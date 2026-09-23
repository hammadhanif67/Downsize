import { encodeToTarget, isSearchCancelled } from './compress';
import { encode } from './encode';
import { resize } from './resize';
import { createSurface, surfaceContext, HAS_OFFSCREEN_CANVAS } from './surface';
import { isAppError } from '../validation';
import type { AppError, SupportedMime } from '../../types';
import type { WorkerRequest, WorkerResponse } from './worker';

// Main-thread side of the pipeline: owns the worker, owns the request
// counter, and owns the fallback (spec §6.7).
//
// Callers never see a bitmap or a canvas. They adopt a file, get an id
// back, and pass that id to jobs — which is what makes the two paths
// interchangeable, because the worker cannot hand a bitmap back anyway.

// Not an error: a result that arrived after something newer started. It
// carries no `kind`, so isAppError can never mistake it for a failure.
export const SUPERSEDED = { superseded: true } as const;
export type Superseded = typeof SUPERSEDED;

export interface AdoptedImage {
  imageId: number;
  width: number;
  height: number;
}

export interface EncodeResult {
  blob: Blob;
  width: number;
  height: number;
}

export interface SearchResult extends EncodeResult {
  quality: number;
  attempts: number;
  reachable: boolean;
}

// ---------------------------------------------------------------------
// Feature detection, once, at module load — not per job.
//
// OffscreenCanvas is the real requirement; Worker itself is universal.
// Construction is still attempted inside a try, because a Content-Security
// Policy can refuse a worker on a page where the API exists.
// ---------------------------------------------------------------------
let worker: Worker | null = null;

if (HAS_OFFSCREEN_CANVAS && typeof Worker !== 'undefined') {
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  } catch {
    worker = null;
  }
}

export const USES_WORKER = worker !== null;

// ---------------------------------------------------------------------
// One counter, as before, but living here rather than in the hook.
//
// Every job path — the debounced encode, the explicit target search, and
// the pass-through commit, which starts no job at all but must invalidate
// whatever is running — calls beginRequest(). A reply whose id is not the
// current one is dropped HERE and resolves as SUPERSEDED, so a stale blob
// never reaches the hook to be committed.
// ---------------------------------------------------------------------
let nextRequestId = 0;
let currentRequestId = 0;

export function beginRequest(): number {
  currentRequestId = ++nextRequestId;
  // Tell the worker to abandon anything older. A target search reads this
  // between attempts and stops rather than finishing six more encodes
  // nobody is waiting for.
  worker?.postMessage({ type: 'cancel', below: currentRequestId } satisfies WorkerRequest);
  return currentRequestId;
}

// ---------------------------------------------------------------------
// Pending replies, keyed by request id.
// ---------------------------------------------------------------------
type Pending = (response: WorkerResponse) => void;
const pending = new Map<number, Pending>();
const adoptions = new Map<number, () => void>();

if (worker) {
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    if (message.type === 'adopted') {
      adoptions.get(message.imageId)?.();
      adoptions.delete(message.imageId);
      return;
    }
    const resolve = pending.get(message.requestId);
    pending.delete(message.requestId);
    resolve?.(message);
  };
}

// ---------------------------------------------------------------------
// Image ownership.
//
// Worker path: the bitmap is TRANSFERRED, which neuters the main thread's
// reference — so nothing on this side may keep one. Fallback path: the
// same bitmap is held in a local map. Either way the caller holds an id.
// ---------------------------------------------------------------------
let nextImageId = 0;
const localBitmaps = new Map<number, ImageBitmap>();

export function adoptBitmap(bitmap: ImageBitmap): Promise<AdoptedImage> {
  const imageId = ++nextImageId;
  const width = bitmap.width;
  const height = bitmap.height;

  if (!worker) {
    localBitmaps.set(imageId, bitmap);
    return Promise.resolve({ imageId, width, height });
  }

  // Resolves only once the worker has acknowledged. That ack is what
  // carries the load-before-release guarantee (§6.2) across the boundary:
  // the caller releases the previous image after this settles, never
  // before, so a failure here leaves the old image whole and usable.
  return new Promise((resolve) => {
    adoptions.set(imageId, () => resolve({ imageId, width, height }));
    worker.postMessage({ type: 'adopt', imageId, bitmap } satisfies WorkerRequest, [bitmap]);
  });
}

export function releaseImage(imageId: number): void {
  alphaByImage.delete(imageId);
  if (worker) {
    worker.postMessage({ type: 'release', imageId } satisfies WorkerRequest);
    return;
  }
  localBitmaps.get(imageId)?.close();
  localBitmaps.delete(imageId);
}

// ---------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------
function isCurrent(requestId: number): boolean {
  return requestId === currentRequestId;
}

export async function runEncode(
  requestId: number,
  imageId: number,
  width: number,
  height: number,
  mime: SupportedMime,
  quality: number | undefined,
  background: string | undefined,
): Promise<EncodeResult | Superseded | AppError> {
  if (worker) {
    const reply = await new Promise<WorkerResponse>((resolve) => {
      pending.set(requestId, resolve);
      worker.postMessage({
        type: 'encode',
        requestId,
        imageId,
        width,
        height,
        mime,
        quality,
        background,
      } satisfies WorkerRequest);
    });
    if (!isCurrent(requestId) || reply.type === 'cancelled') return SUPERSEDED;
    if (reply.type === 'failed') return reply.error;
    if (reply.type !== 'encoded') return SUPERSEDED;
    return { blob: reply.blob, width: reply.width, height: reply.height };
  }

  // Fallback: the same three functions, on this thread. Not a second
  // implementation — the identical imports the worker uses.
  const bitmap = localBitmaps.get(imageId);
  if (!bitmap) return SUPERSEDED;
  const { canvas } = resize(bitmap, width, height, background);
  const blob = await encode(canvas, mime, quality);
  if (isAppError(blob)) return blob;
  if (!isCurrent(requestId)) return SUPERSEDED;
  return { blob, width, height };
}

export async function runTargetSearch(
  requestId: number,
  imageId: number,
  width: number,
  height: number,
  mime: SupportedMime,
  targetBytes: number,
  background: string | undefined,
): Promise<SearchResult | Superseded | AppError> {
  if (worker) {
    const reply = await new Promise<WorkerResponse>((resolve) => {
      pending.set(requestId, resolve);
      worker.postMessage({
        type: 'target',
        requestId,
        imageId,
        width,
        height,
        mime,
        targetBytes,
        background,
      } satisfies WorkerRequest);
    });
    if (!isCurrent(requestId) || reply.type === 'cancelled') return SUPERSEDED;
    if (reply.type === 'failed') return reply.error;
    if (reply.type !== 'searched') return SUPERSEDED;
    return {
      blob: reply.blob,
      width: reply.width,
      height: reply.height,
      quality: reply.quality,
      attempts: reply.attempts,
      reachable: reply.reachable,
    };
  }

  const bitmap = localBitmaps.get(imageId);
  if (!bitmap) return SUPERSEDED;
  const { canvas } = resize(bitmap, width, height, background);
  // Cancellation works on this path too — it just cannot help with the
  // blocking, since the encodes are on the same thread as the UI.
  const found = await encodeToTarget(canvas, mime, targetBytes, () => isCurrent(requestId));
  if (isSearchCancelled(found)) return SUPERSEDED;
  if (isAppError(found)) return found;
  if (!isCurrent(requestId)) return SUPERSEDED;
  return {
    blob: found.blob,
    width,
    height,
    quality: found.quality,
    attempts: found.attempts,
    reachable: found.reachable,
  };
}

// Whether the image has any transparent pixel.
//
// Cached per imageId: it cannot change for a given file, and the answer is
// asked for again every time the user toggles between JPG and the other
// formats. Runs on its own request id so it can never supersede a resize
// or be superseded by one — it is a question about the source, not a job
// that produces output.
const alphaByImage = new Map<number, Promise<boolean>>();

export function imageHasAlpha(imageId: number): Promise<boolean> {
  const known = alphaByImage.get(imageId);
  if (known) return known;

  const answer = (async (): Promise<boolean> => {
    if (worker) {
      const requestId = ++nextRequestId;
      const reply = await new Promise<WorkerResponse>((resolve) => {
        pending.set(requestId, resolve);
        worker.postMessage({ type: 'alpha', requestId, imageId } satisfies WorkerRequest);
      });
      return reply.type === 'alpha-result' ? reply.hasAlpha : false;
    }
    const bitmap = localBitmaps.get(imageId);
    if (!bitmap) return false;
    return scanForAlphaLocally(bitmap);
  })();

  alphaByImage.set(imageId, answer);
  return answer;
}

// Same strip-wise early-exit scan as the worker's. Duplicated rather than
// shared only because the worker's copy is the one that matters; this runs
// exclusively on the no-OffscreenCanvas fallback, where it is already the
// slow path by definition.
const ALPHA_STRIP_ROWS = 256;

function scanForAlphaLocally(bitmap: ImageBitmap): boolean {
  const width = bitmap.width;
  const surface = createSurface(width, Math.min(ALPHA_STRIP_ROWS, bitmap.height));
  const ctx = surfaceContext(surface);
  for (let top = 0; top < bitmap.height; top += ALPHA_STRIP_ROWS) {
    const rows = Math.min(ALPHA_STRIP_ROWS, bitmap.height - top);
    ctx.clearRect(0, 0, width, ALPHA_STRIP_ROWS);
    ctx.drawImage(bitmap, 0, top, width, rows, 0, 0, width, rows);
    const data = ctx.getImageData(0, 0, width, rows).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 255) return true;
    }
  }
  return false;
}

export function isSuperseded(value: unknown): value is Superseded {
  return value === SUPERSEDED;
}

/// <reference lib="webworker" />
import { encodeToTarget, isSearchCancelled } from './compress';
import { encode } from './encode';
import { resize } from './resize';
import { isAppError } from '../validation';
import type { AppError, SupportedMime } from '../../types';

// The whole pipeline, off the main thread (spec §6.7).
//
// resize/encode/compress are imported, not reimplemented — surface.ts is
// the only thing that differed between the two contexts, and it picks
// OffscreenCanvas here the same way it does on the main thread.

// ---------------------------------------------------------------------
// Protocol. Defined here, in the worker, because the worker is the thing
// that speaks it; client.ts imports these as types only, which erases at
// compile time and pulls nothing into the main bundle.
//
// Errors cross as the AppError union — plain objects that structured-clone.
// An Error instance does not survive postMessage intact (message and stack
// go, but the subclass and any custom fields do not), and a discriminated
// union was already the convention everywhere else (§6.3).
// ---------------------------------------------------------------------

export interface AdoptRequest {
  type: 'adopt';
  imageId: number;
  bitmap: ImageBitmap;
}

export interface ReleaseRequest {
  type: 'release';
  imageId: number;
}

export interface EncodeRequest {
  type: 'encode';
  requestId: number;
  imageId: number;
  width: number;
  height: number;
  mime: SupportedMime;
  quality: number | undefined;
}

export interface TargetRequest {
  type: 'target';
  requestId: number;
  imageId: number;
  width: number;
  height: number;
  mime: SupportedMime;
  targetBytes: number;
}

// Sent when the client starts a newer request. Anything older abandons.
export interface CancelRequest {
  type: 'cancel';
  below: number;
}

export type WorkerRequest =
  | AdoptRequest
  | ReleaseRequest
  | EncodeRequest
  | TargetRequest
  | CancelRequest;

export type WorkerResponse =
  | { type: 'adopted'; imageId: number }
  | { type: 'encoded'; requestId: number; blob: Blob; width: number; height: number }
  | {
      type: 'searched';
      requestId: number;
      blob: Blob;
      width: number;
      height: number;
      quality: number;
      attempts: number;
      reachable: boolean;
    }
  | { type: 'cancelled'; requestId: number }
  | { type: 'failed'; requestId: number; error: AppError };

// ---------------------------------------------------------------------

const scope = self as unknown as DedicatedWorkerGlobalScope;

// Source bitmaps live here for the lifetime of the loaded file, addressed
// by id. The alternative — re-decoding per job — would put a full
// createImageBitmap of a 24 MP JPEG on every debounced keystroke, which is
// the cost this whole change exists to remove, reintroduced at a worse
// cadence.
const bitmaps = new Map<number, ImageBitmap>();

// Any request below this has been superseded. The target search reads it
// between attempts; each attempt awaits an encode, which yields to the
// event loop, which is what lets a cancel message land mid-search.
let cancelBelow = 0;

function post(message: WorkerResponse) {
  scope.postMessage(message);
}

function isLive(requestId: number): boolean {
  return requestId >= cancelBelow;
}

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  if (message.type === 'adopt') {
    bitmaps.set(message.imageId, message.bitmap);
    // Acked so the caller can hold the load-before-release guarantee
    // across the boundary: the previous image is only released once this
    // reply has arrived.
    post({ type: 'adopted', imageId: message.imageId });
    return;
  }

  if (message.type === 'release') {
    bitmaps.get(message.imageId)?.close();
    bitmaps.delete(message.imageId);
    return;
  }

  if (message.type === 'cancel') {
    cancelBelow = message.below;
    return;
  }

  const bitmap = bitmaps.get(message.imageId);
  if (!bitmap) {
    // The image was released while this job was queued. Not an error the
    // user caused, and not one worth showing them.
    post({ type: 'cancelled', requestId: message.requestId });
    return;
  }

  if (!isLive(message.requestId)) {
    post({ type: 'cancelled', requestId: message.requestId });
    return;
  }

  const { canvas } = resize(bitmap, message.width, message.height);

  if (message.type === 'encode') {
    const blob = await encode(canvas, message.mime, message.quality);
    if (isAppError(blob)) {
      post({ type: 'failed', requestId: message.requestId, error: blob });
      return;
    }
    post({
      type: 'encoded',
      requestId: message.requestId,
      blob,
      width: message.width,
      height: message.height,
    });
    return;
  }

  const found = await encodeToTarget(canvas, message.mime, message.targetBytes, () =>
    isLive(message.requestId),
  );

  if (isSearchCancelled(found)) {
    post({ type: 'cancelled', requestId: message.requestId });
    return;
  }
  if (isAppError(found)) {
    post({ type: 'failed', requestId: message.requestId, error: found });
    return;
  }
  post({
    type: 'searched',
    requestId: message.requestId,
    blob: found.blob,
    width: message.width,
    height: message.height,
    quality: found.quality,
    attempts: found.attempts,
    reachable: found.reachable,
  });
};

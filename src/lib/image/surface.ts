// A drawing surface that exists in both contexts.
//
// resize/encode/compress are otherwise pure, and the only DOM they touched
// was document.createElement('canvas') and canvas.toBlob. Both have an
// OffscreenCanvas equivalent, so this file is the whole of the difference
// and the three modules above it run unchanged in a worker.
//
// One implementation, two callers — never a forked worker copy. A second
// copy of the stepped-downscale loop is exactly the kind of thing that
// drifts silently and only shows up as a quality regression months later.

export type Surface = HTMLCanvasElement | OffscreenCanvas;

// Detected once, at module load, not per call.
export const HAS_OFFSCREEN_CANVAS =
  typeof OffscreenCanvas !== 'undefined' && typeof OffscreenCanvas.prototype.convertToBlob === 'function';

export function createSurface(width: number, height: number): Surface {
  // Preferred even on the main thread: it is the same rasteriser without
  // an element attached, so the fallback path and the worker path produce
  // identical bytes. If they diverged, "it works, just slowly" would be a
  // lie about the output as well as the speed.
  if (HAS_OFFSCREEN_CANVAS) return new OffscreenCanvas(width, height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function surfaceContext(surface: Surface): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  // Context creation only fails in unsupported environments; the spec's own
  // pseudocode asserts non-null the same way.
  return surface.getContext('2d', { alpha: true }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;
}

// The two APIs differ in shape as well as name: convertToBlob takes an
// options object and returns a promise that REJECTS on failure, toBlob
// takes a callback that receives null. Both are normalised to
// "resolves with a Blob, or null".
export function surfaceToBlob(
  surface: Surface,
  mime: string,
  quality: number | undefined,
): Promise<Blob | null> {
  try {
    // Duck-typed, NOT `surface instanceof OffscreenCanvas`.
    //
    // On a browser without OffscreenCanvas that global is not defined, and
    // `x instanceof undefined` throws a TypeError — so the instanceof
    // version broke the fallback path in precisely the browsers the
    // fallback exists for, and nowhere else. It rejected inside encode(),
    // which is not a path that returns AppError, so the failure was silent:
    // no result, no error, the UI simply stopped updating.
    const offscreen = surface as OffscreenCanvas;
    if (typeof offscreen.convertToBlob === 'function') {
      return offscreen.convertToBlob({ type: mime, quality }).catch(() => null);
    }
    return new Promise((resolve) => {
      (surface as HTMLCanvasElement).toBlob((blob) => resolve(blob), mime, quality);
    });
  } catch {
    // Anything unexpected becomes a null, which encode() turns into
    // { kind: 'encode-failed' }. lib/ does not throw (§6.3), and a
    // rejection here would surface as nothing at all rather than as an
    // error the user can see.
    return Promise.resolve(null);
  }
}

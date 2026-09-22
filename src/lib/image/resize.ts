import { MAX_DOWNSCALE_STEPS } from '../constants';

export interface ResizeOutput {
  canvas: HTMLCanvasElement;
  // Number of halving iterations the stepped-downscale loop actually ran.
  // Exposed (rather than just returning the canvas per the spec's literal
  // §6.4 signature) because it's the only externally-observable proof that
  // the per-axis loop fired instead of silently falling through to a single
  // drawImage — which is exactly the kind of quality regression this
  // function exists to prevent.
  steps: number;
}

function makeContext(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  // Context creation only fails in unsupported environments; the spec's own
  // pseudocode asserts non-null the same way.
  const ctx = canvas.getContext('2d', { alpha: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

// Stepped downscaling (§6.4 MUST). A single drawImage from 4000px to 400px
// aliases badly — the browser samples too few source pixels. Each axis
// halves independently and clamps so it can't undershoot its target while
// the other axis is still catching up; an axis that's already within 2x (or
// needs upscaling) passes through untouched. This is what fixes the
// aspect-changing-preset case that a shared `&&` condition breaks: one axis
// can need eight halvings while the other needs none.
export function resize(bitmap: ImageBitmap, targetWidth: number, targetHeight: number): ResizeOutput {
  let current: CanvasImageSource = bitmap;
  let cw = bitmap.width;
  let ch = bitmap.height;
  let steps = 0;

  while ((cw > targetWidth * 2 || ch > targetHeight * 2) && steps < MAX_DOWNSCALE_STEPS) {
    const nw = cw > targetWidth ? Math.max(targetWidth, Math.floor(cw / 2)) : cw;
    const nh = ch > targetHeight ? Math.max(targetHeight, Math.floor(ch / 2)) : ch;
    const ctx = makeContext(nw, nh);
    ctx.drawImage(current, 0, 0, nw, nh);
    current = ctx.canvas;
    cw = nw;
    ch = nh;
    steps++;
  }

  const finalCtx = makeContext(targetWidth, targetHeight);
  finalCtx.drawImage(current, 0, 0, targetWidth, targetHeight);

  return { canvas: finalCtx.canvas, steps };
}

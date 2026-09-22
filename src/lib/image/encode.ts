import type { AppError, SupportedMime } from '../../types';

// `quality` stays in the signature but unused in v1 (PNG ignores it anyway,
// and quality controls are explicitly out of scope — spec §2, §6.5) so
// Phase 2 slots in without touching call sites.
export function encode(canvas: HTMLCanvasElement, mime: SupportedMime, quality?: number): Promise<Blob | AppError> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob ?? { kind: 'encode-failed' });
      },
      mime,
      quality,
    );
  });
}

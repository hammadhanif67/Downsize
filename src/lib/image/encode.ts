import type { AppError, SupportedMime } from '../../types';

// `quality` is 0–1, as canvas.toBlob takes it.
//
// PNG ignores it, and that is not a limitation to route around: PNG is
// lossless, there is no quality axis to turn, and toBlob's third argument
// is defined to be ignored for any type that is not lossy. Dropping it
// here rather than at every call site means nothing upstream has to
// remember which formats have a quality and which do not — and it makes
// "quality 60 on a PNG" impossible to express rather than merely
// ineffective.
export function encode(
  canvas: HTMLCanvasElement,
  mime: SupportedMime,
  quality?: number,
): Promise<Blob | AppError> {
  const effective = mime === 'image/png' ? undefined : quality;
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob ?? { kind: 'encode-failed' });
      },
      mime,
      effective,
    );
  });
}

// Whether a format has a quality axis at all. The Compress panel reads
// this rather than testing the mime itself, so the one place that knows
// PNG is lossless is this file.
export function supportsQuality(mime: SupportedMime): boolean {
  return mime !== 'image/png';
}

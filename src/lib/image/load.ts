import { MAX_SOURCE_PIXELS } from '../constants';
import { isSupportedMime, validateFile } from '../validation';
import type { AppError, SourceImage } from '../../types';

// createImageBitmap's options argument is async-validated — a browser that
// doesn't understand `imageOrientation` rejects the returned promise rather
// than throwing synchronously, so the try/catch has to wrap the await, not
// the call expression. Without `from-image`, phone photos come out rotated.
async function decodeBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(0, dot) : filename;
}

// Returns the AppError union directly on failure, same convention as
// validateFile — no throwing, no promise rejection carrying the error.
export async function loadImage(file: File): Promise<SourceImage | AppError> {
  const validationError = validateFile(file);
  if (validationError) return validationError;

  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeBitmap(file);
  } catch {
    // A .png that's actually garbage decodes this far and dies here.
    return { kind: 'decode-failed' };
  }

  if (bitmap.width * bitmap.height > MAX_SOURCE_PIXELS) {
    bitmap.close(); // rejecting it, not keeping it — must not leak
    return { kind: 'dimensions-too-large', width: bitmap.width, height: bitmap.height };
  }

  if (!isSupportedMime(file.type)) {
    // Unreachable — validateFile already checked this — but narrows the
    // type without an `as` assertion.
    bitmap.close();
    return { kind: 'unsupported-type', received: file.type };
  }

  return {
    file,
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    bytes: file.size,
    mime: file.type,
    name: stripExtension(file.name),
    previewUrl: URL.createObjectURL(file),
  };
}

// Memory discipline (§6.2 MUST): object URLs and bitmaps are not garbage
// collected on their own. Centralized here so every call site that replaces
// a SourceImage does the same two-line release instead of reimplementing it.
export function releaseSourceImage(source: SourceImage): void {
  URL.revokeObjectURL(source.previewUrl);
  source.bitmap.close();
}

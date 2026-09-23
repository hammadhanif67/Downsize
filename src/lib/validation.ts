import {
  ACCEPTED_MIMES,
  MAX_FILE_BYTES,
  MAX_OUTPUT_DIMENSION,
  MAX_PERCENTAGE,
  MIN_OUTPUT_DIMENSION,
  MIN_PERCENTAGE,
} from './constants';
import type { AppError, ResizeSettings, SupportedMime } from '../types';

// Narrows an unknown MIME string to SupportedMime. Never trust the file
// extension — this is read from file.type, and an empty string (some
// browsers/OSes report no MIME for unrecognized files) simply fails to
// narrow, which is what routes it to `unsupported-type`.
export function isSupportedMime(value: string): value is SupportedMime {
  return (ACCEPTED_MIMES as readonly string[]).includes(value);
}

// Pre-decode gate only (spec §6.3, checks 1–2). Decode itself is async and
// lives in lib/image/load.ts, along with the post-decode pixel-count check —
// neither can run here since both require actually opening the file.
//
// Returns the AppError directly, no throwing: `const err = validateFile(file); if (err) return err;`
export function validateFile(file: File): AppError | null {
  if (!isSupportedMime(file.type)) {
    return { kind: 'unsupported-type', received: file.type };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { kind: 'too-large', bytes: file.size };
  }
  return null;
}

// Guards against NaN/Infinity reaching a canvas dimension or the percentage
// range — both would otherwise either throw at canvas creation or silently
// break the resize math. An emptied field mid-edit is exactly how a NaN gets
// here (spec §9.3: fields clamp on blur, so they can go briefly empty).
export function clampDimension(value: number): number {
  const safe = Number.isFinite(value) ? value : MIN_OUTPUT_DIMENSION;
  return Math.min(MAX_OUTPUT_DIMENSION, Math.max(MIN_OUTPUT_DIMENSION, Math.round(safe)));
}

export function clampPercentage(value: number): number {
  const safe = Number.isFinite(value) ? value : MIN_PERCENTAGE;
  return Math.min(MAX_PERCENTAGE, Math.max(MIN_PERCENTAGE, Math.round(safe)));
}

// Every path into resize() goes through this — typed input, preset,
// percentage, all of them (spec §6.3).
export function clampSettings(settings: ResizeSettings): ResizeSettings {
  return {
    ...settings,
    width: clampDimension(settings.width),
    height: clampDimension(settings.height),
    percentage: clampPercentage(settings.percentage),
  };
}

// The actual pixel target a ResizeSettings implies, for whichever mode is
// active. clampSettings() alone isn't enough for this: in percentage mode,
// settings.width/height are stale leftovers from whatever 'dimensions' edit
// happened last, not the number to resize to — the real target has to be
// derived from the source size instead. This is what every call site
// feeding resize() should use, not clampSettings() directly.
export function resolveTargetSize(
  settings: ResizeSettings,
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  if (settings.mode === 'percentage') {
    const percentage = clampPercentage(settings.percentage);
    return {
      width: clampDimension(Math.round((sourceWidth * percentage) / 100)),
      height: clampDimension(Math.round((sourceHeight * percentage) / 100)),
    };
  }
  return { width: clampDimension(settings.width), height: clampDimension(settings.height) };
}

// Shared with useImageFile and useImagePipeline — both need to tell a decoded
// result apart from the AppError union without an `any`.
const ERROR_KINDS = new Set<string>([
  'unsupported-type',
  'too-large',
  'decode-failed',
  'dimensions-too-large',
  'encode-failed',
]);

export function isAppError(value: unknown): value is AppError {
  // Checks the kind against the known set rather than merely testing that
  // a `kind` property exists. The loose version was one carelessly-shaped
  // sentinel away from rendering a cancellation to the user as a failure,
  // and it silently widened every time a non-error object with a `kind`
  // passed through.
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string' &&
    ERROR_KINDS.has((value as { kind: string }).kind)
  );
}

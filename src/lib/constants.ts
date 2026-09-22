// Single-source-of-truth numbers for the image pipeline and settings clamps
// (spec §6.1). Every limit in the app traces back to one of these.

export const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30 MB
export const MAX_SOURCE_PIXELS = 50_000_000; // ~50 MP guard
export const MAX_OUTPUT_DIMENSION = 12_000; // canvas safety ceiling
export const MIN_OUTPUT_DIMENSION = 1;
export const MIN_PERCENTAGE = 1;
export const MAX_PERCENTAGE = 100;
export const ACCEPTED_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_DOWNSCALE_STEPS = 16; // safety cap on the stepped-downscale loop (§6.4)
export const MAX_FILENAME_LENGTH = 60; // §6.6
export const RESIZE_DEBOUNCE_MS = 250; // §6.8

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

// Quality, as canvas.toBlob takes it: 0–1. The UI shows it as 30–95, which
// is the same number times 100 — the search walks a grid of n/100 so the
// quality it reports is exactly the one it encoded at, and re-encoding at
// that value reproduces the same bytes.
export const MIN_QUALITY = 0.3;
export const MAX_QUALITY = 0.95;

// 0.92 is Chrome's own default for image/jpeg, so a user who never touches
// the slider gets what they got before this existed. WEBP is the exception:
// Chrome defaults that to 0.8, so WEBP output moves up slightly. That is
// the price of the number being visible and stated — a control that shows
// "92" while the browser silently used 80 is worse than a small change in
// output size.
export const DEFAULT_QUALITY = 0.92;

// Each attempt is a full encode of a full-size canvas, so this is a real
// budget, not a formality (§6.9).
export const MAX_QUALITY_SEARCH_ATTEMPTS = 8;

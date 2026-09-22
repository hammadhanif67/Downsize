// Byte + dimension formatting (spec §4). Pure string/number functions —
// no React, no DOM — so components never do their own math on these values.

type ByteUnit = 'B' | 'KB' | 'MB' | 'GB';

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

function toDisplayUnit(bytes: number): { value: number; unit: ByteUnit } {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (safe >= GB) return { value: safe / GB, unit: 'GB' };
  if (safe >= MB) return { value: safe / MB, unit: 'MB' };
  if (safe >= KB) return { value: safe / KB, unit: 'KB' };
  return { value: safe, unit: 'B' };
}

function unitBytes(unit: ByteUnit): number {
  switch (unit) {
    case 'GB':
      return GB;
    case 'MB':
      return MB;
    case 'KB':
      return KB;
    case 'B':
      return 1;
  }
}

// One decimal below 10 in the display unit, integer at 10 and above; whole
// bytes never get a decimal (there's no such thing as 0.5 bytes).
function roundForDisplay(value: number, unit: ByteUnit): number {
  const decimals = unit !== 'B' && value < 10 ? 1 : 0;
  return Number(value.toFixed(decimals));
}

export function formatBytes(bytes: number): string {
  const { value, unit } = toDisplayUnit(bytes);
  return `${roundForDisplay(value, unit)} ${unit}`;
}

export function formatDimensions(width: number, height: number): string {
  return `${width} × ${height}`;
}

// The byte count implied by what's actually printed on screen — e.g. for
// "4.2 MB" this is 4.2 * 1024 * 1024, not the exact source byte count. The
// savings percentage below is built from these, not from the raw values, on
// purpose: it's the only way the percentage can never contradict the two
// numbers sitting next to it. If a person manually redid the arithmetic with
// a calculator using exactly the digits they can see, they'd get the same
// answer Downsize shows.
function displayedByteEquivalent(bytes: number): number {
  const { value, unit } = toDisplayUnit(bytes);
  return roundForDisplay(value, unit) * unitBytes(unit);
}

// Positive = shrank, negative = grew. Unrounded — callers that need copy
// thresholds (formatSavings) need the true magnitude, not a pre-rounded one.
function savingsFraction(beforeBytes: number, afterBytes: number): number {
  const before = displayedByteEquivalent(beforeBytes);
  const after = displayedByteEquivalent(afterBytes);
  if (before <= 0) return 0;
  return (before - after) / before;
}

export function calculateSavingsPercent(beforeBytes: number, afterBytes: number): number {
  return Math.round(savingsFraction(beforeBytes, afterBytes) * 100);
}

// Three cases, not two — PNG-from-JPEG (§6.5) and upscaling can both make
// the result *larger* than the source, and a sub-1% change either way would
// otherwise round to a misleading "0% smaller". The 1% cutoff is checked
// against the true fraction, not the rounded percent, so a real 0.4% change
// can't slip through and print as "0% smaller".
export function formatSavings(beforeBytes: number, afterBytes: number): string {
  const fraction = savingsFraction(beforeBytes, afterBytes);
  if (Math.abs(fraction) < 0.01) return 'About the same size';
  const percent = Math.round(Math.abs(fraction) * 100);
  return fraction > 0 ? `${percent}% smaller` : `File is ${percent}% bigger`;
}

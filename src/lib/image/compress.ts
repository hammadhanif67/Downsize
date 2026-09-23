import { MAX_QUALITY, MAX_QUALITY_SEARCH_ATTEMPTS, MIN_QUALITY } from '../constants';
import { isAppError } from '../validation';
import { encode } from './encode';
import type { Surface } from './surface';
import type { AppError, SupportedMime } from '../../types';

// Cancellation is not an error, and it must not be mistakable for one.
// A `{ kind: 'cancelled' }` object would have passed isAppError and been
// rendered to the user as a failure.
export const SEARCH_CANCELLED = { cancelled: true } as const;
export type SearchCancelled = typeof SEARCH_CANCELLED;

// A predicate, not `=== SEARCH_CANCELLED` at call sites: an object type is
// not a unit type, so TypeScript does not narrow a union on identity
// comparison with one. Without this the callers compiled but kept
// SearchCancelled in the type of every subsequent access.
export function isSearchCancelled(value: unknown): value is SearchCancelled {
  return value === SEARCH_CANCELLED;
}

export interface TargetSearch {
  blob: Blob;
  // 0–1, and always a value the search actually encoded at — never an
  // interpolation. Re-encoding the same canvas at this quality reproduces
  // this blob's size exactly, which is what makes the number worth showing.
  quality: number;
  attempts: number;
  // false means every quality down to MIN_QUALITY still overshot. The blob
  // is the MIN_QUALITY one — the smallest this format can do at these
  // dimensions — and the caller must say so rather than present it as a hit.
  reachable: boolean;
}

// Binary search for the highest quality whose encode lands at or under
// targetBytes (spec §6.9).
//
// It walks whole percentage points rather than the continuous range.
// Bisecting a float converges on something like 0.6414062, and a UI that
// reports "quality 64" while having encoded at 0.6414062 is lying by a
// small amount — re-encode at 0.64 and the size moves. On an integer grid
// the reported number and the encoded number are the same number.
//
// Returns AppError rather than throwing, same as every other lib/ function
// — encode() can genuinely fail (toBlob handing back null) and the caller
// already knows how to render an AppError. This widens the signature past
// the one in the Phase B brief, which had no failure arm; the alternative
// was throwing out of lib/, which §6.3 rules out.
//
// Assumes size decreases monotonically with quality. That holds for JPEG
// and WEBP in practice; it is not guaranteed by any spec, and a
// non-monotonic encoder would make the search land on a valid-but-not-
// optimal quality. It would still never return something over target,
// because only encodes that actually fit are ever kept.
export async function encodeToTarget(
  canvas: Surface,
  mime: SupportedMime,
  targetBytes: number,
  // Checked between attempts, never mid-encode. A superseded search should
  // abandon rather than finish six more encodes nobody is waiting for —
  // each one is a full encode of a full-size canvas, and on a 24 MP image
  // that is seconds of work thrown away.
  shouldContinue: () => boolean = () => true,
): Promise<TargetSearch | SearchCancelled | AppError> {
  let attempts = 0;

  const attempt = async (points: number): Promise<{ blob: Blob; quality: number } | AppError> => {
    const quality = points / 100;
    const blob = await encode(canvas, mime, quality);
    attempts += 1;
    if (isAppError(blob)) return blob;
    return { blob, quality };
  };

  const hiPoints = Math.round(MAX_QUALITY * 100);
  const loPoints = Math.round(MIN_QUALITY * 100);

  // Probe the top first. A modest target on an already-resized image very
  // often fits at full quality, and that case should cost one encode, not
  // eight.
  const top = await attempt(hiPoints);
  if (isAppError(top)) return top;
  if (!shouldContinue()) return SEARCH_CANCELLED;
  if (top.blob.size <= targetBytes) {
    return { blob: top.blob, quality: top.quality, attempts, reachable: true };
  }

  // Then the bottom — before searching, not after. This is what guarantees
  // a known-good blob exists for the rest of the run: every later probe
  // either fits (and becomes the new best) or is discarded, so the function
  // can never be in a position where it has to return an overshooting blob
  // and call it a success.
  const bottom = await attempt(loPoints);
  if (isAppError(bottom)) return bottom;
  if (!shouldContinue()) return SEARCH_CANCELLED;
  if (bottom.blob.size > targetBytes) {
    return { blob: bottom.blob, quality: bottom.quality, attempts, reachable: false };
  }

  // Invariant from here: loPoints fits, hiPoints does not. Narrow until
  // they are adjacent, which the remaining budget covers — 6 bisections
  // over 65 steps leaves an interval of 65/64 < 2.
  let low = loPoints;
  let high = hiPoints;
  let best = bottom;

  while (attempts < MAX_QUALITY_SEARCH_ATTEMPTS && high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    const probe = await attempt(mid);
    if (isAppError(probe)) return probe;
    if (!shouldContinue()) return SEARCH_CANCELLED;
    if (probe.blob.size <= targetBytes) {
      low = mid;
      best = probe;
    } else {
      high = mid;
    }
  }

  return { blob: best.blob, quality: best.quality, attempts, reachable: true };
}

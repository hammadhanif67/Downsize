import { formatBytes, formatDimensions, formatSavings } from '../../lib/format';
import type { ResizeResult, SourceImage } from '../../types';

interface SizeComparisonProps {
  source: SourceImage;
  result: ResizeResult | null;
}

// Before/After thumbnails, not a text-only comparison line. Both boxes are
// a fixed 160px square regardless of either image's own aspect ratio
// (object-contain letterboxes inside it) — that's what keeps the layout
// stable while a resize is in flight: `result` only ever updates on a
// successful encode (see useImagePipeline), so the "After" box keeps showing the
// previous result at its same fixed size right up until a new one replaces
// it, never a smaller/blank box in between.
//
// No percentage math here: formatSavings already returns the finished
// "N% smaller" / "File is N% bigger" / "About the same size" string,
// derived from the exact same numbers this component prints.
function SizeComparison({ source, result }: SizeComparisonProps) {
  return (
    <div aria-live="polite">
      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-caption text-ink-muted">Before</p>
          {/* Capped at 160px but allowed to shrink: two fixed 160px boxes
              plus the gap came to 344px, which overflowed the 313px of
              content width available at a 360px viewport. aspect-square
              keeps it a fixed-shape box driven by the column rather than
              by the image, so it still never reflows when the result
              updates. */}
          <div className="mt-1 flex aspect-square w-full max-w-40 items-center justify-center border border-rule bg-surface">
            <img src={source.previewUrl} alt="" className="max-h-full max-w-full object-contain" />
          </div>
          <p className="mt-1 font-mono text-caption text-ink-muted">{formatDimensions(source.width, source.height)}</p>
          <p className="font-mono text-caption text-ink-muted">{formatBytes(source.bytes)}</p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-caption text-ink-muted">After</p>
          <div className="mt-1 flex aspect-square w-full max-w-40 items-center justify-center border border-rule bg-surface">
            {result && <img src={result.previewUrl} alt="" className="max-h-full max-w-full object-contain" />}
          </div>
          <p className="mt-1 font-mono text-caption text-ink-muted">
            {result ? formatDimensions(result.width, result.height) : '—'}
          </p>
          <p className="font-mono text-caption text-ink-muted">{result ? formatBytes(result.bytes) : ' '}</p>
        </div>
      </div>

      {/* Bumped to 18px/500/--ink against the 13px mono --ink-muted rows
          above — size and weight carry the hierarchy; --accent marks
          interactive state only (focus ring, selected preset, drag-active,
          download button) and this is a static readout, not a state. */}
      {result && <p className="mt-4 text-h3 font-medium text-ink">{formatSavings(source.bytes, result.bytes)}</p>}
    </div>
  );
}

export default SizeComparison;

import { formatBytes, formatDimensions } from '../../lib/format';
import Spinner from '../ui/Spinner';

interface ImageCanvasProps {
  src: string;
  width: number;
  height: number;
  // Always the SOURCE's own numbers, independent of what's currently
  // displayed (src/width/height above track source-or-result). This is a
  // persistent "what you started with" badge, not a live readout of what's
  // in the frame — the before/after block covers that comparison already.
  sourceWidth: number;
  sourceHeight: number;
  sourceBytes: number;
  isProcessing: boolean;
}

interface Tick {
  position: number;
  tall: boolean;
}

// Short marks every 100 source pixels, taller marks every 500 — this is
// what makes it read as a ruler at a glance instead of a stray border. The
// true edge is always included even when it isn't a multiple of 100, so the
// bracket still closes exactly at the frame.
function getTicks(length: number): Tick[] {
  const ticks: Tick[] = [];
  for (let p = 0; p <= length; p += 100) {
    ticks.push({ position: p, tall: p % 500 === 0 });
  }
  if (ticks[ticks.length - 1]?.position !== length) {
    ticks.push({ position: length, tall: false });
  }
  return ticks;
}

// The one ornament in the app (§9.1), desktop only (≥1024px) — at mobile
// width the gutter this needs to reserve costs more than the single number
// it delivers, and the same dimensions already live in the size-comparison
// block, so below 1024px there's no ruler and no reserved space at all:
// the image runs edge to edge in its column.
//
// Each ruler is a flex box anchored to the end nearest the image (justify-
// end), label tight against its line. Interval ticks are positioned by
// percentage along that line — 4px short, 8px tall at every 500 — so what
// used to be a bracket with one number now actually reads as a ruler.
function ImageCanvas({ src, width, height, sourceWidth, sourceHeight, sourceBytes, isProcessing }: ImageCanvasProps) {
  const widthTicks = getTicks(width);
  const heightTicks = getTicks(height);

  return (
    <div className="lg:pt-6 lg:pl-14">
      <div className="relative">
        {/* Top ruler — width, desktop only */}
        <div
          aria-hidden="true"
          className="absolute -top-6 right-0 left-0 hidden h-6 flex-col items-end justify-end gap-1 lg:flex"
        >
          <span className="font-mono text-[11px] leading-none text-ink-muted">{width}</span>
          <div className="relative h-2 w-full">
            <div className="absolute inset-x-0 bottom-0 border-t border-rule" />
            {widthTicks.map(({ position, tall }) => (
              <div
                key={position}
                className="absolute bottom-0 border-l border-rule"
                style={{ left: `${(position / width) * 100}%`, height: tall ? '8px' : '4px' }}
              />
            ))}
          </div>
        </div>

        {/* Left ruler — height, desktop only */}
        <div aria-hidden="true" className="absolute top-0 bottom-0 -left-14 hidden w-14 items-end justify-end gap-1 lg:flex">
          <span className="font-mono text-[11px] leading-none text-ink-muted">{height}</span>
          <div className="relative h-full w-2">
            <div className="absolute inset-y-0 right-0 border-r border-rule" />
            {heightTicks.map(({ position, tall }) => (
              <div
                key={position}
                className="absolute right-0 border-t border-rule"
                style={{ top: `${(position / height) * 100}%`, width: tall ? '8px' : '4px' }}
              />
            ))}
          </div>
        </div>

        {/* Preview frame: 0 radius, a real border because it IS the frame,
            no shadow. The aspect-ratio box is reserved from the same render
            that first has width/height — there's no moment where this
            renders without knowing them, so there's no layout shift to
            reserve against later (spec §11.6). */}
        <div
          className="relative w-full overflow-hidden border border-rule bg-surface"
          style={{ aspectRatio: `${width} / ${height}` }}
        >
          <img
            src={src}
            alt=""
            className="h-full w-full object-contain transition-opacity duration-150"
            style={{ opacity: isProcessing ? 0.6 : 1 }}
          />
          <div className="absolute top-2 left-2 bg-surface px-2 py-1">
            <span className="font-mono text-caption text-ink-muted">
              {formatDimensions(sourceWidth, sourceHeight)} · {formatBytes(sourceBytes)}
            </span>
          </div>
          {isProcessing && (
            <div className="absolute right-2 bottom-2">
              <Spinner className="h-5 w-5 text-ink-muted" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImageCanvas;

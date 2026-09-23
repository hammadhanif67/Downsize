import { MAX_QUALITY, MIN_QUALITY } from '../../lib/constants';
import { formatBytes } from '../../lib/format';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import type { CompressMode, CompressOutcome, CompressSettings, ResizeResult, SizeUnit } from '../../types';

interface CompressControlsProps {
  compress: CompressSettings;
  outputLabel: string;
  convertingTo: boolean;
  result: ResizeResult | null;
  outcome: CompressOutcome | null;
  canCompress: boolean;
  isSearching: boolean;
  setQuality: (quality: number) => void;
  setCompressMode: (mode: CompressMode) => void;
  setTargetValue: (value: number) => void;
  setTargetUnit: (unit: SizeUnit) => void;
  resetCompress: () => void;
  runTargetSearch: () => void;
}

// The slider and the readout work in whole percentage points, which is the
// same grid the target search walks. lib/ speaks 0–1 because that is what
// canvas.toBlob takes; this is the only place the two meet.
const MIN_POINTS = Math.round(MIN_QUALITY * 100);
const MAX_POINTS = Math.round(MAX_QUALITY * 100);

function outcomeLine(outcome: CompressOutcome): string {
  const quality = Math.round(outcome.quality * 100);
  if (!outcome.reachable) {
    const target = formatBytes(outcome.targetBytes);
    const smallest = formatBytes(outcome.bytes);
    // When the overshoot is small enough that both numbers round to the
    // same label, the obvious sentence contradicts itself: "Couldn't get
    // under 110 KB. Smallest is 110 KB." Seen in testing with a 112,640
    // byte result against a 110 KB target. Say what is actually true
    // instead of printing two identical numbers and leaving the reader to
    // decide which one is wrong.
    if (target === smallest) {
      return `Couldn't get under ${target}. The smallest this image encodes to is just over it, at quality ${quality}.`;
    }
    // Says what happened, in the same words a person would use. Not
    // "target not met" — that reads as the tool deflecting.
    return `Couldn't get under ${target}. Smallest is ${smallest} at quality ${quality}.`;
  }
  return `Quality ${quality} · ${outcome.attempts} ${outcome.attempts === 1 ? 'attempt' : 'attempts'}`;
}

function CompressControls({
  compress,
  outputLabel,
  convertingTo,
  result,
  outcome,
  canCompress,
  isSearching,
  setQuality,
  setCompressMode,
  setTargetValue,
  setTargetUnit,
  resetCompress,
  runTargetSearch,
}: CompressControlsProps) {
  const isTarget = compress.mode === 'target';
  const points = Math.round(compress.quality * 100);

  // PNG — whether that is the source format or one the Convert tab chose.
  // Not a disabled slider with a tooltip: the whole mode is off and the
  // reason is stated, because the honest answer is that the format has no
  // quality axis, and the useful next step is a different control. Faking
  // it by quietly downscaling would "work" and would be a lie about what
  // the user asked for.
  if (!canCompress) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-body text-ink">
          {outputLabel} has no quality setting. Reduce the dimensions instead.
        </p>
        <p className="text-body text-ink-muted">
          {outputLabel} stores every pixel exactly. The only way to make one smaller is to make it
          smaller.
          {convertingTo && ' The Convert tab is what put the output in this format.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Same row shape as the resize panel: two explicit radios, Reset
          right-aligned. */}
      <div className="flex items-center justify-between gap-4">
        <fieldset className="m-0 flex gap-4 border-0 p-0">
          <legend className="sr-only">Compress by</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-body text-ink">
            <input
              type="radio"
              name="compress-mode"
              value="quality"
              checked={!isTarget}
              onChange={() => setCompressMode('quality')}
              className="h-4 w-4"
            />
            Quality
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-body text-ink">
            <input
              type="radio"
              name="compress-mode"
              value="target"
              checked={isTarget}
              onChange={() => setCompressMode('target')}
              className="h-4 w-4"
            />
            Target size
          </label>
        </fieldset>

        <button
          type="button"
          onClick={resetCompress}
          className="focus-ring flex min-h-11 items-center text-body text-ink-muted underline"
        >
          Reset
        </button>
      </div>

      {isTarget ? (
        <>
          <div className="flex items-center gap-4">
            <label htmlFor="target-size" className="w-20 shrink-0 text-body text-ink">
              Target
            </label>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input
                id="target-size"
                type="number"
                inputMode="numeric"
                min={1}
                value={compress.targetValue}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  if (e.target.value !== '' && Number.isFinite(parsed)) setTargetValue(parsed);
                }}
                // text-base (16px) for the same reason as NumberField: iOS
                // zooms the viewport on focus for anything under 16px.
                className="focus-ring min-h-11 w-20 min-w-0 border border-rule-strong bg-transparent px-2 py-1.5 text-right font-mono text-base text-ink transition-colors duration-[120ms] focus-visible:border-accent"
              />
              <label htmlFor="target-unit" className="sr-only">
                Unit
              </label>
              {/* Interactive, so --rule-strong. A native select rather than
                  a custom listbox: two options, and the OS picker is
                  better than anything worth building here. color-scheme on
                  :root is what makes it render dark in dark mode. */}
              <select
                id="target-unit"
                value={compress.targetUnit}
                onChange={(e) => setTargetUnit(e.target.value as SizeUnit)}
                className="focus-ring min-h-11 border border-rule-strong bg-paper px-2 text-body text-ink transition-colors duration-[120ms] focus-visible:border-accent"
              >
                <option value="KB">KB</option>
                <option value="MB">MB</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span aria-hidden="true" className="w-20 shrink-0" />
            <Button onClick={runTargetSearch} disabled={isSearching} className="flex items-center gap-2">
              {isSearching && <Spinner className="h-4 w-4" />}
              {isSearching ? 'Compressing…' : 'Compress'}
            </Button>
          </div>
        </>
      ) : (
        <div>
          {/* Same w-20 / w-28 columns as the resize panel, so the readout
              lines up with Width and Height above it. */}
          <div className="flex items-center gap-4">
            <label htmlFor="quality" className="w-20 shrink-0 text-body text-ink">
              Quality
            </label>
            <span className="w-28 text-right font-mono text-caption text-ink-muted">{points}</span>
          </div>
          <input
            id="quality"
            type="range"
            min={MIN_POINTS}
            max={MAX_POINTS}
            value={points}
            onChange={(e) => setQuality(Number(e.target.value) / 100)}
            className="focus-ring mt-2 w-full accent-accent"
          />
        </div>
      )}

      {/* One live readout for both modes: what the output currently weighs.
          aria-live so a screen reader hears it settle rather than having to
          go looking. */}
      <p aria-live="polite" className="font-mono text-caption text-ink-muted">
        {result ? `Output ${formatBytes(result.bytes)}` : 'Output —'}
      </p>

      {outcome && <p className="font-mono text-caption text-ink-muted">{outcomeLine(outcome)}</p>}
    </div>
  );
}

export default CompressControls;

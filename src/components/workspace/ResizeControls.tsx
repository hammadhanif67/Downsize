import { clampDimension } from '../../lib/validation';
import { MAX_PERCENTAGE, MIN_PERCENTAGE } from '../../lib/constants';
import NumberField from '../ui/NumberField';
import Toggle from '../ui/Toggle';
import type { ResizeSettings } from '../../types';

interface ResizeControlsProps {
  settings: ResizeSettings;
  setWidth: (value: number) => void;
  setHeight: (value: number) => void;
  setPercentage: (value: number) => void;
  setMode: (mode: 'dimensions' | 'percentage') => void;
  toggleLock: () => void;
  reset: () => void;
}

function ResizeControls({ settings, setWidth, setHeight, setPercentage, setMode, toggleLock, reset }: ResizeControlsProps) {
  const isPercentage = settings.mode === 'percentage';

  return (
    <div className="flex flex-col gap-4">
      {/* Reset lives on this row, right-aligned — it's a mode-level action,
          not a field-level one, and the row had empty space doing nothing. */}
      <div className="flex items-center justify-between gap-4">
        {/* Two explicit, visible states — not an inferred "whichever
            control you touched last." The inactive group's inputs carry
            the real HTML disabled attribute, not just a dimmed look, so
            nothing on screen can appear interactive while actually being
            ignored. */}
        <fieldset className="m-0 flex gap-4 border-0 p-0">
          <legend className="sr-only">Resize by</legend>
          <label className="flex items-center gap-2 text-body text-ink">
            <input
              type="radio"
              name="resize-mode"
              value="dimensions"
              checked={!isPercentage}
              onChange={() => setMode('dimensions')}
            />
            Exact size
          </label>
          <label className="flex items-center gap-2 text-body text-ink">
            <input
              type="radio"
              name="resize-mode"
              value="percentage"
              checked={isPercentage}
              onChange={() => setMode('percentage')}
            />
            Percentage
          </label>
        </fieldset>

        <button type="button" onClick={reset} className="focus-ring text-body text-ink-muted underline">
          Reset
        </button>
      </div>

      <NumberField
        id="width"
        label="Width"
        value={settings.width}
        disabled={isPercentage}
        onChange={setWidth}
        onCommit={(value) => setWidth(clampDimension(value))}
      />
      <NumberField
        id="height"
        label="Height"
        value={settings.height}
        disabled={isPercentage}
        onChange={setHeight}
        onCommit={(value) => setHeight(clampDimension(value))}
      />

      <Toggle id="lock-ratio" label="Lock ratio" checked={settings.lockAspect} onChange={toggleLock} />

      <div>
        {/* Same w-20 / w-28 columns as NumberField above, so the readout
            lines up under Width/Height. The "Percentage" text itself is
            cut — it already appears on the mode radio above, so only the
            value shows; the label survives for a11y as sr-only. */}
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="w-20 shrink-0" />
          <label htmlFor="percentage" className="sr-only">
            Percentage
          </label>
          <span className="w-28 text-right font-mono text-caption text-ink-muted">{settings.percentage}%</span>
        </div>
        <input
          id="percentage"
          type="range"
          min={MIN_PERCENTAGE}
          max={MAX_PERCENTAGE}
          value={settings.percentage}
          disabled={!isPercentage}
          onChange={(e) => setPercentage(Number(e.target.value))}
          className="focus-ring mt-2 w-full disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    </div>
  );
}

export default ResizeControls;

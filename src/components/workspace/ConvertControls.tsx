import { FORMAT_LABEL } from '../../lib/image/formats';
import type { SupportedMime } from '../../types';

interface ConvertControlsProps {
  sourceMime: SupportedMime;
  format: SupportedMime | null;
  matte: string;
  encodable: SupportedMime[];
  outputMime: SupportedMime;
  sourceHasAlpha: boolean | null;
  setFormat: (format: SupportedMime | null) => void;
  setMatte: (colour: string) => void;
}

// Two presets plus the OS colour picker. No picker library and no new
// dependency — <input type="color"> is the native control and it is the
// one every platform already knows how to show.
const SWATCHES: Array<{ value: string; label: string }> = [
  { value: '#ffffff', label: 'White' },
  { value: '#000000', label: 'Black' },
];

function ConvertControls({
  sourceMime,
  format,
  matte,
  encodable,
  outputMime,
  sourceHasAlpha,
  setFormat,
  setMatte,
}: ConvertControlsProps) {
  // The matte only matters when there is genuinely alpha to lose. A
  // warning on every PNG would be noise, and noisy warnings get ignored —
  // most PNGs are opaque. sourceHasAlpha is null until the scan answers.
  const losesAlpha = outputMime === 'image/jpeg' && sourceHasAlpha === true;
  const checking = outputMime === 'image/jpeg' && sourceHasAlpha === null && sourceMime !== 'image/jpeg';

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className="sr-only">Convert to</legend>

        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-body text-ink">
          <input
            type="radio"
            name="convert-format"
            checked={format === null}
            onChange={() => setFormat(null)}
            className="h-4 w-4"
          />
          Keep original ({FORMAT_LABEL[sourceMime]})
        </label>

        {/* Only formats this browser can actually encode. toBlob falls back
            to PNG for a type it does not support, silently — so offering
            WEBP where it cannot be written would hand back PNG bytes in a
            file named .webp. See lib/image/formats.ts. */}
        {/* The source's own format is not listed again — "Keep original
            (PNG)" above already IS that option, and offering it twice
            invites the reader to look for a difference that does not
            exist. */}
        {encodable
          .filter((mime) => mime !== sourceMime)
          .map((mime) => (
          <label
            key={mime}
            className="flex min-h-11 cursor-pointer items-center gap-2 text-body text-ink"
          >
            <input
              type="radio"
              name="convert-format"
              checked={format === mime}
              onChange={() => setFormat(mime)}
              className="h-4 w-4"
            />
            {FORMAT_LABEL[mime]}
          </label>
          ))}
      </fieldset>

      {checking && <p className="font-mono text-caption text-ink-muted">Checking for transparency…</p>}

      {losesAlpha && (
        <div className="flex flex-col gap-3 border-t border-rule pt-4">
          <p className="text-body text-ink">
            JPG has no transparency. The clear areas will be filled in.
          </p>

          <div className="flex items-center gap-4">
            <span id="matte-label" className="w-20 shrink-0 text-body text-ink">
              Fill with
            </span>
            {/* A radio group would be wrong: the colour input is not a
                third option, it is the same choice by another route. The
                swatches are buttons that set the same value. */}
            <div className="flex items-center gap-2" role="group" aria-labelledby="matte-label">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch.value}
                  type="button"
                  aria-pressed={matte.toLowerCase() === swatch.value}
                  onClick={() => setMatte(swatch.value)}
                  className={`focus-ring h-11 w-11 border border-rule-strong transition-shadow duration-[120ms] ${
                    matte.toLowerCase() === swatch.value ? 'shadow-[inset_0_0_0_3px_var(--accent)]' : ''
                  }`}
                  style={{ backgroundColor: swatch.value }}
                >
                  <span className="sr-only">{swatch.label}</span>
                </button>
              ))}
              <label htmlFor="matte-colour" className="sr-only">
                Custom fill colour
              </label>
              <input
                id="matte-colour"
                type="color"
                value={matte}
                onChange={(e) => setMatte(e.target.value)}
                className="focus-ring h-11 w-11 cursor-pointer border border-rule-strong bg-transparent p-1"
              />
              <span className="font-mono text-caption text-ink-muted">{matte.toLowerCase()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConvertControls;

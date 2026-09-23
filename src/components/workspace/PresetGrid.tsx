import { PRESETS, type Preset, type PresetGroup } from '../../lib/presets';

interface PresetGridProps {
  presetId: string | null;
  onApply: (preset: Preset) => void;
}

const GROUPS: PresetGroup[] = ['Social', 'Web', 'Common'];

function presetSecondaryLine(preset: Preset): string {
  if (preset.kind === 'scale') return `${preset.percentage}%`;
  if (preset.height === null) return `${preset.width} px wide`;
  return `${preset.width} × ${preset.height}`;
}

// One continuous 3-column grid, not twelve floating boxes or one grid per
// group. Every cell (including group-heading cells) contributes only its
// right and bottom border; the grid wrapper supplies the top and left —
// that's what makes adjacent edges collapse to a single 1px line instead of
// doubling up, the same trick a collapsed-border <table> uses. A short
// last row (Common has 2 cells, not 3) is fine now that cells share
// borders — it just reads as a shorter row of the same table, not a
// dangling orphan box.
//
// The selected preset's highlight is an inset box-shadow, not a border —
// a border-collapsed cell only owns its own right/bottom edge (its left and
// top come from a neighbor or the wrapper), so a border-color change alone
// would only light up two of the cell's four sides. An inset shadow draws a
// complete ring inside the cell's own box without touching the shared grid.
function PresetGrid({ presetId, onApply }: PresetGridProps) {
  const selectedPreset = PRESETS.find((p) => p.id === presetId) ?? null;
  const showStretchNote = selectedPreset?.kind === 'dimensions' && selectedPreset.height !== null;

  return (
    <div>
      <div className="grid grid-cols-3 border-t border-l border-rule">
        {GROUPS.flatMap((group) => [
          <div
            key={`heading-${group}`}
            className="col-span-3 border-r border-b border-rule bg-surface px-3 py-1.5 text-caption font-medium text-ink-muted"
          >
            {group}
          </div>,
          ...PRESETS.filter((preset) => preset.group === group).map((preset) => {
            const selected = presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onApply(preset)}
                // h-16 (64px) already clears the 44px touch minimum.
                // Hover and selection are both inset rings rather than
                // border colours — in a border-collapsed grid a cell only
                // owns its right/bottom edge, so a border-colour change
                // would light up two sides of four. Transitioned at 120ms.
                className={`focus-ring flex h-16 flex-col justify-center gap-0.5 overflow-hidden border-r border-b border-rule px-3 text-left transition-shadow duration-[120ms] ${
                  selected
                    ? 'shadow-[inset_0_0_0_2px_var(--accent)]'
                    : 'hover:shadow-[inset_0_0_0_1px_var(--ink-muted)]'
                }`}
              >
                <span className="truncate text-body text-ink">{preset.label}</span>
                <span className="truncate font-mono text-caption text-ink-muted">{presetSecondaryLine(preset)}</span>
              </button>
            );
          }),
        ])}
      </div>

      {/* Exact copy, spec §9.4 */}
      {showStretchNote && (
        <p className="mt-3 text-body text-ink-muted">This preset has a fixed shape, so the image will stretch to fit.</p>
      )}
    </div>
  );
}

export default PresetGrid;

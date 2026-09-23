import { useRef, useState } from 'react';
import { PLATFORMS, PRESETS, type Preset, type PresetPlatform } from '../../lib/presets';
import InstagramIcon from '../icons/InstagramIcon';
import YouTubeIcon from '../icons/YouTubeIcon';
import FacebookIcon from '../icons/FacebookIcon';
import LinkedInIcon from '../icons/LinkedInIcon';
import XIcon from '../icons/XIcon';
import GlobeIcon from '../icons/GlobeIcon';

interface PresetGridProps {
  presetId: string | null;
  onApply: (preset: Preset) => void;
}

const ICONS: Record<PresetPlatform, (props: { className?: string }) => React.ReactElement> = {
  instagram: InstagramIcon,
  youtube: YouTubeIcon,
  facebook: FacebookIcon,
  linkedin: LinkedInIcon,
  x: XIcon,
  web: GlobeIcon,
};

function presetSecondaryLine(preset: Preset): string {
  if (preset.kind === 'scale') return `${preset.percentage}%`;
  if (preset.height === null) return `${preset.width} px wide`;
  return `${preset.width} × ${preset.height}`;
}

// Two levels: a row of platforms, then that platform's sizes underneath.
// One open at a time, nothing open by default, and opening a platform
// never applies a size — it only reveals the choices.
//
// These are accordion headers rather than tabs: nothing is selected when
// the page loads, which a tablist cannot express. Each button carries
// aria-expanded/aria-controls, and Enter/Space come free from using real
// <button> elements. Only the arrow-key roving needs handling.
//
// The size cells are unchanged from the flat grid — same collapsed
// borders, same mono dimensions, same aria-pressed, same 120ms ring. With
// at most five in a row instead of twelve they simply have room now.
function PresetGrid({ presetId, onApply }: PresetGridProps) {
  const [openPlatform, setOpenPlatform] = useState<PresetPlatform | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedPreset = PRESETS.find((p) => p.id === presetId) ?? null;
  const showStretchNote = selectedPreset?.kind === 'dimensions' && selectedPreset.height !== null;
  const openPresets = openPlatform ? PRESETS.filter((p) => p.platform === openPlatform) : [];

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    const last = PLATFORMS.length - 1;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    if (e.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    buttonRefs.current[next]?.focus();
  }

  return (
    <div>
      {/* Three across on a phone, six from sm up. Six across at 390px
          leaves ~57px a cell, which truncates "Instagram" and "LinkedIn"
          — trading the old size-label truncation for a new platform-label
          one. Two rows of three keeps every name whole. */}
      <div className="grid grid-cols-3 border-t border-l border-rule sm:grid-cols-6">
        {PLATFORMS.map((platform, index) => {
          const Icon = ICONS[platform.id];
          const isOpen = openPlatform === platform.id;
          return (
            <button
              key={platform.id}
              type="button"
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              aria-expanded={isOpen}
              aria-controls={isOpen ? 'preset-sizes' : undefined}
              onClick={() => setOpenPlatform(isOpen ? null : platform.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`focus-ring flex min-h-[3.75rem] flex-col items-center justify-center gap-1 border-r border-b border-rule px-1 py-2 transition-colors duration-[120ms] ${
                isOpen ? 'border-b-2 border-b-accent text-ink' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="w-full truncate text-center text-caption">{platform.label}</span>
            </button>
          );
        })}
      </div>

      {openPlatform && (
        <div id="preset-sizes" className="grid grid-cols-3 border-l border-rule">
          {openPresets.map((preset) => {
            const selected = presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onApply(preset)}
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
          })}
        </div>
      )}

      {/* Exact copy, spec §9.4 */}
      {showStretchNote && (
        <p className="mt-3 text-body text-ink-muted">This preset has a fixed shape, so the image will stretch to fit.</p>
      )}
    </div>
  );
}

export default PresetGrid;

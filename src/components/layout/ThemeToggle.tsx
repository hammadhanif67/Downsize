import { Monitor, Moon, Sun } from 'lucide-react';
import type { ThemeChoice } from '../../hooks/useTheme';

interface ThemeToggleProps {
  choice: ThemeChoice;
  resolved: 'light' | 'dark';
  onCycle: () => void;
}

const ICONS = { light: Sun, dark: Moon, system: Monitor };

// One button cycling light → dark → system, showing the CHOICE rather
// than the resolved theme: in system mode the monitor glyph is the honest
// answer, because the control is set to "follow the OS" and a sun there
// would claim a decision the user has not made. The resolved theme is
// still named in the accessible label, so a screen reader hears which one
// system currently means.
//
// 44px square, which is the minimum tap target and also what keeps it
// vertically centred in the 64px bar without any nudging.
function ThemeToggle({ choice, resolved, onCycle }: ThemeToggleProps) {
  const Icon = ICONS[choice];
  const label =
    choice === 'system'
      ? `Theme: system (currently ${resolved}). Change theme.`
      : `Theme: ${choice}. Change theme.`;

  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={label}
      title={label}
      className="focus-ring flex h-11 w-11 items-center justify-center text-ink-muted transition-colors duration-[120ms] hover:text-ink"
    >
      <Icon size={18} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

export default ThemeToggle;

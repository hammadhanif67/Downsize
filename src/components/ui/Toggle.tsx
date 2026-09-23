import { Link, Unlink } from 'lucide-react';

interface ToggleProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

// The real checkbox is sr-only, not display:none — it's what makes this
// keyboard-operable and announced correctly, the Link/Unlink icon swap is
// purely visual. has-[:focus-visible] puts the focus ring on the visible
// label since the focusable element itself is invisible.
function Toggle({ id, label, checked, onChange }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 w-fit cursor-pointer items-center gap-2 pr-2 text-body text-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
    >
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      {/* The icon SHAPE carries the state (Link vs Unlink); it doesn't also
          need a color change — --accent marks interactive state only (focus
          ring, selected preset, drag-active, download button), and a
          checked toggle isn't one of those four. */}
      {checked ? (
        <Link aria-hidden="true" className="h-4 w-4 text-ink" />
      ) : (
        <Unlink aria-hidden="true" className="h-4 w-4 text-ink-muted" />
      )}
      <span>{label}</span>
    </label>
  );
}

export default Toggle;

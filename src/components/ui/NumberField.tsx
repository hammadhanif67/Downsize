import { useEffect, useRef, useState } from 'react';

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  unit?: string;
  // Fires on every keystroke with whatever's currently parseable — raw, not
  // clamped (spec §9.3). Skipped entirely while the field is empty or mid
  // typing something unparseable, so the last good value just holds.
  onChange: (value: number) => void;
  // Fires once, on blur, with whatever the field currently holds — the
  // caller decides how to clamp it. NumberField itself has no opinion on
  // valid ranges; it's a generic primitive, not width/height-specific.
  onCommit: (value: number) => void;
  disabled?: boolean;
}

// Label sits in a fixed-width column (w-20) shared by every labelled
// control in the panel, so Width/Height/Percentage all start their field at
// the same x — no "canyon" from a justify-between spread. The px unit lives
// inside the same bordered box as the input, not floating beside it: the
// input has no border of its own, the wrapping div does, and a
// has-[:focus-visible] ring on that wrapper puts the focus outline around
// the whole field+unit group rather than just the input.
function NumberField({ id, label, value, unit = 'px', onChange, onCommit, disabled = false }: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  const isFocused = useRef(false);

  // Sync from the committed value when it changes from OUTSIDE this field's
  // own typing — aspect-lock deriving this axis from the other one, Reset,
  // a new image loading. Never while focused, or the user's own in-progress
  // keystrokes would be overwritten out from under them mid-edit.
  useEffect(() => {
    if (!isFocused.current) setText(String(value));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setText(raw);
    const parsed = Number(raw);
    if (raw !== '' && Number.isFinite(parsed)) onChange(parsed);
  }

  function handleBlur() {
    isFocused.current = false;
    const parsed = Number(text); // '' coerces to 0, which the caller's clamp will correct to MIN
    onCommit(Number.isFinite(parsed) ? parsed : value);
  }

  return (
    <div className="flex items-center gap-4">
      <label htmlFor={id} className={`w-20 shrink-0 text-body ${disabled ? 'text-ink-muted' : 'text-ink'}`}>
        {label}
      </label>
      <div
        className={`flex w-28 items-center border border-rule has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
          disabled ? 'opacity-50' : ''
        }`}
      >
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={text}
          disabled={disabled}
          onChange={handleChange}
          onFocus={() => {
            isFocused.current = true;
          }}
          onBlur={handleBlur}
          className="w-full min-w-0 bg-transparent px-2 py-1.5 text-right font-mono text-body text-ink outline-none disabled:cursor-not-allowed"
        />
        <span className="shrink-0 pr-2 font-mono text-caption text-ink-muted">{unit}</span>
      </div>
    </div>
  );
}

export default NumberField;

import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

// No hover state beyond the primary variant's own shade — --accent marks
// interactive STATE (focus ring, selected preset, drag-active, this button),
// never static decoration, so a secondary button can't reach for it just
// for a hover flourish. The primary variant's bg-accent/90 hover is a shade
// of that same one state use, not a new one.
function Button({ variant = 'secondary', className = '', type = 'button', ...props }: ButtonProps) {
  const base = 'focus-ring px-4 py-2 text-body disabled:cursor-not-allowed disabled:opacity-40';
  const variants = {
    primary: 'bg-accent text-surface hover:bg-accent/90',
    secondary: 'border border-rule text-ink',
  };
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export default Button;

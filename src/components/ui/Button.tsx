import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

// No hover state beyond the primary variant's own darker shade — --accent
// marks interactive STATE (focus ring, selected preset, drag-active, this
// button), never static decoration, so a secondary button can't reach for
// it just for a hover flourish. --accent-ink exists solely as this
// button's hover/active shade.
function Button({ variant = 'secondary', className = '', type = 'button', ...props }: ButtonProps) {
  const base = 'focus-ring px-4 py-2 text-body disabled:cursor-not-allowed disabled:opacity-40';
  const variants = {
    primary: 'bg-accent text-paper hover:bg-accent-ink',
    secondary: 'border border-rule text-ink',
  };
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export default Button;

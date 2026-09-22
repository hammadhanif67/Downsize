interface SpinnerProps {
  className?: string;
}

// Decorative only — always paired with its own visible text (e.g. "Opening
// image"), so it carries no accessible name of its own. Tailwind's
// animate-spin already respects the global prefers-reduced-motion override
// in index.css (§9.1), so there's nothing extra to do here for that.
function Spinner({ className = '' }: SpinnerProps) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" role="presentation" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default Spinner;

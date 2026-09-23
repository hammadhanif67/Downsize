interface IconProps {
  className?: string;
}

// Simplified mark, not a reproduction: rounded square, circle, corner dot.
// currentColor only — no brand colour, no gradient, no official asset.
// Drawn on the same 24 grid and 2px stroke as the lucide icons elsewhere
// so it sits with them rather than next to them.
function InstagramIcon({ className = '' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default InstagramIcon;

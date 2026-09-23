interface IconProps {
  className?: string;
}

// An "f": a stem with a crossbar and a shoulder curving up to the right.
// Stroked rather than a filled glyph so it keeps the same visual weight as
// the other five at 20px.
function FacebookIcon({ className = '' }: IconProps) {
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
      <path d="M16 4h-1.8A3.2 3.2 0 0 0 11 7.2V20" />
      <path d="M8 11h7" />
    </svg>
  );
}

export default FacebookIcon;

interface IconProps {
  className?: string;
}

// Rounded rectangle with a play triangle. The triangle is filled so it
// still reads as solid at 20px, where a 2px-stroked triangle that small
// closes up into a blob.
function YouTubeIcon({ className = '' }: IconProps) {
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
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="M10.5 9.2v5.6l4.8-2.8z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default YouTubeIcon;

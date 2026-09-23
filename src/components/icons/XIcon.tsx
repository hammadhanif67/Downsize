interface IconProps {
  className?: string;
}

// A cross. Inset from the edges so it optically matches the weight of the
// boxed marks beside it rather than reading larger than all of them.
function XIcon({ className = '' }: IconProps) {
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
      <path d="M5 5l14 14" />
      <path d="M19 5L5 19" />
    </svg>
  );
}

export default XIcon;

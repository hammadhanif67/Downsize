interface IconProps {
  className?: string;
}

// An "in": dotted stem on the left, n with a rounded shoulder on the
// right. The dot is filled — at 20px a stroked 1px circle disappears.
function LinkedInIcon({ className = '' }: IconProps) {
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
      <circle cx="6" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <path d="M6 10.5V18" />
      <path d="M11 18v-7.5" />
      <path d="M11 14a3.5 3.5 0 0 1 7 0v4" />
    </svg>
  );
}

export default LinkedInIcon;

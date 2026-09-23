interface LogoProps {
  size?: number;
  className?: string;
}

// The mark: four corner brackets forming a crop frame, the way a
// viewfinder or a crop tool draws one. The top-right and bottom-left
// brackets are short (4 units of arm) where the other two are long (7),
// and that asymmetry is the whole idea — the frame reads as being pulled
// in on one diagonal rather than sitting square, which is "reducing"
// without drawing an arrow or a down-chevron.
//
// The previous mark was a square inside a square. It was fine at 24px and
// turned into an indistinct blob at 16px, because two nested outlines an
// odd number of pixels apart is exactly the thing a favicon cannot hold.
// Corner brackets survive it: they are four separate shapes with clear
// air between them.
//
// Geometry sits on a 24-unit box with a 2-unit stroke, inset 1 so the
// stroke's outer edge lands on 0 and 24 — the mark fills its own box
// exactly, which is what lets it centre against the wordmark's cap
// height. favicon.svg carries its OWN geometry on a 16-unit grid; see
// the note there. Do not scale this one down to 16 and expect it to hold.
//
// The top-left bracket is the accent one: first corner read, sits
// directly against the wordmark's D, and being a long bracket it keeps
// enough blue to still register at small sizes.
function Logo({ size = 24, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Top-left, long, accent */}
      <path d="M1 8V1h7" stroke="var(--accent)" />
      {/* Top-right, short */}
      <path d="M23 5V1h-4" />
      {/* Bottom-right, long */}
      <path d="M23 16v7h-7" />
      {/* Bottom-left, short */}
      <path d="M1 19v4h4" />
    </svg>
  );
}

export default Logo;

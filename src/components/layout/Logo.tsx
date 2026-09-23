interface LogoProps {
  size?: number;
  className?: string;
}

// The mark: an outer square outline with a smaller filled square nested in
// its bottom-left corner — one shape reducing into another, which is what
// the app does to an image.
//
// Geometry is defined on a 24-unit viewBox and scales with `size`. The
// stroke is drawn on the inside of the outer square's edge (hence the 1px
// inset on a 2px stroke) so the mark's true bounding box is exactly the
// stated size, which is what makes it line up with the wordmark's cap
// height instead of floating a hairline proud of it.
//
// vectorEffect="non-scaling-stroke" is deliberately NOT used: the stroke
// should scale with the mark, so a 32px logo reads the same as a 20px one.
function Logo({ size = 24, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Stroke is centred on the path, so a 22-unit rect with a 2-unit
          stroke occupies exactly 0–24: the mark fills its own box. */}
      <rect x="1" y="1" width="22" height="22" stroke="var(--ink)" strokeWidth="2" />
      {/* 11 units ≈ 45% of the outer 24, inset 1 unit from the inner edge
          of the stroke on both sides so the two squares stay distinct
          shapes rather than merging into one at small sizes. */}
      <rect x="3" y="10" width="11" height="11" fill="var(--accent)" />
    </svg>
  );
}

export default Logo;

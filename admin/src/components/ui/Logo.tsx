/** The Wolso mark — a rounded "W" wave plus a dot, in the accent green.
 *  Renders as inline SVG so it scales cleanly from a 24px header icon up
 *  to a splash-screen size without a raster asset. */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size * (100 / 120)} viewBox="0 0 120 100" fill="none" className={className} aria-hidden="true">
      <path
        d="M15 25 L32 72 L50 45 L68 72 L85 25"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="103" cy="20" r="9" fill="currentColor" />
    </svg>
  );
}

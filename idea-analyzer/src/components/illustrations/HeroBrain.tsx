/** Decorative hero art for the Home screen: a soft gradient blob behind a
 *  simple brain glyph, with a few orbiting sparks. Pure inline SVG so the
 *  app stays a single self-contained bundle — no external image assets. */
export function HeroBrain({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="hero-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-brain" x1="110" y1="40" x2="230" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id="hero-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ec4899" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      <ellipse cx="160" cy="110" rx="150" ry="105" fill="url(#hero-glow)" />

      <g className="float-slow" style={{ transformOrigin: '160px 110px' }}>
        <path
          d="M160 46c-32 0-58 24-58 55 0 20 11 37 27 47v16c0 6 5 11 11 11h40c6 0 11-5 11-11v-16c16-10 27-27 27-47 0-31-26-55-58-55z"
          fill="url(#hero-brain)"
        />
        <path
          d="M160 46c-4 0-8 .3-12 .9 20 5 35 25 35 49 0 21-11 39-27 49"
          stroke="#ffffff"
          strokeOpacity="0.25"
          strokeWidth="3"
          fill="none"
        />
        <path d="M138 155h44M142 165h36" stroke="#1c1732" strokeWidth="3.4" strokeLinecap="round" />
        <path
          d="M160 66v22M148 78l12 10 12-10M138 96c4 6 10 9 16 9M182 96c-4 6-10 9-16 9"
          stroke="#1c1732"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <g opacity="0.9">
        <circle cx="70" cy="60" r="5" fill="url(#hero-ring)" className="pulse-glow" style={{ transformOrigin: '70px 60px' }} />
        <circle cx="250" cy="150" r="4" fill="url(#hero-ring)" className="pulse-glow" style={{ transformOrigin: '250px 150px', animationDelay: '0.6s' }} />
        <circle cx="255" cy="55" r="3" fill="#ec4899" className="pulse-glow" style={{ transformOrigin: '255px 55px', animationDelay: '1.1s' }} />
        <path d="M58 100l6 6M52 106l6-6" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M260 100l7 7M253 107l7-7" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

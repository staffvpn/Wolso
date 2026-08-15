import { motion } from 'framer-motion';

/** Full-screen "analyzing" illustration: a pulsing gradient core with three
 *  particles orbiting it — reads as "thinking" without needing a Lottie
 *  file or any external asset. */
export function LoadingOrb({ color = '#8b5cf6', className }: { color?: string; className?: string }) {
  return (
    <div className={className} style={{ position: 'relative', width: 200, height: 200 }}>
      <svg viewBox="0 0 200 200" width="200" height="200">
        <defs>
          <radialGradient id="orb-core" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.15" />
          </radialGradient>
        </defs>
        <motion.circle
          cx="100"
          cy="100"
          r="46"
          fill="url(#orb-core)"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          style={{ transformOrigin: '100px 100px' }}
        />
        <circle cx="100" cy="100" r="70" stroke={color} strokeOpacity="0.25" strokeWidth="1.5" fill="none" />
        <circle cx="100" cy="100" r="88" stroke={color} strokeOpacity="0.12" strokeWidth="1.5" fill="none" />
      </svg>

      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2.6 + i * 0.5, ease: 'linear' }}
          style={{ position: 'absolute', inset: 0, transformOrigin: '100px 100px' }}
        >
          <div
            style={{
              position: 'absolute',
              top: 100 - (70 + i * 9),
              left: 100 - 4,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: color,
              boxShadow: `0 0 12px ${color}`,
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}

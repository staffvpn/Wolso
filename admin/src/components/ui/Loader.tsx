import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

/** The Wolso mark drawing itself, over and over: the W is stroked on from
 *  left to right, the dot lands at the end, then the whole thing fades and
 *  starts again. Spinning the logo was the obvious thing to do and the
 *  wrong one — the mark reads as a letterform, and a rotating letter just
 *  looks broken. Drawing it keeps the brand legible the whole time.
 *
 *  DURATION drives every keyframe below, so the phases stay in step if the
 *  timing is ever retuned. */
const DURATION = 2.1;

export function Loader({ size = 84, className }: { size?: number; className?: string }) {
  return (
    <div className={cn('relative flex items-center justify-center', className)} style={{ width: size, height: size }}>
      {/* Soft halo breathing behind the mark — gives the whole thing a
          pulse so a slow network doesn't feel like a frozen screen. */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-accent-soft"
        animate={{ scale: [0.82, 1.05, 0.82], opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: DURATION, repeat: Infinity, ease: 'easeInOut' }}
      />

      <svg
        width={size * 0.62}
        height={size * 0.62 * (100 / 120)}
        viewBox="0 0 120 100"
        fill="none"
        className="relative text-accent"
        aria-hidden="true"
      >
        {/* The un-drawn path, kept faintly visible so the mark never fully
            disappears between loops. */}
        <path
          d="M15 25 L32 72 L50 45 L68 72 L85 25"
          stroke="currentColor"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.14}
        />
        <motion.path
          d="M15 25 L32 72 L50 45 L68 72 L85 25"
          stroke="currentColor"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 1, 1, 0] }}
          transition={{
            duration: DURATION,
            repeat: Infinity,
            ease: 'easeInOut',
            // draw · hold · retract — the hold is what makes it read as a
            // finished logo rather than a stroke that never settles.
            times: [0, 0.55, 0.78, 1],
          }}
        />
        <motion.circle
          cx="103"
          cy="20"
          r="9"
          fill="currentColor"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 0, 1, 1, 0], opacity: [0, 0, 1, 1, 0] }}
          transition={{
            duration: DURATION,
            repeat: Infinity,
            ease: 'easeOut',
            // Lands just as the W finishes, holds with it, leaves with it.
            times: [0, 0.5, 0.62, 0.8, 0.92],
          }}
        />
      </svg>
    </div>
  );
}

/** Full-screen loading state — the mark plus a line of text. Used wherever
 *  the dashboard is blocked on a call and has nothing else to show yet. */
export function LoadingScreen({ label }: { label?: string }) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-bg text-center">
      <Loader />
      {label && (
        <motion.p
          className="text-text-muted text-[14px]"
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: DURATION, repeat: Infinity, ease: 'easeInOut' }}
        >
          {label}
        </motion.p>
      )}
    </div>
  );
}

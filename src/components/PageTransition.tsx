import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/** Wraps a screen so it slides/fades in — used for pushed (non-tab) routes. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      className="flex flex-col h-full"
    >
      {children}
    </motion.div>
  );
}

/** Softer cross-fade — used for the bottom-tab roots so switching tabs doesn't feel like navigation. */
export function TabFade({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="flex flex-col h-full min-h-0"
    >
      {children}
    </motion.div>
  );
}

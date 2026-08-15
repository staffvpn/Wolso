import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingOrb } from './illustrations/LoadingOrb';
import { LOADING_LINES } from '@/data/examples';
import { MODES } from '@/data/modes';
import type { Mode } from '@/types';

export function LoadingOverlay({ mode }: { mode: Mode }) {
  const [lineIndex, setLineIndex] = useState(0);
  const meta = MODES[mode];

  useEffect(() => {
    const id = setInterval(() => setLineIndex((i) => (i + 1) % LOADING_LINES.length), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 gap-6 text-center">
      <LoadingOrb color={getComputedColor(mode)} />
      <div className="space-y-1.5">
        <p className="font-bold text-[17px]">{meta.loadingVerb}…</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={lineIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="text-[14px] text-text-muted"
          >
            {LOADING_LINES[lineIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

// SVG stroke/fill props can't consume CSS var() the way Tailwind classes
// can in every browser reliably for JS-driven animation targets, so the
// orb wants a literal hex — map the mode straight to its token's value.
function getComputedColor(mode: Mode): string {
  const map: Record<Mode, string> = {
    praise: '#34d17c',
    criticize: '#f5a623',
    destroy: '#ef4d5e',
    monetize: '#fbbf24',
  };
  return map[mode];
}

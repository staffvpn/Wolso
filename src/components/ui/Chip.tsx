import type { ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  selected?: boolean;
  tone?: 'accent' | 'dark';
}

export function Chip({ selected, tone = 'accent', className, children, ...props }: ChipProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'h-10 px-4 rounded-full text-[14px] font-medium border transition-colors duration-150 whitespace-nowrap',
        selected
          ? tone === 'accent'
            ? 'bg-accent text-accent-fg border-accent'
            : 'bg-text text-bg border-text'
          : 'bg-transparent text-text border-border text-text-muted',
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}

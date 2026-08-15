import { type ButtonHTMLAttributes } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/cn';

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  active?: boolean;
  activeColor?: string;
}

export function Chip({ active, activeColor, className, children, style, ...props }: ChipProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 text-[14px] font-semibold border transition-colors duration-150 whitespace-nowrap',
        active ? 'border-transparent text-white' : 'border-border bg-surface text-text-muted',
        className,
      )}
      style={active ? { background: activeColor ?? 'var(--color-accent)', ...style } : style}
      {...(props as HTMLMotionProps<'button'>)}
    >
      {children}
    </motion.button>
  );
}

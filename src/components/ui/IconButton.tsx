import type { ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  size?: number;
  variant?: 'surface' | 'ghost';
}

export function IconButton({ size = 40, variant = 'surface', className, children, ...props }: IconButtonProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'inline-flex items-center justify-center rounded-full shrink-0 text-text',
        variant === 'surface' ? 'bg-surface-2 border border-border' : 'bg-transparent',
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'dark' | 'ghost' | 'outline' | 'danger';
type Size = 'md' | 'lg' | 'icon';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'text-accent-fg active:brightness-95 shadow-[0_8px_24px_-8px_rgba(139,92,246,0.6)]',
  dark: 'bg-surface-2 text-text border border-border active:bg-surface-hover',
  ghost: 'bg-transparent text-text-muted active:bg-surface',
  outline: 'bg-transparent text-text border border-border active:bg-surface',
  danger: 'bg-danger-soft text-danger active:bg-danger/20',
};

const SIZE_CLASSES: Record<Size, string> = {
  md: 'h-11 px-4 text-[15px] rounded-2xl',
  lg: 'h-14 px-5 text-[16px] rounded-2xl',
  icon: 'h-11 w-11 rounded-2xl',
};

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'lg', fullWidth, className, children, disabled, style, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      disabled={disabled}
      style={variant === 'primary' ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-2))', ...style } : style}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold select-none transition-[filter] duration-150 disabled:opacity-40',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...(props as HTMLMotionProps<'button'>)}
    >
      {children}
    </motion.button>
  );
});

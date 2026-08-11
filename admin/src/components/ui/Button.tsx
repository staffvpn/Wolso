import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'icon';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  dark: 'bg-text text-white hover:bg-black',
  outline: 'bg-white text-text border border-border hover:bg-surface-2',
  ghost: 'bg-transparent text-text-muted hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:bg-danger/15',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
  md: 'h-10 px-4 text-[14px] rounded-xl gap-2',
  icon: 'h-10 w-10 rounded-xl',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'outline', size = 'md', className, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

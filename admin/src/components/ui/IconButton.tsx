import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: number;
}

export function IconButton({ size = 36, className, children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn('inline-flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text transition-colors shrink-0', className)}
      style={{ width: size, height: size }}
      {...props}
    >
      {children}
    </button>
  );
}

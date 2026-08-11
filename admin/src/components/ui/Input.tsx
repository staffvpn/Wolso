import { type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border border-border bg-white px-3.5 text-[14px] text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors',
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-[14px] text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors resize-none',
        className,
      )}
      {...props}
    />
  );
});

export function Label({ className, children }: { className?: string; children: ReactNode }) {
  return <label className={cn('text-[13px] font-semibold text-text-muted mb-1.5 block', className)}>{children}</label>;
}

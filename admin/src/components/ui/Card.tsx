import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card bg-surface border border-border-soft', className)} {...props} />;
}

export function SectionLabel({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn('text-[12px] font-semibold uppercase tracking-wide text-text-faint', className)}>{children}</p>;
}

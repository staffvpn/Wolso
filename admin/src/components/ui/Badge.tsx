import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'accent' | 'neutral' | 'warning' | 'danger' | 'info' | 'dark';

const TONE_CLASSES: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent',
  neutral: 'bg-surface-2 text-text-muted border border-border-soft',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  dark: 'bg-text text-white',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold', TONE_CLASSES[tone], className)}>
      {children}
    </span>
  );
}

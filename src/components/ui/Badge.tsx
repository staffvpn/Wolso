import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** 'info' — синий: им помечено всё, что человек нашёл сам, мимо Wolso.
 *  Тот же цвет, что и его дни в календаре. */
type Tone = 'accent' | 'neutral' | 'warning' | 'danger' | 'dark' | 'info';

const TONE_CLASSES: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent',
  neutral: 'bg-surface-2 text-text-muted',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  dark: 'bg-surface-2 text-text',
  info: 'bg-info-soft text-info',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold', TONE_CLASSES[tone], className)}>
      {children}
    </span>
  );
}

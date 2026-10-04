import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // min-w-0 здесь раз навсегда: Card почти всегда — элемент CSS grid'а или
  // flex-ряда (список+карточка, сетка статистики, карточки рекламы), а у
  // таких элементов по умолчанию min-width: auto — они не сжимаются ниже
  // ширины своего содержимого, и на телефоне всё уезжает за край экрана
  // ещё до того, как до дела доходят внутренние truncate/min-w-0. В обычном
  // блочном контексте (не flex/grid) min-w-0 ни на что не влияет, так что
  // хуже не будет нигде.
  return <div className={cn('rounded-card bg-surface border border-border-soft min-w-0', className)} {...props} />;
}

export function SectionLabel({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn('text-[12px] font-semibold uppercase tracking-wide text-text-faint', className)}>{children}</p>;
}

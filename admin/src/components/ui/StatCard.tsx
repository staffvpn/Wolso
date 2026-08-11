import type { ReactNode } from 'react';
import { ArrowUp } from 'lucide-react';
import { Card } from './Card';
import { cn } from '@/lib/cn';

interface StatCardProps {
  label: string;
  value: ReactNode;
  delta?: string;
  footnote?: ReactNode;
  dark?: boolean;
  className?: string;
}

export function StatCard({ label, value, delta, footnote, dark, className }: StatCardProps) {
  return (
    <Card className={cn('p-5', dark && 'bg-text border-text', className)}>
      <p className={cn('text-[13px] font-medium', dark ? 'text-white/60' : 'text-text-muted')}>{label}</p>
      <div className="flex items-baseline gap-2 mt-2">
        <span className={cn('text-[26px] font-extrabold leading-none', dark ? 'text-white' : 'text-text')}>{value}</span>
        {delta && (
          <span className="inline-flex items-center gap-0.5 text-[12px] font-bold text-accent">
            <ArrowUp size={12} strokeWidth={3} />
            {delta}
          </span>
        )}
      </div>
      {footnote && <p className={cn('text-[12px] mt-1.5', dark ? 'text-white/50' : 'text-text-faint')}>{footnote}</p>}
    </Card>
  );
}

import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

export interface TabOption {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  options: TabOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ options, value, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={cn(
              'h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-colors duration-150',
              selected ? 'bg-text text-white border-text' : 'bg-white text-text-muted border-border hover:bg-surface-2',
            )}
          >
            {opt.label}
            {opt.count !== undefined && <span className={cn('ml-1', selected ? 'text-white/60' : 'text-text-faint')}>· {formatNumber(opt.count)}</span>}
          </button>
        );
      })}
    </div>
  );
}

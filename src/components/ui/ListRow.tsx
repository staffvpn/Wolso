import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ListRowProps {
  label: string;
  value?: ReactNode;
  /** Иконка слева, в цветном квадрате. Без нее строка выглядит как раньше —
   *  остальные экраны (Настройки, Кошелёк и т.д.) её не передают. */
  icon?: ReactNode;
  /** 'accent' — строка, на которую стоит обратить внимание в первую
   *  очередь (например, там есть что-то новое). */
  tone?: 'default' | 'accent';
  onClick?: () => void;
  danger?: boolean;
  showChevron?: boolean;
}

export function ListRow({ label, value, icon, tone = 'default', onClick, danger, showChevron = true }: ListRowProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full flex items-center gap-3 py-3.5 text-left disabled:cursor-default"
    >
      {icon && (
        <span
          className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
            tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-text-muted',
          )}
        >
          {icon}
        </span>
      )}
      <span className={cn('flex-1 text-[15px] font-medium', danger ? 'text-danger' : 'text-text')}>{label}</span>
      <span className="flex items-center gap-1.5 text-[14px] text-text-muted">
        {value}
        {onClick && showChevron && <ChevronRight size={16} className="text-text-faint" />}
      </span>
    </button>
  );
}

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ListRowProps {
  label: string;
  value?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  showChevron?: boolean;
}

export function ListRow({ label, value, onClick, danger, showChevron = true }: ListRowProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full flex items-center justify-between py-3.5 text-left disabled:cursor-default"
    >
      <span className={cn('text-[15px] font-medium', danger ? 'text-danger' : 'text-text')}>{label}</span>
      <span className="flex items-center gap-1.5 text-[14px] text-text-muted">
        {value}
        {onClick && showChevron && <ChevronRight size={16} className="text-text-faint" />}
      </span>
    </button>
  );
}

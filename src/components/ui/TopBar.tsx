import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { IconButton } from './IconButton';
import { cn } from '@/lib/cn';

interface TopBarProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
  className?: string;
}

export function TopBar({ title, subtitle, onBack, right, className }: TopBarProps) {
  return (
    <div className={cn('flex items-center gap-3 px-5 pt-4 pb-3 safe-top shrink-0', className)}>
      {onBack && (
        <IconButton onClick={onBack} aria-label="Назад">
          <ChevronLeft size={20} />
        </IconButton>
      )}
      <div className="flex-1 min-w-0">
        {title && <h1 className="text-[20px] font-bold text-text leading-tight truncate">{title}</h1>}
        {subtitle && <p className="text-[13px] text-text-muted truncate mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}

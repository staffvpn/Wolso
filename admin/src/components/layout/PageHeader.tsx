import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-8 pt-5 sm:pt-7 pb-4 sm:pb-5 shrink-0">
      <div className="flex items-baseline gap-2.5 min-w-0">
        <h1 className="text-[19px] sm:text-[22px] font-extrabold text-text truncate">{title}</h1>
        {subtitle && <span className="text-[13px] sm:text-[14px] text-text-muted truncate">{subtitle}</span>}
      </div>
      {right && <div className="flex items-center gap-2.5 shrink-0 flex-wrap">{right}</div>}
    </div>
  );
}

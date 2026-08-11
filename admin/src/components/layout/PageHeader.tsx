import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-8 pt-7 pb-5 shrink-0">
      <div className="flex items-baseline gap-2.5 min-w-0">
        <h1 className="text-[22px] font-extrabold text-text truncate">{title}</h1>
        {subtitle && <span className="text-[14px] text-text-muted truncate">{subtitle}</span>}
      </div>
      {right && <div className="flex items-center gap-2.5 shrink-0">{right}</div>}
    </div>
  );
}

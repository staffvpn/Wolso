import type { ReactNode } from 'react';
import { Card } from './ui/Card';

export function SectionCard({
  icon,
  title,
  color,
  children,
}: {
  icon: ReactNode;
  title: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}26`, color }}>
          {icon}
        </div>
        <h3 className="font-bold text-[15px]">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

export function BulletList({ items, color }: { items: string[]; color: string }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-[14px] leading-snug text-text-muted">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function NumberedList({ items, color }: { items: string[]; color: string }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[14px] leading-snug">
          <span
            className="h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 mt-0.5"
            style={{ background: color, color: '#1c1732' }}
          >
            {i + 1}
          </span>
          <span className="text-text">{item}</span>
        </li>
      ))}
    </ol>
  );
}

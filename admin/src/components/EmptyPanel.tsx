import { CheckCircle2 } from 'lucide-react';

export function EmptyPanel({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
      <div className="h-14 w-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
        <CheckCircle2 size={26} />
      </div>
      <div>
        <p className="font-bold text-[16px]">{title}</p>
        {description && <p className="text-[13px] text-text-muted mt-1 max-w-[280px]">{description}</p>}
      </div>
    </div>
  );
}

import { cn } from '@/lib/cn';

interface IllustrationProps {
  src?: string;
  caption?: string;
  hint?: string;
  className?: string;
}

/**
 * Placeholder for hand-drawn illustrations that will be dropped in later.
 * Pass `src` once an asset exists — the hatched placeholder disappears
 * automatically and nothing else about the layout needs to change.
 */
export function Illustration({ src, caption, hint, className }: IllustrationProps) {
  if (src) {
    return <img src={src} alt={caption ?? ''} className={cn('w-full h-full object-contain', className)} />;
  }

  return (
    <div
      className={cn(
        'w-full h-full rounded-2xl flex flex-col items-center justify-center gap-1.5 border border-border-soft',
        className,
      )}
      style={{
        background:
          'repeating-linear-gradient(135deg, var(--color-surface) 0px, var(--color-surface) 10px, var(--color-bg-elevated) 10px, var(--color-bg-elevated) 20px)',
      }}
    >
      {caption && <span className="text-text-faint text-[13px] font-medium">{caption}</span>}
      {hint && <span className="text-text-faint/70 text-[11px]">{hint}</span>}
    </div>
  );
}

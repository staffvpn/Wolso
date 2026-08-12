import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

interface AvatarProps {
  name?: string;
  src?: string;
  size?: number;
  className?: string;
}

/** Diagonal-stripe placeholder, same look as the reference mock's empty avatars. */
export function Avatar({ name, src, size = 44, className }: AvatarProps) {
  // A src that 404s or fails to decode (HEIC from an iPhone camera roll is
  // the usual culprit) would otherwise render the browser's broken-image
  // icon forever — fall back to the placeholder instead once that happens.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name ?? ''}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={cn('rounded-full object-cover shrink-0', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn('rounded-full shrink-0 overflow-hidden shrink-0 relative', className)}
      style={{
        width: size,
        height: size,
        background: 'repeating-linear-gradient(135deg, var(--color-surface-2) 0px, var(--color-surface-2) 4px, var(--color-surface) 4px, var(--color-surface) 8px)',
      }}
      aria-hidden
    />
  );
}

interface LogoBadgeProps {
  initial: string;
  color: string;
  size?: number;
  className?: string;
}

export function LogoBadge({ initial, color, size = 44, className }: LogoBadgeProps) {
  return (
    <div
      className={cn('rounded-2xl flex items-center justify-center font-bold shrink-0 text-white', className)}
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
    >
      {initial}
    </div>
  );
}

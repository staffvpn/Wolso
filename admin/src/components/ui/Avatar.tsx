import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

function initialsOf(name: string) {
  const cleaned = name.replace(/[«»"]/g, '').replace(/^(ООО|ИП)\s+/i, '').trim();
  const letters = cleaned.match(/\p{L}/gu) ?? [];
  const parts = cleaned.split(/\s+/).filter((p) => /\p{L}/u.test(p));
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (letters[0] ?? '?').toUpperCase();
}

/** Single-letter mark, closer to a real company logo. */
function markOf(name: string) {
  const cleaned = name.replace(/[«»"]/g, '').replace(/^(ООО|ИП)\s+/i, '').trim();
  const letter = cleaned.match(/\p{L}/u);
  return (letter?.[0] ?? '?').toUpperCase();
}

const PALETTE = ['#1fae63', '#2563a8', '#b8790a', '#7c5cbf', '#d9432e', '#0d9488'];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
  square?: boolean;
  /** Real uploaded photo — falls back to the colored initials mark when
   *  absent, or if the URL 404s/fails to decode. */
  src?: string;
}

export function Avatar({ name, size = 40, className, square, src }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={cn('shrink-0 object-cover', square ? 'rounded-xl' : 'rounded-full', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn('shrink-0 flex items-center justify-center font-bold text-white', square ? 'rounded-xl' : 'rounded-full', className)}
      style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.38 }}
    >
      {square ? markOf(name) : initialsOf(name)}
    </div>
  );
}

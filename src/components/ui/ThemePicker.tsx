import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { hapticSelect, syncTelegramChrome } from '@/lib/telegram';
import { applyThemeAttribute, getStoredTheme, setStoredTheme, type Theme } from '@/lib/theme';

/** Swatches, not a switch: a bare on/off toggle reads as "notifications for
 *  light mode" next to the other switches on this screen, and there are two
 *  actual looks to preview, not one thing to enable. Each circle is a small
 *  render of its own theme (dark fill / light fill) so the choice is
 *  visible before it's made, the same idea as a system appearance picker. */
const THEME_OPTIONS: { value: Theme; label: string; fill: string; border: string; check: string }[] = [
  { value: 'dark', label: 'Тёмная тема', fill: '#0a0b0a', border: '#262a27', check: '#ffffff' },
  { value: 'light', label: 'Светлая тема', fill: '#f5f6f1', border: '#dfe3d8', check: '#14170d' },
];

export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  function pick(next: Theme) {
    if (next === theme) return;
    hapticSelect();
    applyThemeAttribute(next);
    setStoredTheme(next);
    syncTelegramChrome(next);
    setTheme(next);
  }

  return (
    <div className="flex gap-5 py-3">
      {THEME_OPTIONS.map((opt) => {
        const selected = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.label}
            onClick={() => pick(opt.value)}
            className="flex flex-col items-center gap-2"
          >
            <span
              className={cn('h-16 w-16 rounded-full flex items-center justify-center p-[3px]', selected ? 'bg-accent' : 'bg-transparent')}
            >
              <span
                className="h-full w-full rounded-full flex items-center justify-center border"
                style={{ background: opt.fill, borderColor: opt.border }}
              >
                {selected && <Check size={18} style={{ color: opt.check }} />}
              </span>
            </span>
            <span className={cn('text-[12px]', selected ? 'text-text font-semibold' : 'text-text-muted font-medium')}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

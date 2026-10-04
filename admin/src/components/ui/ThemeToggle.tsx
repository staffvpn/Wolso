import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';

/** 'sidebar' — на тёмной панели слева (всегда тёмной, см. index.css).
 *  'bar' — на обычной поверхности (мобильный топ-бар), которая сама
 *  меняется со светлой на тёмную, поэтому ей нужны другие классы. */
const VARIANT_CLASS = {
  sidebar: 'text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text',
  bar: 'text-text-muted hover:bg-surface-2 hover:text-text',
} as const;

export function ThemeToggle({ variant = 'sidebar', className }: { variant?: keyof typeof VARIANT_CLASS; className?: string }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
      title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      className={cn('h-8 w-8 rounded-lg flex items-center justify-center transition-colors shrink-0', VARIANT_CLASS[variant], className)}
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

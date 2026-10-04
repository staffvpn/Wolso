import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'wolso-admin-theme';

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function readStored(): Theme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/** Текущая тема плюс переключатель. Без явного выбора следует системной
 *  (index.html уже применил сохранённый выбор до отрисовки, здесь — только
 *  синхронизация состояния для самой кнопки-тоггла). */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => readStored() ?? (systemPrefersDark() ? 'dark' : 'light'));

  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Приватное окно или запрещённый localStorage — тема просто не
      // переживёт перезагрузку, сам переключатель при этом работает.
    }
  }, [theme]);

  function toggle() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  return { theme, toggle };
}

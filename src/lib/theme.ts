/** Dark is the only theme this product shipped with for a long time (see
 *  the comment in index.css) — light is a per-device preference, not
 *  account data, so it lives in localStorage rather than round-tripping
 *  through the API like the notification switches do. */
export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'wolso-theme';

export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private mode / storage disabled — the theme still applies for this
     * session, it just won't be remembered on the next launch. */
  }
}

/** Flips the attribute the light-theme override block in index.css keys
 *  off (`:root[data-theme="light"]`). Synchronous and side-effect-free
 *  otherwise, so it's safe to call before Telegram's bridge is ready —
 *  main.tsx does, ahead of the first paint, to avoid a flash of the
 *  wrong theme. */
export function applyThemeAttribute(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

/** What Telegram's own chrome (header, background behind the app, bottom
 *  bar) should match for a given theme — see lib/telegram.ts, which sets
 *  these once at startup and again live when the setting changes. */
const CHROME_COLOR: Record<Theme, string> = {
  dark: '#0a0b0a',
  light: '#f5f6f1',
};

export function themeChromeColor(theme: Theme): string {
  return CHROME_COLOR[theme];
}

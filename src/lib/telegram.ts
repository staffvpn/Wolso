/**
 * Thin wrapper around the raw Telegram WebApp bridge (telegram-web-app.js).
 * Everything is defensive: the app must run fine as a plain browser preview
 * too (no Telegram object present), which is how we develop/QA it.
 */

export function getTelegram() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
}

export const isInTelegram = () => Boolean(getTelegram()?.initData);

/** Call once, as early as possible (main.tsx). */
export function bootstrapTelegram() {
  const tg = getTelegram();
  if (!tg) return;

  tg.ready();
  tg.expand();

  // Fullscreen mode landed in Bot API 8.0 — guard for older clients.
  try {
    tg.requestFullscreen?.();
  } catch {
    /* older client, ignore */
  }
  try {
    tg.disableVerticalSwipes?.();
  } catch {
    /* older client, ignore */
  }

  tg.setHeaderColor?.('#0a0b0a');
  tg.setBackgroundColor?.('#0a0b0a');
  tg.setBottomBarColor?.('#0a0b0a');
  tg.enableClosingConfirmation();

  // `safeAreaInset` is the device notch/home-indicator area. `contentSafeAreaInset`
  // is separate: it's the strip Telegram's own floating chrome sits in (the
  // close/collapse/⋯ cluster at the top, still present even in fullscreen).
  // Both stack — content has to clear the device inset *and* Telegram's own
  // controls — so every top-anchored interactive element needs both added in.
  const syncSafeArea = () => {
    const top = (tg.safeAreaInset?.top ?? 0) + (tg.contentSafeAreaInset?.top ?? 0);
    const bottom = (tg.safeAreaInset?.bottom ?? 0) + (tg.contentSafeAreaInset?.bottom ?? 0);
    document.documentElement.style.setProperty('--tg-safe-top', `${top}px`);
    document.documentElement.style.setProperty('--tg-safe-bottom', `${bottom}px`);
  };
  syncSafeArea();
  tg.onEvent('safeAreaChanged', syncSafeArea);
  tg.onEvent('contentSafeAreaChanged', syncSafeArea);
  tg.onEvent('fullscreenChanged', syncSafeArea);
}

export function haptic(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') {
  getTelegram()?.HapticFeedback.impactOccurred(style);
}

export function hapticNotify(type: 'error' | 'success' | 'warning') {
  getTelegram()?.HapticFeedback.notificationOccurred(type);
}

export function hapticSelect() {
  getTelegram()?.HapticFeedback.selectionChanged();
}

export function getTelegramUser() {
  return getTelegram()?.initDataUnsafe.user;
}

export function tgBackButton(onBack: (() => void) | null) {
  const tg = getTelegram();
  if (!tg) return;
  if (!onBack) {
    tg.BackButton.hide();
    return;
  }
  tg.BackButton.show();
  tg.BackButton.onClick(onBack);
  return () => {
    tg.BackButton.offClick(onBack);
  };
}

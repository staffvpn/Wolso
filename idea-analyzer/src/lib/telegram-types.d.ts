export {};

interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface TelegramHapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

interface TelegramBackButton {
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TelegramMainButton {
  show(): void;
  hide(): void;
  setText(text: string): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TelegramInvoiceStatus {
  status: 'paid' | 'cancelled' | 'failed' | 'pending';
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramWebAppUser };
  ready(): void;
  expand(): void;
  requestFullscreen?(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  setBottomBarColor?(color: string): void;
  enableClosingConfirmation(): void;
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  onEvent(event: string, cb: () => void): void;
  offEvent(event: string, cb: () => void): void;
  HapticFeedback: TelegramHapticFeedback;
  BackButton: TelegramBackButton;
  MainButton: TelegramMainButton;
  openInvoice(url: string, cb: (status: TelegramInvoiceStatus['status']) => void): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  showPopup?(params: { title?: string; message: string; buttons?: { id?: string; type?: string; text?: string }[] }, cb?: (id: string) => void): void;
  showAlert?(message: string, cb?: () => void): void;
  close(): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

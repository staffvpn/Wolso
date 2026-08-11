import { useEffect, useRef } from 'react';
import { useSessionStore } from '@/store/useSessionStore';
import { Logo } from '@/components/ui/Logo';
import type { TelegramLoginPayload } from '@/services/authApi';

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME as string | undefined;

declare global {
  interface Window {
    onWolsoTelegramAuth?: (user: TelegramLoginPayload) => void;
  }
}

export function Login() {
  const widgetRef = useRef<HTMLDivElement>(null);
  const status = useSessionStore((s) => s.status);
  const error = useSessionStore((s) => s.error);
  const loginWithTelegram = useSessionStore((s) => s.loginWithTelegram);

  useEffect(() => {
    window.onWolsoTelegramAuth = (user) => loginWithTelegram(user);

    if (!BOT_USERNAME || !widgetRef.current) return;
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '10');
    script.setAttribute('data-onauth', 'onWolsoTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    widgetRef.current.appendChild(script);

    return () => {
      delete window.onWolsoTelegramAuth;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg">
      <div className="w-full max-w-[360px] flex flex-col items-center text-center">
        <div className="h-12 w-12 rounded-full bg-accent-soft flex items-center justify-center mb-4">
          <Logo size={26} className="text-accent" />
        </div>
        <h1 className="font-extrabold text-[22px] tracking-tight">Wolso Admin</h1>
        <p className="text-[14px] text-text-muted mt-1.5 mb-8">
          Войдите через Telegram — доступ есть только у приглашённых сотрудников.
        </p>

        {!BOT_USERNAME && (
          <p className="text-[13px] text-danger bg-danger-soft rounded-xl px-4 py-3">
            VITE_BOT_USERNAME не задан — виджет входа Telegram не может загрузиться.
          </p>
        )}

        <div ref={widgetRef} />

        {status === 'loading' && <p className="text-[13px] text-text-faint mt-4">Входим…</p>}
        {status === 'error' && error && <p className="text-[13px] text-danger mt-4 max-w-[300px]">{error}</p>}
      </div>
    </div>
  );
}

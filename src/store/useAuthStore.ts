import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getTelegram } from '@/lib/telegram';

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

interface TelegramAuthUser {
  id: number;
  name: string;
  photoUrl?: string;
}

interface AuthState {
  workerToken: string | null;
  companyToken: string | null;
  telegramUser: TelegramAuthUser | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  bootstrap: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      workerToken: null,
      companyToken: null,
      telegramUser: null,
      status: 'idle',
      error: null,

      bootstrap: async () => {
        set({ status: 'loading', error: null });

        const initData = getTelegram()?.initData;
        if (!initData) {
          set({ status: 'error', error: 'Открой приложение через Telegram — вне Telegram авторизация недоступна.' });
          return;
        }
        if (!API_URL) {
          set({ status: 'error', error: 'Сервер не настроен (нет VITE_API_URL).' });
          return;
        }

        try {
          const res = await fetch(`${API_URL}/auth/telegram`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData }),
          });
          if (!res.ok) throw new Error(`auth_failed_${res.status}`);
          const data = await res.json() as { workerToken: string; companyToken: string; telegramUser: TelegramAuthUser };
          set({
            workerToken: data.workerToken,
            companyToken: data.companyToken,
            telegramUser: data.telegramUser,
            status: 'ready',
          });
        } catch {
          set({ status: 'error', error: 'Не получилось связаться с сервером. Проверь соединение и попробуй ещё раз.' });
        }
      },
    }),
    { name: 'wolso/auth', partialize: (s) => ({ workerToken: s.workerToken, companyToken: s.companyToken, telegramUser: s.telegramUser }) },
  ),
);

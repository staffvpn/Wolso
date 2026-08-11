import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getTelegram } from '@/lib/telegram';
import type { Role } from '@/types';

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

interface TelegramAuthUser {
  id: number;
  name: string;
  photoUrl?: string;
}

type Status = 'idle' | 'loading' | 'needs_role' | 'ready' | 'error';

interface AuthState {
  workerToken: string | null;
  companyToken: string | null;
  telegramUser: TelegramAuthUser | null;
  /** Wolso is one-account-one-role — this is the permanent role Telegram
   *  id is locked to, resolved by the server. Only staff can change it. */
  role: Role | null;
  status: Status;
  error: string | null;
  bootstrap: () => Promise<void>;
  chooseRole: (role: Role) => Promise<void>;
}

async function callAuth<T>(path: string, body: unknown): Promise<T> {
  if (!API_URL) throw new Error('VITE_API_URL is not set — see .env.example. The app has nothing to talk to without it.');
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const code = (payload as { error?: string }).error;
    throw new Error(`Сервер ответил ошибкой ${res.status}${code ? ` (${code})` : ''}.`);
  }
  return res.json() as Promise<T>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      workerToken: null,
      companyToken: null,
      telegramUser: null,
      role: null,
      status: 'idle',
      error: null,

      bootstrap: async () => {
        set({ status: 'loading', error: null });

        const initData = getTelegram()?.initData;
        if (!initData) {
          set({ status: 'error', error: 'Открой приложение через Telegram — вне Telegram авторизация недоступна.' });
          return;
        }

        try {
          const data = await callAuth<{
            needsRoleChoice?: boolean;
            role?: 'worker' | 'employer';
            workerToken?: string;
            companyToken?: string;
            telegramUser: TelegramAuthUser;
          }>('/auth/telegram', { initData });

          if (data.needsRoleChoice) {
            set({ status: 'needs_role', telegramUser: data.telegramUser });
            return;
          }

          set({
            workerToken: data.workerToken ?? null,
            companyToken: data.companyToken ?? null,
            telegramUser: data.telegramUser,
            role: data.role === 'employer' ? 'employer' : 'worker',
            status: 'ready',
          });
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          set({ status: 'error', error: `Не получилось связаться с сервером: ${detail}` });
        }
      },

      chooseRole: async (role) => {
        set({ status: 'loading', error: null });
        const initData = getTelegram()?.initData;
        if (!initData) {
          set({ status: 'error', error: 'Открой приложение через Telegram — вне Telegram авторизация недоступна.' });
          return;
        }
        try {
          const data = await callAuth<{
            role: 'worker' | 'employer';
            workerToken?: string;
            companyToken?: string;
            telegramUser: TelegramAuthUser;
          }>('/auth/choose-role', { initData, role });

          set({
            workerToken: data.workerToken ?? null,
            companyToken: data.companyToken ?? null,
            telegramUser: data.telegramUser,
            role: data.role === 'employer' ? 'employer' : 'worker',
            status: 'ready',
          });
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          set({ status: 'error', error: `Не получилось сохранить выбор: ${detail}` });
        }
      },
    }),
    {
      name: 'wolso/auth',
      partialize: (s) => ({ workerToken: s.workerToken, companyToken: s.companyToken, telegramUser: s.telegramUser, role: s.role }),
    },
  ),
);

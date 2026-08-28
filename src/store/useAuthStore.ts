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

type Status = 'idle' | 'loading' | 'needs_role' | 'ready' | 'error' | 'suspended';

interface AuthState {
  workerToken: string | null;
  companyToken: string | null;
  telegramUser: TelegramAuthUser | null;
  /** Wolso is one-account-one-role — this is the permanent role Telegram
   *  id is locked to, resolved by the server. Only staff can change it. */
  role: Role | null;
  status: Status;
  /** Set when the account is blocked — carries the reason to show. */
  suspension: Suspension | null;
  /** Called from apiClient when any request comes back account_suspended,
   *  so a session that was open when the block landed stops too. */
  markSuspended: (suspension: Suspension) => void;
  error: string | null;
  bootstrap: () => Promise<void>;
  chooseRole: (role: Role) => Promise<void>;
  /** Drops the current session and drives the app back through
   *  bootstrap() — used when the account this session points to no
   *  longer exists server-side (staff deleted it from the admin
   *  dashboard). Re-running /auth/telegram from scratch is what actually
   *  discovers there's no worker/company row anymore and routes to the
   *  role-choice screen, same as a genuinely new account. */
  signOut: () => void;
}

/** A blocked account, as the server describes it. */
export interface Suspension {
  reason: string | null;
  at: string | null;
}

/** Thrown when the server refuses because the account is blocked — carries
 *  the reason so the app can explain it rather than showing a generic
 *  failure. */
export class SuspendedError extends Error {
  suspension: Suspension;
  constructor(suspension: Suspension) {
    super('account_suspended');
    this.suspension = suspension;
  }
}

async function callAuth<T>(path: string, body: unknown): Promise<T> {
  if (!API_URL) throw new Error('VITE_API_URL is not set — see .env.example. The app has nothing to talk to without it.');
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string; reason?: string | null; suspendedAt?: string | null };
    if (payload.error === 'account_suspended') {
      throw new SuspendedError({ reason: payload.reason ?? null, at: payload.suspendedAt ?? null });
    }
    throw new Error(`Сервер ответил ошибкой ${res.status}${payload.error ? ` (${payload.error})` : ''}.`);
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
      suspension: null,

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
          if (err instanceof SuspendedError) {
            set({ status: 'suspended', suspension: err.suspension });
            return;
          }
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

      markSuspended: (suspension) => set({ status: 'suspended', suspension }),

      signOut: () => set({ workerToken: null, companyToken: null, telegramUser: null, role: null, status: 'idle' }),
    }),
    {
      name: 'wolso/auth',
      partialize: (s) => ({ workerToken: s.workerToken, companyToken: s.companyToken, telegramUser: s.telegramUser, role: s.role }),
    },
  ),
);

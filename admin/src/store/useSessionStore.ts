import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PermissionKey, RoleDef } from '@/types';
import { loginWithTelegram, type TelegramLoginPayload } from '@/services/authApi';
import { useRolesStore } from './useRolesStore';

interface StaffInfo {
  id: string;
  name: string;
  roleId: string;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface SessionState {
  token: string | null;
  staff: StaffInfo | null;
  status: Status;
  error: string | null;
  /** Re-validates a persisted session (or settles to 'idle' if there is none)
   *  on app start. */
  bootstrap: () => Promise<void>;
  loginWithTelegram: (payload: TelegramLoginPayload) => Promise<void>;
  logout: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      token: null,
      staff: null,
      status: 'idle',
      error: null,

      bootstrap: async () => {
        const { token, staff } = get();
        if (!token || !staff) {
          set({ status: 'idle' });
          return;
        }
        set({ status: 'loading' });
        try {
          await useRolesStore.getState().load();
          set({ status: 'ready' });
        } catch {
          set({ token: null, staff: null, status: 'idle' });
        }
      },

      loginWithTelegram: async (payload) => {
        set({ status: 'loading', error: null });
        try {
          const session = await loginWithTelegram(payload);
          set({ token: session.token, staff: { id: session.staffId, name: session.name, roleId: session.roleId }, status: 'ready' });
          await useRolesStore.getState().load();
        } catch {
          set({ status: 'error', error: 'Не удалось войти. Проверьте, что ваш Telegram-аккаунт добавлен в команду.' });
        }
      },

      logout: () => set({ token: null, staff: null, status: 'idle', error: null }),
    }),
    {
      name: 'wolso-admin/session',
      partialize: (s) => ({ token: s.token, staff: s.staff }),
    },
  ),
);

const FALLBACK_ROLE: RoleDef = {
  id: 'unknown',
  name: 'Без роли',
  description: '',
  isSystem: true,
  color: '#6b6d76',
  permissions: {
    approveVacancies: 'no',
    blockUsers: 'no',
    verifyDocuments: 'no',
    viewSupportChats: 'no',
    refundsPayouts: 'no',
    changeCommission: 'no',
    manageTeam: 'no',
    transferOwnership: 'no',
  },
};

/** The signed-in staff member's role, backed by the real roles list. */
export function useCurrentRole(): RoleDef {
  const roleId = useSessionStore((s) => s.staff?.roleId);
  const roles = useRolesStore((s) => s.roles);
  return roles.find((r) => r.id === roleId) ?? FALLBACK_ROLE;
}

export function useCan(key: PermissionKey): boolean {
  const role = useCurrentRole();
  return role.permissions[key] !== 'no';
}

/** Shorthand used when a screen needs "who's doing this" for display —
 *  the server derives the real actor from the session token independently,
 *  this is only for local UI copy. */
export function useCurrentActor(): { name: string; role: string } {
  const staff = useSessionStore((s) => s.staff);
  const role = useCurrentRole();
  return { name: staff?.name ?? '', role: role.name };
}

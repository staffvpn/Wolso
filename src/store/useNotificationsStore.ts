import { create } from 'zustand';
import type { AppNotification } from '@/types';
import { fetchNotifications, markAllNotificationsRead } from '@/services/notificationsApi';

interface NotificationsState {
  notifications: AppNotification[];
  loading: boolean;
  load: (as?: 'worker' | 'company') => Promise<void>;
  unreadCount: () => number;
  markAllRead: () => void;
  /** Local-only toast for something that just happened in this session
   *  (e.g. right after submitting a review) — not persisted server-side. */
  push: (n: Omit<AppNotification, 'id' | 'minutesAgo' | 'read'>) => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  loading: false,

  load: async (as = 'worker') => {
    set({ loading: true });
    try {
      const notifications = await fetchNotifications(as);
      set({ notifications, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  unreadCount: () => get().notifications.filter((n) => !n.read).length,

  markAllRead: () => {
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
    markAllNotificationsRead().catch(() => {});
  },

  push: (n) =>
    set((s) => ({
      notifications: [{ ...n, id: `local-${Date.now()}`, minutesAgo: 0, read: false }, ...s.notifications],
    })),
}));

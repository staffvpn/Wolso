import { create } from 'zustand';
import type { AppNotification } from '@/types';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/notificationsApi';

type Actor = 'worker' | 'company';

interface NotificationsState {
  notifications: AppNotification[];
  loading: boolean;
  /** Which side we last loaded as — remembered so markAllRead/markRead can
   *  hit the right endpoint without every caller having to pass it again. */
  actor: Actor;
  load: (as?: Actor) => Promise<void>;
  unreadCount: () => number;
  markAllRead: () => void;
  /** Tapping a single notification reads just that one — matches how a
   *  normal notification list behaves, without waiting for "Прочитать все". */
  markRead: (id: string) => void;
  /** Local-only toast for something that just happened in this session
   *  (e.g. right after submitting a review) — not persisted server-side. */
  push: (n: Omit<AppNotification, 'id' | 'minutesAgo' | 'read'>) => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  loading: false,
  actor: 'worker',

  load: async (as = 'worker') => {
    set({ loading: true, actor: as });
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
    markAllNotificationsRead(get().actor).catch(() => {});
  },

  markRead: (id) => {
    const target = get().notifications.find((n) => n.id === id);
    if (!target || target.read) return;
    set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
    // A locally-pushed toast (see push() below) has no row on the server —
    // nothing to mark read there.
    if (id.startsWith('local-')) return;
    markNotificationRead(id, get().actor).catch(() => {});
  },

  push: (n) =>
    set((s) => ({
      notifications: [{ ...n, id: `local-${Date.now()}`, minutesAgo: 0, read: false }, ...s.notifications],
    })),
}));

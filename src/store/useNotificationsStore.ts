import { create } from 'zustand';
import type { AppNotification } from '@/types';
import { NOTIFICATIONS } from '@/data/notifications';

interface NotificationsState {
  notifications: AppNotification[];
  unreadCount: () => number;
  markAllRead: () => void;
  push: (n: Omit<AppNotification, 'id' | 'minutesAgo' | 'read'>) => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: NOTIFICATIONS,
  unreadCount: () => get().notifications.filter((n) => !n.read).length,
  markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  push: (n) =>
    set((s) => ({
      notifications: [{ ...n, id: `n-${Date.now()}`, minutesAgo: 0, read: false }, ...s.notifications],
    })),
}));

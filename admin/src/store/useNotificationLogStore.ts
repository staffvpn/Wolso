import { create } from 'zustand';
import type { NotificationLogEntry } from '@/types';
import { fetchNotificationLog, type NotificationLogFilters } from '@/services/notificationLogApi';

interface NotificationLogState {
  entries: NotificationLogEntry[];
  /** Какие виды вообще встречаются в журнале — для выпадашки фильтра. */
  kinds: string[];
  migrationPending: boolean;
  loading: boolean;
  loaded: boolean;
  load: (filters?: NotificationLogFilters) => Promise<void>;
}

export const useNotificationLogStore = create<NotificationLogState>((set) => ({
  entries: [],
  kinds: [],
  migrationPending: false,
  loading: false,
  loaded: false,

  load: async (filters) => {
    set({ loading: true });
    try {
      const { entries, kinds, migrationPending } = await fetchNotificationLog(filters);
      set({ entries, kinds, migrationPending, loading: false, loaded: true });
    } catch {
      set({ loading: false, loaded: true });
    }
  },
}));

import { create } from 'zustand';
import type { AuditLogEntry } from '@/types';
import { fetchAuditLog, type AuditFilters } from '@/services/auditApi';

interface AuditState {
  entries: AuditLogEntry[];
  /** Кто вообще встречается в журнале — для выпадашки фильтра. */
  actors: string[];
  loading: boolean;
  loaded: boolean;
  load: (filters?: AuditFilters) => Promise<void>;
}

export const useAuditStore = create<AuditState>((set) => ({
  entries: [],
  actors: [],
  loading: false,
  loaded: false,

  load: async (filters) => {
    set({ loading: true });
    try {
      const { entries, actors } = await fetchAuditLog(filters);
      // actors приходит по всему журналу, а не по отфильтрованному куску,
      // иначе выбранный фильтр вычищал бы из списка сам себя.
      set({ entries, actors, loading: false, loaded: true });
    } catch {
      set({ loading: false, loaded: true });
    }
  },
}));

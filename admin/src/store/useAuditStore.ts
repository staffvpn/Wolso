import { create } from 'zustand';
import type { AuditLogEntry } from '@/types';
import { fetchAuditLog } from '@/services/auditApi';

interface AuditState {
  entries: AuditLogEntry[];
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
}

export const useAuditStore = create<AuditState>((set) => ({
  entries: [],
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true });
    const entries = await fetchAuditLog();
    set({ entries, loading: false, loaded: true });
  },
}));

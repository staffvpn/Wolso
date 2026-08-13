import { create } from 'zustand';
import { fetchDataStats, clearData, type DataStats } from '@/services/dataApi';

interface DataState {
  stats: DataStats | null;
  loading: boolean;
  load: () => Promise<void>;
  clear: (scope: string) => Promise<void>;
}

export const useDataStore = create<DataState>((set) => ({
  stats: null,
  loading: false,

  load: async () => {
    set({ loading: true });
    const stats = await fetchDataStats();
    set({ stats, loading: false });
  },

  clear: async (scope) => {
    await clearData(scope);
    const stats = await fetchDataStats();
    set({ stats });
  },
}));

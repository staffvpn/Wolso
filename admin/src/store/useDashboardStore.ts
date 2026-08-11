import { create } from 'zustand';
import type { DashboardStats } from '@/types';
import { fetchDashboardStats } from '@/services/dashboardApi';

interface DashboardState {
  stats: DashboardStats | null;
  loading: boolean;
  load: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: null,
  loading: false,

  load: async () => {
    set({ loading: true });
    const stats = await fetchDashboardStats();
    set({ stats, loading: false });
  },
}));

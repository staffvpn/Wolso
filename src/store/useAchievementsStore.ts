import { create } from 'zustand';
import { fetchAchievements, type Achievement } from '@/services/achievementsApi';

export type { Achievement };

interface AchievementsState {
  achievements: Achievement[];
  earnedCount: number;
  totalCount: number;
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
}

export const useAchievementsStore = create<AchievementsState>((set) => ({
  achievements: [],
  earnedCount: 0,
  totalCount: 0,
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true });
    try {
      const { achievements, earnedCount, totalCount } = await fetchAchievements();
      set({ achievements, earnedCount, totalCount, loading: false, loaded: true });
    } catch {
      // Тот же принцип, что у usePromoStore: недоступность бейджей — не
      // повод показывать человеку ошибку, просто список останется пустым.
      set({ loading: false, loaded: true });
    }
  },
}));

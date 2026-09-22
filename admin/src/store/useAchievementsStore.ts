import { create } from 'zustand';
import type { Achievement, AchievementInput } from '@/types';
import { createAchievement, deleteAchievement, fetchAchievements, recomputeAchievements, updateAchievement } from '@/services/achievementsApi';

interface AchievementsState {
  achievements: Achievement[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  recomputing: boolean;
  recomputeResult: string | null;

  load: () => Promise<void>;
  create: (input: AchievementInput) => Promise<void>;
  update: (id: string, input: Partial<AchievementInput>) => Promise<void>;
  setStatus: (id: string, status: 'active' | 'paused') => Promise<void>;
  remove: (id: string) => Promise<void>;
  recompute: () => Promise<void>;
}

export const useAchievementsStore = create<AchievementsState>((set, get) => ({
  achievements: [],
  loading: false,
  loaded: false,
  error: null,
  recomputing: false,
  recomputeResult: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      set({ achievements: await fetchAchievements(), loading: false, loaded: true });
    } catch (err) {
      set({ loading: false, loaded: true, error: (err as { code?: string }).code ?? 'unknown' });
    }
  },

  create: async (input) => {
    await createAchievement(input);
    await get().load();
  },

  update: async (id, input) => {
    await updateAchievement(id, input);
    await get().load();
  },

  setStatus: async (id, status) => {
    await updateAchievement(id, { status });
    set({ achievements: get().achievements.map((a) => (a.id === id ? { ...a, status } : a)) });
  },

  remove: async (id) => {
    await deleteAchievement(id);
    set({ achievements: get().achievements.filter((a) => a.id !== id) });
  },

  // Батч на сервере — 60 соискателей за вызов, поэтому цикл здесь же,
  // как у «Проверить бота» в useUsersStore: жмём ручку, пока remaining
  // не дойдёт до нуля.
  recompute: async () => {
    set({ recomputing: true, recomputeResult: null });
    try {
      let granted = 0;
      let checked = 0;
      for (let i = 0; i < 60; i++) {
        const res = await recomputeAchievements();
        granted += res.granted;
        checked += res.checked;
        if (res.checked === 0 || res.remaining === 0) break;
      }
      await get().load();
      set({ recomputeResult: checked === 0 ? 'Все соискатели уже проверены.' : `Проверено ${checked}, выдано новых бейджей: ${granted}.` });
    } catch {
      set({ recomputeResult: 'Не получилось пересчитать — попробуйте ещё раз.' });
    } finally {
      set({ recomputing: false });
    }
  },
}));

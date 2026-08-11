import { create } from 'zustand';
import type { VacancyRecord } from '@/types';
import { fetchAllVacancies, closeVacancy as closeVacancyApi } from '@/services/vacanciesApi';

interface VacanciesState {
  vacancies: VacancyRecord[];
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  closeVacancy: (id: string) => Promise<void>;
}

export const useVacanciesStore = create<VacanciesState>((set, get) => ({
  vacancies: [],
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true });
    const vacancies = await fetchAllVacancies();
    set({ vacancies, loading: false, loaded: true });
  },

  closeVacancy: async (id) => {
    set({ vacancies: get().vacancies.map((v) => (v.id === id ? { ...v, status: 'closed' } : v)) });
    await closeVacancyApi(id);
  },
}));

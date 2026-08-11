import { create } from 'zustand';
import type { Candidate, Vacancy } from '@/types';
import { fetchCandidates, fetchVacancies, createVacancy as createVacancyApi } from '@/services/employerApi';
import { haptic, hapticNotify } from '@/lib/telegram';

interface EmployerState {
  vacancies: Vacancy[];
  candidates: Candidate[];
  loading: boolean;
  loadAll: () => Promise<void>;
  pendingCandidates: () => Candidate[];
  decideCandidate: (candidateId: string, decision: 'accepted' | 'declined') => void;
  createVacancy: (input: Omit<Vacancy, 'id' | 'publishedMinAgo' | 'status' | 'reach'>) => Promise<Vacancy>;
}

export const useEmployerStore = create<EmployerState>((set, get) => ({
  vacancies: [],
  candidates: [],
  loading: true,

  loadAll: async () => {
    set({ loading: true });
    const [vacancies, candidates] = await Promise.all([fetchVacancies(), fetchCandidates()]);
    set({ vacancies, candidates, loading: false });
  },

  pendingCandidates: () => get().candidates.filter((c) => c.status === 'pending'),

  decideCandidate: (candidateId, decision) => {
    if (decision === 'accepted') hapticNotify('success');
    else haptic('light');
    set((s) => ({
      candidates: s.candidates.map((c) => (c.id === candidateId ? { ...c, status: decision } : c)),
    }));
  },

  createVacancy: async (input) => {
    const vacancy = await createVacancyApi(input);
    set((s) => ({ vacancies: [vacancy, ...s.vacancies] }));
    return vacancy;
  },
}));

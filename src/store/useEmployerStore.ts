import { create } from 'zustand';
import type { Candidate, Position, Vacancy } from '@/types';
import {
  fetchCandidates,
  fetchVacancies,
  fetchVacancyCandidates,
  decideCandidate as decideCandidateApi,
  closeShift as closeShiftApi,
  createVacancy as createVacancyApi,
} from '@/services/employerApi';
import { haptic, hapticNotify } from '@/lib/telegram';

interface EmployerState {
  vacancies: Vacancy[];
  candidates: Candidate[];
  loading: boolean;
  loadAll: () => Promise<void>;
  loadVacancyCandidates: (vacancyId: string, positionLabel?: string) => Promise<void>;
  pendingCandidates: () => Candidate[];
  decideCandidate: (vacancyId: string, candidateId: string, decision: 'accepted' | 'declined') => Promise<void>;
  closeShift: (vacancyId: string, candidateId: string, rating: number, tags: string[], comment: string) => Promise<void>;
  createVacancy: (input: {
    position: Position;
    positionLabel: string;
    date: string;
    startHour: number;
    startMin: number;
    endHour: number;
    endMin: number;
    hourlyRate: number;
    requirements: string[];
    description?: string;
    urgent: boolean;
  }) => Promise<Vacancy>;
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

  /** Merges in candidates for one vacancy — used by VacancyDetail so it works
   *  even before /employer/candidates has loaded everything. */
  loadVacancyCandidates: async (vacancyId, positionLabel) => {
    const fresh = await fetchVacancyCandidates(vacancyId, positionLabel);
    set((s) => ({
      candidates: [...s.candidates.filter((c) => c.vacancyId !== vacancyId), ...fresh],
    }));
  },

  pendingCandidates: () => get().candidates.filter((c) => c.status === 'pending'),

  decideCandidate: async (vacancyId, candidateId, decision) => {
    if (decision === 'accepted') hapticNotify('success');
    else haptic('light');
    set((s) => ({
      candidates: s.candidates.map((c) => (c.id === candidateId ? { ...c, status: decision } : c)),
    }));
    try {
      await decideCandidateApi(vacancyId, candidateId, decision);
    } catch {
      // Best-effort rollback — refetch to reconcile with the server.
      const candidates = await fetchCandidates();
      set({ candidates });
    }
  },

  closeShift: async (vacancyId, candidateId, rating, tags, comment) => {
    await closeShiftApi(vacancyId, candidateId, rating, tags, comment);
    hapticNotify('success');
    set((s) => ({
      candidates: s.candidates.map((c) =>
        c.id === candidateId ? { ...c, workStage: 'employer_closed', closedByEmployerAt: new Date().toISOString() } : c,
      ),
    }));
  },

  createVacancy: async (input) => {
    const vacancy = await createVacancyApi(input);
    set((s) => ({ vacancies: [vacancy, ...s.vacancies] }));
    return vacancy;
  },
}));

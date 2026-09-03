import { create } from 'zustand';
import type { Candidate, Position, Vacancy } from '@/types';
import {
  fetchCandidates,
  fetchVacancies,
  fetchVacancyCandidates,
  decideCandidate as decideCandidateApi,
  cancelCandidate as cancelCandidateApi,
  closeShift as closeShiftApi,
  createVacancy as createVacancyApi,
  updateVacancy as updateVacancyApi,
  deleteVacancy as deleteVacancyApi,
} from '@/services/employerApi';
import { haptic, hapticNotify } from '@/lib/telegram';

interface EmployerState {
  vacancies: Vacancy[];
  candidates: Candidate[];
  loading: boolean;
  /** Settles true once loadAll has finished, however it finished. Read by
   *  HomeRedirect (App.tsx), which has to know whether this employer has a
   *  vacancy before it can pick a landing screen — and must not sit on a
   *  spinner forever if the request fails. */
  loaded: boolean;
  loadAll: () => Promise<void>;
  loadVacancyCandidates: (vacancyId: string, positionLabel?: string) => Promise<void>;
  pendingCandidates: () => Candidate[];
  decideCandidate: (vacancyId: string, candidateId: string, decision: 'accepted' | 'declined') => Promise<void>;
  cancelCandidate: (vacancyId: string, candidateId: string, reason: string) => Promise<void>;
  closeShift: (vacancyId: string, candidateId: string, rating: number, tags: string[], comment: string) => Promise<void>;
  createVacancy: (input: {
    position: Position;
    positionLabel: string;
    date: string;
    endDate?: string;
    startHour: number;
    startMin: number;
    endHour: number;
    endMin: number;
    hourlyRate: number;
    requirements: string[];
    employmentType: Vacancy['employmentType'];
    description?: string;
    urgent: boolean;
  }) => Promise<Vacancy>;
  updateVacancy: (vacancyId: string, input: Parameters<typeof updateVacancyApi>[1]) => Promise<Vacancy>;
  deleteVacancy: (vacancyId: string) => Promise<void>;
}

export const useEmployerStore = create<EmployerState>((set, get) => ({
  vacancies: [],
  candidates: [],
  loading: true,
  loaded: false,

  loadAll: async () => {
    set({ loading: true });
    try {
      const [vacancies, candidates] = await Promise.all([fetchVacancies(), fetchCandidates()]);
      set({ vacancies, candidates, loading: false, loaded: true });
    } catch {
      set({ loading: false, loaded: true });
    }
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
    // "accepted" here means "employer wants to move forward" — the server
    // turns that into an invitation, not an immediate hire, so the local
    // optimistic status has to match or the UI would claim someone's
    // hired before they've actually confirmed.
    const status = decision === 'accepted' ? 'invited' : 'declined';
    set((s) => ({
      candidates: s.candidates.map((c) => (c.id === candidateId ? { ...c, status } : c)),
    }));
    try {
      await decideCandidateApi(vacancyId, candidateId, decision);
    } catch {
      // Best-effort rollback — refetch to reconcile with the server.
      const candidates = await fetchCandidates();
      set({ candidates });
    }
  },

  cancelCandidate: async (vacancyId, candidateId, reason) => {
    await cancelCandidateApi(vacancyId, candidateId, reason);
    haptic('light');
    set((s) => ({
      candidates: s.candidates.map((c) =>
        c.id === candidateId ? { ...c, status: 'cancelled', cancelledBy: 'employer', cancelReason: reason } : c,
      ),
    }));
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

  updateVacancy: async (vacancyId, input) => {
    const vacancy = await updateVacancyApi(vacancyId, input);
    set((s) => ({ vacancies: s.vacancies.map((v) => (v.id === vacancyId ? vacancy : v)) }));
    return vacancy;
  },

  // Drops the vacancy and every candidate row that pointed at it — the
  // server cascade-deletes the applications, so keeping them in the store
  // would leave orphans referencing a vacancy that no longer exists.
  deleteVacancy: async (vacancyId) => {
    await deleteVacancyApi(vacancyId);
    set((s) => ({
      vacancies: s.vacancies.filter((v) => v.id !== vacancyId),
      candidates: s.candidates.filter((c) => c.vacancyId !== vacancyId),
    }));
  },
}));

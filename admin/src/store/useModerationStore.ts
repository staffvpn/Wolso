import { create } from 'zustand';
import type { ComplaintItem, ModerationStatus, ModerationVacancy } from '@/types';
import {
  fetchPendingVacancies,
  fetchPendingComplaints,
  decideVacancy as decideVacancyApi,
  decideComplaint as decideComplaintApi,
} from '@/services/moderationApi';

interface ModerationState {
  vacancies: ModerationVacancy[];
  complaints: ComplaintItem[];
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  decideVacancy: (id: string, status: ModerationStatus) => Promise<void>;
  decideComplaint: (id: string, status: ModerationStatus) => Promise<void>;
}

const VACANCY_STATUS: Record<string, 'active' | 'pending_review' | 'rejected'> = {
  approved: 'active',
  returned: 'pending_review',
  rejected: 'rejected',
};

export const useModerationStore = create<ModerationState>((set, get) => ({
  vacancies: [],
  complaints: [],
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true });
    const [vacancies, complaints] = await Promise.all([fetchPendingVacancies(), fetchPendingComplaints()]);
    set({ vacancies, complaints, loading: false, loaded: true });
  },

  decideVacancy: async (id, status) => {
    set({ vacancies: get().vacancies.filter((v) => v.id !== id) });
    await decideVacancyApi(id, VACANCY_STATUS[status] ?? 'pending_review');
  },

  decideComplaint: async (id, status) => {
    set({ complaints: get().complaints.filter((c) => c.id !== id) });
    await decideComplaintApi(id, status as 'approved' | 'returned' | 'rejected');
  },
}));

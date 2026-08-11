import { create } from 'zustand';
import type { ComplaintItem, DocumentReview, EmployerReview, ModerationStatus, ModerationVacancy } from '@/types';
import {
  fetchPendingVacancies,
  fetchPendingComplaints,
  fetchPendingDocuments,
  fetchPendingEmployers,
  decideVacancy as decideVacancyApi,
  decideComplaint as decideComplaintApi,
  decideDocument as decideDocumentApi,
  decideEmployer as decideEmployerApi,
} from '@/services/moderationApi';

interface ModerationState {
  vacancies: ModerationVacancy[];
  complaints: ComplaintItem[];
  documents: DocumentReview[];
  employers: EmployerReview[];
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  decideVacancy: (id: string, status: ModerationStatus) => Promise<void>;
  decideComplaint: (id: string, status: ModerationStatus) => Promise<void>;
  decideDocument: (id: string, status: ModerationStatus) => Promise<void>;
  decideEmployer: (id: string, status: ModerationStatus) => Promise<void>;
}

const VACANCY_STATUS: Record<string, 'active' | 'pending_review' | 'rejected'> = {
  approved: 'active',
  returned: 'pending_review',
  rejected: 'rejected',
};

const DOCUMENT_STATUS: Record<string, 'verified' | 'missing'> = {
  approved: 'verified',
  returned: 'missing',
  rejected: 'missing',
};

export const useModerationStore = create<ModerationState>((set, get) => ({
  vacancies: [],
  complaints: [],
  documents: [],
  employers: [],
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true });
    const [vacancies, complaints, documents, employers] = await Promise.all([
      fetchPendingVacancies(),
      fetchPendingComplaints(),
      fetchPendingDocuments(),
      fetchPendingEmployers(),
    ]);
    set({ vacancies, complaints, documents, employers, loading: false, loaded: true });
  },

  decideVacancy: async (id, status) => {
    set({ vacancies: get().vacancies.filter((v) => v.id !== id) });
    await decideVacancyApi(id, VACANCY_STATUS[status] ?? 'pending_review');
  },

  decideComplaint: async (id, status) => {
    set({ complaints: get().complaints.filter((c) => c.id !== id) });
    await decideComplaintApi(id, status as 'approved' | 'returned' | 'rejected');
  },

  decideDocument: async (id, status) => {
    set({ documents: get().documents.filter((d) => d.id !== id) });
    await decideDocumentApi(id, DOCUMENT_STATUS[status] ?? 'missing');
  },

  decideEmployer: async (id, status) => {
    set({ employers: get().employers.filter((e) => e.id !== id) });
    await decideEmployerApi(id, status === 'rejected' ? 'rejected' : 'approved');
  },
}));

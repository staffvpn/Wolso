import { create } from 'zustand';
import type { EmployerVerification } from '@/types';
import {
  fetchEmployerVerifications,
  approveEmployerVerification,
  rejectEmployerVerification,
  recheckEmployerVerification,
} from '@/services/verificationApi';

interface VerificationState {
  employers: EmployerVerification[];
  loading: boolean;
  loaded: boolean;
  rechecking: string | null;
  load: () => Promise<void>;
  approve: (id: string) => Promise<void>;
  reject: (id: string, reason: string) => Promise<void>;
  recheck: (id: string) => Promise<void>;
}

export const useVerificationStore = create<VerificationState>((set, get) => ({
  employers: [],
  loading: false,
  loaded: false,
  rechecking: null,

  load: async () => {
    set({ loading: true });
    const employers = await fetchEmployerVerifications('pending');
    set({ employers, loading: false, loaded: true });
  },

  approve: async (id) => {
    await approveEmployerVerification(id);
    set({ employers: get().employers.filter((e) => e.id !== id) });
  },

  reject: async (id, reason) => {
    await rejectEmployerVerification(id, reason);
    set({ employers: get().employers.filter((e) => e.id !== id) });
  },

  recheck: async (id) => {
    set({ rechecking: id });
    try {
      const aiSummary = await recheckEmployerVerification(id);
      set({ employers: get().employers.map((e) => (e.id === id ? { ...e, aiSummary, aiCheckedAt: new Date().toISOString() } : e)) });
    } finally {
      set({ rechecking: null });
    }
  },
}));

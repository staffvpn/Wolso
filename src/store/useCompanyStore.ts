import { create } from 'zustand';
import type { Company } from '@/types';
import {
  fetchMyCompany,
  updateMyCompany,
  uploadCompanyAvatar,
  uploadCompanyPhoto,
  deleteCompanyPhoto,
  type CompanyUpdate,
} from '@/services/companyApi';
import { hapticNotify } from '@/lib/telegram';

interface CompanyState {
  company: Company | null;
  loading: boolean;
  loaded: boolean;
  error: boolean;
  load: () => Promise<void>;
  updateCompany: (update: CompanyUpdate) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  uploadPhoto: (file: File) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  company: null,
  loading: false,
  loaded: false,
  error: false,

  load: async () => {
    set({ loading: true, error: false });
    try {
      const company = await fetchMyCompany();
      set({ company, loading: false, loaded: true });
    } catch {
      // EmployerProfileGate (AuthGate.tsx) blocks the entire app on `loaded`
      // — a request that fails and never resolves it would soft-lock every
      // employer session on a spinner forever, so this has to settle either way.
      set({ loading: false, loaded: true, error: true });
    }
  },

  updateCompany: async (update) => {
    const company = await updateMyCompany(update);
    set({ company, loaded: true });
    hapticNotify('success');
  },

  uploadAvatar: async (file) => {
    const company = await uploadCompanyAvatar(file);
    set({ company, loaded: true });
    hapticNotify('success');
  },

  uploadPhoto: async (file) => {
    const company = await uploadCompanyPhoto(file);
    set({ company, loaded: true });
    hapticNotify('success');
  },

  deletePhoto: async (id) => {
    const company = await deleteCompanyPhoto(id);
    set({ company, loaded: true });
  },
}));

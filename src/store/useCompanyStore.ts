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

  load: async () => {
    set({ loading: true });
    try {
      const company = await fetchMyCompany();
      set({ company, loading: false, loaded: true });
    } catch {
      set({ loading: false });
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

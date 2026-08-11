import { create } from 'zustand';
import type { Company } from '@/types';
import { fetchMyCompany } from '@/services/companyApi';

interface CompanyState {
  company: Company | null;
  loading: boolean;
  load: () => Promise<void>;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  company: null,
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const company = await fetchMyCompany();
      set({ company, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));

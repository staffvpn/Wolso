import { create } from 'zustand';
import type { Company, Shift } from '@/types';
import { apiFetch } from '@/lib/apiClient';

interface FavoritesState {
  shiftIds: string[];
  companyIds: string[];
  shifts: Shift[];
  companies: Company[];
  loading: boolean;
  load: () => Promise<void>;
  toggleShift: (id: string) => Promise<void>;
  toggleCompany: (id: string) => Promise<void>;
  removeShift: (id: string) => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  shiftIds: [],
  companyIds: [],
  shifts: [],
  companies: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const { shifts, companies } = await apiFetch<{ shifts: Shift[]; companies: Company[] }>('/favorites');
      set({
        shifts,
        companies,
        shiftIds: shifts.map((s) => s.id),
        companyIds: companies.map((c) => c.id),
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  toggleShift: async (id) => {
    const wasFavorite = get().shiftIds.includes(id);
    set((s) => ({ shiftIds: wasFavorite ? s.shiftIds.filter((x) => x !== id) : [...s.shiftIds, id] }));
    try {
      await apiFetch(`/favorites/shifts/${id}`, { method: 'POST' });
    } catch {
      set((s) => ({ shiftIds: wasFavorite ? [...s.shiftIds, id] : s.shiftIds.filter((x) => x !== id) }));
    }
  },

  toggleCompany: async (id) => {
    const wasFavorite = get().companyIds.includes(id);
    set((s) => ({ companyIds: wasFavorite ? s.companyIds.filter((x) => x !== id) : [...s.companyIds, id] }));
    try {
      await apiFetch(`/favorites/companies/${id}`, { method: 'POST' });
    } catch {
      set((s) => ({ companyIds: wasFavorite ? [...s.companyIds, id] : s.companyIds.filter((x) => x !== id) }));
    }
  },

  removeShift: async (id) => {
    set((s) => ({ shiftIds: s.shiftIds.filter((x) => x !== id), shifts: s.shifts.filter((x) => x.id !== id) }));
    await apiFetch(`/favorites/shifts/${id}`, { method: 'POST' }).catch(() => {});
  },
}));

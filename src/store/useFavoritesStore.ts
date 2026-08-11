import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FavoritesState {
  shiftIds: string[];
  companyIds: string[];
  toggleShift: (id: string) => void;
  toggleCompany: (id: string) => void;
  removeShift: (id: string) => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set) => ({
      shiftIds: [],
      companyIds: [],
      toggleShift: (id) =>
        set((s) => ({
          shiftIds: s.shiftIds.includes(id) ? s.shiftIds.filter((x) => x !== id) : [...s.shiftIds, id],
        })),
      toggleCompany: (id) =>
        set((s) => ({
          companyIds: s.companyIds.includes(id) ? s.companyIds.filter((x) => x !== id) : [...s.companyIds, id],
        })),
      removeShift: (id) => set((s) => ({ shiftIds: s.shiftIds.filter((x) => x !== id) })),
    }),
    { name: 'wolso/favorites' },
  ),
);

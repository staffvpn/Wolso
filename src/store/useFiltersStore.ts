import { create } from 'zustand';
import type { Filters, Position } from '@/types';

const DEFAULT_FILTERS: Filters = {
  positions: [],
  rateFrom: 200,
  radiusKm: 'city',
  urgentOnly: false,
  employmentType: 'shift',
  when: 'today',
  timeOfDay: [],
  verifiedOnly: false,
};

interface FiltersState {
  filters: Filters;
  togglePosition: (p: Position) => void;
  setRateFrom: (n: number) => void;
  setRadius: (r: number | 'city') => void;
  setUrgentOnly: (v: boolean) => void;
  setEmploymentType: (t: Filters['employmentType']) => void;
  setWhen: (w: Filters['when']) => void;
  toggleTimeOfDay: (t: Filters['timeOfDay'][number]) => void;
  setVerifiedOnly: (v: boolean) => void;
  reset: () => void;
}

export const useFiltersStore = create<FiltersState>((set) => ({
  filters: DEFAULT_FILTERS,
  togglePosition: (p) =>
    set((s) => ({
      filters: {
        ...s.filters,
        positions: s.filters.positions.includes(p)
          ? s.filters.positions.filter((x) => x !== p)
          : [...s.filters.positions, p],
      },
    })),
  setRateFrom: (n) => set((s) => ({ filters: { ...s.filters, rateFrom: n } })),
  setRadius: (r) => set((s) => ({ filters: { ...s.filters, radiusKm: r } })),
  setUrgentOnly: (v) => set((s) => ({ filters: { ...s.filters, urgentOnly: v } })),
  setEmploymentType: (t) => set((s) => ({ filters: { ...s.filters, employmentType: t } })),
  setWhen: (w) => set((s) => ({ filters: { ...s.filters, when: w } })),
  toggleTimeOfDay: (t) =>
    set((s) => ({
      filters: {
        ...s.filters,
        timeOfDay: s.filters.timeOfDay.includes(t)
          ? s.filters.timeOfDay.filter((x) => x !== t)
          : [...s.filters.timeOfDay, t],
      },
    })),
  setVerifiedOnly: (v) => set((s) => ({ filters: { ...s.filters, verifiedOnly: v } })),
  reset: () => set({ filters: DEFAULT_FILTERS }),
}));

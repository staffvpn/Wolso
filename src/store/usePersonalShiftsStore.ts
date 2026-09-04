import { create } from 'zustand';
import type { PersonalShift } from '@/types';
import {
  fetchPersonalShifts,
  createPersonalShift,
  updatePersonalShift,
  deletePersonalShift,
  type PersonalShiftInput,
} from '@/services/personalShiftsApi';

interface PersonalShiftsState {
  shifts: PersonalShift[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (input: PersonalShiftInput) => Promise<void>;
  update: (id: string, input: Partial<PersonalShiftInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const usePersonalShiftsStore = create<PersonalShiftsState>((set, get) => ({
  shifts: [],
  loaded: false,

  load: async () => {
    try {
      set({ shifts: await fetchPersonalShifts(), loaded: true });
    } catch {
      // Экран смен не должен падать целиком из-за личных смен: смены из
      // Wolso важнее, и они грузятся отдельным запросом.
      set({ loaded: true });
    }
  },

  add: async (input) => {
    const shift = await createPersonalShift(input);
    set({ shifts: [shift, ...get().shifts] });
  },

  update: async (id, input) => {
    const shift = await updatePersonalShift(id, input);
    set({ shifts: get().shifts.map((s) => (s.id === id ? shift : s)) });
  },

  remove: async (id) => {
    await deletePersonalShift(id);
    set({ shifts: get().shifts.filter((s) => s.id !== id) });
  },
}));

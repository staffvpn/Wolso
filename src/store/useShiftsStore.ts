import { create } from 'zustand';
import type { Shift } from '@/types';
import { fetchShifts } from '@/services/shiftsApi';
import { useFiltersStore } from './useFiltersStore';
import { useApplicationsStore } from './useApplicationsStore';
import { hapticNotify, haptic } from '@/lib/telegram';

interface ShiftsState {
  deck: Shift[];
  loading: boolean;
  index: number;
  lastAction: { shift: Shift; direction: 'left' | 'right' } | null;
  lastApplied: Shift | null;
  /** Код ошибки последнего отклика, если сервер его не принял. Раньше
   *  отклик отправлялся и забывался: экран показывал «отклик отправлен»
   *  даже когда его отклонили — по лимиту, по скрытой анкете или по чужому
   *  фото, — и человек ждал ответа на заявку, которой не существует. */
  applyError: string | null;
  history: { shift: Shift; direction: 'left' | 'right' }[];
  loadDeck: () => Promise<void>;
  swipe: (direction: 'left' | 'right') => void;
  undoLast: () => void;
  clearLastApplied: () => void;
  clearApplyError: () => void;
}

export const useShiftsStore = create<ShiftsState>((set, get) => ({
  deck: [],
  loading: true,
  index: 0,
  lastAction: null,
  lastApplied: null,
  applyError: null,
  history: [],

  loadDeck: async () => {
    set({ loading: true, index: 0, lastAction: null });
    const filters = useFiltersStore.getState().filters;
    const shifts = await fetchShifts(filters);
    set({ deck: shifts, loading: false });
  },

  swipe: (direction) => {
    const { deck, index, history } = get();
    const shift = deck[index];
    if (!shift) return;

    if (direction === 'right') {
      hapticNotify('success');
      set({ lastApplied: shift, applyError: null });
      // Отказ сервера снимает «отклик отправлен» и называет причину:
      // молча съеденная ошибка здесь означает человека, который ждёт
      // ответа на заявку, которой нет.
      void useApplicationsStore
        .getState()
        .apply(shift.id)
        .catch((err) => {
          const code = (err as { code?: string } | null)?.code;
          set({ lastApplied: null, applyError: code ?? 'unknown' });
        });
    } else {
      haptic('light');
    }

    set({
      index: index + 1,
      lastAction: { shift, direction },
      history: [...history, { shift, direction }],
    });
  },

  undoLast: () => {
    // Premium-gated in the UI (see useEntitlementsStore) — kept here so the
    // real behaviour exists once the feature ships.
    const { history, index } = get();
    if (history.length === 0) return;
    set({ index: Math.max(0, index - 1), history: history.slice(0, -1) });
  },

  clearLastApplied: () => set({ lastApplied: null }),
  clearApplyError: () => set({ applyError: null }),
}));

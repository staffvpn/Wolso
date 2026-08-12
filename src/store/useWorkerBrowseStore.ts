import { create } from 'zustand';
import type { Position, WorkerListing } from '@/types';
import { fetchWorkerListings, passWorker } from '@/services/employerApi';
import { haptic } from '@/lib/telegram';

interface WorkerBrowseState {
  positions: Position[];
  deck: WorkerListing[];
  index: number;
  loading: boolean;
  loaded: boolean;
  setPositions: (positions: Position[]) => void;
  loadDeck: () => Promise<void>;
  /** Left swipe — records the pass server-side so this person doesn't
   *  reappear next time, and moves on to the next card. */
  pass: () => void;
  /** Right swipe ("Написать") advances the deck locally — the actual chat
   *  is started by the screen (it needs to navigate), this just keeps the
   *  card from lingering once that's underway. */
  advance: () => void;
}

export const useWorkerBrowseStore = create<WorkerBrowseState>((set, get) => ({
  positions: [],
  deck: [],
  index: 0,
  loading: false,
  loaded: false,

  setPositions: (positions) => set({ positions }),

  loadDeck: async () => {
    const { positions } = get();
    // No position picked yet — an empty deck (with its own "choose a
    // position" empty state) beats silently showing every worker on the
    // platform regardless of what the employer is actually hiring for.
    if (positions.length === 0) {
      set({ deck: [], index: 0, loaded: true });
      return;
    }
    set({ loading: true, index: 0 });
    try {
      const deck = await fetchWorkerListings(positions);
      set({ deck, loading: false, loaded: true });
    } catch {
      set({ loading: false });
    }
  },

  pass: () => {
    const { deck, index } = get();
    const worker = deck[index];
    if (!worker) return;
    haptic('light');
    passWorker(worker.workerId).catch(() => {});
    set({ index: index + 1 });
  },

  advance: () => set((s) => ({ index: s.index + 1 })),
}));

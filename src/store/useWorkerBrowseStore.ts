import { create } from 'zustand';
import type { Position, WorkerListing } from '@/types';
import { fetchWorkerListings, passWorker, inviteWorkerToShift } from '@/services/employerApi';
import { haptic, hapticNotify } from '@/lib/telegram';

interface WorkerBrowseState {
  /** The shift being staffed right now — every invite in this deck goes
   *  onto it, so browsing is always scoped to one real, active vacancy
   *  rather than a free-floating position filter. */
  shiftId: string | null;
  position: Position | null;
  deck: WorkerListing[];
  index: number;
  loading: boolean;
  loaded: boolean;
  setVacancy: (shiftId: string, position: Position) => void;
  loadDeck: () => Promise<void>;
  /** Left swipe — records the pass server-side so this person doesn't
   *  reappear next time, and moves on to the next card. */
  pass: () => void;
  /** Right swipe ("Пригласить на смену") — invites the current card's
   *  worker onto `shiftId` server-side, then advances. Returns the
   *  resulting chat id (null on failure) so the screen can open it. */
  invite: () => Promise<string | null>;
}

export const useWorkerBrowseStore = create<WorkerBrowseState>((set, get) => ({
  shiftId: null,
  position: null,
  deck: [],
  index: 0,
  loading: false,
  loaded: false,

  setVacancy: (shiftId, position) => {
    if (shiftId === get().shiftId) return;
    set({ shiftId, position, deck: [], index: 0, loaded: false });
  },

  loadDeck: async () => {
    const { position } = get();
    // No vacancy picked yet — an empty deck (with its own "pick a shift"
    // empty state) beats silently showing every worker on the platform
    // regardless of what's actually open right now.
    if (!position) {
      set({ deck: [], index: 0, loaded: true });
      return;
    }
    set({ loading: true, index: 0 });
    try {
      const deck = await fetchWorkerListings([position]);
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

  invite: async () => {
    const { deck, index, shiftId } = get();
    const worker = deck[index];
    if (!worker || !shiftId) return null;
    set({ index: index + 1 });
    try {
      const chatId = await inviteWorkerToShift(shiftId, worker.workerId);
      hapticNotify('success');
      return chatId;
    } catch {
      return null;
    }
  },
}));

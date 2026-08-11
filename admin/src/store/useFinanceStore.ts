import { create } from 'zustand';
import type { Transaction } from '@/types';
import { TRANSACTIONS, PAYOUT_TODAY } from '@/data/finance';

/** Dormant behind FEATURES.payments — kept mock-driven on purpose until the
 *  real payout provider is wired up (see project history). No backend
 *  routes exist for this yet, so this deliberately doesn't touch the real
 *  audit log; it stays a local-only demo trail. */
interface FinanceState {
  transactions: Transaction[];
  payoutToday: number;
  running: boolean;
  runPayouts: (actor: { name: string; role: string }) => Promise<void>;
  resolveDispute: (id: string, outcome: 'paid' | 'dispute', actor: { name: string; role: string }) => void;
}

export const useFinanceStore = create<FinanceState>((set) => ({
  transactions: TRANSACTIONS,
  payoutToday: PAYOUT_TODAY,
  running: false,

  runPayouts: async () => {
    set({ running: true });
    await new Promise((r) => setTimeout(r, 900));
    set((s) => ({
      running: false,
      payoutToday: 0,
      transactions: s.transactions.map((t) => (t.status === 'processing' ? { ...t, status: 'paid' as const } : t)),
    }));
  },

  resolveDispute: (id, outcome) => {
    set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, status: outcome } : t)) }));
  },
}));

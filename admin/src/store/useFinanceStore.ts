import { create } from 'zustand';
import type { Transaction } from '@/types';
import { TRANSACTIONS, PAYOUT_TODAY } from '@/data/finance';
import { useAuditStore } from './useAuditStore';
import { formatMoney } from '@/lib/format';

interface FinanceState {
  transactions: Transaction[];
  payoutToday: number;
  running: boolean;
  runPayouts: (actor: { name: string; role: string }) => Promise<void>;
  resolveDispute: (id: string, outcome: 'paid' | 'dispute', actor: { name: string; role: string }) => void;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  transactions: TRANSACTIONS,
  payoutToday: PAYOUT_TODAY,
  running: false,

  runPayouts: async (actor) => {
    set({ running: true });
    await new Promise((r) => setTimeout(r, 900));
    const amount = get().payoutToday;
    set((s) => ({
      running: false,
      payoutToday: 0,
      transactions: s.transactions.map((t) => (t.status === 'processing' ? { ...t, status: 'paid' as const } : t)),
    }));
    useAuditStore.getState().log(actor.name, actor.role, `провела выплаты на сумму ${formatMoney(amount)}`, 'accent');
  },

  resolveDispute: (id, outcome, actor) => {
    const tx = get().transactions.find((t) => t.id === id);
    set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, status: outcome } : t)) }));
    if (tx) {
      useAuditStore
        .getState()
        .log(actor.name, actor.role, `${outcome === 'paid' ? 'разрешила спор и выплатила' : 'оставила в споре'} — ${tx.workerName} · ${tx.shiftLabel}`, outcome === 'paid' ? 'accent' : 'danger');
    }
  },
}));

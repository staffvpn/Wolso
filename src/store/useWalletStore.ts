import { create } from 'zustand';
import type { Transaction } from '@/types';
import { TRANSACTIONS, WALLET_AVAILABLE, WALLET_DEFAULT_CARD, WALLET_MONTH_TOTAL } from '@/data/wallet';
import { hapticNotify } from '@/lib/telegram';

interface WalletState {
  available: number;
  monthTotal: number;
  defaultCard: string;
  transactions: Transaction[];
  withdrawing: boolean;
  withdraw: () => Promise<void>;
  addEarning: (title: string, amount: number) => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  available: WALLET_AVAILABLE,
  monthTotal: WALLET_MONTH_TOTAL,
  defaultCard: WALLET_DEFAULT_CARD,
  transactions: TRANSACTIONS,
  withdrawing: false,

  withdraw: async () => {
    if (get().available <= 0) return;
    set({ withdrawing: true });
    await new Promise((r) => setTimeout(r, 900));
    const amount = get().available;
    set((s) => ({
      withdrawing: false,
      available: 0,
      transactions: [
        { id: `tx-${Date.now()}`, kind: 'withdrawal_out', title: `Вывод на карту ${s.defaultCard}`, subtitle: 'Сегодня', amount: -amount, createdAt: new Date().toISOString() },
        ...s.transactions,
      ],
    }));
    hapticNotify('success');
  },

  addEarning: (title, amount) =>
    set((s) => ({
      available: s.available + amount,
      monthTotal: s.monthTotal + amount,
      transactions: [
        { id: `tx-${Date.now()}`, kind: 'payout_in', title, subtitle: 'Сегодня', amount, createdAt: new Date().toISOString() },
        ...s.transactions,
      ],
    })),
}));

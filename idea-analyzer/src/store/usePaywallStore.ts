import { create } from 'zustand';
import { apiFetch } from '@/lib/apiClient';
import { openInvoice, hapticNotify } from '@/lib/telegram';
import { useEntitlementStore } from './useEntitlementStore';

type PurchaseKind = 'credit' | 'pro';
type PurchaseStatus = 'idle' | 'pending' | 'error';

interface PaywallState {
  open: boolean;
  purchaseStatus: PurchaseStatus;
  purchaseError: string | null;
  openPaywall: () => void;
  closePaywall: () => void;
  purchase: (kind: PurchaseKind) => Promise<void>;
}

export const usePaywallStore = create<PaywallState>((set) => ({
  open: false,
  purchaseStatus: 'idle',
  purchaseError: null,

  openPaywall: () => set({ open: true, purchaseStatus: 'idle', purchaseError: null }),
  closePaywall: () => set({ open: false }),

  purchase: async (kind) => {
    set({ purchaseStatus: 'pending', purchaseError: null });
    try {
      const { link } = await apiFetch<{ link: string }>('/payments/invoice', { method: 'POST', body: { kind } });
      const status = await openInvoice(link);

      if (status === 'paid') {
        hapticNotify('success');
        // The Bot API webhook that credits the purchase can land a beat
        // after openInvoice resolves — a short poll covers that race
        // instead of showing a stale "still locked" paywall right after
        // a successful payment.
        for (let attempt = 0; attempt < 5; attempt++) {
          await useEntitlementStore.getState().refresh();
          const ent = useEntitlementStore.getState().entitlement;
          if (ent?.canAnalyze) break;
          await new Promise((r) => setTimeout(r, 900));
        }
        set({ open: false, purchaseStatus: 'idle' });
      } else if (status === 'cancelled') {
        set({ purchaseStatus: 'idle' });
      } else {
        hapticNotify('error');
        set({ purchaseStatus: 'error', purchaseError: 'Платёж не прошёл. Попробуйте ещё раз.' });
      }
    } catch {
      hapticNotify('error');
      set({ purchaseStatus: 'error', purchaseError: 'Не удалось создать счёт. Попробуйте ещё раз.' });
    }
  },
}));

import { create } from 'zustand';
import { apiFetch } from '@/lib/apiClient';
import type { Entitlement } from '@/types';

interface MeResponse {
  entitlement: Entitlement;
}

interface EntitlementState {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  entitlement: Entitlement | null;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Optimistic local decrement right after a successful /analyze call —
   *  the response also carries the authoritative entitlement, but applying
   *  it via this setter keeps the call sites simple. */
  set: (entitlement: Entitlement) => void;
}

export const useEntitlementStore = create<EntitlementState>((set, get) => ({
  loaded: false,
  loading: false,
  error: null,
  entitlement: null,

  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const res = await apiFetch<MeResponse>('/me');
      set({ entitlement: res.entitlement, loaded: true, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'unknown_error', loading: false });
    }
  },

  refresh: async () => {
    try {
      const res = await apiFetch<MeResponse>('/me');
      set({ entitlement: res.entitlement, loaded: true });
    } catch {
      /* silent — a background refresh failing shouldn't surface an error state */
    }
  },

  set: (entitlement) => set({ entitlement }),
}));

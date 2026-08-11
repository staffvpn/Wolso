import { create } from 'zustand';

interface OfflineState {
  offline: boolean;
  pendingCount: number;
  setOffline: (v: boolean) => void;
  queue: () => void;
  flush: () => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  pendingCount: 0,
  setOffline: (v) => set({ offline: v }),
  queue: () => set((s) => ({ pendingCount: s.pendingCount + 1 })),
  flush: () => set({ pendingCount: 0 }),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useOfflineStore.getState().setOffline(false);
    useOfflineStore.getState().flush();
  });
  window.addEventListener('offline', () => useOfflineStore.getState().setOffline(true));
}

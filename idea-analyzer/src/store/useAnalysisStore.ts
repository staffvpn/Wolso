import { create } from 'zustand';
import { apiFetch, ApiError } from '@/lib/apiClient';
import { useEntitlementStore } from './useEntitlementStore';
import type { AnalysisResult, Entitlement, HistoryDetail, HistoryItem, Mode } from '@/types';

interface AnalyzeResponse {
  result: AnalysisResult;
  entitlement: Entitlement;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

interface AnalysisState {
  idea: string;
  mode: Mode;
  status: Status;
  result: AnalysisResult | null;
  errorCode: string | null;
  history: HistoryItem[];
  historyLoaded: boolean;
  setIdea: (idea: string) => void;
  setMode: (mode: Mode) => void;
  analyze: () => Promise<'ok' | 'payment_required' | 'error'>;
  reset: () => void;
  loadHistory: () => Promise<void>;
  loadHistoryDetail: (id: number) => Promise<HistoryDetail | null>;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  idea: '',
  mode: 'criticize',
  status: 'idle',
  result: null,
  errorCode: null,
  history: [],
  historyLoaded: false,

  setIdea: (idea) => set({ idea }),
  setMode: (mode) => set({ mode }),

  analyze: async () => {
    const { idea, mode } = get();
    if (idea.trim().length < 8) return 'error';

    set({ status: 'loading', errorCode: null });
    try {
      const res = await apiFetch<AnalyzeResponse>('/analyze', { method: 'POST', body: { idea: idea.trim(), mode } });
      useEntitlementStore.getState().set(res.entitlement);
      set((s) => ({
        status: 'done',
        result: res.result,
        history: [
          { id: -1, ideaText: idea.trim(), mode, verdict: res.result.verdict, score: res.result.score, createdAt: new Date().toISOString() },
          ...s.history,
        ],
      }));
      return 'ok';
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        set({ status: 'idle', errorCode: 'payment_required' });
        return 'payment_required';
      }
      set({ status: 'error', errorCode: err instanceof Error ? err.message : 'unknown_error' });
      return 'error';
    }
  },

  reset: () => set({ status: 'idle', result: null, errorCode: null, idea: '' }),

  loadHistory: async () => {
    try {
      const res = await apiFetch<{ items: HistoryItem[] }>('/history');
      set({ history: res.items, historyLoaded: true });
    } catch {
      set({ historyLoaded: true });
    }
  },

  loadHistoryDetail: async (id) => {
    try {
      return await apiFetch<HistoryDetail>(`/history/${id}`);
    } catch {
      return null;
    }
  },
}));

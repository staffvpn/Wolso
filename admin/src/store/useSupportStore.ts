import { create } from 'zustand';
import type { SupportMessage, SupportThread } from '@/services/supportApi';
import { fetchSupportThreads, fetchSupportMessages, postSupportReply } from '@/services/supportApi';

interface SupportState {
  threads: SupportThread[];
  messagesByThread: Record<string, SupportMessage[]>;
  loading: boolean;
  loaded: boolean;
  loadThreads: () => Promise<void>;
  loadMessages: (threadId: string) => Promise<void>;
  reply: (threadId: string, text: string) => Promise<void>;
}

export const useSupportStore = create<SupportState>((set, get) => ({
  threads: [],
  messagesByThread: {},
  loading: false,
  loaded: false,

  loadThreads: async () => {
    set({ loading: true });
    const threads = await fetchSupportThreads();
    set({ threads, loading: false, loaded: true });
  },

  loadMessages: async (threadId) => {
    const messages = await fetchSupportMessages(threadId);
    set((s) => ({
      messagesByThread: { ...s.messagesByThread, [threadId]: messages },
      threads: s.threads.map((t) => (t.id === threadId ? { ...t, unread: 0 } : t)),
    }));
  },

  reply: async (threadId, text) => {
    const optimistic: SupportMessage = { id: `local-${Date.now()}`, from: 'staff', text, createdAt: new Date().toISOString() };
    set((s) => ({
      messagesByThread: { ...s.messagesByThread, [threadId]: [...(s.messagesByThread[threadId] ?? []), optimistic] },
    }));
    const saved = await postSupportReply(threadId, text);
    set((s) => ({
      messagesByThread: {
        ...s.messagesByThread,
        [threadId]: (s.messagesByThread[threadId] ?? []).map((m) => (m.id === optimistic.id ? saved : m)),
      },
    }));
    // Refresh the list so the preview/order reflects the new reply.
    get().loadThreads();
  },
}));

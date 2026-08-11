import { create } from 'zustand';
import type { ChatMessage } from '@/types';
import { fetchSupportThread, postSupportMessage } from '@/services/supportApi';

type Actor = 'worker' | 'company';

interface SupportState {
  messages: ChatMessage[];
  loading: boolean;
  load: (as: Actor) => Promise<void>;
  sendMessage: (text: string, as: Actor) => Promise<void>;
}

export const useSupportStore = create<SupportState>((set) => ({
  messages: [],
  loading: false,

  load: async (as) => {
    set({ loading: true });
    try {
      const messages = await fetchSupportThread(as);
      set({ messages, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  sendMessage: async (text, as) => {
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, chatId: 'support', from: 'me', text, createdAt: new Date().toISOString() };
    set((s) => ({ messages: [...s.messages, optimistic] }));
    const saved = await postSupportMessage(text, as);
    set((s) => ({ messages: s.messages.map((m) => (m.id === optimistic.id ? saved : m)) }));
  },
}));

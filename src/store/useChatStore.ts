import { create } from 'zustand';
import type { Chat, ChatMessage } from '@/types';
import { fetchChats, fetchMessages, postMessage, type ChatActor } from '@/services/chatApi';

interface ChatState {
  chats: Chat[];
  messagesByChat: Record<string, ChatMessage[]>;
  loading: boolean;
  loaded: boolean;
  error: boolean;
  load: (as: ChatActor) => Promise<void>;
  loadMessages: (chatId: string, as: ChatActor) => Promise<void>;
  sendMessage: (chatId: string, text: string, as: ChatActor) => Promise<void>;
  markRead: (chatId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  messagesByChat: {},
  loading: false,
  loaded: false,
  error: false,

  load: async (as) => {
    set({ loading: true, error: false });
    try {
      const chats = await fetchChats(as);
      set({ chats, loading: false, loaded: true });
    } catch {
      // `loaded` still flips to true on failure — screens gated on it (see
      // ChatDetail) check `loaded` before deciding "not found", so a failed
      // fetch has to resolve one way or another instead of leaving them
      // stuck showing nothing forever.
      set({ loading: false, loaded: true, error: true });
    }
  },

  loadMessages: async (chatId, as) => {
    const messages = await fetchMessages(chatId, as);
    set((s) => ({ messagesByChat: { ...s.messagesByChat, [chatId]: messages } }));
  },

  sendMessage: async (chatId, text, as) => {
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, chatId, from: 'me', text, createdAt: new Date().toISOString() };
    set((s) => ({ messagesByChat: { ...s.messagesByChat, [chatId]: [...(s.messagesByChat[chatId] ?? []), optimistic] } }));
    const saved = await postMessage(chatId, text, as);
    set((s) => ({
      messagesByChat: {
        ...s.messagesByChat,
        [chatId]: (s.messagesByChat[chatId] ?? []).map((m) => (m.id === optimistic.id ? saved : m)),
      },
    }));
  },

  markRead: (chatId) => set((s) => ({ chats: s.chats.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c)) })),
}));

import { create } from 'zustand';
import type { Chat, ChatMessage } from '@/types';
import { fetchChats, fetchMessages, postMessage, startChatWithWorker, type ChatActor } from '@/services/chatApi';

interface ChatState {
  chats: Chat[];
  messagesByChat: Record<string, ChatMessage[]>;
  loading: boolean;
  loaded: boolean;
  load: (as: ChatActor) => Promise<void>;
  loadMessages: (chatId: string, as: ChatActor) => Promise<void>;
  sendMessage: (chatId: string, text: string, as: ChatActor) => Promise<void>;
  markRead: (chatId: string) => void;
  startChatWithWorker: (workerId: string) => Promise<string>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  messagesByChat: {},
  loading: false,
  loaded: false,

  load: async (as) => {
    set({ loading: true });
    try {
      const chats = await fetchChats(as);
      set({ chats, loading: false, loaded: true });
    } catch {
      set({ loading: false });
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

  startChatWithWorker: async (workerId) => {
    const chatId = await startChatWithWorker(workerId);
    await get().load('company');
    return chatId;
  },
}));

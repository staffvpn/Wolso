import { create } from 'zustand';
import type { Chat, ChatMessage } from '@/types';
import { SEED_CHATS, SEED_MESSAGES } from '@/data/chats';
import { getShift } from '@/data/shifts';
import { getCompany } from '@/data/companies';
import { postMessage } from '@/services/chatApi';

interface ChatState {
  chats: Chat[];
  messagesByChat: Record<string, ChatMessage[]>;
  openOrCreateChatForShift: (shiftId: string) => string;
  openOrCreateChatForCandidate: (candidateId: string, candidateName: string) => string;
  sendMessage: (chatId: string, text: string) => Promise<void>;
  markRead: (chatId: string) => void;
}

const seedMessagesByChat = SEED_MESSAGES.reduce<Record<string, ChatMessage[]>>((acc, m) => {
  (acc[m.chatId] ??= []).push(m);
  return acc;
}, {});

export const useChatStore = create<ChatState>((set, get) => ({
  chats: SEED_CHATS,
  messagesByChat: seedMessagesByChat,

  openOrCreateChatForShift: (shiftId) => {
    const existing = get().chats.find((c) => c.shiftId === shiftId);
    if (existing) return existing.id;

    const shift = getShift(shiftId);
    const company = shift ? getCompany(shift.companyId) : undefined;
    const chat: Chat = {
      id: `chat-${shiftId}`,
      companyId: company?.id ?? 'cofix',
      contactName: company ? `${company.name} · Марина` : 'Менеджер',
      online: true,
      shiftId,
      unread: 1,
    };
    const intro: ChatMessage = {
      id: `m-${Date.now()}`,
      chatId: chat.id,
      from: 'them',
      kind: 'system',
      text: shift
        ? `ОТКЛИК НА СМЕНУ\n${shift.positionLabel} · сегодня ${String(shift.startHour).padStart(2, '0')}:${String(shift.startMin).padStart(2, '0')}–${String(shift.endHour).padStart(2, '0')}:${String(shift.endMin).padStart(2, '0')}\n${shift.totalPay} ₽ · ${company?.address ?? ''}`
        : 'Вас взяли на смену. Менеджер скоро напишет.',
      createdAt: new Date().toISOString(),
    };

    set((s) => ({
      chats: [chat, ...s.chats],
      messagesByChat: { ...s.messagesByChat, [chat.id]: [intro] },
    }));
    return chat.id;
  },

  openOrCreateChatForCandidate: (candidateId, candidateName) => {
    const existing = get().chats.find((c) => c.id === `chat-cand-${candidateId}`);
    if (existing) return existing.id;

    const chat: Chat = {
      id: `chat-cand-${candidateId}`,
      companyId: 'cofix',
      contactName: candidateName,
      online: true,
      unread: 0,
    };
    const intro: ChatMessage = {
      id: `m-${Date.now()}`,
      chatId: chat.id,
      from: 'me',
      kind: 'system',
      text: `Вы взяли ${candidateName} на смену. Напишите детали.`,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      chats: [chat, ...s.chats],
      messagesByChat: { ...s.messagesByChat, [chat.id]: [intro] },
    }));
    return chat.id;
  },

  sendMessage: async (chatId, text) => {
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, chatId, from: 'me', text, createdAt: new Date().toISOString() };
    set((s) => ({ messagesByChat: { ...s.messagesByChat, [chatId]: [...(s.messagesByChat[chatId] ?? []), optimistic] } }));
    const saved = await postMessage(chatId, text);
    set((s) => ({
      messagesByChat: {
        ...s.messagesByChat,
        [chatId]: s.messagesByChat[chatId].map((m) => (m.id === optimistic.id ? saved : m)),
      },
    }));
  },

  markRead: (chatId) =>
    set((s) => ({ chats: s.chats.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c)) })),
}));

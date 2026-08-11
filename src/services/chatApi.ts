import { apiFetch } from '@/lib/apiClient';
import type { Chat, ChatMessage } from '@/types';

export type ChatActor = 'worker' | 'company';

interface ApiChat {
  id: number;
  companyId: number;
  workerId: number;
  shiftId: number | null;
  contactName?: string;
  logoInitial?: string;
  logoColor?: string;
  unread: number;
  lastMessage?: { text: string } | null;
}

interface ApiMessage {
  id: number;
  chat_id: number;
  sender: 'worker' | 'company' | 'system';
  kind: 'text' | 'location' | 'system';
  text: string;
  created_at: string;
}

function chatFromApi(c: ApiChat): Chat {
  return {
    id: String(c.id),
    companyId: c.companyId ? String(c.companyId) : undefined,
    workerId: c.workerId ? String(c.workerId) : undefined,
    contactName: c.contactName ?? 'Собеседник',
    logoInitial: c.logoInitial,
    logoColor: c.logoColor,
    shiftId: c.shiftId ? String(c.shiftId) : undefined,
    unread: c.unread,
    lastMessagePreview: c.lastMessage?.text?.split('\n')[0],
  };
}

function messageFromApi(m: ApiMessage, mine: ChatActor): ChatMessage {
  return {
    id: String(m.id),
    chatId: String(m.chat_id),
    from: m.sender === mine ? 'me' : 'them',
    kind: m.kind,
    text: m.text,
    createdAt: m.created_at,
  };
}

export async function fetchChats(as: ChatActor): Promise<Chat[]> {
  const { chats } = await apiFetch<{ chats: ApiChat[] }>('/chats', { as });
  return chats.map(chatFromApi);
}

export async function fetchMessages(chatId: string, as: ChatActor): Promise<ChatMessage[]> {
  const { messages } = await apiFetch<{ messages: ApiMessage[] }>(`/chats/${chatId}/messages`, { as });
  return messages.map((m) => messageFromApi(m, as));
}

export async function postMessage(chatId: string, text: string, as: ChatActor): Promise<ChatMessage> {
  const { message } = await apiFetch<{ message: ApiMessage }>(`/chats/${chatId}/messages`, {
    method: 'POST',
    body: { text },
    as,
  });
  return messageFromApi(message, as);
}

export async function startChatWithWorker(workerId: string): Promise<string> {
  const { chatId } = await apiFetch<{ chatId: number }>(`/employer/candidates/${workerId}/chat`, { method: 'POST', as: 'company' });
  return String(chatId);
}

import { apiFetch } from '@/lib/apiClient';
import type { ChatMessage } from '@/types';

type Actor = 'worker' | 'company';

interface ApiSupportMessage {
  id: number;
  sender: 'user' | 'staff';
  staff_name: string | null;
  text: string;
  created_at: string;
}

function fromApi(m: ApiSupportMessage): ChatMessage {
  return {
    id: String(m.id),
    chatId: 'support',
    from: m.sender === 'user' ? 'me' : 'them',
    text: m.text,
    createdAt: m.created_at,
  };
}

export async function fetchSupportThread(as: Actor): Promise<ChatMessage[]> {
  const { messages } = await apiFetch<{ messages: ApiSupportMessage[] }>('/support/thread', { as });
  return messages.map(fromApi);
}

export async function postSupportMessage(text: string, as: Actor): Promise<ChatMessage> {
  const { message } = await apiFetch<{ message: ApiSupportMessage }>('/support/messages', { method: 'POST', body: { text }, as });
  return fromApi(message);
}

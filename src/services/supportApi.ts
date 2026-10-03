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

/** Вся переписка, либо только то, что появилось после сообщения `after` —
 *  см. chatApi.ts's fetchMessages про тот же курсор в основном чате. */
export async function fetchSupportThread(as: Actor, after?: string): Promise<ChatMessage[]> {
  const cursor = after && /^\d+$/.test(after) ? `?after=${after}` : '';
  const { messages } = await apiFetch<{ messages: ApiSupportMessage[] }>(`/support/thread${cursor}`, { as });
  return messages.map(fromApi);
}

export async function postSupportMessage(text: string, as: Actor): Promise<ChatMessage> {
  const { message } = await apiFetch<{ message: ApiSupportMessage }>('/support/messages', { method: 'POST', body: { text }, as });
  return fromApi(message);
}

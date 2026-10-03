import { apiFetch, apiFetchBlob, resolveMediaUrl } from '@/lib/apiClient';
import type { Chat, ChatMessage } from '@/types';

export type ChatActor = 'worker' | 'company';

interface ApiChat {
  id: number;
  companyId: number;
  workerId: number;
  shiftId: number | null;
  contactName?: string;
  avatarUrl?: string | null;
  logoInitial?: string;
  logoColor?: string;
  unread: number;
  lastMessage?: { text: string; created_at?: string } | null;
  online?: boolean;
  lastMessageAt?: string;
}

interface ApiMessage {
  id: number;
  chat_id: number;
  sender: 'worker' | 'company' | 'system';
  kind: 'text' | 'location' | 'system' | 'image';
  text: string;
  read: number;
  created_at: string;
  has_image?: number;
}

function chatFromApi(c: ApiChat): Chat {
  return {
    id: String(c.id),
    companyId: c.companyId ? String(c.companyId) : undefined,
    workerId: c.workerId ? String(c.workerId) : undefined,
    contactName: c.contactName ?? 'Собеседник',
    avatarUrl: resolveMediaUrl(c.avatarUrl),
    logoInitial: c.logoInitial,
    logoColor: c.logoColor,
    shiftId: c.shiftId ? String(c.shiftId) : undefined,
    unread: c.unread,
    lastMessagePreview: c.lastMessage?.text?.split('\n')[0],
    online: !!c.online,
    lastMessageAt: c.lastMessageAt,
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
    read: !!m.read,
    hasImage: !!m.has_image,
  };
}

export async function fetchChats(as: ChatActor): Promise<Chat[]> {
  const { chats } = await apiFetch<{ chats: ApiChat[] }>('/chats', { as });
  return chats.map(chatFromApi);
}

/** Вся переписка, либо только то, что появилось после сообщения `after`.
 *  Второе — для опроса открытого чата: возить всю историю раз в пару
 *  секунд ради нуля новых строк ни к чему. Заодно возвращает «в сети» у
 *  собеседника — тем же запросом, которым и так опрашивается чат. */
export async function fetchMessages(
  chatId: string,
  as: ChatActor,
  after?: string,
): Promise<{ messages: ChatMessage[]; counterpartyOnline: boolean }> {
  // Оптимистичные сообщения (id вида `local-…`) серверу не отдаём: он ждёт
  // число, а такого id у него всё равно нет.
  const cursor = after && /^\d+$/.test(after) ? `?after=${after}` : '';
  const { messages, counterparty } = await apiFetch<{ messages: ApiMessage[]; counterparty: { online: boolean } }>(
    `/chats/${chatId}/messages${cursor}`,
    { as },
  );
  return { messages: messages.map((m) => messageFromApi(m, as)), counterpartyOnline: counterparty.online };
}

export async function postMessage(chatId: string, text: string, as: ChatActor): Promise<ChatMessage> {
  const { message } = await apiFetch<{ message: ApiMessage }>(`/chats/${chatId}/messages`, {
    method: 'POST',
    body: { text },
    as,
  });
  return messageFromApi(message, as);
}

export async function postImageMessage(chatId: string, file: File, as: ChatActor): Promise<ChatMessage> {
  const body = await file.arrayBuffer();
  const { message } = await apiFetch<{ message: ApiMessage }>(`/chats/${chatId}/messages/image`, {
    method: 'POST',
    body,
    raw: { contentType: file.type || 'application/octet-stream' },
    as,
  });
  return messageFromApi(message, as);
}

/** blob-URL вложения — см. apiClient.ts's apiFetchBlob про то, почему не
 *  просто <img src>. */
export async function fetchMessageImage(chatId: string, messageId: string, as: ChatActor): Promise<string> {
  return apiFetchBlob(`/chats/${chatId}/messages/${messageId}/image`, as);
}

import { apiFetch } from '@/lib/apiClient';
import { minutesSince } from '@/lib/format';

export interface SupportThread {
  id: string;
  kind: 'worker' | 'employer';
  contactName: string;
  lastMessagePreview?: string;
  lastMessageMinAgo?: number;
  unread: number;
}

export interface SupportMessage {
  id: string;
  from: 'user' | 'staff';
  staffName?: string;
  text: string;
  createdAt: string;
}

interface ThreadApiRow {
  id: number;
  kind: 'worker' | 'employer';
  contactName: string;
  lastMessage?: { text: string; created_at: string } | null;
  unread: number;
}

function fromApiThread(t: ThreadApiRow): SupportThread {
  return {
    id: String(t.id),
    kind: t.kind,
    contactName: t.contactName,
    lastMessagePreview: t.lastMessage?.text,
    lastMessageMinAgo: t.lastMessage ? minutesSince(t.lastMessage.created_at) : undefined,
    unread: t.unread,
  };
}

interface MessageApiRow {
  id: number;
  sender: 'user' | 'staff';
  staff_name: string | null;
  text: string;
  created_at: string;
}

function fromApiMessage(m: MessageApiRow): SupportMessage {
  return { id: String(m.id), from: m.sender, staffName: m.staff_name ?? undefined, text: m.text, createdAt: m.created_at };
}

export async function fetchSupportThreads(): Promise<SupportThread[]> {
  const { threads } = await apiFetch<{ threads: ThreadApiRow[] }>('/admin/support/threads');
  return threads.map(fromApiThread);
}

export async function fetchSupportMessages(threadId: string): Promise<SupportMessage[]> {
  const { messages } = await apiFetch<{ messages: MessageApiRow[] }>(`/admin/support/threads/${threadId}/messages`);
  return messages.map(fromApiMessage);
}

export async function postSupportReply(threadId: string, text: string): Promise<SupportMessage> {
  const { message } = await apiFetch<{ message: MessageApiRow }>(`/admin/support/threads/${threadId}/messages`, {
    method: 'POST',
    body: { text },
  });
  return fromApiMessage(message);
}

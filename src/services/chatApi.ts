import type { Chat, ChatMessage } from '@/types';
import { SEED_CHATS, SEED_MESSAGES } from '@/data/chats';
import { delay } from './delay';

export async function fetchChats(): Promise<Chat[]> {
  await delay();
  return SEED_CHATS;
}

export async function fetchMessages(chatId: string): Promise<ChatMessage[]> {
  await delay(180);
  return SEED_MESSAGES.filter((m) => m.chatId === chatId);
}

export async function postMessage(chatId: string, text: string): Promise<ChatMessage> {
  await delay(200);
  return { id: `m-${Date.now()}`, chatId, from: 'me', text, createdAt: new Date().toISOString() };
}

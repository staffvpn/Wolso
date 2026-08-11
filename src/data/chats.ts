import type { Chat, ChatMessage } from '@/types';

export const SEED_CHATS: Chat[] = [
  { id: 'chat-cofix', companyId: 'cofix', contactName: 'Cofix · Марина', online: true, shiftId: 'shift-0', unread: 0 },
];

export const SEED_MESSAGES: ChatMessage[] = [
  { id: 'm-1', chatId: 'chat-cofix', from: 'them', kind: 'system', text: 'ОТКЛИК НА СМЕНУ\nБариста · сегодня 09:00–19:00\n4 500 ₽ · Тверская 12', createdAt: new Date().toISOString() },
  { id: 'm-2', chatId: 'chat-cofix', from: 'them', text: 'Здравствуйте! Опыт с рожковой кофемашиной есть?', createdAt: new Date().toISOString() },
  { id: 'm-3', chatId: 'chat-cofix', from: 'me', text: 'Да, полтора года на La Marzocco', createdAt: new Date().toISOString() },
  { id: 'm-4', chatId: 'chat-cofix', from: 'them', text: 'Отлично, берём. Подходите к 08:45, спросите Марину', createdAt: new Date().toISOString() },
  { id: 'm-5', chatId: 'chat-cofix', from: 'them', kind: 'location', text: 'Тверская ул., 12\n7 минут пешком от м. Тверская', createdAt: new Date().toISOString() },
];

export const QUICK_REPLIES = ['Буду вовремя', 'Опаздываю на 10 мин'];

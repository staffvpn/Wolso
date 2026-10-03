import { create } from 'zustand';
import type { Chat, ChatMessage } from '@/types';
import { fetchChats, fetchMessageImage, fetchMessages, postImageMessage, postMessage, type ChatActor } from '@/services/chatApi';

interface ChatState {
  chats: Chat[];
  messagesByChat: Record<string, ChatMessage[]>;
  /** blob-URL уже скачанных вложений, по id сообщения — см. loadImage. */
  imageBlobs: Record<string, string>;
  loading: boolean;
  loaded: boolean;
  error: boolean;
  load: (as: ChatActor) => Promise<void>;
  refresh: (as: ChatActor) => Promise<void>;
  loadMessages: (chatId: string, as: ChatActor) => Promise<void>;
  syncMessages: (chatId: string, as: ChatActor) => Promise<void>;
  sendMessage: (chatId: string, text: string, as: ChatActor) => Promise<void>;
  sendImage: (chatId: string, file: File, as: ChatActor) => Promise<void>;
  loadImage: (chatId: string, messageId: string, as: ChatActor) => Promise<void>;
  markRead: (chatId: string) => void;
}

/** Последнее сообщение, у которого есть настоящий id с сервера — с него
 *  продолжается опрос. Оптимистичные (`local-…`) пропускаем: сервер о них
 *  не знает, и попросить «всё после local-173…» нельзя. */
function lastServerId(messages: ChatMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (!messages[i].id.startsWith('local-')) return messages[i].id;
  }
  return undefined;
}

/** Дописывает то, чего ещё нет. По id, а не по длине: рядом с ответом
 *  собеседника может лежать своё сообщение, ещё не подтверждённое
 *  сервером, и склеивать их по счётчику — верный способ показать одно и
 *  то же дважды. */
function merge(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return existing;
  const known = new Set(existing.map((m) => m.id));
  const added = incoming.filter((m) => !known.has(m.id));
  return added.length === 0 ? existing : [...existing, ...added];
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  messagesByChat: {},
  imageBlobs: {},
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

  /** Тихое обновление списка: без спиннера и без сброса экрана в ошибку.
   *  Список чатов уже на экране, и мигать им раз в несколько секунд из-за
   *  фонового запроса незачем. */
  refresh: async (as) => {
    try {
      set({ chats: await fetchChats(as), loaded: true, error: false });
    } catch {
      // Оставляем то, что показано: одна неудачная попытка не новость.
    }
  },

  loadMessages: async (chatId, as) => {
    const { messages, counterpartyOnline } = await fetchMessages(chatId, as);
    set((s) => ({
      messagesByChat: { ...s.messagesByChat, [chatId]: messages },
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, online: counterpartyOnline } : c)),
    }));
  },

  /** Догрузить только новое — этим живёт открытый чат. В отличие от
   *  loadMessages не переписывает список целиком: иначе ответ, пришедший
   *  ровно между отправкой и подтверждением своего сообщения, стирал бы
   *  собственный «отправляется» пузырь с экрана. «В сети» обновляется
   *  каждый раз, даже без новых сообщений — это единственный опрос,
   *  который видит статус собеседника, пока чат открыт. */
  syncMessages: async (chatId, as) => {
    const current = get().messagesByChat[chatId] ?? [];
    const { messages: incoming, counterpartyOnline } = await fetchMessages(chatId, as, lastServerId(current));
    set((s) => ({
      messagesByChat:
        incoming.length === 0 ? s.messagesByChat : { ...s.messagesByChat, [chatId]: merge(s.messagesByChat[chatId] ?? [], incoming) },
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, online: counterpartyOnline } : c)),
    }));
  },

  sendMessage: async (chatId, text, as) => {
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, chatId, from: 'me', text, createdAt: new Date().toISOString() };
    set((s) => ({ messagesByChat: { ...s.messagesByChat, [chatId]: [...(s.messagesByChat[chatId] ?? []), optimistic] } }));
    try {
      const saved = await postMessage(chatId, text, as);
      set((s) => ({
        messagesByChat: {
          ...s.messagesByChat,
          [chatId]: (s.messagesByChat[chatId] ?? []).map((m) => (m.id === optimistic.id ? saved : m)),
        },
      }));
    } catch (err) {
      // Неотправленное сообщение убираем с экрана. Оставить его висеть —
      // значит показать человеку отправленным то, чего собеседник никогда
      // не получит; экран поднимет текст обратно в поле ввода.
      set((s) => ({
        messagesByChat: {
          ...s.messagesByChat,
          [chatId]: (s.messagesByChat[chatId] ?? []).filter((m) => m.id !== optimistic.id),
        },
      }));
      throw err;
    }
  },

  /** Тот же оптимистичный пузырь, что и у текста, только превью — сам
   *  файл, ещё до подтверждения сервером (blob-URL, не требует сети). */
  sendImage: async (chatId, file, as) => {
    const localId = `local-${Date.now()}`;
    const previewUrl = URL.createObjectURL(file);
    const optimistic: ChatMessage = { id: localId, chatId, from: 'me', text: '', createdAt: new Date().toISOString(), kind: 'image', hasImage: true };
    set((s) => ({
      messagesByChat: { ...s.messagesByChat, [chatId]: [...(s.messagesByChat[chatId] ?? []), optimistic] },
      imageBlobs: { ...s.imageBlobs, [localId]: previewUrl },
    }));
    try {
      const saved = await postImageMessage(chatId, file, as);
      set((s) => {
        const { [localId]: _localPreview, ...restBlobs } = s.imageBlobs;
        return {
          messagesByChat: {
            ...s.messagesByChat,
            [chatId]: (s.messagesByChat[chatId] ?? []).map((m) => (m.id === localId ? saved : m)),
          },
          // Превью показывает тот же файл, что уже подтверждён сервером —
          // просто переносим blob-URL на настоящий id, без повторной
          // авторизованной загрузки того, что и так уже на экране.
          imageBlobs: { ...restBlobs, [saved.id]: previewUrl },
        };
      });
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      set((s) => {
        const { [localId]: _removed, ...restBlobs } = s.imageBlobs;
        return {
          messagesByChat: { ...s.messagesByChat, [chatId]: (s.messagesByChat[chatId] ?? []).filter((m) => m.id !== localId) },
          imageBlobs: restBlobs,
        };
      });
      throw err;
    }
  },

  /** Подгружает вложение одним авторизованным запросом и кэширует —
   *  повторный рендер того же сообщения (опрос обновляет весь список)
   *  не должен качать одну и ту же картинку заново. */
  loadImage: async (chatId, messageId, as) => {
    if (get().imageBlobs[messageId]) return;
    const url = await fetchMessageImage(chatId, messageId, as);
    set((s) => ({ imageBlobs: { ...s.imageBlobs, [messageId]: url } }));
  },

  markRead: (chatId) => set((s) => ({ chats: s.chats.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c)) })),
}));

import { create } from 'zustand';
import type { ChatMessage } from '@/types';
import { fetchSupportThread, postSupportMessage } from '@/services/supportApi';

type Actor = 'worker' | 'company';

/** См. useChatStore.ts — тот же приём: продолжаем опрос с последнего
 *  настоящего (не оптимистичного) id, а не перекачиваем всю историю. */
function lastServerId(messages: ChatMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (!messages[i].id.startsWith('local-')) return messages[i].id;
  }
  return undefined;
}

function merge(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return existing;
  const known = new Set(existing.map((m) => m.id));
  const added = incoming.filter((m) => !known.has(m.id));
  return added.length === 0 ? existing : [...existing, ...added];
}

interface SupportState {
  messages: ChatMessage[];
  loading: boolean;
  /** `silent` skips the loading flag — used by the background poll so it
   *  doesn't flicker the empty-state message every few seconds. Начиная с
   *  первого же тихого опроса запрашивает только новое (курсор по
   *  последнему известному id) и дописывает в список, а не перезаписывает
   *  его целиком. */
  load: (as: Actor, silent?: boolean) => Promise<void>;
  sendMessage: (text: string, as: Actor) => Promise<void>;
}

export const useSupportStore = create<SupportState>((set, get) => ({
  messages: [],
  loading: false,

  load: async (as, silent = false) => {
    if (!silent) set({ loading: true });
    try {
      const after = silent ? lastServerId(get().messages) : undefined;
      const incoming = await fetchSupportThread(as, after);
      set((s) => ({ messages: after === undefined ? incoming : merge(s.messages, incoming), loading: false }));
    } catch {
      set({ loading: false });
    }
  },

  sendMessage: async (text, as) => {
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, chatId: 'support', from: 'me', text, createdAt: new Date().toISOString() };
    set((s) => ({ messages: [...s.messages, optimistic] }));
    const saved = await postSupportMessage(text, as);
    set((s) => ({ messages: s.messages.map((m) => (m.id === optimistic.id ? saved : m)) }));
  },
}));

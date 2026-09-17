import { create } from 'zustand';
import type { Promo, PromoInput } from '@/types';
import { createPromo, deletePromo, fetchPromos, updatePromo, uploadPromoImage } from '@/services/promosApi';

interface PromosState {
  promos: Promo[];
  loading: boolean;
  loaded: boolean;
  /** Код ошибки с сервера — отдельно от общего падения, чтобы экран мог
   *  назвать недостающую миграцию, а не показать «что-то пошло не так». */
  error: string | null;

  load: () => Promise<void>;
  create: (input: PromoInput, image: File | null) => Promise<void>;
  update: (id: string, input: Partial<PromoInput>) => Promise<void>;
  setStatus: (id: string, status: 'active' | 'paused') => Promise<void>;
  setImage: (id: string, file: File) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const usePromosStore = create<PromosState>((set, get) => ({
  promos: [],
  loading: false,
  loaded: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      set({ promos: await fetchPromos(), loading: false, loaded: true });
    } catch (err) {
      set({ loading: false, loaded: true, error: (err as { code?: string }).code ?? 'unknown' });
    }
  },

  create: async (input, image) => {
    const id = await createPromo(input);
    // Картинка отдельным запросом: карточка создаётся строкой в базе, а
    // изображение уходит сырым телом — в один запрос это не сложить.
    if (image) await uploadPromoImage(id, image);
    await get().load();
  },

  update: async (id, input) => {
    await updatePromo(id, input);
    await get().load();
  },

  setStatus: async (id, status) => {
    await updatePromo(id, { status });
    set({ promos: get().promos.map((p) => (p.id === id ? { ...p, status } : p)) });
  },

  setImage: async (id, file) => {
    await uploadPromoImage(id, file);
    await get().load();
  },

  remove: async (id) => {
    await deletePromo(id);
    set({ promos: get().promos.filter((p) => p.id !== id) });
  },
}));

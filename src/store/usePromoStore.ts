import { create } from 'zustand';
import { apiFetch, resolveMediaUrl } from '@/lib/apiClient';

export interface Promo {
  id: string;
  title: string;
  text: string;
  ctaLabel: string;
  url: string;
  kind: 'telegram' | 'site';
  advertiser: string;
  erid: string;
  /** Через сколько просмотренных смен показывать. Приходит с сервера, а не
   *  зашито в клиенте, чтобы частоту можно было поменять из админки без
   *  выкатки мини-аппа. */
  everyN: number;
  imageUrl?: string;
}

interface PromoState {
  /** Что покажем в следующий раз. Загружается заранее, а не в момент
   *  показа: карточка должна появиться сразу, без пустого места и
   *  подгрузки картинки на глазах. */
  next: Promo | null;
  /** Сколько смен просмотрено с последнего показа рекламы. */
  sinceLastPromo: number;
  /** Промо, которое показано прямо сейчас. */
  current: Promo | null;
  /** Закрытые в этой сессии — второй раз то же самое не показываем, даже
   *  если сервер его снова выдаст. */
  dismissed: string[];

  load: () => Promise<void>;
  countShift: () => void;
  dismiss: () => void;
  click: () => void;
}

export const usePromoStore = create<PromoState>((set, get) => ({
  next: null,
  sinceLastPromo: 0,
  current: null,
  dismissed: [],

  load: async () => {
    try {
      const { promo } = await apiFetch<{ promo: Promo | null }>('/promos/next');
      if (!promo) {
        set({ next: null });
        return;
      }
      set({ next: { ...promo, imageUrl: resolveMediaUrl(promo.imageUrl) } });
    } catch {
      // Реклама — не то, ради чего стоит показывать человеку ошибку.
      // Нет ответа, значит её просто не будет.
      set({ next: null });
    }
  },

  countShift: () => {
    const { next, sinceLastPromo, current, dismissed } = get();
    if (current) return;

    const count = sinceLastPromo + 1;
    if (!next || dismissed.includes(next.id) || count < next.everyN) {
      set({ sinceLastPromo: count });
      return;
    }

    set({ current: next, sinceLastPromo: 0 });
    // Показ засчитываем здесь, а не при выдаче: сервер выдал карточку
    // заранее, и до этого момента человек мог её не увидеть вовсе.
    void apiFetch(`/promos/${next.id}/view`, { method: 'POST' }).catch(() => {});
  },

  dismiss: () => {
    const { current, dismissed } = get();
    if (!current) return;
    set({ current: null, dismissed: [...dismissed, current.id] });
    // Сразу тянем следующую: к моменту, когда счётчик снова дойдёт до
    // порога, она уже должна лежать готовой.
    void get().load();
  },

  click: () => {
    const { current } = get();
    if (!current) return;
    void apiFetch(`/promos/${current.id}/click`, { method: 'POST' }).catch(() => {});
  },
}));

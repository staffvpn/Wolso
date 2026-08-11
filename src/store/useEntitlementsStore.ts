import { create } from 'zustand';

/**
 * Everything paid is stubbed out for launch: `isPro` is hard-locked to
 * false and every premium action routes through `openPaywall`, which
 * just shows a "coming soon" sheet. Wiring a real purchase (Telegram
 * Stars / subscription) later only means flipping `isPro` from a real
 * source and this store's shape stays the same.
 */
export type PremiumFeature = 'boost' | 'undo' | 'unlimited_swipes' | 'top_vacancy' | 'priority_support';

export const PREMIUM_FEATURE_COPY: Record<PremiumFeature, { title: string; description: string }> = {
  boost: {
    title: 'Поднять отклик',
    description: 'Ваш отклик покажут работодателю первым в списке. Скоро можно будет включить за звёзды Telegram.',
  },
  undo: {
    title: 'Вернуть свайп',
    description: 'Отмена случайного пропуска смены. Появится в одном из следующих обновлений.',
  },
  unlimited_swipes: {
    title: 'Безлимит откликов',
    description: 'Снимите дневной лимит на количество откликов в ленте.',
  },
  top_vacancy: {
    title: 'Поднять вакансию',
    description: 'Показывать вашу смену выше остальных в ленте кандидатов ещё дольше.',
  },
  priority_support: {
    title: 'Приоритетная поддержка',
    description: 'Быстрые ответы службы поддержки Wolso.',
  },
};

interface EntitlementsState {
  isPro: boolean;
  paywallFeature: PremiumFeature | null;
  openPaywall: (feature: PremiumFeature) => void;
  closePaywall: () => void;
}

export const useEntitlementsStore = create<EntitlementsState>((set) => ({
  isPro: false,
  paywallFeature: null,
  openPaywall: (feature) => set({ paywallFeature: feature }),
  closePaywall: () => set({ paywallFeature: null }),
}));

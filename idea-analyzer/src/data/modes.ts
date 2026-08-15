import type { Mode } from '@/types';

export interface ModeMeta {
  id: Mode;
  label: string;
  emoji: string;
  verb: string;
  loadingVerb: string;
  description: string;
  colorVar: string;
  softVar: string;
}

export const MODE_ORDER: Mode[] = ['praise', 'criticize', 'destroy', 'monetize'];

export const MODES: Record<Mode, ModeMeta> = {
  praise: {
    id: 'praise',
    label: 'Хвалить',
    emoji: '😊',
    verb: 'Похвалить идею',
    loadingVerb: 'Ищу сильные стороны',
    description: 'Вдохновляющий разбор: что в идее реально хорошо',
    colorVar: 'var(--color-praise)',
    softVar: 'var(--color-praise-soft)',
  },
  criticize: {
    id: 'criticize',
    label: 'Критиковать',
    emoji: '🤔',
    verb: 'Раскритиковать идею',
    loadingVerb: 'Ищу слабые места',
    description: 'Честный трезвый разбор рисков и дыр в идее',
    colorVar: 'var(--color-criticize)',
    softVar: 'var(--color-criticize-soft)',
  },
  destroy: {
    id: 'destroy',
    label: 'Уничтожить',
    emoji: '🔥',
    verb: 'Уничтожить идею',
    loadingVerb: 'Готовлю разнос',
    description: 'Максимально жёстко, без пощады — как злой инвестор',
    colorVar: 'var(--color-destroy)',
    softVar: 'var(--color-destroy-soft)',
  },
  monetize: {
    id: 'monetize',
    label: 'Заработать',
    emoji: '💰',
    verb: 'Найти способ заработать',
    loadingVerb: 'Считаю деньги',
    description: 'Фокус на деньгах: модели монетизации и апсейлы',
    colorVar: 'var(--color-monetize)',
    softVar: 'var(--color-monetize-soft)',
  },
};

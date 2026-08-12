import type { Position, PositionInfo } from '@/types';

export const POSITIONS: PositionInfo[] = [
  { id: 'barista', label: 'Бариста' },
  { id: 'waiter', label: 'Официант' },
  { id: 'cook', label: 'Повар' },
  { id: 'bartender', label: 'Бармен' },
  { id: 'host', label: 'Хостес' },
  { id: 'runner', label: 'Раннер' },
  { id: 'cashier', label: 'Кассир' },
  { id: 'dishwasher', label: 'Посудомойщик' },
  { id: 'cleaner', label: 'Клинер' },
  { id: 'promoter', label: 'Промоутер' },
  { id: 'courier', label: 'Курьер' },
  { id: 'loader', label: 'Грузчик' },
  { id: 'security', label: 'Охранник' },
  { id: 'sommelier', label: 'Сомелье' },
  { id: 'confectioner', label: 'Кондитер' },
  { id: 'admin', label: 'Администратор' },
];

export const POSITION_LABEL: Record<Position, string> = Object.fromEntries(
  POSITIONS.map((p) => [p.id, p.label]),
) as Record<Position, string>;

export const TOP_POSITIONS = POSITIONS.slice(0, 7);
export const MORE_POSITIONS_COUNT = POSITIONS.length - TOP_POSITIONS.length;

/** Illustrative market rates (₽/час) shown to employers while pricing a
 *  shift — same kind of reference number as REGIONAL_MIN_WAGE, not pulled
 *  from real aggregated data yet. */
export const MARKET_AVG_RATE: Record<Position, number> = {
  barista: 430,
  waiter: 400,
  cook: 480,
  bartender: 450,
  host: 380,
  runner: 350,
  cashier: 370,
  dishwasher: 330,
  cleaner: 320,
  promoter: 400,
  courier: 420,
  loader: 380,
  security: 400,
  sommelier: 600,
  confectioner: 470,
  admin: 420,
};

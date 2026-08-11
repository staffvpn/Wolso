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

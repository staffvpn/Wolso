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

/** Market rates (₽/час), Moscow, based on real listings/aggregated pay data
 *  as of Aug 2026 — gorodrabot.ru monthly-salary pages (divided by ~160
 *  working hours/month where no hourly figure was quoted directly) plus
 *  gig-platform hourly/per-shift rates (YouDo, Ventra Go, Пешкарики) for
 *  roles that are usually paid per shift rather than salaried. Same kind
 *  of reference number as REGIONAL_MIN_WAGE — a snapshot, not a live feed,
 *  worth refreshing periodically rather than treating as exact.
 *
 *  Sources: gorodrabot.ru salary pages per position (moskva.gorodrabot.ru),
 *  rambler.ru/pro/zarplata (waiter pay + tips), youdo.com (loader/promoter
 *  hourly gigs), peshkariki.ru (courier per-shift), fulledu.ru (sommelier). */
export const MARKET_AVG_RATE: Record<Position, number> = {
  barista: 360, // gorodrabot: shift/hourly listings run 320–380 ₽/час
  waiter: 400, // gig-shift rate ~350 ₽/час на руки; official avg salary/tips run higher
  cook: 500, // gorodrabot monthly avg 88–110k ÷ ~160ч
  bartender: 470, // gorodrabot monthly avg ~94k ÷ ~160ч
  host: 380, // gorodrabot monthly avg (hostess) ÷ ~160ч
  runner: 350, // no dedicated listings — between host and dishwasher tier
  cashier: 350, // gorodrabot admin-cashier monthly avg ÷ ~160ч
  dishwasher: 300, // typically the lowest-paid kitchen shift role
  cleaner: 320, // gorodrabot cleaner/уборщик range
  promoter: 280, // youdo/domkadrov hourly gigs quote 150–350 ₽/час
  courier: 400, // peshkariki: ~2800–4500 ₽ per 8–10ч shift
  loader: 180, // youdo/profi.ru hourly gigs quote ~175 ₽/час (100–200 range)
  security: 250, // typical shift-post rate for venue/event security
  sommelier: 600, // fulledu.ru + gorodrabot monthly avg 83–120k ÷ ~160ч
  confectioner: 550, // gorodrabot monthly avg ~98k (modal 120k) ÷ ~160ч
  admin: 500, // gorodrabot restaurant/cafe admin monthly avg ÷ ~160ч
};

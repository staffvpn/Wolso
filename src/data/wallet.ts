import type { Transaction } from '@/types';

export const TRANSACTIONS: Transaction[] = [
  { id: 'tx-1', kind: 'payout_in', title: 'Смена в Cofix', subtitle: 'Сегодня 19:02', amount: 4800, createdAt: new Date().toISOString() },
  { id: 'tx-2', kind: 'withdrawal_out', title: 'Вывод на карту ···4120', subtitle: '9 августа', amount: -7600, createdAt: '2026-08-09' },
  { id: 'tx-3', kind: 'payout_in', title: 'Смена в «Веранде»', subtitle: '8 августа', amount: 3800, createdAt: '2026-08-08' },
  { id: 'tx-4', kind: 'payout_in', title: 'Смена в Прозакат', subtitle: '6 августа', amount: 5200, createdAt: '2026-08-06' },
  { id: 'tx-5', kind: 'withdrawal_out', title: 'Вывод на карту ···4120', subtitle: '3 августа', amount: -4500, createdAt: '2026-08-03' },
];

export const WALLET_AVAILABLE = 4800;
export const WALLET_MONTH_TOTAL = 18500;
export const WALLET_DEFAULT_CARD = '···4120';

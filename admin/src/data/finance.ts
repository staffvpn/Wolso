import type { Transaction } from '@/types';
import { mulberry32, pick } from './rng';

const rand = mulberry32(99001);

export const PAYOUT_TODAY = 1284500;
export const PLATFORM_COMMISSION_PCT = 7;
export const DISPUTED_PAYOUTS_COUNT = 4;

const NAMES = ['Иван Ковалёв', 'Мария Соколова', 'Артём Носов', 'Ольга Титова', 'Никита Раков', 'Дарья Волкова', 'Егор Смирнов'];
const SHIFTS = [
  { label: 'Бариста · Cofix', amount: 4500 },
  { label: 'Бариста · Прозакат', amount: 5000 },
  { label: 'Повар · Чебуречная', amount: 6000 },
  { label: 'Официант · Веранда', amount: 3800 },
  { label: 'Бармен · Северный Бар', amount: 5200 },
  { label: 'Клининг · Прозакат', amount: 2600 },
];

function buildTx(i: number, name: string, shift: { label: string; amount: number }, status: Transaction['status']): Transaction {
  return {
    id: `tx-${i}`,
    workerName: name,
    shiftLabel: shift.label,
    companyName: shift.label.split(' · ')[1],
    amount: shift.amount,
    status,
    dateLabel: pick(rand, ['сегодня', 'вчера', '9 авг', '8 авг']),
  };
}

export const TRANSACTIONS: Transaction[] = [
  buildTx(0, 'Иван Ковалёв', SHIFTS[0], 'paid'),
  buildTx(1, 'Мария Соколова', SHIFTS[1], 'processing'),
  buildTx(2, 'Артём Носов', SHIFTS[2], 'dispute'),
  buildTx(3, 'Ольга Титова', SHIFTS[3], 'paid'),
  ...Array.from({ length: 16 }, (_, i) =>
    buildTx(i + 4, pick(rand, NAMES), pick(rand, SHIFTS), pick(rand, ['paid', 'paid', 'processing', 'dispute'] as const)),
  ),
];

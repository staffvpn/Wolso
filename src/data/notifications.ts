import type { AppNotification } from '@/types';

export const NOTIFICATIONS: AppNotification[] = [
  { id: 'n-1', kind: 'accepted', title: 'Cofix взял вас на смену', subtitle: 'Сегодня 09:00–19:00, Тверская 12', minutesAgo: 2, read: false },
  { id: 'n-2', kind: 'new_shifts', title: '6 новых смен рядом', subtitle: 'Бариста, от 450 ₽/ч, в радиусе 3 км', minutesAgo: 60, read: false },
  { id: 'n-3', kind: 'message', title: 'Марина из Cofix написала', subtitle: '«Подходите к 08:45»', minutesAgo: 180, read: true },
  { id: 'n-4', kind: 'payout', title: 'Выплата 4 500 ₽ отправлена', subtitle: 'За смену 8 августа в «Веранде»', minutesAgo: 4320, read: true },
];

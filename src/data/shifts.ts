import type { Position, Shift } from '@/types';
import { COMPANIES } from './companies';
import { POSITION_LABEL } from './positions';
import { intBetween, mulberry32, pick, pickMany } from './rng';

const DESCRIPTIONS: Partial<Record<Position, string[]>> = {
  barista: [
    'Приготовление напитков, работа на кассе, общение с гостями. Альтернатива — плюсом. Выплата в день смены.',
    'Нужен уверенный бариста на поток. La Marzocco, работа в паре со сменщиком.',
  ],
  waiter: [
    'Обслуживание столов в зале на 40 посадок, расчёт гостей, выкладка заказов.',
    'Летняя веранда, быстрый темп, чаевые остаются у вас полностью.',
  ],
  cook: [
    'Работа на линии раздачи, заготовки, соблюдение техкарт. Форма выдаётся.',
    'Нужен повар на горячий цех, смена в паре с шеф-поваром.',
  ],
  bartender: [
    'Классические коктейли и авторская карта бара. Инструмент свой или предоставим.',
    'Барная стойка на 12 мест, вечерний поток, чаевые + ставка.',
  ],
  host: [
    'Встреча и рассадка гостей, ведение листа ожидания, работа с бронями.',
  ],
  runner: [
    'Вынос блюд из кухни в зал, помощь официантам в пиковые часы.',
  ],
  cashier: [
    'Расчёт гостей на кассе, работа с эквайрингом и кассовой дисциплиной.',
  ],
  dishwasher: [
    'Мойка посуды и инвентаря, поддержание чистоты на кухне.',
  ],
  cleaner: [
    'Уборка зала и подсобных помещений в течение смены.',
  ],
  promoter: [
    'Раздача листовок и промо-акция у входа, форма предоставляется.',
  ],
  courier: [
    'Доставка заказов по району на своём транспорте, компенсация топлива.',
  ],
  loader: [
    'Разгрузка поставки, перемещение товара на склад.',
  ],
  security: [
    'Контроль входа, проверка бейджей, обход помещения раз в час.',
  ],
  sommelier: [
    'Консультации гостей по винной карте, подача и подбор напитков.',
  ],
  confectioner: [
    'Выпечка и оформление десертов по техкартам заведения.',
  ],
  admin: [
    'Открытие/закрытие смены, контроль персонала, работа с кассой.',
  ],
};

const TAG_POOL = ['Опыт от 1 года', 'Медкнижка', 'Без опыта', 'Своя форма', 'Ученики'];

const rand = mulberry32(20260810);

function buildShift(index: number): Shift {
  const company = pick(rand, COMPANIES);
  const position = pick(
    rand,
    Object.keys(DESCRIPTIONS) as Position[],
  );
  const startHour = intBetween(rand, 7, 20);
  const startMin = pick(rand, [0, 15, 30, 45]);
  const durationHours = intBetween(rand, 4, 11);
  const endHour = Math.min(23, startHour + durationHours);
  const hourlyRate = intBetween(rand, 22, 65) * 10;
  const totalPay = Math.round((hourlyRate * durationHours) / 50) * 50;
  const dayOffset = pick(rand, [0, 0, 0, 1, 1, 2, 3]);
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);

  const timeOfDay: Shift['timeOfDay'] =
    startHour < 11 ? 'morning' : startHour < 17 ? 'day' : startHour < 22 ? 'evening' : 'night';

  const descriptions = DESCRIPTIONS[position] ?? ['Подробности по смене — в чате с менеджером.'];

  return {
    id: `shift-${index}`,
    companyId: company.id,
    position,
    positionLabel: POSITION_LABEL[position],
    date: date.toISOString().slice(0, 10),
    startHour,
    startMin,
    endHour,
    endMin: startMin,
    hourlyRate,
    totalPay,
    distanceKm: Math.round(rand() * 68) / 10,
    description: pick(rand, descriptions),
    tags: pickMany(rand, TAG_POOL, intBetween(rand, 1, 2)),
    meal: rand() > 0.5,
    urgency: dayOffset === 0 && rand() > 0.6 ? 'urgent' : 'normal',
    responseTimeMin: intBetween(rand, 3, 25),
    employmentType: pick(rand, ['shift', 'shift', 'shift', 'permanent', 'internship']),
    timeOfDay,
  };
}

export const SHIFTS: Shift[] = Array.from({ length: 42 }, (_, i) => buildShift(i));

export function getShift(id: string): Shift | undefined {
  return SHIFTS.find((s) => s.id === id);
}

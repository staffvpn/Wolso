import type { ComplaintItem, DocumentReview, ModerationFlag, ModerationVacancy } from '@/types';
import { intBetween, mulberry32, pick } from './rng';

const rand = mulberry32(551223);

const POSITIONS = ['Бариста', 'Повар', 'Официант', 'Клининг', 'Бармен', 'Кассир', 'Хостес', 'Курьер'];
const COMPANIES = [
  { name: 'Cofix', inn: '7701234567', rating: 4.8 },
  { name: 'Чебуречная №1', inn: '7704551122', rating: 4.6 },
  { name: 'Веранда', inn: '7723459988', rating: 4.4 },
  { name: 'Прозакат', inn: '7712300043', rating: 4.7 },
  { name: 'Skuratov Coffee', inn: '7734561209', rating: 4.9 },
];
const CITIES = ['Москва', 'Химки', 'Санкт-Петербург', 'Казань'];
const DESCRIPTIONS = [
  'Приготовление напитков, работа на кассе, общение с гостями. Альтернативные методы заваривания — плюсом. Выплата в день смены.',
  'Работа на линии раздачи, заготовки, соблюдение техкарт. Форма выдаётся.',
  'Обслуживание столов в зале, расчёт гостей, выкладка заказов. Чаевые остаются полностью.',
  'Уборка зала и подсобных помещений в течение смены.',
];

const FLAGS: (ModerationFlag | null)[] = [
  { label: 'Ставка ниже МРОТ', tone: 'danger' },
  { label: 'Новый работодатель', tone: 'info' },
  { label: 'Контакты в тексте', tone: 'warning' },
  null,
];

function buildVacancy(i: number, position: string, flag: ModerationFlag | null, submittedMinAgo: number, city: string): ModerationVacancy {
  const company = pick(rand, COMPANIES);
  const regionalMinWage = 280;
  const belowMinWage = flag?.label === 'Ставка ниже МРОТ';
  const hourlyRate = belowMinWage ? intBetween(rand, 150, 250) : intBetween(rand, 300, 650);
  return {
    id: `mod-vac-${i}`,
    position,
    companyName: company.name,
    companyInn: company.inn,
    companyRating: company.rating,
    city,
    submittedMinAgo,
    flag,
    status: 'pending',
    hourlyRate,
    regionalMinWage,
    durationHours: intBetween(rand, 4, 12),
    address: `${pick(rand, ['Тверская', 'Арбат', 'Пятницкая', 'Кутузовский', 'Мясницкая'])} ${intBetween(rand, 1, 60)}`,
    experienceReq: pick(rand, ['от 1 года', 'без опыта', 'от 2 лет']),
    description: pick(rand, DESCRIPTIONS),
    shiftsPosted: intBetween(rand, 1, 40),
  };
}

export const MODERATION_QUEUE: ModerationVacancy[] = [
  buildVacancy(0, 'Бариста', FLAGS[0], 2, 'Москва'),
  buildVacancy(1, 'Повар', FLAGS[1], 9, 'Москва'),
  buildVacancy(2, 'Официант', FLAGS[2], 21, 'Химки'),
  buildVacancy(3, 'Клининг', FLAGS[3], 34, 'Москва'),
  ...Array.from({ length: 10 }, (_, i) =>
    buildVacancy(i + 4, pick(rand, POSITIONS), pick(rand, FLAGS), intBetween(rand, 40, 600), pick(rand, CITIES)),
  ),
];

const COMPLAINT_REASONS = [
  'Не вышел на смену без предупреждения',
  'Просит оплату наличными в обход платформы',
  'Грубое общение с соискателем',
  'Смена не соответствует описанию',
];

export const COMPLAINTS: ComplaintItem[] = Array.from({ length: 3 }, (_, i) => ({
  id: `complaint-${i}`,
  targetName: i === 0 ? 'ООО «Кофемолка»' : pick(rand, ['Веранда', 'Прозакат', 'Иван К.']),
  targetType: i === 2 ? 'worker' : 'employer',
  reporterName: pick(rand, ['Мария С.', 'Артём Н.', 'Дарья В.']),
  reason: pick(rand, COMPLAINT_REASONS),
  text: 'Подробности жалобы: гость сообщил о нарушении на смене, требуется проверка со стороны модератора и связь с обеими сторонами.',
  submittedMinAgo: intBetween(rand, 10, 2000),
  status: 'pending',
}));

const DOC_TYPES = ['Медицинская книжка', 'Паспорт', 'Сертификат бариста'];

export const DOCUMENT_REVIEWS: DocumentReview[] = Array.from({ length: 27 }, (_, i) => ({
  id: `doc-${i}`,
  applicantName: `${pick(rand, ['Иван', 'Мария', 'Артём', 'Дарья', 'Никита'])} ${pick(rand, ['К.', 'С.', 'Н.', 'В.', 'П.'])}`,
  docType: pick(rand, DOC_TYPES),
  applicantCity: pick(rand, CITIES),
  applicantRating: Math.round((3.8 + rand() * 1.2) * 10) / 10,
  submittedMinAgo: intBetween(rand, 5, 4000),
  status: 'pending',
}));

import type { VacancyRecord } from '@/types';
import { intBetween, mulberry32, pick } from './rng';
import { MODERATION_QUEUE } from './moderation';

const rand = mulberry32(44210);

const POSITIONS = ['Бариста', 'Повар', 'Официант', 'Бармен', 'Кассир', 'Хостес', 'Клининг', 'Курьер'];
const COMPANIES = ['Cofix', 'Чебуречная №1', 'Веранда', 'Прозакат', 'Skuratov Coffee', 'Северный Бар', 'Lucky Sushi'];
const CITIES = ['Москва', 'Санкт-Петербург', 'Химки', 'Казань'];
const STATUSES: VacancyRecord['status'][] = ['active', 'active', 'active', 'closed', 'rejected'];

function buildVacancy(i: number): VacancyRecord {
  return {
    id: `vac-${i}`,
    position: pick(rand, POSITIONS),
    companyName: pick(rand, COMPANIES),
    city: pick(rand, CITIES),
    hourlyRate: intBetween(rand, 280, 650),
    status: pick(rand, STATUSES),
    responses: intBetween(rand, 0, 40),
    publishedMinAgo: intBetween(rand, 5, 9000),
  };
}

const fromModeration: VacancyRecord[] = MODERATION_QUEUE.map((m, i) => ({
  id: `vac-mod-${i}`,
  position: m.position,
  companyName: m.companyName,
  city: m.city,
  hourlyRate: m.hourlyRate,
  status: 'moderation',
  responses: 0,
  publishedMinAgo: m.submittedMinAgo,
}));

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const VACANCIES: VacancyRecord[] = shuffled([...fromModeration, ...Array.from({ length: 30 }, (_, i) => buildVacancy(i))]);

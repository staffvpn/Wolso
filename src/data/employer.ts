import type { Candidate, Position, Vacancy } from '@/types';
import { POSITION_LABEL } from './positions';
import { intBetween, mulberry32, pick, pickMany } from './rng';

/** The demo employer account manages this venue. */
export const EMPLOYER_COMPANY_ID = 'cofix';

const rand = mulberry32(9182026);

const NAMES = [
  'Иван К.', 'Мария С.', 'Артём Н.', 'Дарья В.', 'Никита П.', 'Ольга Т.',
  'Егор Р.', 'Полина Ж.', 'Максим Б.', 'Алина Ф.', 'Кирилл Д.', 'Света М.',
];

const SKILLS_POOL = ['Медкнижка', 'Паспорт проверен', 'La Marzocco', 'Опыт с кассой', 'Онлайн-обучение', 'HACCP'];

const EXP_PLACES = ['Skuratov', 'Веранда', 'Прозакат', 'Кофемания', 'Даблби', "Traveler's Coffee"];
const EXP_ROLES = ['Бариста', 'Официант', 'Кассир', 'Хостес'];
const EXP_PERIODS = ['2023–2025', '2022–2023', '2021–2022', '2024–2025'];

function buildCandidate(index: number, vacancyId: string, position: Position): Candidate {
  const withExp = rand() > 0.15;
  return {
    id: `cand-${index}`,
    vacancyId,
    name: pick(rand, NAMES),
    position,
    positionLabel: POSITION_LABEL[position],
    distanceKm: Math.round(rand() * 5 * 10) / 10,
    rating: Math.round((3.9 + rand() * 1.1) * 10) / 10,
    shiftsCompleted: intBetween(rand, 2, 40),
    online: rand() > 0.45,
    medBook: rand() > 0.4,
    passportVerified: rand() > 0.25,
    skills: pickMany(rand, SKILLS_POOL, intBetween(rand, 1, 3)),
    experience: withExp
      ? pickMany(rand, EXP_PLACES, intBetween(rand, 1, 2)).map((place, i) => ({
          role: i === 0 ? POSITION_LABEL[position] : pick(rand, EXP_ROLES),
          place,
          period: pick(rand, EXP_PERIODS),
        }))
      : [],
    review: rand() > 0.4 ? { company: 'Cofix', text: 'Пришёл вовремя, работал быстро, гости довольны.' } : undefined,
    status: 'pending',
  };
}

export const VACANCIES: Vacancy[] = [
  {
    id: 'vac-1', position: 'barista', positionLabel: POSITION_LABEL.barista, date: new Date().toISOString().slice(0, 10),
    startHour: 9, startMin: 0, endHour: 19, endMin: 0, hourlyRate: 450,
    requirements: ['Опыт от 1 года', 'Медкнижка'], urgent: true, publishedMinAgo: 120, status: 'active', reach: 214,
  },
  {
    id: 'vac-2', position: 'waiter', positionLabel: POSITION_LABEL.waiter, date: new Date().toISOString().slice(0, 10),
    startHour: 12, startMin: 0, endHour: 22, endMin: 0, hourlyRate: 380,
    requirements: ['Без опыта'], urgent: false, publishedMinAgo: 400, status: 'active', reach: 168,
  },
  {
    id: 'vac-3', position: 'cook', positionLabel: POSITION_LABEL.cook, date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    startHour: 8, startMin: 0, endHour: 16, endMin: 0, hourlyRate: 500,
    requirements: ['Опыт от 1 года'], urgent: false, publishedMinAgo: 900, status: 'active', reach: 96,
  },
];

export const CANDIDATES: Candidate[] = VACANCIES.flatMap((vac, vacIdx) =>
  Array.from({ length: intBetween(rand, 3, 6) }, (_, i) => buildCandidate(vacIdx * 10 + i, vac.id, vac.position)),
);

export function getVacancy(id: string): Vacancy | undefined {
  return VACANCIES.find((v) => v.id === id);
}

export function candidatesFor(vacancyId: string): Candidate[] {
  return CANDIDATES.filter((c) => c.vacancyId === vacancyId);
}

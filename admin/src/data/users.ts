import type { PlatformUser } from '@/types';
import { intBetween, mulberry32, pick } from './rng';

const rand = mulberry32(778812);

const FIRST_NAMES = ['Иван', 'Мария', 'Артём', 'Дарья', 'Никита', 'Ольга', 'Егор', 'Полина', 'Максим', 'Алина', 'Кирилл', 'Света', 'Роман', 'Юлия', 'Тимур'];
const LAST_NAMES = ['Ковалёв', 'Соколова', 'Носов', 'Титова', 'Романов', 'Белова', 'Крылов', 'Жукова', 'Дорохов', 'Фомина', 'Данилов', 'Морозова'];
const CITIES = ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург', 'Новосибирск'];
const COMPANY_NAMES = ['ООО «Кофемолка»', 'ИП Прозакат', 'ООО «Чебуречная №1»', 'ООО «Веранда»', 'Skuratov Coffee', 'ООО «Северный Бар»', 'ИП Колосов', 'Lucky Sushi'];

export const TOTAL_USERS_COUNT = 12480;

function buildSeeker(i: number): PlatformUser {
  const verified = rand() > 0.3;
  const pendingDocs = !verified && rand() > 0.5;
  return {
    id: `seek-${i}`,
    kind: 'seeker',
    name: `${pick(rand, FIRST_NAMES)} ${pick(rand, LAST_NAMES)}`,
    contact: `+7 9${intBetween(rand, 10, 99)} ··· ${intBetween(rand, 10, 99)} ${intBetween(rand, 10, 99)}`,
    status: pendingDocs ? 'pending_docs' : 'active',
    statusLabel: pendingDocs ? 'Ждёт документов' : 'Верифицирован',
    lastActiveMinAgo: intBetween(rand, 1, 8000),
    city: pick(rand, CITIES),
    rating: Math.round((3.8 + rand() * 1.2) * 10) / 10,
    shiftsCompleted: intBetween(rand, 0, 60),
    verified,
  };
}

function buildEmployer(i: number): PlatformUser {
  const blocked = rand() > 0.85;
  return {
    id: `emp-${i}`,
    kind: 'employer',
    name: pick(rand, COMPANY_NAMES),
    contact: `ИНН 77${intBetween(rand, 10, 99)}${intBetween(rand, 100000, 999999)}`,
    status: blocked ? 'suspended' : 'active',
    statusLabel: blocked ? 'Заблокирован' : 'Активен',
    lastActiveMinAgo: intBetween(rand, 1, 8000),
    city: pick(rand, CITIES),
    companyInn: `77${intBetween(rand, 10, 99)}${intBetween(rand, 100000, 999999)}`,
    verified: !blocked && rand() > 0.4,
  };
}

export const SEEKERS: PlatformUser[] = [
  {
    id: 'seek-ivan',
    kind: 'seeker',
    name: 'Иван Ковалёв',
    contact: '+7 926 ··· 41 20',
    status: 'active',
    statusLabel: 'Верифицирован',
    lastActiveMinAgo: 30,
    city: 'Москва',
    rating: 4.9,
    shiftsCompleted: 17,
    verified: true,
  },
  {
    id: 'seek-maria',
    kind: 'seeker',
    name: 'Мария Соколова',
    contact: '+7 903 ··· 88 17',
    status: 'pending_docs',
    statusLabel: 'Ждёт документов',
    lastActiveMinAgo: 1440,
    city: 'Москва',
    rating: 4.2,
    shiftsCompleted: 3,
    verified: false,
  },
  ...Array.from({ length: 34 }, (_, i) => buildSeeker(i)),
];

export const EMPLOYERS: PlatformUser[] = [
  {
    id: 'emp-kofemolka',
    kind: 'employer',
    name: 'ООО «Кофемолка»',
    contact: 'ИНН 7712345678',
    status: 'suspended',
    statusLabel: 'Заблокирован',
    lastActiveMinAgo: 4320,
    city: 'Москва',
    companyInn: '7712345678',
    verified: false,
  },
  ...Array.from({ length: 18 }, (_, i) => buildEmployer(i)),
];

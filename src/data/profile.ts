import type { WorkerProfile } from '@/types';

export const WORKER_PROFILE: WorkerProfile = {
  name: 'Иван Ковалёв',
  city: 'Москва',
  rating: 4.9,
  shiftsCompleted: 17,
  profileCompletion: 80,
  positions: [
    { position: 'barista', positionLabel: 'Бариста', years: 3 },
    { position: 'waiter', positionLabel: 'Официант', years: 1 },
  ],
  documents: [
    { id: 'passport', label: 'Паспорт', status: 'verified', note: 'Проверен 3 августа' },
    { id: 'medbook', label: 'Медицинская книжка', status: 'missing', note: 'Обязательна для кухни и бара' },
    { id: 'certs', label: 'Сертификаты', status: 'missing', note: 'Бариста-курсы, HACCP — по желанию' },
  ],
  reviews: [
    { companyName: 'Cofix', rating: 5, text: 'Пришёл вовремя, работал быстро, гости довольны.' },
  ],
  referralCode: 'IVAN41',
};

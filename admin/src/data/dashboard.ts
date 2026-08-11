import type { DashboardStats } from '@/types';
import { MODERATION_QUEUE, COMPLAINTS, DOCUMENT_REVIEWS } from './moderation';

export const DASHBOARD_STATS: DashboardStats = {
  vacanciesPublished: 8412,
  vacanciesPublishedDeltaPct: 18,
  closedSameDayPct: 73,
  closedSameDayDeltaPp: 5,
  activeWorkers: 3260,
  activeWorkersDeltaPct: 9,
  payoutVolume: 31_400_000,
  platformCommission: 2_100_000,
  weekly: [
    { day: 'Пн', shifts: 980, responses: 1180 },
    { day: 'Вт', shifts: 1120, responses: 1340 },
    { day: 'Ср', shifts: 860, responses: 1020 },
    { day: 'Чт', shifts: 1260, responses: 1580 },
    { day: 'Пт', shifts: 1480, responses: 1720 },
    { day: 'Сб', shifts: 1620, responses: 1860 },
    { day: 'Вс', shifts: 1090, responses: 1260 },
  ],
  topPositions: [
    { label: 'Официант', count: 2140 },
    { label: 'Повар', count: 1780 },
    { label: 'Бариста', count: 1402 },
    { label: 'Клининг', count: 860 },
  ],
  attention: [
    { label: 'Вакансии на модерации', count: MODERATION_QUEUE.length, tone: 'warning' },
    { label: 'Жалобы на работодателей', count: COMPLAINTS.length, tone: 'danger' },
    { label: 'Документы на проверку', count: DOCUMENT_REVIEWS.length, tone: 'info' },
  ],
};

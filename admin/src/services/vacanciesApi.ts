import { apiFetch } from '@/lib/apiClient';
import { minutesSince } from '@/lib/format';
import type { VacancyRecord } from '@/types';

interface VacancyApiRow {
  id: number;
  positionLabel: string;
  hourlyRate: number;
  totalPay: number;
  payMode?: string;
  status: string;
  createdAt: string;
  responseCount: number;
  description?: string;
  requirements?: string[];
  meal?: boolean;
  urgency?: string;
  employmentType?: string;
  timeOfDay?: string;
  date: string;
  endDate?: string;
  dates?: string[];
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  company?: { name: string; city?: string; address?: string };
}

const STATUS_MAP: Record<string, VacancyRecord['status']> = {
  active: 'active',
  rejected: 'rejected',
  closed: 'closed',
};

function fromApi(v: VacancyApiRow): VacancyRecord {
  return {
    id: String(v.id),
    position: v.positionLabel,
    companyName: v.company?.name ?? 'Компания',
    companyAddress: v.company?.address ?? '',
    city: v.company?.city ?? '',
    hourlyRate: v.hourlyRate,
    totalPay: v.totalPay,
    payMode: v.payMode === 'fixed' ? 'fixed' : 'hourly',
    status: STATUS_MAP[v.status] ?? 'active',
    responses: v.responseCount,
    publishedMinAgo: minutesSince(v.createdAt),
    description: v.description ?? '',
    requirements: v.requirements ?? [],
    meal: !!v.meal,
    urgent: v.urgency === 'urgent',
    employmentType: v.employmentType === 'permanent' ? 'permanent' : 'shift',
    timeOfDay: (v.timeOfDay as VacancyRecord['timeOfDay']) ?? 'day',
    date: v.date,
    endDate: v.endDate,
    dates: v.dates,
    startHour: v.startHour,
    startMin: v.startMin,
    endHour: v.endHour,
    endMin: v.endMin,
  };
}

export async function fetchAllVacancies(): Promise<VacancyRecord[]> {
  const { vacancies } = await apiFetch<{ vacancies: VacancyApiRow[] }>('/admin/vacancies');
  return vacancies.map(fromApi);
}

export async function closeVacancy(id: string): Promise<void> {
  await apiFetch(`/admin/vacancies/${id}/close`, { method: 'POST' });
}

export async function deleteVacancy(id: string): Promise<void> {
  await apiFetch(`/admin/vacancies/${id}`, { method: 'DELETE' });
}

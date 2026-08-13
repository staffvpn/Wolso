import { apiFetch } from '@/lib/apiClient';
import { minutesSince } from '@/lib/format';
import type { VacancyRecord } from '@/types';

interface VacancyApiRow {
  id: number;
  positionLabel: string;
  hourlyRate: number;
  status: string;
  createdAt: string;
  responseCount: number;
  company?: { name: string; city?: string };
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
    city: v.company?.city ?? '',
    hourlyRate: v.hourlyRate,
    status: STATUS_MAP[v.status] ?? 'active',
    responses: v.responseCount,
    publishedMinAgo: minutesSince(v.createdAt),
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

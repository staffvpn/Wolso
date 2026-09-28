import { apiFetch, apiUpload, resolveMediaUrl } from '@/lib/apiClient';
import type { ProxyEmployer, ProxyEmployerInput, ProxyVacancy, ProxyVacancyInput } from '@/types';

interface ProxyEmployerApiRow {
  id: number;
  name: string;
  city: string;
  address: string | null;
  description: string;
  foundedYear: number | null;
  telegramUsername: string | null;
  avatarUrl: string | null;
  photos: { id: number; url: string }[];
  activeVacancies: number;
}

function fromApi(r: ProxyEmployerApiRow): ProxyEmployer {
  return {
    id: String(r.id),
    name: r.name,
    city: r.city,
    address: r.address,
    description: r.description,
    foundedYear: r.foundedYear,
    telegramUsername: r.telegramUsername,
    avatarUrl: resolveMediaUrl(r.avatarUrl),
    photos: r.photos.map((p) => ({ id: String(p.id), url: resolveMediaUrl(p.url)! })),
    activeVacancies: r.activeVacancies,
  };
}

export async function fetchProxyEmployers(): Promise<ProxyEmployer[]> {
  const { employers } = await apiFetch<{ employers: ProxyEmployerApiRow[] }>('/admin/proxy-employers');
  return employers.map(fromApi);
}

export async function createProxyEmployer(input: ProxyEmployerInput): Promise<string> {
  const { id } = await apiFetch<{ id: number }>('/admin/proxy-employers', { method: 'POST', body: input });
  return String(id);
}

/** Правка профиля идёт через общую ручку редактирования работодателя
 *  (worker/src/admin/users.ts) — она уже умеет то же самое для настоящих
 *  работодателей, и telegramUsername ей добавили специально для прокси. */
export async function updateProxyEmployer(id: string, input: Partial<ProxyEmployerInput>): Promise<void> {
  await apiFetch(`/admin/users/employers/${id}`, { method: 'PATCH', body: input });
}

export async function uploadProxyEmployerAvatar(id: string, file: File): Promise<void> {
  await apiUpload(`/admin/proxy-employers/${id}/avatar`, file);
}

export async function uploadProxyEmployerPhoto(id: string, file: File): Promise<void> {
  await apiUpload(`/admin/proxy-employers/${id}/photos`, file);
}

export async function deleteProxyEmployerPhoto(id: string, photoId: string): Promise<void> {
  await apiFetch(`/admin/proxy-employers/${id}/photos/${photoId}`, { method: 'DELETE' });
}

export async function deleteProxyEmployer(id: string): Promise<void> {
  await apiFetch(`/admin/proxy-employers/${id}`, { method: 'DELETE' });
}

interface ShiftApiRow {
  id: number;
  position: string;
  positionLabel: string;
  date: string;
  endDate?: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  hourlyRate: number;
  totalPay: number;
  payMode?: 'hourly' | 'fixed';
  description: string;
  meal: boolean;
  urgency: string;
  employmentType: string;
  timeOfDay: string;
  requirements: string[];
  status: string;
}

function vacancyFromApi(s: ShiftApiRow): ProxyVacancy {
  return {
    id: String(s.id),
    position: s.position,
    positionLabel: s.positionLabel,
    date: s.date,
    endDate: s.endDate,
    startHour: s.startHour,
    startMin: s.startMin,
    endHour: s.endHour,
    endMin: s.endMin,
    hourlyRate: s.hourlyRate,
    totalPay: s.totalPay,
    payMode: s.payMode ?? 'hourly',
    description: s.description,
    meal: s.meal,
    urgency: s.urgency === 'urgent' ? 'urgent' : 'normal',
    employmentType: s.employmentType === 'permanent' ? 'permanent' : 'shift',
    timeOfDay: s.timeOfDay,
    requirements: s.requirements,
    status: s.status,
  };
}

export async function fetchProxyVacancies(employerId: string): Promise<ProxyVacancy[]> {
  const { shifts } = await apiFetch<{ shifts: ShiftApiRow[] }>(`/admin/proxy-employers/${employerId}/vacancies`);
  return shifts.map(vacancyFromApi);
}

export async function createProxyVacancy(employerId: string, input: ProxyVacancyInput): Promise<ProxyVacancy> {
  const { shift } = await apiFetch<{ shift: ShiftApiRow }>(`/admin/proxy-employers/${employerId}/vacancies`, {
    method: 'POST',
    body: input,
  });
  return vacancyFromApi(shift);
}

export async function updateProxyVacancy(
  employerId: string,
  vacancyId: string,
  input: Partial<ProxyVacancyInput>,
): Promise<ProxyVacancy> {
  const { shift } = await apiFetch<{ shift: ShiftApiRow }>(`/admin/proxy-employers/${employerId}/vacancies/${vacancyId}`, {
    method: 'PATCH',
    body: input,
  });
  return vacancyFromApi(shift);
}

export async function deleteProxyVacancy(employerId: string, vacancyId: string): Promise<void> {
  await apiFetch(`/admin/proxy-employers/${employerId}/vacancies/${vacancyId}`, { method: 'DELETE' });
}

import { apiFetch } from '@/lib/apiClient';
import { minutesSince } from '@/lib/format';
import type { ComplaintItem, ModerationVacancy } from '@/types';

/** The backend flags vacancies below this hourly rate at creation time —
 *  mirrored here only for display; the real check happens server-side. */
export const REGIONAL_MIN_WAGE = 280;

interface VacancyApiRow {
  id: number;
  positionLabel: string;
  date: string;
  startHour: number;
  endHour: number;
  hourlyRate: number;
  description: string;
  requirements: string[];
  moderationFlag: { label: string; tone: 'danger' | 'warning' | 'info' | 'neutral' } | null;
  createdAt: string;
  shiftsPosted: number;
  company?: { name: string; address?: string; city?: string; rating?: number };
}

function fromApiVacancy(v: VacancyApiRow): ModerationVacancy {
  return {
    id: String(v.id),
    position: v.positionLabel,
    companyName: v.company?.name ?? 'Компания',
    companyRating: v.company?.rating ?? 0,
    city: v.company?.city ?? '',
    submittedMinAgo: minutesSince(v.createdAt),
    flag: v.moderationFlag,
    status: 'pending',
    hourlyRate: v.hourlyRate,
    regionalMinWage: REGIONAL_MIN_WAGE,
    durationHours: v.endHour - v.startHour,
    address: v.company?.address ?? '',
    experienceReq: v.requirements.length ? v.requirements.join(', ') : 'Не указано',
    description: v.description,
    shiftsPosted: v.shiftsPosted,
  };
}

export async function fetchPendingVacancies(): Promise<ModerationVacancy[]> {
  const { vacancies } = await apiFetch<{ vacancies: VacancyApiRow[] }>('/admin/moderation/vacancies');
  return vacancies.map(fromApiVacancy);
}

export async function decideVacancy(id: string, status: 'active' | 'pending_review' | 'rejected'): Promise<void> {
  await apiFetch(`/admin/moderation/vacancies/${id}/decide`, { method: 'POST', body: { status } });
}

interface ComplaintApiRow {
  id: number;
  target_name: string;
  target_type: string;
  reporter_name: string | null;
  reason: string | null;
  text: string | null;
  created_at: string;
}

function fromApiComplaint(c: ComplaintApiRow): ComplaintItem {
  return {
    id: String(c.id),
    targetName: c.target_name,
    targetType: c.target_type as ComplaintItem['targetType'],
    reporterName: c.reporter_name ?? '',
    reason: c.reason ?? '',
    text: c.text ?? '',
    submittedMinAgo: minutesSince(c.created_at),
    status: 'pending',
  };
}

export async function fetchPendingComplaints(): Promise<ComplaintItem[]> {
  const { complaints } = await apiFetch<{ complaints: ComplaintApiRow[] }>('/admin/moderation/complaints');
  return complaints.map(fromApiComplaint);
}

export async function decideComplaint(id: string, status: 'approved' | 'returned' | 'rejected'): Promise<void> {
  await apiFetch(`/admin/moderation/complaints/${id}/decide`, { method: 'POST', body: { status } });
}

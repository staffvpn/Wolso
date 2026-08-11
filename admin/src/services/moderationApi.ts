import { apiFetch } from '@/lib/apiClient';
import { minutesSince } from '@/lib/format';
import { useSessionStore } from '@/store/useSessionStore';
import type { ComplaintItem, DocumentReview, EmployerReview, ModerationVacancy } from '@/types';

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

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
  company?: { name: string; address?: string; city?: string; rating?: number; inn?: string };
}

function fromApiVacancy(v: VacancyApiRow): ModerationVacancy {
  return {
    id: String(v.id),
    position: v.positionLabel,
    companyName: v.company?.name ?? 'Компания',
    companyInn: v.company?.inn ?? '—',
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

interface DocumentApiRow {
  id: number;
  label: string;
  worker_name: string;
  worker_city: string;
  worker_rating: number;
  updated_at: string;
}

function fromApiDocument(d: DocumentApiRow): DocumentReview {
  return {
    id: String(d.id),
    applicantName: d.worker_name,
    docType: d.label,
    applicantCity: d.worker_city,
    applicantRating: d.worker_rating,
    submittedMinAgo: minutesSince(d.updated_at),
    status: 'pending',
  };
}

export async function fetchPendingDocuments(): Promise<DocumentReview[]> {
  const { documents } = await apiFetch<{ documents: DocumentApiRow[] }>('/admin/moderation/documents');
  return documents.map(fromApiDocument);
}

export async function decideDocument(id: string, status: 'verified' | 'missing'): Promise<void> {
  await apiFetch(`/admin/moderation/documents/${id}/decide`, { method: 'POST', body: { status } });
}

interface EmployerApiRow {
  id: number;
  name: string;
  city: string;
  inn: string | null;
  created_at: string;
}

function fromApiEmployer(e: EmployerApiRow): EmployerReview {
  return {
    id: String(e.id),
    companyName: e.name,
    city: e.city,
    inn: e.inn ?? undefined,
    submittedMinAgo: minutesSince(e.created_at),
    status: 'pending',
  };
}

export async function fetchPendingEmployers(): Promise<EmployerReview[]> {
  const { employers } = await apiFetch<{ employers: EmployerApiRow[] }>('/admin/moderation/employers');
  return employers.map(fromApiEmployer);
}

export async function decideEmployer(id: string, status: 'approved' | 'rejected'): Promise<void> {
  await apiFetch(`/admin/moderation/employers/${id}/decide`, { method: 'POST', body: { status } });
}

/** Bearer-token auth means an <img src> can't hit the API directly — fetch
 *  the file manually and hand back a blob URL to render. Caller owns
 *  revoking it (`URL.revokeObjectURL`) once done. */
export async function fetchDocumentFileUrl(id: string): Promise<string | null> {
  if (!API_URL) return null;
  const token = useSessionStore.getState().token;
  const res = await fetch(`${API_URL}/admin/moderation/documents/${id}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

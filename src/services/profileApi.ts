import { apiFetch, resolveMediaUrl } from '@/lib/apiClient';
import type { Position, WorkerDocument, WorkerExperience, WorkerProfile, YesNo } from '@/types';

interface WorkerApiRow {
  id: number;
  name: string;
  city: string;
  rating: number;
  shifts_completed: number;
  referral_code: string | null;
  bio: string;
  skills: string;
  birthdate: string | null;
  smoking: YesNo | null;
  alcohol: YesNo | null;
  age: number | null;
  avatarUrl: string | null;
  profileCompletion: number;
  profileComplete: boolean;
}

interface MeResponse {
  worker: WorkerApiRow;
  positions: { position: string; position_label: string; years: number }[];
  documents: { doc_type: string; label: string; status: string; note: string | null }[];
  photos: { id: number; url: string }[];
}

function fromApi(r: MeResponse): WorkerProfile {
  return {
    name: r.worker.name,
    city: r.worker.city,
    rating: r.worker.rating,
    shiftsCompleted: r.worker.shifts_completed,
    profileCompletion: r.worker.profileCompletion,
    profileComplete: r.worker.profileComplete,
    referralCode: r.worker.referral_code ?? '',
    bio: r.worker.bio ?? '',
    skills: r.worker.skills ?? '',
    birthdate: r.worker.birthdate ?? undefined,
    age: r.worker.age ?? undefined,
    smoking: r.worker.smoking ?? undefined,
    alcohol: r.worker.alcohol ?? undefined,
    avatarUrl: resolveMediaUrl(r.worker.avatarUrl),
    positions: r.positions.map((p) => ({ position: p.position as Position, positionLabel: p.position_label, years: p.years })),
    documents: r.documents.map((d) => ({
      id: d.doc_type,
      label: d.label,
      status: d.status as WorkerDocument['status'],
      note: d.note ?? undefined,
    })),
    reviews: [],
    photos: r.photos.map((p) => ({ id: String(p.id), url: resolveMediaUrl(p.url)! })),
  };
}

export async function fetchMyProfile(): Promise<WorkerProfile> {
  const data = await apiFetch<MeResponse>('/me');
  return fromApi(data);
}

export interface ProfileUpdate {
  name?: string;
  city?: string;
  bio?: string;
  birthdate?: string;
  skills?: string;
  smoking?: YesNo;
  alcohol?: YesNo;
}

export async function updateMyProfile(update: ProfileUpdate): Promise<WorkerProfile> {
  const data = await apiFetch<MeResponse>('/me', { method: 'PATCH', body: update });
  return fromApi(data);
}

export async function addExperience(exp: WorkerExperience): Promise<WorkerProfile> {
  const data = await apiFetch<MeResponse>('/me/positions', {
    method: 'POST',
    body: { position: exp.position, positionLabel: exp.positionLabel, years: exp.years },
  });
  return fromApi(data);
}

export async function uploadDocument(docType: string, file: File): Promise<void> {
  const body = await file.arrayBuffer();
  await apiFetch(`/me/documents/${docType}/upload`, {
    method: 'POST',
    body,
    raw: { contentType: file.type || 'application/octet-stream' },
  });
}

export async function uploadAvatar(file: File): Promise<WorkerProfile> {
  const body = await file.arrayBuffer();
  const data = await apiFetch<MeResponse>('/me/avatar', { method: 'POST', body, raw: { contentType: file.type || 'application/octet-stream' } });
  return fromApi(data);
}

export async function uploadPortfolioPhoto(file: File): Promise<WorkerProfile> {
  const body = await file.arrayBuffer();
  const data = await apiFetch<MeResponse>('/me/photos', { method: 'POST', body, raw: { contentType: file.type || 'application/octet-stream' } });
  return fromApi(data);
}

export async function deletePortfolioPhoto(id: string): Promise<WorkerProfile> {
  const data = await apiFetch<MeResponse>(`/me/photos/${id}`, { method: 'DELETE' });
  return fromApi(data);
}

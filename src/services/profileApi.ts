import { apiFetch, resolveMediaUrl } from '@/lib/apiClient';
import type { Position, WorkerExperience, WorkerProfile } from '@/types';

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
  age: number | null;
  avatarUrl: string | null;
  profileCompletion: number;
  profileComplete: boolean;
  hidden?: boolean;
  hiddenReason?: string | null;
}

interface MeResponse {
  worker: WorkerApiRow;
  positions: { id: number; position: string; position_label: string; months: number }[];
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
    // Absent on a worker deployed before migration 0027 — treat that as
    // "not hidden" rather than blocking the feed on a missing field.
    hidden: !!r.worker.hidden,
    hiddenReason: r.worker.hiddenReason ?? undefined,
    referralCode: r.worker.referral_code ?? '',
    bio: r.worker.bio ?? '',
    skills: r.worker.skills ?? '',
    birthdate: r.worker.birthdate ?? undefined,
    age: r.worker.age ?? undefined,
    avatarUrl: resolveMediaUrl(r.worker.avatarUrl),
    positions: r.positions.map((p) => ({ id: String(p.id), position: p.position as Position, positionLabel: p.position_label, months: p.months })),
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
}

export async function updateMyProfile(update: ProfileUpdate): Promise<WorkerProfile> {
  const data = await apiFetch<MeResponse>('/me', { method: 'PATCH', body: update });
  return fromApi(data);
}

export async function addExperience(exp: Omit<WorkerExperience, 'id'>): Promise<WorkerProfile> {
  const data = await apiFetch<MeResponse>('/me/positions', {
    method: 'POST',
    body: { position: exp.position, positionLabel: exp.positionLabel, months: exp.months },
  });
  return fromApi(data);
}

export async function deleteExperience(id: string): Promise<WorkerProfile> {
  const data = await apiFetch<MeResponse>(`/me/positions/${id}`, { method: 'DELETE' });
  return fromApi(data);
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

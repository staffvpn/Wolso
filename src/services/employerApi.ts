import type { Candidate, Position, Vacancy } from '@/types';
import { apiFetch, resolveMediaUrl } from '@/lib/apiClient';
import { ageFrom } from '@/lib/format';

interface VacancyApiResponse {
  id: number;
  position: string;
  positionLabel: string;
  date: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  hourlyRate: number;
  requirements: string[];
  urgency: string;
  status: string;
  createdAt: string;
  responseCount: number;
}

function fromApiVacancy(v: VacancyApiResponse): Vacancy {
  return {
    id: String(v.id),
    position: v.position as Position,
    positionLabel: v.positionLabel,
    date: v.date,
    startHour: v.startHour,
    startMin: v.startMin,
    endHour: v.endHour,
    endMin: v.endMin,
    hourlyRate: v.hourlyRate,
    requirements: v.requirements,
    urgent: v.urgency === 'urgent',
    createdAt: v.createdAt,
    status: v.status as Vacancy['status'],
    responseCount: v.responseCount,
  };
}

export async function fetchVacancies(): Promise<Vacancy[]> {
  const { shifts } = await apiFetch<{ shifts: VacancyApiResponse[] }>('/employer/vacancies', { as: 'company' });
  return shifts.map(fromApiVacancy);
}

interface CandidateApiResponse {
  id: number;
  shift_id: number;
  worker_id: number;
  status: string;
  worker_name: string;
  worker_rating: number;
  worker_shifts_completed: number;
  worker_city: string;
  worker_bio: string | null;
  worker_skills: string | null;
  worker_birthdate: string | null;
  worker_avatar_url: string | null;
  worker_photos: string[];
  shift_position_label?: string;
}

function fromApiCandidate(c: CandidateApiResponse, fallbackPositionLabel?: string): Candidate {
  const avatar = resolveMediaUrl(c.worker_avatar_url);
  const gallery = c.worker_photos.map((p) => resolveMediaUrl(p)!);
  return {
    id: String(c.id),
    vacancyId: String(c.shift_id),
    workerId: String(c.worker_id),
    name: c.worker_name,
    positionLabel: c.shift_position_label ?? fallbackPositionLabel ?? '',
    rating: c.worker_rating,
    shiftsCompleted: c.worker_shifts_completed,
    city: c.worker_city,
    status: c.status as Candidate['status'],
    bio: c.worker_bio ?? undefined,
    skills: c.worker_skills ?? undefined,
    age: ageFrom(c.worker_birthdate),
    photos: avatar ? [avatar, ...gallery] : gallery,
  };
}

/** All pending applicants across every vacancy this company owns — feeds
 *  the employer's swipe deck. */
export async function fetchCandidates(): Promise<Candidate[]> {
  const { candidates } = await apiFetch<{ candidates: CandidateApiResponse[] }>('/employer/candidates', { as: 'company' });
  return candidates.map((c) => fromApiCandidate(c));
}

export async function fetchVacancyCandidates(vacancyId: string, positionLabel?: string): Promise<Candidate[]> {
  const { candidates } = await apiFetch<{ candidates: CandidateApiResponse[] }>(`/employer/vacancies/${vacancyId}/candidates`, {
    as: 'company',
  });
  return candidates.map((c) => fromApiCandidate(c, positionLabel));
}

export async function decideCandidate(vacancyId: string, applicationId: string, status: 'accepted' | 'declined'): Promise<void> {
  await apiFetch(`/employer/vacancies/${vacancyId}/candidates/${applicationId}/decide`, {
    method: 'POST',
    body: { status },
    as: 'company',
  });
}

export async function createVacancy(input: {
  position: Position;
  positionLabel: string;
  date: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  hourlyRate: number;
  requirements: string[];
  description?: string;
  urgent: boolean;
}): Promise<Vacancy> {
  const { shift } = await apiFetch<{ shift: VacancyApiResponse & { responseCount?: number } }>('/employer/vacancies', {
    method: 'POST',
    as: 'company',
    body: {
      position: input.position,
      positionLabel: input.positionLabel,
      date: input.date,
      startHour: input.startHour,
      startMin: input.startMin,
      endHour: input.endHour,
      endMin: input.endMin,
      hourlyRate: input.hourlyRate,
      requirements: input.requirements,
      description: input.description,
      urgency: input.urgent ? 'urgent' : 'normal',
    },
  });
  return fromApiVacancy({ ...shift, responseCount: shift.responseCount ?? 0 });
}

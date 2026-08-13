import type { Candidate, Position, Vacancy, WorkerListing } from '@/types';
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
  work_stage?: string;
  closed_by_employer_at?: string | null;
  cancelled_by?: string | null;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
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
    workStage: c.work_stage as Candidate['workStage'],
    closedByEmployerAt: c.closed_by_employer_at ?? undefined,
    cancelledBy: (c.cancelled_by as Candidate['cancelledBy']) ?? undefined,
    cancelReason: c.cancel_reason ?? undefined,
    cancelledAt: c.cancelled_at ?? undefined,
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

/** Confirms a hire's shift actually happened (only once the date's past)
 *  and submits the employer's own review of the worker in the same call —
 *  mandatory, there's no "close without reviewing" path. */
export async function closeShift(
  vacancyId: string,
  applicationId: string,
  rating: number,
  tags: string[],
  comment: string,
): Promise<void> {
  await apiFetch(`/employer/vacancies/${vacancyId}/candidates/${applicationId}/close`, {
    method: 'POST',
    body: { rating, tags, comment },
    as: 'company',
  });
}

interface WorkerListingApiResponse {
  worker_id: number;
  worker_name: string;
  worker_rating: number;
  worker_shifts_completed: number;
  worker_city: string;
  worker_bio: string | null;
  worker_skills: string | null;
  worker_birthdate: string | null;
  worker_avatar_url: string | null;
  worker_photos: string[];
  matched_position_label: string | null;
}

function fromApiWorkerListing(w: WorkerListingApiResponse): WorkerListing {
  const avatar = resolveMediaUrl(w.worker_avatar_url);
  const gallery = w.worker_photos.map((p) => resolveMediaUrl(p)!);
  return {
    id: String(w.worker_id),
    workerId: String(w.worker_id),
    name: w.worker_name,
    positionLabel: w.matched_position_label ?? '',
    rating: w.worker_rating,
    shiftsCompleted: w.worker_shifts_completed,
    city: w.worker_city,
    bio: w.worker_bio ?? undefined,
    skills: w.worker_skills ?? undefined,
    age: ageFrom(w.worker_birthdate),
    photos: avatar ? [avatar, ...gallery] : gallery,
  };
}

/** "Find staff" — workers browsed directly rather than applicants to a
 *  specific vacancy, filtered by position so an employer looking for
 *  waiters never has to page past a hostess. */
export async function fetchWorkerListings(positions: Position[]): Promise<WorkerListing[]> {
  const qs = positions.length ? `?positions=${positions.join(',')}` : '';
  const { workers } = await apiFetch<{ workers: WorkerListingApiResponse[] }>(`/employer/workers${qs}`, { as: 'company' });
  return workers.map(fromApiWorkerListing);
}

/** Left swipe in "find staff" — this worker won't be offered again. */
export async function passWorker(workerId: string): Promise<void> {
  await apiFetch(`/employer/workers/${workerId}/pass`, { method: 'POST', as: 'company' });
}

export async function decideCandidate(vacancyId: string, applicationId: string, status: 'accepted' | 'declined'): Promise<void> {
  await apiFetch(`/employer/vacancies/${vacancyId}/candidates/${applicationId}/decide`, {
    method: 'POST',
    body: { status },
    as: 'company',
  });
}

/** Withdraws an invitation or an already-confirmed hire — a reason is
 *  mandatory, and the shift's chat goes away with it. */
export async function cancelCandidate(vacancyId: string, applicationId: string, reason: string): Promise<void> {
  await apiFetch(`/employer/vacancies/${vacancyId}/candidates/${applicationId}/cancel`, {
    method: 'POST',
    body: { reason },
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

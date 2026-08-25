import { apiFetch, resolveMediaUrl } from '@/lib/apiClient';
import { minutesSince, telegramLabel } from '@/lib/format';
import type { AdminReview, BotStatus, EmployerDetail, EmployerVacancy, PlatformUser, SeekerApplication, SeekerDetail, TeamMember, UserPhoto, UserPosition, UserStatus } from '@/types';

/** The column is TEXT with a default, so anything could in principle come
 *  back; anything unrecognised is treated as "we don't know" rather than
 *  rendered raw. */
const BOT_STATUSES: BotStatus[] = ['active', 'blocked', 'deleted', 'unreachable', 'unknown'];
function asBotStatus(v: string | undefined): BotStatus {
  return BOT_STATUSES.includes(v as BotStatus) ? (v as BotStatus) : 'unknown';
}

interface TeamApiRow {
  id: number;
  telegram_id: number;
  name: string;
  email: string | null;
  role_id: string;
  status: string;
  since: number;
  created_at: string;
}

function fromApiTeamMember(t: TeamApiRow): TeamMember {
  return {
    id: String(t.id),
    name: t.name,
    contact: t.email ?? `Telegram ID ${t.telegram_id}`,
    roleId: t.role_id,
    status: t.status as UserStatus,
    since: t.since,
    createdMinAgo: minutesSince(t.created_at),
  };
}

export async function fetchTeam(): Promise<TeamMember[]> {
  const { team } = await apiFetch<{ team: TeamApiRow[] }>('/admin/users/team');
  return team.map(fromApiTeamMember);
}

interface SeekerApiRow {
  id: number;
  telegram_id: number;
  telegram_username: string | null;
  name: string;
  city: string;
  rating: number;
  shifts_completed: number;
  status: string;
  created_at: string;
  bot_status?: string;
  bot_status_at?: string | null;
}

function fromApiSeeker(w: SeekerApiRow): PlatformUser {
  const suspended = w.status === 'suspended';
  return {
    id: String(w.id),
    kind: 'seeker',
    // Registration no longer pre-fills this from Telegram — someone who
    // signed up but hasn't finished onboarding yet genuinely has no name
    // set, rather than always having at least their Telegram one.
    name: w.name || 'Без имени',
    contact: telegramLabel(w.telegram_id, w.telegram_username),
    status: w.status as UserStatus,
    statusLabel: suspended ? 'Заблокирован' : 'Активен',
    createdMinAgo: minutesSince(w.created_at),
    city: w.city,
    rating: w.rating,
    shiftsCompleted: w.shifts_completed,
    telegramId: w.telegram_id,
    telegramUsername: w.telegram_username ?? undefined,
    botStatus: asBotStatus(w.bot_status),
    botStatusAt: w.bot_status_at ?? undefined,
  };
}

export async function fetchSeekers(query?: string): Promise<PlatformUser[]> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : '';
  const { seekers } = await apiFetch<{ seekers: SeekerApiRow[] }>(`/admin/users/seekers${qs}`);
  return seekers.map(fromApiSeeker);
}

interface EmployerApiRow {
  id: number;
  owner_telegram_id: number;
  telegram_username: string | null;
  name: string;
  city: string;
  status: string;
  created_at: string;
  bot_status?: string;
  bot_status_at?: string | null;
}

function fromApiEmployer(c: EmployerApiRow): PlatformUser {
  const suspended = c.status === 'suspended';
  return {
    id: String(c.id),
    kind: 'employer',
    name: c.name || 'Без названия',
    contact: telegramLabel(c.owner_telegram_id, c.telegram_username),
    status: c.status as UserStatus,
    statusLabel: suspended ? 'Заблокирован' : 'Активен',
    createdMinAgo: minutesSince(c.created_at),
    city: c.city,
    telegramId: c.owner_telegram_id,
    telegramUsername: c.telegram_username ?? undefined,
    botStatus: asBotStatus(c.bot_status),
    botStatusAt: c.bot_status_at ?? undefined,
  };
}

export async function fetchEmployers(query?: string): Promise<PlatformUser[]> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : '';
  const { employers } = await apiFetch<{ employers: EmployerApiRow[] }>(`/admin/users/employers${qs}`);
  return employers.map(fromApiEmployer);
}

/** Backfills telegram_username straight from the Bot API for accounts that
 *  registered before that column existed or haven't reopened the app since
 *  — one batch per call (see the route for the cap), call again if
 *  `checked` comes back equal to the batch size to keep going. */
export async function syncTelegramUsernames(): Promise<{ checked: number; updated: number }> {
  return apiFetch('/admin/users/sync-telegram-usernames', { method: 'POST' });
}

export interface BotStatusCheckResult {
  checked: number;
  active: number;
  unreachable: number;
  /** Telegram gave no usable answer for these — a blip or a rate limit,
   *  not a verdict about the person. */
  inconclusive: number;
  /** Accounts still waiting to be checked — loop while this is above 0. */
  remaining: number;
}

/** Asks Telegram who can still receive messages, one batch per call. Only
 *  touches accounts that have never been established either way; a status
 *  learned from a real send or from the webhook is already current. */
export async function checkBotStatus(): Promise<BotStatusCheckResult> {
  return apiFetch('/admin/users/check-bot-status', { method: 'POST' });
}

interface SeekerDetailApiRow {
  id: number;
  telegram_id: number;
  telegram_username: string | null;
  name: string;
  city: string;
  bio: string;
  skills: string;
  birthdate: string | null;
  avatarUrl: string | null;
  rating: number;
  shifts_completed: number;
  status: string;
  created_at: string;
}

interface SeekerApplicationApiRow {
  id: number;
  status: string;
  work_stage: string;
  rating: number | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
  position_label: string;
  date: string;
  start_hour: number;
  start_min: number;
  company_name: string;
}

interface ReviewApiRow {
  id: number;
  rating: number;
  tags: string[];
  comment: string;
  createdAt: string | null;
  positionLabel: string;
  shiftDate: string;
  counterpartyName: string;
}

function fromApiReview(r: ReviewApiRow): AdminReview {
  return {
    id: String(r.id),
    rating: r.rating,
    tags: r.tags ?? [],
    comment: r.comment ?? '',
    createdAt: r.createdAt ?? undefined,
    positionLabel: r.positionLabel,
    shiftDate: r.shiftDate,
    counterpartyName: r.counterpartyName,
  };
}

export async function fetchSeekerDetail(id: string): Promise<SeekerDetail> {
  const { worker, positions, photos, applications, reviewsReceived, reviewsGiven } = await apiFetch<{
    worker: SeekerDetailApiRow;
    positions: { id: number; position: string; position_label: string; months: number }[];
    photos: { id: number; url: string }[];
    applications: SeekerApplicationApiRow[];
    reviewsReceived: ReviewApiRow[];
    reviewsGiven: ReviewApiRow[];
  }>(`/admin/users/seekers/${id}`);

  return {
    id: String(worker.id),
    name: worker.name,
    telegramId: worker.telegram_id,
    telegramUsername: worker.telegram_username ?? undefined,
    city: worker.city,
    bio: worker.bio,
    skills: worker.skills,
    birthdate: worker.birthdate ?? undefined,
    avatarUrl: resolveMediaUrl(worker.avatarUrl),
    rating: worker.rating,
    shiftsCompleted: worker.shifts_completed,
    status: worker.status as UserStatus,
    createdAt: worker.created_at,
    positions: positions.map((p): UserPosition => ({ id: String(p.id), position: p.position, positionLabel: p.position_label, months: p.months })),
    photos: photos.map((p): UserPhoto => ({ id: String(p.id), url: resolveMediaUrl(p.url)! })),
    applications: applications.map(
      (a): SeekerApplication => ({
        id: String(a.id),
        status: a.status,
        workStage: a.work_stage,
        rating: a.rating,
        cancelledBy: a.cancelled_by as SeekerApplication['cancelledBy'],
        cancelReason: a.cancel_reason,
        createdAt: a.created_at,
        positionLabel: a.position_label,
        date: a.date,
        startHour: a.start_hour,
        startMin: a.start_min,
        companyName: a.company_name,
      }),
    ),
    // Older deploys of the worker don't return these yet — default rather
    // than crash the whole card on a stale API.
    reviewsReceived: (reviewsReceived ?? []).map(fromApiReview),
    reviewsGiven: (reviewsGiven ?? []).map(fromApiReview),
  };
}

interface EmployerDetailApiRow {
  id: number;
  owner_telegram_id: number;
  telegram_username: string | null;
  name: string;
  address: string | null;
  city: string;
  description: string;
  founded_year: number | null;
  avatarUrl: string | null;
  rating: number;
  reviews_count: number;
  status: string;
  created_at: string;
}

interface EmployerVacancyApiRow {
  id: number;
  position_label: string;
  date: string;
  end_date: string | null;
  status: string;
  response_count: number;
}

export async function fetchEmployerDetail(id: string): Promise<EmployerDetail> {
  const { company, photos, vacancies, reviewsReceived, reviewsGiven } = await apiFetch<{
    company: EmployerDetailApiRow;
    photos: { id: number; url: string }[];
    vacancies: EmployerVacancyApiRow[];
    reviewsReceived: ReviewApiRow[];
    reviewsGiven: ReviewApiRow[];
  }>(`/admin/users/employers/${id}`);

  return {
    id: String(company.id),
    name: company.name,
    telegramId: company.owner_telegram_id,
    telegramUsername: company.telegram_username ?? undefined,
    address: company.address ?? undefined,
    city: company.city,
    description: company.description,
    foundedYear: company.founded_year ?? undefined,
    avatarUrl: resolveMediaUrl(company.avatarUrl),
    rating: company.rating,
    reviewsCount: company.reviews_count,
    status: company.status as UserStatus,
    createdAt: company.created_at,
    photos: photos.map((p): UserPhoto => ({ id: String(p.id), url: resolveMediaUrl(p.url)! })),
    vacancies: vacancies.map(
      (v): EmployerVacancy => ({
        id: String(v.id),
        positionLabel: v.position_label,
        date: v.date,
        endDate: v.end_date ?? undefined,
        status: v.status,
        responseCount: v.response_count,
      }),
    ),
    reviewsReceived: (reviewsReceived ?? []).map(fromApiReview),
    reviewsGiven: (reviewsGiven ?? []).map(fromApiReview),
  };
}

export async function updateSeeker(
  id: string,
  update: { name?: string; city?: string; bio?: string; skills?: string; birthdate?: string },
): Promise<void> {
  await apiFetch(`/admin/users/seekers/${id}`, { method: 'PATCH', body: update });
}

export async function updateEmployer(
  id: string,
  update: { name?: string; address?: string; city?: string; description?: string; foundedYear?: number },
): Promise<void> {
  await apiFetch(`/admin/users/employers/${id}`, { method: 'PATCH', body: update });
}

export async function toggleBlockSeeker(id: string): Promise<UserStatus> {
  const { status } = await apiFetch<{ status: UserStatus }>(`/admin/users/seekers/${id}/block`, { method: 'POST' });
  return status;
}

export async function toggleBlockEmployer(id: string): Promise<UserStatus> {
  const { status } = await apiFetch<{ status: UserStatus }>(`/admin/users/employers/${id}/block`, { method: 'POST' });
  return status;
}

export async function deleteSeeker(id: string): Promise<void> {
  await apiFetch(`/admin/users/seekers/${id}`, { method: 'DELETE' });
}

export async function deleteEmployer(id: string): Promise<void> {
  await apiFetch(`/admin/users/employers/${id}`, { method: 'DELETE' });
}

export async function switchSeekerToEmployer(id: string): Promise<void> {
  await apiFetch(`/admin/users/seekers/${id}/switch-role`, { method: 'POST' });
}

export async function switchEmployerToSeeker(id: string): Promise<void> {
  await apiFetch(`/admin/users/employers/${id}/switch-role`, { method: 'POST' });
}

export async function inviteTeamMember(name: string, telegramId: number, roleId: string): Promise<void> {
  await apiFetch('/admin/users/team/invite', { method: 'POST', body: { name, telegramId, roleId } });
}

export async function setTeamMemberRole(memberId: string, roleId: string): Promise<void> {
  await apiFetch(`/admin/users/team/${memberId}`, { method: 'PATCH', body: { roleId } });
}

export async function revokeTeamAccess(memberId: string): Promise<void> {
  await apiFetch(`/admin/users/team/${memberId}/revoke`, { method: 'POST' });
}

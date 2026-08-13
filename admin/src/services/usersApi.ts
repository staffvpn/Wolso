import { apiFetch } from '@/lib/apiClient';
import { minutesSince } from '@/lib/format';
import type { PlatformUser, TeamMember, UserStatus } from '@/types';

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
  name: string;
  city: string;
  rating: number;
  shifts_completed: number;
  status: string;
  created_at: string;
}

function fromApiSeeker(w: SeekerApiRow): PlatformUser {
  const suspended = w.status === 'suspended';
  return {
    id: String(w.id),
    kind: 'seeker',
    name: w.name,
    contact: `Telegram ID ${w.telegram_id}`,
    status: w.status as UserStatus,
    statusLabel: suspended ? 'Заблокирован' : 'Активен',
    createdMinAgo: minutesSince(w.created_at),
    city: w.city,
    rating: w.rating,
    shiftsCompleted: w.shifts_completed,
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
  name: string;
  city: string;
  status: string;
  created_at: string;
}

function fromApiEmployer(c: EmployerApiRow): PlatformUser {
  const suspended = c.status === 'suspended';
  return {
    id: String(c.id),
    kind: 'employer',
    name: c.name,
    contact: `Telegram ID ${c.owner_telegram_id}`,
    status: c.status as UserStatus,
    statusLabel: suspended ? 'Заблокирован' : 'Активен',
    createdMinAgo: minutesSince(c.created_at),
    city: c.city,
  };
}

export async function fetchEmployers(query?: string): Promise<PlatformUser[]> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : '';
  const { employers } = await apiFetch<{ employers: EmployerApiRow[] }>(`/admin/users/employers${qs}`);
  return employers.map(fromApiEmployer);
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

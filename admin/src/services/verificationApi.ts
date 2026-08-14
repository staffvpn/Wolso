import { apiFetch, resolveMediaUrl } from '@/lib/apiClient';
import type { EmployerVerification } from '@/types';

interface EmployerVerificationApiRow {
  id: number;
  name: string;
  inn: string | null;
  city: string;
  address: string | null;
  description: string;
  foundedYear: number | null;
  avatarUrl: string | null;
  telegramId: number;
  telegramUsername: string | null;
  status: string;
  rejectionReason: string | null;
  aiSummary: string | null;
  aiCheckedAt: string | null;
  createdAt: string;
}

function fromApi(e: EmployerVerificationApiRow): EmployerVerification {
  return {
    id: String(e.id),
    name: e.name || 'Без названия',
    inn: e.inn ?? undefined,
    city: e.city,
    address: e.address ?? undefined,
    description: e.description,
    foundedYear: e.foundedYear ?? undefined,
    avatarUrl: resolveMediaUrl(e.avatarUrl),
    telegramId: e.telegramId,
    telegramUsername: e.telegramUsername ?? undefined,
    status: e.status as EmployerVerification['status'],
    rejectionReason: e.rejectionReason ?? undefined,
    aiSummary: e.aiSummary ?? undefined,
    aiCheckedAt: e.aiCheckedAt ?? undefined,
    createdAt: e.createdAt,
  };
}

export async function fetchEmployerVerifications(status: 'pending' | 'approved' | 'rejected' = 'pending'): Promise<EmployerVerification[]> {
  const { employers } = await apiFetch<{ employers: EmployerVerificationApiRow[] }>(`/admin/verification/employers?status=${status}`);
  return employers.map(fromApi);
}

export async function approveEmployerVerification(id: string): Promise<void> {
  await apiFetch(`/admin/verification/employers/${id}/approve`, { method: 'POST' });
}

export async function rejectEmployerVerification(id: string, reason: string): Promise<void> {
  await apiFetch(`/admin/verification/employers/${id}/reject`, { method: 'POST', body: { reason } });
}

/** Manually re-runs the AI research pass — for when the automatic check
 *  (fired when the profile first became complete) failed, or the API key
 *  was only just configured. Returns the fresh summary directly since the
 *  route runs it synchronously. */
export async function recheckEmployerVerification(id: string): Promise<string> {
  const { aiSummary } = await apiFetch<{ aiSummary: string }>(`/admin/verification/employers/${id}/recheck`, { method: 'POST' });
  return aiSummary;
}

import { apiFetch } from '@/lib/apiClient';
import { minutesSince } from '@/lib/format';
import type { Complaint, ComplaintStatus } from '@/types';

interface ComplaintApiRow {
  id: number;
  author_kind: string;
  author_worker_name: string | null;
  author_company_name: string | null;
  target_kind: string;
  target_worker_id: number | null;
  target_company_id: number | null;
  target_worker_name: string | null;
  target_company_name: string | null;
  target_shift_position: string | null;
  target_shift_date: string | null;
  target_total: number;
  reason: string;
  comment: string;
  status: string;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export const COMPLAINT_REASON_LABEL: Record<string, string> = {
  no_show: 'Не вышел / не пустили',
  rude: 'Хамство, угрозы',
  misleading: 'Условия не как в объявлении',
  payment: 'Не заплатили',
  fake_profile: 'Фальшивая анкета',
  unsafe: 'Небезопасно',
  other: 'Другое',
};

export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  new: 'Новая',
  reviewing: 'Разбираем',
  resolved: 'Решена',
  rejected: 'Отклонена',
};

function fromApi(r: ComplaintApiRow): Complaint {
  return {
    id: String(r.id),
    authorName: r.author_worker_name ?? r.author_company_name ?? 'Аноним',
    authorKind: r.author_kind === 'company' ? 'employer' : 'seeker',
    targetKind: r.target_kind as Complaint['targetKind'],
    targetId: String(r.target_worker_id ?? r.target_company_id ?? ''),
    targetName:
      r.target_worker_name ??
      r.target_company_name ??
      (r.target_shift_position ? `Смена «${r.target_shift_position}»` : 'Удалённый объект'),
    targetShift: r.target_shift_position ? `${r.target_shift_position} · ${r.target_shift_date ?? ''}` : undefined,
    /** Сколько всего жалоб на этого же — одна жалоба и пятая по счёту
     *  требуют разного отношения, и это видно сразу в списке. */
    targetTotal: r.target_total ?? 1,
    reason: r.reason,
    reasonLabel: COMPLAINT_REASON_LABEL[r.reason] ?? r.reason,
    comment: r.comment ?? '',
    status: r.status as ComplaintStatus,
    resolution: r.resolution ?? undefined,
    resolvedBy: r.resolved_by ?? undefined,
    createdMinAgo: minutesSince(r.created_at),
  };
}

export async function fetchComplaints(status: ComplaintStatus | 'all'): Promise<{ complaints: Complaint[]; counts: Record<string, number> }> {
  const data = await apiFetch<{ complaints: ComplaintApiRow[]; counts: Record<string, number> }>(
    `/admin/complaints?status=${status}`,
  );
  return { complaints: data.complaints.map(fromApi), counts: data.counts ?? {} };
}

export async function resolveComplaint(id: string, status: ComplaintStatus, resolution?: string): Promise<void> {
  await apiFetch(`/admin/complaints/${id}`, { method: 'POST', body: { status, resolution } });
}

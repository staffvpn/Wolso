import { apiFetch } from '@/lib/apiClient';
import { minutesSince } from '@/lib/format';
import type { AuditLogEntry } from '@/types';

interface AuditApiRow {
  id: number;
  actor_name: string;
  actor_role_label: string | null;
  action: string;
  tone: string;
  created_at: string;
}

function fromApi(e: AuditApiRow): AuditLogEntry {
  return {
    id: String(e.id),
    actorName: e.actor_name,
    actorRoleLabel: e.actor_role_label ?? '',
    action: e.action,
    minutesAgo: minutesSince(e.created_at),
    tone: (e.tone as AuditLogEntry['tone']) ?? 'neutral',
  };
}

export async function fetchAuditLog(): Promise<AuditLogEntry[]> {
  const { entries } = await apiFetch<{ entries: AuditApiRow[] }>('/admin/audit-log');
  return entries.map(fromApi);
}

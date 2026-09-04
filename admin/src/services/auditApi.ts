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

export interface AuditFilters {
  /** Точное имя сотрудника, 'all' — без фильтра. */
  actor?: string;
  /** 'danger' — только разрушительное, 'all' — всё. */
  tone?: string;
  /** Подстрока в тексте действия: имя пользователя, название заведения. */
  q?: string;
}

/** Фильтруем на сервере, а не в браузере: экран показывает последние 100
 *  записей, и фильтр по уже загруженной сотне находил бы только то, что и
 *  так на виду, — а искать в журнале нужно как раз то, что уже уехало
 *  вниз. Список сотрудников приходит оттуда же, из самого журнала: человек
 *  мог уйти из команды, а его действия остались. */
export async function fetchAuditLog(filters: AuditFilters = {}): Promise<{ entries: AuditLogEntry[]; actors: string[] }> {
  const params = new URLSearchParams({ limit: '200' });
  if (filters.actor && filters.actor !== 'all') params.set('actor', filters.actor);
  if (filters.tone && filters.tone !== 'all') params.set('tone', filters.tone);
  if (filters.q?.trim()) params.set('q', filters.q.trim());

  const data = await apiFetch<{ entries: AuditApiRow[]; actors?: string[] }>(`/admin/audit-log?${params}`);
  return { entries: data.entries.map(fromApi), actors: data.actors ?? [] };
}

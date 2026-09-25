import { apiFetch } from '@/lib/apiClient';
import { minutesSince } from '@/lib/format';
import type { NotificationLogEntry } from '@/types';

interface NotificationApiRow {
  id: number;
  recipient_role: string;
  recipient_name: string;
  kind: string;
  text: string;
  created_at: string;
}

function fromApi(e: NotificationApiRow): NotificationLogEntry {
  return {
    id: String(e.id),
    recipientRole: e.recipient_role === 'company' ? 'company' : 'worker',
    recipientName: e.recipient_name,
    kind: e.kind,
    text: e.text,
    minutesAgo: minutesSince(e.created_at),
  };
}

export interface NotificationLogFilters {
  /** 'worker' | 'company' | 'all'. */
  role?: string;
  /** Точное совпадение вида (`employer_replies`, `signup_reminder`, …), 'all' — без фильтра. */
  kind?: string;
  /** Подстрока в имени получателя или в самом тексте сообщения. */
  q?: string;
}

/** Фильтруем на сервере — тот же приём, что и у audit-log: экран
 *  показывает последние 100-200 записей, а искать в журнале нужно как раз
 *  то, что уже уехало вниз. `migrationPending` значит, что 0046 ещё не
 *  применена — экран показывает это отдельно, а не пустой список молча. */
export async function fetchNotificationLog(
  filters: NotificationLogFilters = {},
): Promise<{ entries: NotificationLogEntry[]; kinds: string[]; migrationPending: boolean }> {
  const params = new URLSearchParams({ limit: '200' });
  if (filters.role && filters.role !== 'all') params.set('role', filters.role);
  if (filters.kind && filters.kind !== 'all') params.set('kind', filters.kind);
  if (filters.q?.trim()) params.set('q', filters.q.trim());

  const data = await apiFetch<{ entries: NotificationApiRow[]; kinds?: string[]; migrationPending?: boolean }>(
    `/admin/notification-log?${params}`,
  );
  return { entries: data.entries.map(fromApi), kinds: data.kinds ?? [], migrationPending: !!data.migrationPending };
}

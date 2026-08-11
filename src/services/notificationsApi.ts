import { apiFetch } from '@/lib/apiClient';
import type { AppNotification } from '@/types';
import { minutesSince } from '@/lib/format';

type Actor = 'worker' | 'company';

interface ApiNotification {
  id: number;
  kind: string;
  title: string;
  subtitle: string | null;
  read: number;
  created_at: string;
}

function fromApi(n: ApiNotification): AppNotification {
  return {
    id: String(n.id),
    kind: n.kind as AppNotification['kind'],
    title: n.title,
    subtitle: n.subtitle ?? '',
    minutesAgo: minutesSince(n.created_at),
    read: !!n.read,
  };
}

export async function fetchNotifications(as: Actor = 'worker'): Promise<AppNotification[]> {
  const { notifications } = await apiFetch<{ notifications: ApiNotification[] }>('/notifications', { as });
  return notifications.map(fromApi);
}

export async function markAllNotificationsRead(as: Actor = 'worker'): Promise<void> {
  await apiFetch('/notifications/read-all', { method: 'POST', as });
}

import { apiFetch } from '@/lib/apiClient';
import type { Broadcast, BroadcastAudience, BroadcastProgress } from '@/types';

interface BroadcastApiRow {
  id: number;
  text: string;
  audience: string;
  city: string | null;
  total: number;
  cursor: number;
  sent_count: number;
  failed_count: number;
  created_by: string;
  created_at: string;
}

function fromApi(b: BroadcastApiRow): Broadcast {
  return {
    id: String(b.id),
    text: b.text,
    audience: b.audience as BroadcastAudience,
    city: b.city ?? undefined,
    total: b.total,
    sent: b.sent_count,
    failed: b.failed_count,
    done: b.cursor >= b.total,
    createdBy: b.created_by,
    createdAt: b.created_at,
  };
}

export async function fetchAudienceCount(audience: BroadcastAudience, city?: string): Promise<number> {
  const params = new URLSearchParams({ audience });
  if (city) params.set('city', city);
  const { count } = await apiFetch<{ count: number }>(`/admin/broadcast/audience?${params}`);
  return count;
}

export async function fetchBroadcastCities(): Promise<{ city: string; n: number }[]> {
  const { cities } = await apiFetch<{ cities: { city: string; n: number }[] }>('/admin/broadcast/cities');
  return cities;
}

export async function fetchBroadcasts(): Promise<Broadcast[]> {
  const { broadcasts } = await apiFetch<{ broadcasts: BroadcastApiRow[] }>('/admin/broadcast');
  return broadcasts.map(fromApi);
}

/** Creates the broadcast and freezes its recipient list — nothing is sent
 *  until sendBatch runs. */
export async function createBroadcast(text: string, audience: BroadcastAudience, city?: string): Promise<{ id: string; total: number }> {
  const res = await apiFetch<{ id: number; total: number }>('/admin/broadcast', {
    method: 'POST',
    body: { text, audience, city },
  });
  return { id: String(res.id), total: res.total };
}

export async function sendBroadcastBatch(id: string): Promise<BroadcastProgress> {
  return apiFetch<BroadcastProgress>(`/admin/broadcast/${id}/send-batch`, { method: 'POST' });
}

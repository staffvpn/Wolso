import { apiFetch, apiUpload, resolveMediaUrl } from '@/lib/apiClient';
import type { Promo, PromoInput } from '@/types';

interface PromoApiRow {
  id: string;
  title: string;
  text: string;
  ctaLabel: string;
  url: string;
  kind: string;
  advertiser: string;
  erid: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  everyN: number;
  dailyCap: number;
  weight: number;
  impressions: number;
  clicks: number;
  createdAt: string;
  imageUrl: string | null;
}

function fromApi(p: PromoApiRow): Promo {
  return {
    id: p.id,
    title: p.title,
    text: p.text,
    ctaLabel: p.ctaLabel,
    url: p.url,
    kind: p.kind === 'site' ? 'site' : 'telegram',
    advertiser: p.advertiser,
    erid: p.erid,
    status: p.status === 'active' ? 'active' : 'paused',
    startsAt: p.startsAt ?? undefined,
    endsAt: p.endsAt ?? undefined,
    everyN: p.everyN,
    dailyCap: p.dailyCap,
    weight: p.weight,
    impressions: p.impressions,
    clicks: p.clicks,
    createdAt: p.createdAt,
    imageUrl: resolveMediaUrl(p.imageUrl),
  };
}

export async function fetchPromos(): Promise<Promo[]> {
  const { promos } = await apiFetch<{ promos: PromoApiRow[] }>('/admin/promos');
  return promos.map(fromApi);
}

export async function createPromo(input: PromoInput): Promise<string> {
  const { id } = await apiFetch<{ id: string }>('/admin/promos', { method: 'POST', body: input });
  return id;
}

export async function updatePromo(id: string, input: Partial<PromoInput> & { status?: 'active' | 'paused' }): Promise<void> {
  await apiFetch(`/admin/promos/${id}`, { method: 'PATCH', body: input });
}

export async function uploadPromoImage(id: string, file: File): Promise<void> {
  await apiUpload(`/admin/promos/${id}/image`, file);
}

export async function deletePromo(id: string): Promise<void> {
  await apiFetch(`/admin/promos/${id}`, { method: 'DELETE' });
}

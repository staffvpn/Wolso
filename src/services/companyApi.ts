import { apiFetch, resolveMediaUrl } from '@/lib/apiClient';
import type { Company } from '@/types';

export interface CompanyApiRow {
  id: number;
  name: string;
  address: string | null;
  city: string;
  logo_initial: string;
  logo_color: string;
  rating: number;
  reviews_count: number;
  description: string;
  founded_year: number | null;
  avatarUrl: string | null;
  profileComplete?: boolean;
  profileCompletion?: number;
  /** Only present on the owner's own `/employer/me` response — a company
   *  row embedded elsewhere (e.g. a worker's favorites) never carries
   *  this, since it's nobody else's business. */
  inn?: string | null;
  verificationStatus?: string;
  rejectionReason?: string | null;
  aiSummary?: string | null;
}

interface CompanyResponse {
  company: CompanyApiRow;
  photos: { id: number; url: string }[];
}

/** Exported so other stores embedding a raw company row (favorites) get
 *  the same avatarUrl resolution as the owner's own profile — the API
 *  sends a relative `/media/...` path, which needs the app's API origin
 *  prefixed onto it before it works as an <img src>. */
export function fromApiCompanyRow(c: CompanyApiRow): Company {
  return {
    id: String(c.id),
    name: c.name,
    address: c.address ?? '',
    city: c.city,
    logoInitial: c.logo_initial,
    logoColor: c.logo_color,
    rating: c.rating,
    reviewsCount: c.reviews_count,
    description: c.description ?? '',
    foundedYear: c.founded_year ?? undefined,
    avatarUrl: resolveMediaUrl(c.avatarUrl),
    profileComplete: c.profileComplete,
    profileCompletion: c.profileCompletion,
    inn: c.inn ?? undefined,
    verificationStatus: c.verificationStatus as Company['verificationStatus'],
    rejectionReason: c.rejectionReason ?? undefined,
    aiSummary: c.aiSummary ?? undefined,
  };
}

function fromApi(r: CompanyResponse): Company {
  return {
    ...fromApiCompanyRow(r.company),
    photos: r.photos.map((p) => ({ id: String(p.id), url: resolveMediaUrl(p.url)! })),
  };
}

export async function fetchMyCompany(): Promise<Company> {
  const data = await apiFetch<CompanyResponse>('/employer/me', { as: 'company' });
  return fromApi(data);
}

export interface CompanyUpdate {
  name?: string;
  address?: string;
  city?: string;
  description?: string;
  foundedYear?: number;
  inn?: string;
}

export async function updateMyCompany(update: CompanyUpdate): Promise<Company> {
  const data = await apiFetch<CompanyResponse>('/employer/me', { method: 'PATCH', body: update, as: 'company' });
  return fromApi(data);
}

export async function uploadCompanyAvatar(file: File): Promise<Company> {
  const body = await file.arrayBuffer();
  const data = await apiFetch<CompanyResponse>('/employer/me/avatar', {
    method: 'POST',
    body,
    raw: { contentType: file.type || 'application/octet-stream' },
    as: 'company',
  });
  return fromApi(data);
}

export async function uploadCompanyPhoto(file: File): Promise<Company> {
  const body = await file.arrayBuffer();
  const data = await apiFetch<CompanyResponse>('/employer/me/photos', {
    method: 'POST',
    body,
    raw: { contentType: file.type || 'application/octet-stream' },
    as: 'company',
  });
  return fromApi(data);
}

export async function deleteCompanyPhoto(id: string): Promise<Company> {
  const data = await apiFetch<CompanyResponse>(`/employer/me/photos/${id}`, { method: 'DELETE', as: 'company' });
  return fromApi(data);
}

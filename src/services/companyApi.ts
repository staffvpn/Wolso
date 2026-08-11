import { apiFetch } from '@/lib/apiClient';
import type { Company } from '@/types';

interface CompanyRow {
  id: number;
  name: string;
  address: string | null;
  city: string;
  logo_initial: string;
  logo_color: string;
  rating: number;
  reviews_count: number;
  verified: number;
  inn: string | null;
  verification_status: 'pending_review' | 'approved' | 'rejected';
}

function fromApi(c: CompanyRow): Company {
  return {
    id: String(c.id),
    name: c.name,
    address: c.address ?? '',
    logoInitial: c.logo_initial,
    logoColor: c.logo_color,
    rating: c.rating,
    reviewsCount: c.reviews_count,
    verified: !!c.verified,
    inn: c.inn ?? undefined,
    verificationStatus: c.verification_status,
  };
}

export async function fetchMyCompany(): Promise<Company> {
  const { company } = await apiFetch<{ company: CompanyRow }>('/employer/me', { as: 'company' });
  return fromApi(company);
}

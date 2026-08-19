import { apiFetch, resolveMediaUrl } from '@/lib/apiClient';
import type { Review } from '@/types';

interface ReviewApiResponse {
  id: number;
  rating: number;
  tags: string[];
  comment: string;
  createdAt: string | null;
  positionLabel: string;
  shiftDate: string;
  authorName: string;
  authorAvatarUrl: string | null;
}

function fromApi(r: ReviewApiResponse): Review {
  return {
    id: String(r.id),
    rating: r.rating,
    tags: r.tags ?? [],
    comment: r.comment ?? '',
    createdAt: r.createdAt ?? undefined,
    positionLabel: r.positionLabel,
    shiftDate: r.shiftDate,
    authorName: r.authorName,
    authorAvatarUrl: resolveMediaUrl(r.authorAvatarUrl),
  };
}

/** Reviews employers wrote about the signed-in worker. */
export async function fetchMyWorkerReviews(): Promise<Review[]> {
  const { reviews } = await apiFetch<{ reviews: ReviewApiResponse[] }>('/me/reviews');
  return reviews.map(fromApi);
}

/** Reviews workers wrote about the signed-in company. */
export async function fetchMyCompanyReviews(): Promise<Review[]> {
  const { reviews } = await apiFetch<{ reviews: ReviewApiResponse[] }>('/employer/reviews', { as: 'company' });
  return reviews.map(fromApi);
}

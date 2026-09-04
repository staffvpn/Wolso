import { apiFetch } from '@/lib/apiClient';

export interface FunnelStep {
  step: string;
  count: number;
}

export interface Funnel {
  days: number;
  workers: FunnelStep[];
  companies: FunnelStep[];
}

/** Где именно отваливаются люди. Считается по тем, кто зарегистрировался
 *  за выбранное окно, — иначе «дошли до смены» мерилось бы по людям,
 *  которые пришли год назад, и цифра ничего не говорила бы о том, что
 *  происходит сейчас. */
export async function fetchFunnel(days: number): Promise<Funnel> {
  return apiFetch<Funnel>(`/admin/dashboard/funnel?days=${days}`);
}

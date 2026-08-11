import { apiFetch } from '@/lib/apiClient';
import type { DashboardStats } from '@/types';

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>('/admin/dashboard');
}

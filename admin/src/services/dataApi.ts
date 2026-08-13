import { apiFetch } from '@/lib/apiClient';

export interface DataStats {
  workers: number;
  companies: number;
  shifts: number;
  applications: number;
  chats: number;
  messages: number;
  notifications: number;
  supportThreads: number;
  complaints: number;
  auditLog: number;
}

export async function fetchDataStats(): Promise<DataStats> {
  const { stats } = await apiFetch<{ stats: DataStats }>('/admin/data/stats');
  return stats;
}

export async function clearData(scope: string): Promise<void> {
  await apiFetch('/admin/data/clear', { method: 'POST', body: { scope } });
}

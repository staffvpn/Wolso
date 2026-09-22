import { apiFetch } from '@/lib/apiClient';

export interface Achievement {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  kind: 'auto' | 'manual';
  earned: boolean;
  earnedAt?: string;
  current?: number;
  target?: number;
}

export async function fetchAchievements(): Promise<{ achievements: Achievement[]; earnedCount: number; totalCount: number }> {
  return apiFetch<{ achievements: Achievement[]; earnedCount: number; totalCount: number }>('/achievements');
}

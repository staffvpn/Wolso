import { apiFetch } from '@/lib/apiClient';
import type { Achievement, AchievementConditionType, AchievementInput, WorkerAchievement } from '@/types';

interface AchievementApiRow {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  kind: string;
  conditionType: string | null;
  threshold: number | null;
  threshold2: number | null;
  status: string;
  sortOrder: number;
  createdAt: string;
  earnedCount: number;
}

function fromApi(a: AchievementApiRow): Achievement {
  return {
    id: a.id,
    key: a.key,
    title: a.title,
    description: a.description,
    icon: a.icon,
    kind: a.kind === 'manual' ? 'manual' : 'auto',
    conditionType: (a.conditionType as AchievementConditionType | null) ?? null,
    threshold: a.threshold,
    threshold2: a.threshold2,
    status: a.status === 'active' ? 'active' : 'paused',
    sortOrder: a.sortOrder,
    createdAt: a.createdAt,
    earnedCount: a.earnedCount,
  };
}

export async function fetchAchievements(): Promise<Achievement[]> {
  const { achievements } = await apiFetch<{ achievements: AchievementApiRow[] }>('/admin/achievements');
  return achievements.map(fromApi);
}

export async function createAchievement(input: AchievementInput): Promise<string> {
  const { id } = await apiFetch<{ id: string }>('/admin/achievements', { method: 'POST', body: input });
  return id;
}

export async function updateAchievement(
  id: string,
  input: Partial<AchievementInput> & { status?: 'active' | 'paused' },
): Promise<void> {
  await apiFetch(`/admin/achievements/${id}`, { method: 'PATCH', body: input });
}

export async function deleteAchievement(id: string): Promise<void> {
  await apiFetch(`/admin/achievements/${id}`, { method: 'DELETE' });
}

export async function recomputeAchievements(): Promise<{ checked: number; granted: number; remaining: number }> {
  return apiFetch('/admin/achievements/recompute', { method: 'POST' });
}

/** Достижения одного конкретного соискателя — для карточки пользователя. */
export async function fetchWorkerAchievements(workerId: string): Promise<WorkerAchievement[]> {
  const { achievements } = await apiFetch<{ achievements: WorkerAchievement[] }>(`/admin/users/seekers/${workerId}/achievements`);
  return achievements;
}

export async function grantAchievement(workerId: string, achievementId: string, note?: string): Promise<void> {
  await apiFetch(`/admin/users/seekers/${workerId}/achievements`, { method: 'POST', body: { achievementId, note } });
}

export async function revokeAchievement(workerId: string, achievementId: string): Promise<void> {
  await apiFetch(`/admin/users/seekers/${workerId}/achievements/${achievementId}`, { method: 'DELETE' });
}

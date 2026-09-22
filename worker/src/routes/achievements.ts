import { Hono } from 'hono';
import type { Env } from '../types';
import { attachSession, requireWorker } from '../middleware/auth';
import { achievementsTableExists, buildAchievementsList } from '../lib/achievements';

export const achievementRoutes = new Hono<{ Bindings: Env; Variables: { session: unknown } }>();
achievementRoutes.use('*', attachSession);

/** Только соискатели: у работодателей своей ленты бейджей нет — см.
 *  обсуждение при подтверждении списка. */
achievementRoutes.get('/', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  if (!(await achievementsTableExists(c.env))) return c.json({ error: 'migration_required' }, 400);

  const achievements = await buildAchievementsList(c.env, session.workerId);
  return c.json({ achievements, earnedCount: achievements.filter((a) => a.earned).length, totalCount: achievements.length });
});

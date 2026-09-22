import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, actorLabel, logAction, requirePermission, requireStaff } from '../middleware/auth';
import { achievementsTableExists, recomputeAchievementsBatch } from '../lib/achievements';

export const adminAchievementRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminAchievementRoutes.use('*', attachSession);

/** Тот же приём, что у промо: миграция применяется руками, поэтому её
 *  отсутствие называем словами вместо голого internal_error. */
async function requireTable(c: { env: Env; json: (b: unknown, s?: 400) => Response }) {
  if (await achievementsTableExists(c.env)) return null;
  return c.json({ error: 'migration_required', migration: '0040_achievements' }, 400);
}

interface AchievementAdminRow {
  id: number;
  key: string;
  title: string;
  description: string;
  icon: string;
  kind: string;
  condition_type: string | null;
  threshold: number | null;
  threshold2: number | null;
  status: string;
  sort_order: number;
  created_at: string;
  earned_count: number;
}

function toJson(r: AchievementAdminRow) {
  return {
    id: String(r.id),
    key: r.key,
    title: r.title,
    description: r.description,
    icon: r.icon,
    kind: r.kind,
    conditionType: r.condition_type,
    threshold: r.threshold,
    threshold2: r.threshold2,
    status: r.status,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    earnedCount: r.earned_count,
  };
}

adminAchievementRoutes.get('/', requirePermission('manageAchievements'), async (c) => {
  const missing = await requireTable(c as never);
  if (missing) return missing;

  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.key, a.title, a.description, a.icon, a.kind, a.condition_type, a.threshold, a.threshold2,
            a.status, a.sort_order, a.created_at,
            (SELECT COUNT(*) FROM worker_achievements wa WHERE wa.achievement_id = a.id) AS earned_count
     FROM achievements a ORDER BY a.sort_order ASC, a.id ASC`,
  ).all<AchievementAdminRow>();
  return c.json({ achievements: results.map(toJson) });
});

interface AchievementInput {
  title?: string;
  description?: string;
  icon?: string;
  kind?: string;
  conditionType?: string | null;
  threshold?: number | null;
  threshold2?: number | null;
  status?: string;
  sortOrder?: number;
}

const CONDITION_TYPES = [
  'first_response',
  'shifts_completed',
  'own_photo',
  'profile_complete',
  'active_week',
  'distinct_positions',
  'top_performer',
  'no_cancel_streak',
  'fast_response',
  'tenure_months',
  'reviews_given',
];

adminAchievementRoutes.post('/', requirePermission('manageAchievements'), async (c) => {
  const missing = await requireTable(c as never);
  if (missing) return missing;
  const session = requireStaff(c as never)!;

  const body = await c.req.json<AchievementInput>();
  const title = (body.title ?? '').trim();
  if (!title) return c.json({ error: 'title_required' }, 400);

  const kind = body.kind === 'manual' ? 'manual' : 'auto';
  const conditionType = kind === 'manual' ? null : CONDITION_TYPES.includes(body.conditionType ?? '') ? body.conditionType : null;
  if (kind === 'auto' && !conditionType) return c.json({ error: 'condition_required' }, 400);

  // Ключ — из заголовка, слаг: для ручных бейджей ни на что не влияет
  // (условия нет), для авто держит записи в worker_achievements
  // читаемыми в базе напрямую, без JOIN на achievements.
  const key = `${title.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '_').replace(/^_+|_+$/g, '')}_${Date.now().toString(36)}`;

  const inserted = await c.env.DB.prepare(
    `INSERT INTO achievements (key, title, description, icon, kind, condition_type, threshold, threshold2, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paused', ?) RETURNING id`,
  )
    .bind(
      key,
      title,
      (body.description ?? '').trim(),
      (body.icon ?? '').trim() || 'Award',
      kind,
      conditionType,
      body.threshold ?? null,
      body.threshold2 ?? null,
      Math.round(body.sortOrder ?? 500),
    )
    .first<{ id: number }>();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `создала достижение «${title}»`, 'accent');
  return c.json({ ok: true, id: String(inserted?.id) });
});

adminAchievementRoutes.patch('/:id', requirePermission('manageAchievements'), async (c) => {
  const missing = await requireTable(c as never);
  if (missing) return missing;
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');

  const existing = await c.env.DB.prepare('SELECT title FROM achievements WHERE id = ?').bind(id).first<{ title: string }>();
  if (!existing) return c.json({ error: 'not_found' }, 404);

  const body = await c.req.json<AchievementInput>();
  const fields: string[] = [];
  const binds: unknown[] = [];

  const text = (key: keyof AchievementInput, column: string) => {
    const value = body[key];
    if (typeof value === 'string') {
      fields.push(`${column} = ?`);
      binds.push(value.trim());
    }
  };
  text('title', 'title');
  text('description', 'description');
  text('icon', 'icon');

  if (body.conditionType !== undefined) {
    fields.push('condition_type = ?');
    binds.push(body.conditionType && CONDITION_TYPES.includes(body.conditionType) ? body.conditionType : null);
  }
  for (const [key, column] of [['threshold', 'threshold'], ['threshold2', 'threshold2']] as const) {
    if (body[key] !== undefined) {
      fields.push(`${column} = ?`);
      binds.push(body[key]);
    }
  }
  if (body.status === 'active' || body.status === 'paused') {
    fields.push('status = ?');
    binds.push(body.status);
  }
  if (typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
    fields.push('sort_order = ?');
    binds.push(Math.round(body.sortOrder));
  }

  if (fields.length) {
    binds.push(id);
    await c.env.DB.prepare(`UPDATE achievements SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
  }

  if (body.status) {
    const actor = await actorLabel(c.env, session);
    await logAction(
      c.env,
      actor,
      body.status === 'active' ? `включила достижение «${existing.title}»` : `приостановила достижение «${existing.title}»`,
    );
  }
  return c.json({ ok: true });
});

adminAchievementRoutes.delete('/:id', requirePermission('manageAchievements'), async (c) => {
  const missing = await requireTable(c as never);
  if (missing) return missing;
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');

  const existing = await c.env.DB.prepare('SELECT title FROM achievements WHERE id = ?').bind(id).first<{ title: string }>();
  if (!existing) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare('DELETE FROM achievements WHERE id = ?').bind(id).run();
  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `удалила достижение «${existing.title}»`, 'danger');
  return c.json({ ok: true });
});

/** Батч на 60 соискателей за вызов — дашборд жмёт эту ручку в цикле,
 *  пока remaining не станет нулём, тем же способом, что «Проверить
 *  бота» и «Обновить username». */
adminAchievementRoutes.post('/recompute', requirePermission('manageAchievements'), async (c) => {
  const missing = await requireTable(c as never);
  if (missing) return missing;

  const result = await recomputeAchievementsBatch(c.env, 60);
  return c.json(result);
});

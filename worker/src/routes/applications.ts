import { Hono } from 'hono';
import type { Env } from '../types';
import { attachSession, requireWorker } from '../middleware/auth';
import { SHIFT_SELECT, shiftToJson, type ShiftRow } from '../lib/db';

export const applicationRoutes = new Hono<{ Bindings: Env; Variables: { session: unknown } }>();
applicationRoutes.use('*', attachSession);

interface AppRow {
  id: number;
  shift_id: number;
  worker_id: number;
  status: string;
  work_stage: string;
  check_in_at: string | null;
  check_out_at: string | null;
  rating: number | null;
  review_tags: string | null;
  review_comment: string | null;
  created_at: string;
}

function appToJson(a: AppRow, shift?: ReturnType<typeof shiftToJson>) {
  return {
    id: a.id,
    shiftId: a.shift_id,
    status: a.status,
    workStage: a.work_stage,
    checkInAt: a.check_in_at,
    checkOutAt: a.check_out_at,
    rating: a.rating,
    reviewTags: a.review_tags ? JSON.parse(a.review_tags) : [],
    reviewComment: a.review_comment,
    createdAt: a.created_at,
    shift,
  };
}

applicationRoutes.get('/', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const { results } = await c.env.DB.prepare('SELECT * FROM applications WHERE worker_id = ? ORDER BY created_at DESC')
    .bind(session.workerId)
    .all<AppRow>();

  const out = [];
  for (const a of results) {
    const shiftRow = await c.env.DB.prepare(`${SHIFT_SELECT} WHERE s.id = ?`).bind(a.shift_id).first<ShiftRow>();
    out.push(appToJson(a, shiftRow ? shiftToJson(shiftRow) : undefined));
  }
  return c.json({ applications: out });
});

applicationRoutes.post('/', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const { shiftId } = await c.req.json<{ shiftId: number }>();

  const shift = await c.env.DB.prepare("SELECT id, company_id FROM shifts WHERE id = ? AND status = 'active'")
    .bind(shiftId)
    .first<{ id: number; company_id: number }>();
  if (!shift) return c.json({ error: 'shift_not_found' }, 404);

  const existing = await c.env.DB.prepare('SELECT id FROM applications WHERE shift_id = ? AND worker_id = ?')
    .bind(shiftId, session.workerId)
    .first();
  if (existing) return c.json({ error: 'already_applied' }, 409);

  const inserted = await c.env.DB.prepare(
    "INSERT INTO applications (shift_id, worker_id, status, work_stage) VALUES (?, ?, 'pending', 'upcoming') RETURNING *",
  )
    .bind(shiftId, session.workerId)
    .first<AppRow>();

  const worker = await c.env.DB.prepare('SELECT name FROM workers WHERE id = ?').bind(session.workerId).first<{ name: string }>();
  await c.env.DB.prepare('INSERT INTO notifications (company_id, kind, title, subtitle) VALUES (?, ?, ?, ?)')
    .bind(shift.company_id, 'new_response', 'Новый отклик на смену', worker?.name ?? 'Соискатель откликнулся')
    .run();

  return c.json({ application: appToJson(inserted!) });
});

async function ownedApplication(env: Env, id: string, workerId: number) {
  return env.DB.prepare('SELECT * FROM applications WHERE id = ? AND worker_id = ?').bind(id, workerId).first<AppRow>();
}

applicationRoutes.post('/:id/check-in', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const app = await ownedApplication(c.env, c.req.param('id'), session.workerId);
  if (!app) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare("UPDATE applications SET work_stage = 'checked_in', check_in_at = datetime('now') WHERE id = ?")
    .bind(app.id)
    .run();
  return c.json({ ok: true });
});

applicationRoutes.post('/:id/check-out', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const app = await ownedApplication(c.env, c.req.param('id'), session.workerId);
  if (!app) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare("UPDATE applications SET work_stage = 'completed', check_out_at = datetime('now') WHERE id = ?")
    .bind(app.id)
    .run();
  return c.json({ ok: true });
});

applicationRoutes.post('/:id/review', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const app = await ownedApplication(c.env, c.req.param('id'), session.workerId);
  if (!app) return c.json({ error: 'not_found' }, 404);

  const { rating, tags, comment } = await c.req.json<{ rating: number; tags: string[]; comment: string }>();
  await c.env.DB.prepare(
    "UPDATE applications SET work_stage = 'reviewed', rating = ?, review_tags = ?, review_comment = ? WHERE id = ?",
  )
    .bind(rating, JSON.stringify(tags ?? []), comment ?? '', app.id)
    .run();

  await c.env.DB.prepare('UPDATE workers SET shifts_completed = shifts_completed + 1 WHERE id = ?').bind(session.workerId).run();

  return c.json({ ok: true });
});

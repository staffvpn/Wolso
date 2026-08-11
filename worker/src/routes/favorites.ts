import { Hono } from 'hono';
import type { Env } from '../types';
import { attachSession, requireWorker } from '../middleware/auth';
import { SHIFT_SELECT, shiftToJson, type ShiftRow } from '../lib/db';

export const favoriteRoutes = new Hono<{ Bindings: Env; Variables: { session: unknown } }>();
favoriteRoutes.use('*', attachSession);

favoriteRoutes.get('/', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const { results: shiftIds } = await c.env.DB.prepare('SELECT shift_id FROM favorite_shifts WHERE worker_id = ?')
    .bind(session.workerId)
    .all<{ shift_id: number }>();
  const shifts = [];
  for (const { shift_id } of shiftIds) {
    const row = await c.env.DB.prepare(`${SHIFT_SELECT} WHERE s.id = ?`).bind(shift_id).first<ShiftRow>();
    if (row) shifts.push(shiftToJson(row));
  }

  const { results: companies } = await c.env.DB.prepare(
    `SELECT c.* FROM favorite_companies f JOIN companies c ON c.id = f.company_id WHERE f.worker_id = ?`,
  )
    .bind(session.workerId)
    .all();

  return c.json({ shifts, companies });
});

favoriteRoutes.post('/shifts/:shiftId', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const shiftId = c.req.param('shiftId');

  const existing = await c.env.DB.prepare('SELECT 1 FROM favorite_shifts WHERE worker_id = ? AND shift_id = ?')
    .bind(session.workerId, shiftId)
    .first();
  if (existing) {
    await c.env.DB.prepare('DELETE FROM favorite_shifts WHERE worker_id = ? AND shift_id = ?').bind(session.workerId, shiftId).run();
    return c.json({ favorited: false });
  }
  await c.env.DB.prepare('INSERT INTO favorite_shifts (worker_id, shift_id) VALUES (?, ?)').bind(session.workerId, shiftId).run();
  return c.json({ favorited: true });
});

favoriteRoutes.post('/companies/:companyId', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const companyId = c.req.param('companyId');

  const existing = await c.env.DB.prepare('SELECT 1 FROM favorite_companies WHERE worker_id = ? AND company_id = ?')
    .bind(session.workerId, companyId)
    .first();
  if (existing) {
    await c.env.DB.prepare('DELETE FROM favorite_companies WHERE worker_id = ? AND company_id = ?')
      .bind(session.workerId, companyId)
      .run();
    return c.json({ favorited: false });
  }
  await c.env.DB.prepare('INSERT INTO favorite_companies (worker_id, company_id) VALUES (?, ?)')
    .bind(session.workerId, companyId)
    .run();
  return c.json({ favorited: true });
});

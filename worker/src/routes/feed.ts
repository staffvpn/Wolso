import { Hono } from 'hono';
import type { Env } from '../types';
import { attachSession, requireWorker } from '../middleware/auth';
import { SHIFT_SELECT, shiftToJson, type ShiftRow } from '../lib/db';

export const feedRoutes = new Hono<{ Bindings: Env; Variables: { session: unknown } }>();
feedRoutes.use('*', attachSession);

/** GET /shifts — the swipe feed, filtered server-side so the client never
 *  has to fetch more than what it can show. */
feedRoutes.get('/', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const q = c.req.query();
  const positions = q.positions ? q.positions.split(',').filter(Boolean) : [];
  const rateFrom = q.rateFrom ? Number(q.rateFrom) : undefined;
  const radiusKm = q.radiusKm && q.radiusKm !== 'city' ? Number(q.radiusKm) : undefined;
  const urgentOnly = q.urgentOnly === 'true';
  const employmentType = q.employmentType || undefined;
  const when = q.when || 'today';
  const timeOfDay = q.timeOfDay ? q.timeOfDay.split(',').filter(Boolean) : [];

  const clauses = ["s.status = 'active'"];
  const binds: unknown[] = [];

  if (positions.length) {
    clauses.push(`s.position IN (${positions.map(() => '?').join(',')})`);
    binds.push(...positions);
  }
  if (rateFrom) {
    clauses.push('s.hourly_rate >= ?');
    binds.push(rateFrom);
  }
  if (urgentOnly) clauses.push("s.urgency = 'urgent'");
  if (employmentType) {
    clauses.push('s.employment_type = ?');
    binds.push(employmentType);
  }
  if (timeOfDay.length) {
    clauses.push(`s.time_of_day IN (${timeOfDay.map(() => '?').join(',')})`);
    binds.push(...timeOfDay);
  }
  if (when !== 'custom') {
    const target = new Date();
    if (when === 'tomorrow') target.setDate(target.getDate() + 1);
    clauses.push('s.date = ?');
    binds.push(target.toISOString().slice(0, 10));
  }

  // Applicant's own shifts already applied to shouldn't show again.
  clauses.push('s.id NOT IN (SELECT shift_id FROM applications WHERE worker_id = ?)');
  binds.push(session.kind === 'worker' ? session.workerId : -1);

  // radiusKm is accepted but not yet applied — there's no lat/lng captured
  // client-side to filter against. Wire it up once Telegram's location
  // API (or manual city/address geocoding) is in.
  void radiusKm;

  const sql = `${SHIFT_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY s.created_at DESC LIMIT 100`;
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all<ShiftRow>();

  return c.json({ shifts: results.map(shiftToJson) });
});

feedRoutes.get('/:id', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const row = await c.env.DB.prepare(`${SHIFT_SELECT} WHERE s.id = ?`).bind(c.req.param('id')).first<ShiftRow>();
  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json({ shift: shiftToJson(row) });
});

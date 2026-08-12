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

  const { results: companyRows } = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.address, c.city, c.logo_initial, c.logo_color, c.rating, c.reviews_count,
            c.description, c.founded_year, (c.avatar_data IS NOT NULL) as has_avatar
     FROM favorite_companies f JOIN companies c ON c.id = f.company_id WHERE f.worker_id = ?`,
  )
    .bind(session.workerId)
    .all<{
      id: number; name: string; address: string | null; city: string; logo_initial: string; logo_color: string;
      rating: number; reviews_count: number; description: string; founded_year: number | null; has_avatar: number;
    }>();

  // Shaped like companyApi.ts's CompanyApiRow (mixed snake/camel case, same
  // as loadCompanyProfile) so the client can run it through the same
  // fromApiCompanyRow transform instead of trusting a raw row shape.
  const companies = companyRows.map((c) => ({
    id: c.id,
    name: c.name,
    address: c.address,
    city: c.city,
    logo_initial: c.logo_initial,
    logo_color: c.logo_color,
    rating: c.rating,
    reviews_count: c.reviews_count,
    description: c.description,
    founded_year: c.founded_year,
    avatarUrl: c.has_avatar ? `/media/companies/${c.id}/avatar` : null,
  }));

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

import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession } from '../middleware/auth';

export const notificationRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
notificationRoutes.use('*', attachSession);

notificationRoutes.get('/', async (c) => {
  const session = c.get('session');
  if (!session || (session.kind !== 'worker' && session.kind !== 'company')) return c.json({ error: 'auth_required' }, 401);

  const col = session.kind === 'worker' ? 'worker_id' : 'company_id';
  const id = session.kind === 'worker' ? session.workerId : session.companyId;
  const { results } = await c.env.DB.prepare(`SELECT * FROM notifications WHERE ${col} = ? ORDER BY created_at DESC LIMIT 50`)
    .bind(id)
    .all();
  return c.json({ notifications: results });
});

notificationRoutes.post('/read-all', async (c) => {
  const session = c.get('session');
  if (!session || (session.kind !== 'worker' && session.kind !== 'company')) return c.json({ error: 'auth_required' }, 401);

  const col = session.kind === 'worker' ? 'worker_id' : 'company_id';
  const id = session.kind === 'worker' ? session.workerId : session.companyId;
  await c.env.DB.prepare(`UPDATE notifications SET read = 1 WHERE ${col} = ?`).bind(id).run();
  return c.json({ ok: true });
});

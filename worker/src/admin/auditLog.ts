import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, requireStaffMiddleware } from '../middleware/auth';

export const adminAuditLogRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminAuditLogRoutes.use('*', attachSession);

adminAuditLogRoutes.get('/', requireStaffMiddleware, async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? '100'), 500);
  const { results } = await c.env.DB.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').bind(limit).all();
  return c.json({ entries: results });
});

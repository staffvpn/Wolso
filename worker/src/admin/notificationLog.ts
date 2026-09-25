import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, requireStaffMiddleware } from '../middleware/auth';
import { notificationLogTableExists } from '../lib/notificationLog';

export const adminNotificationLogRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminNotificationLogRoutes.use('*', attachSession);

/** Same shape as /admin/audit-log — `role` narrows worker vs company,
 *  `kind` is the notification pref/reminder it came from, `q` searches
 *  both the recipient's name and the message text itself (the text is
 *  what actually distinguishes, say, an invite from a decline — both
 *  share the `employer_replies` kind). */
adminNotificationLogRoutes.get('/', requireStaffMiddleware, async (c) => {
  if (!(await notificationLogTableExists(c.env))) {
    return c.json({ entries: [], kinds: [], migrationPending: true });
  }

  const limit = Math.min(Number(c.req.query('limit') ?? '100'), 500);
  const role = c.req.query('role');
  const kind = c.req.query('kind');
  const q = c.req.query('q');

  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (role && role !== 'all') {
    clauses.push('recipient_role = ?');
    binds.push(role);
  }
  if (kind && kind !== 'all') {
    clauses.push('kind = ?');
    binds.push(kind);
  }
  if (q?.trim()) {
    clauses.push('(recipient_name LIKE ? OR text LIKE ?)');
    binds.push(`%${q.trim()}%`, `%${q.trim()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const { results } = await c.env.DB.prepare(`SELECT * FROM notification_log ${where} ORDER BY created_at DESC LIMIT ?`)
    .bind(...binds, limit)
    .all();

  // Список видов для выпадашки — из самого журнала, чтобы в фильтре не
  // было видов, которых там сроду не было (или наоборот, не было нового,
  // который ещё не попал сюда руками).
  const { results: kinds } = await c.env.DB.prepare('SELECT kind, COUNT(*) as n FROM notification_log GROUP BY kind ORDER BY n DESC').all<{
    kind: string;
    n: number;
  }>();

  return c.json({ entries: results, kinds: kinds.map((k) => k.kind) });
});

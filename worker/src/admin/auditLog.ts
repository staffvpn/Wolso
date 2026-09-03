import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, requireStaffMiddleware } from '../middleware/auth';

export const adminAuditLogRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminAuditLogRoutes.use('*', attachSession);

/** Фильтры: раньше это была сплошная лента, в которой «кто заблокировал
 *  этого человека и когда» искали глазами. `actor` — точное совпадение по
 *  сотруднику, `q` — подстрока в тексте действия (имя пользователя,
 *  название заведения), `tone` — отделить разрушительное от рутины. */
adminAuditLogRoutes.get('/', requireStaffMiddleware, async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? '100'), 500);
  const actor = c.req.query('actor');
  const tone = c.req.query('tone');
  const q = c.req.query('q');

  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (actor && actor !== 'all') {
    clauses.push('actor_name = ?');
    binds.push(actor);
  }
  if (tone && tone !== 'all') {
    clauses.push('tone = ?');
    binds.push(tone);
  }
  if (q?.trim()) {
    clauses.push('action LIKE ?');
    binds.push(`%${q.trim()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const { results } = await c.env.DB.prepare(`SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ?`)
    .bind(...binds, limit)
    .all();

  // Список сотрудников для выпадашки — из самого лога, а не из staff:
  // человек мог уйти из команды, а его действия остаются и их надо уметь
  // отфильтровать.
  const { results: actors } = await c.env.DB.prepare(
    'SELECT actor_name, COUNT(*) as n FROM audit_log GROUP BY actor_name ORDER BY n DESC LIMIT 50',
  ).all<{ actor_name: string; n: number }>();

  return c.json({ entries: results, actors: actors.map((a) => a.actor_name) });
});

import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, requirePermission, requireStaff } from '../middleware/auth';

export const adminSupportRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminSupportRoutes.use('*', attachSession);

interface ThreadRow {
  id: number;
  worker_id: number | null;
  company_id: number | null;
  created_at: string;
  contact_name?: string;
}

adminSupportRoutes.get('/threads', requirePermission('viewSupportChats'), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, COALESCE(w.name, co.name) as contact_name
     FROM support_threads t
     LEFT JOIN workers w ON w.id = t.worker_id
     LEFT JOIN companies co ON co.id = t.company_id
     ORDER BY t.created_at DESC`,
  ).all<ThreadRow>();

  const threads = [];
  for (const row of results) {
    const last = await c.env.DB.prepare('SELECT text, sender, created_at FROM support_messages WHERE thread_id = ? ORDER BY created_at DESC LIMIT 1')
      .bind(row.id)
      .first<{ text: string; sender: string; created_at: string }>();
    const unread = await c.env.DB.prepare("SELECT COUNT(*) as n FROM support_messages WHERE thread_id = ? AND read = 0 AND sender = 'user'")
      .bind(row.id)
      .first<{ n: number }>();
    threads.push({
      id: row.id,
      kind: row.worker_id ? 'worker' : 'employer',
      contactName: row.contact_name ?? 'Пользователь',
      lastMessage: last,
      unread: unread?.n ?? 0,
    });
  }
  return c.json({ threads });
});

adminSupportRoutes.get('/threads/:id/messages', requirePermission('viewSupportChats'), async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare('SELECT * FROM support_messages WHERE thread_id = ? ORDER BY created_at ASC').bind(id).all();
  await c.env.DB.prepare("UPDATE support_messages SET read = 1 WHERE thread_id = ? AND sender = 'user'").bind(id).run();
  return c.json({ messages: results });
});

adminSupportRoutes.post('/threads/:id/messages', requirePermission('viewSupportChats'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const { text } = await c.req.json<{ text: string }>();
  if (!text?.trim()) return c.json({ error: 'empty_message' }, 400);

  const staff = await c.env.DB.prepare('SELECT name FROM staff WHERE id = ?').bind(session.staffId).first<{ name: string }>();

  const inserted = await c.env.DB.prepare(
    "INSERT INTO support_messages (thread_id, sender, staff_name, text) VALUES (?, 'staff', ?, ?) RETURNING *",
  )
    .bind(id, staff?.name ?? 'Wolso', text.trim())
    .first();

  return c.json({ message: inserted });
});

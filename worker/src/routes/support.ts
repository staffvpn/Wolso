import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession } from '../middleware/auth';
import { notifyAdmin } from '../lib/adminNotify';

export const supportRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
supportRoutes.use('*', attachSession);

function actorFromSession(session: SessionPayload | null) {
  if (session?.kind === 'worker') return { col: 'worker_id' as const, id: session.workerId };
  if (session?.kind === 'company') return { col: 'company_id' as const, id: session.companyId };
  return null;
}

async function getOrCreateThread(env: Env, actor: { col: 'worker_id' | 'company_id'; id: number }): Promise<number> {
  const existing = await env.DB.prepare(`SELECT id FROM support_threads WHERE ${actor.col} = ?`).bind(actor.id).first<{ id: number }>();
  if (existing) return existing.id;
  const inserted = await env.DB.prepare(`INSERT INTO support_threads (${actor.col}) VALUES (?) RETURNING id`).bind(actor.id).first<{
    id: number;
  }>();
  return inserted!.id;
}

/** The caller's own support thread + its messages — creates the thread
 *  lazily so there's nothing to provision at onboarding. */
supportRoutes.get('/thread', async (c) => {
  const actor = actorFromSession(c.get('session'));
  if (!actor) return c.json({ error: 'auth_required' }, 401);

  const threadId = await getOrCreateThread(c.env, actor);
  const { results } = await c.env.DB.prepare('SELECT * FROM support_messages WHERE thread_id = ? ORDER BY created_at ASC')
    .bind(threadId)
    .all();
  await c.env.DB.prepare("UPDATE support_messages SET read = 1 WHERE thread_id = ? AND sender = 'staff'").bind(threadId).run();

  return c.json({ threadId, messages: results });
});

supportRoutes.post('/messages', async (c) => {
  const actor = actorFromSession(c.get('session'));
  if (!actor) return c.json({ error: 'auth_required' }, 401);

  const { text } = await c.req.json<{ text: string }>();
  if (!text?.trim()) return c.json({ error: 'empty_message' }, 400);

  const threadId = await getOrCreateThread(c.env, actor);
  const inserted = await c.env.DB.prepare("INSERT INTO support_messages (thread_id, sender, text) VALUES (?, 'user', ?) RETURNING *")
    .bind(threadId, text.trim())
    .first();

  // Only the first unanswered message pings — a person typing three lines
  // in a row shouldn't be three separate alerts, and once staff have
  // replied the thread is already being watched.
  const priorCount = await c.env.DB.prepare('SELECT COUNT(*) as n FROM support_messages WHERE thread_id = ? AND id != ?')
    .bind(threadId, (inserted as { id: number }).id)
    .first<{ n: number }>();
  if ((priorCount?.n ?? 0) === 0) {
    const who =
      actor.col === 'worker_id'
        ? await c.env.DB.prepare('SELECT name FROM workers WHERE id = ?').bind(actor.id).first<{ name: string }>()
        : await c.env.DB.prepare('SELECT name FROM companies WHERE id = ?').bind(actor.id).first<{ name: string }>();
    const role = actor.col === 'worker_id' ? 'соискатель' : 'работодатель';
    c.executionCtx.waitUntil(
      notifyAdmin(c.env, `🛟 Новое обращение в поддержку\n${who?.name || 'Без имени'} (${role})\n\n${text.trim().slice(0, 300)}`),
    );
  }

  return c.json({ message: inserted });
});

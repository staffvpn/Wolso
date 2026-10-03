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

/** The caller's own support thread + its messages, либо только то, что
 *  появилось после сообщения `after`. Экран опрашивает эту ручку раз в 4
 *  секунды, пока открыт (см. src/screens/shared/Support.tsx) — без курсора
 *  это гоняло бы всю историю переписки заново на каждый тик, тот же класс
 *  перерасхода лимита D1 на чтения, что чинили в основном чате. Создаёт
 *  тред лениво, так что при онбординге провижинить нечего. */
supportRoutes.get('/thread', async (c) => {
  const actor = actorFromSession(c.get('session'));
  if (!actor) return c.json({ error: 'auth_required' }, 401);

  const threadId = await getOrCreateThread(c.env, actor);

  const afterParam = c.req.query('after');
  const after = afterParam && /^\d+$/.test(afterParam) ? Number(afterParam) : null;

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM support_messages WHERE thread_id = ?${after === null ? '' : ' AND id > ?'} ORDER BY id ASC`,
  )
    .bind(...(after === null ? [threadId] : [threadId, after]))
    .all();

  // Как и в основном чате — пишем в базу только когда есть что отмечать,
  // а не на каждый пустой тик опроса.
  if (after === null || results.length > 0) {
    await c.env.DB.prepare("UPDATE support_messages SET read = 1 WHERE thread_id = ? AND sender = 'staff' AND read = 0")
      .bind(threadId)
      .run();
  }

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

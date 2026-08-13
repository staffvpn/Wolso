import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession } from '../middleware/auth';
import { sendTelegramMessage } from '../lib/telegramBot';

export const chatRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
chatRoutes.use('*', attachSession);

interface ChatRow {
  id: number;
  company_id: number;
  worker_id: number;
  shift_id: number | null;
  created_at: string;
  company_name?: string;
  company_logo_initial?: string;
  company_logo_color?: string;
  company_has_avatar?: number;
  worker_name?: string;
  worker_has_avatar?: number;
  worker_photo_url?: string | null;
}

function actorFromSession(session: SessionPayload | null) {
  if (session?.kind === 'worker') return { role: 'worker' as const, id: session.workerId };
  if (session?.kind === 'company') return { role: 'company' as const, id: session.companyId };
  return null;
}

chatRoutes.get('/', async (c) => {
  const actor = actorFromSession(c.get('session'));
  if (!actor) return c.json({ error: 'auth_required' }, 401);

  const sql =
    actor.role === 'worker'
      ? `SELECT ch.*, co.name as company_name, co.logo_initial as company_logo_initial, co.logo_color as company_logo_color,
           (co.avatar_data IS NOT NULL) as company_has_avatar
         FROM chats ch JOIN companies co ON co.id = ch.company_id WHERE ch.worker_id = ? ORDER BY ch.created_at DESC`
      : `SELECT ch.*, w.name as worker_name, (w.avatar_data IS NOT NULL) as worker_has_avatar, w.photo_url as worker_photo_url
         FROM chats ch JOIN workers w ON w.id = ch.worker_id WHERE ch.company_id = ? ORDER BY ch.created_at DESC`;

  const { results } = await c.env.DB.prepare(sql).bind(actor.id).all<ChatRow>();

  const chats = [];
  for (const row of results) {
    const last = await c.env.DB.prepare('SELECT text, kind, sender, created_at FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1')
      .bind(row.id)
      .first<{ text: string; kind: string; sender: string; created_at: string }>();
    const unread = await c.env.DB.prepare(
      "SELECT COUNT(*) as n FROM messages WHERE chat_id = ? AND read = 0 AND sender != ?",
    )
      .bind(row.id, actor.role)
      .first<{ n: number }>();

    const avatarUrl =
      actor.role === 'worker'
        ? row.company_has_avatar
          ? `/media/companies/${row.company_id}/avatar`
          : null
        : row.worker_has_avatar
          ? `/media/workers/${row.worker_id}/avatar`
          : row.worker_photo_url ?? null;

    chats.push({
      id: row.id,
      companyId: row.company_id,
      workerId: row.worker_id,
      shiftId: row.shift_id,
      contactName: actor.role === 'worker' ? row.company_name : row.worker_name,
      avatarUrl,
      logoInitial: row.company_logo_initial,
      logoColor: row.company_logo_color,
      lastMessage: last,
      unread: unread?.n ?? 0,
    });
  }
  return c.json({ chats });
});

async function assertParticipant(env: Env, chatId: string, actor: { role: 'worker' | 'company'; id: number }) {
  const col = actor.role === 'worker' ? 'worker_id' : 'company_id';
  return env.DB.prepare(`SELECT id, company_id, worker_id FROM chats WHERE id = ? AND ${col} = ?`)
    .bind(chatId, actor.id)
    .first<{ id: number; company_id: number; worker_id: number }>();
}

chatRoutes.get('/:id/messages', async (c) => {
  const actor = actorFromSession(c.get('session'));
  if (!actor) return c.json({ error: 'auth_required' }, 401);
  const chatId = c.req.param('id');
  if (!(await assertParticipant(c.env, chatId, actor))) return c.json({ error: 'not_found' }, 404);

  const { results } = await c.env.DB.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC').bind(chatId).all();
  await c.env.DB.prepare('UPDATE messages SET read = 1 WHERE chat_id = ? AND sender != ?').bind(chatId, actor.role).run();

  return c.json({ messages: results });
});

chatRoutes.post('/:id/messages', async (c) => {
  const actor = actorFromSession(c.get('session'));
  if (!actor) return c.json({ error: 'auth_required' }, 401);
  const chatId = c.req.param('id');
  const chat = await assertParticipant(c.env, chatId, actor);
  if (!chat) return c.json({ error: 'not_found' }, 404);

  const { text } = await c.req.json<{ text: string }>();
  if (!text?.trim()) return c.json({ error: 'empty_message' }, 400);

  const inserted = await c.env.DB.prepare(
    "INSERT INTO messages (chat_id, sender, kind, text) VALUES (?, ?, 'text', ?) RETURNING *",
  )
    .bind(chatId, actor.role, text.trim())
    .first();

  // Notify whoever didn't just send it — a worker/employer chat is the
  // one place a reply genuinely needs to reach someone's phone right
  // away, not just wait for them to happen to reopen the app.
  const preview = text.trim().length > 200 ? `${text.trim().slice(0, 200)}…` : text.trim();
  if (actor.role === 'worker') {
    const worker = await c.env.DB.prepare('SELECT name FROM workers WHERE id = ?').bind(actor.id).first<{ name: string }>();
    const company = await c.env.DB.prepare('SELECT owner_telegram_id FROM companies WHERE id = ?')
      .bind(chat.company_id)
      .first<{ owner_telegram_id: number }>();
    if (company) {
      c.executionCtx.waitUntil(sendTelegramMessage(c.env, company.owner_telegram_id, `💬 ${worker?.name ?? 'Соискатель'}:\n${preview}`));
    }
  } else {
    const company = await c.env.DB.prepare('SELECT name FROM companies WHERE id = ?').bind(actor.id).first<{ name: string }>();
    const worker = await c.env.DB.prepare('SELECT telegram_id FROM workers WHERE id = ?')
      .bind(chat.worker_id)
      .first<{ telegram_id: number }>();
    if (worker) {
      c.executionCtx.waitUntil(sendTelegramMessage(c.env, worker.telegram_id, `💬 ${company?.name ?? 'Работодатель'}:\n${preview}`));
    }
  }

  return c.json({ message: inserted });
});

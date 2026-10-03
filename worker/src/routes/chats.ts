import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession } from '../middleware/auth';
import { MESSAGE_LIMIT, overLimit } from '../lib/rateLimit';
import { readUpload } from '../lib/media';

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
  online?: number;
  last_message_at?: string | null;
  last_text?: string | null;
  last_kind?: string | null;
  last_sender?: string | null;
  last_preview_at?: string | null;
  unread?: number;
}

function actorFromSession(session: SessionPayload | null) {
  if (session?.kind === 'worker') return { role: 'worker' as const, id: session.workerId };
  if (session?.kind === 'company') return { role: 'company' as const, id: session.companyId };
  return null;
}

/** «В сети» — последние 2 минуты активности в разделе чатов (см.
 *  touchLastSeen ниже), не по всему приложению: это не общий статус
 *  присутствия, а именно «сейчас может ответить в переписке». Сравнение —
 *  на стороне SQLite (datetime('now', ...)), а не разбором строки в JS:
 *  last_seen_at хранится как 'YYYY-MM-DD HH:MM:SS' без таймзоны, и строковое
 *  сравнение в этом формате работает прямо в SQL без догадок о том, как
 *  его допарсит движок JS. NULL (никогда не заходил) сравнение просто не
 *  проходит — отдельная проверка не нужна. */
function onlineExpr(column: string): string {
  return `${column} >= datetime('now', '-2 minutes')`;
}

/** Отмечает «сейчас активен» — но не чаще чем раз в минуту на человека,
 *  иначе опрос открытого чата (раз в 2 секунды, см. ChatDetail.tsx) писал
 *  бы в базу на каждый тик. last_seen_at (миграция 0041) уже существует и
 *  раньше обновлялся только при входе в бот — здесь то же поле, просто
 *  живее, пока человек реально в разделе чатов. */
async function touchLastSeen(env: Env, actor: { role: 'worker' | 'company'; id: number }): Promise<void> {
  const table = actor.role === 'worker' ? 'workers' : 'companies';
  await env.DB.prepare(
    `UPDATE ${table} SET last_seen_at = datetime('now')
     WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at <= datetime('now', '-1 minute'))`,
  )
    .bind(actor.id)
    .run();
}

chatRoutes.get('/', async (c) => {
  const actor = actorFromSession(c.get('session'));
  if (!actor) return c.json({ error: 'auth_required' }, 401);

  c.executionCtx.waitUntil(touchLastSeen(c.env, actor));

  // Отсортированы по последнему сообщению, а не по моменту создания чата —
  // иначе ответ в старый чат никогда не поднимал бы его наверх списка, и
  // человек с открытым недавним разговором мог просто не заметить, что
  // ему ответили в другом. Для чата без единого сообщения (только что
  // пригласили) — время создания, другого ориентира ещё нет.
  //
  // Превью последнего сообщения и счётчик непрочитанных — тоже
  // подзапросами прямо здесь, а не отдельным запросом на каждый чат из
  // списка (как было раньше): список из N чатов стоил 1 + 2N обращений к
  // базе, и при опросе каждые 5 секунд (см. ChatList.tsx) это и съело
  // дневной лимит D1 на чтения. idx_messages_chat_created (миграция 0049)
  // превращает «последнее сообщение» в точечный поиск по индексу вместо
  // перебора всей истории чата.
  const lastMessageAt = '(SELECT MAX(m.created_at) FROM messages m WHERE m.chat_id = ch.id)';
  const previewWhere = 'm.chat_id = ch.id AND (m.visible_to IS NULL OR m.visible_to = ?)';
  const previewOrder = 'ORDER BY m.created_at DESC, m.id DESC LIMIT 1';
  const previewCols = `
    (SELECT m.text FROM messages m WHERE ${previewWhere} ${previewOrder}) as last_text,
    (SELECT m.kind FROM messages m WHERE ${previewWhere} ${previewOrder}) as last_kind,
    (SELECT m.sender FROM messages m WHERE ${previewWhere} ${previewOrder}) as last_sender,
    (SELECT m.created_at FROM messages m WHERE ${previewWhere} ${previewOrder}) as last_preview_at,
    (SELECT COUNT(*) FROM messages m WHERE m.chat_id = ch.id AND m.read = 0 AND m.sender != ? AND (m.visible_to IS NULL OR m.visible_to = ?)) as unread`;
  const sql =
    actor.role === 'worker'
      ? `SELECT ch.*, co.name as company_name, co.logo_initial as company_logo_initial, co.logo_color as company_logo_color,
           (co.avatar_data IS NOT NULL) as company_has_avatar, ${onlineExpr('co.last_seen_at')} as online,
           ${lastMessageAt} as last_message_at, ${previewCols}
         FROM chats ch JOIN companies co ON co.id = ch.company_id WHERE ch.worker_id = ?
         ORDER BY COALESCE(last_message_at, ch.created_at) DESC`
      : `SELECT ch.*, w.name as worker_name, (w.avatar_data IS NOT NULL) as worker_has_avatar, w.photo_url as worker_photo_url,
           ${onlineExpr('w.last_seen_at')} as online, ${lastMessageAt} as last_message_at, ${previewCols}
         FROM chats ch JOIN workers w ON w.id = ch.worker_id WHERE ch.company_id = ?
         ORDER BY COALESCE(last_message_at, ch.created_at) DESC`;

  // Порядок плейсхолдеров: 4 подзапроса превью (каждому своё `?` на
  // visible_to) + unread (sender, visible_to) + финальный WHERE по id.
  const { results } = await c.env.DB.prepare(sql)
    .bind(actor.role, actor.role, actor.role, actor.role, actor.role, actor.role, actor.id)
    .all<ChatRow>();

  const chats = [];
  for (const row of results) {
    const last =
      row.last_kind != null
        ? { text: row.last_text ?? '', kind: row.last_kind, sender: row.last_sender, created_at: row.last_preview_at }
        : null;

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
      lastMessage: last?.kind === 'image' ? { text: '📷 Фото', created_at: last.created_at } : last,
      unread: row.unread ?? 0,
      online: !!row.online,
      lastMessageAt: row.last_message_at ?? row.created_at,
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

/** Применена ли миграция 0048 (messages.file_data/file_content_type). Та же
 *  осторожность, что и везде в этом кодбейзе: миграции накатываются
 *  руками, и запрос к несуществующей колонке уронил бы не только вложения,
 *  а вообще всю переписку — GET .../messages вызывается на каждый опрос
 *  открытого чата. */
let chatMediaColumnsConfirmed = false;

async function chatMediaColumnsExist(env: Env): Promise<boolean> {
  if (chatMediaColumnsConfirmed) return true;
  try {
    const { results } = await env.DB.prepare('PRAGMA table_info(messages)').all<{ name: string }>();
    chatMediaColumnsConfirmed = results.some((r) => r.name === 'file_data');
    return chatMediaColumnsConfirmed;
  } catch {
    return false;
  }
}

/** Колонки сообщения без самого вложения — отдавать BLOB внутри JSON на
 *  каждый опрос (раз в 2 секунды, пока чат открыт) означало бы слать
 *  картинку заново каждый раз. Экран подгружает её отдельным
 *  авторизованным запросом (GET .../image) только когда она правда нужна. */
async function messageColumns(env: Env): Promise<string> {
  const hasImage = (await chatMediaColumnsExist(env)) ? '(file_data IS NOT NULL) as has_image' : '0 as has_image';
  return `id, chat_id, sender, kind, text, read, visible_to, created_at, ${hasImage}`;
}

/** История чата — целиком, либо только то, что появилось после
 *  сообщения `after`.
 *
 *  Второе нужно открытому чату: он опрашивает эту ручку раз в пару секунд,
 *  чтобы ответ собеседника появлялся сам, а не после выхода и повторного
 *  входа в переписку. Возить всю историю каждые две секунды ради нуля
 *  новых строк незачем — при `after` запрос упирается в первичный ключ и
 *  почти всегда возвращает пустой список. */
chatRoutes.get('/:id/messages', async (c) => {
  const actor = actorFromSession(c.get('session'));
  if (!actor) return c.json({ error: 'auth_required' }, 401);
  const chatId = c.req.param('id');
  const chat = await assertParticipant(c.env, chatId, actor);
  if (!chat) return c.json({ error: 'not_found' }, 404);

  c.executionCtx.waitUntil(touchLastSeen(c.env, actor));

  const afterParam = c.req.query('after');
  const after = afterParam && /^\d+$/.test(afterParam) ? Number(afterParam) : null;

  const { results } = await c.env.DB.prepare(
    `SELECT ${await messageColumns(c.env)} FROM messages
     WHERE chat_id = ? AND (visible_to IS NULL OR visible_to = ?)${after === null ? '' : ' AND id > ?'}
     ORDER BY id ASC`,
  )
    .bind(...(after === null ? [chatId, actor.role] : [chatId, actor.role, after]))
    .all();

  // Отметка о прочтении — только когда есть что отмечать. Иначе опрос
  // открытого чата превращался бы в запись в базу каждые две секунды,
  // ничего при этом не меняющую.
  if (after === null || results.length > 0) {
    await c.env.DB.prepare('UPDATE messages SET read = 1 WHERE chat_id = ? AND sender != ? AND read = 0')
      .bind(chatId, actor.role)
      .run();
    // Человек открыл переписку — значит, следующая непрочитанная серия
    // начинается с нуля, и напоминание о ней (см. lib/unreadChats.ts)
    // должно уйти сразу, а не досиживать старый интервал.
    const notifiedCol = actor.role === 'worker' ? 'worker_notified_at' : 'company_notified_at';
    await c.env.DB.prepare(`UPDATE chats SET ${notifiedCol} = NULL WHERE id = ? AND ${notifiedCol} IS NOT NULL`)
      .bind(chatId)
      .run();
  }

  // «В сети» у собеседника — тем же запросом, которым и так опрашивается
  // чат: отдельный поллинг под это заводить незачем.
  const counterpartyTable = actor.role === 'worker' ? 'companies' : 'workers';
  const counterparty = await c.env.DB.prepare(`SELECT ${onlineExpr('last_seen_at')} as online FROM ${counterpartyTable} WHERE id = ?`)
    .bind(actor.role === 'worker' ? chat.company_id : chat.worker_id)
    .first<{ online: number }>();

  return c.json({ messages: results, counterparty: { online: !!counterparty?.online } });
});

chatRoutes.post('/:id/messages', async (c) => {
  const actor = actorFromSession(c.get('session'));
  if (!actor) return c.json({ error: 'auth_required' }, 401);
  const chatId = c.req.param('id');
  const chat = await assertParticipant(c.env, chatId, actor);
  if (!chat) return c.json({ error: 'not_found' }, 404);

  const { text } = await c.req.json<{ text: string }>();
  if (!text?.trim()) return c.json({ error: 'empty_message' }, 400);

  if (await overLimit(c.env, 'messages', 'chat_id', chatId, MESSAGE_LIMIT)) {
    return c.json({ error: 'rate_limited' }, 429);
  }

  const inserted = await c.env.DB.prepare(
    `INSERT INTO messages (chat_id, sender, kind, text) VALUES (?, ?, 'text', ?) RETURNING ${await messageColumns(c.env)}`,
  )
    .bind(chatId, actor.role, text.trim())
    .first();

  // Уведомления в бот о новом сообщении здесь больше нет — сознательно.
  // Переписка идёт внутри приложения и обновляется сама (открытый чат
  // опрашивает GET выше), а дублирующий пуш на каждую реплику превращал
  // обычный разговор в поток сообщений от бота. Бот остаётся для того,
  // что действительно требует внимания вне приложения: приглашения,
  // отмены, изменения смены, напоминание перед выходом.
  // Столбцы chats.worker_notified_at / company_notified_at (миграция 0015)
  // с этого момента никем не читаются и остаются только как след.

  return c.json({ message: inserted });
});

/** Фото или документ прямо в переписке — то же тело запроса, что у
 *  аватарки (сырые байты, Content-Type из заголовка), просто кладётся на
 *  само сообщение, а не на профиль. Тот же лимит на чат, что и у текста
 *  (MESSAGE_LIMIT): вложение — такая же строка messages. */
chatRoutes.post('/:id/messages/image', async (c) => {
  const actor = actorFromSession(c.get('session'));
  if (!actor) return c.json({ error: 'auth_required' }, 401);
  if (!(await chatMediaColumnsExist(c.env))) {
    return c.json({ error: 'migration_required', migration: '0048_chat_media' }, 400);
  }
  const chatId = c.req.param('id');
  const chat = await assertParticipant(c.env, chatId, actor);
  if (!chat) return c.json({ error: 'not_found' }, 404);

  if (await overLimit(c.env, 'messages', 'chat_id', chatId, MESSAGE_LIMIT)) {
    return c.json({ error: 'rate_limited' }, 429);
  }

  const contentType = c.req.header('Content-Type') ?? 'application/octet-stream';
  const bytes = await c.req.arrayBuffer();
  const check = readUpload(bytes);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const inserted = await c.env.DB.prepare(
    `INSERT INTO messages (chat_id, sender, kind, text, file_data, file_content_type)
     VALUES (?, ?, 'image', '', ?, ?) RETURNING ${await messageColumns(c.env)}`,
  )
    .bind(chatId, actor.role, bytes, contentType)
    .first();

  return c.json({ message: inserted });
});

/** D1 hands a BLOB column back as a plain `number[]`, not an
 *  ArrayBuffer/Uint8Array — feeding that straight into `new Response()`
 *  silently stringifies it instead of sending the actual bytes (same gotcha
 *  as routes/media.ts's toBytes). */
function toBytes(raw: unknown): Uint8Array | null {
  if (raw == null) return null;
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (Array.isArray(raw)) return new Uint8Array(raw);
  return null;
}

/** В отличие от аватарок и фото анкеты (routes/media.ts), это не публичная
 *  раздача: то, что прислали в личном чате, видят только двое участников
 *  этого чата, а не кто угодно по ссылке — отсюда проверка участника и то,
 *  что этот маршрут сидит за attachSession, а не в открытом mediaRoutes. */
chatRoutes.get('/:id/messages/:messageId/image', async (c) => {
  const actor = actorFromSession(c.get('session'));
  if (!actor) return c.json({ error: 'auth_required' }, 401);
  if (!(await chatMediaColumnsExist(c.env))) return c.notFound();
  const chatId = c.req.param('id');
  if (!(await assertParticipant(c.env, chatId, actor))) return c.json({ error: 'not_found' }, 404);

  const row = await c.env.DB.prepare('SELECT file_data, file_content_type FROM messages WHERE id = ? AND chat_id = ?')
    .bind(c.req.param('messageId'), chatId)
    .first<{ file_data: unknown; file_content_type: string | null }>();
  const bytes = toBytes(row?.file_data);
  if (!bytes) return c.notFound();

  // Сообщение неизменяемо после отправки — тот же адрес всегда отдаёт те
  // же байты, так что кэшировать его навсегда безопасно (как у галереи
  // фото в lib/media.ts, в отличие от аватарки, которая перезаписывается).
  return new Response(bytes, {
    headers: { 'Content-Type': row!.file_content_type ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
});

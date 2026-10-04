import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, actorLabel, logAction, requirePermission, requireStaff } from '../middleware/auth';
import { sendTelegramMessage, type TelegramEntity } from '../lib/telegramBot';

/** Применена ли миграция 0050 (broadcasts.entities). Та же осторожность,
 *  что и везде в этом кодбейзе — named-колонка в INSERT уронила бы вообще
 *  всё создание рассылок на базе, где миграцию ещё не накатили руками. */
let entitiesColumnConfirmed = false;

async function entitiesColumnExists(env: Env): Promise<boolean> {
  if (entitiesColumnConfirmed) return true;
  try {
    const { results } = await env.DB.prepare('PRAGMA table_info(broadcasts)').all<{ name: string }>();
    entitiesColumnConfirmed = results.some((r) => r.name === 'entities');
    return entitiesColumnConfirmed;
  } catch {
    return false;
  }
}

export const adminBroadcastRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminBroadcastRoutes.use('*', attachSession);

export type Audience = 'all' | 'seekers' | 'employers' | 'custom';

/** Telegram caps bots at roughly 30 messages/second before it starts
 *  returning 429s. A batch of 25 per request, sent with a small gap,
 *  stays comfortably under that — and keeps any single Worker request
 *  short, since a few thousand recipients can't be pushed through one
 *  invocation. The dashboard calls this repeatedly until it reports done. */
const BATCH_SIZE = 25;
const GAP_MS = 40;

/** Who actually gets it. Suspended accounts are skipped, and a Telegram id
 *  locked to the other role is skipped too, so someone who switched from
 *  seeker to employer doesn't get the seeker announcement. A NULL
 *  active_role means the account predates that column — those still count
 *  as their own table's role. */
/** SQLite's lower() only folds ASCII, so `lower('Москва')` is still
 *  'Москва' — matching city names in SQL silently failed for every
 *  Russian city. Compare in JS instead, where toLowerCase() is
 *  Unicode-aware. */
function sameCity(a: string | null, b: string): boolean {
  return (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();
}

async function resolveRecipients(
  env: Env,
  audience: Audience,
  city: string | null,
  chosen?: number[],
): Promise<number[]> {
  const ids = new Set<number>();

  // Hand-picked recipients still get checked against the same eligibility
  // rules, rather than being taken on the client's word: the browser could
  // name a suspended account, or an id belonging to nobody. Intersecting
  // with the real pickable set means the worst a tampered request can do
  // is send to fewer people than asked, never to someone off-limits.
  if (audience === 'custom') {
    if (!chosen?.length) return [];
    const wanted = new Set(chosen);
    for (const r of await pickableRecipients(env)) {
      if (wanted.has(r.telegram_id)) ids.add(r.telegram_id);
    }
    return [...ids];
  }

  if (audience === 'all' || audience === 'seekers') {
    const { results } = await env.DB.prepare(
      `SELECT w.telegram_id, w.city FROM workers w
       LEFT JOIN telegram_accounts t ON t.telegram_id = w.telegram_id
       WHERE w.status != 'suspended' AND (t.active_role = 'worker' OR t.active_role IS NULL)`,
    ).all<{ telegram_id: number; city: string | null }>();
    for (const r of results) if (!city || sameCity(r.city, city)) ids.add(r.telegram_id);
  }

  if (audience === 'all' || audience === 'employers') {
    const { results } = await env.DB.prepare(
      `SELECT co.owner_telegram_id as telegram_id, co.city FROM companies co
       LEFT JOIN telegram_accounts t ON t.telegram_id = co.owner_telegram_id
       WHERE co.status != 'suspended' AND (t.active_role = 'employer' OR t.active_role IS NULL)`,
    ).all<{ telegram_id: number; city: string | null }>();
    for (const r of results) if (!city || sameCity(r.city, city)) ids.add(r.telegram_id);
  }

  // A Set, because "all" would otherwise send twice to anyone whose
  // telegram id has rows in both tables (someone staff switched between
  // roles keeps the dormant one).
  return [...ids];
}

function parseAudience(raw: unknown): Audience {
  return raw === 'seekers' || raw === 'employers' || raw === 'custom' ? raw : 'all';
}

/** One pickable recipient for the manual list. Same eligibility rules as
 *  resolveRecipients — anyone shown here can actually be sent to. */
interface PickableRow {
  telegram_id: number;
  name: string;
  telegram_username: string | null;
  city: string | null;
  bot_status?: string;
}

async function pickableRecipients(env: Env): Promise<(PickableRow & { role: 'seeker' | 'employer' })[]> {
  const [{ results: workers }, { results: companies }] = await Promise.all([
    env.DB.prepare(
      `SELECT w.telegram_id, w.name, w.telegram_username, w.city FROM workers w
       LEFT JOIN telegram_accounts t ON t.telegram_id = w.telegram_id
       WHERE w.status != 'suspended' AND (t.active_role = 'worker' OR t.active_role IS NULL)
       ORDER BY w.created_at DESC`,
    ).all<PickableRow>(),
    env.DB.prepare(
      `SELECT co.owner_telegram_id as telegram_id, co.name, co.telegram_username, co.city FROM companies co
       LEFT JOIN telegram_accounts t ON t.telegram_id = co.owner_telegram_id
       WHERE co.status != 'suspended' AND (t.active_role = 'employer' OR t.active_role IS NULL)
       ORDER BY co.created_at DESC`,
    ).all<PickableRow>(),
  ]);

  return [
    ...workers.map((w) => ({ ...w, role: 'seeker' as const })),
    ...companies.map((co) => ({ ...co, role: 'employer' as const })),
  ];
}

/** The list behind the "выбрать вручную" checkboxes. Deliberately the same
 *  query as the audience resolver rather than the Пользователи list: a
 *  suspended account shows up there but must never be pickable here. */
adminBroadcastRoutes.get('/recipients', requirePermission('sendBroadcasts'), async (c) => {
  return c.json({ recipients: await pickableRecipients(c.env) });
});

/** How many people a given audience currently covers — shown next to the
 *  compose box so it's never a surprise how wide a message is going. */
adminBroadcastRoutes.get('/audience', requirePermission('sendBroadcasts'), async (c) => {
  const audience = parseAudience(c.req.query('audience'));
  const city = c.req.query('city')?.trim() || null;
  // 'custom' is counted client-side from the checkboxes — it has no query
  // to run, and round-tripping the whole id list through a GET would be
  // silly. Report 0 so a stray call can't imply a wider reach than chosen.
  if (audience === 'custom') return c.json({ count: 0 });
  const recipients = await resolveRecipients(c.env, audience, city);
  return c.json({ count: recipients.length });
});

/** Cities that actually have accounts in them, for the city picker —
 *  free-typing a city that matches nobody is the easiest way to send a
 *  broadcast into the void. */
adminBroadcastRoutes.get('/cities', requirePermission('sendBroadcasts'), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT city FROM workers WHERE city IS NOT NULL AND TRIM(city) != ''
     UNION ALL
     SELECT city FROM companies WHERE city IS NOT NULL AND TRIM(city) != ''`,
  ).all<{ city: string }>();

  // Grouped here rather than in SQL — GROUP BY lower(city) would split
  // 'Москва' and 'москва' into two entries, since SQLite's lower() leaves
  // Cyrillic untouched.
  const byKey = new Map<string, { city: string; n: number }>();
  for (const r of results) {
    const name = r.city.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = byKey.get(key);
    if (existing) existing.n++;
    else byKey.set(key, { city: name, n: 1 });
  }

  const cities = [...byKey.values()].sort((a, b) => b.n - a.n).slice(0, 50);
  return c.json({ cities });
});

/** Резолвит аудиторию и сохраняет черновик — само отправление не начинается
 *  (им управляет sendBroadcastBatch ниже, повторными вызовами, чтобы не
 *  упереться в бюджет одного запроса Worker'а и чтобы прерванную рассылку
 *  можно было продолжить, а не начинать заново). Общая для дашборда
 *  (POST / ниже) и для команды /broadcast из самого бота (routes/bot.ts) —
 *  у владельца должен быть тот же самый, проверенный путь, а не отдельная
 *  copy-paste версия. */
export async function createBroadcast(
  env: Env,
  params: {
    text: string;
    audience?: string;
    city?: string | null;
    telegramIds?: number[];
    createdBy: string;
    /** Telegram-разметка текста (жирный/ссылки/премиальные эмодзи) — только
     *  у рассылок из команды /broadcast в самом боте; дашборд шлёт
     *  обычный textarea без неё. */
    entities?: TelegramEntity[];
  },
): Promise<{ id: number; total: number } | { error: 'text_required' | 'no_recipients' }> {
  const text = params.text?.trim();
  if (!text) return { error: 'text_required' };

  const audience = parseAudience(params.audience);
  // A hand-picked list is about specific people, so the city filter has no
  // say in it — resolveRecipients ignores city for 'custom'.
  const city = audience === 'custom' ? null : params.city?.trim() || null;
  const chosen = params.telegramIds?.filter((n) => Number.isFinite(n));
  const recipients = await resolveRecipients(env, audience, city, chosen);
  if (recipients.length === 0) return { error: 'no_recipients' };

  const hasEntities = await entitiesColumnExists(env);
  const entitiesJson = hasEntities && params.entities && params.entities.length > 0 ? JSON.stringify(params.entities) : null;

  const inserted = await env.DB.prepare(
    hasEntities
      ? `INSERT INTO broadcasts (text, audience, city, recipients, total, created_by, entities)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
      : `INSERT INTO broadcasts (text, audience, city, recipients, total, created_by)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(
      ...(hasEntities
        ? [text, audience, city, JSON.stringify(recipients), recipients.length, params.createdBy, entitiesJson]
        : [text, audience, city, JSON.stringify(recipients), recipients.length, params.createdBy]),
    )
    .first<{ id: number }>();

  return { id: inserted!.id, total: recipients.length };
}

export interface BroadcastBatchResult {
  id: number;
  processed: number;
  total: number;
  sent: number;
  failed: number;
  done: boolean;
}

/** Отправляет следующую пачку и двигает курсор. Безопасно звать повторно
 *  после сбоя: курсор продвигается ровно на то, что эта попытка реально
 *  обработала, так что повтор продолжает, а не рассылает всем заново.
 *  `null` — такой рассылки нет. */
export async function sendBroadcastBatch(env: Env, id: number): Promise<BroadcastBatchResult | null> {
  const row = await env.DB.prepare('SELECT * FROM broadcasts WHERE id = ?').bind(id).first<{
    id: number;
    text: string;
    recipients: string;
    total: number;
    cursor: number;
    sent_count: number;
    failed_count: number;
    entities?: string | null;
  }>();
  if (!row) return null;

  // SELECT * просто не вернёт поле на базе без миграции 0050 — row.entities
  // окажется undefined, и ветка ниже тихо отправит как обычный текст.
  const entities: TelegramEntity[] | undefined = row.entities ? JSON.parse(row.entities) : undefined;

  const recipients = JSON.parse(row.recipients) as number[];
  const slice = recipients.slice(row.cursor, row.cursor + BATCH_SIZE);

  let sent = 0;
  let failed = 0;
  for (const telegramId of slice) {
    // sendTelegramMessage swallows its own errors (blocked bot, deleted
    // account) and reports false-ish by logging — check the result so a
    // blocked user counts as "не доставлено" rather than silently as sent.
    const ok = await sendTelegramMessage(env, telegramId, row.text, entities);
    if (ok) sent++;
    else failed++;
    if (GAP_MS > 0) await new Promise((resolve) => setTimeout(resolve, GAP_MS));
  }

  const cursor = row.cursor + slice.length;
  await env.DB.prepare('UPDATE broadcasts SET cursor = ?, sent_count = ?, failed_count = ? WHERE id = ?')
    .bind(cursor, row.sent_count + sent, row.failed_count + failed, id)
    .run();

  return {
    id: row.id,
    processed: cursor,
    total: row.total,
    sent: row.sent_count + sent,
    failed: row.failed_count + failed,
    done: cursor >= row.total,
  };
}

adminBroadcastRoutes.post('/', requirePermission('sendBroadcasts'), async (c) => {
  const session = requireStaff(c as never)!;
  const body = await c.req.json<{ text: string; audience?: string; city?: string; telegramIds?: number[] }>();
  const actor = await actorLabel(c.env, session);

  const result = await createBroadcast(c.env, {
    text: body.text,
    audience: body.audience,
    city: body.city,
    telegramIds: body.telegramIds,
    createdBy: actor.name,
  });
  if ('error' in result) return c.json({ error: result.error }, 400);

  await logAction(c.env, actor, `запустила рассылку на ${result.total} чел.`, 'neutral');
  return c.json(result);
});

adminBroadcastRoutes.post('/:id/send-batch', requirePermission('sendBroadcasts'), async (c) => {
  const result = await sendBroadcastBatch(c.env, Number(c.req.param('id')));
  if (!result) return c.json({ error: 'not_found' }, 404);
  return c.json(result);
});

/** Past broadcasts, newest first — what was sent, to whom, and how it
 *  landed. */
adminBroadcastRoutes.get('/', requirePermission('sendBroadcasts'), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, text, audience, city, total, cursor, sent_count, failed_count, created_by, created_at
     FROM broadcasts ORDER BY id DESC LIMIT 50`,
  ).all();
  return c.json({ broadcasts: results });
});

import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, actorLabel, logAction, requirePermission, requireStaff } from '../middleware/auth';
import { sendTelegramMessage } from '../lib/telegramBot';

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
adminBroadcastRoutes.get('/recipients', requirePermission('manageData'), async (c) => {
  return c.json({ recipients: await pickableRecipients(c.env) });
});

/** How many people a given audience currently covers — shown next to the
 *  compose box so it's never a surprise how wide a message is going. */
adminBroadcastRoutes.get('/audience', requirePermission('manageData'), async (c) => {
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
adminBroadcastRoutes.get('/cities', requirePermission('manageData'), async (c) => {
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

/** Resolves the audience and stores it — nothing is sent yet. Sending is
 *  driven by /:id/send-batch below so a long run can't blow a Worker's
 *  request budget, and so an interrupted broadcast can be resumed instead
 *  of restarted from the top. */
adminBroadcastRoutes.post('/', requirePermission('manageData'), async (c) => {
  const session = requireStaff(c as never)!;
  const body = await c.req.json<{ text: string; audience?: string; city?: string; telegramIds?: number[] }>();
  const text = body.text?.trim();
  if (!text) return c.json({ error: 'text_required' }, 400);

  const audience = parseAudience(body.audience);
  // A hand-picked list is about specific people, so the city filter has no
  // say in it — resolveRecipients ignores city for 'custom'.
  const city = audience === 'custom' ? null : body.city?.trim() || null;
  const chosen = Array.isArray(body.telegramIds) ? body.telegramIds.filter((n) => Number.isFinite(n)) : undefined;
  const recipients = await resolveRecipients(c.env, audience, city, chosen);
  if (recipients.length === 0) return c.json({ error: 'no_recipients' }, 400);

  const actor = await actorLabel(c.env, session);
  const inserted = await c.env.DB.prepare(
    `INSERT INTO broadcasts (text, audience, city, recipients, total, created_by)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(text, audience, city, JSON.stringify(recipients), recipients.length, actor.name)
    .first<{ id: number }>();

  await logAction(c.env, actor, `запустила рассылку на ${recipients.length} чел.`, 'neutral');
  return c.json({ id: inserted!.id, total: recipients.length });
});

/** Sends the next batch and moves the cursor. Safe to call again after a
 *  failure: the cursor only advances past recipients this call actually
 *  attempted, so a retry resumes rather than re-sending to everyone. */
adminBroadcastRoutes.post('/:id/send-batch', requirePermission('manageData'), async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT * FROM broadcasts WHERE id = ?').bind(id).first<{
    id: number;
    text: string;
    recipients: string;
    total: number;
    cursor: number;
    sent_count: number;
    failed_count: number;
  }>();
  if (!row) return c.json({ error: 'not_found' }, 404);

  const recipients = JSON.parse(row.recipients) as number[];
  const slice = recipients.slice(row.cursor, row.cursor + BATCH_SIZE);

  let sent = 0;
  let failed = 0;
  for (const telegramId of slice) {
    // sendTelegramMessage swallows its own errors (blocked bot, deleted
    // account) and reports false-ish by logging — check the result so a
    // blocked user counts as "не доставлено" rather than silently as sent.
    const ok = await sendTelegramMessage(c.env, telegramId, row.text);
    if (ok) sent++;
    else failed++;
    if (GAP_MS > 0) await new Promise((resolve) => setTimeout(resolve, GAP_MS));
  }

  const cursor = row.cursor + slice.length;
  await c.env.DB.prepare('UPDATE broadcasts SET cursor = ?, sent_count = ?, failed_count = ? WHERE id = ?')
    .bind(cursor, row.sent_count + sent, row.failed_count + failed, id)
    .run();

  return c.json({
    id: row.id,
    processed: cursor,
    total: row.total,
    sent: row.sent_count + sent,
    failed: row.failed_count + failed,
    done: cursor >= row.total,
  });
});

/** Past broadcasts, newest first — what was sent, to whom, and how it
 *  landed. */
adminBroadcastRoutes.get('/', requirePermission('manageData'), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, text, audience, city, total, cursor, sent_count, failed_count, created_by, created_at
     FROM broadcasts ORDER BY id DESC LIMIT 50`,
  ).all();
  return c.json({ broadcasts: results });
});

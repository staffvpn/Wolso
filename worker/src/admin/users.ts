import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, actorLabel, logAction, requirePermission, requireStaff, requireStaffMiddleware, staffHasPermission } from '../middleware/auth';
import { provisionWorker, provisionCompany } from '../routes/auth';
import { getTelegramUsername } from '../lib/telegramBot';
import { probeBotStatus, botStatusColumnsExist } from '../lib/botStatus';
import { hiddenColumnExists } from '../lib/hiddenProfiles';
import { userNotesTableExists } from '../lib/complaints';
import { recomputeWorkerRating, recomputeCompanyRating, recomputeAllRatings } from '../lib/ratings';
import { datesColumnExists, expandDates } from '../lib/shiftDates';

export const adminUserRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminUserRoutes.use('*', attachSession);

/** manageTeam (which `admin` has) is deliberately weaker than
 *  transferOwnership (only `owner` has) — anything that would install or
 *  remove an Owner has to check this separately, on top of the route's
 *  own manageTeam gate. Without it, an `admin` could invite themselves as
 *  a second Owner, demote the real Owner out of the role, or revoke the
 *  Owner's access outright, all with a plain "manage team" permission. */
async function canTouchOwnerRole(env: Env, session: Extract<SessionPayload, { kind: 'staff' }>): Promise<boolean> {
  return (await staffHasPermission(env, session.roleId, 'transferOwnership')) === 'yes';
}

async function activeOwnerCount(env: Env): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) as n FROM staff WHERE role_id = 'owner' AND status = 'active'").first<{ n: number }>();
  return row?.n ?? 0;
}

adminUserRoutes.get('/team', requireStaffMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT s.*, r.name as role_name FROM staff s JOIN roles r ON r.id = s.role_id ORDER BY s.created_at ASC',
  ).all();
  return c.json({ team: results });
});

/** Only the role a Telegram id is *currently* active as — a person who got
 *  switched to the other role by staff still has a dormant row here (so
 *  switching back doesn't lose their old profile), but it shouldn't show
 *  up as a live seeker anymore. Without this filter, switching someone's
 *  role looked like it "created a new user": the old row never left this
 *  list, so the person appeared twice. */
adminUserRoutes.get('/seekers', requireStaffMiddleware, async (c) => {
  const search = c.req.query('q');
  // LEFT JOIN, not JOIN: a handful of accounts predate the telegram_accounts
  // table and have never logged in since — those still belong in this list
  // by default (only an explicit 'employer' lock hides them).
  const sql = search
    ? `SELECT w.* FROM workers w LEFT JOIN telegram_accounts t ON t.telegram_id = w.telegram_id
       WHERE (t.active_role = 'worker' OR t.active_role IS NULL) AND w.name LIKE ? ORDER BY w.created_at DESC LIMIT 200`
    : `SELECT w.* FROM workers w LEFT JOIN telegram_accounts t ON t.telegram_id = w.telegram_id
       WHERE t.active_role = 'worker' OR t.active_role IS NULL ORDER BY w.created_at DESC LIMIT 200`;
  const { results } = await (search ? c.env.DB.prepare(sql).bind(`%${search}%`) : c.env.DB.prepare(sql)).all();
  return c.json({ seekers: results });
});

adminUserRoutes.get('/employers', requireStaffMiddleware, async (c) => {
  const search = c.req.query('q');
  const sql = search
    ? `SELECT co.* FROM companies co LEFT JOIN telegram_accounts t ON t.telegram_id = co.owner_telegram_id
       WHERE (t.active_role = 'employer' OR t.active_role IS NULL) AND co.name LIKE ? ORDER BY co.created_at DESC LIMIT 200`
    : `SELECT co.* FROM companies co LEFT JOIN telegram_accounts t ON t.telegram_id = co.owner_telegram_id
       WHERE t.active_role = 'employer' OR t.active_role IS NULL ORDER BY co.created_at DESC LIMIT 200`;
  const { results } = await (search ? c.env.DB.prepare(sql).bind(`%${search}%`) : c.env.DB.prepare(sql)).all();
  return c.json({ employers: results });
});

/** telegram_username is only captured/refreshed at login (see routes/auth.ts)
 *  — accounts that registered before that existed, or just haven't reopened
 *  the app since, sit with a NULL username until then. This backfills them
 *  straight from the Bot API instead of waiting: getChat works for any
 *  chat_id the bot has ever messaged, which in practice is every worker and
 *  company (launching the Mini App and getting notifications both go
 *  through the bot). Capped per call to stay well inside the request's CPU
 *  budget — safe to call again for the next batch. */
adminUserRoutes.post('/sync-telegram-usernames', requireStaffMiddleware, async (c) => {
  const BATCH = 40;
  const { results: workers } = await c.env.DB.prepare(
    'SELECT id, telegram_id FROM workers WHERE telegram_username IS NULL LIMIT ?',
  )
    .bind(BATCH)
    .all<{ id: number; telegram_id: number }>();
  const { results: companies } = await c.env.DB.prepare(
    'SELECT id, owner_telegram_id FROM companies WHERE telegram_username IS NULL LIMIT ?',
  )
    .bind(BATCH)
    .all<{ id: number; owner_telegram_id: number }>();

  let updated = 0;
  await Promise.all([
    ...workers.map(async (w) => {
      const username = await getTelegramUsername(c.env, w.telegram_id);
      if (username) {
        await c.env.DB.prepare('UPDATE workers SET telegram_username = ? WHERE id = ?').bind(username, w.id).run();
        updated++;
      }
    }),
    ...companies.map(async (co) => {
      const username = await getTelegramUsername(c.env, co.owner_telegram_id);
      if (username) {
        await c.env.DB.prepare('UPDATE companies SET telegram_username = ? WHERE id = ?').bind(username, co.id).run();
        updated++;
      }
    }),
  ]);

  return c.json({ checked: workers.length + companies.length, updated });
});

/** Checks who the bot can still reach. Everything else that writes
 *  bot_status is passive — a notification has to fail, or the person has
 *  to block the bot while the webhook is live — so accounts that went
 *  quiet before either of those existed would sit on 'unknown' forever.
 *  This asks Telegram directly.
 *
 *  Batched: the client calls this in a loop until `remaining` hits 0,
 *  because one Worker request can't sit through thousands of Bot API
 *  calls. The queue is "never checked" — bot_status_at IS NULL — and
 *  every row touched gets stamped whatever the answer, which is what
 *  guarantees the loop terminates. Selecting on bot_status = 'unknown'
 *  instead would re-pick rows the probe couldn't classify, forever. */
adminUserRoutes.post('/check-bot-status', requireStaffMiddleware, async (c) => {
  // Named, not thrown: without this the missing migration surfaces as a
  // bare 500 and the button just appears to do nothing.
  if (!(await botStatusColumnsExist(c.env))) {
    return c.json({ error: 'migration_required', migration: '0025_bot_status' }, 400);
  }

  // Без токена бота проверять нечем: каждый запрос ушёл бы в Telegram с
  // пустым токеном и вернулся с 404, а кнопка отчиталась бы «проверено N,
  // все без ответа» — то есть соврала бы, ничего не проверив.
  if (!c.env.BOT_TOKEN) return c.json({ error: 'no_bot_token' }, 400);

  // Сколько аккаунтов трогает один запрос. Не «побольше, чтобы быстрее»:
  // у запроса воркера есть предел на число исходящих обращений (на
  // бесплатном тарифе — 50), и в этот предел считаются не только вызовы
  // Telegram, но и каждый запрос к D1. Прежние 25 + 25 аккаунтов давали
  // около сотни обращений — на бесплатном тарифе такой запрос падал
  // целиком, и кнопка показывала «не получилось проверить» ровно тогда,
  // когда база подросла. Здесь: 1 PRAGMA + 2 SELECT + 15 вызовов Telegram
  // + 1 batch + 1 SELECT — двадцать с небольшим. Дашборд жмёт эту ручку в
  // цикле, так что за одно нажатие всё равно проходит несколько сотен.
  const BATCH = 15;
  const { results: workers } = await c.env.DB.prepare(
    'SELECT id, telegram_id FROM workers WHERE bot_status_at IS NULL ORDER BY id LIMIT ?',
  )
    .bind(BATCH)
    .all<{ id: number; telegram_id: number }>();
  // Работодателей добираем на остаток лимита, а не ещё столько же: считается
  // общее число обращений за запрос, а не по таблице.
  const { results: companies } = await c.env.DB.prepare(
    'SELECT id, owner_telegram_id FROM companies WHERE bot_status_at IS NULL ORDER BY id LIMIT ?',
  )
    .bind(Math.max(0, BATCH - workers.length))
    .all<{ id: number; owner_telegram_id: number }>();

  const now = new Date().toISOString();
  let active = 0;
  let unreachable = 0;
  let inconclusive = 0;

  /** A probe that came back 'unknown' means Telegram never gave us a
   *  usable answer — a network blip, a rate limit. Stamp the row so the
   *  batch moves on, but leave bot_status alone rather than overwriting
   *  something we do know with something we don't.
   *
   *  Раньше каждая такая запись уходила в базу отдельно; теперь они
   *  собираются и отправляются одним batch — это одно обращение вместо
   *  полусотни, из-за которых запрос и упирался в предел. */
  const writes: D1PreparedStatement[] = [];
  const apply = (table: 'workers' | 'companies', id: number, status: string) => {
    if (status === 'unknown') {
      inconclusive++;
      writes.push(c.env.DB.prepare(`UPDATE ${table} SET bot_status_at = ? WHERE id = ?`).bind(now, id));
      return;
    }
    if (status === 'active') active++;
    else unreachable++;
    writes.push(c.env.DB.prepare(`UPDATE ${table} SET bot_status = ?, bot_status_at = ? WHERE id = ?`).bind(status, now, id));
  };

  await Promise.all([
    ...workers.map(async (w) => apply('workers', w.id, await probeBotStatus(c.env, w.telegram_id))),
    ...companies.map(async (co) => apply('companies', co.id, await probeBotStatus(c.env, co.owner_telegram_id))),
  ]);
  if (writes.length > 0) await c.env.DB.batch(writes);

  const left = await c.env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM workers WHERE bot_status_at IS NULL)
          + (SELECT COUNT(*) FROM companies WHERE bot_status_at IS NULL) as n`,
  ).first<{ n: number }>();

  return c.json({
    checked: workers.length + companies.length,
    active,
    unreachable,
    inconclusive,
    remaining: left?.n ?? 0,
  });
});

/** Deletes one review and re-derives the score behind it.
 *
 *  A review lives on the application it came out of, in one of two sets of
 *  columns depending on who wrote about whom, so it's addressed by
 *  application id plus a side. Deleting the vacancy used to be the only way
 *  to get rid of a review, which took the whole shift and its chat with it
 *  — and still left the stars.
 *
 *  work_stage is deliberately left alone: rolling it back from 'reviewed'
 *  would put the mandatory review screen in front of the worker again for
 *  a shift staff have just decided to wipe the review from. */
adminUserRoutes.delete('/reviews/:appId/:side', requirePermission('manageData'), async (c) => {
  const session = requireStaff(c as never)!;
  const appId = c.req.param('appId');
  const side = c.req.param('side');
  if (side !== 'worker' && side !== 'company') return c.json({ error: 'unknown_side' }, 400);

  const app = await c.env.DB.prepare(
    `SELECT a.id, a.worker_id, s.company_id, w.name as worker_name, co.name as company_name
     FROM applications a
     JOIN shifts s ON s.id = a.shift_id
     JOIN workers w ON w.id = a.worker_id
     JOIN companies co ON co.id = s.company_id
     WHERE a.id = ?`,
  )
    .bind(appId)
    .first<{ id: number; worker_id: number; company_id: number; worker_name: string; company_name: string }>();
  if (!app) return c.json({ error: 'not_found' }, 404);

  if (side === 'worker') {
    await c.env.DB.prepare(
      'UPDATE applications SET employer_rating = NULL, employer_review_tags = NULL, employer_review_comment = NULL WHERE id = ?',
    )
      .bind(appId)
      .run();
    await recomputeWorkerRating(c.env, app.worker_id);
  } else {
    await c.env.DB.prepare('UPDATE applications SET rating = NULL, review_tags = NULL, review_comment = NULL WHERE id = ?')
      .bind(appId)
      .run();
    await recomputeCompanyRating(c.env, app.company_id);
  }

  const actor = await actorLabel(c.env, session);
  await logAction(
    c.env,
    actor,
    `удалила отзыв о ${side === 'worker' ? app.worker_name : app.company_name}`,
    'danger',
  );

  return c.json({ ok: true });
});

/** Rebuilds every stored rating from the reviews that exist right now.
 *  For scores that already drifted before deletions started recomputing —
 *  there was no way to fix those short of editing the database. */
adminUserRoutes.post('/recompute-ratings', requirePermission('manageData'), async (c) => {
  const session = requireStaff(c as never)!;
  const counts = await recomputeAllRatings(c.env);
  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, 'пересчитала рейтинги', 'neutral');
  return c.json({ ok: true, ...counts });
});

/** Counts for the "кто отписался" summary above the users table. */
adminUserRoutes.get('/bot-status-summary', requireStaffMiddleware, async (c) => {
  if (!(await botStatusColumnsExist(c.env))) {
    return c.json({ error: 'migration_required', migration: '0025_bot_status' }, 400);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT bot_status, COUNT(*) as n FROM (
       SELECT bot_status FROM workers UNION ALL SELECT bot_status FROM companies
     ) GROUP BY bot_status`,
  ).all<{ bot_status: string; n: number }>();

  const counts: Record<string, number> = {};
  for (const r of results) counts[r.bot_status] = r.n;
  return c.json({ counts });
});

/** Every review lives on the application it came out of — the employer's
 *  review of the worker in employer_rating/employer_review_*, the worker's
 *  review of the employer in rating/review_*. Both sides are shown in the
 *  dashboard: "получил" is what others wrote about this account (the
 *  reputation staff are usually checking), "оставил" is what they wrote
 *  about everyone else — which is what you need when someone's disputing a
 *  review or serially one-starring people. */
interface AdminReviewRow {
  id: number;
  rating: number;
  tags: string | null;
  comment: string | null;
  created_at: string | null;
  position_label: string;
  date: string;
  counterparty_name: string;
}

function reviewToJson(r: AdminReviewRow) {
  return {
    id: r.id,
    rating: r.rating,
    tags: r.tags ? (JSON.parse(r.tags) as string[]) : [],
    comment: r.comment || '',
    createdAt: r.created_at,
    positionLabel: r.position_label,
    shiftDate: r.date,
    counterpartyName: r.counterparty_name,
  };
}

/** Full profile — everything the person themselves filled in, plus their
 *  application history, for the expanded card in the dashboard. The list
 *  endpoints above stay thin (just enough for the table row); this is
 *  only fetched once a specific person is opened. */
adminUserRoutes.get('/seekers/:id', requireStaffMiddleware, async (c) => {
  const id = c.req.param('id');
  const worker = await c.env.DB.prepare('SELECT * FROM workers WHERE id = ?').bind(id).first<{
    id: number;
    avatar_data: unknown;
    photo_url: string | null;
  }>();
  if (!worker) return c.json({ error: 'not_found' }, 404);

  const { results: positions } = await c.env.DB.prepare(
    'SELECT id, position, position_label, months FROM worker_positions WHERE worker_id = ? ORDER BY months DESC',
  )
    .bind(id)
    .all();
  const { results: photoRows } = await c.env.DB.prepare('SELECT id FROM worker_photos WHERE worker_id = ? ORDER BY position ASC')
    .bind(id)
    .all<{ id: number }>();
  const { results: applications } = await c.env.DB.prepare(
    `SELECT a.id, a.status, a.work_stage, a.rating, a.cancelled_by, a.cancel_reason, a.created_at,
            s.position_label, s.date, s.start_hour, s.start_min, co.name as company_name
     FROM applications a
     JOIN shifts s ON s.id = a.shift_id
     JOIN companies co ON co.id = s.company_id
     WHERE a.worker_id = ?
     ORDER BY a.created_at DESC LIMIT 50`,
  )
    .bind(id)
    .all();

  const { results: reviewsReceived } = await c.env.DB.prepare(
    `SELECT a.id, a.employer_rating as rating, a.employer_review_tags as tags, a.employer_review_comment as comment,
            a.closed_by_employer_at as created_at, s.position_label, s.date, co.name as counterparty_name
     FROM applications a
     JOIN shifts s ON s.id = a.shift_id
     JOIN companies co ON co.id = s.company_id
     WHERE a.worker_id = ? AND a.employer_rating IS NOT NULL
     ORDER BY a.closed_by_employer_at DESC LIMIT 50`,
  )
    .bind(id)
    .all<AdminReviewRow>();

  const { results: reviewsGiven } = await c.env.DB.prepare(
    `SELECT a.id, a.rating as rating, a.review_tags as tags, a.review_comment as comment,
            a.created_at as created_at, s.position_label, s.date, co.name as counterparty_name
     FROM applications a
     JOIN shifts s ON s.id = a.shift_id
     JOIN companies co ON co.id = s.company_id
     WHERE a.worker_id = ? AND a.rating IS NOT NULL
     ORDER BY a.id DESC LIMIT 50`,
  )
    .bind(id)
    .all<AdminReviewRow>();

  return c.json({
    worker: {
      ...worker,
      avatar_data: undefined,
      avatarUrl: worker.avatar_data ? `/media/workers/${id}/avatar` : worker.photo_url,
    },
    positions,
    photos: photoRows.map((p) => ({ id: p.id, url: `/media/workers/${id}/photos/${p.id}` })),
    applications,
    reviewsReceived: reviewsReceived.map(reviewToJson),
    reviewsGiven: reviewsGiven.map(reviewToJson),
  });
});

adminUserRoutes.get('/employers/:id', requireStaffMiddleware, async (c) => {
  const id = c.req.param('id');
  const company = await c.env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(id).first<{
    id: number;
    avatar_data: unknown;
  }>();
  if (!company) return c.json({ error: 'not_found' }, 404);

  const { results: photoRows } = await c.env.DB.prepare('SELECT id FROM company_photos WHERE company_id = ? ORDER BY position ASC')
    .bind(id)
    .all<{ id: number }>();
  // Столбец dates называем только когда он есть: миграции накатываются
  // руками, и запрос к отсутствующей колонке уронил бы весь экран
  // работодателя, а не одну строку с датами.
  const datesField = (await datesColumnExists(c.env)) ? ', s.dates' : '';
  const { results: vacancies } = await c.env.DB.prepare(
    `SELECT s.id, s.position_label, s.date, s.end_date${datesField}, s.status,
            (SELECT COUNT(*) FROM applications a WHERE a.shift_id = s.id) as response_count
     FROM shifts s WHERE s.company_id = ? ORDER BY s.created_at DESC LIMIT 50`,
  )
    .bind(id)
    .all();

  const { results: reviewsReceived } = await c.env.DB.prepare(
    `SELECT a.id, a.rating as rating, a.review_tags as tags, a.review_comment as comment,
            a.created_at as created_at, s.position_label, s.date, w.name as counterparty_name
     FROM applications a
     JOIN shifts s ON s.id = a.shift_id
     JOIN workers w ON w.id = a.worker_id
     WHERE s.company_id = ? AND a.rating IS NOT NULL
     ORDER BY a.id DESC LIMIT 50`,
  )
    .bind(id)
    .all<AdminReviewRow>();

  const { results: reviewsGiven } = await c.env.DB.prepare(
    `SELECT a.id, a.employer_rating as rating, a.employer_review_tags as tags, a.employer_review_comment as comment,
            a.closed_by_employer_at as created_at, s.position_label, s.date, w.name as counterparty_name
     FROM applications a
     JOIN shifts s ON s.id = a.shift_id
     JOIN workers w ON w.id = a.worker_id
     WHERE s.company_id = ? AND a.employer_rating IS NOT NULL
     ORDER BY a.closed_by_employer_at DESC LIMIT 50`,
  )
    .bind(id)
    .all<AdminReviewRow>();

  return c.json({
    company: {
      ...company,
      avatar_data: undefined,
      avatarUrl: company.avatar_data ? `/media/companies/${id}/avatar` : null,
    },
    photos: photoRows.map((p) => ({ id: p.id, url: `/media/companies/${id}/photos/${p.id}` })),
    // Дни разворачиваем здесь, а не в дашборде: на клиенте формат столбца
    // (пусто = отрезок, JSON = набор) знать незачем.
    vacancies: (vacancies as { date: string; end_date: string | null; dates?: string | null }[]).map((v) => ({
      ...v,
      days: expandDates(v.date, v.end_date, v.dates),
    })),
    reviewsReceived: reviewsReceived.map(reviewToJson),
    reviewsGiven: reviewsGiven.map(reviewToJson),
  });
});

/** Admin edits a person's own profile fields directly — same field set as
 *  their own "edit profile" screen, just driven from the dashboard. Kept
 *  behind blockUsers (not manageData): editing a typo in someone's name
 *  isn't the same risk class as hard-deleting their account. */
adminUserRoutes.patch('/seekers/:id', requirePermission('blockUsers'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const body = await c.req.json<{ name?: string; city?: string; bio?: string; skills?: string; birthdate?: string }>();

  const worker = await c.env.DB.prepare('SELECT name FROM workers WHERE id = ?').bind(id).first<{ name: string }>();
  if (!worker) return c.json({ error: 'not_found' }, 404);

  const fields: string[] = [];
  const binds: unknown[] = [];
  for (const key of ['name', 'city', 'bio', 'skills', 'birthdate'] as const) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      binds.push(body[key]);
    }
  }
  if (fields.length) {
    binds.push(id);
    await c.env.DB.prepare(`UPDATE workers SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
  }

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `отредактировала профиль соискателя ${body.name?.trim() || worker.name}`, 'neutral');
  return c.json({ ok: true });
});

adminUserRoutes.patch('/employers/:id', requirePermission('blockUsers'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const body = await c.req.json<{ name?: string; address?: string; city?: string; description?: string; foundedYear?: number }>();

  const company = await c.env.DB.prepare('SELECT name FROM companies WHERE id = ?').bind(id).first<{ name: string }>();
  if (!company) return c.json({ error: 'not_found' }, 404);

  const fields: string[] = [];
  const binds: unknown[] = [];
  for (const key of ['name', 'address', 'city', 'description'] as const) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      binds.push(body[key]);
    }
  }
  if (body.foundedYear !== undefined) {
    fields.push('founded_year = ?');
    binds.push(body.foundedYear);
  }
  if (fields.length) {
    binds.push(id);
    await c.env.DB.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
  }

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `отредактировала профиль работодателя ${body.name?.trim() || company.name}`, 'neutral');
  return c.json({ ok: true });
});

/** Hard delete — unlike block/unblock, this actually removes the row and,
 *  via ON DELETE CASCADE, everything hanging off it (applications, chats,
 *  notifications, favorites, positions, photos, support threads). Also
 *  clears their role-lock so if this Telegram id ever messages the bot
 *  again, it onboards clean instead of pointing at a deleted worker. */
adminUserRoutes.delete('/seekers/:id', requirePermission('manageData'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const worker = await c.env.DB.prepare('SELECT name, telegram_id FROM workers WHERE id = ?').bind(id).first<{
    name: string;
    telegram_id: number;
  }>();
  if (!worker) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare('DELETE FROM workers WHERE id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM telegram_accounts WHERE telegram_id = ?').bind(worker.telegram_id).run();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `удалила соискателя ${worker.name}`, 'danger');
  return c.json({ ok: true });
});

adminUserRoutes.delete('/employers/:id', requirePermission('manageData'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const company = await c.env.DB.prepare('SELECT name, owner_telegram_id FROM companies WHERE id = ?').bind(id).first<{
    name: string;
    owner_telegram_id: number;
  }>();
  if (!company) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare('DELETE FROM companies WHERE id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM telegram_accounts WHERE telegram_id = ?').bind(company.owner_telegram_id).run();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `удалила работодателя ${company.name}`, 'danger');
  return c.json({ ok: true });
});

/** Blocking now takes a reason, because the person is shown it: "вас
 *  заблокировали" with no explanation just turns into a support ticket.
 *  Required when blocking, ignored when lifting one. */
async function readBlockReason(c: { req: { json: () => Promise<unknown> } }): Promise<string> {
  const body = (await c.req.json().catch(() => ({}))) as { reason?: unknown };
  return typeof body.reason === 'string' ? body.reason.trim() : '';
}

adminUserRoutes.post('/seekers/:id/block', requirePermission('blockUsers'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const worker = await c.env.DB.prepare('SELECT name, status FROM workers WHERE id = ?').bind(id).first<{ name: string; status?: string }>();
  if (!worker) return c.json({ error: 'not_found' }, 404);

  const next = worker.status === 'suspended' ? 'active' : 'suspended';
  const reason = await readBlockReason(c);
  if (next === 'suspended' && !reason) return c.json({ error: 'reason_required' }, 400);

  await c.env.DB.prepare('UPDATE workers SET status = ?, suspended_reason = ?, suspended_at = ? WHERE id = ?')
    .bind(next, next === 'suspended' ? reason : null, next === 'suspended' ? new Date().toISOString() : null, id)
    .run();

  const actor = await actorLabel(c.env, session);
  await logAction(
    c.env,
    actor,
    next === 'suspended' ? `заблокировала ${worker.name} — «${reason}»` : `разблокировала ${worker.name}`,
    next === 'suspended' ? 'danger' : 'neutral',
  );
  return c.json({ ok: true, status: next, reason: next === 'suspended' ? reason : null });
});

/** Hiding an anketa is the step below blocking: the account keeps working
 *  normally — chats, shifts already agreed, reviews — it just stops being
 *  offered to employers in "найти сотрудников" and can't send new
 *  responses. Use it for a profile that isn't ban-worthy but shouldn't be
 *  in circulation (half-empty, someone else's photos, a duplicate).
 *
 *  The reason is optional here, unlike blocking, because hiding doesn't
 *  lock anyone out — but it is shown to the person if given, so they don't
 *  spend a week wondering why the invitations stopped. */
adminUserRoutes.post('/seekers/:id/hide', requirePermission('blockUsers'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');

  // Named rather than left to throw: without this an unapplied 0027 comes
  // back as a bare internal_error and the button just looks dead.
  if (!(await hiddenColumnExists(c.env))) {
    return c.json({ error: 'migration_required', migration: '0027_hidden_profiles' }, 400);
  }

  const worker = await c.env.DB.prepare('SELECT name, hidden FROM workers WHERE id = ?').bind(id).first<{ name: string; hidden: number }>();
  if (!worker) return c.json({ error: 'not_found' }, 404);

  const next = worker.hidden ? 0 : 1;
  const reason = await readBlockReason(c);

  await c.env.DB.prepare('UPDATE workers SET hidden = ?, hidden_reason = ?, hidden_at = ? WHERE id = ?')
    .bind(next, next ? reason || null : null, next ? new Date().toISOString() : null, id)
    .run();

  const actor = await actorLabel(c.env, session);
  await logAction(
    c.env,
    actor,
    next ? `скрыла анкету ${worker.name}${reason ? ` — «${reason}»` : ''}` : `вернула анкету ${worker.name} в поиск`,
    next ? 'danger' : 'neutral',
  );
  return c.json({ ok: true, hidden: !!next, reason: next ? reason || null : null });
});

adminUserRoutes.post('/employers/:id/block', requirePermission('blockUsers'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const company = await c.env.DB.prepare('SELECT name, status FROM companies WHERE id = ?').bind(id).first<{ name: string; status: string }>();
  if (!company) return c.json({ error: 'not_found' }, 404);

  const next = company.status === 'suspended' ? 'active' : 'suspended';
  const reason = await readBlockReason(c);
  if (next === 'suspended' && !reason) return c.json({ error: 'reason_required' }, 400);

  await c.env.DB.prepare('UPDATE companies SET status = ?, suspended_reason = ?, suspended_at = ? WHERE id = ?')
    .bind(next, next === 'suspended' ? reason : null, next === 'suspended' ? new Date().toISOString() : null, id)
    .run();

  const actor = await actorLabel(c.env, session);
  await logAction(
    c.env,
    actor,
    next === 'suspended' ? `заблокировала ${company.name} — «${reason}»` : `разблокировала ${company.name}`,
    next === 'suspended' ? 'danger' : 'neutral',
  );
  return c.json({ ok: true, status: next, reason: next === 'suspended' ? reason : null });
});

/** Wolso is one-account-one-role: a Telegram id is permanently locked to
 *  worker or employer at onboarding. Only staff with switchUserRole can
 *  move someone across — provisions the target role's row (if it doesn't
 *  exist yet) the same way onboarding would, so their next login just
 *  works. */
adminUserRoutes.post('/seekers/:id/switch-role', requirePermission('switchUserRole'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const worker = await c.env.DB.prepare('SELECT telegram_id, name FROM workers WHERE id = ?').bind(id).first<{
    telegram_id: number;
    name: string;
  }>();
  if (!worker) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare("INSERT OR REPLACE INTO telegram_accounts (telegram_id, active_role) VALUES (?, 'employer')")
    .bind(worker.telegram_id)
    .run();
  await provisionCompany(c.env, { id: worker.telegram_id, first_name: worker.name });

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `переключила ${worker.name} на роль работодателя`, 'neutral');
  return c.json({ ok: true });
});

adminUserRoutes.post('/employers/:id/switch-role', requirePermission('switchUserRole'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const company = await c.env.DB.prepare('SELECT owner_telegram_id, name FROM companies WHERE id = ?').bind(id).first<{
    owner_telegram_id: number;
    name: string;
  }>();
  if (!company) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare("INSERT OR REPLACE INTO telegram_accounts (telegram_id, active_role) VALUES (?, 'worker')")
    .bind(company.owner_telegram_id)
    .run();
  await provisionWorker(c.env, { id: company.owner_telegram_id, first_name: company.name }, company.name);

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `переключила ${company.name} на роль соискателя`, 'neutral');
  return c.json({ ok: true });
});

/** Inviting staff needs their numeric Telegram id up front (there's no
 *  email-based invite link flow yet) — ask the admin to grab it from
 *  @userinfobot or similar. The row is created with status 'invited' and
 *  flips to 'active' the moment that Telegram id logs in via the widget. */
adminUserRoutes.post('/team/invite', requirePermission('manageTeam'), async (c) => {
  const session = requireStaff(c as never)!;
  const { name, telegramId, roleId } = await c.req.json<{ name: string; telegramId: number; roleId: string }>();
  if (!name || !telegramId || !roleId) return c.json({ error: 'missing_fields' }, 400);

  const role = await c.env.DB.prepare('SELECT id FROM roles WHERE id = ?').bind(roleId).first();
  if (!role) return c.json({ error: 'unknown_role' }, 400);
  if (roleId === 'owner' && !(await canTouchOwnerRole(c.env, session))) {
    return c.json({ error: 'owner_transfer_requires_permission' }, 403);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM staff WHERE telegram_id = ?').bind(telegramId).first();
  if (existing) return c.json({ error: 'already_invited' }, 409);

  await c.env.DB.prepare(
    "INSERT INTO staff (telegram_id, name, role_id, status, since) VALUES (?, ?, ?, 'invited', ?)",
  )
    .bind(telegramId, name, roleId, new Date().getFullYear())
    .run();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `пригласила ${name} в команду`, 'neutral');
  return c.json({ ok: true });
});

adminUserRoutes.patch('/team/:id', requirePermission('manageTeam'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const { roleId } = await c.req.json<{ roleId: string }>();

  const member = await c.env.DB.prepare('SELECT name, role_id FROM staff WHERE id = ?').bind(id).first<{ name: string; role_id: string }>();
  if (!member) return c.json({ error: 'not_found' }, 404);

  // Touches the Owner role either way — promoting someone into it or
  // moving the current Owner out of it — needs transferOwnership, not
  // just manageTeam.
  if ((roleId === 'owner' || member.role_id === 'owner') && !(await canTouchOwnerRole(c.env, session))) {
    return c.json({ error: 'owner_transfer_requires_permission' }, 403);
  }
  if (member.role_id === 'owner' && roleId !== 'owner' && (await activeOwnerCount(c.env)) <= 1) {
    return c.json({ error: 'must_keep_one_owner' }, 400);
  }

  await c.env.DB.prepare('UPDATE staff SET role_id = ? WHERE id = ?').bind(roleId, id).run();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `изменила роль ${member.name} на «${roleId}»`, 'neutral');
  return c.json({ ok: true });
});

adminUserRoutes.post('/team/:id/revoke', requirePermission('manageTeam'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');

  const member = await c.env.DB.prepare('SELECT name, role_id FROM staff WHERE id = ?').bind(id).first<{ name: string; role_id: string }>();
  if (!member) return c.json({ error: 'not_found' }, 404);

  if (member.role_id === 'owner') {
    if (!(await canTouchOwnerRole(c.env, session))) return c.json({ error: 'owner_transfer_requires_permission' }, 403);
    if ((await activeOwnerCount(c.env)) <= 1) return c.json({ error: 'must_keep_one_owner' }, 400);
  }

  await c.env.DB.prepare("UPDATE staff SET status = 'suspended' WHERE id = ?").bind(id).run();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `отозвала доступ у ${member.name}`, 'danger');
  return c.json({ ok: true });
});

/** Переписка работодателя с соискателем — read-only, для разбора спора.
 *  Раньше у команды были только support-чаты, поэтому «он не вышел»
 *  против «меня не пустили» решалось наугад: сама переписка, где обычно и
 *  видно, кто что обещал, была недоступна.
 *
 *  Смотреть чужую переписку — сильное право, поэтому оно за тем же
 *  viewSupportChats, что и support-чаты, и каждый просмотр попадает в
 *  аудит-лог: за кем-то, кто читает чаты просто так, должен оставаться
 *  след. Писать в чужой чат нельзя — только читать. */
adminUserRoutes.get('/chats/:kind/:id', requirePermission('viewSupportChats'), async (c) => {
  const kind = c.req.param('kind');
  const id = c.req.param('id');
  if (kind !== 'seeker' && kind !== 'employer') return c.json({ error: 'not_found' }, 404);

  const column = kind === 'seeker' ? 'worker_id' : 'company_id';
  const { results: chats } = await c.env.DB.prepare(
    `SELECT ch.id, ch.shift_id, w.name as worker_name, co.name as company_name,
            s.position_label, s.date,
            (SELECT COUNT(*) FROM messages m WHERE m.chat_id = ch.id) as message_count,
            (SELECT MAX(created_at) FROM messages m WHERE m.chat_id = ch.id) as last_at
     FROM chats ch
     JOIN workers w ON w.id = ch.worker_id
     JOIN companies co ON co.id = ch.company_id
     LEFT JOIN shifts s ON s.id = ch.shift_id
     WHERE ch.${column} = ?
     ORDER BY last_at DESC NULLS LAST, ch.id DESC
     LIMIT 50`,
  )
    .bind(id)
    .all();

  return c.json({ chats });
});

/** Отдельный путь, а не /chats/messages/:id: Hono сопоставил бы его с
 *  /chats/:kind/:id выше (kind = "messages"), и вместо переписки всегда
 *  приходило бы «not_found». */
adminUserRoutes.get('/chat-messages/:chatId', requirePermission('viewSupportChats'), async (c) => {
  const session = requireStaff(c as never)!;
  const chatId = c.req.param('chatId');

  const chat = await c.env.DB.prepare(
    `SELECT ch.id, w.name as worker_name, co.name as company_name
     FROM chats ch JOIN workers w ON w.id = ch.worker_id JOIN companies co ON co.id = ch.company_id
     WHERE ch.id = ?`,
  )
    .bind(chatId)
    .first<{ id: number; worker_name: string; company_name: string }>();
  if (!chat) return c.json({ error: 'not_found' }, 404);

  const { results: messages } = await c.env.DB.prepare(
    'SELECT id, sender, kind, text, visible_to, created_at FROM messages WHERE chat_id = ? ORDER BY created_at ASC LIMIT 500',
  )
    .bind(chatId)
    .all();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `открыла переписку ${chat.worker_name} и «${chat.company_name}»`, 'neutral');

  return c.json({ chat, messages });
});

/** Заметки команды по человеку. История решений («звонил, обещал заменить
 *  фото») до сих пор жила в голове того, кто решал, — а решают по очереди
 *  разные люди. */
adminUserRoutes.get('/notes/:kind/:id', requireStaffMiddleware, async (c) => {
  if (!(await userNotesTableExists(c.env))) return c.json({ notes: [] });
  const kind = c.req.param('kind');
  const column = kind === 'seeker' ? 'worker_id' : 'company_id';
  const { results } = await c.env.DB.prepare(
    `SELECT id, text, author_name, created_at FROM user_notes WHERE ${column} = ? ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(c.req.param('id'))
    .all();
  return c.json({ notes: results });
});

adminUserRoutes.post('/notes/:kind/:id', requirePermission('blockUsers'), async (c) => {
  const session = requireStaff(c as never)!;
  if (!(await userNotesTableExists(c.env))) {
    return c.json({ error: 'migration_required', migration: '0031_complaints_and_employer_settings' }, 400);
  }
  const kind = c.req.param('kind');
  if (kind !== 'seeker' && kind !== 'employer') return c.json({ error: 'not_found' }, 404);

  type Body = { text?: string };
  const { text } = await c.req.json<Body>().catch((): Body => ({}));
  const note = (text ?? '').trim();
  if (!note) return c.json({ error: 'empty_note' }, 400);

  const actor = await actorLabel(c.env, session);
  await c.env.DB.prepare(
    `INSERT INTO user_notes (subject_kind, worker_id, company_id, text, author_name) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(kind, kind === 'seeker' ? c.req.param('id') : null, kind === 'employer' ? c.req.param('id') : null, note.slice(0, 2000), actor.name)
    .run();

  return c.json({ ok: true });
});

adminUserRoutes.delete('/notes/:id', requirePermission('blockUsers'), async (c) => {
  if (!(await userNotesTableExists(c.env))) return c.json({ ok: true });
  await c.env.DB.prepare('DELETE FROM user_notes WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

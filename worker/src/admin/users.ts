import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, actorLabel, logAction, requirePermission, requireStaff, requireStaffMiddleware, staffHasPermission } from '../middleware/auth';
import { provisionWorker, provisionCompany } from '../routes/auth';
import { getTelegramUsername } from '../lib/telegramBot';

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

  return c.json({
    worker: {
      ...worker,
      avatar_data: undefined,
      avatarUrl: worker.avatar_data ? `/media/workers/${id}/avatar` : worker.photo_url,
    },
    positions,
    photos: photoRows.map((p) => ({ id: p.id, url: `/media/workers/${id}/photos/${p.id}` })),
    applications,
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
  const { results: vacancies } = await c.env.DB.prepare(
    `SELECT s.id, s.position_label, s.date, s.end_date, s.status,
            (SELECT COUNT(*) FROM applications a WHERE a.shift_id = s.id) as response_count
     FROM shifts s WHERE s.company_id = ? ORDER BY s.created_at DESC LIMIT 50`,
  )
    .bind(id)
    .all();

  return c.json({
    company: {
      ...company,
      avatar_data: undefined,
      avatarUrl: company.avatar_data ? `/media/companies/${id}/avatar` : null,
    },
    photos: photoRows.map((p) => ({ id: p.id, url: `/media/companies/${id}/photos/${p.id}` })),
    vacancies,
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

adminUserRoutes.post('/seekers/:id/block', requirePermission('blockUsers'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const worker = await c.env.DB.prepare('SELECT name, status FROM workers WHERE id = ?').bind(id).first<{ name: string; status?: string }>();
  if (!worker) return c.json({ error: 'not_found' }, 404);

  const next = worker.status === 'suspended' ? 'active' : 'suspended';
  await c.env.DB.prepare('UPDATE workers SET status = ? WHERE id = ?').bind(next, id).run();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `${next === 'suspended' ? 'заблокировала' : 'разблокировала'} ${worker.name}`, next === 'suspended' ? 'danger' : 'neutral');
  return c.json({ ok: true, status: next });
});

adminUserRoutes.post('/employers/:id/block', requirePermission('blockUsers'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const company = await c.env.DB.prepare('SELECT name, status FROM companies WHERE id = ?').bind(id).first<{ name: string; status: string }>();
  if (!company) return c.json({ error: 'not_found' }, 404);

  const next = company.status === 'suspended' ? 'active' : 'suspended';
  await c.env.DB.prepare('UPDATE companies SET status = ? WHERE id = ?').bind(next, id).run();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `${next === 'suspended' ? 'заблокировала' : 'разблокировала'} ${company.name}`, next === 'suspended' ? 'danger' : 'neutral');
  return c.json({ ok: true, status: next });
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

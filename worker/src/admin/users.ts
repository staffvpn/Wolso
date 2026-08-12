import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, actorLabel, logAction, requirePermission, requireStaff, requireStaffMiddleware, staffHasPermission } from '../middleware/auth';
import { provisionWorker, provisionCompany } from '../routes/auth';

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

adminUserRoutes.get('/seekers', requireStaffMiddleware, async (c) => {
  const search = c.req.query('q');
  const sql = search
    ? 'SELECT * FROM workers WHERE name LIKE ? ORDER BY created_at DESC LIMIT 200'
    : 'SELECT * FROM workers ORDER BY created_at DESC LIMIT 200';
  const { results } = await (search ? c.env.DB.prepare(sql).bind(`%${search}%`) : c.env.DB.prepare(sql)).all();
  return c.json({ seekers: results });
});

adminUserRoutes.get('/employers', requireStaffMiddleware, async (c) => {
  const search = c.req.query('q');
  const sql = search
    ? 'SELECT * FROM companies WHERE name LIKE ? ORDER BY created_at DESC LIMIT 200'
    : 'SELECT * FROM companies ORDER BY created_at DESC LIMIT 200';
  const { results } = await (search ? c.env.DB.prepare(sql).bind(`%${search}%`) : c.env.DB.prepare(sql)).all();
  return c.json({ employers: results });
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

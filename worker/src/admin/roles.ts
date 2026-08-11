import { Hono } from 'hono';
import type { Env, PermissionKey, PermissionValue, SessionPayload } from '../types';
import { attachSession, actorLabel, logAction, requirePermission, requireStaff, requireStaffMiddleware } from '../middleware/auth';

export const adminRoleRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminRoleRoutes.use('*', attachSession);

interface RoleRow {
  id: string;
  name: string;
  description: string;
  is_system: number;
  color: string;
  permissions: string;
}

adminRoleRoutes.get('/', requireStaffMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM roles').all<RoleRow>();
  const roles = results.map((r) => ({ ...r, permissions: JSON.parse(r.permissions) }));

  const counts = await c.env.DB.prepare('SELECT role_id, COUNT(*) as n FROM staff GROUP BY role_id').all<{ role_id: string; n: number }>();
  const countMap = Object.fromEntries(counts.results.map((r) => [r.role_id, r.n]));

  return c.json({ roles: roles.map((r) => ({ ...r, memberCount: countMap[r.id] ?? 0 })) });
});

adminRoleRoutes.post('/', requirePermission('manageTeam'), async (c) => {
  const session = requireStaff(c as never)!;
  const { name, description, permissions } = await c.req.json<{
    name: string;
    description: string;
    permissions: Record<PermissionKey, PermissionValue>;
  }>();
  if (!name) return c.json({ error: 'missing_name' }, 400);

  const id = `custom-${Date.now()}`;
  await c.env.DB.prepare('INSERT INTO roles (id, name, description, is_system, color, permissions) VALUES (?, ?, ?, 0, ?, ?)')
    .bind(id, name, description ?? '', '#6b6d76', JSON.stringify({ ...permissions, transferOwnership: 'no' }))
    .run();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `создала роль «${name}»`, 'neutral');
  return c.json({ id });
});

adminRoleRoutes.patch('/:id/permissions', requirePermission('manageTeam'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  if (id === 'owner') return c.json({ error: 'owner_role_is_fixed' }, 400);

  const { key, value } = await c.req.json<{ key: PermissionKey; value: PermissionValue }>();
  if (key === 'transferOwnership') return c.json({ error: 'owner_only_permission' }, 400);

  const role = await c.env.DB.prepare('SELECT * FROM roles WHERE id = ?').bind(id).first<{ name: string; permissions: string }>();
  if (!role) return c.json({ error: 'not_found' }, 404);

  const permissions = JSON.parse(role.permissions);
  permissions[key] = value;
  await c.env.DB.prepare('UPDATE roles SET permissions = ? WHERE id = ?').bind(JSON.stringify(permissions), id).run();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `изменила право «${key}» у роли «${role.name}»`, 'neutral');
  return c.json({ ok: true });
});

adminRoleRoutes.get('/two-factor', requireStaffMiddleware, async (c) => {
  const row = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'two_factor_required'").first<{ value: string }>();
  return c.json({ required: row?.value !== 'false' });
});

adminRoleRoutes.put('/two-factor', requirePermission('manageTeam'), async (c) => {
  const { required } = await c.req.json<{ required: boolean }>();
  await c.env.DB.prepare("UPDATE settings SET value = ? WHERE key = 'two_factor_required'").bind(String(required)).run();
  return c.json({ ok: true });
});

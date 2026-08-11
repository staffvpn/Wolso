import type { Context, Next } from 'hono';
import type { Env, PermissionKey, PermissionValue, SessionPayload } from '../types';
import { verifySession } from '../lib/session';

type Vars = { session: SessionPayload | null };

/** Parses and verifies the Bearer session token, if any. Never rejects by itself. */
export async function attachSession(c: Context<{ Bindings: Env; Variables: Vars }>, next: Next) {
  const auth = c.req.header('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const session = await verifySession(token, c.env.SESSION_SECRET);
  c.set('session', session);
  await next();
}

export function requireWorker(c: Context<{ Bindings: Env; Variables: Vars }>) {
  const session = c.get('session');
  if (!session || session.kind !== 'worker') return null;
  return session;
}

export function requireCompany(c: Context<{ Bindings: Env; Variables: Vars }>) {
  const session = c.get('session');
  if (!session || session.kind !== 'company') return null;
  return session;
}

export function requireStaff(c: Context<{ Bindings: Env; Variables: Vars }>) {
  const session = c.get('session');
  if (!session || session.kind !== 'staff') return null;
  return session;
}

/** Middleware form of requireStaff — for routes that need "any logged-in
 *  staff member", no specific permission. */
export async function requireStaffMiddleware(c: Context<{ Bindings: Env; Variables: Vars }>, next: Next) {
  if (!requireStaff(c)) return c.json({ error: 'auth_required' }, 401);
  await next();
}

/** Loads the role row for the current staff session and checks a permission. */
export async function staffHasPermission(env: Env, roleId: string, key: PermissionKey): Promise<PermissionValue | null> {
  const row = await env.DB.prepare('SELECT permissions FROM roles WHERE id = ?').bind(roleId).first<{ permissions: string }>();
  if (!row) return null;
  const perms = JSON.parse(row.permissions) as Record<PermissionKey, PermissionValue>;
  return perms[key] ?? 'no';
}

/** Hono middleware: 401s with no/invalid session, 403s if the role lacks `key`
 *  entirely (value 'no'). A 'confirm' value is let through — the client is
 *  expected to have shown its own confirmation step; the server just logs it. */
export function requirePermission(key: PermissionKey) {
  return async (c: Context<{ Bindings: Env; Variables: Vars }>, next: Next) => {
    const session = requireStaff(c);
    if (!session) return c.json({ error: 'auth_required' }, 401);
    const value = await staffHasPermission(c.env, session.roleId, key);
    if (!value || value === 'no') return c.json({ error: 'forbidden' }, 403);
    await next();
  };
}

export async function actorLabel(env: Env, session: Extract<SessionPayload, { kind: 'staff' }>) {
  const staff = await env.DB.prepare(
    'SELECT s.name as name, r.name as role_name FROM staff s JOIN roles r ON r.id = s.role_id WHERE s.id = ?',
  )
    .bind(session.staffId)
    .first<{ name: string; role_name: string }>();
  return { name: staff?.name ?? 'Staff', role: staff?.role_name ?? session.roleId };
}

export async function logAction(env: Env, actor: { name: string; role: string }, action: string, tone: 'neutral' | 'danger' | 'accent' = 'neutral') {
  await env.DB.prepare('INSERT INTO audit_log (actor_name, actor_role_label, action, tone) VALUES (?, ?, ?, ?)')
    .bind(actor.name, actor.role, action, tone)
    .run();
}

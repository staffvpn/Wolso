import { Hono } from 'hono';
import type { Env } from '../types';
import { verifyInitData, verifyLoginWidget, type TelegramUser } from '../lib/telegramAuth';
import { signSession } from '../lib/session';

export const authRoutes = new Hono<{ Bindings: Env }>();

const DEFAULT_POSITIONS = [{ position: 'barista', position_label: 'Бариста', months: 0 }];

/** Exported so admin/users.ts's role-switch action can provision the
 *  target role's row the same way onboarding does. */
export async function provisionWorker(env: Env, user: TelegramUser, name: string): Promise<number> {
  let worker = await env.DB.prepare('SELECT id FROM workers WHERE telegram_id = ?').bind(user.id).first<{ id: number }>();
  if (worker) return worker.id;

  const referralCode = `${(user.username ?? user.first_name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}${user.id % 100}`;
  const inserted = await env.DB.prepare(
    'INSERT INTO workers (telegram_id, name, photo_url, referral_code) VALUES (?, ?, ?, ?) RETURNING id',
  )
    .bind(user.id, name, user.photo_url ?? null, referralCode)
    .first<{ id: number }>();
  worker = inserted!;
  for (const p of DEFAULT_POSITIONS) {
    await env.DB.prepare('INSERT INTO worker_positions (worker_id, position, position_label, months) VALUES (?, ?, ?, ?)')
      .bind(worker.id, p.position, p.position_label, p.months)
      .run();
  }
  return worker.id;
}

export async function provisionCompany(env: Env, user: TelegramUser): Promise<number> {
  let company = await env.DB.prepare('SELECT id FROM companies WHERE owner_telegram_id = ?').bind(user.id).first<{ id: number }>();
  if (company) return company.id;

  const inserted = await env.DB.prepare(
    'INSERT INTO companies (owner_telegram_id, name, logo_initial) VALUES (?, ?, ?) RETURNING id',
  )
    .bind(user.id, `Компания ${user.first_name}`, (user.first_name?.[0] ?? 'W').toUpperCase())
    .first<{ id: number }>();
  return inserted!.id;
}

async function issueSessionForRole(env: Env, user: TelegramUser, name: string, role: 'worker' | 'employer') {
  if (role === 'worker') {
    const workerId = await provisionWorker(env, user, name);
    const workerToken = await signSession({ kind: 'worker', workerId, telegramId: user.id }, env.SESSION_SECRET);
    return { role, workerToken };
  }
  const companyId = await provisionCompany(env, user);
  const companyToken = await signSession({ kind: 'company', companyId, telegramId: user.id }, env.SESSION_SECRET);
  return { role, companyToken };
}

/** Mini App entry point: verifies initData, then looks up which role this
 *  Telegram account is permanently locked to (one account = one role,
 *  chosen once at onboarding — see /choose-role). A brand-new account has
 *  no lock yet and gets told to choose; the client shows the onboarding
 *  screen for that. Pre-existing accounts from before this lock existed
 *  are backfilled here (worker takes priority if somehow both exist). */
authRoutes.post('/telegram', async (c) => {
  const { initData } = await c.req.json<{ initData: string }>().catch(() => ({ initData: '' }));
  const user = await verifyInitData(initData, c.env.BOT_TOKEN);
  if (!user) return c.json({ error: 'invalid_init_data' }, 401);

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const telegramUser = { id: user.id, name, photoUrl: user.photo_url };

  let account = await c.env.DB.prepare('SELECT active_role FROM telegram_accounts WHERE telegram_id = ?')
    .bind(user.id)
    .first<{ active_role: 'worker' | 'employer' }>();

  if (!account) {
    const existingWorker = await c.env.DB.prepare('SELECT id FROM workers WHERE telegram_id = ?').bind(user.id).first();
    const existingCompany = await c.env.DB.prepare('SELECT id FROM companies WHERE owner_telegram_id = ?').bind(user.id).first();
    if (existingWorker || existingCompany) {
      const role: 'worker' | 'employer' = existingWorker ? 'worker' : 'employer';
      await c.env.DB.prepare('INSERT INTO telegram_accounts (telegram_id, active_role) VALUES (?, ?)').bind(user.id, role).run();
      account = { active_role: role };
    } else {
      return c.json({ needsRoleChoice: true, telegramUser });
    }
  }

  const session = await issueSessionForRole(c.env, user, name, account.active_role);
  return c.json({ ...session, telegramUser });
});

/** First-time role choice — permanent until a staff member with
 *  switchUserRole flips it (see admin/users.ts). */
authRoutes.post('/choose-role', async (c) => {
  const { initData, role } = await c.req.json<{ initData: string; role: 'worker' | 'employer' }>().catch(() => ({
    initData: '',
    role: undefined as unknown as 'worker' | 'employer',
  }));
  if (role !== 'worker' && role !== 'employer') return c.json({ error: 'invalid_role' }, 400);

  const user = await verifyInitData(initData, c.env.BOT_TOKEN);
  if (!user) return c.json({ error: 'invalid_init_data' }, 401);

  const existing = await c.env.DB.prepare('SELECT active_role FROM telegram_accounts WHERE telegram_id = ?').bind(user.id).first();
  if (existing) return c.json({ error: 'role_already_set' }, 409);

  await c.env.DB.prepare('INSERT INTO telegram_accounts (telegram_id, active_role) VALUES (?, ?)').bind(user.id, role).run();

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const session = await issueSessionForRole(c.env, user, name, role);
  return c.json({ ...session, telegramUser: { id: user.id, name, photoUrl: user.photo_url } });
});

/** Admin login via the Telegram Login Widget. Only known `staff` rows can
 *  get in — except the very first login from OWNER_TELEGRAM_ID, which
 *  bootstraps the Owner row so there's a way in at all. */
authRoutes.post('/telegram-login', async (c) => {
  const body = await c.req.json<Record<string, string>>().catch(() => ({}));
  const user = await verifyLoginWidget(body, c.env.BOT_TOKEN);
  if (!user) return c.json({ error: 'invalid_login_payload' }, 401);

  let staff = await c.env.DB.prepare('SELECT id, role_id, status, name FROM staff WHERE telegram_id = ?')
    .bind(user.id)
    .first<{ id: number; role_id: string; status: string; name: string }>();

  if (!staff && c.env.OWNER_TELEGRAM_ID && String(user.id) === c.env.OWNER_TELEGRAM_ID) {
    const ownerExists = await c.env.DB.prepare("SELECT id FROM staff WHERE role_id = 'owner'").first();
    if (!ownerExists) {
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
      const inserted = await c.env.DB.prepare(
        "INSERT INTO staff (telegram_id, name, role_id, status, since) VALUES (?, ?, 'owner', 'active', ?) RETURNING id, role_id, status, name",
      )
        .bind(user.id, name, new Date().getFullYear())
        .first<{ id: number; role_id: string; status: string; name: string }>();
      staff = inserted!;
    }
  }

  if (!staff) return c.json({ error: 'not_staff' }, 403);
  if (staff.status === 'suspended') return c.json({ error: 'access_revoked' }, 403);

  if (staff.status === 'invited') {
    await c.env.DB.prepare("UPDATE staff SET status = 'active', telegram_id = ? WHERE id = ?").bind(user.id, staff.id).run();
  }

  const token = await signSession({ kind: 'staff', staffId: staff.id, telegramId: user.id, roleId: staff.role_id }, c.env.SESSION_SECRET);
  return c.json({ token, staff: { id: staff.id, name: staff.name, roleId: staff.role_id } });
});

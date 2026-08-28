import { Hono } from 'hono';
import type { Env } from '../types';
import { verifyInitData, verifyLoginWidget, type TelegramUser } from '../lib/telegramAuth';
import { signSession } from '../lib/session';
import { notifyAdmin, adminNotifyHandle } from '../lib/adminNotify';

export const authRoutes = new Hono<{ Bindings: Env }>();

const DEFAULT_POSITIONS = [{ position: 'barista', position_label: 'Бариста', months: 0 }];

/** The suspension on this Telegram id's active role, if any. */
async function suspensionFor(
  env: Env,
  telegramId: number,
  role: 'worker' | 'employer',
): Promise<{ reason: string | null; at: string | null } | null> {
  const row =
    role === 'worker'
      ? await env.DB.prepare('SELECT status, suspended_reason, suspended_at FROM workers WHERE telegram_id = ?')
          .bind(telegramId)
          .first<{ status: string; suspended_reason: string | null; suspended_at: string | null }>()
      : await env.DB.prepare('SELECT status, suspended_reason, suspended_at FROM companies WHERE owner_telegram_id = ?')
          .bind(telegramId)
          .first<{ status: string; suspended_reason: string | null; suspended_at: string | null }>();

  if (!row || row.status !== 'suspended') return null;
  return { reason: row.suspended_reason, at: row.suspended_at };
}

/** Exported so admin/users.ts's role-switch action can provision the
 *  target role's row the same way onboarding does — that path deliberately
 *  still passes a name (carried over from the person's other role), but
 *  fresh registration (see /choose-role below) always passes '': a
 *  worker's real name has to be typed in on the onboarding screen, not
 *  quietly inherited from their Telegram profile. */
export async function provisionWorker(env: Env, user: TelegramUser, name: string): Promise<number> {
  let worker = await env.DB.prepare('SELECT id FROM workers WHERE telegram_id = ?').bind(user.id).first<{ id: number }>();
  if (worker) return worker.id;

  const referralCode = `${(user.username ?? user.first_name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}${user.id % 100}`;
  const inserted = await env.DB.prepare(
    // rating 0, not the table's legacy 5.0 default — a brand-new account
    // hasn't earned a score yet, and the UI renders 0 as "нет оценок"
    // rather than a fake perfect five.
    'INSERT INTO workers (telegram_id, name, photo_url, referral_code, telegram_username, rating) VALUES (?, ?, ?, ?, ?, 0) RETURNING id',
  )
    .bind(user.id, name, user.photo_url ?? null, referralCode, user.username ?? null)
    .first<{ id: number }>();
  worker = inserted!;
  for (const p of DEFAULT_POSITIONS) {
    await env.DB.prepare('INSERT INTO worker_positions (worker_id, position, position_label, months) VALUES (?, ?, ?, ?)')
      .bind(worker.id, p.position, p.position_label, p.months)
      .run();
  }
  return worker.id;
}

/** Deliberately no name/logo_initial derived from the Telegram account —
 *  an employer's "name" is the venue's name, not the owner's, so it has
 *  to start blank and get filled in on the onboarding screen rather than
 *  quietly inheriting the owner's personal Telegram identity. */
export async function provisionCompany(env: Env, user: TelegramUser): Promise<number> {
  let company = await env.DB.prepare('SELECT id FROM companies WHERE owner_telegram_id = ?').bind(user.id).first<{ id: number }>();
  if (company) return company.id;

  const inserted = await env.DB.prepare('INSERT INTO companies (owner_telegram_id, name, telegram_username, rating) VALUES (?, ?, ?, 0) RETURNING id')
    .bind(user.id, '', user.username ?? null)
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

  // Telegram usernames can change — keep the admin dashboard's copy fresh
  // on every real login instead of only capturing it once at signup.
  // Harmless no-op against whichever table doesn't have a matching row.
  c.executionCtx.waitUntil(
    Promise.all([
      c.env.DB.prepare('UPDATE workers SET telegram_username = ? WHERE telegram_id = ?').bind(user.username ?? null, user.id).run(),
      c.env.DB.prepare('UPDATE companies SET telegram_username = ? WHERE owner_telegram_id = ?').bind(user.username ?? null, user.id).run(),
    ]),
  );

  // Refused before any token is issued, and with the reason attached, so
  // the app can explain the block instead of just failing. The middleware
  // in index.ts covers sessions that were already open when the block
  // happened; this covers the next launch.
  const suspension = await suspensionFor(c.env, user.id, account.active_role);
  if (suspension) {
    return c.json({ error: 'account_suspended', reason: suspension.reason, suspendedAt: suspension.at }, 403);
  }

  // This only ever actually provisions a row for pre-existing accounts
  // being backfilled into telegram_accounts for the first time (a brand
  // new account with no row yet returns needsRoleChoice above instead) —
  // '' here is a no-op in that case since provisionWorker/provisionCompany
  // both bail out early once the row already exists.
  const session = await issueSessionForRole(c.env, user, '', account.active_role);
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

  // This is the one moment an account is genuinely new — /telegram above
  // runs on every launch, so alerting there would fire on every open.
  c.executionCtx.waitUntil(
    notifyAdmin(
      c.env,
      `👤 Новый пользователь\n${name || 'Без имени'} · ${adminNotifyHandle(user.username, user.id)}\nРоль: ${role === 'worker' ? 'соискатель' : 'работодатель'}`,
    ),
  );
  // '' — not `name` — for provisioning: a fresh worker/company profile
  // starts blank (see provisionWorker/provisionCompany above) rather than
  // pre-filling from the Telegram account. `name` still goes out on
  // telegramUser below, unrelated to the stored profile.
  const session = await issueSessionForRole(c.env, user, '', role);
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

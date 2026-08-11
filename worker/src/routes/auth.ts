import { Hono } from 'hono';
import type { Env } from '../types';
import { verifyInitData, verifyLoginWidget } from '../lib/telegramAuth';
import { signSession } from '../lib/session';

export const authRoutes = new Hono<{ Bindings: Env }>();

const DEFAULT_POSITIONS = [{ position: 'barista', position_label: 'Бариста', years: 0 }];
const DEFAULT_DOCS: [string, string][] = [
  ['passport', 'Паспорт'],
  ['medbook', 'Медицинская книжка'],
  ['certificate', 'Сертификаты'],
];

/** Mini App entry point: verifies initData, auto-provisions a worker profile
 *  (every Telegram user gets one) and a company profile (created lazily so
 *  "Я ищу сотрудников" works with zero extra forms, matching the current
 *  onboarding UI). Returns both session tokens; the client picks which one
 *  to use for a given screen based on the role toggle already in the UI. */
authRoutes.post('/telegram', async (c) => {
  const { initData } = await c.req.json<{ initData: string }>().catch(() => ({ initData: '' }));
  const user = await verifyInitData(initData, c.env.BOT_TOKEN);
  if (!user) return c.json({ error: 'invalid_init_data' }, 401);

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');

  let worker = await c.env.DB.prepare('SELECT id FROM workers WHERE telegram_id = ?').bind(user.id).first<{ id: number }>();
  if (!worker) {
    const referralCode = `${(user.username ?? user.first_name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}${user.id % 100}`;
    const inserted = await c.env.DB.prepare(
      'INSERT INTO workers (telegram_id, name, photo_url, referral_code) VALUES (?, ?, ?, ?) RETURNING id',
    )
      .bind(user.id, name, user.photo_url ?? null, referralCode)
      .first<{ id: number }>();
    worker = inserted!;
    for (const p of DEFAULT_POSITIONS) {
      await c.env.DB.prepare('INSERT INTO worker_positions (worker_id, position, position_label, years) VALUES (?, ?, ?, ?)')
        .bind(worker.id, p.position, p.position_label, p.years)
        .run();
    }
    for (const [docType, label] of DEFAULT_DOCS) {
      await c.env.DB.prepare('INSERT INTO worker_documents (worker_id, doc_type, label, status) VALUES (?, ?, ?, ?)')
        .bind(worker.id, docType, label, 'missing')
        .run();
    }
  }

  let company = await c.env.DB.prepare('SELECT id FROM companies WHERE owner_telegram_id = ?').bind(user.id).first<{ id: number }>();
  if (!company) {
    const inserted = await c.env.DB.prepare(
      'INSERT INTO companies (owner_telegram_id, name, logo_initial) VALUES (?, ?, ?) RETURNING id',
    )
      .bind(user.id, `Компания ${user.first_name}`, (user.first_name?.[0] ?? 'W').toUpperCase())
      .first<{ id: number }>();
    company = inserted!;
  }

  const workerToken = await signSession({ kind: 'worker', workerId: worker.id, telegramId: user.id }, c.env.SESSION_SECRET);
  const companyToken = await signSession({ kind: 'company', companyId: company.id, telegramId: user.id }, c.env.SESSION_SECRET);

  return c.json({ workerToken, companyToken, telegramUser: { id: user.id, name, photoUrl: user.photo_url } });
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

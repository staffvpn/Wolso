import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, actorLabel, logAction, requirePermission, requireStaff } from '../middleware/auth';
import { sendTelegramMessage } from '../lib/telegramBot';
import { verifyCompanyWithAI } from '../lib/aiVerification';

export const adminVerificationRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminVerificationRoutes.use('*', attachSession);

interface EmployerVerificationRow {
  id: number;
  name: string;
  inn: string | null;
  city: string;
  address: string | null;
  description: string;
  founded_year: number | null;
  avatar_data: unknown;
  owner_telegram_id: number;
  telegram_username: string | null;
  verification_status: string;
  verification_reason: string | null;
  ai_verification_summary: string | null;
  ai_verification_checked_at: string | null;
  created_at: string;
}

function toJson(row: EmployerVerificationRow) {
  return {
    id: row.id,
    name: row.name,
    inn: row.inn,
    city: row.city,
    address: row.address,
    description: row.description,
    foundedYear: row.founded_year,
    avatarUrl: row.avatar_data ? `/media/companies/${row.id}/avatar` : null,
    telegramId: row.owner_telegram_id,
    telegramUsername: row.telegram_username,
    status: row.verification_status,
    rejectionReason: row.verification_reason,
    aiSummary: row.ai_verification_summary,
    aiCheckedAt: row.ai_verification_checked_at,
    createdAt: row.created_at,
  };
}

/** Reuses approveVacancies — same "content moderation" bucket as approving
 *  a vacancy, rather than a brand-new permission just for this. */
adminVerificationRoutes.get('/employers', requirePermission('approveVacancies'), async (c) => {
  const status = c.req.query('status') ?? 'pending';
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, inn, city, address, description, founded_year, avatar_data, owner_telegram_id, telegram_username,
            verification_status, verification_reason, ai_verification_summary, ai_verification_checked_at, created_at
     FROM companies WHERE verification_status = ? ORDER BY created_at ASC`,
  )
    .bind(status)
    .all<EmployerVerificationRow>();
  return c.json({ employers: results.map(toJson) });
});

/** Manual re-run — for when the automatic check (fired at profile
 *  completion) failed, or an admin wants a fresh look before deciding.
 *  Runs synchronously so the summary is ready by the time this returns. */
adminVerificationRoutes.post('/employers/:id/recheck', requirePermission('approveVacancies'), async (c) => {
  const id = c.req.param('id');
  const company = await c.env.DB.prepare('SELECT id, name, inn, city, address FROM companies WHERE id = ?').bind(id).first<{
    id: number;
    name: string;
    inn: string | null;
    city: string;
    address: string | null;
  }>();
  if (!company) return c.json({ error: 'not_found' }, 404);

  const summary = await verifyCompanyWithAI(c.env, company);
  if (!summary) return c.json({ error: 'ai_unavailable' }, 503);

  await c.env.DB.prepare("UPDATE companies SET ai_verification_summary = ?, ai_verification_checked_at = datetime('now') WHERE id = ?")
    .bind(summary, id)
    .run();
  return c.json({ aiSummary: summary });
});

adminVerificationRoutes.post('/employers/:id/approve', requirePermission('approveVacancies'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const company = await c.env.DB.prepare('SELECT name, owner_telegram_id FROM companies WHERE id = ?').bind(id).first<{
    name: string;
    owner_telegram_id: number;
  }>();
  if (!company) return c.json({ error: 'not_found' }, 404);

  const actor = await actorLabel(c.env, session);
  await c.env.DB.prepare(
    `UPDATE companies SET verification_status = 'approved', verification_reason = NULL,
       verification_reviewed_by = ?, verification_reviewed_at = datetime('now') WHERE id = ?`,
  )
    .bind(actor.name, id)
    .run();

  await logAction(c.env, actor, `одобрила работодателя «${company.name || 'без названия'}»`, 'accent');
  c.executionCtx.waitUntil(
    sendTelegramMessage(
      c.env,
      company.owner_telegram_id,
      `✅ Ваша компания «${company.name}» прошла проверку — теперь можно публиковать вакансии и смотреть анкеты соискателей.`,
    ),
  );
  return c.json({ ok: true });
});

adminVerificationRoutes.post('/employers/:id/reject', requirePermission('approveVacancies'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const { reason } = await c.req.json<{ reason: string }>();
  if (!reason?.trim()) return c.json({ error: 'reason_required' }, 400);

  const company = await c.env.DB.prepare('SELECT name, owner_telegram_id FROM companies WHERE id = ?').bind(id).first<{
    name: string;
    owner_telegram_id: number;
  }>();
  if (!company) return c.json({ error: 'not_found' }, 404);

  const actor = await actorLabel(c.env, session);
  await c.env.DB.prepare(
    `UPDATE companies SET verification_status = 'rejected', verification_reason = ?,
       verification_reviewed_by = ?, verification_reviewed_at = datetime('now') WHERE id = ?`,
  )
    .bind(reason.trim(), actor.name, id)
    .run();

  await logAction(c.env, actor, `отклонила проверку работодателя «${company.name || 'без названия'}»: ${reason.trim()}`, 'danger');
  c.executionCtx.waitUntil(
    sendTelegramMessage(
      c.env,
      company.owner_telegram_id,
      `❌ Проверка компании «${company.name}» не пройдена.\nПричина: ${reason.trim()}\nИсправьте анкету в приложении и отправьте на повторную проверку.`,
    ),
  );
  return c.json({ ok: true });
});

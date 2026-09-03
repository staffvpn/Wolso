import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession } from '../middleware/auth';
import { asComplaintReason, asComplaintTarget, complaintsTableExists } from '../lib/complaints';
import { notifyAdmin } from '../lib/adminNotify';

export const complaintRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
complaintRoutes.use('*', attachSession);

/** How many complaints one account can file per day. Not a throttle
 *  against load — a complaint costs a person a tap and costs staff a real
 *  look, so an unhappy user in a bad mood shouldn't be able to bury the
 *  queue in forty of them. */
const MAX_PER_DAY = 10;

complaintRoutes.post('/', async (c) => {
  const session = c.get('session');
  if (!session || session.kind === 'staff') return c.json({ error: 'auth_required' }, 401);

  if (!(await complaintsTableExists(c.env))) {
    return c.json({ error: 'migration_required', migration: '0031_complaints_and_employer_settings' }, 400);
  }

  // Typed catch value: `?? ({})` collapses the union to its shared keys
  // (i.e. none) and every field below stops type-checking.
  type Body = { targetKind?: string; targetId?: number; reason?: string; comment?: string };
  const body = await c.req.json<Body>().catch((): Body => ({}));
  const targetKind = asComplaintTarget(body.targetKind);
  const reason = asComplaintReason(body.reason);
  const targetId = Number(body.targetId);

  if (!targetKind || !reason || !Number.isFinite(targetId)) return c.json({ error: 'invalid_complaint' }, 400);

  const authorWorkerId = session.kind === 'worker' ? session.workerId : null;
  const authorCompanyId = session.kind === 'company' ? session.companyId : null;

  const recent = await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM complaints
     WHERE created_at >= datetime('now', '-1 day')
       AND ((author_worker_id IS NOT NULL AND author_worker_id = ?) OR (author_company_id IS NOT NULL AND author_company_id = ?))`,
  )
    .bind(authorWorkerId, authorCompanyId)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_PER_DAY) return c.json({ error: 'too_many_complaints' }, 429);

  // Nobody gets to report themselves, and a worker reporting a "worker"
  // they've never met is noise — but checking that they actually crossed
  // paths would mean refusing legitimate reports about a profile someone
  // just browsed. Only the self-report is blocked.
  if (targetKind === 'worker' && authorWorkerId === targetId) return c.json({ error: 'invalid_complaint' }, 400);
  if (targetKind === 'company' && authorCompanyId === targetId) return c.json({ error: 'invalid_complaint' }, 400);

  await c.env.DB.prepare(
    `INSERT INTO complaints (author_kind, author_worker_id, author_company_id, target_kind,
                             target_worker_id, target_company_id, target_shift_id, reason, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      session.kind,
      authorWorkerId,
      authorCompanyId,
      targetKind,
      targetKind === 'worker' ? targetId : null,
      targetKind === 'company' ? targetId : null,
      targetKind === 'shift' ? targetId : null,
      reason,
      (body.comment ?? '').toString().slice(0, 2000),
    )
    .run();

  // Staff hear about it immediately: a complaint that sits unseen for a
  // week is the same as no complaint at all.
  c.executionCtx.waitUntil(
    notifyAdmin(c.env, `⚠️ Новая жалоба\nНа: ${targetKind} #${targetId}\nПричина: ${reason}\nОткройте «Жалобы» в дашборде.`),
  );

  return c.json({ ok: true });
});

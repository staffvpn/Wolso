import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { actorLabel, attachSession, logAction, requirePermission, requireStaff, requireStaffMiddleware } from '../middleware/auth';
import { SHIFT_SELECT, shiftToJson, type ShiftRow } from '../lib/db';
import { recomputeWorkerRating, recomputeCompanyRating } from '../lib/ratings';

export const adminVacancyRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminVacancyRoutes.use('*', attachSession);

/** Every shift ever posted, any status — the full "Вакансии и смены" table.
 *  Adds a response count per row so the list doesn't need N+1 calls. */
adminVacancyRoutes.get('/', requireStaffMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(`${SHIFT_SELECT} ORDER BY s.created_at DESC LIMIT 500`).all<ShiftRow>();

  const vacancies = [];
  for (const row of results) {
    const responses = await c.env.DB.prepare('SELECT COUNT(*) as n FROM applications WHERE shift_id = ?').bind(row.id).first<{ n: number }>();
    vacancies.push({ ...shiftToJson(row), responseCount: responses?.n ?? 0 });
  }
  return c.json({ vacancies });
});

/** Hard delete — cascades to its applications, chats+messages, and
 *  favorites (see worker/migrations for the FK graph). Unlike /close,
 *  this removes the row outright rather than just marking it closed. */
adminVacancyRoutes.delete('/:id', requirePermission('manageData'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');

  const shift = await c.env.DB.prepare(`${SHIFT_SELECT} WHERE s.id = ?`).bind(id).first<ShiftRow>();
  if (!shift) return c.json({ error: 'not_found' }, 404);

  const { results: reviewed } = await c.env.DB.prepare(
    'SELECT DISTINCT worker_id FROM applications WHERE shift_id = ? AND employer_rating IS NOT NULL',
  )
    .bind(id)
    .all<{ worker_id: number }>();

  // Same reason as the employer-side delete: chats.shift_id is
  // ON DELETE SET NULL, so without this the worker keeps an orphaned chat
  // for a vacancy that's gone.
  await c.env.DB.prepare('DELETE FROM chats WHERE shift_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM shifts WHERE id = ?').bind(id).run();

  // The reviews left on this shift are gone with it — the stars they
  // produced have to go too, or the account keeps a score with nothing
  // behind it.
  for (const r of reviewed) await recomputeWorkerRating(c.env, r.worker_id);
  await recomputeCompanyRating(c.env, shift.company_id);

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `удалила вакансию «${shift.position_label} · ${shift.company_name}»`, 'danger');
  return c.json({ ok: true });
});

adminVacancyRoutes.post('/:id/close', requirePermission('approveVacancies'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');

  const shift = await c.env.DB.prepare(`${SHIFT_SELECT} WHERE s.id = ?`).bind(id).first<ShiftRow>();
  if (!shift) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare("UPDATE shifts SET status = 'closed' WHERE id = ?").bind(id).run();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `закрыла вакансию «${shift.position_label} · ${shift.company_name}»`, 'neutral');
  return c.json({ ok: true });
});

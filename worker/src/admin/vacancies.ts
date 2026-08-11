import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { actorLabel, attachSession, logAction, requirePermission, requireStaff, requireStaffMiddleware } from '../middleware/auth';
import { SHIFT_SELECT, shiftToJson, type ShiftRow } from '../lib/db';

export const adminVacancyRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminVacancyRoutes.use('*', attachSession);

/** Every shift ever posted, any status — the full "Вакансии и смены" table,
 *  as opposed to /admin/moderation/vacancies which only shows the pending
 *  queue. Adds a response count per row so the list doesn't need N+1 calls. */
adminVacancyRoutes.get('/', requireStaffMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(`${SHIFT_SELECT} ORDER BY s.created_at DESC LIMIT 500`).all<ShiftRow>();

  const vacancies = [];
  for (const row of results) {
    const responses = await c.env.DB.prepare('SELECT COUNT(*) as n FROM applications WHERE shift_id = ?').bind(row.id).first<{ n: number }>();
    vacancies.push({ ...shiftToJson(row), responseCount: responses?.n ?? 0 });
  }
  return c.json({ vacancies });
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

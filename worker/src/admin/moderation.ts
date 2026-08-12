import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, actorLabel, logAction, requirePermission, requireStaff } from '../middleware/auth';
import { SHIFT_SELECT, shiftToJson, type ShiftRow } from '../lib/db';

export const adminModerationRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminModerationRoutes.use('*', attachSession);

adminModerationRoutes.get('/vacancies', requirePermission('approveVacancies'), async (c) => {
  const status = c.req.query('status') ?? 'pending_review';
  const { results } = await c.env.DB.prepare(`${SHIFT_SELECT} WHERE s.status = ? ORDER BY s.created_at ASC`).bind(status).all<ShiftRow>();

  const vacancies = [];
  for (const row of results) {
    const posted = await c.env.DB.prepare("SELECT COUNT(*) as n FROM shifts WHERE company_id = ? AND status != 'pending_review'")
      .bind(row.company_id)
      .first<{ n: number }>();
    vacancies.push({ ...shiftToJson(row), shiftsPosted: posted?.n ?? 0 });
  }
  return c.json({ vacancies });
});

const VACANCY_VERB: Record<string, string> = { active: 'одобрил(а)', pending_review: 'вернул(а) на правку', rejected: 'отклонил(а)' };

adminModerationRoutes.post('/vacancies/:id/decide', requirePermission('approveVacancies'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const { status } = await c.req.json<{ status: 'active' | 'pending_review' | 'rejected' }>();

  const shift = await c.env.DB.prepare(`${SHIFT_SELECT} WHERE s.id = ?`).bind(id).first<ShiftRow>();
  if (!shift) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare('UPDATE shifts SET status = ? WHERE id = ?').bind(status, id).run();

  const actor = await actorLabel(c.env, session);
  await logAction(
    c.env,
    actor,
    `${VACANCY_VERB[status] ?? 'обновил(а)'} вакансию «${shift.position_label} · ${shift.company_name}»`,
    status === 'rejected' ? 'danger' : status === 'active' ? 'accent' : 'neutral',
  );

  return c.json({ ok: true });
});

adminModerationRoutes.get('/complaints', requirePermission('blockUsers'), async (c) => {
  const status = c.req.query('status') ?? 'pending';
  const { results } = await c.env.DB.prepare('SELECT * FROM complaints WHERE status = ? ORDER BY created_at ASC').bind(status).all();
  return c.json({ complaints: results });
});

adminModerationRoutes.post('/complaints/:id/decide', requirePermission('blockUsers'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const { status } = await c.req.json<{ status: 'rejected' | 'returned' | 'approved' }>();

  const complaint = await c.env.DB.prepare('SELECT * FROM complaints WHERE id = ?').bind(id).first<{ target_name: string }>();
  if (!complaint) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare('UPDATE complaints SET status = ? WHERE id = ?').bind(status, id).run();

  const actor = await actorLabel(c.env, session);
  const verb = status === 'approved' ? 'подтвердил(а) и заблокировал(а) по жалобе на' : status === 'rejected' ? 'отклонил(а) жалобу на' : 'запросил(а) уточнение по жалобе на';
  await logAction(c.env, actor, `${verb} «${complaint.target_name}»`, status === 'approved' ? 'danger' : 'neutral');

  return c.json({ ok: true });
});

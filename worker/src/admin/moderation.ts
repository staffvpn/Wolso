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

/** Serves the raw uploaded file so a moderator can actually look at it.
 *  Bearer-token auth means an <img src> can't hit this directly — the
 *  client fetches it manually and turns the response into an object URL. */
adminModerationRoutes.get('/documents/:id/file', requirePermission('verifyDocuments'), async (c) => {
  const id = c.req.param('id');
  const doc = await c.env.DB.prepare('SELECT file_data, content_type FROM worker_documents WHERE id = ?')
    .bind(id)
    .first<{ file_data: ArrayBuffer | null; content_type: string | null }>();
  if (!doc || !doc.file_data) return c.json({ error: 'not_found' }, 404);
  return new Response(doc.file_data, { headers: { 'Content-Type': doc.content_type ?? 'application/octet-stream' } });
});

adminModerationRoutes.get('/employers', requirePermission('approveVacancies'), async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM companies WHERE verification_status = 'pending_review' ORDER BY created_at ASC",
  ).all();
  return c.json({ employers: results });
});

adminModerationRoutes.post('/employers/:id/decide', requirePermission('approveVacancies'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const { status } = await c.req.json<{ status: 'approved' | 'rejected' }>();

  const company = await c.env.DB.prepare('SELECT name FROM companies WHERE id = ?').bind(id).first<{ name: string }>();
  if (!company) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare('UPDATE companies SET verification_status = ? WHERE id = ?').bind(status, id).run();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `${status === 'approved' ? 'одобрил(а)' : 'отклонил(а)'} регистрацию «${company.name}»`, status === 'approved' ? 'accent' : 'danger');
  return c.json({ ok: true });
});

adminModerationRoutes.get('/documents', requirePermission('verifyDocuments'), async (c) => {
  const status = c.req.query('status') ?? 'pending';
  const { results } = await c.env.DB.prepare(
    `SELECT d.*, w.name as worker_name, w.city as worker_city, w.rating as worker_rating
     FROM worker_documents d JOIN workers w ON w.id = d.worker_id WHERE d.status = ? ORDER BY d.updated_at ASC`,
  )
    .bind(status)
    .all();
  return c.json({ documents: results });
});

adminModerationRoutes.post('/documents/:id/decide', requirePermission('verifyDocuments'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  const { status, note } = await c.req.json<{ status: 'verified' | 'missing'; note?: string }>();

  const doc = await c.env.DB.prepare(
    'SELECT d.*, w.name as worker_name FROM worker_documents d JOIN workers w ON w.id = d.worker_id WHERE d.id = ?',
  )
    .bind(id)
    .first<{ label: string; worker_name: string }>();
  if (!doc) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare("UPDATE worker_documents SET status = ?, note = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(status, note ?? (status === 'verified' ? 'Проверен' : 'Требуется повторная загрузка'), id)
    .run();

  const actor = await actorLabel(c.env, session);
  await logAction(
    c.env,
    actor,
    `${status === 'verified' ? 'одобрил(а)' : 'отклонил(а)'} документ «${doc.label}» — ${doc.worker_name}`,
    status === 'verified' ? 'accent' : 'danger',
  );

  return c.json({ ok: true });
});

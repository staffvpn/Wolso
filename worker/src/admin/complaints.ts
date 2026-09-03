import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, actorLabel, logAction, requirePermission, requireStaff, requireStaffMiddleware } from '../middleware/auth';
import { complaintsTableExists } from '../lib/complaints';

export const adminComplaintRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminComplaintRoutes.use('*', attachSession);

/** Everything the queue shows about one complaint, including who filed it
 *  and who it's about — the whole point is not having to go and look each
 *  side up by hand before deciding anything. */
const COMPLAINT_SELECT = `
  SELECT c.*,
         aw.name as author_worker_name, ac.name as author_company_name,
         tw.name as target_worker_name, tc.name as target_company_name,
         s.position_label as target_shift_position, s.date as target_shift_date,
         (SELECT COUNT(*) FROM complaints c2
           WHERE (c2.target_worker_id IS NOT NULL AND c2.target_worker_id = c.target_worker_id)
              OR (c2.target_company_id IS NOT NULL AND c2.target_company_id = c.target_company_id)) as target_total
  FROM complaints c
  LEFT JOIN workers aw ON aw.id = c.author_worker_id
  LEFT JOIN companies ac ON ac.id = c.author_company_id
  LEFT JOIN workers tw ON tw.id = c.target_worker_id
  LEFT JOIN companies tc ON tc.id = c.target_company_id
  LEFT JOIN shifts s ON s.id = c.target_shift_id
`;

adminComplaintRoutes.get('/', requireStaffMiddleware, async (c) => {
  // Named rather than left to throw — an unapplied migration would
  // otherwise turn the whole screen into a bare internal_error 500, which
  // is precisely how the «Данные» screen broke.
  if (!(await complaintsTableExists(c.env))) {
    return c.json({ error: 'migration_required', migration: '0031_complaints_and_employer_settings' }, 400);
  }

  const status = c.req.query('status');
  const where = status && status !== 'all' ? 'WHERE c.status = ?' : '';
  const sql = `${COMPLAINT_SELECT} ${where} ORDER BY c.created_at DESC LIMIT 200`;
  const stmt = where ? c.env.DB.prepare(sql).bind(status) : c.env.DB.prepare(sql);
  const { results } = await stmt.all();

  const counts = await c.env.DB.prepare('SELECT status, COUNT(*) as n FROM complaints GROUP BY status').all<{
    status: string;
    n: number;
  }>();

  return c.json({ complaints: results, counts: Object.fromEntries(counts.results.map((r) => [r.status, r.n])) });
});

/** Moving a complaint along. 'resolved' means staff acted (blocked, hid an
 *  anketa, closed a vacancy — those actions live on their own screens and
 *  are already in the audit log); 'rejected' means they looked and there
 *  was nothing to it. Both take a note, because "почему по этой жалобе
 *  ничего не сделали" is a question that gets asked later. */
adminComplaintRoutes.post('/:id', requirePermission('blockUsers'), async (c) => {
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');
  type Body = { status?: string; resolution?: string };
  const { status, resolution } = await c.req.json<Body>().catch((): Body => ({}));

  if (!['reviewing', 'resolved', 'rejected'].includes(status ?? '')) return c.json({ error: 'invalid_status' }, 400);
  const note = (resolution ?? '').trim();
  if ((status === 'resolved' || status === 'rejected') && !note) return c.json({ error: 'resolution_required' }, 400);

  const complaint = await c.env.DB.prepare('SELECT id, reason FROM complaints WHERE id = ?').bind(id).first<{ id: number; reason: string }>();
  if (!complaint) return c.json({ error: 'not_found' }, 404);

  const actor = await actorLabel(c.env, session);
  await c.env.DB.prepare(
    `UPDATE complaints SET status = ?, resolution = ?, resolved_by = ?, resolved_at = ? WHERE id = ?`,
  )
    .bind(status, note || null, status === 'reviewing' ? null : actor.name, status === 'reviewing' ? null : new Date().toISOString(), id)
    .run();

  if (status !== 'reviewing') {
    await logAction(
      c.env,
      actor,
      `${status === 'resolved' ? 'закрыла' : 'отклонила'} жалобу #${id} (${complaint.reason}) — «${note}»`,
      status === 'resolved' ? 'neutral' : 'neutral',
    );
  }
  return c.json({ ok: true });
});

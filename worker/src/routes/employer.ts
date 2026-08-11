import { Hono } from 'hono';
import type { Env } from '../types';
import { attachSession, requireCompany } from '../middleware/auth';
import { SHIFT_SELECT, shiftToJson, type ShiftRow } from '../lib/db';

export const employerRoutes = new Hono<{ Bindings: Env; Variables: { session: unknown } }>();
employerRoutes.use('*', attachSession);

const REGIONAL_MIN_WAGE = 280;

/** Lets an employer message a candidate before deciding — a chat can exist
 *  with no shift_id, just company+worker. */
employerRoutes.post('/candidates/:workerId/chat', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const workerId = c.req.param('workerId');

  let chat = await c.env.DB.prepare('SELECT id FROM chats WHERE company_id = ? AND worker_id = ? AND shift_id IS NULL')
    .bind(session.companyId, workerId)
    .first<{ id: number }>();
  if (!chat) {
    chat = await c.env.DB.prepare('INSERT INTO chats (company_id, worker_id) VALUES (?, ?) RETURNING id')
      .bind(session.companyId, workerId)
      .first<{ id: number }>();
  }
  return c.json({ chatId: chat!.id });
});

employerRoutes.get('/me', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const company = await c.env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(session.companyId).first();
  return c.json({ company });
});

employerRoutes.patch('/me', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const body = await c.req.json<{ name?: string; address?: string; city?: string }>();

  const fields: string[] = [];
  const binds: unknown[] = [];
  for (const key of ['name', 'address', 'city'] as const) {
    if (body[key]) {
      fields.push(`${key} = ?`);
      binds.push(body[key]);
    }
  }
  if (fields.length) {
    binds.push(session.companyId);
    await c.env.DB.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
  }
  return c.json({ ok: true });
});

employerRoutes.get('/vacancies', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const { results } = await c.env.DB.prepare(`${SHIFT_SELECT} WHERE s.company_id = ? ORDER BY s.created_at DESC`)
    .bind(session.companyId)
    .all<ShiftRow>();

  const shifts = [];
  for (const row of results) {
    const responses = await c.env.DB.prepare('SELECT COUNT(*) as n FROM applications WHERE shift_id = ?').bind(row.id).first<{ n: number }>();
    shifts.push({ ...shiftToJson(row), responseCount: responses?.n ?? 0 });
  }
  return c.json({ shifts });
});

employerRoutes.post('/vacancies', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const body = await c.req.json<{
    position: string;
    positionLabel: string;
    date: string;
    startHour: number;
    startMin: number;
    endHour: number;
    endMin: number;
    hourlyRate: number;
    description?: string;
    meal?: boolean;
    urgency?: 'normal' | 'urgent';
    employmentType?: string;
    timeOfDay?: string;
    requirements?: string[];
  }>();

  const durationHours = body.endHour - body.startHour;
  const totalPay = Math.max(0, Math.round(durationHours * body.hourlyRate));

  const priorShifts = await c.env.DB.prepare('SELECT COUNT(*) as n FROM shifts WHERE company_id = ?').bind(session.companyId).first<{ n: number }>();
  let flagLabel: string | null = null;
  let flagTone: string | null = null;
  if (body.hourlyRate < REGIONAL_MIN_WAGE) {
    flagLabel = 'Ставка ниже МРОТ';
    flagTone = 'danger';
  } else if ((priorShifts?.n ?? 0) === 0) {
    flagLabel = 'Новый работодатель';
    flagTone = 'info';
  }

  const inserted = await c.env.DB.prepare(
    `INSERT INTO shifts (company_id, position, position_label, date, start_hour, start_min, end_hour, end_min,
       hourly_rate, total_pay, description, meal, urgency, employment_type, time_of_day, requirements,
       status, moderation_flag_label, moderation_flag_tone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?) RETURNING id`,
  )
    .bind(
      session.companyId,
      body.position,
      body.positionLabel,
      body.date,
      body.startHour,
      body.startMin ?? 0,
      body.endHour,
      body.endMin ?? 0,
      body.hourlyRate,
      totalPay,
      body.description ?? '',
      body.meal ? 1 : 0,
      body.urgency ?? 'normal',
      body.employmentType ?? 'shift',
      body.timeOfDay ?? 'day',
      JSON.stringify(body.requirements ?? []),
      flagLabel,
      flagTone,
    )
    .first<{ id: number }>();

  const row = await c.env.DB.prepare(`${SHIFT_SELECT} WHERE s.id = ?`).bind(inserted!.id).first<ShiftRow>();
  return c.json({ shift: shiftToJson(row!) });
});

/** All pending applicants across every vacancy this company owns — feeds
 *  the employer's swipe deck without an N+1 fetch per vacancy. */
employerRoutes.get('/candidates', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT a.*, w.name as worker_name, w.rating as worker_rating, w.shifts_completed as worker_shifts_completed, w.city as worker_city,
            s.position_label as shift_position_label, s.date as shift_date, s.start_hour as shift_start_hour, s.start_min as shift_start_min,
            EXISTS(SELECT 1 FROM worker_documents d WHERE d.worker_id = w.id AND d.doc_type = 'med_book' AND d.status = 'verified') as worker_med_book
     FROM applications a
     JOIN shifts s ON s.id = a.shift_id
     JOIN workers w ON w.id = a.worker_id
     WHERE s.company_id = ? AND a.status = 'pending'
     ORDER BY a.created_at ASC`,
  )
    .bind(session.companyId)
    .all();

  return c.json({ candidates: results });
});

employerRoutes.get('/vacancies/:id/candidates', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const shiftId = c.req.param('id');

  const shift = await c.env.DB.prepare('SELECT id FROM shifts WHERE id = ? AND company_id = ?').bind(shiftId, session.companyId).first();
  if (!shift) return c.json({ error: 'not_found' }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT a.*, w.name as worker_name, w.rating as worker_rating, w.shifts_completed as worker_shifts_completed, w.city as worker_city,
            EXISTS(SELECT 1 FROM worker_documents d WHERE d.worker_id = w.id AND d.doc_type = 'med_book' AND d.status = 'verified') as worker_med_book
     FROM applications a JOIN workers w ON w.id = a.worker_id WHERE a.shift_id = ? ORDER BY a.created_at ASC`,
  )
    .bind(shiftId)
    .all();

  return c.json({ candidates: results });
});

employerRoutes.post('/vacancies/:shiftId/candidates/:appId/decide', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const { shiftId, appId } = c.req.param();
  const { status } = await c.req.json<{ status: 'accepted' | 'declined' }>();

  const shift = await c.env.DB.prepare('SELECT id FROM shifts WHERE id = ? AND company_id = ?').bind(shiftId, session.companyId).first();
  if (!shift) return c.json({ error: 'not_found' }, 404);

  const app = await c.env.DB.prepare('SELECT * FROM applications WHERE id = ? AND shift_id = ?').bind(appId, shiftId).first<{
    worker_id: number;
  }>();
  if (!app) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare('UPDATE applications SET status = ? WHERE id = ?').bind(status, appId).run();

  if (status === 'accepted') {
    const company = await c.env.DB.prepare('SELECT name, address FROM companies WHERE id = ?').bind(session.companyId).first<{
      name: string;
      address: string;
    }>();

    let chat = await c.env.DB.prepare('SELECT id FROM chats WHERE company_id = ? AND worker_id = ? AND shift_id = ?')
      .bind(session.companyId, app.worker_id, shiftId)
      .first<{ id: number }>();
    if (!chat) {
      chat = await c.env.DB.prepare('INSERT INTO chats (company_id, worker_id, shift_id) VALUES (?, ?, ?) RETURNING id')
        .bind(session.companyId, app.worker_id, shiftId)
        .first<{ id: number }>();
      await c.env.DB.prepare("INSERT INTO messages (chat_id, sender, kind, text) VALUES (?, 'system', 'system', ?)")
        .bind(chat!.id, `Вас взяли на смену. ${company?.address ? `Адрес: ${company.address}` : ''}`)
        .run();
    }

    await c.env.DB.prepare('INSERT INTO notifications (worker_id, kind, title, subtitle) VALUES (?, ?, ?, ?)')
      .bind(app.worker_id, 'accepted', `${company?.name ?? 'Работодатель'} взял вас на смену`, company?.address ?? '')
      .run();
  }

  return c.json({ ok: true });
});

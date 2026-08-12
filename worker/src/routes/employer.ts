import { Hono } from 'hono';
import type { Env } from '../types';
import { attachSession, requireCompany } from '../middleware/auth';
import { SHIFT_SELECT, shiftToJson, type ShiftRow } from '../lib/db';
import { readUpload, setAvatar, addGalleryPhoto, deleteGalleryPhoto } from '../lib/media';
import { sendTelegramMessage } from '../lib/telegramBot';

export const employerRoutes = new Hono<{ Bindings: Env; Variables: { session: unknown } }>();
employerRoutes.use('*', attachSession);

interface CompanyRow {
  id: number;
  name: string;
  address: string | null;
  city: string;
  description: string;
  founded_year: number | null;
  avatar_data: ArrayBuffer | null;
}

/** Every field on this list must be present before a company profile counts
 *  as "complete" — see ProfileGate on the client. There's no Telegram photo
 *  fallback for companies (unlike workers), so the avatar has to be
 *  uploaded here. No moderation gate beyond this — filling the profile in
 *  is the only thing standing between an employer and publishing. */
function companyIsComplete(company: CompanyRow) {
  const fields = [!!company.name, !!company.description, !!company.founded_year, !!company.avatar_data];
  return { complete: fields.every(Boolean), percent: Math.round((fields.filter(Boolean).length / fields.length) * 100) };
}

async function loadCompanyProfile(env: Env, companyId: number) {
  const company = await env.DB.prepare('SELECT id, name, address, city, description, founded_year, avatar_data FROM companies WHERE id = ?')
    .bind(companyId)
    .first<CompanyRow>();
  if (!company) return null;

  const { results: photoRows } = await env.DB.prepare('SELECT id FROM company_photos WHERE company_id = ? ORDER BY position ASC')
    .bind(companyId)
    .all<{ id: number }>();

  const { complete, percent } = companyIsComplete(company);

  return {
    company: {
      ...company,
      avatar_data: undefined,
      avatarUrl: company.avatar_data ? `/media/companies/${company.id}/avatar` : null,
      profileComplete: complete,
      profileCompletion: percent,
    },
    photos: photoRows.map((p) => ({ id: p.id, url: `/media/companies/${companyId}/photos/${p.id}` })),
  };
}

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
  const profile = await loadCompanyProfile(c.env, session.companyId);
  if (!profile) return c.json({ error: 'not_found' }, 404);
  return c.json(profile);
});

employerRoutes.patch('/me', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const body = await c.req.json<{ name?: string; address?: string; city?: string; description?: string; foundedYear?: number }>();

  const fields: string[] = [];
  const binds: unknown[] = [];
  for (const key of ['name', 'address', 'city', 'description'] as const) {
    if (body[key]) {
      fields.push(`${key} = ?`);
      binds.push(body[key]);
    }
  }
  if (body.foundedYear) {
    fields.push('founded_year = ?');
    binds.push(body.foundedYear);
  }
  if (fields.length) {
    binds.push(session.companyId);
    await c.env.DB.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
  }

  const profile = await loadCompanyProfile(c.env, session.companyId);
  return c.json({ ok: true, ...profile });
});

/** Avatar upload — same D1-BLOB pattern as worker documents/avatar, served
 *  publicly via routes/media.ts. */
employerRoutes.post('/me/avatar', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const contentType = c.req.header('Content-Type') ?? 'application/octet-stream';
  const bytes = await c.req.arrayBuffer();
  const check = readUpload(bytes);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await setAvatar(c.env, 'companies', session.companyId, bytes, contentType);
  const profile = await loadCompanyProfile(c.env, session.companyId);
  return c.json({ ok: true, ...profile });
});

/** Additional gallery photos — optional, up to 6, shown alongside the main
 *  avatar on the company's profile and vacancy cards. */
employerRoutes.post('/me/photos', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const contentType = c.req.header('Content-Type') ?? 'application/octet-stream';
  const bytes = await c.req.arrayBuffer();
  const check = readUpload(bytes);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const result = await addGalleryPhoto(c.env, 'company_photos', 'company_id', session.companyId, bytes, contentType);
  if (!result.ok) return c.json({ error: result.error }, 400);

  const profile = await loadCompanyProfile(c.env, session.companyId);
  return c.json({ ok: true, ...profile });
});

employerRoutes.delete('/me/photos/:id', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  await deleteGalleryPhoto(c.env, 'company_photos', 'company_id', session.companyId, c.req.param('id'));
  const profile = await loadCompanyProfile(c.env, session.companyId);
  return c.json({ ok: true, ...profile });
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

  const inserted = await c.env.DB.prepare(
    `INSERT INTO shifts (company_id, position, position_label, date, start_hour, start_min, end_hour, end_min,
       hourly_rate, total_pay, description, meal, urgency, employment_type, time_of_day, requirements, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active') RETURNING id`,
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
    )
    .first<{ id: number }>();

  const row = await c.env.DB.prepare(`${SHIFT_SELECT} WHERE s.id = ?`).bind(inserted!.id).first<ShiftRow>();
  // Runs after the response is sent (waitUntil) — an employer posting a
  // shift shouldn't sit waiting on however many Telegram API calls this
  // turns into.
  c.executionCtx.waitUntil(notifyMatchingWorkers(c.env, row!));
  return c.json({ shift: shiftToJson(row!) });
});

/** Pings, via the bot itself (not just the in-app notifications list),
 *  every worker who has this position in their experience — the same
 *  match a worker would get by filtering the feed for it. Deliberately
 *  narrow: broadcasting every new shift to every worker regardless of
 *  what they do would just train people to ignore the bot. */
async function notifyMatchingWorkers(env: Env, shift: ShiftRow): Promise<void> {
  const { results: matches } = await env.DB.prepare(
    `SELECT DISTINCT w.id, w.telegram_id FROM workers w
     JOIN worker_positions wp ON wp.worker_id = w.id
     LEFT JOIN telegram_accounts t ON t.telegram_id = w.telegram_id
     WHERE wp.position = ? AND w.status != 'suspended' AND (t.active_role = 'worker' OR t.active_role IS NULL)`,
  )
    .bind(shift.position)
    .all<{ id: number; telegram_id: number }>();
  if (matches.length === 0) return;

  const pad = (n: number) => String(n).padStart(2, '0');
  // shift.date is stored as ISO (YYYY-MM-DD) — the bot message shows the
  // ru-RU-familiar dd.mm.yyyy instead.
  const [year, month, day] = shift.date.split('-');
  const dateLabel = `${day}.${month}.${year}`;
  const title = `Новая смена: ${shift.position_label}`;
  const subtitle = `${shift.company_name ?? 'Компания'} · ${shift.company_city ?? ''} · ${shift.hourly_rate} ₽/ч`;
  const text = [
    `🆕 ${title}`,
    subtitle,
    `${dateLabel}, ${pad(shift.start_hour)}:${pad(shift.start_min)}–${pad(shift.end_hour)}:${pad(shift.end_min)}`,
  ].join('\n');

  await Promise.allSettled(
    matches.map(async (m) => {
      await env.DB.prepare('INSERT INTO notifications (worker_id, kind, title, subtitle) VALUES (?, ?, ?, ?)')
        .bind(m.id, 'new_shifts', title, subtitle)
        .run();
      await sendTelegramMessage(env, m.telegram_id, text);
    }),
  );
}

/** Worker columns joined into both candidate queries below — enough for
 *  the swipe card to show a real profile (avatar, bio, skills, age)
 *  instead of just a name and a rating. */
const CANDIDATE_WORKER_FIELDS = `
  w.name as worker_name, w.rating as worker_rating, w.shifts_completed as worker_shifts_completed, w.city as worker_city,
  w.bio as worker_bio, w.skills as worker_skills, w.birthdate as worker_birthdate,
  (w.avatar_data IS NOT NULL) as worker_has_avatar, w.photo_url as worker_photo_url,
  (SELECT json_group_array(id) FROM worker_photos wp WHERE wp.worker_id = w.id) as worker_photo_ids
`;

interface CandidateWorkerRow {
  worker_id: number;
  worker_has_avatar: number;
  worker_photo_url: string | null;
  worker_photo_ids: string | null;
  [key: string]: unknown;
}

/** Turns the joined `worker_*` columns into a small `worker` object with
 *  ready-to-use photo URLs — same avatar-or-Telegram-fallback logic as the
 *  worker's own profile endpoint. */
function withWorkerPhotos<T extends CandidateWorkerRow>(row: T) {
  const avatarUrl = row.worker_has_avatar ? `/media/workers/${row.worker_id}/avatar` : row.worker_photo_url;
  const photoIds = row.worker_photo_ids ? (JSON.parse(row.worker_photo_ids) as number[]) : [];
  return { ...row, worker_avatar_url: avatarUrl, worker_photos: photoIds.map((id) => `/media/workers/${row.worker_id}/photos/${id}`) };
}

/** All pending applicants across every vacancy this company owns — feeds
 *  the employer's swipe deck without an N+1 fetch per vacancy. */
employerRoutes.get('/candidates', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT a.*, ${CANDIDATE_WORKER_FIELDS},
            s.position_label as shift_position_label, s.date as shift_date, s.start_hour as shift_start_hour, s.start_min as shift_start_min
     FROM applications a
     JOIN shifts s ON s.id = a.shift_id
     JOIN workers w ON w.id = a.worker_id
     WHERE s.company_id = ? AND a.status = 'pending'
     ORDER BY a.created_at ASC`,
  )
    .bind(session.companyId)
    .all<CandidateWorkerRow>();

  return c.json({ candidates: results.map(withWorkerPhotos) });
});

employerRoutes.get('/vacancies/:id/candidates', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const shiftId = c.req.param('id');

  const shift = await c.env.DB.prepare('SELECT id FROM shifts WHERE id = ? AND company_id = ?').bind(shiftId, session.companyId).first();
  if (!shift) return c.json({ error: 'not_found' }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT a.*, ${CANDIDATE_WORKER_FIELDS}
     FROM applications a JOIN workers w ON w.id = a.worker_id WHERE a.shift_id = ? ORDER BY a.created_at ASC`,
  )
    .bind(shiftId)
    .all<CandidateWorkerRow>();

  return c.json({ candidates: results.map(withWorkerPhotos) });
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

/** A left swipe isn't "never again" — just "not for a while", same idea as
 *  a job board not re-showing a listing you dismissed yesterday but not
 *  hiding it forever. Long enough that re-browsing the same deck a few
 *  minutes later doesn't just re-show everyone already passed on, short
 *  enough that someone's anketa (which can change — new photos, new
 *  positions) resurfaces on a realistic timescale. */
const PASS_COOLDOWN_DAYS = 1;

/** Browse workers directly, not tied to any one vacancy — filtered by the
 *  positions the employer says they're hiring for, so "find staff" never
 *  shows a hostess to someone looking for waiters. Requires at least one
 *  position (empty list = empty deck, not "show everyone"). Workers who
 *  already have a chat with this company (invited from here, or hired off
 *  an application) don't show up again; a passed worker comes back after
 *  PASS_COOLDOWN_DAYS. */
employerRoutes.get('/workers', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const positions = (c.req.query('positions') ?? '').split(',').filter(Boolean);
  if (positions.length === 0) return c.json({ workers: [] });

  const placeholders = positions.map(() => '?').join(',');
  const { results } = await c.env.DB.prepare(
    `SELECT DISTINCT w.id as worker_id, ${CANDIDATE_WORKER_FIELDS},
            (SELECT wp2.position_label FROM worker_positions wp2
             WHERE wp2.worker_id = w.id AND wp2.position IN (${placeholders})
             ORDER BY wp2.months DESC LIMIT 1) as matched_position_label
     FROM workers w
     JOIN worker_positions wp ON wp.worker_id = w.id
     LEFT JOIN telegram_accounts t ON t.telegram_id = w.telegram_id
     WHERE wp.position IN (${placeholders})
       AND w.status != 'suspended'
       AND (t.active_role = 'worker' OR t.active_role IS NULL)
       AND w.id NOT IN (
         SELECT worker_id FROM company_worker_passes
         WHERE company_id = ? AND created_at >= datetime('now', '-${PASS_COOLDOWN_DAYS} days')
       )
       AND w.id NOT IN (SELECT worker_id FROM chats WHERE company_id = ?)
     ORDER BY w.created_at DESC
     LIMIT 100`,
  )
    .bind(...positions, ...positions, session.companyId, session.companyId)
    .all<CandidateWorkerRow & { matched_position_label: string | null }>();

  return c.json({ workers: results.map(withWorkerPhotos) });
});

/** Left swipe in "find staff" — hidden for PASS_COOLDOWN_DAYS, not forever.
 *  Passing the same person again (once they've resurfaced) restarts the
 *  cooldown from that point rather than the original pass. */
employerRoutes.post('/workers/:workerId/pass', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  await c.env.DB.prepare(
    `INSERT INTO company_worker_passes (company_id, worker_id) VALUES (?, ?)
     ON CONFLICT (company_id, worker_id) DO UPDATE SET created_at = datetime('now')`,
  )
    .bind(session.companyId, c.req.param('workerId'))
    .run();
  return c.json({ ok: true });
});

import { Hono, type Context } from 'hono';
import type { Env } from '../types';
import { attachSession, requireCompany } from '../middleware/auth';
import { SHIFT_SELECT, shiftToJson, deleteShiftChat, type ShiftRow } from '../lib/db';
import { readUpload, setAvatar, addGalleryPhoto, deleteGalleryPhoto } from '../lib/media';
import { mskTodayStr } from '../lib/time';
import { lookupInn } from '../lib/innLookup';
import { notifyAdmin } from '../lib/adminNotify';
import { recomputeWorkerRating, recomputeCompanyRating } from '../lib/ratings';
import { excludeHiddenSql } from '../lib/hiddenProfiles';
import { asLookingFor, lookingForColumnExists, matchesLookingForSql } from '../lib/workerPrefs';
import { companyNotifyPrefColumnsExist, notifyWorker } from '../lib/notifyPrefs';
import { VACANCY_LIMIT, overLimit } from '../lib/rateLimit';
import { reportCancellation } from '../lib/incidents';

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
  inn: string | null;
  verification_status: string;
  verification_reason: string | null;
  ai_verification_summary: string | null;
}

/** Every field on this list must be present before a company profile counts
 *  as "complete" — see ProfileGate on the client. There's no Telegram photo
 *  fallback for companies (unlike workers), so the avatar has to be
 *  uploaded here. Completing the profile isn't the whole gate anymore —
 *  see verification_status below: a complete-but-unverified employer still
 *  can't publish vacancies or browse candidates until an admin approves it. */
function companyIsComplete(company: CompanyRow) {
  const fields = [!!company.name, !!company.description, !!company.founded_year, !!company.avatar_data, !!company.inn];
  return { complete: fields.every(Boolean), percent: Math.round((fields.filter(Boolean).length / fields.length) * 100) };
}

async function loadCompanyProfile(env: Env, companyId: number) {
  // SELECT * so columns added by later migrations (the notification
  // switches below) arrive without this list having to be kept in sync.
  const company = await env.DB.prepare('SELECT * FROM companies WHERE id = ?')
    .bind(companyId)
    .first<CompanyRow>();
  if (!company) return null;

  const { results: photoRows } = await env.DB.prepare('SELECT id FROM company_photos WHERE company_id = ? ORDER BY position ASC')
    .bind(companyId)
    .all<{ id: number }>();

  const { complete, percent } = companyIsComplete(company);

  // Read off the row rather than named in the SELECT so this keeps working
  // before migration 0031 is applied — absent columns read as "on", which
  // is how the bot behaves until then.
  const prefs = company as CompanyRow & {
    notify_new_responses?: number;
    notify_worker_replies?: number;
    notify_pending_reminder?: number;
  };

  return {
    company: {
      ...company,
      avatar_data: undefined,
      avatarUrl: company.avatar_data ? `/media/companies/${company.id}/avatar` : null,
      profileComplete: complete,
      profileCompletion: percent,
      verificationStatus: company.verification_status,
      rejectionReason: company.verification_reason,
      aiSummary: company.ai_verification_summary,
      notifyNewResponses: (prefs.notify_new_responses ?? 1) === 1,
      notifyWorkerReplies: (prefs.notify_worker_replies ?? 1) === 1,
      notifyPendingReminder: (prefs.notify_pending_reminder ?? 1) === 1,
    },
    photos: photoRows.map((p) => ({ id: p.id, url: `/media/companies/${companyId}/photos/${p.id}` })),
  };
}

/** Gate for publishing a vacancy or browsing worker anketas — both require
 *  a complete profile *and* admin approval, not just completeness. Kept
 *  separate from companyIsComplete since a rejected/pending-but-complete
 *  profile is a different reason to block than an unfinished one, and the
 *  client shows a different screen for each (see ProfileGate/VerificationGate). */
async function requireVerifiedCompany(env: Env, companyId: number): Promise<boolean> {
  const row = await env.DB.prepare('SELECT verification_status FROM companies WHERE id = ?').bind(companyId).first<{
    verification_status: string;
  }>();
  return row?.verification_status === 'approved';
}

employerRoutes.get('/me', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const profile = await loadCompanyProfile(c.env, session.companyId);
  if (!profile) return c.json({ error: 'not_found' }, 404);
  return c.json(profile);
});

/** ИНН is 10 digits for a legal entity (ООО etc.) or 12 for a sole
 *  proprietor (ИП) — the two real lengths in Russia's registry. */
function isValidInn(inn: string): boolean {
  return /^\d{10}$|^\d{12}$/.test(inn);
}

employerRoutes.patch('/me', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const body = await c.req.json<{
    name?: string;
    address?: string;
    city?: string;
    description?: string;
    foundedYear?: number;
    inn?: string;
    notifyNewResponses?: boolean;
    notifyWorkerReplies?: boolean;
    notifyPendingReminder?: boolean;
  }>();

  if (body.inn !== undefined && body.inn !== '' && !isValidInn(body.inn.trim())) {
    return c.json({ error: 'invalid_inn' }, 400);
  }

  const before = await c.env.DB.prepare(
    'SELECT name, address, city, description, founded_year, avatar_data, inn, verification_status FROM companies WHERE id = ?',
  )
    .bind(session.companyId)
    .first<CompanyRow>();
  if (!before) return c.json({ error: 'not_found' }, 404);
  const wasComplete = companyIsComplete(before).complete;

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
  if (body.inn) {
    fields.push('inn = ?');
    binds.push(body.inn.trim());
  }
  // Ignored rather than fatal while migration 0031 is pending — failing the
  // whole save would also throw away the name and description typed
  // alongside it.
  if (await companyNotifyPrefColumnsExist(c.env)) {
    for (const [key, column] of [
      ['notifyNewResponses', 'notify_new_responses'],
      ['notifyWorkerReplies', 'notify_worker_replies'],
      ['notifyPendingReminder', 'notify_pending_reminder'],
    ] as const) {
      if (typeof body[key] === 'boolean') {
        fields.push(`${column} = ?`);
        binds.push(body[key] ? 1 : 0);
      }
    }
  }
  if (fields.length) {
    binds.push(session.companyId);
    await c.env.DB.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
  }

  // Send it for (re)verification the first time the profile becomes
  // complete, or after fixing it up following a rejection — not on every
  // edit an already-approved employer makes, so tweaking a description
  // doesn't send a working account back into the moderation queue.
  const after = await c.env.DB.prepare(
    'SELECT name, address, city, description, founded_year, avatar_data, inn, verification_status FROM companies WHERE id = ?',
  )
    .bind(session.companyId)
    .first<CompanyRow>();
  const isComplete = after ? companyIsComplete(after).complete : false;
  const justCompleted = isComplete && !wasComplete;
  const resubmittingAfterRejection = isComplete && before.verification_status === 'rejected';
  if (after && (justCompleted || resubmittingAfterRejection)) {
    await c.env.DB.prepare(
      "UPDATE companies SET verification_status = 'pending', verification_reason = NULL WHERE id = ?",
    )
      .bind(session.companyId)
      .run();
    c.executionCtx.waitUntil(
      notifyAdmin(
        c.env,
        `🏢 Работодатель на проверку\n${after.name || 'Без названия'}\nИНН: ${after.inn ?? '—'} · ${after.city ?? ''}\nОткройте «Проверка работодателей» в дашборде.`,
      ),
    );
    c.executionCtx.waitUntil(
      (async () => {
        const summary = await lookupInn({ id: session.companyId, name: after.name, inn: after.inn });
        if (summary) {
          await c.env.DB.prepare(
            "UPDATE companies SET ai_verification_summary = ?, ai_verification_checked_at = datetime('now') WHERE id = ?",
          )
            .bind(summary, session.companyId)
            .run();
        }
      })(),
    );
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
  if (!(await requireVerifiedCompany(c.env, session.companyId))) return c.json({ error: 'not_verified' }, 403);

  // Каждая опубликованная смена рассылает сообщение всем подходящим
  // соискателям (см. notifyMatchingWorkers), так что двадцать вакансий
  // подряд — это не двадцать строк в базе, а рассылка живым людям.
  if (await overLimit(c.env, 'shifts', 'company_id', session.companyId, VACANCY_LIMIT)) {
    return c.json({ error: 'rate_limited' }, 429);
  }

  const body = await c.req.json<{
    position: string;
    positionLabel: string;
    date: string;
    endDate?: string;
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
    `INSERT INTO shifts (company_id, position, position_label, date, end_date, start_hour, start_min, end_hour, end_min,
       hourly_rate, total_pay, description, meal, urgency, employment_type, time_of_day, requirements, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active') RETURNING id`,
  )
    .bind(
      session.companyId,
      body.position,
      body.positionLabel,
      body.date,
      body.endDate && body.endDate > body.date ? body.endDate : null,
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

/** Edits a vacancy in place. Until now the only way to fix a typo in the
 *  rate or move a shift by an hour was deleting the posting and republishing
 *  — which threw away the responses it had already collected.
 *
 *  Only an active posting can be edited: a closed one is a record of work
 *  that happened, and rewriting its terms after the fact would rewrite what
 *  people were paid for.
 *
 *  Anyone already invited or confirmed is told what changed rather than
 *  finding out on the day. Silently moving the time or the pay under
 *  someone who has agreed to come is the one genuinely dangerous thing this
 *  route can do, so it is the one thing it refuses to do quietly. */
employerRoutes.patch('/vacancies/:id', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const id = c.req.param('id');

  const existing = await c.env.DB.prepare(`${SHIFT_SELECT} WHERE s.id = ? AND s.company_id = ?`)
    .bind(id, session.companyId)
    .first<ShiftRow>();
  if (!existing) return c.json({ error: 'not_found' }, 404);
  if (existing.status !== 'active') return c.json({ error: 'not_editable' }, 409);

  const body = await c.req.json<{
    position?: string;
    positionLabel?: string;
    date?: string;
    endDate?: string | null;
    startHour?: number;
    endHour?: number;
    hourlyRate?: number;
    description?: string;
    employmentType?: string;
    requirements?: string[];
  }>();

  const next = {
    position: body.position ?? existing.position,
    positionLabel: body.positionLabel ?? existing.position_label,
    date: body.date ?? existing.date,
    startHour: body.startHour ?? existing.start_hour,
    endHour: body.endHour ?? existing.end_hour,
    hourlyRate: body.hourlyRate ?? existing.hourly_rate,
    description: body.description ?? existing.description,
    employmentType: body.employmentType ?? existing.employment_type,
    requirements: body.requirements ?? (JSON.parse(existing.requirements || '[]') as string[]),
  };

  // An ongoing job carries no range; a shift's end date only counts when it
  // is genuinely later than the start (same rule as creation).
  const endDate =
    next.employmentType === 'permanent'
      ? null
      : body.endDate === undefined
        ? existing.end_date
        : body.endDate && body.endDate > next.date
          ? body.endDate
          : null;

  const totalPay = Math.max(0, Math.round((next.endHour - next.startHour) * next.hourlyRate));

  await c.env.DB.prepare(
    `UPDATE shifts SET position = ?, position_label = ?, date = ?, end_date = ?, start_hour = ?, end_hour = ?,
       hourly_rate = ?, total_pay = ?, description = ?, employment_type = ?, requirements = ?
     WHERE id = ? AND company_id = ?`,
  )
    .bind(
      next.position,
      next.positionLabel,
      next.date,
      endDate,
      next.startHour,
      next.endHour,
      next.hourlyRate,
      totalPay,
      next.description,
      next.employmentType,
      JSON.stringify(next.requirements),
      id,
      session.companyId,
    )
    .run();

  // What a candidate would actually care about — not every edit is worth a
  // notification, and pinging people because a typo in the description got
  // fixed is how notifications start getting ignored.
  const changes: string[] = [];
  if (next.date !== existing.date) changes.push(`дата — ${next.date}`);
  if (next.startHour !== existing.start_hour || next.endHour !== existing.end_hour) {
    changes.push(`время — ${String(next.startHour).padStart(2, '0')}:00–${String(next.endHour).padStart(2, '0')}:00`);
  }
  if (next.hourlyRate !== existing.hourly_rate) changes.push(`ставка — ${next.hourlyRate} ₽/ч`);
  if (next.positionLabel !== existing.position_label) changes.push(`должность — ${next.positionLabel}`);

  if (changes.length > 0) {
    const { results: engaged } = await c.env.DB.prepare(
      `SELECT a.worker_id, w.telegram_id FROM applications a JOIN workers w ON w.id = a.worker_id
       WHERE a.shift_id = ? AND a.status IN ('invited', 'accepted')`,
    )
      .bind(id)
      .all<{ worker_id: number; telegram_id: number }>();

    const title = `Изменились условия смены «${next.positionLabel}»`;
    const subtitle = changes.join(', ');

    for (const person of engaged) {
      await c.env.DB.prepare('INSERT INTO notifications (worker_id, kind, title, subtitle) VALUES (?, ?, ?, ?)')
        .bind(person.worker_id, 'shift_updated', title, subtitle)
        .run();
      c.executionCtx.waitUntil(
        notifyWorker(c.env, { id: person.worker_id, telegramId: person.telegram_id }, 'employer_replies', `✏️ ${title}\n${subtitle}`),
      );
    }
  }

  const row = await c.env.DB.prepare(`${SHIFT_SELECT} WHERE s.id = ?`).bind(id).first<ShiftRow>();
  return c.json({ shift: shiftToJson(row!) });
});

/** Reviews workers left about this company, newest first — the list
 *  behind the rating on the employer's own profile. Mirrors
 *  GET /me/reviews on the worker side. */
employerRoutes.get('/reviews', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.rating as rating, a.review_tags as tags, a.review_comment as comment,
            a.created_at, s.position_label, s.date,
            w.id as worker_id, w.name as worker_name, (w.avatar_data IS NOT NULL) as worker_has_avatar
     FROM applications a
     JOIN shifts s ON s.id = a.shift_id
     JOIN workers w ON w.id = a.worker_id
     WHERE s.company_id = ? AND a.rating IS NOT NULL
     ORDER BY a.id DESC LIMIT 100`,
  )
    .bind(session.companyId)
    .all<{
      id: number;
      rating: number;
      tags: string | null;
      comment: string | null;
      created_at: string;
      position_label: string;
      date: string;
      worker_id: number;
      worker_name: string;
      worker_has_avatar: number;
    }>();

  return c.json({
    reviews: results.map((r) => ({
      id: r.id,
      rating: r.rating,
      tags: r.tags ? (JSON.parse(r.tags) as string[]) : [],
      comment: r.comment || '',
      createdAt: r.created_at,
      positionLabel: r.position_label,
      shiftDate: r.date,
      authorName: r.worker_name,
      authorAvatarUrl: r.worker_has_avatar ? `/media/workers/${r.worker_id}/avatar` : null,
    })),
  });
});

/** An employer removing one of their own postings. Cascades to its
 *  applications, chats and favorites the same way the admin-side delete
 *  does (see worker/migrations for the FK graph) — so anyone already
 *  invited or hired gets told first, since from their side the shift is
 *  simply about to vanish. */
employerRoutes.delete('/vacancies/:id', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const id = c.req.param('id');

  const shift = await c.env.DB.prepare('SELECT id, position_label FROM shifts WHERE id = ? AND company_id = ?')
    .bind(id, session.companyId)
    .first<{ id: number; position_label: string }>();
  if (!shift) return c.json({ error: 'not_found' }, 404);

  const { results: engaged } = await c.env.DB.prepare(
    `SELECT a.worker_id, w.telegram_id FROM applications a JOIN workers w ON w.id = a.worker_id
     WHERE a.shift_id = ? AND a.status IN ('invited', 'accepted')`,
  )
    .bind(id)
    .all<{ worker_id: number; telegram_id: number }>();

  const company = await c.env.DB.prepare('SELECT name FROM companies WHERE id = ?').bind(session.companyId).first<{ name: string }>();
  const title = `${company?.name ?? 'Работодатель'} снял(а) смену с публикации`;
  const subtitle = `«${shift.position_label}» — смена больше не актуальна`;

  for (const person of engaged) {
    await c.env.DB.prepare('INSERT INTO notifications (worker_id, kind, title, subtitle) VALUES (?, ?, ?, ?)')
      .bind(person.worker_id, 'cancelled_by_employer', title, subtitle)
      .run();
    c.executionCtx.waitUntil(
      notifyWorker(c.env, { id: person.worker_id, telegramId: person.telegram_id }, 'employer_replies', `❌ ${title}\n${subtitle}`),
    );
  }

  // chats.shift_id is ON DELETE SET NULL, not CASCADE — deleting the shift
  // on its own leaves the chat alive with a null shift, still sitting in
  // both sides' chat list pointing at a vacancy that no longer exists.
  // Messages cascade off the chat row itself.
  // Whose scores this shift's reviews were propping up — collected before
  // the delete, because afterwards there's nothing left to ask.
  const { results: reviewed } = await c.env.DB.prepare(
    'SELECT DISTINCT worker_id FROM applications WHERE shift_id = ? AND employer_rating IS NOT NULL',
  )
    .bind(id)
    .all<{ worker_id: number }>();

  await c.env.DB.prepare('DELETE FROM chats WHERE shift_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM shifts WHERE id = ?').bind(id).run();

  // Deleting the shift takes its applications — and the reviews on them —
  // with it. Without this the stars those reviews produced would just stay
  // frozen on the accounts.
  for (const r of reviewed) await recomputeWorkerRating(c.env, r.worker_id);
  await recomputeCompanyRating(c.env, session.companyId);

  return c.json({ ok: true });
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
      await notifyWorker(env, { id: m.id, telegramId: m.telegram_id }, 'new_shifts', text);
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
  (SELECT json_group_array(id) FROM worker_photos wp WHERE wp.worker_id = w.id) as worker_photo_ids,
  (SELECT json_group_array(json_object('positionLabel', position_label, 'months', months))
     FROM worker_positions wp2 WHERE wp2.worker_id = w.id) as worker_experience
`;

/** `looking_for` on top of those, once migration 0029 has been applied.
 *  Appended separately rather than folded into the list above because
 *  naming a column the database doesn't have yet doesn't degrade — it
 *  throws, and takes the employer's whole candidates screen with it. */
async function lookingForField(env: Env): Promise<string> {
  return (await lookingForColumnExists(env)) ? ", w.looking_for as worker_looking_for" : '';
}

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

/** Pending applicants and current hires across every vacancy this company
 *  owns — feeds the employer's swipe deck (client-side filtered to
 *  'pending'), the "приглашены"/"pора закрыть смену" badges on the
 *  Vacancies list (needs 'invited' and 'accepted' too), without an N+1
 *  fetch per vacancy. Declined/cancelled applicants aren't included —
 *  nothing in the overview reads those, the reason lives in the
 *  notification each side already got. */
employerRoutes.get('/candidates', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT a.*, ${CANDIDATE_WORKER_FIELDS}${await lookingForField(c.env)},
            s.position_label as shift_position_label, s.date as shift_date, s.start_hour as shift_start_hour, s.start_min as shift_start_min
     FROM applications a
     JOIN shifts s ON s.id = a.shift_id
     JOIN workers w ON w.id = a.worker_id
     WHERE s.company_id = ? AND a.status IN ('pending', 'invited', 'accepted')
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
    `SELECT a.*, ${CANDIDATE_WORKER_FIELDS}${await lookingForField(c.env)}
     FROM applications a JOIN workers w ON w.id = a.worker_id WHERE a.shift_id = ? ORDER BY a.created_at ASC`,
  )
    .bind(shiftId)
    .all<CandidateWorkerRow>();

  return c.json({ candidates: results.map(withWorkerPhotos) });
});

/** The full "invite" side effect, shared by both ways an employer can
 *  invite someone: accepting an applicant below, and proactively inviting
 *  a worker found via search (see /vacancies/:shiftId/invite/:workerId).
 *  Opens/reuses the shift-scoped chat (with the worker-only "you're
 *  invited" system message on first creation), pushes the in-app
 *  notification, and pings the bot — the worker still has to confirm (see
 *  applications.ts's /:id/respond) before they're actually on the shift. */
async function notifyInvite(
  c: Context<{ Bindings: Env; Variables: { session: unknown } }>,
  companyId: number,
  workerId: number,
  shift: { id: number | string; position_label: string },
): Promise<{ chatId: number }> {
  const company = await c.env.DB.prepare('SELECT name, address FROM companies WHERE id = ?').bind(companyId).first<{
    name: string;
    address: string;
  }>();

  let chat = await c.env.DB.prepare('SELECT id FROM chats WHERE company_id = ? AND worker_id = ? AND shift_id = ?')
    .bind(companyId, workerId, shift.id)
    .first<{ id: number }>();
  if (!chat) {
    chat = await c.env.DB.prepare('INSERT INTO chats (company_id, worker_id, shift_id) VALUES (?, ?, ?) RETURNING id')
      .bind(companyId, workerId, shift.id)
      .first<{ id: number }>();
    // Addressed to the worker ("Вас приглашают…") — the employer is the
    // one doing the inviting, so seeing this in their own chat view would
    // read like a message from nowhere. Scope it to the worker's side only.
    await c.env.DB.prepare("INSERT INTO messages (chat_id, sender, kind, text, visible_to) VALUES (?, 'system', 'system', ?, 'worker')")
      .bind(chat!.id, `Вас приглашают на смену «${shift.position_label}». ${company?.address ? `Адрес: ${company.address}` : ''}`)
      .run();
  }

  const title = `${company?.name ?? 'Работодатель'} приглашает вас на смену`;
  const subtitle = `«${shift.position_label}» — подтвердите в приложении`;
  await c.env.DB.prepare('INSERT INTO notifications (worker_id, kind, title, subtitle) VALUES (?, ?, ?, ?)')
    .bind(workerId, 'invited', title, subtitle)
    .run();

  const worker = await c.env.DB.prepare('SELECT telegram_id FROM workers WHERE id = ?').bind(workerId).first<{ telegram_id: number }>();
  if (worker) {
    c.executionCtx.waitUntil(
      notifyWorker(c.env, { id: workerId, telegramId: worker.telegram_id }, 'employer_replies', `🎉 ${title}\n${subtitle}`),
    );
  }

  return { chatId: chat!.id };
}

/** The employer's first decision on an applicant — "declined" is final,
 *  but "accepted" isn't a hire yet, just an invitation (see notifyInvite
 *  above for what that triggers). */
employerRoutes.post('/vacancies/:shiftId/candidates/:appId/decide', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const { shiftId, appId } = c.req.param();
  const { status } = await c.req.json<{ status: 'accepted' | 'declined' }>();

  const shift = await c.env.DB.prepare('SELECT id, position_label FROM shifts WHERE id = ? AND company_id = ?')
    .bind(shiftId, session.companyId)
    .first<{ id: number; position_label: string }>();
  if (!shift) return c.json({ error: 'not_found' }, 404);

  const app = await c.env.DB.prepare('SELECT * FROM applications WHERE id = ? AND shift_id = ?').bind(appId, shiftId).first<{
    worker_id: number;
  }>();
  if (!app) return c.json({ error: 'not_found' }, 404);

  const dbStatus = status === 'accepted' ? 'invited' : 'declined';
  await c.env.DB.prepare('UPDATE applications SET status = ? WHERE id = ?').bind(dbStatus, appId).run();

  if (dbStatus === 'invited') {
    await notifyInvite(c, session.companyId, app.worker_id, shift);
  }

  return c.json({ ok: true });
});

/** Proactively inviting a worker found via search/browse ("Поиск") straight
 *  onto one of the employer's own open shifts — the mirror image of
 *  accepting an applicant above, just without an existing application to
 *  start from. Requires a real, still-active vacancy: there's nothing to
 *  invite someone onto otherwise. Ends up in exactly the same place either
 *  way — a live 'invited' application, the worker sees it under Отклики
 *  and can confirm or decline (declining deletes the chat, see
 *  applications.ts's /:id/respond). */
employerRoutes.post('/vacancies/:shiftId/invite/:workerId', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  if (!(await requireVerifiedCompany(c.env, session.companyId))) return c.json({ error: 'not_verified' }, 403);
  const { shiftId, workerId } = c.req.param();

  const shift = await c.env.DB.prepare("SELECT id, position_label FROM shifts WHERE id = ? AND company_id = ? AND status = 'active'")
    .bind(shiftId, session.companyId)
    .first<{ id: number; position_label: string }>();
  if (!shift) return c.json({ error: 'not_found' }, 404);

  const worker = await c.env.DB.prepare("SELECT id FROM workers WHERE id = ? AND status != 'suspended'").bind(workerId).first();
  if (!worker) return c.json({ error: 'worker_not_found' }, 404);

  const existing = await c.env.DB.prepare('SELECT id, status FROM applications WHERE shift_id = ? AND worker_id = ?')
    .bind(shiftId, workerId)
    .first<{ id: number; status: string }>();

  if (existing && (existing.status === 'invited' || existing.status === 'accepted')) {
    return c.json({ error: 'already_invited' }, 409);
  }

  if (existing) {
    // 'pending' (they'd already applied themselves — this just fast-tracks
    // straight to invited) or 'declined'/'cancelled' (a closed decision,
    // same reasoning as the worker's own re-apply in applications.ts):
    // reuse the row instead of a fresh INSERT hitting the
    // shift_id+worker_id UNIQUE constraint.
    await c.env.DB.prepare(
      `UPDATE applications SET status = 'invited', work_stage = 'upcoming', check_in_at = NULL, closed_by_employer_at = NULL,
         rating = NULL, review_tags = NULL, review_comment = NULL,
         cancelled_by = NULL, cancel_reason = NULL, cancelled_at = NULL WHERE id = ?`,
    )
      .bind(existing.id)
      .run();
  } else {
    await c.env.DB.prepare("INSERT INTO applications (shift_id, worker_id, status, work_stage) VALUES (?, ?, 'invited', 'upcoming')")
      .bind(shiftId, workerId)
      .run();
  }

  const { chatId } = await notifyInvite(c, session.companyId, Number(workerId), shift);
  return c.json({ chatId });
});

/** Employer backs out of a candidate they already invited or confirmed —
 *  a reason is mandatory, same as the worker's own cancel below, so
 *  whoever's on the other end isn't just left guessing why the chat and
 *  the shift both disappeared. */
employerRoutes.post('/vacancies/:shiftId/candidates/:appId/cancel', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const { shiftId, appId } = c.req.param();
  const { reason } = await c.req.json<{ reason: string }>();
  if (!reason?.trim()) return c.json({ error: 'reason_required' }, 400);

  const shift = await c.env.DB.prepare('SELECT id, position_label FROM shifts WHERE id = ? AND company_id = ?')
    .bind(shiftId, session.companyId)
    .first<{ id: number; position_label: string }>();
  if (!shift) return c.json({ error: 'not_found' }, 404);

  const app = await c.env.DB.prepare('SELECT id, worker_id, status FROM applications WHERE id = ? AND shift_id = ?')
    .bind(appId, shiftId)
    .first<{ id: number; worker_id: number; status: string }>();
  if (!app) return c.json({ error: 'not_found' }, 404);
  if (app.status !== 'invited' && app.status !== 'accepted') return c.json({ error: 'not_cancellable' }, 400);

  const wasAccepted = app.status === 'accepted';
  await c.env.DB.prepare(
    "UPDATE applications SET status = 'cancelled', cancelled_by = 'employer', cancel_reason = ?, cancelled_at = datetime('now') WHERE id = ?",
  )
    .bind(reason.trim(), appId)
    .run();

  await deleteShiftChat(c.env, session.companyId, app.worker_id, shiftId);

  const company = await c.env.DB.prepare('SELECT name FROM companies WHERE id = ?').bind(session.companyId).first<{ name: string }>();
  const worker = await c.env.DB.prepare('SELECT telegram_id FROM workers WHERE id = ?').bind(app.worker_id).first<{ telegram_id: number }>();

  // Отзыв приглашения — не срыв: человек ещё не подтверждал. А вот отмена
  // уже подтверждённой смены за несколько часов — именно он.
  if (wasAccepted) {
    c.executionCtx.waitUntil(
      reportCancellation(c.env, {
        shiftId: Number(shiftId),
        by: 'employer',
        actorName: company?.name ?? 'Работодатель',
        reason: reason.trim(),
        companyId: session.companyId,
      }),
    );
  }

  const title = wasAccepted
    ? `${company?.name ?? 'Работодатель'} отменил(а) смену`
    : `${company?.name ?? 'Работодатель'} отозвал(а) приглашение`;
  const subtitle = `«${shift.position_label}» — причина: ${reason.trim()}`;
  await c.env.DB.prepare('INSERT INTO notifications (worker_id, kind, title, subtitle) VALUES (?, ?, ?, ?)')
    .bind(app.worker_id, 'cancelled_by_employer', title, subtitle)
    .run();
  if (worker) {
    c.executionCtx.waitUntil(
      notifyWorker(c.env, { id: app.worker_id, telegramId: worker.telegram_id }, 'employer_replies', `❌ ${title}\n${subtitle}`),
    );
  }

  return c.json({ ok: true });
});

/** The employer confirms a specific hire's shift actually happened — the
 *  day has to have passed, and the employer's own review of the worker is
 *  bundled into the same request (mandatory: closing without rating them
 *  isn't an option). This is also the signal that unlocks the worker's
 *  own mandatory review — see applications.ts's /:id/review, which
 *  refuses to run until work_stage is 'employer_closed'. */
employerRoutes.post('/vacancies/:shiftId/candidates/:appId/close', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const { shiftId, appId } = c.req.param();
  const { rating, tags, comment } = await c.req.json<{ rating: number; tags: string[]; comment: string }>();
  if (!rating || rating < 1 || rating > 5) return c.json({ error: 'rating_required' }, 400);

  const shift = await c.env.DB.prepare('SELECT id, date, end_date, position_label FROM shifts WHERE id = ? AND company_id = ?')
    .bind(shiftId, session.companyId)
    .first<{ id: number; date: string; end_date: string | null; position_label: string }>();
  if (!shift) return c.json({ error: 'shift_not_found' }, 404);

  // A multi-day posting isn't over until its *last* day has passed —
  // comparing against the start date would let it be closed (and reviewed)
  // while the worker still has days left to work.
  const lastDay = shift.end_date && shift.end_date > shift.date ? shift.end_date : shift.date;
  if (lastDay >= mskTodayStr()) return c.json({ error: 'too_early' }, 400);

  const app = await c.env.DB.prepare('SELECT id, worker_id, status, closed_by_employer_at FROM applications WHERE id = ? AND shift_id = ?')
    .bind(appId, shiftId)
    .first<{ id: number; worker_id: number; status: string; closed_by_employer_at: string | null }>();
  if (!app) return c.json({ error: 'application_not_found' }, 404);
  if (app.status !== 'accepted') return c.json({ error: 'not_accepted' }, 400);
  if (app.closed_by_employer_at) return c.json({ error: 'already_closed' }, 409);

  await c.env.DB.prepare(
    `UPDATE applications SET work_stage = 'employer_closed', closed_by_employer_at = datetime('now'),
       employer_rating = ?, employer_review_tags = ?, employer_review_comment = ? WHERE id = ?`,
  )
    .bind(rating, JSON.stringify(tags ?? []), comment ?? '', appId)
    .run();

  // Shared with every other place a review can appear or disappear, so a
  // deleted review lowers the score the same way leaving one raises it.
  await recomputeWorkerRating(c.env, app.worker_id);

  // Everything past this point is after-the-fact bookkeeping — the shift is
  // already closed and reviewed in the database. If notifying the worker or
  // tearing down the chat fails, that must not surface to the employer as
  // "не получилось закрыть смену": they'd retry, hit already_closed, and be
  // stuck looking at an error for work that actually succeeded.
  try {
    const company = await c.env.DB.prepare('SELECT name FROM companies WHERE id = ?').bind(session.companyId).first<{ name: string }>();
    const worker = await c.env.DB.prepare('SELECT telegram_id FROM workers WHERE id = ?').bind(app.worker_id).first<{ telegram_id: number }>();

    const title = `${company?.name ?? 'Работодатель'} закрыл(а) смену`;
    const subtitle = `«${shift.position_label}» — оставьте отзыв о том, как всё прошло`;
    await c.env.DB.prepare('INSERT INTO notifications (worker_id, kind, title, subtitle) VALUES (?, ?, ?, ?)')
      .bind(app.worker_id, 'shift_closed', title, subtitle)
      .run();

    if (worker) {
      c.executionCtx.waitUntil(
        notifyWorker(c.env, { id: app.worker_id, telegramId: worker.telegram_id }, 'employer_replies', `✅ ${title}\n${subtitle}`),
      );
    }

    // The chat was only ever meant to last for the duration of this hire —
    // once the shift is closed there's nothing left to coordinate about, so
    // it (and its messages, via ON DELETE CASCADE) goes away with it.
    await deleteShiftChat(c.env, session.companyId, app.worker_id, shiftId);
  } catch (err) {
    console.error('close-shift post-steps failed (shift itself is closed)', shiftId, appId, err);
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
 *  PASS_COOLDOWN_DAYS. Anketas hidden from the dashboard are left out
 *  entirely — that's the whole point of hiding one. */
employerRoutes.get('/workers', async (c) => {
  const session = requireCompany(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  if (!(await requireVerifiedCompany(c.env, session.companyId))) return c.json({ error: 'not_verified' }, 403);

  const positions = (c.req.query('positions') ?? '').split(',').filter(Boolean);
  if (positions.length === 0) return c.json({ workers: [] });

  const notHidden = await excludeHiddenSql(c.env, 'w');
  // Someone who only wants weekend shifts is a bad match for a permanent
  // job and vice versa — both sides used to find that out in the chat.
  // 'any' on either side means no narrowing, so the default costs nobody
  // any reach.
  const wantsType = await matchesLookingForSql(c.env, 'w', asLookingFor(c.req.query('lookingFor')));
  const placeholders = positions.map(() => '?').join(',');
  const { results } = await c.env.DB.prepare(
    `SELECT DISTINCT w.id as worker_id, ${CANDIDATE_WORKER_FIELDS}${await lookingForField(c.env)},
            (SELECT wp2.position_label FROM worker_positions wp2
             WHERE wp2.worker_id = w.id AND wp2.position IN (${placeholders})
             ORDER BY wp2.months DESC LIMIT 1) as matched_position_label
     FROM workers w
     JOIN worker_positions wp ON wp.worker_id = w.id
     LEFT JOIN telegram_accounts t ON t.telegram_id = w.telegram_id
     WHERE wp.position IN (${placeholders})
       AND w.status != 'suspended'
       ${notHidden}
       ${wantsType}
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

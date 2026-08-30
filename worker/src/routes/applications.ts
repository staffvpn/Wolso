import { Hono } from 'hono';
import type { Env } from '../types';
import { attachSession, requireWorker } from '../middleware/auth';
import { SHIFT_SELECT, shiftToJson, deleteShiftChat, type ShiftRow } from '../lib/db';
import { sendTelegramMessage } from '../lib/telegramBot';
import { recomputeCompanyRating } from '../lib/ratings';
import { workerIsHidden } from '../lib/hiddenProfiles';

export const applicationRoutes = new Hono<{ Bindings: Env; Variables: { session: unknown } }>();
applicationRoutes.use('*', attachSession);

interface AppRow {
  id: number;
  shift_id: number;
  worker_id: number;
  status: string;
  work_stage: string;
  check_in_at: string | null;
  closed_by_employer_at: string | null;
  rating: number | null;
  review_tags: string | null;
  review_comment: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
}

function appToJson(a: AppRow, shift?: ReturnType<typeof shiftToJson>) {
  return {
    id: a.id,
    shiftId: a.shift_id,
    status: a.status,
    workStage: a.work_stage,
    checkInAt: a.check_in_at,
    closedByEmployerAt: a.closed_by_employer_at,
    rating: a.rating,
    reviewTags: a.review_tags ? JSON.parse(a.review_tags) : [],
    reviewComment: a.review_comment,
    cancelledBy: a.cancelled_by,
    cancelReason: a.cancel_reason,
    cancelledAt: a.cancelled_at,
    createdAt: a.created_at,
    shift,
  };
}

applicationRoutes.get('/', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const { results } = await c.env.DB.prepare('SELECT * FROM applications WHERE worker_id = ? ORDER BY created_at DESC')
    .bind(session.workerId)
    .all<AppRow>();

  const out = [];
  for (const a of results) {
    const shiftRow = await c.env.DB.prepare(`${SHIFT_SELECT} WHERE s.id = ?`).bind(a.shift_id).first<ShiftRow>();
    out.push(appToJson(a, shiftRow ? shiftToJson(shiftRow) : undefined));
  }
  return c.json({ applications: out });
});

applicationRoutes.post('/', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const { shiftId } = await c.req.json<{ shiftId: number }>();

  // A hidden anketa is out of circulation: it isn't offered to employers in
  // "найти сотрудников", so it shouldn't be able to walk in the other door
  // either. The app hides the feed for these accounts (see ProfileHidden),
  // this is the enforcement behind it.
  if (await workerIsHidden(c.env, session.workerId)) return c.json({ error: 'profile_hidden' }, 403);

  const shift = await c.env.DB.prepare("SELECT id, company_id, position_label FROM shifts WHERE id = ? AND status = 'active'")
    .bind(shiftId)
    .first<{ id: number; company_id: number; position_label: string }>();
  if (!shift) return c.json({ error: 'shift_not_found' }, 404);

  const existing = await c.env.DB.prepare('SELECT id, status FROM applications WHERE shift_id = ? AND worker_id = ?')
    .bind(shiftId, session.workerId)
    .first<{ id: number; status: string }>();

  let inserted: AppRow | null;
  if (existing) {
    // A declined invite or a cancelled shift is a closed decision, not an
    // open one — the feed lets the shift reappear for this worker (see
    // feed.ts), so re-applying has to actually work rather than hit the
    // shift_id+worker_id UNIQUE constraint. Reuse the row instead of a
    // fresh INSERT, wiping the earlier outcome so it starts over cleanly.
    if (existing.status !== 'declined' && existing.status !== 'cancelled') return c.json({ error: 'already_applied' }, 409);
    inserted = await c.env.DB.prepare(
      `UPDATE applications
       SET status = 'pending', work_stage = 'upcoming', check_in_at = NULL, closed_by_employer_at = NULL,
           rating = NULL, review_tags = NULL, review_comment = NULL,
           cancelled_by = NULL, cancel_reason = NULL, cancelled_at = NULL, created_at = datetime('now')
       WHERE id = ? RETURNING *`,
    )
      .bind(existing.id)
      .first<AppRow>();
  } else {
    inserted = await c.env.DB.prepare(
      "INSERT INTO applications (shift_id, worker_id, status, work_stage) VALUES (?, ?, 'pending', 'upcoming') RETURNING *",
    )
      .bind(shiftId, session.workerId)
      .first<AppRow>();
  }

  const worker = await c.env.DB.prepare('SELECT name FROM workers WHERE id = ?').bind(session.workerId).first<{ name: string }>();
  await c.env.DB.prepare('INSERT INTO notifications (company_id, kind, title, subtitle) VALUES (?, ?, ?, ?)')
    .bind(shift.company_id, 'new_response', 'Новый отклик на смену', worker?.name ?? 'Соискатель откликнулся')
    .run();

  const company = await c.env.DB.prepare('SELECT owner_telegram_id FROM companies WHERE id = ?')
    .bind(shift.company_id)
    .first<{ owner_telegram_id: number }>();
  if (company) {
    const text = `📩 Новый отклик на «${shift.position_label}»\n${worker?.name ?? 'Соискатель'} хочет выйти на смену`;
    c.executionCtx.waitUntil(sendTelegramMessage(c.env, company.owner_telegram_id, text));
  }

  return c.json({ application: appToJson(inserted!) });
});

async function ownedApplication(env: Env, id: string, workerId: number) {
  return env.DB.prepare('SELECT * FROM applications WHERE id = ? AND worker_id = ?').bind(id, workerId).first<AppRow>();
}

/** The worker's answer to an employer's invitation — confirming is what
 *  actually makes them the hire; declining ends it here, same as never
 *  having been invited, and the chat goes with it. */
applicationRoutes.post('/:id/respond', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const app = await ownedApplication(c.env, c.req.param('id'), session.workerId);
  if (!app) return c.json({ error: 'not_found' }, 404);
  if (app.status !== 'invited') return c.json({ error: 'not_invited' }, 400);

  const { accept } = await c.req.json<{ accept: boolean }>();
  const shift = await c.env.DB.prepare('SELECT company_id, position_label FROM shifts WHERE id = ?')
    .bind(app.shift_id)
    .first<{ company_id: number; position_label: string }>();
  const worker = await c.env.DB.prepare('SELECT name FROM workers WHERE id = ?').bind(session.workerId).first<{ name: string }>();

  if (accept) {
    await c.env.DB.prepare("UPDATE applications SET status = 'accepted' WHERE id = ?").bind(app.id).run();
    if (shift) {
      const title = `${worker?.name ?? 'Кандидат'} подтвердил(а) смену`;
      const subtitle = `«${shift.position_label}»`;
      await c.env.DB.prepare('INSERT INTO notifications (company_id, kind, title, subtitle) VALUES (?, ?, ?, ?)')
        .bind(shift.company_id, 'invite_accepted', title, subtitle)
        .run();
      const company = await c.env.DB.prepare('SELECT owner_telegram_id FROM companies WHERE id = ?')
        .bind(shift.company_id)
        .first<{ owner_telegram_id: number }>();
      if (company) c.executionCtx.waitUntil(sendTelegramMessage(c.env, company.owner_telegram_id, `✅ ${title}\n${subtitle}`));
    }
  } else {
    await c.env.DB.prepare("UPDATE applications SET status = 'declined' WHERE id = ?").bind(app.id).run();
    if (shift) {
      await deleteShiftChat(c.env, shift.company_id, session.workerId, app.shift_id);
      const title = `${worker?.name ?? 'Кандидат'} отклонил(а) приглашение`;
      const subtitle = `«${shift.position_label}»`;
      await c.env.DB.prepare('INSERT INTO notifications (company_id, kind, title, subtitle) VALUES (?, ?, ?, ?)')
        .bind(shift.company_id, 'invite_declined', title, subtitle)
        .run();
      const company = await c.env.DB.prepare('SELECT owner_telegram_id FROM companies WHERE id = ?')
        .bind(shift.company_id)
        .first<{ owner_telegram_id: number }>();
      if (company) c.executionCtx.waitUntil(sendTelegramMessage(c.env, company.owner_telegram_id, `↩️ ${title}\n${subtitle}`));
    }
  }

  return c.json({ ok: true });
});

/** A worker who already confirmed a shift can still back out — a reason
 *  is mandatory, matching the employer's own /vacancies/:id/candidates/:id/cancel,
 *  so the employer isn't left guessing why someone they were counting on
 *  just disappeared from the chat. */
applicationRoutes.post('/:id/cancel', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const app = await ownedApplication(c.env, c.req.param('id'), session.workerId);
  if (!app) return c.json({ error: 'not_found' }, 404);
  if (app.status !== 'accepted') return c.json({ error: 'not_accepted' }, 400);
  if (app.work_stage !== 'upcoming') return c.json({ error: 'already_started' }, 400);

  const { reason } = await c.req.json<{ reason: string }>();
  if (!reason?.trim()) return c.json({ error: 'reason_required' }, 400);

  await c.env.DB.prepare(
    "UPDATE applications SET status = 'cancelled', cancelled_by = 'worker', cancel_reason = ?, cancelled_at = datetime('now') WHERE id = ?",
  )
    .bind(reason.trim(), app.id)
    .run();

  const shift = await c.env.DB.prepare('SELECT company_id, position_label FROM shifts WHERE id = ?')
    .bind(app.shift_id)
    .first<{ company_id: number; position_label: string }>();
  if (shift) {
    await deleteShiftChat(c.env, shift.company_id, session.workerId, app.shift_id);

    const worker = await c.env.DB.prepare('SELECT name FROM workers WHERE id = ?').bind(session.workerId).first<{ name: string }>();
    const title = `${worker?.name ?? 'Сотрудник'} не сможет выйти на смену`;
    const subtitle = `«${shift.position_label}» — причина: ${reason.trim()}`;
    await c.env.DB.prepare('INSERT INTO notifications (company_id, kind, title, subtitle) VALUES (?, ?, ?, ?)')
      .bind(shift.company_id, 'cancelled_by_worker', title, subtitle)
      .run();
    const company = await c.env.DB.prepare('SELECT owner_telegram_id FROM companies WHERE id = ?')
      .bind(shift.company_id)
      .first<{ owner_telegram_id: number }>();
    if (company) c.executionCtx.waitUntil(sendTelegramMessage(c.env, company.owner_telegram_id, `❌ ${title}\n${subtitle}`));
  }

  return c.json({ ok: true });
});

applicationRoutes.post('/:id/check-in', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const app = await ownedApplication(c.env, c.req.param('id'), session.workerId);
  if (!app) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare("UPDATE applications SET work_stage = 'checked_in', check_in_at = datetime('now') WHERE id = ?")
    .bind(app.id)
    .run();
  return c.json({ ok: true });
});

/** The worker's review of the shift/employer — mandatory, and only once
 *  the employer has actually closed the shift (see employer.ts's
 *  /vacancies/:id/candidates/:id/close). That's the real "this happened"
 *  signal now, not worker self-checkout. */
applicationRoutes.post('/:id/review', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const app = await ownedApplication(c.env, c.req.param('id'), session.workerId);
  if (!app) return c.json({ error: 'not_found' }, 404);
  if (app.work_stage !== 'employer_closed') return c.json({ error: 'not_ready' }, 400);

  const { rating, tags, comment } = await c.req.json<{ rating: number; tags: string[]; comment: string }>();
  if (!rating || rating < 1 || rating > 5) return c.json({ error: 'rating_required' }, 400);

  const shift = await c.env.DB.prepare('SELECT company_id FROM shifts WHERE id = ?').bind(app.shift_id).first<{ company_id: number }>();

  await c.env.DB.prepare("UPDATE applications SET work_stage = 'reviewed', rating = ?, review_tags = ?, review_comment = ? WHERE id = ?")
    .bind(rating, JSON.stringify(tags ?? []), comment ?? '', app.id)
    .run();

  await c.env.DB.prepare('UPDATE workers SET shifts_completed = shifts_completed + 1 WHERE id = ?').bind(session.workerId).run();

  if (shift) await recomputeCompanyRating(c.env, shift.company_id);

  return c.json({ ok: true });
});

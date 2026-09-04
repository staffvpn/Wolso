import { Hono } from 'hono';
import type { Env } from '../types';
import { attachSession, requireWorker } from '../middleware/auth';
import { SHIFT_SELECT, shiftToJson, type ShiftRow } from '../lib/db';
import { datesColumnExists } from '../lib/shiftDates';

export const feedRoutes = new Hono<{ Bindings: Env; Variables: { session: unknown } }>();
feedRoutes.use('*', attachSession);

/** GET /shifts — the swipe feed, filtered server-side so the client never
 *  has to fetch more than what it can show. */
feedRoutes.get('/', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const q = c.req.query();
  const positions = q.positions ? q.positions.split(',').filter(Boolean) : [];
  const rateFrom = q.rateFrom ? Number(q.rateFrom) : undefined;
  const radiusKm = q.radiusKm && q.radiusKm !== 'city' ? Number(q.radiusKm) : undefined;
  const urgentOnly = q.urgentOnly === 'true';
  const employmentType = q.employmentType || undefined;
  const when = q.when || 'upcoming';
  const timeOfDay = q.timeOfDay ? q.timeOfDay.split(',').filter(Boolean) : [];

  const clauses = ["s.status = 'active'"];
  const binds: unknown[] = [];

  if (positions.length) {
    clauses.push(`s.position IN (${positions.map(() => '?').join(',')})`);
    binds.push(...positions);
  }
  if (rateFrom) {
    clauses.push('s.hourly_rate >= ?');
    binds.push(rateFrom);
  }
  if (urgentOnly) clauses.push("s.urgency = 'urgent'");
  if (employmentType) {
    clauses.push('s.employment_type = ?');
    binds.push(employmentType);
  }
  if (timeOfDay.length) {
    clauses.push(`s.time_of_day IN (${timeOfDay.map(() => '?').join(',')})`);
    binds.push(...timeOfDay);
  }
  // Every date rule below is about *shifts*. A permanent posting is an
  // ongoing job, not a day of work: it carries a date only because the
  // column is NOT NULL, and that date is just when it was published. Left
  // to the date filter it fell out of the feed the day after it was
  // posted — which is exactly how "не вижу никаких вакансий" happened. A
  // permanent job is open today, tomorrow and next week alike, so it
  // passes whatever the date filter is set to.
  const ongoing = "s.employment_type = 'permanent'";
  // Последний день вакансии, а не первый. Смена может стоять на нескольких
  // днях — подряд или вразнобой (13-е и 27-е), — и пока хоть один из них
  // впереди, вакансия открыта и её надо показывать. По первому дню она
  // пропадала из ленты 14-го, хотя работодатель всё ещё ищет человека на
  // 27-е.
  const lastDay = "COALESCE(NULLIF(s.end_date, ''), s.date)";
  // Столбец dates называем, только когда он есть: миграции накатываются
  // руками, а лента без ленты — это весь экран соискателя.
  const hasDates = await datesColumnExists(c.env);

  if (when === 'today' || when === 'tomorrow') {
    const target = new Date();
    if (when === 'tomorrow') target.setDate(target.getDate() + 1);
    const day = target.toISOString().slice(0, 10);
    // День попадает в вакансию, если он внутри её границ и (когда дни
    // перечислены явно) есть в самом списке. instr по ISO-дате не может
    // случайно совпасть с другой датой — формат фиксированной длины.
    const inSet = hasDates ? ` AND (s.dates = '' OR instr(s.dates, ?) > 0)` : '';
    clauses.push(`(${ongoing} OR (? BETWEEN s.date AND ${lastDay}${inSet}))`);
    binds.push(day);
    if (hasDates) binds.push(day);
  } else {
    // 'upcoming' (default — no date chip explicitly picked) and 'custom'
    // (not actually wired to specific dates yet) both show every shift
    // from today on, so a shift posted for tomorrow or later doesn't
    // silently disappear from the feed just because nobody narrowed the
    // date filter. Still excludes shifts whose every day is in the past.
    clauses.push(`(${ongoing} OR ${lastDay} >= ?)`);
    binds.push(new Date().toISOString().slice(0, 10));
  }

  // Only a *live* application on this shift hides it from the feed —
  // something already pending, invited, or confirmed. A declined invite or
  // a cancelled shift is a closed decision, not an ongoing one: the shift
  // is still open and other workers still see it, so this worker should
  // too rather than have it disappear from their feed forever.
  clauses.push(
    "s.id NOT IN (SELECT shift_id FROM applications WHERE worker_id = ? AND status IN ('pending', 'invited', 'accepted'))",
  );
  binds.push(session.kind === 'worker' ? session.workerId : -1);

  // radiusKm is accepted but not yet applied — there's no lat/lng captured
  // client-side to filter against. Wire it up once Telegram's location
  // API (or manual city/address geocoding) is in.
  void radiusKm;

  const sql = `${SHIFT_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY s.created_at DESC LIMIT 100`;
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all<ShiftRow>();

  return c.json({ shifts: results.map(shiftToJson) });
});

feedRoutes.get('/:id', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const row = await c.env.DB.prepare(`${SHIFT_SELECT} WHERE s.id = ?`).bind(c.req.param('id')).first<ShiftRow>();
  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json({ shift: shiftToJson(row) });
});

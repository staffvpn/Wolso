import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, requireStaffMiddleware } from '../middleware/auth';

export const adminDashboardRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminDashboardRoutes.use('*', attachSession);

const WEEKDAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

adminDashboardRoutes.get('/', requireStaffMiddleware, async (c) => {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const d60 = new Date(now.getTime() - 60 * 86400000).toISOString();

  const [published30, published60to30, filled, activeShiftsOrLater, activeWorkers, filledPrev, activeShiftsOrLaterPrev, activeWorkersPrev] =
    await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as n FROM shifts WHERE created_at >= ?').bind(d30).first<{ n: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as n FROM shifts WHERE created_at >= ? AND created_at < ?').bind(d60, d30).first<{ n: number }>(),
      c.env.DB.prepare(
        `SELECT COUNT(DISTINCT s.id) as n FROM shifts s JOIN applications a ON a.shift_id = s.id
         WHERE a.status = 'accepted' AND s.created_at >= ?`,
      )
        .bind(d30)
        .first<{ n: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as n FROM shifts WHERE created_at >= ?').bind(d30).first<{ n: number }>(),
      c.env.DB.prepare('SELECT COUNT(DISTINCT worker_id) as n FROM applications WHERE created_at >= ?').bind(d30).first<{ n: number }>(),
      c.env.DB.prepare(
        `SELECT COUNT(DISTINCT s.id) as n FROM shifts s JOIN applications a ON a.shift_id = s.id
         WHERE a.status = 'accepted' AND s.created_at >= ? AND s.created_at < ?`,
      )
        .bind(d60, d30)
        .first<{ n: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as n FROM shifts WHERE created_at >= ? AND created_at < ?')
        .bind(d60, d30)
        .first<{ n: number }>(),
      c.env.DB.prepare('SELECT COUNT(DISTINCT worker_id) as n FROM applications WHERE created_at >= ? AND created_at < ?')
        .bind(d60, d30)
        .first<{ n: number }>(),
    ]);

  const vacanciesPublished = published30?.n ?? 0;
  const prevPublished = published60to30?.n ?? 0;
  const vacanciesPublishedDeltaPct = prevPublished ? Math.round(((vacanciesPublished - prevPublished) / prevPublished) * 100) : 0;
  const closedSameDayPct = activeShiftsOrLater?.n ? Math.round(((filled?.n ?? 0) / activeShiftsOrLater.n) * 100) : 0;
  const closedSameDayPctPrev = activeShiftsOrLaterPrev?.n ? Math.round(((filledPrev?.n ?? 0) / activeShiftsOrLaterPrev.n) * 100) : 0;
  const closedSameDayDeltaPp = closedSameDayPct - closedSameDayPctPrev;
  const activeWorkersDeltaPct = activeWorkersPrev?.n
    ? Math.round((((activeWorkers?.n ?? 0) - activeWorkersPrev.n) / activeWorkersPrev.n) * 100)
    : 0;

  const weekly: { day: string; shifts: number; responses: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 86400000);
    const dateStr = day.toISOString().slice(0, 10);
    const shiftsCount = await c.env.DB.prepare("SELECT COUNT(*) as n FROM shifts WHERE date(created_at) = ?").bind(dateStr).first<{ n: number }>();
    const responsesCount = await c.env.DB.prepare("SELECT COUNT(*) as n FROM applications WHERE date(created_at) = ?")
      .bind(dateStr)
      .first<{ n: number }>();
    weekly.push({ day: WEEKDAY_LABELS[day.getDay()], shifts: shiftsCount?.n ?? 0, responses: responsesCount?.n ?? 0 });
  }

  const { results: topPositions } = await c.env.DB.prepare(
    `SELECT position_label as label, COUNT(*) as count FROM shifts WHERE created_at >= ?
     GROUP BY position_label ORDER BY count DESC LIMIT 4`,
  )
    .bind(d30)
    .all<{ label: string; count: number }>();

  return c.json({
    vacanciesPublished,
    vacanciesPublishedDeltaPct,
    closedSameDayPct,
    closedSameDayDeltaPp,
    activeWorkers: activeWorkers?.n ?? 0,
    activeWorkersDeltaPct,
    weekly,
    topPositions,
  });
});

/** Воронка: где именно отваливаются люди. Счётчики «смен за 30 дней» и
 *  «откликов за 30 дней» показывают объём, но не то, на каком шаге всё
 *  ломается, — а на ранней стадии продукта нужно ровно это.
 *
 *  Считаем по обеим сторонам отдельно: у соискателя и работодателя разные
 *  пути и отваливаются они в разных местах. Окно — параметр, потому что
 *  «за неделю» и «за всё время» отвечают на разные вопросы. */
adminDashboardRoutes.get('/funnel', requireStaffMiddleware, async (c) => {
  const days = Math.min(Math.max(Number(c.req.query('days') ?? '30'), 1), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const one = async (sql: string) => (await c.env.DB.prepare(sql).bind(since).first<{ n: number }>())?.n ?? 0;

  // «Заполнил анкету» повторяет проверку из routes/profile.ts: без реального
  // опыта (months > 0) анкета не считается заполненной — см. миграцию 0029.
  const [registered, completed, applied, invited, worked] = await Promise.all([
    one('SELECT COUNT(*) as n FROM workers WHERE created_at >= ?'),
    one(`SELECT COUNT(*) as n FROM workers w WHERE w.created_at >= ?
           AND w.name != '' AND w.bio != '' AND w.skills != '' AND w.birthdate IS NOT NULL
           AND EXISTS (SELECT 1 FROM worker_positions wp WHERE wp.worker_id = w.id AND wp.months > 0)`),
    one(`SELECT COUNT(DISTINCT a.worker_id) as n FROM applications a
         JOIN workers w ON w.id = a.worker_id WHERE w.created_at >= ?`),
    one(`SELECT COUNT(DISTINCT a.worker_id) as n FROM applications a
         JOIN workers w ON w.id = a.worker_id
         WHERE w.created_at >= ? AND a.status IN ('invited', 'accepted')`),
    one(`SELECT COUNT(DISTINCT a.worker_id) as n FROM applications a
         JOIN workers w ON w.id = a.worker_id
         WHERE w.created_at >= ? AND a.work_stage IN ('employer_closed', 'reviewed')`),
  ]);

  const [coRegistered, coCompleted, coApproved, coPublished, coHired] = await Promise.all([
    one('SELECT COUNT(*) as n FROM companies WHERE created_at >= ?'),
    one(`SELECT COUNT(*) as n FROM companies WHERE created_at >= ?
           AND name != '' AND description != '' AND founded_year IS NOT NULL AND avatar_data IS NOT NULL AND inn IS NOT NULL`),
    one("SELECT COUNT(*) as n FROM companies WHERE created_at >= ? AND verification_status = 'approved'"),
    one(`SELECT COUNT(DISTINCT s.company_id) as n FROM shifts s
         JOIN companies co ON co.id = s.company_id WHERE co.created_at >= ?`),
    one(`SELECT COUNT(DISTINCT s.company_id) as n FROM shifts s
         JOIN applications a ON a.shift_id = s.id
         JOIN companies co ON co.id = s.company_id
         WHERE co.created_at >= ? AND a.status = 'accepted'`),
  ]);

  return c.json({
    days,
    workers: [
      { step: 'Зарегистрировались', count: registered },
      { step: 'Заполнили анкету', count: completed },
      { step: 'Откликнулись', count: applied },
      { step: 'Получили приглашение', count: invited },
      { step: 'Вышли на смену', count: worked },
    ],
    companies: [
      { step: 'Зарегистрировались', count: coRegistered },
      { step: 'Заполнили профиль', count: coCompleted },
      { step: 'Прошли проверку', count: coApproved },
      { step: 'Опубликовали смену', count: coPublished },
      { step: 'Кого-то наняли', count: coHired },
    ],
  });
});

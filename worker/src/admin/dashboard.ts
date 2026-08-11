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

  const [published30, published60to30, filled, activeShiftsOrLater, activeWorkers] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as n FROM shifts WHERE created_at >= ?').bind(d30).first<{ n: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as n FROM shifts WHERE created_at >= ? AND created_at < ?').bind(d60, d30).first<{ n: number }>(),
    c.env.DB.prepare(
      `SELECT COUNT(DISTINCT s.id) as n FROM shifts s JOIN applications a ON a.shift_id = s.id
       WHERE s.status != 'pending_review' AND a.status = 'accepted' AND s.created_at >= ?`,
    )
      .bind(d30)
      .first<{ n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as n FROM shifts WHERE status != 'pending_review' AND created_at >= ?").bind(d30).first<{ n: number }>(),
    c.env.DB.prepare('SELECT COUNT(DISTINCT worker_id) as n FROM applications WHERE created_at >= ?').bind(d30).first<{ n: number }>(),
  ]);

  const vacanciesPublished = published30?.n ?? 0;
  const prevPublished = published60to30?.n ?? 0;
  const vacanciesPublishedDeltaPct = prevPublished ? Math.round(((vacanciesPublished - prevPublished) / prevPublished) * 100) : 0;
  const closedSameDayPct = activeShiftsOrLater?.n ? Math.round(((filled?.n ?? 0) / activeShiftsOrLater.n) * 100) : 0;

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

  const [pendingVacancies, pendingComplaints, pendingDocuments] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as n FROM shifts WHERE status = 'pending_review'").first<{ n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as n FROM complaints WHERE status = 'pending'").first<{ n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as n FROM worker_documents WHERE status = 'pending'").first<{ n: number }>(),
  ]);

  return c.json({
    vacanciesPublished,
    vacanciesPublishedDeltaPct,
    closedSameDayPct,
    activeWorkers: activeWorkers?.n ?? 0,
    weekly,
    topPositions,
    attention: [
      { label: 'Вакансии на модерации', count: pendingVacancies?.n ?? 0, tone: 'warning' },
      { label: 'Жалобы на работодателей', count: pendingComplaints?.n ?? 0, tone: 'danger' },
      { label: 'Документы на проверку', count: pendingDocuments?.n ?? 0, tone: 'info' },
    ],
  });
});

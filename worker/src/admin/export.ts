import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, actorLabel, logAction, requirePermission, requireStaff } from '../middleware/auth';

export const adminExportRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminExportRoutes.use('*', attachSession);

/** Выгрузки для отчёта или разбора — до сих пор данные можно было только
 *  разглядывать на экране. Три набора, которые реально просят: люди,
 *  смены, отклики.
 *
 *  Никаких телефонов и e-mail здесь нет по той же причине, по какой их нет
 *  на экранах: файл уходит из системы и живёт дальше сам по себе. Telegram
 *  id оставлен — без него строки не с чем сопоставить. */
const EXPORTS: Record<string, { sql: string; filename: string }> = {
  seekers: {
    filename: 'wolso-seekers',
    sql: `SELECT w.id, w.name, w.city, w.telegram_id, w.telegram_username, w.rating, w.shifts_completed,
                 w.status, w.created_at,
                 (SELECT COUNT(*) FROM applications a WHERE a.worker_id = w.id) as applications,
                 (SELECT GROUP_CONCAT(position_label || ' (' || months || ' мес.)', '; ')
                    FROM worker_positions wp WHERE wp.worker_id = w.id) as experience
          FROM workers w ORDER BY w.created_at DESC`,
  },
  employers: {
    filename: 'wolso-employers',
    sql: `SELECT co.id, co.name, co.city, co.address, co.inn, co.owner_telegram_id, co.telegram_username,
                 co.verification_status, co.status, co.rating, co.created_at,
                 (SELECT COUNT(*) FROM shifts s WHERE s.company_id = co.id) as shifts
          FROM companies co ORDER BY co.created_at DESC`,
  },
  shifts: {
    filename: 'wolso-shifts',
    sql: `SELECT s.id, co.name as company, s.position_label, s.date, s.end_date,
                 s.start_hour, s.start_min, s.end_hour, s.end_min,
                 s.hourly_rate, s.total_pay, s.employment_type, s.status, s.created_at,
                 (SELECT COUNT(*) FROM applications a WHERE a.shift_id = s.id) as responses,
                 (SELECT COUNT(*) FROM applications a WHERE a.shift_id = s.id AND a.status = 'accepted') as hired
          FROM shifts s JOIN companies co ON co.id = s.company_id ORDER BY s.created_at DESC`,
  },
  applications: {
    filename: 'wolso-applications',
    sql: `SELECT a.id, w.name as worker, co.name as company, s.position_label, s.date,
                 a.status, a.work_stage, a.employer_rating, a.rating as worker_rating,
                 a.cancelled_by, a.cancel_reason, a.created_at
          FROM applications a
          JOIN workers w ON w.id = a.worker_id
          JOIN shifts s ON s.id = a.shift_id
          JOIN companies co ON co.id = s.company_id
          ORDER BY a.created_at DESC`,
  },
};

/** Excel по-русски открывает CSV, разделённый точкой с запятой, а запятую
 *  игнорирует — файл, который не открывается двойным щелчком, бесполезен.
 *  Плюс BOM, иначе кириллица приезжает крякозябрами. */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '﻿';
  const headers = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(';'), ...rows.map((r) => headers.map((h) => cell(r[h])).join(';'))];
  return `﻿${lines.join('\r\n')}`;
}

/** manageData, а не общий доступ: выгрузка — это вся база одним файлом,
 *  и она должна стоить того же права, что и удаление. Каждая попадает в
 *  аудит-лог. */
adminExportRoutes.get('/:dataset', requirePermission('manageData'), async (c) => {
  const session = requireStaff(c as never)!;
  const dataset = c.req.param('dataset') ?? '';
  const spec = EXPORTS[dataset];
  if (!spec) return c.json({ error: 'unknown_dataset' }, 404);

  const { results } = await c.env.DB.prepare(spec.sql).all<Record<string, unknown>>();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `выгрузила «${dataset}» в CSV (${results.length} строк)`, 'neutral');

  const date = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(results), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${spec.filename}-${date}.csv"`,
    },
  });
});

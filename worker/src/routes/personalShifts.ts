import { Hono } from 'hono';
import type { Env } from '../types';
import { attachSession, requireWorker } from '../middleware/auth';

export const personalShiftRoutes = new Hono<{ Bindings: Env; Variables: { session: unknown } }>();
personalShiftRoutes.use('*', attachSession);

/** Личные смены — то, что человек ведёт для себя. Ни одна другая часть
 *  системы в эту таблицу не смотрит: ни лента, ни поиск сотрудников, ни
 *  дашборд, ни воронка, ни статистика работодателей. Каждая ручка здесь
 *  ограничена worker_id из сессии, так что и чужую личную смену достать
 *  нельзя — включая по прямой ссылке на id. */

interface Row {
  id: number;
  place_name: string;
  address: string;
  position_label: string;
  date: string;
  start_hour: number;
  start_min: number;
  end_hour: number;
  end_min: number;
  pay: number;
  notes: string;
  created_at: string;
}

function toJson(r: Row) {
  return {
    id: r.id,
    placeName: r.place_name,
    address: r.address,
    positionLabel: r.position_label,
    date: r.date,
    startHour: r.start_hour,
    startMin: r.start_min,
    endHour: r.end_hour,
    endMin: r.end_min,
    pay: r.pay,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

/** Whether migration 0032 has been applied — same probe-first pattern as
 *  everywhere else here, because migrations are run by hand and a query
 *  against a table that doesn't exist becomes a bare internal_error 500. */
let tableConfirmed = false;

async function tableExists(env: Env): Promise<boolean> {
  if (tableConfirmed) return true;
  try {
    const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'personal_shifts'").first();
    tableConfirmed = !!row;
    return tableConfirmed;
  } catch {
    return false;
  }
}

interface Body {
  placeName?: string;
  address?: string;
  positionLabel?: string;
  date?: string;
  startHour?: number;
  startMin?: number;
  endHour?: number;
  endMin?: number;
  pay?: number;
  notes?: string;
}

/** Что обязательно, а что нет. Название, должность, дата и время — без них
 *  запись бессмысленна в календаре. Адрес, оплата и заметки необязательны:
 *  человек может занести смену на бегу и дописать оплату потом (для этого и
 *  есть редактирование отработанной). */
function validate(b: Body): string | null {
  if (!b.placeName?.trim()) return 'place_required';
  if (!b.positionLabel?.trim()) return 'position_required';
  if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return 'date_required';
  for (const [h, m] of [
    [b.startHour, b.startMin],
    [b.endHour, b.endMin],
  ] as const) {
    if (!Number.isInteger(h) || h! < 0 || h! > 23) return 'time_required';
    if (!Number.isInteger(m) || m! < 0 || m! > 59) return 'time_required';
  }
  if (b.pay !== undefined && (!Number.isFinite(b.pay) || b.pay < 0)) return 'pay_invalid';
  return null;
}

personalShiftRoutes.get('/', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  if (!(await tableExists(c.env))) return c.json({ shifts: [] });

  const { results } = await c.env.DB.prepare('SELECT * FROM personal_shifts WHERE worker_id = ? ORDER BY date DESC, start_hour DESC')
    .bind(session.workerId)
    .all<Row>();
  return c.json({ shifts: results.map(toJson) });
});

personalShiftRoutes.post('/', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  if (!(await tableExists(c.env))) {
    return c.json({ error: 'migration_required', migration: '0032_personal_shifts' }, 400);
  }

  const body = await c.req.json<Body>().catch((): Body => ({}));
  const problem = validate(body);
  if (problem) return c.json({ error: problem }, 400);

  const row = await c.env.DB.prepare(
    `INSERT INTO personal_shifts (worker_id, place_name, address, position_label, date,
                                  start_hour, start_min, end_hour, end_min, pay, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  )
    .bind(
      session.workerId,
      body.placeName!.trim().slice(0, 200),
      (body.address ?? '').trim().slice(0, 300),
      body.positionLabel!.trim().slice(0, 100),
      body.date,
      body.startHour,
      body.startMin ?? 0,
      body.endHour,
      body.endMin ?? 0,
      Math.round(body.pay ?? 0),
      (body.notes ?? '').trim().slice(0, 1000),
    )
    .first<Row>();

  return c.json({ shift: toJson(row!) });
});

personalShiftRoutes.patch('/:id', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  if (!(await tableExists(c.env))) {
    return c.json({ error: 'migration_required', migration: '0032_personal_shifts' }, 400);
  }

  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM personal_shifts WHERE id = ? AND worker_id = ?')
    .bind(id, session.workerId)
    .first<Row>();
  if (!existing) return c.json({ error: 'not_found' }, 404);

  const body = await c.req.json<Body>().catch((): Body => ({}));
  // Правки частичные: экран может прислать одну изменённую оплату. Сливаем
  // с тем, что уже лежит, и проверяем результат целиком — иначе половинчатая
  // правка могла бы оставить запись без времени.
  const merged: Body = {
    placeName: body.placeName ?? existing.place_name,
    address: body.address ?? existing.address,
    positionLabel: body.positionLabel ?? existing.position_label,
    date: body.date ?? existing.date,
    startHour: body.startHour ?? existing.start_hour,
    startMin: body.startMin ?? existing.start_min,
    endHour: body.endHour ?? existing.end_hour,
    endMin: body.endMin ?? existing.end_min,
    pay: body.pay ?? existing.pay,
    notes: body.notes ?? existing.notes,
  };
  const problem = validate(merged);
  if (problem) return c.json({ error: problem }, 400);

  const row = await c.env.DB.prepare(
    `UPDATE personal_shifts
     SET place_name = ?, address = ?, position_label = ?, date = ?,
         start_hour = ?, start_min = ?, end_hour = ?, end_min = ?, pay = ?, notes = ?,
         updated_at = datetime('now')
     WHERE id = ? AND worker_id = ? RETURNING *`,
  )
    .bind(
      merged.placeName!.trim().slice(0, 200),
      (merged.address ?? '').trim().slice(0, 300),
      merged.positionLabel!.trim().slice(0, 100),
      merged.date,
      merged.startHour,
      merged.startMin,
      merged.endHour,
      merged.endMin,
      Math.round(merged.pay ?? 0),
      (merged.notes ?? '').trim().slice(0, 1000),
      id,
      session.workerId,
    )
    .first<Row>();

  return c.json({ shift: toJson(row!) });
});

personalShiftRoutes.delete('/:id', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  if (!(await tableExists(c.env))) return c.json({ ok: true });

  await c.env.DB.prepare('DELETE FROM personal_shifts WHERE id = ? AND worker_id = ?').bind(c.req.param('id'), session.workerId).run();
  return c.json({ ok: true });
});

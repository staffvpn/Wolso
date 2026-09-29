import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, actorLabel, logAction, requirePermission, requireStaff } from '../middleware/auth';
import { getShiftSelect, shiftToJson, type ShiftRow } from '../lib/db';
import { readUpload, setAvatar, addGalleryPhoto, deleteGalleryPhoto } from '../lib/media';
import { datesColumnExists, datesColumnValue, expandDates, isConsecutive, normalizeDates } from '../lib/shiftDates';
import { asPayMode, derivePay, payModeColumnExists } from '../lib/payMode';
import { notifyWorker } from '../lib/notifyPrefs';
import { notifyMatchingWorkers } from '../routes/employer';
import { recomputeWorkerRating, recomputeCompanyRating } from '../lib/ratings';

/** «Работодатели», которых заводит сам админ вместо реального бизнеса, пока
 *  тот не зарегистрировался сам (см. migration 0047 и комментарий в
 *  routes/applications.ts). Вакансия выглядит и работает как настоящая —
 *  лента, отклики, приглашения — разница только в том, кто ей управляет.
 *
 *  Права те же, что у /admin/recompute-ratings и удаления отзывов
 *  (manageData): создавать и удалять контент от лица площадки — это тот же
 *  уровень ответственности. */
export const adminProxyEmployerRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminProxyEmployerRoutes.use('*', attachSession);

async function proxyColumnExists(env: Env): Promise<boolean> {
  try {
    const { results } = await env.DB.prepare('PRAGMA table_info(companies)').all<{ name: string }>();
    return results.some((r) => r.name === 'is_proxy');
  } catch {
    return false;
  }
}

async function requireMigration(c: { env: Env; json: (b: unknown, s?: 400) => Response }) {
  if (await proxyColumnExists(c.env)) return null;
  return c.json({ error: 'migration_required', migration: '0047_proxy_employers' }, 400);
}

async function requireProxyCompany(env: Env, id: number) {
  return env.DB.prepare('SELECT id, name FROM companies WHERE id = ? AND is_proxy = 1').bind(id).first<{ id: number; name: string }>();
}

/** Следующий синтетический owner_telegram_id — отрицательный, чтобы никогда
 *  не совпасть с настоящим Telegram id (те всегда положительные) и не
 *  столкнуться с уже заведёнными прокси-работодателями. */
async function nextProxyTelegramId(env: Env): Promise<number> {
  const row = await env.DB.prepare('SELECT MIN(owner_telegram_id) as m FROM companies').first<{ m: number | null }>();
  const min = row?.m ?? 0;
  return (min < 0 ? min : 0) - 1;
}

adminProxyEmployerRoutes.get('/', requirePermission('manageData'), async (c) => {
  const missing = await requireMigration(c as never);
  if (missing) return missing;

  const { results } = await c.env.DB.prepare(
    `SELECT co.id, co.name, co.city, co.address, co.description, co.founded_year, co.telegram_username,
            (co.avatar_data IS NOT NULL) as has_avatar,
            (SELECT json_group_array(id) FROM company_photos cp WHERE cp.company_id = co.id) as photo_ids,
            (SELECT COUNT(*) FROM shifts s WHERE s.company_id = co.id AND s.status = 'active') as active_vacancies
     FROM companies co WHERE co.is_proxy = 1 ORDER BY co.created_at DESC`,
  ).all<{
    id: number;
    name: string;
    city: string;
    address: string | null;
    description: string;
    founded_year: number | null;
    telegram_username: string | null;
    has_avatar: number;
    photo_ids: string;
    active_vacancies: number;
  }>();

  return c.json({
    employers: results.map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      address: r.address,
      description: r.description,
      foundedYear: r.founded_year,
      telegramUsername: r.telegram_username,
      avatarUrl: r.has_avatar ? `/media/companies/${r.id}/avatar` : null,
      photos: (JSON.parse(r.photo_ids || '[]') as number[]).map((id) => ({ id, url: `/media/companies/${r.id}/photos/${id}` })),
      activeVacancies: r.active_vacancies,
    })),
  });
});

interface ProxyEmployerInput {
  name?: string;
  address?: string;
  city?: string;
  description?: string;
  foundedYear?: number;
  telegramUsername?: string;
}

adminProxyEmployerRoutes.post('/', requirePermission('manageData'), async (c) => {
  const missing = await requireMigration(c as never);
  if (missing) return missing;
  const session = requireStaff(c as never)!;

  const body = await c.req.json<ProxyEmployerInput>();
  const name = (body.name ?? '').trim();
  const telegramUsername = (body.telegramUsername ?? '').replace(/^@/, '').trim();
  if (!name) return c.json({ error: 'name_required' }, 400);
  // Без юзернейма отклику вести некуда — вся связка держится на диплинке
  // t.me/<username> в routes/applications.ts.
  if (!telegramUsername) return c.json({ error: 'telegram_username_required' }, 400);

  const ownerTelegramId = await nextProxyTelegramId(c.env);

  const inserted = await c.env.DB.prepare(
    `INSERT INTO companies (owner_telegram_id, name, address, city, description, founded_year, telegram_username, is_proxy, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active') RETURNING id`,
  )
    .bind(
      ownerTelegramId,
      name,
      (body.address ?? '').trim() || null,
      (body.city ?? '').trim() || 'Москва',
      (body.description ?? '').trim(),
      body.foundedYear ?? null,
      telegramUsername,
    )
    .first<{ id: number }>();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `создала прокси-работодателя «${name}»`, 'neutral');
  return c.json({ ok: true, id: inserted!.id });
});

adminProxyEmployerRoutes.post('/:id/avatar', requirePermission('manageData'), async (c) => {
  const missing = await requireMigration(c as never);
  if (missing) return missing;
  const id = Number(c.req.param('id'));
  if (!(await requireProxyCompany(c.env, id))) return c.json({ error: 'not_found' }, 404);

  const contentType = c.req.header('Content-Type') ?? 'application/octet-stream';
  const bytes = await c.req.arrayBuffer();
  const check = readUpload(bytes);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await setAvatar(c.env, 'companies', id, bytes, contentType);
  return c.json({ ok: true });
});

adminProxyEmployerRoutes.post('/:id/photos', requirePermission('manageData'), async (c) => {
  const missing = await requireMigration(c as never);
  if (missing) return missing;
  const id = Number(c.req.param('id'));
  if (!(await requireProxyCompany(c.env, id))) return c.json({ error: 'not_found' }, 404);

  const contentType = c.req.header('Content-Type') ?? 'application/octet-stream';
  const bytes = await c.req.arrayBuffer();
  const check = readUpload(bytes);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const result = await addGalleryPhoto(c.env, 'company_photos', 'company_id', id, bytes, contentType);
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json({ ok: true, id: result.id });
});

adminProxyEmployerRoutes.delete('/:id/photos/:photoId', requirePermission('manageData'), async (c) => {
  const missing = await requireMigration(c as never);
  if (missing) return missing;
  const id = Number(c.req.param('id'));
  if (!(await requireProxyCompany(c.env, id))) return c.json({ error: 'not_found' }, 404);

  await deleteGalleryPhoto(c.env, 'company_photos', 'company_id', id, c.req.param('photoId') ?? '');
  return c.json({ ok: true });
});

/** Hard delete — то же самое, что DELETE /admin/employers/:id, только здесь
 *  явным образом только для прокси: /employers/:id не отличает прокси от
 *  настоящего работодателя, и удалить его тоже можно оттуда, но фронт
 *  экрана прокси-работодателей ходит именно сюда, чтобы не тащить общий
 *  экран пользователей ради одной кнопки. */
adminProxyEmployerRoutes.delete('/:id', requirePermission('manageData'), async (c) => {
  const missing = await requireMigration(c as never);
  if (missing) return missing;
  const session = requireStaff(c as never)!;
  const id = Number(c.req.param('id'));

  const company = await requireProxyCompany(c.env, id);
  if (!company) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare('DELETE FROM companies WHERE id = ?').bind(id).run();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `удалила прокси-работодателя «${company.name}»`, 'danger');
  return c.json({ ok: true });
});

adminProxyEmployerRoutes.get('/:id/vacancies', requirePermission('manageData'), async (c) => {
  const missing = await requireMigration(c as never);
  if (missing) return missing;
  const id = Number(c.req.param('id'));
  if (!(await requireProxyCompany(c.env, id))) return c.json({ error: 'not_found' }, 404);

  const { results } = await c.env.DB.prepare(`${await getShiftSelect(c.env)} WHERE s.company_id = ? ORDER BY s.created_at DESC`)
    .bind(id)
    .all<ShiftRow>();
  return c.json({ shifts: results.map(shiftToJson) });
});

interface VacancyInput {
  position: string;
  positionLabel: string;
  date: string;
  endDate?: string;
  dates?: string[];
  startHour: number;
  startMin?: number;
  endHour: number;
  endMin?: number;
  hourlyRate: number;
  payMode?: string;
  totalPay?: number;
  description?: string;
  meal?: boolean;
  urgency?: 'normal' | 'urgent';
  employmentType?: string;
  timeOfDay?: string;
  requirements?: string[];
}

/** Публикация вакансии от лица прокси-работодателя — то же самое, что
 *  employerRoutes.post('/vacancies') в routes/employer.ts, без лимита на
 *  число публикаций (VACANCY_LIMIT — защита от злоупотребления настоящих
 *  работодателей, админ под неё не должен попадать) и без разбивки по дням
 *  (splitPerDay): для вакансий, которые заводит один человек через
 *  дашборд, а не форма на несколько дней подряд, это не нужно. */
adminProxyEmployerRoutes.post('/:id/vacancies', requirePermission('manageData'), async (c) => {
  const missing = await requireMigration(c as never);
  if (missing) return missing;
  const session = requireStaff(c as never)!;
  const companyId = Number(c.req.param('id'));
  if (!(await requireProxyCompany(c.env, companyId))) return c.json({ error: 'not_found' }, 404);

  const body = await c.req.json<VacancyInput>();
  const employmentType = body.employmentType ?? 'shift';
  const explicit = normalizeDates(body.dates);
  const picked =
    employmentType === 'permanent' ? [body.date] : explicit.length > 0 ? explicit : expandDates(body.date, body.endDate ?? null, null);
  if (picked.length === 0 || !picked[0]) return c.json({ error: 'date_required' }, 400);

  const withDates = await datesColumnExists(c.env);
  if (!withDates && !isConsecutive(picked)) {
    return c.json({ error: 'migration_required', migration: '0034_shift_date_set' }, 400);
  }

  const durationHours = body.endHour - body.startHour;
  const payMode = asPayMode(body.payMode);
  const { hourlyRate, totalPay } = derivePay(payMode, payMode === 'fixed' ? (body.totalPay ?? 0) : body.hourlyRate, durationHours);
  const withPayMode = await payModeColumnExists(c.env);

  const columns = [
    'company_id', 'position', 'position_label', 'date', 'end_date', 'start_hour', 'start_min', 'end_hour', 'end_min',
    'hourly_rate', 'total_pay', 'description', 'meal', 'urgency', 'employment_type', 'time_of_day', 'requirements', 'status',
  ];
  const values: unknown[] = [
    companyId,
    body.position,
    body.positionLabel,
    picked[0],
    picked.length > 1 ? picked[picked.length - 1] : null,
    body.startHour,
    body.startMin ?? 0,
    body.endHour,
    body.endMin ?? 0,
    hourlyRate,
    totalPay,
    body.description ?? '',
    body.meal ? 1 : 0,
    body.urgency ?? 'normal',
    employmentType,
    body.timeOfDay ?? 'day',
    JSON.stringify(body.requirements ?? []),
    'active',
  ];
  if (withDates) {
    columns.push('dates');
    values.push(datesColumnValue(picked));
  }
  if (withPayMode) {
    columns.push('pay_mode');
    values.push(payMode);
  }

  const inserted = await c.env.DB.prepare(
    `INSERT INTO shifts (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) RETURNING id`,
  )
    .bind(...values)
    .first<{ id: number }>();

  const row = await c.env.DB.prepare(`${await getShiftSelect(c.env)} WHERE s.id = ?`).bind(inserted!.id).first<ShiftRow>();

  c.executionCtx.waitUntil(notifyMatchingWorkers(c.env, row!, picked, 1));

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `опубликовала вакансию «${body.positionLabel}» от лица прокси-работодателя #${companyId}`, 'neutral');

  return c.json({ shift: shiftToJson(row!) });
});

adminProxyEmployerRoutes.patch('/:id/vacancies/:shiftId', requirePermission('manageData'), async (c) => {
  const missing = await requireMigration(c as never);
  if (missing) return missing;
  const session = requireStaff(c as never)!;
  const companyId = Number(c.req.param('id'));
  const shiftId = c.req.param('shiftId');
  if (!(await requireProxyCompany(c.env, companyId))) return c.json({ error: 'not_found' }, 404);

  const existing = await c.env.DB.prepare(`${await getShiftSelect(c.env)} WHERE s.id = ? AND s.company_id = ?`)
    .bind(shiftId, companyId)
    .first<ShiftRow>();
  if (!existing) return c.json({ error: 'not_found' }, 404);
  if (existing.status !== 'active') return c.json({ error: 'not_editable' }, 409);

  const body = await c.req.json<Partial<VacancyInput>>();
  const pickedDates = body.dates === undefined ? [] : normalizeDates(body.dates);

  const next = {
    position: body.position ?? existing.position,
    positionLabel: body.positionLabel ?? existing.position_label,
    date: pickedDates[0] ?? body.date ?? existing.date,
    startHour: body.startHour ?? existing.start_hour,
    startMin: body.startMin ?? existing.start_min,
    endHour: body.endHour ?? existing.end_hour,
    endMin: body.endMin ?? existing.end_min,
    hourlyRate: body.hourlyRate ?? existing.hourly_rate,
    description: body.description ?? existing.description,
    meal: body.meal ?? !!existing.meal,
    urgency: body.urgency ?? existing.urgency,
    employmentType: body.employmentType ?? existing.employment_type,
    timeOfDay: body.timeOfDay ?? existing.time_of_day,
    requirements: body.requirements ?? (JSON.parse(existing.requirements || '[]') as string[]),
  };

  const endDate =
    next.employmentType === 'permanent'
      ? null
      : pickedDates.length > 1
        ? pickedDates[pickedDates.length - 1]!
        : pickedDates.length === 1
          ? null
          : body.endDate === undefined
            ? existing.end_date
            : body.endDate && body.endDate > next.date
              ? body.endDate
              : null;

  const existingMode = asPayMode((existing as ShiftRow & { pay_mode?: string }).pay_mode);
  const payMode = body.payMode === undefined ? existingMode : asPayMode(body.payMode);
  const entered =
    payMode === 'fixed'
      ? (body.totalPay ?? (existingMode === 'fixed' ? existing.total_pay : next.hourlyRate * (next.endHour - next.startHour)))
      : next.hourlyRate;
  const { hourlyRate, totalPay } = derivePay(payMode, entered, next.endHour - next.startHour);
  next.hourlyRate = hourlyRate;

  const sets = [
    'position = ?', 'position_label = ?', 'date = ?', 'end_date = ?', 'start_hour = ?', 'start_min = ?', 'end_hour = ?', 'end_min = ?',
    'hourly_rate = ?', 'total_pay = ?', 'description = ?', 'meal = ?', 'urgency = ?', 'employment_type = ?', 'time_of_day = ?', 'requirements = ?',
  ];
  const values: unknown[] = [
    next.position,
    next.positionLabel,
    next.date,
    endDate,
    next.startHour,
    next.startMin,
    next.endHour,
    next.endMin,
    next.hourlyRate,
    totalPay,
    next.description,
    next.meal ? 1 : 0,
    next.urgency,
    next.employmentType,
    next.timeOfDay,
    JSON.stringify(next.requirements),
  ];
  if (await payModeColumnExists(c.env)) {
    sets.push('pay_mode = ?');
    values.push(payMode);
  }
  if (body.dates !== undefined) {
    if (!(await datesColumnExists(c.env))) {
      if (!isConsecutive(pickedDates)) {
        return c.json({ error: 'migration_required', migration: '0034_shift_date_set' }, 400);
      }
    } else {
      sets.push('dates = ?');
      values.push(next.employmentType === 'permanent' ? '' : datesColumnValue(pickedDates));
    }
  }

  values.push(shiftId);
  await c.env.DB.prepare(`UPDATE shifts SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();

  // То же предупреждение занятым воркерам, что и у настоящего работодателя
  // (routes/employer.ts's PATCH /vacancies/:id) — молча подвинуть время или
  // ставку под тем, кто уже согласился, нельзя и здесь.
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
      .bind(shiftId)
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

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `отредактировала вакансию «${next.positionLabel}» прокси-работодателя #${companyId}`, 'neutral');

  const row = await c.env.DB.prepare(`${await getShiftSelect(c.env)} WHERE s.id = ?`).bind(shiftId).first<ShiftRow>();
  return c.json({ shift: shiftToJson(row!) });
});

/** Снятие вакансии с публикации — то же самое, что employerRoutes.delete
 *  ('/vacancies/:id'): предупреждает уже приглашённых/подтверждённых,
 *  чистит чаты и пересчитывает рейтинги тех, чьи отзывы на этой смене
 *  висели. */
adminProxyEmployerRoutes.delete('/:id/vacancies/:shiftId', requirePermission('manageData'), async (c) => {
  const missing = await requireMigration(c as never);
  if (missing) return missing;
  const session = requireStaff(c as never)!;
  const companyId = Number(c.req.param('id'));
  const shiftId = c.req.param('shiftId');
  if (!(await requireProxyCompany(c.env, companyId))) return c.json({ error: 'not_found' }, 404);

  const shift = await c.env.DB.prepare('SELECT id, position_label FROM shifts WHERE id = ? AND company_id = ?')
    .bind(shiftId, companyId)
    .first<{ id: number; position_label: string }>();
  if (!shift) return c.json({ error: 'not_found' }, 404);

  const { results: engaged } = await c.env.DB.prepare(
    `SELECT a.worker_id, w.telegram_id FROM applications a JOIN workers w ON w.id = a.worker_id
     WHERE a.shift_id = ? AND a.status IN ('invited', 'accepted')`,
  )
    .bind(shiftId)
    .all<{ worker_id: number; telegram_id: number }>();

  const company = await c.env.DB.prepare('SELECT name FROM companies WHERE id = ?').bind(companyId).first<{ name: string }>();
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

  const { results: reviewed } = await c.env.DB.prepare(
    'SELECT DISTINCT worker_id FROM applications WHERE shift_id = ? AND employer_rating IS NOT NULL',
  )
    .bind(shiftId)
    .all<{ worker_id: number }>();

  await c.env.DB.prepare('DELETE FROM chats WHERE shift_id = ?').bind(shiftId).run();
  await c.env.DB.prepare('DELETE FROM shifts WHERE id = ?').bind(shiftId).run();

  for (const r of reviewed) await recomputeWorkerRating(c.env, r.worker_id);
  await recomputeCompanyRating(c.env, companyId);

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `удалила вакансию «${shift.position_label}» прокси-работодателя #${companyId}`, 'danger');
  return c.json({ ok: true });
});

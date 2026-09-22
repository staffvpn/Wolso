import type { Env } from '../types';

/** Миграции применяются вручную — тот же приём, что у promosTableExists:
 *  кэшируем только положительный ответ, чтобы применённая миграция
 *  подхватилась без передеплоя. */
let tableConfirmed = false;

export async function achievementsTableExists(env: Env): Promise<boolean> {
  if (tableConfirmed) return true;
  try {
    const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'achievements'").first<{
      name: string;
    }>();
    tableConfirmed = !!row;
    return tableConfirmed;
  } catch {
    return false;
  }
}

export interface AchievementRow {
  id: number;
  key: string;
  title: string;
  description: string;
  icon: string;
  kind: 'auto' | 'manual';
  condition_type: string | null;
  threshold: number | null;
  threshold2: number | null;
  status: 'active' | 'paused';
  sort_order: number;
}

export interface AchievementProgress {
  earned: boolean;
  current?: number;
  target?: number;
}

function monthsSince(timestamp: string): number {
  const iso = timestamp.includes('T') ? timestamp : `${timestamp.replace(' ', 'T')}Z`;
  const then = new Date(iso);
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
}

/** Ниже минимальной выборки среднее время отклика ничего не значит —
 *  одна случайно быстрая заявка не делает человека «быстро откликающимся». */
const FAST_RESPONSE_MIN_SAMPLE = 5;
/** «Ни одной отмены» и «Быстрый отклик» шерстят историю заявок — без
 *  разумного потолка человек с тысячами откликов делает запрос тяжёлым
 *  ради бейджа, который всё равно даётся один раз. */
const HISTORY_SCAN_LIMIT = 300;

/** Одно условие — один запрос (или два для top_performer). Не самый
 *  дешёвый способ посчитать весь список сразу, но бейджей меньше
 *  двадцати, а экран открывается не на каждый чих. */
async function checkCondition(env: Env, workerId: number, a: AchievementRow): Promise<AchievementProgress> {
  switch (a.condition_type) {
    case 'first_response': {
      const row = await env.DB.prepare('SELECT COUNT(*) n FROM applications WHERE worker_id = ?').bind(workerId).first<{ n: number }>();
      return { earned: (row?.n ?? 0) >= 1 };
    }

    case 'shifts_completed': {
      const row = await env.DB.prepare('SELECT shifts_completed n FROM workers WHERE id = ?').bind(workerId).first<{ n: number }>();
      const current = row?.n ?? 0;
      const target = a.threshold ?? 1;
      return { earned: current >= target, current, target };
    }

    case 'own_photo': {
      const row = await env.DB.prepare('SELECT (avatar_data IS NOT NULL) v FROM workers WHERE id = ?').bind(workerId).first<{ v: number }>();
      return { earned: !!row?.v };
    }

    case 'profile_complete': {
      const w = await env.DB.prepare('SELECT bio, skills FROM workers WHERE id = ?').bind(workerId).first<{ bio: string; skills: string }>();
      const photos = await env.DB.prepare('SELECT COUNT(*) n FROM worker_photos WHERE worker_id = ?').bind(workerId).first<{ n: number }>();
      return { earned: !!w?.bio?.trim() && !!w?.skills?.trim() && (photos?.n ?? 0) > 0 };
    }

    // Недели считаем по дате самой смены (shifts.date), не по моменту
    // отклика — «активная неделя» про то, сколько реально отработано в
    // эти семь дней, а не когда на них откликнулись.
    case 'active_week': {
      const row = await env.DB.prepare(
        `SELECT MAX(cnt) m FROM (
           SELECT strftime('%Y-%W', s.date) AS wk, COUNT(*) AS cnt
           FROM applications a JOIN shifts s ON s.id = a.shift_id
           WHERE a.worker_id = ? AND a.rating IS NOT NULL
           GROUP BY wk
         )`,
      )
        .bind(workerId)
        .first<{ m: number | null }>();
      const current = row?.m ?? 0;
      const target = a.threshold ?? 5;
      return { earned: current >= target, current, target };
    }

    // «Отработал» — через закрытые смены (rating IS NOT NULL: воркер
    // сам оставил отзыв, то есть дошёл до конца), а не через
    // самостоятельно вписанный опыт в анкете — там легко ошибиться.
    case 'distinct_positions': {
      const row = await env.DB.prepare(
        `SELECT COUNT(DISTINCT s.position) n FROM applications a JOIN shifts s ON s.id = a.shift_id
         WHERE a.worker_id = ? AND a.rating IS NOT NULL`,
      )
        .bind(workerId)
        .first<{ n: number }>();
      const current = row?.n ?? 0;
      const target = a.threshold ?? 3;
      return { earned: current >= target, current, target };
    }

    case 'top_performer': {
      const w = await env.DB.prepare('SELECT rating FROM workers WHERE id = ?').bind(workerId).first<{ rating: number }>();
      const reviews = await env.DB.prepare('SELECT COUNT(*) n FROM applications WHERE worker_id = ? AND employer_rating IS NOT NULL')
        .bind(workerId)
        .first<{ n: number }>();
      const minRating = a.threshold ?? 4.8;
      const minReviews = a.threshold2 ?? 15;
      const current = reviews?.n ?? 0;
      return { earned: (w?.rating ?? 0) >= minRating && current >= minReviews, current, target: minReviews };
    }

    // Самые свежие заявки с исходом (не «ждёт ответа») — назад от
    // последней, пока не встретится отмена по инициативе работника.
    case 'no_cancel_streak': {
      const { results } = await env.DB.prepare(
        `SELECT status, cancelled_by FROM applications
         WHERE worker_id = ? AND status IN ('accepted', 'declined', 'cancelled')
         ORDER BY created_at DESC LIMIT ?`,
      )
        .bind(workerId, HISTORY_SCAN_LIMIT)
        .all<{ status: string; cancelled_by: string | null }>();
      let streak = 0;
      for (const r of results) {
        if (r.status === 'cancelled' && r.cancelled_by === 'worker') break;
        streak++;
      }
      const target = a.threshold ?? 20;
      return { earned: streak >= target, current: streak, target };
    }

    case 'fast_response': {
      const row = await env.DB.prepare(
        `SELECT AVG((julianday(a.created_at) - julianday(s.created_at)) * 1440) avg_min, COUNT(*) n
         FROM applications a JOIN shifts s ON s.id = a.shift_id WHERE a.worker_id = ? LIMIT ?`,
      )
        .bind(workerId, HISTORY_SCAN_LIMIT)
        .first<{ avg_min: number | null; n: number }>();
      const target = a.threshold ?? 10;
      if (!row || row.n < FAST_RESPONSE_MIN_SAMPLE || row.avg_min == null) {
        return { earned: false, current: row?.n ?? 0, target: FAST_RESPONSE_MIN_SAMPLE };
      }
      return { earned: row.avg_min <= target };
    }

    case 'tenure_months': {
      const w = await env.DB.prepare('SELECT created_at FROM workers WHERE id = ?').bind(workerId).first<{ created_at: string }>();
      if (!w) return { earned: false };
      const current = monthsSince(w.created_at);
      const target = a.threshold ?? 6;
      return { earned: current >= target, current, target };
    }

    case 'reviews_given': {
      const row = await env.DB.prepare('SELECT COUNT(*) n FROM applications WHERE worker_id = ? AND rating IS NOT NULL')
        .bind(workerId)
        .first<{ n: number }>();
      const current = row?.n ?? 0;
      const target = a.threshold ?? 10;
      return { earned: current >= target, current, target };
    }

    default:
      return { earned: false };
  }
}

export interface AchievementView {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  kind: 'auto' | 'manual';
  earned: boolean;
  earnedAt?: string;
  note?: string;
  current?: number;
  target?: number;
}

/** Список для экрана «Достижения» (и для карточки пользователя в
 *  админке). Уже выданные auto-бейджи не пересчитываются — читаются из
 *  worker_achievements, как обычная запись; условие проверяется только
 *  для тех, что ещё не выданы, и, если оно теперь выполняется,
 *  записывается тут же. Так открытие экрана само подтягивает то, что
 *  человек успел заработать со времени последнего захода, а
 *  «Пересчитать» в админке нужен только тем, кто сам сюда не заходит. */
export async function buildAchievementsList(env: Env, workerId: number, includeAll = false): Promise<AchievementView[]> {
  const { results: defs } = await env.DB.prepare(
    `SELECT id, key, title, description, icon, kind, condition_type, threshold, threshold2, status, sort_order
     FROM achievements ${includeAll ? '' : "WHERE status = 'active'"} ORDER BY sort_order ASC, id ASC`,
  ).all<AchievementRow>();

  const { results: earned } = await env.DB.prepare(
    'SELECT achievement_id, earned_at, note FROM worker_achievements WHERE worker_id = ?',
  )
    .bind(workerId)
    .all<{ achievement_id: number; earned_at: string; note: string | null }>();
  const earnedMap = new Map(earned.map((e) => [e.achievement_id, e]));

  const toGrant: number[] = [];
  const views: AchievementView[] = [];

  for (const a of defs) {
    const already = earnedMap.get(a.id);
    if (already) {
      views.push({
        id: String(a.id),
        key: a.key,
        title: a.title,
        description: a.description,
        icon: a.icon,
        kind: a.kind,
        earned: true,
        earnedAt: already.earned_at,
        note: already.note ?? undefined,
      });
      continue;
    }

    if (a.kind === 'manual') {
      views.push({ id: String(a.id), key: a.key, title: a.title, description: a.description, icon: a.icon, kind: a.kind, earned: false });
      continue;
    }

    const progress = await checkCondition(env, workerId, a);
    if (progress.earned) toGrant.push(a.id);
    views.push({
      id: String(a.id),
      key: a.key,
      title: a.title,
      description: a.description,
      icon: a.icon,
      kind: a.kind,
      earned: progress.earned,
      current: progress.current,
      target: progress.target,
    });
  }

  if (toGrant.length > 0) {
    const now = new Date().toISOString();
    await env.DB.batch(
      toGrant.map((id) =>
        env.DB.prepare('INSERT OR IGNORE INTO worker_achievements (worker_id, achievement_id, earned_at) VALUES (?, ?, ?)').bind(
          workerId,
          id,
          now,
        ),
      ),
    );
    for (const view of views) {
      if (toGrant.includes(Number(view.id))) view.earnedAt = now;
    }
  }

  return views;
}

/** Один проход по не более чем `limit` соискателям, у которых
 *  auto-бейджей меньше, чем активных auto-достижений всего — то есть
 *  есть что дотянуть. Как checkBots/syncTelegramUsernames: вызывается
 *  батчами, пока remaining не станет нулём. */
export async function recomputeAchievementsBatch(env: Env, limit: number): Promise<{ checked: number; granted: number; remaining: number }> {
  const totalActiveAuto = await env.DB.prepare("SELECT COUNT(*) n FROM achievements WHERE kind = 'auto' AND status = 'active'").first<{
    n: number;
  }>();
  const target = totalActiveAuto?.n ?? 0;
  if (target === 0) return { checked: 0, granted: 0, remaining: 0 };

  const { results: workers } = await env.DB.prepare(
    `SELECT w.id FROM workers w
     WHERE (SELECT COUNT(*) FROM worker_achievements wa JOIN achievements a ON a.id = wa.achievement_id
            WHERE wa.worker_id = w.id AND a.kind = 'auto' AND a.status = 'active') < ?
     ORDER BY w.id LIMIT ?`,
  )
    .bind(target, limit)
    .all<{ id: number }>();

  let granted = 0;
  for (const w of workers) {
    const before = await env.DB.prepare(
      `SELECT COUNT(*) n FROM worker_achievements wa JOIN achievements a ON a.id = wa.achievement_id
       WHERE wa.worker_id = ? AND a.kind = 'auto'`,
    )
      .bind(w.id)
      .first<{ n: number }>();
    await buildAchievementsList(env, w.id);
    const after = await env.DB.prepare(
      `SELECT COUNT(*) n FROM worker_achievements wa JOIN achievements a ON a.id = wa.achievement_id
       WHERE wa.worker_id = ? AND a.kind = 'auto'`,
    )
      .bind(w.id)
      .first<{ n: number }>();
    granted += (after?.n ?? 0) - (before?.n ?? 0);
  }

  const remainingRow = await env.DB.prepare(
    `SELECT COUNT(*) n FROM workers w
     WHERE (SELECT COUNT(*) FROM worker_achievements wa JOIN achievements a ON a.id = wa.achievement_id
            WHERE wa.worker_id = w.id AND a.kind = 'auto' AND a.status = 'active') < ?`,
  )
    .bind(target)
    .first<{ n: number }>();

  return { checked: workers.length, granted, remaining: remainingRow?.n ?? 0 };
}

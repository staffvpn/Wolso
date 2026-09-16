import type { Env } from '../types';

/** Whether migration 0039 has been applied. Same rule as the other probes
 *  here: only the `true` answer is cached, so running the SQL takes effect
 *  without a redeploy. Without this the feed would 500 for everyone the
 *  moment the worker is deployed ahead of the migration — a promo slot
 *  nobody bought is not worth breaking the feed over. */
let tableConfirmed = false;

export async function promosTableExists(env: Env): Promise<boolean> {
  if (tableConfirmed) return true;
  try {
    const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'promos'").first<{
      name: string;
    }>();
    tableConfirmed = !!row;
    return tableConfirmed;
  } catch {
    return false;
  }
}

export type PromoKind = 'telegram' | 'site';

export interface PromoRow {
  id: number;
  title: string;
  text: string;
  cta_label: string;
  url: string;
  kind: string;
  advertiser: string;
  erid: string;
  every_n: number;
  daily_cap: number;
  weight: number;
  has_image: number;
}

export interface PromoJson {
  id: string;
  title: string;
  text: string;
  ctaLabel: string;
  url: string;
  kind: PromoKind;
  advertiser: string;
  erid: string;
  everyN: number;
  imageUrl: string | null;
}

export function promoToJson(row: PromoRow): PromoJson {
  return {
    id: String(row.id),
    title: row.title,
    text: row.text,
    ctaLabel: row.cta_label,
    url: row.url,
    kind: row.kind === 'site' ? 'site' : 'telegram',
    advertiser: row.advertiser,
    erid: row.erid,
    everyN: row.every_n,
    imageUrl: row.has_image ? `/media/promos/${row.id}/image` : null,
  };
}

/** Московская дата — тот же часовой пояс, в котором живут смены (lib/time.ts).
 *  Сутки для дневного потолка должны кончаться тогда же, когда у человека,
 *  а не в полночь UTC посреди его вечера. */
export function promoDay(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Промо, которое стоит показать этому человеку прямо сейчас, или null.
 *
 *  Отбор делает SQL, а не перебор строк в памяти: это ходит на каждый
 *  запрос ленты. Условия — активна, попадает в даты, и человек сегодня
 *  видел её меньше, чем разрешает daily_cap.
 *
 *  Из подходящих берём ту, что человек сегодня видел реже всего, а при
 *  равенстве — с большим весом. Так несколько партнёров чередуются сами,
 *  без отдельного планировщика, и никто не выпадает из показа. */
export async function pickPromo(env: Env, workerId: number): Promise<PromoJson | null> {
  if (!(await promosTableExists(env))) return null;

  const row = await env.DB.prepare(
    `SELECT p.id, p.title, p.text, p.cta_label, p.url, p.kind, p.advertiser, p.erid,
            p.every_n, p.daily_cap, p.weight,
            (p.image_data IS NOT NULL) AS has_image
     FROM promos p
     LEFT JOIN promo_views v ON v.promo_id = p.id AND v.worker_id = ? AND v.day = ?
     WHERE p.status = 'active'
       AND (p.starts_at IS NULL OR p.starts_at <= datetime('now'))
       AND (p.ends_at IS NULL OR p.ends_at >= datetime('now'))
       AND COALESCE(v.shown, 0) < p.daily_cap
     ORDER BY COALESCE(v.shown, 0) ASC, p.weight DESC, p.id ASC
     LIMIT 1`,
  )
    .bind(workerId, promoDay())
    .first<PromoRow>();

  return row ? promoToJson(row) : null;
}

/** Показ засчитан. Пишем и общий счётчик, и дневной — первый для отчёта
 *  партнёру, второй для потолка.
 *
 *  Вызывается по факту появления карточки на экране, а не при выдаче:
 *  выданное промо человек может не увидеть вовсе — закрыл приложение,
 *  ушёл из ленты, — и засчитывать такое показом значит завышать цифры,
 *  которые потом кому-то показываешь. */
export async function recordPromoView(env: Env, promoId: number, workerId: number): Promise<void> {
  if (!(await promosTableExists(env))) return;
  await env.DB.batch([
    env.DB.prepare('UPDATE promos SET impressions = impressions + 1 WHERE id = ?').bind(promoId),
    env.DB.prepare(
      `INSERT INTO promo_views (promo_id, worker_id, day, shown) VALUES (?, ?, ?, 1)
       ON CONFLICT (promo_id, worker_id, day) DO UPDATE SET shown = shown + 1`,
    ).bind(promoId, workerId, promoDay()),
  ]);
}

export async function recordPromoClick(env: Env, promoId: number, workerId: number): Promise<void> {
  if (!(await promosTableExists(env))) return;
  await env.DB.batch([
    env.DB.prepare('UPDATE promos SET clicks = clicks + 1 WHERE id = ?').bind(promoId),
    env.DB.prepare(
      `INSERT INTO promo_views (promo_id, worker_id, day, clicked) VALUES (?, ?, ?, 1)
       ON CONFLICT (promo_id, worker_id, day) DO UPDATE SET clicked = clicked + 1`,
    ).bind(promoId, workerId, promoDay()),
  ]);
}

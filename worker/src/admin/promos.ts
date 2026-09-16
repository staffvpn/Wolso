import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, actorLabel, logAction, requirePermission, requireStaff } from '../middleware/auth';
import { promosTableExists } from '../lib/promos';
import { readUpload } from '../lib/media';

/** Управление рекламными карточками. Всё под правом managePromos —
 *  отдельным, а не внутри manageData: включить партнёрский канал и
 *  очистить базу не должны быть одной галочкой. */
export const adminPromoRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminPromoRoutes.use('*', attachSession);

/** Миграция здесь применяется руками, поэтому её отсутствие называем
 *  словами. Иначе запрос к несуществующей таблице прилетает в дашборд
 *  голым internal_error, и раздел выглядит просто сломанным. */
async function requireTable(c: { env: Env; json: (b: unknown, s?: 400) => Response }) {
  if (await promosTableExists(c.env)) return null;
  return c.json({ error: 'migration_required', migration: '0039_promos' }, 400);
}

interface PromoAdminRow {
  id: number;
  title: string;
  text: string;
  cta_label: string;
  url: string;
  kind: string;
  advertiser: string;
  erid: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  every_n: number;
  daily_cap: number;
  weight: number;
  impressions: number;
  clicks: number;
  created_at: string;
  has_image: number;
}

function toJson(r: PromoAdminRow) {
  return {
    id: String(r.id),
    title: r.title,
    text: r.text,
    ctaLabel: r.cta_label,
    url: r.url,
    kind: r.kind,
    advertiser: r.advertiser,
    erid: r.erid,
    status: r.status,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    everyN: r.every_n,
    dailyCap: r.daily_cap,
    weight: r.weight,
    impressions: r.impressions,
    clicks: r.clicks,
    createdAt: r.created_at,
    imageUrl: r.has_image ? `/media/promos/${r.id}/image` : null,
  };
}

const SELECT_COLUMNS = `id, title, text, cta_label, url, kind, advertiser, erid, status,
   starts_at, ends_at, every_n, daily_cap, weight, impressions, clicks, created_at,
   (image_data IS NOT NULL) AS has_image`;

adminPromoRoutes.get('/', requirePermission('managePromos'), async (c) => {
  const missing = await requireTable(c as never);
  if (missing) return missing;

  const { results } = await c.env.DB.prepare(`SELECT ${SELECT_COLUMNS} FROM promos ORDER BY id DESC`).all<PromoAdminRow>();
  return c.json({ promos: results.map(toJson) });
});

interface PromoInput {
  title?: string;
  text?: string;
  ctaLabel?: string;
  url?: string;
  kind?: string;
  advertiser?: string;
  erid?: string;
  status?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  everyN?: number;
  dailyCap?: number;
  weight?: number;
}

/** Ссылка t.me открывается внутри Telegram, всё остальное — во внешнем
 *  браузере. Тип выводим из самой ссылки, а не спрашиваем: ошибиться в
 *  выпадающем списке легко, а последствие неприятное — человека выкинет
 *  из приложения. */
function kindFor(url: string, explicit?: string): string {
  if (explicit === 'telegram' || explicit === 'site') return explicit;
  return /^https?:\/\/(t\.me|telegram\.me)\//i.test(url.trim()) ? 'telegram' : 'site';
}

function badUrl(url: string): boolean {
  return !/^https:\/\/[^\s]+$/i.test(url.trim());
}

adminPromoRoutes.post('/', requirePermission('managePromos'), async (c) => {
  const missing = await requireTable(c as never);
  if (missing) return missing;
  const session = requireStaff(c as never)!;

  const body = await c.req.json<PromoInput>();
  const title = (body.title ?? '').trim();
  const url = (body.url ?? '').trim();
  if (!title) return c.json({ error: 'title_required' }, 400);
  // Только https: ссылка уходит в openLink/openTelegramLink, и http там
  // либо не откроется, либо откроется с предупреждением.
  if (badUrl(url)) return c.json({ error: 'bad_url' }, 400);

  const inserted = await c.env.DB.prepare(
    `INSERT INTO promos (title, text, cta_label, url, kind, advertiser, erid, status,
                         starts_at, ends_at, every_n, daily_cap, weight)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'paused', ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(
      title,
      (body.text ?? '').trim(),
      (body.ctaLabel ?? '').trim() || 'Открыть',
      url,
      kindFor(url, body.kind),
      (body.advertiser ?? '').trim(),
      (body.erid ?? '').trim(),
      body.startsAt || null,
      body.endsAt || null,
      Math.max(1, Math.round(body.everyN ?? 7)),
      Math.max(1, Math.round(body.dailyCap ?? 3)),
      Math.max(1, Math.round(body.weight ?? 1)),
    )
    .first<{ id: number }>();

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `создала рекламу «${title}»`);
  // Создаётся всегда на паузе: карточка без картинки и с непроверенной
  // ссылкой не должна уехать в ленту в момент нажатия «Сохранить».
  return c.json({ ok: true, id: String(inserted?.id) });
});

adminPromoRoutes.patch('/:id', requirePermission('managePromos'), async (c) => {
  const missing = await requireTable(c as never);
  if (missing) return missing;
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');

  const existing = await c.env.DB.prepare('SELECT title FROM promos WHERE id = ?').bind(id).first<{ title: string }>();
  if (!existing) return c.json({ error: 'not_found' }, 404);

  const body = await c.req.json<PromoInput>();
  const fields: string[] = [];
  const binds: unknown[] = [];

  const text = (key: keyof PromoInput, column: string) => {
    const value = body[key];
    if (typeof value === 'string') {
      fields.push(`${column} = ?`);
      binds.push(value.trim());
    }
  };
  text('title', 'title');
  text('text', 'text');
  text('ctaLabel', 'cta_label');
  text('advertiser', 'advertiser');
  text('erid', 'erid');

  if (typeof body.url === 'string') {
    if (badUrl(body.url)) return c.json({ error: 'bad_url' }, 400);
    fields.push('url = ?', 'kind = ?');
    binds.push(body.url.trim(), kindFor(body.url, body.kind));
  }
  if (body.status === 'active' || body.status === 'paused') {
    fields.push('status = ?');
    binds.push(body.status);
  }
  for (const [key, column] of [['startsAt', 'starts_at'], ['endsAt', 'ends_at']] as const) {
    if (body[key] !== undefined) {
      fields.push(`${column} = ?`);
      binds.push(body[key] || null);
    }
  }
  for (const [key, column] of [['everyN', 'every_n'], ['dailyCap', 'daily_cap'], ['weight', 'weight']] as const) {
    const value = body[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      fields.push(`${column} = ?`);
      binds.push(Math.max(1, Math.round(value)));
    }
  }

  if (fields.length) {
    binds.push(id);
    await c.env.DB.prepare(`UPDATE promos SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
  }

  if (body.status) {
    const actor = await actorLabel(c.env, session);
    await logAction(
      c.env,
      actor,
      body.status === 'active' ? `включила рекламу «${existing.title}»` : `приостановила рекламу «${existing.title}»`,
    );
  }
  return c.json({ ok: true });
});

adminPromoRoutes.post('/:id/image', requirePermission('managePromos'), async (c) => {
  const missing = await requireTable(c as never);
  if (missing) return missing;
  const id = c.req.param('id');

  const contentType = c.req.header('Content-Type') ?? 'application/octet-stream';
  const bytes = await c.req.arrayBuffer();
  const check = readUpload(bytes);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const result = await c.env.DB.prepare('UPDATE promos SET image_data = ?, image_content_type = ? WHERE id = ?')
    .bind(bytes, contentType, id)
    .run();
  if (!result.meta.changes) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});

adminPromoRoutes.delete('/:id', requirePermission('managePromos'), async (c) => {
  const missing = await requireTable(c as never);
  if (missing) return missing;
  const session = requireStaff(c as never)!;
  const id = c.req.param('id');

  const existing = await c.env.DB.prepare('SELECT title FROM promos WHERE id = ?').bind(id).first<{ title: string }>();
  if (!existing) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare('DELETE FROM promos WHERE id = ?').bind(id).run();
  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `удалила рекламу «${existing.title}»`, 'danger');
  return c.json({ ok: true });
});

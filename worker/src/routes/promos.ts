import { Hono } from 'hono';
import type { Env } from '../types';
import { attachSession, requireWorker } from '../middleware/auth';
import { pickPromo, recordPromoClick, recordPromoView } from '../lib/promos';

/** Рекламная карточка в ленте смен — то, что видит соискатель.
 *
 *  Промо сознательно не подмешивается в саму колоду: `deck` в мини-аппе
 *  типизирован как массив смен, и свайп вправо по нему означает «отправить
 *  отклик». Реклама живёт отдельным слоем поверх, поэтому отклики, undo и
 *  фильтры о ней вообще не знают и ломаться им не на чем. */
export const promoRoutes = new Hono<{ Bindings: Env; Variables: { session: unknown } }>();
promoRoutes.use('*', attachSession);

/** Что показать следующим. Пустой ответ — нормальный случай: ни одной
 *  активной кампании, или человек уже выбрал дневной потолок. */
promoRoutes.get('/next', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const promo = await pickPromo(c.env, session.workerId);
  return c.json({ promo });
});

promoRoutes.post('/:id/view', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'not_found' }, 404);

  // waitUntil, а не await: человек уже смотрит на карточку, и ждать
  // записи счётчика ему незачем.
  c.executionCtx.waitUntil(recordPromoView(c.env, id, session.workerId));
  return c.json({ ok: true });
});

promoRoutes.post('/:id/click', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'not_found' }, 404);

  c.executionCtx.waitUntil(recordPromoClick(c.env, id, session.workerId));
  return c.json({ ok: true });
});

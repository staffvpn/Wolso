import { Hono } from 'hono';
import type { Env } from '../types';
import { answerPreCheckoutQuery, sendTelegramMessage } from '../lib/stars';

export const webhookRoutes = new Hono<{ Bindings: Env }>();

interface TelegramUpdate {
  pre_checkout_query?: { id: string; from: { id: number }; total_amount: number; invoice_payload: string };
  message?: {
    chat: { id: number };
    from: { id: number };
    successful_payment?: {
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
    };
  };
}

const PRO_DAYS = 30;

/** Telegram calls this directly (no initData, no CORS) — it's authenticated
 *  by the secret_token set on the webhook, not by requireTelegramUser. Set
 *  it up with:
 *  curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
 *    -d url=https://<worker>/telegram/webhook -d secret_token=<WEBHOOK_SECRET> */
webhookRoutes.post('/', async (c) => {
  const secret = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  if (!c.env.WEBHOOK_SECRET || secret !== c.env.WEBHOOK_SECRET) return c.json({ error: 'forbidden' }, 403);

  const update = await c.req.json<TelegramUpdate>().catch(() => ({}) as TelegramUpdate);

  if (update.pre_checkout_query) {
    // Nothing to actually validate against inventory (digital, unlimited) —
    // always accept, Telegram requires an answer within 10s either way.
    await answerPreCheckoutQuery(c.env, update.pre_checkout_query.id, true);
    return c.json({ ok: true });
  }

  const payment = update.message?.successful_payment;
  if (payment) {
    const payerId = update.message!.from.id;
    const [kind] = payment.invoice_payload.split(':');

    const user = await c.env.DB.prepare('SELECT id FROM users WHERE telegram_id = ?').bind(payerId).first<{ id: number }>();
    if (!user) return c.json({ ok: true }); // nothing to credit — shouldn't happen, payer always has a row by the time they can pay

    if (kind === 'pro') {
      const current = await c.env.DB.prepare('SELECT pro_until FROM users WHERE id = ?').bind(user.id).first<{ pro_until: string | null }>();
      const base = current?.pro_until && new Date(`${current.pro_until.replace(' ', 'T')}Z`) > new Date() ? new Date(current.pro_until.replace(' ', 'T') + 'Z') : new Date();
      base.setDate(base.getDate() + PRO_DAYS);
      await c.env.DB.prepare('UPDATE users SET pro_until = ? WHERE id = ?').bind(base.toISOString().slice(0, 19).replace('T', ' '), user.id).run();
    } else {
      await c.env.DB.prepare('UPDATE users SET credits = credits + 1 WHERE id = ?').bind(user.id).run();
    }

    await c.env.DB.prepare('INSERT INTO payments (user_id, kind, stars_amount, telegram_charge_id) VALUES (?, ?, ?, ?)')
      .bind(user.id, kind, payment.total_amount, payment.telegram_payment_charge_id)
      .run();

    c.executionCtx.waitUntil(
      sendTelegramMessage(
        c.env,
        update.message!.chat.id,
        kind === 'pro' ? '👑 Pro активирован на 30 дней. Разбирайте идеи без ограничений!' : '⭐ Оплата прошла — один разбор уже доступен.',
      ),
    );
  }

  return c.json({ ok: true });
});

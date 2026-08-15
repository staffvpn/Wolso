import { Hono } from 'hono';
import type { Env } from '../types';
import type { Vars } from '../middleware/auth';
import { requireTelegramUser } from '../middleware/auth';
import { getOrCreateUser } from '../lib/users';
import { createStarsInvoiceLink } from '../lib/stars';

export const paymentRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

const OFFERS = {
  credit: { title: 'Один разбор идеи', description: 'Ещё один разбор в «Разнеси мою идею»', amount: 79 },
  pro: { title: 'Pro на месяц', description: 'Безлимит разборов идей на 30 дней', amount: 249 },
} as const;

paymentRoutes.post('/invoice', requireTelegramUser, async (c) => {
  const { kind } = await c.req.json<{ kind?: string }>().catch(() => ({}) as { kind?: string });
  if (kind !== 'credit' && kind !== 'pro') return c.json({ error: 'invalid_kind' }, 400);

  const user = await getOrCreateUser(c.env, c.get('telegramUser'));
  const offer = OFFERS[kind];
  // Payload identity is carried by the payer's Telegram id in the webhook's
  // successful_payment.from — this is just what to grant, not who to grant
  // it to, so a nonce is enough to keep payloads unique per invoice.
  const payload = `${kind}:${user.id}:${Date.now()}`;

  const link = await createStarsInvoiceLink(c.env, { title: offer.title, description: offer.description, payload, amount: offer.amount });
  return c.json({ link });
});

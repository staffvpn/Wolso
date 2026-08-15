import type { Context, Next } from 'hono';
import type { Env } from '../types';
import { verifyInitData, type TelegramUser } from '../lib/telegramAuth';

export type Vars = { telegramUser: TelegramUser };

/** Every protected route sends the raw Mini App initData string on every
 *  request (header X-Init-Data) instead of exchanging it for a session
 *  token up front — this product has no login step to gate, so there's
 *  nothing a stateless per-request check costs us over a token flow. */
export async function requireTelegramUser(c: Context<{ Bindings: Env; Variables: Vars }>, next: Next) {
  const initData = c.req.header('X-Init-Data') ?? '';
  const user = await verifyInitData(initData, c.env.BOT_TOKEN);
  if (!user) return c.json({ error: 'invalid_init_data' }, 401);
  c.set('telegramUser', user);
  await next();
}

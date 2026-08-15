import { Hono } from 'hono';
import type { Env } from '../types';
import type { Vars } from '../middleware/auth';
import { requireTelegramUser } from '../middleware/auth';
import { getOrCreateUser, entitlementOf } from '../lib/users';

export const meRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

meRoutes.get('/', requireTelegramUser, async (c) => {
  const user = await getOrCreateUser(c.env, c.get('telegramUser'));
  return c.json({ entitlement: entitlementOf(user) });
});

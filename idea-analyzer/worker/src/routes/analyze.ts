import { Hono } from 'hono';
import type { Env, Mode, UserRow } from '../types';
import type { Vars } from '../middleware/auth';
import { requireTelegramUser } from '../middleware/auth';
import { getOrCreateUser, entitlementOf } from '../lib/users';
import { generateAnalysis } from '../lib/analysis';

export const analyzeRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

const VALID_MODES: Mode[] = ['praise', 'criticize', 'destroy', 'monetize'];

analyzeRoutes.post('/', requireTelegramUser, async (c) => {
  const body = await c.req.json<{ idea?: string; mode?: string }>().catch(() => ({}) as { idea?: string; mode?: string });
  const idea = (body.idea ?? '').trim();
  const mode = body.mode as Mode;

  if (idea.length < 8 || idea.length > 600) return c.json({ error: 'invalid_idea' }, 400);
  if (!VALID_MODES.includes(mode)) return c.json({ error: 'invalid_mode' }, 400);

  const user = await getOrCreateUser(c.env, c.get('telegramUser'));
  const entitlement = entitlementOf(user);
  if (!entitlement.canAnalyze) return c.json({ error: 'payment_required' }, 402);

  const result = await generateAnalysis(c.env, idea, mode);

  // Consume the entitlement only after a successful generation — a failed
  // LLM call (or fallback throwing, which it doesn't, but belt & braces)
  // must never burn a free credit the user didn't get value from.
  if (!entitlement.isPro) {
    if (entitlement.freeAvailable) {
      await c.env.DB.prepare('UPDATE users SET free_used = 1 WHERE id = ?').bind(user.id).run();
    } else {
      await c.env.DB.prepare('UPDATE users SET credits = credits - 1 WHERE id = ? AND credits > 0').bind(user.id).run();
    }
  }

  await c.env.DB.prepare(
    'INSERT INTO analyses (user_id, idea_text, mode, verdict, score, result_json) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(user.id, idea, mode, result.verdict, result.score, JSON.stringify(result))
    .run();

  const refreshed = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<UserRow>();
  return c.json({ result, entitlement: entitlementOf(refreshed ?? user) });
});

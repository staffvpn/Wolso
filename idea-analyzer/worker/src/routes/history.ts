import { Hono } from 'hono';
import type { Env, Mode } from '../types';
import type { Vars } from '../middleware/auth';
import { requireTelegramUser } from '../middleware/auth';
import { getOrCreateUser } from '../lib/users';

export const historyRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

interface AnalysisRow {
  id: number;
  idea_text: string;
  mode: Mode;
  verdict: string;
  score: number;
  result_json: string;
  created_at: string;
}

historyRoutes.get('/', requireTelegramUser, async (c) => {
  const user = await getOrCreateUser(c.env, c.get('telegramUser'));
  const { results } = await c.env.DB.prepare(
    'SELECT id, idea_text, mode, verdict, score, created_at FROM analyses WHERE user_id = ? ORDER BY id DESC LIMIT 50',
  )
    .bind(user.id)
    .all<AnalysisRow>();

  return c.json({
    items: results.map((r) => ({
      id: r.id,
      ideaText: r.idea_text,
      mode: r.mode,
      verdict: r.verdict,
      score: r.score,
      createdAt: r.created_at,
    })),
  });
});

historyRoutes.get('/:id', requireTelegramUser, async (c) => {
  const user = await getOrCreateUser(c.env, c.get('telegramUser'));
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid_id' }, 400);

  const row = await c.env.DB.prepare('SELECT * FROM analyses WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first<AnalysisRow>();
  if (!row) return c.json({ error: 'not_found' }, 404);

  return c.json({
    id: row.id,
    ideaText: row.idea_text,
    mode: row.mode,
    verdict: row.verdict,
    score: row.score,
    createdAt: row.created_at,
    result: JSON.parse(row.result_json),
  });
});

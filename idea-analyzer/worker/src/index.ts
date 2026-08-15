import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';

import { meRoutes } from './routes/me';
import { analyzeRoutes } from './routes/analyze';
import { historyRoutes } from './routes/history';
import { paymentRoutes } from './routes/payments';
import { webhookRoutes } from './routes/webhook';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  // The webhook is called by Telegram's servers, not the Mini App — it
  // never needs (and must not require) a CORS origin check.
  if (c.req.path.startsWith('/telegram/webhook')) return next();
  const middleware = cors({
    origin: [c.env.APP_ORIGIN, 'http://localhost:5173', 'http://localhost:5195'],
    allowHeaders: ['Content-Type', 'X-Init-Data'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  });
  return middleware(c, next);
});

app.get('/', (c) => c.json({ ok: true, service: 'idea-analyzer-api' }));

app.route('/me', meRoutes);
app.route('/analyze', analyzeRoutes);
app.route('/history', historyRoutes);
app.route('/payments', paymentRoutes);
app.route('/telegram/webhook', webhookRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal_error' }, 500);
});

export default app;

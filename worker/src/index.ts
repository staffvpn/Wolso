import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { attachSession, rejectSuspended } from './middleware/auth';
import { runReminders } from './lib/reminders';

import { authRoutes } from './routes/auth';
import { feedRoutes } from './routes/feed';
import { applicationRoutes } from './routes/applications';
import { favoriteRoutes } from './routes/favorites';
import { chatRoutes } from './routes/chats';
import { notificationRoutes } from './routes/notifications';
import { profileRoutes } from './routes/profile';
import { employerRoutes } from './routes/employer';
import { supportRoutes } from './routes/support';
import { mediaRoutes } from './routes/media';
import { botRoutes } from './routes/bot';
import { complaintRoutes } from './routes/complaints';

import { adminUserRoutes } from './admin/users';
import { adminRoleRoutes } from './admin/roles';
import { adminAuditLogRoutes } from './admin/auditLog';
import { adminDashboardRoutes } from './admin/dashboard';
import { adminVacancyRoutes } from './admin/vacancies';
import { adminSupportRoutes } from './admin/support';
import { adminDataRoutes } from './admin/data';
import { adminVerificationRoutes } from './admin/verification';
import { adminSchemaHealthRoutes } from './admin/schemaHealth';
import { adminBroadcastRoutes } from './admin/broadcast';
import { adminComplaintRoutes } from './admin/complaints';
import { adminExportRoutes } from './admin/export';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const middleware = cors({
    origin: [c.env.APP_ORIGIN, c.env.ADMIN_ORIGIN, 'http://localhost:5173', 'http://localhost:5192', 'http://localhost:5191'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  return middleware(c, next);
});

app.get('/', (c) => c.json({ ok: true, service: 'wolso-api' }));

// A suspended account is refused everything the app can ask for. Applied
// here, in front of the app-facing routes, rather than inside each one:
// blocking that depends on every route remembering to check is blocking
// that stops working the moment a route is added. Both the bare path and
// the subtree are registered — Hono's '/me/*' does not match a plain
// '/me'. /auth is excluded on purpose: sign-in has to be able to answer
// with the reason, and /media serves avatars that other people's screens
// still legitimately show.
for (const base of ['/shifts', '/applications', '/favorites', '/chats', '/notifications', '/me', '/employer', '/support', '/complaints']) {
  app.use(base, attachSession, rejectSuspended);
  app.use(`${base}/*`, attachSession, rejectSuspended);
}

app.route('/auth', authRoutes);
app.route('/shifts', feedRoutes);
app.route('/applications', applicationRoutes);
app.route('/favorites', favoriteRoutes);
app.route('/chats', chatRoutes);
app.route('/notifications', notificationRoutes);
app.route('/me', profileRoutes);
app.route('/employer', employerRoutes);
app.route('/support', supportRoutes);
app.route('/media', mediaRoutes);
app.route('/bot', botRoutes);
app.route('/complaints', complaintRoutes);

app.route('/admin/users', adminUserRoutes);
app.route('/admin/roles', adminRoleRoutes);
app.route('/admin/audit-log', adminAuditLogRoutes);
app.route('/admin/dashboard', adminDashboardRoutes);
app.route('/admin/vacancies', adminVacancyRoutes);
app.route('/admin/support', adminSupportRoutes);
app.route('/admin/data', adminDataRoutes);
app.route('/admin/verification', adminVerificationRoutes);
app.route('/admin/health', adminSchemaHealthRoutes);
app.route('/admin/broadcast', adminBroadcastRoutes);
app.route('/admin/complaints', adminComplaintRoutes);
app.route('/admin/export', adminExportRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal_error' }, 500);
});

/** The Worker is no longer only a request handler: the cron trigger in
 *  wrangler.toml calls `scheduled` on its own schedule, with no request
 *  and nobody watching, which is why runReminders swallows and logs its
 *  own failures rather than throwing into the void. */
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runReminders(env));
  },
};

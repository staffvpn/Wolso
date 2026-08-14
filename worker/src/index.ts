import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';

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

import { adminUserRoutes } from './admin/users';
import { adminRoleRoutes } from './admin/roles';
import { adminAuditLogRoutes } from './admin/auditLog';
import { adminDashboardRoutes } from './admin/dashboard';
import { adminVacancyRoutes } from './admin/vacancies';
import { adminSupportRoutes } from './admin/support';
import { adminDataRoutes } from './admin/data';
import { adminVerificationRoutes } from './admin/verification';

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

app.route('/admin/users', adminUserRoutes);
app.route('/admin/roles', adminRoleRoutes);
app.route('/admin/audit-log', adminAuditLogRoutes);
app.route('/admin/dashboard', adminDashboardRoutes);
app.route('/admin/vacancies', adminVacancyRoutes);
app.route('/admin/support', adminSupportRoutes);
app.route('/admin/data', adminDataRoutes);
app.route('/admin/verification', adminVerificationRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal_error' }, 500);
});

export default app;

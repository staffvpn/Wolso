import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, actorLabel, logAction, requirePermission, requireStaff, requireStaffMiddleware } from '../middleware/auth';

export const adminDataRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminDataRoutes.use('*', attachSession);

/** Live row counts for the "Данные" screen — lets staff see what a clear
 *  action would actually touch before pressing it, and confirms one did
 *  something after. */
const COUNT_QUERIES: Record<string, string> = {
  workers: 'SELECT COUNT(*) as n FROM workers',
  companies: 'SELECT COUNT(*) as n FROM companies',
  shifts: 'SELECT COUNT(*) as n FROM shifts',
  applications: 'SELECT COUNT(*) as n FROM applications',
  chats: 'SELECT COUNT(*) as n FROM chats',
  messages: 'SELECT COUNT(*) as n FROM messages',
  notifications: 'SELECT COUNT(*) as n FROM notifications',
  supportThreads: 'SELECT COUNT(*) as n FROM support_threads',
  complaints: 'SELECT COUNT(*) as n FROM complaints',
  auditLog: 'SELECT COUNT(*) as n FROM audit_log',
};

adminDataRoutes.get('/stats', requireStaffMiddleware, async (c) => {
  const entries = await Promise.all(
    Object.entries(COUNT_QUERIES).map(async ([key, sql]) => {
      // Per-query try, not one for the lot: this endpoint counted a
      // `complaints` table that migration 0011 had dropped, the query threw,
      // and Hono's handler turned the whole screen into internal_error —
      // so none of the other nine counts loaded either. A table that isn't
      // there now reports null (rendered as «—») instead of taking the rest
      // of the screen down with it.
      try {
        const row = await c.env.DB.prepare(sql).first<{ n: number }>();
        return [key, row?.n ?? 0] as const;
      } catch {
        return [key, null] as const;
      }
    }),
  );
  return c.json({ stats: Object.fromEntries(entries) });
});

/** Every clear action, keyed by what the client sends as `scope`. Kept as
 *  plain DELETE/UPDATE statements relying on the schema's own ON DELETE
 *  CASCADE — 'users' in particular only has to touch workers/companies/
 *  telegram_accounts directly, cascades take care of the rest (shifts,
 *  applications, chats+messages, notifications, favorites, photos, support
 *  threads — see worker/migrations for the FK graph). Staff, roles, and
 *  the audit log itself are never touched by any of these. */
const CLEAR_ACTIONS: Record<string, { label: string; run: (env: Env) => Promise<void> }> = {
  applications: {
    label: 'отклики и приглашения на смены',
    run: async (env) => {
      await env.DB.prepare('DELETE FROM applications').run();
    },
  },
  chats: {
    label: 'чаты и сообщения',
    run: async (env) => {
      await env.DB.prepare('DELETE FROM chats').run();
    },
  },
  notifications: {
    label: 'уведомления',
    run: async (env) => {
      await env.DB.prepare('DELETE FROM notifications').run();
    },
  },
  support: {
    label: 'обращения в поддержку',
    run: async (env) => {
      await env.DB.prepare('DELETE FROM support_threads').run();
    },
  },
  complaints: {
    label: 'жалобы',
    run: async (env) => {
      await env.DB.prepare('DELETE FROM complaints').run();
    },
  },
  auditLog: {
    label: 'журнал действий',
    run: async (env) => {
      await env.DB.prepare('DELETE FROM audit_log').run();
    },
  },
  vacancies: {
    label: 'все вакансии и смены (вместе с откликами и чатами по ним)',
    run: async (env) => {
      await env.DB.prepare('DELETE FROM shifts').run();
    },
  },
  ratings: {
    label: 'рейтинги и статистику отработанных смен',
    run: async (env) => {
      await env.DB.prepare('UPDATE workers SET rating = 5.0, shifts_completed = 0').run();
      await env.DB.prepare('UPDATE companies SET rating = 5.0, reviews_count = 0').run();
    },
  },
  users: {
    label: 'всех пользователей — соискателей и работодателей',
    run: async (env) => {
      await env.DB.prepare('DELETE FROM workers').run();
      await env.DB.prepare('DELETE FROM companies').run();
      await env.DB.prepare('DELETE FROM telegram_accounts').run();
    },
  },
};

adminDataRoutes.post('/clear', requirePermission('manageData'), async (c) => {
  const session = requireStaff(c as never)!;
  const { scope } = await c.req.json<{ scope: string }>();
  const action = CLEAR_ACTIONS[scope];
  if (!action) return c.json({ error: 'unknown_scope' }, 400);

  await action.run(c.env);

  const actor = await actorLabel(c.env, session);
  await logAction(c.env, actor, `очистила тестовые данные: ${action.label}`, 'danger');
  return c.json({ ok: true });
});

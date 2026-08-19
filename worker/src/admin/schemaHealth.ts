import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, requireStaffMiddleware } from '../middleware/auth';
import { notifyAdmin } from '../lib/adminNotify';

export const adminSchemaHealthRoutes = new Hono<{ Bindings: Env; Variables: { session: SessionPayload | null } }>();
adminSchemaHealthRoutes.use('*', attachSession);

/** Columns the running code reads or writes, and the migration that adds
 *  each one. Deploying the worker without applying a migration leaves the
 *  code querying a column D1 doesn't have — SQLite throws, Hono's global
 *  handler turns it into a bare `internal_error` 500, and the feature just
 *  looks broken with no clue why (this is exactly how the "не получилось
 *  закрыть смену" report started). This endpoint names the missing
 *  migration instead of leaving it to be reverse-engineered. */
const REQUIRED_COLUMNS: { table: string; column: string; migration: string; breaks: string }[] = [
  { table: 'applications', column: 'closed_by_employer_at', migration: '0014_shift_close_reviews', breaks: 'закрытие смены' },
  { table: 'applications', column: 'employer_rating', migration: '0014_shift_close_reviews', breaks: 'закрытие смены' },
  { table: 'applications', column: 'employer_review_tags', migration: '0014_shift_close_reviews', breaks: 'закрытие смены' },
  { table: 'applications', column: 'employer_review_comment', migration: '0014_shift_close_reviews', breaks: 'закрытие смены' },
  { table: 'chats', column: 'worker_notified_at', migration: '0015_chat_notify_cooldown', breaks: 'уведомления о сообщениях' },
  { table: 'chats', column: 'company_notified_at', migration: '0015_chat_notify_cooldown', breaks: 'уведомления о сообщениях' },
  { table: 'applications', column: 'cancelled_by', migration: '0016_invite_and_cancel_flow', breaks: 'отмена и отзыв приглашения' },
  { table: 'applications', column: 'cancel_reason', migration: '0016_invite_and_cancel_flow', breaks: 'отмена и отзыв приглашения' },
  { table: 'applications', column: 'cancelled_at', migration: '0016_invite_and_cancel_flow', breaks: 'отмена и отзыв приглашения' },
  { table: 'workers', column: 'telegram_username', migration: '0018_telegram_username', breaks: 'ссылки на Telegram в дашборде' },
  { table: 'companies', column: 'telegram_username', migration: '0018_telegram_username', breaks: 'ссылки на Telegram в дашборде' },
  { table: 'messages', column: 'visible_to', migration: '0019_message_visibility', breaks: 'системные сообщения в чате' },
  { table: 'companies', column: 'inn', migration: '0020_company_verification', breaks: 'проверка работодателей' },
  { table: 'companies', column: 'verification_status', migration: '0020_company_verification', breaks: 'проверка работодателей' },
  { table: 'shifts', column: 'end_date', migration: '0021_shift_end_date', breaks: 'многодневные вакансии и закрытие смены' },
];

adminSchemaHealthRoutes.get('/schema', requireStaffMiddleware, async (c) => {
  const tables = [...new Set(REQUIRED_COLUMNS.map((r) => r.table))];
  const present = new Map<string, Set<string>>();

  for (const table of tables) {
    try {
      const { results } = await c.env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
      present.set(table, new Set(results.map((r) => r.name)));
    } catch {
      present.set(table, new Set());
    }
  }

  const missing = REQUIRED_COLUMNS.filter((r) => !present.get(r.table)?.has(r.column));
  const missingMigrations = [...new Set(missing.map((m) => m.migration))].sort();

  return c.json({
    ok: missing.length === 0,
    missingMigrations,
    missingColumns: missing.map((m) => ({ table: m.table, column: m.column, migration: m.migration, breaks: m.breaks })),
  });
});

/** Sends a test operator alert. Worth having a button for: the usual
 *  reason alerts never arrive is that nobody pressed Start in the bot's
 *  chat, and Telegram simply refuses ("chat not found") — which is
 *  invisible until something tries to send. */
adminSchemaHealthRoutes.post('/test-alert', requireStaffMiddleware, async (c) => {
  const configured = !!(c.env.ADMIN_CHAT_ID || c.env.OWNER_TELEGRAM_ID);
  if (!configured) return c.json({ error: 'no_admin_chat_id' }, 400);

  await notifyAdmin(c.env, '🔔 Проверка уведомлений Wolso\nЕсли вы это видите — оповещения настроены и работают.');
  return c.json({ ok: true });
});

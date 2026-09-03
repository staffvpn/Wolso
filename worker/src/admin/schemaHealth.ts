import { Hono } from 'hono';
import type { Env, SessionPayload } from '../types';
import { attachSession, requireStaffMiddleware } from '../middleware/auth';
import { notifyAdmin } from '../lib/adminNotify';
import sql0014 from '../../migrations/0014_shift_close_reviews.sql';
import sql0015 from '../../migrations/0015_chat_notify_cooldown.sql';
import sql0016 from '../../migrations/0016_invite_and_cancel_flow.sql';
import sql0018 from '../../migrations/0018_telegram_username.sql';
import sql0019 from '../../migrations/0019_message_visibility.sql';
import sql0020 from '../../migrations/0020_company_verification.sql';
import sql0021 from '../../migrations/0021_shift_end_date.sql';
import sql0024 from '../../migrations/0024_broadcasts.sql';
import sql0025 from '../../migrations/0025_bot_status.sql';
import sql0026 from '../../migrations/0026_suspension_reason.sql';
import sql0027 from '../../migrations/0027_hidden_profiles.sql';
import sql0028 from '../../migrations/0028_reminders.sql';
import sql0029 from '../../migrations/0029_worker_employment_type.sql';
import sql0030 from '../../migrations/0030_notification_settings.sql';

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
  { table: 'workers', column: 'bot_status', migration: '0025_bot_status', breaks: 'статус бота в дашборде' },
  { table: 'companies', column: 'bot_status', migration: '0025_bot_status', breaks: 'статус бота в дашборде' },
  { table: 'workers', column: 'suspended_reason', migration: '0026_suspension_reason', breaks: 'блокировка пользователей' },
  { table: 'companies', column: 'suspended_reason', migration: '0026_suspension_reason', breaks: 'блокировка пользователей' },
  { table: 'workers', column: 'hidden', migration: '0027_hidden_profiles', breaks: 'скрытие анкет' },
  { table: 'workers', column: 'signup_reminded_at', migration: '0028_reminders', breaks: 'авто-напоминания в боте' },
  { table: 'companies', column: 'pending_reminded_at', migration: '0028_reminders', breaks: 'авто-напоминания в боте' },
  { table: 'workers', column: 'looking_for', migration: '0029_worker_employment_type', breaks: 'смена или постоянная работа в анкете' },
  { table: 'workers', column: 'notify_employer_replies', migration: '0030_notification_settings', breaks: 'переключатели уведомлений в настройках' },
  { table: 'applications', column: 'shift_reminded_at', migration: '0030_notification_settings', breaks: 'напоминание перед сменой' },
];

/** Same idea for whole tables a migration creates — a missing table fails
 *  the same silent way a missing column does. */
const REQUIRED_TABLES: { table: string; migration: string; breaks: string }[] = [
  { table: 'broadcasts', migration: '0024_broadcasts', breaks: 'рассылки из дашборда' },
];

/** The real migration files, bundled in as text (see the Text rule in
 *  wrangler.toml). Imported rather than retyped: a hand-copied list of
 *  statements would eventually drift from the files, and handing someone
 *  SQL that doesn't match the migration is a worse failure than the
 *  missing migration itself. Only the ones detectable above are here —
 *  a data-only migration leaves nothing to probe for. */
const MIGRATION_FILES: Record<string, string> = {
  '0014_shift_close_reviews': sql0014,
  '0015_chat_notify_cooldown': sql0015,
  '0016_invite_and_cancel_flow': sql0016,
  '0018_telegram_username': sql0018,
  '0019_message_visibility': sql0019,
  '0020_company_verification': sql0020,
  '0021_shift_end_date': sql0021,
  '0024_broadcasts': sql0024,
  '0025_bot_status': sql0025,
  '0026_suspension_reason': sql0026,
  '0027_hidden_profiles': sql0027,
  '0028_reminders': sql0028,
  '0029_worker_employment_type': sql0029,
  '0030_notification_settings': sql0030,
};

/** Strips the explanatory comments and splits into individual statements,
 *  because the D1 console runs one at a time. Safe to split on `;` here:
 *  no statement in these files carries a semicolon inside a string
 *  literal, and comment lines are dropped before the split. */
function statementsOf(migration: string): string[] {
  const file = MIGRATION_FILES[migration];
  if (!file) return [];
  return file
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `${s};`);
}

adminSchemaHealthRoutes.get('/schema', requireStaffMiddleware, async (c) => {
  const tables = [...new Set([...REQUIRED_COLUMNS.map((r) => r.table), ...REQUIRED_TABLES.map((t) => t.table)])];
  const present = new Map<string, Set<string>>();

  for (const table of tables) {
    try {
      const { results } = await c.env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
      present.set(table, new Set(results.map((r) => r.name)));
    } catch {
      present.set(table, new Set());
    }
  }

  // A table that doesn't exist at all reports zero columns above, which
  // would otherwise show up as "every column missing" rather than as the
  // one missing table it actually is.
  const missingTables = REQUIRED_TABLES.filter((t) => !present.get(t.table)?.size);
  const missingColumns = REQUIRED_COLUMNS.filter((r) => !present.get(r.table)?.has(r.column));

  const missingMigrations = [...new Set([...missingColumns, ...missingTables].map((m) => m.migration))].sort();

  return c.json({
    ok: missingMigrations.length === 0,
    missingMigrations,
    missingColumns: missingColumns.map((m) => ({ table: m.table, column: m.column, migration: m.migration, breaks: m.breaks })),
    missingTables: missingTables.map((t) => ({ table: t.table, migration: t.migration, breaks: t.breaks })),
    // Copy-paste-ready, in migration order, so fixing this never means
    // going and finding the files in the repo.
    sql: missingMigrations.map((migration) => ({ migration, statements: statementsOf(migration) })),
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

/** The my_chat_member webhook (see routes/bot.ts) has to be registered
 *  with Telegram once. Doing that by hand means finding the bot token and
 *  the Worker's own URL and pasting a long api.telegram.org link together
 *  — but the Worker already has both, so it can just do it. Keeps the
 *  token out of the operator's clipboard and browser history too. */
function webhookUrl(c: { req: { url: string }; env: Env }): string {
  return `${new URL(c.req.url).origin}/bot/webhook/${c.env.BOT_TOKEN}`;
}

/** Never returns the URL as Telegram reports it — it contains the bot
 *  token. Only whether it points at this Worker. */
adminSchemaHealthRoutes.get('/webhook', requireStaffMiddleware, async (c) => {
  if (!c.env.BOT_TOKEN) return c.json({ error: 'no_bot_token' }, 400);

  const res = await fetch(`https://api.telegram.org/bot${c.env.BOT_TOKEN}/getWebhookInfo`);
  const data = await res
    .json<{ ok: boolean; result?: { url?: string; last_error_message?: string; last_error_date?: number } }>()
    .catch(() => null);

  if (!data?.ok) return c.json({ error: 'telegram_unreachable' }, 502);

  const current = data.result?.url ?? '';
  return c.json({
    connected: current === webhookUrl(c),
    // Some other URL registered means another deployment (or an older
    // one) owns this bot's updates — worth saying out loud rather than
    // just showing "не подключён" and inviting a fight over it.
    otherUrl: current !== '' && current !== webhookUrl(c),
    lastError: data.result?.last_error_message ?? null,
  });
});

adminSchemaHealthRoutes.post('/webhook', requireStaffMiddleware, async (c) => {
  if (!c.env.BOT_TOKEN) return c.json({ error: 'no_bot_token' }, 400);

  const res = await fetch(`https://api.telegram.org/bot${c.env.BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl(c),
      // Only membership changes. Without this Telegram would also post
      // every message sent to the bot, which nothing here handles.
      allowed_updates: ['my_chat_member'],
    }),
  });

  const data = await res.json<{ ok: boolean; description?: string }>().catch(() => null);
  if (!data?.ok) return c.json({ error: 'setwebhook_failed', description: data?.description ?? '' }, 502);

  return c.json({ ok: true });
});

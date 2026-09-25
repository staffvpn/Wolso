import type { Env } from '../types';

export type NotificationRecipientRole = 'worker' | 'company';

let tableConfirmed = false;

export async function notificationLogTableExists(env: Env): Promise<boolean> {
  if (tableConfirmed) return true;
  try {
    const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'notification_log'").first<{
      name: string;
    }>();
    tableConfirmed = !!row;
    return tableConfirmed;
  } catch {
    return false;
  }
}

/** Records a message that actually went out — called only once the send
 *  itself succeeded (see notifyWorker/notifyCompany in notifyPrefs.ts,
 *  and the three onboarding reminders in reminders.ts that bypass those
 *  wrappers). Best-effort and never throws: a missing migration, a worker
 *  row that's gone, anything — none of that should be the reason a real
 *  Telegram send gets treated as a failure by its caller. */
export async function logNotification(env: Env, role: NotificationRecipientRole, id: number, kind: string, text: string): Promise<void> {
  if (!(await notificationLogTableExists(env))) return;
  try {
    const row =
      role === 'worker'
        ? await env.DB.prepare('SELECT name FROM workers WHERE id = ?').bind(id).first<{ name: string }>()
        : await env.DB.prepare('SELECT name FROM companies WHERE id = ?').bind(id).first<{ name: string }>();
    await env.DB.prepare(
      'INSERT INTO notification_log (recipient_role, recipient_id, recipient_name, kind, text) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(role, id, row?.name || (role === 'worker' ? 'Без имени' : 'Без названия'), kind, text)
      .run();
  } catch (err) {
    console.error('notification log insert failed', role, id, kind, err);
  }
}

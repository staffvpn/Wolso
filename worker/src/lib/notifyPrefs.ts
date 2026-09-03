import type { Env } from '../types';
import { sendTelegramMessage } from './telegramBot';

/** Which switch in «Настройки» governs a given bot message.
 *  - `new_shifts`        — "появилась смена по вашей должности"
 *  - `employer_replies`  — приглашения, отмены, изменения условий, сообщения в чате
 *  - `shift_reminder`    — напоминание незадолго до начала смены */
export type WorkerNotifyPref = 'new_shifts' | 'employer_replies' | 'shift_reminder';

const COLUMN: Record<WorkerNotifyPref, string> = {
  new_shifts: 'notify_new_shifts',
  employer_replies: 'notify_employer_replies',
  shift_reminder: 'notify_shift_reminder',
};

/** Whether migration 0030 has been applied. Same reasoning as the other
 *  probes: migrations are run by hand, so the deployed code can be a
 *  migration ahead of the database. Until then every message goes out as
 *  it did before — which is the safe direction to be wrong in for a
 *  notification (missing an invitation is worse than one extra ping). */
let columnsConfirmed = false;

export async function notifyPrefColumnsExist(env: Env): Promise<boolean> {
  if (columnsConfirmed) return true;
  try {
    const { results } = await env.DB.prepare('PRAGMA table_info(workers)').all<{ name: string }>();
    columnsConfirmed = results.some((r) => r.name === 'notify_employer_replies');
    return columnsConfirmed;
  } catch {
    return false;
  }
}

export async function workerWantsNotification(env: Env, workerId: number, pref: WorkerNotifyPref): Promise<boolean> {
  if (!(await notifyPrefColumnsExist(env))) return true;
  const row = await env.DB.prepare(`SELECT ${COLUMN[pref]} as allowed FROM workers WHERE id = ?`)
    .bind(workerId)
    .first<{ allowed: number }>();
  // A worker that doesn't exist gets nothing; a worker that does defaults
  // to allowed, matching the column default.
  return row ? !!row.allowed : false;
}

/** Sends a bot message to a worker unless they've switched that kind off.
 *
 *  Only the Telegram push is suppressed — never the row in `notifications`
 *  that the callers write. Someone who turned notifications off still has
 *  to be able to open the app and find out they were invited to a shift;
 *  silencing the in-app list too would turn a preference about pings into
 *  losing the information altogether.
 *
 *  Deliberately not used for support replies or dashboard broadcasts:
 *  the first is a direct answer to a question the person asked, and the
 *  second is an operator picking recipients by hand. */
export async function notifyWorker(
  env: Env,
  worker: { id: number; telegramId: number },
  pref: WorkerNotifyPref,
  text: string,
): Promise<boolean> {
  if (!(await workerWantsNotification(env, worker.id, pref))) return false;
  return sendTelegramMessage(env, worker.telegramId, text);
}

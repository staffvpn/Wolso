import type { Env } from '../types';

/** Whether the bot can still reach an account.
 *  - `active`      — a call to the Bot API for this chat succeeded
 *  - `blocked`     — the person blocked or stopped the bot
 *  - `deleted`     — their Telegram account is deactivated
 *  - `unreachable` — the bot has no chat with them (never pressed Start)
 *  - `unknown`     — nothing has told us either way yet */
export type BotStatus = 'active' | 'blocked' | 'deleted' | 'unreachable' | 'unknown';

/** Turns a Bot API failure into a status, or null when the failure says
 *  nothing about the user — a 429 or a 500 is Telegram having a moment,
 *  and recording "blocked" off the back of one would quietly mislabel
 *  people who are perfectly reachable. */
export function classifyTelegramFailure(httpStatus: number, description: string): BotStatus | null {
  const d = description.toLowerCase();
  if (d.includes('bot was blocked') || d.includes('user is deactivated') || d.includes('bot can\'t initiate conversation')) {
    return d.includes('deactivated') ? 'deleted' : 'blocked';
  }
  if (d.includes('chat not found')) return 'unreachable';
  // Deliberately no bare `httpStatus === 403 -> blocked` fallback. Telegram
  // always explains a 403 in `description`, so a 403 without one of the
  // phrases above did not come from Telegram — a gateway, proxy or WAF in
  // front of the request would otherwise brand every account as having
  // blocked the bot. Leaving the status untouched is the safer wrong
  // answer: this column is only worth having if it can be trusted.
  if (httpStatus === 403) console.error('unrecognised 403 from Bot API', description);
  return null;
}

/** Records what we just learned about a chat. A person is a worker or a
 *  company owner, never both, so both statements run and one is a no-op.
 *  The `bot_status != ?` guard keeps this from writing on every single
 *  notification once the status is already what we're about to set. */
export async function recordBotStatus(env: Env, telegramId: number, status: BotStatus): Promise<void> {
  const now = new Date().toISOString();
  try {
    await Promise.all([
      env.DB.prepare('UPDATE workers SET bot_status = ?, bot_status_at = ? WHERE telegram_id = ? AND bot_status != ?')
        .bind(status, now, telegramId, status)
        .run(),
      env.DB.prepare('UPDATE companies SET bot_status = ?, bot_status_at = ? WHERE owner_telegram_id = ? AND bot_status != ?')
        .bind(status, now, telegramId, status)
        .run(),
    ]);
  } catch (err) {
    // Never let bookkeeping break the thing it's observing — this runs
    // inside notification sends.
    console.error('recordBotStatus failed', telegramId, status, err);
  }
}

/** Asks Telegram whether this chat is still reachable without sending
 *  anything the person would see. sendChatAction is the usual way to do
 *  this: it fails exactly like sendMessage would, but a "typing" bubble
 *  that never turns into a message leaves no trace in the chat. */
export async function probeBotStatus(env: Env, chatId: number): Promise<BotStatus> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
    if (res.ok) return 'active';
    const body = await res.json<{ description?: string }>().catch(() => ({}) as { description?: string });
    return classifyTelegramFailure(res.status, body.description ?? '') ?? 'unknown';
  } catch (err) {
    console.error('probeBotStatus threw', chatId, err);
    return 'unknown';
  }
}

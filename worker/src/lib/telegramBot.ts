import type { Env } from '../types';

/** Looks up a person's current @username via the Bot API's getChat — works
 *  for any chat_id the bot has ever exchanged messages with (which, in
 *  practice, is every worker/company: launching the Mini App or getting a
 *  notification both go through the bot). Used to backfill telegram_username
 *  for accounts that registered before that column existed, or haven't
 *  reopened the app since, without waiting on them to log in again.
 *  Best-effort: returns null on anything from "bot blocked" to "no
 *  username set" rather than throwing, same spirit as sendTelegramMessage. */
export async function getTelegramUsername(env: Env, chatId: number): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getChat?chat_id=${chatId}`);
    if (!res.ok) return null;
    const data = await res.json<{ ok: boolean; result?: { username?: string } }>();
    return data.ok ? (data.result?.username ?? null) : null;
  } catch (err) {
    console.error('telegram getChat threw', chatId, err);
    return null;
  }
}

/** Pushes a message into the user's chat with the bot itself — distinct
 *  from the in-app notifications list (routes/notifications.ts), which
 *  only shows up once someone opens the Mini App. This is what actually
 *  pings their phone. Best-effort: a blocked bot, deactivated account, or
 *  any other single failure is logged and swallowed rather than thrown,
 *  so one bad chat_id in a batch never takes down the rest. */
export async function sendTelegramMessage(env: Env, chatId: number, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: {
          inline_keyboard: [[{ text: 'Открыть Wolso', web_app: { url: env.APP_ORIGIN } }]],
        },
      }),
    });
    if (!res.ok) {
      console.error('telegram sendMessage failed', chatId, res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('telegram sendMessage threw', chatId, err);
    return false;
  }
}

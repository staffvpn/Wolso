import type { Env } from '../types';

/** Pushes a message into the user's chat with the bot itself — distinct
 *  from the in-app notifications list (routes/notifications.ts), which
 *  only shows up once someone opens the Mini App. This is what actually
 *  pings their phone. Best-effort: a blocked bot, deactivated account, or
 *  any other single failure is logged and swallowed rather than thrown,
 *  so one bad chat_id in a batch never takes down the rest. */
export async function sendTelegramMessage(env: Env, chatId: number, text: string): Promise<void> {
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
    }
  } catch (err) {
    console.error('telegram sendMessage threw', chatId, err);
  }
}

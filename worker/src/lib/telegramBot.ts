import type { Env } from '../types';
import { classifyTelegramFailure, recordBotStatus } from './botStatus';

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
  return (await sendTelegramMessageResult(env, chatId, text)) === 'sent';
}

/** Исход отправки для тех, кто на него смотрит.
 *
 *  - `sent`      — доставлено;
 *  - `permanent` — не доставится и при повторе: бот заблокирован, аккаунт
 *                  удалён, чат не найден, запрос отвергнут;
 *  - `transient` — Telegram прилёг или лимитит (429, 5xx, обрыв сети).
 *                  О самом человеке это не говорит ничего.
 *
 *  Разница важна ровно там, где попытка одна на всю жизнь: напоминание о
 *  незаконченном профиле помечается отправленным и больше не повторяется,
 *  так что списать его на 429 — значит молча лишить человека письма
 *  навсегда. Граница проведена по коду ответа, а не по описанию: всё,
 *  кроме 429 и 5xx, считаем окончательным, иначе нераспознанная ошибка
 *  заставила бы крон долбиться в один и тот же чат каждый час. */
export type TelegramSendResult = 'sent' | 'permanent' | 'transient';

export async function sendTelegramMessageResult(
  env: Env,
  chatId: number,
  text: string,
): Promise<TelegramSendResult> {
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
      const raw = await res.text().catch(() => '');
      console.error('telegram sendMessage failed', chatId, res.status, raw);
      // Every notification doubles as a liveness check: this is the moment
      // we find out someone blocked the bot, so it's the moment to write it
      // down. classifyTelegramFailure returns null for rate limits and
      // outages, which say nothing about the user.
      let description = '';
      try {
        description = (JSON.parse(raw) as { description?: string }).description ?? '';
      } catch {
        description = raw;
      }
      const status = classifyTelegramFailure(res.status, description);
      if (status) await recordBotStatus(env, chatId, status);
      return res.status === 429 || res.status >= 500 ? 'transient' : 'permanent';
    }
    await recordBotStatus(env, chatId, 'active');
    return 'sent';
  } catch (err) {
    // Сеть оборвалась — про человека это не говорит ничего.
    console.error('telegram sendMessage threw', chatId, err);
    return 'transient';
  }
}

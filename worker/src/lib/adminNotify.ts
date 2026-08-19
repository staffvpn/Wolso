import type { Env } from '../types';

/** Operator alerts — the bot messaging you personally about things worth
 *  knowing right away (a new signup, an employer waiting on verification,
 *  a fresh support ticket), separate from the notifications users get.
 *
 *  Telegram's sendMessage needs a *numeric* chat id: a bot cannot open a
 *  chat by @username, so a t.me link alone isn't enough. ADMIN_CHAT_ID is
 *  that number; OWNER_TELEGRAM_ID (already configured to bootstrap the
 *  first Owner account) is the fallback, since in practice it's the same
 *  person. Note the bot can only write to you after you've pressed Start
 *  in its chat at least once — Telegram refuses to let bots open a
 *  conversation, and returns "chat not found" until then.
 *
 *  Best-effort by design: an alert failing must never break the user
 *  action that triggered it. */
function adminChatId(env: Env): number | null {
  const raw = env.ADMIN_CHAT_ID || env.OWNER_TELEGRAM_ID;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id !== 0 ? id : null;
}

export async function notifyAdmin(env: Env, text: string): Promise<void> {
  const chatId = adminChatId(env);
  if (!chatId) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // No inline keyboard here on purpose: these go to the operator, not
      // to a user being invited back into the mini app.
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!res.ok) {
      console.error('admin notify failed', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('admin notify threw', err);
  }
}

/** A person's display handle for an alert — @username when they have one,
 *  otherwise the numeric id, which is all Telegram gives us to go on. */
export function adminNotifyHandle(username: string | null | undefined, telegramId: number): string {
  return username ? `@${username}` : `id ${telegramId}`;
}

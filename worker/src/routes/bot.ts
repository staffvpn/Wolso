import { Hono } from 'hono';
import type { Env } from '../types';
import { recordBotStatus } from '../lib/botStatus';

export const botRoutes = new Hono<{ Bindings: Env }>();

/** Telegram's my_chat_member update fires the instant someone blocks or
 *  unblocks the bot, which is the only way to learn about it without
 *  waiting for the next notification to fail. Register it with:
 *
 *    https://api.telegram.org/bot<TOKEN>/setWebhook
 *      ?url=<API_ORIGIN>/bot/webhook/<TOKEN>
 *      &allowed_updates=["my_chat_member"]
 *
 *  The token in the path is the authentication — Telegram's own docs
 *  recommend exactly this ("use a secret path in the URL"), and it means
 *  no extra secret to configure. Anyone who knew the token could already
 *  post as the bot, so this grants nothing new. Without it, an open
 *  endpoint would let anybody mark any user as having blocked the bot.
 *
 *  allowed_updates keeps Telegram from sending message traffic here: this
 *  handler deliberately does nothing with messages, and the bot has no
 *  conversational behaviour to speak of. */
botRoutes.post('/webhook/:token', async (c) => {
  if (c.req.param('token') !== c.env.BOT_TOKEN) return c.json({ error: 'not_found' }, 404);

  interface MyChatMemberUpdate {
    my_chat_member?: {
      chat?: { id?: number; type?: string };
      new_chat_member?: { status?: string };
    };
  }

  const update = await c.req.json<MyChatMemberUpdate>().catch(() => ({}) as MyChatMemberUpdate);

  const change = update.my_chat_member;
  const chatId = change?.chat?.id;

  // Only private chats say anything about a *person's* subscription; the
  // same update fires for groups the bot is added to or removed from.
  if (!change || !chatId || (change.chat?.type && change.chat.type !== 'private')) {
    return c.json({ ok: true });
  }

  // 'kicked' is what Telegram calls a user blocking the bot. 'member' is
  // an active subscription — it's also what an unblock reports, so this
  // clears a stale 'blocked' as soon as someone comes back.
  const memberStatus = change.new_chat_member?.status;
  if (memberStatus === 'kicked') await recordBotStatus(c.env, chatId, 'blocked');
  else if (memberStatus === 'member') await recordBotStatus(c.env, chatId, 'active');

  // Always 200: a non-2xx makes Telegram retry the same update for hours.
  return c.json({ ok: true });
});

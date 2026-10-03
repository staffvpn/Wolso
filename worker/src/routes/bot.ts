import { Hono } from 'hono';
import type { Env } from '../types';
import { recordBotStatus } from '../lib/botStatus';
import { createBroadcast, sendBroadcastBatch } from '../admin/broadcast';

export const botRoutes = new Hono<{ Bindings: Env; Variables: { session: unknown } }>();

/** Telegram's my_chat_member update fires the instant someone blocks or
 *  unblocks the bot, which is the only way to learn about it without
 *  waiting for the next notification to fail. my_chat_member вместе с
 *  message регистрируются так:
 *
 *    https://api.telegram.org/bot<TOKEN>/setWebhook
 *      ?url=<API_ORIGIN>/bot/webhook/<TOKEN>
 *      &allowed_updates=["my_chat_member","message"]
 *
 *  (кнопка «Подключить вебхук» в Тех. здоровье дашборда делает это сама).
 *
 *  The token in the path is the authentication — Telegram's own docs
 *  recommend exactly this ("use a secret path in the URL"), and it means
 *  no extra secret to configure. Anyone who knew the token could already
 *  post as the bot, so this grants nothing new. Without it, an open
 *  endpoint would let anybody mark any user as having blocked the bot. */
interface TelegramUpdate {
  my_chat_member?: {
    chat?: { id?: number; type?: string };
    new_chat_member?: { status?: string };
  };
  message?: {
    chat?: { id?: number; type?: string };
    text?: string;
  };
}

/** Владелец — единственный, у кого бот вообще на что-то реагирует в
 *  личных сообщениях. OWNER_TELEGRAM_ID и ADMIN_CHAT_ID (см. lib/adminNotify.ts)
 *  на практике один и тот же человек, но оба настроены по отдельности —
 *  поэтому сверяемся с обоими, а не выбираем один. */
function isOwnerChat(env: Env, chatId: number): boolean {
  return [env.OWNER_TELEGRAM_ID, env.ADMIN_CHAT_ID]
    .filter((raw): raw is string => !!raw)
    .map(Number)
    .filter(Number.isFinite)
    .includes(chatId);
}

/** Ответ владельцу в тот же чат, откуда пришла команда — не через
 *  notifyAdmin (который всегда шлёт в ADMIN_CHAT_ID), потому что owner и
 *  admin-chat могут отличаться, а ответить нужно туда, откуда спросили. */
async function reply(env: Env, chatId: number, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
  } catch (err) {
    console.error('bot admin reply failed', err);
  }
}

/** Гонит рассылку до конца пачками в фоне (waitUntil) — ответ на вебхук
 *  уходит сразу, не дожидаясь, пока разошлётся несколько тысяч сообщений;
 *  тот же BATCH_SIZE/GAP_MS, что и у дашборда, см. admin/broadcast.ts. */
async function runBroadcastToCompletion(env: Env, id: number, chatId: number): Promise<void> {
  for (;;) {
    const result = await sendBroadcastBatch(env, id);
    if (!result) return;
    if (result.done) {
      await reply(env, chatId, `✅ Рассылка #${id} завершена.\nОтправлено: ${result.sent}\nНе доставлено: ${result.failed}`);
      return;
    }
  }
}

const HELP_TEXT =
  'Команды для владельца:\n\n' +
  '/status — быстрая сводка по площадке\n' +
  '/broadcast <текст> — подготовить рассылку всем, у кого есть бот\n' +
  '/confirm <id> — разослать подготовленную рассылку #id\n' +
  '/help — это сообщение';

/** Сводка в одно сообщение — специально лёгкая (голые COUNT по индексам,
 *  без джойнов и без воронки, как у дашборда), чтобы с телефона за пару
 *  секунд понять «а точно ли что-то сломалось», не открывая веб-админку.
 *  Любая из таблиц может не существовать на базе, где накатаны не все
 *  миграции (см. весь этот кодбейз) — тогда просто сообщаем об этом,
 *  а не роняем всю команду. */
async function statusSummary(env: Env): Promise<string> {
  const count = async (sql: string): Promise<number> => (await env.DB.prepare(sql).first<{ n: number }>())?.n ?? 0;

  try {
    const [workers, companies, activeShifts, pendingVerification, newComplaints, unreadSupport, newWorkersToday, newCompaniesToday] =
      await Promise.all([
        count('SELECT COUNT(*) as n FROM workers'),
        count('SELECT COUNT(*) as n FROM companies'),
        count("SELECT COUNT(*) as n FROM shifts WHERE status = 'active'"),
        count("SELECT COUNT(*) as n FROM companies WHERE verification_status = 'pending'"),
        count("SELECT COUNT(*) as n FROM complaints WHERE status = 'new'"),
        count("SELECT COUNT(*) as n FROM support_messages WHERE sender = 'user' AND read = 0"),
        count("SELECT COUNT(*) as n FROM workers WHERE date(created_at) = date('now')"),
        count("SELECT COUNT(*) as n FROM companies WHERE date(created_at) = date('now')"),
      ]);

    return (
      `📊 Wolso сейчас\n\n` +
      `Соискателей всего: ${workers}\n` +
      `Работодателей всего: ${companies}\n` +
      `Активных вакансий: ${activeShifts}\n\n` +
      `Сегодня зарегистрировалось: ${newWorkersToday + newCompaniesToday} (${newWorkersToday} соискателей, ${newCompaniesToday} работодателей)\n\n` +
      `На проверке (работодатели): ${pendingVerification}\n` +
      `Новых жалоб: ${newComplaints}\n` +
      `Непрочитано в поддержке: ${unreadSupport}`
    );
  } catch (err) {
    console.error('bot /status failed', err);
    return 'Не получилось собрать сводку — похоже, воркер или база недоступны.';
  }
}

async function handleOwnerCommand(
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void,
  chatId: number,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  const spaceAt = trimmed.indexOf(' ');
  const cmd = (spaceAt === -1 ? trimmed : trimmed.slice(0, spaceAt)).split('@')[0]; // срезает /cmd@botname
  const arg = spaceAt === -1 ? '' : trimmed.slice(spaceAt + 1).trim();

  if (cmd === '/start' || cmd === '/help') {
    await reply(env, chatId, HELP_TEXT);
    return;
  }

  if (cmd === '/status') {
    await reply(env, chatId, await statusSummary(env));
    return;
  }

  if (cmd === '/broadcast') {
    if (!arg) {
      await reply(env, chatId, 'Напиши текст после команды, например:\n/broadcast Сегодня временные технические работы, скоро всё вернём.');
      return;
    }
    const result = await createBroadcast(env, { text: arg, audience: 'all', createdBy: 'владелец (из бота)' });
    if ('error' in result) {
      await reply(env, chatId, result.error === 'no_recipients' ? 'Получателей не нашлось.' : 'Не получилось подготовить рассылку.');
      return;
    }
    await reply(
      env,
      chatId,
      `Рассылка #${result.id} подготовлена, но ещё не отправлена.\nПолучателей: ${result.total}\n\nТекст:\n${arg}\n\n` +
        `Чтобы разослать — пришли /confirm ${result.id}\nЕсли передумал — просто ничего не делай, сама она не уйдёт.`,
    );
    return;
  }

  if (cmd === '/confirm') {
    const id = Number(arg);
    if (!Number.isFinite(id)) {
      await reply(env, chatId, 'Укажи номер рассылки: /confirm 12');
      return;
    }
    await reply(env, chatId, `Рассылка #${id} запущена, пишу сюда, когда закончу…`);
    waitUntil(runBroadcastToCompletion(env, id, chatId));
    return;
  }
}

botRoutes.post('/webhook/:token', async (c) => {
  if (c.req.param('token') !== c.env.BOT_TOKEN) return c.json({ error: 'not_found' }, 404);

  const update = await c.req.json<TelegramUpdate>().catch(() => ({}) as TelegramUpdate);

  const change = update.my_chat_member;
  const memberChatId = change?.chat?.id;
  // Only private chats say anything about a *person's* subscription; the
  // same update fires for groups the bot is added to or removed from.
  if (change && memberChatId && (!change.chat?.type || change.chat.type === 'private')) {
    // 'kicked' is what Telegram calls a user blocking the bot. 'member' is
    // an active subscription — it's also what an unblock reports, so this
    // clears a stale 'blocked' as soon as someone comes back.
    const memberStatus = change.new_chat_member?.status;
    if (memberStatus === 'kicked') await recordBotStatus(c.env, memberChatId, 'blocked');
    else if (memberStatus === 'member') await recordBotStatus(c.env, memberChatId, 'active');
  }

  const message = update.message;
  const messageChatId = message?.chat?.id;
  if (messageChatId && message?.chat?.type === 'private' && message.text?.startsWith('/') && isOwnerChat(c.env, messageChatId)) {
    await handleOwnerCommand(c.env, (p) => c.executionCtx.waitUntil(p), messageChatId, message.text);
  }

  // Always 200: a non-2xx makes Telegram retry the same update for hours.
  return c.json({ ok: true });
});

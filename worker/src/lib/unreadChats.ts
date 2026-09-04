import type { Env } from '../types';
import { notifyCompany, notifyWorker } from './notifyPrefs';
import { pluralize } from './plural';

/** Одно напоминание о непрочитанной переписке — тем, кто не открыл её сам.
 *
 *  Раньше бот присылал пуш на каждое сообщение, с его текстом. Обычный
 *  разговор превращался в поток сообщений от бота, а бота после такого
 *  отключают — вместе с уведомлениями, которые действительно важны.
 *  Поэтому теперь наоборот: пуш уходит, только если человек не открыл чат
 *  сам, и говорит лишь о том, что сообщения есть.
 *
 *  Текста переписки в уведомлении нет намеренно. Пуш видно на заблокированном
 *  экране, через плечо, в чужих руках — договорённости о работе и деньгах
 *  туда попадать не должны. Имя собеседника остаётся: без него непонятно,
 *  куда идти.
 *
 *  Задержка нужна ровно затем, чтобы не пинговать человека, который и так
 *  сидит в переписке: открытый чат помечает сообщения прочитанными в тот же
 *  момент (см. routes/chats.ts), и до этой минутной сверки они просто не
 *  доживают. */

/** Сколько сообщение должно пролежать непрочитанным, прежде чем о нём
 *  напомнят. Две минуты — заметно больше, чем пауза между репликами в
 *  живом разговоре, и заметно меньше, чем время, за которое смена уходит
 *  другому. */
const UNREAD_AFTER_MINUTES = 2;

/** Одно напоминание на серию непрочитанных: следующее — только если человек
 *  за это время так и не открыл чат. Открыл — отметка снимается сразу
 *  (routes/chats.ts), и новая серия снова получит своё напоминание. */
const UNREAD_COOLDOWN_MINUTES = 60;

/** Сколько чатов трогает один запуск. Крон ходит раз в минуту, следующий
 *  подберёт остальное — всё отправленное отмечено в базе. */
const BATCH = 40;

interface Pending {
  chat_id: number;
  recipient_id: number;
  telegram_id: number;
  counterparty: string;
  unread: number;
}

function unreadLine(n: number): string {
  return `${n} ${pluralize(n, 'непрочитанное сообщение', 'непрочитанных сообщения', 'непрочитанных сообщений')}`;
}

/** Непрочитанное у соискателя (написал работодатель) и у работодателя
 *  (написал соискатель) — один и тот же запрос с зеркальными колонками. */
async function pendingFor(env: Env, side: 'worker' | 'company'): Promise<Pending[]> {
  const isWorker = side === 'worker';
  const sql = isWorker
    ? `SELECT ch.id AS chat_id, ch.worker_id AS recipient_id, w.telegram_id AS telegram_id,
              co.name AS counterparty, COUNT(m.id) AS unread
       FROM chats ch
       JOIN messages m ON m.chat_id = ch.id AND m.read = 0 AND m.sender = 'company'
       JOIN workers w ON w.id = ch.worker_id
       JOIN companies co ON co.id = ch.company_id
       WHERE w.status != 'suspended'
         AND (ch.worker_notified_at IS NULL OR ch.worker_notified_at <= datetime('now', ?))
       GROUP BY ch.id
       HAVING MIN(m.created_at) <= datetime('now', ?)
       LIMIT ?`
    : `SELECT ch.id AS chat_id, ch.company_id AS recipient_id, co.owner_telegram_id AS telegram_id,
              w.name AS counterparty, COUNT(m.id) AS unread
       FROM chats ch
       JOIN messages m ON m.chat_id = ch.id AND m.read = 0 AND m.sender = 'worker'
       JOIN companies co ON co.id = ch.company_id
       JOIN workers w ON w.id = ch.worker_id
       WHERE co.status != 'suspended'
         AND (ch.company_notified_at IS NULL OR ch.company_notified_at <= datetime('now', ?))
       GROUP BY ch.id
       HAVING MIN(m.created_at) <= datetime('now', ?)
       LIMIT ?`;

  const { results } = await env.DB.prepare(sql)
    .bind(`-${UNREAD_COOLDOWN_MINUTES} minutes`, `-${UNREAD_AFTER_MINUTES} minutes`, BATCH)
    .all<Pending>();
  return results;
}

/** Запускается отдельным минутным кроном (см. wrangler.toml и `scheduled`
 *  в index.ts). Свои ошибки глотает и пишет в лог: это фон, где никто не
 *  смотрит, и упавшая рассылка не должна ронять запуск целиком. */
export async function runUnreadChatPings(env: Env): Promise<void> {
  const now = new Date().toISOString();

  try {
    for (const row of await pendingFor(env, 'worker')) {
      await notifyWorker(
        env,
        { id: row.recipient_id, telegramId: row.telegram_id },
        'employer_replies',
        `💬 ${row.counterparty || 'Работодатель'}\nУ вас ${unreadLine(row.unread)} — откройте Wolso, чтобы прочитать.`,
      );
      // Отмечаем в любом случае: человеку, заблокировавшему бота, сообщение
      // не дойдёт никогда, а цикл должен заканчиваться.
      await env.DB.prepare('UPDATE chats SET worker_notified_at = ? WHERE id = ?').bind(now, row.chat_id).run();
    }
  } catch (err) {
    console.error('unread chat pings (worker) failed', err);
  }

  try {
    for (const row of await pendingFor(env, 'company')) {
      await notifyCompany(
        env,
        { id: row.recipient_id, telegramId: row.telegram_id },
        'worker_replies',
        `💬 ${row.counterparty || 'Соискатель'}\nУ вас ${unreadLine(row.unread)} — откройте Wolso, чтобы прочитать.`,
      );
      await env.DB.prepare('UPDATE chats SET company_notified_at = ? WHERE id = ?').bind(now, row.chat_id).run();
    }
  } catch (err) {
    console.error('unread chat pings (company) failed', err);
  }
}

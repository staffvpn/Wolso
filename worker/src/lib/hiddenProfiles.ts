import type { Env } from '../types';
import { adminNotifyHandle, notifyAdmin } from './adminNotify';

/** Whether migration 0027 has been applied. Migrations here are run by
 *  hand, so the deployed code can be a migration ahead of the database —
 *  and a query naming a column D1 doesn't have throws, which Hono flattens
 *  into a bare internal_error 500. For the dashboard that means a button
 *  that looks dead; for `/employer/workers` it would mean the whole "найти
 *  сотрудников" deck failing for every employer until the SQL is run. Both
 *  are worth a cheap check first.
 *
 *  The `true` answer is cached for the lifetime of the isolate — a column
 *  never goes away again — but `false` is deliberately not, so applying the
 *  migration takes effect without redeploying. */
let columnConfirmed = false;

export async function hiddenColumnExists(env: Env): Promise<boolean> {
  if (columnConfirmed) return true;
  try {
    const { results } = await env.DB.prepare('PRAGMA table_info(workers)').all<{ name: string }>();
    columnConfirmed = results.some((r) => r.name === 'hidden');
    return columnConfirmed;
  } catch {
    return false;
  }
}

/** A WHERE fragment excluding hidden workers, or an empty string while the
 *  migration is still pending. Meant to be interpolated into SQL, so it
 *  takes no user input — the caller passes the table alias it uses. */
export async function excludeHiddenSql(env: Env, alias: string): Promise<string> {
  return (await hiddenColumnExists(env)) ? `AND ${alias}.hidden = 0` : '';
}

/** Whether this particular worker is hidden. Returns false while the
 *  migration is pending, so nothing is refused because of a column that
 *  doesn't exist yet. */
export async function workerIsHidden(env: Env, workerId: number): Promise<boolean> {
  if (!(await hiddenColumnExists(env))) return false;
  const row = await env.DB.prepare('SELECT hidden FROM workers WHERE id = ?').bind(workerId).first<{ hidden: number }>();
  return !!row?.hidden;
}

/** Whether migration 0037 has been applied. Same caching rule as above:
 *  only the `true` answer sticks, so running the SQL takes effect without
 *  a redeploy. */
let editNotifyColumnConfirmed = false;

export async function hiddenEditColumnExists(env: Env): Promise<boolean> {
  if (editNotifyColumnConfirmed) return true;
  try {
    const { results } = await env.DB.prepare('PRAGMA table_info(workers)').all<{ name: string }>();
    editNotifyColumnConfirmed = results.some((r) => r.name === 'hidden_edit_notified_at');
    return editNotifyColumnConfirmed;
  } catch {
    return false;
  }
}

/** Не чаще одного сообщения оператору за это время на одного человека.
 *  Анкета правится по частям — имя, фото, опыт уходят отдельными
 *  запросами, — и без окна оператор получил бы подряд десяток одинаковых
 *  «посмотрите ещё раз». Полдня достаточно: за один заход человек
 *  укладывается, а вернувшись назавтра, справедливо ждёт нового разбора. */
const HIDDEN_EDIT_COOLDOWN_HOURS = 12;

/** Человек со скрытой анкетой её поправил — значит просит посмотреть
 *  снова. Дёргается из всех ручек, которые меняют анкету, и сама решает,
 *  писать оператору или нет:
 *
 *  - анкета не скрыта → молчим, это обычная правка;
 *  - уже писали недавно → молчим, см. окно выше;
 *  - миграция 0037 не применена → молчим и пишем в лог. Без отметки
 *    единственная альтернатива — сообщение на каждое сохранение, а это
 *    хуже, чем не работающая до применения SQL функция.
 *
 *  Best-effort целиком: это наблюдатель, он не имеет права уронить
 *  сохранение анкеты, ради которого его позвали. */
export async function reportHiddenProfileEdit(env: Env, workerId: number): Promise<void> {
  try {
    if (!(await hiddenColumnExists(env))) return;

    const worker = await env.DB.prepare(
      'SELECT name, telegram_id, telegram_username, hidden, hidden_reason FROM workers WHERE id = ?',
    )
      .bind(workerId)
      .first<{
        name: string;
        telegram_id: number;
        telegram_username: string | null;
        hidden: number;
        hidden_reason: string | null;
      }>();
    if (!worker?.hidden) return;

    if (!(await hiddenEditColumnExists(env))) {
      console.error('hidden-profile edit alert skipped — migration 0037_hidden_review_request is not applied');
      return;
    }

    // Отметку ставим тем же запросом, что и проверяем окно: два
    // сохранения подряд успевают пройти проверку одновременно, и тогда
    // оператор получает два сообщения вместо одного.
    const stamped = await env.DB.prepare(
      `UPDATE workers SET hidden_edit_notified_at = datetime('now')
       WHERE id = ? AND (hidden_edit_notified_at IS NULL OR hidden_edit_notified_at <= datetime('now', ?))`,
    )
      .bind(workerId, `-${HIDDEN_EDIT_COOLDOWN_HOURS} hours`)
      .run();
    if (!stamped.meta.changes) return;

    await notifyAdmin(
      env,
      `♻️ Скрытая анкета изменена\n${worker.name || 'Без имени'} (${adminNotifyHandle(worker.telegram_username, worker.telegram_id)})\n` +
        `Скрыта: ${worker.hidden_reason ? `«${worker.hidden_reason}»` : 'без причины'}\n\n` +
        'Человек поправил анкету и ждёт повторного разбора. Откройте «Соискатели» в дашборде.',
    );
  } catch (err) {
    console.error('reportHiddenProfileEdit failed', workerId, err);
  }
}

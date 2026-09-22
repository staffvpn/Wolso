import type { Env } from '../types';
import { sendTelegramMessageResult } from './telegramBot';
import { notifyCompany, notifyWorker } from './notifyPrefs';
import { photoReminderColumnExists } from './ownPhoto';

/** The two automatic bot reminders, run from the cron trigger (see
 *  wrangler.toml and the `scheduled` export in index.ts).
 *
 *  Both are deliberately conservative. Telegram's rule of thumb is that a
 *  bot people don't want to hear from gets blocked, and a blocked bot
 *  stops delivering the messages that actually matter — invitations,
 *  cancellations, shift changes. So: one nudge ever for an unfinished
 *  registration, and a cooldown on the employer one, with every send
 *  written down before the next run can consider the same account. */

/** How long someone gets to finish their profile in peace before the
 *  reminder goes out. Short enough to catch them the next day while they
 *  still remember signing up, long enough that someone who is filling the
 *  form in right now never gets nagged mid-typing. */
const SIGNUP_REMINDER_AFTER_HOURS = 20;

/** How long an applicant can sit unanswered before the employer hears
 *  about it. A shift is a time-sensitive thing — a worker waiting even a
 *  couple of hours has usually started looking elsewhere, so this fires
 *  fast rather than waiting for the situation to be clearly bad. */
const PENDING_REMINDER_AFTER_HOURS = 2;

/** …and how long before the same employer can be reminded again for the
 *  same still-pending pile, so an employer who's ignoring the bot entirely
 *  doesn't get paged every hour. Short, because the 2h trigger above means
 *  someone who's just busy for the afternoon should still hear about it
 *  again today instead of tomorrow. */
const PENDING_REMINDER_COOLDOWN_HOURS = 6;

/** How long a worker can go without opening the app before they're
 *  considered dormant, and the matching cooldown before the same worker
 *  can be nudged again — see remindDormantWorkers below. */
const DORMANT_AFTER_DAYS = 4;
const DORMANT_REMINDER_COOLDOWN_DAYS = 4;

/** How long an employer with a finished profile gets before being asked
 *  why they haven't posted a single shift — long enough that someone who
 *  just hasn't gotten to it yet isn't nagged the same day they signed up. */
const NEVER_POSTED_REMINDER_AFTER_HOURS = 72;

/** One cron run touches at most this many accounts per reminder. A Worker
 *  invocation has a wall-clock budget and the Bot API has a rate limit;
 *  the next run picks up where this one stopped, because everything sent
 *  is stamped. */
const BATCH = 25;

/** Whether migration 0028 has been applied. Same reasoning as
 *  hiddenProfiles.ts: migrations are run by hand, so the deployed code can
 *  be a migration ahead of the database. A cron job that throws does it
 *  silently, in the background, where nobody is watching — so it checks
 *  first and does nothing instead. */
let columnsConfirmed = false;

export async function reminderColumnsExist(env: Env): Promise<boolean> {
  if (columnsConfirmed) return true;
  try {
    const [workers, companies] = await Promise.all([
      env.DB.prepare('PRAGMA table_info(workers)').all<{ name: string }>(),
      env.DB.prepare('PRAGMA table_info(companies)').all<{ name: string }>(),
    ]);
    columnsConfirmed =
      workers.results.some((r) => r.name === 'signup_reminded_at') &&
      companies.results.some((r) => r.name === 'pending_reminded_at');
    return columnsConfirmed;
  } catch {
    return false;
  }
}

function supportLine(env: Env): string {
  const handle = (env.SUPPORT_USERNAME ?? '').replace(/^@/, '').trim();
  return handle ? `Если что-то не получается или есть вопросы — напишите в поддержку @${handle}.` : '';
}

/** Один текст на обе роли. Раньше их было два — «не закончили анкету» и
 *  «не закончили профиль заведения», — и человек, у которого есть строки в
 *  обеих таблицах (регистрировался обеими ролями, или роль переключали из
 *  дашборда), получал оба письма подряд, включая то, которое к его
 *  сегодняшней роли отношения не имеет. Отсюда две правки: текст без
 *  упоминания роли и фильтр по active_role ниже.
 *
 *  "Не заполнено" повторяет проверки, которые приложение и так применяет
 *  (isComplete в routes/profile.ts, companyIsComplete в routes/employer.ts)
 *  — выражено в SQL, а не перебором строк: это ходит по всей таблице по
 *  расписанию, а не по одному человеку по запросу. */
const SIGNUP_REMINDER_TEXT =
  'Вы заходили в Wolso, но не заполнили профиль до конца.\n\n' +
  'Пока он пустой, ничего не начнётся: анкету не увидят работодатели, а смену не получится опубликовать. ' +
  'Это пара минут — заполните профиль, и можно начинать.';

async function remindUnfinishedSignups(env: Env): Promise<{ workers: number; companies: number }> {
  const cutoff = `-${SIGNUP_REMINDER_AFTER_HOURS} hours`;

  // Роль берём из telegram_accounts — там она и живёт. Когда её нет
  // (аккаунты, заведённые до появления таблицы), приоритет у соискателя,
  // как и при входе (см. routes/auth.ts), а вторая роль пропускается —
  // иначе одному человеку уходят два письма.
  const { results: workers } = await env.DB.prepare(
    `SELECT w.id, w.telegram_id
     FROM workers w
     LEFT JOIN telegram_accounts t ON t.telegram_id = w.telegram_id
     WHERE w.signup_reminded_at IS NULL
       AND w.status != 'suspended'
       AND w.created_at <= datetime('now', ?)
       AND (t.active_role = 'worker' OR t.active_role IS NULL)
       AND (
         w.name = '' OR w.city = '' OR w.bio = '' OR w.skills = '' OR w.birthdate IS NULL
         OR NOT EXISTS (SELECT 1 FROM worker_positions wp WHERE wp.worker_id = w.id AND wp.months > 0)
       )
     ORDER BY w.created_at ASC LIMIT ?`,
  )
    .bind(cutoff, BATCH)
    .all<{ id: number; telegram_id: number }>();

  const { results: companies } = await env.DB.prepare(
    `SELECT co.id, co.owner_telegram_id
     FROM companies co
     LEFT JOIN telegram_accounts t ON t.telegram_id = co.owner_telegram_id
     WHERE co.signup_reminded_at IS NULL
       AND co.status != 'suspended'
       AND co.created_at <= datetime('now', ?)
       AND (
         t.active_role = 'employer'
         OR (t.active_role IS NULL AND NOT EXISTS (SELECT 1 FROM workers w2 WHERE w2.telegram_id = co.owner_telegram_id))
       )
       AND (co.name = '' OR co.description = '' OR co.founded_year IS NULL OR co.avatar_data IS NULL OR co.inn IS NULL)
     ORDER BY co.created_at ASC LIMIT ?`,
  )
    .bind(cutoff, BATCH)
    .all<{ id: number; owner_telegram_id: number }>();

  const support = supportLine(env);
  const text = support ? `${SIGNUP_REMINDER_TEXT}\n\n${support}` : SIGNUP_REMINDER_TEXT;
  const now = new Date().toISOString();

  // Помечаем отправленным всё, кроме временных отказов. Человек,
  // заблокировавший бота, письма не получит сколько ни повторяй, и вот
  // из-за таких повторов цикл бы никогда не закончился. А 429 или 500 от
  // Telegram про человека не говорят ничего: раньше такой ответ тоже
  // ставил отметку — и единственная за всю жизнь попытка сгорала впустую,
  // причём молча. Теперь её просто повторит следующий час.
  let sentWorkers = 0;
  let sentCompanies = 0;

  for (const w of workers) {
    const result = await sendTelegramMessageResult(env, w.telegram_id, text);
    if (result === 'transient') continue;
    if (result === 'sent') sentWorkers++;
    await env.DB.prepare('UPDATE workers SET signup_reminded_at = ? WHERE id = ?').bind(now, w.id).run();
  }

  for (const co of companies) {
    const result = await sendTelegramMessageResult(env, co.owner_telegram_id, text);
    if (result === 'transient') continue;
    if (result === 'sent') sentCompanies++;
    await env.DB.prepare('UPDATE companies SET signup_reminded_at = ? WHERE id = ?').bind(now, co.id).run();
  }

  return { workers: sentWorkers, companies: sentCompanies };
}

/** Анкеты, на которых до сих пор стоит картинка из Telegram.
 *
 *  Само по себе это не мешало ничему — поле выглядит заполненным, поэтому
 *  его и не трогают, — но откликаться теперь без своего фото нельзя (см.
 *  routes/applications.ts). Человек, который зайдёт в приложение, узнает об
 *  этом сразу; человек, который не зайдёт, не узнает никогда. Отсюда одно
 *  сообщение — и объясняющее, а не требующее.
 *
 *  Профиль при этом должен быть заполнен: тому, кто вообще не дошёл до
 *  конца регистрации, уже ушло письмо про профиль целиком, и второе про
 *  фото — это ровно тот случай, после которого бота отключают. */
const OWN_PHOTO_REMINDER_TEXT =
  'На вашей анкете стоит фото из Telegram.\n\n' +
  'Работодатель выбирает человека на смену по лицу, поэтому откликаться можно только со своим фото — ' +
  'обычное селфи при дневном свете, лицо видно, этого достаточно.\n\n' +
  'Откройте Wolso → Профиль → Редактировать и поставьте фото: это одно нажатие, и смены снова станут доступны.';

async function remindTelegramPhotos(env: Env): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT w.id, w.telegram_id
     FROM workers w
     LEFT JOIN telegram_accounts t ON t.telegram_id = w.telegram_id
     WHERE w.photo_reminded_at IS NULL
       AND w.status != 'suspended'
       AND w.avatar_data IS NULL
       AND w.photo_url IS NOT NULL
       AND (t.active_role = 'worker' OR t.active_role IS NULL)
       AND w.name != '' AND w.city != '' AND w.bio != '' AND w.skills != '' AND w.birthdate IS NOT NULL
       AND EXISTS (SELECT 1 FROM worker_positions wp WHERE wp.worker_id = w.id AND wp.months > 0)
     ORDER BY w.created_at ASC LIMIT ?`,
  )
    .bind(BATCH)
    .all<{ id: number; telegram_id: number }>();

  const support = supportLine(env);
  const text = support ? `${OWN_PHOTO_REMINDER_TEXT}\n\n${support}` : OWN_PHOTO_REMINDER_TEXT;
  const now = new Date().toISOString();

  // Та же попытка «раз в жизни», что и у напоминания о профиле, — и та же
  // оговорка про временные отказы.
  let sent = 0;
  for (const w of results) {
    const result = await sendTelegramMessageResult(env, w.telegram_id, text);
    if (result === 'transient') continue;
    if (result === 'sent') sent++;
    await env.DB.prepare('UPDATE workers SET photo_reminded_at = ? WHERE id = ?').bind(now, w.id).run();
  }

  return sent;
}

/** The employer-side equivalent of remindUnfinishedSignups: profile done,
 *  but never once published a shift. Deliberately narrow — a company that
 *  posted before and has simply been quiet since isn't nagged here, only
 *  someone with zero shifts ever, because that's the one case where "they
 *  already built a team through Wolso and don't need this" can't be true.
 *  One nudge ever, same as the signup/photo reminders above. */
const NEVER_POSTED_REMINDER_TEXT =
  'Профиль заведения заполнен, а смену вы ещё ни разу не публиковали.\n\n' +
  'Это минута: должность, дата и ставка — и отклики начнут приходить сами.';

async function remindNeverPostedEmployers(env: Env): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT co.id, co.owner_telegram_id
     FROM companies co
     WHERE co.never_posted_reminded_at IS NULL
       AND co.status != 'suspended'
       AND co.created_at <= datetime('now', ?)
       AND co.name != '' AND co.description != '' AND co.founded_year IS NOT NULL
       AND co.avatar_data IS NOT NULL AND co.inn IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM shifts s WHERE s.company_id = co.id)
     ORDER BY co.created_at ASC LIMIT ?`,
  )
    .bind(`-${NEVER_POSTED_REMINDER_AFTER_HOURS} hours`, BATCH)
    .all<{ id: number; owner_telegram_id: number }>();

  const support = supportLine(env);
  const text = support ? `${NEVER_POSTED_REMINDER_TEXT}\n\n${support}` : NEVER_POSTED_REMINDER_TEXT;
  const now = new Date().toISOString();

  let sent = 0;
  for (const co of results) {
    const result = await sendTelegramMessageResult(env, co.owner_telegram_id, text);
    if (result === 'transient') continue;
    if (result === 'sent') sent++;
    await env.DB.prepare('UPDATE companies SET never_posted_reminded_at = ? WHERE id = ?').bind(now, co.id).run();
  }

  return sent;
}

/** Applicants nobody answered. One message per employer, not per
 *  applicant — someone with eight unanswered responses has one problem,
 *  not eight. */
async function remindPendingCandidates(env: Env): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT co.id, co.owner_telegram_id, co.name,
            COUNT(a.id) as waiting,
            MIN(s.position_label) as position_label
     FROM companies co
     JOIN shifts s ON s.company_id = co.id AND s.status = 'active'
     JOIN applications a ON a.shift_id = s.id AND a.status = 'pending'
     WHERE co.status != 'suspended'
       AND a.created_at <= datetime('now', ?)
       AND (co.pending_reminded_at IS NULL OR co.pending_reminded_at <= datetime('now', ?))
     GROUP BY co.id
     ORDER BY waiting DESC LIMIT ?`,
  )
    .bind(`-${PENDING_REMINDER_AFTER_HOURS} hours`, `-${PENDING_REMINDER_COOLDOWN_HOURS} hours`, BATCH)
    .all<{ id: number; owner_telegram_id: number; name: string; waiting: number; position_label: string }>();

  const now = new Date().toISOString();

  for (const co of results) {
    const people =
      co.waiting === 1 ? '1 человек ждёт ответа' : `${co.waiting} ${co.waiting < 5 ? 'человека ждут' : 'человек ждут'} ответа`;
    await notifyCompany(
      env,
      { id: co.id, telegramId: co.owner_telegram_id },
      'pending_reminder',
      `На вашу смену «${co.position_label}» откликнулись, но решения пока нет — ${people}.\n\n` +
        'Люди обычно не ждут долго и уходят на другую смену. Откройте «Кандидаты» и ответьте — это пара свайпов.',
    );
    await env.DB.prepare('UPDATE companies SET pending_reminded_at = ? WHERE id = ?').bind(now, co.id).run();
  }

  return results.length;
}

/** Whether migration 0042 has been applied. */
let neverPostedColumnConfirmed = false;

async function neverPostedColumnExists(env: Env): Promise<boolean> {
  if (neverPostedColumnConfirmed) return true;
  try {
    const { results } = await env.DB.prepare('PRAGMA table_info(companies)').all<{ name: string }>();
    neverPostedColumnConfirmed = results.some((r) => r.name === 'never_posted_reminded_at');
    return neverPostedColumnConfirmed;
  } catch {
    return false;
  }
}

/** Whether migration 0041 has been applied — same caution as the other
 *  gates in this file. */
let winbackColumnsConfirmed = false;

async function winbackColumnsExist(env: Env): Promise<boolean> {
  if (winbackColumnsConfirmed) return true;
  try {
    const { results } = await env.DB.prepare('PRAGMA table_info(workers)').all<{ name: string }>();
    winbackColumnsConfirmed = results.some((r) => r.name === 'last_seen_at');
    return winbackColumnsConfirmed;
  } catch {
    return false;
  }
}

/** People are in the bot, not using it, and hunting the same shifts
 *  through random chats instead — because nothing ever tells them the
 *  bot has anything new. This is that nudge: a worker who's gone quiet
 *  for a few days hears about it only if their specialty actually has
 *  fresh shifts to show for it, so it reads as news rather than a guilt
 *  trip about not opening an app.
 *
 *  Reuses the `new_shifts` pref — it's the same kind of message
 *  (routes/employer.ts's notifyMatchingWorkers) just batched into one
 *  digest for someone who missed the individual pings while they were
 *  away, instead of a switch of its own. */
async function remindDormantWorkers(env: Env): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT w.id, w.telegram_id, COALESCE(w.dormant_reminded_at, w.last_seen_at) as since
     FROM workers w
     WHERE w.status != 'suspended'
       AND w.name != '' AND w.city != '' AND w.bio != '' AND w.skills != '' AND w.birthdate IS NOT NULL
       AND EXISTS (SELECT 1 FROM worker_positions wp WHERE wp.worker_id = w.id AND wp.months > 0)
       AND w.last_seen_at IS NOT NULL
       AND w.last_seen_at <= datetime('now', ?)
       AND (w.dormant_reminded_at IS NULL OR w.dormant_reminded_at <= datetime('now', ?))
     ORDER BY w.last_seen_at ASC LIMIT ?`,
  )
    .bind(`-${DORMANT_AFTER_DAYS} days`, `-${DORMANT_REMINDER_COOLDOWN_DAYS} days`, BATCH)
    .all<{ id: number; telegram_id: number; since: string }>();

  const now = new Date().toISOString();
  let sent = 0;

  for (const w of results) {
    // Stamped either way, sent or not — otherwise a dormant worker with
    // nothing new for their specialty would get re-queried every single
    // hour until something finally shows up, crowding out everyone else
    // this batch could have reached instead.
    await env.DB.prepare('UPDATE workers SET dormant_reminded_at = ? WHERE id = ?').bind(now, w.id).run();

    const match = await env.DB.prepare(
      `SELECT COUNT(DISTINCT s.id) as n, MIN(s.position_label) as label
       FROM shifts s JOIN worker_positions wp ON wp.position = s.position
       WHERE wp.worker_id = ? AND s.status = 'active' AND s.created_at > ?`,
    )
      .bind(w.id, w.since)
      .first<{ n: number; label: string | null }>();
    const count = match?.n ?? 0;
    if (count === 0) continue;

    const shiftsWord = count === 1 ? 'смена' : count < 5 ? 'смены' : 'смен';
    const sentOk = await notifyWorker(
      env,
      { id: w.id, telegramId: w.telegram_id },
      'new_shifts',
      `🔔 Пока вас не было, на Wolso появил${count === 1 ? 'ась' : 'ось'} ${count} ${shiftsWord} по вашей специальности` +
        (match?.label ? ` — например «${match.label}»` : '') +
        '.\n\nЗагляните — работодатели откликов долго не ждут.',
    );
    if (sentOk) sent++;
  }

  return sent;
}

/** «Напоминание перед сменой» in Настройки used to be a switch with
 *  nothing behind it — no code anywhere sent such a message. This is it.
 *
 *  Shifts are stored as a local date plus an hour, with no timezone, and
 *  the rest of the app treats that as Moscow time (see lib/time.ts), so
 *  the window is computed the same way rather than in the Worker's UTC.
 *  Anything starting within the next couple of hours that hasn't been
 *  reminded about yet gets one message — the cron runs hourly, so "an
 *  hour before" is really "some time in the hour or two before", and
 *  promising to the minute would be a lie. */
async function remindUpcomingShifts(env: Env): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.worker_id, w.telegram_id, s.position_label, s.start_hour, s.start_min, co.name as company_name, co.address
     FROM applications a
     JOIN shifts s ON s.id = a.shift_id
     JOIN companies co ON co.id = s.company_id
     JOIN workers w ON w.id = a.worker_id
     WHERE a.status = 'accepted'
       AND a.work_stage = 'upcoming'
       AND a.shift_reminded_at IS NULL
       AND s.date = date('now', '+3 hours')
       AND (s.start_hour * 60 + s.start_min) BETWEEN
             (CAST(strftime('%H', datetime('now', '+3 hours')) AS INTEGER) * 60
              + CAST(strftime('%M', datetime('now', '+3 hours')) AS INTEGER))
         AND (CAST(strftime('%H', datetime('now', '+3 hours')) AS INTEGER) * 60
              + CAST(strftime('%M', datetime('now', '+3 hours')) AS INTEGER) + 120)
     LIMIT ?`,
  )
    .bind(BATCH)
    .all<{
      id: number;
      worker_id: number;
      telegram_id: number;
      position_label: string;
      start_hour: number;
      start_min: number;
      company_name: string;
      address: string | null;
    }>();

  const now = new Date().toISOString();
  const pad = (n: number) => String(n).padStart(2, '0');

  for (const r of results) {
    await notifyWorker(
      env,
      { id: r.worker_id, telegramId: r.telegram_id },
      'shift_reminder',
      `⏰ Скоро смена: «${r.position_label}»\n${r.company_name} — сегодня в ${pad(r.start_hour)}:${pad(r.start_min)}` +
        (r.address ? `\nАдрес: ${r.address}` : ''),
    );
    // Stamped whether or not the message went out — including when the
    // worker has these switched off — so the hourly run doesn't reconsider
    // the same shift every hour until it starts.
    await env.DB.prepare('UPDATE applications SET shift_reminded_at = ? WHERE id = ?').bind(now, r.id).run();
  }

  return results.length;
}

/** Whether migration 0030 has been applied — the pre-shift reminder needs
 *  applications.shift_reminded_at, which the other two jobs don't. */
let shiftReminderColumnConfirmed = false;

async function shiftReminderColumnExists(env: Env): Promise<boolean> {
  if (shiftReminderColumnConfirmed) return true;
  try {
    const { results } = await env.DB.prepare('PRAGMA table_info(applications)').all<{ name: string }>();
    shiftReminderColumnConfirmed = results.some((r) => r.name === 'shift_reminded_at');
    return shiftReminderColumnConfirmed;
  } catch {
    return false;
  }
}

/** Entry point for the cron trigger. Never throws: a scheduled handler
 *  that fails does so invisibly, so each job is isolated and logged. */
export async function runReminders(env: Env): Promise<void> {
  if (!(await reminderColumnsExist(env))) {
    console.error('reminders skipped — migration 0028_reminders is not applied');
    return;
  }

  try {
    const signups = await remindUnfinishedSignups(env);
    console.log('signup reminders sent', signups);
  } catch (err) {
    console.error('signup reminders failed', err);
  }

  try {
    const pending = await remindPendingCandidates(env);
    console.log('pending-candidate reminders sent', pending);
  } catch (err) {
    console.error('pending-candidate reminders failed', err);
  }

  try {
    if (await neverPostedColumnExists(env)) {
      console.log('never-posted reminders sent', await remindNeverPostedEmployers(env));
    } else {
      console.error('never-posted reminders skipped — migration 0042_employer_activation is not applied');
    }
  } catch (err) {
    console.error('never-posted reminders failed', err);
  }

  try {
    if (await winbackColumnsExist(env)) {
      console.log('win-back reminders sent', await remindDormantWorkers(env));
    } else {
      console.error('win-back reminders skipped — migration 0041_winback is not applied');
    }
  } catch (err) {
    console.error('win-back reminders failed', err);
  }

  try {
    if (await photoReminderColumnExists(env)) {
      console.log('own-photo reminders sent', await remindTelegramPhotos(env));
    } else {
      console.error('own-photo reminders skipped — migration 0035_own_photo_reminder is not applied');
    }
  } catch (err) {
    console.error('own-photo reminders failed', err);
  }

  try {
    if (await shiftReminderColumnExists(env)) {
      console.log('shift reminders sent', await remindUpcomingShifts(env));
    } else {
      console.error('shift reminders skipped — migration 0030_notification_settings is not applied');
    }
  } catch (err) {
    console.error('shift reminders failed', err);
  }
}

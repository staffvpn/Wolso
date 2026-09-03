import type { Env } from '../types';
import { sendTelegramMessage } from './telegramBot';

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
 *  about it. A shift is a time-sensitive thing — a worker waiting three
 *  days has usually taken something else by then. */
const PENDING_REMINDER_AFTER_HOURS = 18;

/** …and how long before the same employer can be reminded again, so a
 *  permanently-ignored applicant doesn't produce a daily message. */
const PENDING_REMINDER_COOLDOWN_DAYS = 3;

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

/** Registered, then stopped. Both roles land here: a worker with no real
 *  anketa is invisible to employers, and an employer with no filled-in
 *  profile can't publish anything — in both cases the account exists and
 *  does nothing, which is exactly what one message can fix.
 *
 *  "Incomplete" mirrors the gates the app itself enforces (see isComplete
 *  in routes/profile.ts and companyIsComplete in routes/employer.ts). It's
 *  expressed in SQL rather than by loading every row: this runs over the
 *  whole table on a schedule, not for one person on request. */
async function remindUnfinishedSignups(env: Env): Promise<{ workers: number; companies: number }> {
  const cutoff = `-${SIGNUP_REMINDER_AFTER_HOURS} hours`;

  const { results: workers } = await env.DB.prepare(
    `SELECT w.id, w.telegram_id
     FROM workers w
     WHERE w.signup_reminded_at IS NULL
       AND w.status != 'suspended'
       AND w.created_at <= datetime('now', ?)
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
     WHERE co.signup_reminded_at IS NULL
       AND co.status != 'suspended'
       AND co.created_at <= datetime('now', ?)
       AND (co.name = '' OR co.description = '' OR co.founded_year IS NULL OR co.avatar_data IS NULL OR co.inn IS NULL)
     ORDER BY co.created_at ASC LIMIT ?`,
  )
    .bind(cutoff, BATCH)
    .all<{ id: number; owner_telegram_id: number }>();

  const support = supportLine(env);
  const now = new Date().toISOString();

  for (const w of workers) {
    await sendTelegramMessage(
      env,
      w.telegram_id,
      'Вы заходили в Wolso, но не закончили анкету.\n\n' +
        'Работодатели выбирают людей именно по ней — пока анкета пустая, вас просто не видно. ' +
        'Это пара минут: фото, город, пара слов о себе и где вы уже работали.\n\n' +
        support,
    );
    // Stamped whatever the send returned. A person who blocked the bot
    // won't get this message no matter how many times we retry, and
    // retrying is what would make this loop never terminate.
    await env.DB.prepare('UPDATE workers SET signup_reminded_at = ? WHERE id = ?').bind(now, w.id).run();
  }

  for (const co of companies) {
    await sendTelegramMessage(
      env,
      co.owner_telegram_id,
      'Вы заходили в Wolso, но не закончили профиль заведения.\n\n' +
        'Без него нельзя опубликовать смену и посмотреть, кто откликнулся. ' +
        'Осталось немного: название, фото, пара слов о заведении и ИНН для проверки.\n\n' +
        support,
    );
    await env.DB.prepare('UPDATE companies SET signup_reminded_at = ? WHERE id = ?').bind(now, co.id).run();
  }

  return { workers: workers.length, companies: companies.length };
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
    .bind(`-${PENDING_REMINDER_AFTER_HOURS} hours`, `-${PENDING_REMINDER_COOLDOWN_DAYS} days`, BATCH)
    .all<{ id: number; owner_telegram_id: number; name: string; waiting: number; position_label: string }>();

  const now = new Date().toISOString();

  for (const co of results) {
    const people =
      co.waiting === 1 ? '1 человек ждёт ответа' : `${co.waiting} ${co.waiting < 5 ? 'человека ждут' : 'человек ждут'} ответа`;
    await sendTelegramMessage(
      env,
      co.owner_telegram_id,
      `На вашу смену «${co.position_label}» откликнулись, но решения пока нет — ${people}.\n\n` +
        'Люди обычно не ждут долго и уходят на другую смену. Откройте «Кандидаты» и ответьте — это пара свайпов.',
    );
    await env.DB.prepare('UPDATE companies SET pending_reminded_at = ? WHERE id = ?').bind(now, co.id).run();
  }

  return results.length;
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
}

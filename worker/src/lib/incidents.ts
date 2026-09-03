import type { Env } from '../types';
import { notifyAdmin } from './adminNotify';

/** ЧП, о которых дежурному стоит узнать сразу, а не из жалобы через два
 *  дня. Инфраструктура для этого уже была (notifyAdmin) — не было
 *  собственно повода её позвать: отмена подтверждённой смены за час до
 *  начала выглядела в системе ровно так же, как отмена за неделю.
 *
 *  Ничего не блокирует и никого не наказывает: это сигнал человеку, а не
 *  автоматическое решение. */

/** За сколько часов до начала отмена считается срывом, а не изменением
 *  планов. Меньше суток — заменить человека уже почти невозможно. */
const LATE_CANCEL_HOURS = 24;

/** Сколько отмен за две недели делают из «бывает» закономерность. */
const REPEAT_CANCEL_THRESHOLD = 3;
const REPEAT_CANCEL_WINDOW_DAYS = 14;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Смена начинается меньше чем через LATE_CANCEL_HOURS? Считается по МСК
 *  (`+3 hours`), как и всё остальное, что имеет дело с датой смены — она
 *  хранится без таймзоны. */
async function isLateCancel(env: Env, shiftId: number): Promise<{ late: boolean; label: string } | null> {
  const row = await env.DB.prepare(
    `SELECT position_label, date, start_hour, start_min,
            (julianday(date || ' ' || printf('%02d:%02d', start_hour, start_min)) - julianday(datetime('now', '+3 hours'))) * 24 as hours_left
     FROM shifts WHERE id = ?`,
  )
    .bind(shiftId)
    .first<{ position_label: string; date: string; start_hour: number; start_min: number; hours_left: number }>();
  if (!row) return null;
  return {
    late: row.hours_left !== null && row.hours_left >= 0 && row.hours_left <= LATE_CANCEL_HOURS,
    label: `«${row.position_label}» ${row.date} в ${pad(row.start_hour)}:${pad(row.start_min)}`,
  };
}

/** Кто-то из сторон отменил уже подтверждённую смену. Зовётся из обоих
 *  мест отмены (соискатель — applications.ts, работодатель —
 *  employer.ts); best-effort, ошибки глотает: сорванное оповещение не
 *  должно ронять саму отмену. */
export async function reportCancellation(
  env: Env,
  input: { shiftId: number; by: 'worker' | 'employer'; actorName: string; reason: string; workerId?: number; companyId?: number },
): Promise<void> {
  try {
    const shift = await isLateCancel(env, input.shiftId);
    if (!shift) return;

    const lines: string[] = [];
    if (shift.late) {
      lines.push(`🚨 Отмена меньше чем за ${LATE_CANCEL_HOURS} ч`);
      lines.push(`${input.by === 'worker' ? 'Соискатель' : 'Работодатель'}: ${input.actorName}`);
      lines.push(shift.label);
      lines.push(`Причина: ${input.reason}`);
    }

    // Повторяющиеся отмены — отдельный сигнал: одна поздняя отмена бывает
    // у кого угодно, три за две недели это уже про человека.
    const column = input.by === 'worker' ? 'worker_id' : 'company_id';
    const id = input.by === 'worker' ? input.workerId : input.companyId;
    if (id) {
      const repeats = await env.DB.prepare(
        input.by === 'worker'
          ? `SELECT COUNT(*) as n FROM applications
             WHERE worker_id = ? AND cancelled_by = 'worker' AND cancelled_at >= datetime('now', ?)`
          : `SELECT COUNT(*) as n FROM applications a JOIN shifts s ON s.id = a.shift_id
             WHERE s.company_id = ? AND a.cancelled_by = 'employer' AND a.cancelled_at >= datetime('now', ?)`,
      )
        .bind(id, `-${REPEAT_CANCEL_WINDOW_DAYS} days`)
        .first<{ n: number }>();

      if ((repeats?.n ?? 0) >= REPEAT_CANCEL_THRESHOLD) {
        if (lines.length) lines.push('');
        lines.push(`⚠️ ${input.actorName} — ${repeats!.n}-я отмена за ${REPEAT_CANCEL_WINDOW_DAYS} дней (${column})`);
      }
    }

    if (lines.length) await notifyAdmin(env, lines.join('\n'));
  } catch (err) {
    console.error('incident report failed', err);
  }
}

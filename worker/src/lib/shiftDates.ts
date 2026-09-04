import type { Env } from '../types';

/** Дни разовой вакансии. Одна вакансия может стоять на нескольких днях —
 *  и на подряд идущих (13–15), и на разрозненных (13-е и 27-е). Это по-
 *  прежнему одна вакансия и один человек на все её дни: набор дней
 *  описывает, когда этот человек нужен, а не сколько людей нужно.
 *
 *  Границы живут в date/end_date, как и до миграции 0034 — на них
 *  завязаны лента, сортировка, закрытие смены и выгрузки. Столбец `dates`
 *  только уточняет, какие дни внутри границ реально нужны. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Больше месяца одной вакансией — это уже не разовая смена, а постоянная
 *  работа, для которой есть отдельный тип. */
export const MAX_SHIFT_DAYS = 31;

/** Убирает мусор, дубли и порядок: наружу всегда выходит возрастающий
 *  список валидных дат без повторов. */
export function normalizeDates(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const clean = input.filter((d): d is string => typeof d === 'string' && ISO_DATE.test(d));
  return [...new Set(clean)].sort().slice(0, MAX_SHIFT_DAYS);
}

/** Идут ли дни подряд без пропусков. Такой набор полностью описывается
 *  парой date/end_date, поэтому список для него не хранится: незачем
 *  держать в базе то, что и так выводится из двух колонок. */
export function isConsecutive(dates: string[]): boolean {
  if (dates.length < 2) return true;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(`${dates[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${dates[i]}T00:00:00Z`).getTime();
    if (cur - prev !== 86400000) return false;
  }
  return true;
}

/** Что записать в столбец `dates`: JSON-список — только когда дни идут с
 *  пропусками, иначе пустая строка (= «подряд от date до end_date»). */
export function datesColumnValue(dates: string[]): string {
  return dates.length > 1 && !isConsecutive(dates) ? JSON.stringify(dates) : '';
}

/** Развернуть строку смены в реальный список дней. Пустой столбец — это
 *  старое поведение: все дни от date до end_date включительно. */
export function expandDates(date: string, endDate: string | null | undefined, datesJson: string | null | undefined): string[] {
  if (datesJson) {
    try {
      const parsed = normalizeDates(JSON.parse(datesJson));
      if (parsed.length > 0) return parsed;
    } catch {
      // Битый JSON в столбце — не повод отдавать пустой календарь: ниже
      // отработает тот же отрезок, что и до миграции.
    }
  }
  if (!endDate || endDate <= date) return [date];

  const out: string[] = [];
  for (let t = new Date(`${date}T00:00:00Z`).getTime(), end = new Date(`${endDate}T00:00:00Z`).getTime(); t <= end; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
    if (out.length >= MAX_SHIFT_DAYS) break;
  }
  return out;
}

/** Применена ли миграция 0034. Тот же probe-first подход, что и везде:
 *  миграции накатываются руками, и запрос к несуществующему столбцу
 *  превращается в голый internal_error 500. Пока столбца нет, вакансия
 *  публикуется отрезком date–end_date, как и раньше. */
let confirmed = false;

export async function datesColumnExists(env: Env): Promise<boolean> {
  if (confirmed) return true;
  try {
    const { results } = await env.DB.prepare('PRAGMA table_info(shifts)').all<{ name: string }>();
    confirmed = results.some((r) => r.name === 'dates');
    return confirmed;
  } catch {
    return false;
  }
}

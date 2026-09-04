const rub = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

export function formatMoney(value: number) {
  return `${rub.format(value)} ₽`;
}

export function formatMoneySigned(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${rub.format(value)} ₽`;
}

export function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} м`;
  return `${km.toFixed(1)} км`;
}

const WEEKDAYS_SHORT = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
const WEEKDAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export function weekdayShort(date: Date) {
  return WEEKDAYS_SHORT[date.getDay()];
}

export function weekdayFull(date: Date) {
  return WEEKDAYS_FULL[date.getDay()];
}

export function formatDayMonth(date: Date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today" as a YYYY-MM-DD string in the device's own local time zone —
 *  unlike `toISOString().slice(0, 10)` (always UTC), this matches what a
 *  shift's `date` field actually means: the calendar day someone picked in
 *  their own timezone. Comparing against the UTC version made a shift that
 *  had already ended hours ago still read as "not over yet" for a few
 *  hours around local midnight. */
export function localDateStr(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function relativeDay(date: Date, now = new Date()) {
  if (isSameDay(date, now)) return 'Сегодня';
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameDay(date, tomorrow)) return 'Завтра';
  return `${formatDayMonth(date)}`;
}

/** How many calendar days a shift spans, inclusive — 1 for a single-day
 *  shift (the common case: no endDate, or endDate === date). */
export function shiftDaysCount(date: string, endDate?: string): number {
  if (!endDate || endDate === date) return 1;
  const ms = new Date(endDate).getTime() - new Date(date).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

/** Реальные дни смены. Вакансия может стоять на разрозненных днях («13-е
 *  и 27-е»), которые парой date/endDate не описать, — тогда сервер
 *  присылает их списком. Для однодневной смены и для старого API
 *  (до миграции 0034) это по-прежнему отрезок или один день, поэтому
 *  читать `dates` напрямую нигде не нужно: всё идёт сюда. */
export function shiftDays(shift: { date: string; endDate?: string; dates?: string[] }): string[] {
  if (shift.dates && shift.dates.length > 0) return shift.dates;
  const count = shiftDaysCount(shift.date, shift.endDate);
  if (count === 1) return [shift.date];
  const start = new Date(`${shift.date}T00:00:00Z`).getTime();
  return Array.from({ length: count }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10));
}

/** Идут ли дни подряд без пропусков — от этого зависит, показывать их
 *  отрезком («10–12 авг») или перечислением («13, 27 сент»). */
export function daysAreConsecutive(days: string[]): boolean {
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(`${days[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${days[i]}T00:00:00Z`).getTime();
    if (cur - prev !== 86400000) return false;
  }
  return true;
}

/** A multi-day vacancy shows as a range ("10–12 авг"); a single-day one is
 *  just the one date, same as `formatDayMonth` always did. */
export function formatDateRange(date: string, endDate?: string): string {
  if (!endDate || endDate === date) return formatDayMonth(new Date(date));
  return `${formatDayMonth(new Date(date))} – ${formatDayMonth(new Date(endDate))}`;
}

/** Как назвать набор дней. Подряд — отрезком, с пропусками —
 *  перечислением: «13, 27 сент» вместо «13 – 27 сент», которое обещало бы
 *  две недели работы вместо двух выходов. Длинный список подрезаем — в
 *  строку карточки он всё равно не влезет. */
export function formatDays(days: string[], maxListed = 4): string {
  if (days.length === 0) return '';
  if (days.length === 1) return formatDayMonth(new Date(days[0]));
  if (daysAreConsecutive(days)) return `${formatDayMonth(new Date(days[0]))} – ${formatDayMonth(new Date(days[days.length - 1]))}`;

  const shown = days.slice(0, maxListed);
  const sameMonth = shown.every((d) => new Date(d).getMonth() === new Date(shown[0]).getMonth());
  // В пределах одного месяца название месяца повторять незачем: «13, 27 сент».
  const head = sameMonth
    ? `${shown.map((d) => new Date(d).getDate()).join(', ')} ${MONTHS[new Date(shown[0]).getMonth()].slice(0, 3)}`
    : shown.map((d) => formatDayMonth(new Date(d))).join(', ');
  return days.length > maxListed ? `${head} и ещё ${days.length - maxListed}` : head;
}

/** Same as `relativeDay`, but a multi-day shift keeps "Сегодня"/"Завтра"
 *  for its first day and appends where it ends — "Сегодня – 12 авг"
 *  instead of losing that context to a bare date range. */
export function relativeDayRange(date: string, endDate: string | undefined, now = new Date()) {
  const startLabel = relativeDay(new Date(date), now);
  if (!endDate || endDate === date) return startLabel;
  return `${startLabel} – ${formatDayMonth(new Date(endDate))}`;
}

/** Дни смены строкой — единственное, что стоит показывать в карточке.
 *  Берёт набор целиком, поэтому вакансия с пропусками не притворяется
 *  двухнедельной («13, 27 сент», а не «13 – 27 сент»). */
export function formatShiftDays(shift: { date: string; endDate?: string; dates?: string[] }): string {
  return formatDays(shiftDays(shift));
}

/** То же самое, но с «Сегодня»/«Завтра» для однодневной смены — как
 *  `relativeDayRange` до появления разрозненных дней. */
export function relativeShiftDays(shift: { date: string; endDate?: string; dates?: string[] }, now = new Date()): string {
  const days = shiftDays(shift);
  if (days.length === 1) return relativeDay(new Date(days[0]), now);
  if (daysAreConsecutive(days)) return relativeDayRange(days[0], days[days.length - 1], now);
  return formatDays(days);
}

export function timeRange(startHour: number, startMin: number, endHour: number, endMin: number) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(startHour)}:${pad(startMin)}–${pad(endHour)}:${pad(endMin)}`;
}

export function timeAgo(minutes: number) {
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  return `${days} д`;
}

/** Minutes elapsed since a server timestamp. D1's `datetime('now')` returns
 *  `"YYYY-MM-DD HH:MM:SS"` (UTC, no timezone marker) — normalize that to a
 *  properly-parseable ISO string first. */
export function minutesSince(timestamp: string): number {
  const iso = timestamp.includes('T') ? timestamp : `${timestamp.replace(' ', 'T')}Z`;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

/** Like `timeAgo`, but from a server timestamp instead of a precomputed offset. */
export function timeAgoSince(timestamp: string) {
  return timeAgo(minutesSince(timestamp));
}

/** A rating of 0 means "no reviews yet", not "rated zero" — everyone
 *  starts there now instead of at a fake 5.0, so it has to read as an
 *  absence rather than a bad score everywhere it's shown. */
export function formatRating(rating: number): string {
  return rating > 0 ? `★ ${rating.toFixed(1)}` : 'Без оценок';
}

export function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/** Genitive plural for "N смена/смены/смен" — shared by anywhere a
 *  multi-day vacancy needs to say how many days it covers. */
export function pluralizeShifts(n: number): string {
  return pluralize(n, 'смена', 'смены', 'смен');
}

/** Work experience is stored as a single total-months count so people can
 *  enter "8 месяцев" without rounding up to a year — this renders it back
 *  as "2 года 3 месяца" / "6 месяцев" / "1 год" for display. */
export function formatExperience(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${pluralize(years, 'год', 'года', 'лет')}`);
  if (months > 0 || parts.length === 0) parts.push(`${months} ${pluralize(months, 'месяц', 'месяца', 'месяцев')}`);
  return parts.join(' ');
}

/** Age from an ISO birthdate — profiles only ever show the computed age,
 *  never the date of birth itself. */
export function ageFrom(birthdate?: string | null): number | undefined {
  if (!birthdate) return undefined;
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

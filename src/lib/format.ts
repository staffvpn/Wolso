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

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
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

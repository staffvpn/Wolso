const rub = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

export function formatMoney(value: number) {
  return `${rub.format(value)} ₽`;
}

export function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')} млн`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')} тыс`;
  return String(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const MONTHS_NOM = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

export function formatDayMonth(date: Date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** A multi-day vacancy ("нужен человек на 3 дня") is one posting with a
 *  start and end date, not several separate ones — shows as a range when
 *  it spans more than a day, same single date as before otherwise. */
export function formatDateRange(date: string, endDate?: string): string {
  if (!endDate || endDate === date) return formatDayMonth(new Date(date));
  return `${formatDayMonth(new Date(date))} – ${formatDayMonth(new Date(endDate))}`;
}

export function formatMonthYear(date: Date) {
  return `${MONTHS_NOM[date.getMonth()]} ${date.getFullYear()}`;
}

/** Minutes elapsed since a server timestamp. D1's `datetime('now')` returns
 *  `"YYYY-MM-DD HH:MM:SS"` (UTC, no timezone marker) — normalize that to a
 *  properly-parseable ISO string first. */
export function minutesSince(timestamp: string): number {
  const iso = timestamp.includes('T') ? timestamp : `${timestamp.replace(' ', 'T')}Z`;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

/** A username gives a universal https://t.me link that opens fine from any
 *  browser or client. Without one there is no working link at all —
 *  Telegram doesn't let you open an arbitrary person's chat/profile from
 *  outside the app by numeric id alone (the old `tg://user?id=` fallback
 *  looked like a link but silently did nothing for anyone not already in
 *  the opener's local Telegram cache/contacts). Return null so callers can
 *  show the id as plain, copyable text instead of a broken link. */
export function telegramLink(_telegramId: number, username?: string | null): string | null {
  return username ? `https://t.me/${username}` : null;
}

export function telegramLabel(telegramId: number, username?: string | null): string {
  return username ? `@${username}` : `Telegram ID ${telegramId}`;
}

export function timeAgo(minutes: number) {
  if (minutes < 1) return 'сейчас';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн назад`;
  return formatDayMonth(new Date(Date.now() - minutes * 60000));
}

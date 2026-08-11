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

export function formatMonthYear(date: Date) {
  return `${MONTHS_NOM[date.getMonth()]} ${date.getFullYear()}`;
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

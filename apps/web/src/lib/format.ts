const PALETTE = [
  '#8b7bb8',
  '#d08a66',
  '#e0b15c',
  '#5b8db8',
  '#6fa88a',
  '#b58bb8',
] as const;

const AVATARS = [
  { bg: '#efeaf8', fg: '#6f5fa0' },
  { bg: '#f8ebe5', fg: '#a2543a' },
  { bg: '#fbf0dc', fg: '#9a7320' },
  { bg: '#e6eff7', fg: '#3f6e96' },
  { bg: '#e9f3ee', fg: '#3f7a5f' },
] as const;

export function hashIndex(value: string, size: number) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % size;
}

export function chartColor(value: string) {
  return PALETTE[hashIndex(value, PALETTE.length)];
}

export function avatarColor(value: string) {
  return AVATARS[hashIndex(value, AVATARS.length)];
}

export function formatMoney(
  minor: number,
  currency: string,
  options: { sign?: boolean } = {},
) {
  const value = minor / 100;
  const body = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  const prefix = value < 0 ? '−' : options.sign && value > 0 ? '+' : '';
  return `${prefix}${body}`;
}

export function formatMoneyShort(minor: number, currency: string) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function dateFromMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1);
}

function dateFromDay(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatMonth(month: string) {
  const label = new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
  }).format(dateFromMonth(month));

  return capitalize(label.replace(' de ', ' '));
}

export function formatMonthShort(month: string) {
  return capitalize(
    new Intl.DateTimeFormat('es-ES', { month: 'short' })
      .format(dateFromMonth(month))
      .replace('.', ''),
  );
}

export function monthName(month: string) {
  return new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(
    dateFromMonth(month),
  );
}

export function formatDay(date: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
  })
    .format(dateFromDay(date))
    .replace('.', '');
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(iso))
    .replace('.', '');
}

export function formatPercent(ratio: number, digits = 1) {
  return `${new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(ratio * 100)}%`;
}

export function formatSignedPercent(ratio: number, digits = 1) {
  const value = ratio * 100;
  const number = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Math.abs(value));

  const sign = value < 0 ? '−' : '+';
  return `${sign}${number}%`;
}

export function relativeTime(iso: string) {
  const difference = Date.now() - new Date(iso).getTime();

  if (Number.isNaN(difference)) return 'hace un momento';

  const minutes = Math.floor(difference / 60_000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export function initial(value: string) {
  return value.trim().charAt(0).toUpperCase() || '·';
}

export function niceMax(value: number) {
  if (value <= 0) return 100;

  const power = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 7.5, 10];

  return (
    steps.map(step => step * power).find(candidate => candidate >= value) ??
    power * 10
  );
}

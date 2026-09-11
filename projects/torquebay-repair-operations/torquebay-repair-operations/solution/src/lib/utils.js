import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function money(cents) {
  const value = Number(cents || 0) / 100;
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function fmtDay(value) {
  if (!value) return '—';
  return String(value).slice(0, 10);
}

export function labelize(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function localWindow(hoursFromNow, durationHours) {
  const start = new Date(Date.now() + hoursFromNow * 36e5);
  const end = new Date(start.getTime() + durationHours * 36e5);
  const toLocal = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return { start: toLocal(start), end: toLocal(end) };
}

export function toIso(localValue) {
  if (!localValue) return '';
  const d = new Date(localValue);
  return d.toISOString();
}

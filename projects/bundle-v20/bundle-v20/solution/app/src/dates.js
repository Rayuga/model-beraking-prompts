import { DateTime } from 'luxon';
import { z } from 'zod';

export const calendarDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export function isoDate(value) {
  const parsed = calendarDay.safeParse(String(value || '').trim());
  if (!parsed.success) return null;
  const dt = DateTime.fromISO(parsed.data, { zone: 'utc' });
  if (!dt.isValid || dt.toISODate() !== parsed.data) return null;
  return parsed.data;
}

export function inclusiveDays(start, end) {
  const a = DateTime.fromISO(start, { zone: 'utc' });
  const b = DateTime.fromISO(end, { zone: 'utc' });
  if (!a.isValid || !b.isValid || b < a) return null;
  return Math.trunc(b.diff(a, 'days').days) + 1;
}

export function todayUtc() {
  return DateTime.utc().toISODate();
}

export function asDate(value) {
  if (value instanceof Date) {
    return DateTime.fromJSDate(value, { zone: 'utc' }).toISODate();
  }
  if (value == null) return value;
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

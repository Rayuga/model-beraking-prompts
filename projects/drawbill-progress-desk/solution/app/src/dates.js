import { DateTime } from 'luxon';

export function isoDate(value) {
  const dt = DateTime.fromISO(String(value || ''), { zone: 'utc' });
  if (!dt.isValid || !/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  return dt.toISODate();
}

export function datesInRange(start, end) {
  const out = [];
  let d = start;
  while (d <= end) {
    out.push(d);
    d = DateTime.fromISO(d, { zone: 'utc' }).plus({ days: 1 }).toISODate();
  }
  return out;
}

export function inclusiveOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

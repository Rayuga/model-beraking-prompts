import ical from 'ical-generator';
import { DateTime } from 'luxon';

export function reservationIcs(reservation, unit, customer) {
  const cal = ical({ name: 'GearVault Rental' });
  const start = DateTime.fromISO(reservation.start_date, { zone: 'utc' });
  const end = DateTime.fromISO(reservation.end_date, { zone: 'utc' }).plus({ days: 1 });
  cal.createEvent({
    start: start.toJSDate(),
    end: end.toJSDate(),
    allDay: true,
    summary: `${unit?.asset_tag || 'Gear'} · ${unit?.category || 'Rental'}`,
    description: `GearVault reservation for ${customer?.full_name || 'customer'} ${reservation.start_date} through ${reservation.end_date}`
  });
  return cal.toString();
}

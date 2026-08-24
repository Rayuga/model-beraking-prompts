/**
 * Shop pricing policy.
 *
 * The desks own tax, hull cover and the weekend line. Everything in this file
 * is the shop's own arithmetic, derived from the brief:
 *
 *  - The week rate starts on the seventh day of a single paper. From there a
 *    tenth comes off the kit line, and it comes off the WHOLE slip rather
 *    than only the days past the sixth. Six days is still full price.
 *  - The tenth touches the kit line only — never a deposit, never the
 *    bureau's hull rider.
 *  - The county taxes the kit line as invoiced (week rate already applied)
 *    plus the weekend line. It does not tax the deposit and it does not tax
 *    the hull rider.
 *  - Nothing goes out on one paper for more than a fortnight.
 */

export const WEEK_RATE_MIN_DAYS = 7;
export const WEEK_RATE_NUMERATOR = 1;
export const WEEK_RATE_DENOMINATOR = 10;
export const MAX_RENTAL_DAYS = 14;

/** Full-price kit line before the week rate, in pennies. */
export function grossRentalCents(dailyRateCents, days) {
  return Math.round(dailyRateCents) * days;
}

/** The tenth that comes off the kit line once the paper reaches a week. */
export function weekRateReliefCents(grossCents, days) {
  if (days < WEEK_RATE_MIN_DAYS) return 0;
  return Math.round((grossCents * WEEK_RATE_NUMERATOR) / WEEK_RATE_DENOMINATOR);
}

/** The kit line the customer is actually invoiced for. */
export function billableRentalCents(dailyRateCents, days) {
  const gross = grossRentalCents(dailyRateCents, days);
  return gross - weekRateReliefCents(gross, days);
}

/**
 * The figure the county tax desk is asked about: the invoiced kit line plus
 * the weekend line. Deposit and hull are deliberately absent.
 */
export function taxableBaseCents(billableRental, surchargeCents) {
  return billableRental + (surchargeCents || 0);
}

export function exceedsMaxSpan(days) {
  return days > MAX_RENTAL_DAYS;
}

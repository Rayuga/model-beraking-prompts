import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export function halfUpCents(rentalCents, bps) {
  return new Decimal(rentalCents).times(bps).div(10000).toDecimalPlaces(0).toNumber();
}

export function dollars(cents) {
  return Number(cents || 0) / 100;
}

export function usdToCents(usd) {
  return Math.round(Number(usd) * 100);
}

export function centsToUsdLabel(cents) {
  const n = Number(cents) || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n) / 100;
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function dollars(cents) {
  return centsToUsdLabel(cents);
}

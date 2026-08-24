import crypto from 'crypto';
import { taxableBaseCents } from './pricing.js';

const base = () => String(process.env.VENDOR_BASE_URL || 'http://localhost:3101').replace(/\/$/, '');
const token = () => process.env.VENDOR_TOKEN || 'gv-vendor-dev';
const noticeKey = () => process.env.NOTICE_API_KEY || 'gv-notice-dev';
const hmacSecret = () => process.env.INSURANCE_HMAC_SECRET || 'gv-hull-hmac-dev';

export async function vendorJson(method, path, { query, body, notice } = {}) {
  const url = new URL(path, `${base()}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null) url.searchParams.set(key, String(value));
    }
  }
  const headers = { 'Content-Type': 'application/json' };
  if (notice) headers['X-Notice-Key'] = noticeKey();
  else headers.Authorization = `Bearer ${token()}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'A shop vendor desk refused the request');
    error.status = response.status >= 400 ? response.status : 503;
    throw error;
  }
  return data;
}

export function insuranceBindSignature(sessionId, premiumCents) {
  return crypto
    .createHmac('sha256', hmacSecret())
    .update(`${sessionId}:${premiumCents}`)
    .digest('hex');
}

/**
 * Ask the live desks about one span.
 *
 * `billableRentalCents` is the kit line as the customer will be invoiced —
 * the shop's week rate has already come off it. The county is asked about
 * that line plus the weekend money and nothing else: the deposit is the
 * customer's own money coming back, and the bureau's hull rider is insurance
 * taxed somewhere else.
 */
export async function composeVendorQuote(unit, location, billableRentalCents, startDate, endDate, days) {
  if (/tent|generator|rain fly/i.test(unit.category || '')) {
    const weather = await vendorJson('GET', '/weather/forecast', {
      query: { start: startDate, end: endDate, shop: location?.slug }
    });
    const condition = String(weather.condition || '').toUpperCase();
    if (weather.outdoor_ok === false || weather.canvas_hold === true || condition === 'SEVERE') {
      const error = new Error('Outdoor kits stay in when the weather desk calls severe conditions');
      error.status = 409;
      throw error;
    }
  }
  const blackout = await vendorJson('GET', '/blackout/calendar', {
    query: { start: startDate, end: endDate, shop: location?.slug }
  });
  const closed = String(blackout.condition || '').toUpperCase();
  if (blackout.shop_open === false || blackout.van_idle === true || closed === 'CLOSED') {
    const error = new Error('The shops are dark those days');
    error.status = 409;
    throw error;
  }

  // The weekend desk counts each Saturday and each Sunday on the paper, so it
  // has to see the whole range, and its answer is part of what the county
  // taxes — ask it before the tax desk.
  const weekend = await vendorJson('GET', '/surcharge/weekend', {
    query: { start: startDate, end: endDate, shop: location?.slug }
  });
  const surchargeCents = Number(weekend.surcharge_cents) || 0;

  const tax = await vendorJson('GET', '/tax/quote', {
    query: {
      shop: location?.slug,
      locationId: location?.id,
      rental_cents: taxableBaseCents(billableRentalCents, surchargeCents)
    }
  });

  // The bureau bills hull cover by the day, so it needs the day count.
  const hull = await vendorJson('POST', '/insurance/hull', {
    body: { category: unit.category, unit_id: unit.id, days }
  });

  return {
    tax_cents: Number(tax.tax_cents) || 0,
    hull_cents: Number(hull.premium_cents) || 0,
    surcharge_cents: surchargeCents
  };
}

export async function postPaidVendors({ reservation, sessionId, quote, options = {} }) {
  await vendorJson('POST', '/notices/receipts', {
    notice: true,
    body: {
      reservation_id: reservation.id,
      customer_id: reservation.customer_id,
      asset_tag: reservation.asset_tag,
      total_cents: quote.total_cents,
      tax_cents: quote.tax_cents,
      hull_cents: quote.hull_cents,
      surcharge_cents: quote.surcharge_cents,
      deposit_cents: quote.deposit_cents,
      rental_cents: quote.rental_cents
    }
  });
  await vendorJson('POST', '/sms/receipts', {
    notice: true,
    body: {
      reservation_id: reservation.id,
      customer_id: reservation.customer_id,
      asset_tag: reservation.asset_tag,
      total_cents: quote.total_cents,
      tax_cents: quote.tax_cents,
      hull_cents: quote.hull_cents,
      surcharge_cents: quote.surcharge_cents,
      deposit_cents: quote.deposit_cents,
      rental_cents: quote.rental_cents
    }
  });
  await vendorJson('POST', '/email/receipts', {
    notice: true,
    body: {
      reservation_id: reservation.id,
      customer_id: reservation.customer_id,
      asset_tag: reservation.asset_tag,
      total_cents: quote.total_cents,
      tax_cents: quote.tax_cents,
      hull_cents: quote.hull_cents,
      surcharge_cents: quote.surcharge_cents,
      deposit_cents: quote.deposit_cents,
      rental_cents: quote.rental_cents
    }
  });
  await vendorJson('POST', '/calendar/holds', {
    body: {
      reservation_id: reservation.id,
      unit_id: reservation.unit_id,
      asset_tag: reservation.asset_tag,
      start_date: reservation.start_date,
      end_date: reservation.end_date
    }
  });
  if (options.member === true) {
    await vendorJson('POST', '/loyalty/punches', {
      body: {
        reservation_id: reservation.id,
        customer_id: reservation.customer_id
      }
    });
  }
  if (quote.hull_cents > 0) {
    const signature = insuranceBindSignature(sessionId, quote.hull_cents);
    const url = new URL('/insurance/bind', `${base()}/`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token()}`,
        'X-Insurance-Signature': signature
      },
      body: JSON.stringify({
        sessionId,
        premium_cents: quote.hull_cents,
        customer_id: reservation.customer_id,
        unit_id: reservation.unit_id
      })
    });
    if (!response.ok) {
      const error = new Error('Insurance bureau rejected the hull bind');
      error.status = 503;
      throw error;
    }
  }
}

'use strict';
// Signalworks settlement engine. Pure functions, INTEGER PENCE and INTEGER
// MINUTES throughout. Nothing here reads the wall clock: every date-driven
// result is derived from two STORED timestamps.

const NIGHT_FROM_HOUR = 22;                 // 22:00
const NIGHT_TO_HOUR = 6;                    // 06:00
const NIGHT_PREMIUM_PENCE_PER_HOUR = 180;
const OVERTIME_THRESHOLD_MINUTES = 8 * 60;
const OVERTIME_NUM = 3, OVERTIME_DEN = 2;   // 1.5x
const CALLOUT_MINIMUM_MINUTES = 4 * 60;

// Half-up to the penny on a non-negative rational n/d.
function halfUpDiv(n, d) {
  if (n < 0) throw new Error('halfUpDiv expects a non-negative numerator');
  return Math.floor((n * 2 + d) / (2 * d));
}

const ms = (iso) => Date.parse(iso);
const minutesBetween = (a, b) => Math.round((ms(b) - ms(a)) / 60000);

// ---------------------------------------------------------------- delay
// Penalty bands are MARGINAL, like tax bands: each band's rate applies only to
// the minutes that fall inside it, never to the whole total.
function bandedPenalty(delayMinutes, bands) {
  const ordered = [...bands].sort((a, b) => a.sequence - b.sequence);
  let remaining = delayMinutes, floor = 0, total = 0;
  for (const b of ordered) {
    if (remaining <= 0) break;
    const ceiling = b.up_to_minutes === null ? Infinity : b.up_to_minutes;
    const width = ceiling - floor;
    const take = Math.min(remaining, width);
    total += take * b.pence_per_minute;
    remaining -= take;
    floor = ceiling;
  }
  return total;
}

// An incident whose whole span lies inside a declared major-disruption window
// is charged FLAT at the middle band's rate - the banding does not apply.
function incidentInsideWindow(incident, windows) {
  if (!incident.cleared_at) return null;
  return windows.find((w) => ms(incident.raised_at) >= ms(w.starts_at)
                          && ms(incident.cleared_at) <= ms(w.ends_at)) || null;
}

function flatWindowRate(bands) {
  const ordered = [...bands].sort((a, b) => a.sequence - b.sequence);
  return ordered[1].pence_per_minute;          // the middle band
}

// Gross penalty for one incident, before any credit.
function grossPenalty(incident, delayMinutes, bands, windows) {
  const w = incidentInsideWindow(incident, windows);
  if (w) return { pence: delayMinutes * flatWindowRate(bands), window_id: w.id, banded: false };
  return { pence: bandedPenalty(delayMinutes, bands), window_id: null, banded: true };
}

// A mutual-aid credit offsets the PENALTY, never the delay minutes, and can
// never take the settlement below zero. A credit against a zero penalty has
// nothing to offset, so it is NOT consumed.
function applyCredit(grossPence, credit) {
  if (!credit || credit.state !== 'AVAILABLE' || grossPence <= 0) {
    return { applied_pence: 0, net_pence: grossPence, credit_consumed: false };
  }
  const applied = Math.min(credit.amount_pence, grossPence);
  return { applied_pence: applied, net_pence: grossPence - applied, credit_consumed: true };
}

function settleIncident(incident, delayMinutes, bands, windows, credit) {
  const gross = grossPenalty(incident, delayMinutes, bands, windows);
  const c = applyCredit(gross.pence, credit);
  return {
    delay_minutes: delayMinutes,
    gross_pence: gross.pence,
    banded: gross.banded,
    window_id: gross.window_id,
    credit_applied_pence: c.applied_pence,
    credit_consumed: c.credit_consumed,
    net_pence: c.net_pence,
  };
}

// ---------------------------------------------------------------- labour
// Callouts by ONE technician that overlap or merely touch are one callout, so
// the four-hour minimum applies once to the merged span, not once each.
function mergeCallouts(callouts) {
  const byTech = new Map();
  for (const c of callouts) {
    if (!byTech.has(c.technician_id)) byTech.set(c.technician_id, []);
    byTech.get(c.technician_id).push(c);
  }
  const merged = [];
  for (const [tech, list] of byTech) {
    list.sort((a, b) => ms(a.starts_at) - ms(b.starts_at));
    let cur = null;
    for (const c of list) {
      if (cur && ms(c.starts_at) <= ms(cur.ends_at)) {          // overlap OR touch
        if (ms(c.ends_at) > ms(cur.ends_at)) cur.ends_at = c.ends_at;
        cur.parts.push(c.id);
      } else {
        if (cur) merged.push(cur);
        cur = { technician_id: tech, starts_at: c.starts_at, ends_at: c.ends_at, parts: [c.id] };
      }
    }
    if (cur) merged.push(cur);
  }
  return merged;
}

// Minutes of a span that fall in the night window (22:00-06:00), walked hour by
// hour so a span crossing midnight is counted correctly.
function nightMinutes(startIso, endIso) {
  let total = 0;
  const start = ms(startIso), end = ms(endIso);
  for (let t = start; t < end; t += 60000) {
    const h = new Date(t).getUTCHours();
    if (h >= NIGHT_FROM_HOUR || h < NIGHT_TO_HOUR) total += 1;
  }
  return total;
}

// Pay for one merged callout span.
//   - worked minutes are what was actually on site
//   - billed minutes are those, floored at the callout minimum
//   - overtime is on WORKED minutes beyond eight hours, at 1.5x
//   - the night premium is on WORKED night minutes, never on the padding
function payForSpan(span, baseRatePencePerHour) {
  const worked = minutesBetween(span.starts_at, span.ends_at);
  const billed = Math.max(worked, CALLOUT_MINIMUM_MINUTES);
  const normal = Math.min(billed, OVERTIME_THRESHOLD_MINUTES);
  const overtime = Math.max(billed - OVERTIME_THRESHOLD_MINUTES, 0);
  const night = nightMinutes(span.starts_at, span.ends_at);

  const basePence = halfUpDiv(normal * baseRatePencePerHour, 60);
  const overtimePence = halfUpDiv(overtime * baseRatePencePerHour * OVERTIME_NUM, 60 * OVERTIME_DEN);
  const nightPence = halfUpDiv(night * NIGHT_PREMIUM_PENCE_PER_HOUR, 60);
  return {
    technician_id: span.technician_id, parts: span.parts,
    starts_at: span.starts_at, ends_at: span.ends_at,
    worked_minutes: worked, billed_minutes: billed,
    normal_minutes: normal, overtime_minutes: overtime, night_minutes: night,
    base_pence: basePence, overtime_pence: overtimePence, night_pence: nightPence,
    total_pence: basePence + overtimePence + nightPence,
  };
}

function settleLabour(callouts, techniciansById) {
  return mergeCallouts(callouts).map((span) =>
    payForSpan(span, techniciansById[span.technician_id].base_rate_pence_per_hour));
}

function money(pence) {
  const sign = pence < 0 ? '-' : '';
  const abs = Math.abs(pence);
  return `${sign}£${Math.floor(abs / 100).toLocaleString('en-GB')}.${String(abs % 100).padStart(2, '0')}`;
}

module.exports = {
  NIGHT_FROM_HOUR, NIGHT_TO_HOUR, NIGHT_PREMIUM_PENCE_PER_HOUR,
  OVERTIME_THRESHOLD_MINUTES, CALLOUT_MINIMUM_MINUTES,
  halfUpDiv, minutesBetween, bandedPenalty, incidentInsideWindow, flatWindowRate,
  grossPenalty, applyCredit, settleIncident, mergeCallouts, nightMinutes,
  payForSpan, settleLabour, money,
};

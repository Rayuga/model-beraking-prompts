'use strict';
// hireops rule engine. PURE derivations over STORED rows. Money is INTEGER CENTS;
// vesting/band percentages INTEGER BASIS POINTS (4000 = 40.00%). Rounding is
// half-up, applied ONCE at the stated event: roundHalfUp(x) = floor(x + 0.5).
// Nothing here reads the wall clock. Referral vesting compares a hire's 6-month
// cliff against the ONE stored reference moment; signing/equity clawback compares
// against a rescission's OWN stored effective date. Every window is HALF-OPEN
// [start, end): clock >= cliff means the cliff has passed. Every graded figure is
// computed here alongside the other readings the desk tracks.
const REF = require('./db').reference;
const C = REF.constants;

const ROLES = ['recruiter', 'comp_partner', 'approver', 'finance_controller', 'auditor'];
const ms = (iso) => Date.parse(iso);
function roundHalfUp(x) { return Math.floor(x + 0.5); }

function clock(db) {
  return db.prepare("SELECT * FROM system_clock WHERE id='CLOCK'").get()
      || { id: 'CLOCK', reference_at: '1970-01-01T00:00:00Z', reference_date: '1970-01-01' };
}
const refAt = (db) => clock(db).reference_at;

// Calendar anniversaries always derive from the original anchor, including milliseconds.
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value)) return false;
  const stamp = Date.parse(value);
  if (!Number.isFinite(stamp)) return false;
  const expected = value.length === 10 ? value + 'T00:00:00.000Z' : value.replace(/(?:\.(\d{1,3}))?Z$/, (_, f) => '.' + (f || '').padEnd(3, '0') + 'Z');
  return new Date(stamp).toISOString() === expected;
}
function addMonths(iso, n) {
  const d = new Date(ms(iso));
  const target = new Date(d);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + n);
  const end = new Date(target);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  target.setUTCDate(Math.min(d.getUTCDate(), end.getUTCDate()));
  return target.toISOString();
}
function completedMonths(startIso, atIso) {
  const a = new Date(ms(startIso)), b = new Date(ms(atIso));
  if (!validDate(startIso) || !validDate(atIso)) throw new Error('Invalid calendar date');
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth();
  if (months <= 0) return 0;
  if (ms(atIso) < ms(addMonths(startIso, months))) months--;
  return months;
}
function safeResult(n) {
  const out = Number(n);
  if (!Number.isSafeInteger(out)) { const e = new Error('Derived arithmetic exceeds safe integer range'); e.status = 400; throw e; }
  return out;
}
function halfUpRatio(n, d) { return safeResult((BigInt(n) * 2n + BigInt(d)) / (2n * BigInt(d))); }
function sumSafe(...values) { return safeResult(values.reduce((s, v) => s + BigInt(v), 0n)); }

// ---------------------------------------------------------------- equity value
// Intrinsic value = units x max(0, fair - strike), floored at 0. Deliberately
// NOT units x fair (the gross grant) and NOT units x strike (the strike
// notional): those two are the wrong readings, so nothing here computes them.
// Annualized = intrinsic / the 4-year vesting term.
function equityIntrinsicCents(o) { return safeResult(BigInt(o.equity_units) * BigInt(Math.max(0, o.equity_fair_cents - o.equity_strike_cents))); }
function equityAnnualizedCents(o) { return halfUpRatio(equityIntrinsicCents(o), C.equity_annualization_years); }

// ---------------------------------------------------------------- comp composition
// TWO distinct derived figures on different inclusion rules:
//  committed run-rate  = base + equity_annualized                (EXCLUDES one-time signing & relocation)
//  approval-band basis = base + signing/2 + equity_annualized    (amortizes signing over its 24-mo term; EXCLUDES relocation)
function committedRunRateCents(o) { return sumSafe(o.base_salary_cents, equityAnnualizedCents(o)); }
function bandBasisCents(o) { return sumSafe(o.base_salary_cents, halfUpRatio(o.signing_bonus_cents, 2), equityAnnualizedCents(o)); }

function bandLabel(basis) {
  if (basis < C.band_edges_cents.II_floor) return 'I';
  if (basis < C.band_edges_cents.III_floor) return 'II';   // half-open [II_floor, III_floor)
  return 'III';                                             // half-open [III_floor, inf)
}
function requiredTier(basis) { return bandLabel(basis) === 'I' ? 1 : bandLabel(basis) === 'II' ? 2 : 3; }

// The full composition view for an offer: the raw components it was priced from
// beside every figure the rules derive, and nothing else.
function composition(o) {
  const intrinsic = equityIntrinsicCents(o);
  const annualized = equityAnnualizedCents(o);
  const runRate = committedRunRateCents(o);
  const basis = bandBasisCents(o);
  return {
    base_salary_cents: o.base_salary_cents, signing_bonus_cents: o.signing_bonus_cents,
    relocation_cents: o.relocation_cents, equity_units: o.equity_units,
    equity_fair_cents: o.equity_fair_cents, equity_strike_cents: o.equity_strike_cents,

    equity_intrinsic_cents: intrinsic,                 // rule: units x max(0, fair - strike)
    equity_annualized_cents: annualized,               // rule: intrinsic / 4

    committed_run_rate_cents: runRate,                 // rule: base + equity_annualized

    band_basis_cents: basis,                           // rule: base + signing/2 + equity_annualized
    band: bandLabel(basis),                            // I / II / III (half-open edges)
    required_tier: requiredTier(basis),
  };
}

// ---------------------------------------------------------------- signing clawback (vest-first)
// Vested fraction at a stored as-of date: 0 before the 12-month cliff; cliff_bp at
// the cliff; then +monthly_bp per completed month, capped at 100% at 24 months.
function signingVestedBp(o, atIso) {
  const m = completedMonths(o.start_date, atIso);
  const v = C.signing_clawback_vesting;
  if (m < v.cliff_months) return 0;
  return Math.min(10000, v.cliff_bp + (m - v.cliff_months) * v.monthly_bp);
}
function signingClawback(o, atIso) {
  const paid = o.signing_bonus_cents;
  const m = completedMonths(o.start_date, atIso);
  const v = C.signing_clawback_vesting;
  const vestedBp = signingVestedBp(o, atIso);
  const vested = halfUpRatio(BigInt(paid) * BigInt(vestedBp), 10000);        // retained
  const clawback = paid - vested;                            // the company reclaims the UNVESTED portion
  return {
    as_of: atIso, completed_months: m, vested_bp: vestedBp,
    signing_paid_cents: paid, signing_vested_cents: vested, clawback_cents: clawback,   // clawback = paid - vested
  };
}

// ---------------------------------------------------------------- equity clawback (cancel unvested)
function equityVestedBp(g, atIso) {
  const m = completedMonths(g.grant_date, atIso);
  const v = C.equity_vesting;
  if (m < v.cliff_months) return 0;
  return Math.min(10000, v.cliff_bp + (m - v.cliff_months) * v.monthly_bp);
}
function equityCancellation(g, atIso) {
  const vestedBp = equityVestedBp(g, atIso);
  const vestedUnits = halfUpRatio(BigInt(g.units) * BigInt(vestedBp), 10000);   // retained
  const cancelledUnits = g.units - vestedUnits;                  // cancel ONLY the unvested slice
  return {
    as_of: atIso, completed_months: completedMonths(g.grant_date, atIso), vested_bp: vestedBp,
    units: g.units, vested_units: vestedUnits, cancelled_units: cancelledUnits,
  };
}

// ---------------------------------------------------------------- referral vesting (vs the stored clock)
function referralVested(ra, clockIso) {
  const cliff = addMonths(ra.referred_hire_start, C.referral_retention_cliff_months);
  const secondVested = ms(clockIso) >= ms(cliff);              // HALF-OPEN: clock >= cliff has passed
  const vested = ra.at_hire_cents + (secondVested ? ra.contingent_cents : 0);
  return {
    retention_cliff_at: cliff, second_half_vested: secondVested,
    total_cents: ra.total_cents, at_hire_cents: ra.at_hire_cents, contingent_cents: ra.contingent_cents,
    vested_cents: vested,
  };
}

// ---------------------------------------------------------------- budget headroom (summed from rows)
function headroom(db, reqId) {
  const req = db.prepare('SELECT * FROM requisitions WHERE id=?').get(reqId);
  if (!req) return null;
  const sum = sumSafe(...db.prepare('SELECT movement_cents FROM commitment_movements WHERE req_id=?').all(reqId).map(r => r.movement_cents));
  return {
    req_id: reqId, budget_cents: req.budget_cents,
    committed_sum_cents: sum,                                   // negative
    headroom_cents: sumSafe(req.budget_cents, sum),                    // budget - committed, summed from rows
  };
}

// ---------------------------------------------------------------- net payroll outflow (summed from rows)
// Net signing-bonus outflow for an offer = SUM of its remittance rows: the signing
// remittance (positive) plus the clawback contra (negative). Summed from rows.
function lineageIds(db, offerId) {
  const ids = [], seen = new Set();
  let row = db.prepare('SELECT id,supersedes_id FROM offers WHERE id=?').get(offerId);
  while (row && !seen.has(row.id)) {
    ids.unshift(row.id); seen.add(row.id);
    row = row.supersedes_id ? db.prepare('SELECT id,supersedes_id FROM offers WHERE id=?').get(row.supersedes_id) : null;
  }
  return ids;
}
function netSigningOutflow(db, offerId) {
  const ids = lineageIds(db, offerId);
  const rows = ids.flatMap(id => db.prepare("SELECT * FROM remittances WHERE offer_id=? AND kind IN ('SIGNING','SIGNING_ADJUSTMENT','CLAWBACK_CONTRA') ORDER BY rowid").all(id));
  const net = sumSafe(...rows.map(r => r.kind === 'CLAWBACK_CONTRA' ? -Math.abs(r.amount_cents) : r.amount_cents));
  return { offer_id: offerId, net_signing_outflow_cents: net, rows };
}

module.exports = {
  ROLES, ms, roundHalfUp, completedMonths, addMonths, validDate, sumSafe, halfUpRatio, lineageIds, clock, refAt,
  equityIntrinsicCents, equityAnnualizedCents,
  committedRunRateCents, bandBasisCents, bandLabel, requiredTier, composition,
  signingVestedBp, signingClawback, equityVestedBp, equityCancellation,
  referralVested, headroom, netSigningOutflow,
};

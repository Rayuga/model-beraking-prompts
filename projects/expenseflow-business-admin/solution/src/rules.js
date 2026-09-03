'use strict';
// ExpenseFlow rule engine. Pure derivations over STORED rows. Money is INTEGER
// CENTS ($12.00 = 1200); allocations/percentages INTEGER BASIS POINTS (3000 =
// 30.00%); FX rates INTEGER TEN-THOUSANDTHS (12500 = 1.2500). Rounding is half-up,
// applied ONCE at each stated event: round_half_up(x) = floor(x + 0.5). Nothing
// here reads the wall clock; every date decision compares two stored timestamps.
// Every window is HALF-OPEN [start, end).
const REF = require('./db').reference;

const ROLES = ['proxy', 'approver', 'finance', 'auditor'];
const HOME = REF.home_currency;
const VAT_BP = REF.vat_inclusive_bp;

const ms = (iso) => Date.parse(iso);
function roundHalfUp(x) { return Math.floor(x + 0.5); }
// Integer-exact half-up division n/d for positive n,d: floor((n + d/2)/d).
function rhuDiv(n, d) { return Math.floor((n + Math.floor(d / 2)) / d); }

function clock(db) {
  return db.prepare("SELECT * FROM system_clock WHERE id='CLOCK'").get()
      || { id: 'CLOCK', reference_at: '1970-01-01T00:00:00Z', reference_date: '1970-01-01' };
}
const refAt = (db) => clock(db).reference_at;

// ---------------------------------------------------------------- FX conversion
// A foreign line converts at the STORED rate for its OWN transaction date: the
// most-recent stored rate as-of that date (exact match, else the prior day). Half
// -open day windows. home_cents = round_half_up(foreign_cents x rate / 10000).
function fxRateFor(db, txnDate, pair) {
  pair = pair || 'EUR/USD';
  const exactOrPrior = db.prepare(
    'SELECT * FROM fx_rates WHERE pair=? AND as_of_date<=? ORDER BY as_of_date DESC, id DESC LIMIT 1'
  ).get(pair, txnDate);
  if (exactOrPrior) return exactOrPrior;
  // Defensive fallback: a date before the first stored rate uses the earliest one.
  return db.prepare('SELECT * FROM fx_rates WHERE pair=? ORDER BY as_of_date ASC, id ASC LIMIT 1').get(pair) || null;
}
function convertForeign(cents, rateTenThousandths) {
  return rhuDiv(cents * rateTenThousandths, 10000);
}

// ---------------------------------------------------------------- per-diem
// Meals per-diem entitlement = block rate x the count of half-open six-hour blocks
// [00,06)/[06,12)/[12,18)/[18,24) that the stored trip window [depart, return)
// overlaps. Counted inside the stored interval only; no wall clock. Decoys: a full
// per-diem for each calendar day the trip touches, and a per-diem for each day the
// trip is rounded up to.
const DAY_MS = 86400000;
function perDiem(departAt, returnAt) {
  const dep = ms(departAt), ret = ms(returnAt);
  const blockMs = REF.per_diem_block_hours * 3600000;
  let blocks = 0, blocksInclusive = 0;
  let s = Math.floor(dep / blockMs) * blockMs;                 // grid aligned to 00/06/12/18 UTC
  for (; s < ret; s += blockMs) {
    const e = s + blockMs;
    if (Math.max(s, dep) < Math.min(e, ret)) blocks += 1;      // strict half-open overlap
    if (Math.max(s, dep) <= Math.min(e, ret)) blocksInclusive += 1;
  }
  // calendar days the interval touches (half-open): distinct UTC dates overlapped
  let calDays = 0;
  let d = Math.floor(dep / DAY_MS) * DAY_MS;
  for (; d < ret; d += DAY_MS) if (Math.max(d, dep) < Math.min(d + DAY_MS, ret)) calDays += 1;
  const ceilDays = Math.max(1, Math.ceil((ret - dep) / DAY_MS));
  const entitlement = blocks * REF.per_diem_block_cents;
  return {
    blocks, entitlement_cents: entitlement,
    decoy_calendar_days: calDays, decoy_calendar_days_cents: calDays * REF.per_diem_full_day_cents,
    decoy_ceil_days: ceilDays, decoy_ceil_days_cents: ceilDays * REF.per_diem_full_day_cents,
    decoy_inclusive_blocks: blocksInclusive, decoy_inclusive_blocks_cents: blocksInclusive * REF.per_diem_block_cents,
  };
}

// ---------------------------------------------------------------- one line
// The FX -> cap spine for a single line, every intermediate and decoy surfaced.
// Order is load-bearing: convert first, THEN the policy cap bites the CONVERTED
// (home-currency) base, THEN the reimbursable feeds the VAT reclaim.
function adjudicateLine(db, report, line) {
  const cat = line.category;
  const out = {
    line_id: line.id, line_no: line.line_no, category: cat, currency: line.currency,
    txn_date: line.txn_date, nights: line.nights, miles: line.miles,
    claimed_cents: line.amount_cents == null ? null : line.amount_cents,
    rate_ten_thousandths: null, cap_kind: null, cap_cents: null,
    vat_eligible: REF.eligible_vat_categories.includes(cat) ? 1 : 0,
  };

  // ---- convert to home currency ----
  if (cat === 'mileage') {
    out.converted_cents = (line.miles || 0) * REF.mileage_rate_cents_per_mile;
    out.claimed_cents = out.converted_cents;
    out.decoy_mileage_irs_cents = (line.miles || 0) * 67;      // recalled 2024 IRS $0.67
    out.decoy_mileage_alt_cents = (line.miles || 0) * 60;      // a rounder $0.60
  } else if (line.currency === HOME) {
    out.converted_cents = line.amount_cents;
  } else {
    const r = fxRateFor(db, line.txn_date, `${line.currency}/${HOME}`);
    const rate = r ? r.rate_ten_thousandths : 10000;
    out.rate_ten_thousandths = rate;
    out.converted_cents = convertForeign(line.amount_cents, rate);
    // decoy conversions: the same amount at every OTHER stored daily rate
    out.decoy_conversions = db.prepare('SELECT as_of_date,rate_ten_thousandths FROM fx_rates WHERE pair=? ORDER BY as_of_date')
      .all(`${line.currency}/${HOME}`)
      .filter((x) => x.rate_ten_thousandths !== rate)
      .map((x) => ({ as_of_date: x.as_of_date, rate: x.rate_ten_thousandths, converted_cents: convertForeign(line.amount_cents, x.rate_ten_thousandths) }));
  }

  // ---- the policy cap bites the CONVERTED base ----
  const conv = out.converted_cents;
  if (cat === 'mileage' || cat === 'ground') {
    out.cap_kind = null; out.cap_cents = null;
    out.reimbursable_cents = conv; out.disallowed_cents = 0;
  } else if (cat === 'lodging') {
    out.cap_kind = 'lodging_nightly'; out.cap_cents = (line.nights || 0) * REF.lodging_nightly_cap_cents;
    out.reimbursable_cents = Math.min(conv, out.cap_cents);
    out.disallowed_cents = Math.max(0, conv - out.cap_cents);
  } else if (cat === 'airfare') {
    out.cap_kind = 'airfare_economy'; out.cap_cents = REF.airfare_economy_cap_cents;
    out.reimbursable_cents = Math.min(conv, out.cap_cents);
    out.disallowed_cents = Math.max(0, conv - out.cap_cents);
  } else if (cat === 'meals') {
    const pd = perDiem(report.trip_depart_at, report.trip_return_at);
    out.cap_kind = 'per_diem'; out.cap_cents = pd.entitlement_cents; out.per_diem = pd;
    out.reimbursable_cents = Math.min(conv, out.cap_cents);
    out.disallowed_cents = Math.max(0, conv - out.cap_cents);
  } else if (REF.nonreimbursable_categories.includes(cat)) {
    out.cap_kind = 'non_reimbursable'; out.cap_cents = 0;
    out.reimbursable_cents = 0; out.disallowed_cents = conv;
  } else {
    out.cap_kind = null; out.cap_cents = null;
    out.reimbursable_cents = conv; out.disallowed_cents = 0;
  }

  // ---- VAT reclaim contribution on the eligible POST-CAP base ----
  out.vat_contribution_cents = out.vat_eligible
    ? rhuDiv(out.reimbursable_cents * VAT_BP, 10000 + VAT_BP) : 0;
  // decoy: VAT taken on the PRE-CAP converted base (tax before the cap)
  out.decoy_vat_precap_cents = out.vat_eligible
    ? rhuDiv(out.converted_cents * VAT_BP, 10000 + VAT_BP) : 0;
  return out;
}

// ---------------------------------------------------------------- cost-center split
// A residual-plug split: the non-plug shares round half-up, the plug center absorbs
// the residual so the three commitments sum to the report total EXACTLY. Independent
// rounding of the plug conjures a phantom cent.
function splitReport(totalCents, allocation) {
  const plug = allocation.find((a) => a.is_plug) || allocation[0];
  const rows = [];
  let nonPlugSum = 0;
  for (const a of allocation) {
    if (a === plug) continue;
    const amt = rhuDiv(totalCents * a.pct_bp, 10000);
    nonPlugSum += amt;
    rows.push({ cost_center_id: a.cost_center_id, pct_bp: a.pct_bp, is_plug: 0, amount_cents: amt });
  }
  const plugAmt = totalCents - nonPlugSum;
  const plugRow = { cost_center_id: plug.cost_center_id, pct_bp: plug.pct_bp, is_plug: 1,
    amount_cents: plugAmt,
    decoy_independent_cents: rhuDiv(totalCents * plug.pct_bp, 10000) };
  // ordered by allocation order, plug in its declared slot
  const ordered = allocation.map((a) => (a === plug ? plugRow : rows.find((r) => r.cost_center_id === a.cost_center_id)));
  const decoyThreeSum = ordered.reduce((s, r) => s + (r.is_plug ? r.decoy_independent_cents : r.amount_cents), 0);
  return { rows: ordered, plug_cost_center_id: plug.cost_center_id, sum_cents: ordered.reduce((s, r) => s + r.amount_cents, 0),
    decoy_three_independent_sum_cents: decoyThreeSum };
}

// ---------------------------------------------------------------- report composition
function reportAllocation(db, reportId) {
  return db.prepare('SELECT * FROM report_allocations WHERE report_id=? ORDER BY id').all(reportId);
}
function computeReport(db, reportId) {
  const report = db.prepare('SELECT * FROM reports WHERE id=?').get(reportId);
  if (!report) return null;
  const lis = db.prepare('SELECT * FROM line_items WHERE report_id=? ORDER BY line_no').all(reportId);
  const lines = lis.map((l) => adjudicateLine(db, report, l));

  const reimbursableTotal = lines.reduce((a, l) => a + l.reimbursable_cents, 0);
  const disallowedTotal = lines.reduce((a, l) => a + l.disallowed_cents, 0);
  const claimedConvertedTotal = lines.reduce((a, l) => a + l.converted_cents, 0);

  // VAT reclaim on the ELIGIBLE, POST-CAP base (lodging + meals reimbursable).
  const eligibleBase = lines.filter((l) => l.vat_eligible).reduce((a, l) => a + l.reimbursable_cents, 0);
  const vatAccrual = rhuDiv(eligibleBase * VAT_BP, 10000 + VAT_BP);
  // VAT decoys, each a plausible-wrong base/rate
  const eligiblePrecap = lines.filter((l) => l.vat_eligible).reduce((a, l) => a + l.converted_cents, 0);
  const decoyVatWholeReport = rhuDiv(reimbursableTotal * VAT_BP, 10000 + VAT_BP);
  const decoyVatPrecapEligible = rhuDiv(eligiblePrecap * VAT_BP, 10000 + VAT_BP);
  const decoyVatExclusive = rhuDiv(eligibleBase * VAT_BP, 10000);

  const allocation = reportAllocation(db, reportId);
  const split = splitReport(reimbursableTotal, allocation);

  const requiredTierName = requiredTier(reimbursableTotal);
  const tierOnClaimed = requiredTier(claimedConvertedTotal);

  return {
    report_id: reportId, employee_id: report.employee_id, title: report.title,
    trip_depart_at: report.trip_depart_at, trip_return_at: report.trip_return_at,
    state: report.state, lines,
    reimbursable_total_cents: reimbursableTotal, disallowed_total_cents: disallowedTotal,
    claimed_converted_total_cents: claimedConvertedTotal,
    decoy_pay_as_claimed_cents: claimedConvertedTotal,          // reimburse with no caps
    vat_eligible_base_cents: eligibleBase, vat_accrual_cents: vatAccrual, vat_inclusive_bp: VAT_BP,
    decoy_vat_whole_report_cents: decoyVatWholeReport,
    decoy_vat_precap_eligible_cents: decoyVatPrecapEligible,
    decoy_vat_exclusive_cents: decoyVatExclusive,
    split,
    required_tier: requiredTierName, tier_on_claimed: tierOnClaimed,
  };
}

// ---------------------------------------------------------------- approval tiers
function requiredTier(amountCents) {
  if (amountCents <= REF.tier_manager_max_cents) return 'manager';
  if (amountCents <= REF.tier_director_max_cents) return 'director';
  return 'controller';
}
const tierRank = { manager: 1, director: 2, controller: 3 };
// An approver may approve a report iff their approval limit covers the SERVER
// -computed reimbursable amount.
function approverCovers(approver, amountCents) {
  return (approver.approval_limit_cents || 0) >= amountCents;
}

// ---------------------------------------------------------------- headroom
// A cost center's headroom = budget - SUM of its LIVE commitment rows (prior +
// posted), never the stored scalar decoy.
function committedFor(db, ccId) {
  return db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS c FROM commitments WHERE cost_center_id=? AND state='LIVE'").get(ccId).c;
}
function headroomFor(db, ccId) {
  const cc = db.prepare('SELECT * FROM cost_centers WHERE id=?').get(ccId);
  if (!cc) return null;
  const committed = committedFor(db, ccId);
  return { cost_center_id: ccId, budget_cents: cc.budget_cents, committed_cents: committed,
    headroom_cents: cc.budget_cents - committed,
    stored_scalar_headroom_cents: cc.stored_scalar_headroom_cents,
    decoy_budget_less_new_only_note: 'budget minus the new commitment, prior rows ignored' };
}

module.exports = {
  ROLES, HOME, VAT_BP, roundHalfUp, rhuDiv, ms, clock, refAt,
  fxRateFor, convertForeign, perDiem, adjudicateLine, splitReport,
  computeReport, reportAllocation, requiredTier, tierRank, approverCovers,
  committedFor, headroomFor,
};

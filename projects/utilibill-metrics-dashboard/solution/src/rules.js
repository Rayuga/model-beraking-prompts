'use strict';
// UtiliBill rule engine. Pure derivations over STORED rows. Money is INTEGER CENTS
// ($12.00 = 1200); percentages INTEGER BASIS POINTS (400 = 4.00%); volumes INTEGER kWh;
// sub-cent volumetric rates INTEGER HUNDREDTHS-OF-A-CENT per kWh (90 = 0.90 c/kWh).
// Rounding is half-up, applied ONCE at the stated event: round_half_up(x)=floor(x+0.5).
// Nothing reads the wall clock; every date decision compares two stored timestamps.
// Every window is HALF-OPEN [start, end).
//
// THE WITHHELD COMPOSITION (each rule stated atomically in the rules file, never sequenced):
//  - Tiered energy runs on THAT cycle's own fresh half-open blocks (reset each cycle).
//  - A mid-cycle peak rate change splits peak by the METERED sub-period (pre@30, at/after
//    the effective instant @34, half-open), never a day-count.
//  - Net metering: the export credit (avoided-cost 6.5c, NOT retail) offsets the ENERGY
//    line only; the excess BANKS and carries forward; it is never cashed out.
//  - RPS 4% rides the energy charge only, on GROSS delivered energy (pre-credit).
//  - SBC 0.90c/kWh rides GROSS delivered kWh, tier-independent.
//  - GRT 2.5% rides the NET-of-credit total of everything else (energy_net + fixed + RPS
//    + SBC), struck LAST.
//  - A late/estimated read trued up by a later actual is billed in the period it ACCRUED
//    (split by each cycle's stored baseline weight), each period re-billed on its OWN
//    fresh blocks; the prior bill (its original estimate, or — on a SECOND or later
//    correction — its own most recent still-live rebill) is superseded (retained) and a
//    contra of the delta over THAT prior bill is posted. A second correction nets against
//    what the first one actually left live, never against the original estimate again and
//    never against zero.
//  - A budget true-up fires at the enrollment anniversary (stored vs reference, half-open)
//    and resets the levelized to the trailing-12 ratio.
const REF = require('./db').reference;
const P = REF.policy;
const RC = REF.rate_change;

const ROLES = ['meter_analyst', 'billing_operator', 'rate_admin', 'settlement_controller'];
const ms = (iso) => Date.parse(iso);
function roundHalfUp(x) { return Math.floor(x + 0.5); }

function clock(db) {
  return db.prepare("SELECT * FROM system_clock WHERE id='CLOCK'").get()
      || { id: 'CLOCK', reference_at: '1970-01-01T00:00:00Z', reference_date: '1970-01-01' };
}
const refAt = (db) => clock(db).reference_at;

// ------------------------------------------------------------------ rate primitives
// Tiered energy on FRESH per-cycle half-open [lo,hi) blocks.
function tierEnergy(kwh) {
  let total = 0;
  for (const b of P.tier_bands) {
    const hi = b.hi_kwh == null ? Infinity : b.hi_kwh;
    const inBand = Math.max(0, Math.min(kwh, hi) - b.lo_kwh);
    total += inBand * b.rate_cents_per_kwh;
  }
  return total;
}
// Which tier band each kWh threshold falls in (for surfacing the split).
function tierSplit(kwh) {
  const out = [];
  for (const b of P.tier_bands) {
    const hi = b.hi_kwh == null ? Infinity : b.hi_kwh;
    const inBand = Math.max(0, Math.min(kwh, hi) - b.lo_kwh);
    if (inBand > 0) out.push({ tier: b.tier, kwh: inBand, rate: b.rate_cents_per_kwh, cents: inBand * b.rate_cents_per_kwh });
  }
  return out;
}
const rps = (energyCents) => roundHalfUp(energyCents * P.rps_bp / 10000);
const grt = (baseCents) => roundHalfUp(baseCents * P.grt_bp / 10000);
const sbc = (kwh) => roundHalfUp(P.sbc_centicents_per_kwh * kwh / 100);
const exportCredit = (kwh) => roundHalfUp(P.export_credit_centicents_per_kwh * kwh / 100);
const retailFirstTier = () => P.tier_bands[0].rate_cents_per_kwh;   // 8c, the "net metering at retail" decoy rate

// ------------------------------------------------------------------ net-metering bank
function nmBank(db, accountId) {
  // Bank balance = SUM of movement rows (never a stored scalar) — so a SECOND billing
  // action on the same net-metering account within one session correctly compounds off
  // whatever the FIRST one just posted, not off the original seed row alone.
  return db.prepare('SELECT COALESCE(SUM(amount_cents),0) AS c FROM nm_bank_movements WHERE account_id=?').get(accountId).c;
}

// ------------------------------------------------------------------ the cycle bill
// Compute the full bill for a normal cycle, every intermediate + decoy surfaced.
function computeCycleBill(db, cycleId) {
  const cycle = db.prepare('SELECT * FROM cycles WHERE id=?').get(cycleId);
  if (!cycle) return null;
  const account = db.prepare('SELECT * FROM accounts WHERE id=?').get(cycle.account_id);
  const read = db.prepare("SELECT * FROM meter_reads WHERE cycle_id=? AND kind='ACTUAL'").get(cycleId)
            || db.prepare('SELECT * FROM meter_reads WHERE cycle_id=?').get(cycleId);
  if (!read) return null;

  const deliveredKwh = read.delivered_kwh;
  const exportedKwh = read.exported_kwh;

  // ---- energy: TOU (metered sub-period split at the rate change) or tiered ----
  let energy, energyKind, touDetail = null, peakLine = null, peakDecoys = null, tiers = null;
  if (account.tariff === 'TOU') {
    energyKind = 'TOU';
    const pre = read.peak_pre_kwh, bound = read.peak_boundary_kwh, after = read.peak_after_kwh;
    const sh = read.shoulder_kwh, off = read.offpeak_kwh;
    const rOld = P.tou_rates.peak_old_cents_per_kwh, rNew = P.tou_rates.peak_new_cents_per_kwh;
    // half-open [eff, end): the boundary interval (stamped AT the effective instant) is NEW rate.
    const peakOldKwh = pre;
    const peakNewKwh = bound + after;
    peakLine = peakOldKwh * rOld + peakNewKwh * rNew;
    const totalPeak = pre + bound + after;
    const half = Math.floor(totalPeak / 2);
    peakDecoys = {
      peak_whole_new_cents: totalPeak * rNew,
      peak_whole_old_cents: totalPeak * rOld,
      peak_day_split_cents: half * rOld + (totalPeak - half) * rNew,
      peak_boundary_to_old_cents: (pre + bound) * rOld + after * rNew,   // boundary wrongly on old
    };
    const shoulder = sh * P.tou_rates.shoulder_cents_per_kwh;
    const offpeak = off * P.tou_rates.offpeak_cents_per_kwh;
    energy = peakLine + shoulder + offpeak;
    touDetail = {
      peak_old_kwh: peakOldKwh, peak_new_kwh: peakNewKwh, peak_boundary_kwh: bound,
      peak_cents: peakLine, shoulder_kwh: sh, shoulder_cents: shoulder, offpeak_kwh: off, offpeak_cents: offpeak,
      rate_change_effective_at: RC.effective_at, peak_old_rate: rOld, peak_new_rate: rNew,
    };
  } else {
    energyKind = 'TIERED';
    energy = tierEnergy(deliveredKwh);
    tiers = tierSplit(deliveredKwh);
  }

  // ---- net metering: energy-only offset + bank the excess ----
  const netMeter = !!account.net_metering;
  const credit = netMeter ? exportCredit(exportedKwh) : 0;
  const priorBank = netMeter ? nmBank(db, account.id) : 0;
  const available = priorBank + credit;
  const energyOffset = netMeter ? Math.min(available, energy) : 0;
  const energyNet = energy - energyOffset;
  const newBank = netMeter ? available - energyOffset : 0;
  const carryforwardDelta = newBank - priorBank;

  // ---- fixed + riders ----
  const fixed = P.fixed_charge_cents;
  const rpsCents = rps(energy);              // RPS on GROSS energy (energy-only, pre-credit)
  const sbcCents = sbc(deliveredKwh);        // SBC on GROSS delivered kWh
  const grtBase = energyNet + fixed + rpsCents + sbcCents;   // net-of-credit total of everything else
  const grtCents = grt(grtBase);             // struck LAST
  const total = grtBase + grtCents;

  // ---- decoys (never the basis) ----
  const retailCredit = netMeter ? exportedKwh * retailFirstTier() : 0;    // "net metering at retail"
  const grossBase = energy + fixed + rpsCents + sbcCents;                 // if credit ignored / on grand total
  const grtOnGross = grt(grossBase);
  const grossTotal = grossBase + grtOnGross;
  const decoys = {
    decoy_rps_on_subtotal_cents: rps(grtBase),               // RPS on everything-else subtotal
    decoy_grt_on_energy_only_cents: grt(energyNet),          // GRT on energy only
    decoy_grt_before_riders_cents: grt(energyNet + fixed),   // GRT struck before the riders
    decoy_credit_at_retail_cents: retailCredit,              // credit at retail tier-1 rate
    decoy_rps_on_net_energy_cents: rps(energyNet),           // RPS on net (post-credit) energy
    decoy_sbc_on_net_kwh_cents: sbc(Math.max(0, deliveredKwh - exportedKwh)),  // SBC on net-of-export kWh
    decoy_grt_on_gross_receipts_cents: grtOnGross,           // GRT on gross (pre-credit) receipts
    decoy_total_credit_vs_grand_cents: netMeter ? Math.max(0, grossTotal - available) : total,  // credit against grand total -> ~$0
  };
  if (peakDecoys) Object.assign(decoys, peakDecoys);

  return {
    cycle_id: cycleId, account_id: account.id, tariff: account.tariff, net_metering: netMeter ? 1 : 0,
    delivered_kwh: deliveredKwh, exported_kwh: exportedKwh,
    energy_kind: energyKind, energy_cents: energy, tiers, tou: touDetail, peak_cents: peakLine,
    export_credit_cents: credit, prior_bank_cents: priorBank, available_credit_cents: available,
    energy_offset_cents: energyOffset, energy_net_cents: energyNet,
    new_bank_cents: newBank, carryforward_delta_cents: carryforwardDelta,
    fixed_cents: fixed, rps_cents: rpsCents, sbc_cents: sbcCents,
    grt_base_cents: grtBase, grt_cents: grtCents, total_cents: total,
    ...decoys,
  };
}

// ------------------------------------------------------------------ the catch-up true-up
// Allocate a trued-up two-cycle total across the accrual cycles by their STORED baseline
// weight, re-bill each on its OWN fresh blocks, supersede the prior bill + contra the delta.
function computeTrueup(db, actualCycleId) {
  const actualRead = db.prepare("SELECT * FROM meter_reads WHERE cycle_id=? AND kind='ACTUAL'").get(actualCycleId);
  if (!actualRead || actualRead.trueup_total_kwh == null) return null;
  const accrualIds = JSON.parse(actualRead.accrual_cycle_ids || '[]');
  const cycles = accrualIds.map((id) => db.prepare('SELECT * FROM cycles WHERE id=?').get(id)).filter(Boolean);
  const totalKwh = actualRead.trueup_total_kwh;
  const totalWeight = cycles.reduce((a, c) => a + c.baseline_weight, 0);
  const threshold = P.dual_control_threshold_cents;

  const legs = cycles.map((c) => {
    const kwh = totalWeight > 0 ? Math.round(totalKwh * c.baseline_weight / totalWeight) : 0;
    const rebillEnergy = tierEnergy(kwh);
    // What this leg supersedes: its original ESTIMATE if this cycle has never been
    // corrected before, or else its own most recent still-live (non-superseded) REBILL —
    // so a SECOND (or later) correction on the same accrual cycle nets its contra against
    // what the PREVIOUS correction actually left live, never against the original estimate
    // a second time and never against zero. A cycle with neither (never estimated, never
    // previously rebilled) has nothing to supersede and mints a plain first-time rebill.
    const priorBill =
      db.prepare("SELECT * FROM bills WHERE cycle_id=? AND kind='ESTIMATE'").get(c.id) ||
      db.prepare("SELECT * FROM bills WHERE cycle_id=? AND kind='REBILL' AND superseded=0 ORDER BY created_at DESC, id DESC LIMIT 1").get(c.id) ||
      null;
    const priorTotal = priorBill ? priorBill.total_cents : 0;
    const contra = priorBill ? rebillEnergy - priorTotal : 0;
    return { cycle_id: c.id, label: c.label, weight: c.baseline_weight, allocated_kwh: kwh,
      rebill_energy_cents: rebillEnergy, tiers: tierSplit(kwh),
      estimate_bill_id: priorBill ? priorBill.id : null, estimate_total_cents: priorTotal,
      has_estimate: priorBill ? 1 : 0, contra_cents: contra };
  });
  const twoCycleEnergy = legs.reduce((a, l) => a + l.rebill_energy_cents, 0);
  const maxContra = legs.reduce((a, l) => Math.max(a, Math.abs(l.contra_cents)), 0);
  const needsApproval = maxContra > threshold;

  // ---- decoys ----
  // equal-split allocation
  const equalKwh = cycles.length ? Math.round(totalKwh / cycles.length) : 0;
  const decoyEqualLegs = cycles.map((c) => {
    const est = db.prepare("SELECT * FROM bills WHERE cycle_id=? AND kind='ESTIMATE'").get(c.id) || null;
    return { cycle_id: c.id, rebill_energy_cents: tierEnergy(equalKwh),
      contra_cents: est ? tierEnergy(equalKwh) - est.total_cents : 0 };
  });
  // dump-in-current: the actual read's cycle gets total minus prior estimates; others keep estimates.
  const priorEstSum = cycles.reduce((a, c) => {
    const est = db.prepare("SELECT * FROM bills WHERE cycle_id=? AND kind='ESTIMATE'").get(c.id);
    return a + (est ? est.delivered_kwh : 0);
  }, 0);
  const dumpKwh = totalKwh - priorEstSum;
  const dumpCurrentEnergy = tierEnergy(dumpKwh);
  const dumpTwoCycle = cycles.reduce((a, c) => {
    const est = db.prepare("SELECT * FROM bills WHERE cycle_id=? AND kind='ESTIMATE'").get(c.id);
    return a + (est ? est.total_cents : (c.id === actualCycleId ? dumpCurrentEnergy : tierEnergy(0)));
  }, 0);

  return {
    actual_cycle_id: actualCycleId, account_id: cycles[0] && cycles[0].account_id,
    trueup_total_kwh: totalKwh, total_weight: totalWeight, legs,
    two_cycle_energy_cents: twoCycleEnergy, max_contra_cents: maxContra,
    needs_approval: needsApproval ? 1 : 0, threshold_cents: threshold,
    decoy_equal_split_legs: decoyEqualLegs,
    decoy_dump_current_kwh: dumpKwh, decoy_dump_current_energy_cents: dumpCurrentEnergy,
    decoy_dump_two_cycle_cents: dumpTwoCycle,
  };
}

// ------------------------------------------------------------------ budget / levelized
function currentLevelized(db, accountId) {
  const t = db.prepare('SELECT * FROM budget_trueups WHERE account_id=? ORDER BY created_at DESC, id DESC LIMIT 1').get(accountId);
  if (t) return t.new_levelized_cents;
  const a = db.prepare('SELECT levelized_cents FROM accounts WHERE id=?').get(accountId);
  return a ? a.levelized_cents : 0;
}
function deferredMovements(db, accountId) {
  const lev = db.prepare('SELECT levelized_cents FROM accounts WHERE id=?').get(accountId).levelized_cents;
  const rows = db.prepare('SELECT * FROM budget_ledgers WHERE account_id=? ORDER BY cycle_no').all(accountId);
  return rows.map((r) => ({ cycle_no: r.cycle_no, actual_cents: r.actual_cents, levelized_cents: lev,
    movement_cents: r.actual_cents - lev }));
}
function deferredBalance(db, accountId) {
  const moves = deferredMovements(db, accountId);
  const gross = moves.reduce((a, m) => a + m.movement_cents, 0);
  const settled = db.prepare('SELECT COALESCE(SUM(settled_cents),0) AS c FROM budget_trueups WHERE account_id=?').get(accountId).c;
  return gross - settled;
}
function anniversaryDue(db, account) {
  if (!account.budget || !account.anniversary_at) return false;
  return ms(refAt(db)) >= ms(account.anniversary_at);          // fires at/after the stored anniversary
}
function budgetTrueupPlan(db, accountId) {
  const account = db.prepare('SELECT * FROM accounts WHERE id=?').get(accountId);
  const rows = db.prepare('SELECT * FROM budget_ledgers WHERE account_id=? ORDER BY cycle_no').all(accountId);
  const trailingTotal = rows.reduce((a, r) => a + r.actual_cents, 0);
  const n = rows.length || 12;
  const newLevelized = roundHalfUp(trailingTotal / n);
  const settle = deferredBalance(db, accountId);
  const lastActual = rows.length ? rows[rows.length - 1].actual_cents : 0;
  return {
    account_id: accountId, trailing_total_cents: trailingTotal, cycles: n,
    settle_cents: settle, old_levelized_cents: currentLevelized(db, accountId), new_levelized_cents: newLevelized,
    due: anniversaryDue(db, account) ? 1 : 0, anniversary_at: account.anniversary_at, reference_moment: refAt(db),
    decoy_levelized_unchanged_cents: account.levelized_cents,       // levelized left as-is
    decoy_last_cycle_x12_cents: lastActual,                         // (last x 12)/12 = last cycle
  };
}

// ------------------------------------------------------------------ remittance
function remittancePlan(db, periodId) {
  const cyc = db.prepare('SELECT cycle_id FROM period_cycles WHERE period_id=?').all(periodId).map((r) => r.cycle_id);
  if (!cyc.length) return { period_id: periodId, cycle_ids: [], rps_cents: 0, sbc_cents: 0, grt_cents: 0, total_cents: 0 };
  const ph = cyc.map(() => '?').join(',');
  const sumKind = (kind) => db.prepare(`SELECT COALESCE(SUM(amount_cents),0) AS c FROM rider_accruals WHERE kind=? AND cycle_id IN (${ph})`).get(kind, ...cyc).c;
  const rpsSum = sumKind('RPS'), sbcSum = sumKind('SBC'), grtSum = sumKind('GRT');
  return { period_id: periodId, cycle_ids: cyc, rps_cents: rpsSum, sbc_cents: sbcSum, grt_cents: grtSum,
    total_cents: rpsSum + sbcSum + grtSum };
}

module.exports = {
  ROLES, roundHalfUp, ms, clock, refAt,
  tierEnergy, tierSplit, rps, grt, sbc, exportCredit,
  nmBank, computeCycleBill, computeTrueup,
  currentLevelized, deferredMovements, deferredBalance, anniversaryDue, budgetTrueupPlan,
  remittancePlan,
};

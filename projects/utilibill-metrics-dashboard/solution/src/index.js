'use strict';
// UtiliBill HTTP layer — the billing + regulatory-settlement back office of an energy
// retailer. It bills metered cycles (tiered / TOU with a mid-cycle rate change), applies
// net-metering credits (energy-only offset + carryforward bank), strikes the regulatory
// riders (RPS on gross energy, SBC on gross delivered kWh, GRT last on the net total),
// trues up late/estimated reads (allocate by baseline weight, re-bill each accrual period,
// supersede + contra — and compounds cleanly on a SECOND correction), runs the annual
// budget/levelized true-up, and nets the period remittance from its OWN persisted
// rider-accrual rows.
//
// Non-negotiables:
//  - /api/health (and /health) answer immediately, never gated on seeding or the database.
//  - Identity comes ONLY from the session cookie. A role, actor, approver or amount in a
//    request body is a CLAIM, never authority; every decision is recomputed from stored
//    records and the session identity.
//  - No wall clock: the one stored reference moment drives every date rule.
//  - Money is integer cents; rates integer basis points / hundredths-of-a-cent; round
//    half-up once, at the stated event.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const dbmod = require('./db');
const R = require('./rules');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Health is answered before any DB access and is never gated on seeding.
app.get('/health', (_req, res) => res.json({ ok: true, service: 'utilibill' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'utilibill' }));

let db = null;
try { db = dbmod.open(); }
catch (e) { console.error('[utilibill] database open failed:', e.message); }

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));

function cookieParser(req, _res, next) {
  req.cookies = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  next();
}

const now = () => R.refAt(db);
const uid = (p) => `${p}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
const one = (sql, ...a) => db.prepare(sql).get(...a) || null;
const all = (sql, ...a) => db.prepare(sql).all(...a);
function audit(actorId, action, subject, detail) {
  db.prepare('INSERT INTO audit_log (actor_id,action,subject,detail,created_at) VALUES (?,?,?,?,?)')
    .run(actorId || null, action, subject, detail == null ? null : String(detail), now());
}

function money(c) {
  if (c === null || c === undefined) return null;
  const s = c < 0 ? '-' : '', a = Math.abs(c);
  return `${s}$${Math.floor(a / 100).toLocaleString('en-US')}.${String(a % 100).padStart(2, '0')}`;
}
const pct = (bp) => (bp === null || bp === undefined) ? null : `${Math.floor(bp / 100)}.${String(bp % 100).padStart(2, '0')}%`;
const perKwh = (cc) => (cc === null || cc === undefined) ? null : `${(cc / 100).toFixed(2)}¢/kWh`;

// Identity is resolved from the session ONLY.
function currentUser(req) {
  const t = req.cookies.utilibill_session;
  if (!t) return null;
  const s = one('SELECT * FROM sessions WHERE token=?', t);
  if (!s) return null;
  const u = one('SELECT * FROM users WHERE id=?', s.user_id);
  if (!u || u.suspended) return null;
  return u;
}
function auth(...roles) {
  return (req, res, next) => {
    const u = currentUser(req);
    if (!u) return res.status(401).json({ error: 'authentication required' });
    if (roles.length && !roles.includes(u.role))
      return res.status(403).json({ error: `role ${u.role} may not perform this action`,
        your_role: u.role, allowed_roles: roles });
    req.user = u;
    next();
  };
}
const bad = (res, msg, code) => res.status(code || 400).json({ error: msg });
const fail = (res, code, msg, extra) => res.status(code).json({ error: msg, ...(extra || {}) });

// ================================================================= auth routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = one('SELECT * FROM users WHERE email=?', String(email || '').toLowerCase());
  if (!u || u.password !== password) return bad(res, 'invalid credentials', 401);
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)').run(token, u.id, now());
  res.setHeader('Set-Cookie', `utilibill_session=${token}; Path=/; HttpOnly; SameSite=Lax`);
  audit(u.id, 'LOGIN', u.id, null);
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role });
});
app.post('/api/auth/logout', (req, res) => {
  const t = req.cookies.utilibill_session;
  if (t) db.prepare('DELETE FROM sessions WHERE token=?').run(t);
  res.setHeader('Set-Cookie', 'utilibill_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
  res.json({ ok: true });
});
app.get('/api/auth/me', (req, res) => {
  const u = currentUser(req);
  if (!u) return bad(res, 'authentication required', 401);
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role });
});

// ================================================================= views
function billView(b) {
  const accruals = all('SELECT * FROM rider_accruals WHERE bill_id=? ORDER BY id', b.id)
    .map((a) => ({ ...a, base_display: money(a.base_cents), amount_display: money(a.amount_cents) }));
  const contras = all('SELECT * FROM contras WHERE bill_id=? ORDER BY id', b.id)
    .map((c) => ({ ...c, amount_display: money(c.amount_cents) }));
  const contraSum = contras.reduce((a, c) => a + c.amount_cents, 0);
  return { ...b, breakdown: JSON.parse(b.breakdown || '{}'),
    energy_display: money(b.energy_cents), credit_display: money(b.credit_cents),
    energy_net_display: money(b.energy_net_cents), fixed_display: money(b.fixed_cents),
    rps_display: money(b.rps_cents), sbc_display: money(b.sbc_cents), grt_display: money(b.grt_cents),
    total_display: money(b.total_cents), net_cents: b.total_cents + contraSum,
    net_display: money(b.total_cents + contraSum),
    raiser: b.raised_by ? one('SELECT id,name,role FROM users WHERE id=?', b.raised_by) : null,
    approver: b.approved_by ? one('SELECT id,name,role FROM users WHERE id=?', b.approved_by) : null,
    accruals, contras };
}

function cycleView(c) {
  const account = one('SELECT * FROM accounts WHERE id=?', c.account_id);
  const read = one("SELECT * FROM meter_reads WHERE cycle_id=? AND kind='ACTUAL'", c.id)
            || one('SELECT * FROM meter_reads WHERE cycle_id=?', c.id);
  const bills = all('SELECT * FROM bills WHERE cycle_id=? ORDER BY created_at,id', c.id).map(billView);
  let preview = null;
  if (read && read.kind === 'ACTUAL' && account.tariff && read.trueup_total_kwh == null) {
    const p = R.computeCycleBill(db, c.id);
    preview = p ? cycleBillView(p) : null;
  }
  let trueup = null;
  if (read && read.trueup_total_kwh != null) {
    const t = R.computeTrueup(db, c.id);
    trueup = t ? trueupView(t) : null;
  }
  return { ...c,
    account_name: account.name, tariff: account.tariff, net_metering: account.net_metering,
    read: read ? { ...read, accrual_cycle_ids: JSON.parse(read.accrual_cycle_ids || '[]') } : null,
    bill_preview: preview, trueup_preview: trueup, bills };
}

function cycleBillView(p) {
  return { ...p,
    energy_display: money(p.energy_cents), peak_display: money(p.peak_cents),
    export_credit_display: money(p.export_credit_cents), prior_bank_display: money(p.prior_bank_cents),
    available_credit_display: money(p.available_credit_cents), energy_offset_display: money(p.energy_offset_cents),
    energy_net_display: money(p.energy_net_cents), new_bank_display: money(p.new_bank_cents),
    carryforward_delta_display: money(p.carryforward_delta_cents),
    fixed_display: money(p.fixed_cents), rps_display: money(p.rps_cents), sbc_display: money(p.sbc_cents),
    grt_base_display: money(p.grt_base_cents), grt_display: money(p.grt_cents), total_display: money(p.total_cents),
    decoy_rps_on_subtotal_display: money(p.decoy_rps_on_subtotal_cents),
    decoy_grt_on_energy_only_display: money(p.decoy_grt_on_energy_only_cents),
    decoy_grt_before_riders_display: money(p.decoy_grt_before_riders_cents),
    decoy_credit_at_retail_display: money(p.decoy_credit_at_retail_cents),
    decoy_rps_on_net_energy_display: money(p.decoy_rps_on_net_energy_cents),
    decoy_sbc_on_net_kwh_display: money(p.decoy_sbc_on_net_kwh_cents),
    decoy_grt_on_gross_receipts_display: money(p.decoy_grt_on_gross_receipts_cents),
    decoy_total_credit_vs_grand_display: money(p.decoy_total_credit_vs_grand_cents),
    decoy_peak_whole_new_display: money(p.peak_whole_new_cents),
    decoy_peak_whole_old_display: money(p.peak_whole_old_cents),
    decoy_peak_day_split_display: money(p.peak_day_split_cents),
    decoy_peak_boundary_to_old_display: money(p.peak_boundary_to_old_cents) };
}

function trueupView(t) {
  return { ...t,
    two_cycle_energy_display: money(t.two_cycle_energy_cents), max_contra_display: money(t.max_contra_cents),
    threshold_display: money(t.threshold_cents), decoy_dump_two_cycle_display: money(t.decoy_dump_two_cycle_cents),
    decoy_dump_current_energy_display: money(t.decoy_dump_current_energy_cents),
    legs: t.legs.map((l) => ({ ...l, rebill_energy_display: money(l.rebill_energy_cents),
      estimate_total_display: money(l.estimate_total_cents), contra_display: money(l.contra_cents) })),
    decoy_equal_split_legs: t.decoy_equal_split_legs.map((l) => ({ ...l,
      rebill_energy_display: money(l.rebill_energy_cents), contra_display: money(l.contra_cents) })) };
}

function budgetView(account) {
  const moves = R.deferredMovements(db, account.id);
  const bal = R.deferredBalance(db, account.id);
  const plan = R.budgetTrueupPlan(db, account.id);
  const trueups = all('SELECT * FROM budget_trueups WHERE account_id=? ORDER BY id', account.id)
    .map((t) => ({ ...t, settled_display: money(t.settled_cents), old_levelized_display: money(t.old_levelized_cents),
      new_levelized_display: money(t.new_levelized_cents), trailing_total_display: money(t.trailing_total_cents) }));
  return {
    current_levelized_cents: R.currentLevelized(db, account.id), current_levelized_display: money(R.currentLevelized(db, account.id)),
    deferred_balance_cents: bal, deferred_balance_display: money(bal),
    movements: moves.map((m) => ({ ...m, movement_display: money(m.movement_cents), actual_display: money(m.actual_cents) })),
    trueup_plan: { ...plan, settle_display: money(plan.settle_cents), trailing_total_display: money(plan.trailing_total_cents),
      new_levelized_display: money(plan.new_levelized_cents), old_levelized_display: money(plan.old_levelized_cents),
      decoy_levelized_unchanged_display: money(plan.decoy_levelized_unchanged_cents),
      decoy_last_cycle_x12_display: money(plan.decoy_last_cycle_x12_cents) },
    trueups };
}

function accountView(a) {
  const cycles = all('SELECT * FROM cycles WHERE account_id=? ORDER BY window_start,id', a.id).map(cycleView);
  const out = { ...a,
    net_metering_display: a.net_metering ? 'yes' : 'no',
    cycles };
  if (a.net_metering) {
    const bank = R.nmBank(db, a.id);
    out.nm_bank_cents = bank; out.nm_bank_display = money(bank);
    out.nm_bank_movements = all('SELECT * FROM nm_bank_movements WHERE account_id=? ORDER BY id', a.id)
      .map((m) => ({ ...m, amount_display: money(m.amount_cents) }));
  }
  if (a.budget) out.budget = budgetView(a);
  return out;
}

function periodView(p) {
  const plan = R.remittancePlan(db, p.id);
  const rem = one('SELECT * FROM remittances WHERE period_id=? ORDER BY id DESC LIMIT 1', p.id);
  return { ...p,
    finalized_cycle_ids: all('SELECT cycle_id FROM period_cycles WHERE period_id=? ORDER BY id', p.id).map((r) => r.cycle_id),
    remittance_plan: { ...plan, rps_display: money(plan.rps_cents), sbc_display: money(plan.sbc_cents),
      grt_display: money(plan.grt_cents), total_display: money(plan.total_cents) },
    remittance: rem ? { ...rem, rps_display: money(rem.rps_cents), sbc_display: money(rem.sbc_cents),
      grt_display: money(rem.grt_cents), total_display: money(rem.total_cents) } : null };
}

// ================================================================= bootstrap / reads
app.get('/api/bootstrap', auth(), (req, res) => {
  const pol = dbmod.reference.policy;
  res.json({
    user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role },
    clock: R.clock(db),
    policy: {
      tier_bands: pol.tier_bands, tou_rates: pol.tou_rates,
      rps_display: pct(pol.rps_bp), grt_display: pct(pol.grt_bp),
      sbc_display: perKwh(pol.sbc_centicents_per_kwh), export_credit_display: perKwh(pol.export_credit_centicents_per_kwh),
      fixed_charge_display: money(pol.fixed_charge_cents), dual_control_threshold_display: money(pol.dual_control_threshold_cents),
      rate_change: dbmod.reference.rate_change,
    },
    accounts: all('SELECT * FROM accounts ORDER BY id').map(accountView),
    periods: all('SELECT * FROM settlement_periods ORDER BY id').map(periodView),
    users: all('SELECT id,name,email,role FROM users ORDER BY id'),
    audit: all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100'),
  });
});
app.get('/api/accounts/:id', auth(), (req, res) => {
  const a = one('SELECT * FROM accounts WHERE id=?', req.params.id);
  return a ? res.json(accountView(a)) : bad(res, 'no such account', 404);
});
app.get('/api/cycles/:id', auth(), (req, res) => {
  const c = one('SELECT * FROM cycles WHERE id=?', req.params.id);
  return c ? res.json(cycleView(c)) : bad(res, 'no such cycle', 404);
});
app.get('/api/periods/:id', auth(), (req, res) => {
  const p = one('SELECT * FROM settlement_periods WHERE id=?', req.params.id);
  return p ? res.json(periodView(p)) : bad(res, 'no such period', 404);
});

// ================================================================= bill a cycle (billing operator)
// Compute the ordered bill and MINT the bill + rider-accrual rows (+ net-metering bank
// movement). Body-claimed amounts are ignored; the server computes from stored reads.
app.post('/api/cycles/:id/bill', auth('billing_operator'), (req, res) => {
  const c = one('SELECT * FROM cycles WHERE id=?', req.params.id);
  if (!c) return bad(res, 'no such cycle', 404);
  if (c.status === 'FINALIZED' || c.status === 'REMITTED')
    return fail(res, 409, `cycle ${c.id} is ${c.status}; it is locked and cannot be re-billed`, { cycle_id: c.id, status: c.status });
  const read = one("SELECT * FROM meter_reads WHERE cycle_id=? AND kind='ACTUAL'", c.id);
  if (!read || read.trueup_total_kwh != null)
    return fail(res, 409, `cycle ${c.id} has no plain actual read to bill (an estimated/true-up cycle is billed through the true-up)`, { cycle_id: c.id });
  const existing = one("SELECT * FROM bills WHERE cycle_id=? AND kind='CYCLE'", c.id);
  if (existing)
    return fail(res, 409, `cycle ${c.id} is already billed (${existing.id}); it is not billed twice`, { cycle_id: c.id, bill_id: existing.id });
  const p = R.computeCycleBill(db, c.id);
  const billId = uid('BILL');
  db.transaction(() => {
    db.prepare(`INSERT INTO bills (id,account_id,cycle_id,kind,delivered_kwh,exported_kwh,energy_cents,credit_cents,energy_net_cents,fixed_cents,rps_cents,sbc_cents,grt_cents,total_cents,state,raised_by,breakdown,created_at)
      VALUES (?,?,?, 'CYCLE', ?,?,?,?,?,?,?,?,?,?, 'BILLED', ?, ?, ?)`)
      .run(billId, c.account_id, c.id, p.delivered_kwh, p.exported_kwh, p.energy_cents, p.export_credit_cents,
        p.energy_net_cents, p.fixed_cents, p.rps_cents, p.sbc_cents, p.grt_cents, p.total_cents, req.user.id,
        JSON.stringify({ energy_kind: p.energy_kind, tou: p.tou, tiers: p.tiers, grt_base_cents: p.grt_base_cents }), now());
    // rider accrual rows (the remittance sums these OWN rows)
    db.prepare('INSERT INTO rider_accruals (id,bill_id,account_id,cycle_id,kind,base_cents,rate,amount_cents,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(uid('ACR'), billId, c.account_id, c.id, 'RPS', p.energy_cents, dbmod.reference.policy.rps_bp, p.rps_cents, now());
    db.prepare('INSERT INTO rider_accruals (id,bill_id,account_id,cycle_id,kind,base_cents,rate,amount_cents,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(uid('ACR'), billId, c.account_id, c.id, 'SBC', p.delivered_kwh, dbmod.reference.policy.sbc_centicents_per_kwh, p.sbc_cents, now());
    db.prepare('INSERT INTO rider_accruals (id,bill_id,account_id,cycle_id,kind,base_cents,rate,amount_cents,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(uid('ACR'), billId, c.account_id, c.id, 'GRT', p.grt_base_cents, dbmod.reference.policy.grt_bp, p.grt_cents, now());
    // net-metering carryforward movement: only when the bank actually moves (delta != 0)
    if (p.net_metering && p.carryforward_delta_cents !== 0)
      db.prepare('INSERT INTO nm_bank_movements (id,account_id,amount_cents,kind,bill_id,note,created_at) VALUES (?,?,?,?,?,?,?)')
        .run(uid('NMB'), c.account_id, p.carryforward_delta_cents, 'CARRYFORWARD', billId,
          'Net-metering excess carried forward (energy-only offset; never cashed out)', now());
    db.prepare("UPDATE cycles SET status='BILLED' WHERE id=?").run(c.id);
  })();
  audit(req.user.id, 'CYCLE_BILLED', billId, String(p.total_cents));
  res.json({ billed: true, bill_id: billId, cycle_id: c.id, ...cycleBillView(p), account: accountView(one('SELECT * FROM accounts WHERE id=?', c.account_id)) });
});

// ================================================================= raise the true-up (meter analyst)
// Allocate the trued-up total by baseline weight, re-bill each accrual period on its OWN
// fresh blocks, mint the re-bill rows. If any contra delta exceeds the dual-control
// threshold, the batch is held PENDING_APPROVAL (a distinct Settlement Controller must
// approve); otherwise the prior bills are superseded and the contras posted at once.
app.post('/api/reads/:cycleId/trueup', auth('meter_analyst'), (req, res) => {
  const c = one('SELECT * FROM cycles WHERE id=?', req.params.cycleId);
  if (!c) return bad(res, 'no such cycle', 404);
  if (c.status === 'FINALIZED' || c.status === 'REMITTED')
    return fail(res, 409, `cycle ${c.id} is ${c.status}; a re-bill cannot be raised against a locked/remitted cycle`, { cycle_id: c.id, status: c.status });
  const t = R.computeTrueup(db, c.id);
  if (!t) return fail(res, 409, `cycle ${c.id} has no actual true-up read`, { cycle_id: c.id });
  const already = one("SELECT * FROM bills WHERE cycle_id=? AND kind='REBILL'", c.id);
  if (already) return fail(res, 409, `cycle ${c.id} has already been trued up (${already.id})`, { cycle_id: c.id, bill_id: already.id });

  const state = t.needs_approval ? 'PENDING_APPROVAL' : 'BILLED';
  const created = [];
  db.transaction(() => {
    for (const leg of t.legs) {
      const rebillId = uid('BILL');
      db.prepare(`INSERT INTO bills (id,account_id,cycle_id,kind,delivered_kwh,energy_cents,energy_net_cents,total_cents,state,supersedes_id,raised_by,breakdown,created_at)
        VALUES (?,?,?, 'REBILL', ?,?,?,?,?,?,?,?,?)`)
        .run(rebillId, t.account_id, leg.cycle_id, leg.allocated_kwh, leg.rebill_energy_cents, leg.rebill_energy_cents,
          leg.rebill_energy_cents, state, leg.estimate_bill_id,
          req.user.id, JSON.stringify({ trueup_actual_cycle: c.id, allocated_kwh: leg.allocated_kwh,
            contra_cents: leg.contra_cents, estimate_bill_id: leg.estimate_bill_id, weight: leg.weight, tiers: leg.tiers }), now());
      created.push(rebillId);
      if (!t.needs_approval && leg.has_estimate) {
        db.prepare('UPDATE bills SET superseded=1, superseded_by_id=?, state=? WHERE id=?').run(rebillId, 'SUPERSEDED', leg.estimate_bill_id);
        db.prepare('INSERT INTO contras (id,account_id,bill_id,cycle_id,amount_cents,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)')
          .run(uid('CON'), t.account_id, rebillId, leg.cycle_id, leg.contra_cents,
            'True-up contra: re-bill delta over the superseded prior bill (retained, not edited)', req.user.id, now());
      }
    }
  })();
  audit(req.user.id, t.needs_approval ? 'TRUEUP_RAISED_PENDING' : 'TRUEUP_POSTED', c.id, String(t.max_contra_cents));
  res.json({ trueup: true, needs_approval: t.needs_approval, state, rebill_ids: created,
    ...trueupView(t), cycle: cycleView(one('SELECT * FROM cycles WHERE id=?', c.id)) });
});

// ================================================================= approve a pending true-up (settlement controller, dual control)
// The approver is resolved from the SESSION (must be a settlement_controller); a
// body-claimed approver / amount is ignored. Approval posts the held supersede + contra
// rows and flips the re-bills to BILLED.
app.post('/api/reads/:cycleId/trueup/approve', auth('settlement_controller'), (req, res) => {
  const c = one('SELECT * FROM cycles WHERE id=?', req.params.cycleId);
  if (!c) return bad(res, 'no such cycle', 404);
  const pending = all("SELECT * FROM bills WHERE kind='REBILL' AND state='PENDING_APPROVAL' AND json_extract(breakdown,'$.trueup_actual_cycle')=?", c.id);
  if (!pending.length) return fail(res, 409, `no pending true-up is awaiting approval on cycle ${c.id}`, { cycle_id: c.id });
  const raiser = pending[0].raised_by;
  if (req.user.id === raiser)
    return fail(res, 409, 'the person who raised a re-bill may not approve it (dual control requires a distinct settlement controller)',
      { cycle_id: c.id, raiser_id: raiser, approver_id: req.user.id, distinct_humans_required: 2,
        claimed_approver_ignored: (req.body || {}).approver_id || (req.body || {}).approved_by || null });
  db.transaction(() => {
    for (const rb of pending) {
      const bd = JSON.parse(rb.breakdown || '{}');
      db.prepare("UPDATE bills SET state='BILLED', approved_by=?, approved_at=? WHERE id=?").run(req.user.id, now(), rb.id);
      if (bd.estimate_bill_id) {
        db.prepare('UPDATE bills SET superseded=1, superseded_by_id=?, state=? WHERE id=?').run(rb.id, 'SUPERSEDED', bd.estimate_bill_id);
        db.prepare('INSERT INTO contras (id,account_id,bill_id,cycle_id,amount_cents,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)')
          .run(uid('CON'), rb.account_id, rb.id, rb.cycle_id, bd.contra_cents,
            'True-up contra (approved): re-bill delta over the superseded prior bill', req.user.id, now());
      }
    }
  })();
  audit(req.user.id, 'TRUEUP_APPROVED', c.id, String(req.user.id));
  res.json({ approved: true, cycle_id: c.id, approver_id: req.user.id,
    cycle: cycleView(one('SELECT * FROM cycles WHERE id=?', c.id)) });
});

// ================================================================= annual budget/levelized true-up (billing operator)
// Fires ONLY at the enrollment anniversary (stored vs the reference moment, half-open):
// settles the deferred balance and resets the levelized to the trailing-12 ratio.
app.post('/api/accounts/:id/budget-trueup', auth('billing_operator'), (req, res) => {
  const a = one('SELECT * FROM accounts WHERE id=?', req.params.id);
  if (!a) return bad(res, 'no such account', 404);
  if (!a.budget) return fail(res, 409, `account ${a.id} is not on a budget/levelized plan`, { account_id: a.id });
  if (!R.anniversaryDue(db, a))
    return fail(res, 409, `account ${a.id} is before its enrollment anniversary ${a.anniversary_at}; the reference moment ${now()} has not reached it, so no true-up fires`,
      { account_id: a.id, anniversary_at: a.anniversary_at, reference_moment: now() });
  const existing = one('SELECT * FROM budget_trueups WHERE account_id=?', a.id);
  if (existing) return fail(res, 409, `account ${a.id} has already had its annual true-up (${existing.id})`, { account_id: a.id, trueup_id: existing.id });
  const plan = R.budgetTrueupPlan(db, a.id);
  const tid = uid('BTU');
  db.prepare('INSERT INTO budget_trueups (id,account_id,settled_cents,trailing_total_cents,old_levelized_cents,new_levelized_cents,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(tid, a.id, plan.settle_cents, plan.trailing_total_cents, plan.old_levelized_cents, plan.new_levelized_cents, req.user.id, now());
  audit(req.user.id, 'BUDGET_TRUEUP', a.id, String(plan.settle_cents));
  res.json({ trued_up: true, trueup_id: tid, settled_display: money(plan.settle_cents), new_levelized_display: money(plan.new_levelized_cents),
    account: accountView(one('SELECT * FROM accounts WHERE id=?', a.id)) });
});

// ================================================================= finalize billed cycles into a settlement period (billing operator)
app.post('/api/periods/:id/finalize', auth('billing_operator'), (req, res) => {
  const p = one('SELECT * FROM settlement_periods WHERE id=?', req.params.id);
  if (!p) return bad(res, 'no such period', 404);
  if (p.status === 'REMITTED') return fail(res, 409, `period ${p.id} is already remitted`, { period_id: p.id });
  const ids = Array.isArray((req.body || {}).cycle_ids) ? req.body.cycle_ids : [];
  if (!ids.length) return bad(res, 'cycle_ids (billed cycles to finalize into this period) required', 400);
  const finalized = [];
  db.transaction(() => {
    for (const cid of ids) {
      const c = one('SELECT * FROM cycles WHERE id=?', cid);
      if (!c || c.status !== 'BILLED') continue;
      db.prepare('INSERT INTO period_cycles (id,period_id,cycle_id,created_at) VALUES (?,?,?,?)').run(uid('PC'), p.id, cid, now());
      db.prepare("UPDATE cycles SET status='FINALIZED' WHERE id=?").run(cid);
      finalized.push(cid);
    }
  })();
  audit(req.user.id, 'PERIOD_FINALIZED', p.id, finalized.join(','));
  res.json({ finalized, period: periodView(one('SELECT * FROM settlement_periods WHERE id=?', p.id)) });
});

// ================================================================= run the remittance (settlement controller)
// The persisted remittance line = SUM of the app's OWN RPS+SBC+GRT accrual rows across the
// finalized cycles — not a stored scalar and not the twin's echo.
app.post('/api/periods/:id/remit', auth('settlement_controller'), (req, res) => {
  const p = one('SELECT * FROM settlement_periods WHERE id=?', req.params.id);
  if (!p) return bad(res, 'no such period', 404);
  if (p.status === 'REMITTED') return fail(res, 409, `period ${p.id} is already remitted`, { period_id: p.id });
  const plan = R.remittancePlan(db, p.id);
  if (!plan.cycle_ids.length) return fail(res, 409, `period ${p.id} has no finalized cycles to remit`, { period_id: p.id });
  const remId = uid('REM');
  const ack = 'ACK-' + crypto.createHash('sha256').update(remId).digest('hex').slice(0, 12).toUpperCase();
  db.transaction(() => {
    db.prepare('INSERT INTO remittances (id,period_id,rps_cents,sbc_cents,grt_cents,total_cents,authority_ack,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(remId, p.id, plan.rps_cents, plan.sbc_cents, plan.grt_cents, plan.total_cents, ack, req.user.id, now());
    db.prepare("UPDATE settlement_periods SET status='REMITTED' WHERE id=?").run(p.id);
    for (const cid of plan.cycle_ids) db.prepare("UPDATE cycles SET status='REMITTED' WHERE id=?").run(cid);
  })();
  audit(req.user.id, 'PERIOD_REMITTED', remId, String(plan.total_cents));
  res.json({ remitted: true, remittance_id: remId, authority_ack: ack, total_display: money(plan.total_cents),
    period: periodView(one('SELECT * FROM settlement_periods WHERE id=?', p.id)) });
});

// ================================================================= append-only audit trail
app.get('/api/audit', auth(), (_req, res) => res.json({ audit: all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200') }));
// A path-prefix middleware (not app.all('/api/audit/*', ...)) avoids an Express 5 /
// path-to-regexp v8 bare-wildcard rejection at boot. Any request under /api/audit that
// the GET route above did not already answer (any write, at the list path or a sub-path)
// lands here and is refused: the trail is append-only for every role, including finance.
app.use('/api/audit', (req, res) => fail(res, 405, 'the audit trail is append-only; entries cannot be edited or deleted'));

// ================================================================= fallthrough
app.use('/api', (_req, res) => res.status(404).json({ error: 'no such endpoint' }));
// A path-less middleware (not app.get('*', ...)) avoids the same Express 5 bare-wildcard
// rejection for the SPA fallthrough.
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    const idx = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(idx)) return res.sendFile(idx);
    return res.status(200).type('html').send('<!doctype html><title>UtiliBill</title><p>UtiliBill billing back office API is running.</p>');
  }
  next();
});

app.listen(PORT, '0.0.0.0', () => console.log(`[utilibill] listening on ${PORT}`));
module.exports = app;

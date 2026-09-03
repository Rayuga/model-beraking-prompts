'use strict';
// ExpenseFlow HTTP layer — the corporate travel & expense (T&E) reimbursement back
// office. Finance ADJUDICATES a filed report (FX-converts each foreign line at its
// stored transaction-date rate, disallows what breaches a policy cap on the CONVERTED
// base, and accrues reclaimable VAT on the eligible post-cap base), an APPROVER signs
// at their amount tier on the server-computed reimbursable, finance POSTS the cost
// -center split with a residual plug and moves each center's headroom, and a rejected
// receipt is clawed back by SUPERSEDE + contra (headroom restored, VAT reversed, an
// employee recovery raised) — always additions, never edits. A report may have more
// than one receipt rejected over its life; each rejection nets against whatever the
// PREVIOUS rejection actually left live, never against the report's original total.
//
// Non-negotiables:
//  - /health and /api/health answer immediately, never gated on seeding or the database.
//  - Identity comes ONLY from the session cookie. A role, actor, approver, tier or
//    amount in a request body is a CLAIM, never authority; every decision is
//    recomputed from stored records and the session identity.
//  - No wall clock: the one stored reference moment drives every date stamp.
//  - Money is integer cents; rates integer basis points / ten-thousandths; round
//    half-up once.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const dbmod = require('./db');
const R = require('./rules');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Health is answered before any DB access and is never gated on seeding.
app.get('/health', (_req, res) => res.json({ ok: true, service: 'expenseflow' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'expenseflow' }));

let db = null;
try { db = dbmod.open(); }
catch (e) { console.error('[expenseflow] database open failed:', e.message); }

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
const rateDisplay = (t) => (t == null ? null : `${Math.floor(t / 10000)}.${String(t % 10000).padStart(4, '0')}`);
const pct = (bp) => (bp == null ? null : `${Math.floor(bp / 100)}.${String(bp % 100).padStart(2, '0')}%`);

// Identity is resolved from the session ONLY.
function currentUser(req) {
  const t = req.cookies.expenseflow_session;
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
// The signed-in identity view always carries the approval limit (null off-role) so
// the UI can show which of the three approver tiers an account holds.
const authView = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role,
  approval_limit_cents: u.approval_limit_cents ?? null, approval_limit_display: money(u.approval_limit_cents) });

// ================================================================= auth routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = one('SELECT * FROM users WHERE email=?', String(email || '').toLowerCase());
  if (!u || u.password !== password) return bad(res, 'invalid credentials', 401);
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)').run(token, u.id, now());
  res.setHeader('Set-Cookie', `expenseflow_session=${token}; Path=/; HttpOnly; SameSite=Lax`);
  audit(u.id, 'LOGIN', u.id, null);
  res.json(authView(u));
});
app.post('/api/auth/logout', (req, res) => {
  const t = req.cookies.expenseflow_session;
  if (t) db.prepare('DELETE FROM sessions WHERE token=?').run(t);
  res.setHeader('Set-Cookie', 'expenseflow_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
  res.json({ ok: true });
});
app.get('/api/auth/me', (req, res) => {
  const u = currentUser(req);
  if (!u) return bad(res, 'authentication required', 401);
  res.json(authView(u));
});

// ================================================================= views
function lineComputedView(l) {
  const v = { ...l,
    claimed_display: money(l.claimed_cents), converted_display: money(l.converted_cents),
    cap_display: l.cap_cents == null ? null : money(l.cap_cents),
    rate_display: rateDisplay(l.rate_ten_thousandths),
    reimbursable_display: money(l.reimbursable_cents), disallowed_display: money(l.disallowed_cents),
    vat_contribution_display: money(l.vat_contribution_cents),
    decoy_vat_precap_display: money(l.decoy_vat_precap_cents) };
  if (l.decoy_conversions) v.decoy_conversions = l.decoy_conversions.map((d) => ({ ...d, converted_display: money(d.converted_cents), rate_display: rateDisplay(d.rate) }));
  if (l.decoy_mileage_irs_cents != null) { v.decoy_mileage_irs_display = money(l.decoy_mileage_irs_cents); v.decoy_mileage_alt_display = money(l.decoy_mileage_alt_cents); }
  if (l.per_diem) v.per_diem = { ...l.per_diem,
    entitlement_display: money(l.per_diem.entitlement_cents),
    decoy_calendar_days_display: money(l.per_diem.decoy_calendar_days_cents),
    decoy_ceil_days_display: money(l.per_diem.decoy_ceil_days_cents),
    decoy_inclusive_blocks_display: money(l.per_diem.decoy_inclusive_blocks_cents) };
  return v;
}
function computedReportView(c) {
  const s = c.split;
  return { ...c,
    lines: c.lines.map(lineComputedView),
    reimbursable_total_display: money(c.reimbursable_total_cents),
    disallowed_total_display: money(c.disallowed_total_cents),
    claimed_converted_total_display: money(c.claimed_converted_total_cents),
    decoy_pay_as_claimed_display: money(c.decoy_pay_as_claimed_cents),
    vat_eligible_base_display: money(c.vat_eligible_base_cents),
    vat_accrual_display: money(c.vat_accrual_cents), vat_inclusive_display: pct(c.vat_inclusive_bp),
    decoy_vat_whole_report_display: money(c.decoy_vat_whole_report_cents),
    decoy_vat_precap_eligible_display: money(c.decoy_vat_precap_eligible_cents),
    decoy_vat_exclusive_display: money(c.decoy_vat_exclusive_cents),
    split: { ...s, sum_display: money(s.sum_cents), decoy_three_independent_sum_display: money(s.decoy_three_independent_sum_cents),
      rows: s.rows.map((r) => ({ ...r, amount_display: money(r.amount_cents),
        decoy_independent_display: r.is_plug ? money(r.decoy_independent_cents) : null })) } };
}
function reportRecords(reportId) {
  return {
    line_postings: all('SELECT * FROM line_postings WHERE report_id=? ORDER BY line_no', reportId)
      .map((p) => ({ ...p, converted_display: money(p.converted_cents), cap_display: p.cap_cents == null ? null : money(p.cap_cents),
        reimbursable_display: money(p.reimbursable_cents), disallowed_display: money(p.disallowed_cents),
        rate_display: rateDisplay(p.rate_ten_thousandths), vat_contribution_display: money(p.vat_contribution_cents) })),
    disallowances: all('SELECT * FROM disallowances WHERE report_id=? ORDER BY id', reportId)
      .map((d) => ({ ...d, amount_display: money(d.amount_cents) })),
    vat_accruals: all('SELECT * FROM vat_accruals WHERE report_id=? ORDER BY id', reportId)
      .map((a) => ({ ...a, amount_display: money(a.amount_cents), base_display: money(a.base_cents) })),
    vat_net_cents: all("SELECT COALESCE(SUM(amount_cents),0) AS c FROM vat_accruals WHERE report_id=?", reportId)[0].c,
    commitments: all('SELECT * FROM commitments WHERE report_id=? ORDER BY id', reportId)
      .map((c) => ({ ...c, amount_display: money(c.amount_cents) })),
    payout_batches: all('SELECT * FROM payout_batches WHERE report_id=? ORDER BY id', reportId)
      .map((p) => ({ ...p, amount_display: money(p.amount_cents) })),
    recoveries: all('SELECT * FROM recoveries WHERE report_id=? ORDER BY id', reportId)
      .map((r) => ({ ...r, amount_display: money(r.amount_cents) })),
  };
}
function reportView(rep) {
  const c = R.computeReport(db, rep.id);
  const recs = reportRecords(rep.id);
  const liveReimb = all("SELECT COALESCE(SUM(amount_cents),0) AS c FROM commitments WHERE report_id=? AND state='LIVE'", rep.id)[0].c;
  return { ...rep,
    employee: one('SELECT * FROM employees WHERE id=?', rep.employee_id),
    filer: one('SELECT id,name,role FROM users WHERE id=?', rep.filed_by),
    approver: rep.approved_by ? one('SELECT id,name,role FROM users WHERE id=?', rep.approved_by) : null,
    allocation: R.reportAllocation(db, rep.id),
    computed: computedReportView(c),
    records: recs,
    net_report_reimbursable_cents: (recs.commitments.length ? liveReimb : c.reimbursable_total_cents),
    net_report_reimbursable_display: money(recs.commitments.length ? liveReimb : c.reimbursable_total_cents) };
}
function costCenterView(cc) {
  const hr = R.headroomFor(db, cc.id);
  return { ...cc,
    budget_display: money(cc.budget_cents),
    committed_cents: hr.committed_cents, committed_display: money(hr.committed_cents),
    headroom_cents: hr.headroom_cents, headroom_display: money(hr.headroom_cents),
    stored_scalar_headroom_display: money(cc.stored_scalar_headroom_cents),   // decoy
    commitments: all('SELECT * FROM commitments WHERE cost_center_id=? ORDER BY is_prior DESC, id', cc.id)
      .map((c) => ({ ...c, amount_display: money(c.amount_cents) })),
    ledger: all('SELECT * FROM ledger_entries WHERE cost_center_id=? ORDER BY id', cc.id)
      .map((e) => ({ ...e, net_cents: e.debit_cents - e.credit_cents, net_display: money(e.debit_cents - e.credit_cents) })) };
}

// ================================================================= bootstrap / reads
app.get('/api/bootstrap', auth(), (req, res) => {
  res.json({
    user: authView(req.user),
    clock: R.clock(db),
    policy: {
      home_currency: R.HOME,
      per_diem_full_day_cents: dbmod.reference.per_diem_full_day_cents, per_diem_full_day_display: money(dbmod.reference.per_diem_full_day_cents),
      per_diem_block_cents: dbmod.reference.per_diem_block_cents, per_diem_block_display: money(dbmod.reference.per_diem_block_cents),
      per_diem_block_hours: dbmod.reference.per_diem_block_hours,
      mileage_rate_cents_per_mile: dbmod.reference.mileage_rate_cents_per_mile, mileage_rate_display: money(dbmod.reference.mileage_rate_cents_per_mile) + '/mi',
      lodging_nightly_cap_cents: dbmod.reference.lodging_nightly_cap_cents, lodging_nightly_cap_display: money(dbmod.reference.lodging_nightly_cap_cents) + '/night',
      airfare_economy_cap_cents: dbmod.reference.airfare_economy_cap_cents, airfare_economy_cap_display: money(dbmod.reference.airfare_economy_cap_cents),
      vat_inclusive_bp: dbmod.reference.vat_inclusive_bp, vat_inclusive_display: pct(dbmod.reference.vat_inclusive_bp),
      eligible_vat_categories: dbmod.reference.eligible_vat_categories,
      nonreimbursable_categories: dbmod.reference.nonreimbursable_categories,
      tier_manager_max_cents: dbmod.reference.tier_manager_max_cents, tier_manager_max_display: money(dbmod.reference.tier_manager_max_cents),
      tier_director_max_cents: dbmod.reference.tier_director_max_cents, tier_director_max_display: money(dbmod.reference.tier_director_max_cents),
      fx_rates: all('SELECT as_of_date,pair,rate_ten_thousandths FROM fx_rates ORDER BY as_of_date')
        .map((f) => ({ ...f, rate_display: rateDisplay(f.rate_ten_thousandths) })),
    },
    employees: all('SELECT * FROM employees ORDER BY id'),
    cost_centers: all('SELECT * FROM cost_centers ORDER BY id').map(costCenterView),
    reports: all('SELECT * FROM reports ORDER BY id').map(reportView),
    users: all('SELECT id,name,email,role,approval_limit_cents FROM users ORDER BY id')
      .map((u) => ({ ...u, approval_limit_display: money(u.approval_limit_cents) })),
    audit: all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100'),
  });
});
app.get('/api/reports/:id', auth(), (req, res) => {
  const rep = one('SELECT * FROM reports WHERE id=?', req.params.id);
  return rep ? res.json(reportView(rep)) : bad(res, 'no such report', 404);
});
app.get('/api/cost-centers/:id', auth(), (req, res) => {
  const cc = one('SELECT * FROM cost_centers WHERE id=?', req.params.id);
  return cc ? res.json(costCenterView(cc)) : bad(res, 'no such cost center', 404);
});

// ================================================================= file / edit (proxy)
// A proxy files a report on an employee's behalf, and may edit it up until it is
// adjudicated (after that, the line/allocation rows are what the derived spine was
// computed from, and editing them out from under an already-computed report is not
// a correction this system models — it is the clawback path instead). Filing and
// editing are pure CRUD over the SAME line_items/report_allocations tables the
// adjudication engine already reads generically, so no rule in rules.js changes.
function normalizeReportBody(body) {
  const b = body || {};
  const lines = Array.isArray(b.line_items) ? b.line_items : [];
  const allocation = Array.isArray(b.allocation) ? b.allocation : [];
  if (!b.employee_id) return { error: 'an employee is required' };
  if (!b.title) return { error: 'a title is required' };
  if (!b.trip_depart_at || !b.trip_return_at) return { error: 'a trip depart and return instant are required' };
  if (!lines.length) return { error: 'at least one line item is required' };
  if (!allocation.length) return { error: 'a cost-center allocation is required' };
  const plugCount = allocation.filter((a) => Number(a.is_plug) === 1).length;
  if (plugCount !== 1) return { error: 'exactly one cost center in the allocation must be the residual plug' };
  const pctSum = allocation.reduce((s, a) => s + (Number(a.pct_bp) || 0), 0);
  if (pctSum !== 10000) return { error: `allocation shares must sum to 100.00% (10000 bp); got ${pctSum}` };
  for (const l of lines) {
    if (!l.category || !l.txn_date) return { error: 'every line needs a category and a transaction date' };
    if (l.category === 'mileage') {
      if (!(Number(l.miles) > 0)) return { error: 'a mileage line needs a positive mile count' };
    } else if (!(Number(l.amount_cents) > 0)) {
      return { error: 'every non-mileage line needs a positive claimed amount' };
    }
  }
  return { ok: true, lines, allocation };
}
app.post('/api/reports', auth('proxy'), (req, res) => {
  const parsed = normalizeReportBody(req.body);
  if (!parsed.ok) return bad(res, parsed.error, 400);
  const emp = one('SELECT * FROM employees WHERE id=?', req.body.employee_id);
  if (!emp) return bad(res, 'no such employee', 400);
  for (const a of parsed.allocation) if (!one('SELECT * FROM cost_centers WHERE id=?', a.cost_center_id)) return bad(res, `no such cost center ${a.cost_center_id}`, 400);
  const repId = uid('R');
  db.transaction(() => {
    db.prepare(`INSERT INTO reports (id,employee_id,title,filed_by,trip_depart_at,trip_return_at,submitted_date,state,created_at)
      VALUES (?,?,?,?,?,?,?, 'FILED', ?)`).run(repId, emp.id, String(req.body.title), req.user.id,
      String(req.body.trip_depart_at), String(req.body.trip_return_at), now().slice(0, 10), now());
    for (const a of parsed.allocation)
      db.prepare('INSERT INTO report_allocations (report_id,cost_center_id,pct_bp,is_plug) VALUES (?,?,?,?)')
        .run(repId, a.cost_center_id, Number(a.pct_bp), Number(a.is_plug) === 1 ? 1 : 0);
    parsed.lines.forEach((l, i) => {
      db.prepare(`INSERT INTO line_items (id,report_id,line_no,category,currency,amount_cents,miles,txn_date,nights,note)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(uid('LI'), repId, i + 1, String(l.category), String(l.currency || 'USD'),
        l.category === 'mileage' ? null : Number(l.amount_cents), l.category === 'mileage' ? Number(l.miles) : null,
        String(l.txn_date), l.nights != null ? Number(l.nights) : null, l.note || null);
    });
  })();
  audit(req.user.id, 'REPORT_FILED', repId, `employee=${emp.id}`);
  res.status(201).json(reportView(one('SELECT * FROM reports WHERE id=?', repId)));
});
app.patch('/api/reports/:id', auth('proxy'), (req, res) => {
  const rep = one('SELECT * FROM reports WHERE id=?', req.params.id);
  if (!rep) return bad(res, 'no such report', 404);
  if (rep.state !== 'FILED')
    return fail(res, 409, `report ${rep.id} is ${rep.state}; only a filed, not-yet-adjudicated report can be edited`, { report_id: rep.id, state: rep.state });
  const parsed = normalizeReportBody(req.body);
  if (!parsed.ok) return bad(res, parsed.error, 400);
  const emp = one('SELECT * FROM employees WHERE id=?', req.body.employee_id);
  if (!emp) return bad(res, 'no such employee', 400);
  for (const a of parsed.allocation) if (!one('SELECT * FROM cost_centers WHERE id=?', a.cost_center_id)) return bad(res, `no such cost center ${a.cost_center_id}`, 400);
  db.transaction(() => {
    db.prepare('UPDATE reports SET employee_id=?, title=?, trip_depart_at=?, trip_return_at=? WHERE id=?')
      .run(emp.id, String(req.body.title), String(req.body.trip_depart_at), String(req.body.trip_return_at), rep.id);
    db.prepare('DELETE FROM report_allocations WHERE report_id=?').run(rep.id);
    db.prepare('DELETE FROM line_items WHERE report_id=?').run(rep.id);
    for (const a of parsed.allocation)
      db.prepare('INSERT INTO report_allocations (report_id,cost_center_id,pct_bp,is_plug) VALUES (?,?,?,?)')
        .run(rep.id, a.cost_center_id, Number(a.pct_bp), Number(a.is_plug) === 1 ? 1 : 0);
    parsed.lines.forEach((l, i) => {
      db.prepare(`INSERT INTO line_items (id,report_id,line_no,category,currency,amount_cents,miles,txn_date,nights,note)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(uid('LI'), rep.id, i + 1, String(l.category), String(l.currency || 'USD'),
        l.category === 'mileage' ? null : Number(l.amount_cents), l.category === 'mileage' ? Number(l.miles) : null,
        String(l.txn_date), l.nights != null ? Number(l.nights) : null, l.note || null);
    });
  })();
  audit(req.user.id, 'REPORT_EDITED', rep.id, `employee=${emp.id}`);
  res.json(reportView(one('SELECT * FROM reports WHERE id=?', rep.id)));
});

// ================================================================= adjudicate (finance)
// Compute the FX -> cap -> VAT spine from the stored lines and MINT the per-line
// postings, the disallowed-excess rows (only where the excess is positive), and the
// VAT-reclaim accrual on the eligible post-cap base — together.
app.post('/api/reports/:id/adjudicate', auth('finance'), (req, res) => {
  const rep = one('SELECT * FROM reports WHERE id=?', req.params.id);
  if (!rep) return bad(res, 'no such report', 404);
  if (rep.state !== 'FILED')
    return fail(res, 409, `report ${rep.id} is ${rep.state}; it has already been adjudicated`,
      { report_id: rep.id, state: rep.state });
  const c = R.computeReport(db, rep.id);
  db.transaction(() => {
    for (const l of c.lines) {
      db.prepare(`INSERT INTO line_postings (id,report_id,line_id,line_no,category,currency,claimed_cents,txn_date,
        rate_ten_thousandths,converted_cents,cap_kind,cap_cents,reimbursable_cents,disallowed_cents,vat_eligible,vat_contribution_cents,created_by,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        uid('LP'), rep.id, l.line_id, l.line_no, l.category, l.currency, l.claimed_cents, l.txn_date,
        l.rate_ten_thousandths, l.converted_cents, l.cap_kind, l.cap_cents, l.reimbursable_cents, l.disallowed_cents,
        l.vat_eligible, l.vat_contribution_cents, req.user.id, now());
      if (l.disallowed_cents > 0)
        db.prepare(`INSERT INTO disallowances (id,report_id,line_id,category,amount_cents,reason,created_at)
          VALUES (?,?,?,?,?,?,?)`).run(uid('DIS'), rep.id, l.line_id, l.category, l.disallowed_cents,
          `${l.cap_kind || 'policy'} cap on the converted base`, now());
    }
    if (c.vat_eligible_base_cents > 0)
      db.prepare(`INSERT INTO vat_accruals (id,report_id,base_cents,amount_cents,kind,is_reversal,note,created_at)
        VALUES (?,?,?,?,'RECLAIM',0,?,?)`).run(uid('VAT'), rep.id, c.vat_eligible_base_cents, c.vat_accrual_cents,
        'VAT reclaim on the eligible post-cap base', now());
    db.prepare("UPDATE reports SET state='ADJUDICATED', adjudicated_at=? WHERE id=?").run(now(), rep.id);
  })();
  audit(req.user.id, 'REPORT_ADJUDICATED', rep.id, `${c.reimbursable_total_cents}|disallowed=${c.disallowed_total_cents}|vat=${c.vat_accrual_cents}`);
  res.json({ adjudicated: true, report_id: rep.id, ...computedReportView(c), records: reportRecords(rep.id) });
});

// ================================================================= approve (approver, by tier)
// The tier is decided by the SERVER-computed reimbursable, not the claim. The
// approver must cover that amount; the refusal names the required tier and the
// figure. The approver may not be the person who FILED the report. Identity and the
// amount come from the session and the server — a role/actor/approver/tier/amount in
// the body is ignored.
app.post('/api/reports/:id/approve', auth('approver'), (req, res) => {
  const rep = one('SELECT * FROM reports WHERE id=?', req.params.id);
  if (!rep) return bad(res, 'no such report', 404);
  if (rep.state === 'FILED') return fail(res, 409, `report ${rep.id} must be adjudicated before approval`, { report_id: rep.id, state: rep.state });
  if (rep.state !== 'ADJUDICATED') return fail(res, 409, `report ${rep.id} is ${rep.state} and is not awaiting approval`, { report_id: rep.id, state: rep.state });
  // Separation of duties: the approver may not be the filer.
  if (rep.filed_by === req.user.id)
    return fail(res, 409, `the person who filed report ${rep.id} may not approve it (separation of duties)`,
      { report_id: rep.id, filed_by: rep.filed_by, approver_id: req.user.id, distinct_humans_required: 2 });
  // The amount is the server-computed reimbursable, SUMMED from the stored postings.
  const amount = all("SELECT COALESCE(SUM(reimbursable_cents),0) AS c FROM line_postings WHERE report_id=?", rep.id)[0].c;
  const requiredTier = R.requiredTier(amount);
  if (!R.approverCovers(req.user, amount))
    return fail(res, 403, `report ${rep.id} computes to ${money(amount)}, which needs a ${requiredTier}-tier approver; ${req.user.name} cannot approve above ${money(req.user.approval_limit_cents)}`,
      { report_id: rep.id, computed_reimbursable_cents: amount, computed_reimbursable_display: money(amount),
        required_tier: requiredTier, your_limit_cents: req.user.approval_limit_cents,
        claimed_amount_ignored: (req.body || {}).amount_cents ?? null });
  db.transaction(() => {
    db.prepare("UPDATE reports SET state='APPROVED', approved_by=?, approved_tier=?, approved_at=? WHERE id=?")
      .run(req.user.id, requiredTier, now(), rep.id);
  })();
  audit(req.user.id, 'REPORT_APPROVED', rep.id, `${amount}|${requiredTier}`);
  res.json({ approved: true, report_id: rep.id, approver_id: req.user.id, approved_tier: requiredTier,
    computed_reimbursable_cents: amount, computed_reimbursable_display: money(amount),
    ...computedReportView(R.computeReport(db, rep.id)) });
});

// ================================================================= post (finance)
// Mint the cost-center commitments (residual-plug split) that move each center's
// headroom, and the payout twin. Requires an approved report.
app.post('/api/reports/:id/post', auth('finance'), (req, res) => {
  const rep = one('SELECT * FROM reports WHERE id=?', req.params.id);
  if (!rep) return bad(res, 'no such report', 404);
  if (rep.state === 'POSTED') return fail(res, 409, `report ${rep.id} is already posted; a duplicate post commits nothing more`, { report_id: rep.id, state: rep.state });
  if (rep.state !== 'APPROVED') return fail(res, 409, `report ${rep.id} must be approved before it is posted`, { report_id: rep.id, state: rep.state });
  const c = R.computeReport(db, rep.id);
  db.transaction(() => {
    for (const r of c.split.rows) {
      db.prepare(`INSERT INTO commitments (id,report_id,cost_center_id,amount_cents,pct_bp,is_plug,state,is_prior,note,created_by,created_at)
        VALUES (?,?,?,?,?,?,'LIVE',0,?,?,?)`).run(uid('CM'), rep.id, r.cost_center_id, r.amount_cents, r.pct_bp, r.is_plug,
        `${r.is_plug ? 'Residual-plug' : 'Allocated'} commitment on ${rep.id}`, req.user.id, now());
      db.prepare(`INSERT INTO ledger_entries (account,cost_center_id,report_id,ref,description,debit_cents,credit_cents,created_at)
        VALUES ('CC_COMMITMENT',?,?,?,?,?,0,?)`).run(r.cost_center_id, rep.id, rep.id,
        `Commitment on ${rep.id}`, r.amount_cents, now());
    }
    db.prepare(`INSERT INTO payout_batches (id,report_id,amount_cents,state,created_at) VALUES (?,?,?,'PAID',?)`)
      .run(uid('PB'), rep.id, c.reimbursable_total_cents, now());
    db.prepare("UPDATE reports SET state='POSTED', posted_at=? WHERE id=?").run(now(), rep.id);
  })();
  audit(req.user.id, 'REPORT_POSTED', rep.id, `${c.reimbursable_total_cents}|${rep.approved_tier}`);
  res.json({ posted: true, report_id: rep.id, ...computedReportView(c), records: reportRecords(rep.id),
    cost_centers: c.split.rows.map((r) => costCenterView(one('SELECT * FROM cost_centers WHERE id=?', r.cost_center_id))) });
});

// ================================================================= reject a receipt (finance clawback)
// A rejected receipt SUPERSEDES the report's CURRENTLY LIVE commitments (whatever
// generation they are — the original, or an earlier rejection's own fresh netted
// row), re-derives the split on the CURRENT live total less this line's reimbursed
// amount, posts a contra that restores each center's headroom, reverses the
// receipt's VAT reclaim, and raises an employee recovery at the POST-CAP reimbursed
// figure. A line never reimbursed (fully disallowed) claws back NOTHING. A report
// may have more than one receipt rejected over its life; each repeats this same path
// against whatever the previous rejection actually left live, never against the
// report's original total, so two rejections on the same report compound correctly.
app.post('/api/reports/:id/reject-receipt', auth('finance'), (req, res) => {
  const rep = one('SELECT * FROM reports WHERE id=?', req.params.id);
  if (!rep) return bad(res, 'no such report', 404);
  if (rep.state !== 'POSTED') return fail(res, 409, `report ${rep.id} is ${rep.state}; only a posted report can have a receipt rejected`, { report_id: rep.id, state: rep.state });
  const lineId = (req.body || {}).line_id;
  const posting = one('SELECT * FROM line_postings WHERE report_id=? AND line_id=?', rep.id, lineId);
  if (!posting) return bad(res, 'no such line on this report', 404);
  const already = one("SELECT * FROM recoveries WHERE report_id=? AND line_id=?", rep.id, lineId);
  if (already) return fail(res, 409, `the receipt on line ${lineId} has already been rejected`, { report_id: rep.id, line_id: lineId });
  const removed = posting.reimbursable_cents;
  if (removed <= 0)
    return fail(res, 409, `line ${lineId} was reimbursed ${money(0)}; a fully-disallowed line has nothing to claw back`,
      { report_id: rep.id, line_id: lineId, reimbursable_display: money(0) });

  // Read the CURRENT live commitments — not the original mint. On a second (or
  // later) rejection this is already the previous rejection's fresh netted row, so
  // this rejection nets against what is actually on file right now.
  const liveOld = all("SELECT * FROM commitments WHERE report_id=? AND state='LIVE'", rep.id);
  const oldTotal = liveOld.reduce((a, r) => a + r.amount_cents, 0);
  const newTotal = oldTotal - removed;
  const allocation = R.reportAllocation(db, rep.id);
  const split = R.splitReport(newTotal, allocation);
  const emp = one('SELECT * FROM reports WHERE id=?', rep.id).employee_id;
  const recId = uid('REC'), out = {};
  db.transaction(() => {
    // supersede the CURRENT live commitments and mint the fresh netted ones
    const oldByCc = {}; for (const o of liveOld) oldByCc[o.cost_center_id] = o;
    for (const r of split.rows) {
      const oldRow = oldByCc[r.cost_center_id];
      const newId = uid('CM');
      if (oldRow) db.prepare("UPDATE commitments SET state='SUPERSEDED', superseded_by_id=? WHERE id=?").run(newId, oldRow.id);
      db.prepare(`INSERT INTO commitments (id,report_id,cost_center_id,amount_cents,pct_bp,is_plug,state,is_prior,supersedes_id,note,created_by,created_at)
        VALUES (?,?,?,?,?,?,'LIVE',0,?,?,?,?)`).run(newId, rep.id, r.cost_center_id, r.amount_cents, r.pct_bp, r.is_plug,
        oldRow ? oldRow.id : null, `Re-derived after rejecting ${lineId}`, req.user.id, now());
      const delta = r.amount_cents - (oldRow ? oldRow.amount_cents : 0);   // negative: the contra
      db.prepare(`INSERT INTO ledger_entries (account,cost_center_id,report_id,ref,description,debit_cents,credit_cents,created_at)
        VALUES ('CC_CONTRA',?,?,?,?,0,?,?)`).run(r.cost_center_id, rep.id, recId,
        `Contra restoring ${r.cost_center_id} headroom after rejecting ${lineId}`, Math.abs(Math.min(delta, 0)), now());
    }
    // reverse the receipt's VAT reclaim (a negative accrual row)
    if (posting.vat_eligible && posting.vat_contribution_cents > 0)
      db.prepare(`INSERT INTO vat_accruals (id,report_id,base_cents,amount_cents,kind,is_reversal,reverses_id,note,created_at)
        VALUES (?,?,?,?,'REVERSAL',1,?,?,?)`).run(uid('VAT'), rep.id, -posting.reimbursable_cents, -posting.vat_contribution_cents,
        posting.id, `VAT reclaim reversed on rejected receipt ${lineId}`, now());
    // raise the employee recovery at the POST-CAP reimbursed figure
    db.prepare(`INSERT INTO recoveries (id,report_id,line_id,employee_id,amount_cents,note,created_at)
      VALUES (?,?,?,?,?,?,?)`).run(recId, rep.id, lineId, emp, removed,
      `Employee recovery for rejected receipt ${lineId} (post-cap reimbursed figure)`, now());
  })();
  audit(req.user.id, 'RECEIPT_REJECTED', rep.id, `${lineId}|recovery=${removed}|net=${newTotal}`);
  const vatNet = all("SELECT COALESCE(SUM(amount_cents),0) AS c FROM vat_accruals WHERE report_id=?", rep.id)[0].c;
  out.rejected = true; out.report_id = rep.id; out.line_id = lineId;
  out.recovery_id = recId; out.recovery_cents = removed; out.recovery_display = money(removed);
  out.net_report_reimbursable_cents = newTotal; out.net_report_reimbursable_display = money(newTotal);
  out.contra_total_cents = -removed; out.contra_total_display = money(-removed);
  out.vat_net_cents = vatNet; out.vat_net_display = money(vatNet);
  out.records = reportRecords(rep.id);
  out.cost_centers = split.rows.map((r) => costCenterView(one('SELECT * FROM cost_centers WHERE id=?', r.cost_center_id)));
  res.json(out);
});

// ================================================================= append-only audit trail
app.get('/api/audit', auth(), (_req, res) => res.json({ audit: all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200') }));
app.all('/api/audit', (req, res, next) => {
  if (req.method === 'GET') return next();
  return fail(res, 405, 'the audit trail is append-only; entries cannot be edited or deleted');
});
// Express 5 / path-to-regexp v8 rejects a bare trailing '*' segment; a named
// wildcard ('*splat') is required to match any sub-path under /api/audit/.
app.all('/api/audit/*splat', (_req, res) => fail(res, 405, 'the audit trail is append-only; entries cannot be edited or deleted'));

// ================================================================= fallthrough
app.use('/api', (_req, res) => res.status(404).json({ error: 'no such endpoint' }));
// A path-less middleware (not app.get('*', ...)) avoids the same Express 5 bare
// -wildcard rejection for the SPA fallthrough.
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    const idx = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(idx)) return res.sendFile(idx);
    return res.status(200).type('html').send('<!doctype html><title>ExpenseFlow</title><p>ExpenseFlow T&E reimbursement API is running.</p>');
  }
  next();
});

app.listen(PORT, '0.0.0.0', () => console.log(`[expenseflow] listening on ${PORT}`));
module.exports = app;

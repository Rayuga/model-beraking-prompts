'use strict';
// hireops HTTP layer. A recruiting-operations + compensation back-office (offer &
// clawback desk).
//
// Non-negotiables:
//  - /health answers immediately, never gated on seeding or the database.
//  - Identity comes ONLY from the session cookie. A role, actor, approver, band or
//    amount in a request body is a CLAIM, never authority; every decision is
//    recomputed from stored records and the session identity.
//  - No wall clock: referral vesting uses the one stored reference moment; signing/
//    equity clawback uses a rescission's OWN stored effective date.
//  - Money is integer cents; percentages integer basis points; round half-up once.
//  - Every approve/revise/rescind writes an append-only after-image + audit row;
//    corrections are additions (supersede + contra + release), never edits/deletes.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const dbmod = require('./db');
const R = require('./rules');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Health is answered before any DB access and is never gated on seeding.
app.get('/health', (_req, res) => res.json({ ok: true, service: 'hireops' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'hireops' }));

let db = null;
try { db = dbmod.open(); }
catch (e) { console.error('[hireops] database open failed:', e.message); }

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));

function cookieParser(req, _res, next) {
  req.cookies = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) { try { req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch {} }
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
function afterImage(offerId, action, actorId, figures) {
  db.prepare('INSERT INTO after_images (offer_id,action,actor_id,figures_json,created_at) VALUES (?,?,?,?,?)')
    .run(offerId, action, actorId || null, JSON.stringify(figures), now());
}

function money(c) {
  if (c === null || c === undefined) return null;
  const s = c < 0 ? '-' : '', a = Math.abs(c);
  return `${s}$${Math.floor(a / 100).toLocaleString('en-US')}.${String(a % 100).padStart(2, '0')}`;
}
const bp = (b) => (b === null || b === undefined) ? null : `${Math.floor(b / 100)}.${String(b % 100).padStart(2, '0')}%`;
const romanTier = (t) => ({ 1: 'I', 2: 'II', 3: 'III' })[t] || String(t);

// Identity is resolved from the session ONLY.
function currentUser(req) {
  const t = req.cookies.hireops_session;
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
  res.setHeader('Set-Cookie', `hireops_session=${token}; Path=/; HttpOnly; SameSite=Lax`);
  audit(u.id, 'LOGIN', u.id, null);
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role, authority_tier: u.authority_tier });
});
app.post('/api/auth/logout', (req, res) => {
  const t = req.cookies.hireops_session;
  if (t) db.prepare('DELETE FROM sessions WHERE token=?').run(t);
  res.setHeader('Set-Cookie', 'hireops_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
  res.json({ ok: true });
});
app.get('/api/auth/me', (req, res) => {
  const u = currentUser(req);
  if (!u) return bad(res, 'authentication required', 401);
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role, authority_tier: u.authority_tier });
});

// ================================================================= views
const userBrief = (id) => id ? one('SELECT id,name,role,authority_tier FROM users WHERE id=?', id) : null;

function compositionView(o) {
  const c = R.composition(o);
  return { ...c,
    base_salary_display: money(c.base_salary_cents), signing_bonus_display: money(c.signing_bonus_cents),
    relocation_display: money(c.relocation_cents),
    equity_intrinsic_display: money(c.equity_intrinsic_cents),
    equity_fair_display: money(c.equity_fair_cents),
    equity_strike_display: money(c.equity_strike_cents),
    equity_annualized_display: money(c.equity_annualized_cents),
    committed_run_rate_display: money(c.committed_run_rate_cents),
    band_basis_display: money(c.band_basis_cents),
    required_tier_label: romanTier(c.required_tier),
  };
}

function offerView(o) {
  const comp = compositionView(o);
  const grant = one('SELECT * FROM equity_grants WHERE offer_id=? ORDER BY id', o.id);
  const cancellation = one('SELECT * FROM equity_cancellations WHERE offer_id=? ORDER BY id DESC', o.id);
  const lineage = R.lineageIds(db, o.id);
  const accrual = one('SELECT * FROM referral_accruals WHERE offer_id=? ORDER BY id', lineage[0]);
  const outflow = R.netSigningOutflow(db, o.id);
  const remits = outflow.rows
    .map((r) => ({ ...r, amount_display: money(r.amount_cents) }));
  const commits = all('SELECT * FROM commitment_movements WHERE offer_id=? ORDER BY id', o.id)
    .map((m) => ({ ...m, movement_display: money(m.movement_cents) }));

  const v = {
    id: o.id, req_id: o.req_id, candidate: o.candidate, status: o.status,
    lineage_ids: lineage, lineage_root_id: lineage[0],
    start_date: o.start_date, referred_by: o.referred_by, referred_hire_start: o.referred_hire_start,
    supersedes_id: o.supersedes_id, superseded_by_id: o.superseded_by_id,
    rescinded_at: o.rescinded_at, rescission_effective_at: o.rescission_effective_at,
    raised_by: o.raised_by, approved_by: o.approved_by, approved_at: o.approved_at,
    raiser: userBrief(o.raised_by), approver: userBrief(o.approved_by),
    composition: comp,
    equity_grant: grant ? { ...grant, cancelled: null } : null,
    referral_accrual: accrual ? referralAccrualView(accrual) : null,
    remittances: remits,
    net_signing_outflow_cents: outflow.net_signing_outflow_cents,
    net_signing_outflow_display: money(outflow.net_signing_outflow_cents),
    commitment_movements: commits,
  };
  // A rescinded offer surfaces its clawback and equity-cancellation figures,
  // computed at ITS OWN stored effective date rather than any wall clock.
  if (o.status === 'RESCINDED' && o.rescission_effective_at) {
    const claw = R.signingClawback(o, o.rescission_effective_at);
    v.clawback = { ...claw,
      signing_paid_display: money(claw.signing_paid_cents),
      signing_vested_display: money(claw.signing_vested_cents),
      clawback_display: money(claw.clawback_cents), vested_pct: bp(claw.vested_bp) };
    if (grant) {
      const ec = R.equityCancellation(grant, o.rescission_effective_at);
      v.equity_grant.cancelled = { ...ec, vested_pct: bp(ec.vested_bp) };
    }
  }
  if (cancellation) v.equity_cancellation = cancellation;
  return v;
}

function referralAccrualView(ra) {
  const rv = R.referralVested(ra, now());
  return { ...ra, ...rv,
    referrer: one('SELECT id,name FROM employees WHERE id=?', ra.referrer_id),
    total_display: money(rv.total_cents), at_hire_display: money(rv.at_hire_cents),
    contingent_display: money(rv.contingent_cents), vested_display: money(rv.vested_cents) };
}

function reqView(r) {
  const hr = R.headroom(db, r.id);
  return {
    id: r.id, title: r.title, dept: r.dept, note: r.note,
    budget_cents: r.budget_cents,
    movements: all('SELECT kind,offer_id,movement_cents FROM commitment_movements WHERE req_id=? ORDER BY id', r.id)
      .map((m) => ({ ...m, movement_display: money(m.movement_cents) })),
    budget_display: money(r.budget_cents),
    headroom_cents: hr.headroom_cents, headroom_display: money(hr.headroom_cents),
    committed_sum_cents: hr.committed_sum_cents, committed_sum_display: money(hr.committed_sum_cents),
    offers: all('SELECT id FROM offers WHERE req_id=? ORDER BY id', r.id).map((x) => x.id) };
}

// ================================================================= bootstrap / reads
app.get('/api/bootstrap', auth(), (req, res) => {
  res.json({
    user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, authority_tier: req.user.authority_tier },
    clock: R.clock(db),
    constants: dbmod.reference.constants,
    requisitions: all('SELECT * FROM requisitions ORDER BY id').map(reqView),
    offers: all('SELECT * FROM offers ORDER BY id').map(offerView),
    referral_accruals: all('SELECT * FROM referral_accruals ORDER BY id').map(referralAccrualView),
    commitment_movements: all('SELECT * FROM commitment_movements ORDER BY id')
      .map((m) => ({ ...m, movement_display: money(m.movement_cents) })),
    equity_grants: all('SELECT * FROM equity_grants ORDER BY id'),
    equity_cancellations: all('SELECT * FROM equity_cancellations ORDER BY id'),
    remittances: all('SELECT * FROM remittances ORDER BY id').map((r) => ({ ...r, amount_display: money(r.amount_cents) })),
    after_images: all('SELECT * FROM after_images ORDER BY id')
      .map((a) => ({ ...a, figures: safeParse(a.figures_json) })),
    users: all('SELECT id,name,email,role,authority_tier FROM users ORDER BY id'),
    employees: all('SELECT * FROM employees ORDER BY id'),
    audit: all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 5000'),
  });
});
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

app.get('/api/offers/:id', auth(), (req, res) => {
  const o = one('SELECT * FROM offers WHERE id=?', req.params.id);
  return o ? res.json(offerView(o)) : bad(res, 'no such offer', 404);
});
app.get('/api/requisitions/:id', auth(), (req, res) => {
  const r = one('SELECT * FROM requisitions WHERE id=?', req.params.id);
  return r ? res.json(reqView(r)) : bad(res, 'no such requisition', 404);
});

// Validation precedes writes. Express converts our explicit errors into safe JSON.
function reject(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
function idValue(value, label) {
  if (typeof value !== 'string' || !value.trim()) reject(`${label} must be a nonblank string`);
  return value;
}
function integer(value, label) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    reject(`${label} must be a nonnegative safe integer`);
  return value;
}
function dateValue(value, label) {
  if (!R.validDate(value)) reject(`${label} must be a real UTC date or ISO instant ending in Z`);
  return value;
}
const economicKeys = ['base_salary_cents', 'signing_bonus_cents', 'relocation_cents', 'equity_units', 'equity_fair_cents', 'equity_strike_cents'];
function economics(body, prior = null) {
  const result = {};
  for (const key of economicKeys) result[key] = integer(Object.hasOwn(body, key) ? body[key] : (prior ? prior[key] : 0), key);
  R.composition(result); // Also checks derived integer ranges before persistence.
  return result;
}
function movement(o, kind, cents, ref) {
  db.prepare('INSERT INTO commitment_movements (req_id,offer_id,kind,movement_cents,ref,created_at) VALUES (?,?,?,?,?,?)')
    .run(o.req_id, o.id, kind, cents, ref || o.id, now());
}
function remit(o, kind, cents) {
  db.prepare('INSERT INTO remittances (id,offer_id,kind,amount_cents,ref,created_at) VALUES (?,?,?,?,?,?)')
    .run(`RM-${o.id}-${kind}`, o.id, kind, cents, o.id, now());
}
function mintGrant(o) {
  if (!o.equity_units) return;
  const v = dbmod.reference.constants.equity_vesting;
  db.prepare('INSERT INTO equity_grants (id,offer_id,units,strike_cents,fair_cents,grant_date,schedule_note,state,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(`GR-${o.id}`, o.id, o.equity_units, o.equity_strike_cents, o.equity_fair_cents, o.start_date,
      `${v.cliff_bp / 100}% at the ${v.cliff_months}-month cliff, then +${v.monthly_bp / 100}% per completed month to 100% at ${v.full_months} months`, 'LIVE', now());
}
function snapshot(o) {
  const view = offerView(o);
  return { ...view, headroom_cents: R.headroom(db, o.req_id).headroom_cents };
}
function validateDashboardTotal() {
  R.sumSafe(...all('SELECT id FROM requisitions').map(r => R.headroom(db, r.id).headroom_cents));
}
function receipt(action, actor, before, after, settlement = {}) {
  validateDashboardTotal();
  afterImage(after.id, action, actor.id, { actor_id: actor.id, actor_name: actor.name, actor_role: actor.role, before, after, ...settlement });
  audit(actor.id, `OFFER_${{ APPROVE: 'APPROVED', REVISE: 'REVISED', RESCIND: 'RESCINDED' }[action]}`, after.id,
    `${before.candidate}: ${before.id} ${before.status} -> ${after.id} ${after.status}; `
    + `headroom ${money(before.headroom_cents)} -> ${money(after.headroom_cents)}; `
    + `run-rate ${money(before.composition.committed_run_rate_cents)} -> ${money(after.composition.committed_run_rate_cents)}; `
    + `signing net ${money(before.net_signing_outflow_cents)} -> ${money(after.net_signing_outflow_cents)}`);
}
function storedOffer(id, status) {
  const o = one('SELECT * FROM offers WHERE id=?', id);
  if (!o) reject('no such offer', 404);
  if (o.status !== status || o.superseded_by_id) reject(`offer ${o.id} is ${o.status}; action requires current ${status}`, 409);
  return o;
}
function budgetCheck(rate, available) {
  if (rate > available) reject(`committed run-rate ${money(rate)} exceeds available headroom ${money(available)}; shortfall ${money(rate - available)}`, 409);
}

app.post('/api/requisitions', auth(), (req, res) => {
  const b = req.body || {}, id = idValue(b.id, 'requisition id');
  if (one('SELECT id FROM requisitions WHERE id=?', id)) reject('requisition id already exists', 409);
  const budget = integer(b.budget_cents, 'budget_cents');
  db.transaction(() => {
    db.prepare('INSERT INTO requisitions (id,title,dept,budget_cents,stated_headroom_scalar_cents,note) VALUES (?,?,?,?,?,?)')
      .run(id, String(b.title || 'Untitled requisition'), String(b.dept || 'General'), budget, 0, b.note == null ? null : String(b.note));
    validateDashboardTotal();
    audit(req.user.id, 'REQUISITION_CREATED', id, String(b.title || ''));
  })();
  res.json({ created: true, ...reqView(one('SELECT * FROM requisitions WHERE id=?', id)) });
});

app.post('/api/offers', auth('recruiter', 'comp_partner', 'approver', 'finance_controller'), (req, res) => {
  const b = req.body || {}, id = idValue(b.id, 'offer id');
  if (one('SELECT id FROM offers WHERE id=?', id)) reject('offer id already exists', 409);
  const reqId = idValue(b.req_id, 'requisition id');
  if (!one('SELECT id FROM requisitions WHERE id=?', reqId)) reject('a valid requisition is required');
  const candidate = idValue(b.candidate, 'candidate'), e = economics(b);
  const start = dateValue(b.start_date, 'offer start date');
  const referrer = b.referred_by == null || b.referred_by === '' ? null : idValue(b.referred_by, 'referrer');
  if (referrer && !one('SELECT id FROM employees WHERE id=?', referrer)) reject('a valid referring employee is required');
  const referralStart = referrer ? dateValue(b.referred_hire_start, 'referred hire start date') : null;
  db.transaction(() => {
    db.prepare(`INSERT INTO offers (id,req_id,candidate,status,base_salary_cents,signing_bonus_cents,relocation_cents,
      equity_units,equity_fair_cents,equity_strike_cents,referred_by,referred_hire_start,start_date,raised_by,raised_at,note)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, reqId, candidate, 'PENDING', ...economicKeys.map(k => e[k]), referrer, referralStart, start, req.user.id, now(), b.note == null ? null : String(b.note));
    audit(req.user.id, 'OFFER_DRAFTED', id, `${candidate} on ${reqId}`);
  })();
  res.json({ created: true, ...offerView(one('SELECT * FROM offers WHERE id=?', id)) });
});

app.post('/api/offers/:id/approve', auth('approver'), (req, res) => {
  let after;
  db.transaction(() => {
    const o = storedOffer(req.params.id, 'PENDING'), before = snapshot(o), comp = R.composition(o);
    if (req.user.id === o.raised_by) reject('the person who raised an offer may not approve it', 409);
    if ((req.user.authority_tier || 0) < comp.required_tier)
      reject(`held authority tier ${req.user.authority_tier || 0} does not meet required tier ${comp.required_tier}`, 403);
    budgetCheck(comp.committed_run_rate_cents, before.headroom_cents);
    db.prepare("UPDATE offers SET status='COMMITTED',approved_by=?,approved_at=? WHERE id=?").run(req.user.id, now(), o.id);
    movement(o, 'COMMIT', -comp.committed_run_rate_cents);
    mintGrant(o);
    if (o.signing_bonus_cents) remit(o, 'SIGNING', o.signing_bonus_cents);
    if (o.referred_by) {
      const c = dbmod.reference.constants, atHire = R.halfUpRatio(BigInt(c.referral_bonus_cents) * BigInt(c.referral_at_hire_bp), 10000);
      db.prepare('INSERT INTO referral_accruals (id,offer_id,referrer_id,candidate,referred_hire_start,total_cents,at_hire_cents,contingent_cents,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(`RA-${o.id}`, o.id, o.referred_by, o.candidate, o.referred_hire_start, c.referral_bonus_cents, atHire, c.referral_bonus_cents - atHire, now());
    }
    after = snapshot(one('SELECT * FROM offers WHERE id=?', o.id));
    receipt('APPROVE', req.user, before, after);
  })();
  res.json({ approved: true, ...after, req_headroom_cents: after.headroom_cents, req_headroom_display: money(after.headroom_cents) });
});

app.post('/api/offers/:id/revise', auth('recruiter', 'approver', 'finance_controller'), (req, res) => {
  let before, after, old;
  db.transaction(() => {
    const o = storedOffer(req.params.id, 'COMMITTED');
    before = snapshot(o);
    const e = economics(req.body || {}, o), comp = R.composition(e);
    const available = R.sumSafe(before.headroom_cents, before.composition.committed_run_rate_cents);
    budgetCheck(comp.committed_run_rate_cents, available);
    let id = `${o.id}-R`;
    while (one('SELECT id FROM offers WHERE id=?', id)) id = uid('OFF');
    const revised = { ...o, ...e, id };
    db.prepare(`INSERT INTO offers (id,req_id,candidate,status,base_salary_cents,signing_bonus_cents,relocation_cents,
      equity_units,equity_fair_cents,equity_strike_cents,referred_by,referred_hire_start,start_date,
      raised_by,raised_at,approved_by,approved_at,supersedes_id,note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, o.req_id, o.candidate, 'COMMITTED', ...economicKeys.map(k => e[k]), o.referred_by, o.referred_hire_start,
        o.start_date, o.raised_by, o.raised_at, o.approved_by, o.approved_at, o.id, `Revision of ${o.id}`);
    db.prepare("UPDATE offers SET status='SUPERSEDED',superseded_by_id=? WHERE id=?").run(id, o.id);
    movement(o, 'REVERSAL', before.composition.committed_run_rate_cents, id);
    movement(revised, 'COMMIT', -comp.committed_run_rate_cents);
    const delta = e.signing_bonus_cents - o.signing_bonus_cents;
    if (delta !== 0) remit(revised, 'SIGNING_ADJUSTMENT', delta);
    db.prepare("UPDATE equity_grants SET state='SUPERSEDED' WHERE offer_id=?").run(o.id);
    mintGrant(revised);
    after = snapshot(one('SELECT * FROM offers WHERE id=?', id));
    old = offerView(one('SELECT * FROM offers WHERE id=?', o.id));
    receipt('REVISE', req.user, before, after, { signing_adjustment_cents: delta });
  })();
  res.json({ revised: true, revised_offer_id: after.id, superseded_offer_id: before.id,
    reversal_cents: before.composition.committed_run_rate_cents, reversal_display: money(before.composition.committed_run_rate_cents),
    fresh_commit_cents: after.composition.committed_run_rate_cents, fresh_commit_display: money(after.composition.committed_run_rate_cents),
    req_headroom_cents: after.headroom_cents, req_headroom_display: money(after.headroom_cents), revised_offer: after, superseded_offer: old });
});

app.post('/api/offers/:id/rescind', auth('finance_controller'), (req, res) => {
  let after, claw, ec;
  const effective = dateValue((req.body || {}).effective_at, 'rescission effective date');
  db.transaction(() => {
    const o = storedOffer(req.params.id, 'COMMITTED'), before = snapshot(o);
    claw = R.signingClawback(o, effective);
    const grant = one("SELECT * FROM equity_grants WHERE offer_id=? AND state='LIVE'", o.id);
    ec = grant ? R.equityCancellation(grant, effective) : null;
    db.prepare("UPDATE offers SET status='RESCINDED',rescinded_at=?,rescission_effective_at=? WHERE id=?").run(now(), effective, o.id);
    movement(o, 'RELEASE', before.composition.committed_run_rate_cents);
    if (claw.clawback_cents > 0) remit(o, 'CLAWBACK_CONTRA', claw.clawback_cents);
    if (ec && ec.cancelled_units > 0) {
      db.prepare('INSERT INTO equity_cancellations (id,grant_id,offer_id,effective_at,vested_units,cancelled_units,ref,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(`EC-${o.id}`, grant.id, o.id, effective, ec.vested_units, ec.cancelled_units, o.id, now());
      db.prepare("UPDATE equity_grants SET state='CANCELLED_PARTIAL' WHERE id=?").run(grant.id);
    }
    after = snapshot(one('SELECT * FROM offers WHERE id=?', o.id));
    receipt('RESCIND', req.user, before, after, { effective_at: effective, signing_settlement: claw, equity_settlement: ec });
  })();
  res.json({ rescinded: true, ...after, effective_at: effective,
    clawback_cents: claw.clawback_cents, clawback_display: money(claw.clawback_cents),
    signing_vested_cents: claw.signing_vested_cents, signing_vested_display: money(claw.signing_vested_cents),
    contra_minted: claw.clawback_cents > 0, equity_cancelled_units: ec ? ec.cancelled_units : 0,
    equity_vested_units: ec ? ec.vested_units : 0, req_headroom_cents: after.headroom_cents, req_headroom_display: money(after.headroom_cents) });
});

// ================================================================= append-only trail (edits/deletes refused)
function trailImmutable(_req, res) {
  return res.status(405).json({ error: 'the audit trail and after-images are append-only; entries cannot be edited or deleted' });
}
app.put('/api/after_images/:id', auth(), trailImmutable);
app.patch('/api/after_images/:id', auth(), trailImmutable);
app.delete('/api/after_images/:id', auth(), trailImmutable);
app.put('/api/audit/:id', auth(), trailImmutable);
app.patch('/api/audit/:id', auth(), trailImmutable);
app.delete('/api/audit/:id', auth(), trailImmutable);

// ================================================================= fallthrough
app.use('/api', (_req, res) => res.status(404).json({ error: 'no such endpoint' }));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    const idx = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(idx)) return res.sendFile(idx);
    return res.status(200).type('html').send('<!doctype html><title>App</title><p>Application is running.</p>');
  }
  next();
});

app.use((error, _req, res, _next) => {
  const status = error.status && error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status === 500) console.error('[hireops] operation failed:', error.message);
  res.status(status).json({ error: status === 500 ? 'Operation failed; no financial changes were committed.' : error.message });
});
app.listen(PORT, '0.0.0.0', () => console.log(`[hireops] listening on ${PORT}`));
module.exports = app;

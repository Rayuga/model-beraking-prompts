'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const dbmod = require('./db');
const S = require('./settlement');
const R = require('./rules');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// /health answers immediately and is never gated behind seeding, the database,
// or anything external. Boot must never depend on work that can fail.
app.get('/health', (_req, res) => res.json({ ok: true, service: 'signalworks' }));

let db = null;
try { db = dbmod.open(); }
catch (e) { console.error('[signalworks] database open failed:', e.message); }

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser);
app.use(express.static(path.join(__dirname, '..', 'public')));

function cookieParser(req, _res, next) {
  req.cookies = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  next();
}

const now = () => new Date().toISOString();
const uid = (p) => `${p}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

function audit(actorId, action, subject, detail) {
  db.prepare('INSERT INTO audit_log (actor_id,action,subject,detail,created_at) VALUES (?,?,?,?,?)')
    .run(actorId || null, action, subject, detail == null ? null : String(detail), now());
}
function notify(subject, sectionId, message) {
  db.prepare('INSERT INTO notifications (subject,section_id,message,created_at) VALUES (?,?,?,?)')
    .run(subject || null, sectionId || null, message, now());
}
function ledger(account, ref, description, debit, credit) {
  db.prepare('INSERT INTO ledger_entries (account,ref,description,debit_pence,credit_pence,created_at) VALUES (?,?,?,?,?,?)')
    .run(account, ref, description, debit || 0, credit || 0, now());
}
// Every posting is double entry: the ledger always balances. A negative amount
// simply swaps the two sides rather than writing a negative figure.
function journal(ref, description, debitAccount, creditAccount, pence) {
  if (!pence) return;
  const d = pence > 0 ? debitAccount : creditAccount;
  const c = pence > 0 ? creditAccount : debitAccount;
  const amt = Math.abs(pence);
  ledger(d, ref, description, amt, 0);
  ledger(c, ref, description, 0, amt);
}

function currentUser(req) {
  const t = req.cookies.sw_session;
  if (!t) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(t);
  if (!s) return null;
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(s.user_id);
  if (!u || u.suspended) return null;
  return u;
}

// Every protected route resolves identity from the SESSION only. Anything the
// client puts in the body - role, actor_id, approved, competent, state,
// amounts, another user's id - is a CLAIM, never an authorisation. Each
// decision below is recomputed from the stored records.
function auth(...roles) {
  return (req, res, next) => {
    const u = currentUser(req);
    if (!u) return res.status(401).json({ error: 'authentication required' });
    if (roles.length && !roles.includes(u.role)) {
      return res.status(403).json({
        error: `role ${u.role} may not perform this action`,
        your_role: u.role, allowed_roles: roles, area_denied: true,
      });
    }
    req.user = u;
    next();
  };
}
const bad = (res, msg, code) => res.status(code || 400).json({ error: msg });
// Every refusal that turns on a figure returns that figure alongside the message.
const fail = (res, code, msg, extra) => res.status(code).json({ error: msg, ...(extra || {}) });

// ---------------------------------------------------------------- lookups
const userOf = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
const assetOf = (id) => db.prepare('SELECT * FROM assets WHERE id = ?').get(id) || null;
const sectionOf = (id) => db.prepare('SELECT * FROM line_sections WHERE id = ?').get(id) || null;
const techOf = (id) => db.prepare('SELECT * FROM technicians WHERE id = ?').get(id) || null;
const teamOf = (id) => db.prepare('SELECT * FROM teams WHERE id = ?').get(id) || null;
const jobOf = (id) => db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) || null;
const incidentOf = (id) => db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) || null;
const planOf = (id) => db.prepare('SELECT * FROM possession_plans WHERE id = ?').get(id) || null;
const blockageOf = (id) => db.prepare('SELECT * FROM line_blockages WHERE id = ?').get(id) || null;
const handbackOf = (id) => db.prepare('SELECT * FROM handbacks WHERE id = ?').get(id) || null;
const stages = () => db.prepare('SELECT * FROM handback_stages ORDER BY sequence').all();

// ---------------------------------------------------------------- views
function assetView(a) {
  const overdue = R.inspectionOverdue(db, a);
  const blockage = R.activeBlockage(db, a.section_id);
  return {
    ...a,
    section: sectionOf(a.section_id),
    required_competence: R.requiredCompetences(db, a.kind),
    inspection_overdue: !!overdue,
    inspection_overdue_detail: overdue,
    latest_inspection: R.latestInspection(db, a.id),
    section_blocked: !!blockage,
    blockage_id: blockage ? blockage.id : null,
    available_for_repair: !R.assetWorkHold(db, a, 'REPAIR'),
    available_for_renewal: !R.assetWorkHold(db, a, 'RENEWAL'),
    available_for_inspection: !R.assetWorkHold(db, a, 'INSPECTION'),
  };
}

function jobView(j) {
  const a = assetOf(j.asset_id);
  const assignments = db.prepare('SELECT * FROM job_assignments WHERE job_id = ? ORDER BY assigned_at, id').all(j.id);
  const active = assignments.filter((x) => x.state === 'ACTIVE').slice(-1)[0] || null;
  const blockage = a ? R.activeBlockage(db, a.section_id) : null;
  const hold = a ? R.assetWorkHold(db, a, j.kind) : { code: 'ASSET_UNKNOWN' };
  return {
    ...j,
    asset: a ? { id: a.id, kind: a.kind, state: a.state, section_id: a.section_id,
                 inspection_due_on: a.inspection_due_on } : null,
    section_id: a ? a.section_id : null,
    team: j.team_id ? teamOf(j.team_id) : null,
    technician: j.technician_id ? techOf(j.technician_id) : null,
    assignments, active_assignment: active,
    required_competence: a ? R.requiredCompetences(db, a.kind) : [],
    asset_hold: hold,
    section_blockage: blockage,
    startable: !hold && !blockage && !!j.technician_id && j.state === 'ASSIGNED',
    handback: db.prepare('SELECT * FROM handbacks WHERE job_id = ?').get(j.id) || null,
  };
}

function incidentView(i) {
  const delays = db.prepare('SELECT * FROM delay_records WHERE incident_id = ? ORDER BY id').all(i.id);
  return {
    ...i,
    asset: assetOf(i.asset_id),
    delay_records: delays,
    delay_minutes_total: delays.reduce((t, d) => t + d.delay_minutes, 0),
    events: db.prepare('SELECT * FROM incident_events WHERE incident_id = ? ORDER BY id').all(i.id),
    jobs: db.prepare('SELECT id,kind,state,team_id,technician_id FROM jobs WHERE incident_id = ?').all(i.id),
    settlement: i.settlement_id
      ? db.prepare('SELECT * FROM incident_settlements WHERE id = ?').get(i.settlement_id) : null,
    credit: db.prepare('SELECT * FROM mutual_aid_credits WHERE incident_id = ?').get(i.id) || null,
    settled: !!i.settlement_id,
  };
}

function planView(p) {
  const conflict = R.possessionConflict(db, p.section_id, p.starts_at, p.ends_at, p.id);
  return {
    ...p,
    section: sectionOf(p.section_id),
    planner: p.planner_id ? { id: p.planner_id, name: (userOf(p.planner_id) || {}).name || null } : null,
    approver: p.approved_by ? { id: p.approved_by, name: (userOf(p.approved_by) || {}).name || null } : null,
    approvals: db.prepare('SELECT * FROM possession_approvals WHERE plan_id = ? ORDER BY id').all(p.id),
    active_blockage: R.activeBlockage(db, p.section_id),
    conflict,
    executable: p.state === 'APPROVED' && !R.activeBlockage(db, p.section_id) && !conflict,
  };
}

function handbackView(h) {
  const done = db.prepare('SELECT * FROM handback_steps WHERE handback_id = ? ORDER BY sequence').all(h.id);
  const all = stages();
  const doneIds = done.map((d) => d.stage_id);
  const next = all.find((s) => !doneIds.includes(s.id)) || null;
  return {
    ...h, stages: all, steps: done,
    completed_stage_ids: doneIds,
    next_stage: next, total_stages: all.length, completed_stages: done.length,
  };
}

// Settlement figures for one incident, computed and never stored by this view.
function incidentSettlementPreview(incident) {
  const delayMinutes = R.delayMinutesFor(db, incident.id);
  const credit = R.creditFor(db, incident.id);
  const computed = S.settleIncident(incident, delayMinutes, R.bands(db), R.windows(db), credit);
  return {
    incident_id: incident.id, ...computed,
    credit_id: credit ? credit.id : null,
    credit_amount_pence: credit ? credit.amount_pence : 0,
    gross_display: S.money(computed.gross_pence), net_display: S.money(computed.net_pence),
  };
}

function labourPreview(calloutIds) {
  let rows = db.prepare('SELECT * FROM callouts WHERE settled_in IS NULL ORDER BY technician_id, starts_at').all();
  if (Array.isArray(calloutIds) && calloutIds.length) rows = rows.filter((c) => calloutIds.includes(c.id));
  const byId = {};
  for (const t of db.prepare('SELECT * FROM technicians').all()) byId[t.id] = t;
  const spans = S.settleLabour(rows, byId);
  return {
    callouts_considered: rows.map((r) => r.id),
    spans: spans.map((s) => ({ ...s, total_display: S.money(s.total_pence) })),
    total_pence: spans.reduce((t, s) => t + s.total_pence, 0),
  };
}

// ---------------------------------------------------------------- auth (2 writes, 1 read)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase());
  if (!u || u.password !== password) return bad(res, 'invalid credentials', 401);
  if (u.suspended) return fail(res, 403, 'account suspended', { user_id: u.id, suspended: true });
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)').run(token, u.id, now());
  res.setHeader('Set-Cookie', `sw_session=${token}; Path=/; HttpOnly; SameSite=Lax`);
  audit(u.id, 'LOGIN', u.id, null);
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role, areas: R.ROLE_AREAS[u.role] || [] });
});

app.post('/api/auth/logout', (req, res) => {
  const t = req.cookies.sw_session;
  if (t) db.prepare('DELETE FROM sessions WHERE token = ?').run(t);
  res.setHeader('Set-Cookie', 'sw_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const u = currentUser(req);
  if (!u) return bad(res, 'authentication required', 401);
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role, areas: R.ROLE_AREAS[u.role] || [] });
});

// ---------------------------------------------------------------- bootstrap
app.get('/api/bootstrap', auth(), (req, res) => {
  const role = req.user.role;
  const has = (a) => R.can(role, a);
  const out = {
    user: { id: req.user.id, name: req.user.name, email: req.user.email, role },
    areas: R.ROLE_AREAS[role] || [],
    region: db.prepare('SELECT * FROM region LIMIT 1').get() || null,
    clock: R.clock(db),
  };
  if (has('sections') || has('assets') || has('incidents') || has('possessions') || has('blockages')) {
    out.interlockings = db.prepare('SELECT * FROM interlockings ORDER BY id').all();
    out.sections = db.prepare('SELECT * FROM line_sections ORDER BY id').all()
      .map((s) => ({ ...s, active_blockage: R.activeBlockage(db, s.id) }));
  }
  if (has('assets')) out.assets = db.prepare('SELECT * FROM assets ORDER BY id').all().map(assetView);
  if (has('inspections')) out.inspections = db.prepare('SELECT * FROM asset_inspections ORDER BY seq').all();
  if (has('technicians')) {
    out.technicians = db.prepare('SELECT * FROM technicians ORDER BY id').all();
    out.teams = db.prepare('SELECT * FROM teams ORDER BY id').all();
  }
  if (has('jobs')) out.jobs = db.prepare('SELECT * FROM jobs ORDER BY id').all().map(jobView);
  if (has('incidents')) {
    out.incidents = db.prepare('SELECT * FROM incidents ORDER BY id').all().map(incidentView);
    out.operators = db.prepare('SELECT * FROM operators ORDER BY id').all();
  }
  if (has('possessions')) out.possessions = db.prepare('SELECT * FROM possession_plans ORDER BY id').all().map(planView);
  if (has('blockages') || has('sections')) out.blockages = db.prepare('SELECT * FROM line_blockages ORDER BY id').all();
  if (has('handbacks')) {
    out.handback_stages = stages();
    out.handbacks = db.prepare('SELECT * FROM handbacks ORDER BY id').all().map(handbackView);
  }
  if (has('callouts')) out.callouts = db.prepare('SELECT * FROM callouts ORDER BY id').all();
  if (has('settlements')) {
    out.incident_settlements = db.prepare('SELECT * FROM incident_settlements ORDER BY id').all();
    out.labour_settlements = db.prepare('SELECT * FROM labour_settlements ORDER BY id').all();
    out.callouts = db.prepare('SELECT * FROM callouts ORDER BY id').all();
    out.penalty_bands = R.bands(db);
    out.disruption_windows = R.windows(db);
    out.mutual_aid_credits = db.prepare('SELECT * FROM mutual_aid_credits ORDER BY id').all();
    out.payroll_rules = db.prepare('SELECT * FROM payroll_rules ORDER BY id').all();
  }
  if (has('periods')) out.periods = db.prepare('SELECT * FROM settlement_periods ORDER BY id').all();
  if (has('ledger')) out.ledger = db.prepare('SELECT * FROM ledger_entries ORDER BY id').all();
  if (has('users')) out.users = db.prepare('SELECT id,name,email,role,suspended FROM users ORDER BY id').all();
  if (has('audit')) out.audit = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all();
  if (has('notifications')) out.notifications = db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 100').all();
  if (has('configuration')) out.competence_requirements = db.prepare('SELECT * FROM competence_requirements ORDER BY id').all();
  res.json(out);
});

// Reference data every desk may read.
app.get('/api/reference', auth(), (_req, res) => res.json({
  clock: R.clock(db),
  region: db.prepare('SELECT * FROM region LIMIT 1').get() || null,
  interlockings: db.prepare('SELECT * FROM interlockings ORDER BY id').all(),
  competence_requirements: db.prepare('SELECT * FROM competence_requirements ORDER BY id').all(),
  handback_stages: stages(),
  penalty_bands: R.bands(db),
  disruption_windows: R.windows(db),
  payroll_rules: db.prepare('SELECT * FROM payroll_rules ORDER BY id').all(),
  operators: db.prepare('SELECT * FROM operators ORDER BY id').all(),
  roles: R.ROLE_AREAS,
}));

// ---------------------------------------------------------------- reads
app.get('/api/sections', auth(), (_req, res) => res.json(
  db.prepare('SELECT * FROM line_sections ORDER BY id').all().map((s) => ({
    ...s, active_blockage: R.activeBlockage(db, s.id),
    assets: db.prepare('SELECT id,kind,state FROM assets WHERE section_id = ? ORDER BY id').all(s.id),
  }))));

app.get('/api/sections/:id', auth(), (req, res) => {
  const s = sectionOf(req.params.id);
  if (!s) return bad(res, 'no such section', 404);
  res.json({
    ...s, active_blockage: R.activeBlockage(db, s.id),
    assets: db.prepare('SELECT * FROM assets WHERE section_id = ? ORDER BY id').all(s.id).map(assetView),
    possessions: db.prepare('SELECT * FROM possession_plans WHERE section_id = ? ORDER BY starts_at').all(s.id),
    incidents: db.prepare('SELECT * FROM incidents WHERE section_id = ? ORDER BY id').all(s.id),
  });
});

app.get('/api/assets', auth(), (_req, res) =>
  res.json(db.prepare('SELECT * FROM assets ORDER BY id').all().map(assetView)));

app.get('/api/assets/:id', auth(), (req, res) => {
  const a = assetOf(req.params.id);
  if (!a) return bad(res, 'no such asset', 404);
  res.json({
    ...assetView(a),
    inspections: db.prepare('SELECT * FROM asset_inspections WHERE asset_id = ? ORDER BY seq').all(a.id),
    state_changes: db.prepare('SELECT * FROM asset_state_changes WHERE asset_id = ? ORDER BY id').all(a.id),
    jobs: db.prepare('SELECT id,kind,state FROM jobs WHERE asset_id = ? ORDER BY id').all(a.id),
  });
});

app.get('/api/technicians', auth(), (_req, res) => {
  const ref = R.clock(db).reference_date;
  res.json(db.prepare('SELECT * FROM technicians ORDER BY id').all().map((t) => ({
    ...t, competences: R.heldCompetences(t),
    competence_valid_at_reference_date: t.competence_expires_on >= ref,
    reference_date: ref, team: teamOf(t.team_id),
  })));
});

app.get('/api/technicians/:id', auth(), (req, res) => {
  const t = techOf(req.params.id);
  if (!t) return bad(res, 'no such technician', 404);
  const ref = R.clock(db).reference_date;
  res.json({
    ...t, competences: R.heldCompetences(t), team: teamOf(t.team_id),
    competence_valid_at_reference_date: t.competence_expires_on >= ref, reference_date: ref,
    assignments: db.prepare('SELECT * FROM job_assignments WHERE technician_id = ? ORDER BY id').all(t.id),
    callouts: db.prepare('SELECT * FROM callouts WHERE technician_id = ? ORDER BY starts_at').all(t.id),
  });
});

app.get('/api/teams', auth(), (_req, res) => res.json(
  db.prepare('SELECT * FROM teams ORDER BY id').all().map((t) => ({
    ...t, on_call: !!t.on_call,
    technicians: db.prepare('SELECT * FROM technicians WHERE team_id = ? ORDER BY id').all(t.id),
  }))));

app.get('/api/jobs', auth(), (_req, res) =>
  res.json(db.prepare('SELECT * FROM jobs ORDER BY id').all().map(jobView)));

app.get('/api/jobs/:id', auth(), (req, res) => {
  const j = jobOf(req.params.id);
  if (!j) return bad(res, 'no such job', 404);
  res.json(jobView(j));
});

app.get('/api/incidents', auth(), (_req, res) =>
  res.json(db.prepare('SELECT * FROM incidents ORDER BY id').all().map(incidentView)));

app.get('/api/incidents/:id', auth(), (req, res) => {
  const i = incidentOf(req.params.id);
  if (!i) return bad(res, 'no such incident', 404);
  res.json(incidentView(i));
});

app.get('/api/possessions', auth(), (_req, res) =>
  res.json(db.prepare('SELECT * FROM possession_plans ORDER BY id').all().map(planView)));

app.get('/api/possessions/:id', auth(), (req, res) => {
  const p = planOf(req.params.id);
  if (!p) return bad(res, 'no such possession plan', 404);
  res.json(planView(p));
});

app.get('/api/blockages', auth(), (_req, res) =>
  res.json(db.prepare('SELECT * FROM line_blockages ORDER BY id').all()));

app.get('/api/handbacks', auth(), (_req, res) =>
  res.json(db.prepare('SELECT * FROM handbacks ORDER BY id').all().map(handbackView)));

app.get('/api/handbacks/:id', auth(), (req, res) => {
  const h = handbackOf(req.params.id);
  if (!h) return bad(res, 'no such handback', 404);
  res.json(handbackView(h));
});

app.get('/api/callouts', auth(), (_req, res) =>
  res.json(db.prepare('SELECT * FROM callouts ORDER BY id').all()));

app.get('/api/periods', auth(), (_req, res) =>
  res.json(db.prepare('SELECT * FROM settlement_periods ORDER BY id').all()));

app.get('/api/settlements', auth('admin'), (_req, res) => res.json({
  incident_settlements: db.prepare('SELECT * FROM incident_settlements ORDER BY id').all(),
  labour_settlements: db.prepare('SELECT * FROM labour_settlements ORDER BY id').all(),
  periods: db.prepare('SELECT * FROM settlement_periods ORDER BY id').all(),
}));

app.get('/api/settlements/labour/preview', auth('admin'), (req, res) => {
  const ids = req.query.callout_ids ? String(req.query.callout_ids).split(',') : null;
  res.json(labourPreview(ids));
});

app.get('/api/settlements/incidents/:id/preview', auth('admin', 'signaller'), (req, res) => {
  const i = incidentOf(req.params.id);
  if (!i) return bad(res, 'no such incident', 404);
  res.json(incidentSettlementPreview(i));
});

app.get('/api/ledger', auth('admin'), (_req, res) =>
  res.json(db.prepare('SELECT * FROM ledger_entries ORDER BY id').all()));

app.get('/api/audit', auth('admin'), (_req, res) =>
  res.json(db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all()));

app.get('/api/notifications', auth(), (_req, res) =>
  res.json(db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 100').all()));

app.get('/api/admin/users', auth('admin'), (_req, res) =>
  res.json(db.prepare('SELECT id,name,email,role,suspended FROM users ORDER BY id').all()));

// ---------------------------------------------------------------- incidents
app.post('/api/incidents', auth('signaller'), (req, res) => {
  const { id, asset_id, note, raised_at } = req.body || {};
  if (!id || !asset_id) return bad(res, 'id and asset_id are required');
  if (incidentOf(id)) return fail(res, 409, 'an incident with that reference already exists', { incident_id: id });
  const a = assetOf(asset_id);
  if (!a) return bad(res, 'no such asset', 404);
  const at = raised_at || R.clock(db).reference_at;
  db.prepare(`INSERT INTO incidents (id,asset_id,section_id,state,raised_at,raised_by,note)
    VALUES (?,?,?,'OPEN',?,?,?)`).run(id, a.id, a.section_id, at, req.user.id, note || null);
  db.prepare('INSERT INTO incident_events (incident_id,kind,actor_id,detail,created_at) VALUES (?,?,?,?,?)')
    .run(id, 'RAISED', req.user.id, note || null, now());
  audit(req.user.id, 'INCIDENT_RAISED', id, a.id);
  notify(id, a.section_id, `Incident ${id} raised on ${a.id}.`);
  res.status(201).json(incidentView(incidentOf(id)));
});

app.post('/api/incidents/:id/acknowledge', auth('signaller'), (req, res) => {
  const i = incidentOf(req.params.id);
  if (!i) return bad(res, 'no such incident', 404);
  if (i.state !== 'OPEN')
    return fail(res, 409, `an incident in state ${i.state} cannot be acknowledged`,
      { incident_state: i.state, requires_state: 'OPEN' });
  db.prepare("UPDATE incidents SET state='ACKNOWLEDGED', acknowledged_at=?, acknowledged_by=? WHERE id=?")
    .run(now(), req.user.id, i.id);
  db.prepare('INSERT INTO incident_events (incident_id,kind,actor_id,detail,created_at) VALUES (?,?,?,?,?)')
    .run(i.id, 'ACKNOWLEDGED', req.user.id, null, now());
  audit(req.user.id, 'INCIDENT_ACKNOWLEDGED', i.id, null);
  res.json(incidentView(incidentOf(i.id)));
});

app.post('/api/incidents/:id/assign', auth('signaller', 'teamlead'), (req, res) => {
  const i = incidentOf(req.params.id);
  if (!i) return bad(res, 'no such incident', 404);
  if (i.state !== 'ACKNOWLEDGED')
    return fail(res, 409, `an incident in state ${i.state} cannot be assigned`,
      { incident_state: i.state, requires_state: 'ACKNOWLEDGED' });
  const { job_id, team_id } = req.body || {};
  let job = job_id ? jobOf(job_id) : null;
  if (job_id && !job) return bad(res, 'no such job', 404);
  if (job && job.incident_id && job.incident_id !== i.id)
    return fail(res, 409, 'that job already belongs to another incident', { job_id: job.id, incident_id: job.incident_id });
  if (team_id) {
    const t = teamOf(team_id);
    if (!t) return bad(res, 'no such team', 404);
    if (!t.on_call) return fail(res, 409, 'that team is not on call and cannot take incident work',
      { team_id: t.id, on_call: false, requires_on_call: true });
  }
  const tx = db.transaction(() => {
    if (job) {
      db.prepare('UPDATE jobs SET incident_id=? WHERE id=?').run(i.id, job.id);
      if (team_id) db.prepare("UPDATE jobs SET team_id=?, state='ASSIGNED' WHERE id=?").run(team_id, job.id);
    }
    db.prepare("UPDATE incidents SET state='ASSIGNED', assigned_at=?, assigned_by=? WHERE id=?")
      .run(now(), req.user.id, i.id);
    db.prepare('INSERT INTO incident_events (incident_id,kind,actor_id,detail,created_at) VALUES (?,?,?,?,?)')
      .run(i.id, 'ASSIGNED', req.user.id, job ? job.id : team_id || null, now());
  });
  tx();
  audit(req.user.id, 'INCIDENT_ASSIGNED', i.id, job ? job.id : team_id || null);
  res.json(incidentView(incidentOf(i.id)));
});

app.post('/api/incidents/:id/clear', auth('signaller'), (req, res) => {
  const i = incidentOf(req.params.id);
  if (!i) return bad(res, 'no such incident', 404);
  if (!['ACKNOWLEDGED', 'ASSIGNED'].includes(i.state))
    return fail(res, 409, `an incident in state ${i.state} cannot be cleared`,
      { incident_state: i.state, requires_state: ['ACKNOWLEDGED', 'ASSIGNED'] });
  const clearedAt = (req.body || {}).cleared_at || now();
  if (Date.parse(clearedAt) <= Date.parse(i.raised_at))
    return fail(res, 400, 'an incident cannot be cleared before it was raised',
      { raised_at: i.raised_at, cleared_at: clearedAt });
  db.prepare("UPDATE incidents SET state='CLEARED', cleared_at=?, cleared_by=? WHERE id=?")
    .run(clearedAt, req.user.id, i.id);
  db.prepare('INSERT INTO incident_events (incident_id,kind,actor_id,detail,created_at) VALUES (?,?,?,?,?)')
    .run(i.id, 'CLEARED', req.user.id, clearedAt, now());
  audit(req.user.id, 'INCIDENT_CLEARED', i.id, clearedAt);
  notify(i.id, i.section_id, `Incident ${i.id} cleared at ${clearedAt}; it is now settleable.`);
  res.json(incidentView(incidentOf(i.id)));
});

// A settled incident is a closed book. The edit is refused and the correction
// route below is the only way to add anything to it.
app.patch('/api/incidents/:id', auth('signaller'), (req, res) => {
  const i = incidentOf(req.params.id);
  if (!i) return bad(res, 'no such incident', 404);
  if (i.settlement_id) {
    const st = db.prepare('SELECT * FROM incident_settlements WHERE id = ?').get(i.settlement_id);
    return fail(res, 409, 'a settled incident cannot be edited; append a correction instead', {
      incident_id: i.id, settlement_id: i.settlement_id, settled_at: st ? st.settled_at : null,
      net_pence: st ? st.net_pence : null, correction_route: `/api/incidents/${i.id}/corrections`,
    });
  }
  const { note, asset_id } = req.body || {};
  if (note === undefined && asset_id === undefined) return bad(res, 'nothing to change');
  if (asset_id !== undefined) {
    const a = assetOf(asset_id);
    if (!a) return bad(res, 'no such asset', 404);
    db.prepare('UPDATE incidents SET asset_id=?, section_id=? WHERE id=?').run(a.id, a.section_id, i.id);
  }
  if (note !== undefined) db.prepare('UPDATE incidents SET note=? WHERE id=?').run(note, i.id);
  db.prepare('INSERT INTO incident_events (incident_id,kind,actor_id,detail,created_at) VALUES (?,?,?,?,?)')
    .run(i.id, 'EDITED', req.user.id, JSON.stringify({ note, asset_id }), now());
  audit(req.user.id, 'INCIDENT_EDITED', i.id, null);
  res.json(incidentView(incidentOf(i.id)));
});

app.post('/api/incidents/:id/delays', auth('signaller'), (req, res) => {
  const i = incidentOf(req.params.id);
  if (!i) return bad(res, 'no such incident', 404);
  if (i.settlement_id)
    return fail(res, 409, 'a settled incident cannot take further delay records', {
      incident_id: i.id, settlement_id: i.settlement_id,
      correction_route: `/api/incidents/${i.id}/corrections`,
    });
  const { id, operator_id, delay_minutes } = req.body || {};
  if (!id || !operator_id || !Number.isInteger(delay_minutes))
    return bad(res, 'id, operator_id and integer delay_minutes are required');
  if (db.prepare('SELECT 1 FROM delay_records WHERE id=?').get(id))
    return fail(res, 409, 'duplicate delay reference', { delay_id: id });
  if (!db.prepare('SELECT 1 FROM operators WHERE id=?').get(operator_id)) return bad(res, 'no such operator', 404);
  if (delay_minutes <= 0) return fail(res, 400, 'delay_minutes must be positive', { delay_minutes });
  db.prepare('INSERT INTO delay_records (id,incident_id,operator_id,delay_minutes,created_at) VALUES (?,?,?,?,?)')
    .run(id, i.id, operator_id, delay_minutes, now());
  audit(req.user.id, 'DELAY_RECORDED', id, `${i.id} ${operator_id} ${delay_minutes}`);
  res.status(201).json({
    delay: db.prepare('SELECT * FROM delay_records WHERE id=?').get(id),
    incident_delay_minutes_total: R.delayMinutesFor(db, i.id),
  });
});

// Corrections are APPENDED. Nothing that already exists is rewritten, and a
// settled incident accepts them.
app.post('/api/incidents/:id/corrections', auth('signaller', 'admin'), (req, res) => {
  const i = incidentOf(req.params.id);
  if (!i) return bad(res, 'no such incident', 404);
  const detail = (req.body || {}).detail;
  if (!detail) return bad(res, 'detail is required');
  const info = db.prepare('INSERT INTO incident_events (incident_id,kind,actor_id,detail,created_at) VALUES (?,?,?,?,?)')
    .run(i.id, 'CORRECTION', req.user.id, String(detail), now());
  audit(req.user.id, 'INCIDENT_CORRECTION_APPENDED', i.id, String(detail));
  res.status(201).json({
    mode: 'CORRECTION_APPENDED', incident_unchanged: incidentOf(i.id),
    correction: db.prepare('SELECT * FROM incident_events WHERE id=?').get(info.lastInsertRowid),
  });
});

// ---------------------------------------------------------------- jobs
app.post('/api/jobs', auth('maintenance', 'teamlead'), (req, res) => {
  const { id, asset_id, kind, incident_id, note } = req.body || {};
  if (!id || !asset_id || !kind) return bad(res, 'id, asset_id and kind are required');
  if (jobOf(id)) return fail(res, 409, 'a job with that reference already exists', { job_id: id });
  if (!['REPAIR', 'INSPECTION', 'RENEWAL'].includes(kind))
    return fail(res, 400, 'kind must be REPAIR, INSPECTION or RENEWAL', { allowed_kinds: ['REPAIR', 'INSPECTION', 'RENEWAL'] });
  const a = assetOf(asset_id);
  if (!a) return bad(res, 'no such asset', 404);
  if (incident_id && !incidentOf(incident_id)) return bad(res, 'no such incident', 404);
  db.prepare(`INSERT INTO jobs (id,asset_id,incident_id,kind,state,team_id,note)
    VALUES (?,?,?,?,'OPEN',NULL,?)`).run(id, a.id, incident_id || null, kind, note || null);
  audit(req.user.id, 'JOB_CREATED', id, `${a.id} ${kind}`);
  res.status(201).json(jobView(jobOf(id)));
});

app.post('/api/jobs/:id/assign-team', auth('teamlead', 'maintenance'), (req, res) => {
  const j = jobOf(req.params.id);
  if (!j) return bad(res, 'no such job', 404);
  if (!['OPEN', 'ASSIGNED'].includes(j.state))
    return fail(res, 409, `a job in state ${j.state} cannot be re-assigned`,
      { job_state: j.state, requires_state: ['OPEN', 'ASSIGNED'] });
  const t = teamOf((req.body || {}).team_id);
  if (!t) return bad(res, 'no such team', 404);
  // A claimed job is a single-holder statement: exactly one team wins it, and no
  // other route may quietly re-team it. A job that reached its team through
  // /claim carries claimed_at; re-teaming it to a DIFFERENT team here is refused
  // just as a second /claim would be. Unclaimed incident jobs (claimed_at NULL)
  // and re-teaming to the same holder are unaffected.
  if (j.claimed_at && j.team_id && j.team_id !== t.id)
    return fail(res, 409, 'that job is already claimed by another team', {
      job_id: j.id, already_claimed_by: j.team_id, claiming_team_id: t.id, claimed_at: j.claimed_at,
    });
  // Incident work only goes to a team that is on call.
  if (j.incident_id && !t.on_call)
    return fail(res, 409, 'that team is not on call and cannot take incident work',
      { team_id: t.id, team_name: t.name, on_call: false, requires_on_call: true, job_id: j.id, incident_id: j.incident_id });
  const tx = db.transaction(() => {
    // Changing team drops any technician who is no longer in it.
    const keepTech = j.technician_id && (techOf(j.technician_id) || {}).team_id === t.id;
    db.prepare("UPDATE job_assignments SET state='SUPERSEDED' WHERE job_id=? AND state='ACTIVE'").run(j.id);
    db.prepare("UPDATE jobs SET team_id=?, technician_id=?, state='ASSIGNED' WHERE id=?")
      .run(t.id, keepTech ? j.technician_id : null, j.id);
    db.prepare(`INSERT INTO job_assignments (id,job_id,team_id,technician_id,assigned_by,assigned_at,
      competence_required,competence_expires_on,state) VALUES (?,?,?,?,?,?,NULL,NULL,'ACTIVE')`)
      .run(uid('ASG'), j.id, t.id, keepTech ? j.technician_id : null, req.user.id, now());
  });
  tx();
  audit(req.user.id, 'JOB_TEAM_ASSIGNED', j.id, t.id);
  res.json(jobView(jobOf(j.id)));
});

// Competence at ASSIGNMENT is tested against the STORED reference date. This is
// deliberately a different moment from the one tested at execution.
app.post('/api/jobs/:id/assign-technician', auth('teamlead', 'maintenance'), (req, res) => {
  const j = jobOf(req.params.id);
  if (!j) return bad(res, 'no such job', 404);
  if (!['OPEN', 'ASSIGNED'].includes(j.state))
    return fail(res, 409, `a job in state ${j.state} cannot take a technician`,
      { job_state: j.state, requires_state: ['OPEN', 'ASSIGNED'] });
  if (!j.team_id) return fail(res, 409, 'assign a team before a technician', { job_id: j.id, team_id: null });
  const t = techOf((req.body || {}).technician_id);
  if (!t) return bad(res, 'no such technician', 404);
  if (t.team_id !== j.team_id)
    return fail(res, 409, 'that technician is not in the team holding this job',
      { technician_id: t.id, technician_team_id: t.team_id, job_team_id: j.team_id });
  // Competence first: whether this person may touch this KIND of asset at all is
  // a different and more fundamental question than whether they are free today.
  const a = assetOf(j.asset_id);
  const ref = R.clock(db);
  const chk = R.competenceCheck(db, t, a, ref.reference_date, 'ASSIGNMENT');
  if (!chk.ok) return fail(res, 409, 'the technician does not hold a valid competence for that asset at assignment', chk);
  const busy = R.technicianLiveJob(db, t.id, j.id);
  if (busy)
    return fail(res, 409, 'that technician is already on a claimed job',
      { technician_id: t.id, technician_name: t.name, held_job_id: busy.id,
        held_job_state: busy.state, held_asset_id: busy.asset_id });

  const tx = db.transaction(() => {
    db.prepare("UPDATE job_assignments SET state='SUPERSEDED' WHERE job_id=? AND state='ACTIVE'").run(j.id);
    db.prepare("UPDATE jobs SET technician_id=?, state='ASSIGNED' WHERE id=?").run(t.id, j.id);
    db.prepare(`INSERT INTO job_assignments (id,job_id,team_id,technician_id,assigned_by,assigned_at,
      competence_required,competence_expires_on,state) VALUES (?,?,?,?,?,?,?,?,'ACTIVE')`)
      .run(uid('ASG'), j.id, j.team_id, t.id, req.user.id, ref.reference_at,
           chk.required_competence.join(','), t.competence_expires_on);
  });
  tx();
  audit(req.user.id, 'JOB_TECHNICIAN_ASSIGNED', j.id, t.id);
  res.json({ ...jobView(jobOf(j.id)), assignment_check: chk });
});

// Two desks reaching for the same job: the claim is one atomic statement, so
// exactly one of them wins and the loser is told who holds it.
app.post('/api/jobs/:id/claim', auth('teamlead', 'maintenance'), (req, res) => {
  const j = jobOf(req.params.id);
  if (!j) return bad(res, 'no such job', 404);
  const t = teamOf((req.body || {}).team_id);
  if (!t) return bad(res, 'no such team', 404);
  // An asset takes one team at a time: jobs may sit open against the same
  // asset, but once one is claimed the others cannot be.
  const otherTeam = R.assetClaimedByOtherTeam(db, j.asset_id, t.id, j.id);
  if (otherTeam)
    return fail(res, 409, 'another team already holds that asset',
      { asset_id: j.asset_id, held_by_job_id: otherTeam.id, held_by_team_id: otherTeam.team_id,
        held_job_state: otherTeam.state, claiming_team_id: t.id });

  const info = db.prepare(
    "UPDATE jobs SET team_id=?, state='ASSIGNED', claimed_at=?, claimed_by=? WHERE id=? AND state='OPEN' AND team_id IS NULL"
  ).run(t.id, now(), req.user.id, j.id);
  if (info.changes === 0) {
    const cur = jobOf(j.id);
    return fail(res, 409, 'that job has already been claimed', {
      job_id: j.id, job_state: cur.state, already_claimed_by: cur.team_id, claiming_team_id: t.id,
    });
  }
  db.prepare(`INSERT INTO job_assignments (id,job_id,team_id,technician_id,assigned_by,assigned_at,
    competence_required,competence_expires_on,state) VALUES (?,?,?,NULL,?,?,NULL,NULL,'ACTIVE')`)
    .run(uid('ASG'), j.id, t.id, req.user.id, now());
  audit(req.user.id, 'JOB_CLAIMED', j.id, t.id);
  res.json(jobView(jobOf(j.id)));
});

// Execution. Every hold is re-tested HERE, against the moment the work is
// actually done - which is not the moment it was planned.
app.post('/api/jobs/:id/start', auth('teamlead', 'maintenance'), (req, res) => {
  const j = jobOf(req.params.id);
  if (!j) return bad(res, 'no such job', 404);
  if (j.state !== 'ASSIGNED')
    return fail(res, 409, `a job in state ${j.state} cannot be started`,
      { job_state: j.state, requires_state: 'ASSIGNED' });
  if (!j.technician_id)
    return fail(res, 409, 'a job needs a technician before it can be started', { job_id: j.id, technician_id: null });
  const a = assetOf(j.asset_id);
  const t = techOf(j.technician_id);

  const possession = R.possessionForJob(db, j, a);
  const executedAt = (req.body || {}).executed_at
    || (possession ? possession.starts_at : null)
    || R.clock(db).reference_at;

  const hold = R.assetWorkHold(db, a, j.kind);
  if (hold) return fail(res, 409, 'that asset is not available for work', { ...hold, job_id: j.id, job_kind: j.kind });

  const blockage = R.activeBlockage(db, a.section_id);
  if (blockage) return fail(res, 409, 'a line blockage is in force on that section',
    { ...R.blockageRefusal(blockage), job_id: j.id });

  const chk = R.competenceCheck(db, t, a, executedAt, 'EXECUTION');
  if (!chk.ok) {
    const asg = db.prepare("SELECT * FROM job_assignments WHERE job_id=? AND state='ACTIVE'").get(j.id);
    return fail(res, 409, 'the technician does not hold a valid competence at the moment of execution', {
      ...chk, job_id: j.id,
      assigned_at: asg ? asg.assigned_at : null,
      valid_at_assignment: !!asg && (!asg.competence_expires_on
        || asg.competence_expires_on >= R.clock(db).reference_date),
      possession_id: possession ? possession.id : null,
    });
  }


  db.prepare("UPDATE jobs SET state='IN_PROGRESS', started_at=?, possession_id=? WHERE id=?")
    .run(executedAt, possession ? possession.id : null, j.id);
  audit(req.user.id, 'JOB_STARTED', j.id, executedAt);
  res.json({ ...jobView(jobOf(j.id)), executed_at: executedAt, competence_check: chk });
});

app.post('/api/jobs/:id/complete', auth('teamlead', 'maintenance'), (req, res) => {
  const j = jobOf(req.params.id);
  if (!j) return bad(res, 'no such job', 404);
  if (j.state !== 'IN_PROGRESS')
    return fail(res, 409, `a job in state ${j.state} cannot be completed`,
      { job_state: j.state, requires_state: 'IN_PROGRESS' });
  const at = (req.body || {}).completed_at || now();
  db.prepare("UPDATE jobs SET state='COMPLETE', completed_at=? WHERE id=?").run(at, j.id);
  audit(req.user.id, 'JOB_COMPLETED', j.id, at);
  notify(j.id, (assetOf(j.asset_id) || {}).section_id || null,
    `Job ${j.id} is complete; a handback is now required before the asset returns to service.`);
  res.json(jobView(jobOf(j.id)));
});

app.post('/api/jobs/:id/cancel', auth('teamlead', 'maintenance'), (req, res) => {
  const j = jobOf(req.params.id);
  if (!j) return bad(res, 'no such job', 404);
  if (['COMPLETE', 'HANDED_BACK', 'CANCELLED'].includes(j.state))
    return fail(res, 409, `a job in state ${j.state} cannot be cancelled`, { job_state: j.state });
  db.prepare("UPDATE jobs SET state='CANCELLED' WHERE id=?").run(j.id);
  db.prepare("UPDATE job_assignments SET state='SUPERSEDED' WHERE job_id=? AND state='ACTIVE'").run(j.id);
  audit(req.user.id, 'JOB_CANCELLED', j.id, (req.body || {}).reason || null);
  res.json(jobView(jobOf(j.id)));
});

// ---------------------------------------------------------------- assets
app.post('/api/assets/:id/inspections', auth('maintenance'), (req, res) => {
  const a = assetOf(req.params.id);
  if (!a) return bad(res, 'no such asset', 404);
  const { id, result, inspected_on, next_due_on, technician_id, evidence_ref } = req.body || {};
  if (!id || !result || !inspected_on) return bad(res, 'id, result and inspected_on are required');
  if (db.prepare('SELECT 1 FROM asset_inspections WHERE id=?').get(id))
    return fail(res, 409, 'duplicate inspection reference', { inspection_id: id });
  if (!['PASS', 'FAIL'].includes(result))
    return fail(res, 400, 'result must be PASS or FAIL', { allowed_results: ['PASS', 'FAIL'] });
  if (technician_id) {
    const t = techOf(technician_id);
    if (!t) return bad(res, 'no such technician', 404);
    const chk = R.competenceCheck(db, t, a, inspected_on, 'EXECUTION');
    if (!chk.ok) return fail(res, 409, 'the inspector does not hold a valid competence on the date inspected', chk);
  }
  if (result === 'PASS') {
    if (!next_due_on) return fail(res, 400, 'a passed inspection must set the next due date',
      { result, next_due_on: null, current_due_on: a.inspection_due_on });
    if (next_due_on <= inspected_on) return fail(res, 400, 'the next due date must fall after the inspection',
      { inspected_on, next_due_on });
  }

  const seq = (db.prepare('SELECT COALESCE(MAX(seq),0) AS s FROM asset_inspections').get().s) + 1;
  const effects = { asset_state_changed: false, cleared_overdue: false, notified: [] };
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO asset_inspections (id,asset_id,technician_id,result,inspected_on,next_due_on,
      evidence_ref,seq,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(id, a.id, technician_id || null, result, inspected_on, next_due_on || null, evidence_ref || null, seq, now());
    if (result === 'PASS') {
      const wasOverdue = !!R.inspectionOverdue(db, a);
      db.prepare('UPDATE assets SET inspection_due_on=?, last_inspected_on=? WHERE id=?')
        .run(next_due_on, inspected_on, a.id);
      effects.cleared_overdue = wasOverdue;
    } else {
      if (a.state !== 'FAILED') {
        db.prepare("UPDATE assets SET state='FAILED' WHERE id=?").run(a.id);
        db.prepare('INSERT INTO asset_state_changes (asset_id,from_state,to_state,actor_id,reason,created_at) VALUES (?,?,?,?,?,?)')
          .run(a.id, a.state, 'FAILED', req.user.id, `failed inspection ${id}`, now());
        effects.asset_state_changed = true;
      }
      notify(a.id, a.section_id, `${a.id} failed inspection ${id}; it is out of service until an engineer returns it.`);
      effects.notified.push(a.id);
    }
  });
  tx();
  audit(req.user.id, 'INSPECTION_RECORDED', id, `${a.id} ${result}`);
  res.status(201).json({
    inspection: db.prepare('SELECT * FROM asset_inspections WHERE id=?').get(id),
    asset: assetView(assetOf(a.id)), effects,
  });
});

// Only an engineer touches an asset's live configuration or state, and even an
// engineer cannot put an asset back IN_SERVICE here - that is its own gate.
app.patch('/api/assets/:id', auth('engineer'), (req, res) => {
  const a = assetOf(req.params.id);
  if (!a) return bad(res, 'no such asset', 404);
  const { state, config_note } = req.body || {};
  const allowed = ['MAINTENANCE', 'WITHDRAWN', 'FAILED'];
  if (state === undefined && config_note === undefined) return bad(res, 'nothing to change');
  if (state !== undefined) {
    if (!allowed.includes(state))
      return fail(res, 400, 'that state cannot be set directly', {
        requested_state: state, allowed_states: allowed, current_state: a.state,
        return_to_service_route: `/api/assets/${a.id}/return-to-service`,
      });
    db.prepare('UPDATE assets SET state=? WHERE id=?').run(state, a.id);
    db.prepare('INSERT INTO asset_state_changes (asset_id,from_state,to_state,actor_id,reason,created_at) VALUES (?,?,?,?,?,?)')
      .run(a.id, a.state, state, req.user.id, (req.body || {}).reason || 'engineer configuration change', now());
    notify(a.id, a.section_id, `${a.id} moved from ${a.state} to ${state} by engineering.`);
  }
  if (config_note !== undefined) db.prepare('UPDATE assets SET config_note=? WHERE id=?').run(config_note, a.id);
  audit(req.user.id, 'ASSET_CONFIGURED', a.id, JSON.stringify({ state, config_note }));
  res.json(assetView(assetOf(a.id)));
});

app.post('/api/assets/:id/return-to-service', auth('engineer'), (req, res) => {
  const a = assetOf(req.params.id);
  if (!a) return bad(res, 'no such asset', 404);
  const hold = R.returnToServiceHold(db, a);
  if (hold) return fail(res, 409, 'that asset cannot be returned to service', hold);
  db.prepare("UPDATE assets SET state='IN_SERVICE' WHERE id=?").run(a.id);
  db.prepare('INSERT INTO asset_state_changes (asset_id,from_state,to_state,actor_id,reason,created_at) VALUES (?,?,?,?,?,?)')
    .run(a.id, a.state, 'IN_SERVICE', req.user.id, (req.body || {}).reason || 'returned to service', now());
  audit(req.user.id, 'ASSET_RETURNED_TO_SERVICE', a.id, null);
  notify(a.id, a.section_id, `${a.id} is back in service.`);
  res.json(assetView(assetOf(a.id)));
});

// ---------------------------------------------------------------- blockages
app.post('/api/blockages', auth('safety'), (req, res) => {
  const { id, section_id, reason } = req.body || {};
  if (!id || !section_id) return bad(res, 'id and section_id are required');
  if (blockageOf(id)) return fail(res, 409, 'duplicate blockage reference', { blockage_id: id });
  if (!sectionOf(section_id)) return bad(res, 'no such section', 404);
  const existing = R.activeBlockage(db, section_id);
  if (existing) return fail(res, 409, 'that section already carries an active blockage',
    { section_id, existing_blockage_id: existing.id, placed_by: existing.placed_by, reason: existing.reason });
  db.prepare(`INSERT INTO line_blockages (id,section_id,state,placed_by,reason,placed_at) VALUES (?,?,'ACTIVE',?,?,?)`)
    .run(id, section_id, req.user.id, reason || null, now());
  audit(req.user.id, 'BLOCKAGE_PLACED', id, section_id);
  notify(id, section_id, `Blockage ${id} placed on ${section_id}; work and possession execution are held there.`);
  res.status(201).json(blockageOf(id));
});

app.post('/api/blockages/:id/remove', auth('safety'), (req, res) => {
  const b = blockageOf(req.params.id);
  if (!b) return bad(res, 'no such blockage', 404);
  if (b.state !== 'ACTIVE')
    return fail(res, 409, `a blockage in state ${b.state} cannot be removed`,
      { blockage_id: b.id, blockage_state: b.state, requires_state: 'ACTIVE' });
  db.prepare("UPDATE line_blockages SET state='REMOVED', removed_by=?, removed_at=? WHERE id=?")
    .run(req.user.id, now(), b.id);
  audit(req.user.id, 'BLOCKAGE_REMOVED', b.id, b.section_id);
  notify(b.id, b.section_id, `Blockage ${b.id} lifted from ${b.section_id}.`);
  res.json(blockageOf(b.id));
});

// ---------------------------------------------------------------- possessions
app.post('/api/possessions', auth('safety', 'engineer'), (req, res) => {
  const { id, section_id, starts_at, ends_at, note } = req.body || {};
  if (!id || !section_id || !starts_at || !ends_at)
    return bad(res, 'id, section_id, starts_at and ends_at are required');
  if (planOf(id)) return fail(res, 409, 'duplicate possession reference', { plan_id: id });
  if (!sectionOf(section_id)) return bad(res, 'no such section', 404);
  if (Date.parse(ends_at) <= Date.parse(starts_at))
    return fail(res, 400, 'a possession must end after it starts', { starts_at, ends_at });
  // A DRAFT may be written over another plan's span - the roster itself ships
  // POS-5002 in draft across the approved POS-5003. The APPROVAL is the gate:
  // two possessions cannot both STAND on one section.
  // The planner is the SESSION user. A planner_id in the body is ignored.
  db.prepare(`INSERT INTO possession_plans (id,section_id,starts_at,ends_at,state,planner_id,version,note)
    VALUES (?,?,?,?,'DRAFT',?,1,?)`).run(id, section_id, starts_at, ends_at, req.user.id, note || null);
  audit(req.user.id, 'POSSESSION_PLANNED', id, section_id);
  res.status(201).json(planView(planOf(id)));
});

// A material edit after approval INVALIDATES the approval; execution is then
// blocked until a second person approves the changed plan.
app.patch('/api/possessions/:id', auth('safety', 'engineer'), (req, res) => {
  const p = planOf(req.params.id);
  if (!p) return bad(res, 'no such possession plan', 404);
  if (['EXECUTED', 'CANCELLED'].includes(p.state))
    return fail(res, 409, `a possession in state ${p.state} cannot be edited`,
      { plan_id: p.id, plan_state: p.state });
  const patch = req.body || {};
  const changed = R.materialChanges(p, patch);
  const nextStart = patch.starts_at !== undefined ? patch.starts_at : p.starts_at;
  const nextEnd = patch.ends_at !== undefined ? patch.ends_at : p.ends_at;
  const nextSection = patch.section_id !== undefined ? patch.section_id : p.section_id;
  if (changed.length === 0 && patch.note === undefined) return bad(res, 'nothing to change');
  if (Date.parse(nextEnd) <= Date.parse(nextStart))
    return fail(res, 400, 'a possession must end after it starts', { starts_at: nextStart, ends_at: nextEnd });
  if (!sectionOf(nextSection)) return bad(res, 'no such section', 404);
  if (changed.length) {
    const conflict = R.possessionConflict(db, nextSection, nextStart, nextEnd, p.id);
    if (conflict) return fail(res, 409, 'the edited possession would overlap an approved possession', conflict);
  }

  const invalidates = changed.length > 0 && p.state === 'APPROVED';
  const out = { changed_fields: changed, approval_invalidated: invalidates,
                previous_approver_id: invalidates ? p.approved_by : null, invalidated_approval_id: null };
  const tx = db.transaction(() => {
    db.prepare('UPDATE possession_plans SET section_id=?, starts_at=?, ends_at=?, note=? WHERE id=?')
      .run(nextSection, nextStart, nextEnd, patch.note !== undefined ? patch.note : p.note, p.id);
    if (invalidates) {
      const ap = db.prepare("SELECT * FROM possession_approvals WHERE plan_id=? AND state='APPROVED' ORDER BY id DESC LIMIT 1").get(p.id);
      if (ap) {
        db.prepare("UPDATE possession_approvals SET state='INVALIDATED', invalidated_reason=? WHERE id=?")
          .run(`material edit to ${changed.join(',')}`, ap.id);
        out.invalidated_approval_id = ap.id;
      }
      db.prepare("UPDATE possession_plans SET state='DRAFT', approved_by=NULL, approved_at=NULL, version=version+1 WHERE id=?")
        .run(p.id);
    }
  });
  tx();
  if (invalidates) {
    notify(p.id, nextSection, `Possession ${p.id} was materially edited (${changed.join(', ')}); its approval is void and it must be approved again.`);
    audit(req.user.id, 'POSSESSION_APPROVAL_INVALIDATED', p.id, changed.join(','));
  }
  audit(req.user.id, 'POSSESSION_EDITED', p.id, changed.join(',') || 'note');
  res.json({ ...planView(planOf(p.id)), ...out });
});

app.post('/api/possessions/:id/approve', auth('safety', 'engineer'), (req, res) => {
  const p = planOf(req.params.id);
  if (!p) return bad(res, 'no such possession plan', 404);
  if (p.state === 'APPROVED')
    return fail(res, 409, 'that possession is already approved',
      { plan_id: p.id, plan_state: p.state, approved_by: p.approved_by });
  if (p.state !== 'DRAFT')
    return fail(res, 409, `a possession in state ${p.state} cannot be approved`,
      { plan_id: p.id, plan_state: p.state, requires_state: 'DRAFT' });
  // The approver is the SESSION user, and must be a different person from the
  // planner. An approver_id in the body is a claim and is ignored.
  if (p.planner_id === req.user.id)
    return fail(res, 409, 'a possession must be approved by someone other than its planner', {
      plan_id: p.id, planner_id: p.planner_id, approver_id: req.user.id, self_approval: true,
    });
  const conflict = R.possessionConflict(db, p.section_id, p.starts_at, p.ends_at, p.id);
  if (conflict) return fail(res, 409, 'that possession overlaps an approved possession on the same section', conflict);

  const apId = uid('PAP');
  const tx = db.transaction(() => {
    db.prepare("UPDATE possession_plans SET state='APPROVED', approved_by=?, approved_at=? WHERE id=?")
      .run(req.user.id, now(), p.id);
    db.prepare(`INSERT INTO possession_approvals (id,plan_id,approver_id,plan_version,state,created_at)
      VALUES (?,?,?,?,'APPROVED',?)`).run(apId, p.id, req.user.id, p.version, now());
  });
  tx();
  audit(req.user.id, 'POSSESSION_APPROVED', p.id, apId);
  res.json(planView(planOf(p.id)));
});

app.post('/api/possessions/:id/execute', auth('safety'), (req, res) => {
  const p = planOf(req.params.id);
  if (!p) return bad(res, 'no such possession plan', 404);
  if (p.state !== 'APPROVED') {
    const inval = db.prepare("SELECT * FROM possession_approvals WHERE plan_id=? AND state='INVALIDATED' ORDER BY id DESC LIMIT 1").get(p.id);
    return fail(res, 409, `a possession in state ${p.state} cannot be executed`, {
      plan_id: p.id, plan_state: p.state, requires_state: 'APPROVED', plan_version: p.version,
      approval_invalidated: !!inval, invalidated_approval_id: inval ? inval.id : null,
      invalidated_reason: inval ? inval.invalidated_reason : null,
    });
  }
  const blockage = R.activeBlockage(db, p.section_id);
  if (blockage) return fail(res, 409, 'a line blockage is in force on that section',
    { ...R.blockageRefusal(blockage), plan_id: p.id });
  const conflict = R.possessionConflict(db, p.section_id, p.starts_at, p.ends_at, p.id, ['EXECUTING']);
  if (conflict) return fail(res, 409, 'another possession is already executing over that span', conflict);

  db.prepare("UPDATE possession_plans SET state='EXECUTING', executed_at=? WHERE id=?").run(now(), p.id);
  audit(req.user.id, 'POSSESSION_EXECUTED', p.id, p.section_id);
  notify(p.id, p.section_id, `Possession ${p.id} is now in force on ${p.section_id}.`);
  res.json(planView(planOf(p.id)));
});

app.post('/api/possessions/:id/cancel', auth('safety', 'engineer'), (req, res) => {
  const p = planOf(req.params.id);
  if (!p) return bad(res, 'no such possession plan', 404);
  if (['EXECUTED', 'CANCELLED'].includes(p.state))
    return fail(res, 409, `a possession in state ${p.state} cannot be cancelled`, { plan_id: p.id, plan_state: p.state });
  db.prepare("UPDATE possession_plans SET state='CANCELLED' WHERE id=?").run(p.id);
  db.prepare("UPDATE possession_approvals SET state='INVALIDATED', invalidated_reason='plan cancelled' WHERE plan_id=? AND state='APPROVED'").run(p.id);
  audit(req.user.id, 'POSSESSION_CANCELLED', p.id, (req.body || {}).reason || null);
  res.json(planView(planOf(p.id)));
});

// ---------------------------------------------------------------- handbacks
app.post('/api/handbacks', auth('teamlead', 'safety'), (req, res) => {
  const { id, job_id } = req.body || {};
  if (!id || !job_id) return bad(res, 'id and job_id are required');
  if (handbackOf(id)) return fail(res, 409, 'duplicate handback reference', { handback_id: id });
  const j = jobOf(job_id);
  if (!j) return bad(res, 'no such job', 404);
  if (j.state !== 'COMPLETE')
    return fail(res, 409, 'only a completed job can be handed back',
      { job_id: j.id, job_state: j.state, requires_state: 'COMPLETE' });
  const existing = db.prepare('SELECT * FROM handbacks WHERE job_id=?').get(j.id);
  if (existing) return fail(res, 409, 'that job already has a handback', { job_id: j.id, handback_id: existing.id });
  db.prepare(`INSERT INTO handbacks (id,job_id,asset_id,state,opened_by,opened_at) VALUES (?,?,?,'IN_PROGRESS',?,?)`)
    .run(id, j.id, j.asset_id, req.user.id, now());
  audit(req.user.id, 'HANDBACK_OPENED', id, j.id);
  res.status(201).json(handbackView(handbackOf(id)));
});

// Stages are worked in sequence, and a stage that demands evidence will not
// accept a blank.
app.post('/api/handbacks/:id/steps', auth('teamlead', 'safety'), (req, res) => {
  const h = handbackOf(req.params.id);
  if (!h) return bad(res, 'no such handback', 404);
  if (h.state !== 'IN_PROGRESS')
    return fail(res, 409, `a handback in state ${h.state} cannot take further stages`,
      { handback_id: h.id, handback_state: h.state, requires_state: 'IN_PROGRESS' });
  const { stage_id, evidence_ref } = req.body || {};
  if (!stage_id) return bad(res, 'stage_id is required');
  const stage = db.prepare('SELECT * FROM handback_stages WHERE id=?').get(stage_id);
  if (!stage) return bad(res, 'no such handback stage', 404);
  const v = handbackView(h);
  if (!v.next_stage)
    return fail(res, 409, 'every stage is already recorded', { handback_id: h.id, total_stages: v.total_stages });
  if (v.next_stage.id !== stage.id)
    return fail(res, 409, 'handback stages must be recorded in sequence', {
      handback_id: h.id, expected_stage_id: v.next_stage.id, expected_sequence: v.next_stage.sequence,
      expected_stage_name: v.next_stage.name, submitted_stage_id: stage.id, submitted_sequence: stage.sequence,
      completed_stages: v.completed_stages, total_stages: v.total_stages,
    });
  if (stage.evidence_required !== 'NONE' && !evidence_ref)
    return fail(res, 400, 'that stage cannot be recorded without its evidence', {
      handback_id: h.id, stage_id: stage.id, stage_name: stage.name,
      evidence_required: stage.evidence_required, evidence_ref: null,
    });
  db.prepare(`INSERT INTO handback_steps (handback_id,stage_id,sequence,evidence_ref,completed_by,completed_at)
    VALUES (?,?,?,?,?,?)`).run(h.id, stage.id, stage.sequence, evidence_ref || null, req.user.id, now());
  audit(req.user.id, 'HANDBACK_STAGE_RECORDED', h.id, stage.id);

  // Signing the LAST stage is what completes the handback and returns the asset
  // to service — the brief states this plainly and names no separate "complete"
  // step. When the final stage lands, complete the handback and return the asset,
  // subject to the SAME return-to-service hold (an overdue inspection still keeps
  // it out, and the notification records that it stayed out).
  const after = handbackView(handbackOf(h.id));
  if (after.completed_stages >= after.total_stages && h.state === 'IN_PROGRESS') {
    const asset = assetOf(h.asset_id);
    const hold = R.returnToServiceHold(db, asset, { handback: handbackOf(h.id) });
    const returned = !hold;
    const tx = db.transaction(() => {
      db.prepare("UPDATE handbacks SET state='COMPLETE', completed_at=?, completed_by=? WHERE id=?")
        .run(now(), req.user.id, h.id);
      db.prepare("UPDATE jobs SET state='HANDED_BACK' WHERE id=?").run(h.job_id);
      if (returned) {
        db.prepare("UPDATE assets SET state='IN_SERVICE' WHERE id=?").run(asset.id);
        db.prepare('INSERT INTO asset_state_changes (asset_id,from_state,to_state,actor_id,reason,created_at) VALUES (?,?,?,?,?,?)')
          .run(asset.id, asset.state, 'IN_SERVICE', req.user.id, `handback ${h.id}`, now());
      }
    });
    tx();
    audit(req.user.id, 'HANDBACK_COMPLETED', h.id, returned ? 'asset returned to service' : hold.code);
    if (!returned)
      notify(h.id, asset.section_id,
        `Handback ${h.id} is complete but ${asset.id} stayed out of service: ${hold.code}.`);
  }
  res.status(201).json(handbackView(handbackOf(h.id)));
});

app.post('/api/handbacks/:id/complete', auth('teamlead', 'safety'), (req, res) => {
  const h = handbackOf(req.params.id);
  if (!h) return bad(res, 'no such handback', 404);
  if (h.state !== 'IN_PROGRESS')
    return fail(res, 409, `a handback in state ${h.state} cannot be completed`,
      { handback_id: h.id, handback_state: h.state });
  const v = handbackView(h);
  if (v.completed_stages < v.total_stages) {
    const doneIds = v.completed_stage_ids;
    return fail(res, 409, 'the handback is not complete', {
      handback_id: h.id, completed_stages: v.completed_stages, total_stages: v.total_stages,
      missing_stage_ids: v.stages.filter((s) => !doneIds.includes(s.id)).map((s) => s.id),
      next_stage_id: v.next_stage ? v.next_stage.id : null,
    });
  }
  const asset = assetOf(h.asset_id);
  const hold = R.returnToServiceHold(db, asset, { handback: h });
  const returned = !hold;
  const tx = db.transaction(() => {
    db.prepare("UPDATE handbacks SET state='COMPLETE', completed_at=?, completed_by=? WHERE id=?")
      .run(now(), req.user.id, h.id);
    db.prepare("UPDATE jobs SET state='HANDED_BACK' WHERE id=?").run(h.job_id);
    if (returned) {
      db.prepare("UPDATE assets SET state='IN_SERVICE' WHERE id=?").run(asset.id);
      db.prepare('INSERT INTO asset_state_changes (asset_id,from_state,to_state,actor_id,reason,created_at) VALUES (?,?,?,?,?,?)')
        .run(asset.id, asset.state, 'IN_SERVICE', req.user.id, `handback ${h.id}`, now());
    }
  });
  tx();
  audit(req.user.id, 'HANDBACK_COMPLETED', h.id, returned ? 'asset returned to service' : hold.code);
  if (!returned)
    notify(h.id, asset.section_id,
      `Handback ${h.id} is complete but ${asset.id} stayed out of service: ${hold.code}.`);
  res.json({
    ...handbackView(handbackOf(h.id)),
    asset: assetView(assetOf(asset.id)),
    asset_returned_to_service: returned,
    asset_return_blocked_by: hold || null,
  });
});

// ---------------------------------------------------------------- callouts
app.post('/api/callouts', auth('teamlead'), (req, res) => {
  const { id, technician_id, job_id, starts_at, ends_at } = req.body || {};
  if (!id || !technician_id || !starts_at || !ends_at)
    return bad(res, 'id, technician_id, starts_at and ends_at are required');
  if (db.prepare('SELECT 1 FROM callouts WHERE id=?').get(id))
    return fail(res, 409, 'duplicate callout reference', { callout_id: id });
  if (!techOf(technician_id)) return bad(res, 'no such technician', 404);
  if (job_id && !jobOf(job_id)) return bad(res, 'no such job', 404);
  if (Date.parse(ends_at) <= Date.parse(starts_at))
    return fail(res, 400, 'a callout must end after it starts', { starts_at, ends_at });
  const period = R.openPeriod(db);
  if (!period) return fail(res, 409, 'no settlement period is open to take a new callout',
    { open_period: null, periods: db.prepare('SELECT id,state FROM settlement_periods').all() });
  db.prepare('INSERT INTO callouts (id,technician_id,job_id,starts_at,ends_at,settled_in,created_at) VALUES (?,?,?,?,?,NULL,?)')
    .run(id, technician_id, job_id || null, starts_at, ends_at, now());
  audit(req.user.id, 'CALLOUT_RECORDED', id, `${technician_id} ${starts_at}..${ends_at}`);
  res.status(201).json(db.prepare('SELECT * FROM callouts WHERE id=?').get(id));
});

// ---------------------------------------------------------------- settlement
app.post('/api/settlements/incidents/:id', auth('admin'), (req, res) => {
  const i = incidentOf(req.params.id);
  if (!i) return bad(res, 'no such incident', 404);
  if (i.settlement_id)
    return fail(res, 409, 'that incident is already settled',
      { incident_id: i.id, settlement_id: i.settlement_id });
  if (!R.SETTLEABLE_INCIDENT_STATES.includes(i.state))
    return fail(res, 409, `an incident in state ${i.state} cannot be settled`, {
      incident_id: i.id, incident_state: i.state, settleable_states: R.SETTLEABLE_INCIDENT_STATES,
    });
  if (!i.cleared_at)
    return fail(res, 409, 'an incident with no clearance time cannot be settled', { incident_id: i.id, cleared_at: null });
  const period = R.openPeriod(db);
  if (!period) return fail(res, 409, 'no settlement period is open',
    { open_period: null, periods: db.prepare('SELECT id,state FROM settlement_periods').all() });
  const delayMinutes = R.delayMinutesFor(db, i.id);
  if (delayMinutes <= 0)
    return fail(res, 409, 'that incident carries no delay to settle',
      { incident_id: i.id, delay_minutes: delayMinutes, delay_records: 0 });

  const credit = R.creditFor(db, i.id);
  const c = S.settleIncident(i, delayMinutes, R.bands(db), R.windows(db), credit);
  const setId = (req.body || {}).id || `ISET-${i.id}`;
  if (db.prepare('SELECT 1 FROM incident_settlements WHERE id=?').get(setId))
    return fail(res, 409, 'duplicate settlement reference', { settlement_id: setId });

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO incident_settlements (id,incident_id,period_id,delay_minutes,gross_pence,banded,
      window_id,credit_id,credit_applied_pence,net_pence,state,settled_by,settled_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,'SETTLED',?,?)`)
      .run(setId, i.id, period.id, c.delay_minutes, c.gross_pence, c.banded ? 1 : 0, c.window_id,
           credit && c.credit_consumed ? credit.id : null, c.credit_applied_pence, c.net_pence,
           req.user.id, now());
    db.prepare("UPDATE incidents SET state='SETTLED', settlement_id=? WHERE id=?").run(setId, i.id);
    // The GROSS penalty is booked first; the credit is then a separate posting
    // that reduces the payable, so both figures survive in the ledger.
    journal(setId, `Delay penalty for ${i.id}`, '7100', '2100', c.gross_pence);
    if (c.credit_consumed && credit) {
      db.prepare("UPDATE mutual_aid_credits SET state='CONSUMED', consumed_on_settlement=? WHERE id=?")
        .run(setId, credit.id);
      journal(setId, `Mutual-aid credit ${credit.id} applied to ${i.id}`, '2100', '7150', c.credit_applied_pence);
    }
    db.prepare('INSERT INTO incident_events (incident_id,kind,actor_id,detail,created_at) VALUES (?,?,?,?,?)')
      .run(i.id, 'SETTLED', req.user.id, setId, now());
  });
  tx();
  audit(req.user.id, 'INCIDENT_SETTLED', setId, String(c.net_pence));
  if (c.credit_consumed && credit)
    notify(i.id, i.section_id, `Mutual-aid credit ${credit.id} was consumed against ${i.id}.`);
  else if (credit)
    notify(i.id, i.section_id, `Mutual-aid credit ${credit.id} stayed available: ${i.id} settled at ${S.money(c.gross_pence)}.`);
  res.status(201).json({
    settlement: db.prepare('SELECT * FROM incident_settlements WHERE id=?').get(setId),
    computed: c, credit_id: credit ? credit.id : null,
    credit_state: credit ? db.prepare('SELECT state FROM mutual_aid_credits WHERE id=?').get(credit.id).state : null,
    net_display: S.money(c.net_pence),
  });
});

app.post('/api/settlements/labour', auth('admin'), (req, res) => {
  const period = R.openPeriod(db);
  if (!period) return fail(res, 409, 'no settlement period is open',
    { open_period: null, periods: db.prepare('SELECT id,state FROM settlement_periods').all() });
  const ids = (req.body || {}).callout_ids;
  let rows = db.prepare('SELECT * FROM callouts WHERE settled_in IS NULL ORDER BY technician_id, starts_at').all();
  if (Array.isArray(ids) && ids.length) rows = rows.filter((c) => ids.includes(c.id));
  if (!rows.length) return fail(res, 409, 'there are no unsettled callouts to settle',
    { unsettled_callouts: 0, period_id: period.id });

  const byId = {};
  for (const t of db.prepare('SELECT * FROM technicians').all()) byId[t.id] = t;
  const spans = S.settleLabour(rows, byId);

  const created = [];
  const tx = db.transaction(() => {
    for (const s of spans) {
      const n = db.prepare('SELECT COUNT(*) AS c FROM labour_settlements WHERE technician_id=?').get(s.technician_id).c + 1;
      const lid = `LSET-${period.id}-${s.technician_id}-${n}`;
      db.prepare(`INSERT INTO labour_settlements (id,period_id,technician_id,parts,starts_at,ends_at,
        worked_minutes,billed_minutes,normal_minutes,overtime_minutes,night_minutes,
        base_pence,overtime_pence,night_pence,total_pence,state,settled_by,settled_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'SETTLED',?,?)`)
        .run(lid, period.id, s.technician_id, s.parts.join(','), s.starts_at, s.ends_at,
             s.worked_minutes, s.billed_minutes, s.normal_minutes, s.overtime_minutes, s.night_minutes,
             s.base_pence, s.overtime_pence, s.night_pence, s.total_pence, req.user.id, now());
      for (const p of s.parts) db.prepare('UPDATE callouts SET settled_in=? WHERE id=?').run(lid, p);
      journal(lid, `Labour for ${s.technician_id} (${s.parts.join('+')})`, '7200', '2300', s.total_pence);
      created.push({ id: lid, ...s, total_display: S.money(s.total_pence) });
    }
  });
  tx();
  audit(req.user.id, 'LABOUR_SETTLED', period.id, String(created.length));
  res.status(201).json({
    period_id: period.id, settlements: created,
    total_pence: created.reduce((t, s) => t + s.total_pence, 0),
    callouts_settled: rows.map((r) => r.id),
  });
});

// While the period is open a settlement may be edited. Once the period is
// CLOSED the settlement is immutable and the adjustment is APPENDED as an
// offset record - the original is never rewritten.
app.post('/api/settlements/:id/adjust', auth('admin'), (req, res) => {
  const id = req.params.id;
  const inc = db.prepare('SELECT * FROM incident_settlements WHERE id=?').get(id) || null;
  const lab = inc ? null : (db.prepare('SELECT * FROM labour_settlements WHERE id=?').get(id) || null);
  if (!inc && !lab) return bad(res, 'no such settlement', 404);
  const amount = (req.body || {}).amount_pence;
  const reason = (req.body || {}).reason || null;
  if (!Number.isInteger(amount) || amount === 0)
    return fail(res, 400, 'a non-zero integer amount_pence is required', { amount_pence: amount });

  const periodId = (inc || lab).period_id;
  const closed = R.periodClosed(db, periodId);
  const period = db.prepare('SELECT * FROM settlement_periods WHERE id=?').get(periodId) || null;

  if (!closed) {
    if (inc) {
      db.prepare('UPDATE incident_settlements SET net_pence=net_pence+? WHERE id=?').run(amount, inc.id);
      journal(inc.id, `Adjustment to ${inc.id}`, '7100', '2100', amount);
    } else {
      db.prepare('UPDATE labour_settlements SET total_pence=total_pence+? WHERE id=?').run(amount, lab.id);
      journal(lab.id, `Adjustment to ${lab.id}`, '7200', '2300', amount);
    }
    audit(req.user.id, 'SETTLEMENT_ADJUSTED', id, String(amount));
    return res.json({
      mode: 'EDITED', period_id: periodId, period_state: period ? period.state : null,
      settlement: inc ? db.prepare('SELECT * FROM incident_settlements WHERE id=?').get(id)
                      : db.prepare('SELECT * FROM labour_settlements WHERE id=?').get(id),
    });
  }

  const offId = `${id}-OFF-${db.prepare(
    inc ? 'SELECT COUNT(*) AS c FROM incident_settlements WHERE offsets_settlement_id=?'
        : 'SELECT COUNT(*) AS c FROM labour_settlements WHERE offsets_settlement_id=?').get(id).c + 1}`;
  const tx = db.transaction(() => {
    if (inc) {
      db.prepare(`INSERT INTO incident_settlements (id,incident_id,period_id,delay_minutes,gross_pence,banded,
        window_id,credit_id,credit_applied_pence,net_pence,state,offsets_settlement_id,reason,settled_by,settled_at)
        VALUES (?,?,?,0,0,0,NULL,NULL,0,?,'OFFSET',?,?,?,?)`)
        .run(offId, inc.incident_id, periodId, amount, inc.id, reason, req.user.id, now());
      journal(offId, `Offset against ${inc.id} in closed period ${periodId}`, '7900', '2100', amount);
    } else {
      db.prepare(`INSERT INTO labour_settlements (id,period_id,technician_id,parts,starts_at,ends_at,
        worked_minutes,billed_minutes,normal_minutes,overtime_minutes,night_minutes,
        base_pence,overtime_pence,night_pence,total_pence,state,offsets_settlement_id,reason,settled_by,settled_at)
        VALUES (?,?,?,'',?,?,0,0,0,0,0,0,0,0,?,'OFFSET',?,?,?,?)`)
        .run(offId, periodId, lab.technician_id, lab.starts_at, lab.ends_at, amount, lab.id, reason, req.user.id, now());
      journal(offId, `Offset against ${lab.id} in closed period ${periodId}`, '7900', '2300', amount);
    }
  });
  tx();
  audit(req.user.id, 'SETTLEMENT_OFFSET_APPENDED', id, offId);
  notify(id, null, `Period ${periodId} is closed; adjustment to ${id} was appended as offset ${offId}.`);
  res.status(201).json({
    mode: 'OFFSET_APPENDED', period_id: periodId, period_state: 'CLOSED',
    original_unchanged: inc ? db.prepare('SELECT * FROM incident_settlements WHERE id=?').get(id)
                            : db.prepare('SELECT * FROM labour_settlements WHERE id=?').get(id),
    offset: inc ? db.prepare('SELECT * FROM incident_settlements WHERE id=?').get(offId)
                : db.prepare('SELECT * FROM labour_settlements WHERE id=?').get(offId),
  });
});

app.post('/api/periods/:id/close', auth('admin'), (req, res) => {
  const p = db.prepare('SELECT * FROM settlement_periods WHERE id=?').get(req.params.id);
  if (!p) return bad(res, 'no such settlement period', 404);
  if (p.state === 'CLOSED')
    return fail(res, 409, 'that period is already closed',
      { period_id: p.id, period_state: p.state, closed_by: p.closed_by, closed_at: p.closed_at });
  db.prepare("UPDATE settlement_periods SET state='CLOSED', closed_by=?, closed_at=? WHERE id=?")
    .run(req.user.id, now(), p.id);
  const frozen = db.prepare('SELECT COUNT(*) AS c FROM incident_settlements WHERE period_id=?').get(p.id).c
               + db.prepare('SELECT COUNT(*) AS c FROM labour_settlements WHERE period_id=?').get(p.id).c;
  audit(req.user.id, 'PERIOD_CLOSED', p.id, String(frozen));
  notify(p.id, null, `Settlement period ${p.id} is closed; ${frozen} settlements are now immutable.`);
  res.json({ ...db.prepare('SELECT * FROM settlement_periods WHERE id=?').get(p.id), settlements_frozen: frozen });
});

// ---------------------------------------------------------------- admin
app.post('/api/admin/users/:id/role', auth('admin'), (req, res) => {
  const u = userOf(req.params.id);
  if (!u) return bad(res, 'no such user', 404);
  if (u.id === req.user.id)
    return fail(res, 409, 'an administrator cannot change their own role',
      { user_id: u.id, actor_id: req.user.id, self_change: true });
  const role = (req.body || {}).role;
  if (!R.ROLE_AREAS[role])
    return fail(res, 400, 'unknown role', { requested_role: role, known_roles: R.ALL_ROLES });
  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, u.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);
  audit(req.user.id, 'ROLE_CHANGED', u.id, `${u.role} -> ${role}`);
  res.json(db.prepare('SELECT id,name,email,role,suspended FROM users WHERE id=?').get(u.id));
});

app.post('/api/admin/users/:id/suspend', auth('admin'), (req, res) => {
  const u = userOf(req.params.id);
  if (!u) return bad(res, 'no such user', 404);
  if (u.id === req.user.id)
    return fail(res, 409, 'an administrator cannot suspend their own account',
      { user_id: u.id, actor_id: req.user.id, self_change: true });
  const suspended = (req.body || {}).suspended ? 1 : 0;
  db.prepare('UPDATE users SET suspended=? WHERE id=?').run(suspended, u.id);
  if (suspended) db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);
  audit(req.user.id, suspended ? 'USER_SUSPENDED' : 'USER_REINSTATED', u.id, null);
  res.json(db.prepare('SELECT id,name,email,role,suspended FROM users WHERE id=?').get(u.id));
});

// The audit trail is append-only: it can be read, never rewritten.
app.all('/api/audit/:id', auth('admin'), (req, res) => {
  if (req.method === 'GET') {
    const row = db.prepare('SELECT * FROM audit_log WHERE id=?').get(req.params.id);
    return row ? res.json(row) : bad(res, 'no such entry', 404);
  }
  return res.status(405).json({ error: 'the audit trail is append-only', method: req.method, entry_id: req.params.id });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'no such endpoint' }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`[signalworks] listening on ${PORT}`));
module.exports = app;

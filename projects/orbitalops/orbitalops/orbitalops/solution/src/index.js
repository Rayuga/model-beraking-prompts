'use strict';
// Orbital Ops Console HTTP layer — a ground-station console for a four-craft
// constellation: command queueing/execution, contact-window and propellant/
// battery budgets, checkout gating, two-person authorization for high-energy
// burns, role-scoped visibility and an append-only audit trail.
//
// Non-negotiables:
//  - /api/health answers immediately, never gated on seeding or the database.
//  - Identity comes ONLY from the session cookie. A role, propellant figure,
//    battery figure, window or checkout claimed in a request body is a CLAIM,
//    never authority; every decision is recomputed from stored records.
//  - The audit table is append-only; no route updates or deletes a line.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const dbmod = require('./db');
const { verifyPassword } = require('./auth');
const R = require('./rules');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Health is answered before any DB access and is never gated on seeding.
app.get('/health', (_req, res) => res.json({ ok: true, service: 'orbitalops' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'orbitalops' }));

let db = null;
try { db = dbmod.open(); }
catch (e) { console.error('[orbitalops] database open failed:', e.message); }

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

const now = () => new Date().toISOString();
const one = (sql, ...a) => db.prepare(sql).get(...a) || null;
const all = (sql, ...a) => db.prepare(sql).all(...a);
function audit(action, subjectRef, actorEmail, detail) {
  db.prepare('INSERT INTO audit (action, subject_ref, actor_email, at, detail) VALUES (?, ?, ?, ?, ?)')
    .run(action, subjectRef, actorEmail || null, now(), detail == null ? null : String(detail));
}

// Identity is re-read from the database on every request, so a demotion or a
// suspension takes effect on the very next write, not at next login.
function currentUser(req) {
  const t = req.cookies.ooc_session;
  if (!t) return null;
  const s = one('SELECT * FROM sessions WHERE token=?', t);
  if (!s) return null;
  const u = one('SELECT * FROM users WHERE email=?', s.email);
  if (!u || u.status !== 'ACTIVE') return null;
  return u;
}
function auth(...roles) {
  return (req, res, next) => {
    const u = currentUser(req);
    if (!u) return res.status(401).json({ error: 'Not signed in.' });
    if (roles.length && !roles.includes(u.role)) {
      return res.status(403).json({ error: 'Your role cannot do that.', your_role: u.role, allowed_roles: roles });
    }
    req.user = u;
    next();
  };
}
const bad = (res, code, msg, extra) => res.status(code).json({ error: msg, ...(extra || {}) });

// An analyst reads only the craft they are assigned. Used by every list AND
// by search — filtering one without the other is what the floor complained
// about. null = the whole constellation.
function visibleCraftCodes(user) {
  if (user.role !== 'analyst') return null;
  return all('SELECT craft_code FROM user_craft WHERE email = ?', user.email).map((r) => r.craft_code);
}
function scopeFilter(user, rows, key = 'craft_code') {
  const allowed = visibleCraftCodes(user);
  return allowed === null ? rows : rows.filter((r) => allowed.includes(r[key]));
}

const getCraft = (code) => one('SELECT * FROM craft WHERE code = ?', code);
const getCmd = (ref) => one('SELECT * FROM commands WHERE ref = ?', ref);
const allPasses = () => all('SELECT * FROM passes');

const userView = (u) => ({ email: u.email, name: u.name, role: u.role, status: u.status });

// ================================================================= auth
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = one('SELECT * FROM users WHERE email = ?', String(email || '').trim().toLowerCase());
  if (!u || !verifyPassword(String(password || ''), u.salt, u.pw_hash)) {
    return bad(res, 401, 'That email and password do not match.');
  }
  if (u.status !== 'ACTIVE') return bad(res, 403, 'This account is suspended.');
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, email, created_at) VALUES (?, ?, ?)').run(token, u.email, now());
  res.setHeader('Set-Cookie', `ooc_session=${token}; Path=/; HttpOnly; SameSite=Lax`);
  audit('LOGIN', u.email, u.email, null);
  res.json(userView(u));
});
app.post('/api/auth/logout', (req, res) => {
  const t = req.cookies.ooc_session;
  if (t) db.prepare('DELETE FROM sessions WHERE token = ?').run(t);
  res.setHeader('Set-Cookie', 'ooc_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
  res.json({ ok: true });
});
app.get('/api/auth/me', auth(), (req, res) => res.json(userView(req.user)));

// One shot state fetch the SPA renders every workspace from, mirroring the
// scoping every individual read route already enforces.
app.get('/api/bootstrap', auth(), (req, res) => {
  const craft = scopeFilter(req.user, all('SELECT * FROM craft ORDER BY code'), 'code');
  const commands = scopeFilter(req.user, all('SELECT * FROM commands ORDER BY starts_at'));
  res.json({
    user: userView(req.user),
    thresholds: dbmod.thresholds(db),
    craft,
    passes: scopeFilter(req.user, all('SELECT * FROM passes ORDER BY opens_at')),
    anomalies: scopeFilter(req.user, all('SELECT * FROM anomalies ORDER BY raised_at DESC')),
    commands,
    telemetry: scopeFilter(req.user, all('SELECT * FROM telemetry ORDER BY recorded_at DESC')),
    users: req.user.role === 'admin' ? all('SELECT * FROM users ORDER BY email').map(userView) : null,
    audit: req.user.role === 'admin' ? all('SELECT * FROM audit ORDER BY id DESC LIMIT 500') : null,
  });
});

// ================================================================= reads
// Every read below sits behind `auth`, so a signed-out caller gets 401 and no
// rows — a client-side redirect is not what stops them.
app.get('/api/craft', auth(), (req, res) => {
  res.json(scopeFilter(req.user, all('SELECT * FROM craft ORDER BY code'), 'code'));
});
app.get('/api/craft/:code', auth(), (req, res) => {
  const allowed = visibleCraftCodes(req.user);
  if (allowed && !allowed.includes(req.params.code)) return bad(res, 403, 'Not one of your assigned craft.');
  const c = getCraft(req.params.code);
  return c ? res.json(c) : bad(res, 404, 'No such craft.');
});
app.post('/api/craft/:code/checkout', auth('flight_director'), (req, res) => {
  const craft = getCraft(req.params.code);
  if (!craft) return bad(res, 404, 'No such craft.');
  const result = String((req.body || {}).result || '').toUpperCase();
  if (!['PASSED', 'FAILED'].includes(result)) return bad(res, 400, 'A checkout result must be PASSED or FAILED.');
  db.prepare('UPDATE craft SET checkout = ?, checkout_at = ? WHERE code = ?').run(result, now(), craft.code);
  audit('CHECKOUT', craft.code, req.user.email, result);
  res.json(getCraft(craft.code));
});

app.get('/api/passes', auth(), (req, res) => {
  res.json(scopeFilter(req.user, all('SELECT * FROM passes ORDER BY opens_at')));
});
app.get('/api/anomalies', auth(), (req, res) => {
  res.json(scopeFilter(req.user, all('SELECT * FROM anomalies ORDER BY raised_at DESC')));
});

// `q` is the search box, scoped through exactly the same filter as the list —
// an analyst cannot search their way to another craft.
app.get('/api/commands', auth(), (req, res) => {
  const q = String(req.query.q || '').trim().toUpperCase();
  let rows = scopeFilter(req.user, all('SELECT * FROM commands ORDER BY starts_at'));
  if (q) {
    rows = rows.filter((r) =>
      r.ref.toUpperCase().includes(q) || r.craft_code.toUpperCase().includes(q) ||
      r.type.toUpperCase().includes(q) || r.status.toUpperCase().includes(q));
  }
  res.json(rows);
});
app.get('/api/commands/:ref', auth(), (req, res) => {
  const c = getCmd(req.params.ref);
  if (!c) return bad(res, 404, 'No such command.');
  const allowed = visibleCraftCodes(req.user);
  if (allowed && !allowed.includes(c.craft_code)) return bad(res, 403, 'Not one of your assigned craft.');
  res.json(c);
});

app.post('/api/commands', auth('operator', 'flight_director'), (req, res) => {
  const b = req.body || {};
  const ref = String(b.ref || '').trim();
  if (!ref) return bad(res, 400, 'A command reference is required.');
  if (getCmd(ref)) return bad(res, 409, `Command reference ${ref} is already in use.`);
  const craft = getCraft(String(b.craft_code || b.craft || ''));
  if (!craft) return bad(res, 400, 'No such craft.');
  if (!b.starts_at || !b.ends_at) return bad(res, 400, 'A planned window is required.');
  db.prepare(
    `INSERT INTO commands (ref, craft_code, type, delta_v_ms, propellant_kg, battery_draw_pct,
       starts_at, ends_at, status, submitted_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`
  ).run(ref, craft.code, String(b.type || 'IMAGE').toUpperCase(), Number(b.delta_v_ms) || 0,
    Number(b.propellant_kg) || 0, Number(b.battery_draw_pct) || 0, String(b.starts_at), String(b.ends_at), req.user.email);
  audit('CREATE', ref, req.user.email, `Drafted for ${craft.code}`);
  res.status(201).json(getCmd(ref));
});

// Authorization is the second signature on a high-energy burn.
app.post('/api/commands/:ref/authorize', auth(), (req, res) => {
  const cmd = getCmd(req.params.ref);
  if (!cmd) return bad(res, 404, 'No such command.');
  const refused = R.canAuthorize(cmd, req.user);
  if (refused) return bad(res, refused.code === 'NOT_FLIGHT_DIRECTOR' ? 403 : 409, refused.message, { code: refused.code });
  db.prepare('UPDATE commands SET authorized_by = ?, authorized_at = ? WHERE ref = ?').run(req.user.email, now(), cmd.ref);
  audit('AUTHORIZE', cmd.ref, req.user.email, `delta-v ${cmd.delta_v_ms} m/s`);
  res.json(getCmd(cmd.ref));
});

// The uplink. Every figure below is read from the stored command and craft;
// anything the client put in the body is ignored outright.
app.post('/api/commands/:ref/execute', auth(), (req, res) => {
  const cmd = getCmd(req.params.ref);
  if (!cmd) return bad(res, 404, 'No such command.');
  const craft = getCraft(cmd.craft_code);
  const refused = R.canExecute(cmd, craft, allPasses(), req.user, dbmod.thresholds(db));
  if (refused) return bad(res, refused.code === 'NOT_PERMITTED' ? 403 : 409, refused.message, { code: refused.code });
  db.transaction(() => {
    db.prepare(`UPDATE craft SET propellant_kg = ROUND(propellant_kg - ?, 4), battery_pct = battery_pct - ? WHERE code = ?`)
      .run(cmd.propellant_kg, cmd.battery_draw_pct, craft.code);
    db.prepare("UPDATE commands SET status = 'EXECUTED', executed_at = ? WHERE ref = ?").run(now(), cmd.ref);
    db.prepare(`INSERT INTO telemetry (craft_code, recorded_at, battery_pct, propellant_kg, temp_c)
       SELECT code, ?, battery_pct, propellant_kg, 10 FROM craft WHERE code = ?`).run(now(), craft.code);
  })();
  audit('EXECUTE', cmd.ref, req.user.email, `Uplinked to ${craft.code}`);
  res.json(getCmd(cmd.ref));
});

app.post('/api/commands/:ref/cancel', auth(), (req, res) => {
  const cmd = getCmd(req.params.ref);
  if (!cmd) return bad(res, 404, 'No such command.');
  const refused = R.canCancel(cmd, req.user);
  if (refused) return bad(res, refused.code === 'NOT_PERMITTED' ? 403 : 409, refused.message, { code: refused.code });
  db.prepare("UPDATE commands SET status = 'CANCELLED' WHERE ref = ?").run(cmd.ref);
  audit('CANCEL', cmd.ref, req.user.email, null);
  res.json(getCmd(cmd.ref));
});

app.get('/api/telemetry', auth(), (req, res) => {
  const q = String(req.query.q || '').trim().toUpperCase();
  let rows = scopeFilter(req.user, all('SELECT * FROM telemetry ORDER BY recorded_at DESC'));
  if (q) rows = rows.filter((r) => r.craft_code.toUpperCase().includes(q));
  res.json(rows);
});

// ================================================================= admin
app.get('/api/users', auth('admin'), (req, res) => res.json(all('SELECT * FROM users ORDER BY email').map(userView)));
app.post('/api/users/:email/role', auth('admin'), (req, res) => {
  const target = one('SELECT * FROM users WHERE email = ?', req.params.email);
  if (!target) return bad(res, 404, 'No such user.');
  const role = String((req.body || {}).role || '');
  if (!['operator', 'flight_director', 'analyst', 'admin'].includes(role)) return bad(res, 400, 'Unknown role.');
  db.prepare('UPDATE users SET role = ? WHERE email = ?').run(role, target.email);
  audit('ROLE_CHANGE', target.email, req.user.email, `-> ${role}`);
  res.json({ email: target.email, role });
});
app.post('/api/users/:email/status', auth('admin'), (req, res) => {
  const target = one('SELECT * FROM users WHERE email = ?', req.params.email);
  if (!target) return bad(res, 404, 'No such user.');
  const status = String((req.body || {}).status || '').toUpperCase();
  if (!['ACTIVE', 'SUSPENDED'].includes(status)) return bad(res, 400, 'Unknown status.');
  db.prepare('UPDATE users SET status = ? WHERE email = ?').run(status, target.email);
  if (status === 'SUSPENDED') db.prepare('DELETE FROM sessions WHERE email = ?').run(target.email);
  audit('STATUS_CHANGE', target.email, req.user.email, status);
  res.json({ email: target.email, status });
});
// Append-only: there is no update or delete route for the audit trail, by design.
app.get('/api/audit', auth('admin'), (req, res) => res.json(all('SELECT * FROM audit ORDER BY id DESC LIMIT 500')));

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

app.listen(PORT, '0.0.0.0', () => console.log(`[orbitalops] listening on ${PORT}`));
module.exports = app;

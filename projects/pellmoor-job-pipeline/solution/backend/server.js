'use strict';
// Pellmoor hiring console. One Express process: the JSON API and the
// esbuild-bundled browser side. Every rule in rules.js runs here before a write,
// and the funnel is recomputed on every read rather than stored.

const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const R = require('./rules');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'pellmoor.db');
const SEED = process.env.SEED_PATH || '/recruitment/records/pellmoor_seed_data.json';
const PORT = Number(process.env.PORT || 3000);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS people (
  email TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS roles (
  code TEXT PRIMARY KEY, title TEXT NOT NULL, team TEXT NOT NULL, openings INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY, role TEXT NOT NULL, name TEXT NOT NULL,
  stage TEXT NOT NULL, history TEXT NOT NULL, applied_days INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS panels (
  candidate TEXT NOT NULL, member TEXT NOT NULL, PRIMARY KEY (candidate, member));
CREATE TABLE IF NOT EXISTS scores (
  candidate TEXT NOT NULL, panel_member TEXT NOT NULL, score INTEGER NOT NULL,
  PRIMARY KEY (candidate, panel_member));
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, candidate TEXT NOT NULL,
  author TEXT NOT NULL, at INTEGER NOT NULL, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, email TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
`);

let PASSWORD = 'password123';
let CLOCK = 0;

function seed() {
  const row = db.prepare("SELECT v FROM meta WHERE k='pw'").get();
  if (row) {
    PASSWORD = row.v;
    CLOCK = Number(db.prepare("SELECT v FROM meta WHERE k='clock'").get().v);
    return;
  }
  const s = JSON.parse(fs.readFileSync(SEED, 'utf8'));
  PASSWORD = s.seed_password;
  CLOCK = Date.parse(s.clock);
  db.transaction(() => {
    for (const p of s.people) {
      db.prepare('INSERT INTO people (email,name,role) VALUES (?,?,?)')
        .run(p.email, p.name, p.role);
    }
    for (const r of s.roles) {
      db.prepare('INSERT INTO roles (code,title,team,openings) VALUES (?,?,?,?)')
        .run(r.code, r.title, r.team, r.openings);
    }
    for (const c of s.candidates) {
      db.prepare(`INSERT INTO candidates (id,role,name,stage,history,applied_days)
        VALUES (?,?,?,?,?,?)`).run(
        c.id, c.role, c.name, c.stage, JSON.stringify(c.history), c.days_since_applied);
    }
    for (const p of s.panels) {
      for (const m of p.members) {
        db.prepare('INSERT INTO panels (candidate,member) VALUES (?,?)').run(p.candidate, m);
      }
    }
    for (const sc of s.scores) {
      db.prepare('INSERT INTO scores (candidate,panel_member,score) VALUES (?,?,?)')
        .run(sc.candidate, sc.panel_member, sc.score);
    }
    db.prepare("INSERT INTO meta (k,v) VALUES ('pw',?)").run(PASSWORD);
    db.prepare("INSERT INTO meta (k,v) VALUES ('clock',?)").run(String(CLOCK));
  })();
}
seed();

const candidates = () => db.prepare('SELECT * FROM candidates').all()
  .map((c) => ({ ...c, history: JSON.parse(c.history) }));
const panelOf = (id) => db.prepare('SELECT member FROM panels WHERE candidate=?')
  .all(id).map((r) => r.member);
const scoresOf = (id) => db.prepare('SELECT * FROM scores WHERE candidate=?').all(id);
const managers = () => db.prepare("SELECT email FROM people WHERE role='hiring manager'")
  .all().map((r) => r.email);

const app = express();
app.use(express.json({ limit: '64kb' }));
const fail = (res, r) => res.status(r.code).json({ error: r.error });

function who(req) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)pm=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const s = db.prepare('SELECT email FROM sessions WHERE token=?').get(m[1]);
  return s ? db.prepare('SELECT * FROM people WHERE email=?').get(s.email) : null;
}
const needAuth = (req, res, next) => {
  const p = who(req);
  if (!p) return res.status(401).json({ error: 'Please sign in.' });
  req.person = p;
  next();
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const p = db.prepare('SELECT * FROM people WHERE email=?').get(String(email || ''));
  if (!p || password !== PASSWORD) {
    return res.status(401).json({ error: 'That email and password do not match.' });
  }
  const token = crypto.randomBytes(18).toString('base64url');
  db.prepare('INSERT INTO sessions (token,email) VALUES (?,?)').run(token, p.email);
  res.setHeader('Set-Cookie', `pm=${token}; Path=/; SameSite=Lax; HttpOnly`);
  res.json({ person: p });
});

app.post('/api/logout', (req, res) => {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)pm=([A-Za-z0-9_-]+)/);
  if (m) db.prepare('DELETE FROM sessions WHERE token=?').run(m[1]);
  res.setHeader('Set-Cookie', 'pm=; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', needAuth, (req, res) =>
  res.json({ person: req.person, stages: R.STAGES, terminal: R.TERMINAL,
             score_range: [R.SCORE_MIN, R.SCORE_MAX], min_panel: R.MIN_PANEL }));

app.get('/api/roles', needAuth, (_req, res) => {
  const cs = candidates();
  res.json({
    roles: db.prepare('SELECT * FROM roles ORDER BY code').all().map((r) => ({
      ...r,
      live: cs.filter((c) => c.role === r.code && !R.isTerminal(c.stage)).length,
      total: cs.filter((c) => c.role === r.code).length,
    })),
  });
});

// The funnel and the stage columns come from ONE response, so the chart and the
// columns cannot disagree with each other.
app.get('/api/roles/:code', needAuth, (req, res) => {
  const role = db.prepare('SELECT * FROM roles WHERE code=?').get(req.params.code);
  if (!role) return res.status(404).json({ error: 'no such vacancy' });
  const cs = candidates().filter((c) => c.role === role.code);
  res.json({
    role,
    funnel: R.funnel(candidates(), role.code),
    candidates: cs.map((c) => ({
      ...c, panel: panelOf(c.id), scores: scoresOf(c.id),
      notes: db.prepare('SELECT COUNT(*) n FROM notes WHERE candidate=?').get(c.id).n,
    })),
  });
});

app.get('/api/candidates/:id', needAuth, (req, res) => {
  const c = candidates().find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'no such candidate' });
  res.json({
    candidate: c, panel: panelOf(c.id), scores: scoresOf(c.id),
    notes: db.prepare('SELECT * FROM notes WHERE candidate=? ORDER BY id').all(c.id),
    people: db.prepare('SELECT * FROM people').all(),
  });
});

app.post('/api/candidates', needAuth, (req, res) => {
  { const g = R.may(req.person, 'add'); if (!g.ok) return fail(res, g); }
  const { role, name } = req.body || {};
  if (!db.prepare('SELECT 1 FROM roles WHERE code=?').get(String(role || ''))) {
    return res.status(404).json({ error: 'no such vacancy' });
  }
  const r = R.admitCandidate(candidates(), role, name);
  if (!r.ok) return fail(res, r);
  const id = 'CAND-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  db.prepare(`INSERT INTO candidates (id,role,name,stage,history,applied_days)
    VALUES (?,?,?,'applied',?,0)`).run(id, role, r.name, JSON.stringify(['applied']));
  res.status(201).json({ id });
});

app.post('/api/candidates/:id/stage', needAuth, (req, res) => {
  { const g = R.may(req.person, 'move'); if (!g.ok) return fail(res, g); }
  const c = candidates().find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'no such candidate' });
  const to = String((req.body || {}).stage || '');
  const verdict = R.admitTransition(c.stage, to, {
    panel: panelOf(c.id), scores: scoresOf(c.id), managers: managers(),
  });
  if (!verdict.ok) return fail(res, verdict);
  // History records where they have BEEN. A stage already visited is not added
  // twice, so moving back and forward again does not inflate the funnel.
  const history = c.history.includes(to) ? c.history : [...c.history, to];
  db.prepare('UPDATE candidates SET stage=?, history=? WHERE id=?')
    .run(to, JSON.stringify(history), c.id);
  res.json({ stage: to, funnel: R.funnel(candidates(), c.role) });
});

app.post('/api/candidates/:id/panel', needAuth, (req, res) => {
  { const g = R.may(req.person, 'panel'); if (!g.ok) return fail(res, g); }
  const c = candidates().find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'no such candidate' });
  const member = String((req.body || {}).member || '');
  if (!db.prepare('SELECT 1 FROM people WHERE email=?').get(member)) {
    return res.status(404).json({ error: 'no such person' });
  }
  db.prepare('INSERT OR IGNORE INTO panels (candidate,member) VALUES (?,?)')
    .run(c.id, member);
  res.status(201).json({ panel: panelOf(c.id) });
});

app.post('/api/candidates/:id/score', needAuth, (req, res) => {
  { const g = R.may(req.person, 'score'); if (!g.ok) return fail(res, g); }
  const c = candidates().find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'no such candidate' });
  const verdict = R.admitScore((req.body || {}).score);
  if (!verdict.ok) return fail(res, verdict);
  // You score as yourself, and only if you are on the panel.
  if (!panelOf(c.id).includes(req.person.email)) {
    return res.status(403).json({ error: 'only the panel scores this candidate' });
  }
  db.prepare(`INSERT INTO scores (candidate,panel_member,score) VALUES (?,?,?)
    ON CONFLICT(candidate,panel_member) DO UPDATE SET score=excluded.score`)
    .run(c.id, req.person.email, Number(req.body.score));
  res.status(201).json({ scores: scoresOf(c.id) });
});

app.post('/api/candidates/:id/notes', needAuth, (req, res) => {
  const c = candidates().find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'no such candidate' });
  const body = String((req.body || {}).body || '').trim();
  if (!body) return res.status(409).json({ error: 'a note needs something in it' });
  db.prepare('INSERT INTO notes (candidate,author,at,body) VALUES (?,?,?,?)')
    .run(c.id, req.person.email, Date.now(), body);
  res.status(201).json({ ok: true });
});

// Notes are append-only. Both of these exist so the refusal is explicit rather
// than a 404 that looks like a routing mistake.
app.patch('/api/notes/:id', needAuth, (_req, res) =>
  res.status(409).json({ error: 'notes are never edited; add another saying so' }));
app.delete('/api/notes/:id', needAuth, (_req, res) =>
  res.status(409).json({ error: 'notes are never deleted; add another saying so' }));

// A candidate is never deleted. The policy says notes are never deleted and the
// funnel is derived from history, so removing the record would destroy both —
// and "withdrawn is terminal" only means anything if the withdrawn record
// survives. Leaving somebody the pipeline is a transition, not a deletion.
app.delete('/api/candidates/:id', needAuth, (req, res) => {
  const c = candidates().find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'no such candidate' });
  return res.status(409).json({
    error: 'a candidate is withdrawn, not deleted — the record is the trail. '
         + 'Move them to withdrawn instead.' });
});

app.use(express.static(path.join(ROOT, 'public')));
app.get(/.*/, (_req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`pellmoor pipeline on ${PORT}`));

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');
const R = require('./rules');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'pellmoor.db');
const SEED = process.env.SEED_PATH || '/recruitment/records/pellmoor_seed_data.json';
const PORT = Number(process.env.PORT || 3000);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS people (
  email TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
  password_salt TEXT NOT NULL, password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS roles (
  code TEXT PRIMARY KEY, title TEXT NOT NULL, team TEXT NOT NULL,
  openings INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY, role TEXT NOT NULL REFERENCES roles(code), name TEXT NOT NULL,
  stage TEXT NOT NULL, history TEXT NOT NULL, applied_days INTEGER NOT NULL,
  created_by TEXT NOT NULL REFERENCES people(email), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS panels (
  candidate TEXT NOT NULL REFERENCES candidates(id),
  member TEXT NOT NULL REFERENCES people(email), PRIMARY KEY (candidate, member));
CREATE TABLE IF NOT EXISTS scores (
  candidate TEXT NOT NULL REFERENCES candidates(id),
  panel_member TEXT NOT NULL REFERENCES people(email), score INTEGER NOT NULL,
  PRIMARY KEY (candidate, panel_member));
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, candidate TEXT NOT NULL REFERENCES candidates(id),
  author TEXT NOT NULL REFERENCES people(email), at TEXT NOT NULL, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL REFERENCES roles(code),
  candidate TEXT NOT NULL REFERENCES candidates(id), kind TEXT NOT NULL,
  actor TEXT NOT NULL REFERENCES people(email), at TEXT NOT NULL, details TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, email TEXT NOT NULL REFERENCES people(email), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mutation_receipts (
  actor TEXT NOT NULL REFERENCES people(email), operation_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL, status_code INTEGER NOT NULL, response_json TEXT NOT NULL,
  created_at TEXT NOT NULL, PRIMARY KEY (actor, operation_id));
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_candidates_role ON candidates(role);
CREATE INDEX IF NOT EXISTS idx_activity_candidate ON activity(candidate, id);
CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);
`);

function passwordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}

function passwordMatches(password, salt, expected) {
  const actual = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(expected, 'hex');
  return actual.length === stored.length && crypto.timingSafeEqual(actual, stored);
}

function bootstrap() {
  if (db.prepare('SELECT COUNT(*) AS count FROM people').get().count) return;
  const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
  db.transaction(() => {
    db.prepare("INSERT INTO meta (key,value) VALUES ('clock',?)")
      .run(String(Date.parse(seed.clock)));
    const addPerson = db.prepare(`INSERT INTO people
      (email,name,role,password_salt,password_hash) VALUES (?,?,?,?,?)`);
    for (const person of seed.people) {
      const password = passwordRecord(seed.seed_password);
      addPerson.run(person.email, person.name, person.role, password.salt, password.hash);
    }
    const addRole = db.prepare(`INSERT INTO roles
      (code,title,team,openings,revision) VALUES (?,?,?,?,0)`);
    for (const role of seed.roles) {
      addRole.run(role.code, role.title, role.team, role.openings);
    }
    const addCandidate = db.prepare(`INSERT INTO candidates
      (id,role,name,stage,history,applied_days,created_by,created_at)
      VALUES (?,?,?,?,?,?,?,?)`);
    for (const candidate of seed.candidates) {
      addCandidate.run(candidate.id, candidate.role, candidate.name, candidate.stage,
        JSON.stringify(candidate.history), candidate.days_since_applied,
        'hiring@pellmoor.test', seed.clock);
    }
    const addPanel = db.prepare('INSERT INTO panels (candidate,member) VALUES (?,?)');
    for (const panel of seed.panels) {
      for (const member of panel.members) addPanel.run(panel.candidate, member);
    }
    const addScore = db.prepare(`INSERT INTO scores
      (candidate,panel_member,score) VALUES (?,?,?)`);
    for (const score of seed.scores) {
      addScore.run(score.candidate, score.panel_member, score.score);
    }
  })();
}
bootstrap();

function nextTime() {
  const now = Number(db.prepare("SELECT value FROM meta WHERE key='clock'").get().value) + 1000;
  db.prepare("UPDATE meta SET value=? WHERE key='clock'").run(String(now));
  return new Date(now).toISOString();
}

function currentRevision(role) {
  return Number(db.prepare('SELECT revision FROM roles WHERE code=?').get(role)?.revision ?? -1);
}

function incrementRevision(role) {
  db.prepare('UPDATE roles SET revision=revision+1 WHERE code=?').run(role);
  return currentRevision(role);
}

function candidateRow(id) {
  const row = db.prepare('SELECT * FROM candidates WHERE id=?').get(id);
  return row ? { ...row, history: JSON.parse(row.history) } : null;
}

function candidates() {
  return db.prepare('SELECT * FROM candidates ORDER BY id').all()
    .map((row) => ({ ...row, history: JSON.parse(row.history) }));
}

function panelOf(id) {
  return db.prepare('SELECT member FROM panels WHERE candidate=? ORDER BY member')
    .all(id).map((row) => row.member);
}

function scoresOf(id) {
  return db.prepare(`SELECT panel_member,score FROM scores
    WHERE candidate=? ORDER BY panel_member`).all(id);
}

function managers() {
  return db.prepare("SELECT email FROM people WHERE role='hiring manager'")
    .all().map((row) => row.email);
}

function roleSnapshot(code) {
  const role = db.prepare('SELECT code,title,team,openings FROM roles WHERE code=?').get(code);
  if (!role) return null;
  const all = candidates();
  const mine = all.filter((candidate) => candidate.role === code);
  return {
    role,
    revision: currentRevision(code),
    funnel: R.funnel(all, code),
    candidates: mine.map((candidate) => ({
      ...candidate,
      panel: panelOf(candidate.id),
      scores: scoresOf(candidate.id),
      notes: db.prepare('SELECT COUNT(*) AS count FROM notes WHERE candidate=?')
        .get(candidate.id).count,
      activity: db.prepare('SELECT COUNT(*) AS count FROM activity WHERE candidate=?')
        .get(candidate.id).count,
    })),
  };
}

function candidateSnapshot(id) {
  const candidate = candidateRow(id);
  if (!candidate) return null;
  return {
    candidate,
    revision: currentRevision(candidate.role),
    panel: panelOf(id),
    scores: scoresOf(id),
    notes: db.prepare(`SELECT n.*,p.name AS author_name FROM notes n
      JOIN people p ON p.email=n.author WHERE n.candidate=? ORDER BY n.id`).all(id),
    activity: db.prepare(`SELECT a.*,p.name AS actor_name FROM activity a
      JOIN people p ON p.email=a.actor WHERE a.candidate=? ORDER BY a.id DESC`).all(id)
      .map((event) => ({ ...event, details: JSON.parse(event.details) })),
    people: db.prepare('SELECT email,name,role FROM people ORDER BY email').all(),
  };
}

function currentUser(request) {
  const match = /^Bearer\s+([A-Za-z0-9_-]{32,180})$/i.exec(
    String(request.headers.authorization || ''));
  if (!match) return null;
  return db.prepare(`SELECT p.email,p.name,p.role,s.token FROM sessions s
    JOIN people p ON p.email=s.email WHERE s.token=?`).get(match[1]) || null;
}

function requireUser(request, response, next) {
  const person = currentUser(request);
  if (!person) return response.status(401).json({ error: 'Please sign in.' });
  request.person = person;
  next();
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function requireKeys(body, allowed) {
  const keys = Object.keys(body || {});
  if (keys.some((key) => !allowed.includes(key))) {
    throw httpError(400, 'The request contains fields this action does not accept.');
  }
}

function mutationMetadata(request) {
  const operationId = request.body?.operation_id;
  const expectedRevision = request.body?.expected_revision;
  if (typeof operationId !== 'string' || !/^[A-Za-z0-9_-]{20,120}$/.test(operationId)) {
    throw httpError(400, 'A valid operation identifier is required.');
  }
  if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision)
      || expectedRevision < 0) {
    throw httpError(400, 'A valid expected revision is required.');
  }
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({
    method: request.method, path: request.path, body: request.body,
  })).digest('hex');
  return { operationId, expectedRevision, fingerprint };
}

function activity(role, candidate, kind, actor, details) {
  db.prepare(`INSERT INTO activity (role,candidate,kind,actor,at,details)
    VALUES (?,?,?,?,?,?)`).run(role, candidate, kind, actor, nextTime(), JSON.stringify(details));
}

function performMutation(request, role, execute, successStatus = 200) {
  let metadata;
  try {
    metadata = mutationMetadata(request);
  } catch (error) {
    return { status: error.status || 400, payload: { error: error.message } };
  }
  const existing = db.prepare(`SELECT fingerprint,status_code,response_json
    FROM mutation_receipts WHERE actor=? AND operation_id=?`)
    .get(request.person.email, metadata.operationId);
  if (existing) {
    if (existing.fingerprint !== metadata.fingerprint) {
      return { status: 409, payload: {
        error: 'This operation identifier was already used for different input.',
        revision: currentRevision(role), snapshot: roleSnapshot(role),
      } };
    }
    return { status: existing.status_code, payload: JSON.parse(existing.response_json) };
  }

  return db.transaction(() => {
    let status = successStatus;
    let payload;
    try {
      const actual = currentRevision(role);
      if (actual < 0) throw httpError(404, 'No such vacancy.');
      if (metadata.expectedRevision !== actual) {
        throw httpError(409, 'This vacancy changed since your view was loaded. Review it and retry.');
      }
      payload = execute();
      const revision = incrementRevision(role);
      payload = { ...payload, revision, snapshot: roleSnapshot(role) };
    } catch (error) {
      status = Number(error.status) || 500;
      if (status >= 500) throw error;
      payload = {
        error: error.message,
        revision: currentRevision(role),
        snapshot: roleSnapshot(role),
      };
    }
    db.prepare(`INSERT INTO mutation_receipts
      (actor,operation_id,fingerprint,status_code,response_json,created_at)
      VALUES (?,?,?,?,?,?)`).run(request.person.email, metadata.operationId,
        metadata.fingerprint, status, JSON.stringify(payload), nextTime());
    return { status, payload };
  })();
}

function sendMutation(response, outcome) {
  response.status(outcome.status).json(outcome.payload);
}

const app = express();
app.disable('x-powered-by');
app.use((_request, response, next) => {
  response.set({
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'self'; form-action 'self'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
  next();
});
app.use(express.json({ limit: '128kb' }));

app.get('/api/health', (_request, response) => response.json({ ok: true }));

app.post('/api/login', (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim() : '';
  const password = typeof request.body?.password === 'string' ? request.body.password : '';
  const person = db.prepare('SELECT * FROM people WHERE email=?').get(email);
  if (!person || !passwordMatches(password, person.password_salt, person.password_hash)) {
    return response.status(401).json({ error: 'That email and password do not match.' });
  }
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token,email,created_at) VALUES (?,?,?)')
    .run(token, person.email, nextTime());
  response.json({
    token,
    person: { email: person.email, name: person.name, role: person.role },
  });
});

app.post('/api/logout', requireUser, (request, response) => {
  db.prepare('DELETE FROM sessions WHERE token=?').run(request.person.token);
  response.json({ ok: true });
});

app.get('/api/me', requireUser, (request, response) => response.json({
  person: { email: request.person.email, name: request.person.name, role: request.person.role },
  stages: R.STAGES,
  terminal: R.TERMINAL,
  score_range: [R.SCORE_MIN, R.SCORE_MAX],
  min_panel: R.MIN_PANEL,
}));

app.get('/api/roles', requireUser, (_request, response) => {
  const all = candidates();
  response.json({ roles: db.prepare(`SELECT code,title,team,openings,revision
    FROM roles ORDER BY code`).all().map((role) => ({
      ...role,
      live: all.filter((candidate) => candidate.role === role.code
        && !R.isTerminal(candidate.stage)).length,
      total: all.filter((candidate) => candidate.role === role.code).length,
    })) });
});

app.get('/api/roles/:code', requireUser, (request, response) => {
  const snapshot = roleSnapshot(request.params.code);
  if (!snapshot) return response.status(404).json({ error: 'No such vacancy.' });
  response.json(snapshot);
});

app.get('/api/candidates/:id', requireUser, (request, response) => {
  const snapshot = candidateSnapshot(request.params.id);
  if (!snapshot) return response.status(404).json({ error: 'No such candidate.' });
  response.json(snapshot);
});

app.post('/api/candidates', requireUser, (request, response) => {
  const role = typeof request.body?.role === 'string' ? request.body.role : '';
  const outcome = performMutation(request, role, () => {
    requireKeys(request.body, ['role', 'name', 'operation_id', 'expected_revision']);
    const permission = R.may(request.person, 'add');
    if (!permission.ok) throw httpError(permission.code, permission.error);
    const verdict = R.admitCandidate(candidates(), role, request.body.name);
    if (!verdict.ok) throw httpError(verdict.code, verdict.error);
    const id = `CAND-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    const at = nextTime();
    db.prepare(`INSERT INTO candidates
      (id,role,name,stage,history,applied_days,created_by,created_at)
      VALUES (?,?,?,'applied',?,0,?,?)`)
      .run(id, role, verdict.name, JSON.stringify(['applied']), request.person.email, at);
    activity(role, id, 'candidate_created', request.person.email,
      { name: verdict.name, stage: 'applied' });
    return { candidate: candidateRow(id) };
  }, 201);
  sendMutation(response, outcome);
});

app.post('/api/candidates/:id/stage', requireUser, (request, response) => {
  const candidate = candidateRow(request.params.id);
  if (!candidate) return response.status(404).json({ error: 'No such candidate.' });
  const outcome = performMutation(request, candidate.role, () => {
    requireKeys(request.body, ['stage', 'operation_id', 'expected_revision']);
    const permission = R.may(request.person, 'move');
    if (!permission.ok) throw httpError(permission.code, permission.error);
    const to = typeof request.body.stage === 'string' ? request.body.stage : '';
    const fresh = candidateRow(candidate.id);
    const verdict = R.admitTransition(fresh.stage, to, {
      panel: panelOf(fresh.id), scores: scoresOf(fresh.id), managers: managers(),
    });
    if (!verdict.ok) throw httpError(verdict.code, verdict.error);
    const history = fresh.history.includes(to) ? fresh.history : [...fresh.history, to];
    db.prepare('UPDATE candidates SET stage=?,history=? WHERE id=?')
      .run(to, JSON.stringify(history), fresh.id);
    activity(fresh.role, fresh.id, 'stage_changed', request.person.email,
      { from: fresh.stage, to });
    return { candidate: candidateRow(fresh.id) };
  });
  sendMutation(response, outcome);
});

app.post('/api/candidates/:id/panel', requireUser, (request, response) => {
  const candidate = candidateRow(request.params.id);
  if (!candidate) return response.status(404).json({ error: 'No such candidate.' });
  const outcome = performMutation(request, candidate.role, () => {
    requireKeys(request.body, ['member', 'operation_id', 'expected_revision']);
    const permission = R.may(request.person, 'panel');
    if (!permission.ok) throw httpError(permission.code, permission.error);
    const member = typeof request.body.member === 'string' ? request.body.member : '';
    if (!db.prepare('SELECT 1 FROM people WHERE email=?').get(member)) {
      throw httpError(404, 'No such person.');
    }
    if (panelOf(candidate.id).includes(member)) throw httpError(409, 'That person is already on the panel.');
    db.prepare('INSERT INTO panels (candidate,member) VALUES (?,?)').run(candidate.id, member);
    activity(candidate.role, candidate.id, 'panel_added', request.person.email, { member });
    return { panel: panelOf(candidate.id) };
  }, 201);
  sendMutation(response, outcome);
});

app.post('/api/candidates/:id/score', requireUser, (request, response) => {
  const candidate = candidateRow(request.params.id);
  if (!candidate) return response.status(404).json({ error: 'No such candidate.' });
  const outcome = performMutation(request, candidate.role, () => {
    requireKeys(request.body, ['score', 'operation_id', 'expected_revision']);
    const permission = R.may(request.person, 'score');
    if (!permission.ok) throw httpError(permission.code, permission.error);
    const verdict = R.admitScore(request.body.score);
    if (!verdict.ok) throw httpError(verdict.code, verdict.error);
    if (!panelOf(candidate.id).includes(request.person.email)) {
      throw httpError(403, 'Only this candidate\'s panel members may score them.');
    }
    db.prepare(`INSERT INTO scores (candidate,panel_member,score) VALUES (?,?,?)
      ON CONFLICT(candidate,panel_member) DO UPDATE SET score=excluded.score`)
      .run(candidate.id, request.person.email, request.body.score);
    activity(candidate.role, candidate.id, 'score_recorded', request.person.email,
      { score: request.body.score });
    return { scores: scoresOf(candidate.id) };
  }, 201);
  sendMutation(response, outcome);
});

app.post('/api/candidates/:id/notes', requireUser, (request, response) => {
  const candidate = candidateRow(request.params.id);
  if (!candidate) return response.status(404).json({ error: 'No such candidate.' });
  const outcome = performMutation(request, candidate.role, () => {
    requireKeys(request.body, ['body', 'operation_id', 'expected_revision']);
    const permission = R.may(request.person, 'note');
    if (!permission.ok) throw httpError(permission.code, permission.error);
    const body = typeof request.body.body === 'string' ? request.body.body.trim() : '';
    if (!body || body.length > 1000) throw httpError(400, 'A note needs 1 to 1000 characters.');
    const at = nextTime();
    const result = db.prepare(`INSERT INTO notes (candidate,author,at,body)
      VALUES (?,?,?,?)`).run(candidate.id, request.person.email, at, body);
    activity(candidate.role, candidate.id, 'note_added', request.person.email,
      { note_id: Number(result.lastInsertRowid), body });
    return { note: { id: Number(result.lastInsertRowid), author: request.person.email, at, body } };
  }, 201);
  sendMutation(response, outcome);
});

app.patch('/api/notes/:id', requireUser, (_request, response) =>
  response.status(409).json({ error: 'Notes are append-only; add a correction instead.' }));
app.delete('/api/notes/:id', requireUser, (_request, response) =>
  response.status(409).json({ error: 'Notes are append-only and cannot be deleted.' }));
app.delete('/api/activity/:id', requireUser, (_request, response) =>
  response.status(409).json({ error: 'Recorded activity cannot be deleted.' }));
app.delete('/api/candidates/:id', requireUser, (request, response) => {
  if (!candidateRow(request.params.id)) return response.status(404).json({ error: 'No such candidate.' });
  response.status(409).json({
    error: 'A candidate is withdrawn, not deleted. The record is the trail.',
  });
});

app.use(express.static(path.join(ROOT, 'public')));
app.get(/.*/, (_request, response) => response.sendFile(path.join(ROOT, 'public', 'index.html')));
app.use((error, _request, response, _next) => {
  const status = Number(error.status) || 500;
  if (status >= 400 && status < 500) {
    return response.status(status).json({ error: 'The request body is malformed.' });
  }
  console.error(error);
  response.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Pellmoor pipeline listening on ${PORT}`));

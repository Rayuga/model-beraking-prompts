'use strict';
const { isMainThread, parentPort } = require('node:worker_threads');
if (isMainThread) {
  module.exports = require('./bootstrap').start(__filename);
} else {
// HireOps HTTP layer: a recruiting workspace with a shared pipeline board and
// recruiter-candidate conversations.
//
//  - /api/health answers before the database is touched (see bootstrap.js).
//  - Identity comes only from the session cookie; nothing in a request body is authority.
//  - Every board change is one SQLite transaction: a refused move or bulk move leaves
//    every card, position and history row as it was.
//  - A card carries a version. A move made against an older version is refused, so two
//    people cannot silently overwrite each other.
//  - Candidates are served by their own read model and never receive staff-only data.
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const dbmod = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3000);
app.get('/health', (_req, res) => res.json({ ok: true, service: 'hireops' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'hireops' }));

const db = dbmod.open();
const { stages: STAGES, candidateLabels: LABELS, pageSize: PAGE } = dbmod.reference;
const FLOW = STAGES.filter((s) => s !== 'REJECTED');
const MANAGER_STAGES = ['INTERVIEW', 'OFFER', 'HIRED'];
const STAFF = ['recruiter', 'hiring_manager', 'observer'];
const title = (s) => s.charAt(0) + s.slice(1).toLowerCase();

app.use(express.json({ limit: '1mb' }));
app.use((req, _res, next) => {
  req.cookies = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) { try { req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch {} }
  }
  next();
});
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));

// Live updates: every successful write tells open workspaces that something changed.
// The stream carries no data; each listener re-reads through its own session.
const streams = new Set();
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && !req.path.startsWith('/api/auth/')) {
    res.on('finish', () => { if (res.statusCode < 400) for (const s of streams) s.write('event: changed\ndata: 1\n\n'); });
  }
  next();
});
setInterval(() => { for (const s of streams) s.write(': keep-alive\n\n'); }, 25000).unref();

const one = (sql, ...a) => db.prepare(sql).get(...a) || null;
const all = (sql, ...a) => db.prepare(sql).all(...a);
const run = (sql, ...a) => db.prepare(sql).run(...a);
const now = () => new Date().toISOString();
const uid = (p) => `${p}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
function reject(message, status = 400, details) { const e = new Error(message); e.status = status; e.details = details; throw e; }
const text = (v, label, max = 200) => {
  if (typeof v !== 'string' || !v.trim()) reject(`${label} is required.`);
  if (v.trim().length > max) reject(`${label} is too long.`);
  return v.trim();
};

function currentUser(req) {
  const t = req.cookies.hireops_session;
  const s = t && one('SELECT user_id FROM sessions WHERE token=?', t);
  return s ? one('SELECT id,name,email,role FROM users WHERE id=?', s.user_id) : null;
}
function auth(...roles) {
  return (req, res, next) => {
    const u = currentUser(req);
    if (!u) return res.status(401).json({ error: 'Sign in to continue.' });
    if (roles.length && !roles.includes(u.role)) return res.status(403).json({ error: 'Your role cannot do this.' });
    req.user = u;
    next();
  };
}

// ------------------------------------------------------------------ sign-in
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = one('SELECT * FROM users WHERE email=?', String(email || '').trim().toLowerCase());
  if (!u || u.password !== password) return res.status(401).json({ error: 'That email and password do not match an account.' });
  const token = crypto.randomBytes(24).toString('hex');
  run('INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)', token, u.id, now());
  res.setHeader('Set-Cookie', `hireops_session=${token}; Path=/; HttpOnly; SameSite=Lax`);
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role });
});
app.post('/api/auth/logout', (req, res) => {
  if (req.cookies.hireops_session) run('DELETE FROM sessions WHERE token=?', req.cookies.hireops_session);
  res.setHeader('Set-Cookie', 'hireops_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
  res.json({ ok: true });
});
app.get('/api/auth/me', (req, res) => {
  const u = currentUser(req);
  return u ? res.json(u) : res.status(401).json({ error: 'Sign in to continue.' });
});
app.get('/api/events', auth(), (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
  res.write('retry: 3000\n\n');
  streams.add(res);
  req.on('close', () => streams.delete(res));
});

// ------------------------------------------------------------------ conversations: access and read state
const jobOf = (a) => one('SELECT * FROM jobs WHERE id=?', a.job_id);
/* Who may open a conversation: every recruiter and the observer, the job's own hiring
 * manager, and the candidate the application belongs to. Only the first, third and
 * fourth of those may write. */
function threadAccess(user, a) {
  if (user.role === 'recruiter') return 'write';
  if (user.role === 'observer') return 'read';
  if (user.role === 'hiring_manager') return jobOf(a).manager_id === user.id ? 'write' : null;
  if (user.role === 'candidate') return a.candidate_user_id === user.id ? 'write' : null;
  return null;
}
function application(id, user, need) {
  const a = one('SELECT * FROM applications WHERE id=?', id);
  if (!a) reject('No such application.', 404);
  if (need) {
    const access = threadAccess(user, a);
    // A candidate asking about someone else's application learns nothing, not even that it exists.
    if (!access) reject(user.role === 'candidate' ? 'No such application.' : 'This conversation belongs to another hiring manager\'s job.', user.role === 'candidate' ? 404 : 403);
    if (need === 'write' && access !== 'write') reject('Your role can read this conversation but cannot write in it.', 403);
  }
  return a;
}
const lastRead = (userId, appId) => (one('SELECT last_read_id FROM reads WHERE user_id=? AND application_id=?', userId, appId) || { last_read_id: 0 }).last_read_id;
const unread = (userId, appId) => one('SELECT COUNT(*) AS c FROM messages WHERE application_id=? AND id>? AND sender_id<>?', appId, lastRead(userId, appId), userId).c;
function markRead(userId, appId, upTo) {
  const top = (one('SELECT MAX(id) AS m FROM messages WHERE application_id=?', appId) || {}).m || 0;
  const value = Math.max(lastRead(userId, appId), Math.min(Number.isSafeInteger(upTo) ? upTo : top, top));
  run(`INSERT INTO reads (user_id,application_id,last_read_id) VALUES (?,?,?)
       ON CONFLICT(user_id,application_id) DO UPDATE SET last_read_id=excluded.last_read_id`, userId, appId, value);
}
/* A message is seen once someone on the other side has opened the conversation at or
 * after it: the candidate for a staff message; a recruiter or the job's hiring manager
 * for a candidate message. The observer never counts as either side. */
function seenBoundary(a, viewerIsCandidate) {
  if (viewerIsCandidate) {
    const job = jobOf(a);
    return (one(`SELECT MAX(r.last_read_id) AS m FROM reads r JOIN users u ON u.id=r.user_id
      WHERE r.application_id=? AND (u.role='recruiter' OR u.id=?)`, a.id, job.manager_id) || {}).m || 0;
  }
  return a.candidate_user_id ? lastRead(a.candidate_user_id, a.id) : 0;
}
function messageView(m, a, viewer, boundary) {
  const sender = one('SELECT name,role FROM users WHERE id=?', m.sender_id);
  const mine = m.sender_id === viewer.id;
  return { id: m.id, body: m.body, created_at: m.created_at, sender_name: sender.name,
    from_candidate: sender.role === 'candidate', mine, seen: mine ? m.id <= boundary : undefined };
}
function threadSummary(a, user) {
  const last = one('SELECT * FROM messages WHERE application_id=? ORDER BY id DESC LIMIT 1', a.id);
  return { unread: unread(user.id, a.id), message_count: one('SELECT COUNT(*) AS c FROM messages WHERE application_id=?', a.id).c,
    last_message: last ? { id: last.id, body: last.body, created_at: last.created_at,
      sender_name: one('SELECT name FROM users WHERE id=?', last.sender_id).name } : null };
}

// ------------------------------------------------------------------ workspace read
function myUndo(user) {
  const a = one('SELECT * FROM actions WHERE actor_id=? ORDER BY id DESC LIMIT 1', user.id);
  return a && !a.undone ? { action_id: a.id, summary: a.summary } : null;
}
app.get('/api/bootstrap', auth(), (req, res) => {
  const u = req.user;
  if (u.role === 'candidate') {
    // Candidate read model: own applications only, the public status wording only.
    return res.json({ user: u, page_size: PAGE, applications: all('SELECT * FROM applications WHERE candidate_user_id=? ORDER BY created_at, id', u.id).map((a) => {
      const job = jobOf(a);
      return { id: a.id, job_title: job.title, team: job.team, status: LABELS[a.stage], ...threadSummary(a, u) };
    }) });
  }
  const users = all("SELECT id,name,role FROM users WHERE role<>'candidate' ORDER BY name");
  res.json({
    user: u, stages: STAGES, page_size: PAGE, users,
    jobs: all('SELECT * FROM jobs ORDER BY title, id'),
    applications: all('SELECT * FROM applications ORDER BY job_id, stage, position').map((a) => {
      const access = threadAccess(u, a);
      return { id: a.id, job_id: a.job_id, candidate_name: a.candidate_name, candidate_email: a.candidate_email, source: a.source,
        stage: a.stage, position: a.position, version: a.version, rejected_from: a.rejected_from, reject_reason: a.reject_reason,
        note_count: one('SELECT COUNT(*) AS c FROM notes WHERE application_id=?', a.id).c,
        thread: access, ...(access ? threadSummary(a, u) : {}) };
    }),
    activity: all('SELECT a.*, u.name AS actor_name FROM activity a JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC'),
    undo: myUndo(u),
  });
});

// ------------------------------------------------------------------ jobs and candidates
function log(jobId, appId, actor, kind, detail, actionId) {
  run('INSERT INTO activity (job_id,application_id,actor_id,kind,detail,action_id,created_at) VALUES (?,?,?,?,?,?,?)',
    jobId, appId, actor.id, kind, detail, actionId || null, now());
}
const column = (jobId, stage) => all('SELECT id FROM applications WHERE job_id=? AND stage=? ORDER BY position, id', jobId, stage).map((r) => r.id);
function writeColumn(ids) { ids.forEach((id, i) => run('UPDATE applications SET position=? WHERE id=?', i + 1, id)); }

app.post('/api/jobs', auth('recruiter'), (req, res) => {
  const b = req.body || {};
  const jobTitle = text(b.title, 'Job title'), team = text(b.team, 'Team');
  const manager = one("SELECT id FROM users WHERE id=? AND role='hiring_manager'", b.manager_id);
  if (!manager) reject('Choose a hiring manager.');
  if (!Number.isInteger(b.interview_limit) || b.interview_limit < 1 || b.interview_limit > 50) reject('Interview limit must be a whole number from 1 to 50.');
  const id = uid('JOB');
  db.transaction(() => {
    run('INSERT INTO jobs (id,title,team,recruiter_id,manager_id,interview_limit) VALUES (?,?,?,?,?,?)', id, jobTitle, team, req.user.id, manager.id, b.interview_limit);
    log(id, null, req.user, 'JOB_OPENED', `${req.user.name} opened ${jobTitle}`);
  })();
  res.json(one('SELECT * FROM jobs WHERE id=?', id));
});

app.post('/api/applications', auth('recruiter'), (req, res) => {
  const b = req.body || {};
  const job = one('SELECT * FROM jobs WHERE id=?', b.job_id);
  if (!job) reject('Choose a job.');
  const name = text(b.candidate_name, 'Candidate name'), source = text(b.source, 'Source', 80);
  const email = String(b.candidate_email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) reject('Enter a valid email address.', 400, { field: 'candidate_email' });
  if (one('SELECT id FROM applications WHERE job_id=? AND candidate_email=?', job.id, email))
    reject('This person has already applied to this job.', 409, { field: 'candidate_email' });
  const account = one("SELECT id FROM users WHERE email=? AND role='candidate'", email);
  const id = uid('APP');
  db.transaction(() => {
    run(`INSERT INTO applications (id,job_id,candidate_name,candidate_email,candidate_user_id,source,stage,position,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`, id, job.id, name, email, account ? account.id : null, source, 'APPLIED', column(job.id, 'APPLIED').length + 1, now());
    log(job.id, id, req.user, 'ADDED', `${req.user.name} added ${name} to Applied`);
  })();
  res.json(one('SELECT * FROM applications WHERE id=?', id));
});

// ------------------------------------------------------------------ moving cards
/* Validates one card's move for this person and returns the stage it lands in.
 * Nothing is written here. */
function checkMove(a, job, toStage, user, reason, givenVersion) {
  if (user.role !== 'recruiter' && user.role !== 'hiring_manager') reject('Your role cannot move candidates.', 403);
  if (!STAGES.includes(toStage)) reject('Choose a stage.');
  if (a.version !== givenVersion) {
    const last = one("SELECT a.detail FROM activity a WHERE a.application_id=? ORDER BY a.id DESC LIMIT 1", a.id);
    reject(`${a.candidate_name} was changed by someone else${last ? ' (' + last.detail + ')' : ''}. Nothing was moved; the board now shows the current position.`,
      409, { conflict: 'stale', application_id: a.id });
  }
  const from = a.stage;
  if (from !== toStage) {
    if (toStage === 'REJECTED') {
      if (from === 'HIRED') reject(`${a.candidate_name} is hired and cannot be rejected.`, 409, { application_id: a.id });
      if (typeof reason !== 'string' || !reason.trim()) reject('Give a reason for rejecting.', 400, { field: 'reason', application_id: a.id });
    } else if (from === 'REJECTED') {
      if (toStage !== a.rejected_from) reject(`${a.candidate_name} can only be reopened to ${title(a.rejected_from)}, the stage they were rejected from.`, 409, { application_id: a.id });
    } else if (Math.abs(FLOW.indexOf(toStage) - FLOW.indexOf(from)) !== 1) {
      reject(`${a.candidate_name} can only move one stage at a time; ${title(from)} to ${title(toStage)} skips a stage.`, 409, { application_id: a.id });
    }
  }
  if (user.role === 'hiring_manager') {
    if (job.manager_id !== user.id) reject('Only this job\'s own hiring manager can move its candidates.', 403, { application_id: a.id });
    const origin = from === 'REJECTED' ? a.rejected_from : from;
    const target = toStage === 'REJECTED' ? origin : toStage;
    if (!MANAGER_STAGES.includes(origin) || !MANAGER_STAGES.includes(target) || (toStage === 'REJECTED' && from === 'HIRED')
      || (from === 'REJECTED' && toStage === 'REJECTED'))
      reject('A hiring manager works only between Interview, Offer and Hired.', 403, { application_id: a.id });
  }
}
function describe(a, from, to, actor, reason) {
  if (from === to) return `${actor.name} reordered ${a.candidate_name} in ${title(to)}`;
  if (to === 'REJECTED') return `${actor.name} rejected ${a.candidate_name} from ${title(from)}: ${reason.trim()}`;
  if (from === 'REJECTED') return `${actor.name} reopened ${a.candidate_name} to ${title(to)}`;
  return `${actor.name} moved ${a.candidate_name} from ${title(from)} to ${title(to)}`;
}
/* Moves the given cards, in the given order, into one stage of one job. All of it
 * happens or none of it does. beforeId places a single card ahead of another card. */
function moveCards(items, toStage, beforeId, reason, user, kind) {
  return db.transaction(() => {
    let cards = items.map((it) => {
      const a = one('SELECT * FROM applications WHERE id=?', it.id);
      if (!a) reject('No such application.', 404);
      return a;
    });
    if (new Set(cards.map((c) => c.id)).size !== cards.length) reject('A candidate is listed twice.');
    const job = one('SELECT * FROM jobs WHERE id=?', cards[0].job_id);
    if (cards.some((c) => c.job_id !== job.id)) reject('Select candidates from one job at a time.');
    if (cards.length > 1) {                    // several together arrive in the order they had on the board
      const rank = (c) => STAGES.indexOf(c.stage) * 100000 + c.position;
      const order = cards.map((c, i) => i).sort((x, y) => rank(cards[x]) - rank(cards[y]));
      [cards, items] = [order.map((i) => cards[i]), order.map((i) => items[i])];
    }
    cards.forEach((a, i) => checkMove(a, job, toStage, user, reason, items[i].version));
    const entering = cards.filter((c) => c.stage !== 'INTERVIEW').length;
    if (toStage === 'INTERVIEW' && entering) {
      const held = column(job.id, 'INTERVIEW').length;
      if (held + entering > job.interview_limit)
        reject(`Interview is full for ${job.title}: ${held} of ${job.interview_limit} places are taken and this would add ${entering}.`, 409, { conflict: 'limit' });
    }
    const moving = new Set(cards.map((c) => c.id));
    if (beforeId != null) {
      const anchor = one('SELECT * FROM applications WHERE id=?', beforeId);
      if (!anchor || anchor.job_id !== job.id || anchor.stage !== toStage || moving.has(anchor.id))
        reject('That position is no longer on this board. Nothing was moved.', 409, { conflict: 'stale' });
    }
    const before = cards.map((a) => ({ id: a.id, stage: a.stage, index: column(job.id, a.stage).indexOf(a.id),
      rejected_from: a.rejected_from, reject_reason: a.reject_reason, version_after: a.version + 1 }));
    const touched = new Set([toStage, ...cards.map((c) => c.stage)]);
    const columns = Object.fromEntries([...touched].map((s) => [s, column(job.id, s).filter((id) => !moving.has(id))]));
    const at = beforeId != null ? columns[toStage].indexOf(beforeId) : columns[toStage].length;
    columns[toStage].splice(at, 0, ...cards.map((c) => c.id));
    const actionId = Number(run('INSERT INTO actions (actor_id,kind,summary,before_json,created_at) VALUES (?,?,?,?,?)', user.id, kind,
      cards.length === 1 ? describe(cards[0], cards[0].stage, toStage, user, reason || '') : `${user.name} moved ${cards.length} candidates to ${title(toStage)}`,
      JSON.stringify(before), now()).lastInsertRowid);
    for (const a of cards) {
      run('UPDATE applications SET stage=?, version=version+1, rejected_from=?, reject_reason=? WHERE id=?', toStage,
        toStage === 'REJECTED' ? (a.stage === 'REJECTED' ? a.rejected_from : a.stage) : null,
        toStage === 'REJECTED' ? (a.stage === 'REJECTED' ? a.reject_reason : reason.trim()) : null, a.id);
      log(job.id, a.id, user, a.stage === toStage ? 'REORDERED' : toStage === 'REJECTED' ? 'REJECTED' : a.stage === 'REJECTED' ? 'REOPENED' : 'MOVED',
        describe(a, a.stage, toStage, user, reason || ''), actionId);
    }
    for (const ids of Object.values(columns)) writeColumn(ids);
    return { action_id: actionId, moved: cards.map((c) => c.id) };
  }).immediate();
}
const version = (v) => { if (!Number.isInteger(v)) reject('Reload the board and try again.', 409, { conflict: 'stale' }); return v; };

/* Only staff who may move reach the move rules. Anyone else is refused before a card is
 * looked at, and a candidate asking about another application is told it does not exist. */
function mayMove(user, ids) {
  if (user.role === 'recruiter' || user.role === 'hiring_manager') return;
  for (const id of ids) {
    const a = one('SELECT candidate_user_id FROM applications WHERE id=?', id);
    if (!a || (user.role === 'candidate' && a.candidate_user_id !== user.id)) reject('No such application.', 404);
  }
  reject('Your role cannot move candidates.', 403);
}
app.post('/api/applications/:id/move', auth(), (req, res) => {
  const b = req.body || {};
  mayMove(req.user, [req.params.id]);
  res.json(moveCards([{ id: req.params.id, version: version(b.version) }], b.to_stage, b.before_id == null ? null : String(b.before_id), b.reason, req.user, 'MOVE'));
});
app.post('/api/moves/bulk', auth(), (req, res) => {
  const b = req.body || {};
  if (!Array.isArray(b.items) || b.items.length < 2 || b.items.length > 50) reject('Select between 2 and 50 candidates to move together.');
  mayMove(req.user, b.items.map((it) => String((it || {}).id)));
  res.json(moveCards(b.items.map((it) => ({ id: String((it || {}).id), version: version((it || {}).version) })), b.to_stage, null, b.reason, req.user, 'BULK'));
});

/* Undo puts every card of my most recent move back in the stage and place it came
 * from. It is refused, changing nothing, if any of those cards has changed since. */
app.post('/api/undo', auth('recruiter', 'hiring_manager'), (req, res) => {
  const result = db.transaction(() => {
    const action = one('SELECT * FROM actions WHERE actor_id=? ORDER BY id DESC LIMIT 1', req.user.id);
    if (!action || action.undone || action.id !== (req.body || {}).action_id) reject('There is nothing of yours to undo.', 409);
    const before = JSON.parse(action.before_json);
    const cards = before.map((b) => ({ b, a: one('SELECT * FROM applications WHERE id=?', b.id) }));
    const changed = cards.find(({ a, b }) => a.version !== b.version_after);
    if (changed) reject(`${changed.a.candidate_name} has been changed since your move, so it cannot be undone. Nothing was changed.`, 409, { conflict: 'stale' });
    const job = one('SELECT * FROM jobs WHERE id=?', cards[0].a.job_id);
    const returning = cards.filter(({ a, b }) => b.stage === 'INTERVIEW' && a.stage !== 'INTERVIEW').length;
    if (returning && column(job.id, 'INTERVIEW').length + returning > job.interview_limit)
      reject(`Interview is now full for ${job.title}, so the move cannot be undone. Nothing was changed.`, 409, { conflict: 'limit' });
    const moving = new Set(before.map((b) => b.id));
    const touched = new Set(cards.flatMap(({ a, b }) => [a.stage, b.stage]));
    const columns = Object.fromEntries([...touched].map((s) => [s, column(job.id, s).filter((id) => !moving.has(id))]));
    for (const b of [...before].sort((x, y) => x.index - y.index)) columns[b.stage].splice(Math.min(b.index, columns[b.stage].length), 0, b.id);
    for (const { a, b } of cards) {
      run('UPDATE applications SET stage=?, version=version+1, rejected_from=?, reject_reason=? WHERE id=?', b.stage, b.rejected_from, b.reject_reason, a.id);
      log(job.id, a.id, req.user, 'UNDONE', `${req.user.name} undid a move: ${a.candidate_name} is back in ${title(b.stage)}`, action.id);
    }
    for (const ids of Object.values(columns)) writeColumn(ids);
    run('UPDATE actions SET undone=1 WHERE id=?', action.id);
    return { undone: action.id, restored: before.map((b) => b.id) };
  }).immediate();
  res.json(result);
});

// ------------------------------------------------------------------ card detail and internal notes
/* Staff-only reads and writes on one application. A candidate asking about an application that
 * is not theirs is told it does not exist; their own is simply not open to them. */
function staffOnly(user, id, roles) {
  if (roles.includes(user.role)) return;
  if (user.role === 'candidate') {
    const a = one('SELECT candidate_user_id FROM applications WHERE id=?', id);
    if (!a || a.candidate_user_id !== user.id) reject('No such application.', 404);
  }
  reject('Your role cannot do that.', 403);
}
app.get('/api/applications/:id', auth(), (req, res) => {
  staffOnly(req.user, req.params.id, STAFF);
  const a = application(req.params.id, req.user);
  res.json({ id: a.id, notes: all('SELECT n.id,n.body,n.created_at,u.name AS author_name FROM notes n JOIN users u ON u.id=n.author_id WHERE n.application_id=? ORDER BY n.id', a.id) });
});
app.post('/api/applications/:id/notes', auth(), (req, res) => {
  staffOnly(req.user, req.params.id, ['recruiter', 'hiring_manager']);
  const a = application(req.params.id, req.user);
  if (req.user.role === 'hiring_manager' && jobOf(a).manager_id !== req.user.id) reject('Only this job\'s own hiring manager can add notes here.', 403);
  const body = text((req.body || {}).body, 'Note', 2000);
  const id = run('INSERT INTO notes (application_id,author_id,body,created_at) VALUES (?,?,?,?)', a.id, req.user.id, body, now()).lastInsertRowid;
  res.json({ id: Number(id) });
});

// ------------------------------------------------------------------ conversations
app.get('/api/applications/:id/messages', auth(), (req, res) => {
  const a = application(req.params.id, req.user, 'read');
  const boundary = seenBoundary(a, req.user.role === 'candidate');
  const view = (m) => messageView(m, a, req.user, boundary);
  const after = Number(req.query.after);
  if (Number.isSafeInteger(after) && after >= 0 && req.query.after !== undefined) {
    return res.json({ messages: all('SELECT * FROM messages WHERE application_id=? AND id>? ORDER BY id', a.id, after).map(view), seen_up_to: boundary });
  }
  const before = Number(req.query.before);
  const rows = Number.isSafeInteger(before) && before > 0
    ? all('SELECT * FROM messages WHERE application_id=? AND id<? ORDER BY id DESC LIMIT ?', a.id, before, PAGE)
    : all('SELECT * FROM messages WHERE application_id=? ORDER BY id DESC LIMIT ?', a.id, PAGE);
  rows.reverse();
  const earlier = rows.length ? one('SELECT COUNT(*) AS c FROM messages WHERE application_id=? AND id<?', a.id, rows[0].id).c : 0;
  res.json({ messages: rows.map(view), earlier_count: earlier, seen_up_to: boundary, first_unread_id:
    (one('SELECT MIN(id) AS m FROM messages WHERE application_id=? AND id>? AND sender_id<>?', a.id, lastRead(req.user.id, a.id), req.user.id) || {}).m || null });
});
app.post('/api/applications/:id/messages', auth(), (req, res) => {
  const a = application(req.params.id, req.user, 'write');
  const body = (req.body || {}).body;
  if (typeof body !== 'string' || !body.trim()) reject('Write a message before sending.');
  if (body.length > 4000) reject('That message is too long.');
  const id = db.transaction(() => {
    const mid = Number(run('INSERT INTO messages (application_id,sender_id,body,created_at) VALUES (?,?,?,?)', a.id, req.user.id, body.replace(/\s+$/, ''), now()).lastInsertRowid);
    markRead(req.user.id, a.id, mid);
    return mid;
  })();
  res.json({ id });
});
app.post('/api/applications/:id/read', auth(), (req, res) => {
  const a = application(req.params.id, req.user, 'read');
  markRead(req.user.id, a.id, (req.body || {}).up_to);
  res.json({ unread: unread(req.user.id, a.id) });
});

// ------------------------------------------------------------------ fallthrough
app.use('/api', (_req, res) => res.status(404).json({ error: 'No such endpoint.' }));
app.use((req, res, next) => {
  if (req.method === 'GET') return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  next();
});
app.use((error, _req, res, _next) => {
  const status = error.status && error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status === 500) console.error('[hireops] request failed:', error.message);
  res.status(status).json({ error: status === 500 ? 'Something went wrong; nothing was changed.' : error.message, ...(status !== 500 && error.details ? error.details : {}) });
});
const server = app.listen(PORT, '127.0.0.1', () => parentPort.postMessage({ port: server.address().port }));
module.exports = app;

}

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const Database = require('better-sqlite3');
const PORT = Number(process.env.PORT || 3000);
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'docketlight.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SESSION_COOKIE = 'docketlight_session';
const seedPath = process.env.SEED_PATH || path.join(__dirname, 'seed_data.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const cents = (value) => {
  if (!Number.isSafeInteger(value)) return null;
  return value;
};
const validIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const now = () => new Date().toISOString();
const id = (prefix = '') => `${prefix}${crypto.randomUUID()}`;
const fail = (res, status, error) => res.status(status).json({ error });

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL, region TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE'
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
      revoked_at TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS policies (
      id INTEGER PRIMARY KEY, number TEXT UNIQUE NOT NULL, region TEXT NOT NULL,
      holder TEXT NOT NULL, effective_from TEXT NOT NULL, effective_to TEXT NOT NULL,
      limit_cents INTEGER NOT NULL, deductible_cents INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL, region TEXT NOT NULL,
      policy_id INTEGER NOT NULL REFERENCES policies(id), claimant TEXT NOT NULL,
      loss_cents INTEGER NOT NULL, payable_cents INTEGER NOT NULL, status TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id), assigned_adjuster_id INTEGER REFERENCES users(id),
      medical_note TEXT, loss_date TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      reserve_cents INTEGER, reserve_requested_by INTEGER REFERENCES users(id),
      reserve_supervisor_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY, claim_id TEXT NOT NULL REFERENCES claims(id), type TEXT NOT NULL,
      note TEXT, added_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
      UNIQUE(claim_id, type)
    );
    CREATE TABLE IF NOT EXISTS reserve_requests (
      id TEXT PRIMARY KEY, claim_id TEXT NOT NULL REFERENCES claims(id), amount_cents INTEGER NOT NULL,
      requested_by INTEGER NOT NULL REFERENCES users(id), supervisor_by INTEGER REFERENCES users(id),
      status TEXT NOT NULL, created_at TEXT NOT NULL, superseded_at TEXT
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY, claim_id TEXT NOT NULL REFERENCES claims(id), amount_cents INTEGER NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE, requested_by INTEGER NOT NULL REFERENCES users(id),
      supervisor_by INTEGER REFERENCES users(id), status TEXT NOT NULL, created_at TEXT NOT NULL,
      released_at TEXT, released_by INTEGER REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS ledger (
      id TEXT PRIMARY KEY, claim_id TEXT NOT NULL REFERENCES claims(id), direction TEXT NOT NULL,
      amount_cents INTEGER NOT NULL, kind TEXT NOT NULL, related_id TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER REFERENCES users(id), action TEXT NOT NULL,
      entity TEXT NOT NULL, entity_id TEXT NOT NULL, revision INTEGER, details TEXT, created_at TEXT NOT NULL
    );
  `);

  const insertUser = db.prepare('INSERT OR IGNORE INTO users (id,email,name,password_hash,role,region,status) VALUES (?,?,?,?,?,?,?)');
  for (const user of seed.users || []) {
    insertUser.run(user.id, user.email, user.name, hashPassword(seed.account_password || 'password123'), user.role, user.region, user.status || 'ACTIVE');
  }
  const insertPolicy = db.prepare('INSERT OR IGNORE INTO policies (id,number,region,holder,effective_from,effective_to,limit_cents,deductible_cents) VALUES (?,?,?,?,?,?,?,?)');
  for (const policy of seed.policies || []) {
    insertPolicy.run(policy.id, policy.number, policy.region, policy.holder, policy.effective_from, policy.effective_to, policy.limit_cents, policy.deductible_cents);
  }
  const insertClaim = db.prepare(`INSERT OR IGNORE INTO claims (
    id,reference,region,policy_id,claimant,loss_cents,payable_cents,status,created_by,
    assigned_adjuster_id,medical_note,loss_date,revision,reserve_cents,
    reserve_requested_by,reserve_supervisor_by,
    created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const claim of seed.claims || []) {
    insertClaim.run(
      claim.id, claim.reference, claim.region, claim.policy_id, claim.claimant,
      claim.loss_cents, claim.payable_cents, claim.status, claim.created_by,
      claim.assigned_adjuster_id ?? null, claim.medical_note ?? null, claim.loss_date,
      claim.revision ?? 1, claim.reserve_cents ?? null,
      claim.reserve_requested_by ?? null, claim.reserve_supervisor_by ?? null,
      claim.created_at, claim.updated_at
    );
  }
  const insertEvidence = db.prepare('INSERT OR IGNORE INTO evidence (id,claim_id,type,note,added_by,created_at) VALUES (?,?,?,?,?,?)');
  for (const item of seed.evidence || []) {
    insertEvidence.run(item.id, item.claim_id, item.type, item.note ?? '', item.added_by, item.created_at);
  }
  const insertReserve = db.prepare('INSERT OR IGNORE INTO reserve_requests (id,claim_id,amount_cents,requested_by,supervisor_by,status,created_at,superseded_at) VALUES (?,?,?,?,?,?,?,?)');
  for (const item of seed.reserve_requests || []) {
    insertReserve.run(item.id, item.claim_id, item.amount_cents, item.requested_by, item.supervisor_by ?? null, item.status, item.created_at, item.superseded_at ?? null);
  }
  const insertPayment = db.prepare('INSERT OR IGNORE INTO payments (id,claim_id,amount_cents,idempotency_key,requested_by,supervisor_by,status,created_at,released_at,released_by) VALUES (?,?,?,?,?,?,?,?,?,?)');
  for (const item of seed.payments || []) {
    insertPayment.run(item.id, item.claim_id, item.amount_cents, item.idempotency_key, item.requested_by, item.supervisor_by ?? null, item.status, item.created_at, item.released_at ?? null, item.released_by ?? null);
  }
  const insertLedger = db.prepare('INSERT OR IGNORE INTO ledger (id,claim_id,direction,amount_cents,kind,related_id,created_at) VALUES (?,?,?,?,?,?,?)');
  for (const item of seed.ledger || []) {
    insertLedger.run(item.id, item.claim_id, item.direction, item.amount_cents, item.kind ?? 'PAYMENT', item.related_id, item.created_at);
  }
  const insertAudit = db.prepare('INSERT OR IGNORE INTO audit (id,actor_id,action,entity,entity_id,revision,details,created_at) VALUES (?,?,?,?,?,?,?,?)');
  for (const item of seed.audit || []) {
    insertAudit.run(item.id, item.actor_id, item.action, item.entity, item.entity_id, item.revision ?? null, typeof item.details === 'string' ? item.details : JSON.stringify(item.details || {}), item.created_at);
  }
}
init();

function audit(actor, action, entity, entityId, revision = null, details = {}) {
  db.prepare('INSERT INTO audit (actor_id,action,entity,entity_id,revision,details,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(actor?.id ?? null, action, entity, String(entityId), revision ?? 0, JSON.stringify(details), now());
}
function auditDetails(value) {
  try { return JSON.parse(value || '{}'); } catch { return {}; }
}
function claimTimeline(claimId) {
  return db.prepare(`SELECT a.action,a.entity,a.entity_id,a.revision,a.details,a.created_at,u.email actor_email
    FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id`).all()
    .map((row) => ({ ...row, details: auditDetails(row.details) }))
    .filter((row) => (row.entity === 'claim' && row.entity_id === claimId) || row.details.claimId === claimId);
}
function parseCookies(req) {
  const header = req.get('cookie') || '';
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index !== -1) {
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (key) cookies[key] = decodeURIComponent(value);
    }
  }
  return cookies;
}
function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
function auth(req, res, next) {
  const token = parseCookies(req)[SESSION_COOKIE] || '';
  if (!token) return fail(res, 401, 'Authentication required');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL`).get(tokenHash);
  if (!row || row.status !== 'ACTIVE') return fail(res, 401, 'Session is revoked or account is inactive');
  req.user = row;
  req.tokenHash = tokenHash;
  next();
}
function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next() : fail(res, 403, 'Your role is not permitted to perform this action');
}
function getClaim(claimId) {
  return db.prepare(`SELECT c.*, p.number policy_number,p.holder,p.effective_from,p.effective_to,p.limit_cents,p.deductible_cents, u.name adjuster_name
    FROM claims c JOIN policies p ON p.id=c.policy_id LEFT JOIN users u ON u.id=c.assigned_adjuster_id WHERE c.id=? OR c.reference=?`).get(claimId, claimId);
}
function canReadClaim(user, claim) {
  if (!claim) return false;
  if (['ADMIN','FINANCE'].includes(user.role)) return true;
  if (user.region !== claim.region) return false;
  if (user.role === 'ADJUSTER') return claim.assigned_adjuster_id === user.id;
  if (user.role === 'INTAKE') return claim.created_by === user.id;
  return user.role === 'SUPERVISOR';
}
function requireClaim(req, res, next) {
  const claim = getClaim(req.params.claimId || req.params.id);
  if (!claim || !canReadClaim(req.user, claim)) return fail(res, 404, 'Claim not found');
  req.claim = claim;
  next();
}
function claimView(user, claim) {
  const medicalVisible = (user.role === 'SUPERVISOR' && user.region === claim.region) || (user.role === 'ADJUSTER' && claim.assigned_adjuster_id === user.id);
  const evidence = db.prepare('SELECT type,note,created_at FROM evidence WHERE claim_id=? ORDER BY created_at').all(claim.id);
  const reserveHistory = db.prepare('SELECT id,amount_cents,status,supervisor_by,created_at,superseded_at FROM reserve_requests WHERE claim_id=? ORDER BY created_at,id').all(claim.id);
  const payment = db.prepare('SELECT id,amount_cents,status,idempotency_key,requested_by,supervisor_by,released_at,released_by FROM payments WHERE claim_id=? ORDER BY created_at DESC').all(claim.id);
  const ledgerRows = db.prepare('SELECT direction,amount_cents,kind,related_id,created_at FROM ledger WHERE claim_id=? ORDER BY created_at,id').all(claim.id);
  return {
    id: claim.id, reference: claim.reference, region: claim.region, status: claim.status,
    policy: { id: claim.policy_id, number: claim.policy_number, holder: claim.holder, effectiveFrom: claim.effective_from, effectiveTo: claim.effective_to, limitCents: claim.limit_cents, deductibleCents: claim.deductible_cents },
    claimant: claim.claimant, lossCents: claim.loss_cents, payableCents: claim.payable_cents,
    lossDate: claim.loss_date,
    revision: claim.revision, assignedAdjusterId: claim.assigned_adjuster_id, assignedAdjuster: claim.adjuster_name,
    reserveCents: claim.reserve_cents, reserveRequestedBy: claim.reserve_requested_by,
    reserveSupervisorBy: claim.reserve_supervisor_by,
    reserveApproved: Boolean(claim.reserve_supervisor_by),
    medicalNote: medicalVisible ? claim.medical_note : null, medicalNoteRedacted: Boolean(claim.medical_note && !medicalVisible),
    evidence, reserveHistory, payments: payment, ledger: ledgerRows, timeline: claimTimeline(claim.id),
    createdAt: claim.created_at, updatedAt: claim.updated_at
  };
}
function expectedRevision(res, claim, supplied) {
  if (Number(supplied) !== claim.revision) { fail(res, 409, `Stale revision. Current revision is ${claim.revision}`); return false; }
  return true;
}
function payable(loss, policy) { return Math.max(0, Math.min(loss, policy.limit_cents) - policy.deductible_cents); }
function reserveApproved(claim) { return Boolean(claim.reserve_supervisor_by); }

app.post('/api/auth/login', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email || '').toLowerCase());
  if (!user || !verifyPassword(String(req.body.password || ''), user.password_hash) || user.status !== 'ACTIVE') return fail(res, 401, 'Invalid credentials');
  const token = crypto.randomBytes(30).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash,user_id,created_at) VALUES (?,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'), user.id, now());
  setSessionCookie(res, token);
  audit(user, 'LOGIN', 'session', user.id);
  res.json({ ok: true, user: { id:user.id, email:user.email, name:user.name, role:user.role, region:user.region } });
});
app.post('/api/auth/logout', auth, (req, res) => {
  db.prepare('UPDATE sessions SET revoked_at=? WHERE token_hash=?').run(now(), req.tokenHash);
  clearSessionCookie(res);
  audit(req.user, 'LOGOUT', 'session', req.user.id);
  res.json({ ok: true });
});
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'Docketlight Enterprise', database: 'sqlite' }));
app.get('/api/me', auth, (req, res) => res.json({ user: { id:req.user.id, email:req.user.email, name:req.user.name, role:req.user.role, region:req.user.region, status:req.user.status } }));
app.get('/api/users', auth, (req, res) => {
  let rows = [];
  if (req.user.role === 'ADMIN') rows = db.prepare('SELECT id,email,name,role,region,status FROM users ORDER BY email').all();
  else if (req.user.role === 'SUPERVISOR') rows = db.prepare("SELECT id,email,name,role,region,status FROM users WHERE role='ADJUSTER' AND region=? ORDER BY email").all(req.user.region);
  else return fail(res, 403, 'User directory is not available to this role');
  res.json({ users: rows });
});
app.get('/api/policies', auth, (req, res) => {
  const rows = req.user.region === 'ALL' ? db.prepare('SELECT * FROM policies ORDER BY number').all() : db.prepare('SELECT * FROM policies WHERE region=? ORDER BY number').all(req.user.region);
  res.json({ policies: rows.map((p) => ({ id:p.id, number:p.number, region:p.region, holder:p.holder, effectiveFrom:p.effective_from, effectiveTo:p.effective_to, limitCents:p.limit_cents, deductibleCents:p.deductible_cents })) });
});
app.get('/api/claims', auth, (req, res) => {
  const rows = db.prepare(`SELECT c.*,p.number policy_number,p.holder,p.effective_from,p.effective_to,p.limit_cents,p.deductible_cents,u.name adjuster_name FROM claims c JOIN policies p ON p.id=c.policy_id LEFT JOIN users u ON u.id=c.assigned_adjuster_id ORDER BY c.updated_at DESC`).all();
  res.json({ claims: rows.filter((c) => canReadClaim(req.user, c)).map((c) => claimView(req.user, c)) });
});
app.get('/api/dashboard', auth, (req, res) => {
  const rows = db.prepare(`SELECT c.*,p.number policy_number,p.holder,p.effective_from,p.effective_to,p.limit_cents,p.deductible_cents,u.name adjuster_name FROM claims c JOIN policies p ON p.id=c.policy_id LEFT JOIN users u ON u.id=c.assigned_adjuster_id`).all().filter((c) => canReadClaim(req.user, c));
  res.json({ claims: rows.map((c) => claimView(req.user, c)), metrics: { open: rows.filter((c) => c.status !== 'SETTLED').length, exposureCents: rows.reduce((total, c) => total + c.payable_cents, 0) } });
});
app.get('/api/claims/:id', auth, requireClaim, (req, res) => res.json({ claim: claimView(req.user, req.claim) }));
app.post('/api/claims', auth, requireRole('INTAKE'), (req, res) => {
  const policy = db.prepare('SELECT * FROM policies WHERE id=? OR number=?').get(req.body.policyId, req.body.policyId);
  const loss = cents(req.body.lossCents);
  const lossDate = String(req.body.lossDate || '').trim();
  const reference = String(req.body.reference || '').trim().toUpperCase();
  if (!policy || policy.region !== req.user.region) return fail(res, 403, 'Policy is not available in your region');
  if (!reference || loss === null || loss <= 0 || !validIsoDate(lossDate)) return fail(res, 400, 'reference, valid loss date, and positive loss amount are required');
  if (lossDate < policy.effective_from || lossDate > policy.effective_to) return fail(res, 409, 'Loss date is outside the policy coverage period');
  if (db.prepare('SELECT 1 FROM claims WHERE reference=?').get(reference)) return fail(res, 409, 'External reference already exists');
  const claimId = id('clm-'); const stamp = now();
  db.prepare(`INSERT INTO claims (id,reference,region,policy_id,claimant,loss_cents,payable_cents,status,created_by,medical_note,loss_date,revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(claimId,reference,policy.region,policy.id,String(req.body.claimant || policy.holder),loss,payable(loss,policy),'DRAFT',req.user.id,String(req.body.medicalNote || ''),lossDate,1,stamp,stamp);
  const claim = getClaim(claimId); audit(req.user, 'CLAIM_CREATED', 'claim', claimId, 1, { reference, policy:policy.number, lossDate, lossCents:loss, payableCents:claim.payable_cents });
  res.status(201).json({ claim: claimView(req.user, claim) });
});
app.post('/api/claims/:claimId/submit', auth, requireClaim, (req, res) => {
  const c = req.claim;
  if (req.user.role !== 'INTAKE' || c.created_by !== req.user.id || c.status !== 'DRAFT') return fail(res, 403, 'Only the creating intake specialist may submit a draft');
  if (!expectedRevision(res, c, req.body.expectedRevision)) return;
  db.prepare('UPDATE claims SET status=?,revision=revision+1,updated_at=? WHERE id=?').run('SUBMITTED', now(), c.id);
  const updated = getClaim(c.id); audit(req.user, 'CLAIM_SUBMITTED', 'claim', c.id, updated.revision);
  res.json({ claim: claimView(req.user, updated) });
});
app.post('/api/claims/:claimId/assign', auth, requireRole('SUPERVISOR'), requireClaim, (req, res) => {
  const c=req.claim; const adjuster=db.prepare('SELECT * FROM users WHERE id=?').get(req.body.adjusterId);
  if (req.user.region !== c.region || !adjuster || adjuster.role !== 'ADJUSTER' || adjuster.region !== c.region || adjuster.status !== 'ACTIVE') return fail(res, 403, 'Assignment must stay with an active adjuster in the claim region');
  if (!['SUBMITTED','INVESTIGATING','READY_FOR_REVIEW'].includes(c.status)) return fail(res, 409, 'Only open claims may be assigned');
  if (!expectedRevision(res,c,req.body.expectedRevision)) return;
  db.prepare('UPDATE claims SET assigned_adjuster_id=?,revision=revision+1,updated_at=? WHERE id=?').run(adjuster.id,now(),c.id);
  const updated=getClaim(c.id); audit(req.user,c.assigned_adjuster_id?'ADJUSTER_REASSIGNED':'ADJUSTER_ASSIGNED','claim',c.id,updated.revision,{fromAdjusterId:c.assigned_adjuster_id,adjusterId:adjuster.id}); res.json({claim:claimView(req.user,updated)});
});
app.post('/api/claims/:claimId/reopen', auth, requireRole('SUPERVISOR'), requireClaim, (req, res) => {
  const c = req.claim;
  if (req.user.region !== c.region) return fail(res, 403, 'Supervisors may reopen only within their region');
  if (!c.assigned_adjuster_id) return fail(res, 409, 'Only an assigned claim may be reopened');
  if (!['SUBMITTED', 'INVESTIGATING', 'READY_FOR_REVIEW'].includes(c.status)) return fail(res, 409, 'Only open claims may be reopened');
  if (!expectedRevision(res, c, req.body.expectedRevision)) return;
  const previousAdjusterId = c.assigned_adjuster_id;
  db.prepare(`UPDATE claims SET assigned_adjuster_id=NULL,status='SUBMITTED',revision=revision+1,updated_at=? WHERE id=?`).run(now(), c.id);
  const updated = getClaim(c.id);
  audit(req.user, 'CLAIM_REOPENED', 'claim', c.id, updated.revision, { fromAdjusterId: previousAdjusterId });
  res.json({ claim: claimView(req.user, updated) });
});
app.post('/api/claims/:claimId/triage', auth, requireRole('ADJUSTER'), requireClaim, (req,res) => {
  const c=req.claim; if(c.assigned_adjuster_id!==req.user.id || c.status!=='SUBMITTED') return fail(res,403,'Only the assigned adjuster may triage a submitted claim');
  if(!expectedRevision(res,c,req.body.expectedRevision)) return;
  db.prepare('UPDATE claims SET status=?,revision=revision+1,updated_at=? WHERE id=?').run('INVESTIGATING',now(),c.id);
  const updated=getClaim(c.id); audit(req.user,'CLAIM_TRIAGED','claim',c.id,updated.revision); res.json({claim:claimView(req.user,updated)});
});
app.post('/api/claims/:claimId/evidence', auth, requireRole('ADJUSTER'), requireClaim, (req,res) => {
  const c=req.claim; const type=String(req.body.type || '').toUpperCase();
  if(c.assigned_adjuster_id!==req.user.id || c.status!=='INVESTIGATING') return fail(res,403,'Only the assigned adjuster may add investigation evidence');
  if(!expectedRevision(res,c,req.body.expectedRevision)) return;
  if(!['PHOTO','ESTIMATE'].includes(type)) return fail(res,400,'Evidence type must be PHOTO or ESTIMATE');
  db.prepare('INSERT OR REPLACE INTO evidence (id,claim_id,type,note,added_by,created_at) VALUES (?,?,?,?,?,?)').run(id('ev-'),c.id,type,String(req.body.note||''),req.user.id,now());
  db.prepare('UPDATE claims SET revision=revision+1,updated_at=? WHERE id=?').run(now(),c.id);
  const updated=getClaim(c.id); audit(req.user,'EVIDENCE_ADDED','claim',c.id,updated.revision,{type}); res.json({claim:claimView(req.user,updated)});
});
app.post('/api/claims/:claimId/ready', auth, requireRole('ADJUSTER'), requireClaim, (req,res) => {
  const c=req.claim; if(c.assigned_adjuster_id!==req.user.id || c.status!=='INVESTIGATING') return fail(res,403,'Only the assigned adjuster may request review');
  if(!expectedRevision(res,c,req.body.expectedRevision)) return;
  const have=db.prepare('SELECT type FROM evidence WHERE claim_id=?').all(c.id).map((x)=>x.type);
  if(!have.includes('PHOTO')) return fail(res,409,'PHOTO evidence is required');
  db.prepare('UPDATE claims SET status=?,revision=revision+1,updated_at=? WHERE id=?').run('READY_FOR_REVIEW',now(),c.id);
  const updated=getClaim(c.id); audit(req.user,'CLAIM_READY_FOR_REVIEW','claim',c.id,updated.revision); res.json({claim:claimView(req.user,updated)});
});
app.post('/api/claims/:claimId/amend', auth, requireRole('INTAKE'), requireClaim, (req,res) => {
  const c=req.claim; const loss=cents(req.body.lossCents); if(c.created_by!==req.user.id || loss===null || loss<=0) return fail(res,403,'Only the creating intake specialist may amend a positive loss amount');
  if(c.status==='SETTLED') return fail(res,409,'Closed claims cannot be amended');
  if(db.prepare('SELECT 1 FROM payments WHERE claim_id=?').get(c.id)) return fail(res,409,'A payment request freezes the claim financial basis');
  if(!expectedRevision(res,c,req.body.expectedRevision)) return;
  const policy=db.prepare('SELECT * FROM policies WHERE id=?').get(c.policy_id);
  const superseded=db.prepare("SELECT * FROM reserve_requests WHERE claim_id=? AND status IN ('PENDING','APPROVED')").all(c.id);
  const stamp=now();
  db.transaction(() => {
    db.prepare("UPDATE reserve_requests SET status='SUPERSEDED',superseded_at=? WHERE claim_id=? AND status IN ('PENDING','APPROVED')").run(stamp,c.id);
    db.prepare(`UPDATE claims SET loss_cents=?,payable_cents=?,status='SUBMITTED',reserve_cents=NULL,reserve_requested_by=NULL,reserve_supervisor_by=NULL,revision=revision+1,updated_at=? WHERE id=?`).run(loss,payable(loss,policy),stamp,c.id);
  })();
  const updated=getClaim(c.id);
  superseded.forEach((item) => audit(req.user,'RESERVE_SUPERSEDED','reserve',item.id,updated.revision,{claimId:c.id,amountCents:item.amount_cents,reason:'claim amendment'}));
  audit(req.user,'CLAIM_AMENDED','claim',c.id,updated.revision,{lossCents:loss}); res.json({claim:claimView(req.user,updated)});
});
app.post('/api/claims/:claimId/reserve', auth, requireRole('ADJUSTER'), requireClaim, (req,res) => {
  const c=req.claim; const amount=cents(req.body.amountCents);
  if(c.assigned_adjuster_id!==req.user.id || c.status!=='READY_FOR_REVIEW') return fail(res,403,'Only the assigned adjuster may request a reserve');
  if(!expectedRevision(res,c,req.body.expectedRevision)) return;
  if(amount===null || amount<=0 || amount>c.payable_cents) return fail(res,409,'Reserve must be positive and no greater than payable exposure');
  if(db.prepare('SELECT 1 FROM payments WHERE claim_id=?').get(c.id)) return fail(res,409,'A payment already binds this claim reserve');
  const previous=db.prepare("SELECT * FROM reserve_requests WHERE claim_id=? AND status IN ('PENDING','APPROVED') ORDER BY created_at DESC,id DESC LIMIT 1").get(c.id);
  const stamp=now(); const reserveId=id('res-');
  db.transaction(() => {
    db.prepare("UPDATE reserve_requests SET status='SUPERSEDED',superseded_at=? WHERE claim_id=? AND status IN ('PENDING','APPROVED')").run(stamp,c.id);
    db.prepare('INSERT INTO reserve_requests (id,claim_id,amount_cents,requested_by,status,created_at) VALUES (?,?,?,?,?,?)').run(reserveId,c.id,amount,req.user.id,'PENDING',stamp);
    db.prepare('UPDATE claims SET reserve_cents=?,reserve_requested_by=?,reserve_supervisor_by=NULL,revision=revision+1,updated_at=? WHERE id=?').run(amount,req.user.id,stamp,c.id);
  })();
  const updated=getClaim(c.id);
  if(previous) audit(req.user,'RESERVE_SUPERSEDED','reserve',previous.id,updated.revision,{claimId:c.id,amountCents:previous.amount_cents,replacedBy:reserveId});
  audit(req.user,'RESERVE_REQUESTED','claim',c.id,updated.revision,{amountCents:amount,reserveId}); res.json({claim:claimView(req.user,updated)});
});
app.post('/api/claims/:claimId/reserve-approve', auth, requireClaim, (req,res) => {
  const c=req.claim;
  if(!c.reserve_cents) return fail(res,409,'No reserve request exists');
  if(c.reserve_requested_by===req.user.id) return fail(res,403,'A requester cannot approve their own reserve');
  if(!expectedRevision(res,c,req.body.expectedRevision)) return;
  const current=db.prepare("SELECT * FROM reserve_requests WHERE claim_id=? AND status='PENDING' ORDER BY created_at DESC,id DESC LIMIT 1").get(c.id);
  if(!current || current.amount_cents!==c.reserve_cents) return fail(res,409,'No current reserve request exists');
  if(req.user.role!=='SUPERVISOR' || req.user.region!==c.region) return fail(res,403,'Only the regional supervisor may approve a reserve');
  if(current.supervisor_by || c.reserve_supervisor_by) return fail(res,409,'Supervisor approval is already complete');
  const stamp=now();
  db.transaction(() => {
    db.prepare('UPDATE claims SET reserve_supervisor_by=?,revision=revision+1,updated_at=? WHERE id=?').run(req.user.id,stamp,c.id);
    db.prepare("UPDATE reserve_requests SET supervisor_by=?,status='APPROVED' WHERE id=?").run(req.user.id,current.id);
  })();
  const updated=getClaim(c.id); audit(req.user,'RESERVE_APPROVED','claim',c.id,updated.revision,{amountCents:updated.reserve_cents}); res.json({claim:claimView(req.user,updated)});
});
app.post('/api/claims/:claimId/payment-request', auth, requireRole('ADJUSTER'), requireClaim, (req,res) => {
  const c=req.claim; const key=String(req.body.idempotencyKey||'').trim(); const proposedAmount=cents(req.body.amountCents);
  if(!key) return fail(res,400,'idempotencyKey is required');
  const existing=db.prepare('SELECT * FROM payments WHERE idempotency_key=?').get(key);
  if(existing) {
    if(existing.claim_id!==c.id || existing.requested_by!==req.user.id) return fail(res,409,'Idempotency key is bound to another payment intent');
    return res.json({payment:existing,replayed:true});
  }
  if(c.assigned_adjuster_id!==req.user.id || c.status!=='READY_FOR_REVIEW') return fail(res,403,'Only the assigned adjuster may request settlement');
  if(!reserveApproved(c)) return fail(res,409,'Approved reserve is required before settlement');
  if(proposedAmount===null || proposedAmount!==c.reserve_cents) return fail(res,409,'Payment amount must exactly match the approved reserve');
  if(db.prepare('SELECT 1 FROM payments WHERE claim_id=?').get(c.id)) return fail(res,409,'This claim already has a payment request');
  if(!expectedRevision(res,c,req.body.expectedRevision)) return;
  const payment={ id:id('pay-'), claimId:c.id, amount:c.reserve_cents, key, user:req.user.id, stamp:now() };
  db.transaction(() => {
    db.prepare('INSERT INTO payments (id,claim_id,amount_cents,idempotency_key,requested_by,status,created_at) VALUES (?,?,?,?,?,?,?)').run(payment.id,payment.claimId,payment.amount,payment.key,payment.user,'PENDING',payment.stamp);
    db.prepare('UPDATE claims SET revision=revision+1,updated_at=? WHERE id=?').run(payment.stamp,c.id);
  })();
  const updatedClaim=getClaim(c.id); audit(req.user,'PAYMENT_REQUESTED','payment',payment.id,updatedClaim.revision,{claimId:c.id,amountCents:payment.amount}); res.status(201).json({payment:{id:payment.id,amountCents:payment.amount,status:'PENDING'},replayed:false});
});
app.post('/api/payments/:paymentId/approve', auth, (req,res) => {
  const p=db.prepare('SELECT p.*,c.region,c.reserve_cents,c.revision,c.status AS claim_status FROM payments p JOIN claims c ON c.id=p.claim_id WHERE p.id=?').get(req.params.paymentId);
  if(!p || !canReadClaim(req.user,getClaim(p.claim_id))) return fail(res,404,'Payment not found');
  if(p.claim_status!=='READY_FOR_REVIEW') return fail(res,409,'The claim is no longer eligible for payment approval');
  if(p.status!=='PENDING') return fail(res,409,'Only pending payments may be approved');
  if(p.requested_by===req.user.id) return fail(res,403,'A requester cannot approve their own payment');
  if(!expectedRevision(res,p,req.body.expectedRevision)) return;
  if(req.user.role!=='SUPERVISOR' || req.user.region!==p.region) return fail(res,403,'Only the regional supervisor may approve this payment');
  if(p.supervisor_by) return fail(res,409,'Supervisor approval is already complete');
  const stamp=now();
  db.transaction(() => {
    db.prepare('UPDATE payments SET supervisor_by=? WHERE id=?').run(req.user.id,p.id);
    db.prepare('UPDATE claims SET revision=revision+1,updated_at=? WHERE id=?').run(stamp,p.claim_id);
  })();
  const updated=db.prepare('SELECT * FROM payments WHERE id=?').get(p.id); const updatedClaim=getClaim(p.claim_id); audit(req.user,'PAYMENT_APPROVED','payment',p.id,updatedClaim.revision,{claimId:p.claim_id,amountCents:p.amount_cents,approvalRole:req.user.role}); res.json({payment:updated});
});
app.post('/api/payments/:paymentId/release', auth, requireRole('FINANCE'), (req,res) => {
  const p=db.prepare('SELECT p.*,c.region,c.status AS claim_status,c.revision FROM payments p JOIN claims c ON c.id=p.claim_id WHERE p.id=?').get(req.params.paymentId);
  if(!p) return fail(res,404,'Payment not found');
  if(p.status==='RELEASED') return res.json({payment:p,replayed:true});
  if(!expectedRevision(res,p,req.body.expectedRevision)) return;
  if(p.status!=='PENDING' || p.claim_status!=='READY_FOR_REVIEW') return fail(res,409,'Payment is not releasable');
  if(!p.supervisor_by) return fail(res,409,'Supervisor approval is required before release');
  const stamp=now();
  const release=db.transaction(() => {
    db.prepare('UPDATE payments SET status=?,released_at=?,released_by=? WHERE id=?').run('RELEASED',stamp,req.user.id,p.id);
    db.prepare('UPDATE claims SET status=?,revision=revision+1,updated_at=? WHERE id=?').run('SETTLED',stamp,p.claim_id);
    db.prepare('INSERT INTO ledger (id,claim_id,direction,amount_cents,kind,related_id,created_at) VALUES (?,?,?,?,?,?,?)').run(id('led-'),p.claim_id,'DEBIT',p.amount_cents,'PAYMENT',p.id,stamp);
  });
  release(); const updated=db.prepare('SELECT * FROM payments WHERE id=?').get(p.id); const updatedClaim=getClaim(p.claim_id); audit(req.user,'PAYMENT_RELEASED','payment',p.id,updatedClaim.revision,{claimId:p.claim_id,amountCents:p.amount_cents}); res.json({payment:updated,replayed:false});
});
app.get('/api/ledger', auth, requireRole('FINANCE','ADMIN'), (req,res) => res.json({ ledger: db.prepare(`SELECT l.*,c.reference claim_reference
  FROM ledger l JOIN claims c ON c.id=l.claim_id ORDER BY l.created_at DESC,l.id`).all() }));
app.get('/api/audit', auth, requireRole('ADMIN'), (req,res) => res.json({ audit: db.prepare('SELECT a.*,u.email actor_email FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC').all() }));
app.post('/api/admin/users/:userId/suspend', auth, requireRole('ADMIN'), (req,res) => {
  const target=db.prepare('SELECT * FROM users WHERE id=?').get(req.params.userId); if(!target) return fail(res,404,'User not found');
  const stamp=now();
  db.transaction(() => {
    db.prepare('UPDATE users SET status=? WHERE id=?').run('SUSPENDED',target.id);
    db.prepare('UPDATE sessions SET revoked_at=COALESCE(revoked_at,?) WHERE user_id=?').run(stamp,target.id);
    audit(req.user,'ACCOUNT_SUSPENDED','user',target.id,null,{email:target.email});
  })();
  res.json({ok:true});
});
app.post('/api/admin/users/:userId/reactivate', auth, requireRole('ADMIN'), (req,res) => {
  const target=db.prepare('SELECT * FROM users WHERE id=?').get(req.params.userId); if(!target) return fail(res,404,'User not found');
  const stamp=now();
  db.transaction(() => {
    db.prepare('UPDATE users SET status=? WHERE id=?').run('ACTIVE',target.id);
    audit(req.user,'ACCOUNT_REINSTATED','user',target.id,null,{email:target.email});
  })();
  res.json({ok:true});
});
app.get(/.*/, (_req,res) => res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`Docketlight listening on ${PORT}`));

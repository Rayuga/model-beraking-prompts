import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const db = new Database(process.env.SQLITE_PATH || path.join(__dirname, 'oriel.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'client')));

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}${crypto.randomUUID()}`;
const fail = (res, status, error) => res.status(status).json({ error });
const money = (value) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : null;
const allDistrict = (user) => user.district === 'ALL';

function hash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function matches(password, stored) {
  const [salt, expected] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL, district TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE'
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
      revoked_at TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS parcels (
      id INTEGER PRIMARY KEY, number TEXT UNIQUE NOT NULL, district TEXT NOT NULL,
      zone TEXT NOT NULL, address TEXT NOT NULL, allowed_type TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS permits (
      id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL, district TEXT NOT NULL,
      parcel_id INTEGER NOT NULL REFERENCES parcels(id), permit_type TEXT NOT NULL,
      applicant TEXT NOT NULL, valuation_cents INTEGER NOT NULL, permit_fee_cents INTEGER NOT NULL,
      levy_cents INTEGER NOT NULL, status TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id),
      assigned_reviewer_id INTEGER REFERENCES users(id), assigned_inspector_id INTEGER REFERENCES users(id),
      plan_note TEXT, zoning_approved INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1,
      waiver_cents INTEGER, waiver_requested_by INTEGER REFERENCES users(id),
      waiver_supervisor_by INTEGER REFERENCES users(id), waiver_finance_by INTEGER REFERENCES users(id),
      foundation_passed INTEGER NOT NULL DEFAULT 0, final_passed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY, permit_id TEXT UNIQUE NOT NULL REFERENCES permits(id),
      permit_fee_cents INTEGER NOT NULL, levy_cents INTEGER NOT NULL, due_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY, assessment_id TEXT UNIQUE NOT NULL REFERENCES assessments(id),
      amount_cents INTEGER NOT NULL, receipt_key TEXT NOT NULL, recorded_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL, UNIQUE(assessment_id, receipt_key)
    );
    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY, permit_id TEXT NOT NULL REFERENCES permits(id), type TEXT NOT NULL,
      slot TEXT NOT NULL, inspector_id INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL,
      result_note TEXT, created_at TEXT NOT NULL, completed_at TEXT,
      UNIQUE(permit_id, type, slot)
    );
    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY, permit_id TEXT UNIQUE NOT NULL REFERENCES permits(id),
      issued_by INTEGER NOT NULL REFERENCES users(id), issued_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER REFERENCES users(id), action TEXT NOT NULL,
      entity TEXT NOT NULL, entity_id TEXT NOT NULL, revision INTEGER, details TEXT, created_at TEXT NOT NULL
    );
  `);
  const freshSeed = !db.prepare('SELECT 1 FROM permits LIMIT 1').get();
  const addUser = db.prepare('INSERT OR IGNORE INTO users (id,email,name,password_hash,role,district,status) VALUES (?,?,?,?,?,?,?)');
  [
    [1,'clerk.nadi@oriel.test','Nadi Ross','CLERK','NORTH'], [2,'clerk.suri@oriel.test','Suri Hale','CLERK','SOUTH'],
    [3,'review.arden@oriel.test','Arden Vale','REVIEWER','NORTH'], [4,'review.bela@oriel.test','Bela Moran','REVIEWER','SOUTH'],
    [5,'zoning.kael@oriel.test','Kael Drew','ZONING','NORTH'], [6,'zoning.iren@oriel.test','Iren Cole','ZONING','SOUTH'],
    [7,'inspector.mira@oriel.test','Mira Chen','INSPECTOR','NORTH'], [8,'inspector.ren@oriel.test','Ren Moss','INSPECTOR','SOUTH'],
    [9,'supervisor.oz@oriel.test','Oz Hart','SUPERVISOR','NORTH'], [10,'supervisor.lei@oriel.test','Lei Pratt','SUPERVISOR','SOUTH'],
    [11,'controller.vik@oriel.test','Vik Sato','FINANCE','ALL'], [12,'admin.elsa@oriel.test','Elsa Rowan','ADMIN','ALL']
  ].forEach(([userId,email,name,role,district]) => addUser.run(userId,email,name,hash('password123'),role,district,'ACTIVE'));
  const addParcel = db.prepare('INSERT OR IGNORE INTO parcels (id,number,district,zone,address,allowed_type) VALUES (?,?,?,?,?,?)');
  [[1,'PAR-N-100','NORTH','R2','18 Juniper Avenue','RESIDENTIAL_ADDITION'],[2,'PAR-N-200','NORTH','C1','240 Market Street','COMMERCIAL_SIGN'],[3,'PAR-S-100','SOUTH','R2','91 Orchard Lane','RESIDENTIAL_ADDITION'],[4,'PAR-S-200','SOUTH','C1','7 Foundry Road','COMMERCIAL_SIGN']].forEach((row) => addParcel.run(...row));
  const stamp = now();
  const addPermit = db.prepare(`INSERT OR IGNORE INTO permits (id,reference,district,parcel_id,permit_type,applicant,valuation_cents,permit_fee_cents,levy_cents,status,created_by,assigned_reviewer_id,assigned_inspector_id,plan_note,zoning_approved,revision,waiver_cents,waiver_requested_by,waiver_supervisor_by,waiver_finance_by,foundation_passed,final_passed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const fee = (type, valuation) => type === 'COMMERCIAL_SIGN' ? 50000 + Math.ceil(valuation / 100000) * 6000 : 25000 + Math.ceil(valuation / 100000) * 4000;
  const permit = (slug, reference, district, parcelId, type, applicant, valuation, status, creator, reviewer = null, inspector = null, note = null, zoning = 0, revision = 1, waiver = null, requester = null, supervisor = null, finance = null, foundation = 0, final = 0) => {
    const levy = type === 'COMMERCIAL_SIGN' ? 10000 : 5000;
    addPermit.run(slug,reference,district,parcelId,type,applicant,valuation,fee(type,valuation),levy,status,creator,reviewer,inspector,note,zoning,revision,waiver,requester,supervisor,finance,foundation,final,stamp,stamp);
  };
  permit('p-n-draft','PER-N-DRAFT','NORTH',1,'RESIDENTIAL_ADDITION','Juniper Works',900000,'DRAFT',1,null,null,'Restricted structural note: basement support review');
  permit('p-n-corr','PER-N-CORR','NORTH',1,'RESIDENTIAL_ADDITION','Juniper Works',1200000,'CORRECTIONS_REQUIRED',1,3,null,'Restricted plan note: egress dimension missing',0,3);
  permit('p-s-review','PER-S-REVIEW','SOUTH',3,'RESIDENTIAL_ADDITION','Orchard Collective',650000,'PLANS_REVIEW',2,4,null,'South reviewer note: verify fire separation',0,2);
  permit('p-n-hold','PER-N-HOLD','NORTH',2,'COMMERCIAL_SIGN','Market Lantern Co',2000000,'FEE_DUE',1,3,null,'Restricted sign illumination note',1,4,70000,1,9);
  permit('p-n-cert','PER-N-CERT','NORTH',1,'RESIDENTIAL_ADDITION','North Hill Renovation',700000,'CERTIFIED',1,3,7,null,1,5,null,null,null,null,1,1);
  permit('p-n-denied','PER-N-DENIED','NORTH',2,'COMMERCIAL_SIGN','Market Lantern Co',300000,'DENIED',1,3,null,null,0,2);

  // Independent browser-verification fixtures. Each workflow criterion receives
  // its own record so a failed earlier interaction cannot erase later credit.
  permit('p-n-submit','PER-N-SUBMIT','NORTH',1,'RESIDENTIAL_ADDITION','Submit House',1100000,'DRAFT',1);
  permit('p-n-assign','PER-N-ASSIGN','NORTH',2,'COMMERCIAL_SIGN','Assignment Signage',1500000,'SUBMITTED',1);
  permit('p-n-approve','PER-N-APPROVE','NORTH',1,'RESIDENTIAL_ADDITION','Approval Addition',1800000,'PLANS_REVIEW',1,3,null,'Reviewer seed note: confirm beam schedule',0,2);
  permit('p-n-review-correct','PER-N-REVIEW-CORRECT','NORTH',2,'COMMERCIAL_SIGN','Correction Sign',800000,'PLANS_REVIEW',1,3,null,'Reviewer seed note: verify illumination controls',0,2);
  permit('p-n-reset','PER-N-RESET','NORTH',1,'RESIDENTIAL_ADDITION','Reset Addition',1400000,'CORRECTIONS_REQUIRED',1,3,null,'Reviewer note: update egress sheet',0,4,30000,1,9,null);
  permit('p-n-zone','PER-N-ZONE','NORTH',2,'COMMERCIAL_SIGN','Zoning Sign',900000,'PLANS_APPROVED',1,3,null,'Approved plans ready for zoning',0,3);
  permit('p-n-waiver-small','PER-N-WAIVER-SMALL','NORTH',1,'RESIDENTIAL_ADDITION','Small Waiver Home',1600000,'FEE_DUE',1,3,null,null,1,4);
  permit('p-n-waiver-approve','PER-N-WAIVER-APPROVE','NORTH',1,'RESIDENTIAL_ADDITION','Waiver Approval Home',1700000,'FEE_DUE',1,3,null,null,1,4,40000,1);
  permit('p-n-waiver-large','PER-N-WAIVER-LARGE','NORTH',2,'COMMERCIAL_SIGN','Large Waiver Sign',2500000,'FEE_DUE',1,3,null,null,1,4,70000,1);
  permit('p-n-receipt','PER-N-RECEIPT','NORTH',1,'RESIDENTIAL_ADDITION','Receipt Addition',1300000,'FEE_DUE',1,3,null,null,1,4);
  permit('p-n-inspect','PER-N-INSPECT','NORTH',2,'COMMERCIAL_SIGN','Inspector Assignment',1000000,'FEE_DUE',1,3,null,null,1,4);
  permit('p-n-sequence','PER-N-SEQUENCE','NORTH',1,'RESIDENTIAL_ADDITION','Sequence Addition',1000000,'READY_FOR_INSPECTION',1,3,7,null,1,5);
  permit('p-n-slot','PER-N-SLOT','NORTH',1,'RESIDENTIAL_ADDITION','Slot Control Addition',1050000,'READY_FOR_INSPECTION',1,3,7,null,1,5);
  permit('p-n-fail','PER-N-FAIL','NORTH',2,'COMMERCIAL_SIGN','Failed Sign Inspection',950000,'READY_FOR_INSPECTION',1,3,7,null,1,5);
  permit('p-n-final','PER-N-FINAL','NORTH',1,'RESIDENTIAL_ADDITION','Final Inspection Home',1150000,'READY_FOR_INSPECTION',1,3,7,null,1,6,null,null,null,null,1,0);
  permit('p-n-cert-ready','PER-N-CERT-READY','NORTH',1,'RESIDENTIAL_ADDITION','Certificate Ready Home',1250000,'READY_FOR_INSPECTION',1,3,7,null,1,7,null,null,null,null,1,1);
  permit('p-s-control','PER-S-CONTROL','SOUTH',3,'RESIDENTIAL_ADDITION','South Scope Control',750000,'SUBMITTED',2);
  // Mutable fixtures are initial state, not startup reconciliation. Recreating
  // them after a restart would resurrect assessments, receipts, inspections,
  // or certificates that a legitimate workflow intentionally invalidated.
  if (freshSeed) {
    const addAssessment = db.prepare('INSERT OR IGNORE INTO assessments (id,permit_id,permit_fee_cents,levy_cents,due_cents,created_at) VALUES (?,?,?,?,?,?)');
    addAssessment.run('asmt-n-hold','p-n-hold',fee('COMMERCIAL_SIGN',2000000),10000,fee('COMMERCIAL_SIGN',2000000)+10000,stamp);
    addAssessment.run('asmt-n-cert','p-n-cert',fee('RESIDENTIAL_ADDITION',700000),5000,fee('RESIDENTIAL_ADDITION',700000)+5000,stamp);
    const seededAssessment = (slug, permitId, type, valuation, reduction = 0) => {
      const permitFee = fee(type, valuation); const levy = type === 'COMMERCIAL_SIGN' ? 10000 : 5000;
      addAssessment.run(slug,permitId,permitFee,levy,permitFee-reduction+levy,stamp);
    };
    seededAssessment('asmt-n-reset','p-n-reset','RESIDENTIAL_ADDITION',1400000,30000);
    seededAssessment('asmt-n-waiver-small','p-n-waiver-small','RESIDENTIAL_ADDITION',1600000);
    seededAssessment('asmt-n-waiver-approve','p-n-waiver-approve','RESIDENTIAL_ADDITION',1700000);
    seededAssessment('asmt-n-waiver-large','p-n-waiver-large','COMMERCIAL_SIGN',2500000);
    seededAssessment('asmt-n-receipt','p-n-receipt','RESIDENTIAL_ADDITION',1300000);
    seededAssessment('asmt-n-inspect','p-n-inspect','COMMERCIAL_SIGN',1000000);
    seededAssessment('asmt-n-sequence','p-n-sequence','RESIDENTIAL_ADDITION',1000000);
    seededAssessment('asmt-n-slot','p-n-slot','RESIDENTIAL_ADDITION',1050000);
    seededAssessment('asmt-n-fail','p-n-fail','COMMERCIAL_SIGN',950000);
    seededAssessment('asmt-n-final','p-n-final','RESIDENTIAL_ADDITION',1150000);
    seededAssessment('asmt-n-cert-ready','p-n-cert-ready','RESIDENTIAL_ADDITION',1250000);
    db.prepare('INSERT OR IGNORE INTO receipts (id,assessment_id,amount_cents,receipt_key,recorded_by,created_at) VALUES (?,?,?,?,?,?)').run('rec-n-cert','asmt-n-cert',fee('RESIDENTIAL_ADDITION',700000)+5000,'seed-receipt',11,stamp);
    const paid = (slug, assessmentId, amount) => db.prepare('INSERT OR IGNORE INTO receipts (id,assessment_id,amount_cents,receipt_key,recorded_by,created_at) VALUES (?,?,?,?,?,?)').run(slug,assessmentId,amount,`seed-${slug}`,11,stamp);
    paid('rec-n-inspect','asmt-n-inspect',fee('COMMERCIAL_SIGN',1000000)+10000);
    paid('rec-n-sequence','asmt-n-sequence',fee('RESIDENTIAL_ADDITION',1000000)+5000);
    paid('rec-n-slot','asmt-n-slot',fee('RESIDENTIAL_ADDITION',1050000)+5000);
    paid('rec-n-fail','asmt-n-fail',fee('COMMERCIAL_SIGN',950000)+10000);
    paid('rec-n-final','asmt-n-final',fee('RESIDENTIAL_ADDITION',1150000)+5000);
    paid('rec-n-cert-ready','asmt-n-cert-ready',fee('RESIDENTIAL_ADDITION',1250000)+5000);
    const addInspection = db.prepare('INSERT OR IGNORE INTO inspections (id,permit_id,type,slot,inspector_id,status,result_note,created_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?)');
    addInspection.run('ins-n-cert-found','p-n-cert','FOUNDATION','2026-03-01T09:00:00Z',7,'PASSED','Seed passed foundation',stamp,stamp);
    addInspection.run('ins-n-cert-final','p-n-cert','FINAL','2026-03-02T09:00:00Z',7,'PASSED','Seed passed final',stamp,stamp);
    addInspection.run('ins-n-slot-found','p-n-slot','FOUNDATION','2026-09-15T09:00:00Z',7,'SCHEDULED',null,stamp,null);
    addInspection.run('ins-n-fail-found','p-n-fail','FOUNDATION','2026-09-16T09:00:00Z',7,'SCHEDULED',null,stamp,null);
    addInspection.run('ins-n-final-found','p-n-final','FOUNDATION','2026-08-20T09:00:00Z',7,'PASSED','Foundation accepted',stamp,stamp);
    addInspection.run('ins-n-final-final','p-n-final','FINAL','2026-09-17T09:00:00Z',7,'SCHEDULED',null,stamp,null);
    addInspection.run('ins-n-ready-found','p-n-cert-ready','FOUNDATION','2026-08-21T09:00:00Z',7,'PASSED','Foundation accepted',stamp,stamp);
    addInspection.run('ins-n-ready-final','p-n-cert-ready','FINAL','2026-08-22T09:00:00Z',7,'PASSED','Final accepted',stamp,stamp);
    db.prepare('INSERT OR IGNORE INTO certificates (id,permit_id,issued_by,issued_at) VALUES (?,?,?,?)').run('cert-n-seed','p-n-cert',9,stamp);
    const seedAudit = db.prepare(`INSERT INTO audit (actor_id,action,entity,entity_id,revision,details,created_at)
      SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (
        SELECT 1 FROM audit WHERE action=? AND entity=? AND entity_id=? AND revision=?
      )`);
    const addSeedAudit = (actorId, action, entity, entityId, revision, details = {}) =>
      seedAudit.run(actorId,action,entity,entityId,revision,JSON.stringify(details),stamp,
        action,entity,entityId,revision);
    addSeedAudit(1,'PERMIT_CREATED','permit','p-n-draft',1,{reference:'PER-N-DRAFT'});
    addSeedAudit(9,'REVIEWER_ASSIGNED','permit','p-n-approve',2,{reviewerId:3});
    addSeedAudit(3,'PLANS_APPROVED','permit','p-n-zone',3,{});
    addSeedAudit(11,'ASSESSMENT_SETTLED','assessment','asmt-n-cert',5,{permitId:'p-n-cert',amountCents:58000});
    addSeedAudit(7,'INSPECTION_PASSED','inspection','ins-n-cert-final',5,{permitId:'p-n-cert',type:'FINAL'});
    addSeedAudit(9,'CERTIFICATE_ISSUED','certificate','cert-n-seed',5,{permitId:'p-n-cert'});
  }
}
init();

function audit(actor, action, entity, entityId, revision = null, details = {}) {
  db.prepare('INSERT INTO audit (actor_id,action,entity,entity_id,revision,details,created_at) VALUES (?,?,?,?,?,?,?)').run(actor?.id ?? null,action,entity,String(entityId),revision,JSON.stringify(details),now());
}
function auth(req,res,next) {
  const token=(req.get('authorization') || '').replace(/^Bearer\s+/i,'');
  if(!token) return fail(res,401,'Authentication required');
  const tokenHash=crypto.createHash('sha256').update(token).digest('hex');
  const user=db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL').get(tokenHash);
  if(!user || user.status !== 'ACTIVE') return fail(res,401,'Session is revoked or account is inactive');
  req.user=user; req.tokenHash=tokenHash; next();
}
const requireRole = (...roles) => (req,res,next) => roles.includes(req.user.role) ? next() : fail(res,403,'Your role is not permitted to perform this action');
function getPermit(permitId) {
  return db.prepare(`SELECT p.*,x.number parcel_number,x.zone,x.address,x.allowed_type,r.name reviewer_name,i.name inspector_name FROM permits p JOIN parcels x ON x.id=p.parcel_id LEFT JOIN users r ON r.id=p.assigned_reviewer_id LEFT JOIN users i ON i.id=p.assigned_inspector_id WHERE p.id=? OR p.reference=?`).get(permitId,permitId);
}
function canRead(user, permit) {
  if(!permit) return false;
  if(['ADMIN','FINANCE'].includes(user.role)) return true;
  if(user.district !== permit.district) return false;
  if(user.role==='CLERK') return permit.created_by===user.id;
  if(user.role==='REVIEWER') return permit.assigned_reviewer_id===user.id;
  if(user.role==='INSPECTOR') return permit.assigned_inspector_id===user.id;
  return ['ZONING','SUPERVISOR'].includes(user.role);
}
function requirePermit(req,res,next) {
  const permit=getPermit(req.params.permitId || req.params.id);
  if(!permit || !canRead(req.user,permit)) return fail(res,404,'Permit not found');
  req.permit=permit; next();
}
function expected(res, permit, value) {
  if(Number(value)!==permit.revision) { fail(res,409,`Stale revision. Current revision is ${permit.revision}`); return false; }
  return true;
}
function feeFor(type, valuation) {
  if(!['RESIDENTIAL_ADDITION','COMMERCIAL_SIGN'].includes(type) || !Number.isInteger(valuation) || valuation<=0) return null;
  return type==='COMMERCIAL_SIGN' ? { permitFee:50000+Math.ceil(valuation/100000)*6000, levy:10000 } : { permitFee:25000+Math.ceil(valuation/100000)*4000, levy:5000 };
}
function waiverApproved(p) { return Boolean(p.waiver_cents !== null && p.waiver_supervisor_by && (p.waiver_cents<=50000 || p.waiver_finance_by)); }
function assessment(permitId) { return db.prepare('SELECT * FROM assessments WHERE permit_id=?').get(permitId); }
function isPaid(permitId) { const a=assessment(permitId); return Boolean(a && db.prepare('SELECT 1 FROM receipts WHERE assessment_id=?').get(a.id)); }
function permitView(user,p) {
  const noteVisible=user.role==='ADMIN' || (user.role==='SUPERVISOR' && user.district===p.district) || (user.role==='REVIEWER' && p.assigned_reviewer_id===user.id);
  const a=assessment(p.id); const receipt=a ? db.prepare('SELECT id,amount_cents,receipt_key,created_at FROM receipts WHERE assessment_id=?').get(a.id) : null;
  const inspections=db.prepare('SELECT id,type,slot,inspector_id,status,result_note,completed_at FROM inspections WHERE permit_id=? ORDER BY created_at').all(p.id);
  const certificate=db.prepare('SELECT * FROM certificates WHERE permit_id=?').get(p.id);
  return { id:p.id,reference:p.reference,district:p.district,status:p.status,revision:p.revision,permitType:p.permit_type,applicant:p.applicant,valuationCents:p.valuation_cents,permitFeeCents:p.permit_fee_cents,levyCents:p.levy_cents,parcel:{id:p.parcel_id,number:p.parcel_number,zone:p.zone,address:p.address,allowedType:p.allowed_type},assignedReviewerId:p.assigned_reviewer_id,assignedReviewer:p.reviewer_name,assignedInspectorId:p.assigned_inspector_id,assignedInspector:p.inspector_name,planNote:noteVisible?p.plan_note:null,planNoteRedacted:Boolean(p.plan_note && !noteVisible),zoningApproved:Boolean(p.zoning_approved),waiverCents:p.waiver_cents,waiverApproved:waiverApproved(p),assessment:a?{id:a.id,permitFeeCents:a.permit_fee_cents,levyCents:a.levy_cents,dueCents:a.due_cents}:null,receipt:receipt?{id:receipt.id,amountCents:receipt.amount_cents,receiptKey:receipt.receipt_key}:null,inspections,certificate:certificate?{id:certificate.id,issuedAt:certificate.issued_at}:null,foundationPassed:Boolean(p.foundation_passed),finalPassed:Boolean(p.final_passed),createdAt:p.created_at,updatedAt:p.updated_at };
}
function recalcAssessment(p) {
  const a=assessment(p.id); if(!a) return null;
  const reduction=waiverApproved(p) ? p.waiver_cents : 0;
  const due=p.permit_fee_cents-reduction+p.levy_cents;
  db.prepare('UPDATE assessments SET due_cents=? WHERE id=?').run(due,a.id);
  return due;
}

app.post('/api/auth/login',(req,res) => {
  const user=db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email || '').toLowerCase());
  if(!user || user.status!=='ACTIVE' || !matches(String(req.body.password || ''),user.password_hash)) return fail(res,401,'Invalid credentials');
  const token=crypto.randomBytes(30).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash,user_id,created_at) VALUES (?,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'),user.id,now());
  audit(user,'LOGIN','session',user.id); res.json({token,user:{id:user.id,email:user.email,name:user.name,role:user.role,district:user.district}});
});
app.post('/api/auth/logout',auth,(req,res) => { db.prepare('UPDATE sessions SET revoked_at=? WHERE token_hash=?').run(now(),req.tokenHash); audit(req.user,'LOGOUT','session',req.user.id); res.json({ok:true}); });
app.get('/api/health',(_req,res) => res.json({ok:true,service:'Oriel Permitworks',database:'sqlite'}));
app.get('/api/me',auth,(req,res) => res.json({user:{id:req.user.id,email:req.user.email,name:req.user.name,role:req.user.role,district:req.user.district,status:req.user.status}}));
app.get('/api/parcels',auth,(req,res) => { const rows=allDistrict(req.user)?db.prepare('SELECT * FROM parcels ORDER BY number').all():db.prepare('SELECT * FROM parcels WHERE district=? ORDER BY number').all(req.user.district); res.json({parcels:rows.map((x)=>({id:x.id,number:x.number,district:x.district,zone:x.zone,address:x.address,allowedType:x.allowed_type}))}); });
app.get('/api/permits',auth,(req,res) => { const rows=db.prepare(`SELECT p.*,x.number parcel_number,x.zone,x.address,x.allowed_type,r.name reviewer_name,i.name inspector_name FROM permits p JOIN parcels x ON x.id=p.parcel_id LEFT JOIN users r ON r.id=p.assigned_reviewer_id LEFT JOIN users i ON i.id=p.assigned_inspector_id ORDER BY p.updated_at DESC`).all(); res.json({permits:rows.filter((p)=>canRead(req.user,p)).map((p)=>permitView(req.user,p))}); });
app.get('/api/permits/:id',auth,requirePermit,(req,res) => res.json({permit:permitView(req.user,req.permit)}));
app.post('/api/permits',auth,requireRole('CLERK'),(req,res) => {
  const parcel=db.prepare('SELECT * FROM parcels WHERE id=? OR number=?').get(req.body.parcelId,req.body.parcelId); const valuation=money(req.body.valuationCents); const type=String(req.body.permitType || '').toUpperCase(); const reference=String(req.body.reference || '').trim(); const composed=feeFor(type,valuation);
  if(!parcel || parcel.district!==req.user.district) return fail(res,403,'Parcel is not available in your district');
  if(!composed || parcel.allowed_type!==type) return fail(res,409,'Stored parcel zoning does not allow this permit type');
  if(!reference) return fail(res,400,'reference is required');
  if(db.prepare('SELECT 1 FROM permits WHERE reference=?').get(reference)) return fail(res,409,'Public reference already exists');
  const permitId=id('permit-'); const stamp=now();
  db.prepare('INSERT INTO permits (id,reference,district,parcel_id,permit_type,applicant,valuation_cents,permit_fee_cents,levy_cents,status,created_by,revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(permitId,reference,parcel.district,parcel.id,type,String(req.body.applicant || 'Oriel Applicant'),valuation,composed.permitFee,composed.levy,'DRAFT',req.user.id,1,stamp,stamp);
  const p=getPermit(permitId); audit(req.user,'PERMIT_CREATED','permit',permitId,1,{reference,parcel:parcel.number}); res.status(201).json({permit:permitView(req.user,p)});
});
app.post('/api/permits/:permitId/submit',auth,requirePermit,(req,res) => { const p=req.permit; if(req.user.role!=='CLERK' || p.created_by!==req.user.id || p.status!=='DRAFT') return fail(res,403,'Only the creating clerk may submit a draft'); if(!expected(res,p,req.body.expectedRevision)) return; db.prepare('UPDATE permits SET status=?,revision=revision+1,updated_at=? WHERE id=?').run('SUBMITTED',now(),p.id); const u=getPermit(p.id); audit(req.user,'PERMIT_SUBMITTED','permit',p.id,u.revision); res.json({permit:permitView(req.user,u)}); });
app.post('/api/permits/:permitId/assign-reviewer',auth,requireRole('SUPERVISOR'),requirePermit,(req,res) => { const p=req.permit; const reviewer=db.prepare('SELECT * FROM users WHERE id=?').get(req.body.reviewerId); if(req.user.district!==p.district || !reviewer || reviewer.role!=='REVIEWER' || reviewer.district!==p.district) return fail(res,403,'Reviewer assignment must remain in district'); if(p.status!=='SUBMITTED') return fail(res,409,'Only submitted permits may be assigned'); if(!expected(res,p,req.body.expectedRevision)) return; db.prepare('UPDATE permits SET assigned_reviewer_id=?,status=?,revision=revision+1,updated_at=? WHERE id=?').run(reviewer.id,'PLANS_REVIEW',now(),p.id); const u=getPermit(p.id); audit(req.user,'REVIEWER_ASSIGNED','permit',p.id,u.revision,{reviewerId:reviewer.id}); res.json({permit:permitView(req.user,u)}); });
app.post('/api/permits/:permitId/plans-review',auth,requireRole('REVIEWER'),requirePermit,(req,res) => { const p=req.permit; const decision=String(req.body.decision || '').toUpperCase(); if(p.assigned_reviewer_id!==req.user.id || p.status!=='PLANS_REVIEW') return fail(res,403,'Only the assigned reviewer may decide this permit'); if(!expected(res,p,req.body.expectedRevision)) return; if(!['APPROVE','CORRECTIONS'].includes(decision)) return fail(res,400,'decision must be APPROVE or CORRECTIONS'); const status=decision==='APPROVE'?'PLANS_APPROVED':'CORRECTIONS_REQUIRED'; db.prepare('UPDATE permits SET status=?,plan_note=?,revision=revision+1,updated_at=? WHERE id=?').run(status,String(req.body.note || ''),now(),p.id); const u=getPermit(p.id); audit(req.user,decision==='APPROVE'?'PLANS_APPROVED':'CORRECTIONS_REQUIRED','permit',p.id,u.revision); res.json({permit:permitView(req.user,u)}); });
app.post('/api/permits/:permitId/correct',auth,requireRole('CLERK'),requirePermit,(req,res) => { const p=req.permit; const valuation=money(req.body.valuationCents); const composed=feeFor(p.permit_type,valuation); if(p.created_by!==req.user.id || p.status!=='CORRECTIONS_REQUIRED' || !composed) return fail(res,403,'Only the creating clerk may correct this permit'); if(!expected(res,p,req.body.expectedRevision)) return; if(isPaid(p.id)) return fail(res,409,'A settled permit requires an administrative amendment'); db.transaction(()=>{ db.prepare('DELETE FROM assessments WHERE permit_id=?').run(p.id); db.prepare('DELETE FROM inspections WHERE permit_id=?').run(p.id); db.prepare('UPDATE permits SET valuation_cents=?,permit_fee_cents=?,levy_cents=?,status=?,zoning_approved=0,waiver_cents=NULL,waiver_requested_by=NULL,waiver_supervisor_by=NULL,waiver_finance_by=NULL,foundation_passed=0,final_passed=0,revision=revision+1,updated_at=? WHERE id=?').run(valuation,composed.permitFee,composed.levy,'PLANS_REVIEW',now(),p.id); })(); const u=getPermit(p.id); audit(req.user,'PERMIT_CORRECTED','permit',p.id,u.revision); res.json({permit:permitView(req.user,u)}); });
app.post('/api/permits/:permitId/zoning-approve',auth,requireRole('ZONING'),requirePermit,(req,res) => { const p=req.permit; if(req.user.district!==p.district || p.status!=='PLANS_APPROVED' || p.permit_type!==p.allowed_type) return fail(res,409,'Permit is not eligible for zoning approval'); if(!expected(res,p,req.body.expectedRevision)) return; const assessmentId=id('asmt-'); db.transaction(()=>{ db.prepare('UPDATE permits SET zoning_approved=1,status=?,revision=revision+1,updated_at=? WHERE id=?').run('FEE_DUE',now(),p.id); db.prepare('INSERT INTO assessments (id,permit_id,permit_fee_cents,levy_cents,due_cents,created_at) VALUES (?,?,?,?,?,?)').run(assessmentId,p.id,p.permit_fee_cents,p.levy_cents,p.permit_fee_cents+p.levy_cents,now()); })(); const u=getPermit(p.id); audit(req.user,'ZONING_APPROVED','permit',p.id,u.revision,{assessmentId}); res.json({permit:permitView(req.user,u)}); });
app.post('/api/permits/:permitId/waiver',auth,requireRole('CLERK'),requirePermit,(req,res) => { const p=req.permit; const amount=money(req.body.amountCents); if(p.created_by!==req.user.id || p.status!=='FEE_DUE' || amount===null || amount<0 || amount>p.permit_fee_cents) return fail(res,409,'Waiver must be within the stored permit fee'); if(isPaid(p.id)) return fail(res,409,'A settled assessment cannot be waived'); if(!expected(res,p,req.body.expectedRevision)) return; db.prepare('UPDATE permits SET waiver_cents=?,waiver_requested_by=?,waiver_supervisor_by=NULL,waiver_finance_by=NULL,revision=revision+1,updated_at=? WHERE id=?').run(amount,req.user.id,now(),p.id); const u=getPermit(p.id); audit(req.user,'WAIVER_REQUESTED','permit',p.id,u.revision,{amountCents:amount}); res.json({permit:permitView(req.user,u)}); });
app.post('/api/permits/:permitId/waiver-approve',auth,requirePermit,(req,res) => { const p=req.permit; if(p.status!=='FEE_DUE' || p.waiver_cents===null) return fail(res,409,'No waiver request exists'); if(p.waiver_requested_by===req.user.id) return fail(res,403,'A requester cannot approve their own waiver'); if(!expected(res,p,req.body.expectedRevision)) return; if(req.user.role==='SUPERVISOR' && req.user.district===p.district) db.prepare('UPDATE permits SET waiver_supervisor_by=?,revision=revision+1,updated_at=? WHERE id=?').run(req.user.id,now(),p.id); else if(req.user.role==='FINANCE') db.prepare('UPDATE permits SET waiver_finance_by=?,revision=revision+1,updated_at=? WHERE id=?').run(req.user.id,now(),p.id); else return fail(res,403,'Only district supervisor or Finance may approve a waiver'); const u=getPermit(p.id); const due=recalcAssessment(u); audit(req.user,'WAIVER_APPROVED','permit',p.id,u.revision,{amountCents:u.waiver_cents,dueCents:due}); res.json({permit:permitView(req.user,u)}); });
app.get('/api/permits/:permitId/assessment',auth,requirePermit,(req,res)=> { const a=assessment(req.permit.id); if(!a) return fail(res,404,'Assessment not found'); res.json({assessment:{id:a.id,permitId:a.permit_id,permitFeeCents:a.permit_fee_cents,levyCents:a.levy_cents,dueCents:a.due_cents,settled:isPaid(req.permit.id)}}); });
app.post('/api/assessments/:assessmentId/receipts',auth,requireRole('FINANCE'),(req,res)=> { const a=db.prepare('SELECT * FROM assessments WHERE id=?').get(req.params.assessmentId); if(!a) return fail(res,404,'Assessment not found'); const p=getPermit(a.permit_id); const amount=money(req.body.amountCents); const key=String(req.body.receiptKey || '').trim(); if(!key) return fail(res,400,'receiptKey is required'); const existing=db.prepare('SELECT * FROM receipts WHERE assessment_id=? AND receipt_key=?').get(a.id,key); if(existing) return res.json({receipt:{id:existing.id,amountCents:existing.amount_cents,receiptKey:existing.receipt_key},replayed:true}); if(isPaid(p.id)) return fail(res,409,'Assessment is already settled'); if(!waiverApproved(p) && p.waiver_cents!==null) return fail(res,409,'Pending waiver must be resolved before settlement'); if(p.status!=='FEE_DUE' || amount!==a.due_cents) return fail(res,409,'Receipt must settle the exact stored assessment amount'); const receipt={id:id('receipt-'),amount,key}; db.prepare('INSERT INTO receipts (id,assessment_id,amount_cents,receipt_key,recorded_by,created_at) VALUES (?,?,?,?,?,?)').run(receipt.id,a.id,amount,key,req.user.id,now()); audit(req.user,'ASSESSMENT_SETTLED','assessment',a.id,p.revision,{permitId:p.id,amountCents:amount}); res.status(201).json({receipt:{id:receipt.id,amountCents:amount,receiptKey:key},replayed:false}); });
app.post('/api/permits/:permitId/assign-inspector',auth,requireRole('SUPERVISOR'),requirePermit,(req,res)=> { const p=req.permit; const inspector=db.prepare('SELECT * FROM users WHERE id=?').get(req.body.inspectorId); if(req.user.district!==p.district || !inspector || inspector.role!=='INSPECTOR' || inspector.district!==p.district) return fail(res,403,'Inspector assignment must remain in district'); if(!p.zoning_approved || !isPaid(p.id) || ['CORRECTIONS_REQUIRED','CERTIFIED','DENIED'].includes(p.status)) return fail(res,409,'A paid zoning-approved permit is required'); if(!expected(res,p,req.body.expectedRevision)) return; db.prepare('UPDATE permits SET assigned_inspector_id=?,status=?,revision=revision+1,updated_at=? WHERE id=?').run(inspector.id,'READY_FOR_INSPECTION',now(),p.id); const u=getPermit(p.id); audit(req.user,'INSPECTOR_ASSIGNED','permit',p.id,u.revision,{inspectorId:inspector.id}); res.json({permit:permitView(req.user,u)}); });
app.post('/api/permits/:permitId/inspections',auth,requireRole('INSPECTOR'),requirePermit,(req,res)=> { const p=req.permit; const type=String(req.body.type || '').toUpperCase(); const parsedSlot=new Date(String(req.body.slot || '')); const slot=Number.isNaN(parsedSlot.getTime())?'':parsedSlot.toISOString(); if(p.assigned_inspector_id!==req.user.id || p.status!=='READY_FOR_INSPECTION') return fail(res,403,'Only the assigned inspector may schedule'); if(!expected(res,p,req.body.expectedRevision)) return; if(!slot || !['FOUNDATION','FINAL'].includes(type)) return fail(res,400,'type and slot are required'); if((type==='FOUNDATION' && p.foundation_passed) || (type==='FINAL' && (!p.foundation_passed || p.final_passed))) return fail(res,409,'Inspection sequence is not eligible'); if(db.prepare("SELECT 1 FROM inspections WHERE inspector_id=? AND datetime(slot)=datetime(?) AND status='SCHEDULED'").get(req.user.id,slot)) return fail(res,409,'Inspector already has an active inspection at this slot'); const prior=db.prepare("SELECT 1 FROM inspections WHERE permit_id=? AND type=? AND status='SCHEDULED'").get(p.id,type); if(prior) return fail(res,409,'This inspection type is already scheduled'); const inspection={id:id('insp-'),type,slot}; db.prepare('INSERT INTO inspections (id,permit_id,type,slot,inspector_id,status,created_at) VALUES (?,?,?,?,?,?,?)').run(inspection.id,p.id,type,slot,req.user.id,'SCHEDULED',now()); const u=getPermit(p.id); audit(req.user,'INSPECTION_SCHEDULED','inspection',inspection.id,u.revision,{permitId:p.id,type,slot}); res.status(201).json({inspection,replayed:false}); });
app.post('/api/inspections/:inspectionId/result',auth,requireRole('INSPECTOR'),(req,res)=> { const inspection=db.prepare('SELECT * FROM inspections WHERE id=?').get(req.params.inspectionId); if(!inspection) return fail(res,404,'Inspection not found'); const p=getPermit(inspection.permit_id); const result=String(req.body.result || '').toUpperCase(); if(!canRead(req.user,p) || inspection.inspector_id!==req.user.id || inspection.status!=='SCHEDULED') return fail(res,403,'Only the assigned inspector may record this result'); if(!expected(res,p,req.body.expectedRevision)) return; if(!['PASSED','FAILED'].includes(result)) return fail(res,400,'result must be PASSED or FAILED'); const stamp=now(); db.transaction(()=>{ db.prepare('UPDATE inspections SET status=?,result_note=?,completed_at=? WHERE id=?').run(result,String(req.body.note || ''),stamp,inspection.id); if(result==='PASSED') { const field=inspection.type==='FOUNDATION'?'foundation_passed':'final_passed'; db.prepare(`UPDATE permits SET ${field}=1,revision=revision+1,updated_at=? WHERE id=?`).run(stamp,p.id); } else { db.prepare('UPDATE permits SET status=?,zoning_approved=0,foundation_passed=0,final_passed=0,revision=revision+1,updated_at=? WHERE id=?').run('CORRECTIONS_REQUIRED',stamp,p.id); } })(); const u=getPermit(p.id); audit(req.user,result==='PASSED'?'INSPECTION_PASSED':'INSPECTION_FAILED','inspection',inspection.id,u.revision,{permitId:p.id,type:inspection.type}); res.json({permit:permitView(req.user,u)}); });
app.post('/api/permits/:permitId/certificate',auth,requireRole('SUPERVISOR'),requirePermit,(req,res)=> { const p=req.permit; if(req.user.district!==p.district) return fail(res,403,'Certificate must remain in district'); const existing=db.prepare('SELECT * FROM certificates WHERE permit_id=?').get(p.id); if(existing) return res.json({certificate:{id:existing.id,issuedAt:existing.issued_at},replayed:true}); if(!expected(res,p,req.body.expectedRevision)) return; if(!p.zoning_approved || !isPaid(p.id) || !p.foundation_passed || !p.final_passed) return fail(res,409,'Paid zoning approval and both passed inspections are required'); const certificate={id:id('cert-'),stamp:now()}; db.transaction(()=>{ db.prepare('INSERT INTO certificates (id,permit_id,issued_by,issued_at) VALUES (?,?,?,?)').run(certificate.id,p.id,req.user.id,certificate.stamp); db.prepare('UPDATE permits SET status=?,revision=revision+1,updated_at=? WHERE id=?').run('CERTIFIED',certificate.stamp,p.id); })(); const u=getPermit(p.id); audit(req.user,'CERTIFICATE_ISSUED','certificate',certificate.id,u.revision,{permitId:p.id}); res.status(201).json({certificate:{id:certificate.id,issuedAt:certificate.stamp},replayed:false}); });
app.get('/api/audit',auth,requireRole('ADMIN'),(req,res)=>res.json({audit:db.prepare('SELECT a.*,u.email actor_email FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC').all()}));
app.post('/api/admin/users/:userId/suspend',auth,requireRole('ADMIN'),(req,res)=> { const user=db.prepare('SELECT * FROM users WHERE id=?').get(req.params.userId); if(!user) return fail(res,404,'User not found'); db.prepare('UPDATE users SET status=? WHERE id=?').run('SUSPENDED',user.id); audit(req.user,'ACCOUNT_SUSPENDED','user',user.id,null,{email:user.email}); res.json({ok:true}); });
app.get(/.*/,(_req,res)=>res.sendFile(path.join(__dirname,'client','index.html')));
app.listen(PORT,'0.0.0.0',()=>console.log(`Oriel Permitworks listening on ${PORT}`));

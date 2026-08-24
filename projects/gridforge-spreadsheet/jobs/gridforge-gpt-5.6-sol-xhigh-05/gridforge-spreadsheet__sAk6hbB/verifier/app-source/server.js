'use strict';
const express = require('express');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.GRIDFORGE_DB || '/app/gridforge.sqlite';
const SEED_PATH = '/assets/workbook_seed.json';
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workbooks (id TEXT PRIMARY KEY, title TEXT NOT NULL, current_revision INTEGER NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS revisions (workbook_id TEXT NOT NULL, revision INTEGER NOT NULL, snapshot TEXT NOT NULL, created_at TEXT NOT NULL, user_id TEXT, PRIMARY KEY(workbook_id, revision), FOREIGN KEY(workbook_id) REFERENCES workbooks(id));
CREATE TABLE IF NOT EXISTS cell_history (id INTEGER PRIMARY KEY AUTOINCREMENT, workbook_id TEXT NOT NULL, sheet_id TEXT NOT NULL, address TEXT NOT NULL, old_value TEXT NOT NULL, new_value TEXT NOT NULL, user_id TEXT NOT NULL, revision INTEGER NOT NULL, changed_at TEXT NOT NULL);
`);

function canonicalWorkbook(w) {
  return {id:w.id, title:w.title, sheets:w.sheets.map(s => ({id:s.id, name:s.name, cells:{...s.cells}}))};
}
function seed() {
  const data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const now = new Date().toISOString();
  db.transaction(() => {
    const putUser = db.prepare('INSERT OR IGNORE INTO users(id,name) VALUES(?,?)');
    for (const u of data.users) putUser.run(u.id, u.name);
    if (!db.prepare('SELECT 1 FROM workbooks WHERE id=?').get(data.workbook.id)) {
      const workbook = canonicalWorkbook(data.workbook);
      db.prepare('INSERT INTO workbooks(id,title,current_revision,updated_at) VALUES(?,?,1,?)').run(workbook.id, workbook.title, now);
      db.prepare('INSERT INTO revisions(workbook_id,revision,snapshot,created_at,user_id) VALUES(?,1,?,?,NULL)').run(workbook.id, JSON.stringify(workbook), now);
    }
  })();
}
seed();

const app = express();
app.disable('x-powered-by');
app.use(express.json({limit:'2mb'}));
const clients = new Map();
const presence = new Map();
function sendEvent(type, payload) {
  const text = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients.values()) res.write(text);
}
function cleanPresence() {
  const cutoff = Date.now() - 45000;
  let changed = false;
  for (const [id,p] of presence) if (p.seen < cutoff) { presence.delete(id); changed = true; }
  if (changed) sendEvent('presence', [...presence.values()].map(publicPresence));
}
function publicPresence(p) { const {seen,...safe}=p; return safe; }
setInterval(cleanPresence, 15000).unref();

function getWorkbookRow(id) { return db.prepare('SELECT * FROM workbooks WHERE id=?').get(id); }
function getSnapshot(id, revision) {
  const row = db.prepare('SELECT snapshot FROM revisions WHERE workbook_id=? AND revision=?').get(id, revision);
  return row && JSON.parse(row.snapshot);
}
function invalidSnapshot(body, stored) {
  if (!body || typeof body !== 'object' || !Number.isInteger(body.baseRevision) || body.baseRevision < 1) return 'A valid integer baseRevision is required.';
  const w = body.workbook;
  if (!w || typeof w !== 'object' || w.id !== stored.id || w.title !== stored.title || !Array.isArray(w.sheets)) return 'Workbook identity or structure is invalid.';
  const current = getSnapshot(stored.id, stored.current_revision);
  if (w.sheets.length !== current.sheets.length) return 'Sheet structure cannot be changed by a cell save.';
  for (let i=0;i<w.sheets.length;i++) {
    const s=w.sheets[i], c=current.sheets[i];
    if (!s || s.id!==c.id || s.name!==c.name || !s.cells || typeof s.cells!=='object' || Array.isArray(s.cells)) return 'Sheet identity or cells are invalid.';
    for (const [a,v] of Object.entries(s.cells)) {
      if (!/^[A-Z]{1,3}[1-9]\d{0,4}$/.test(a) || typeof v!=='string' || v.length>10000) return `Invalid cell data at ${a}.`;
    }
  }
  if (JSON.stringify(w).length > 1500000) return 'Workbook is too large.';
  return null;
}
function cellMap(w) {
  const out = new Map();
  for (const s of w.sheets) for (const [a,v] of Object.entries(s.cells)) out.set(`${s.id}!${a}`, v);
  return out;
}
function diff(a,b) {
  const am=cellMap(a), bm=cellMap(b), out=new Map();
  for (const k of new Set([...am.keys(),...bm.keys()])) {
    const av=am.get(k)||'', bv=bm.get(k)||'';
    if (av!==bv) out.set(k,{old:av,value:bv});
  }
  return out;
}
function applyChanges(workbook, changes) {
  const result=canonicalWorkbook(workbook);
  const sheets=new Map(result.sheets.map(s=>[s.id,s]));
  for (const [key,c] of changes) {
    const [sid,address]=key.split('!');
    if (c.value==='') delete sheets.get(sid).cells[address]; else sheets.get(sid).cells[address]=c.value;
  }
  return result;
}
function requireUser(id) { return typeof id==='string' && db.prepare('SELECT * FROM users WHERE id=?').get(id); }

app.get('/api/bootstrap', (req,res) => {
  const wb = db.prepare('SELECT * FROM workbooks ORDER BY rowid LIMIT 1').get();
  const workbook=getSnapshot(wb.id, wb.current_revision);
  res.json({users:db.prepare('SELECT * FROM users ORDER BY rowid').all(), workbook, revision:wb.current_revision, updatedAt:wb.updated_at});
});
app.get('/api/workbooks/:id', (req,res) => {
  const wb=getWorkbookRow(req.params.id); if(!wb) return res.status(404).json({error:'Unknown workbook.'});
  res.json({workbook:getSnapshot(wb.id,wb.current_revision),revision:wb.current_revision,updatedAt:wb.updated_at});
});
app.get('/api/workbooks/:id/revisions', (req,res) => {
  if(!getWorkbookRow(req.params.id)) return res.status(404).json({error:'Unknown workbook.'});
  res.json(db.prepare(`SELECT r.revision,r.created_at AS createdAt,r.user_id AS userId,u.name AS userName FROM revisions r LEFT JOIN users u ON u.id=r.user_id WHERE workbook_id=? ORDER BY revision DESC`).all(req.params.id));
});
app.get('/api/workbooks/:id/revisions/:revision', (req,res) => {
  const n=Number(req.params.revision); if(!Number.isInteger(n)) return res.status(400).json({error:'Invalid revision.'});
  const row=db.prepare('SELECT snapshot,created_at AS createdAt FROM revisions WHERE workbook_id=? AND revision=?').get(req.params.id,n);
  if(!row) return res.status(404).json({error:'Revision not found.'});
  res.json({workbook:JSON.parse(row.snapshot),revision:n,createdAt:row.createdAt});
});
app.get('/api/workbooks/:id/cells/:sheet/:address/history', (req,res) => {
  if(!getWorkbookRow(req.params.id)) return res.status(404).json({error:'Unknown workbook.'});
  res.json(db.prepare(`SELECT h.old_value AS oldValue,h.new_value AS newValue,h.revision,h.changed_at AS changedAt,u.name AS userName FROM cell_history h JOIN users u ON u.id=h.user_id WHERE workbook_id=? AND sheet_id=? AND address=? ORDER BY h.id DESC`).all(req.params.id,req.params.sheet,req.params.address.toUpperCase()));
});
app.post('/api/workbooks/:id/save', (req,res) => {
  const stored=getWorkbookRow(req.params.id);
  if(!stored || req.body?.workbook?.id!==req.params.id) return res.status(404).json({error:'Unknown or mismatched workbook id.'});
  const err=invalidSnapshot(req.body,stored); if(err) return res.status(400).json({error:err});
  if(!requireUser(req.body.userId)) return res.status(400).json({error:'A valid signed-in user is required.'});
  const base=getSnapshot(stored.id,req.body.baseRevision);
  if(!base) return res.status(409).json({error:'Base revision does not exist.'});
  const incoming=canonicalWorkbook(req.body.workbook), requested=diff(base,incoming);
  const current=getSnapshot(stored.id,stored.current_revision), concurrent=diff(base,current);
  const conflicts=[...requested.keys()].filter(k=>concurrent.has(k) && requested.get(k).value!==concurrent.get(k).value);
  if(conflicts.length) return res.status(409).json({error:'Save conflict: the same cells changed in a newer revision.',conflicts:conflicts.map(k=>k.split('!')[1]),revision:stored.current_revision,workbook:current});
  const merged=applyChanges(current,requested), actual=diff(current,merged);
  if(!actual.size) return res.json({unchanged:true,revision:stored.current_revision,workbook:current});
  const now=new Date().toISOString(), next=stored.current_revision+1;
  db.transaction(() => {
    const fresh=getWorkbookRow(stored.id);
    if(fresh.current_revision!==stored.current_revision) throw new Error('RETRY_CONFLICT');
    db.prepare('INSERT INTO revisions(workbook_id,revision,snapshot,created_at,user_id) VALUES(?,?,?,?,?)').run(stored.id,next,JSON.stringify(merged),now,req.body.userId);
    db.prepare('UPDATE workbooks SET current_revision=?,updated_at=? WHERE id=?').run(next,now,stored.id);
    const hist=db.prepare('INSERT INTO cell_history(workbook_id,sheet_id,address,old_value,new_value,user_id,revision,changed_at) VALUES(?,?,?,?,?,?,?,?)');
    for(const [key,c] of actual) {const [sid,a]=key.split('!'); hist.run(stored.id,sid,a,c.old,c.value,req.body.userId,next,now);}
  })();
  const payload={workbook:merged,revision:next,updatedAt:now,changed:[...actual.keys()].map(k=>k.split('!')[1]),userId:req.body.userId};
  sendEvent('saved',payload); res.json(payload);
});

app.get('/api/events', (req,res) => {
  const id=crypto.randomUUID();
  res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'}); res.flushHeaders();
  clients.set(id,res); res.write(`event: presence\ndata: ${JSON.stringify([...presence.values()].map(publicPresence))}\n\n`);
  req.on('close',()=>clients.delete(id));
});
app.post('/api/presence', (req,res) => {
  const {sessionId,userId,workbookId,address}=req.body||{};
  if(typeof sessionId!=='string'||sessionId.length>100||!requireUser(userId)||!getWorkbookRow(workbookId)||typeof address!=='string'||address.length>30) return res.status(400).json({error:'Invalid presence update.'});
  const user=requireUser(userId); presence.set(sessionId,{sessionId,userId,userName:user.name,workbookId,address,seen:Date.now()});
  sendEvent('presence',[...presence.values()].map(publicPresence)); res.json({ok:true});
});
app.delete('/api/presence/:sessionId', (req,res) => { presence.delete(req.params.sessionId); sendEvent('presence',[...presence.values()].map(publicPresence)); res.json({ok:true}); });
app.use(express.static(path.join(__dirname,'public')));
app.use((err,req,res,next)=>{ console.error(err); if(!res.headersSent) res.status(err.message==='RETRY_CONFLICT'?409:500).json({error:err.message==='RETRY_CONFLICT'?'Workbook changed during save; retry.':'Server error.'}); });
if(require.main===module) app.listen(PORT,'0.0.0.0',()=>console.log(`GridForge listening on 0.0.0.0:${PORT}; database ${DB_PATH}`));
module.exports={app,db,DB_PATH};

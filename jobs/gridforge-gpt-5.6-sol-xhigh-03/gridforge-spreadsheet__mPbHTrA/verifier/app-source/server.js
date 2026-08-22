const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.GRIDFORGE_DB || '/app/gridforge.sqlite';
const SEED_PATH = '/assets/workbook_seed.json';
const db = new DatabaseSync(DB_PATH);
function transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const result=fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } }
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workbooks(id TEXT PRIMARY KEY, title TEXT NOT NULL, current_revision INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS revisions(workbook_id TEXT NOT NULL, number INTEGER NOT NULL, created_at TEXT NOT NULL, user_id TEXT, snapshot TEXT NOT NULL, PRIMARY KEY(workbook_id,number));
CREATE TABLE IF NOT EXISTS revision_changes(workbook_id TEXT NOT NULL, revision INTEGER NOT NULL, sheet_id TEXT NOT NULL, address TEXT NOT NULL, old_value TEXT, new_value TEXT, user_id TEXT NOT NULL, changed_at TEXT NOT NULL, PRIMARY KEY(workbook_id,revision,sheet_id,address));
CREATE INDEX IF NOT EXISTS idx_changes_cell ON revision_changes(workbook_id,sheet_id,address,revision DESC);`);

function seed() {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const tx = () => transaction(() => {
    const addUser = db.prepare('INSERT OR IGNORE INTO users(id,name) VALUES(?,?)');
    for (const u of seed.users) addUser.run(u.id, u.name);
    const exists = db.prepare('SELECT id FROM workbooks WHERE id=?').get(seed.workbook.id);
    if (!exists) {
      db.prepare('INSERT INTO workbooks(id,title,current_revision) VALUES(?,?,1)').run(seed.workbook.id, seed.workbook.title);
      db.prepare('INSERT INTO revisions(workbook_id,number,created_at,user_id,snapshot) VALUES(?,1,?,?,?)')
        .run(seed.workbook.id, new Date().toISOString(), seed.users[0].id, JSON.stringify(seed.workbook));
    }
  }); tx();
}
seed();

const app = express();
app.use(express.json({limit:'2mb'}));
app.use(express.static(path.join(__dirname, 'public')));
const streams = new Map();
const presence = new Map();
function send(res, type, data) { res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); }
function broadcast(type, data, except=null) { for (const [id,res] of streams) if(id !== except) send(res,type,data); }
function presenceList() { return [...presence.values()]; }
function broadcastPresence() { broadcast('presence', presenceList()); }
function workbookRow(id) { return db.prepare('SELECT * FROM workbooks WHERE id=?').get(id); }
function snapshot(id, rev) { const r=db.prepare('SELECT snapshot FROM revisions WHERE workbook_id=? AND number=?').get(id,rev); return r && JSON.parse(r.snapshot); }
function apiError(res, status, message, extra={}) { return res.status(status).json({error:message,...extra}); }
function validAddress(a){return /^[A-Z]{1,3}[1-9]\d{0,3}$/.test(a)}
function validateWorkbook(body, stored) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Workbook is missing or malformed';
  if (body.id !== stored.id) return 'Workbook id does not match';
  if (body.title !== stored.title) return 'Cell saves cannot rename the workbook';
  if (!Array.isArray(body.sheets) || body.sheets.length !== stored.sheets.length) return 'Sheet structure is invalid';
  for(let i=0;i<stored.sheets.length;i++){
    const s=body.sheets[i], old=stored.sheets[i];
    if(!s || s.id!==old.id || s.name!==old.name) return 'Cell saves cannot change sheet identity';
    if(!s.cells || typeof s.cells!=='object' || Array.isArray(s.cells)) return 'Cell data is malformed';
    for(const [a,v] of Object.entries(s.cells)) if(!validAddress(a) || typeof v!=='string' || v.length>10000) return `Invalid cell data at ${a}`;
  }
  return null;
}
function cellMap(w){const m=new Map(); for(const s of w.sheets) for(const [a,v] of Object.entries(s.cells)) m.set(`${s.id}!${a}`,v); return m;}
function differences(a,b){const am=cellMap(a),bm=cellMap(b),out=[]; for(const k of new Set([...am.keys(),...bm.keys()])) {const av=am.get(k)||'',bv=bm.get(k)||'';if(av!==bv){const [sheet,address]=k.split('!');out.push({sheet,address,old:av,next:bv});}} return out;}
function applyChanges(w,changes){const clone=structuredClone(w); const sm=new Map(clone.sheets.map(s=>[s.id,s])); for(const c of changes){if(c.next==='') delete sm.get(c.sheet).cells[c.address]; else sm.get(c.sheet).cells[c.address]=c.next;} return clone;}

app.get('/api/users',(req,res)=>res.json(db.prepare('SELECT id,name FROM users ORDER BY rowid').all()));
app.get('/api/workbooks',(req,res)=>res.json(db.prepare('SELECT id,title,current_revision AS revision FROM workbooks').all()));
app.get('/api/workbooks/:id',(req,res)=>{const w=workbookRow(req.params.id); if(!w)return apiError(res,404,'Unknown workbook id'); res.json({workbook:snapshot(w.id,w.current_revision),revision:w.current_revision});});
app.get('/api/workbooks/:id/revisions',(req,res)=>{if(!workbookRow(req.params.id))return apiError(res,404,'Unknown workbook id'); res.json(db.prepare('SELECT number,created_at AS createdAt,user_id AS userId FROM revisions WHERE workbook_id=? ORDER BY number DESC').all(req.params.id));});
app.get('/api/workbooks/:id/revisions/:rev',(req,res)=>{const n=Number(req.params.rev);if(!Number.isInteger(n))return apiError(res,400,'Invalid revision');const s=snapshot(req.params.id,n);if(!s)return apiError(res,404,'Revision not found');res.json({workbook:s,revision:n});});
app.get('/api/workbooks/:id/history/:sheet/:address',(req,res)=>{if(!workbookRow(req.params.id))return apiError(res,404,'Unknown workbook id'); if(!validAddress(req.params.address))return apiError(res,400,'Invalid address');res.json(db.prepare(`SELECT revision,old_value AS oldValue,new_value AS newValue,user_id AS userId,changed_at AS changedAt,u.name AS userName FROM revision_changes c JOIN users u ON u.id=c.user_id WHERE workbook_id=? AND sheet_id=? AND address=? ORDER BY revision DESC`).all(req.params.id,req.params.sheet,req.params.address));});

app.post('/api/workbooks/:id/save',(req,res)=>{
  const row=workbookRow(req.params.id); if(!row)return apiError(res,404,'Unknown workbook id');
  const {baseRevision,workbook,userId,sessionId}=req.body||{};
  if(!Number.isInteger(baseRevision)||baseRevision<1||baseRevision>row.current_revision)return apiError(res,400,'Invalid base revision');
  if(!db.prepare('SELECT id FROM users WHERE id=?').get(userId))return apiError(res,400,'Invalid user');
  const base=snapshot(row.id,baseRevision), current=snapshot(row.id,row.current_revision);
  const validation=validateWorkbook(workbook,current); if(validation)return apiError(res,400,validation);
  const changes=differences(base,workbook);
  if(baseRevision<row.current_revision){
    const remote=db.prepare('SELECT DISTINCT sheet_id,address FROM revision_changes WHERE workbook_id=? AND revision>?').all(row.id,baseRevision);
    const touched=new Set(remote.map(x=>`${x.sheet_id}!${x.address}`));
    const conflicts=changes.filter(c=>touched.has(`${c.sheet}!${c.address}`));
    if(conflicts.length)return apiError(res,409,'Save conflict: these cells changed in a newer revision',{conflicts:conflicts.map(c=>c.address),revision:row.current_revision,workbook:current});
  }
  const merged=applyChanges(current,changes);
  const actual=differences(current,merged);
  if(!actual.length)return res.json({revision:row.current_revision,workbook:current,unchanged:true});
  const now=new Date().toISOString(), next=row.current_revision+1;
  transaction(()=>{
    db.prepare('INSERT INTO revisions(workbook_id,number,created_at,user_id,snapshot) VALUES(?,?,?,?,?)').run(row.id,next,now,userId,JSON.stringify(merged));
    const q=db.prepare('INSERT INTO revision_changes(workbook_id,revision,sheet_id,address,old_value,new_value,user_id,changed_at) VALUES(?,?,?,?,?,?,?,?)');
    for(const c of actual)q.run(row.id,next,c.sheet,c.address,c.old,c.next,userId,now);
    db.prepare('UPDATE workbooks SET current_revision=? WHERE id=?').run(next,row.id);
  });
  const event={workbookId:row.id,revision:next,workbook:merged,changes:actual.map(c=>({sheetId:c.sheet,address:c.address,value:c.next})),userId};
  broadcast('saved',event,sessionId); res.json({revision:next,workbook:merged});
});

app.get('/api/events',(req,res)=>{const id=String(req.query.sessionId||'');if(!id)return res.status(400).end();res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.flushHeaders();streams.set(id,res);send(res,'presence',presenceList());const timer=setInterval(()=>res.write(': ping\n\n'),20000);req.on('close',()=>{clearInterval(timer);streams.delete(id);if(presence.delete(id))broadcastPresence();});});
app.post('/api/presence',(req,res)=>{const {sessionId,userId,address}=req.body||{};const u=db.prepare('SELECT id,name FROM users WHERE id=?').get(userId);if(!sessionId||!u||typeof address!=='string'||!/^[A-Z]+\d+(?::[A-Z]+\d+)?$/.test(address))return apiError(res,400,'Invalid presence');presence.set(sessionId,{sessionId,userId,name:u.name,address});broadcastPresence();res.json({ok:true});});
app.post('/api/presence/close',(req,res)=>{if(presence.delete(req.body?.sessionId))broadcastPresence();res.json({ok:true});});
app.use('/api',(req,res)=>apiError(res,404,'API route not found'));
app.listen(PORT,'0.0.0.0',()=>console.log(`GridForge listening on 0.0.0.0:${PORT}; database ${DB_PATH}`));

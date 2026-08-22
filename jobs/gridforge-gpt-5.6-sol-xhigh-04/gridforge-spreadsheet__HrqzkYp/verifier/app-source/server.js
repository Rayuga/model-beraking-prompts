import http from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = '/app/gridforge.sqlite';
const seed = JSON.parse(readFileSync('/assets/workbook_seed.json', 'utf8'));
const db = new DatabaseSync(DB_PATH);
db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workbooks(id TEXT PRIMARY KEY, title TEXT NOT NULL, current_revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sheets(id TEXT NOT NULL, workbook_id TEXT NOT NULL REFERENCES workbooks(id), name TEXT NOT NULL, PRIMARY KEY(workbook_id,id));
CREATE TABLE IF NOT EXISTS cells(workbook_id TEXT NOT NULL, sheet_id TEXT NOT NULL, address TEXT NOT NULL, raw TEXT NOT NULL, updated_by TEXT, updated_at TEXT, PRIMARY KEY(workbook_id,sheet_id,address), FOREIGN KEY(workbook_id,sheet_id) REFERENCES sheets(workbook_id,id));
CREATE TABLE IF NOT EXISTS revisions(workbook_id TEXT NOT NULL REFERENCES workbooks(id), number INTEGER NOT NULL, created_at TEXT NOT NULL, user_id TEXT, snapshot TEXT NOT NULL, changes TEXT NOT NULL, PRIMARY KEY(workbook_id,number));
CREATE TABLE IF NOT EXISTS cell_history(id INTEGER PRIMARY KEY AUTOINCREMENT, workbook_id TEXT NOT NULL, sheet_id TEXT NOT NULL, address TEXT NOT NULL, previous_value TEXT NOT NULL, new_value TEXT NOT NULL, user_id TEXT NOT NULL, changed_at TEXT NOT NULL);`);

function snapshot(workbookId) {
  const sheets = db.prepare('SELECT id,name FROM sheets WHERE workbook_id=? ORDER BY rowid').all(workbookId).map(s => ({...s, cells: Object.fromEntries(db.prepare('SELECT address,raw FROM cells WHERE workbook_id=? AND sheet_id=?').all(workbookId,s.id).map(c=>[c.address,c.raw]))}));
  const wb = db.prepare('SELECT id,title,current_revision AS revision FROM workbooks WHERE id=?').get(workbookId);
  return wb ? {...wb, sheets} : null;
}

function seedDatabase() {
  if (db.prepare('SELECT id FROM workbooks WHERE id=?').get(seed.workbook.id)) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    const userStmt=db.prepare('INSERT OR IGNORE INTO users(id,name) VALUES(?,?)');
    seed.users.forEach(u=>userStmt.run(u.id,u.name));
    db.prepare('INSERT INTO workbooks(id,title,current_revision) VALUES(?,?,1)').run(seed.workbook.id,seed.workbook.title);
    const sh=db.prepare('INSERT INTO sheets(id,workbook_id,name) VALUES(?,?,?)');
    const cell=db.prepare('INSERT INTO cells(workbook_id,sheet_id,address,raw) VALUES(?,?,?,?)');
    seed.workbook.sheets.forEach(s=>{ sh.run(s.id,seed.workbook.id,s.name); Object.entries(s.cells).forEach(([a,v])=>cell.run(seed.workbook.id,s.id,a,String(v))); });
    const snap=snapshot(seed.workbook.id);
    db.prepare('INSERT INTO revisions(workbook_id,number,created_at,user_id,snapshot,changes) VALUES(?,?,?,?,?,?)').run(seed.workbook.id,1,new Date().toISOString(),null,JSON.stringify(snap),JSON.stringify([]));
    db.exec('COMMIT');
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
seedDatabase();

const sessions = new Map();
const streams = new Set();
function visiblePresence(workbookId) {
  const now=Date.now();
  for (const [id,s] of sessions) if(now-s.seen>60000) sessions.delete(id);
  return [...sessions.values()].filter(s=>s.workbookId===workbookId).map(({sessionId,userId,address,color})=>({sessionId,userId,address,color}));
}
function emit(workbookId,event,data) {
  const text=`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for(const client of streams) if(client.workbookId===workbookId) client.res.write(text);
}
function presenceChanged(workbookId){ emit(workbookId,'presence',visiblePresence(workbookId)); }

function json(res,status,data){ const body=JSON.stringify(data); res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body)}); res.end(body); }
function error(res,status,message,extra={}){ json(res,status,{error:message,...extra}); }
async function body(req){ let text=''; for await(const chunk of req){ text+=chunk; if(text.length>1_000_000) throw new Error('Request too large'); } try{return JSON.parse(text||'{}')}catch{throw new Error('Malformed JSON')} }
function validAddress(a){ const m=/^([A-Z]{1,3})([1-9]\d{0,3})$/.exec(a); if(!m)return false; let n=0; for(const c of m[1])n=n*26+c.charCodeAt(0)-64; return n<=200; }
function validateSave(p,workbookId){
  if(!p || typeof p!=='object' || Array.isArray(p)) return 'Payload must be an object';
  const allowed=new Set(['workbookId','sheetId','baseRevision','userId','changes']);
  if(Object.keys(p).some(k=>!allowed.has(k))) return 'Cell saves cannot change workbook or sheet metadata';
  if(p.workbookId!==workbookId) return 'Mismatched workbook id';
  if(typeof p.sheetId!=='string'||!p.sheetId) return 'Invalid sheet id';
  if(!Number.isSafeInteger(p.baseRevision)||p.baseRevision<1) return 'Invalid base revision';
  if(typeof p.userId!=='string'||!db.prepare('SELECT 1 FROM users WHERE id=?').get(p.userId)) return 'Invalid user';
  if(!Array.isArray(p.changes)||p.changes.length>10000) return 'Invalid changes';
  const seen=new Set();
  for(const c of p.changes){ if(!c||typeof c!=='object'||Object.keys(c).some(k=>!['address','value'].includes(k))||!validAddress(c.address)||typeof c.value!=='string'||c.value.length>10000||seen.has(c.address))return 'Malformed or duplicate cell change'; seen.add(c.address); }
  return null;
}
function revisions(workbookId){return db.prepare(`SELECT number,created_at AS createdAt,user_id AS userId FROM revisions WHERE workbook_id=? ORDER BY number DESC`).all(workbookId);}

async function api(req,res,url){
  const parts=url.pathname.split('/').filter(Boolean);
  if(req.method==='GET'&&url.pathname==='/api/bootstrap'){
    const wb=db.prepare('SELECT id FROM workbooks ORDER BY rowid LIMIT 1').get();
    if(!wb)return error(res,404,'No workbook');
    return json(res,200,{users:db.prepare('SELECT id,name FROM users ORDER BY rowid').all(),workbook:snapshot(wb.id),revisions:revisions(wb.id)});
  }
  if(parts[0]==='api'&&parts[1]==='workbooks'&&parts[2]){
    const id=parts[2], wb=db.prepare('SELECT id FROM workbooks WHERE id=?').get(id);
    if(!wb)return error(res,404,'Unknown workbook id');
    if(req.method==='GET'&&parts[3]==='events'){
      res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'}); res.write(': connected\n\n');
      const client={workbookId:id,res}; streams.add(client); req.on('close',()=>streams.delete(client)); return;
    }
    if(req.method==='POST'&&parts[3]==='presence'){
      let p; try{p=await body(req)}catch(e){return error(res,400,e.message)}
      if(typeof p.sessionId!=='string'||p.sessionId.length<8||typeof p.userId!=='string'||!db.prepare('SELECT 1 FROM users WHERE id=?').get(p.userId)||typeof p.address!=='string'||p.address.length>30||typeof p.color!=='string') return error(res,400,'Invalid presence');
      sessions.set(p.sessionId,{sessionId:p.sessionId,userId:p.userId,address:p.address,color:p.color,workbookId:id,seen:Date.now()}); presenceChanged(id); return json(res,200,{ok:true});
    }
    if((req.method==='DELETE'||req.method==='POST')&&parts[3]==='presence'&&parts[4]){ sessions.delete(parts[4]); presenceChanged(id); return json(res,200,{ok:true}); }
    if(req.method==='GET'&&parts[3]==='revisions'&&parts[4]){
      const n=Number(parts[4]); if(!Number.isSafeInteger(n))return error(res,400,'Invalid revision');
      const r=db.prepare('SELECT snapshot FROM revisions WHERE workbook_id=? AND number=?').get(id,n); return r?json(res,200,JSON.parse(r.snapshot)):error(res,404,'Revision not found');
    }
    if(req.method==='GET'&&parts[3]==='history'){
      const sheet=url.searchParams.get('sheet'),address=url.searchParams.get('address'); if(!sheet||!validAddress(address||''))return error(res,400,'Invalid cell');
      const rows=db.prepare(`SELECT previous_value AS previousValue,new_value AS newValue,user_id AS userId,changed_at AS changedAt FROM cell_history WHERE workbook_id=? AND sheet_id=? AND address=? ORDER BY id DESC LIMIT 100`).all(id,sheet,address);
      return json(res,200,rows);
    }
    if(req.method==='POST'&&parts[3]==='save'){
      let p; try{p=await body(req)}catch(e){return error(res,400,e.message)} const invalid=validateSave(p,id); if(invalid)return error(res,400,invalid);
      if(!db.prepare('SELECT 1 FROM sheets WHERE workbook_id=? AND id=?').get(id,p.sheetId))return error(res,400,'Unknown or mismatched sheet id');
      const current=db.prepare('SELECT current_revision AS n FROM workbooks WHERE id=?').get(id).n; if(p.baseRevision>current)return error(res,400,'Invalid base revision');
      const targets=new Set(p.changes.map(c=>c.address));
      if(p.baseRevision<current){
        const later=db.prepare('SELECT changes FROM revisions WHERE workbook_id=? AND number>? ORDER BY number').all(id,p.baseRevision);
        const conflicts=[]; for(const r of later)for(const c of JSON.parse(r.changes))if(c.sheetId===p.sheetId&&targets.has(c.address))conflicts.push(c.address);
        if(conflicts.length)return error(res,409,'Save conflict: these cells changed since your base revision',{conflicts:[...new Set(conflicts)],currentRevision:current});
      }
      const actual=[]; for(const c of p.changes){const old=db.prepare('SELECT raw FROM cells WHERE workbook_id=? AND sheet_id=? AND address=?').get(id,p.sheetId,c.address)?.raw||''; if(old!==c.value)actual.push({sheetId:p.sheetId,address:c.address,value:c.value,previousValue:old});}
      if(!actual.length)return json(res,200,{unchanged:true,revision:current,workbook:snapshot(id),revisions:revisions(id)});
      const next=current+1, now=new Date().toISOString(); db.exec('BEGIN IMMEDIATE');
      try{
        const up=db.prepare(`INSERT INTO cells(workbook_id,sheet_id,address,raw,updated_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(workbook_id,sheet_id,address) DO UPDATE SET raw=excluded.raw,updated_by=excluded.updated_by,updated_at=excluded.updated_at`);
        const del=db.prepare('DELETE FROM cells WHERE workbook_id=? AND sheet_id=? AND address=?'); const hist=db.prepare('INSERT INTO cell_history(workbook_id,sheet_id,address,previous_value,new_value,user_id,changed_at) VALUES(?,?,?,?,?,?,?)');
        for(const c of actual){ if(c.value==='')del.run(id,p.sheetId,c.address);else up.run(id,p.sheetId,c.address,c.value,p.userId,now); hist.run(id,p.sheetId,c.address,c.previousValue,c.value,p.userId,now); }
        db.prepare('UPDATE workbooks SET current_revision=? WHERE id=?').run(next,id); const snap=snapshot(id);
        db.prepare('INSERT INTO revisions(workbook_id,number,created_at,user_id,snapshot,changes) VALUES(?,?,?,?,?,?)').run(id,next,now,p.userId,JSON.stringify(snap),JSON.stringify(actual)); db.exec('COMMIT');
        const result={revision:next,changes:actual.map(({sheetId,address,value})=>({sheetId,address,value})),userId:p.userId,createdAt:now,revisions:revisions(id)}; json(res,200,result); emit(id,'revision',result); return;
      }catch(e){db.exec('ROLLBACK'); return error(res,500,'Save failed');}
    }
  }
  error(res,404,'Not found');
}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url);const rel=url.pathname==='/'?'index.html':url.pathname.slice(1), file=normalize(join('/app/public',rel));if(!file.startsWith('/app/public/')||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});createReadStream(file).pipe(res)}catch(e){console.error(e);if(!res.headersSent)error(res,500,'Internal server error');else res.end()}});
server.listen(PORT,'0.0.0.0',()=>console.log(`GridForge listening on 0.0.0.0:${PORT}; database ${DB_PATH}`));

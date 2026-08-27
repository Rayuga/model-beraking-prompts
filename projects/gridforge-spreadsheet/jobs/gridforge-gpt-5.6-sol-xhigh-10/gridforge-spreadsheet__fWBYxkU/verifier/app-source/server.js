const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'gridforge.sqlite');
const SEED_PATH = '/assets/workbook_seed.json';
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workbooks (id TEXT PRIMARY KEY, title TEXT NOT NULL, current_revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sheets (id TEXT PRIMARY KEY, workbook_id TEXT NOT NULL REFERENCES workbooks(id), name TEXT NOT NULL, position INTEGER NOT NULL, UNIQUE(workbook_id,name));
CREATE TABLE IF NOT EXISTS cells (workbook_id TEXT NOT NULL, sheet_id TEXT NOT NULL REFERENCES sheets(id), address TEXT NOT NULL, raw TEXT NOT NULL, updated_revision INTEGER NOT NULL, PRIMARY KEY(workbook_id,sheet_id,address));
CREATE TABLE IF NOT EXISTS revisions (workbook_id TEXT NOT NULL REFERENCES workbooks(id), number INTEGER NOT NULL, created_at TEXT NOT NULL, user_id TEXT REFERENCES users(id), session_id TEXT, reason TEXT NOT NULL, PRIMARY KEY(workbook_id,number));
CREATE TABLE IF NOT EXISTS revision_cells (workbook_id TEXT NOT NULL, revision_number INTEGER NOT NULL, sheet_id TEXT NOT NULL, address TEXT NOT NULL, raw TEXT NOT NULL, PRIMARY KEY(workbook_id,revision_number,sheet_id,address));
CREATE TABLE IF NOT EXISTS edit_history (id INTEGER PRIMARY KEY AUTOINCREMENT, workbook_id TEXT NOT NULL, sheet_id TEXT NOT NULL, address TEXT NOT NULL, previous_raw TEXT NOT NULL, new_raw TEXT NOT NULL, user_id TEXT NOT NULL, changed_at TEXT NOT NULL, revision_number INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, workbook_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), selection TEXT NOT NULL DEFAULT 'A1', color TEXT NOT NULL, created_at TEXT NOT NULL, last_seen TEXT NOT NULL);
`);

function seed() {
  const data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const exists = db.prepare('SELECT 1 FROM workbooks WHERE id=?').get(data.workbook.id);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const user of data.users) db.prepare('INSERT OR IGNORE INTO users(id,name) VALUES(?,?)').run(user.id,user.name);
    if (!exists) {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO workbooks(id,title,current_revision,updated_at) VALUES(?,?,1,?)').run(data.workbook.id,data.workbook.title,now);
      for (const [position, sheet] of data.workbook.sheets.entries()) {
        db.prepare('INSERT INTO sheets(id,workbook_id,name,position) VALUES(?,?,?,?)').run(sheet.id,data.workbook.id,sheet.name,position);
        for (const [address, raw] of Object.entries(sheet.cells)) {
          db.prepare('INSERT INTO cells(workbook_id,sheet_id,address,raw,updated_revision) VALUES(?,?,?,?,1)').run(data.workbook.id,sheet.id,address,String(raw));
          db.prepare('INSERT INTO revision_cells(workbook_id,revision_number,sheet_id,address,raw) VALUES(?,?,?,?,?)').run(data.workbook.id,1,sheet.id,address,String(raw));
        }
      }
      db.prepare("INSERT INTO revisions(workbook_id,number,created_at,user_id,session_id,reason) VALUES(?,1,?,NULL,NULL,'Seeded workbook')").run(data.workbook.id,now);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
seed();

const clients = new Map();
const COLORS = ['#e5484d','#3e63dd','#30a46c','#ab4aba','#f76b15','#0090ff','#9e6c00','#12a594'];
function sendEvent(workbookId, type, data, except = '') {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [sessionId, client] of clients) if (client.workbookId === workbookId && sessionId !== except) client.res.write(payload);
}
function presence(workbookId) {
  const rows = db.prepare(`SELECT s.id,s.user_id AS userId,u.name,s.selection,s.color FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.workbook_id=? AND s.last_seen > datetime('now','-2 minutes') ORDER BY s.created_at`).all(workbookId);
  sendEvent(workbookId, 'presence', rows);
}
function json(res, status, body) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(body)); }
function error(res, status, message, details) { json(res,status,{error:message,...(details?{details}:{})}); }
async function body(req) {
  let text='';
  for await (const chunk of req) { text += chunk; if (text.length > 1_000_000) throw new Error('Request too large'); }
  try { return JSON.parse(text || '{}'); } catch { throw new Error('Malformed JSON'); }
}
function workbook(id) {
  const wb=db.prepare('SELECT id,title,current_revision AS revision,updated_at AS updatedAt FROM workbooks WHERE id=?').get(id);
  if(!wb) return null;
  wb.sheets=db.prepare('SELECT id,name FROM sheets WHERE workbook_id=? ORDER BY position').all(id).map(s=>({...s,cells:Object.fromEntries(db.prepare('SELECT address,raw FROM cells WHERE workbook_id=? AND sheet_id=?').all(id,s.id).map(c=>[c.address,c.raw]))}));
  return wb;
}
function validAddress(a){return typeof a==='string' && /^[A-Z]{1,3}[1-9][0-9]{0,4}$/.test(a);}
function sessionFor(id){return id && db.prepare('SELECT * FROM sessions WHERE id=?').get(id);}
function getSession(req,payload){ return sessionFor(req.headers['x-session-id'] || payload?.sessionId); }
function staticFile(req,res){
  const pathname=new URL(req.url,'http://localhost').pathname;
  const requested=pathname==='/'?'index.html':pathname.slice(1);
  const file=path.join(ROOT,'public',requested);
  if(!file.startsWith(path.join(ROOT,'public')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
  const ext=path.extname(file); const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
  res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'}); fs.createReadStream(file).pipe(res); return true;
}

const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost'); const parts=url.pathname.split('/').filter(Boolean);
    if(req.method==='GET' && url.pathname==='/api/users') return json(res,200,db.prepare('SELECT id,name FROM users ORDER BY name').all());
    if(req.method==='POST' && url.pathname==='/api/sessions') {
      const p=await body(req); const user=db.prepare('SELECT id FROM users WHERE id=?').get(p.userId); const wb=db.prepare('SELECT id FROM workbooks WHERE id=?').get(p.workbookId);
      if(!user||!wb) return error(res,400,'Unknown user or workbook');
      const id=crypto.randomUUID(), now=new Date().toISOString(); const active=db.prepare('SELECT COUNT(*) n FROM sessions').get().n;
      db.prepare('INSERT INTO sessions(id,workbook_id,user_id,selection,color,created_at,last_seen) VALUES(?,?,?,?,?,?,?)').run(id,p.workbookId,p.userId,'A1',COLORS[active%COLORS.length],now,now); presence(p.workbookId); return json(res,201,{id});
    }
    if(parts[0]==='api'&&parts[1]==='sessions'&&parts[2]&&req.method==='PATCH') {
      const p=await body(req), s=sessionFor(parts[2]); if(!s)return error(res,404,'Unknown session');
      if(p.userId!==undefined && !db.prepare('SELECT 1 FROM users WHERE id=?').get(p.userId))return error(res,400,'Unknown user');
      if(p.selection!==undefined && !/^([A-Z]{1,3}[1-9][0-9]{0,4})(:([A-Z]{1,3}[1-9][0-9]{0,4}))?$/.test(p.selection))return error(res,400,'Invalid selection');
      db.prepare('UPDATE sessions SET user_id=?,selection=?,last_seen=? WHERE id=?').run(p.userId||s.user_id,p.selection||s.selection,new Date().toISOString(),s.id); presence(s.workbook_id); return json(res,200,{ok:true});
    }
    if(parts[0]==='api'&&parts[1]==='sessions'&&parts[2]&&req.method==='DELETE') {
      const s=sessionFor(parts[2]); if(s){db.prepare('DELETE FROM sessions WHERE id=?').run(s.id);clients.delete(s.id);presence(s.workbook_id);} return json(res,200,{ok:true});
    }
    if(req.method==='GET'&&url.pathname==='/api/events') {
      const s=sessionFor(url.searchParams.get('sessionId')); if(!s)return error(res,401,'Unknown session');
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(': connected\n\n');clients.set(s.id,{res,workbookId:s.workbook_id});presence(s.workbook_id);
      req.on('close',()=>{clients.delete(s.id);db.prepare('DELETE FROM sessions WHERE id=?').run(s.id);presence(s.workbook_id);});return;
    }
    if(parts[0]==='api'&&parts[1]==='workbooks'&&parts[2]) {
      const id=parts[2], wb=workbook(id); if(!wb)return error(res,404,'Unknown workbook');
      if(req.method==='GET'&&parts.length===3) return json(res,200,{workbook:wb,users:db.prepare('SELECT id,name FROM users ORDER BY name').all()});
      if(req.method==='GET'&&parts[3]==='revisions'&&parts.length===4){
        return json(res,200,db.prepare(`SELECT r.number,r.created_at AS createdAt,r.reason,u.name AS userName FROM revisions r LEFT JOIN users u ON u.id=r.user_id WHERE r.workbook_id=? ORDER BY r.number DESC`).all(id));
      }
      if(req.method==='GET'&&parts[3]==='revisions'&&parts[4]){
        const n=Number(parts[4]); if(!Number.isInteger(n)||n<1)return error(res,400,'Invalid revision');
        const rev=db.prepare('SELECT * FROM revisions WHERE workbook_id=? AND number=?').get(id,n);if(!rev)return error(res,404,'Unknown revision');
        const sheets=wb.sheets.map(s=>({id:s.id,name:s.name,cells:Object.fromEntries(db.prepare('SELECT address,raw FROM revision_cells WHERE workbook_id=? AND revision_number=? AND sheet_id=?').all(id,n,s.id).map(c=>[c.address,c.raw]))}));return json(res,200,{number:n,sheets});
      }
      if(req.method==='GET'&&parts[3]==='history'){
        const sheetId=url.searchParams.get('sheetId'),address=url.searchParams.get('address');if(!validAddress(address)||!wb.sheets.some(s=>s.id===sheetId))return error(res,400,'Invalid cell');
        return json(res,200,db.prepare(`SELECT h.previous_raw AS previousRaw,h.new_raw AS newRaw,h.changed_at AS changedAt,h.revision_number AS revision,u.name AS userName FROM edit_history h JOIN users u ON u.id=h.user_id WHERE h.workbook_id=? AND h.sheet_id=? AND h.address=? ORDER BY h.id DESC`).all(id,sheetId,address));
      }
      if(req.method==='POST'&&parts[3]==='save'){
        const p=await body(req),s=getSession(req,p);if(!s)return error(res,401,'Missing or unknown editing session');if(s.workbook_id!==id)return error(res,403,'Session workbook mismatch');if(p.userId!==s.user_id)return error(res,403,'Session user mismatch');
        if(p.workbookId!==id||p.title!==wb.title||!Array.isArray(p.sheets)||p.sheets.length!==wb.sheets.length)return error(res,400,'Workbook metadata mismatch');
        for(const sh of p.sheets){const stored=wb.sheets.find(x=>x.id===sh.id);if(!stored||sh.name!==stored.name)return error(res,400,'Sheet metadata mismatch');}
        if(!Number.isInteger(p.baseRevision)||p.baseRevision<1||p.baseRevision>wb.revision)return error(res,400,'Invalid base revision');
        if(!Array.isArray(p.changes)||p.changes.length>10000)return error(res,400,'Malformed changes');
        const seen=new Set();for(const c of p.changes){const key=`${c.sheetId}:${c.address}`;if(!wb.sheets.some(x=>x.id===c.sheetId)||!validAddress(c.address)||typeof c.raw!=='string'||c.raw.length>10000||seen.has(key))return error(res,400,'Malformed or inconsistent cell change');seen.add(key);}
        const conflicts=p.changes.filter(c=>{const row=db.prepare('SELECT MAX(rev) AS rev FROM (SELECT updated_revision AS rev FROM cells WHERE workbook_id=? AND sheet_id=? AND address=? UNION ALL SELECT revision_number AS rev FROM edit_history WHERE workbook_id=? AND sheet_id=? AND address=?)').get(id,c.sheetId,c.address,id,c.sheetId,c.address);return row?.rev>p.baseRevision;});
        if(conflicts.length)return error(res,409,'Save conflict: cells changed in a newer revision',{cells:conflicts.map(c=>c.address),currentRevision:wb.revision});
        const actual=p.changes.filter(c=>(db.prepare('SELECT raw FROM cells WHERE workbook_id=? AND sheet_id=? AND address=?').get(id,c.sheetId,c.address)?.raw||'')!==c.raw);
        if(!actual.length)return json(res,200,{revision:wb.revision,unchanged:true});
        const next=wb.revision+1,now=new Date().toISOString();db.exec('BEGIN IMMEDIATE');
        try{
          for(const c of actual){const old=db.prepare('SELECT raw FROM cells WHERE workbook_id=? AND sheet_id=? AND address=?').get(id,c.sheetId,c.address)?.raw||'';if(c.raw==='')db.prepare('DELETE FROM cells WHERE workbook_id=? AND sheet_id=? AND address=?').run(id,c.sheetId,c.address);else db.prepare('INSERT INTO cells(workbook_id,sheet_id,address,raw,updated_revision) VALUES(?,?,?,?,?) ON CONFLICT(workbook_id,sheet_id,address) DO UPDATE SET raw=excluded.raw,updated_revision=excluded.updated_revision').run(id,c.sheetId,c.address,c.raw,next);db.prepare('INSERT INTO edit_history(workbook_id,sheet_id,address,previous_raw,new_raw,user_id,changed_at,revision_number) VALUES(?,?,?,?,?,?,?,?)').run(id,c.sheetId,c.address,old,c.raw,s.user_id,now,next);}
          db.prepare('UPDATE workbooks SET current_revision=?,updated_at=? WHERE id=?').run(next,now,id);db.prepare('INSERT INTO revisions(workbook_id,number,created_at,user_id,session_id,reason) VALUES(?,?,?,?,?,?)').run(id,next,now,s.user_id,s.id,p.reason||'Saved changes');
          db.prepare('INSERT INTO revision_cells(workbook_id,revision_number,sheet_id,address,raw) SELECT workbook_id,?,sheet_id,address,raw FROM cells WHERE workbook_id=?').run(next,id);db.exec('COMMIT');
        }catch(e){db.exec('ROLLBACK');throw e;}
        const changes=actual.map(c=>({...c,userId:s.user_id}));sendEvent(id,'saved',{revision:next,changes,sessionId:s.id},s.id);return json(res,200,{revision:next,changes});
      }
    }
    if(req.method==='GET'&&staticFile(req,res))return;
    error(res,404,'Not found');
  }catch(e){console.error(e);error(res,e.message==='Request too large'?413:400,e.message||'Request failed');}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`GridForge listening on http://0.0.0.0:${PORT}`));

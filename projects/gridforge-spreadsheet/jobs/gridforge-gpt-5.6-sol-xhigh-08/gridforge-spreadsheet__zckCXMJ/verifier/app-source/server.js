const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'gridforge.sqlite3');
const SEED_PATH = '/assets/workbook_seed.json';
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workbooks (id TEXT PRIMARY KEY, title TEXT NOT NULL, current_revision INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sheets (id TEXT PRIMARY KEY, workbook_id TEXT NOT NULL REFERENCES workbooks(id), name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS revisions (
  workbook_id TEXT NOT NULL REFERENCES workbooks(id), revision INTEGER NOT NULL,
  created_at TEXT NOT NULL, user_id TEXT REFERENCES users(id), snapshot TEXT NOT NULL,
  PRIMARY KEY (workbook_id, revision)
);
CREATE TABLE IF NOT EXISTS cell_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, workbook_id TEXT NOT NULL, revision INTEGER NOT NULL,
  sheet_id TEXT NOT NULL, address TEXT NOT NULL, previous_value TEXT NOT NULL, new_value TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id), changed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), workbook_id TEXT NOT NULL REFERENCES workbooks(id),
  selection TEXT NOT NULL DEFAULT 'A1', color TEXT NOT NULL, created_at TEXT NOT NULL, last_seen INTEGER NOT NULL
);
`);

function seed() {
  if (db.prepare('SELECT COUNT(*) n FROM workbooks').get().n) return;
  const data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    const iu = db.prepare('INSERT INTO users (id,name) VALUES (?,?)');
    for (const u of data.users) iu.run(u.id, u.name);
    db.prepare('INSERT INTO workbooks (id,title,current_revision) VALUES (?,?,1)').run(data.workbook.id, data.workbook.title);
    const is = db.prepare('INSERT INTO sheets (id,workbook_id,name) VALUES (?,?,?)');
    for (const s of data.workbook.sheets) is.run(s.id, data.workbook.id, s.name);
    db.prepare('INSERT INTO revisions (workbook_id,revision,created_at,user_id,snapshot) VALUES (?,1,?,NULL,?)')
      .run(data.workbook.id, now, JSON.stringify(data.workbook));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
seed();

const sseClients = new Map();
const COLORS = ['#2563eb','#db2777','#059669','#d97706','#7c3aed','#0891b2','#dc2626','#65a30d'];
const ADDRESS = /^[A-Z]+[1-9]\d*$/;
const RANGE = /^[A-Z]+[1-9]\d*(?::[A-Z]+[1-9]\d*)?$/;
const isPlainObject = value => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(data),'Cache-Control':'no-store'});
  res.end(data);
}
function fail(res, status, message, extra={}) { json(res, status, {error: message, ...extra}); }
function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 2_000_000) reject(new Error('Request too large')); });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error('Malformed JSON')); } });
    req.on('error', reject);
  });
}
function getWorkbook(id, revision=null) {
  const w = db.prepare('SELECT * FROM workbooks WHERE id=?').get(id);
  if (!w) return null;
  const r = revision == null ? w.current_revision : revision;
  const row = db.prepare('SELECT snapshot,created_at,user_id FROM revisions WHERE workbook_id=? AND revision=?').get(id,r);
  return row ? {workbook:JSON.parse(row.snapshot), revision:r, currentRevision:w.current_revision, createdAt:row.created_at, userId:row.user_id} : null;
}
function validWorkbookShape(value, canonical, expectedId) {
  if (!isPlainObject(value) || value.id !== expectedId || value.title !== canonical.title || !Array.isArray(value.sheets) || value.sheets.length !== canonical.sheets.length) return false;
  return value.sheets.every((sheet, i) => {
    const original = canonical.sheets[i];
    if (!isPlainObject(sheet) || sheet.id !== original.id || sheet.name !== original.name || !isPlainObject(sheet.cells)) return false;
    return Object.entries(sheet.cells).every(([address, cell]) => ADDRESS.test(address) && typeof cell === 'string');
  });
}
function sessionRow(id) { return typeof id === 'string' ? db.prepare('SELECT * FROM sessions WHERE id=?').get(id) : null; }
function activePresence(workbookId) {
  const cutoff = Date.now() - 15000;
  db.prepare('DELETE FROM sessions WHERE last_seen < ?').run(cutoff);
  return db.prepare(`SELECT s.id,s.user_id userId,u.name,s.selection,s.color
    FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.workbook_id=? ORDER BY s.created_at`).all(workbookId);
}
function broadcast(workbookId, type, payload) {
  const message = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients.values()) if (client.workbookId === workbookId) client.res.write(message);
}
function broadcastPresence(workbookId) { broadcast(workbookId, 'presence', activePresence(workbookId)); }
function requireSession(reqBody, workbookId) {
  const session = sessionRow(reqBody.sessionId);
  if (!session || session.workbook_id !== workbookId || typeof reqBody.userId !== 'string' || reqBody.userId !== session.user_id) return null;
  db.prepare('UPDATE sessions SET last_seen=? WHERE id=?').run(Date.now(), session.id);
  return session;
}

async function api(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/users') return json(res,200,{users:db.prepare('SELECT id,name FROM users ORDER BY rowid').all()});
  if (req.method === 'POST' && url.pathname === '/api/sessions') {
    const data = await body(req);
    const user = typeof data.userId === 'string' && db.prepare('SELECT id,name FROM users WHERE id=?').get(data.userId);
    const wb = typeof data.workbookId === 'string' && db.prepare('SELECT id FROM workbooks WHERE id=?').get(data.workbookId);
    if (!user || !wb) return fail(res,400,'Unknown user or workbook');
    const id = crypto.randomUUID();
    const used = new Set(activePresence(wb.id).map(p=>p.color));
    const color = COLORS.find(c=>!used.has(c)) || `hsl(${Math.floor(Math.random()*360)} 70% 45%)`;
    db.prepare('INSERT INTO sessions (id,user_id,workbook_id,selection,color,created_at,last_seen) VALUES (?,?,?,?,?,?,?)')
      .run(id,user.id,wb.id,'A1',color,new Date().toISOString(),Date.now());
    json(res,201,{sessionId:id,user,color});
    broadcastPresence(wb.id); return;
  }
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/sessions/')) {
    const id = decodeURIComponent(url.pathname.slice('/api/sessions/'.length));
    const old = sessionRow(id); db.prepare('DELETE FROM sessions WHERE id=?').run(id);
    sseClients.delete(id); res.writeHead(204).end(); if (old) broadcastPresence(old.workbook_id); return;
  }
  if (req.method === 'POST' && /^\/api\/sessions\/[^/]+\/presence$/.test(url.pathname)) {
    const id = decodeURIComponent(url.pathname.split('/')[3]); const session = sessionRow(id); const data = await body(req);
    if (!session || data.userId !== session.user_id || typeof data.selection !== 'string' || !RANGE.test(data.selection)) return fail(res,403,'Unknown session or user mismatch');
    db.prepare('UPDATE sessions SET selection=?,last_seen=? WHERE id=?').run(data.selection,Date.now(),id);
    json(res,200,{ok:true}); broadcastPresence(session.workbook_id); return;
  }
  if (req.method === 'GET' && url.pathname === '/api/events') {
    const id = url.searchParams.get('sessionId'); const session = sessionRow(id);
    if (!session) return fail(res,403,'Unknown session');
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
    res.write(': connected\n\n'); sseClients.set(id,{res,workbookId:session.workbook_id});
    db.prepare('UPDATE sessions SET last_seen=? WHERE id=?').run(Date.now(),id); broadcastPresence(session.workbook_id);
    req.on('close',()=>{ sseClients.delete(id); }); return;
  }
  const match = url.pathname.match(/^\/api\/workbooks\/([^/]+)(?:\/(.*))?$/);
  if (!match) return false;
  const workbookId = decodeURIComponent(match[1]), action = match[2] || '';
  if (req.method === 'GET' && !action) {
    const data = getWorkbook(workbookId); if (!data) return fail(res,404,'Unknown workbook');
    return json(res,200,{...data,users:db.prepare('SELECT id,name FROM users ORDER BY rowid').all()});
  }
  if (req.method === 'GET' && action === 'revisions') {
    if (!db.prepare('SELECT id FROM workbooks WHERE id=?').get(workbookId)) return fail(res,404,'Unknown workbook');
    const revisions = db.prepare(`SELECT r.revision,r.created_at createdAt,r.user_id userId,u.name
      FROM revisions r LEFT JOIN users u ON u.id=r.user_id WHERE r.workbook_id=? ORDER BY r.revision DESC`).all(workbookId);
    return json(res,200,{revisions});
  }
  const revMatch = action.match(/^revisions\/(\d+)$/);
  if (req.method === 'GET' && revMatch) {
    const data=getWorkbook(workbookId,Number(revMatch[1])); return data?json(res,200,data):fail(res,404,'Unknown revision');
  }
  const histMatch = action.match(/^history\/([^/]+)\/([^/]+)$/);
  if (req.method === 'GET' && histMatch) {
    const sheetId=decodeURIComponent(histMatch[1]), address=decodeURIComponent(histMatch[2]);
    if (!ADDRESS.test(address)) return fail(res,400,'Invalid cell address');
    const changes=db.prepare(`SELECT c.revision,c.previous_value previousValue,c.new_value newValue,c.changed_at changedAt,c.user_id userId,u.name
      FROM cell_changes c JOIN users u ON u.id=c.user_id WHERE c.workbook_id=? AND c.sheet_id=? AND c.address=? ORDER BY c.id DESC`).all(workbookId,sheetId,address);
    const last=changes[0]||null; return json(res,200,{changes,lastChangedBy:last?{userId:last.userId,name:last.name,changedAt:last.changedAt}:null});
  }
  if (req.method === 'POST' && action === 'save') {
    const data = await body(req);
    const canonical=getWorkbook(workbookId); if (!canonical) return fail(res,404,'Unknown workbook');
    if (!isPlainObject(data) || data.workbookId !== workbookId) return fail(res,400,'Workbook id mismatch');
    if (!Number.isInteger(data.baseRevision) || data.baseRevision < 1 || data.baseRevision > canonical.currentRevision) return fail(res,400,'Invalid base revision');
    const base=getWorkbook(workbookId,data.baseRevision); if (!base) return fail(res,400,'Unknown base revision');
    if (!validWorkbookShape(data.workbook,base.workbook,workbookId)) return fail(res,400,'Malformed workbook, sheet, or cells');
    const session=requireSession(data,workbookId); if (!session) return fail(res,403,'Unknown editing session or user mismatch');
    const edits=[];
    for (let i=0;i<base.workbook.sheets.length;i++) {
      const oldCells=base.workbook.sheets[i].cells, newCells=data.workbook.sheets[i].cells;
      for (const address of new Set([...Object.keys(oldCells),...Object.keys(newCells)])) {
        const oldValue=oldCells[address] ?? '', newValue=newCells[address] ?? '';
        if (newValue !== oldValue) edits.push({sheetIndex:i,sheetId:base.workbook.sheets[i].id,address,oldValue,newValue});
      }
    }
    const current=getWorkbook(workbookId); const conflicts=[];
    for (const e of edits) {
      const currentValue=current.workbook.sheets[e.sheetIndex].cells[e.address] ?? '';
      if (currentValue !== e.oldValue && currentValue !== e.newValue) conflicts.push({sheetId:e.sheetId,address:e.address,serverValue:currentValue,localValue:e.newValue});
    }
    if (conflicts.length) return fail(res,409,'Conflicting cell changes',{conflicts,currentRevision:current.currentRevision,workbook:current.workbook});
    const effective=edits.filter(e=>(current.workbook.sheets[e.sheetIndex].cells[e.address]??'')!==e.newValue);
    if (!effective.length) return json(res,200,{saved:false,revision:current.currentRevision,workbook:current.workbook});
    const merged=structuredClone(current.workbook);
    for (const e of effective) merged.sheets[e.sheetIndex].cells[e.address]=e.newValue;
    const next=current.currentRevision+1, now=new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      const live=db.prepare('SELECT current_revision currentRevision FROM workbooks WHERE id=?').get(workbookId);
      if (live.currentRevision!==current.currentRevision) throw Object.assign(new Error('Concurrent save; retry'),{status:409});
      db.prepare('INSERT INTO revisions (workbook_id,revision,created_at,user_id,snapshot) VALUES (?,?,?,?,?)').run(workbookId,next,now,session.user_id,JSON.stringify(merged));
      const ic=db.prepare('INSERT INTO cell_changes (workbook_id,revision,sheet_id,address,previous_value,new_value,user_id,changed_at) VALUES (?,?,?,?,?,?,?,?)');
      for (const e of effective) ic.run(workbookId,next,e.sheetId,e.address,current.workbook.sheets[e.sheetIndex].cells[e.address]??'',e.newValue,session.user_id,now);
      db.prepare('UPDATE workbooks SET current_revision=? WHERE id=?').run(next,workbookId); db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); if(error.status) return fail(res,error.status,error.message); throw error; }
    const result={saved:true,revision:next,workbook:merged,changed:effective.map(e=>({sheetId:e.sheetId,address:e.address,value:e.newValue})),userId:session.user_id,sessionId:session.id,createdAt:now};
    json(res,200,result); broadcast(workbookId,'revision',result); return;
  }
  return false;
}

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')) { const handled=await api(req,res,url); if(handled===false) fail(res,404,'Not found'); return; }
    let pathname=url.pathname==='/'?'/index.html':url.pathname;
    const file=path.resolve(ROOT,'public','.'+pathname), publicRoot=path.resolve(ROOT,'public');
    if(!file.startsWith(publicRoot+path.sep)) return fail(res,403,'Forbidden');
    const data=fs.readFileSync(file); res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream'}); res.end(data);
  } catch(error) {
    console.error(error); if(!res.headersSent) fail(res,error.message==='Malformed JSON'?400:500,error.message==='Malformed JSON'?'Malformed JSON':'Unexpected server error'); else res.end();
  }
});
setInterval(()=>{ for(const c of sseClients.values()) c.res.write(': heartbeat\n\n'); for(const id of sseClients.keys()) db.prepare('UPDATE sessions SET last_seen=? WHERE id=?').run(Date.now(),id); },5000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`GridForge listening on http://0.0.0.0:${PORT}`));

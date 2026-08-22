const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = '/app/gridforge.sqlite';
const ASSET_DIR = path.join(__dirname, 'public');
const db = new DatabaseSync(DB_PATH);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workbooks(id TEXT PRIMARY KEY, title TEXT NOT NULL, current_revision INTEGER NOT NULL, content TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS revisions(workbook_id TEXT NOT NULL, revision INTEGER NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL, user_id TEXT, PRIMARY KEY(workbook_id,revision), FOREIGN KEY(workbook_id) REFERENCES workbooks(id));
CREATE TABLE IF NOT EXISTS revision_changes(workbook_id TEXT NOT NULL, revision INTEGER NOT NULL, sheet_id TEXT NOT NULL, address TEXT NOT NULL, old_value TEXT, new_value TEXT, user_id TEXT NOT NULL, changed_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS revision_changes_lookup ON revision_changes(workbook_id,revision,sheet_id,address);`);

function normalizeWorkbook(w) {
  return { id: w.id, title: w.title, sheets: w.sheets.map(s => ({ id: s.id, name: s.name, cells: {...s.cells} })) };
}
function seed() {
  const seed = JSON.parse(fs.readFileSync('/assets/workbook_seed.json', 'utf8'));
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const u of seed.users) db.prepare('INSERT OR IGNORE INTO users(id,name) VALUES(?,?)').run(u.id,u.name);
    const w = normalizeWorkbook(seed.workbook);
    const inserted = db.prepare('INSERT OR IGNORE INTO workbooks(id,title,current_revision,content,updated_at) VALUES(?,?,?,?,?)').run(w.id,w.title,1,JSON.stringify(w),now);
    if (inserted.changes) db.prepare('INSERT INTO revisions(workbook_id,revision,content,created_at,user_id) VALUES(?,?,?,?,?)').run(w.id,1,JSON.stringify(w),now,null);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
seed();

const clients = new Map();
const presence = new Map();
function sendEvent(res, event, data) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
function broadcast(event, data, except = null) { for (const [id,res] of clients) if (id !== except) sendEvent(res,event,data); }
function presenceSnapshot() { return [...presence.values()]; }
function broadcastPresence() { broadcast('presence', presenceSnapshot()); }

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store'}); res.end(body);
}
function error(res, status, message, extra={}) { json(res,status,{error:message,...extra}); }
function readJson(req) { return new Promise((resolve,reject) => { let s=''; req.on('data',c=>{s+=c;if(s.length>2_000_000){reject(new Error('Payload too large'));req.destroy();}}); req.on('end',()=>{try{resolve(JSON.parse(s||'{}'));}catch{reject(new Error('Malformed JSON'));}}); req.on('error',reject); }); }
function validAddress(a) { return /^[A-Z]{1,3}[1-9]\d{0,4}$/.test(a); }
function validateWorkbook(candidate, stored) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return 'Workbook must be an object';
  if (candidate.id !== stored.id) return 'Workbook id does not match';
  if (candidate.title !== stored.title) return 'Cell saves cannot rename the workbook';
  if (!Array.isArray(candidate.sheets) || candidate.sheets.length !== stored.sheets.length) return 'Sheet structure does not match';
  for (let i=0;i<stored.sheets.length;i++) {
    const s=candidate.sheets[i], old=stored.sheets[i];
    if (!s || s.id!==old.id || s.name!==old.name) return 'Cell saves cannot change sheet identity';
    if (!s.cells || typeof s.cells!=='object' || Array.isArray(s.cells)) return 'Cells must be an object';
    for (const [a,v] of Object.entries(s.cells)) if (!validAddress(a) || typeof v!=='string' || v.length>20000) return `Invalid cell data at ${a}`;
  }
  return null;
}
function cellMap(w) { const m=new Map(); for(const s of w.sheets) for(const [a,v] of Object.entries(s.cells)) m.set(`${s.id}!${a}`,v); return m; }
function diff(from,to) {
  const a=cellMap(from), b=cellMap(to), out=[];
  for(const key of new Set([...a.keys(),...b.keys()])) { const av=a.get(key)??'', bv=b.get(key)??''; if(av!==bv){const p=key.indexOf('!');out.push({sheetId:key.slice(0,p),address:key.slice(p+1),oldValue:av,newValue:bv});} }
  return out;
}
function setCell(w,sheetId,address,value) { const s=w.sheets.find(x=>x.id===sheetId); if(value==='') delete s.cells[address]; else s.cells[address]=value; }
function revisions(id) { return db.prepare('SELECT revision,created_at AS createdAt,user_id AS userId FROM revisions WHERE workbook_id=? ORDER BY revision DESC').all(id); }

async function api(req,res,url) {
  if (req.method==='GET' && url.pathname==='/api/bootstrap') {
    const row=db.prepare('SELECT * FROM workbooks ORDER BY rowid LIMIT 1').get();
    if(!row)return error(res,404,'No workbook');
    return json(res,200,{users:db.prepare('SELECT id,name FROM users ORDER BY rowid').all(),workbook:JSON.parse(row.content),revision:row.current_revision,updatedAt:row.updated_at,revisions:revisions(row.id)});
  }
  const revMatch=url.pathname.match(/^\/api\/workbooks\/([^/]+)\/revisions\/(\d+)$/);
  if(req.method==='GET'&&revMatch){const row=db.prepare('SELECT content,created_at AS createdAt,user_id AS userId FROM revisions WHERE workbook_id=? AND revision=?').get(decodeURIComponent(revMatch[1]),Number(revMatch[2]));return row?json(res,200,{...row,content:JSON.parse(row.content)}):error(res,404,'Revision not found');}
  const histMatch=url.pathname.match(/^\/api\/workbooks\/([^/]+)\/history$/);
  if(req.method==='GET'&&histMatch){const sheetId=url.searchParams.get('sheetId'),address=url.searchParams.get('address');if(!sheetId||!validAddress(address||''))return error(res,400,'Valid sheetId and address are required');const rows=db.prepare(`SELECT rc.revision,rc.old_value AS oldValue,rc.new_value AS newValue,rc.changed_at AS changedAt,u.name AS userName FROM revision_changes rc JOIN users u ON u.id=rc.user_id WHERE rc.workbook_id=? AND rc.sheet_id=? AND rc.address=? ORDER BY rc.revision DESC`).all(decodeURIComponent(histMatch[1]),sheetId,address);return json(res,200,{history:rows});}
  const saveMatch=url.pathname.match(/^\/api\/workbooks\/([^/]+)\/save$/);
  if(req.method==='POST'&&saveMatch){
    let body;try{body=await readJson(req);}catch(e){return error(res,400,e.message);}
    const id=decodeURIComponent(saveMatch[1]); if(body.workbookId!==id)return error(res,400,'Workbook id mismatch');
    if(!Number.isSafeInteger(body.baseRevision)||body.baseRevision<1)return error(res,400,'Invalid base revision');
    if(typeof body.userId!=='string'||!db.prepare('SELECT 1 FROM users WHERE id=?').get(body.userId))return error(res,400,'Invalid user');
    const currentRow=db.prepare('SELECT * FROM workbooks WHERE id=?').get(id);if(!currentRow)return error(res,404,'Unknown workbook');
    const current=JSON.parse(currentRow.content), validation=validateWorkbook(body.workbook,current);if(validation)return error(res,400,validation);
    const baseRow=db.prepare('SELECT content FROM revisions WHERE workbook_id=? AND revision=?').get(id,body.baseRevision);if(!baseRow)return error(res,409,'Base revision does not exist');
    if(body.baseRevision>currentRow.current_revision)return error(res,409,'Base revision is ahead of current revision');
    const base=JSON.parse(baseRow.content), submitted=normalizeWorkbook(body.workbook);
    const baseDiff=diff(base,submitted), currentMap=cellMap(current);
    const intended=baseDiff.filter(c=>(currentMap.get(`${c.sheetId}!${c.address}`)??'')!==c.newValue);
    const changedSince=new Set(db.prepare('SELECT sheet_id,address FROM revision_changes WHERE workbook_id=? AND revision>?').all(id,body.baseRevision).map(x=>`${x.sheet_id}!${x.address}`));
    const conflicts=intended.filter(c=>changedSince.has(`${c.sheetId}!${c.address}`)).map(c=>({sheetId:c.sheetId,address:c.address,serverValue:currentMap.get(`${c.sheetId}!${c.address}`)??'',localValue:c.newValue}));
    if(conflicts.length)return error(res,409,'Save conflict: the same cell changed in a newer revision',{conflicts,currentRevision:currentRow.current_revision});
    if(!intended.length)return json(res,200,{saved:false,revision:currentRow.current_revision,workbook:current,revisions:revisions(id)});
    const merged=normalizeWorkbook(current); for(const c of intended)setCell(merged,c.sheetId,c.address,c.newValue);
    const next=currentRow.current_revision+1, now=new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');try{
      const guard=db.prepare('UPDATE workbooks SET content=?,current_revision=?,updated_at=? WHERE id=? AND current_revision=?').run(JSON.stringify(merged),next,now,id,currentRow.current_revision);if(!guard.changes)throw new Error('Concurrent save; retry');
      db.prepare('INSERT INTO revisions(workbook_id,revision,content,created_at,user_id) VALUES(?,?,?,?,?)').run(id,next,JSON.stringify(merged),now,body.userId);
      const ins=db.prepare('INSERT INTO revision_changes(workbook_id,revision,sheet_id,address,old_value,new_value,user_id,changed_at) VALUES(?,?,?,?,?,?,?,?)');
      for(const c of intended)ins.run(id,next,c.sheetId,c.address,currentMap.get(`${c.sheetId}!${c.address}`)??'',c.newValue,body.userId,now);
      db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');return error(res,409,e.message);}
    const payload={workbookId:id,revision:next,changes:intended.map(({sheetId,address,newValue})=>({sheetId,address,value:newValue})),userId:body.userId,createdAt:now};broadcast('revision',payload,body.sessionId||null);
    return json(res,200,{saved:true,revision:next,workbook:merged,revisions:revisions(id),changes:payload.changes});
  }
  if(req.method==='POST'&&url.pathname==='/api/presence'){
    let b;try{b=await readJson(req);}catch(e){return error(res,400,e.message);}if(typeof b.sessionId!=='string'||!clients.has(b.sessionId))return error(res,400,'Unknown session');if(!db.prepare('SELECT 1 FROM users WHERE id=?').get(b.userId))return error(res,400,'Invalid user');if(!b.selection||!validAddress(b.selection.start)||!validAddress(b.selection.end))return error(res,400,'Invalid selection');presence.set(b.sessionId,{sessionId:b.sessionId,userId:b.userId,name:db.prepare('SELECT name FROM users WHERE id=?').get(b.userId).name,selection:b.selection});broadcastPresence();return json(res,200,{ok:true});
  }
  return error(res,404,'API route not found');
}

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/api/events'){
    const sid=url.searchParams.get('sessionId');if(!sid||!/^[\w-]{8,100}$/.test(sid))return error(res,400,'Invalid session id');
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(': connected\n\n');clients.set(sid,res);sendEvent(res,'presence',presenceSnapshot());
    req.on('close',()=>{clients.delete(sid);presence.delete(sid);broadcastPresence();});return;
  }
  if(url.pathname.startsWith('/api/'))return api(req,res,url).catch(e=>{console.error(e);if(!res.headersSent)error(res,500,'Internal server error');});
  let rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));if(rel.includes('..'))return error(res,403,'Forbidden');const file=path.join(ASSET_DIR,rel);
  fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);res.end('Not found');}else{res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream'});res.end(data);}});
});
server.listen(PORT,'0.0.0.0',()=>console.log(`GridForge listening on http://0.0.0.0:${PORT} using ${DB_PATH}`));

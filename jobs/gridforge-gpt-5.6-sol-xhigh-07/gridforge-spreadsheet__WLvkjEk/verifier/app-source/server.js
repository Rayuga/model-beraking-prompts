const express = require('express');
const Database = require('better-sqlite3');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.GRIDFORGE_DB || '/app/gridforge.sqlite';
const SEED_PATH = fs.existsSync('/assets/workbook_seed.json') ? '/assets/workbook_seed.json' : path.join(__dirname, 'assets/workbook_seed.json');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workbooks (id TEXT PRIMARY KEY, title TEXT NOT NULL, current_revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS revisions (
  workbook_id TEXT NOT NULL, number INTEGER NOT NULL, created_at TEXT NOT NULL,
  user_id TEXT, snapshot TEXT NOT NULL, PRIMARY KEY(workbook_id, number),
  FOREIGN KEY(workbook_id) REFERENCES workbooks(id), FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS revision_changes (
  workbook_id TEXT NOT NULL, revision INTEGER NOT NULL, sheet_id TEXT NOT NULL, address TEXT NOT NULL,
  PRIMARY KEY(workbook_id, revision, sheet_id, address)
);
CREATE TABLE IF NOT EXISTS cell_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, workbook_id TEXT NOT NULL, sheet_id TEXT NOT NULL,
  address TEXT NOT NULL, previous_value TEXT NOT NULL, new_value TEXT NOT NULL,
  user_id TEXT NOT NULL, changed_at TEXT NOT NULL, revision INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

function seed() {
  const data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const run = db.transaction(() => {
    const addUser = db.prepare('INSERT OR IGNORE INTO users(id,name) VALUES (?,?)');
    for (const user of data.users) addUser.run(user.id, user.name);
    const exists = db.prepare('SELECT 1 FROM workbooks WHERE id=?').get(data.workbook.id);
    if (!exists) {
      db.prepare('INSERT INTO workbooks(id,title,current_revision) VALUES (?,?,1)').run(data.workbook.id, data.workbook.title);
      db.prepare('INSERT INTO revisions(workbook_id,number,created_at,user_id,snapshot) VALUES (?,1,?,?,?)')
        .run(data.workbook.id, new Date().toISOString(), null, JSON.stringify(data.workbook));
    }
  });
  run();
}
seed();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
const addressRe = /^[A-Z]{1,3}[1-9][0-9]{0,4}$/;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function fail(res, status, message, extra = {}) { return res.status(status).json({ error: message, ...extra }); }
function readRevision(id, number) {
  const row = db.prepare('SELECT snapshot,created_at,user_id FROM revisions WHERE workbook_id=? AND number=?').get(id, number);
  return row && { workbook: JSON.parse(row.snapshot), createdAt: row.created_at, userId: row.user_id };
}
function validIdentity(payload, stored) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.id !== stored.id || payload.title !== stored.title || !Array.isArray(payload.sheets)) return false;
  if (Object.keys(payload).some(k => !['id', 'title', 'sheets'].includes(k)) || payload.sheets.length !== stored.sheets.length) return false;
  return payload.sheets.every((s, i) => {
    if (!s || typeof s !== 'object' || Array.isArray(s) || s.id !== stored.sheets[i].id || s.name !== stored.sheets[i].name) return false;
    if (Object.keys(s).some(k => !['id', 'name', 'cells'].includes(k)) || !s.cells || typeof s.cells !== 'object' || Array.isArray(s.cells)) return false;
    return Object.entries(s.cells).every(([address, value]) => addressRe.test(address) && typeof value === 'string');
  });
}

app.get('/api/users', (_req, res) => res.json(db.prepare('SELECT id,name FROM users ORDER BY rowid').all()));
app.get('/api/workbooks', (_req, res) => res.json(db.prepare('SELECT id,title,current_revision AS revision FROM workbooks ORDER BY rowid').all()));
app.get('/api/workbooks/:id', (req, res) => {
  const row = db.prepare('SELECT id,title,current_revision FROM workbooks WHERE id=?').get(req.params.id);
  if (!row) return fail(res, 404, 'Unknown workbook id');
  const rev = readRevision(row.id, row.current_revision);
  res.json({ ...rev.workbook, revision: row.current_revision, savedAt: rev.createdAt });
});
app.get('/api/workbooks/:id/revisions', (req, res) => {
  if (!db.prepare('SELECT 1 FROM workbooks WHERE id=?').get(req.params.id)) return fail(res, 404, 'Unknown workbook id');
  res.json(db.prepare(`SELECT r.number,r.created_at AS createdAt,r.user_id AS userId,u.name AS userName
    FROM revisions r LEFT JOIN users u ON u.id=r.user_id WHERE r.workbook_id=? ORDER BY r.number DESC`).all(req.params.id));
});
app.get('/api/workbooks/:id/revisions/:number', (req, res) => {
  const n = Number(req.params.number);
  if (!Number.isInteger(n) || n < 1) return fail(res, 400, 'Invalid revision');
  const rev = readRevision(req.params.id, n);
  if (!rev) return fail(res, 404, 'Revision not found');
  res.json({ ...rev.workbook, revision: n, savedAt: rev.createdAt });
});
app.get('/api/workbooks/:id/history', (req, res) => {
  const { sheetId, address } = req.query;
  if (typeof sheetId !== 'string' || typeof address !== 'string' || !addressRe.test(address)) return fail(res, 400, 'Valid sheetId and address are required');
  res.json(db.prepare(`SELECT h.previous_value AS previousValue,h.new_value AS newValue,h.changed_at AS changedAt,
    h.revision,u.id AS userId,u.name AS userName FROM cell_history h JOIN users u ON u.id=h.user_id
    WHERE h.workbook_id=? AND h.sheet_id=? AND h.address=? ORDER BY h.id DESC`).all(req.params.id, sheetId, address));
});

const saveTransaction = db.transaction((id, body) => {
  const meta = db.prepare('SELECT id,title,current_revision FROM workbooks WHERE id=?').get(id);
  if (!meta) throw Object.assign(new Error('Unknown workbook id'), { status: 404 });
  const latest = readRevision(id, meta.current_revision).workbook;
  if (!validIdentity(body.workbook, latest)) throw Object.assign(new Error('Workbook or sheet identity does not match'), { status: 400 });
  if (!Number.isInteger(body.baseRevision) || body.baseRevision < 1 || body.baseRevision > meta.current_revision || !readRevision(id, body.baseRevision)) throw Object.assign(new Error('Invalid base revision'), { status: 400 });
  if (typeof body.userId !== 'string' || !db.prepare('SELECT 1 FROM users WHERE id=?').get(body.userId)) throw Object.assign(new Error('Invalid user'), { status: 400 });
  if (!Array.isArray(body.changes) || body.changes.length > 10000) throw Object.assign(new Error('Changes must be an array'), { status: 400 });
  const sheetIds = new Set(latest.sheets.map(s => s.id));
  const seen = new Set();
  for (const c of body.changes) {
    if (!c || typeof c !== 'object' || !sheetIds.has(c.sheetId) || typeof c.address !== 'string' || !addressRe.test(c.address) || typeof c.value !== 'string' || Object.keys(c).some(k => !['sheetId','address','value'].includes(k))) throw Object.assign(new Error('Malformed or inconsistent cell change'), { status: 400 });
    const payloadSheet = body.workbook.sheets.find(s => s.id === c.sheetId);
    if (String(payloadSheet.cells[c.address] ?? '') !== c.value) throw Object.assign(new Error('Cell change does not match workbook data'), { status: 400 });
    const key = `${c.sheetId}:${c.address}`;
    if (seen.has(key)) throw Object.assign(new Error('Duplicate cell change'), { status: 400 });
    seen.add(key);
  }
  const baseWorkbook = readRevision(id, body.baseRevision).workbook;
  const declared = new Set(seen);
  const actualDiffs = new Set();
  for (const baseSheet of baseWorkbook.sheets) {
    const payloadSheet = body.workbook.sheets.find(s => s.id === baseSheet.id);
    for (const address of new Set([...Object.keys(baseSheet.cells), ...Object.keys(payloadSheet.cells)])) {
      if (String(baseSheet.cells[address] ?? '') !== String(payloadSheet.cells[address] ?? '')) actualDiffs.add(`${baseSheet.id}:${address}`);
    }
  }
  if (actualDiffs.size !== declared.size || [...actualDiffs].some(key => !declared.has(key))) throw Object.assign(new Error('Changes do not match workbook data'), { status: 400 });
  if (body.baseRevision < meta.current_revision && seen.size) {
    const changed = db.prepare(`SELECT sheet_id || ':' || address AS key,revision FROM revision_changes
      WHERE workbook_id=? AND revision>? AND revision<=?`).all(id, body.baseRevision, meta.current_revision);
    const conflict = changed.filter(c => seen.has(c.key));
    if (conflict.length) throw Object.assign(new Error('Save conflict: cells changed since your base revision'), { status: 409, conflicts: conflict.map(c => c.key) });
  }
  const next = JSON.parse(JSON.stringify(latest));
  const applied = [];
  for (const c of body.changes) {
    const sheet = next.sheets.find(s => s.id === c.sheetId);
    const previous = own(sheet.cells, c.address) ? String(sheet.cells[c.address]) : '';
    if (previous === c.value) continue;
    if (c.value === '') delete sheet.cells[c.address]; else sheet.cells[c.address] = c.value;
    applied.push({ ...c, previous });
  }
  if (!applied.length) return { revision: meta.current_revision, unchanged: true, workbook: latest };
  const revision = meta.current_revision + 1;
  const now = new Date().toISOString();
  db.prepare('INSERT INTO revisions(workbook_id,number,created_at,user_id,snapshot) VALUES (?,?,?,?,?)').run(id, revision, now, body.userId, JSON.stringify(next));
  const changeStmt = db.prepare('INSERT INTO revision_changes(workbook_id,revision,sheet_id,address) VALUES (?,?,?,?)');
  const historyStmt = db.prepare(`INSERT INTO cell_history(workbook_id,sheet_id,address,previous_value,new_value,user_id,changed_at,revision)
    VALUES (?,?,?,?,?,?,?,?)`);
  for (const c of applied) {
    changeStmt.run(id, revision, c.sheetId, c.address);
    historyStmt.run(id, c.sheetId, c.address, c.previous, c.value, body.userId, now, revision);
  }
  db.prepare('UPDATE workbooks SET current_revision=? WHERE id=?').run(revision, id);
  return { revision, unchanged: false, workbook: next, changed: applied.map(({ sheetId,address,value }) => ({ sheetId,address,value })), savedAt: now, userId: body.userId };
});

app.post('/api/workbooks/:id/save', (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).some(k => !['baseRevision','userId','workbook','changes'].includes(k))) return fail(res, 400, 'Malformed save payload');
  try {
    const result = saveTransaction(req.params.id, req.body);
    if (!result.unchanged) broadcast(req.params.id, { type: 'saved', ...result });
    res.json(result);
  } catch (e) { fail(res, e.status || 500, e.message || 'Save failed', e.conflicts ? { conflicts: e.conflicts } : {}); }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/live' });
const sessions = new Map();
function send(ws, data) { if (ws.readyState === 1) ws.send(JSON.stringify(data)); }
function broadcast(workbookId, data, except = null) { for (const [ws,s] of sessions) if (s.workbookId === workbookId && ws !== except) send(ws, data); }
function presence(workbookId) { return [...sessions.values()].filter(s => s.workbookId === workbookId).map(({ sessionId,userId,userName,color,selection }) => ({ sessionId,userId,userName,color,selection })); }
function publishPresence(workbookId) { broadcast(workbookId, { type: 'presence', sessions: presence(workbookId) }); }
const colors = ['#2563eb','#dc2626','#16a34a','#9333ea','#ea580c','#0891b2','#be123c','#4f46e5'];
let colorIndex = 0;
wss.on('connection', ws => {
  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'join') {
      const user = db.prepare('SELECT id,name FROM users WHERE id=?').get(msg.userId);
      const workbook = db.prepare('SELECT id FROM workbooks WHERE id=?').get(msg.workbookId);
      if (!user || !workbook || typeof msg.sessionId !== 'string') return send(ws, { type: 'error', message: 'Invalid collaboration session' });
      const old = sessions.get(ws);
      sessions.set(ws, { sessionId: msg.sessionId.slice(0,80), userId:user.id, userName:user.name, workbookId:workbook.id, color:colors[colorIndex++ % colors.length], selection:msg.selection || 'A1' });
      if (old && old.workbookId !== workbook.id) publishPresence(old.workbookId);
      publishPresence(workbook.id);
    } else if (msg.type === 'selection' && sessions.has(ws) && typeof msg.selection === 'string' && /^([A-Z]+[1-9]\d*)(:([A-Z]+[1-9]\d*))?$/.test(msg.selection)) {
      const s = sessions.get(ws); s.selection = msg.selection; publishPresence(s.workbookId);
    }
  });
  ws.on('close', () => { const s=sessions.get(ws); sessions.delete(ws); if(s) publishPresence(s.workbookId); });
});
server.listen(PORT, '0.0.0.0', () => console.log(`GridForge listening on 0.0.0.0:${PORT}; database ${DB_PATH}`));

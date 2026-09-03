const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { spawnSync } = require('child_process');

const ROOT = '/app';
const DB_PATH = path.join(ROOT, 'brickfall.db');
const PORT = 3000;
const SEED_XLSX = '/assets/artifacts/brickfall_seed.xlsx';
const SCENARIOS = JSON.parse(fs.readFileSync('/assets/artifacts/brickfall_scenarios.json', 'utf8'));
const PUBLIC_DIR = path.join(ROOT, 'public');

function ensurePythonDeps() {
  const check = spawnSync('python3', ['- <<PY\nimport openpyxl\nPY'], { shell: true, stdio: 'ignore' });
  return check.status === 0;
}

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function randHex(n) { return crypto.randomBytes(n).toString('hex'); }
function nowIso() { return new Date().toISOString(); }
function json(res, status, body) { res.status(status).json(body); }
function parseBody(req) { return req.body || {}; }

function initDb() {
  const first = !fs.existsSync(DB_PATH);
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, initials TEXT NOT NULL, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, highest_level INTEGER NOT NULL, best_score INTEGER NOT NULL, next_extra_life INTEGER NOT NULL DEFAULT 20000);
    CREATE TABLE IF NOT EXISTS tokens(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, issued_at TEXT NOT NULL, revoked_at TEXT, FOREIGN KEY(user_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS runs(run_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, revision INTEGER NOT NULL, state_json TEXT NOT NULL, active INTEGER NOT NULL, outcome TEXT, updated_at TEXT NOT NULL, finished_at TEXT, FOREIGN KEY(user_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS receipts(operation_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, method TEXT NOT NULL, route TEXT NOT NULL, payload_hash TEXT NOT NULL, status INTEGER NOT NULL, response_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS leaderboard(id INTEGER PRIMARY KEY AUTOINCREMENT, initials TEXT NOT NULL, score INTEGER NOT NULL, level INTEGER NOT NULL, achieved_at TEXT NOT NULL, user_id INTEGER, run_id TEXT, source TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS checkpoints(user_id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, checkpoint_json TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS run_history(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, run_id TEXT NOT NULL, outcome TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, time TEXT NOT NULL, snapshot_json TEXT NOT NULL);
  `);
  if (first) seed(db);
  return db;
}

function parseXlsxUsers() {
  const py = `import json, zipfile, xml.etree.ElementTree as ET\nfrom pathlib import Path\np=Path('${SEED_XLSX}')\nns={'a':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}\nwith zipfile.ZipFile(p) as z:\n root=ET.fromstring(z.read('xl/worksheets/sheet1.xml'))\n rows=[]\n for row in root.findall('.//a:sheetData/a:row', ns):\n  vals=[]\n  for c in row.findall('a:c', ns):\n   t=c.attrib.get('t')\n   v=c.find('a:v', ns)\n   is_el=c.find('a:is', ns)\n   if v is not None: val=v.text\n   elif is_el is not None: val=''.join(tn.text or '' for tn in is_el.iterfind('.//a:t', ns))\n   else: val=''\n   vals.append(val)\n  rows.append(vals)\n print(json.dumps(rows))`;
  const out = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  return JSON.parse(out.stdout);
}

function seed(db) {
  const rows = parseXlsxUsers();
  const insertUser = db.prepare('INSERT INTO users(id,email,name,initials,password_salt,password_hash,highest_level,best_score,next_extra_life) VALUES (?,?,?,?,?,?,?,?,?)');
  for (const r of rows.slice(1)) {
    const [, email, name, initials, password, highest, best] = r;
    const salt = randHex(16);
    insertUser.run(Number(r[0]), email, name, initials, salt, sha256(`${salt}:${password}`), Number(highest), Number(best), 20000);
  }
  const constants = parseSheet('xl/worksheets/sheet5.xml');
  db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES (?,?)').run('constants', JSON.stringify(constants));
  const levels = parseSheet('xl/worksheets/sheet2.xml');
  db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES (?,?)').run('levels', JSON.stringify(levels));
  const bricks = parseSheet('xl/worksheets/sheet3.xml');
  db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES (?,?)').run('bricks', JSON.stringify(bricks));
  const leaderboard = parseSheet('xl/worksheets/sheet4.xml').slice(1);
  const ins = db.prepare('INSERT INTO leaderboard(initials,score,level,achieved_at,user_id,run_id,source) VALUES (?,?,?,?,?,?,?)');
  leaderboard.forEach(r => ins.run(r[0], Number(r[1]), Number(r[2]), r[3], null, null, 'seed'));
  importScenarios(db);
}

function parseSheet(name) {
  const py = `import json, zipfile, xml.etree.ElementTree as ET\nfrom pathlib import Path\np=Path('${SEED_XLSX}')\nns={'a':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}\nwith zipfile.ZipFile(p) as z:\n root=ET.fromstring(z.read('${name}'))\n rows=[]\n for row in root.findall('.//a:sheetData/a:row', ns):\n  vals=[]\n  for c in row.findall('a:c', ns):\n   t=c.attrib.get('t')\n   v=c.find('a:v', ns)\n   is_el=c.find('a:is', ns)\n   if v is not None: val=v.text\n   elif is_el is not None: val=''.join(tn.text or '' for tn in is_el.iterfind('.//a:t', ns))\n   else: val=''\n   vals.append(val)\n  rows.append(vals)\n print(json.dumps(rows))`;
  return JSON.parse(spawnSync('python3', ['-c', py], { encoding: 'utf8' }).stdout);
}

function importScenarios(db) {
  const cp = SCENARIOS.checkpoints;
  const users = db.prepare('SELECT id,email FROM users').all();
  const byEmail = Object.fromEntries(users.map(u => [u.email.split('@')[0], u.id]));
  for (const key of Object.keys(cp)) {
    const userId = byEmail[key];
    const data = cp[key];
    db.prepare('INSERT OR REPLACE INTO checkpoints(user_id,revision,checkpoint_json) VALUES (?,?,?)').run(userId, data.revision, JSON.stringify(data));
    db.prepare('UPDATE users SET highest_level=?, best_score=? WHERE id=?').run(Math.max(data.level, 1), data.score, userId);
    const run = { runId: `${key}-checkpoint`, level: data.level, score: data.score, lives: data.lives, combo: data.combo, nextExtraLife: data.next_extra_life, state: 'paused', revision: data.revision };
    db.prepare('INSERT OR REPLACE INTO runs(run_id,user_id,revision,state_json,active,outcome,updated_at,finished_at) VALUES (?,?,?,?,?,?,?,?)').run(run.runId, userId, data.revision, JSON.stringify(run), 1, null, nowIso(), null);
  }
  for (const r of SCENARIOS.personal_run_fixtures) {
    const user = db.prepare('SELECT id FROM users WHERE email=?').get(`${r.user}@brickfall.test`) || db.prepare('SELECT id FROM users WHERE email LIKE ?').get(`${r.user}%`) || null;
    if (!user) continue;
    db.prepare('INSERT INTO run_history(user_id,run_id,outcome,level,score,time,snapshot_json) VALUES (?,?,?,?,?,?,?)').run(user.id, r.run_id, r.outcome, r.level, r.score, r.finished_at, JSON.stringify(r));
  }
  for (const g of SCENARIOS.guest_leaderboard) db.prepare('INSERT INTO leaderboard(initials,score,level,achieved_at,source) VALUES (?,?,?,?,?)').run(g.initials, g.score, g.level, g.achieved_at, 'guest');
}

const db = initDb();
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR));

function auth(req, res, next) {
  const h = req.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return json(res, 401, { error: 'sign-in required' });
  const row = db.prepare('SELECT t.token,u.* FROM tokens t JOIN users u ON u.id=t.user_id WHERE t.token=? AND t.revoked_at IS NULL').get(token);
  if (!row) return json(res, 401, { error: 'sign-in required' });
  req.user = row;
  req.token = token;
  next();
}

function idempotent(routeHandler) {
  return (req, res) => {
    const op = req.get('x-operation-id');
    if (!op) return json(res, 400, { error: 'missing operation id' });
    const payloadHash = sha256(JSON.stringify(req.body || {}));
    const existing = db.prepare('SELECT * FROM receipts WHERE operation_id=?').get(op);
    if (existing) {
      if (existing.payload_hash !== payloadHash) return json(res, 409, { error: 'operation id reused', status: existing.status });
      res.status(existing.status).json(JSON.parse(existing.response_json));
      return;
    }
    routeHandler(req, res, (status, body) => {
      db.prepare('INSERT INTO receipts(operation_id,user_id,method,route,payload_hash,status,response_json,created_at) VALUES (?,?,?,?,?,?,?,?)').run(op, req.user.id, req.method, req.path, payloadHash, status, JSON.stringify(body), nowIso());
      json(res, status, body);
    });
  };
}

app.post('/api/sign-in', (req,res)=>{
  const { email, password } = parseBody(req);
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user) return json(res, 401, { error: 'invalid credentials' });
  if (sha256(`${user.password_salt}:${password}`) !== user.password_hash) return json(res, 401, { error: 'invalid credentials' });
  const token = randHex(32);
  db.prepare('INSERT INTO tokens(token,user_id,issued_at,revoked_at) VALUES (?,?,?,NULL)').run(token, user.id, nowIso());
  json(res, 200, { token, player: { name: user.name, email: user.email, initials: user.initials, highest_level: user.highest_level, best_score: user.best_score } });
});
app.post('/api/sign-out', auth, (req,res)=>{ db.prepare('UPDATE tokens SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').run(nowIso(), req.user.id); json(res, 200, { ok: true }); });
app.get('/api/me', auth, (req,res)=>json(res,200,{ name:req.user.name,email:req.user.email,initials:req.user.initials,highest_level:req.user.highest_level,best_score:req.user.best_score }));
app.get('/api/leaderboard', (req,res)=>json(res,200,{ rows:db.prepare('SELECT initials,score,level,achieved_at FROM leaderboard ORDER BY score DESC, achieved_at ASC LIMIT 10').all() }));
app.get('/api/checkpoints', auth, (req,res)=>{ const row=db.prepare('SELECT * FROM checkpoints WHERE user_id=?').get(req.user.id); json(res,200,{ checkpoint: row ? JSON.parse(row.checkpoint_json) : null }); });

app.listen(PORT, ()=>console.log('Brickfall listening on', PORT));

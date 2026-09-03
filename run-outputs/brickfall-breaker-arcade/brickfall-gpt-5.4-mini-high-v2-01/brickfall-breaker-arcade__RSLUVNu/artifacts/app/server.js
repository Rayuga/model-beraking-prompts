const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const XLSX = require('xlsx');

const app = express();
const PORT = 3000;
const DB_PATH = '/app/brickfall.db';
const ASSET_XLSX = '/assets/artifacts/brickfall_seed.xlsx';
const SCENARIOS_PATH = '/assets/artifacts/brickfall_scenarios.json';
const PUBLIC_DIR = '/app/public';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR));

let db;
let seedCache = null;

function sha256hex(input) { return crypto.createHash('sha256').update(input).digest('hex'); }
function randomHex(n = 32) { return crypto.randomBytes(n / 2).toString('hex'); }
function nowIso() { return new Date().toISOString(); }
function opKey(req) { return req.get('X-Operation-Id') || req.body.operationId || req.query.operationId || null; }
function expectedRev(req) { const v = req.get('X-Expected-Revision') || req.body.expectedRevision || req.query.expectedRevision; return v == null ? null : Number(v); }
function authToken(req) { const h = req.get('Authorization') || ''; return h.startsWith('Bearer ') ? h.slice(7) : null; }
function stable(obj) { return JSON.stringify(obj, Object.keys(obj).sort()); }

function parseWorkbook() {
  const wb = XLSX.readFile(ASSET_XLSX, { cellDates: false });
  const sheetToRows = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null });
  return {
    users: sheetToRows('Users'), levels: sheetToRows('Levels'), bricks: sheetToRows('Bricks'),
    leaderboard: sheetToRows('Leaderboard'), constants: sheetToRows('Constants')
  };
}

function parseScenarios() { return JSON.parse(fs.readFileSync(SCENARIOS_PATH, 'utf8')); }

async function initDb() {
  const exists = fs.existsSync(DB_PATH);
  db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      initials TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      highest_level INTEGER NOT NULL DEFAULT 1,
      best_score INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 1,
      active_token_hash TEXT,
      current_run_json TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tokens(
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS idempotency(
      op_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      route TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      status INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS leaderboard(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      initials TEXT NOT NULL,
      score INTEGER NOT NULL,
      level INTEGER NOT NULL,
      achieved_at TEXT NOT NULL,
      email TEXT,
      run_id TEXT UNIQUE,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS personal_runs(
      run_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      outcome TEXT NOT NULL,
      level INTEGER NOT NULL,
      score INTEGER NOT NULL,
      finished_at TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS constants(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS levels(level INTEGER PRIMARY KEY, name TEXT NOT NULL, base_speed INTEGER NOT NULL, speed_cap INTEGER NOT NULL, accent TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bricks(level INTEGER NOT NULL, row INTEGER NOT NULL, column INTEGER NOT NULL, type TEXT NOT NULL, drop_value TEXT, PRIMARY KEY(level,row,column));
  `);
  if (!exists) await seedDb();
}

async function seedDb() {
  const wb = parseWorkbook(); const sc = parseScenarios();
  for (const c of wb.constants) await db.run('INSERT INTO constants(key,value) VALUES(?,?)', [c.key, String(c.value)]);
  for (const l of wb.levels) await db.run('INSERT INTO levels(level,name,base_speed,speed_cap,accent) VALUES(?,?,?,?,?)', [l.level, l.name, l.base_speed, l.speed_cap, l.accent]);
  for (const b of wb.bricks) await db.run('INSERT INTO bricks(level,row,column,type,drop_value) VALUES(?,?,?,?,?)', [b.level, b.row, b.column, b.type, b.drop]);
  for (const u of wb.users) {
    const salt = randomHex(32); const hash = sha256hex(salt + ':' + u.password);
    await db.run('INSERT INTO users(email,name,initials,password_salt,password_hash,highest_level,best_score,updated_at) VALUES(?,?,?,?,?,?,?,?)', [u.email,u.name,u.initials,salt,hash,u.highest_level,u.best_score,nowIso()]);
  }
  for (const r of wb.leaderboard) {
    await db.run('INSERT INTO leaderboard(user_id,initials,score,level,achieved_at,email,run_id) VALUES(NULL,?,?,?,?,?,?)', [r.initials,r.score,r.level,r.achieved_at,r.email,null]);
  }
  for (const [k,v] of Object.entries(sc.checkpoints || {})) await db.run('INSERT INTO constants(key,value) VALUES(?,?)', [`checkpoint:${k}`, JSON.stringify(v)]);
}

async function currentUser(req) {
  const token = authToken(req); if (!token) return null; const hash = sha256hex(token); const row = await db.get('SELECT * FROM users WHERE active_token_hash=?', [hash]); return row || null;
}

async function rememberToken(userId, token) { await db.run('UPDATE users SET active_token_hash=? WHERE id=?', [sha256hex(token), userId]); await db.run('INSERT OR REPLACE INTO tokens(token_hash,user_id,token,created_at,revoked_at) VALUES(?,?,?,?,NULL)', [sha256hex(token), userId, token, nowIso()]); }
async function revokeTokens(userId) { await db.run('UPDATE users SET active_token_hash=NULL WHERE id=?', [userId]); await db.run('UPDATE tokens SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL', [nowIso(), userId]); }

function userPublic(u){return {id:u.id,email:u.email,name:u.name,initials:u.initials,highestLevel:u.highest_level,bestScore:u.best_score,revision:u.revision,run:u.current_run_json?JSON.parse(u.current_run_json):null};}
async function leaderboard(){return db.all('SELECT initials,score,level,achieved_at,email FROM leaderboard ORDER BY score DESC, achieved_at ASC LIMIT 10');}

function hashPayload(obj){ return sha256hex(JSON.stringify(obj)); }
async function replayIfNeeded(req,res,user,route,payload){ const op=opKey(req); if(!op) return null; const row=await db.get('SELECT * FROM idempotency WHERE op_id=?', [op]); const h=hashPayload(payload); if(row){ if(row.user_id!==user.id||row.route!==route||row.payload_hash!==h) return res.status(409).json({error:'operation-id-reused'}); return res.status(row.status).json(JSON.parse(row.body)); } return {op,h}; }
async function storeReceipt(op,user,route,h,status,body){ if(!op) return; await db.run('INSERT INTO idempotency(op_id,user_id,route,payload_hash,status,body,created_at) VALUES(?,?,?,?,?,?,?)', [op,user.id,route,h,status,JSON.stringify(body),nowIso()]); }

app.post('/api/auth/signin', async (req,res)=>{
  const {email,password} = req.body||{}; const user = await db.get('SELECT * FROM users WHERE email=?',[email]); if(!user) return res.status(401).json({error:'invalid_credentials'});
  const hash=sha256hex(user.password_salt+':'+password); if(hash!==user.password_hash) return res.status(401).json({error:'invalid_credentials'});
  const token = randomHex(64); await rememberToken(user.id,token); res.json({token,user:userPublic(user),leaderboard:await leaderboard()});
});
app.post('/api/auth/signout', async (req,res)=>{ const user=await currentUser(req); if(user) await revokeTokens(user.id); res.json({ok:true}); });
app.get('/api/bootstrap', async (req,res)=>{ const user=await currentUser(req); if(!user) return res.status(401).json({error:'unauthorized'}); res.json({user:userPublic(user),leaderboard:await leaderboard(),levels:await db.all('SELECT * FROM levels ORDER BY level'),bricks:await db.all('SELECT * FROM bricks ORDER BY level,row,column'),constants:await db.all('SELECT * FROM constants ORDER BY key')}); });

app.use('/api/*', async (req,res,next)=>{ if(req.path.startsWith('/auth/')) return next(); const user=await currentUser(req); if(!user) return res.status(401).json({error:'unauthorized'}); req.user=user; next(); });

app.post('/api/run/start', async (req,res)=>{ const user=req.user; const replay=await replayIfNeeded(req,res,user,'start',req.body||{}); if(replay) return; const rev=expectedRev(req); if(rev!==null && rev!==user.revision) return res.status(409).json({error:'stale_revision',currentRevision:user.revision,savedState:user.current_run_json?JSON.parse(user.current_run_json):null}); const run={runId:crypto.randomUUID(),status:'ready',level:req.body.level||1,score:0,lives:3,combo:1,nextLifeThreshold:20000,balls:[{id:'ball-1',x:450,y:540,vx:0,vy:-320,state:'waiting',primary:true}],drops:[],power:null,revision:user.revision,simTime:0}; await db.run('UPDATE users SET current_run_json=?, updated_at=? WHERE id=?',[JSON.stringify(run),nowIso(),user.id]); const body={run,leaderboard:await leaderboard()}; const op=replay?.op; if(op) await storeReceipt(op,user,'start',replay.h,200,body); res.json(body); });

app.get('/api/state', async (req,res)=>{ const user=req.user; res.json({user:userPublic(await db.get('SELECT * FROM users WHERE id=?',[user.id])),leaderboard:await leaderboard()}); });

app.post('/api/run/save', async (req,res)=>{ const user=req.user; const replay=await replayIfNeeded(req,res,user,'save',req.body||{}); if(replay) return; const rev=expectedRev(req); if(rev!==null && rev!==user.revision) return res.status(409).json({error:'stale_revision',currentRevision:user.revision,savedState:user.current_run_json?JSON.parse(user.current_run_json):null}); await db.run('UPDATE users SET current_run_json=?, revision=revision+1, updated_at=? WHERE id=?',[JSON.stringify(req.body.run),nowIso(),user.id]); const fresh=await db.get('SELECT * FROM users WHERE id=?',[user.id]); const body={user:userPublic(fresh),leaderboard:await leaderboard()}; const op=replay?.op; if(op) await storeReceipt(op,user,'save',replay.h,200,body); res.json(body); });

app.post('/api/run/finish', async (req,res)=>{ const user=req.user; const replay=await replayIfNeeded(req,res,user,'finish',req.body||{}); if(replay) return; const rev=expectedRev(req); if(rev!==null && rev!==user.revision) return res.status(409).json({error:'stale_revision',currentRevision:user.revision,savedState:user.current_run_json?JSON.parse(user.current_run_json):null}); const {run,outcome}=req.body||{}; const snapshot=JSON.stringify(run); await db.run('BEGIN'); try { const fresh=await db.get('SELECT * FROM users WHERE id=?',[user.id]); if (run.score > fresh.best_score) await db.run('UPDATE users SET best_score=?, highest_level=MAX(highest_level,?), current_run_json=NULL, revision=revision+1, updated_at=? WHERE id=?',[run.score, run.level===10?10:Math.max(fresh.highest_level, run.level+1), nowIso(), user.id]); else await db.run('UPDATE users SET highest_level=MAX(highest_level,?), current_run_json=NULL, revision=revision+1, updated_at=? WHERE id=?',[run.level===10?10:Math.max(fresh.highest_level, run.level+1), nowIso(), user.id]); await db.run('INSERT OR REPLACE INTO personal_runs(run_id,user_id,outcome,level,score,finished_at,snapshot_json) VALUES(?,?,?,?,?,?,?)', [run.runId,user.id,outcome,run.level,run.score,nowIso(),snapshot]); await db.run('INSERT OR IGNORE INTO leaderboard(user_id,initials,score,level,achieved_at,email,run_id) VALUES(?,?,?,?,?,?,?)', [user.id,user.initials,run.score,run.level,nowIso(),user.email,run.runId]); await db.exec('COMMIT'); } catch(e){ await db.exec('ROLLBACK'); throw e; } const fresh=await db.get('SELECT * FROM users WHERE id=?',[user.id]); const body={user:userPublic(fresh),leaderboard:await leaderboard()}; const op=replay?.op; if(op) await storeReceipt(op,user,'finish',replay.h,200,body); res.json(body); });

app.get('/api/mechanics-lab', async (req,res)=>{ const user=req.user; const scenarios=seedCache||(seedCache=parseScenarios()); res.json({user:userPublic(user),drills:scenarios.drills,leaderboard:await leaderboard()}); });

app.get('*', (req,res)=>res.sendFile(path.join(PUBLIC_DIR,'index.html')));

initDb().then(()=>app.listen(PORT,()=>console.log('Brickfall listening on',PORT))).catch(err=>{ console.error(err); process.exit(1); });

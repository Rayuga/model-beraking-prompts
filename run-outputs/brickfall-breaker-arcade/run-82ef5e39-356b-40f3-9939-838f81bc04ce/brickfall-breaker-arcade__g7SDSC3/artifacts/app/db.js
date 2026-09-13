// /app/db.js - Database initialization, schema, and queries for Brickfall

const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createMiraCheckpoint, createDevCheckpoint } = require('./drills');

const DB_PATH = path.join(__dirname, 'brickfall.db');

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function computeLevelDigest(bricks) {
  const sorted = [...bricks].sort((a, b) => a.row - b.row || a.column - b.column);
  const sigs = sorted.map(b => `${b.row}:${b.column}:${b.type}:${b.drop || ''}`).join('|');
  return crypto.createHash('sha256').update(sigs, 'utf8').digest('hex').toLowerCase();
}

function initDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      initials TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      highest_level INTEGER NOT NULL DEFAULT 1,
      best_score INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS levels (
      level INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      base_speed INTEGER NOT NULL,
      speed_cap INTEGER NOT NULL,
      accent TEXT NOT NULL,
      digest TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bricks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level INTEGER NOT NULL REFERENCES levels(level),
      row INTEGER NOT NULL,
      column INTEGER NOT NULL,
      type TEXT NOT NULL,
      "drop" TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS constants (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS active_runs (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      run_id TEXT NOT NULL,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS personal_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      run_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      level INTEGER NOT NULL,
      score INTEGER NOT NULL,
      finished_at TEXT NOT NULL,
      snapshot_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      initials TEXT NOT NULL,
      score INTEGER NOT NULL,
      level INTEGER NOT NULL,
      achieved_at TEXT NOT NULL,
      run_id TEXT
    );

    CREATE TABLE IF NOT EXISTS operation_receipts (
      operation_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      request_hash TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Check if seed data exists
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  if (userCount === 0) {
    seedData(db);
  }

  return db;
}

function seedData(db) {
  const seedFile = '/assets/artifacts/brickfall_seed.xlsx';
  const scenariosFile = '/assets/artifacts/brickfall_scenarios.json';

  const wb = XLSX.readFile(seedFile);
  const scenarios = JSON.parse(fs.readFileSync(scenariosFile, 'utf8'));

  const usersSheet = XLSX.utils.sheet_to_json(wb.Sheets['Users']);
  const levelsSheet = XLSX.utils.sheet_to_json(wb.Sheets['Levels']);
  const bricksSheet = XLSX.utils.sheet_to_json(wb.Sheets['Bricks']);
  const leaderboardSheet = XLSX.utils.sheet_to_json(wb.Sheets['Leaderboard']);
  const constantsSheet = XLSX.utils.sheet_to_json(wb.Sheets['Constants']);

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, name, initials, password_hash, salt, highest_level, best_score, revision)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLevel = db.prepare(`
    INSERT INTO levels (level, name, base_speed, speed_cap, accent, digest)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertBrick = db.prepare(`
    INSERT INTO bricks (level, row, column, type, "drop")
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertConstant = db.prepare(`
    INSERT INTO constants (key, value)
    VALUES (?, ?)
  `);

  const insertLeaderboard = db.prepare(`
    INSERT INTO leaderboard (user_id, initials, score, level, achieved_at, run_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertPersonalRun = db.prepare(`
    INSERT INTO personal_runs (user_id, run_id, outcome, level, score, finished_at, snapshot_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertActiveRun = db.prepare(`
    INSERT INTO active_runs (user_id, run_id, state_json, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  const seedTransaction = db.transaction(() => {
    // 1. Constants
    for (const c of constantsSheet) {
      insertConstant.run(String(c.key), String(c.value));
    }

    // 2. Levels first, then Bricks (due to foreign key)
    for (const l of levelsSheet) {
      const lvlBricks = bricksSheet.filter(b => b.level === l.level);
      const digest = computeLevelDigest(lvlBricks);
      insertLevel.run(Number(l.level), String(l.name), Number(l.base_speed), Number(l.speed_cap), String(l.accent), digest);
    }

    for (const b of bricksSheet) {
      insertBrick.run(Number(b.level), Number(b.row), Number(b.column), String(b.type), String(b.drop || ''));
    }

    // 3. Users
    for (const u of usersSheet) {
      const salt = crypto.randomBytes(16).toString('hex');
      const pass = u.password || 'password123';
      const hash = hashPassword(pass, salt);
      // Mira and Dev have starting revision 1 from checkpoints, Polly has revision 0 (or 1)
      let rev = 0;
      if (u.email === 'mira@brickfall.test' || u.email === 'dev@brickfall.test') {
        rev = 1;
      }
      insertUser.run(
        Number(u.id),
        String(u.email),
        String(u.name),
        String(u.initials),
        hash,
        salt,
        Number(u.highest_level || 1),
        Number(u.best_score || 0),
        rev
      );
    }

    // 4. Leaderboard from workbook and guest leaderboard from scenarios
    // Scenario guest leaderboard
    for (const g of scenarios.guest_leaderboard) {
      insertLeaderboard.run(null, String(g.initials), Number(g.score), Number(g.level), String(g.achieved_at), null);
    }

    // Workbook leaderboard
    for (const lb of leaderboardSheet) {
      const user = usersSheet.find(u => u.email === lb.email);
      const userId = user ? user.id : null;
      insertLeaderboard.run(userId, String(lb.initials), Number(lb.score), Number(lb.level), String(lb.achieved_at), null);
    }

    // Polly's terminal fixtures from scenarios.personal_run_fixtures
    // Polly user id is 3
    const pollyUser = usersSheet.find(u => u.email === 'polly@brickfall.test');
    const pollyId = pollyUser ? pollyUser.id : 3;

    if (scenarios.personal_run_fixtures) {
      // Sort fixtures newest to oldest by finished_at
      const pollyFixtures = [...scenarios.personal_run_fixtures].sort((a, b) => new Date(b.finished_at) - new Date(a.finished_at));
      
      // Retain every result globally (in leaderboard) if not already present
      for (const fix of pollyFixtures) {
        insertLeaderboard.run(pollyId, 'PLY', Number(fix.score), Number(fix.level), String(fix.finished_at), String(fix.run_id));
      }

      // Keep only Polly's newest ten personal snapshots in personal_runs
      const newestTen = pollyFixtures.slice(0, 10);
      for (const fix of newestTen) {
        const snapshot = {
          run_id: fix.run_id,
          outcome: fix.outcome,
          level: fix.level,
          score: fix.score,
          finished_at: fix.finished_at,
          lives: fix.outcome === 'completed' ? 3 : 0,
          combo: 1
        };
        insertPersonalRun.run(
          pollyId,
          String(fix.run_id),
          String(fix.outcome),
          Number(fix.level),
          Number(fix.score),
          String(fix.finished_at),
          JSON.stringify(snapshot)
        );
      }
    }

    // 5. Mira and Dev Checkpoints in active_runs
    const miraUser = usersSheet.find(u => u.email === 'mira@brickfall.test');
    const devUser = usersSheet.find(u => u.email === 'dev@brickfall.test');

    if (miraUser) {
      const miraState = createMiraCheckpoint(bricksSheet);
      insertActiveRun.run(miraUser.id, miraState.run_id, JSON.stringify(miraState), new Date().toISOString());
    }

    if (devUser) {
      const devState = createDevCheckpoint(bricksSheet);
      insertActiveRun.run(devUser.id, devState.run_id, JSON.stringify(devState), new Date().toISOString());
    }
  });

  seedTransaction();
}

module.exports = {
  DB_PATH,
  initDb,
  hashPassword,
  computeLevelDigest
};

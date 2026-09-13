const Database = require('better-sqlite3');
const crypto = require('crypto');
const XLSX = require('xlsx');
const path = require('path');

const DB_PATH = path.join(__dirname, 'brickfall.db');

function initDB() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  
  // Check if already initialized
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const tableNames = tables.map(t => t.name);
  
  if (!tableNames.includes('users')) {
    initializeSchema(db);
    seedData(db);
  }
  
  return db;
}

function initializeSchema(db) {
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      initials TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      highest_level INTEGER DEFAULT 1,
      best_score INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE tokens (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      token TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE levels (
      id INTEGER PRIMARY KEY,
      level_number INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      base_speed INTEGER NOT NULL,
      speed_cap INTEGER NOT NULL,
      accent TEXT NOT NULL
    );

    CREATE TABLE bricks (
      id INTEGER PRIMARY KEY,
      level_number INTEGER NOT NULL,
      row_idx INTEGER NOT NULL,
      col_idx INTEGER NOT NULL,
      type TEXT NOT NULL,
      drop_type TEXT,
      FOREIGN KEY (level_number) REFERENCES levels(level_number),
      UNIQUE(level_number, row_idx, col_idx)
    );

    CREATE TABLE leaderboard (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      initials TEXT NOT NULL,
      score INTEGER NOT NULL,
      level INTEGER NOT NULL,
      achieved_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE run_records (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      run_id TEXT UNIQUE NOT NULL,
      revision INTEGER NOT NULL,
      outcome TEXT,
      level INTEGER NOT NULL,
      score INTEGER NOT NULL,
      finished_at TEXT,
      snapshot TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE active_runs (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      run_id TEXT UNIQUE NOT NULL,
      revision INTEGER NOT NULL,
      level INTEGER NOT NULL,
      score INTEGER NOT NULL,
      lives INTEGER NOT NULL,
      combo INTEGER NOT NULL,
      next_extra_life INTEGER NOT NULL,
      power_up TEXT,
      power_seconds REAL,
      paddle_width INTEGER NOT NULL,
      balls TEXT NOT NULL,
      drops TEXT NOT NULL,
      bricks TEXT NOT NULL,
      accumulated_time REAL NOT NULL,
      unlocked_levels TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE constants (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE operation_receipts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      operation_id TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, operation_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE checkpoints (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      run_id TEXT UNIQUE NOT NULL,
      revision INTEGER NOT NULL,
      level INTEGER NOT NULL,
      score INTEGER NOT NULL,
      lives INTEGER NOT NULL,
      combo INTEGER NOT NULL,
      next_extra_life INTEGER NOT NULL,
      power_up TEXT,
      power_seconds REAL,
      paddle_width INTEGER NOT NULL,
      balls TEXT NOT NULL,
      drops TEXT,
      bricks TEXT,
      accumulated_time REAL NOT NULL,
      next_outcome TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

function seedData(db) {
  const wb = XLSX.readFile('/assets/artifacts/brickfall_seed.xlsx');
  
  // Seed users
  const usersWs = wb.Sheets['Users'];
  const users = XLSX.utils.sheet_to_json(usersWs);
  
  for (const user of users) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(user.password, salt, 100000, 64, 'sha256').toString('hex');
    
    db.prepare(`
      INSERT INTO users (email, name, initials, password_hash, password_salt, highest_level, best_score)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(user.email, user.name, user.initials, hash, salt, user.highest_level, user.best_score);
  }
  
  // Seed levels
  const levelsWs = wb.Sheets['Levels'];
  const levels = XLSX.utils.sheet_to_json(levelsWs);
  
  for (const level of levels) {
    db.prepare(`
      INSERT INTO levels (level_number, name, base_speed, speed_cap, accent)
      VALUES (?, ?, ?, ?, ?)
    `).run(level.level, level.name, level.base_speed, level.speed_cap, level.accent);
  }
  
  // Seed bricks
  const bricksWs = wb.Sheets['Bricks'];
  const bricks = XLSX.utils.sheet_to_json(bricksWs);
  
  for (const brick of bricks) {
    const dropType = brick.drop && brick.drop.trim() ? brick.drop : null;
    db.prepare(`
      INSERT INTO bricks (level_number, row_idx, col_idx, type, drop_type)
      VALUES (?, ?, ?, ?, ?)
    `).run(brick.level, brick.row, brick.column, brick.type, dropType);
  }
  
  // Seed leaderboard
  const leaderboardWs = wb.Sheets['Leaderboard'];
  const leaderboard = XLSX.utils.sheet_to_json(leaderboardWs);
  
  for (const entry of leaderboard) {
    let userId = null;
    if (entry.email && entry.email.trim()) {
      const user = db.prepare('SELECT id FROM users WHERE email = ?').get(entry.email);
      if (user) userId = user.id;
    }
    
    db.prepare(`
      INSERT INTO leaderboard (user_id, initials, score, level, achieved_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, entry.initials, entry.score, entry.level, entry.achieved_at);
  }
  
  // Seed constants
  const constantsWs = wb.Sheets['Constants'];
  const constants = XLSX.utils.sheet_to_json(constantsWs);
  
  for (const constant of constants) {
    db.prepare(`
      INSERT INTO constants (key, value)
      VALUES (?, ?)
    `).run(constant.key, constant.value);
  }
  
  // Import scenarios
  const scenarios = require('/assets/artifacts/brickfall_scenarios.json');
  
  // Add guest leaderboard entries
  for (const entry of scenarios.guest_leaderboard) {
    db.prepare(`
      INSERT INTO leaderboard (user_id, initials, score, level, achieved_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(null, entry.initials, entry.score, entry.level, entry.achieved_at);
  }
  
  // Add personal run fixtures
  for (const fixture of scenarios.personal_run_fixtures) {
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(fixture.user + '@brickfall.test');
    if (!user) continue;
    
    db.prepare(`
      INSERT INTO run_records (user_id, run_id, revision, outcome, level, score, finished_at, snapshot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(user.id, fixture.run_id, 1, fixture.outcome, fixture.level, fixture.score, fixture.finished_at, null);
  }
  
  // Store checkpoints for Mira and Dev
  const miraUser = db.prepare('SELECT id FROM users WHERE email = ?').get('mira@brickfall.test');
  const devUser = db.prepare('SELECT id FROM users WHERE email = ?').get('dev@brickfall.test');
  
  if (miraUser && scenarios.checkpoints.mira) {
    const cp = scenarios.checkpoints.mira;
    const runId = `mira-checkpoint-${cp.revision}`;
    
    db.prepare(`
      INSERT INTO checkpoints (user_id, run_id, revision, level, score, lives, combo, next_extra_life, 
        power_up, power_seconds, paddle_width, balls, drops, bricks, accumulated_time, next_outcome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      miraUser.id, runId, cp.revision, cp.level, cp.score, cp.lives, cp.combo, cp.next_extra_life,
      cp.power, cp.power_seconds, cp.paddle_width, cp.balls, cp.drop, cp.bricks, 0, cp.next_outcome
    );
  }
  
  if (devUser && scenarios.checkpoints.dev) {
    const cp = scenarios.checkpoints.dev;
    const runId = `dev-checkpoint-${cp.revision}`;
    
    db.prepare(`
      INSERT INTO checkpoints (user_id, run_id, revision, level, score, lives, combo, next_extra_life,
        power_up, power_seconds, paddle_width, balls, drops, bricks, accumulated_time, next_outcome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      devUser.id, runId, cp.revision, cp.level, cp.score, cp.lives, cp.combo, cp.next_extra_life,
      null, null, 118, cp.balls, null, null, 0, cp.next_outcome
    );
  }
}

function getDB() {
  return new Database(DB_PATH);
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function authenticateUser(db, email, password) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return null;
  
  const hash = hashPassword(password, user.password_salt);
  if (hash !== user.password_hash) return null;
  
  // Revoke existing tokens
  db.prepare('DELETE FROM tokens WHERE user_id = ?').run(user.id);
  
  // Create new token
  const token = generateToken();
  db.prepare('INSERT INTO tokens (user_id, token) VALUES (?, ?)').run(user.id, token);
  
  return { user, token };
}

function getUserFromToken(db, token) {
  if (!token) return null;
  const record = db.prepare('SELECT u.* FROM users u JOIN tokens t ON u.id = t.user_id WHERE t.token = ?').get(token);
  return record || null;
}

function revokeToken(db, token) {
  db.prepare('DELETE FROM tokens WHERE token = ?').run(token);
}

module.exports = {
  initDB,
  getDB,
  hashPassword,
  generateToken,
  authenticateUser,
  getUserFromToken,
  revokeToken
};

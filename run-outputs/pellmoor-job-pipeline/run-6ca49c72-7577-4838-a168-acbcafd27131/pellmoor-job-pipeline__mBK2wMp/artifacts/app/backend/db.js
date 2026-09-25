const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../pellmoor.db');
const SEED_FILE = path.join(__dirname, '../../recruitment/records/pellmoor_seed_data.json');

let dbInstance = null;

function getDb(customPath = null) {
  const targetPath = customPath || DB_PATH;
  if (!dbInstance || (customPath && dbInstance.name !== targetPath)) {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    dbInstance = new Database(targetPath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_email) REFERENCES people(email) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vacancies (
      code TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      team TEXT NOT NULL,
      openings INTEGER NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      vacancy_code TEXT NOT NULL,
      name TEXT NOT NULL,
      stage TEXT NOT NULL,
      days_since_applied INTEGER NOT NULL DEFAULT 0,
      assessment_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (vacancy_code) REFERENCES vacancies(code) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS candidate_stage_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      sequence_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS panel_assignments (
      candidate_id TEXT NOT NULL,
      member_email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (candidate_id, member_email),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
      FOREIGN KEY (member_email) REFERENCES people(email) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id TEXT NOT NULL,
      assessment_version INTEGER NOT NULL,
      scorer_email TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(candidate_id, assessment_version, scorer_email),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
      FOREIGN KEY (scorer_email) REFERENCES people(email) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id TEXT NOT NULL,
      author_email TEXT NOT NULL,
      author_name TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
      FOREIGN KEY (author_email) REFERENCES people(email) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vacancy_code TEXT NOT NULL,
      candidate_id TEXT,
      actor_email TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      action_type TEXT NOT NULL,
      description TEXT NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vacancy_code) REFERENCES vacancies(code) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS operation_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      operation_key TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_email, operation_key),
      FOREIGN KEY (user_email) REFERENCES people(email) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_candidates_vacancy ON candidates(vacancy_code);
    CREATE INDEX IF NOT EXISTS idx_history_candidate ON candidate_stage_history(candidate_id, sequence_order);
    CREATE INDEX IF NOT EXISTS idx_scores_candidate ON scores(candidate_id, assessment_version);
    CREATE INDEX IF NOT EXISTS idx_notes_candidate ON notes(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_activity_vacancy ON activity_log(vacancy_code, id);
    CREATE INDEX IF NOT EXISTS idx_activity_candidate ON activity_log(candidate_id, id);
  `);

  // Check if seed data needs to be populated
  const peopleCount = db.prepare('SELECT COUNT(*) as count FROM people').get().count;
  if (peopleCount === 0 && fs.existsSync(SEED_FILE)) {
    seedDatabase(db);
  }
}

function seedDatabase(db, seedPath = SEED_FILE) {
  const seedRaw = fs.readFileSync(seedPath, 'utf8');
  const seed = JSON.parse(seedRaw);
  const now = seed.clock || new Date().toISOString();

  const insertPeople = db.prepare('INSERT OR REPLACE INTO people (email, name, role, password) VALUES (?, ?, ?, ?)');
  const insertVacancy = db.prepare('INSERT OR REPLACE INTO vacancies (code, title, team, openings, revision) VALUES (?, ?, ?, ?, 1)');
  const insertCandidate = db.prepare('INSERT OR REPLACE INTO candidates (id, vacancy_code, name, stage, days_since_applied, assessment_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)');
  const insertHistory = db.prepare('INSERT INTO candidate_stage_history (candidate_id, stage, sequence_order, created_at) VALUES (?, ?, ?, ?)');
  const insertPanel = db.prepare('INSERT OR IGNORE INTO panel_assignments (candidate_id, member_email, created_at) VALUES (?, ?, ?)');
  const insertScore = db.prepare('INSERT OR REPLACE INTO scores (candidate_id, assessment_version, scorer_email, score, created_at, updated_at) VALUES (?, 1, ?, ?, ?, ?)');
  const insertActivity = db.prepare('INSERT INTO activity_log (vacancy_code, candidate_id, actor_email, actor_name, action_type, description, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

  const tx = db.transaction(() => {
    // 1. People
    for (const p of seed.people) {
      insertPeople.run(p.email, p.name, p.role, seed.seed_password || 'password123');
    }

    // 2. Roles / Vacancies
    for (const r of seed.roles) {
      insertVacancy.run(r.code, r.title, r.team, r.openings);
    }

    // 3. Candidates and history
    if (seed.candidates) {
      for (const c of seed.candidates) {
        insertCandidate.run(c.id, c.role, c.name, c.stage, c.days_since_applied || 0, now, now);
        if (c.history && Array.isArray(c.history)) {
          c.history.forEach((stage, idx) => {
            insertHistory.run(c.id, stage, idx + 1, now);
          });
        } else {
          insertHistory.run(c.id, c.stage, 1, now);
        }
      }
    }

    // 4. Panel assignments
    if (seed.panels) {
      for (const p of seed.panels) {
        for (const member of p.members) {
          insertPanel.run(p.candidate, member, now);
        }
      }
    }

    // 5. Scores (version 1)
    if (seed.scores) {
      for (const s of seed.scores) {
        insertScore.run(s.candidate, s.panel_member, s.score, now, now);
      }
    }
  });

  tx();
}

function canonicalStringify(val) {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(val).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(val[k])).join(',') + '}';
}

function computePayloadHash(method, pathUrl, body) {
  const normMethod = (method || '').toUpperCase();
  const normPath = (pathUrl || '').split('?')[0];
  const normBody = canonicalStringify(body || {});
  return crypto.createHash('sha256').update(`${normMethod}|${normPath}|${normBody}`).digest('hex');
}

module.exports = {
  getDb,
  initSchema,
  seedDatabase,
  canonicalStringify,
  computePayloadHash,
  DB_PATH
};

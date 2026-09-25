import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DB_PATH || '/app/pellmoor.db';

// Use verbose mode for debugging
sqlite3.verbose();

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database at', dbPath);
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Wrap db methods to use callbacks properly
const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

const dbExec = (sql) =>
  new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

export async function initializeDatabase() {
  try {
    // Check if database already has tables
    const tables = await dbAll(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );

    if (tables.length > 0) {
      console.log('Database already initialized');
      return;
    }

    console.log('Initializing database...');

    // Create tables
    await dbExec(`
      CREATE TABLE users (
        email TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT NOT NULL
      );

      CREATE TABLE sessions (
        token TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY(email) REFERENCES users(email)
      );

      CREATE TABLE roles (
        code TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        team TEXT NOT NULL,
        openings INTEGER NOT NULL
      );

      CREATE TABLE candidates (
        id TEXT PRIMARY KEY,
        role_code TEXT NOT NULL,
        name TEXT NOT NULL,
        current_stage TEXT NOT NULL,
        assessment_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(role_code) REFERENCES roles(code)
      );

      CREATE TABLE stage_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        candidate_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY(candidate_id) REFERENCES candidates(id)
      );

      CREATE TABLE panels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        candidate_id TEXT NOT NULL,
        assessment_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(candidate_id) REFERENCES candidates(id)
      );

      CREATE TABLE panel_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        panel_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        added_at TEXT NOT NULL,
        FOREIGN KEY(panel_id) REFERENCES panels(id),
        FOREIGN KEY(email) REFERENCES users(email)
      );

      CREATE TABLE scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        candidate_id TEXT NOT NULL,
        assessment_version INTEGER NOT NULL,
        panel_member_email TEXT NOT NULL,
        score INTEGER NOT NULL,
        recorded_at TEXT NOT NULL,
        FOREIGN KEY(candidate_id) REFERENCES candidates(id),
        FOREIGN KEY(panel_member_email) REFERENCES users(email),
        UNIQUE(candidate_id, assessment_version, panel_member_email)
      );

      CREATE TABLE notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        candidate_id TEXT NOT NULL,
        author_email TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(candidate_id) REFERENCES candidates(id),
        FOREIGN KEY(author_email) REFERENCES users(email)
      );

      CREATE TABLE vacancy_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_code TEXT NOT NULL,
        revision_number INTEGER NOT NULL,
        changed_by TEXT,
        change_reason TEXT NOT NULL,
        changed_at TEXT NOT NULL,
        FOREIGN KEY(role_code) REFERENCES roles(code),
        FOREIGN KEY(changed_by) REFERENCES users(email),
        UNIQUE(role_code, revision_number)
      );

      CREATE TABLE activity_trail (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_code TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        actor_email TEXT NOT NULL,
        action_data TEXT,
        batch_id TEXT,
        batch_position INTEGER,
        batch_total INTEGER,
        assessment_version_at_action INTEGER,
        assessment_version_changed BOOLEAN DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY(role_code) REFERENCES roles(code),
        FOREIGN KEY(candidate_id) REFERENCES candidates(id),
        FOREIGN KEY(actor_email) REFERENCES users(email)
      );

      CREATE TABLE operation_receipts (
        operation_id TEXT NOT NULL,
        actor_email TEXT NOT NULL,
        role_code TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        status TEXT NOT NULL,
        request_data TEXT NOT NULL,
        response_data TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY(operation_id, actor_email),
        FOREIGN KEY(actor_email) REFERENCES users(email),
        FOREIGN KEY(role_code) REFERENCES roles(code)
      );

      CREATE INDEX idx_candidates_role ON candidates(role_code);
      CREATE INDEX idx_stage_history_candidate ON stage_history(candidate_id);
      CREATE INDEX idx_panels_candidate ON panels(candidate_id);
      CREATE INDEX idx_scores_candidate ON scores(candidate_id);
      CREATE INDEX idx_notes_candidate ON notes(candidate_id);
      CREATE INDEX idx_activity_vacancy ON activity_trail(role_code);
      CREATE INDEX idx_sessions_email ON sessions(email);
    `);

    console.log('Tables created successfully');

    // Load seed data
    await loadSeedData();
  } catch (err) {
    console.error('Database initialization error:', err);
    throw err;
  }
}

async function loadSeedData() {
  const seedPath = '/recruitment/records/pellmoor_seed_data.json';

  if (!fs.existsSync(seedPath)) {
    console.log('Seed data file not found at', seedPath);
    return;
  }

  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  const now = new Date().toISOString();

  try {
    // Hash seed password
    const crypto = await import('crypto');
    const passwordHash = crypto
      .createHash('sha256')
      .update(seedData.seed_password)
      .digest('hex');

    // Load users
    for (const person of seedData.people) {
      await dbRun(
        `INSERT OR IGNORE INTO users (email, name, role, password_hash)
         VALUES (?, ?, ?, ?)`,
        [person.email, person.name, person.role, passwordHash]
      );
    }

    // Load roles (vacancies)
    for (const role of seedData.roles) {
      await dbRun(
        `INSERT OR IGNORE INTO roles (code, title, team, openings)
         VALUES (?, ?, ?, ?)`,
        [role.code, role.title, role.team, role.openings]
      );
    }

    // Load candidates
    for (const candidate of seedData.candidates) {
      const appliedDate = new Date(seedData.clock);
      appliedDate.setDate(
        appliedDate.getDate() - candidate.days_since_applied
      );

      await dbRun(
        `INSERT OR IGNORE INTO candidates (id, role_code, name, current_stage, assessment_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          candidate.id,
          candidate.role,
          candidate.name,
          candidate.stage,
          1,
          appliedDate.toISOString(),
          now,
        ]
      );

      // Load stage history
      for (const stage of candidate.history) {
        // Use a simple timestamp progression for history
        const stageIndex = candidate.history.indexOf(stage);
        const stageDate = new Date(appliedDate);
        stageDate.setDate(stageDate.getDate() + stageIndex);

        await dbRun(
          `INSERT INTO stage_history (candidate_id, stage, timestamp)
           VALUES (?, ?, ?)`,
          [candidate.id, stage, stageDate.toISOString()]
        );
      }
    }

    // Load panels
    const panelMap = new Map();
    for (const panel of seedData.panels) {
      const panelResult = await dbRun(
        `INSERT INTO panels (candidate_id, assessment_version, created_at)
         VALUES (?, ?, ?)`,
        [panel.candidate, 1, now]
      );
      panelMap.set(panel.candidate, panelResult.id);

      for (const member of panel.members) {
        await dbRun(
          `INSERT INTO panel_members (panel_id, email, added_at)
           VALUES (?, ?, ?)`,
          [panelResult.id, member, now]
        );
      }
    }

    // Load scores
    for (const score of seedData.scores) {
      await dbRun(
        `INSERT INTO scores (candidate_id, assessment_version, panel_member_email, score, recorded_at)
         VALUES (?, ?, ?, ?, ?)`,
        [score.candidate, 1, score.panel_member, score.score, now]
      );
    }

    // Initialize vacancy revisions to 1 for each role
    for (const role of seedData.roles) {
      await dbRun(
        `INSERT OR IGNORE INTO vacancy_revisions (role_code, revision_number, changed_by, change_reason, changed_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          role.code,
          1,
          null,
          'Database initialization',
          now,
        ]
      );
    }

    console.log('Seed data loaded successfully');
  } catch (err) {
    console.error('Error loading seed data:', err);
    throw err;
  }
}

export { db, dbRun, dbGet, dbAll, dbExec };

'use strict';
// HireOps data layer. Opens SQLite, creates the schema and seeds it once. A database
// that already holds users is never reseeded, so work survives a restart. The seed
// file is read from beside this module, never from the working directory.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'app.db');
const SEED = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed_data.json'), 'utf8'));

const reference = {
  stages: SEED.stages,
  candidateLabels: SEED.candidate_status_labels,
  pageSize: SEED.thread_page_size,
};

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL, role TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, team TEXT NOT NULL,
    recruiter_id TEXT NOT NULL REFERENCES users(id), manager_id TEXT NOT NULL REFERENCES users(id),
    interview_limit INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id),
    candidate_name TEXT NOT NULL, candidate_email TEXT NOT NULL, candidate_user_id TEXT REFERENCES users(id),
    source TEXT NOT NULL, stage TEXT NOT NULL, position INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1,
    rejected_from TEXT, reject_reason TEXT, created_at TEXT NOT NULL,
    UNIQUE(job_id, candidate_email));
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, application_id TEXT NOT NULL REFERENCES applications(id),
    sender_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS messages_thread ON messages(application_id, id);
  CREATE TABLE IF NOT EXISTS reads (
    user_id TEXT NOT NULL REFERENCES users(id), application_id TEXT NOT NULL REFERENCES applications(id),
    last_read_id INTEGER NOT NULL, PRIMARY KEY (user_id, application_id));
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, application_id TEXT NOT NULL REFERENCES applications(id),
    author_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL REFERENCES jobs(id),
    application_id TEXT, actor_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL,
    detail TEXT NOT NULL, action_id INTEGER, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL,
    summary TEXT NOT NULL, before_json TEXT NOT NULL, undone INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
  `);
  seedIfEmpty(db);
  return db;
}

function seedIfEmpty(db) {
  if (db.prepare('SELECT COUNT(*) AS c FROM users').get().c > 0) return;
  const pw = 'Hireops!2026'; // Public demo credential given in the brief.
  const run = (sql, ...a) => db.prepare(sql).run(...a);
  db.transaction(() => {
    for (const u of SEED.users) run('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)', u.id, u.name, u.email, pw, u.role);
    for (const j of SEED.jobs) run('INSERT INTO jobs (id,title,team,recruiter_id,manager_id,interview_limit) VALUES (?,?,?,?,?,?)',
      j.id, j.title, j.team, j.recruiter_id, j.manager_id, j.interview_limit);
    const byEmail = Object.fromEntries(SEED.users.map((u) => [u.email, u]));
    for (const a of SEED.applications) {
      const account = byEmail[a.candidate_email];
      run(`INSERT INTO applications (id,job_id,candidate_name,candidate_email,candidate_user_id,source,stage,position,rejected_from,reject_reason,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`, a.id, a.job_id, a.candidate_name, a.candidate_email,
        account && account.role === 'candidate' ? account.id : null, a.source, a.stage, a.position,
        a.rejected_from || null, a.reject_reason || null, '2026-06-15T09:00:00Z');
    }
    const ids = {};
    for (const m of SEED.messages) {
      const r = run('INSERT INTO messages (application_id,sender_id,body,created_at) VALUES (?,?,?,?)', m.application_id, m.sender_id, m.body, m.created_at);
      (ids[m.application_id] = ids[m.application_id] || []).push(Number(r.lastInsertRowid));
    }
    for (const r of SEED.reads) run('INSERT INTO reads (user_id,application_id,last_read_id) VALUES (?,?,?)',
      r.user_id, r.application_id, ids[r.application_id][r.read_count - 1]);
    for (const n of SEED.notes) run('INSERT INTO notes (application_id,author_id,body,created_at) VALUES (?,?,?,?)', n.application_id, n.author_id, n.body, n.created_at);
  })();
}

module.exports = { open, reference };

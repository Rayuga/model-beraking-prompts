import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'gridforge.db');
const SEED_PATH = process.env.SEED_PATH || '/assets/workbook_seed.json';

fs.mkdirSync(DATA_DIR, { recursive: true });

if (process.env.RESET_SEED === '1' && fs.existsSync(DB_PATH)) {
  fs.rmSync(DB_PATH, { force: true });
}

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS workbooks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    current_revision INTEGER NOT NULL,
    content TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS revisions (
    workbook_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (workbook_id, revision)
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cell_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workbook_id TEXT NOT NULL,
    sheet_id TEXT NOT NULL,
    cell_addr TEXT NOT NULL,
    revision INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    old_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

function defaultSeed() {
  return {
    workbook: {
      id: 'ops-plan',
      title: 'Northwind Operations Plan',
      sheets: [{ id: 'plan', name: 'Plan', cells: {} }]
    }
  };
}

function readSeed() {
  try {
    return JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  } catch {
    return defaultSeed();
  }
}

export function seedIfNeeded() {
  seedUsers();
  const count = db.prepare('SELECT COUNT(*) AS count FROM workbooks').get().count;
  if (count > 0) return;
  const seed = readSeed().workbook;
  const now = new Date().toISOString();
  const content = JSON.stringify(seed);
  db.prepare(`
    INSERT INTO workbooks (id, title, current_revision, content, updated_at)
    VALUES (?, ?, 1, ?, ?)
  `).run(seed.id, seed.title, content, now);
  db.prepare(`
    INSERT INTO revisions (workbook_id, revision, content, created_at)
    VALUES (?, 1, ?, ?)
  `).run(seed.id, content, now);
}

seedIfNeeded();

function seedUsers() {
  const seedUsers = readSeed().users || [
    { id: 'riley', name: 'Riley Stone' },
    { id: 'morgan', name: 'Morgan Lee' },
    { id: 'priya', name: 'Priya Shah' }
  ];
  const insert = db.prepare('INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)');
  for (const user of seedUsers) insert.run(user.id, user.name);
}

export { DB_PATH };

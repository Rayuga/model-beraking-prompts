import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'patchpad.db'));
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    current_revision INTEGER NOT NULL,
    content TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS revisions (
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    content TEXT NOT NULL,
    saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (document_id, revision)
  );
`);

function seedPath() {
  const candidates = [
    process.env.SEED_PATH,
    '/assets/incident_seed.json',
    path.resolve(__dirname, '../../../environment/assets/incident_seed.json')
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('incident_seed.json not found');
}

function buildSeedContent(seed) {
  const doc = seed.document;
  const lines = [...doc.sections];
  const width = Number(doc.generatedLineNumberWidth || 0);
  for (let i = 1; i <= Number(doc.generatedLineCount || 0); i += 1) {
    lines.push(String(doc.generatedLineTemplate).replaceAll('{n}', String(i).padStart(width, '0')));
  }
  lines.push(...(doc.tailSections || []));
  return lines.join('\n');
}

export function ensureSeed() {
  const raw = JSON.parse(fs.readFileSync(seedPath(), 'utf8'));
  const doc = raw.document;
  if (process.env.RESET_SEED === '1') {
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM revisions WHERE document_id = ?').run(doc.id);
      db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  const existing = db.prepare('SELECT id FROM documents WHERE id = ?').get(doc.id);
  if (existing) return;

  const content = buildSeedContent(raw);
  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO documents (id, title, author, current_revision, content)
      VALUES (?, ?, ?, 1, ?)
    `).run(doc.id, doc.title, doc.author, content);
    db.prepare(`
      INSERT INTO revisions (document_id, revision, content)
      VALUES (?, 1, ?)
    `).run(doc.id, content);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

ensureSeed();

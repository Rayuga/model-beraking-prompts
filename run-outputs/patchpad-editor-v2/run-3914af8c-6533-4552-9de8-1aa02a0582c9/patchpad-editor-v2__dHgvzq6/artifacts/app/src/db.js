const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'patchpad.db');

let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initDb(db);
  }
  return db;
}

function initDb(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      summary TEXT,
      current_revision INTEGER NOT NULL DEFAULT 1,
      current_content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents (id),
      UNIQUE(document_id, revision)
    );
  `);

  // Check if seeded report exists
  const existingDoc = database.prepare('SELECT id FROM documents WHERE id = ?').get('incident-alpha');
  if (!existingDoc) {
    seedDatabase(database);
  }
}

function seedDatabase(database) {
  let seedPath = '/assets/incident_seed.json';
  if (!fs.existsSync(seedPath)) {
    seedPath = path.join(__dirname, '..', 'assets', 'incident_seed.json');
  }
  if (!fs.existsSync(seedPath)) {
    console.error('Seed file not found at', seedPath);
    return;
  }

  const seedRaw = fs.readFileSync(seedPath, 'utf8');
  const seed = JSON.parse(seedRaw);
  const doc = seed.document;

  const lines = [...doc.sections];
  for (let i = 1; i <= doc.generatedLineCount; i++) {
    const nStr = String(i).padStart(doc.generatedLineNumberWidth, '0');
    const line = doc.generatedLineTemplate.replace(/\{n\}/g, nStr);
    lines.push(line);
  }
  lines.push(...doc.tailSections);
  const fullContent = lines.join('\n');

  const now = new Date().toISOString();

  const insertDoc = database.prepare(`
    INSERT INTO documents (id, title, author, summary, current_revision, current_content, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?)
  `);

  const insertRev = database.prepare(`
    INSERT INTO revisions (document_id, revision, content, created_at)
    VALUES (?, 1, ?, ?)
  `);

  const transaction = database.transaction(() => {
    insertDoc.run(doc.id, doc.title, doc.author, doc.summary || '', fullContent, now, now);
    insertRev.run(doc.id, fullContent, now);
  });

  transaction();
  console.log(`Seeded document "${doc.id}" at revision 1.`);
}

module.exports = {
  getDb,
  DB_PATH
};

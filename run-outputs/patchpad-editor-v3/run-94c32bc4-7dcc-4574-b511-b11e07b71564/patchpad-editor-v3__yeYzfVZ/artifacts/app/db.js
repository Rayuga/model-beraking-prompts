const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'patchpad.db');

let dbInstance = null;

function getDb(dbPath = DB_PATH) {
  if (!dbInstance) {
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    initSchema(dbInstance);
  }
  return dbInstance;
}

function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      summary TEXT,
      current_revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      revision_number INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      comment TEXT,
      UNIQUE(document_id, revision_number),
      FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
  `);

  // Seed default report if table is empty or seed doc does not exist
  const checkDoc = db.prepare('SELECT id FROM documents WHERE id = ?').get('incident-alpha');
  if (!checkDoc) {
    seedDatabase(db);
  }
}

function seedDatabase(db) {
  let seedData = null;
  const seedPaths = [
    '/assets/incident_seed.json',
    path.join(__dirname, '..', 'assets', 'incident_seed.json'),
    path.join(__dirname, 'assets', 'incident_seed.json')
  ];

  for (const p of seedPaths) {
    if (fs.existsSync(p)) {
      try {
        seedData = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      } catch (e) {
        console.error('Error reading seed file at', p, e);
      }
    }
  }

  if (!seedData || !seedData.document) {
    console.error('Seed file not found or invalid format');
    return;
  }

  const doc = seedData.document;
  const lines = [...(doc.sections || [])];
  const genCount = doc.generatedLineCount || 0;
  const width = doc.generatedLineNumberWidth || 4;
  const template = doc.generatedLineTemplate || 'Log line {n}';

  for (let i = 1; i <= genCount; i++) {
    const n = String(i).padStart(width, '0');
    lines.push(template.replace(/\{n\}/g, n));
  }

  if (doc.tailSections && Array.isArray(doc.tailSections)) {
    lines.push(...doc.tailSections);
  }

  const fullContent = lines.join('\n');
  const now = new Date().toISOString();

  const insertDoc = db.prepare(`
    INSERT INTO documents (id, title, author, summary, current_revision, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `);

  const insertRev = db.prepare(`
    INSERT INTO revisions (document_id, revision_number, content, created_at, comment)
    VALUES (?, 1, ?, ?, 'Initial seeded report')
  `);

  const tx = db.transaction(() => {
    insertDoc.run(doc.id, doc.title, doc.author, doc.summary || '', now, now);
    insertRev.run(doc.id, fullContent, now);
  });

  tx();
  console.log(`Seeded document "${doc.title}" (${doc.id}) at revision 1 with ${lines.length} lines.`);
}

function listDocuments(db = getDb()) {
  const stmt = db.prepare(`
    SELECT id, title, author, summary, current_revision, created_at, updated_at
    FROM documents
    ORDER BY updated_at DESC
  `);
  return stmt.all();
}

function getDocument(id, db = getDb()) {
  const docStmt = db.prepare(`
    SELECT id, title, author, summary, current_revision, created_at, updated_at
    FROM documents
    WHERE id = ?
  `);
  const doc = docStmt.get(id);
  if (!doc) return null;

  const revStmt = db.prepare(`
    SELECT revision_number, content, created_at, comment
    FROM revisions
    WHERE document_id = ? AND revision_number = ?
  `);
  const rev = revStmt.get(id, doc.current_revision);

  return {
    ...doc,
    content: rev ? rev.content : ''
  };
}

function getRevisions(id, db = getDb()) {
  const stmt = db.prepare(`
    SELECT revision_number, created_at, comment, length(content) as char_count
    FROM revisions
    WHERE document_id = ?
    ORDER BY revision_number DESC
  `);
  return stmt.all(id);
}

function getRevisionContent(id, revisionNumber, db = getDb()) {
  const stmt = db.prepare(`
    SELECT revision_number, content, created_at, comment
    FROM revisions
    WHERE document_id = ? AND revision_number = ?
  `);
  return stmt.get(id, revisionNumber);
}

function saveDocument(id, baseRevision, content, comment, db = getDb()) {
  const docStmt = db.prepare(`
    SELECT id, title, author, summary, current_revision, created_at, updated_at
    FROM documents
    WHERE id = ?
  `);
  const doc = docStmt.get(id);
  if (!doc) {
    const err = new Error('Document not found');
    err.status = 404;
    throw err;
  }

  // Conflict detection
  if (doc.current_revision !== baseRevision) {
    const err = new Error(`Conflict: Base revision ${baseRevision} does not match server revision ${doc.current_revision}`);
    err.status = 409;
    err.currentRevision = doc.current_revision;
    throw err;
  }

  // Check if content is unchanged
  const revStmt = db.prepare(`
    SELECT content
    FROM revisions
    WHERE document_id = ? AND revision_number = ?
  `);
  const currentRev = revStmt.get(id, doc.current_revision);

  if (currentRev && currentRev.content === content) {
    return {
      saved: false,
      message: 'Document unchanged',
      revision: doc.current_revision,
      updated_at: doc.updated_at
    };
  }

  // Content changed, create new revision
  const newRevision = doc.current_revision + 1;
  const now = new Date().toISOString();

  const insertRevStmt = db.prepare(`
    INSERT INTO revisions (document_id, revision_number, content, created_at, comment)
    VALUES (?, ?, ?, ?, ?)
  `);

  const updateDocStmt = db.prepare(`
    UPDATE documents
    SET current_revision = ?, updated_at = ?
    WHERE id = ?
  `);

  const tx = db.transaction(() => {
    insertRevStmt.run(id, newRevision, content, now, comment || null);
    updateDocStmt.run(newRevision, now, id);
  });

  tx();

  return {
    saved: true,
    message: 'Document saved successfully',
    revision: newRevision,
    updated_at: now
  };
}

module.exports = {
  DB_PATH,
  getDb,
  closeDb,
  listDocuments,
  getDocument,
  getRevisions,
  getRevisionContent,
  saveDocument
};

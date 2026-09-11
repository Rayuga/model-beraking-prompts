const path = require('path');
const Database = require('better-sqlite3');
const { loadSeedData } = require('./seed');

const DB_PATH = process.env.SQLITE_PATH || path.resolve(__dirname, 'patchpad.db');

let db = null;

function getDb(dbPath = DB_PATH) {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      summary TEXT,
      current_revision INTEGER NOT NULL DEFAULT 1,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      content TEXT NOT NULL,
      author TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      summary TEXT,
      UNIQUE(document_id, revision),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_revisions_doc_rev ON revisions(document_id, revision);
  `);

  // Check if seed document exists
  const seed = loadSeedData();
  const existing = database.prepare('SELECT id, current_revision FROM documents WHERE id = ?').get(seed.id);

  if (!existing) {
    const now = new Date().toISOString();
    const insertDoc = database.prepare(`
      INSERT INTO documents (id, title, author, summary, current_revision, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    `);

    const insertRev = database.prepare(`
      INSERT INTO revisions (document_id, revision, content, author, timestamp, summary)
      VALUES (?, 1, ?, ?, ?, ?)
    `);

    const seedTx = database.transaction(() => {
      insertDoc.run(seed.id, seed.title, seed.author, seed.summary, seed.content, now, now);
      insertRev.run(seed.id, seed.content, seed.author, now, 'Initial seed revision');
    });

    seedTx();
  }
}

function listDocuments() {
  const d = getDb();
  const rows = d.prepare(`
    SELECT id, title, author, summary, current_revision AS currentRevision, created_at AS createdAt, updated_at AS updatedAt
    FROM documents
    ORDER BY updated_at DESC
  `).all();
  return rows;
}

function getDocument(id) {
  const d = getDb();
  const row = d.prepare(`
    SELECT id, title, author, summary, current_revision AS currentRevision, content, created_at AS createdAt, updated_at AS updatedAt
    FROM documents
    WHERE id = ?
  `).get(id);
  return row || null;
}

function getRevisions(documentId) {
  const d = getDb();
  const rows = d.prepare(`
    SELECT revision, timestamp, author, summary, length(content) AS charCount
    FROM revisions
    WHERE document_id = ?
    ORDER BY revision DESC
  `).all(documentId);

  return rows;
}

function getRevision(documentId, revision) {
  const d = getDb();
  const row = d.prepare(`
    SELECT document_id AS documentId, revision, content, author, timestamp, summary
    FROM revisions
    WHERE document_id = ? AND revision = ?
  `).get(documentId, revision);

  return row || null;
}

function saveDocument({ documentId, baseRevision, content, author, summary }) {
  const d = getDb();

  const tx = d.transaction(() => {
    const doc = d.prepare('SELECT id, author, current_revision, content FROM documents WHERE id = ?').get(documentId);
    if (!doc) {
      return { status: 'not_found' };
    }

    if (doc.current_revision !== baseRevision) {
      return {
        status: 'conflict',
        currentRevision: doc.current_revision,
        currentContent: doc.content
      };
    }

    if (doc.content === content) {
      return {
        status: 'unchanged',
        revision: doc.current_revision,
        updatedAt: new Date().toISOString()
      };
    }

    const newRevision = doc.current_revision + 1;
    const now = new Date().toISOString();
    const revAuthor = author || doc.author || 'Anonymous';
    const revSummary = summary || `Revision ${newRevision}`;

    d.prepare(`
      UPDATE documents
      SET current_revision = ?, content = ?, updated_at = ?
      WHERE id = ?
    `).run(newRevision, content, now, documentId);

    d.prepare(`
      INSERT INTO revisions (document_id, revision, content, author, timestamp, summary)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(documentId, newRevision, content, revAuthor, now, revSummary);

    return {
      status: 'saved',
      revision: newRevision,
      updatedAt: now
    };
  });

  return tx();
}

module.exports = {
  DB_PATH,
  getDb,
  listDocuments,
  getDocument,
  getRevisions,
  getRevision,
  saveDocument
};

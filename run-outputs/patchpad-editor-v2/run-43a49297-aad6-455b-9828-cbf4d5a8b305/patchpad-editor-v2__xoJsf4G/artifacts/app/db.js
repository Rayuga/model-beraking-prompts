const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'patchpad.db');
const seedPath = '/assets/incident_seed.json';

let db = new Database(dbPath);

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      currentRevision INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revisions (
      documentId TEXT NOT NULL,
      revision INTEGER NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      PRIMARY KEY (documentId, revision),
      FOREIGN KEY (documentId) REFERENCES documents(id)
    );
  `);

  // Load seed data if documents table is empty
  const docCount = db.prepare('SELECT COUNT(*) as count FROM documents').get();
  if (docCount.count === 0) {
    loadSeedData();
  }
}

function loadSeedData() {
  try {
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    const doc = seedData.document;

    // Generate full content
    const lines = [...doc.sections];
    
    // Add generated lines
    for (let i = 1; i <= doc.generatedLineCount; i++) {
      const line = doc.generatedLineTemplate.replace(/{n}/g, i);
      lines.push(line);
    }
    
    // Add tail sections
    lines.push(...doc.tailSections);
    
    const content = lines.join('\n');

    // Insert document and first revision
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO documents (id, title, author, content, currentRevision)
      VALUES (?, ?, ?, ?, ?)
    `).run(doc.id, doc.title, doc.author, content, 1);

    db.prepare(`
      INSERT INTO revisions (documentId, revision, content, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(doc.id, 1, content, now);

    console.log(`Loaded seed document: ${doc.title}`);
  } catch (err) {
    console.error('Failed to load seed data:', err);
  }
}

function getDocument(id) {
  return db.prepare(`
    SELECT id, title, author, content, currentRevision
    FROM documents WHERE id = ?
  `).get(id);
}

function getAllDocuments() {
  return db.prepare(`
    SELECT id, title, author
    FROM documents
    ORDER BY id
  `).all();
}

function getRevisions(documentId) {
  return db.prepare(`
    SELECT revision, timestamp
    FROM revisions
    WHERE documentId = ?
    ORDER BY revision DESC
  `).all(documentId);
}

function getRevisionContent(documentId, revision) {
  return db.prepare(`
    SELECT content, timestamp
    FROM revisions
    WHERE documentId = ? AND revision = ?
  `).get(documentId, revision);
}

function saveDocument(documentId, newContent, baseRevision) {
  const doc = getDocument(documentId);
  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  // Check for stale save
  if (baseRevision !== doc.currentRevision) {
    const err = new Error('Stale save detected');
    err.status = 409;
    throw err;
  }

  // Don't create a new revision if content hasn't changed
  if (newContent === doc.content) {
    return {
      documentId,
      revision: doc.currentRevision,
      status: 'unchanged'
    };
  }

  const newRevision = doc.currentRevision + 1;
  const now = new Date().toISOString();

  const stmt = db.transaction((docId, content, revision, timestamp) => {
    db.prepare(`
      UPDATE documents SET content = ?, currentRevision = ?
      WHERE id = ?
    `).run(content, revision, docId);

    db.prepare(`
      INSERT INTO revisions (documentId, revision, content, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(docId, revision, content, timestamp);
  });

  stmt(documentId, newContent, newRevision, now);

  return {
    documentId,
    revision: newRevision,
    status: 'saved'
  };
}

initializeDatabase();

module.exports = {
  db,
  getDocument,
  getAllDocuments,
  getRevisions,
  getRevisionContent,
  saveDocument
};

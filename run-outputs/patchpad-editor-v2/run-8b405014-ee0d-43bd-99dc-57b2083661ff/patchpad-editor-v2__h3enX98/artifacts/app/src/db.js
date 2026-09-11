const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../patchpad.db');
const SEED_PATH = '/assets/incident_seed.json';

let db = null;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) console.error('Database connection error:', err);
    });
    db.configure('busyTimeout', 5000);
  }
  return db;
}

function promisify(fn) {
  return (...args) => new Promise((resolve, reject) => {
    fn(...args, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function run(sql, params = []) {
  return promisify((cb) => {
    getDb().run(sql, params, function(err) {
      if (err) cb(err);
      else cb(null, { lastID: this.lastID, changes: this.changes });
    });
  })();
}

function get(sql, params = []) {
  return promisify((cb) => {
    getDb().get(sql, params, cb);
  })();
}

function all(sql, params = []) {
  return promisify((cb) => {
    getDb().all(sql, params, cb);
  })();
}

function expandSeedContent(seed) {
  const { sections, generatedLineCount, generatedLineTemplate, tailSections } = seed.document;
  const lines = [...sections];
  
  for (let i = 1; i <= generatedLineCount; i++) {
    const line = generatedLineTemplate.replace(/\{n\}/g, i);
    lines.push(line);
  }
  
  lines.push(...tailSections);
  return lines.join('\n');
}

async function initializeDatabase() {
  try {
    await run(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        summary TEXT,
        currentRevision INTEGER NOT NULL DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        documentId TEXT NOT NULL,
        revisionNumber INTEGER NOT NULL,
        content TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (documentId) REFERENCES documents(id),
        UNIQUE(documentId, revisionNumber)
      )
    `);

    // Check if we need to seed
    const existingDoc = await get('SELECT * FROM documents WHERE id = ?', ['incident-alpha']);
    if (!existingDoc) {
      const seedData = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
      const content = expandSeedContent(seedData);
      
      await run(
        `INSERT INTO documents (id, title, author, summary, currentRevision) VALUES (?, ?, ?, ?, 1)`,
        [
          seedData.document.id,
          seedData.document.title,
          seedData.document.author,
          seedData.document.summary
        ]
      );

      await run(
        `INSERT INTO revisions (documentId, revisionNumber, content) VALUES (?, 1, ?)`,
        [seedData.document.id, content]
      );
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

async function listDocuments() {
  return all('SELECT id, title, author FROM documents ORDER BY updatedAt DESC');
}

async function getDocument(documentId) {
  const doc = await get('SELECT * FROM documents WHERE id = ?', [documentId]);
  if (!doc) return null;

  const revision = await get(
    'SELECT content FROM revisions WHERE documentId = ? AND revisionNumber = ?',
    [documentId, doc.currentRevision]
  );

  return {
    id: doc.id,
    title: doc.title,
    author: doc.author,
    summary: doc.summary,
    content: revision ? revision.content : '',
    currentRevision: doc.currentRevision
  };
}

async function saveDocument(documentId, content, baseRevision) {
  const doc = await get('SELECT currentRevision FROM documents WHERE id = ?', [documentId]);
  if (!doc) throw new Error('Document not found');

  if (doc.currentRevision !== baseRevision) {
    throw { statusCode: 409, message: 'Conflict: Document has been modified' };
  }

  const currentContent = await get(
    'SELECT content FROM revisions WHERE documentId = ? AND revisionNumber = ?',
    [documentId, baseRevision]
  );

  if (currentContent && currentContent.content === content) {
    return { revision: baseRevision, status: 'unchanged' };
  }

  const newRevision = baseRevision + 1;
  await run(
    'INSERT INTO revisions (documentId, revisionNumber, content) VALUES (?, ?, ?)',
    [documentId, newRevision, content]
  );

  await run(
    'UPDATE documents SET currentRevision = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [newRevision, documentId]
  );

  return { revision: newRevision, status: 'saved' };
}

async function getRevisionHistory(documentId) {
  return all(
    `SELECT revisionNumber, createdAt FROM revisions WHERE documentId = ? ORDER BY revisionNumber DESC`,
    [documentId]
  );
}

async function getRevision(documentId, revisionNumber) {
  return get(
    'SELECT content FROM revisions WHERE documentId = ? AND revisionNumber = ?',
    [documentId, revisionNumber]
  );
}

async function restoreRevision(documentId, revisionNumber) {
  const revision = await get(
    'SELECT content FROM revisions WHERE documentId = ? AND revisionNumber = ?',
    [documentId, revisionNumber]
  );

  if (!revision) throw new Error('Revision not found');
  
  const doc = await get('SELECT currentRevision FROM documents WHERE id = ?', [documentId]);
  const newRevision = doc.currentRevision + 1;

  await run(
    'INSERT INTO revisions (documentId, revisionNumber, content) VALUES (?, ?, ?)',
    [documentId, newRevision, revision.content]
  );

  await run(
    'UPDATE documents SET currentRevision = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [newRevision, documentId]
  );

  return { revision: newRevision, content: revision.content };
}

module.exports = {
  initializeDatabase,
  listDocuments,
  getDocument,
  saveDocument,
  getRevisionHistory,
  getRevision,
  restoreRevision,
  getDb
};

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = '/app';
const DB_PATH = path.join(ROOT, 'data', 'patchpad.sqlite');
const SEED_PATH = '/assets/incident_seed.json';
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(ROOT, 'public'), {
  extensions: ['html'],
  index: false,
}));

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

function nowIso() {
  return new Date().toISOString();
}

function runTransaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch (_) {
      // ignore rollback errors
    }
    throw error;
  }
}

function loadSeed() {
  const raw = fs.readFileSync(SEED_PATH, 'utf8');
  return JSON.parse(raw);
}

function buildSeedContent(document) {
  const lines = [];
  for (const line of document.sections || []) {
    lines.push(line);
  }
  const count = Number(document.generatedLineCount || 0);
  const template = String(document.generatedLineTemplate || '');
  for (let i = 1; i <= count; i += 1) {
    lines.push(template.replaceAll('{n}', String(i)));
  }
  for (const line of document.tailSections || []) {
    lines.push(line);
  }
  return lines.join('\n');
}

function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      current_revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revisions (
      document_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (document_id, revision),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
  `);
}

function seedDatabaseIfNeeded() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM documents').get().count;
  if (count > 0) {
    return;
  }
  const seed = loadSeed().document;
  const content = buildSeedContent(seed);
  const timestamp = nowIso();
  const insertDocument = db.prepare(`
    INSERT INTO documents (id, title, author, summary, content, current_revision, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);
  const insertRevision = db.prepare(`
    INSERT INTO revisions (document_id, revision, content, created_at)
    VALUES (?, 1, ?, ?)
  `);
  runTransaction(() => {
    insertDocument.run(seed.id, seed.title, seed.author, seed.summary, content, timestamp, timestamp);
    insertRevision.run(seed.id, content, timestamp);
  });
}

function rowToDocument(row) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    summary: row.summary,
    currentRevision: row.current_revision,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getDocument(documentId) {
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
  return row ? rowToDocument(row) : null;
}

function listDocuments() {
  return db.prepare(`
    SELECT id, title, author, summary, current_revision AS currentRevision, updated_at AS updatedAt
    FROM documents
    ORDER BY created_at ASC, id ASC
  `).all();
}

function listRevisions(documentId) {
  return db.prepare(`
    SELECT revision, created_at AS createdAt,
           LENGTH(content) AS contentLength,
           substr(content, 1, 160) AS preview
    FROM revisions
    WHERE document_id = ?
    ORDER BY revision DESC
  `).all(documentId);
}

function getRevision(documentId, revision) {
  return db.prepare(`
    SELECT revision, created_at AS createdAt, content
    FROM revisions
    WHERE document_id = ? AND revision = ?
  `).get(documentId, revision);
}

function sendError(res, status, message, extra = {}) {
  res.status(status).json({ ok: false, error: message, ...extra });
}

function parseInteger(value) {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
}

ensureSchema();
seedDatabaseIfNeeded();

app.get('/api/bootstrap', (req, res) => {
  const documents = listDocuments();
  const activeDocument = documents[0] ? getDocument(documents[0].id) : null;
  if (!activeDocument) {
    return res.json({ ok: true, documents: [], activeDocument: null, revisions: [] });
  }
  return res.json({
    ok: true,
    documents,
    activeDocument: {
      id: activeDocument.id,
      title: activeDocument.title,
      author: activeDocument.author,
      summary: activeDocument.summary,
      currentRevision: activeDocument.currentRevision,
      content: activeDocument.content,
      createdAt: activeDocument.createdAt,
      updatedAt: activeDocument.updatedAt,
    },
    revisions: listRevisions(activeDocument.id),
  });
});

app.get('/api/documents', (req, res) => {
  res.json({ ok: true, documents: listDocuments() });
});

app.get('/api/documents/:id', (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) {
    return sendError(res, 404, 'Document not found');
  }
  return res.json({ ok: true, document: doc, revisions: listRevisions(doc.id) });
});

app.get('/api/documents/:id/revisions', (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) {
    return sendError(res, 404, 'Document not found');
  }
  return res.json({ ok: true, documentId: doc.id, revisions: listRevisions(doc.id) });
});

app.get('/api/documents/:id/revisions/:revision', (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) {
    return sendError(res, 404, 'Document not found');
  }
  const revision = parseInteger(req.params.revision);
  if (revision === null) {
    return sendError(res, 400, 'Revision must be an integer');
  }
  const entry = getRevision(doc.id, revision);
  if (!entry) {
    return sendError(res, 404, 'Revision not found');
  }
  return res.json({
    ok: true,
    documentId: doc.id,
    revision: entry.revision,
    createdAt: entry.createdAt,
    content: entry.content,
  });
});

app.post('/api/documents/:id/save', (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) {
    return sendError(res, 404, 'Document not found');
  }
  const body = req.body || {};
  if (body.documentId !== undefined && body.documentId !== doc.id) {
    return sendError(res, 400, 'Document id does not match the save target');
  }
  const baseRevision = parseInteger(body.baseRevision);
  if (baseRevision === null) {
    return sendError(res, 400, 'baseRevision must be an integer');
  }
  if (typeof body.content !== 'string') {
    return sendError(res, 400, 'content must be text');
  }
  if (baseRevision !== doc.currentRevision) {
    return sendError(res, 409, 'Save rejected because the document changed elsewhere', {
      currentRevision: doc.currentRevision,
    });
  }
  if (body.content === doc.content) {
    return res.json({
      ok: true,
      saved: false,
      currentRevision: doc.currentRevision,
      updatedAt: doc.updatedAt,
      revisionCount: listRevisions(doc.id).length,
    });
  }
  const nextRevision = doc.currentRevision + 1;
  const timestamp = nowIso();
  runTransaction(() => {
    db.prepare(`
      UPDATE documents
      SET content = ?, current_revision = ?, updated_at = ?
      WHERE id = ?
    `).run(body.content, nextRevision, timestamp, doc.id);
    db.prepare(`
      INSERT INTO revisions (document_id, revision, content, created_at)
      VALUES (?, ?, ?, ?)
    `).run(doc.id, nextRevision, body.content, timestamp);
  });
  return res.json({
    ok: true,
    saved: true,
    currentRevision: nextRevision,
    updatedAt: timestamp,
    revisionCount: listRevisions(doc.id).length,
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PatchPad listening on http://0.0.0.0:${PORT}`);
  console.log(`SQLite path: ${DB_PATH}`);
});

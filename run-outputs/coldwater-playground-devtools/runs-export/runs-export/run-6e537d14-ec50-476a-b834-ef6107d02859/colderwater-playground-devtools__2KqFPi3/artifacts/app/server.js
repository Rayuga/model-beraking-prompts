const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');

const ROOT = __dirname;
const dbPath = process.env.DB_PATH || path.join(ROOT, 'app.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    source TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snippet_id INTEGER NOT NULL REFERENCES snippets(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    restore_key TEXT,
    UNIQUE(snippet_id, revision),
    UNIQUE(snippet_id, restore_key)
  );
`);

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

const now = () => new Date().toISOString();
const publicDir = path.join(ROOT, 'public');

function record(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    filename: row.filename,
    source: row.source,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function revisionRecord(row) {
  return {
    id: row.id,
    snippetId: row.snippet_id,
    revision: row.revision,
    title: row.title,
    filename: row.filename,
    source: row.source,
    createdAt: row.created_at
  };
}

function validatePayload(body) {
  if (!body || typeof body.title !== 'string' || typeof body.filename !== 'string' || typeof body.source !== 'string') {
    return 'Title, filename, and source are required.';
  }
  if (!body.title.trim()) return 'Title cannot be empty.';
  if (!/\.(js|html)$/i.test(body.filename.trim())) return 'Filename must end in .js or .html.';
  if (body.title.length > 160 || body.filename.length > 160 || body.source.length > 2000000) return 'One or more fields are too large.';
  return null;
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'playground' }));

app.get('/api/snippets', (_req, res) => {
  const rows = db.prepare('SELECT * FROM snippets ORDER BY updated_at DESC, id DESC').all();
  res.json({ snippets: rows.map(record) });
});

app.get('/api/snippets/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM snippets WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Snippet not found.' });
  res.json({ snippet: record(row) });
});

app.get('/api/snippets/:id/history', (req, res) => {
  const exists = db.prepare('SELECT id FROM snippets WHERE id = ?').get(Number(req.params.id));
  if (!exists) return res.status(404).json({ error: 'Snippet not found.' });
  const rows = db.prepare('SELECT * FROM revisions WHERE snippet_id = ? ORDER BY revision DESC').all(Number(req.params.id));
  res.json({ revisions: rows.map(revisionRecord) });
});

app.post('/api/snippets', (req, res) => {
  const invalid = validatePayload(req.body);
  if (invalid) return res.status(400).json({ error: invalid });
  const timestamp = now();
  const create = db.transaction((body) => {
    const result = db.prepare('INSERT INTO snippets (title, filename, source, revision, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)')
      .run(body.title, body.filename, body.source, timestamp, timestamp);
    db.prepare('INSERT INTO revisions (snippet_id, revision, title, filename, source, created_at) VALUES (?, 1, ?, ?, ?, ?)')
      .run(result.lastInsertRowid, body.title, body.filename, body.source, timestamp);
    return db.prepare('SELECT * FROM snippets WHERE id = ?').get(result.lastInsertRowid);
  });
  res.status(201).json({ snippet: record(create(req.body)) });
});

app.put('/api/snippets/:id', (req, res) => {
  const invalid = validatePayload(req.body);
  if (invalid) return res.status(400).json({ error: invalid });
  const id = Number(req.params.id);
  const expected = Number(req.body.expectedRevision);
  const current = db.prepare('SELECT * FROM snippets WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Snippet not found.' });
  if (!Number.isInteger(expected) || expected !== current.revision) {
    return res.status(409).json({ error: 'This snippet changed in another tab. Keep your draft and load the newer revision when ready.', conflict: true, snippet: record(current) });
  }
  const timestamp = now();
  const save = db.transaction(() => {
    const next = current.revision + 1;
    db.prepare('UPDATE snippets SET title = ?, filename = ?, source = ?, revision = ?, updated_at = ? WHERE id = ?')
      .run(req.body.title, req.body.filename, req.body.source, next, timestamp, id);
    db.prepare('INSERT INTO revisions (snippet_id, revision, title, filename, source, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, next, req.body.title, req.body.filename, req.body.source, timestamp);
    return db.prepare('SELECT * FROM snippets WHERE id = ?').get(id);
  });
  res.json({ snippet: record(save()) });
});

app.post('/api/snippets/:id/restore', (req, res) => {
  const id = Number(req.params.id);
  const targetRevision = Number(req.body.revision);
  const expected = Number(req.body.expectedRevision);
  const restoreKey = typeof req.body.restoreKey === 'string' && req.body.restoreKey ? req.body.restoreKey : null;
  const current = db.prepare('SELECT * FROM snippets WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Snippet not found.' });
  if (restoreKey) {
    const prior = db.prepare('SELECT * FROM revisions WHERE snippet_id = ? AND restore_key = ?').get(id, restoreKey);
    if (prior) return res.json({ snippet: record(current), alreadyApplied: true });
  }
  const target = db.prepare('SELECT * FROM revisions WHERE snippet_id = ? AND revision = ?').get(id, targetRevision);
  if (!target) return res.status(404).json({ error: 'That history revision was not found.' });
  if (!Number.isInteger(expected) || expected !== current.revision) {
    return res.status(409).json({ error: 'The snippet changed in another tab. The older history snapshot was not restored.', conflict: true, snippet: record(current) });
  }
  const timestamp = now();
  const restore = db.transaction(() => {
    const next = current.revision + 1;
    db.prepare('UPDATE snippets SET title = ?, filename = ?, source = ?, revision = ?, updated_at = ? WHERE id = ?')
      .run(target.title, target.filename, target.source, next, timestamp, id);
    db.prepare('INSERT INTO revisions (snippet_id, revision, title, filename, source, created_at, restore_key) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, next, target.title, target.filename, target.source, timestamp, restoreKey);
    return db.prepare('SELECT * FROM snippets WHERE id = ?').get(id);
  });
  res.json({ snippet: record(restore()) });
});

app.use(express.static(publicDir, { index: 'index.html' }));
app.use((_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`Playground listening on http://0.0.0.0:${port}`));

const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const dbPath = process.env.DB_PATH || '/app/app.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    code TEXT NOT NULL,
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
    code TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(snippet_id, revision)
  );
  CREATE TABLE IF NOT EXISTS restore_requests (
    request_id TEXT PRIMARY KEY,
    snippet_id INTEGER NOT NULL REFERENCES snippets(id) ON DELETE CASCADE,
    resulting_revision INTEGER NOT NULL
  );
`);

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function now() { return new Date().toISOString(); }
function cleanText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}
function snippetView(row) {
  return {
    id: row.id, title: row.title, filename: row.filename, code: row.code,
    revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
function getSnippet(id) {
  return db.prepare('SELECT * FROM snippets WHERE id = ?').get(id);
}
function validSnippetInput(body) {
  const filenameValue = cleanText(body.filename, 'experiment.js');
  const titleValue = cleanText(body.title, 'Untitled experiment');
  const filename = filenameValue || 'experiment.js';
  const title = titleValue || 'Untitled experiment';
  const code = cleanText(body.code);
  if (!/\.(js|html)$/i.test(filename)) return { error: 'Filename must end in .js or .html.' };
  if (title.length > 200 || filename.length > 200 || code.length > 2_000_000) return { error: 'Title, filename, or code is too large.' };
  return { title, filename, code };
}

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/snippets', (req, res) => {
  const rows = db.prepare('SELECT id, title, filename, revision, created_at, updated_at FROM snippets ORDER BY updated_at DESC, id DESC').all();
  res.json(rows.map(snippetView));
});
app.get('/api/snippets/:id', (req, res) => {
  const row = getSnippet(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Snippet not found.' });
  res.json(snippetView(row));
});
app.get('/api/snippets/:id/history', (req, res) => {
  const row = getSnippet(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Snippet not found.' });
  const rows = db.prepare('SELECT revision, title, filename, code, created_at FROM revisions WHERE snippet_id = ? ORDER BY revision DESC').all(row.id);
  res.json(rows.map(item => ({ revision: item.revision, title: item.title, filename: item.filename, code: item.code, createdAt: item.created_at })));
});

app.post('/api/snippets', (req, res) => {
  const input = validSnippetInput(req.body || {});
  if (input.error) return res.status(400).json({ error: input.error });
  const timestamp = now();
  const create = db.transaction(() => {
    const result = db.prepare('INSERT INTO snippets (title, filename, code, revision, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)').run(input.title, input.filename, input.code, timestamp, timestamp);
    db.prepare('INSERT INTO revisions (snippet_id, revision, title, filename, code, created_at) VALUES (?, 1, ?, ?, ?, ?)').run(result.lastInsertRowid, input.title, input.filename, input.code, timestamp);
    return getSnippet(result.lastInsertRowid);
  });
  res.status(201).json(snippetView(create()));
});

app.put('/api/snippets/:id', (req, res) => {
  const id = Number(req.params.id);
  const expectedRevision = Number(req.body && req.body.expectedRevision);
  const input = validSnippetInput(req.body || {});
  if (input.error) return res.status(400).json({ error: input.error });
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) return res.status(400).json({ error: 'A current revision is required.' });
  const current = getSnippet(id);
  if (!current) return res.status(404).json({ error: 'Snippet not found.' });
  if (current.revision !== expectedRevision) return res.status(409).json({ error: 'Save refused: this snippet has a newer revision in another tab.', current: snippetView(current) });
  const timestamp = now();
  const update = db.transaction(() => {
    const next = current.revision + 1;
    db.prepare('UPDATE snippets SET title = ?, filename = ?, code = ?, revision = ?, updated_at = ? WHERE id = ? AND revision = ?').run(input.title, input.filename, input.code, next, timestamp, id, expectedRevision);
    db.prepare('INSERT INTO revisions (snippet_id, revision, title, filename, code, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, next, input.title, input.filename, input.code, timestamp);
    return getSnippet(id);
  });
  res.json(snippetView(update()));
});

app.post('/api/snippets/:id/restore', (req, res) => {
  const id = Number(req.params.id);
  const expectedRevision = Number(req.body && req.body.expectedRevision);
  const snapshotRevision = Number(req.body && req.body.snapshotRevision);
  const requestId = cleanText(req.body && req.body.requestId).trim();
  if (!requestId || requestId.length > 120) return res.status(400).json({ error: 'A restore request id is required.' });
  const prior = db.prepare('SELECT resulting_revision FROM restore_requests WHERE request_id = ? AND snippet_id = ?').get(requestId, id);
  if (prior) return res.json(snippetView(getSnippet(id)));
  const current = getSnippet(id);
  if (!current) return res.status(404).json({ error: 'Snippet not found.' });
  if (!Number.isInteger(expectedRevision) || current.revision !== expectedRevision) return res.status(409).json({ error: 'Restore refused: this snippet has a newer revision in another tab.', current: snippetView(current) });
  const snapshot = db.prepare('SELECT * FROM revisions WHERE snippet_id = ? AND revision = ?').get(id, snapshotRevision);
  if (!snapshot) return res.status(404).json({ error: 'History snapshot not found.' });
  const timestamp = now();
  const restore = db.transaction(() => {
    const next = current.revision + 1;
    db.prepare('UPDATE snippets SET title = ?, filename = ?, code = ?, revision = ?, updated_at = ? WHERE id = ? AND revision = ?').run(snapshot.title, snapshot.filename, snapshot.code, next, timestamp, id, expectedRevision);
    db.prepare('INSERT INTO revisions (snippet_id, revision, title, filename, code, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, next, snapshot.title, snapshot.filename, snapshot.code, timestamp);
    db.prepare('INSERT INTO restore_requests (request_id, snippet_id, resulting_revision) VALUES (?, ?, ?)').run(requestId, id, next);
    return getSnippet(id);
  });
  res.json(snippetView(restore()));
});

app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`Playground listening on http://0.0.0.0:${PORT}`));

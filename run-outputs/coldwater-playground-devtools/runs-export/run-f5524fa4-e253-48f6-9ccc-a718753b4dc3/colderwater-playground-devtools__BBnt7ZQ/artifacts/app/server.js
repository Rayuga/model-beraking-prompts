const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const root = __dirname;
const port = Number(process.env.PORT || 3000);
const dbPath = process.env.DB_PATH || path.join(root, 'app.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS snippets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL COLLATE BINARY UNIQUE,
  filename TEXT NOT NULL,
  source TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(root, 'public')));

const toSnippet = row => row && ({ id: row.id, title: row.title, filename: row.filename, source: row.source, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at });
const now = () => new Date().toISOString();
function validate(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const filename = typeof body.filename === 'string' ? body.filename.trim() : '';
  const source = typeof body.source === 'string' ? body.source : '';
  if (!title) return { error: 'Give this snippet a title before saving.' };
  if (!/^.+\.(js|html|css)$/i.test(filename)) return { error: 'Filename must end in .js, .html, or .css.' };
  if (title.length > 120) return { error: 'Titles must be 120 characters or fewer.' };
  return { title, filename, source };
}

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/snippets', (req, res) => {
  const rows = db.prepare('SELECT * FROM snippets ORDER BY updated_at DESC, title COLLATE BINARY').all();
  res.json(rows.map(toSnippet));
});
app.post('/api/snippets', (req, res) => {
  const input = validate(req.body || {});
  if (input.error) return res.status(400).json({ error: input.error });
  const id = crypto.randomUUID();
  const timestamp = now();
  try {
    db.prepare('INSERT INTO snippets (id,title,filename,source,revision,created_at,updated_at) VALUES (?,?,?,?,1,?,?)').run(id, input.title, input.filename, input.source, timestamp, timestamp);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: `A saved snippet titled “${input.title}” already exists.` });
    throw error;
  }
  res.status(201).json(toSnippet(db.prepare('SELECT * FROM snippets WHERE id=?').get(id)));
});
app.put('/api/snippets/:id', (req, res) => {
  const input = validate(req.body || {});
  if (input.error) return res.status(400).json({ error: input.error });
  const expectedRevision = Number(req.body.revision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) return res.status(400).json({ error: 'This saved copy is missing its revision.' });
  const result = db.transaction(() => {
    const current = db.prepare('SELECT * FROM snippets WHERE id=?').get(req.params.id);
    if (!current) return { kind: 'missing' };
    if (current.revision !== expectedRevision) return { kind: 'conflict', current: toSnippet(current) };
    try {
      const updated = db.prepare('UPDATE snippets SET title=?,filename=?,source=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').run(input.title, input.filename, input.source, now(), req.params.id, expectedRevision);
      if (!updated.changes) return { kind: 'conflict', current: toSnippet(db.prepare('SELECT * FROM snippets WHERE id=?').get(req.params.id)) };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return { kind: 'duplicate' };
      throw error;
    }
    return { kind: 'updated', snippet: toSnippet(db.prepare('SELECT * FROM snippets WHERE id=?').get(req.params.id)) };
  })();
  if (result.kind === 'missing') return res.status(404).json({ error: 'That saved snippet no longer exists.' });
  if (result.kind === 'duplicate') return res.status(409).json({ error: `A saved snippet titled “${input.title}” already exists.` });
  if (result.kind === 'conflict') return res.status(409).json({ error: 'This snippet changed in another editor.', conflict: result.current });
  res.json(result.snippet);
});
app.delete('/api/snippets/:id', (req, res) => {
  const result = db.prepare('DELETE FROM snippets WHERE id=?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'That saved snippet was not found.' });
  res.status(204).end();
});
app.use((req, res) => res.sendFile(path.join(root, 'public', 'index.html')));
app.listen(port, '0.0.0.0', () => console.log(`Colderwater Playground listening on 0.0.0.0:${port}`));

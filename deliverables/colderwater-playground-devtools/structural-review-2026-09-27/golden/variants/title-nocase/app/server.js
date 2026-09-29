'use strict';
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const Database = require('better-sqlite3');
const app = express();
const root = __dirname;
const databasePath = process.env.DB_PATH || process.env.SQLITE_PATH || path.join(root, 'app.db');
let db;

app.disable('x-powered-by');
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'colderwater-playground' }));
app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.use(express.json({ limit: '1mb' }));
app.use((_req, res, next) => {
  res.set('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'self' http://localhost:* http://127.0.0.1:*; object-src 'none'; base-uri 'none'; form-action 'none'");
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!db) return res.status(503).json({ error: 'The snippet library is starting. Please retry shortly.' });
  next();
});

function problem(message, status = 400, code = 'INVALID_SNIPPET', current) {
  return Object.assign(new Error(message), { publicError: true, status, code, current });
}
function recordId(value) {
  if (!/^[1-9][0-9]*$/.test(value)) throw problem('Snippet not found.', 404, 'NOT_FOUND');
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw problem('Snippet not found.', 404, 'NOT_FOUND');
  return id;
}
function findRecord(id) {
  const record = db.prepare('SELECT * FROM snippets WHERE id = ?').get(id);
  if (!record) throw problem('Snippet not found.', 404, 'NOT_FOUND');
  return record;
}
function fields(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw problem('Supply a title, filename and code.');
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const filename = typeof body.filename === 'string' ? body.filename.trim() : '';
  if (!title || title.length > 120) throw problem('Use a title of 1–120 characters.');
  if (!filename || filename.length > 180 || /[\x00-\x1f/\\]/.test(filename) || !/\.(js|html|css)$/i.test(filename)) {
    throw problem('Use a filename ending in .js, .html or .css, without directory paths.');
  }
  if (typeof body.code !== 'string') throw problem('Code must be text.');
  return { title, filename, code: body.code };
}
function matchingRevision(body, current) {
  if (!Number.isSafeInteger(body?.revision) || body.revision <= 0) {
    throw problem('Reload this snippet before saving or deleting it.', 409, 'REVISION_REQUIRED', current);
  }
  if (body.revision !== current.revision) {
    throw problem('This snippet changed in another editor. Your edits are kept; reload the latest version before trying again.', 409, 'REVISION_CONFLICT', current);
  }
}
function uniqueTitle(title, exceptId = 0) {
  if (db.prepare('SELECT 1 FROM snippets WHERE title COLLATE NOCASE = ? AND id != ?').get(title, exceptId)) {
    throw problem('A snippet with that title already exists. Choose another title.', 409, 'TITLE_CONFLICT');
  }
}

app.get('/api/snippets', (_req, res) => res.json(db.prepare('SELECT * FROM snippets ORDER BY updated_at DESC, id DESC').all()));
app.get('/api/snippets/:id', (req, res) => res.json(findRecord(recordId(req.params.id))));
app.post('/api/snippets', (req, res) => {
  const result = db.transaction(() => {
    const value = fields(req.body);
    uniqueTitle(value.title);
    const inserted = db.prepare('INSERT INTO snippets (title, filename, code, revision, updated_at) VALUES (?, ?, ?, 1, ?)')
      .run(value.title, value.filename, value.code, new Date().toISOString());
    return findRecord(Number(inserted.lastInsertRowid));
  }).immediate();
  res.status(201).json(result);
});
app.put('/api/snippets/:id', (req, res) => {
  const result = db.transaction(() => {
    const current = findRecord(recordId(req.params.id));
    matchingRevision(req.body, current);
    const value = fields(req.body);
    uniqueTitle(value.title, current.id);
    db.prepare('UPDATE snippets SET title = ?, filename = ?, code = ?, revision = revision + 1, updated_at = ? WHERE id = ?')
      .run(value.title, value.filename, value.code, new Date().toISOString(), current.id);
    return findRecord(current.id);
  }).immediate();
  res.json(result);
});
app.delete('/api/snippets/:id', (req, res) => {
  db.transaction(() => {
    const current = findRecord(recordId(req.params.id));
    matchingRevision(req.body, current);
    db.prepare('DELETE FROM snippets WHERE id = ?').run(current.id);
  }).immediate();
  res.json({ ok: true });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use('/starters', express.static(path.join(root, 'starters'), { fallthrough: false }));
app.use(express.static(path.join(root, 'public'), { dotfiles: 'deny' }));
app.get('/', (_req, res) => res.sendFile(path.join(root, 'public', 'index.html')));
app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((error, _req, res, _next) => {
  if (error.publicError) return res.status(error.status).json({ error: error.message, code: error.code, ...(error.current ? { current: error.current } : {}) });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body must be valid JSON.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'This snippet exceeds the request size limit.' });
  if (error.status === 404) return res.status(404).json({ error: 'Not found.' });
  console.error('Snippet request failed:', error.code || error.name);
  res.status(500).json({ error: 'The request could not be completed. Your saved work has not been replaced.' });
});

app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const connection = new Database(databasePath, { timeout: 5000 });
  connection.pragma('journal_mode = WAL');
  connection.pragma('foreign_keys = ON');
  connection.exec(`CREATE TABLE IF NOT EXISTS snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    code TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
    updated_at TEXT NOT NULL
  )`);
  const columns = connection.prepare('PRAGMA table_info(snippets)').all();
  if (!columns.some(c => c.name === 'revision')) connection.exec('ALTER TABLE snippets ADD COLUMN revision INTEGER NOT NULL DEFAULT 1');
  db = connection;
  console.log('Colderwater ready on port ' + (process.env.PORT || 3000));
});

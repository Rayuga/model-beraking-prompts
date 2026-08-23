'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'data', 'patchpad.sqlite');
const SEED_PATH = process.env.SEED_PATH || '/assets/incident_seed.json';
const PORT = Number(process.env.PORT || 3000);
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '', content TEXT NOT NULL,
    seed_metadata TEXT NOT NULL, current_revision INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS revisions (
    document_id TEXT NOT NULL, revision INTEGER NOT NULL, content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY(document_id, revision),
    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
  );`);

function seedDatabase() {
  const raw = fs.readFileSync(SEED_PATH, 'utf8');
  const seed = JSON.parse(raw).document;
  if (db.prepare('SELECT 1 FROM documents WHERE id = ?').get(seed.id)) return;
  const generated = Array.from({ length: seed.generatedLineCount }, (_, i) => {
    const n = String(i + 1).padStart(seed.generatedLineNumberWidth, '0');
    return seed.generatedLineTemplate.replaceAll('{n}', n);
  });
  const content = [...seed.sections, ...generated, ...seed.tailSections].join('\n');
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO documents
      (id,title,author,summary,content,seed_metadata,current_revision,updated_at)
      VALUES (?,?,?,?,?,?,1,?)`).run(seed.id, seed.title, seed.author || '', seed.summary || '', content, raw, now);
    db.prepare('INSERT INTO revisions(document_id,revision,content,created_at) VALUES (?,1,?,?)')
      .run(seed.id, content, now);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
seedDatabase();

const json = (res, status, body) => {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), 'Cache-Control': 'no-store' });
  res.end(data);
};
const documentView = row => ({ id: row.id, title: row.title, author: row.author, summary: row.summary, content: row.content, revision: row.current_revision, updatedAt: row.updated_at });

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10_000_000) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
  }
  try { return JSON.parse(body || '{}'); } catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
}

function saveContent(id, body, restoring = null) {
  if (!body.id || body.id !== id) return { status: 400, error: 'Document id in the request must match the route.' };
  if (!Number.isInteger(body.baseRevision) || body.baseRevision < 1) return { status: 400, error: 'A valid baseRevision is required.' };
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!doc) return { status: 404, error: 'Unknown document id.' };
  if (doc.current_revision !== body.baseRevision) return { status: 409, error: `Save conflict: revision ${doc.current_revision} is newer than your base revision ${body.baseRevision}.`, currentRevision: doc.current_revision };
  let content = body.content;
  if (restoring !== null) {
    if (!Number.isInteger(restoring) || restoring < 1) return { status: 400, error: 'A valid revision to restore is required.' };
    const old = db.prepare('SELECT content FROM revisions WHERE document_id = ? AND revision = ?').get(id, restoring);
    if (!old) return { status: 404, error: 'That revision does not exist for this document.' };
    content = old.content;
  }
  if (typeof content !== 'string') return { status: 400, error: 'Document content must be a string.' };
  if (content === doc.content) return { status: 200, document: documentView(doc), unchanged: true };
  const revision = doc.current_revision + 1;
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = db.prepare('UPDATE documents SET content=?, current_revision=?, updated_at=? WHERE id=? AND current_revision=?')
      .run(content, revision, now, id, body.baseRevision);
    if (result.changes !== 1) { db.exec('ROLLBACK'); return { status: 409, error: 'Save conflict: the document changed while saving.' }; }
    db.prepare('INSERT INTO revisions(document_id,revision,content,created_at) VALUES (?,?,?,?)').run(id, revision, content, now);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  const updated = db.prepare('SELECT * FROM documents WHERE id=?').get(id);
  return { status: 200, document: documentView(updated), restoredFrom: restoring };
}

async function api(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/documents') {
    const rows = db.prepare('SELECT id,title,author,summary,current_revision,updated_at FROM documents ORDER BY title').all();
    return json(res, 200, rows.map(r => ({ id:r.id,title:r.title,author:r.author,summary:r.summary,revision:r.current_revision,updatedAt:r.updated_at })));
  }
  const match = url.pathname.match(/^\/api\/documents\/([^/]+)(?:\/(revisions|restore)(?:\/(\d+))?)?$/);
  if (!match) return json(res, 404, { error: 'API route not found.' });
  const id = decodeURIComponent(match[1]);
  const action = match[2];
  if (req.method === 'GET' && !action) {
    const row = db.prepare('SELECT * FROM documents WHERE id=?').get(id);
    return row ? json(res, 200, documentView(row)) : json(res, 404, { error: 'Unknown document id.' });
  }
  if (req.method === 'PUT' && !action) {
    const body = await readBody(req); const result = saveContent(id, body); return json(res, result.status, result);
  }
  if (req.method === 'GET' && action === 'revisions' && !match[3]) {
    if (!db.prepare('SELECT 1 FROM documents WHERE id=?').get(id)) return json(res, 404, { error:'Unknown document id.' });
    const rows = db.prepare('SELECT revision,created_at,LENGTH(content) AS length FROM revisions WHERE document_id=? ORDER BY revision DESC LIMIT 20').all(id);
    return json(res, 200, rows.map(r => ({ revision:r.revision, createdAt:r.created_at, length:r.length })));
  }
  if (req.method === 'GET' && action === 'revisions' && match[3]) {
    const row = db.prepare('SELECT revision,created_at,content FROM revisions WHERE document_id=? AND revision=?').get(id, Number(match[3]));
    return row ? json(res, 200, { revision:row.revision,createdAt:row.created_at,content:row.content }) : json(res, 404, { error:'Revision not found.' });
  }
  if (req.method === 'POST' && action === 'restore' && match[3]) {
    const body = await readBody(req); const result = saveContent(id, body, Number(match[3])); return json(res, result.status, result);
  }
  return json(res, 405, { error: 'Method not allowed.' });
}

const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = path.resolve(ROOT, 'public', relative);
    const publicRoot = path.resolve(ROOT, 'public') + path.sep;
    if (!file.startsWith(publicRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return json(res, 404, { error:'Not found.' });
    const data = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Content-Length':data.length }); res.end(data);
  } catch (error) { console.error(error); json(res, error.status || 500, { error:error.status ? error.message : 'Internal server error.' }); }
});
server.listen(PORT, '0.0.0.0', () => console.log(`PatchPad listening on http://0.0.0.0:${PORT} using ${DB_PATH}`));

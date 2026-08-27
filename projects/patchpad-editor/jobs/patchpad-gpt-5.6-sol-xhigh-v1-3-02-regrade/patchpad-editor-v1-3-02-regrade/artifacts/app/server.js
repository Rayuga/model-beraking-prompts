'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'data', 'patchpad.db');
const SEED_PATH = process.env.SEED_PATH || '/assets/incident_seed.json';
const MAX_BODY = 5 * 1024 * 1024;

function seedContent(document) {
  const generated = [];
  for (let i = 1; i <= document.generatedLineCount; i += 1) {
    const n = String(i).padStart(document.generatedLineNumberWidth, '0');
    generated.push(document.generatedLineTemplate.replaceAll('{n}', n));
  }
  return [...document.sections, ...generated, ...document.tailSections].join('\n');
}

function openDatabase(dbPath = DB_PATH, seedPath = SEED_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      summary TEXT NOT NULL,
      generation_metadata TEXT NOT NULL,
      content TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS revisions (
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (document_id, revision)
    );
  `);
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8')).document;
  const exists = db.prepare('SELECT 1 FROM documents WHERE id = ?').get(seed.id);
  if (!exists) {
    const content = seedContent(seed);
    const timestamp = new Date().toISOString();
    const metadata = JSON.stringify({
      sections: seed.sections,
      generatedLineCount: seed.generatedLineCount,
      generatedLineNumberWidth: seed.generatedLineNumberWidth,
      generatedLineTemplate: seed.generatedLineTemplate,
      tailSections: seed.tailSections
    });
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`INSERT INTO documents
        (id, title, author, summary, generation_metadata, content, revision, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)`)
        .run(seed.id, seed.title, seed.author, seed.summary, metadata, content, timestamp);
      db.prepare(`INSERT INTO revisions (document_id, revision, content, created_at)
        VALUES (?, 1, ?, ?)`)
        .run(seed.id, content, timestamp);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return db;
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request body is too large.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function documentResponse(row) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    summary: row.summary,
    generationMetadata: JSON.parse(row.generation_metadata),
    content: row.content,
    revision: row.revision,
    updatedAt: row.updated_at
  };
}

function saveDocument(db, routeId, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { status: 400, body: { error: 'Save payload must be an object.' } };
  }
  if (typeof body.id !== 'string' || body.id !== routeId) {
    return { status: 400, body: { error: 'Document id does not match the requested document.' } };
  }
  if (!Number.isSafeInteger(body.baseRevision) || body.baseRevision < 1) {
    return { status: 400, body: { error: 'baseRevision must be a positive integer.' } };
  }
  if (typeof body.content !== 'string') {
    return { status: 400, body: { error: 'content must be a string.' } };
  }
  const current = db.prepare('SELECT * FROM documents WHERE id = ?').get(routeId);
  if (!current) return { status: 404, body: { error: 'Document not found.' } };
  if (current.revision !== body.baseRevision) {
    return { status: 409, body: { error: `Save conflict: revision ${current.revision} is newer than your base revision ${body.baseRevision}.`, currentRevision: current.revision } };
  }
  if (current.content === body.content) {
    return { status: 200, body: { ...documentResponse(current), unchanged: true } };
  }
  const nextRevision = current.revision + 1;
  const timestamp = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    const update = db.prepare(`UPDATE documents SET content = ?, revision = ?, updated_at = ?
      WHERE id = ? AND revision = ?`)
      .run(body.content, nextRevision, timestamp, routeId, body.baseRevision);
    if (update.changes !== 1) {
      db.exec('ROLLBACK');
      const latest = db.prepare('SELECT revision FROM documents WHERE id = ?').get(routeId);
      return { status: 409, body: { error: 'Save conflict: the document changed before this save completed.', currentRevision: latest?.revision } };
    }
    db.prepare(`INSERT INTO revisions (document_id, revision, content, created_at)
      VALUES (?, ?, ?, ?)`)
      .run(routeId, nextRevision, body.content, timestamp);
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
  const saved = db.prepare('SELECT * FROM documents WHERE id = ?').get(routeId);
  return { status: 200, body: { ...documentResponse(saved), unchanged: false } };
}

function createApp({ db = openDatabase() } = {}) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      if (req.method === 'GET' && url.pathname === '/api/documents') {
        const rows = db.prepare('SELECT id, title, author, summary, revision, updated_at FROM documents ORDER BY title').all();
        return json(res, 200, { documents: rows.map(row => ({ ...row, updatedAt: row.updated_at, updated_at: undefined })) });
      }
      if (segments[0] === 'api' && segments[1] === 'documents' && segments[2]) {
        const id = segments[2];
        if (req.method === 'GET' && segments.length === 3) {
          const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
          return row ? json(res, 200, documentResponse(row)) : json(res, 404, { error: 'Document not found.' });
        }
        if (req.method === 'PUT' && segments.length === 3) {
          const result = saveDocument(db, id, await readJson(req));
          return json(res, result.status, result.body);
        }
        if (req.method === 'GET' && segments[3] === 'revisions' && segments.length === 4) {
          const exists = db.prepare('SELECT 1 FROM documents WHERE id = ?').get(id);
          if (!exists) return json(res, 404, { error: 'Document not found.' });
          const revisions = db.prepare(`SELECT revision, created_at FROM revisions
            WHERE document_id = ? ORDER BY revision DESC LIMIT 50`).all(id);
          return json(res, 200, { revisions: revisions.map(row => ({ revision: row.revision, createdAt: row.created_at })) });
        }
        if (req.method === 'GET' && segments[3] === 'revisions' && segments[4] && segments.length === 5) {
          const revision = Number(segments[4]);
          if (!Number.isSafeInteger(revision) || revision < 1) return json(res, 400, { error: 'Invalid revision number.' });
          const row = db.prepare(`SELECT revision, content, created_at FROM revisions
            WHERE document_id = ? AND revision = ?`).get(id, revision);
          return row ? json(res, 200, { revision: row.revision, content: row.content, createdAt: row.created_at }) : json(res, 404, { error: 'Revision not found.' });
        }
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' });
      const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const file = path.resolve(PUBLIC, requested);
      if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        return json(res, 404, { error: 'Not found.' });
      }
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
      const data = fs.readFileSync(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': data.length });
      if (req.method === 'HEAD') return res.end();
      res.end(data);
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Internal server error.' });
      if (!error.status) console.error(error);
    }
  });
}

if (require.main === module) {
  const db = openDatabase();
  const server = createApp({ db });
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => console.log(`PatchPad listening on http://0.0.0.0:${port}`));
}

module.exports = { createApp, openDatabase, saveDocument, seedContent };

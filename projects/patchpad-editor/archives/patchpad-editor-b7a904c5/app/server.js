'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const DB_PATH = path.resolve(process.env.DATABASE_PATH || path.join(__dirname, 'data', 'patchpad.sqlite'));
const SEED_PATH = '/assets/incident_seed.json';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 10 * 1024 * 1024;

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    current_revision INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS revisions (
    document_id TEXT NOT NULL,
    revision_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (document_id, revision_number),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  );
`);

function seedDatabase() {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8')).document;
  const exists = db.prepare('SELECT 1 FROM documents WHERE id = ?').get(seed.id);
  if (exists) return;

  const lines = [...seed.sections];
  for (let n = 1; n <= seed.generatedLineCount; n += 1) {
    lines.push(seed.generatedLineTemplate.replaceAll('{n}', String(n)));
  }
  const content = lines.join('\n');
  const now = new Date().toISOString();

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO documents
      (id, title, content, current_revision, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)`)
      .run(seed.id, seed.title, content, now, now);
    db.prepare(`INSERT INTO revisions
      (document_id, revision_number, title, content, created_at)
      VALUES (?, 1, ?, ?, ?)`)
      .run(seed.id, seed.title, content, now);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
seedDatabase();

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendError(res, status, message, details) {
  sendJson(res, status, { error: message, ...(details || {}) });
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body is too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Request body must be valid JSON');
    error.status = 400;
    throw error;
  }
}

function getDocument(id) {
  return db.prepare(`SELECT id, title, content,
    current_revision AS currentRevision, created_at AS createdAt, updated_at AS updatedAt
    FROM documents WHERE id = ?`).get(id);
}

function saveDocument(id, body) {
  if (!body || body.id !== id) {
    return { status: 400, payload: { error: 'Document id in the request does not match the route.' } };
  }
  if (!Number.isInteger(body.baseRevision) || body.baseRevision < 1) {
    return { status: 400, payload: { error: 'A valid integer baseRevision is required.' } };
  }
  if (typeof body.content !== 'string' || typeof body.title !== 'string' || !body.title.trim()) {
    return { status: 400, payload: { error: 'A non-empty title and string content are required.' } };
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const current = getDocument(id);
    if (!current) {
      db.exec('ROLLBACK');
      return { status: 404, payload: { error: 'Unknown document id.' } };
    }
    if (body.baseRevision !== current.currentRevision) {
      db.exec('ROLLBACK');
      return {
        status: 409,
        payload: {
          error: 'Save conflict: this document has a newer saved revision.',
          currentRevision: current.currentRevision
        }
      };
    }
    if (body.content === current.content && body.title === current.title) {
      db.exec('COMMIT');
      return { status: 200, payload: { document: current, unchanged: true } };
    }

    const nextRevision = current.currentRevision + 1;
    const now = new Date().toISOString();
    db.prepare(`UPDATE documents SET title = ?, content = ?, current_revision = ?, updated_at = ?
      WHERE id = ? AND current_revision = ?`)
      .run(body.title.trim(), body.content, nextRevision, now, id, body.baseRevision);
    db.prepare(`INSERT INTO revisions
      (document_id, revision_number, title, content, created_at)
      VALUES (?, ?, ?, ?, ?)`)
      .run(id, nextRevision, body.title.trim(), body.content, now);
    db.exec('COMMIT');
    return { status: 200, payload: { document: getDocument(id), unchanged: false } };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/documents') {
    const documents = db.prepare(`SELECT id, title, current_revision AS currentRevision,
      updated_at AS updatedAt FROM documents ORDER BY updated_at DESC`).all();
    sendJson(res, 200, { documents });
    return true;
  }

  let match = url.pathname.match(/^\/api\/documents\/([^/]+)$/);
  if (match && req.method === 'GET') {
    const document = getDocument(decodeURIComponent(match[1]));
    if (!document) sendError(res, 404, 'Unknown document id.');
    else sendJson(res, 200, { document });
    return true;
  }
  if (match && req.method === 'PUT') {
    readJson(req)
      .then((body) => {
        const result = saveDocument(decodeURIComponent(match[1]), body);
        sendJson(res, result.status, result.payload);
      })
      .catch((error) => sendError(res, error.status || 500, error.status ? error.message : 'Unable to save document.'));
    return true;
  }

  match = url.pathname.match(/^\/api\/documents\/([^/]+)\/revisions$/);
  if (match && req.method === 'GET') {
    const id = decodeURIComponent(match[1]);
    if (!getDocument(id)) {
      sendError(res, 404, 'Unknown document id.');
      return true;
    }
    const revisions = db.prepare(`SELECT revision_number AS revisionNumber, title, created_at AS createdAt,
      length(content) AS contentLength FROM revisions WHERE document_id = ?
      ORDER BY revision_number DESC`).all(id);
    sendJson(res, 200, { revisions });
    return true;
  }

  match = url.pathname.match(/^\/api\/documents\/([^/]+)\/revisions\/(\d+)$/);
  if (match && req.method === 'GET') {
    const revision = db.prepare(`SELECT document_id AS documentId, revision_number AS revisionNumber,
      title, content, created_at AS createdAt FROM revisions
      WHERE document_id = ? AND revision_number = ?`)
      .get(decodeURIComponent(match[1]), Number(match[2]));
    if (!revision) sendError(res, 404, 'Unknown document revision.');
    else sendJson(res, 200, { revision });
    return true;
  }

  if (url.pathname.startsWith('/api/')) {
    sendError(res, 404, 'Unknown API route.');
    return true;
  }
  return false;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendError(res, 405, 'Method not allowed.');
    return;
  }
  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const filePath = path.resolve(PUBLIC_DIR, requested);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    sendError(res, 403, 'Forbidden.');
    return;
  }
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      sendError(res, 404, 'Not found.');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache'
    });
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    sendError(res, 400, 'Invalid URL.');
    return;
  }
  try {
    if (!handleApi(req, res, url)) serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) sendError(res, 500, 'Internal server error.');
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`PatchPad listening on http://${HOST}:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

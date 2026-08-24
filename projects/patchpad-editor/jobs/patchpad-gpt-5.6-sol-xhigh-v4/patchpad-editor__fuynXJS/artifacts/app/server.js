const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const DB_PATH = process.env.PATCHPAD_DB || path.join(__dirname, 'data', 'patchpad.sqlite');
const SEED_PATH = process.env.PATCHPAD_SEED || '/assets/incident_seed.json';
const PUBLIC_DIR = path.join(__dirname, 'public');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000');
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    current_revision INTEGER NOT NULL,
    seed_metadata TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS revisions (
    document_id TEXT NOT NULL,
    revision_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (document_id, revision_number),
    FOREIGN KEY (document_id) REFERENCES documents(id)
  );
`);

function materializeSeed(seed) {
  const doc = seed.document;
  const generated = [];
  for (let i = 1; i <= doc.generatedLineCount; i += 1) {
    const n = String(i).padStart(doc.generatedLineNumberWidth, '0');
    generated.push(doc.generatedLineTemplate.replaceAll('{n}', n));
  }
  return [...doc.sections, ...generated, ...doc.tailSections].join('\n');
}

function seedDatabase() {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const doc = seed.document;
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    const exists = db.prepare('SELECT 1 FROM documents WHERE id = ?').get(doc.id);
    if (!exists) {
      const content = materializeSeed(seed);
      db.prepare(`INSERT INTO documents
        (id, title, content, current_revision, seed_metadata, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)`).run(doc.id, doc.title, content, JSON.stringify(seed), now);
      db.prepare(`INSERT INTO revisions
        (document_id, revision_number, content, created_at) VALUES (?, 1, ?, ?)`)
        .run(doc.id, content, now);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
seedDatabase();

function send(res, status, payload, headers = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': typeof payload === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers
  });
  res.end(body);
}

function documentDto(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    revision: row.current_revision,
    updatedAt: row.updated_at
  };
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 5_000_000) throw Object.assign(new Error('Request body is too large'), { status: 413 });
  }
  try {
    return JSON.parse(body || '{}');
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { status: 400 });
  }
}

function assertSaveRequest(pathId, body) {
  if (!body || body.id !== pathId) throw Object.assign(new Error('Document id does not match the request path'), { status: 400 });
  if (!Number.isInteger(body.baseRevision) || body.baseRevision < 1) {
    throw Object.assign(new Error('A valid baseRevision is required'), { status: 400 });
  }
}

function saveContent(id, baseRevision, content) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const current = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    if (!current) throw Object.assign(new Error('Unknown document'), { status: 404 });
    if (current.current_revision !== baseRevision) {
      throw Object.assign(new Error(`Save conflict: revision ${current.current_revision} is already current`), {
        status: 409,
        currentRevision: current.current_revision
      });
    }
    if (current.content === content) {
      db.exec('COMMIT');
      return { document: documentDto(current), unchanged: true };
    }
    const revision = current.current_revision + 1;
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO revisions
      (document_id, revision_number, content, created_at) VALUES (?, ?, ?, ?)`)
      .run(id, revision, content, now);
    db.prepare(`UPDATE documents SET content = ?, current_revision = ?, updated_at = ?
      WHERE id = ? AND current_revision = ?`)
      .run(content, revision, now, id, baseRevision);
    db.exec('COMMIT');
    return { document: { id, title: current.title, content, revision, updatedAt: now }, unchanged: false };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function serveStatic(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.resolve(PUBLIC_DIR, relative);
  if (!file.startsWith(`${PUBLIC_DIR}${path.sep}`)) return send(res, 404, { error: 'Not found' });
  try {
    const body = fs.readFileSync(file);
    const ext = path.extname(file);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Content-Length': body.length });
    res.end(body);
  } catch {
    send(res, 404, { error: 'Not found' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (req.method === 'GET' && pathname === '/api/documents') {
      const rows = db.prepare('SELECT id, title, current_revision, updated_at FROM documents ORDER BY title').all();
      return send(res, 200, rows.map(row => ({ id: row.id, title: row.title, revision: row.current_revision, updatedAt: row.updated_at })));
    }
    let match = pathname.match(/^\/api\/documents\/([^/]+)$/);
    if (match && req.method === 'GET') {
      const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(match[1]);
      return row ? send(res, 200, documentDto(row)) : send(res, 404, { error: 'Unknown document' });
    }
    if (match && req.method === 'PUT') {
      const body = await readJson(req);
      assertSaveRequest(match[1], body);
      if (typeof body.content !== 'string') return send(res, 400, { error: 'Content must be a string' });
      return send(res, 200, saveContent(match[1], body.baseRevision, body.content));
    }
    match = pathname.match(/^\/api\/documents\/([^/]+)\/revisions$/);
    if (match && req.method === 'GET') {
      const exists = db.prepare('SELECT 1 FROM documents WHERE id = ?').get(match[1]);
      if (!exists) return send(res, 404, { error: 'Unknown document' });
      const rows = db.prepare(`SELECT revision_number, created_at FROM revisions
        WHERE document_id = ? ORDER BY revision_number DESC LIMIT 20`).all(match[1]);
      return send(res, 200, rows.map(row => ({ revision: row.revision_number, createdAt: row.created_at })));
    }
    match = pathname.match(/^\/api\/documents\/([^/]+)\/revisions\/(\d+)$/);
    if (match && req.method === 'GET') {
      const row = db.prepare(`SELECT revision_number, content, created_at FROM revisions
        WHERE document_id = ? AND revision_number = ?`).get(match[1], Number(match[2]));
      return row ? send(res, 200, { revision: row.revision_number, content: row.content, createdAt: row.created_at })
        : send(res, 404, { error: 'Unknown document or revision' });
    }
    match = pathname.match(/^\/api\/documents\/([^/]+)\/restore$/);
    if (match && req.method === 'POST') {
      const body = await readJson(req);
      assertSaveRequest(match[1], body);
      if (!Number.isInteger(body.revision) || body.revision < 1) return send(res, 400, { error: 'A valid revision is required' });
      const historical = db.prepare(`SELECT content FROM revisions
        WHERE document_id = ? AND revision_number = ?`).get(match[1], body.revision);
      if (!historical) return send(res, 404, { error: 'Unknown document or revision' });
      return send(res, 200, saveContent(match[1], body.baseRevision, historical.content));
    }
    if (pathname.startsWith('/api/')) return send(res, 404, { error: 'API route not found' });
    return serveStatic(req, res, pathname);
  } catch (error) {
    const status = error.status || 500;
    const payload = { error: status === 500 ? 'Internal server error' : error.message };
    if (error.currentRevision) payload.currentRevision = error.currentRevision;
    if (status === 500) console.error(error);
    return send(res, status, payload);
  }
});

server.listen(PORT, HOST, () => console.log(`PatchPad listening on http://${HOST}:${PORT}`));

function shutdown() {
  server.close(() => { db.close(); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

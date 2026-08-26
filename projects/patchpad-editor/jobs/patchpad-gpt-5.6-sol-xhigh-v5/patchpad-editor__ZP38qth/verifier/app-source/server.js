import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(root, 'data', 'patchpad.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS documents (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL, summary TEXT NOT NULL,
 metadata TEXT NOT NULL, content TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS revisions (
 document_id TEXT NOT NULL, revision INTEGER NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(document_id, revision), FOREIGN KEY(document_id) REFERENCES documents(id)
);`);

function seed() {
  const seed = JSON.parse(readFileSync('/assets/incident_seed.json', 'utf8')).document;
  if (db.prepare('SELECT 1 FROM documents WHERE id=?').get(seed.id)) return;
  const generated = Array.from({ length: seed.generatedLineCount }, (_, i) => {
    const n = String(i + 1).padStart(seed.generatedLineNumberWidth, '0');
    return seed.generatedLineTemplate.replaceAll('{n}', n);
  });
  const content = [...seed.sections, ...generated, ...seed.tailSections].join('\n');
  const metadata = JSON.stringify({
    generatedLineCount: seed.generatedLineCount,
    generatedLineNumberWidth: seed.generatedLineNumberWidth,
    generatedLineTemplate: seed.generatedLineTemplate,
    tailSections: seed.tailSections
  });
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, 1, ?)').run(
      seed.id, seed.title, seed.author, seed.summary, metadata, content, now
    );
    db.prepare('INSERT INTO revisions VALUES (?, 1, ?, ?)').run(seed.id, content, now);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
seed();

const json = (res, status, value) => {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
  res.end(body);
};
const error = (res, status, message) => json(res, status, { error: message });
const rowToDoc = row => row && ({ ...row, metadata: JSON.parse(row.metadata) });

async function body(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 5_000_000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Malformed JSON body.'), { status: 400 }); }
}

async function api(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/documents') {
    return json(res, 200, db.prepare('SELECT id,title,author,summary,revision,updated_at FROM documents ORDER BY title').all());
  }
  let match = url.pathname.match(/^\/api\/documents\/([^/]+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    if (req.method === 'GET') {
      const doc = rowToDoc(db.prepare('SELECT * FROM documents WHERE id=?').get(id));
      return doc ? json(res, 200, doc) : error(res, 404, 'Unknown document.');
    }
    if (req.method === 'PUT') {
      let payload;
      try { payload = await body(req); } catch (e) { return error(res, e.status || 400, e.message); }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return error(res, 400, 'Save body must be an object.');
      if (typeof payload.id !== 'string' || payload.id !== id) return error(res, 400, 'Document id does not match the route.');
      if (!Number.isSafeInteger(payload.baseRevision) || payload.baseRevision < 1) return error(res, 400, 'A valid baseRevision is required.');
      if (typeof payload.content !== 'string') return error(res, 400, 'Content must be a string.');
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = db.prepare('SELECT content,revision FROM documents WHERE id=?').get(id);
        if (!current) { db.exec('ROLLBACK'); return error(res, 404, 'Unknown document.'); }
        if (current.revision !== payload.baseRevision) { db.exec('ROLLBACK'); return error(res, 409, `Save conflict: revision ${current.revision} is already current.`); }
        if (current.content === payload.content) { db.exec('COMMIT'); return json(res, 200, { revision: current.revision, unchanged: true }); }
        const revision = current.revision + 1;
        const now = new Date().toISOString();
        const changed = db.prepare('UPDATE documents SET content=?,revision=?,updated_at=? WHERE id=? AND revision=?')
          .run(payload.content, revision, now, id, payload.baseRevision).changes;
        if (changed !== 1) { db.exec('ROLLBACK'); return error(res, 409, 'Save conflict.'); }
        db.prepare('INSERT INTO revisions VALUES (?, ?, ?, ?)').run(id, revision, payload.content, now);
        db.exec('COMMIT');
        return json(res, 200, { revision, updated_at: now, unchanged: false });
      } catch (e) { try { db.exec('ROLLBACK'); } catch {} console.error(e); return error(res, 500, 'Save failed.'); }
    }
  }
  match = url.pathname.match(/^\/api\/documents\/([^/]+)\/revisions$/);
  if (req.method === 'GET' && match) {
    const id = decodeURIComponent(match[1]);
    if (!db.prepare('SELECT 1 FROM documents WHERE id=?').get(id)) return error(res, 404, 'Unknown document.');
    return json(res, 200, db.prepare('SELECT revision,created_at FROM revisions WHERE document_id=? ORDER BY revision DESC LIMIT 20').all(id));
  }
  match = url.pathname.match(/^\/api\/documents\/([^/]+)\/revisions\/(\d+)$/);
  if (req.method === 'GET' && match) {
    const row = db.prepare('SELECT revision,content,created_at FROM revisions WHERE document_id=? AND revision=?').get(decodeURIComponent(match[1]), Number(match[2]));
    return row ? json(res, 200, row) : error(res, 404, 'Unknown revision.');
  }
  error(res, 404, 'Unknown API route.');
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (!/^[\w.-]+$/.test(name)) return error(res, 404, 'Not found.');
  const path = join(root, 'public', name);
  if (!existsSync(path)) return error(res, 404, 'Not found.');
  const data = readFileSync(path);
  res.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'content-length': data.length });
  res.end(data);
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`PatchPad listening on ${process.env.PORT || 3000}`));

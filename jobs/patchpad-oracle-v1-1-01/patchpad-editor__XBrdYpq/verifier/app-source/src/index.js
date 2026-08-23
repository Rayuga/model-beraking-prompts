import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.resolve(__dirname, '../public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/documents', (_req, res) => {
  const documents = db.prepare(`
    SELECT id, title, author, current_revision, updated_at, length(content) AS length
    FROM documents
    ORDER BY title
  `).all();
  res.json({ documents });
});

app.get('/api/documents/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  res.json({ document: doc });
});

app.post('/api/documents/:id/save', (req, res) => {
  const { documentId, baseRevision, content } = req.body || {};
  if (documentId && documentId !== req.params.id) {
    return res.status(400).json({ error: 'Document id mismatch' });
  }
  if (!Number.isInteger(baseRevision) || typeof content !== 'string') {
    return res.status(400).json({ error: 'baseRevision and content are required' });
  }

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.current_revision !== baseRevision) {
    return res.status(409).json({
      error: 'Save conflict: this document has a newer saved revision',
      currentRevision: doc.current_revision,
      storedContent: doc.content
    });
  }
  if (doc.content === content) {
    return res.status(200).json({
      revision: doc.current_revision,
      unchanged: true,
      savedAt: doc.updated_at
    });
  }

  const nextRevision = doc.current_revision + 1;
  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE documents
      SET current_revision = ?, content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND current_revision = ?
    `).run(nextRevision, content, req.params.id, baseRevision);
    const changed = db.prepare('SELECT changes() AS changes').get().changes;
    if (!changed) {
      db.exec('ROLLBACK');
      return res.status(409).json({ error: 'Save conflict' });
    }
    db.prepare(`
      INSERT INTO revisions (document_id, revision, content)
      VALUES (?, ?, ?)
    `).run(req.params.id, nextRevision, content);
    db.exec('COMMIT');
    res.json({ revision: nextRevision, savedAt: new Date().toISOString() });
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('save failed', error);
    res.status(500).json({ error: 'Unable to save document' });
  }
});

app.get('/api/documents/:id/revisions', (req, res) => {
  const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const revisions = db.prepare(`
    SELECT document_id, revision, saved_at, length(content) AS length,
           substr(content, 1, 140) AS preview
    FROM revisions
    WHERE document_id = ?
    ORDER BY revision DESC
    LIMIT 20
  `).all(req.params.id);
  res.json({ revisions });
});

app.get('/api/documents/:id/revisions/:revision', (req, res) => {
  const revision = Number(req.params.revision);
  if (!Number.isInteger(revision)) return res.status(400).json({ error: 'Invalid revision' });
  const row = db.prepare(`
    SELECT * FROM revisions WHERE document_id = ? AND revision = ?
  `).get(req.params.id, revision);
  if (!row) return res.status(404).json({ error: 'Revision not found' });
  res.json({ revision: row });
});

app.use((_req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`PatchPad listening on http://0.0.0.0:${port}`);
});

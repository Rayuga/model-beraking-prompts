import express from 'express';
import path from 'node:path';
import { db } from './db.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.resolve('public')));

function rowToWorkbook(row) {
  return {
    id: row.id,
    title: row.title,
    revision: row.current_revision,
    workbook: JSON.parse(row.content)
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, app: 'gridforge-spreadsheet' });
});

app.get('/api/workbooks', (_req, res) => {
  const rows = db.prepare('SELECT id, title, current_revision FROM workbooks ORDER BY title').all();
  res.json({ workbooks: rows.map(row => ({ id: row.id, title: row.title, revision: row.current_revision })) });
});

app.get('/api/workbooks/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM workbooks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'unknown workbook' });
  res.json(rowToWorkbook(row));
});

app.post('/api/workbooks/:id/save', (req, res) => {
  const { workbookId, baseRevision, workbook } = req.body || {};
  if (workbookId && workbookId !== req.params.id) return res.status(400).json({ error: 'workbook id mismatch' });
  if (!Number.isInteger(baseRevision)) return res.status(400).json({ error: 'baseRevision required' });
  if (!workbook || typeof workbook !== 'object') return res.status(400).json({ error: 'workbook required' });
  const row = db.prepare('SELECT * FROM workbooks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'unknown workbook' });
  if (row.current_revision !== baseRevision) {
    return res.status(409).json({ error: 'stale revision', currentRevision: row.current_revision });
  }
  const content = JSON.stringify(workbook);
  if (content === row.content) {
    return res.json({ ok: true, unchanged: true, revision: row.current_revision });
  }
  const revision = row.current_revision + 1;
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE workbooks SET current_revision = ?, content = ?, updated_at = ?
      WHERE id = ?
    `).run(revision, content, now, req.params.id);
    db.prepare(`
      INSERT INTO revisions (workbook_id, revision, content, created_at)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, revision, content, now);
  });
  tx();
  res.json({ ok: true, revision });
});

app.get('/api/workbooks/:id/revisions', (req, res) => {
  const rows = db.prepare(`
    SELECT revision, created_at FROM revisions
    WHERE workbook_id = ?
    ORDER BY revision DESC
    LIMIT 20
  `).all(req.params.id);
  res.json({ revisions: rows });
});

app.get('/api/workbooks/:id/revisions/:revision', (req, res) => {
  const row = db.prepare(`
    SELECT revision, content, created_at FROM revisions
    WHERE workbook_id = ? AND revision = ?
  `).get(req.params.id, Number(req.params.revision));
  if (!row) return res.status(404).json({ error: 'unknown revision' });
  res.json({ revision: { revision: row.revision, created_at: row.created_at, workbook: JSON.parse(row.content) } });
});

app.listen(PORT, HOST, () => {
  console.log(`GridForge listening on http://${HOST}:${PORT}`);
});

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

function cellsOf(workbook) {
  return workbook?.sheets?.[0]?.cells || {};
}

function sheetIdOf(workbook) {
  return workbook?.sheets?.[0]?.id || 'plan';
}

function changedCells(fromWorkbook, toWorkbook) {
  const before = cellsOf(fromWorkbook);
  const after = cellsOf(toWorkbook);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => String(before[key] ?? '') !== String(after[key] ?? ''));
}

function applyCellChanges(targetWorkbook, sourceWorkbook, addresses) {
  const merged = structuredClone(targetWorkbook);
  const targetCells = merged.sheets[0].cells || {};
  const sourceCells = cellsOf(sourceWorkbook);
  for (const address of addresses) {
    const value = sourceCells[address];
    if (String(value ?? '') === '') delete targetCells[address];
    else targetCells[address] = value;
  }
  merged.sheets[0].cells = targetCells;
  return merged;
}

function getUser(req) {
  const requested = String(req.body?.userId || req.get('x-gridforge-user') || '').trim();
  if (requested) {
    const row = db.prepare('SELECT id, name FROM users WHERE id = ?').get(requested);
    if (row) return row;
  }
  return db.prepare('SELECT id, name FROM users ORDER BY id LIMIT 1').get();
}

function latestCellMeta(workbookId) {
  const rows = db.prepare(`
    SELECT h.cell_addr, h.user_id, u.name AS user_name, h.created_at, h.revision
    FROM cell_history h
    JOIN (
      SELECT cell_addr, MAX(id) AS id
      FROM cell_history
      WHERE workbook_id = ?
      GROUP BY cell_addr
    ) latest ON latest.id = h.id
    LEFT JOIN users u ON u.id = h.user_id
    ORDER BY h.cell_addr
  `).all(workbookId);
  return Object.fromEntries(rows.map((row) => [row.cell_addr, {
    userId: row.user_id,
    userName: row.user_name || row.user_id,
    editedAt: row.created_at,
    revision: row.revision
  }]));
}

function recordCellHistory({ workbookId, sheetId, revision, user, beforeWorkbook, afterWorkbook, addresses, createdAt }) {
  const before = cellsOf(beforeWorkbook);
  const after = cellsOf(afterWorkbook);
  const insert = db.prepare(`
    INSERT INTO cell_history
      (workbook_id, sheet_id, cell_addr, revision, user_id, old_value, new_value, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const address of addresses) {
    insert.run(
      workbookId,
      sheetId,
      address,
      revision,
      user.id,
      String(before[address] ?? ''),
      String(after[address] ?? ''),
      createdAt
    );
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, app: 'gridforge-spreadsheet' });
});

app.get('/api/users', (_req, res) => {
  const users = db.prepare('SELECT id, name FROM users ORDER BY name').all();
  res.json({ users });
});

app.get('/api/workbooks', (_req, res) => {
  const rows = db.prepare('SELECT id, title, current_revision FROM workbooks ORDER BY title').all();
  res.json({ workbooks: rows.map(row => ({ id: row.id, title: row.title, revision: row.current_revision })) });
});

app.get('/api/workbooks/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM workbooks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'unknown workbook' });
  res.json({ ...rowToWorkbook(row), cellMeta: latestCellMeta(req.params.id) });
});

app.post('/api/workbooks/:id/save', (req, res) => {
  const { workbookId, baseRevision, workbook } = req.body || {};
  if (workbookId && workbookId !== req.params.id) return res.status(400).json({ error: 'workbook id mismatch' });
  if (!Number.isInteger(baseRevision)) return res.status(400).json({ error: 'baseRevision required' });
  if (!workbook || typeof workbook !== 'object') return res.status(400).json({ error: 'workbook required' });
  const row = db.prepare('SELECT * FROM workbooks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'unknown workbook' });
  const user = getUser(req);
  const currentWorkbook = JSON.parse(row.content);
  const baseRow = db.prepare(`
    SELECT content FROM revisions WHERE workbook_id = ? AND revision = ?
  `).get(req.params.id, baseRevision);
  if (!baseRow) return res.status(409).json({ error: 'unknown base revision', currentRevision: row.current_revision });
  const baseWorkbook = JSON.parse(baseRow.content);
  const userChanged = changedCells(baseWorkbook, workbook);
  const serverChanged = changedCells(baseWorkbook, currentWorkbook);
  const conflicts = userChanged.filter((address) => serverChanged.includes(address));
  if (row.current_revision !== baseRevision && conflicts.length) {
    return res.status(409).json({ error: 'cell conflict', currentRevision: row.current_revision, conflictingCells: conflicts });
  }
  const savedWorkbook = row.current_revision === baseRevision
    ? workbook
    : applyCellChanges(currentWorkbook, workbook, userChanged);
  const content = JSON.stringify(savedWorkbook);
  if (content === row.content) {
    return res.json({ ok: true, unchanged: true, revision: row.current_revision });
  }
  const revision = row.current_revision + 1;
  const now = new Date().toISOString();
  const historyAddresses = changedCells(currentWorkbook, savedWorkbook);
  try {
    db.exec('BEGIN');
    db.prepare(`
      UPDATE workbooks SET current_revision = ?, content = ?, updated_at = ?
      WHERE id = ?
    `).run(revision, content, now, req.params.id);
    db.prepare(`
      INSERT INTO revisions (workbook_id, revision, content, created_at)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, revision, content, now);
    recordCellHistory({
      workbookId: req.params.id,
      sheetId: sheetIdOf(savedWorkbook),
      revision,
      user,
      beforeWorkbook: currentWorkbook,
      afterWorkbook: savedWorkbook,
      addresses: historyAddresses,
      createdAt: now
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  res.json({ ok: true, revision, workbook: savedWorkbook, merged: row.current_revision !== baseRevision, cellMeta: latestCellMeta(req.params.id) });
});

app.get('/api/workbooks/:id/cells/:addr/history', (req, res) => {
  const row = db.prepare('SELECT 1 FROM workbooks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'unknown workbook' });
  const rows = db.prepare(`
    SELECT h.cell_addr, h.revision, h.user_id, u.name AS user_name,
           h.old_value, h.new_value, h.created_at
    FROM cell_history h
    LEFT JOIN users u ON u.id = h.user_id
    WHERE h.workbook_id = ? AND h.cell_addr = ?
    ORDER BY h.id DESC
    LIMIT 20
  `).all(req.params.id, req.params.addr.toUpperCase());
  res.json({ history: rows.map((item) => ({
    cell: item.cell_addr,
    revision: item.revision,
    userId: item.user_id,
    userName: item.user_name || item.user_id,
    oldValue: item.old_value,
    newValue: item.new_value,
    editedAt: item.created_at
  })) });
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

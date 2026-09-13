const express = require('express');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const APP_ROOT = __dirname;
const DB_PATH = path.join(APP_ROOT, 'patchpad.sqlite');
const PORT = Number(process.env.PORT || 3000);
const SEED_PATH = '/assets/incident_seed.json';

const app = express();
const db = new DatabaseSync(DB_PATH);

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(APP_ROOT, 'public')));

function isoNow() {
  return new Date().toISOString();
}

function loadSeed() {
  return JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
}

function documentTextFromSeed(seed) {
  const doc = seed.document;
  const generatedLines = Array.from({ length: doc.generatedLineCount }, (_, index) =>
    doc.generatedLineTemplate.replaceAll('{n}', String(index + 1))
  );
  return [...doc.sections, ...generatedLines, ...doc.tailSections].join('\n');
}

function initializeSchema() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      current_revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      revision_number INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(document_id, revision_number),
      FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
  `);
}

function seedIfNeeded() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM documents').get().count;
  if (count > 0) {
    return;
  }

  const seed = loadSeed();
  const doc = seed.document;
  const content = documentTextFromSeed(seed);
  const now = isoNow();

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      'INSERT INTO documents (id, title, author, summary, content, current_revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(doc.id, doc.title, doc.author, doc.summary, content, 1, now, now);
    db.prepare(
      'INSERT INTO revisions (document_id, revision_number, content, created_at) VALUES (?, ?, ?, ?)'
    ).run(doc.id, 1, content, now);
    db.exec('COMMIT');
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw error;
  }
}

function listDocuments() {
  return db.prepare(
    'SELECT id, title, author, summary, current_revision AS currentRevision, updated_at AS updatedAt FROM documents ORDER BY title ASC'
  ).all();
}

function getDocument(documentId) {
  return db.prepare(
    'SELECT id, title, author, summary, content, current_revision AS currentRevision, created_at AS createdAt, updated_at AS updatedAt FROM documents WHERE id = ?'
  ).get(documentId);
}

function getRevisionHistory(documentId) {
  return db.prepare(
    'SELECT revision_number AS revisionNumber, created_at AS createdAt FROM revisions WHERE document_id = ? ORDER BY revision_number DESC'
  ).all(documentId);
}

function getRevision(documentId, revisionNumber) {
  return db.prepare(
    'SELECT document_id AS documentId, revision_number AS revisionNumber, content, created_at AS createdAt FROM revisions WHERE document_id = ? AND revision_number = ?'
  ).get(documentId, revisionNumber);
}

function reportPayload(documentId) {
  const document = getDocument(documentId);
  if (!document) {
    return null;
  }
  return {
    document,
    revisions: getRevisionHistory(documentId),
    reports: listDocuments(),
  };
}

function validateSaveBody(body, routeDocumentId) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.', status: 400 };
  }

  const { baseRevision, content, documentId } = body;

  if (documentId !== undefined && documentId !== routeDocumentId) {
    return { error: 'documentId must match the requested report.', status: 400 };
  }
  if (!Number.isInteger(baseRevision)) {
    return { error: 'baseRevision must be an integer.', status: 400 };
  }
  if (typeof content !== 'string') {
    return { error: 'content must be a text string.', status: 400 };
  }

  return { baseRevision, content };
}

app.get('/api/reports', (req, res) => {
  res.json({ reports: listDocuments() });
});

app.get('/api/reports/:documentId', (req, res) => {
  const payload = reportPayload(req.params.documentId);
  if (!payload) {
    res.status(404).json({ error: 'Unknown report.' });
    return;
  }
  res.json(payload);
});

app.get('/api/reports/:documentId/revisions', (req, res) => {
  const document = getDocument(req.params.documentId);
  if (!document) {
    res.status(404).json({ error: 'Unknown report.' });
    return;
  }
  res.json({ documentId: document.id, revisions: getRevisionHistory(document.id) });
});

app.get('/api/reports/:documentId/revisions/:revisionNumber', (req, res) => {
  const document = getDocument(req.params.documentId);
  if (!document) {
    res.status(404).json({ error: 'Unknown report.' });
    return;
  }
  const revisionNumber = Number(req.params.revisionNumber);
  if (!Number.isInteger(revisionNumber)) {
    res.status(400).json({ error: 'Revision number must be an integer.' });
    return;
  }
  const revision = getRevision(document.id, revisionNumber);
  if (!revision) {
    res.status(404).json({ error: 'Unknown revision.' });
    return;
  }
  res.json({
    documentId: revision.documentId,
    revisionNumber: revision.revisionNumber,
    content: revision.content,
    createdAt: revision.createdAt,
  });
});

app.post('/api/reports/:documentId/save', (req, res) => {
  const validation = validateSaveBody(req.body, req.params.documentId);
  if (validation.error) {
    res.status(validation.status || 400).json({ error: validation.error });
    return;
  }

  const documentId = req.params.documentId;
  const document = getDocument(documentId);
  if (!document) {
    res.status(404).json({ error: 'Unknown report.' });
    return;
  }

  if (validation.baseRevision !== document.currentRevision) {
    res.status(409).json({
      error: 'Save conflict: the report has changed on the server.',
      document: {
        id: document.id,
        currentRevision: document.currentRevision,
        content: document.content,
      },
    });
    return;
  }

  if (validation.content === document.content) {
    res.json({
      saved: true,
      changed: false,
      document: {
        id: document.id,
        currentRevision: document.currentRevision,
        updatedAt: document.updatedAt,
        content: document.content,
      },
    });
    return;
  }

  const nextRevision = document.currentRevision + 1;
  const now = isoNow();

  db.exec('BEGIN IMMEDIATE');
  try {
    const lockedDocument = getDocument(documentId);
    if (!lockedDocument) {
      db.exec('ROLLBACK');
      res.status(404).json({ error: 'Unknown report.' });
      return;
    }
    if (lockedDocument.currentRevision !== validation.baseRevision) {
      db.exec('ROLLBACK');
      res.status(409).json({
        error: 'Save conflict: the report has changed on the server.',
        document: {
          id: lockedDocument.id,
          currentRevision: lockedDocument.currentRevision,
          content: lockedDocument.content,
        },
      });
      return;
    }

    db.prepare(
      'INSERT INTO revisions (document_id, revision_number, content, created_at) VALUES (?, ?, ?, ?)'
    ).run(documentId, nextRevision, validation.content, now);
    db.prepare(
      'UPDATE documents SET content = ?, current_revision = ?, updated_at = ? WHERE id = ?'
    ).run(validation.content, nextRevision, now, documentId);
    db.exec('COMMIT');
    res.json({
      saved: true,
      changed: true,
      document: {
        id: documentId,
        currentRevision: nextRevision,
        updatedAt: now,
        content: validation.content,
      },
    });
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    res.status(500).json({ error: 'Unable to save the report.' });
  }
});

app.get('/', (req, res) => {
  const reports = listDocuments();
  const activeReportId = req.query.report && reports.some((report) => report.id === req.query.report)
    ? String(req.query.report)
    : reports[0]?.id || null;

  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PatchPad</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div id="appShell">
      <header class="app-header">
        <div>
          <div class="eyebrow">PatchPad</div>
          <h1>Incident report editor</h1>
          <p class="subtitle">Custom editing, revision history, and conflict-safe saving.</p>
        </div>
        <div class="report-list-card">
          <h2>Available reports</h2>
          <div id="report-list" data-active-report="${activeReportId || ''}">
            ${reports.map((report) => `
              <button type="button" class="report-chip${report.id === activeReportId ? ' active' : ''}" data-report-id="${report.id}">
                <strong>${escapeHtml(report.title)}</strong>
                <span>${escapeHtml(report.author)}</span>
                <small>Revision ${report.currentRevision}</small>
              </button>
            `).join('')}
          </div>
        </div>
      </header>
      <main class="workspace">
        <section class="editor-panel">
          <div class="editor-toolbar">
            <div class="toolbar-group">
              <button type="button" id="saveButton">Save</button>
              <button type="button" id="reloadButton">Reload latest</button>
              <button type="button" id="discardButton">Discard draft</button>
            </div>
            <div class="toolbar-group">
              <button type="button" id="undoButton">Undo</button>
              <button type="button" id="redoButton">Redo</button>
            </div>
            <div class="toolbar-group">
              <button type="button" id="findToggleButton">Find</button>
              <button type="button" id="findPrevButton">Find Previous</button>
              <button type="button" id="findNextButton">Find Next</button>
              <button type="button" id="replaceCurrentButton">Replace Current</button>
              <button type="button" id="replaceAllButton">Replace All</button>
            </div>
          </div>
          <div class="find-bar" id="findBar" hidden>
            <label>
              Find
              <input id="findInput" type="text" autocomplete="off" spellcheck="false" placeholder="Search report text" />
            </label>
            <label>
              Replace
              <input id="replaceInput" type="text" autocomplete="off" spellcheck="false" placeholder="Replacement text" />
            </label>
            <div class="find-summary">
              <span id="findCount">0 matches</span>
              <span id="findStatus"></span>
            </div>
          </div>
          <div class="document-title-block">
            <h2 id="documentTitle">Loading…</h2>
            <div class="document-meta" id="documentMeta"></div>
          </div>
          <div class="editor-shell">
            <div class="line-gutter" id="lineGutter" aria-hidden="true"></div>
            <div class="editor-scroll" id="editorScroll" tabindex="0" aria-label="PatchPad editor"></div>
          </div>
          <div class="status-bar">
            <div id="saveState">Loading report…</div>
            <div id="cursorState">Line 1, Column 1</div>
          </div>
          <div class="message-bar" id="messageBar" aria-live="polite"></div>
        </section>
        <aside class="history-panel">
          <div class="panel-header">
            <div>
              <h2>Revision history</h2>
              <p>Preview or restore earlier saved revisions.</p>
            </div>
          </div>
          <div id="historyList" class="history-list"></div>
        </aside>
      </main>
      <div id="previewModal" class="modal" hidden>
        <div class="modal-backdrop"></div>
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="previewTitle">
          <div class="modal-header">
            <div>
              <h3 id="previewTitle">Revision preview</h3>
              <p id="previewMeta"></p>
            </div>
            <button type="button" id="closePreviewButton">Close</button>
          </div>
          <div class="preview-shell">
            <div class="line-gutter preview-gutter" id="previewGutter" aria-hidden="true"></div>
            <div class="editor-scroll preview-scroll" id="previewScroll"></div>
          </div>
        </div>
      </div>
    </div>
    <script>
      window.__PATCHPAD_BOOT__ = ${JSON.stringify({ reports, activeReportId })};
    </script>
    <script src="/client.js"></script>
  </body>
</html>`);
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

initializeSchema();
seedIfNeeded();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PatchPad listening on 0.0.0.0:${PORT}`);
});

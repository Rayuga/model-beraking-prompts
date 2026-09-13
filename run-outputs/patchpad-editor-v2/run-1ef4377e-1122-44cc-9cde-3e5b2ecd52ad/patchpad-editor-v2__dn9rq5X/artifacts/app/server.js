const express = require('express');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DB_PATH = path.join(ROOT, 'patchpad.db');
const SEED_PATH = '/assets/incident_seed.json';

function nowIso() {
  return new Date().toISOString();
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readSeed() {
  const raw = fs.readFileSync(SEED_PATH, 'utf8');
  return JSON.parse(raw);
}

function buildSeedContent(seed) {
  const doc = seed.document;
  const generated = Array.from({ length: doc.generatedLineCount }, (_, index) => {
    const n = String(index + 1).padStart(doc.generatedLineNumberWidth, '0');
    return doc.generatedLineTemplate.replace(/\{n\}/g, n);
  });

  return [...doc.sections, ...generated, ...doc.tailSections].join('\n');
}

function createDatabase() {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      summary TEXT NOT NULL,
      current_content TEXT NOT NULL,
      current_revision INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(report_id, revision)
    );
  `);
  return db;
}

function seedDatabase(db) {
  const seed = readSeed();
  const doc = seed.document;
  const reportExists = db
    .prepare('SELECT 1 AS present FROM reports WHERE id = $id LIMIT 1')
    .get({ id: doc.id });

  if (reportExists) {
    return;
  }

  const content = buildSeedContent(seed);
  const timestamp = nowIso();

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      INSERT INTO reports (id, title, author, summary, current_content, current_revision, updated_at)
      VALUES ($id, $title, $author, $summary, $content, 1, $updated_at)
    `).run({
      id: doc.id,
      title: doc.title,
      author: doc.author,
      summary: doc.summary,
      content,
      updated_at: timestamp,
    });

    db.prepare(`
      INSERT INTO revisions (report_id, revision, content, created_at)
      VALUES ($report_id, 1, $content, $created_at)
    `).run({
      report_id: doc.id,
      content,
      created_at: timestamp,
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

const db = createDatabase();
seedDatabase(db);

const statements = {
  listReports: db.prepare(`
    SELECT id, title, author, summary, current_revision AS currentRevision, updated_at AS updatedAt
    FROM reports
    ORDER BY title COLLATE NOCASE, id COLLATE NOCASE
  `),
  getReport: db.prepare(`
    SELECT id, title, author, summary, current_content AS content, current_revision AS currentRevision, updated_at AS updatedAt
    FROM reports
    WHERE id = $id
  `),
  getRevision: db.prepare(`
    SELECT report_id AS reportId, revision, content, created_at AS createdAt
    FROM revisions
    WHERE report_id = $reportId AND revision = $revision
  `),
  listRevisions: db.prepare(`
    SELECT revision, created_at AS createdAt, length(content) AS contentLength
    FROM revisions
    WHERE report_id = $reportId
    ORDER BY revision DESC
  `),
};

function serializeReport(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    author: row.author,
    summary: row.summary,
    content: row.content,
    currentRevision: row.currentRevision,
    updatedAt: row.updatedAt,
  };
}

function serializeReportSummary(row) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    summary: row.summary,
    currentRevision: row.currentRevision,
    updatedAt: row.updatedAt,
  };
}

function validateRevisionParam(value) {
  if (!/^\d+$/.test(String(value))) {
    return null;
  }
  return Number.parseInt(value, 10);
}

function readJsonBody(req, res, next) {
  express.json({ limit: '2mb' })(req, res, next);
}

function getReportOr404(req, res) {
  const report = statements.getReport.get({ id: req.params.id });
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return null;
  }
  return report;
}

function renderPage(reports) {
  const selectedReportId = reports[0] ? reports[0].id : null;
  const reportCards = reports.length
    ? reports.map((report) => `
        <button class="report-card" type="button" data-report-id="${escapeHtml(report.id)}">
          <span class="report-card__title">${escapeHtml(report.title)}</span>
          <span class="report-card__meta">${escapeHtml(report.id)} · ${escapeHtml(report.author)}</span>
        </button>
      `).join('')
    : '<div class="empty-note">No reports are stored yet.</div>';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PatchPad</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <div class="app-shell">
      <header class="topbar">
        <div class="brand-block">
          <div class="brand-kicker">PatchPad</div>
          <div class="brand-copy">Browser editor for long incident reports</div>
        </div>
        <div class="global-status">
          <div id="save-state" class="status-pill">Loading…</div>
          <div id="cursor-state" class="status-copy">Cursor position unavailable</div>
        </div>
      </header>
      <main class="workspace">
        <aside class="side-panel">
          <section class="panel card">
            <div class="panel-head">
              <h2>Reports</h2>
            </div>
            <div id="report-list" class="report-list">
              ${reportCards}
            </div>
          </section>

          <section class="panel card history-panel">
            <div class="panel-head">
              <h2>Revision history</h2>
            </div>
            <div id="history-list" class="history-list">
              <div class="empty-note">Open a report to see its revisions.</div>
            </div>
            <div id="preview-pane" class="preview-pane">
              <div class="empty-note">Select a revision to preview it.</div>
            </div>
          </section>
        </aside>

        <section class="panel editor-panel card">
          <div class="editor-head">
            <div>
              <div class="panel-kicker">Open report</div>
              <h1 id="report-title" class="report-title">Northwind API Incident Report</h1>
              <div id="report-meta" class="report-meta">Author and revision details will appear here.</div>
            </div>
            <div class="toolbar" role="group" aria-label="Editor controls">
              <button type="button" id="save-button">Save</button>
              <button type="button" id="undo-button">Undo</button>
              <button type="button" id="redo-button">Redo</button>
              <button type="button" id="find-next-button">Find Next</button>
              <button type="button" id="replace-current-button">Replace Current</button>
              <button type="button" id="replace-all-button">Replace All</button>
              <button type="button" id="reload-button">Reload</button>
              <button type="button" id="discard-button">Discard draft</button>
            </div>
          </div>

          <div class="search-panel" role="search" aria-label="Find and replace">
            <label>
              <span>Find</span>
              <input id="find-input" type="text" autocomplete="off" spellcheck="false" placeholder="Search the report" />
            </label>
            <label>
              <span>Replace</span>
              <input id="replace-input" type="text" autocomplete="off" spellcheck="false" placeholder="Replacement text" />
            </label>
            <div class="search-actions">
              <button type="button" id="find-prev-button">Find Previous</button>
              <div id="match-count" class="match-count">0 matches</div>
            </div>
          </div>

          <div id="editor-viewport" class="editor-viewport" tabindex="0" aria-label="Document editor">
            <div id="editor-inner" class="editor-inner">
              <div class="empty-note editor-empty">Loading report…</div>
            </div>
          </div>

          <div id="feedback" class="feedback" aria-live="polite"></div>
        </section>
      </main>
    </div>

    <script id="patchpad-bootstrap" type="application/json">${safeJson({ reports, selectedReportId })}</script>
    <script src="/app.js" defer></script>
  </body>
</html>`;
}

const app = express();
app.disable('x-powered-by');
app.use(express.static(PUBLIC_DIR, { etag: false, maxAge: 0 }));

app.get('/', (req, res) => {
  const reports = statements.listReports.all();
  res.setHeader('Cache-Control', 'no-store');
  res.send(renderPage(reports));
});

app.get('/api/reports', (req, res) => {
  const reports = statements.listReports.all().map(serializeReportSummary);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ reports });
});

app.get('/api/reports/:id', (req, res) => {
  const report = getReportOr404(req, res);
  if (!report) {
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ report: serializeReport(report) });
});

app.get('/api/reports/:id/revisions', (req, res) => {
  const report = getReportOr404(req, res);
  if (!report) {
    return;
  }
  const revisions = statements.listRevisions.all({ reportId: report.id }).map((row) => ({
    revision: row.revision,
    createdAt: row.createdAt,
    contentLength: row.contentLength,
    current: row.revision === report.currentRevision,
  }));
  res.setHeader('Cache-Control', 'no-store');
  res.json({ reportId: report.id, revisions });
});

app.get('/api/reports/:id/revisions/:revision', (req, res) => {
  const report = getReportOr404(req, res);
  if (!report) {
    return;
  }
  const revision = validateRevisionParam(req.params.revision);
  if (!revision) {
    res.status(400).json({ error: 'Invalid revision number' });
    return;
  }
  const row = statements.getRevision.get({ reportId: report.id, revision });
  if (!row) {
    res.status(404).json({ error: 'Revision not found' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    revision: {
      reportId: row.reportId,
      revision: row.revision,
      createdAt: row.createdAt,
      content: row.content,
    },
  });
});

app.post('/api/reports/:id/save', readJsonBody, (req, res) => {
  const reportId = req.params.id;
  const body = req.body && typeof req.body === 'object' ? req.body : null;

  if (!body) {
    res.status(400).json({ error: 'Missing JSON body' });
    return;
  }

  if (typeof body.content !== 'string') {
    res.status(400).json({ error: 'Missing text content' });
    return;
  }

  if (!Number.isInteger(body.baseRevision)) {
    res.status(400).json({ error: 'baseRevision must be an integer' });
    return;
  }

  if (body.documentId !== undefined && body.documentId !== reportId) {
    res.status(400).json({ error: 'documentId does not match the target report' });
    return;
  }

  const current = db.prepare(`
    SELECT id, title, author, summary, current_content AS content, current_revision AS currentRevision, updated_at AS updatedAt
    FROM reports
    WHERE id = $id
  `).get({ id: reportId });

  if (!current) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  if (current.currentRevision !== body.baseRevision) {
    res.status(409).json({
      error: 'Stale revision',
      report: serializeReport(current),
    });
    return;
  }

  if (current.content === body.content) {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ saved: true, changed: false, report: serializeReport(current) });
    return;
  }

  const nextRevision = current.currentRevision + 1;
  const timestamp = nowIso();

  db.exec('BEGIN IMMEDIATE');
  try {
    const fresh = db.prepare(`
      SELECT current_content AS content, current_revision AS currentRevision
      FROM reports
      WHERE id = $id
    `).get({ id: reportId });

    if (!fresh) {
      db.exec('ROLLBACK');
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    if (fresh.currentRevision !== body.baseRevision) {
      db.exec('ROLLBACK');
      res.status(409).json({
        error: 'Stale revision',
        report: serializeReport({
          ...current,
          content: fresh.content,
          currentRevision: fresh.currentRevision,
        }),
      });
      return;
    }

    db.prepare(`
      INSERT INTO revisions (report_id, revision, content, created_at)
      VALUES ($reportId, $revision, $content, $createdAt)
    `).run({
      reportId,
      revision: nextRevision,
      content: body.content,
      createdAt: timestamp,
    });

    db.prepare(`
      UPDATE reports
      SET current_content = $content,
          current_revision = $revision,
          updated_at = $updatedAt
      WHERE id = $id
    `).run({
      content: body.content,
      revision: nextRevision,
      updatedAt: timestamp,
      id: reportId,
    });

    db.exec('COMMIT');

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      saved: true,
      changed: true,
      report: {
        id: current.id,
        title: current.title,
        author: current.author,
        summary: current.summary,
        content: body.content,
        currentRevision: nextRevision,
        updatedAt: timestamp,
      },
    });
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch (rollbackError) {
      void rollbackError;
    }
    res.status(500).json({ error: 'Failed to save report' });
  }
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(500).json({ error: 'Unexpected server error' });
});

const port = Number.parseInt(process.env.PORT || '3000', 10);
app.listen(port, '0.0.0.0', () => {
  console.log(`PatchPad listening on http://0.0.0.0:${port}`);
});

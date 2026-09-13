const express = require('express');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const DB_PATH = path.join(__dirname, 'patchpad.db');
const SEED_PATH = '/assets/incident_seed.json';
const PUBLIC_DIR = path.join(__dirname, 'public');

function readSeedDocument() {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  if (!seed || !seed.document) {
    throw new Error('Seed document is missing the document payload.');
  }
  return seed.document;
}

function buildSeedContent(document) {
  const lines = [];

  if (document.title) lines.push(`Title: ${document.title}`);
  if (document.author) lines.push(`Author: ${document.author}`);
  if (document.summary) lines.push(`Summary: ${document.summary}`);
  lines.push('');

  for (const section of document.sections || []) {
    lines.push(section);
  }

  const generatedCount = Number(document.generatedLineCount || 0);
  const width = Number(document.generatedLineNumberWidth || 1);
  const template = String(document.generatedLineTemplate || 'Log line {n}');
  for (let i = 1; i <= generatedCount; i += 1) {
    const number = String(i).padStart(width, '0');
    lines.push(template.replace(/\{n\}/g, number));
  }

  for (const tail of document.tailSections || []) {
    lines.push(tail);
  }

  return lines.join('\n');
}

function createDatabase() {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      summary TEXT NOT NULL,
      current_content TEXT NOT NULL,
      current_revision INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      revision_number INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      UNIQUE(report_id, revision_number)
    );

    CREATE INDEX IF NOT EXISTS idx_revisions_report_revision
      ON revisions(report_id, revision_number DESC);
  `);

  return db;
}

const db = createDatabase();
const seedDocument = readSeedDocument();
const seedContent = buildSeedContent(seedDocument);

const insertSeed = db.transaction(() => {
  const reportCount = db.prepare('SELECT COUNT(*) AS count FROM reports').get().count;
  if (reportCount > 0) {
    return;
  }

  db.prepare(
    `INSERT INTO reports (id, title, author, summary, current_content, current_revision, created_at, updated_at)
     VALUES (@id, @title, @author, @summary, @content, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).run({
    id: seedDocument.id,
    title: seedDocument.title,
    author: seedDocument.author,
    summary: seedDocument.summary,
    content: seedContent,
  });

  db.prepare(
    `INSERT INTO revisions (report_id, revision_number, content, created_at)
     VALUES (?, 1, ?, CURRENT_TIMESTAMP)`
  ).run(seedDocument.id, seedContent);
});

insertSeed();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb', type: ['application/json', 'application/*+json'] }));
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

const statements = {
  listReports: db.prepare('SELECT id, title, author, current_revision AS currentRevision, updated_at AS updatedAt FROM reports ORDER BY title COLLATE NOCASE, id'),
  getReport: db.prepare('SELECT id, title, author, summary, current_content AS currentContent, current_revision AS currentRevision, created_at AS createdAt, updated_at AS updatedAt FROM reports WHERE id = ?'),
  getRevisions: db.prepare('SELECT revision_number AS revisionNumber, created_at AS createdAt FROM revisions WHERE report_id = ? ORDER BY revision_number DESC'),
  getRevision: db.prepare('SELECT revision_number AS revisionNumber, content, created_at AS createdAt FROM revisions WHERE report_id = ? AND revision_number = ?'),
};

function getReportOr404(reportId, res) {
  const report = statements.getReport.get(reportId);
  if (!report) {
    res.status(404).json({ error: 'Report not found.' });
    return null;
  }
  return report;
}

function formatReport(report) {
  return {
    id: report.id,
    title: report.title,
    author: report.author,
    summary: report.summary,
    content: report.currentContent,
    currentRevision: report.currentRevision,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    revisions: statements.getRevisions.all(report.id),
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bootstrapJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

app.get('/', (req, res) => {
  const reports = statements.listReports.all();
  const currentId = reports[0] ? reports[0].id : null;
  const bootstrap = bootstrapJson({
    reports,
    currentId,
  });

  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PatchPad</title>
    <link rel="stylesheet" href="/styles.css" />
    <script>
      window.__PATCHPAD_BOOTSTRAP__ = ${bootstrap};
    </script>
  </head>
  <body>
    <div id="app-shell">
      <noscript>
        <div class="noscript">PatchPad requires JavaScript to edit reports.</div>
      </noscript>
      <div id="app"></div>
    </div>
    <script src="/app.js" defer></script>
  </body>
</html>`);
});

app.get('/api/reports', (req, res) => {
  res.json({ reports: statements.listReports.all() });
});

app.get('/api/reports/:reportId', (req, res) => {
  const report = getReportOr404(req.params.reportId, res);
  if (!report) return;
  res.json(formatReport(report));
});

app.get('/api/reports/:reportId/revisions', (req, res) => {
  const report = getReportOr404(req.params.reportId, res);
  if (!report) return;
  res.json({
    reportId: report.id,
    revisions: statements.getRevisions.all(report.id),
  });
});

app.get('/api/reports/:reportId/revisions/:revisionNumber', (req, res) => {
  const report = getReportOr404(req.params.reportId, res);
  if (!report) return;

  const revisionNumber = Number(req.params.revisionNumber);
  if (!Number.isInteger(revisionNumber) || revisionNumber < 1) {
    res.status(400).json({ error: 'Revision number must be a positive integer.' });
    return;
  }

  const revision = statements.getRevision.get(report.id, revisionNumber);
  if (!revision) {
    res.status(404).json({ error: 'Revision not found.' });
    return;
  }

  res.json({
    reportId: report.id,
    revisionNumber: revision.revisionNumber,
    createdAt: revision.createdAt,
    content: revision.content,
  });
});

app.post('/api/reports/:reportId/save', (req, res) => {
  const report = getReportOr404(req.params.reportId, res);
  if (!report) return;

  const { documentId, baseRevision, content } = req.body || {};
  if (documentId != null && documentId !== report.id) {
    res.status(400).json({ error: 'documentId does not match the target report.' });
    return;
  }

  if (!Number.isInteger(baseRevision)) {
    res.status(400).json({ error: 'baseRevision must be an integer.' });
    return;
  }

  if (typeof content !== 'string') {
    res.status(400).json({ error: 'content must be text.' });
    return;
  }

  if (baseRevision !== report.currentRevision) {
    res.status(409).json({
      error: 'Save rejected because the report has changed since editing started.',
      currentRevision: report.currentRevision,
      currentContent: report.currentContent,
      updatedAt: report.updatedAt,
    });
    return;
  }

  if (content === report.currentContent) {
    res.json({
      ok: true,
      saved: false,
      revision: report.currentRevision,
      updatedAt: report.updatedAt,
    });
    return;
  }

  const nextRevision = report.currentRevision + 1;
  const now = new Date().toISOString();
  const saveTransaction = db.transaction(() => {
    db.prepare(
      `INSERT INTO revisions (report_id, revision_number, content, created_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(report.id, nextRevision, content);

    db.prepare(
      `UPDATE reports
       SET current_content = ?, current_revision = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(content, nextRevision, report.id);
  });

  saveTransaction();

  res.json({
    ok: true,
    saved: true,
    revision: nextRevision,
    updatedAt: now,
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Malformed JSON request body.' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, HOST, () => {
  console.log(`PatchPad listening on http://${HOST}:${PORT}`);
  console.log(`SQLite path: ${DB_PATH}`);
});

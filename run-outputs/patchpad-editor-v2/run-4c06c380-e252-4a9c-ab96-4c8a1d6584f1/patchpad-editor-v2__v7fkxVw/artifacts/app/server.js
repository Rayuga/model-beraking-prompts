const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure database schema and seed initialized
db.getDb();

// API Routes

// 1. Available reports list
function handleListDocuments(req, res) {
  try {
    const docs = db.listDocuments();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list documents', message: err.message });
  }
}
app.get('/api/documents', handleListDocuments);
app.get('/api/reports', handleListDocuments);

// 2. Document detail
function handleGetDocument(req, res) {
  try {
    const doc = db.getDocument(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get document', message: err.message });
  }
}
app.get('/api/documents/:id', handleGetDocument);
app.get('/api/reports/:id', handleGetDocument);

// 3. Document revision list
function handleGetRevisions(req, res) {
  try {
    const doc = db.getDocument(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const revisions = db.getRevisions(req.params.id);
    res.json(revisions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get revisions', message: err.message });
  }
}
app.get('/api/documents/:id/revisions', handleGetRevisions);
app.get('/api/reports/:id/revisions', handleGetRevisions);

// 4. Specific revision content
function handleGetRevision(req, res) {
  try {
    const revNum = parseInt(req.params.rev, 10);
    if (isNaN(revNum)) {
      return res.status(400).json({ error: 'Invalid revision number' });
    }
    const revision = db.getRevision(req.params.id, revNum);
    if (!revision) {
      return res.status(404).json({ error: 'Revision not found' });
    }
    res.json(revision);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get revision', message: err.message });
  }
}
app.get('/api/documents/:id/revisions/:rev', handleGetRevision);
app.get('/api/reports/:id/revisions/:rev', handleGetRevision);

// 5. Save document (with conflict safety validation)
function handleSaveDocument(req, res) {
  try {
    const documentId = req.params.id;
    const { baseRevision, content, documentId: bodyDocId, author, summary } = req.body || {};

    if (bodyDocId !== undefined && bodyDocId !== null && bodyDocId !== documentId) {
      return res.status(400).json({ error: 'Document ID mismatch between URL and body' });
    }

    if (baseRevision === undefined || baseRevision === null || !Number.isInteger(baseRevision)) {
      return res.status(400).json({ error: 'Invalid baseRevision: must be an integer' });
    }

    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Invalid content: must be a string' });
    }

    const result = db.saveDocument({
      documentId,
      baseRevision,
      content,
      author,
      summary
    });

    if (result.status === 'not_found') {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (result.status === 'conflict') {
      return res.status(409).json({
        error: 'Conflict',
        message: `Conflict: Document has already been updated to revision ${result.currentRevision} by another session.`,
        currentRevision: result.currentRevision,
        currentContent: result.currentContent
      });
    }

    if (result.status === 'unchanged') {
      return res.status(200).json({
        ok: true,
        status: 'unchanged',
        revision: result.revision,
        message: 'Content is identical to current revision. No new revision was created.',
        timestamp: result.updatedAt
      });
    }

    return res.status(200).json({
      ok: true,
      status: 'saved',
      revision: result.revision,
      timestamp: result.updatedAt
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save document', message: err.message });
  }
}
app.post('/api/documents/:id/save', handleSaveDocument);
app.put('/api/documents/:id', handleSaveDocument);
app.post('/api/reports/:id/save', handleSaveDocument);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server if run directly
if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`PatchPad editor listening on http://${HOST}:${PORT}`);
  });
}

module.exports = app;

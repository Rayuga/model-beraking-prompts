const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure database is initialized
db.getDb();

// List all reports
app.get('/api/reports', (req, res) => {
  try {
    const reports = db.listDocuments();
    res.json(reports);
  } catch (err) {
    console.error('Error listing reports:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single report
app.get('/api/reports/:id', (req, res) => {
  try {
    const doc = db.getDocument(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(doc);
  } catch (err) {
    console.error('Error fetching report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save a report handler
function handleSave(req, res) {
  const { id } = req.params;
  const { baseRevision, content, documentId, comment } = req.body;

  // Validation
  if (documentId !== undefined && documentId !== null && documentId !== id) {
    return res.status(400).json({ error: 'documentId does not match the target document' });
  }

  if (baseRevision === undefined || typeof baseRevision !== 'number' || !Number.isInteger(baseRevision)) {
    return res.status(400).json({ error: 'baseRevision must be an integer' });
  }

  if (content === undefined || typeof content !== 'string') {
    return res.status(400).json({ error: 'content must be a string' });
  }

  try {
    const result = db.saveDocument(id, baseRevision, content, comment);
    return res.status(200).json(result);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    if (err.status === 409) {
      return res.status(409).json({
        error: err.message,
        serverRevision: err.currentRevision
      });
    }
    console.error('Save error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

app.post('/api/reports/:id/save', handleSave);
app.put('/api/reports/:id', handleSave);
app.post('/api/reports/:id', handleSave);

// Get revision history for a report
app.get('/api/reports/:id/revisions', (req, res) => {
  try {
    const doc = db.getDocument(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const revisions = db.getRevisions(req.params.id);
    res.json(revisions);
  } catch (err) {
    console.error('Error fetching revisions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific revision's content
app.get('/api/reports/:id/revisions/:revNum', (req, res) => {
  try {
    const revNum = parseInt(req.params.revNum, 10);
    if (isNaN(revNum)) {
      return res.status(400).json({ error: 'Invalid revision number' });
    }
    const revision = db.getRevisionContent(req.params.id, revNum);
    if (!revision) {
      return res.status(404).json({ error: 'Revision not found' });
    }
    res.json(revision);
  } catch (err) {
    console.error('Error fetching revision content:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve frontend SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listening
if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`PatchPad server listening on http://${HOST}:${PORT}`);
  });
}

module.exports = app;

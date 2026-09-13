const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Get list of all reports
app.get('/api/reports', (req, res) => {
  try {
    const reports = db.getAllDocuments();
    res.json(reports);
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get a specific report
app.get('/api/reports/:id', (req, res) => {
  try {
    const doc = db.getDocument(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const revisions = db.getRevisions(req.params.id);
    res.json({
      id: doc.id,
      title: doc.title,
      author: doc.author,
      content: doc.content,
      currentRevision: doc.currentRevision,
      revisions
    });
  } catch (err) {
    console.error('Error fetching report:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Get revision history
app.get('/api/reports/:id/revisions', (req, res) => {
  try {
    const revisions = db.getRevisions(req.params.id);
    res.json(revisions);
  } catch (err) {
    console.error('Error fetching revisions:', err);
    res.status(500).json({ error: 'Failed to fetch revisions' });
  }
});

// Get specific revision content
app.get('/api/reports/:id/revisions/:rev', (req, res) => {
  try {
    const rev = parseInt(req.params.rev, 10);
    if (isNaN(rev)) {
      return res.status(400).json({ error: 'Invalid revision number' });
    }

    const revision = db.getRevisionContent(req.params.id, rev);
    if (!revision) {
      return res.status(404).json({ error: 'Revision not found' });
    }

    res.json(revision);
  } catch (err) {
    console.error('Error fetching revision:', err);
    res.status(500).json({ error: 'Failed to fetch revision' });
  }
});

// Save a report
app.post('/api/reports/:id/save', (req, res) => {
  try {
    const { content, baseRevision, documentId } = req.body;

    // Validate input
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be text' });
    }
    if (!Number.isInteger(baseRevision)) {
      return res.status(400).json({ error: 'Base revision must be an integer' });
    }
    if (documentId && documentId !== req.params.id) {
      return res.status(400).json({ error: 'Document ID mismatch' });
    }

    const result = db.saveDocument(req.params.id, content, baseRevision);
    res.json(result);
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({
        error: 'Conflict: Document was modified by another tab',
        currentRevision: db.getDocument(req.params.id).currentRevision
      });
    }
    console.error('Error saving report:', err);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

// Serve main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PatchPad editor listening on http://0.0.0.0:${PORT}`);
});

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.text({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// API Routes

app.get('/api/documents', async (req, res) => {
  try {
    const documents = await db.listDocuments();
    res.json(documents);
  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

app.get('/api/documents/:id', async (req, res) => {
  try {
    const document = await db.getDocument(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

app.post('/api/documents/:id/save', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, baseRevision, documentId } = req.body;

    // Validate input
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be a string' });
    }
    if (typeof baseRevision !== 'number' || !Number.isInteger(baseRevision)) {
      return res.status(400).json({ error: 'baseRevision must be an integer' });
    }
    if (documentId && documentId !== id) {
      return res.status(400).json({ error: 'Document ID mismatch' });
    }

    const result = await db.saveDocument(id, content, baseRevision);
    res.json(result);
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({ error: error.message });
    }
    console.error('Error saving document:', error);
    res.status(500).json({ error: 'Failed to save document' });
  }
});

app.get('/api/documents/:id/history', async (req, res) => {
  try {
    const history = await db.getRevisionHistory(req.params.id);
    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.get('/api/documents/:id/revisions/:revisionNumber', async (req, res) => {
  try {
    const { id, revisionNumber } = req.params;
    const revision = await db.getRevision(id, parseInt(revisionNumber));
    if (!revision) {
      return res.status(404).json({ error: 'Revision not found' });
    }
    res.json(revision);
  } catch (error) {
    console.error('Error fetching revision:', error);
    res.status(500).json({ error: 'Failed to fetch revision' });
  }
});

app.post('/api/documents/:id/restore/:revisionNumber', async (req, res) => {
  try {
    const { id, revisionNumber } = req.params;
    const result = await db.restoreRevision(id, parseInt(revisionNumber));
    res.json(result);
  } catch (error) {
    console.error('Error restoring revision:', error);
    res.status(500).json({ error: 'Failed to restore revision' });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize database and start server
async function start() {
  try {
    await db.initializeDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`PatchPad server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

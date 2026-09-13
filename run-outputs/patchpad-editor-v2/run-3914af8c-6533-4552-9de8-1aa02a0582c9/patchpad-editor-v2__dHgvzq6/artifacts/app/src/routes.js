const express = require('express');
const { getDb } = require('./db');

const router = express.Router();

// List all documents
router.get('/reports', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, title, author, summary, current_revision, created_at, updated_at
      FROM documents
      ORDER BY id ASC
    `).all();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single document by ID
router.get('/reports/:id', (req, res) => {
  try {
    const db = getDb();
    const doc = db.prepare(`
      SELECT id, title, author, summary, current_revision, current_content, created_at, updated_at
      FROM documents
      WHERE id = ?
    `).get(req.params.id);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(doc);
  } catch (err) {
    console.error('Error fetching report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save document changes with conflict safety
function handleSave(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;
    const { baseRevision, content, documentId } = req.body;

    // Document ID check if provided
    if (documentId !== undefined && documentId !== id) {
      return res.status(400).json({ error: 'Document ID mismatch between URL and payload' });
    }

    // Content validation
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be a string' });
    }

    // baseRevision validation
    if (baseRevision === undefined || typeof baseRevision !== 'number' || !Number.isInteger(baseRevision)) {
      return res.status(400).json({ error: 'baseRevision must be an integer' });
    }

    // Fetch current document state
    const doc = db.prepare('SELECT id, current_revision, current_content FROM documents WHERE id = ?').get(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check for stale save (conflict)
    if (baseRevision !== doc.current_revision) {
      return res.status(409).json({
        error: 'Conflict: Document has been modified by another session',
        baseRevision,
        currentRevision: doc.current_revision
      });
    }

    // Check if content is unchanged
    if (content === doc.current_content) {
      return res.status(200).json({
        success: true,
        revision: doc.current_revision,
        changed: false,
        message: 'Content unchanged. Revision maintained.'
      });
    }

    // Create new revision
    const newRevision = doc.current_revision + 1;
    const now = new Date().toISOString();

    const updateDoc = db.prepare(`
      UPDATE documents
      SET current_revision = ?, current_content = ?, updated_at = ?
      WHERE id = ?
    `);

    const insertRev = db.prepare(`
      INSERT INTO revisions (document_id, revision, content, created_at)
      VALUES (?, ?, ?, ?)
    `);

    const saveTransaction = db.transaction(() => {
      updateDoc.run(newRevision, content, now, id);
      insertRev.run(id, newRevision, content, now);
    });

    saveTransaction();

    return res.status(200).json({
      success: true,
      revision: newRevision,
      changed: true,
      message: 'Saved new revision.'
    });
  } catch (err) {
    console.error('Error saving report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

router.post('/reports/:id/save', handleSave);
router.post('/reports/:id', handleSave);
router.put('/reports/:id', handleSave);

// Get revision history for a document
router.get('/reports/:id/revisions', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const rows = db.prepare(`
      SELECT revision, created_at, length(content) AS byte_length
      FROM revisions
      WHERE document_id = ?
      ORDER BY revision DESC
    `).all(id);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching revisions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific revision's content
router.get('/reports/:id/revisions/:rev', (req, res) => {
  try {
    const db = getDb();
    const { id, rev } = req.params;
    const revNum = parseInt(rev, 10);

    if (isNaN(revNum)) {
      return res.status(400).json({ error: 'Revision must be an integer' });
    }

    const row = db.prepare(`
      SELECT document_id, revision, content, created_at
      FROM revisions
      WHERE document_id = ? AND revision = ?
    `).get(id, revNum);

    if (!row) {
      return res.status(404).json({ error: 'Revision not found' });
    }

    res.json(row);
  } catch (err) {
    console.error('Error fetching revision details:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

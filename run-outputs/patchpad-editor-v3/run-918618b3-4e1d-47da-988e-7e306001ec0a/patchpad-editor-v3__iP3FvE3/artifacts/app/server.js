const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'patchpad.db');

app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('Database error:', err);
  else console.log('Connected to SQLite database');
});

// Database initialization
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    // Check if database is empty
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'", (err, row) => {
      if (row) {
        // Database already initialized
        resolve();
        return;
      }

      // Create tables
      db.serialize(() => {
        // Documents table
        db.run(`
          CREATE TABLE documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            summary TEXT,
            currentRevision INTEGER NOT NULL DEFAULT 1,
            content TEXT NOT NULL,
            lastModified TEXT NOT NULL
          )
        `);

        // Revisions table
        db.run(`
          CREATE TABLE revisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            documentId TEXT NOT NULL,
            revisionNumber INTEGER NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY(documentId) REFERENCES documents(id)
          )
        `);

        // Insert seed data
        const seedPath = '/assets/incident_seed.json';
        const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
        const doc = seedData.document;

        // Build the content from sections and generated lines
        let content = doc.sections.join('\n');
        
        // Add generated lines
        if (doc.generatedLineCount > 0) {
          const lines = [];
          for (let i = 1; i <= doc.generatedLineCount; i++) {
            const line = doc.generatedLineTemplate.replace(/{n}/g, i);
            lines.push(line);
          }
          content += '\n' + lines.join('\n');
        }

        // Add tail sections
        if (doc.tailSections) {
          content += '\n' + doc.tailSections.join('\n');
        }

        const timestamp = new Date().toISOString();
        
        db.run(
          `INSERT INTO documents (id, title, author, summary, currentRevision, content, lastModified)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [doc.id, doc.title, doc.author, doc.summary, 1, content, timestamp],
          function(err) {
            if (err) {
              console.error('Error inserting document:', err);
              reject(err);
              return;
            }

            // Insert initial revision
            db.run(
              `INSERT INTO revisions (documentId, revisionNumber, content, timestamp)
               VALUES (?, ?, ?, ?)`,
              [doc.id, 1, content, timestamp],
              (err) => {
                if (err) {
                  console.error('Error inserting revision:', err);
                  reject(err);
                } else {
                  resolve();
                }
              }
            );
          }
        );
      });
    });
  });
}

// API Routes
app.get('/api/reports', (req, res) => {
  db.all('SELECT id, title, author FROM documents', (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Failed to fetch reports' });
      return;
    }
    res.json(rows || []);
  });
});

app.get('/api/documents/:id', (req, res) => {
  const { id } = req.params;
  db.get(
    'SELECT id, title, author, summary, currentRevision, content FROM documents WHERE id = ?',
    [id],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: 'Database error' });
        return;
      }
      if (!row) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      res.json({
        id: row.id,
        title: row.title,
        author: row.author,
        summary: row.summary,
        currentRevision: row.currentRevision,
        content: row.content
      });
    }
  );
});

app.get('/api/documents/:id/history', (req, res) => {
  const { id } = req.params;
  db.all(
    'SELECT revisionNumber, timestamp FROM revisions WHERE documentId = ? ORDER BY revisionNumber DESC',
    [id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: 'Database error' });
        return;
      }
      res.json(rows || []);
    }
  );
});

app.get('/api/documents/:id/revisions/:revision', (req, res) => {
  const { id, revision } = req.params;
  db.get(
    'SELECT revisionNumber, content, timestamp FROM revisions WHERE documentId = ? AND revisionNumber = ?',
    [id, parseInt(revision)],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: 'Database error' });
        return;
      }
      if (!row) {
        res.status(404).json({ error: 'Revision not found' });
        return;
      }
      res.json(row);
    }
  );
});

app.post('/api/documents/:id/save', (req, res) => {
  const { id } = req.params;
  const { content, baseRevision, documentId } = req.body;

  // Validation
  if (!content || typeof content !== 'string') {
    res.status(400).json({ error: 'Invalid or missing content' });
    return;
  }
  if (!Number.isInteger(baseRevision)) {
    res.status(400).json({ error: 'Invalid or missing baseRevision' });
    return;
  }
  if (documentId && documentId !== id) {
    res.status(400).json({ error: 'Document ID mismatch' });
    return;
  }

  // Check current revision
  db.get('SELECT currentRevision, content FROM documents WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Conflict detection: if baseRevision doesn't match current revision, it's stale
    if (baseRevision !== row.currentRevision) {
      res.status(409).json({
        error: 'Stale save attempt',
        currentRevision: row.currentRevision,
        currentContent: row.content
      });
      return;
    }

    // Don't create new revision if content hasn't changed
    if (content === row.content) {
      res.json({ success: true, revision: row.currentRevision, contentUnchanged: true });
      return;
    }

    // Create new revision
    const newRevision = row.currentRevision + 1;
    const timestamp = new Date().toISOString();

    db.serialize(() => {
      db.run(
        'INSERT INTO revisions (documentId, revisionNumber, content, timestamp) VALUES (?, ?, ?, ?)',
        [id, newRevision, content, timestamp],
        (err) => {
          if (err) {
            res.status(500).json({ error: 'Failed to save revision' });
            return;
          }

          db.run(
            'UPDATE documents SET currentRevision = ?, content = ?, lastModified = ? WHERE id = ?',
            [newRevision, content, timestamp, id],
            (err) => {
              if (err) {
                res.status(500).json({ error: 'Failed to update document' });
                return;
              }
              res.json({ success: true, revision: newRevision });
            }
          );
        }
      );
    });
  });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PatchPad server running on http://0.0.0.0:${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

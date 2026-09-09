const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Database = require('./db');
const Workbook = require('./workbook');
const FormulaCalculator = require('./formula');

const app = express();
const db = new Database();
const workbookMgr = new Workbook(db);

const PORT = process.env.PORT || 3000;
const AUTOSAVE_DELAY = 5000;

let autosaveTimers = new Map();
let sessions = new Map();
let presenceData = new Map();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const users = [
  { id: 'riley', name: 'Riley Stone' },
  { id: 'morgan', name: 'Morgan Lee' },
  { id: 'priya', name: 'Priya Shah' }
];

async function initializeServer() {
  await db.init();
  await db.loadSeedIfNeeded();
  console.log(`✓ Database initialized at ${path.join(__dirname, 'gridforge.sqlite3')}`);
}

app.get('/api/workbooks/:workbookId', async (req, res) => {
  try {
    const { workbookId } = req.params;
    const snapshot = await workbookMgr.load(workbookId);
    
    const calc = new FormulaCalculator();
    const sheets = snapshot.sheets.map(sheet => ({
      ...sheet,
      cells: Object.fromEntries(
        Object.entries(sheet.cells).map(([addr, value]) => {
          calc.setCells(sheet.cells);
          const result = calc.calculate(value);
          return [addr, { value, result }];
        })
      )
    }));

    res.json({
      workbook: snapshot.workbook,
      sheets,
      revision: (await db.getWorkbook(workbookId)).current_revision,
      users
    });
  } catch (e) {
    console.error('Error loading workbook:', e);
    res.status(404).json({ error: e.message });
  }
});

app.get('/api/workbooks/:workbookId/revisions', async (req, res) => {
  try {
    const { workbookId } = req.params;
    const revisions = await db.getRevisions(workbookId);
    res.json({ revisions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/workbooks/:workbookId/revisions/:revision', async (req, res) => {
  try {
    const { workbookId, revision } = req.params;
    const revNum = parseInt(revision);
    const snapshot = await workbookMgr.load(workbookId, revNum);
    
    const calc = new FormulaCalculator();
    const sheets = snapshot.sheets.map(sheet => ({
      ...sheet,
      cells: Object.fromEntries(
        Object.entries(sheet.cells).map(([addr, value]) => {
          calc.setCells(sheet.cells);
          const result = calc.calculate(value);
          return [addr, { value, result }];
        })
      )
    }));

    res.json({
      workbook: snapshot.workbook,
      sheets,
      revision: revNum
    });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.get('/api/workbooks/:workbookId/sheets/:sheetId/cells/:address/history', async (req, res) => {
  try {
    const { workbookId, sheetId, address } = req.params;
    const history = await db.getCellHistory(workbookId, sheetId, address);
    res.json({ history });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/sessions', (req, res) => {
  try {
    const { workbookId, userId } = req.body;
    
    if (!workbookId || !userId) {
      return res.status(400).json({ error: 'Missing workbookId or userId' });
    }

    const validUser = users.find(u => u.id === userId);
    if (!validUser) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    const sessionId = uuidv4();
    const session = {
      sessionId,
      workbookId,
      userId,
      createdAt: new Date()
    };

    sessions.set(sessionId, session);
    
    if (!presenceData.has(workbookId)) {
      presenceData.set(workbookId, []);
    }
    
    presenceData.get(workbookId).push({
      sessionId,
      userId,
      cell: null,
      color: getColorForSession(sessionId, userId)
    });

    res.json({ sessionId, session });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    sessions.delete(sessionId);

    for (const [wbId, presence] of presenceData) {
      const idx = presence.findIndex(p => p.sessionId === sessionId);
      if (idx !== -1) {
        presence.splice(idx, 1);
      }
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/workbooks/:workbookId', async (req, res) => {
  try {
    const { workbookId } = req.params;
    const { snapshot, basedOnRevision, sessionId, changes } = req.body;

    if (!sessionId || !sessions.has(sessionId)) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const session = sessions.get(sessionId);
    if (session.workbookId !== workbookId) {
      return res.status(401).json({ error: 'Session workbook mismatch' });
    }

    if (!snapshot || typeof basedOnRevision !== 'number') {
      return res.status(400).json({ error: 'Missing snapshot or basedOnRevision' });
    }

    const result = await workbookMgr.saveWithConflictResolution(
      workbookId,
      basedOnRevision,
      snapshot,
      session.userId
    );

    res.json(result);
  } catch (e) {
    console.error('Error saving workbook:', e);
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/presence/:workbookId', (req, res) => {
  try {
    const { workbookId } = req.params;
    const presence = presenceData.get(workbookId) || [];
    
    const enrichedPresence = presence.map(p => ({
      ...p,
      user: users.find(u => u.id === p.userId)
    }));

    res.json({ presence: enrichedPresence });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/presence/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { cell, range } = req.body;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const workbookId = session.workbookId;
    const presence = presenceData.get(workbookId) || [];
    const p = presence.find(pr => pr.sessionId === sessionId);
    
    if (p) {
      p.cell = cell;
      p.range = range;
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/calculate', (req, res) => {
  try {
    const { cells, address } = req.body;
    
    if (!cells || !address) {
      return res.status(400).json({ error: 'Missing cells or address' });
    }

    const calc = new FormulaCalculator(cells);
    const value = cells[address];
    const result = calc.calculate(value);

    res.json({ address, value, result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

function getColorForSession(sessionId, userId) {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
  const hash = (sessionId + userId).split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  return colors[hash % colors.length];
}

async function startServer() {
  try {
    await initializeServer();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`GridForge server running on port ${PORT}`);
      console.log(`Open http://localhost:${PORT} in your browser`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await db.close();
  process.exit(0);
});

startServer();

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.GRIDFORGE_DB_PATH || path.join(__dirname, '..', 'gridforge.db');
const SEED_PATH = process.env.GRIDFORGE_SEED_PATH || '/assets/workbook_seed.json';

function initDatabase(dbFilePath = DB_PATH) {
  const db = new Database(dbFilePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS workbooks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      current_revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sheets (
      id TEXT NOT NULL,
      workbook_id TEXT NOT NULL,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (workbook_id, id),
      FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cells (
      workbook_id TEXT NOT NULL,
      sheet_id TEXT NOT NULL,
      cell_ref TEXT NOT NULL,
      raw_value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT,
      PRIMARY KEY (workbook_id, sheet_id, cell_ref),
      FOREIGN KEY (workbook_id, sheet_id) REFERENCES sheets(workbook_id, id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workbook_id TEXT NOT NULL,
      revision_number INTEGER NOT NULL,
      user_id TEXT,
      user_name TEXT,
      description TEXT,
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (workbook_id, revision_number),
      FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cell_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workbook_id TEXT NOT NULL,
      sheet_id TEXT NOT NULL,
      cell_ref TEXT NOT NULL,
      revision_number INTEGER NOT NULL,
      old_value TEXT,
      new_value TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cell_history_lookup 
      ON cell_history(workbook_id, sheet_id, cell_ref, revision_number DESC);
  `);

  seedIfEmpty(db);
  return db;
}

const DEFAULT_USER_COLORS = {
  riley: '#2563eb',  // blue
  morgan: '#059669', // emerald
  priya: '#7c3aed',  // purple
};

function seedIfEmpty(db) {
  const rowCount = db.prepare('SELECT COUNT(*) as count FROM workbooks').get();
  if (rowCount && rowCount.count > 0) {
    return; // Already seeded
  }

  let seedData = null;
  if (fs.existsSync(SEED_PATH)) {
    try {
      const raw = fs.readFileSync(SEED_PATH, 'utf8');
      seedData = JSON.parse(raw);
    } catch (err) {
      console.error('Failed to parse seed data from', SEED_PATH, err);
    }
  }

  if (!seedData || !seedData.workbook) {
    console.warn('No seed data found, initializing default workbook');
    seedData = {
      users: [
        { id: 'riley', name: 'Riley Stone' },
        { id: 'morgan', name: 'Morgan Lee' },
        { id: 'priya', name: 'Priya Shah' }
      ],
      workbook: {
        id: 'ops-plan',
        title: 'Northwind Operations Plan',
        sheets: [
          {
            id: 'plan',
            name: 'Plan',
            cells: {}
          }
        ]
      }
    };
  }

  const now = new Date().toISOString();
  const insertTransaction = db.transaction(() => {
    // Insert users
    const insertUser = db.prepare('INSERT OR REPLACE INTO users (id, name, color) VALUES (?, ?, ?)');
    for (const u of (seedData.users || [])) {
      const color = DEFAULT_USER_COLORS[u.id] || '#d97706';
      insertUser.run(u.id, u.name, color);
    }

    const wb = seedData.workbook;
    // Insert workbook
    db.prepare('INSERT INTO workbooks (id, title, current_revision, created_at, updated_at) VALUES (?, ?, 1, ?, ?)')
      .run(wb.id, wb.title, now, now);

    const insertSheet = db.prepare('INSERT INTO sheets (id, workbook_id, name, order_index) VALUES (?, ?, ?, ?)');
    const insertCell = db.prepare('INSERT INTO cells (workbook_id, sheet_id, cell_ref, raw_value, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)');
    const insertCellHistory = db.prepare(`
      INSERT INTO cell_history (workbook_id, sheet_id, cell_ref, revision_number, old_value, new_value, user_id, user_name, created_at)
      VALUES (?, ?, ?, 1, NULL, ?, 'system', 'Seed Data', ?)
    `);

    (wb.sheets || []).forEach((sheet, sheetIdx) => {
      insertSheet.run(sheet.id, wb.id, sheet.name, sheetIdx);
      if (sheet.cells) {
        for (const [ref, val] of Object.entries(sheet.cells)) {
          const strVal = String(val);
          insertCell.run(wb.id, sheet.id, ref.toUpperCase(), strVal, now, 'system');
          insertCellHistory.run(wb.id, sheet.id, ref.toUpperCase(), strVal, now);
        }
      }
    });

    // Create Revision 1 snapshot
    const initialSnapshot = {
      id: wb.id,
      title: wb.title,
      sheets: (wb.sheets || []).map(s => ({
        id: s.id,
        name: s.name,
        cells: { ...s.cells }
      }))
    };

    db.prepare(`
      INSERT INTO revisions (workbook_id, revision_number, user_id, user_name, description, snapshot, created_at)
      VALUES (?, 1, 'system', 'Initial seed', 'Initial revision', ?, ?)
    `).run(wb.id, JSON.stringify(initialSnapshot), now);
  });

  insertTransaction();
  console.log(`Database seeded with workbook "${seedData.workbook.title}" (Revision 1)`);
}

class StorageEngine {
  constructor(db) {
    this.db = db;
  }

  getUsers() {
    return this.db.prepare('SELECT id, name, color FROM users').all();
  }

  getUser(userId) {
    return this.db.prepare('SELECT id, name, color FROM users WHERE id = ?').get(userId);
  }

  getWorkbook(workbookId) {
    const wb = this.db.prepare('SELECT id, title, current_revision, created_at, updated_at FROM workbooks WHERE id = ?').get(workbookId);
    if (!wb) return null;

    const sheets = this.db.prepare('SELECT id, name, order_index FROM sheets WHERE workbook_id = ? ORDER BY order_index ASC').all(workbookId);
    const cells = this.db.prepare('SELECT sheet_id, cell_ref, raw_value, updated_at, updated_by FROM cells WHERE workbook_id = ?').all(workbookId);

    const sheetMap = {};
    sheets.forEach(s => {
      sheetMap[s.id] = {
        id: s.id,
        name: s.name,
        cells: {}
      };
    });

    cells.forEach(c => {
      if (sheetMap[c.sheet_id]) {
        sheetMap[c.sheet_id].cells[c.cell_ref] = c.raw_value;
      }
    });

    return {
      id: wb.id,
      title: wb.title,
      current_revision: wb.current_revision,
      created_at: wb.created_at,
      updated_at: wb.updated_at,
      sheets: sheets.map(s => sheetMap[s.id]),
      users: this.getUsers()
    };
  }

  getWorkbookSnapshot(workbookId) {
    const wb = this.getWorkbook(workbookId);
    if (!wb) return null;
    return {
      id: wb.id,
      title: wb.title,
      sheets: wb.sheets.map(s => ({
        id: s.id,
        name: s.name,
        cells: { ...s.cells }
      }))
    };
  }

  getRevisions(workbookId) {
    return this.db.prepare(`
      SELECT revision_number, user_id, user_name, description, created_at 
      FROM revisions 
      WHERE workbook_id = ? 
      ORDER BY revision_number DESC
    `).all(workbookId);
  }

  getRevision(workbookId, revisionNumber) {
    const row = this.db.prepare(`
      SELECT revision_number, user_id, user_name, description, snapshot, created_at 
      FROM revisions 
      WHERE workbook_id = ? AND revision_number = ?
    `).get(workbookId, revisionNumber);
    if (!row) return null;
    return {
      revision_number: row.revision_number,
      user_id: row.user_id,
      user_name: row.user_name,
      description: row.description,
      snapshot: JSON.parse(row.snapshot),
      created_at: row.created_at
    };
  }

  getCellHistory(workbookId, sheetId, cellRef) {
    return this.db.prepare(`
      SELECT id, workbook_id, sheet_id, cell_ref, revision_number, old_value, new_value, user_id, user_name, created_at 
      FROM cell_history 
      WHERE workbook_id = ? AND sheet_id = ? AND cell_ref = ?
      ORDER BY revision_number DESC, id DESC
    `).all(workbookId, sheetId, cellRef.toUpperCase());
  }

  saveWorkbook(workbookId, baseRevision, snapshot, userId, userName, description = 'Update') {
    // 1. Validation checks
    if (!Number.isInteger(baseRevision) || baseRevision < 1) {
      return { success: false, error: 'Invalid base revision: must be a positive integer', statusCode: 400 };
    }
    if (!snapshot || typeof snapshot !== 'object') {
      return { success: false, error: 'Malformed snapshot: must be an object', statusCode: 400 };
    }
    if (snapshot.id !== workbookId) {
      return { success: false, error: `Mismatched workbook ID: expected ${workbookId}, got ${snapshot.id}`, statusCode: 400 };
    }
    if (!Array.isArray(snapshot.sheets) || snapshot.sheets.length === 0) {
      return { success: false, error: 'Workbook must have at least one sheet', statusCode: 400 };
    }

    const currentWb = this.getWorkbook(workbookId);
    if (!currentWb) {
      return { success: false, error: 'Workbook not found', statusCode: 404 };
    }

    if (snapshot.title !== currentWb.title) {
      return { success: false, error: 'Cannot rename workbook in cell edit save', statusCode: 400 };
    }

    // Validate sheets
    const currentSheetMap = {};
    currentWb.sheets.forEach(s => { currentSheetMap[s.id] = s; });

    for (const sheet of snapshot.sheets) {
      if (!sheet.id || !currentSheetMap[sheet.id]) {
        return { success: false, error: `Unknown sheet identity: ${sheet.id}`, statusCode: 400 };
      }
      if (sheet.name !== currentSheetMap[sheet.id].name) {
        return { success: false, error: `Cannot rename sheet ${sheet.id} in cell edit save`, statusCode: 400 };
      }
      if (!sheet.cells || typeof sheet.cells !== 'object' || Array.isArray(sheet.cells)) {
        return { success: false, error: `Malformed cells object for sheet ${sheet.id}`, statusCode: 400 };
      }
      // Check every cell value is a string
      for (const [ref, val] of Object.entries(sheet.cells)) {
        if (typeof val !== 'string') {
          return { success: false, error: `Cell ${ref} value must be a string, got ${typeof val}`, statusCode: 400 };
        }
        if (!/^[A-Za-z]+[1-9][0-9]*$/.test(ref)) {
          return { success: false, error: `Invalid cell reference: ${ref}`, statusCode: 400 };
        }
      }
    }

    const currentRev = currentWb.current_revision;

    if (baseRevision > currentRev) {
      return { success: false, error: `Base revision ${baseRevision} is in the future (current is ${currentRev})`, statusCode: 400 };
    }

    // Normalize snapshot cells to uppercase references
    const normalizedSnapshot = {
      id: snapshot.id,
      title: snapshot.title,
      sheets: snapshot.sheets.map(s => {
        const normCells = {};
        for (const [ref, val] of Object.entries(s.cells)) {
          if (val !== '') {
            normCells[ref.toUpperCase()] = val;
          }
        }
        return {
          id: s.id,
          name: s.name,
          cells: normCells
        };
      })
    };

    // Calculate diff between incoming snapshot and current state
    const incomingSheet = normalizedSnapshot.sheets[0];
    const currentSheet = currentWb.sheets.find(s => s.id === incomingSheet.id) || currentWb.sheets[0];

    // Case 1: baseRevision === currentRev
    if (baseRevision === currentRev) {
      // Find diff between current state and incoming snapshot
      const cellDiff = this._computeCellDiff(currentSheet.cells, incomingSheet.cells);
      if (cellDiff.length === 0) {
        // No changes, no new revision needed
        return {
          success: true,
          revision: currentRev,
          workbook: this.getWorkbookSnapshot(workbookId),
          noChange: true
        };
      }

      // Apply changes and create next revision
      const nextRev = currentRev + 1;
      const now = new Date().toISOString();

      const saveTx = this.db.transaction(() => {
        this._applyCellDiff(workbookId, incomingSheet.id, cellDiff, nextRev, userId, userName, now);
        this.db.prepare('UPDATE workbooks SET current_revision = ?, updated_at = ? WHERE id = ?')
          .run(nextRev, now, workbookId);
        this.db.prepare(`
          INSERT INTO revisions (workbook_id, revision_number, user_id, user_name, description, snapshot, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(workbookId, nextRev, userId, userName, description, JSON.stringify(normalizedSnapshot), now);
      });

      saveTx();

      return {
        success: true,
        revision: nextRev,
        workbook: normalizedSnapshot,
        changes: cellDiff
      };
    }

    // Case 2: baseRevision < currentRev (Concurrent save)
    // Fetch snapshot at baseRevision
    const baseRevRecord = this.getRevision(workbookId, baseRevision);
    if (!baseRevRecord) {
      return { success: false, error: `Base revision ${baseRevision} not found in history`, statusCode: 400 };
    }

    const baseSnapshot = baseRevRecord.snapshot;
    const baseSheet = baseSnapshot.sheets.find(s => s.id === incomingSheet.id) || baseSnapshot.sheets[0];

    // Find which cells the incoming save changed compared to baseRevision
    const incomingChangedCells = new Set();
    const allBaseKeys = new Set([...Object.keys(baseSheet.cells || {}), ...Object.keys(incomingSheet.cells || {})]);
    for (const key of allBaseKeys) {
      const baseVal = (baseSheet.cells && baseSheet.cells[key]) || '';
      const incVal = (incomingSheet.cells && incomingSheet.cells[key]) || '';
      if (baseVal !== incVal) {
        incomingChangedCells.add(key);
      }
    }

    // Find which cells changed on server since baseRevision (in revisions baseRevision+1 .. currentRev)
    const serverChanges = this.db.prepare(`
      SELECT DISTINCT cell_ref 
      FROM cell_history 
      WHERE workbook_id = ? AND sheet_id = ? AND revision_number > ? AND revision_number <= ?
    `).all(workbookId, incomingSheet.id, baseRevision, currentRev);

    const serverChangedCells = new Set(serverChanges.map(r => r.cell_ref));

    // Check for overlapping conflicting cells
    const conflicts = [];
    for (const cell of incomingChangedCells) {
      if (serverChangedCells.has(cell)) {
        conflicts.push(cell);
      }
    }

    if (conflicts.length > 0) {
      // Reject overlapping stale save
      return {
        success: false,
        conflict: true,
        conflictingCells: conflicts,
        currentRevision: currentRev,
        error: `Conflict: Stale save overlaps with changes made in revisions ${baseRevision + 1} to ${currentRev} on cell(s): ${conflicts.join(', ')}`,
        statusCode: 409
      };
    }

    // Non-overlapping changes! Perform 3-way merge onto current state
    const mergedCells = { ...currentSheet.cells };
    const cellDiff = [];

    for (const cell of incomingChangedCells) {
      const oldVal = mergedCells[cell] || '';
      const newVal = incomingSheet.cells[cell] || '';
      if (newVal === '') {
        delete mergedCells[cell];
      } else {
        mergedCells[cell] = newVal;
      }
      cellDiff.push({ cell, oldVal, newVal });
    }

    const mergedSnapshot = {
      id: workbookId,
      title: currentWb.title,
      sheets: [
        {
          id: incomingSheet.id,
          name: incomingSheet.name,
          cells: mergedCells
        }
      ]
    };

    const nextRev = currentRev + 1;
    const now = new Date().toISOString();

    const mergeTx = this.db.transaction(() => {
      this._applyCellDiff(workbookId, incomingSheet.id, cellDiff, nextRev, userId, userName, now);
      this.db.prepare('UPDATE workbooks SET current_revision = ?, updated_at = ? WHERE id = ?')
        .run(nextRev, now, workbookId);
      this.db.prepare(`
        INSERT INTO revisions (workbook_id, revision_number, user_id, user_name, description, snapshot, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(workbookId, nextRev, userId, userName, description + ' (Merged)', JSON.stringify(mergedSnapshot), now);
    });

    mergeTx();

    return {
      success: true,
      revision: nextRev,
      workbook: mergedSnapshot,
      changes: cellDiff,
      merged: true
    };
  }

  _computeCellDiff(currentCells, incomingCells) {
    const diff = [];
    const allKeys = new Set([...Object.keys(currentCells || {}), ...Object.keys(incomingCells || {})]);
    for (const key of allKeys) {
      const currVal = (currentCells && currentCells[key]) || '';
      const incVal = (incomingCells && incomingCells[key]) || '';
      if (currVal !== incVal) {
        diff.push({ cell: key, oldVal: currVal, newVal: incVal });
      }
    }
    return diff;
  }

  _applyCellDiff(workbookId, sheetId, diff, revisionNumber, userId, userName, timestamp) {
    const insertCell = this.db.prepare('INSERT OR REPLACE INTO cells (workbook_id, sheet_id, cell_ref, raw_value, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)');
    const deleteCell = this.db.prepare('DELETE FROM cells WHERE workbook_id = ? AND sheet_id = ? AND cell_ref = ?');
    const insertCellHistory = this.db.prepare(`
      INSERT INTO cell_history (workbook_id, sheet_id, cell_ref, revision_number, old_value, new_value, user_id, user_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const change of diff) {
      if (change.newVal === '') {
        deleteCell.run(workbookId, sheetId, change.cell);
      } else {
        insertCell.run(workbookId, sheetId, change.cell, change.newVal, timestamp, userId);
      }
      insertCellHistory.run(workbookId, sheetId, change.cell, revisionNumber, change.oldVal || null, change.newVal, userId, userName, timestamp);
    }
  }
}

module.exports = {
  DB_PATH,
  SEED_PATH,
  initDatabase,
  StorageEngine
};

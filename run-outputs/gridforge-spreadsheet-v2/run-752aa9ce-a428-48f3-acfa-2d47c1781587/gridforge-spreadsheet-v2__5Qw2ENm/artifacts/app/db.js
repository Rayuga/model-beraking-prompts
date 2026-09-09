const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'gridforge.sqlite3');

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) reject(err);
        else this.setupSchema().then(resolve).catch(reject);
      });
    });
  }

  async setupSchema() {
    return Promise.all([
      this.run(`
        CREATE TABLE IF NOT EXISTS workbooks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          current_revision INTEGER NOT NULL DEFAULT 0
        )
      `),
      this.run(`
        CREATE TABLE IF NOT EXISTS sheets (
          id TEXT NOT NULL,
          workbook_id TEXT NOT NULL,
          name TEXT NOT NULL,
          PRIMARY KEY (workbook_id, id),
          FOREIGN KEY (workbook_id) REFERENCES workbooks(id)
        )
      `),
      this.run(`
        CREATE TABLE IF NOT EXISTS revisions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workbook_id TEXT NOT NULL,
          revision INTEGER NOT NULL,
          snapshot TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(workbook_id, revision),
          FOREIGN KEY (workbook_id) REFERENCES workbooks(id)
        )
      `),
      this.run(`
        CREATE TABLE IF NOT EXISTS cell_changes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workbook_id TEXT NOT NULL,
          sheet_id TEXT NOT NULL,
          cell_address TEXT NOT NULL,
          revision INTEGER NOT NULL,
          previous_value TEXT,
          new_value TEXT NOT NULL,
          user_id TEXT NOT NULL,
          changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (workbook_id) REFERENCES workbooks(id)
        )
      `),
      this.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          workbook_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
    ]);
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async loadSeedIfNeeded() {
    const seedPath = path.join(__dirname, '../assets/workbook_seed.json');
    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    
    const existing = await this.get('SELECT id FROM workbooks WHERE id = ?', [seed.workbook.id]);
    if (existing) return;

    const workbook = seed.workbook;
    await this.run('INSERT INTO workbooks (id, title, current_revision) VALUES (?, ?, ?)', 
      [workbook.id, workbook.title, 0]);

    for (const sheet of workbook.sheets) {
      await this.run('INSERT INTO sheets (workbook_id, id, name) VALUES (?, ?, ?)',
        [workbook.id, sheet.id, sheet.name]);
    }

    const snapshot = {
      workbook: {
        id: workbook.id,
        title: workbook.title,
        sheets: workbook.sheets.map(s => ({ id: s.id, name: s.name }))
      },
      sheets: workbook.sheets.map(s => ({
        id: s.id,
        name: s.name,
        cells: s.cells || {}
      }))
    };

    await this.run(
      'INSERT INTO revisions (workbook_id, revision, snapshot) VALUES (?, ?, ?)',
      [workbook.id, 0, JSON.stringify(snapshot)]
    );
  }

  async saveRevision(workbookId, snapshot) {
    const workbook = await this.get('SELECT current_revision FROM workbooks WHERE id = ?', [workbookId]);
    if (!workbook) throw new Error('Workbook not found');

    const newRevision = workbook.current_revision + 1;
    await this.run(
      'INSERT INTO revisions (workbook_id, revision, snapshot) VALUES (?, ?, ?)',
      [workbookId, newRevision, JSON.stringify(snapshot)]
    );
    await this.run('UPDATE workbooks SET current_revision = ? WHERE id = ?', [newRevision, workbookId]);
    return newRevision;
  }

  async getRevision(workbookId, revision = null) {
    let query = 'SELECT * FROM revisions WHERE workbook_id = ?';
    let params = [workbookId];
    if (revision !== null) {
      query += ' AND revision = ?';
      params.push(revision);
    } else {
      query += ' ORDER BY revision DESC LIMIT 1';
    }
    const row = await this.get(query, params);
    return row ? JSON.parse(row.snapshot) : null;
  }

  async getRevisions(workbookId, limit = 50) {
    const rows = await this.all(
      'SELECT revision, created_at FROM revisions WHERE workbook_id = ? ORDER BY revision DESC LIMIT ?',
      [workbookId, limit]
    );
    return rows;
  }

  async getCellHistory(workbookId, sheetId, cellAddress, limit = 50) {
    return this.all(
      `SELECT cell_address, previous_value, new_value, user_id, changed_at 
       FROM cell_changes 
       WHERE workbook_id = ? AND sheet_id = ? AND cell_address = ?
       ORDER BY changed_at DESC LIMIT ?`,
      [workbookId, sheetId, cellAddress, limit]
    );
  }

  async recordCellChange(workbookId, sheetId, cellAddress, revision, previousValue, newValue, userId) {
    await this.run(
      `INSERT INTO cell_changes (workbook_id, sheet_id, cell_address, revision, previous_value, new_value, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [workbookId, sheetId, cellAddress, revision, previousValue, newValue, userId]
    );
  }

  async getWorkbook(workbookId) {
    return this.get('SELECT * FROM workbooks WHERE id = ?', [workbookId]);
  }

  async getSheets(workbookId) {
    return this.all('SELECT * FROM sheets WHERE workbook_id = ?', [workbookId]);
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else resolve();
    });
  }
}

module.exports = Database;

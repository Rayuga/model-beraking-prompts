const Database = require('better-sqlite3');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'dropline.db');
const SEED_PATH = process.env.SEED_PATH || path.join('/assets', 'artifacts', 'dropline_seed.xlsx');

let dbInstance = null;

function getDb() {
  if (dbInstance) return dbInstance;

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  seedIfEmpty(db);

  dbInstance = db;
  return dbInstance;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS game_states (
      account_id INTEGER PRIMARY KEY,
      board TEXT NOT NULL,
      current_player TEXT NOT NULL,
      status TEXT NOT NULL,
      winning_cells TEXT NOT NULL,
      red_wins INTEGER NOT NULL DEFAULT 0,
      yellow_wins INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      applied_history TEXT NOT NULL,
      redo_history TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      round_id TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS completed_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      match_id TEXT NOT NULL,
      result TEXT NOT NULL,
      final_board TEXT NOT NULL,
      moves TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      UNIQUE (account_id, match_id)
    );

    CREATE TABLE IF NOT EXISTS operation_receipts (
      account_id INTEGER NOT NULL,
      operation_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (account_id, operation_id)
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      source_match_id TEXT NOT NULL,
      source_step INTEGER NOT NULL,
      source_prefix TEXT NOT NULL,
      root_node_id TEXT NOT NULL,
      selected_node_id TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analysis_nodes (
      id TEXT PRIMARY KEY,
      analysis_id TEXT NOT NULL,
      account_id INTEGER NOT NULL,
      parent_id TEXT,
      incoming_column INTEGER,
      move_number INTEGER NOT NULL,
      color TEXT NOT NULL,
      landing_row INTEGER,
      landing_col INTEGER,
      landing_index INTEGER,
      board TEXT NOT NULL,
      turn TEXT NOT NULL,
      status TEXT NOT NULL,
      winning_cells TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES analysis_nodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transplant_previews (
      id TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL,
      source_analysis_id TEXT NOT NULL,
      source_node_id TEXT NOT NULL,
      source_revision INTEGER NOT NULL,
      dest_analysis_id TEXT NOT NULL,
      dest_node_id TEXT NOT NULL,
      dest_revision INTEGER NOT NULL,
      preview_data TEXT NOT NULL,
      committed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function seedIfEmpty(db) {
  const accountCount = db.prepare('SELECT COUNT(*) as count FROM accounts').get().count;
  if (accountCount > 0) {
    return;
  }

  if (!fs.existsSync(SEED_PATH)) {
    console.warn(`Seed file not found at ${SEED_PATH}, skipping seed.`);
    return;
  }

  const wb = xlsx.readFile(SEED_PATH);

  // Accounts
  if (wb.Sheets['Accounts']) {
    const accountsData = xlsx.utils.sheet_to_json(wb.Sheets['Accounts']);
    const insertAccount = db.prepare('INSERT INTO accounts (email, password, name) VALUES (?, ?, ?)');
    for (const row of accountsData) {
      insertAccount.run(row['Email'], row['Password'], row['Name']);
    }
  }

  // Initial Game State
  if (wb.Sheets['Initial Game State']) {
    const gameStateData = xlsx.utils.sheet_to_json(wb.Sheets['Initial Game State']);
    const insertGameState = db.prepare(`
      INSERT INTO game_states (
        account_id, board, current_player, status, winning_cells,
        red_wins, yellow_wins, draws, applied_history, redo_history, revision, round_id
      ) VALUES (
        (SELECT id FROM accounts WHERE email = ? COLLATE NOCASE),
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    for (const row of gameStateData) {
      const email = row['Account email'];
      const board = typeof row['Board'] === 'string' ? row['Board'] : JSON.stringify(row['Board'] || Array(42).fill(""));
      const currentPlayer = row['Current player'] || 'Red';
      const status = row['Status'] || 'active';
      const winningCells = row['Winning cells'] === 'none' || !row['Winning cells'] ? '[]' : (typeof row['Winning cells'] === 'string' ? row['Winning cells'] : JSON.stringify(row['Winning cells']));
      const redWins = Number(row['Red wins'] || 0);
      const yellowWins = Number(row['Yellow wins'] || 0);
      const draws = Number(row['Draws'] || 0);
      const appliedHistory = row['Applied history'] === 'none' || !row['Applied history'] ? '[]' : (typeof row['Applied history'] === 'string' ? row['Applied history'] : JSON.stringify(row['Applied history']));
      const redoHistory = row['Redo history'] === 'none' || !row['Redo history'] ? '[]' : (typeof row['Redo history'] === 'string' ? row['Redo history'] : JSON.stringify(row['Redo history']));
      const revision = Number(row['Revision'] || 0);
      const roundId = row['Round id'] || `seed-${Date.now()}`;

      insertGameState.run(
        email, board, currentPlayer, status, winningCells,
        redWins, yellowWins, draws, appliedHistory, redoHistory, revision, roundId
      );
    }
  }

  // Completed Matches
  if (wb.Sheets['Completed Matches']) {
    const matchData = xlsx.utils.sheet_to_json(wb.Sheets['Completed Matches']);
    const insertMatch = db.prepare(`
      INSERT INTO completed_matches (
        account_id, match_id, result, final_board, moves, completed_at
      ) VALUES (
        (SELECT id FROM accounts WHERE email = ? COLLATE NOCASE),
        ?, ?, ?, ?, ?
      )
    `);

    for (const row of matchData) {
      const email = row['Account email'];
      const matchId = row['Match id'];
      const result = row['Result'];
      const finalBoard = typeof row['Final board'] === 'string' ? row['Final board'] : JSON.stringify(row['Final board']);
      const moves = typeof row['Moves'] === 'string' ? row['Moves'] : JSON.stringify(row['Moves']);
      const completedAt = row['Completed at'] || new Date().toISOString();

      insertMatch.run(email, matchId, result, finalBoard, moves, completedAt);
    }
  }
}

module.exports = {
  getDb,
  DB_PATH
};

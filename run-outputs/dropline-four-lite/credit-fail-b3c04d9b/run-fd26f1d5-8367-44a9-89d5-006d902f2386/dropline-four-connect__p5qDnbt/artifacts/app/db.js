const Database = require('better-sqlite3');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function getDbPath() {
  return process.env.DB_PATH || path.join(__dirname, 'dropline.db');
}

function initDb(customPath) {
  const dbPath = customPath || getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS game_states (
      user_id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL,
      board TEXT NOT NULL,
      current_player TEXT NOT NULL,
      status TEXT NOT NULL,
      winning_cells TEXT,
      red_wins INTEGER NOT NULL DEFAULT 0,
      yellow_wins INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      applied_history TEXT NOT NULL,
      redo_history TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS completed_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      match_id TEXT NOT NULL,
      round_id TEXT,
      result TEXT NOT NULL,
      final_board TEXT NOT NULL,
      moves TEXT NOT NULL,
      winning_cells TEXT,
      completed_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS operations (
      user_id TEXT NOT NULL,
      op_id TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, op_id)
    );
  `);

  // Check if seeded
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    seedDatabase(db);
  }

  return db;
}

function seedDatabase(db) {
  const seedFile = path.join('/assets', 'artifacts', 'dropline_seed.xlsx');
  if (!fs.existsSync(seedFile)) {
    console.warn('Seed file not found at:', seedFile);
    return;
  }

  const wb = xlsx.readFile(seedFile);
  const accounts = xlsx.utils.sheet_to_json(wb.Sheets['Accounts'] || {});
  const initialStates = xlsx.utils.sheet_to_json(wb.Sheets['Initial Game State'] || {});
  const completedMatches = xlsx.utils.sheet_to_json(wb.Sheets['Completed Matches'] || {});

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password, name)
    VALUES (?, ?, ?, ?)
  `);

  const insertGameState = db.prepare(`
    INSERT INTO game_states (
      user_id, round_id, board, current_player, status, winning_cells,
      red_wins, yellow_wins, draws, applied_history, redo_history, revision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCompletedMatch = db.prepare(`
    INSERT INTO completed_matches (
      user_id, match_id, round_id, result, final_board, moves, winning_cells, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const userEmailToId = {};

  const tx = db.transaction(() => {
    for (const acc of accounts) {
      const email = (acc['Email'] || '').trim().toLowerCase();
      const password = acc['Password'] || '';
      const name = acc['Name'] || '';
      const userId = 'usr_' + crypto.randomUUID();
      insertUser.run(userId, email, password, name);
      userEmailToId[email] = userId;
    }

    for (const state of initialStates) {
      const email = (state['Account email'] || '').trim().toLowerCase();
      const userId = userEmailToId[email];
      if (!userId) continue;

      const roundId = state['Round id'] || ('seed-' + crypto.randomUUID());
      const board = state['Board'] || JSON.stringify(Array(42).fill(''));
      const currentPlayer = state['Current player'] || 'Red';
      const status = state['Status'] || 'active';
      let winningCells = state['Winning cells'];
      if (winningCells === 'none' || !winningCells) {
        winningCells = null;
      } else if (typeof winningCells === 'string' && winningCells.startsWith('[')) {
        // already JSON
      } else {
        winningCells = null;
      }

      const redWins = Number(state['Red wins']) || 0;
      const yellowWins = Number(state['Yellow wins']) || 0;
      const draws = Number(state['Draws']) || 0;
      const appliedHistory = state['Applied history'] || '[]';
      let redoHistory = state['Redo history'];
      if (redoHistory === 'none' || !redoHistory) {
        redoHistory = '[]';
      }

      const revision = Number(state['Revision']) || 0;

      insertGameState.run(
        userId,
        roundId,
        board,
        currentPlayer,
        status,
        winningCells,
        redWins,
        yellowWins,
        draws,
        appliedHistory,
        redoHistory,
        revision
      );
    }

    for (const match of completedMatches) {
      const email = (match['Account email'] || '').trim().toLowerCase();
      const userId = userEmailToId[email];
      if (!userId) continue;

      const matchId = match['Match id'] || ('match-' + crypto.randomUUID());
      const result = match['Result'] || 'Draw';
      const finalBoard = match['Final board'] || JSON.stringify(Array(42).fill(''));
      const moves = match['Moves'] || '[]';
      const completedAt = match['Completed at'] || new Date().toISOString();

      insertCompletedMatch.run(
        userId,
        matchId,
        matchId, // round_id
        result,
        finalBoard,
        moves,
        null,
        completedAt
      );
    }
  });

  tx();
  console.log('Database successfully seeded from:', seedFile);
}

module.exports = {
  getDbPath,
  initDb
};

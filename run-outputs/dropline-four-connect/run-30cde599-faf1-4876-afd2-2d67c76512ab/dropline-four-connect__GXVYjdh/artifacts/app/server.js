#!/usr/bin/env node
const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Determine database path
const DB_PATH = process.env.DB_PATH || '/app/dropline.db';

// Initialize database
let db;
let dbNeedsSeeding = false;

function initializeDatabase() {
  const dbExists = fs.existsSync(DB_PATH);
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  dbNeedsSeeding = !dbExists;
  
  if (dbNeedsSeeding) {
    createSchema();
    seedDatabase();
  }
}

function createSchema() {
  db.exec(`
    CREATE TABLE accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      revoked_at DATETIME,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL UNIQUE,
      round_id TEXT NOT NULL,
      board TEXT NOT NULL,
      current_player TEXT NOT NULL,
      status TEXT NOT NULL,
      winning_cells TEXT NOT NULL,
      red_wins INTEGER DEFAULT 0,
      yellow_wins INTEGER DEFAULT 0,
      draws INTEGER DEFAULT 0,
      revision INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      move_number INTEGER NOT NULL,
      color TEXT NOT NULL,
      column_num INTEGER NOT NULL,
      row_num INTEGER NOT NULL,
      board_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id),
      UNIQUE(game_id, move_number)
    );

    CREATE TABLE redo_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      redo_number INTEGER NOT NULL,
      color TEXT NOT NULL,
      column_num INTEGER NOT NULL,
      row_num INTEGER NOT NULL,
      board_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id),
      UNIQUE(game_id, redo_number)
    );

    CREATE TABLE archives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      match_id TEXT NOT NULL,
      result TEXT NOT NULL,
      final_board TEXT NOT NULL,
      move_count INTEGER NOT NULL,
      completed_at DATETIME NOT NULL,
      round_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      UNIQUE(account_id, round_id)
    );

    CREATE TABLE analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      match_id TEXT NOT NULL,
      source_step INTEGER NOT NULL,
      name TEXT NOT NULL,
      root_board TEXT NOT NULL,
      root_player TEXT NOT NULL,
      revision INTEGER DEFAULT 0,
      selected_node_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE analysis_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id INTEGER NOT NULL,
      parent_id INTEGER,
      column_num INTEGER,
      board TEXT NOT NULL,
      current_player TEXT NOT NULL,
      winning_cells TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (analysis_id) REFERENCES analyses(id),
      FOREIGN KEY (parent_id) REFERENCES analysis_nodes(id)
    );

    CREATE TABLE operation_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      operation_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE transplant_previews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      operation_id TEXT NOT NULL UNIQUE,
      source_analysis_id INTEGER NOT NULL,
      source_node_id INTEGER NOT NULL,
      dest_analysis_id INTEGER NOT NULL,
      dest_node_id INTEGER NOT NULL,
      preview_data TEXT NOT NULL,
      source_revision INTEGER NOT NULL,
      dest_revision INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (source_analysis_id) REFERENCES analyses(id),
      FOREIGN KEY (source_node_id) REFERENCES analysis_nodes(id),
      FOREIGN KEY (dest_analysis_id) REFERENCES analyses(id),
      FOREIGN KEY (dest_node_id) REFERENCES analysis_nodes(id)
    );

    CREATE TABLE tactical_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id INTEGER NOT NULL,
      node_id INTEGER NOT NULL,
      depth INTEGER NOT NULL,
      result TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (analysis_id) REFERENCES analyses(id),
      FOREIGN KEY (node_id) REFERENCES analysis_nodes(id),
      UNIQUE(node_id, depth)
    );

    CREATE INDEX idx_tokens_account ON tokens(account_id);
    CREATE INDEX idx_games_account ON games(account_id);
    CREATE INDEX idx_moves_game ON moves(game_id);
    CREATE INDEX idx_redo_game ON redo_history(game_id);
    CREATE INDEX idx_archives_account ON archives(account_id);
    CREATE INDEX idx_analyses_account ON analyses(account_id);
    CREATE INDEX idx_nodes_analysis ON analysis_nodes(analysis_id);
    CREATE INDEX idx_receipts_operation ON operation_receipts(operation_id);
  `);
}

function seedDatabase() {
  const xlsx = require('xlsx');
  const seedPath = '/assets/artifacts/dropline_seed.xlsx';
  
  if (!fs.existsSync(seedPath)) {
    console.warn('Seed file not found, creating empty database');
    return;
  }

  try {
    const wb = xlsx.readFile(seedPath);
    
    // Seed accounts
    const accountsWs = wb.Sheets['Accounts'];
    const accounts = xlsx.utils.sheet_to_json(accountsWs);
    for (const acc of accounts) {
      const hash = hashPassword(acc.Password);
      const stmt = db.prepare('INSERT INTO accounts (email, password_hash, name) VALUES (?, ?, ?)');
      stmt.run(acc.Email, hash, acc.Name);
    }

    // Seed initial game states
    const statesWs = wb.Sheets['Initial Game State'];
    const states = xlsx.utils.sheet_to_json(statesWs);
    for (const state of states) {
      const accountResult = db.prepare('SELECT id FROM accounts WHERE email = ?').get(state['Account email']);
      if (!accountResult) continue;

      const board = typeof state.Board === 'string' ? JSON.parse(state.Board) : state.Board;
      const appliedHistory = state['Applied history'] === 'none' ? [] : JSON.parse(state['Applied history']);
      const redoHistory = state['Redo history'] === 'none' ? [] : JSON.parse(state['Redo history']);

      const gameStmt = db.prepare(`
        INSERT INTO games (account_id, round_id, board, current_player, status, winning_cells, red_wins, yellow_wins, draws, revision)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const gameResult = gameStmt.run(
        accountResult.id,
        state['Round id'],
        JSON.stringify(board),
        state['Current player'],
        state.Status,
        state['Winning cells'],
        state['Red wins'],
        state['Yellow wins'],
        state['Draws'],
        state['Revision']
      );

      // Insert applied moves
      for (let i = 0; i < appliedHistory.length; i++) {
        const move = appliedHistory[i];
        const moveStmt = db.prepare(`
          INSERT INTO moves (game_id, move_number, color, column_num, row_num, board_index)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        moveStmt.run(gameResult.lastInsertRowid, i + 1, move.color, move.column, move.row, move.index);
      }

      // Insert redo history
      for (let i = 0; i < redoHistory.length; i++) {
        const redo = redoHistory[i];
        const redoStmt = db.prepare(`
          INSERT INTO redo_history (game_id, redo_number, color, column_num, row_num, board_index)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        redoStmt.run(gameResult.lastInsertRowid, i + 1, redo.color, redo.column, redo.row, redo.index);
      }
    }

    // Seed completed matches
    const matchesWs = wb.Sheets['Completed Matches'];
    const matches = xlsx.utils.sheet_to_json(matchesWs);
    for (const match of matches) {
      const accountResult = db.prepare('SELECT id FROM accounts WHERE email = ?').get(match['Account email']);
      if (!accountResult) continue;

      const moves = JSON.parse(match.Moves);
      const archiveStmt = db.prepare(`
        INSERT INTO archives (account_id, match_id, result, final_board, move_count, completed_at, round_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      archiveStmt.run(
        accountResult.id,
        match['Match id'],
        match.Result,
        match['Final board'],
        moves.length,
        match['Completed at'],
        match['Match id']
      );
    }

    console.log('Database seeded successfully');
  } catch (err) {
    console.error('Seed error:', err);
  }
}

function hashPassword(password) {
  return crypto.pbkdf2Sync(password, 'salt-dropline', 100000, 64, 'sha256').toString('hex');
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getAccountFromToken(token) {
  const result = db.prepare(`
    SELECT a.* FROM accounts a
    JOIN tokens t ON a.id = t.account_id
    WHERE t.token = ? AND t.revoked_at IS NULL
  `).get(token);
  return result;
}

// Middleware
app.use(express.json());
app.use(express.static('/app/public'));

// Auth middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  const account = getAccountFromToken(token);
  if (!account) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.account = account;
  req.token = token;
  next();
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Sign in
app.post('/api/signin', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email);
  if (!account || !verifyPassword(password, account.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken();
  db.prepare('INSERT INTO tokens (account_id, token) VALUES (?, ?)').run(account.id, token);

  res.json({
    token,
    account: {
      id: account.id,
      email: account.email,
      name: account.name
    }
  });
});

// Sign out
app.post('/api/signout', requireAuth, (req, res) => {
  db.prepare('UPDATE tokens SET revoked_at = CURRENT_TIMESTAMP WHERE account_id = ?').run(req.account.id);
  res.json({ ok: true });
});

// Get game state
app.get('/api/game', requireAuth, (req, res) => {
  const game = db.prepare('SELECT * FROM games WHERE account_id = ?').get(req.account.id);
  if (!game) {
    return res.json({ game: null });
  }

  const moves = db.prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number').all(game.id);
  const redoMoves = db.prepare('SELECT * FROM redo_history WHERE game_id = ? ORDER BY redo_number').all(game.id);

  res.json({
    game: {
      id: game.id,
      roundId: game.round_id,
      board: JSON.parse(game.board),
      currentPlayer: game.current_player,
      status: game.status,
      winningCells: game.winning_cells === 'none' ? [] : JSON.parse(game.winning_cells),
      redWins: game.red_wins,
      yellowWins: game.yellow_wins,
      draws: game.draws,
      revision: game.revision,
      moves: moves.map(m => ({
        number: m.move_number,
        color: m.color,
        column: m.column_num,
        row: m.row_num
      })),
      redoMoves: redoMoves.map(m => ({
        color: m.color,
        column: m.column_num,
        row: m.row_num
      }))
    }
  });
});

// Make a move
app.post('/api/move', requireAuth, (req, res) => {
  const { column, operationId, expectedRevision } = req.body;

  if (!column || typeof column !== 'number' || column < 1 || column > 7) {
    return res.status(400).json({ error: 'Invalid column' });
  }
  if (!operationId || typeof operationId !== 'string') {
    return res.status(400).json({ error: 'Invalid operation ID' });
  }
  if (typeof expectedRevision !== 'number') {
    return res.status(400).json({ error: 'Invalid revision' });
  }

  // Check for duplicate operation
  const receipt = db.prepare('SELECT * FROM operation_receipts WHERE account_id = ? AND operation_id = ?').get(req.account.id, operationId);
  if (receipt) {
    const result = JSON.parse(receipt.result);
    return res.status(receipt.status === 'success' ? 200 : 400).json(result);
  }

  const game = db.prepare('SELECT * FROM games WHERE account_id = ?').get(req.account.id);
  if (!game) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'No game found' }, res, 400);
  }

  if (game.revision !== expectedRevision) {
    return recordReceipt(req.account.id, operationId, 'conflict', {
      error: 'Game updated in another tab',
      game: getGameResponse(game)
    }, res, 409);
  }

  const board = JSON.parse(game.board);
  const colIndex = column - 1;

  // Find empty row in column
  let dropRow = -1;
  for (let row = 5; row >= 0; row--) {
    const cellIndex = row * 7 + colIndex;
    if (board[cellIndex] === '') {
      dropRow = row;
      break;
    }
  }

  if (dropRow === -1) {
    return recordReceipt(req.account.id, operationId, 'error', {
      error: `Column ${column} is full`
    }, res, 400);
  }

  if (game.status !== 'active') {
    return recordReceipt(req.account.id, operationId, 'error', {
      error: 'Game is not active'
    }, res, 400);
  }

  const cellIndex = dropRow * 7 + colIndex;
  board[cellIndex] = game.current_player;

  const moves = db.prepare('SELECT COUNT(*) as count FROM moves WHERE game_id = ?').get(game.id);
  const moveNumber = moves.count + 1;

  let newStatus = 'active';
  let newPlayer = game.current_player === 'Red' ? 'Yellow' : 'Red';
  let winningCells = 'none';

  // Check win
  const winLine = detectWin(board, dropRow, colIndex, game.current_player);
  if (winLine.length === 4) {
    newStatus = 'terminal';
    winningCells = JSON.stringify(winLine);
    if (game.current_player === 'Red') {
      game.red_wins++;
    } else {
      game.yellow_wins++;
    }
  } else if (isBoardFull(board)) {
    newStatus = 'terminal';
    game.draws++;
  }

  // Save move
  const moveStmt = db.prepare(`
    INSERT INTO moves (game_id, move_number, color, column_num, row_num, board_index)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  moveStmt.run(game.id, moveNumber, game.current_player, column, dropRow + 1, cellIndex);

  // Clear redo history
  db.prepare('DELETE FROM redo_history WHERE game_id = ?').run(game.id);

  // Update game
  const updateStmt = db.prepare(`
    UPDATE games SET board = ?, current_player = ?, status = ?, winning_cells = ?, red_wins = ?, yellow_wins = ?, draws = ?, revision = revision + 1
    WHERE id = ?
  `);
  updateStmt.run(
    JSON.stringify(board),
    newPlayer,
    newStatus,
    winningCells,
    game.red_wins,
    game.yellow_wins,
    game.draws,
    game.id
  );

  // Create archive if needed
  if (newStatus === 'terminal') {
    const archiveStmt = db.prepare(`
      INSERT OR IGNORE INTO archives (account_id, match_id, result, final_board, move_count, completed_at, round_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = newStatus === 'terminal' ? (winningCells !== 'none' ? (game.current_player === 'Red' ? 'Red wins' : 'Yellow wins') : 'Draw') : null;
    if (result) {
      archiveStmt.run(
        req.account.id,
        game.round_id,
        result,
        JSON.stringify(board),
        moveNumber,
        new Date().toISOString(),
        game.round_id
      );
    }
  }

  const updatedGame = db.prepare('SELECT * FROM games WHERE id = ?').get(game.id);
  recordReceipt(req.account.id, operationId, 'success', { game: getGameResponse(updatedGame) }, res, 200);
});

// Helper function for responses
function getGameResponse(game) {
  const moves = db.prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number').all(game.id);
  const redoMoves = db.prepare('SELECT * FROM redo_history WHERE game_id = ? ORDER BY redo_number').all(game.id);

  return {
    id: game.id,
    roundId: game.round_id,
    board: JSON.parse(game.board),
    currentPlayer: game.current_player,
    status: game.status,
    winningCells: game.winning_cells === 'none' ? [] : JSON.parse(game.winning_cells),
    redWins: game.red_wins,
    yellowWins: game.yellow_wins,
    draws: game.draws,
    revision: game.revision,
    moves: moves.map(m => ({
      number: m.move_number,
      color: m.color,
      column: m.column_num,
      row: m.row_num
    })),
    redoMoves: redoMoves.map(m => ({
      color: m.color,
      column: m.column_num,
      row: m.row_num
    }))
  };
}

function recordReceipt(accountId, operationId, status, result, res, statusCode) {
  const stmt = db.prepare(`
    INSERT INTO operation_receipts (account_id, operation_id, status, result)
    VALUES (?, ?, ?, ?)
  `);
  try {
    stmt.run(accountId, operationId, status, JSON.stringify(result));
  } catch (e) {
    // Operation already recorded
  }
  return res.status(statusCode).json(result);
}

// Undo
app.post('/api/undo', requireAuth, (req, res) => {
  const { operationId, expectedRevision } = req.body;

  if (!operationId || typeof operationId !== 'string') {
    return res.status(400).json({ error: 'Invalid operation ID' });
  }
  if (typeof expectedRevision !== 'number') {
    return res.status(400).json({ error: 'Invalid revision' });
  }

  // Check for duplicate operation
  const receipt = db.prepare('SELECT * FROM operation_receipts WHERE account_id = ? AND operation_id = ?').get(req.account.id, operationId);
  if (receipt) {
    const result = JSON.parse(receipt.result);
    return res.status(receipt.status === 'success' ? 200 : 400).json(result);
  }

  const game = db.prepare('SELECT * FROM games WHERE account_id = ?').get(req.account.id);
  if (!game) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'No game found' }, res, 400);
  }

  if (game.revision !== expectedRevision) {
    return recordReceipt(req.account.id, operationId, 'conflict', {
      error: 'Game updated in another tab',
      game: getGameResponse(game)
    }, res, 409);
  }

  const moves = db.prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number DESC LIMIT 1').get(game.id);
  if (!moves) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'No moves to undo' }, res, 400);
  }

  const board = JSON.parse(game.board);
  board[moves.board_index] = '';

  // Save undone move to redo history
  const redoCount = db.prepare('SELECT COUNT(*) as count FROM redo_history WHERE game_id = ?').get(game.id).count;
  db.prepare(`
    INSERT INTO redo_history (game_id, redo_number, color, column_num, row_num, board_index)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(game.id, redoCount + 1, moves.color, moves.column_num, moves.row_num, moves.board_index);

  // Delete the move
  db.prepare('DELETE FROM moves WHERE id = ?').run(moves.id);

  // Determine new player and status
  const newPlayer = moves.color === 'Red' ? 'Yellow' : 'Red';
  let newStatus = 'active';
  let winningCells = 'none';
  let redWins = game.red_wins;
  let yellowWins = game.yellow_wins;
  let draws = game.draws;

  // If the game was terminal, reduce score
  if (game.status === 'terminal') {
    if (game.winning_cells !== 'none') {
      if (moves.color === 'Red') {
        redWins--;
      } else {
        yellowWins--;
      }
    } else {
      draws--;
    }
  }

  // Update game
  db.prepare(`
    UPDATE games SET board = ?, current_player = ?, status = ?, winning_cells = ?, red_wins = ?, yellow_wins = ?, draws = ?, revision = revision + 1
    WHERE id = ?
  `).run(JSON.stringify(board), newPlayer, newStatus, winningCells, redWins, yellowWins, draws, game.id);

  const updatedGame = db.prepare('SELECT * FROM games WHERE id = ?').get(game.id);
  recordReceipt(req.account.id, operationId, 'success', { game: getGameResponse(updatedGame) }, res, 200);
});

// Redo
app.post('/api/redo', requireAuth, (req, res) => {
  const { operationId, expectedRevision } = req.body;

  if (!operationId || typeof operationId !== 'string') {
    return res.status(400).json({ error: 'Invalid operation ID' });
  }
  if (typeof expectedRevision !== 'number') {
    return res.status(400).json({ error: 'Invalid revision' });
  }

  // Check for duplicate operation
  const receipt = db.prepare('SELECT * FROM operation_receipts WHERE account_id = ? AND operation_id = ?').get(req.account.id, operationId);
  if (receipt) {
    const result = JSON.parse(receipt.result);
    return res.status(receipt.status === 'success' ? 200 : 400).json(result);
  }

  const game = db.prepare('SELECT * FROM games WHERE account_id = ?').get(req.account.id);
  if (!game) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'No game found' }, res, 400);
  }

  if (game.revision !== expectedRevision) {
    return recordReceipt(req.account.id, operationId, 'conflict', {
      error: 'Game updated in another tab',
      game: getGameResponse(game)
    }, res, 409);
  }

  const redoMove = db.prepare('SELECT * FROM redo_history WHERE game_id = ? ORDER BY redo_number DESC LIMIT 1').get(game.id);
  if (!redoMove) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'No moves to redo' }, res, 400);
  }

  const board = JSON.parse(game.board);
  board[redoMove.board_index] = redoMove.color;

  // Delete from redo history
  db.prepare('DELETE FROM redo_history WHERE id = ?').run(redoMove.id);

  // Re-add to moves
  const moveCount = db.prepare('SELECT COUNT(*) as count FROM moves WHERE game_id = ?').get(game.id).count;
  db.prepare(`
    INSERT INTO moves (game_id, move_number, color, column_num, row_num, board_index)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(game.id, moveCount + 1, redoMove.color, redoMove.column_num, redoMove.row_num, redoMove.board_index);

  // Determine new player and status
  const newPlayer = redoMove.color === 'Red' ? 'Yellow' : 'Red';
  let newStatus = 'active';
  let winningCells = 'none';
  let redWins = game.red_wins;
  let yellowWins = game.yellow_wins;
  let draws = game.draws;

  const row = Math.floor(redoMove.board_index / 7);
  const col = redoMove.board_index % 7;
  const winLine = detectWin(board, row, col, redoMove.color);
  if (winLine.length === 4) {
    newStatus = 'terminal';
    winningCells = JSON.stringify(winLine);
    if (redoMove.color === 'Red') {
      redWins++;
    } else {
      yellowWins++;
    }
  } else if (isBoardFull(board)) {
    newStatus = 'terminal';
    draws++;
  }

  // Update game
  db.prepare(`
    UPDATE games SET board = ?, current_player = ?, status = ?, winning_cells = ?, red_wins = ?, yellow_wins = ?, draws = ?, revision = revision + 1
    WHERE id = ?
  `).run(JSON.stringify(board), newPlayer, newStatus, winningCells, redWins, yellowWins, draws, game.id);

  const updatedGame = db.prepare('SELECT * FROM games WHERE id = ?').get(game.id);
  recordReceipt(req.account.id, operationId, 'success', { game: getGameResponse(updatedGame) }, res, 200);
});

// New game
app.post('/api/newgame', requireAuth, (req, res) => {
  const { operationId, expectedRevision } = req.body;

  if (!operationId || typeof operationId !== 'string') {
    return res.status(400).json({ error: 'Invalid operation ID' });
  }
  if (typeof expectedRevision !== 'number') {
    return res.status(400).json({ error: 'Invalid revision' });
  }

  // Check for duplicate operation
  const receipt = db.prepare('SELECT * FROM operation_receipts WHERE account_id = ? AND operation_id = ?').get(req.account.id, operationId);
  if (receipt) {
    const result = JSON.parse(receipt.result);
    return res.status(receipt.status === 'success' ? 200 : 400).json(result);
  }

  const game = db.prepare('SELECT * FROM games WHERE account_id = ?').get(req.account.id);
  if (!game) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'No game found' }, res, 400);
  }

  if (game.revision !== expectedRevision) {
    return recordReceipt(req.account.id, operationId, 'conflict', {
      error: 'Game updated in another tab',
      game: getGameResponse(game)
    }, res, 409);
  }

  const emptyBoard = Array(42).fill('');
  const newRoundId = `game-${Date.now()}`;

  // Clear moves and redo
  db.prepare('DELETE FROM moves WHERE game_id = ?').run(game.id);
  db.prepare('DELETE FROM redo_history WHERE game_id = ?').run(game.id);

  // Update game
  db.prepare(`
    UPDATE games SET board = ?, current_player = 'Red', status = 'active', winning_cells = 'none', round_id = ?, revision = revision + 1
    WHERE id = ?
  `).run(JSON.stringify(emptyBoard), newRoundId, game.id);

  const updatedGame = db.prepare('SELECT * FROM games WHERE id = ?').get(game.id);
  recordReceipt(req.account.id, operationId, 'success', { game: getGameResponse(updatedGame) }, res, 200);
});

// Get archives
app.get('/api/archives', requireAuth, (req, res) => {
  const archives = db.prepare(`
    SELECT * FROM archives WHERE account_id = ?
    ORDER BY completed_at DESC
    LIMIT 10
  `).all(req.account.id);

  const total = db.prepare('SELECT COUNT(*) as count FROM archives WHERE account_id = ?').get(req.account.id).count;

  res.json({
    total,
    archives: archives.map(a => ({
      id: a.id,
      matchId: a.match_id,
      result: a.result,
      moveCount: a.move_count,
      completedAt: a.completed_at
    }))
  });
});

// Get archive replay
app.get('/api/archive/:id', requireAuth, (req, res) => {
  const archive = db.prepare('SELECT * FROM archives WHERE id = ? AND account_id = ?').get(req.params.id, req.account.id);
  if (!archive) {
    return res.status(404).json({ error: 'Not found' });
  }

  const moves = JSON.parse(archive.final_board);
  const board = JSON.parse(archive.final_board);

  res.json({
    archive: {
      id: archive.id,
      matchId: archive.match_id,
      result: archive.result,
      board: JSON.parse(archive.final_board),
      moveCount: archive.move_count
    }
  });
});

// Win detection helper
function detectWin(board, row, col, color) {
  const directions = [
    [0, 1], [1, 0], [1, 1], [1, -1]
  ];
  
  const winLine = [];
  
  for (const [dRow, dCol] of directions) {
    const line = [[row, col]];
    
    // Forward
    for (let i = 1; i < 4; i++) {
      const r = row + i * dRow;
      const c = col + i * dCol;
      if (r < 0 || r >= 6 || c < 0 || c >= 7) break;
      if (board[r * 7 + c] !== color) break;
      line.push([r, c]);
    }
    
    // Backward
    for (let i = 1; i < 4; i++) {
      const r = row - i * dRow;
      const c = col - i * dCol;
      if (r < 0 || r >= 6 || c < 0 || c >= 7) break;
      if (board[r * 7 + c] !== color) break;
      line.push([r, c]);
    }
    
    if (line.length >= 4) {
      return line.slice(0, 4).map(([r, c]) => r * 7 + c);
    }
  }
  
  return [];
}

function isBoardFull(board) {
  return board.every(cell => cell !== '');
}

// Analysis endpoints
app.post('/api/analyses', requireAuth, (req, res) => {
  const { matchId, sourceStep, name } = req.body;

  if (typeof matchId !== 'string') {
    return res.status(400).json({ error: 'Invalid match ID' });
  }
  if (typeof sourceStep !== 'number' || sourceStep < 0) {
    return res.status(400).json({ error: 'Invalid source step' });
  }
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Invalid name' });
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0 || trimmedName.length > 60) {
    return res.status(400).json({ error: 'Name must be 1-60 characters' });
  }

  // Find the archive
  const archive = db.prepare('SELECT * FROM archives WHERE account_id = ? AND match_id = ?').get(req.account.id, matchId);
  if (!archive) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const finalBoard = JSON.parse(archive.final_board);
  
  // Reconstruct board at source step - we'll compute this from the stored game state
  // For now, we'll use a simple approach: get all moves and apply up to sourceStep
  const game = db.prepare('SELECT * FROM games WHERE account_id = ? AND round_id = ?').get(req.account.id, archive.round_id);
  if (!game) {
    return res.status(400).json({ error: 'Could not find game state' });
  }

  let board = Array(42).fill('');
  let currentPlayer = 'Red';
  let moves = [];
  
  const appliedMoves = db.prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number').all(game.id);
  for (let i = 0; i < Math.min(sourceStep, appliedMoves.length); i++) {
    const move = appliedMoves[i];
    board[move.board_index] = move.color;
    moves.push(move);
    currentPlayer = move.color === 'Red' ? 'Yellow' : 'Red';
  }

  const rootPlayer = sourceStep === 0 ? 'Red' : currentPlayer;

  // Create analysis
  const stmt = db.prepare(`
    INSERT INTO analyses (account_id, match_id, source_step, name, root_board, root_player, revision)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `);
  const result = stmt.run(req.account.id, matchId, sourceStep, trimmedName, JSON.stringify(board), rootPlayer);

  // Create root node
  const nodeStmt = db.prepare(`
    INSERT INTO analysis_nodes (analysis_id, parent_id, column_num, board, current_player, winning_cells, status)
    VALUES (?, NULL, NULL, ?, ?, 'none', 'active')
  `);
  const nodeResult = nodeStmt.run(result.lastInsertRowid, JSON.stringify(board), rootPlayer);

  // Update selected node
  db.prepare('UPDATE analyses SET selected_node_id = ? WHERE id = ?').run(nodeResult.lastInsertRowid, result.lastInsertRowid);

  res.json({
    analysis: {
      id: result.lastInsertRowid,
      matchId,
      sourceStep,
      name: trimmedName,
      revision: 0,
      rootBoard: board,
      selectedNodeId: nodeResult.lastInsertRowid
    }
  });
});

// List analyses
app.get('/api/analyses', requireAuth, (req, res) => {
  const analyses = db.prepare(`
    SELECT id, match_id, source_step, name, revision, selected_node_id, root_board, root_player
    FROM analyses WHERE account_id = ?
    ORDER BY created_at DESC
  `).all(req.account.id);

  res.json({
    analyses: analyses.map(a => ({
      id: a.id,
      matchId: a.match_id,
      sourceStep: a.source_step,
      name: a.name,
      revision: a.revision,
      selectedNodeId: a.selected_node_id
    }))
  });
});

// Get analysis
app.get('/api/analyses/:id', requireAuth, (req, res) => {
  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(req.params.id, req.account.id);
  if (!analysis) {
    return res.status(404).json({ error: 'Not found' });
  }

  const nodes = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ?').all(analysis.id);

  res.json({
    analysis: {
      id: analysis.id,
      matchId: analysis.match_id,
      sourceStep: analysis.source_step,
      name: analysis.name,
      revision: analysis.revision,
      rootBoard: JSON.parse(analysis.root_board),
      rootPlayer: analysis.root_player,
      selectedNodeId: analysis.selected_node_id,
      nodes: nodes.map(n => ({
        id: n.id,
        parentId: n.parent_id,
        column: n.column_num,
        board: JSON.parse(n.board),
        currentPlayer: n.current_player,
        winningCells: n.winning_cells === 'none' ? [] : JSON.parse(n.winning_cells),
        status: n.status
      }))
    }
  });
});

// Analysis move
app.post('/api/analyses/:id/move', requireAuth, (req, res) => {
  const analysisId = parseInt(req.params.id);
  const { column, operationId, expectedRevision } = req.body;

  if (!column || typeof column !== 'number' || column < 1 || column > 7) {
    return res.status(400).json({ error: 'Invalid column' });
  }
  if (!operationId || typeof operationId !== 'string') {
    return res.status(400).json({ error: 'Invalid operation ID' });
  }
  if (typeof expectedRevision !== 'number') {
    return res.status(400).json({ error: 'Invalid revision' });
  }

  // Check for duplicate operation
  const receipt = db.prepare('SELECT * FROM operation_receipts WHERE account_id = ? AND operation_id = ?').get(req.account.id, operationId);
  if (receipt) {
    const result = JSON.parse(receipt.result);
    return res.status(receipt.status === 'success' ? 200 : 400).json(result);
  }

  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(analysisId, req.account.id);
  if (!analysis) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'Analysis not found' }, res, 404);
  }

  if (analysis.revision !== expectedRevision) {
    return recordReceipt(req.account.id, operationId, 'conflict', { error: 'Analysis updated in another tab' }, res, 409);
  }

  const selectedNode = db.prepare('SELECT * FROM analysis_nodes WHERE id = ?').get(analysis.selected_node_id);
  if (!selectedNode) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'Selected node not found' }, res, 400);
  }

  const board = JSON.parse(selectedNode.board);
  const colIndex = column - 1;

  // Find empty row
  let dropRow = -1;
  for (let row = 5; row >= 0; row--) {
    const cellIndex = row * 7 + colIndex;
    if (board[cellIndex] === '') {
      dropRow = row;
      break;
    }
  }

  if (dropRow === -1) {
    return recordReceipt(req.account.id, operationId, 'error', { error: `Column ${column} is full` }, res, 400);
  }

  if (selectedNode.status !== 'active') {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'Cannot move in terminal position' }, res, 400);
  }

  const newBoard = [...board];
  const cellIndex = dropRow * 7 + colIndex;
  newBoard[cellIndex] = selectedNode.current_player;

  let newStatus = 'active';
  let newPlayer = selectedNode.current_player === 'Red' ? 'Yellow' : 'Red';
  let winningCells = 'none';

  // Check win
  const winLine = detectWin(newBoard, dropRow, colIndex, selectedNode.current_player);
  if (winLine.length === 4) {
    newStatus = 'terminal';
    winningCells = JSON.stringify(winLine);
  } else if (isBoardFull(newBoard)) {
    newStatus = 'terminal';
  }

  // Check if this column move already exists as a child
  const existingChild = db.prepare(`
    SELECT * FROM analysis_nodes WHERE parent_id = ? AND column_num = ?
  `).get(selectedNode.id, column);

  if (existingChild) {
    // Reopen existing child
    db.prepare('UPDATE analyses SET selected_node_id = ?, revision = revision + 1 WHERE id = ?').run(existingChild.id, analysisId);
    const updatedAnalysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId);
    const nodes = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ?').all(analysisId);
    return recordReceipt(req.account.id, operationId, 'success', {
      analysis: buildAnalysisResponse(updatedAnalysis, nodes)
    }, res, 200);
  }

  // Create new node
  const nodeStmt = db.prepare(`
    INSERT INTO analysis_nodes (analysis_id, parent_id, column_num, board, current_player, winning_cells, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const nodeResult = nodeStmt.run(analysisId, selectedNode.id, column, JSON.stringify(newBoard), newPlayer, winningCells, newStatus);

  // Update analysis
  db.prepare('UPDATE analyses SET selected_node_id = ?, revision = revision + 1 WHERE id = ?').run(nodeResult.lastInsertRowid, analysisId);

  const updatedAnalysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId);
  const nodes = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ?').all(analysisId);
  recordReceipt(req.account.id, operationId, 'success', {
    analysis: buildAnalysisResponse(updatedAnalysis, nodes)
  }, res, 200);
});

// Analysis undo
app.post('/api/analyses/:id/undo', requireAuth, (req, res) => {
  const analysisId = parseInt(req.params.id);
  const { operationId, expectedRevision } = req.body;

  if (!operationId || typeof operationId !== 'string') {
    return res.status(400).json({ error: 'Invalid operation ID' });
  }
  if (typeof expectedRevision !== 'number') {
    return res.status(400).json({ error: 'Invalid revision' });
  }

  // Check for duplicate operation
  const receipt = db.prepare('SELECT * FROM operation_receipts WHERE account_id = ? AND operation_id = ?').get(req.account.id, operationId);
  if (receipt) {
    const result = JSON.parse(receipt.result);
    return res.status(receipt.status === 'success' ? 200 : 400).json(result);
  }

  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(analysisId, req.account.id);
  if (!analysis) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'Analysis not found' }, res, 404);
  }

  if (analysis.revision !== expectedRevision) {
    return recordReceipt(req.account.id, operationId, 'conflict', { error: 'Analysis updated in another tab' }, res, 409);
  }

  const selectedNode = db.prepare('SELECT * FROM analysis_nodes WHERE id = ?').get(analysis.selected_node_id);
  if (!selectedNode || !selectedNode.parent_id) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'Cannot undo at root' }, res, 400);
  }

  const parentNode = db.prepare('SELECT * FROM analysis_nodes WHERE id = ?').get(selectedNode.parent_id);
  if (!parentNode) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'Parent node not found' }, res, 400);
  }

  // Select parent
  db.prepare('UPDATE analyses SET selected_node_id = ?, revision = revision + 1 WHERE id = ?').run(parentNode.id, analysisId);

  const updatedAnalysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId);
  const nodes = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ?').all(analysisId);
  recordReceipt(req.account.id, operationId, 'success', {
    analysis: buildAnalysisResponse(updatedAnalysis, nodes)
  }, res, 200);
});

// Analysis redo
app.post('/api/analyses/:id/redo', requireAuth, (req, res) => {
  const analysisId = parseInt(req.params.id);
  const { childId, operationId, expectedRevision } = req.body;

  if (!operationId || typeof operationId !== 'string') {
    return res.status(400).json({ error: 'Invalid operation ID' });
  }
  if (typeof expectedRevision !== 'number') {
    return res.status(400).json({ error: 'Invalid revision' });
  }

  // Check for duplicate operation
  const receipt = db.prepare('SELECT * FROM operation_receipts WHERE account_id = ? AND operation_id = ?').get(req.account.id, operationId);
  if (receipt) {
    const result = JSON.parse(receipt.result);
    return res.status(receipt.status === 'success' ? 200 : 400).json(result);
  }

  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(analysisId, req.account.id);
  if (!analysis) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'Analysis not found' }, res, 404);
  }

  if (analysis.revision !== expectedRevision) {
    return recordReceipt(req.account.id, operationId, 'conflict', { error: 'Analysis updated in another tab' }, res, 409);
  }

  const selectedNode = db.prepare('SELECT * FROM analysis_nodes WHERE id = ?').get(analysis.selected_node_id);
  if (!selectedNode) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'Selected node not found' }, res, 400);
  }

  // Get children
  const children = db.prepare('SELECT * FROM analysis_nodes WHERE parent_id = ?').all(selectedNode.id);
  if (children.length === 0) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'No moves to redo' }, res, 400);
  }

  let targetChild;
  if (children.length === 1) {
    targetChild = children[0];
  } else {
    // Multiple children - need childId
    if (typeof childId !== 'number') {
      return recordReceipt(req.account.id, operationId, 'error', { error: 'Multiple continuations - childId required' }, res, 400);
    }
    targetChild = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND parent_id = ?').get(childId, selectedNode.id);
    if (!targetChild) {
      return recordReceipt(req.account.id, operationId, 'error', { error: 'Invalid child node' }, res, 400);
    }
  }

  // Select child
  db.prepare('UPDATE analyses SET selected_node_id = ?, revision = revision + 1 WHERE id = ?').run(targetChild.id, analysisId);

  const updatedAnalysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId);
  const nodes = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ?').all(analysisId);
  recordReceipt(req.account.id, operationId, 'success', {
    analysis: buildAnalysisResponse(updatedAnalysis, nodes)
  }, res, 200);
});

// Select node
app.post('/api/analyses/:id/select', requireAuth, (req, res) => {
  const analysisId = parseInt(req.params.id);
  const { nodeId, operationId, expectedRevision } = req.body;

  if (typeof nodeId !== 'number') {
    return res.status(400).json({ error: 'Invalid node ID' });
  }
  if (!operationId || typeof operationId !== 'string') {
    return res.status(400).json({ error: 'Invalid operation ID' });
  }
  if (typeof expectedRevision !== 'number') {
    return res.status(400).json({ error: 'Invalid revision' });
  }

  // Check for duplicate operation
  const receipt = db.prepare('SELECT * FROM operation_receipts WHERE account_id = ? AND operation_id = ?').get(req.account.id, operationId);
  if (receipt) {
    const result = JSON.parse(receipt.result);
    return res.status(receipt.status === 'success' ? 200 : 400).json(result);
  }

  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(analysisId, req.account.id);
  if (!analysis) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'Analysis not found' }, res, 404);
  }

  if (analysis.revision !== expectedRevision) {
    return recordReceipt(req.account.id, operationId, 'conflict', { error: 'Analysis updated in another tab' }, res, 409);
  }

  const node = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(nodeId, analysisId);
  if (!node) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'Node not found' }, res, 400);
  }

  db.prepare('UPDATE analyses SET selected_node_id = ?, revision = revision + 1 WHERE id = ?').run(nodeId, analysisId);

  const updatedAnalysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId);
  const nodes = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ?').all(analysisId);
  recordReceipt(req.account.id, operationId, 'success', {
    analysis: buildAnalysisResponse(updatedAnalysis, nodes)
  }, res, 200);
});

// Rename analysis
app.post('/api/analyses/:id/rename', requireAuth, (req, res) => {
  const analysisId = parseInt(req.params.id);
  const { name, operationId, expectedRevision } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Invalid name' });
  }
  if (!operationId || typeof operationId !== 'string') {
    return res.status(400).json({ error: 'Invalid operation ID' });
  }
  if (typeof expectedRevision !== 'number') {
    return res.status(400).json({ error: 'Invalid revision' });
  }

  // Check for duplicate operation
  const receipt = db.prepare('SELECT * FROM operation_receipts WHERE account_id = ? AND operation_id = ?').get(req.account.id, operationId);
  if (receipt) {
    const result = JSON.parse(receipt.result);
    return res.status(receipt.status === 'success' ? 200 : 400).json(result);
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0 || trimmedName.length > 60) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'Name must be 1-60 characters' }, res, 400);
  }

  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(analysisId, req.account.id);
  if (!analysis) {
    return recordReceipt(req.account.id, operationId, 'error', { error: 'Analysis not found' }, res, 404);
  }

  if (analysis.revision !== expectedRevision) {
    return recordReceipt(req.account.id, operationId, 'conflict', { error: 'Analysis updated in another tab' }, res, 409);
  }

  db.prepare('UPDATE analyses SET name = ?, revision = revision + 1 WHERE id = ?').run(trimmedName, analysisId);

  const updatedAnalysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId);
  const nodes = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ?').all(analysisId);
  recordReceipt(req.account.id, operationId, 'success', {
    analysis: buildAnalysisResponse(updatedAnalysis, nodes)
  }, res, 200);
});

// Compare positions
app.post('/api/analyses/:id/compare', requireAuth, (req, res) => {
  const analysisId = parseInt(req.params.id);
  const { leftNodeId, rightNodeId } = req.body;

  if (typeof leftNodeId !== 'number' || typeof rightNodeId !== 'number') {
    return res.status(400).json({ error: 'Invalid node IDs' });
  }

  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(analysisId, req.account.id);
  if (!analysis) {
    return res.status(404).json({ error: 'Analysis not found' });
  }

  const leftNode = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(leftNodeId, analysisId);
  const rightNode = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(rightNodeId, analysisId);

  if (!leftNode || !rightNode) {
    return res.status(400).json({ error: 'Node not found' });
  }

  const leftBoard = JSON.parse(leftNode.board);
  const rightBoard = JSON.parse(rightNode.board);

  // Count common prefix
  let commonPrefix = 0;
  for (let i = 0; i < 42 && i < Math.min(leftBoard.length, rightBoard.length); i++) {
    if (leftBoard[i] !== '' || rightBoard[i] !== '') {
      commonPrefix = i + 1;
    } else if (leftBoard[i] === rightBoard[i]) {
      commonPrefix = i + 1;
    } else {
      break;
    }
  }

  // Find differences
  const differences = [];
  for (let i = 0; i < 42; i++) {
    if (leftBoard[i] !== rightBoard[i]) {
      const row = 6 - Math.floor(i / 7);
      const col = (i % 7) + 1;
      differences.push({
        index: i,
        row,
        col,
        leftCell: leftBoard[i],
        rightCell: rightBoard[i]
      });
    }
  }

  res.json({
    comparison: {
      leftNodeId,
      rightNodeId,
      leftBoard,
      rightBoard,
      commonPrefix,
      differences
    }
  });
});

// Transplant preview - stub for now
app.post('/api/analyses/:id/transplant-preview', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Not yet implemented' });
});

// Transplant commit - stub for now
app.post('/api/analyses/:id/transplant-commit', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Not yet implemented' });
});

// Tactical reports - stub for now
app.get('/api/analyses/:id/tactical', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Not yet implemented' });
});

// Helper function
function buildAnalysisResponse(analysis, nodes) {
  return {
    id: analysis.id,
    matchId: analysis.match_id,
    sourceStep: analysis.source_step,
    name: analysis.name,
    revision: analysis.revision,
    rootBoard: JSON.parse(analysis.root_board),
    rootPlayer: analysis.root_player,
    selectedNodeId: analysis.selected_node_id,
    nodes: nodes.map(n => ({
      id: n.id,
      parentId: n.parent_id,
      column: n.column_num,
      board: JSON.parse(n.board),
      currentPlayer: n.current_player,
      winningCells: n.winning_cells === 'none' ? [] : JSON.parse(n.winning_cells),
      status: n.status
    }))
  };
}

// Start server
initializeDatabase();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`DropLine server listening on port ${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});

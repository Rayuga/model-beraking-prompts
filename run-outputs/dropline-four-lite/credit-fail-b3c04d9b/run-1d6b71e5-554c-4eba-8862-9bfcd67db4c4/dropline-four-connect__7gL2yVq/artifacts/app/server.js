const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || '/app/dropline.db';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;

function initializeDatabase() {
  const dbExists = fs.existsSync(DB_PATH);
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  if (!dbExists) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY,
        account_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );

      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY,
        account_id INTEGER UNIQUE NOT NULL,
        current_board TEXT NOT NULL,
        current_player TEXT NOT NULL,
        status TEXT NOT NULL,
        winning_cells TEXT,
        red_wins INTEGER DEFAULT 0,
        yellow_wins INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        revision INTEGER DEFAULT 0,
        round_id TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );

      CREATE TABLE IF NOT EXISTS moves (
        id INTEGER PRIMARY KEY,
        game_id INTEGER NOT NULL,
        move_number INTEGER NOT NULL,
        color TEXT NOT NULL,
        column_num INTEGER NOT NULL,
        row_num INTEGER NOT NULL,
        board_index INTEGER NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games(id)
      );

      CREATE TABLE IF NOT EXISTS redo_stack (
        id INTEGER PRIMARY KEY,
        game_id INTEGER NOT NULL,
        move_number INTEGER NOT NULL,
        color TEXT NOT NULL,
        column_num INTEGER NOT NULL,
        row_num INTEGER NOT NULL,
        board_index INTEGER NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games(id)
      );

      CREATE TABLE IF NOT EXISTS archives (
        id INTEGER PRIMARY KEY,
        account_id INTEGER NOT NULL,
        match_id TEXT NOT NULL,
        result TEXT NOT NULL,
        final_board TEXT NOT NULL,
        move_count INTEGER NOT NULL,
        completed_at TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );

      CREATE TABLE IF NOT EXISTS operation_idempotency (
        id INTEGER PRIMARY KEY,
        account_id INTEGER NOT NULL,
        operation_id TEXT UNIQUE NOT NULL,
        result TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );
    `);

    seedDatabase();
  }
}

function seedDatabase() {
  const seedPath = '/assets/artifacts/dropline_seed.xlsx';
  if (!fs.existsSync(seedPath)) {
    console.warn('Seed file not found, creating empty database');
    return;
  }

  const wb = XLSX.readFile(seedPath);

  // Import accounts
  const accountsData = XLSX.utils.sheet_to_json(wb.Sheets['Accounts']);
  for (const acc of accountsData) {
    const passwordHash = crypto
      .createHash('sha256')
      .update(acc.Password)
      .digest('hex');
    db.prepare(`
      INSERT INTO accounts (email, name, password_hash)
      VALUES (?, ?, ?)
    `).run(acc.Email, acc.Name, passwordHash);
  }

  // Import initial game states
  const gameStates = XLSX.utils.sheet_to_json(wb.Sheets['Initial Game State']);
  for (const state of gameStates) {
    const account = db.prepare('SELECT id FROM accounts WHERE email = ?').get(
      state['Account email']
    );
    if (account) {
      const appliedHistory = state['Applied history'] === 'none' ? [] : JSON.parse(state['Applied history']);
      const redoHistory = state['Redo history'] === 'none' ? [] : JSON.parse(state['Redo history']);

      db.prepare(`
        INSERT INTO games (
          account_id, current_board, current_player, status, winning_cells,
          red_wins, yellow_wins, draws, revision, round_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        account.id,
        state.Board,
        state['Current player'],
        state.Status,
        state['Winning cells'],
        state['Red wins'],
        state['Yellow wins'],
        state.Draws,
        state.Revision,
        state['Round id']
      );

      const game = db.prepare('SELECT id FROM games WHERE account_id = ?').get(account.id);

      // Insert applied moves
      for (let i = 0; i < appliedHistory.length; i++) {
        const move = appliedHistory[i];
        db.prepare(`
          INSERT INTO moves (game_id, move_number, color, column_num, row_num, board_index)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(game.id, i + 1, move.color, move.column, move.row, move.index);
      }

      // Insert redo stack
      for (let i = 0; i < redoHistory.length; i++) {
        const move = redoHistory[i];
        db.prepare(`
          INSERT INTO redo_stack (game_id, move_number, color, column_num, row_num, board_index)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(game.id, appliedHistory.length + i + 1, move.color, move.column, move.row, move.index);
      }
    }
  }

  // Import completed matches
  const completedMatches = XLSX.utils.sheet_to_json(wb.Sheets['Completed Matches']);
  for (const match of completedMatches) {
    const account = db.prepare('SELECT id FROM accounts WHERE email = ?').get(
      match['Account email']
    );
    if (account) {
      const moves = JSON.parse(match.Moves);
      db.prepare(`
        INSERT INTO archives (account_id, match_id, result, final_board, move_count, completed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        account.id,
        match['Match id'],
        match.Result,
        match['Final board'],
        moves.length,
        match['Completed at']
      );
    }
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const session = db
    .prepare(`
      SELECT s.*, a.id as account_id, a.email, a.name
      FROM sessions s
      JOIN accounts a ON s.account_id = a.id
      WHERE s.token = ?
    `)
    .get(token);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.accountId = session.account_id;
  req.email = session.email;
  req.name = session.name;
  next();
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ready' });
});

app.post('/api/sign-in', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email);

  if (!account || account.password_hash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO sessions (account_id, token, created_at)
    VALUES (?, ?, ?)
  `).run(account.id, token, createdAt);

  res.json({
    token,
    email: account.email,
    name: account.name,
  });
});

app.post('/api/sign-out', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE account_id = ?').run(req.accountId);
  res.json({ success: true });
});

function safeJsonParse(str) {
  if (!str || str === 'none') {
    return null;
  }
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

app.get('/api/game', authenticateToken, (req, res) => {
  const game = db
    .prepare('SELECT * FROM games WHERE account_id = ?')
    .get(req.accountId);

  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const moves = db
    .prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number ASC')
    .all(game.id);

  const redoStack = db
    .prepare('SELECT * FROM redo_stack WHERE game_id = ? ORDER BY move_number ASC')
    .all(game.id);

  res.json({
    board: safeJsonParse(game.current_board) || new Array(42).fill(''),
    currentPlayer: game.current_player,
    status: game.status,
    winningCells: safeJsonParse(game.winning_cells) || [],
    redWins: game.red_wins,
    yellowWins: game.yellow_wins,
    draws: game.draws,
    revision: game.revision,
    roundId: game.round_id,
    appliedHistory: moves,
    redoHistory: redoStack,
  });
});

function checkWinner(board) {
  const checkLine = (indices) => {
    const colors = indices.map((i) => board[i]).filter((c) => c);
    if (
      colors.length === 4 &&
      colors.every((c) => c === colors[0])
    ) {
      return { winner: colors[0], indices };
    }
    return null;
  };

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      const idx = row * 7 + col;
      if (board[idx]) {
        // Horizontal
        if (col <= 3) {
          const result = checkLine([idx, idx + 1, idx + 2, idx + 3]);
          if (result) return result;
        }
        // Vertical
        if (row <= 2) {
          const result = checkLine([
            idx,
            idx + 7,
            idx + 14,
            idx + 21,
          ]);
          if (result) return result;
        }
        // Diagonal down-right
        if (row <= 2 && col <= 3) {
          const result = checkLine([idx, idx + 8, idx + 16, idx + 24]);
          if (result) return result;
        }
        // Diagonal down-left
        if (row <= 2 && col >= 3) {
          const result = checkLine([idx, idx + 6, idx + 12, idx + 18]);
          if (result) return result;
        }
      }
    }
  }
  return null;
}

function isBoardFull(board) {
  return board.every((cell) => cell !== '');
}

app.post('/api/move', authenticateToken, (req, res) => {
  const { column, revision, operationId } = req.body;

  if (!column || typeof column !== 'number') {
    return res.status(400).json({ error: 'Invalid column' });
  }

  // Check idempotency
  const existing = db
    .prepare('SELECT result FROM operation_idempotency WHERE account_id = ? AND operation_id = ?')
    .get(req.accountId, operationId);

  if (existing) {
    return res.json(JSON.parse(existing.result));
  }

  const game = db.prepare('SELECT * FROM games WHERE account_id = ?').get(req.accountId);

  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (game.revision !== revision) {
    const currentGame = db.prepare('SELECT * FROM games WHERE account_id = ?').get(req.accountId);
    const moves = db
      .prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number ASC')
      .all(game.id);
    const redoStack = db
      .prepare('SELECT * FROM redo_stack WHERE game_id = ? ORDER BY move_number ASC')
      .all(game.id);

    const response = {
      error: 'Game updated in another tab',
      board: safeJsonParse(currentGame.current_board) || new Array(42).fill(''),
      currentPlayer: currentGame.current_player,
      status: currentGame.status,
      winningCells: currentGame.winning_cells ? safeJsonParse(currentGame.winning_cells) : [],
      redWins: currentGame.red_wins,
      yellowWins: currentGame.yellow_wins,
      draws: currentGame.draws,
      revision: currentGame.revision,
      roundId: currentGame.round_id,
      appliedHistory: moves,
      redoHistory: redoStack,
    };

    db.prepare(
      'INSERT INTO operation_idempotency (account_id, operation_id, result) VALUES (?, ?, ?)'
    ).run(req.accountId, operationId, JSON.stringify(response));

    return res.status(409).json(response);
  }

  const board = safeJsonParse(game.current_board) || new Array(42).fill('');

  if (game.status !== 'active') {
    const response = {
      error: 'Game is not active',
      board,
      currentPlayer: game.current_player,
      status: game.status,
    };
    db.prepare(
      'INSERT INTO operation_idempotency (account_id, operation_id, result) VALUES (?, ?, ?)'
    ).run(req.accountId, operationId, JSON.stringify(response));
    return res.status(400).json(response);
  }

  // Find lowest empty row in the column
  let rowIndex = -1;
  for (let row = 5; row >= 0; row--) {
    const cellIndex = row * 7 + (column - 1);
    if (board[cellIndex] === '') {
      rowIndex = row;
      break;
    }
  }

  if (rowIndex === -1) {
    const response = {
      error: `Column ${column} is full`,
      board,
      currentPlayer: game.current_player,
      status: game.status,
    };
    db.prepare(
      'INSERT INTO operation_idempotency (account_id, operation_id, result) VALUES (?, ?, ?)'
    ).run(req.accountId, operationId, JSON.stringify(response));
    return res.status(400).json(response);
  }

  const cellIndex = rowIndex * 7 + (column - 1);
  const color = game.current_player;
  board[cellIndex] = color;

  const moveNumber = db
    .prepare('SELECT MAX(move_number) as max FROM moves WHERE game_id = ?')
    .get(game.id).max || 0;

  const nextPlayer = color === 'Red' ? 'Yellow' : 'Red';
  let status = 'active';
  let winningCells = null;
  let newRedWins = game.red_wins;
  let newYellowWins = game.yellow_wins;
  let newDraws = game.draws;

  const winner = checkWinner(board);
  if (winner) {
    status = `${winner.winner} wins`;
    winningCells = winner.indices;
    if (winner.winner === 'Red') {
      newRedWins++;
    } else {
      newYellowWins++;
    }
  } else if (isBoardFull(board)) {
    status = 'Draw';
    newDraws++;
  }

  const newRevision = game.revision + 1;

  // Clear redo stack when a new move is made
  db.prepare('DELETE FROM redo_stack WHERE game_id = ?').run(game.id);

  // Insert the move
  db.prepare(`
    INSERT INTO moves (game_id, move_number, color, column_num, row_num, board_index)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(game.id, moveNumber + 1, color, column, rowIndex + 1, cellIndex);

  // Update game state
  db.prepare(`
    UPDATE games
    SET current_board = ?, current_player = ?, status = ?, winning_cells = ?,
        red_wins = ?, yellow_wins = ?, draws = ?, revision = ?
    WHERE id = ?
  `).run(
    JSON.stringify(board),
    status === 'active' ? nextPlayer : game.current_player,
    status,
    winningCells ? JSON.stringify(winningCells) : null,
    newRedWins,
    newYellowWins,
    newDraws,
    newRevision,
    game.id
  );

  // Archive if game is terminal
  if (status !== 'active') {
    const roundId = game.round_id;
    const archiveId = `${roundId}-${Date.now()}`;
    const moves = db
      .prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number ASC')
      .all(game.id);

    db.prepare(`
      INSERT INTO archives (account_id, match_id, result, final_board, move_count, completed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.accountId,
      archiveId,
      status,
      JSON.stringify(board),
      moves.length,
      new Date().toISOString()
    );
  }

  const response = {
    board,
    currentPlayer: status === 'active' ? nextPlayer : game.current_player,
    status,
    winningCells: winningCells || [],
    redWins: newRedWins,
    yellowWins: newYellowWins,
    draws: newDraws,
    revision: newRevision,
    roundId: game.round_id,
  };

  db.prepare(
    'INSERT INTO operation_idempotency (account_id, operation_id, result) VALUES (?, ?, ?)'
  ).run(req.accountId, operationId, JSON.stringify(response));

  res.json(response);
});

app.post('/api/undo', authenticateToken, (req, res) => {
  const { revision, operationId } = req.body;

  if (!operationId) {
    return res.status(400).json({ error: 'Operation ID required' });
  }

  // Check idempotency
  const existing = db
    .prepare('SELECT result FROM operation_idempotency WHERE account_id = ? AND operation_id = ?')
    .get(req.accountId, operationId);

  if (existing) {
    return res.json(JSON.parse(existing.result));
  }

  const game = db.prepare('SELECT * FROM games WHERE account_id = ?').get(req.accountId);

  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (game.revision !== revision) {
    const moves = db
      .prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number ASC')
      .all(game.id);
    const redoStack = db
      .prepare('SELECT * FROM redo_stack WHERE game_id = ? ORDER BY move_number ASC')
      .all(game.id);

    const response = {
      error: 'Game updated in another tab',
      board: safeJsonParse(game.current_board) || new Array(42).fill(''),
      currentPlayer: game.current_player,
      status: game.status,
      winningCells: game.winning_cells ? safeJsonParse(game.winning_cells) : [],
      redWins: game.red_wins,
      yellowWins: game.yellow_wins,
      draws: game.draws,
      revision: game.revision,
      roundId: game.round_id,
      appliedHistory: moves,
      redoHistory: redoStack,
    };

    db.prepare(
      'INSERT INTO operation_idempotency (account_id, operation_id, result) VALUES (?, ?, ?)'
    ).run(req.accountId, operationId, JSON.stringify(response));

    return res.status(409).json(response);
  }

  const lastMove = db
    .prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number DESC LIMIT 1')
    .get(game.id);

  if (!lastMove) {
    const response = {
      error: 'No moves to undo',
      board: safeJsonParse(game.current_board) || new Array(42).fill(''),
      currentPlayer: game.current_player,
      status: game.status,
    };
    db.prepare(
      'INSERT INTO operation_idempotency (account_id, operation_id, result) VALUES (?, ?, ?)'
    ).run(req.accountId, operationId, JSON.stringify(response));
    return res.status(400).json(response);
  }

  // Remove the move from applied history
  db.prepare('DELETE FROM moves WHERE id = ?').run(lastMove.id);

  // Add to redo stack
  db.prepare(`
    INSERT INTO redo_stack (game_id, move_number, color, column_num, row_num, board_index)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(game.id, lastMove.move_number, lastMove.color, lastMove.column_num, lastMove.row_num, lastMove.board_index);

  // Rebuild board
  const board = new Array(42).fill('');
  const moves = db
    .prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number ASC')
    .all(game.id);

  for (const move of moves) {
    board[move.board_index] = move.color;
  }

  // Determine new status and winning cells
  let status = 'active';
  let winningCells = null;
  let newRedWins = game.red_wins;
  let newYellowWins = game.yellow_wins;
  let newDraws = game.draws;

  // If the undone move was terminal, revert the score
  if (game.status.includes('wins')) {
    if (game.status === 'Red wins') {
      newRedWins--;
    } else {
      newYellowWins--;
    }
  } else if (game.status === 'Draw') {
    newDraws--;
  }

  // Check if new state is terminal
  const winner = checkWinner(board);
  if (winner) {
    status = `${winner.winner} wins`;
    winningCells = winner.indices;
  } else if (isBoardFull(board)) {
    status = 'Draw';
  }

  const newRevision = game.revision + 1;
  const previousColor = lastMove.color;
  const nextPlayer = previousColor;

  db.prepare(`
    UPDATE games
    SET current_board = ?, current_player = ?, status = ?, winning_cells = ?,
        red_wins = ?, yellow_wins = ?, draws = ?, revision = ?
    WHERE id = ?
  `).run(
    JSON.stringify(board),
    nextPlayer,
    status,
    winningCells ? JSON.stringify(winningCells) : null,
    newRedWins,
    newYellowWins,
    newDraws,
    newRevision,
    game.id
  );

  const response = {
    board,
    currentPlayer: nextPlayer,
    status,
    winningCells: winningCells || [],
    redWins: newRedWins,
    yellowWins: newYellowWins,
    draws: newDraws,
    revision: newRevision,
    roundId: game.round_id,
    appliedHistory: moves.slice(0, -1),
    redoHistory: db
      .prepare('SELECT * FROM redo_stack WHERE game_id = ? ORDER BY move_number ASC')
      .all(game.id),
  };

  db.prepare(
    'INSERT INTO operation_idempotency (account_id, operation_id, result) VALUES (?, ?, ?)'
  ).run(req.accountId, operationId, JSON.stringify(response));

  res.json(response);
});

app.post('/api/redo', authenticateToken, (req, res) => {
  const { revision, operationId } = req.body;

  if (!operationId) {
    return res.status(400).json({ error: 'Operation ID required' });
  }

  // Check idempotency
  const existing = db
    .prepare('SELECT result FROM operation_idempotency WHERE account_id = ? AND operation_id = ?')
    .get(req.accountId, operationId);

  if (existing) {
    return res.json(JSON.parse(existing.result));
  }

  const game = db.prepare('SELECT * FROM games WHERE account_id = ?').get(req.accountId);

  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (game.revision !== revision) {
    const moves = db
      .prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number ASC')
      .all(game.id);
    const redoStack = db
      .prepare('SELECT * FROM redo_stack WHERE game_id = ? ORDER BY move_number ASC')
      .all(game.id);

    const response = {
      error: 'Game updated in another tab',
      board: safeJsonParse(game.current_board) || new Array(42).fill(''),
      currentPlayer: game.current_player,
      status: game.status,
      winningCells: game.winning_cells ? safeJsonParse(game.winning_cells) : [],
      redWins: game.red_wins,
      yellowWins: game.yellow_wins,
      draws: game.draws,
      revision: game.revision,
      roundId: game.round_id,
      appliedHistory: moves,
      redoHistory: redoStack,
    };

    db.prepare(
      'INSERT INTO operation_idempotency (account_id, operation_id, result) VALUES (?, ?, ?)'
    ).run(req.accountId, operationId, JSON.stringify(response));

    return res.status(409).json(response);
  }

  const nextRedoMove = db
    .prepare('SELECT * FROM redo_stack WHERE game_id = ? ORDER BY move_number ASC LIMIT 1')
    .get(game.id);

  if (!nextRedoMove) {
    const response = {
      error: 'No moves to redo',
      board: safeJsonParse(game.current_board) || new Array(42).fill(''),
      currentPlayer: game.current_player,
      status: game.status,
    };
    db.prepare(
      'INSERT INTO operation_idempotency (account_id, operation_id, result) VALUES (?, ?, ?)'
    ).run(req.accountId, operationId, JSON.stringify(response));
    return res.status(400).json(response);
  }

  // Move from redo stack to applied moves
  db.prepare('DELETE FROM redo_stack WHERE id = ?').run(nextRedoMove.id);

  const board = safeJsonParse(game.current_board) || new Array(42).fill('');
  board[nextRedoMove.board_index] = nextRedoMove.color;

  db.prepare(`
    INSERT INTO moves (game_id, move_number, color, column_num, row_num, board_index)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    game.id,
    nextRedoMove.move_number,
    nextRedoMove.color,
    nextRedoMove.column_num,
    nextRedoMove.row_num,
    nextRedoMove.board_index
  );

  // Determine new status and winning cells
  let status = 'active';
  let winningCells = null;
  let newRedWins = game.red_wins;
  let newYellowWins = game.yellow_wins;
  let newDraws = game.draws;

  const winner = checkWinner(board);
  if (winner) {
    status = `${winner.winner} wins`;
    winningCells = winner.indices;
    if (winner.winner === 'Red') {
      newRedWins++;
    } else {
      newYellowWins++;
    }
  } else if (isBoardFull(board)) {
    status = 'Draw';
    newDraws++;
  }

  const newRevision = game.revision + 1;
  const nextPlayer = nextRedoMove.color === 'Red' ? 'Yellow' : 'Red';

  db.prepare(`
    UPDATE games
    SET current_board = ?, current_player = ?, status = ?, winning_cells = ?,
        red_wins = ?, yellow_wins = ?, draws = ?, revision = ?
    WHERE id = ?
  `).run(
    JSON.stringify(board),
    status === 'active' ? nextPlayer : nextRedoMove.color,
    status,
    winningCells ? JSON.stringify(winningCells) : null,
    newRedWins,
    newYellowWins,
    newDraws,
    newRevision,
    game.id
  );

  const moves = db
    .prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number ASC')
    .all(game.id);
  const redoStack = db
    .prepare('SELECT * FROM redo_stack WHERE game_id = ? ORDER BY move_number ASC')
    .all(game.id);

  const response = {
    board,
    currentPlayer: status === 'active' ? nextPlayer : nextRedoMove.color,
    status,
    winningCells: winningCells || [],
    redWins: newRedWins,
    yellowWins: newYellowWins,
    draws: newDraws,
    revision: newRevision,
    roundId: game.round_id,
    appliedHistory: moves,
    redoHistory: redoStack,
  };

  db.prepare(
    'INSERT INTO operation_idempotency (account_id, operation_id, result) VALUES (?, ?, ?)'
  ).run(req.accountId, operationId, JSON.stringify(response));

  res.json(response);
});

app.post('/api/new-game', authenticateToken, (req, res) => {
  const { revision, operationId } = req.body;

  if (!operationId) {
    return res.status(400).json({ error: 'Operation ID required' });
  }

  // Check idempotency
  const existing = db
    .prepare('SELECT result FROM operation_idempotency WHERE account_id = ? AND operation_id = ?')
    .get(req.accountId, operationId);

  if (existing) {
    return res.json(JSON.parse(existing.result));
  }

  const game = db.prepare('SELECT * FROM games WHERE account_id = ?').get(req.accountId);

  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (game.revision !== revision) {
    const moves = db
      .prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number ASC')
      .all(game.id);
    const redoStack = db
      .prepare('SELECT * FROM redo_stack WHERE game_id = ? ORDER BY move_number ASC')
      .all(game.id);

    const response = {
      error: 'Game updated in another tab',
      board: safeJsonParse(game.current_board) || new Array(42).fill(''),
      currentPlayer: game.current_player,
      status: game.status,
      winningCells: game.winning_cells ? safeJsonParse(game.winning_cells) : [],
      redWins: game.red_wins,
      yellowWins: game.yellow_wins,
      draws: game.draws,
      revision: game.revision,
      roundId: game.round_id,
      appliedHistory: moves,
      redoHistory: redoStack,
    };

    db.prepare(
      'INSERT INTO operation_idempotency (account_id, operation_id, result) VALUES (?, ?, ?)'
    ).run(req.accountId, operationId, JSON.stringify(response));

    return res.status(409).json(response);
  }

  const newBoard = new Array(42).fill('');
  const newRoundId = `round-${Date.now()}`;
  const newRevision = game.revision + 1;

  // Clear applied moves and redo stack
  db.prepare('DELETE FROM moves WHERE game_id = ?').run(game.id);
  db.prepare('DELETE FROM redo_stack WHERE game_id = ?').run(game.id);

  // Update game
  db.prepare(`
    UPDATE games
    SET current_board = ?, current_player = 'Red', status = 'active', winning_cells = NULL,
        revision = ?, round_id = ?
    WHERE id = ?
  `).run(
    JSON.stringify(newBoard),
    newRevision,
    newRoundId,
    game.id
  );

  const response = {
    board: newBoard,
    currentPlayer: 'Red',
    status: 'active',
    winningCells: [],
    redWins: game.red_wins,
    yellowWins: game.yellow_wins,
    draws: game.draws,
    revision: newRevision,
    roundId: newRoundId,
    appliedHistory: [],
    redoHistory: [],
  };

  db.prepare(
    'INSERT INTO operation_idempotency (account_id, operation_id, result) VALUES (?, ?, ?)'
  ).run(req.accountId, operationId, JSON.stringify(response));

  res.json(response);
});

app.get('/api/archive', authenticateToken, (req, res) => {
  const archives = db
    .prepare(`
      SELECT match_id, result, move_count, completed_at
      FROM archives
      WHERE account_id = ?
      ORDER BY completed_at DESC
      LIMIT 10
    `)
    .all(req.accountId);

  const totalCount = db
    .prepare('SELECT COUNT(*) as count FROM archives WHERE account_id = ?')
    .get(req.accountId).count;

  res.json({
    totalCount,
    records: archives,
  });
});

app.get('/api/archive/:matchId', authenticateToken, (req, res) => {
  const archive = db
    .prepare('SELECT * FROM archives WHERE account_id = ? AND match_id = ?')
    .get(req.accountId, req.params.matchId);

  if (!archive) {
    return res.status(404).json({ error: 'Archive not found' });
  }

  res.json({
    matchId: archive.match_id,
    result: archive.result,
    finalBoard: JSON.parse(archive.final_board),
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initializeDatabase();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

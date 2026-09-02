const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const express = require('express');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');

const PORT = 3000;
const DB_PATH = '/app/dropline.db';
const SEED_PATH = '/assets/artifacts/dropline_seed.xlsx';
const PUBLIC_DIR = path.join(__dirname, 'public');
const BOARD_COLUMNS = 7;
const BOARD_ROWS = 6;
const CELL_COUNT = BOARD_COLUMNS * BOARD_ROWS;

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(express.static(PUBLIC_DIR));

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    revoked_at TEXT
  );

  CREATE TABLE IF NOT EXISTS games (
    account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    board_json TEXT NOT NULL,
    turn TEXT NOT NULL,
    status TEXT NOT NULL,
    result TEXT NOT NULL,
    winning_cells_json TEXT NOT NULL,
    red_wins INTEGER NOT NULL,
    yellow_wins INTEGER NOT NULL,
    draws INTEGER NOT NULL,
    applied_history_json TEXT NOT NULL,
    redo_history_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const selectAccountByEmail = db.prepare('SELECT * FROM accounts WHERE email = ?');
const selectAccountByToken = db.prepare(`
  SELECT a.id, a.email, a.name, s.token
  FROM sessions s
  JOIN accounts a ON a.id = s.account_id
  WHERE s.token = ? AND s.revoked_at IS NULL
`);
const insertAccount = db.prepare(`
  INSERT INTO accounts (email, name, password_salt, password_hash, created_at)
  VALUES (?, ?, ?, ?, ?)
`);
const insertSession = db.prepare(`
  INSERT INTO sessions (token, account_id, created_at, revoked_at)
  VALUES (?, ?, ?, NULL)
`);
const revokeSession = db.prepare('UPDATE sessions SET revoked_at = ? WHERE token = ? AND revoked_at IS NULL');
const selectGame = db.prepare('SELECT * FROM games WHERE account_id = ?');
const insertGame = db.prepare(`
  INSERT OR IGNORE INTO games (
    account_id, board_json, turn, status, result, winning_cells_json,
    red_wins, yellow_wins, draws, applied_history_json, redo_history_json, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateGame = db.prepare(`
  UPDATE games
  SET board_json = ?, turn = ?, status = ?, result = ?, winning_cells_json = ?,
      red_wins = ?, yellow_wins = ?, draws = ?, applied_history_json = ?,
      redo_history_json = ?, updated_at = ?
  WHERE account_id = ?
`);
const insertAction = db.prepare(`
  INSERT INTO actions (account_id, type, payload_json, created_at)
  VALUES (?, ?, ?, ?)
`);

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function trimString(value) {
  return String(value || '').trim();
}

function gameError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, account) {
  const expected = Buffer.from(account.password_hash, 'hex');
  const actual = crypto.scryptSync(String(password), account.password_salt, 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function createEmptyBoard() {
  return Array(CELL_COUNT).fill(null);
}

function parseWinningCells(value) {
  const text = String(value || '').trim();
  if (!text || text.toLowerCase() === 'none') {
    return [];
  }
  return text
    .split(/[;,]/)
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isInteger(part) && part >= 0 && part < CELL_COUNT);
}

function parseBoardSeed(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === '42 empty cells') {
    return createEmptyBoard();
  }
  throw new Error(`Unsupported seed board description: ${value}`);
}

function buildInitialGameState(row) {
  const turn = trimString(row['Current player']) || 'Red';
  const status = (trimString(row.Status) || 'active').toLowerCase();
  const board = parseBoardSeed(row.Board);
  const winningCells = parseWinningCells(row['Winning cells']);
  const redWins = Number(row['Red wins']) || 0;
  const yellowWins = Number(row['Yellow wins']) || 0;
  const draws = Number(row.Draws) || 0;
  return {
    board,
    turn,
    status,
    result: status === 'active' ? '' : status,
    winningCells,
    redWins,
    yellowWins,
    draws,
    appliedMoves: [],
    redoMoves: []
  };
}

function deserializeGame(row) {
  return {
    board: JSON.parse(row.board_json),
    turn: row.turn,
    status: row.status,
    result: row.result,
    winningCells: JSON.parse(row.winning_cells_json),
    redWins: row.red_wins,
    yellowWins: row.yellow_wins,
    draws: row.draws,
    appliedMoves: JSON.parse(row.applied_history_json),
    redoMoves: JSON.parse(row.redo_history_json)
  };
}

function persistGame(accountId, state) {
  updateGame.run(
    JSON.stringify(state.board),
    state.turn,
    state.status,
    state.result,
    JSON.stringify(state.winningCells),
    state.redWins,
    state.yellowWins,
    state.draws,
    JSON.stringify(state.appliedMoves),
    JSON.stringify(state.redoMoves),
    nowIso(),
    accountId
  );
}

function oppositeColor(color) {
  return color === 'Red' ? 'Yellow' : 'Red';
}

function cellIndex(row, column) {
  return row * BOARD_COLUMNS + column;
}

function findLandingRow(board, column) {
  for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
    if (!board[cellIndex(row, column)]) {
      return row;
    }
  }
  return -1;
}

function lineWindow(line, placedIndex) {
  const position = line.indexOf(placedIndex);
  if (position === -1) {
    return line.slice(0, 4);
  }
  const start = Math.min(Math.max(position - 3, 0), line.length - 4);
  return line.slice(start, start + 4);
}

function findWinningCells(board, placedIndex, color) {
  const row = Math.floor(placedIndex / BOARD_COLUMNS);
  const column = placedIndex % BOARD_COLUMNS;
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];

  for (const [dr, dc] of directions) {
    const line = [placedIndex];

    let r = row - dr;
    let c = column - dc;
    while (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLUMNS && board[cellIndex(r, c)] === color) {
      line.unshift(cellIndex(r, c));
      r -= dr;
      c -= dc;
    }

    r = row + dr;
    c = column + dc;
    while (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLUMNS && board[cellIndex(r, c)] === color) {
      line.push(cellIndex(r, c));
      r += dr;
      c += dc;
    }

    if (line.length >= 4) {
      return lineWindow(line, placedIndex);
    }
  }

  return [];
}

function boardIsFull(board) {
  return board.every(Boolean);
}

function ensureGameSeed() {
  const workbook = XLSX.readFile(SEED_PATH);
  const accountSheet = workbook.Sheets.Accounts;
  const gameSheet = workbook.Sheets['Initial Game State'];
  const accountRows = XLSX.utils.sheet_to_json(accountSheet, { defval: '' });
  const gameRows = XLSX.utils.sheet_to_json(gameSheet, { defval: '' });

  const seedAccounts = new Map();
  for (const row of gameRows) {
    seedAccounts.set(normalizeEmail(row['Account email']), row);
  }

  for (const row of accountRows) {
    const email = normalizeEmail(row.Email);
    const name = trimString(row.Name);
    const password = String(row.Password || '');
    if (!email || !name) {
      continue;
    }

    let account = selectAccountByEmail.get(email);
    if (!account) {
      const { salt, hash } = hashPassword(password);
      insertAccount.run(email, name, salt, hash, nowIso());
      account = selectAccountByEmail.get(email);
    }

    const seedStateRow = seedAccounts.get(email);
    if (!seedStateRow) {
      continue;
    }

    const initialState = buildInitialGameState(seedStateRow);
    insertGame.run(
      account.id,
      JSON.stringify(initialState.board),
      initialState.turn,
      initialState.status,
      initialState.result,
      JSON.stringify(initialState.winningCells),
      initialState.redWins,
      initialState.yellowWins,
      initialState.draws,
      JSON.stringify(initialState.appliedMoves),
      JSON.stringify(initialState.redoMoves),
      nowIso()
    );
  }
}

function getOrCreateGame(accountId) {
  let row = selectGame.get(accountId);
  if (!row) {
    const fallbackState = {
      board: createEmptyBoard(),
      turn: 'Red',
      status: 'active',
      result: '',
      winningCells: [],
      redWins: 0,
      yellowWins: 0,
      draws: 0,
      appliedMoves: [],
      redoMoves: []
    };
    insertGame.run(
      accountId,
      JSON.stringify(fallbackState.board),
      fallbackState.turn,
      fallbackState.status,
      fallbackState.result,
      JSON.stringify(fallbackState.winningCells),
      fallbackState.redWins,
      fallbackState.yellowWins,
      fallbackState.draws,
      JSON.stringify(fallbackState.appliedMoves),
      JSON.stringify(fallbackState.redoMoves),
      nowIso()
    );
    row = selectGame.get(accountId);
  }
  return row;
}

function publicState(account, game) {
  return {
    account: {
      name: account.name,
      email: account.email
    },
    board: game.board,
    turn: game.turn,
    status: game.status,
    result: game.result,
    winningCells: game.winningCells,
    totals: {
      redWins: game.redWins,
      yellowWins: game.yellowWins,
      draws: game.draws
    },
    appliedMoves: game.appliedMoves,
    redoCount: game.redoMoves.length,
    canUndo: game.appliedMoves.length > 0,
    canRedo: game.redoMoves.length > 0,
    statusMessage: game.status === 'active' ? `${game.turn}'s turn` : game.result
  };
}

function currentAccountFromToken(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice(7).trim();
  if (!token) {
    return null;
  }
  return selectAccountByToken.get(token) || null;
}

function requireAuth(req, res, next) {
  const account = currentAccountFromToken(req);
  if (!account) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.account = account;
  next();
}

function withGameMutation(type, handler) {
  return db.transaction((accountId, payload) => {
    const row = getOrCreateGame(accountId);
    const state = deserializeGame(row);
    const result = handler(state, payload);
    persistGame(accountId, state);
    insertAction.run(accountId, type, JSON.stringify(payload || {}), nowIso());
    return result || state;
  });
}

const applyMove = withGameMutation('move', (state, payload) => {
  const column = Number(payload.column);
  if (!Number.isInteger(column) || column < 1 || column > BOARD_COLUMNS) {
    throw gameError(400, 'Invalid column');
  }
  if (state.status !== 'active') {
    throw gameError(409, 'Game is over');
  }

  const columnIndex = column - 1;
  const landingRow = findLandingRow(state.board, columnIndex);
  if (landingRow === -1) {
    throw gameError(409, `Column ${column} is full`);
  }

  const color = state.turn;
  const index = cellIndex(landingRow, columnIndex);
  state.board[index] = color;
  const move = {
    moveNumber: state.appliedMoves.length + 1,
    color,
    column,
    row: landingRow + 1,
    cellIndex: index
  };
  state.appliedMoves.push(move);
  state.redoMoves = [];

  const winningCells = findWinningCells(state.board, index, color);
  if (winningCells.length === 4) {
    state.status = 'won';
    state.result = `${color} wins`;
    state.winningCells = winningCells;
    if (color === 'Red') {
      state.redWins += 1;
    } else {
      state.yellowWins += 1;
    }
  } else if (boardIsFull(state.board)) {
    state.status = 'draw';
    state.result = 'Draw';
    state.winningCells = [];
    state.draws += 1;
  } else {
    state.status = 'active';
    state.result = '';
    state.winningCells = [];
  }

  state.turn = oppositeColor(color);
  return state;
});

const undoMove = withGameMutation('undo', (state) => {
  if (state.appliedMoves.length === 0) {
    throw gameError(409, 'Nothing to undo');
  }

  const undone = state.appliedMoves.pop();
  state.redoMoves.push(undone);
  state.board[undone.cellIndex] = null;

  if (state.status === 'won') {
    if (undone.color === 'Red') {
      state.redWins -= 1;
    } else {
      state.yellowWins -= 1;
    }
  } else if (state.status === 'draw') {
    state.draws -= 1;
  }

  state.status = 'active';
  state.result = '';
  state.winningCells = [];
  state.turn = undone.color;
  return state;
});

const redoMove = withGameMutation('redo', (state) => {
  if (state.redoMoves.length === 0) {
    throw gameError(409, 'Nothing to redo');
  }
  if (state.status !== 'active') {
    throw gameError(409, 'Game is over');
  }

  const move = state.redoMoves.pop();
  state.board[move.cellIndex] = move.color;
  state.appliedMoves.push(move);

  const winningCells = findWinningCells(state.board, move.cellIndex, move.color);
  if (winningCells.length === 4) {
    state.status = 'won';
    state.result = `${move.color} wins`;
    state.winningCells = winningCells;
    if (move.color === 'Red') {
      state.redWins += 1;
    } else {
      state.yellowWins += 1;
    }
  } else if (boardIsFull(state.board)) {
    state.status = 'draw';
    state.result = 'Draw';
    state.winningCells = [];
    state.draws += 1;
  } else {
    state.status = 'active';
    state.result = '';
    state.winningCells = [];
  }

  state.turn = oppositeColor(move.color);
  return state;
});

const newGame = withGameMutation('new-game', (state) => {
  state.board = createEmptyBoard();
  state.turn = 'Red';
  state.status = 'active';
  state.result = '';
  state.winningCells = [];
  state.appliedMoves = [];
  state.redoMoves = [];
  return state;
});

function handleRoute(fn) {
  return (req, res, next) => {
    try {
      fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

app.get('/health', handleRoute((req, res) => {
  res.json({ ok: true });
}));

app.post('/api/login', handleRoute((req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  const password = String(req.body && req.body.password ? req.body.password : '');
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const account = selectAccountByEmail.get(email);
  if (!account || !verifyPassword(password, account)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }

  const token = crypto.randomBytes(32).toString('base64url');
  insertSession.run(token, account.id, nowIso());
  const state = deserializeGame(getOrCreateGame(account.id));
  res.json({
    token,
    account: {
      name: account.name,
      email: account.email
    },
    state: publicState(account, state)
  });
}));

app.post('/api/logout', requireAuth, handleRoute((req, res) => {
  const token = String(req.headers.authorization || '').slice(7).trim();
  revokeSession.run(nowIso(), token);
  res.json({ ok: true });
}));

app.get('/api/state', requireAuth, handleRoute((req, res) => {
  const account = req.account;
  const state = deserializeGame(getOrCreateGame(account.id));
  res.json(publicState(account, state));
}));

app.post('/api/move', requireAuth, handleRoute((req, res) => {
  const state = applyMove(req.account.id, { column: Number(req.body && req.body.column) });
  res.json(publicState(req.account, state));
}));

app.post('/api/undo', requireAuth, handleRoute((req, res) => {
  const state = undoMove(req.account.id, {});
  res.json(publicState(req.account, state));
}));

app.post('/api/redo', requireAuth, handleRoute((req, res) => {
  const state = redoMove(req.account.id, {});
  res.json(publicState(req.account, state));
}));

app.post('/api/new-game', requireAuth, handleRoute((req, res) => {
  const state = newGame(req.account.id, {});
  res.json(publicState(req.account, state));
}));

app.get('/', (req, res, next) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((error, req, res, next) => {
  if (error && error.status) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

ensureGameSeed();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DropLine listening on http://0.0.0.0:${PORT}`);
});

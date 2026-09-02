const express = require('express');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const APP_DIR = '/app';
const DB_PATH = path.join(APP_DIR, 'dropline.db');
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const SEED_PATH = '/assets/artifacts/dropline_seed.xlsx';
const PORT = 3000;

const app = express();
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  token_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_state (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  board_json TEXT NOT NULL,
  current_player TEXT NOT NULL,
  status TEXT NOT NULL,
  winner_color TEXT,
  winning_cells_json TEXT NOT NULL,
  red_wins INTEGER NOT NULL DEFAULT 0,
  yellow_wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  color TEXT NOT NULL,
  column_index INTEGER NOT NULL,
  row_index INTEGER NOT NULL,
  applied INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, move_number)
);

CREATE INDEX IF NOT EXISTS idx_tokens_account ON tokens(account_id);
CREATE INDEX IF NOT EXISTS idx_moves_account_applied ON moves(account_id, applied, move_number);
`;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
}

function newPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: hashPassword(password, salt) };
}

function emptyBoard() {
  return Array.from({ length: 42 }, () => null);
}

function parseWinningCells(value) {
  if (!value || value === 'none') {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseBoard(value) {
  if (!value) {
    return emptyBoard();
  }
  if (Array.isArray(value) && value.length === 42) {
    return value.map((cell) => (cell === 'Red' || cell === 'Yellow' ? cell : null));
  }
  const text = String(value).trim();
  if (/^42 empty cells$/i.test(text)) {
    return emptyBoard();
  }
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length === 42) {
      return parsed.map((cell) => (cell === 'Red' || cell === 'Yellow' ? cell : null));
    }
  } catch {
    // fall through
  }
  return emptyBoard();
}

function serializeBoard(board) {
  return JSON.stringify(board);
}

function serializeWinningCells(cells) {
  return JSON.stringify(cells || []);
}

function rowColToIndex(row, col) {
  return row * 7 + col;
}

function indexToRowCol(index) {
  return { row: Math.floor(index / 7), col: index % 7 };
}

function dropInColumn(board, columnIndex, color) {
  for (let row = 5; row >= 0; row -= 1) {
    const index = rowColToIndex(row, columnIndex);
    if (board[index] === null) {
      const nextBoard = board.slice();
      nextBoard[index] = color;
      return { rowIndex: row, board: nextBoard };
    }
  }
  return null;
}

function detectWinningCells(board, rowIndex, columnIndex, color) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (const [dr, dc] of directions) {
    const cells = [rowColToIndex(rowIndex, columnIndex)];

    let r = rowIndex - dr;
    let c = columnIndex - dc;
    while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[rowColToIndex(r, c)] === color) {
      cells.unshift(rowColToIndex(r, c));
      r -= dr;
      c -= dc;
    }

    r = rowIndex + dr;
    c = columnIndex + dc;
    while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[rowColToIndex(r, c)] === color) {
      cells.push(rowColToIndex(r, c));
      r += dr;
      c += dc;
    }

    if (cells.length >= 4) {
      const anchor = cells.indexOf(rowColToIndex(rowIndex, columnIndex));
      let start = Math.max(0, anchor - 3);
      if (start + 4 > cells.length) {
        start = cells.length - 4;
      }
      return cells.slice(start, start + 4);
    }
  }

  return [];
}

function boardIsFull(board) {
  return board.every((cell) => cell !== null);
}

function makeInitialGameState(row) {
  return {
    board_json: serializeBoard(parseBoard(row.Board)),
    current_player: row['Current player'] || 'Red',
    status: row.Status || 'active',
    winner_color: null,
    winning_cells_json: serializeWinningCells(parseWinningCells(row['Winning cells'])),
    red_wins: Number(row['Red wins'] || 0),
    yellow_wins: Number(row['Yellow wins'] || 0),
    draws: Number(row.Draws || 0),
  };
}

function loadSeedRows() {
  const workbook = XLSX.readFile(SEED_PATH);
  const accountsSheet = workbook.Sheets.Accounts;
  const stateSheet = workbook.Sheets['Initial Game State'];
  const accounts = XLSX.utils.sheet_to_json(accountsSheet, { defval: '' });
  const states = XLSX.utils.sheet_to_json(stateSheet, { defval: '' });
  const stateByEmail = new Map(states.map((row) => [String(row['Account email']).trim(), row]));
  return accounts.map((account) => {
    const stateRow = stateByEmail.get(String(account.Email).trim());
    if (!stateRow) {
      throw new Error(`Missing seed state for ${account.Email}`);
    }
    return { account, stateRow };
  });
}

function ensureSchemaAndSeed() {
  db.exec(schema);
  const seeded = db.prepare('SELECT value FROM meta WHERE key = ?').get('seeded');
  if (seeded) {
    return;
  }

  if (!fs.existsSync(SEED_PATH)) {
    throw new Error(`Missing seed workbook at ${SEED_PATH}`);
  }

  const seedRows = loadSeedRows();
  const insertAccount = db.prepare('INSERT INTO accounts (email, name, password_salt, password_hash) VALUES (?, ?, ?, ?)');
  const insertGame = db.prepare(`
    INSERT INTO game_state (
      account_id, board_json, current_player, status, winner_color, winning_cells_json,
      red_wins, yellow_wins, draws
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');

  const seed = db.transaction(() => {
    for (const { account, stateRow } of seedRows) {
      const passwordInfo = newPasswordHash(String(account.Password));
      const accountInfo = insertAccount.run(String(account.Email).trim(), String(account.Name).trim(), passwordInfo.salt, passwordInfo.hash);
      const state = makeInitialGameState(stateRow);
      insertGame.run(
        accountInfo.lastInsertRowid,
        state.board_json,
        state.current_player,
        state.status,
        state.winner_color,
        state.winning_cells_json,
        state.red_wins,
        state.yellow_wins,
        state.draws,
      );
    }
    insertMeta.run('seeded', '1');
  });

  seed();
}

ensureSchemaAndSeed();

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function getTokenFromRequest(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

function getAccountByToken(token) {
  if (!token) {
    return null;
  }
  const tokenHash = sha256(token);
  return db.prepare(`
    SELECT a.id, a.email, a.name
    FROM tokens t
    JOIN accounts a ON a.id = t.account_id
    WHERE t.token_hash = ?
  `).get(tokenHash) || null;
}

function requireAuth(req, res) {
  const token = getTokenFromRequest(req);
  const account = getAccountByToken(token);
  if (!account) {
    sendError(res, 401, 'Authentication required.');
    return null;
  }
  return { token, account };
}

function getGameRow(accountId) {
  return db.prepare('SELECT * FROM game_state WHERE account_id = ?').get(accountId);
}

function getMoves(accountId) {
  return db.prepare('SELECT move_number, color, column_index, row_index, applied FROM moves WHERE account_id = ? ORDER BY move_number ASC').all(accountId);
}

function mapStateRow(row) {
  return {
    board: JSON.parse(row.board_json),
    currentPlayer: row.current_player,
    status: row.status,
    winnerColor: row.winner_color,
    winningCells: JSON.parse(row.winning_cells_json),
    totals: {
      redWins: row.red_wins,
      yellowWins: row.yellow_wins,
      draws: row.draws,
    },
  };
}

function buildPayload(account, gameRow, moves, feedback = '') {
  const state = mapStateRow(gameRow);
  const appliedMoves = moves
    .filter((move) => move.applied === 1)
    .map((move) => ({
      moveNumber: move.move_number,
      color: move.color,
      column: move.column_index + 1,
      row: move.row_index + 1,
    }));
  const redoMoves = moves.filter((move) => move.applied === 0);
  const statusText = state.status === 'active'
    ? `${state.currentPlayer}'s turn`
    : state.status === 'won'
      ? `${state.winnerColor} wins`
      : 'Draw';

  return {
    account,
    board: state.board,
    currentPlayer: state.currentPlayer,
    status: state.status,
    statusText,
    winnerColor: state.winnerColor,
    winningCells: state.winningCells,
    totals: state.totals,
    history: appliedMoves,
    canUndo: appliedMoves.length > 0,
    canRedo: redoMoves.length > 0,
    feedback,
  };
}

function getSessionPayload(accountId, feedback = '') {
  const accountRow = db.prepare('SELECT id, email, name FROM accounts WHERE id = ?').get(accountId);
  const gameRow = getGameRow(accountId);
  const moves = getMoves(accountId);
  return buildPayload(
    { id: accountRow.id, email: accountRow.email, name: accountRow.name },
    gameRow,
    moves,
    feedback,
  );
}

function createToken(accountId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO tokens (token_hash, account_id) VALUES (?, ?)').run(sha256(token), accountId);
  return token;
}

function getMoveCount(accountId) {
  const row = db.prepare('SELECT COALESCE(MAX(move_number), 0) AS max_move FROM moves WHERE account_id = ?').get(accountId);
  return row.max_move;
}

function setGameState(accountId, updater) {
  const current = getGameRow(accountId);
  const next = updater({
    board: JSON.parse(current.board_json),
    currentPlayer: current.current_player,
    status: current.status,
    winnerColor: current.winner_color,
    winningCells: JSON.parse(current.winning_cells_json),
    totals: {
      redWins: current.red_wins,
      yellowWins: current.yellow_wins,
      draws: current.draws,
    },
  });

  db.prepare(`
    UPDATE game_state
    SET board_json = ?, current_player = ?, status = ?, winner_color = ?, winning_cells_json = ?,
        red_wins = ?, yellow_wins = ?, draws = ?, updated_at = CURRENT_TIMESTAMP
    WHERE account_id = ?
  `).run(
    serializeBoard(next.board),
    next.currentPlayer,
    next.status,
    next.winnerColor,
    serializeWinningCells(next.winningCells),
    next.totals.redWins,
    next.totals.yellowWins,
    next.totals.draws,
    accountId,
  );
}

function resetToNewGame(accountId) {
  db.prepare('DELETE FROM moves WHERE account_id = ?').run(accountId);
  setGameState(accountId, (state) => ({
    ...state,
    board: emptyBoard(),
    currentPlayer: 'Red',
    status: 'active',
    winnerColor: null,
    winningCells: [],
  }));
}

function applyMove(accountId, columnOneBased) {
  const columnIndex = columnOneBased - 1;
  const current = getGameRow(accountId);
  const state = {
    board: JSON.parse(current.board_json),
    currentPlayer: current.current_player,
    status: current.status,
    winnerColor: current.winner_color,
    winningCells: JSON.parse(current.winning_cells_json),
    totals: {
      redWins: current.red_wins,
      yellowWins: current.yellow_wins,
      draws: current.draws,
    },
  };

  if (state.status !== 'active') {
    return { ok: false, status: 409, message: 'Game is over. Start a new game.' };
  }

  if (!Number.isInteger(columnOneBased) || columnOneBased < 1 || columnOneBased > 7) {
    return { ok: false, status: 400, message: 'Choose a column from 1 to 7.' };
  }

  const dropped = dropInColumn(state.board, columnIndex, state.currentPlayer);
  if (!dropped) {
    return { ok: false, status: 409, message: `Column ${columnOneBased} is full` };
  }

  const nextBoard = dropped.board;
  const winningCells = detectWinningCells(nextBoard, dropped.rowIndex, columnIndex, state.currentPlayer);

  const insertMove = db.prepare(`
    INSERT INTO moves (account_id, move_number, color, column_index, row_index, applied)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  const nextMoveNumberStmt = db.prepare('SELECT COALESCE(MAX(move_number), 0) AS max_move FROM moves WHERE account_id = ?');

  const run = db.transaction(() => {
    db.prepare('DELETE FROM moves WHERE account_id = ? AND applied = 0').run(accountId);
    const nextMoveNumber = nextMoveNumberStmt.get(accountId).max_move + 1;
    insertMove.run(accountId, nextMoveNumber, state.currentPlayer, columnIndex, dropped.rowIndex);

    if (winningCells.length === 4) {
      const winnerKey = state.currentPlayer === 'Red' ? 'redWins' : 'yellowWins';
      state.totals[winnerKey] += 1;
      db.prepare(`
        UPDATE game_state
        SET board_json = ?, current_player = ?, status = 'won', winner_color = ?, winning_cells_json = ?,
            red_wins = ?, yellow_wins = ?, draws = ?, updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?
      `).run(
        serializeBoard(nextBoard),
        state.currentPlayer === 'Red' ? 'Yellow' : 'Red',
        state.currentPlayer,
        serializeWinningCells(winningCells),
        state.totals.redWins,
        state.totals.yellowWins,
        state.totals.draws,
        accountId,
      );
      return;
    }

    if (boardIsFull(nextBoard)) {
      state.totals.draws += 1;
      db.prepare(`
        UPDATE game_state
        SET board_json = ?, current_player = ?, status = 'draw', winner_color = NULL, winning_cells_json = ?,
            red_wins = ?, yellow_wins = ?, draws = ?, updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?
      `).run(
        serializeBoard(nextBoard),
        state.currentPlayer === 'Red' ? 'Yellow' : 'Red',
        serializeWinningCells([]),
        state.totals.redWins,
        state.totals.yellowWins,
        state.totals.draws,
        accountId,
      );
      return;
    }

    db.prepare(`
      UPDATE game_state
      SET board_json = ?, current_player = ?, status = 'active', winner_color = NULL, winning_cells_json = ?,
          red_wins = ?, yellow_wins = ?, draws = ?, updated_at = CURRENT_TIMESTAMP
      WHERE account_id = ?
    `).run(
      serializeBoard(nextBoard),
      state.currentPlayer === 'Red' ? 'Yellow' : 'Red',
      serializeWinningCells([]),
      state.totals.redWins,
      state.totals.yellowWins,
      state.totals.draws,
      accountId,
    );
  });

  run();
  return { ok: true, feedback: '' };
}

function undoMove(accountId) {
  const current = getGameRow(accountId);
  const lastMove = db.prepare(`
    SELECT * FROM moves
    WHERE account_id = ? AND applied = 1
    ORDER BY move_number DESC
    LIMIT 1
  `).get(accountId);

  if (!lastMove) {
    return { ok: false, status: 409, message: 'Nothing to undo' };
  }

  const state = {
    board: JSON.parse(current.board_json),
    currentPlayer: current.current_player,
    status: current.status,
    winnerColor: current.winner_color,
    winningCells: JSON.parse(current.winning_cells_json),
    totals: {
      redWins: current.red_wins,
      yellowWins: current.yellow_wins,
      draws: current.draws,
    },
  };

  const index = rowColToIndex(lastMove.row_index, lastMove.column_index);
  state.board[index] = null;
  state.currentPlayer = lastMove.color;
  state.status = 'active';
  state.winnerColor = null;
  state.winningCells = [];
  if (current.status === 'won') {
    if (current.winner_color === 'Red') {
      state.totals.redWins -= 1;
    } else if (current.winner_color === 'Yellow') {
      state.totals.yellowWins -= 1;
    }
  } else if (current.status === 'draw') {
    state.totals.draws -= 1;
  }

  const run = db.transaction(() => {
    db.prepare('UPDATE moves SET applied = 0 WHERE account_id = ? AND move_number = ?').run(accountId, lastMove.move_number);
    db.prepare(`
      UPDATE game_state
      SET board_json = ?, current_player = ?, status = 'active', winner_color = NULL, winning_cells_json = ?,
          red_wins = ?, yellow_wins = ?, draws = ?, updated_at = CURRENT_TIMESTAMP
      WHERE account_id = ?
    `).run(
      serializeBoard(state.board),
      state.currentPlayer,
      serializeWinningCells([]),
      state.totals.redWins,
      state.totals.yellowWins,
      state.totals.draws,
      accountId,
    );
  });

  run();
  return { ok: true, feedback: '' };
}

function redoMove(accountId) {
  const undoneMove = db.prepare(`
    SELECT * FROM moves
    WHERE account_id = ? AND applied = 0
    ORDER BY move_number DESC
    LIMIT 1
  `).get(accountId);

  if (!undoneMove) {
    return { ok: false, status: 409, message: 'Nothing to redo' };
  }

  const current = getGameRow(accountId);
  const state = {
    board: JSON.parse(current.board_json),
    currentPlayer: current.current_player,
    status: current.status,
    winnerColor: current.winner_color,
    winningCells: JSON.parse(current.winning_cells_json),
    totals: {
      redWins: current.red_wins,
      yellowWins: current.yellow_wins,
      draws: current.draws,
    },
  };

  if (state.status !== 'active') {
    return { ok: false, status: 409, message: 'Game is over. Start a new game.' };
  }

  const index = rowColToIndex(undoneMove.row_index, undoneMove.column_index);
  if (state.board[index] !== null) {
    return { ok: false, status: 409, message: 'That move can no longer be redone.' };
  }

  state.board[index] = undoneMove.color;
  const winningCells = detectWinningCells(state.board, undoneMove.row_index, undoneMove.column_index, undoneMove.color);

  const run = db.transaction(() => {
    db.prepare('UPDATE moves SET applied = 1 WHERE account_id = ? AND move_number = ?').run(accountId, undoneMove.move_number);

    if (winningCells.length === 4) {
      const winnerKey = undoneMove.color === 'Red' ? 'redWins' : 'yellowWins';
      state.totals[winnerKey] += 1;
      db.prepare(`
        UPDATE game_state
        SET board_json = ?, current_player = ?, status = 'won', winner_color = ?, winning_cells_json = ?,
            red_wins = ?, yellow_wins = ?, draws = ?, updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?
      `).run(
        serializeBoard(state.board),
        undoneMove.color === 'Red' ? 'Yellow' : 'Red',
        undoneMove.color,
        serializeWinningCells(winningCells),
        state.totals.redWins,
        state.totals.yellowWins,
        state.totals.draws,
        accountId,
      );
      return;
    }

    if (boardIsFull(state.board)) {
      state.totals.draws += 1;
      db.prepare(`
        UPDATE game_state
        SET board_json = ?, current_player = ?, status = 'draw', winner_color = NULL, winning_cells_json = ?,
            red_wins = ?, yellow_wins = ?, draws = ?, updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?
      `).run(
        serializeBoard(state.board),
        undoneMove.color === 'Red' ? 'Yellow' : 'Red',
        serializeWinningCells([]),
        state.totals.redWins,
        state.totals.yellowWins,
        state.totals.draws,
        accountId,
      );
      return;
    }

    db.prepare(`
      UPDATE game_state
      SET board_json = ?, current_player = ?, status = 'active', winner_color = NULL, winning_cells_json = ?,
          red_wins = ?, yellow_wins = ?, draws = ?, updated_at = CURRENT_TIMESTAMP
      WHERE account_id = ?
    `).run(
      serializeBoard(state.board),
      undoneMove.color === 'Red' ? 'Yellow' : 'Red',
      serializeWinningCells([]),
      state.totals.redWins,
      state.totals.yellowWins,
      state.totals.draws,
      accountId,
    );
  });

  run();
  return { ok: true, feedback: '' };
}

function clearRedoStack(accountId) {
  db.prepare('DELETE FROM moves WHERE account_id = ? AND applied = 0').run(accountId);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const account = db.prepare('SELECT * FROM accounts WHERE lower(email) = ?').get(email);
  if (!account) {
    return sendError(res, 401, 'Incorrect email or password.');
  }
  const computed = hashPassword(password, account.password_salt);
  if (computed !== account.password_hash) {
    return sendError(res, 401, 'Incorrect email or password.');
  }

  const token = createToken(account.id);
  const payload = getSessionPayload(account.id);
  res.json({ token, ...payload });
});

app.post('/api/logout', (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }
  db.prepare('DELETE FROM tokens WHERE token_hash = ?').run(sha256(auth.token));
  res.json({ ok: true });
});

app.get('/api/bootstrap', (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }
  res.json({ token: auth.token, ...getSessionPayload(auth.account.id) });
});

app.get('/api/state', (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }
  res.json(getSessionPayload(auth.account.id));
});

app.post('/api/move', (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  const column = Number(req.body?.column);
  const outcome = applyMove(auth.account.id, column);
  if (!outcome.ok) {
    return sendError(res, outcome.status, outcome.message);
  }

  res.json(getSessionPayload(auth.account.id));
});

app.post('/api/undo', (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  const outcome = undoMove(auth.account.id);
  if (!outcome.ok) {
    return sendError(res, outcome.status, outcome.message);
  }

  res.json(getSessionPayload(auth.account.id));
});

app.post('/api/redo', (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  const outcome = redoMove(auth.account.id);
  if (!outcome.ok) {
    return sendError(res, outcome.status, outcome.message);
  }

  res.json(getSessionPayload(auth.account.id));
});

app.post('/api/new-game', (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  db.transaction(() => {
    resetToNewGame(auth.account.id);
  })();

  res.json(getSessionPayload(auth.account.id));
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DropLine listening on 0.0.0.0:${PORT}`);
});

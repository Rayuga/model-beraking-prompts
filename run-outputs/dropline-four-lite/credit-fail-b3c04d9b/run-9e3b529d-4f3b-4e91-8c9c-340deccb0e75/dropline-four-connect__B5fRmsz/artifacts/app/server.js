const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');
const xlsx = require('xlsx');

const APP_DIR = '/app';
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const DB_PATH = process.env.DB_PATH || path.join(APP_DIR, 'dropline.db');
const PORT = 3000;
const SEED_WORKBOOK = '/assets/artifacts/dropline_seed.xlsx';

const COLORS = ['Red', 'Yellow'];
const BOARD_WIDTH = 7;
const BOARD_HEIGHT = 6;
const BOARD_SIZE = BOARD_WIDTH * BOARD_HEIGHT;
const EMPTY_BOARD = Array.from({ length: BOARD_SIZE }, () => null);

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix = '') {
  return `${prefix}${crypto.randomUUID()}`;
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: hashPassword(password, salt) };
}

function verifyPassword(password, salt, expectedHash) {
  return hashPassword(password, salt) === expectedHash;
}

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => null);
}

function normalizeBoard(value) {
  const parsed = parseJson(value, []);
  const board = Array.from({ length: BOARD_SIZE }, (_, index) => {
    const cell = parsed[index];
    return cell === '' || cell === undefined ? null : cell;
  });
  return board;
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '' || value === 'none') {
    return fallback;
  }
  if (Array.isArray(value)) {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stringifyJson(value) {
  return JSON.stringify(value);
}

function toStoredBoard(board) {
  return stringifyJson(board.map((cell) => (cell === null ? null : cell)));
}

function toStoredMoves(moves) {
  return stringifyJson(moves.map((move) => ({
    color: move.color,
    column: move.column,
    row: move.row,
    index: move.index,
  })));
}

function toStoredCells(cells) {
  return stringifyJson(cells);
}

function oppositeColor(color) {
  return color === 'Red' ? 'Yellow' : 'Red';
}

function boardIndex(row, column) {
  return (row - 1) * BOARD_WIDTH + (column - 1);
}

function columnHasSpace(board, column) {
  const zeroBased = column - 1;
  for (let row = BOARD_HEIGHT; row >= 1; row -= 1) {
    if (board[boardIndex(row, column)] === null) {
      return true;
    }
  }
  return false;
}

function findLandingIndex(board, column) {
  for (let row = BOARD_HEIGHT; row >= 1; row -= 1) {
    const index = boardIndex(row, column);
    if (board[index] === null) {
      return { row, index };
    }
  }
  return null;
}

function collectLine(board, startIndex, color, deltaRow, deltaColumn) {
  const startRow = Math.floor(startIndex / BOARD_WIDTH) + 1;
  const startColumn = (startIndex % BOARD_WIDTH) + 1;
  const cells = [{ row: startRow, column: startColumn, index: startIndex }];

  let row = startRow - deltaRow;
  let column = startColumn - deltaColumn;
  while (row >= 1 && row <= BOARD_HEIGHT && column >= 1 && column <= BOARD_WIDTH) {
    const index = boardIndex(row, column);
    if (board[index] !== color) {
      break;
    }
    cells.unshift({ row, column, index });
    row -= deltaRow;
    column -= deltaColumn;
  }

  row = startRow + deltaRow;
  column = startColumn + deltaColumn;
  while (row >= 1 && row <= BOARD_HEIGHT && column >= 1 && column <= BOARD_WIDTH) {
    const index = boardIndex(row, column);
    if (board[index] !== color) {
      break;
    }
    cells.push({ row, column, index });
    row += deltaRow;
    column += deltaColumn;
  }

  return cells;
}

function winningCellsFor(board, startIndex, color) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (const [deltaRow, deltaColumn] of directions) {
    const line = collectLine(board, startIndex, color, deltaRow, deltaColumn);
    if (line.length >= 4) {
      const pivot = line.findIndex((cell) => cell.index === startIndex);
      let start = Math.max(0, pivot - 3);
      if (start + 4 > line.length) {
        start = line.length - 4;
      }
      return line.slice(start, start + 4).map((cell) => cell.index);
    }
  }

  return [];
}

function boardFull(board) {
  return board.every((cell) => cell !== null);
}

function parseHistoryList(value) {
  return parseJson(value, []).map((entry) => ({
    color: entry.color,
    column: entry.column,
    row: entry.row,
    index: entry.index,
  }));
}

function parseArchiveSnapshot(value) {
  const snapshot = parseJson(value, null);
  if (!snapshot) {
    return null;
  }
  return {
    matchId: snapshot.matchId,
    roundId: snapshot.roundId,
    result: snapshot.result,
    finalBoard: snapshot.finalBoard,
    moves: parseHistoryList(snapshot.moves),
    winningCells: snapshot.winningCells || [],
    moveCount: snapshot.moveCount,
    completedAt: snapshot.completedAt,
  };
}

function serializeArchiveSnapshot(snapshot) {
  return stringifyJson({
    matchId: snapshot.matchId,
    roundId: snapshot.roundId,
    result: snapshot.result,
    finalBoard: snapshot.finalBoard,
    moves: snapshot.moves,
    winningCells: snapshot.winningCells,
    moveCount: snapshot.moveCount,
    completedAt: snapshot.completedAt,
  });
}

function parseGameRow(row) {
  return {
    accountId: row.account_id,
    roundId: row.round_id,
    board: normalizeBoard(row.board),
    currentPlayer: row.current_player,
    status: row.status,
    result: row.result,
    winningCells: parseJson(row.winning_cells, []),
    redWins: row.red_wins,
    yellowWins: row.yellow_wins,
    draws: row.draws,
    revision: row.revision,
    appliedHistory: parseHistoryList(row.applied_history),
    redoHistory: parseHistoryList(row.redo_history),
    terminalSnapshot: parseArchiveSnapshot(row.terminal_snapshot),
  };
}

function buildArchiveSummary(db, accountId) {
  const count = db.prepare('SELECT COUNT(*) AS count FROM completed_matches WHERE account_id = ?').get(accountId).count;
  const latest = db.prepare(`
    SELECT match_id, round_id, result, move_count, completed_at
    FROM completed_matches
    WHERE account_id = ?
    ORDER BY completed_at DESC, id DESC
    LIMIT 10
  `).all(accountId).map((row) => ({
    matchId: row.match_id,
    roundId: row.round_id,
    result: row.result,
    moveCount: row.move_count,
    completedAt: row.completed_at,
  }));
  return { count, latest };
}

function buildStateBundle(db, accountId, feedback = '') {
  const account = db.prepare('SELECT id, email, name FROM accounts WHERE id = ?').get(accountId);
  const gameRow = db.prepare('SELECT * FROM game_state WHERE account_id = ?').get(accountId);
  if (!account || !gameRow) {
    return null;
  }
  const game = parseGameRow(gameRow);
  const archive = buildArchiveSummary(db, accountId);
  return {
    account: {
      id: account.id,
      email: account.email,
      name: account.name,
    },
    feedback,
    revision: game.revision,
    roundId: game.roundId,
    status: game.status,
    currentPlayer: game.currentPlayer,
    currentTurnLabel: game.status === 'active' ? `${game.currentPlayer}'s turn` : game.result,
    result: game.result,
    board: game.board,
    winningCells: game.winningCells,
    totals: {
      redWins: game.redWins,
      yellowWins: game.yellowWins,
      draws: game.draws,
    },
    appliedHistory: game.appliedHistory,
    redoHistory: game.redoHistory,
    archive,
  };
}

function loadArchiveMatch(db, accountId, matchId) {
  const row = db.prepare(`
    SELECT *
    FROM completed_matches
    WHERE account_id = ? AND match_id = ?
  `).get(accountId, matchId);
  if (!row) {
    return null;
  }
  return {
    matchId: row.match_id,
    roundId: row.round_id,
    result: row.result,
    finalBoard: normalizeBoard(row.final_board),
    moves: parseHistoryList(row.moves),
    winningCells: parseJson(row.winning_cells, []),
    moveCount: row.move_count,
    completedAt: row.completed_at,
  };
}

function ensureTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS active_tokens (
      token TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL,
      issued_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS game_state (
      account_id INTEGER PRIMARY KEY,
      round_id TEXT NOT NULL,
      board TEXT NOT NULL,
      current_player TEXT NOT NULL,
      status TEXT NOT NULL,
      result TEXT NOT NULL,
      winning_cells TEXT NOT NULL,
      red_wins INTEGER NOT NULL,
      yellow_wins INTEGER NOT NULL,
      draws INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      applied_history TEXT NOT NULL,
      redo_history TEXT NOT NULL,
      terminal_snapshot TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS completed_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      match_id TEXT NOT NULL UNIQUE,
      round_id TEXT NOT NULL,
      result TEXT NOT NULL,
      final_board TEXT NOT NULL,
      winning_cells TEXT NOT NULL,
      moves TEXT NOT NULL,
      move_count INTEGER NOT NULL,
      completed_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      operation_id TEXT NOT NULL,
      mutation_type TEXT NOT NULL,
      request_revision INTEGER NOT NULL,
      response_status INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (account_id, operation_id),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );
  `);
}

function seedDatabase(db) {
  const workbook = xlsx.readFile(SEED_WORKBOOK);
  const accountsSheet = xlsx.utils.sheet_to_json(workbook.Sheets['Accounts'], { defval: null });
  const initialSheet = xlsx.utils.sheet_to_json(workbook.Sheets['Initial Game State'], { defval: null });
  const completedSheet = xlsx.utils.sheet_to_json(workbook.Sheets['Completed Matches'], { defval: null });

  const insertAccount = db.prepare(`
    INSERT INTO accounts (email, name, password_salt, password_hash)
    VALUES (?, ?, ?, ?)
  `);
  const insertState = db.prepare(`
    INSERT INTO game_state (
      account_id, round_id, board, current_player, status, result, winning_cells,
      red_wins, yellow_wins, draws, revision, applied_history, redo_history,
      terminal_snapshot, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertArchive = db.prepare(`
    INSERT INTO completed_matches (
      account_id, match_id, round_id, result, final_board, winning_cells,
      moves, move_count, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const accountIds = new Map();

  const tx = db.transaction(() => {
    for (const row of accountsSheet) {
      const password = row.Password || '';
      const { salt, hash } = createPasswordRecord(password);
      const info = insertAccount.run(row.Email, row.Name, salt, hash);
      accountIds.set(row.Email, info.lastInsertRowid);
    }

    for (const row of initialSheet) {
      const accountId = accountIds.get(row['Account email']);
      const board = normalizeBoard(row.Board);
      const currentPlayer = row['Current player'];
      const status = row.Status;
      const winningCells = parseJson(row['Winning cells'], []);
      const redWins = row['Red wins'];
      const yellowWins = row['Yellow wins'];
      const draws = row['Draws'];
      const appliedHistory = parseHistoryList(row['Applied history']);
      const redoHistory = parseHistoryList(row['Redo history']);
      insertState.run(
        accountId,
        row['Round id'],
        toStoredBoard(board),
        currentPlayer,
        status,
        status === 'terminal' ? row.Result || '' : '',
        toStoredCells(winningCells),
        redWins,
        yellowWins,
        draws,
        row.Revision,
        toStoredMoves(appliedHistory),
        toStoredMoves(redoHistory),
        '',
        nowIso(),
      );
    }

    for (const row of completedSheet) {
      const accountId = accountIds.get(row['Account email']);
      const moves = parseHistoryList(row.Moves);
      const finalBoard = normalizeBoard(row['Final board']);
      const result = row.Result;
      const winningCells = result.includes('wins') && moves.length > 0
        ? winningCellsFor(finalBoard, moves[moves.length - 1].index, moves[moves.length - 1].color)
        : [];
      insertArchive.run(
        accountId,
        row['Match id'],
        row['Match id'],
        result,
        toStoredBoard(finalBoard),
        toStoredCells(winningCells),
        toStoredMoves(moves),
        moves.length,
        row['Completed at'],
      );
    }
  });

  tx();
}

function openDatabase() {
  const dbExists = fs.existsSync(DB_PATH);
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  ensureTables(db);
  const accountCount = db.prepare('SELECT COUNT(*) AS count FROM accounts').get().count;
  if (!dbExists || accountCount === 0) {
    db.exec('DELETE FROM operations; DELETE FROM active_tokens; DELETE FROM completed_matches; DELETE FROM game_state; DELETE FROM accounts;');
    seedDatabase(db);
  }
  return db;
}

const db = openDatabase();

function authenticateRequest(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  const tokenRow = db.prepare(`
    SELECT active_tokens.account_id, accounts.email, accounts.name
    FROM active_tokens
    JOIN accounts ON accounts.id = active_tokens.account_id
    WHERE active_tokens.token = ?
  `).get(token);
  if (!tokenRow) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  db.prepare('UPDATE active_tokens SET last_seen_at = ? WHERE token = ?').run(nowIso(), token);
  req.auth = {
    token,
    accountId: tokenRow.account_id,
    account: {
      id: tokenRow.account_id,
      email: tokenRow.email,
      name: tokenRow.name,
    },
  };
  return next();
}

function storeOperation(accountId, operationId, mutationType, requestRevision, responseStatus, responseBody) {
  db.prepare(`
    INSERT INTO operations (
      account_id, operation_id, mutation_type, request_revision, response_status, response_body, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(accountId, operationId, mutationType, requestRevision, responseStatus, JSON.stringify(responseBody), nowIso());
}

function getStoredOperation(accountId, operationId) {
  const row = db.prepare(`
    SELECT response_status, response_body
    FROM operations
    WHERE account_id = ? AND operation_id = ?
  `).get(accountId, operationId);
  if (!row) {
    return null;
  }
  return {
    status: row.response_status,
    body: JSON.parse(row.response_body),
  };
}

function mutationTransaction(accountId, body, mutationType, handler) {
  const operationId = typeof body.operationId === 'string' ? body.operationId.trim() : '';
  const expectedRevision = Number(body.expectedRevision);
  if (!operationId) {
    return { status: 400, body: { ok: false, message: 'Missing operation id' } };
  }

  const tx = db.transaction(() => {
    const stored = getStoredOperation(accountId, operationId);
    if (stored) {
      return stored;
    }

    const currentRow = db.prepare('SELECT * FROM game_state WHERE account_id = ?').get(accountId);
    if (!currentRow) {
      const response = { ok: false, message: 'Account state not found' };
      storeOperation(accountId, operationId, mutationType, Number.isFinite(expectedRevision) ? expectedRevision : -1, 500, response);
      return { status: 500, body: response };
    }

    const current = parseGameRow(currentRow);
    if (Number.isNaN(expectedRevision) || expectedRevision !== current.revision) {
      const response = {
        ok: false,
        message: 'Game updated in another tab',
        state: buildStateBundle(db, accountId, 'Game updated in another tab'),
      };
      storeOperation(accountId, operationId, mutationType, Number.isNaN(expectedRevision) ? -1 : expectedRevision, 409, response);
      return { status: 409, body: response };
    }

    const response = handler({ currentRow, current, accountId, operationId, mutationType });
    storeOperation(accountId, operationId, mutationType, expectedRevision, response.status, response.body);
    return response;
  });

  return tx();
}

function updateGameState(accountId, fields) {
  const existing = db.prepare('SELECT * FROM game_state WHERE account_id = ?').get(accountId);
  if (!existing) {
    throw new Error('Game state missing');
  }
  const next = {
    round_id: fields.roundId ?? existing.round_id,
    board: fields.board ?? existing.board,
    current_player: fields.currentPlayer ?? existing.current_player,
    status: fields.status ?? existing.status,
    result: fields.result ?? existing.result,
    winning_cells: fields.winningCells ?? existing.winning_cells,
    red_wins: fields.redWins ?? existing.red_wins,
    yellow_wins: fields.yellowWins ?? existing.yellow_wins,
    draws: fields.draws ?? existing.draws,
    revision: fields.revision ?? existing.revision,
    applied_history: fields.appliedHistory ?? existing.applied_history,
    redo_history: fields.redoHistory ?? existing.redo_history,
    terminal_snapshot: fields.terminalSnapshot ?? existing.terminal_snapshot,
  };
  db.prepare(`
    UPDATE game_state
    SET round_id = ?, board = ?, current_player = ?, status = ?, result = ?, winning_cells = ?,
        red_wins = ?, yellow_wins = ?, draws = ?, revision = ?, applied_history = ?, redo_history = ?,
        terminal_snapshot = ?, updated_at = ?
    WHERE account_id = ?
  `).run(
    next.round_id,
    next.board,
    next.current_player,
    next.status,
    next.result,
    next.winning_cells,
    next.red_wins,
    next.yellow_wins,
    next.draws,
    next.revision,
    next.applied_history,
    next.redo_history,
    next.terminal_snapshot,
    nowIso(),
    accountId,
  );
}

function removeArchiveForRound(accountId, roundId) {
  db.prepare('DELETE FROM completed_matches WHERE account_id = ? AND match_id = ?').run(accountId, roundId);
}

function insertArchiveRecord(accountId, snapshot) {
  db.prepare(`
    INSERT INTO completed_matches (
      account_id, match_id, round_id, result, final_board, winning_cells, moves, move_count, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    accountId,
    snapshot.matchId,
    snapshot.roundId,
    snapshot.result,
    toStoredBoard(snapshot.finalBoard),
    toStoredCells(snapshot.winningCells),
    toStoredMoves(snapshot.moves),
    snapshot.moveCount,
    snapshot.completedAt,
  );
}

function getGameRowForAccount(accountId) {
  return db.prepare('SELECT * FROM game_state WHERE account_id = ?').get(accountId);
}

function sendState(res, accountId, feedback = '') {
  const bundle = buildStateBundle(db, accountId, feedback);
  if (!bundle) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }
  return res.json({ ok: true, state: bundle });
}

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(express.static(PUBLIC_DIR));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/sign-in', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const account = db.prepare('SELECT * FROM accounts WHERE lower(email) = ?').get(email);
  if (!account || !verifyPassword(password, account.password_salt, account.password_hash)) {
    return res.status(401).json({ ok: false, message: 'Email or password is incorrect.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`
    INSERT INTO active_tokens (token, account_id, issued_at, last_seen_at)
    VALUES (?, ?, ?, ?)
  `).run(token, account.id, nowIso(), nowIso());
  const state = buildStateBundle(db, account.id, '');
  return res.json({ ok: true, token, state });
});

app.use('/api', authenticateRequest);

app.get('/api/state', (req, res) => {
  return sendState(res, req.auth.accountId);
});

app.post('/api/sign-out', (req, res) => {
  db.prepare('DELETE FROM active_tokens WHERE account_id = ?').run(req.auth.accountId);
  return res.json({ ok: true });
});

app.get('/api/archive', (req, res) => {
  const state = buildStateBundle(db, req.auth.accountId);
  if (!state) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }
  return res.json({ ok: true, archive: state.archive });
});

app.get('/api/archive/:matchId', (req, res) => {
  const match = loadArchiveMatch(db, req.auth.accountId, req.params.matchId);
  if (!match) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }
  return res.json({ ok: true, match });
});

app.post('/api/new-game', (req, res) => {
  const result = mutationTransaction(req.auth.accountId, req.body || {}, 'new-game', ({ accountId, current }) => {
    updateGameState(accountId, {
      roundId: randomId('round-'),
      board: toStoredBoard(emptyBoard()),
      currentPlayer: 'Red',
      status: 'active',
      result: '',
      winningCells: toStoredCells([]),
      appliedHistory: toStoredMoves([]),
      redoHistory: toStoredMoves([]),
      terminalSnapshot: '',
      revision: current.revision + 1,
    });
    return {
      status: 200,
      body: {
        ok: true,
        message: 'New game started',
        state: buildStateBundle(db, accountId, ''),
      },
    };
  });
  return res.status(result.status).json(result.body);
});

app.post('/api/move', (req, res) => {
  const result = mutationTransaction(req.auth.accountId, req.body || {}, 'move', ({ accountId, current }) => {
    if (current.status === 'terminal') {
      return {
        status: 400,
        body: {
          ok: false,
          message: 'Game already finished',
          state: buildStateBundle(db, accountId, 'Game already finished'),
        },
      };
    }

    const column = Number(req.body?.column);
    if (!Number.isInteger(column) || column < 1 || column > BOARD_WIDTH) {
      return {
        status: 400,
        body: {
          ok: false,
          message: 'Choose a column from 1 to 7',
          state: buildStateBundle(db, accountId, 'Choose a column from 1 to 7'),
        },
      };
    }

    if (!columnHasSpace(current.board, column)) {
      return {
        status: 400,
        body: {
          ok: false,
          message: `Column ${column} is full`,
          state: buildStateBundle(db, accountId, `Column ${column} is full`),
        },
      };
    }

    const landing = findLandingIndex(current.board, column);
    if (!landing) {
      return {
        status: 400,
        body: {
          ok: false,
          message: `Column ${column} is full`,
          state: buildStateBundle(db, accountId, `Column ${column} is full`),
        },
      };
    }

    const color = current.currentPlayer;
    const nextBoard = current.board.slice();
    nextBoard[landing.index] = color;
    const appliedHistory = current.appliedHistory.slice();
    appliedHistory.push({
      color,
      column,
      row: landing.row,
      index: landing.index,
    });

    const nextPlayer = oppositeColor(color);
    let status = 'active';
    let resultText = '';
    let winningCells = [];
    let redWins = current.redWins;
    let yellowWins = current.yellowWins;
    let draws = current.draws;
    let terminalSnapshot = '';

    const winners = winningCellsFor(nextBoard, landing.index, color);
    if (winners.length === 4) {
      status = 'terminal';
      resultText = `${color} wins`;
      winningCells = winners;
      if (color === 'Red') {
        redWins += 1;
      } else {
        yellowWins += 1;
      }
      const archiveRecord = {
        matchId: current.roundId,
        roundId: current.roundId,
        result: resultText,
        finalBoard: nextBoard,
        winningCells,
        moves: appliedHistory,
        moveCount: appliedHistory.length,
        completedAt: nowIso(),
      };
      terminalSnapshot = serializeArchiveSnapshot(archiveRecord);
      insertArchiveRecord(accountId, archiveRecord);
    } else if (boardFull(nextBoard)) {
      status = 'terminal';
      resultText = 'Draw';
      draws += 1;
      const archiveRecord = {
        matchId: current.roundId,
        roundId: current.roundId,
        result: resultText,
        finalBoard: nextBoard,
        winningCells: [],
        moves: appliedHistory,
        moveCount: appliedHistory.length,
        completedAt: nowIso(),
      };
      terminalSnapshot = serializeArchiveSnapshot(archiveRecord);
      insertArchiveRecord(accountId, archiveRecord);
    }

    updateGameState(accountId, {
      board: toStoredBoard(nextBoard),
      currentPlayer: nextPlayer,
      status,
      result: resultText,
      winningCells: toStoredCells(winningCells),
      redWins,
      yellowWins,
      draws,
      revision: current.revision + 1,
      appliedHistory: toStoredMoves(appliedHistory),
      redoHistory: toStoredMoves([]),
      terminalSnapshot,
    });

    return {
      status: 200,
      body: {
        ok: true,
        state: buildStateBundle(db, accountId, ''),
      },
    };
  });
  return res.status(result.status).json(result.body);
});

app.post('/api/undo', (req, res) => {
  const result = mutationTransaction(req.auth.accountId, req.body || {}, 'undo', ({ accountId, current }) => {
    if (current.appliedHistory.length === 0) {
      return {
        status: 400,
        body: {
          ok: false,
          message: 'Nothing to undo',
          state: buildStateBundle(db, accountId, 'Nothing to undo'),
        },
      };
    }

    const appliedHistory = current.appliedHistory.slice();
    const undone = appliedHistory.pop();
    const redoHistory = current.redoHistory.slice();
    redoHistory.push(undone);
    const nextBoard = current.board.slice();
    nextBoard[undone.index] = null;

    let redWins = current.redWins;
    let yellowWins = current.yellowWins;
    let draws = current.draws;
    let status = current.status;
    let resultText = current.result;
    let winningCells = current.winningCells.slice();
    let terminalSnapshot = current.terminalSnapshot ? serializeArchiveSnapshot(current.terminalSnapshot) : '';

    if (current.status === 'terminal') {
      if (current.result === 'Red wins') {
        redWins -= 1;
      } else if (current.result === 'Yellow wins') {
        yellowWins -= 1;
      } else if (current.result === 'Draw') {
        draws -= 1;
      }
      removeArchiveForRound(accountId, current.roundId);
      status = 'active';
      resultText = '';
      winningCells = [];
      terminalSnapshot = current.terminalSnapshot ? serializeArchiveSnapshot(current.terminalSnapshot) : '';
    }

    updateGameState(accountId, {
      board: toStoredBoard(nextBoard),
      currentPlayer: undone.color,
      status,
      result: resultText,
      winningCells: toStoredCells(winningCells),
      redWins,
      yellowWins,
      draws,
      revision: current.revision + 1,
      appliedHistory: toStoredMoves(appliedHistory),
      redoHistory: toStoredMoves(redoHistory),
      terminalSnapshot,
    });

    return {
      status: 200,
      body: {
        ok: true,
        state: buildStateBundle(db, accountId, ''),
      },
    };
  });
  return res.status(result.status).json(result.body);
});

app.post('/api/redo', (req, res) => {
  const result = mutationTransaction(req.auth.accountId, req.body || {}, 'redo', ({ accountId, current }) => {
    if (current.redoHistory.length === 0) {
      return {
        status: 400,
        body: {
          ok: false,
          message: 'Nothing to redo',
          state: buildStateBundle(db, accountId, 'Nothing to redo'),
        },
      };
    }

    const redoHistory = current.redoHistory.slice();
    const move = redoHistory.pop();
    const appliedHistory = current.appliedHistory.slice();
    const nextBoard = current.board.slice();
    if (nextBoard[move.index] !== null) {
      return {
        status: 409,
        body: {
          ok: false,
          message: 'Game updated in another tab',
          state: buildStateBundle(db, accountId, 'Game updated in another tab'),
        },
      };
    }
    nextBoard[move.index] = move.color;
    appliedHistory.push(move);

    const nextPlayer = oppositeColor(move.color);
    let status = 'active';
    let resultText = '';
    let winningCells = [];
    let redWins = current.redWins;
    let yellowWins = current.yellowWins;
    let draws = current.draws;
    let terminalSnapshot = current.terminalSnapshot ? serializeArchiveSnapshot(current.terminalSnapshot) : '';

    const winners = winningCellsFor(nextBoard, move.index, move.color);
    if (winners.length === 4) {
      status = 'terminal';
      resultText = `${move.color} wins`;
      winningCells = winners;
      if (move.color === 'Red') {
        redWins += 1;
      } else {
        yellowWins += 1;
      }
      const archiveRecord = current.terminalSnapshot || {
        matchId: current.roundId,
        roundId: current.roundId,
        result: resultText,
        finalBoard: nextBoard,
        winningCells,
        moves: appliedHistory,
        moveCount: appliedHistory.length,
        completedAt: nowIso(),
      };
      if (current.terminalSnapshot) {
        insertArchiveRecord(accountId, current.terminalSnapshot);
      } else {
        insertArchiveRecord(accountId, archiveRecord);
        terminalSnapshot = serializeArchiveSnapshot(archiveRecord);
      }
      if (current.terminalSnapshot) {
        terminalSnapshot = serializeArchiveSnapshot(current.terminalSnapshot);
      }
    } else if (boardFull(nextBoard)) {
      status = 'terminal';
      resultText = 'Draw';
      draws += 1;
      const archiveRecord = current.terminalSnapshot || {
        matchId: current.roundId,
        roundId: current.roundId,
        result: resultText,
        finalBoard: nextBoard,
        winningCells: [],
        moves: appliedHistory,
        moveCount: appliedHistory.length,
        completedAt: nowIso(),
      };
      if (current.terminalSnapshot) {
        insertArchiveRecord(accountId, current.terminalSnapshot);
      } else {
        insertArchiveRecord(accountId, archiveRecord);
        terminalSnapshot = serializeArchiveSnapshot(archiveRecord);
      }
      if (current.terminalSnapshot) {
        terminalSnapshot = serializeArchiveSnapshot(current.terminalSnapshot);
      }
    }

    updateGameState(accountId, {
      board: toStoredBoard(nextBoard),
      currentPlayer: nextPlayer,
      status,
      result: resultText,
      winningCells: toStoredCells(winningCells),
      redWins,
      yellowWins,
      draws,
      revision: current.revision + 1,
      appliedHistory: toStoredMoves(appliedHistory),
      redoHistory: toStoredMoves(redoHistory),
      terminalSnapshot,
    });

    return {
      status: 200,
      body: {
        ok: true,
        state: buildStateBundle(db, accountId, ''),
      },
    };
  });
  return res.status(result.status).json(result.body);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }
  return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DropLine listening on 0.0.0.0:${PORT}`);
});

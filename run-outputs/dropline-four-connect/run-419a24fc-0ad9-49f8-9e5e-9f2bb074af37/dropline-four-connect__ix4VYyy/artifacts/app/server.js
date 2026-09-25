const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const Database = require('better-sqlite3');
const xlsx = require('xlsx');

const PORT = 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DB_PATH = path.join(ROOT, 'dropline.db');
const SEED_XLSX = '/assets/artifacts/dropline_seed.xlsx';
const BOARD_ROWS = 6;
const BOARD_COLS = 7;
const TOTAL_CELLS = BOARD_ROWS * BOARD_COLS;
const TURN_COLORS = ['Red', 'Yellow'];

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR));

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS competitive_state (
      account_id INTEGER PRIMARY KEY,
      board_json TEXT NOT NULL,
      current_player TEXT NOT NULL,
      status TEXT NOT NULL,
      result TEXT,
      winning_cells_json TEXT NOT NULL,
      red_wins INTEGER NOT NULL,
      yellow_wins INTEGER NOT NULL,
      draws INTEGER NOT NULL,
      applied_history_json TEXT NOT NULL,
      redo_history_json TEXT NOT NULL,
      revision INTEGER NOT NULL,
      round_id TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS competitive_archive (
      match_id TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL,
      result TEXT NOT NULL,
      final_board_json TEXT NOT NULL,
      moves_json TEXT NOT NULL,
      winning_cells_json TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      round_id TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS operations (
      account_id INTEGER NOT NULL,
      op_id TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id, op_id),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      source_match_id TEXT NOT NULL,
      source_label TEXT NOT NULL,
      source_step INTEGER NOT NULL,
      source_round_id TEXT NOT NULL,
      source_prefix_json TEXT NOT NULL,
      source_board_json TEXT NOT NULL,
      source_turn TEXT NOT NULL,
      source_result TEXT,
      source_winning_cells_json TEXT NOT NULL,
      root_node_id INTEGER,
      selected_node_id INTEGER,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analysis_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id INTEGER NOT NULL,
      parent_id INTEGER,
      incoming_column INTEGER,
      color TEXT NOT NULL,
      row INTEGER,
      cell_index INTEGER,
      board_json TEXT NOT NULL,
      turn TEXT NOT NULL,
      result TEXT,
      winning_cells_json TEXT NOT NULL,
      history_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES analysis_nodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS previews (
      id TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL,
      source_analysis_id INTEGER NOT NULL,
      source_node_id INTEGER NOT NULL,
      destination_analysis_id INTEGER NOT NULL,
      destination_node_id INTEGER NOT NULL,
      source_revision INTEGER NOT NULL,
      destination_revision INTEGER NOT NULL,
      preview_json TEXT NOT NULL,
      committed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      committed_at TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
    CREATE INDEX IF NOT EXISTS idx_archive_account ON competitive_archive(account_id, completed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analyses_account ON analyses(account_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_nodes_analysis ON analysis_nodes(analysis_id);
  `);
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function randomId() {
  return crypto.randomBytes(16).toString('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => stableStringify(item)).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  return '{' + keys.map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function nowIso() {
  return new Date().toISOString();
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseMaybeJson(text, fallback) {
  if (text === null || text === undefined || text === 'none') {
    return fallback;
  }
  if (typeof text === 'string') {
    return JSON.parse(text);
  }
  return fallback;
}

function createEmptyBoard() {
  return Array.from({ length: TOTAL_CELLS }, () => '');
}

function cloneBoard(board) {
  return board.slice();
}

function indexFromRowCol(row, column) {
  return (row - 1) * BOARD_COLS + (column - 1);
}

function rowColFromIndex(index) {
  return {
    row: Math.floor(index / BOARD_COLS) + 1,
    column: (index % BOARD_COLS) + 1,
  };
}

function winningCellsForBoard(board) {
  for (let row = 1; row <= BOARD_ROWS; row += 1) {
    for (let column = 1; column <= BOARD_COLS; column += 1) {
      const occupant = board[indexFromRowCol(row, column)];
      if (!occupant) continue;
      const directions = [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
      ];
      for (const [dr, dc] of directions) {
        const line = [{ row, column }];
        let ok = true;
        for (let step = 1; step < 4; step += 1) {
          const nextRow = row + dr * step;
          const nextColumn = column + dc * step;
          if (nextRow < 1 || nextRow > BOARD_ROWS || nextColumn < 1 || nextColumn > BOARD_COLS) {
            ok = false;
            break;
          }
          const nextOccupant = board[indexFromRowCol(nextRow, nextColumn)];
          if (nextOccupant !== occupant) {
            ok = false;
            break;
          }
          line.push({ row: nextRow, column: nextColumn });
        }
        if (ok) {
          return line.map((cell) => indexFromRowCol(cell.row, cell.column));
        }
      }
    }
  }
  return [];
}

function boardResult(board) {
  const winningCells = winningCellsForBoard(board);
  if (winningCells.length) {
    const occupant = board[winningCells[0]];
    return {
      result: `${occupant} wins`,
      winningCells,
    };
  }
  if (board.every((cell) => cell)) {
    return { result: 'Draw', winningCells: [] };
  }
  return { result: null, winningCells: [] };
}

function currentPlayerAfterHistory(history) {
  return history.length % 2 === 0 ? 'Red' : 'Yellow';
}

function legalDropRow(board, column) {
  for (let row = BOARD_ROWS; row >= 1; row -= 1) {
    const index = indexFromRowCol(row, column);
    if (!board[index]) return row;
  }
  return null;
}

function applyMove(board, history, column, forcedColor) {
  if (!Number.isInteger(column) || column < 1 || column > BOARD_COLS) {
    return { error: 'Column must be an integer from 1 to 7.' };
  }
  const currentResult = boardResult(board).result;
  if (currentResult) {
    return { error: 'The position is already terminal.' };
  }
  const row = legalDropRow(board, column);
  if (!row) {
    return { error: `Column ${column} is full.` };
  }
  const color = forcedColor || currentPlayerAfterHistory(history);
  const nextBoard = cloneBoard(board);
  const index = indexFromRowCol(row, column);
  nextBoard[index] = color;
  const resultInfo = boardResult(nextBoard);
  const move = { color, column, row, index };
  return {
    board: nextBoard,
    move,
    result: resultInfo.result,
    winningCells: resultInfo.winningCells,
    turn: resultInfo.result ? color : (color === 'Red' ? 'Yellow' : 'Red'),
  };
}

function parseBoard(raw) {
  const board = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!Array.isArray(board) || board.length !== TOTAL_CELLS) {
    throw new Error('Invalid board shape');
  }
  return board.map((cell) => (cell === 'Red' || cell === 'Yellow' ? cell : ''));
}

function parseHistory(raw) {
  const history = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!Array.isArray(history)) {
    throw new Error('Invalid history');
  }
  return history.map((move) => ({
    color: move.color,
    column: move.column,
    row: move.row,
    index: move.index,
  }));
}

function deriveStateFromHistory(history) {
  let board = createEmptyBoard();
  let result = null;
  let winningCells = [];
  for (const move of history) {
    const applied = applyMove(board, history.slice(0, history.indexOf(move)), move.column, move.color);
    if (applied.error) {
      throw new Error(applied.error);
    }
    board = applied.board;
    result = applied.result;
    winningCells = applied.winningCells;
  }
  return {
    board,
    currentPlayer: currentPlayerAfterHistory(history),
    result,
    winningCells,
  };
}

function formatValidationError(message, extra = {}) {
  return { ok: false, statusCode: 400, body: { error: message, ...extra } };
}

function formatConflictError(message, extra = {}) {
  return { ok: false, statusCode: 409, body: { error: message, ...extra } };
}

function formatNotFoundError(message = 'Not found') {
  return { ok: false, statusCode: 404, body: { error: message } };
}

function formatUnauthorizedError(message = 'Unauthorized') {
  return { ok: false, statusCode: 401, body: { error: message } };
}

function validateName(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 60) return null;
  return trimmed;
}

function validateOpId(opId) {
  return typeof opId === 'string' && /^[A-Za-z0-9_-]{20,}$/.test(opId);
}

function validateInteger(value) {
  return Number.isInteger(value);
}

function assertAllowedKeys(body, allowedKeys) {
  if (!isPlainObject(body)) return false;
  return Object.keys(body).every((key) => allowedKeys.includes(key));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, salt, expectedHash) {
  const actual = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function boardToDisplayState(board, winningCells, differenceSet = new Set()) {
  return board.map((occupant, index) => {
    const { row, column } = rowColFromIndex(index);
    const labels = [
      `Row ${row}`,
      `Column ${column}`,
      occupant ? `${occupant}` : 'Empty',
    ];
    if (winningCells.includes(index)) labels.push('Winning cell');
    if (differenceSet.has(index)) labels.push('Different cell');
    return {
      occupant,
      row,
      column,
      label: labels.join(', '),
      winning: winningCells.includes(index),
      different: differenceSet.has(index),
    };
  });
}

function boardToRows(board, winningCells = [], differenceSet = new Set()) {
  const cells = boardToDisplayState(board, winningCells, differenceSet);
  const rows = [];
  for (let row = 1; row <= BOARD_ROWS; row += 1) {
    const rowCells = [];
    for (let column = 1; column <= BOARD_COLS; column += 1) {
      const index = indexFromRowCol(row, column);
      rowCells.push(cells[index]);
    }
    rows.push(rowCells);
  }
  return rows;
}

function boardSummary(board) {
  return board.map((cell) => cell || '');
}

function moveLabel(move, index) {
  return `${index + 1}. ${move.color} column ${move.column}`;
}

function buildMoveList(history) {
  return history.map((move, index) => ({
    index: index + 1,
    color: move.color,
    column: move.column,
    row: move.row,
    cellIndex: move.index,
    label: moveLabel(move, index),
  }));
}

function getCurrentAccount(req) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const tokenHash = sha256(match[1]);
  const session = db.prepare('SELECT s.*, a.email, a.name FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.revoked_at IS NULL').get(tokenHash);
  if (!session) return null;
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(nowIso(), session.id);
  return {
    id: session.account_id,
    email: session.email,
    name: session.name,
    tokenHash,
  };
}

function requireAccount(req, res) {
  const account = getCurrentAccount(req);
  if (!account) {
    res.status(401).json(formatUnauthorizedError().body);
    return null;
  }
  return account;
}

function getCompetitiveState(accountId) {
  const row = db.prepare('SELECT * FROM competitive_state WHERE account_id = ?').get(accountId);
  if (!row) return null;
  return {
    accountId: row.account_id,
    board: parseBoard(row.board_json),
    currentPlayer: row.current_player,
    status: row.status,
    result: row.result,
    winningCells: parseMaybeJson(row.winning_cells_json, []),
    redWins: row.red_wins,
    yellowWins: row.yellow_wins,
    draws: row.draws,
    history: parseHistory(row.applied_history_json),
    redoHistory: parseHistory(row.redo_history_json),
    revision: row.revision,
    roundId: row.round_id,
    updatedAt: row.updated_at,
  };
}

function serializeCompetitiveState(state) {
  return {
    board: boardSummary(state.board),
    currentPlayer: state.currentPlayer,
    status: state.status,
    result: state.result,
    winningCells: state.winningCells,
    redWins: state.redWins,
    yellowWins: state.yellowWins,
    draws: state.draws,
    history: buildMoveList(state.history),
    redoHistory: buildMoveList(state.redoHistory),
    revision: state.revision,
    roundId: state.roundId,
    updatedAt: state.updatedAt,
  };
}

function getArchiveSummaries(accountId) {
  const rows = db.prepare('SELECT * FROM competitive_archive WHERE account_id = ? ORDER BY completed_at DESC, match_id DESC').all(accountId);
  return rows.map((row) => ({
    matchId: row.match_id,
    accountId: row.account_id,
    result: row.result,
    completedAt: row.completed_at,
    roundId: row.round_id,
    moveCount: parseMaybeJson(row.moves_json, []).length,
  }));
}

function archiveDetail(accountId, matchId) {
  const row = db.prepare('SELECT * FROM competitive_archive WHERE account_id = ? AND match_id = ?').get(accountId, matchId);
  if (!row) return null;
  const moves = parseHistory(row.moves_json);
  const board = parseBoard(row.final_board_json);
  const winningCells = parseMaybeJson(row.winning_cells_json, []);
  return {
    matchId: row.match_id,
    accountId: row.account_id,
    result: row.result,
    completedAt: row.completed_at,
    roundId: row.round_id,
    board: boardSummary(board),
    winningCells,
    history: buildMoveList(moves),
    moveCount: moves.length,
    sourceLabel: row.match_id,
  };
}

function getAnalysisMetadata(accountId) {
  const rows = db.prepare('SELECT * FROM analyses WHERE account_id = ? ORDER BY updated_at DESC, id DESC').all(accountId);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sourceMatchId: row.source_match_id,
    sourceLabel: row.source_label,
    sourceStep: row.source_step,
    revision: row.revision,
    selectedNodeId: row.selected_node_id,
    rootNodeId: row.root_node_id,
    sourceRoundId: row.source_round_id,
    updatedAt: row.updated_at,
  }));
}

function getAnalysisById(accountId, analysisId) {
  const analysis = db.prepare('SELECT * FROM analyses WHERE account_id = ? AND id = ?').get(accountId, analysisId);
  if (!analysis) return null;
  const nodes = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ? ORDER BY id ASC').all(analysisId);
  const serializedNodes = nodes.map((node) => ({
    id: node.id,
    analysisId: node.analysis_id,
    parentId: node.parent_id,
    incomingColumn: node.incoming_column,
    color: node.color,
    row: node.row,
    cellIndex: node.cell_index,
    board: parseBoard(node.board_json),
    turn: node.turn,
    result: node.result,
    winningCells: parseMaybeJson(node.winning_cells_json, []),
    history: parseHistory(node.history_json),
    moveCount: parseHistory(node.history_json).length,
  }));
  const byId = new Map(serializedNodes.map((node) => [node.id, { ...node, children: [] }]));
  let root = null;
  for (const node of serializedNodes) {
    const current = byId.get(node.id);
    if (node.parentId === null || node.parentId === undefined) {
      root = current;
    } else {
      const parent = byId.get(node.parentId);
      if (parent) parent.children.push(current);
    }
  }
  const sortTree = (node) => {
    node.children.sort((a, b) => {
      if (a.incomingColumn !== b.incomingColumn) return a.incomingColumn - b.incomingColumn;
      return a.id - b.id;
    });
    node.children.forEach(sortTree);
  };
  if (root) sortTree(root);
  return {
    analysis: {
      id: analysis.id,
      accountId: analysis.account_id,
      name: analysis.name,
      sourceMatchId: analysis.source_match_id,
      sourceLabel: analysis.source_label,
      sourceStep: analysis.source_step,
      sourceRoundId: analysis.source_round_id,
      sourcePrefix: parseMaybeJson(analysis.source_prefix_json, []),
      sourceBoard: parseBoard(analysis.source_board_json),
      sourceTurn: analysis.source_turn,
      sourceResult: analysis.source_result,
      sourceWinningCells: parseMaybeJson(analysis.source_winning_cells_json, []),
      rootNodeId: analysis.root_node_id,
      selectedNodeId: analysis.selected_node_id,
      revision: analysis.revision,
      updatedAt: analysis.updated_at,
    },
    nodes: serializedNodes,
    tree: root,
  };
}

function nodeLookup(accountId, analysisId, nodeId) {
  const analysis = db.prepare('SELECT * FROM analyses WHERE account_id = ? AND id = ?').get(accountId, analysisId);
  if (!analysis) return null;
  const node = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(nodeId, analysisId);
  if (!node) return null;
  return {
    analysis,
    node: {
      id: node.id,
      analysisId: node.analysis_id,
      parentId: node.parent_id,
      incomingColumn: node.incoming_column,
      color: node.color,
      row: node.row,
      cellIndex: node.cell_index,
      board: parseBoard(node.board_json),
      turn: node.turn,
      result: node.result,
      winningCells: parseMaybeJson(node.winning_cells_json, []),
      history: parseHistory(node.history_json),
    },
  };
}

function nodeToPublic(node) {
  return {
    id: node.id,
    analysisId: node.analysisId,
    parentId: node.parentId,
    incomingColumn: node.incomingColumn,
    color: node.color,
    row: node.row,
    cellIndex: node.cellIndex,
    board: boardSummary(node.board),
    turn: node.turn,
    result: node.result,
    winningCells: node.winningCells,
    history: buildMoveList(node.history),
    moveCount: node.history.length,
  };
}

function historyPrefixLength(a, b) {
  const limit = Math.min(a.length, b.length);
  let count = 0;
  for (let i = 0; i < limit; i += 1) {
    if (a[i].column !== b[i].column || a[i].color !== b[i].color) break;
    count += 1;
  }
  return count;
}

function compareNodes(accountId, analysisId, leftId, rightId) {
  const left = nodeLookup(accountId, analysisId, leftId);
  const right = nodeLookup(accountId, analysisId, rightId);
  if (!left || !right) return null;
  const leftNode = left.node;
  const rightNode = right.node;
  const sameAnalysis = leftNode.analysisId === rightNode.analysisId;
  if (!sameAnalysis) return null;
  const differingCells = [];
  for (let i = 0; i < TOTAL_CELLS; i += 1) {
    if (leftNode.board[i] !== rightNode.board[i]) {
      const { row, column } = rowColFromIndex(i);
      differingCells.push({
        index: i,
        row,
        column,
        left: leftNode.board[i] || '',
        right: rightNode.board[i] || '',
      });
    }
  }
  return {
    left: nodeToPublic(leftNode),
    right: nodeToPublic(rightNode),
    commonPrefixMoves: historyPrefixLength(leftNode.history, rightNode.history),
    differingCells,
  };
}

function legalChildrenForNode(node) {
  const board = node.board;
  const result = node.result;
  if (result) return [];
  const children = [];
  for (let column = 1; column <= BOARD_COLS; column += 1) {
    const row = legalDropRow(board, column);
    if (!row) continue;
    const applied = applyMove(board, node.history, column);
    if (applied.error) continue;
    children.push({
      column,
      board: applied.board,
      move: applied.move,
      result: applied.result,
      winningCells: applied.winningCells,
      turn: applied.turn,
    });
  }
  return children;
}

function evaluatePosition(board, turn, depth, memo) {
  const key = `${board.join('')}|${turn}|${depth}`;
  if (memo.has(key)) return memo.get(key);
  const terminal = boardResult(board);
  if (terminal.result) {
    const winner = terminal.result === 'Draw' ? null : terminal.result.split(' ')[0];
    const outcome = winner ? (winner === turn ? 'loss' : 'win') : 'draw';
    const value = { outcome, distance: 0, terminal: true, result: terminal.result };
    memo.set(key, value);
    return value;
  }
  if (depth === 0) {
    const value = { outcome: 'unknown', distance: null, terminal: false, result: null };
    memo.set(key, value);
    return value;
  }
  const nextTurn = turn === 'Red' ? 'Yellow' : 'Red';
  let winningDistances = [];
  let losingDistances = [];
  let drawSeen = false;
  let unknownSeen = false;
  const columns = [];
  for (let column = 1; column <= BOARD_COLS; column += 1) {
    const row = legalDropRow(board, column);
    if (!row) continue;
    const applied = applyMove(board, [], column, turn);
    if (applied.error) continue;
    const childEval = evaluatePosition(applied.board, nextTurn, depth - 1, memo);
    columns.push({ column, row, childEval });
    if (childEval.outcome === 'loss') {
      winningDistances.push(childEval.distance + 1);
    } else if (childEval.outcome === 'win') {
      losingDistances.push(childEval.distance + 1);
    } else if (childEval.outcome === 'draw') {
      drawSeen = true;
    } else {
      unknownSeen = true;
    }
  }
  let outcome = 'unknown';
  let distance = null;
  if (winningDistances.length) {
    outcome = 'win';
    distance = Math.min(...winningDistances);
  } else if (columns.length && losingDistances.length === columns.length) {
    outcome = 'loss';
    distance = Math.max(...losingDistances);
  } else if (!winningDistances.length && !unknownSeen && drawSeen) {
    outcome = 'draw';
  }
  const value = { outcome, distance, terminal: false, result: null };
  memo.set(key, value);
  return value;
}

function reportTreeForNode(node, depth, memo, path = []) {
  const terminal = boardResult(node.board);
  const evalResult = evaluatePosition(node.board, node.turn, depth, memo);
  const current = {
    path: path.slice(),
    player: node.turn,
    outcome: evalResult.outcome,
    distance: evalResult.distance,
    result: terminal.result,
    winningCells: node.winningCells,
    board: boardSummary(node.board),
    move: node.incomingColumn ? { column: node.incomingColumn, color: node.color } : null,
    terminal: Boolean(terminal.result),
    horizon: !terminal.result && depth === 0,
    children: [],
  };
  if (terminal.result || depth === 0) {
    return current;
  }
  for (let column = 1; column <= BOARD_COLS; column += 1) {
    const row = legalDropRow(node.board, column);
    if (!row) continue;
    const applied = applyMove(node.board, node.history, column);
    if (applied.error) continue;
    const childNode = {
      id: null,
      analysisId: node.analysisId,
      parentId: node.id,
      incomingColumn: column,
      color: node.turn,
      row: applied.move.row,
      cellIndex: applied.move.index,
      board: applied.board,
      turn: applied.turn,
      result: applied.result,
      winningCells: applied.winningCells,
      history: node.history.concat([applied.move]),
    };
    current.children.push(reportTreeForNode(childNode, depth - 1, memo, path.concat(column)));
  }
  return current;
}

function getAnalysisNodeState(accountId, analysisId) {
  const detail = getAnalysisById(accountId, analysisId);
  if (!detail) return null;
  const selected = detail.nodes.find((node) => node.id === detail.analysis.selectedNodeId) || detail.nodes[0];
  return { detail, selected };
}

function selectedNodeResponse(accountId, analysisId) {
  const detail = getAnalysisById(accountId, analysisId);
  if (!detail) return null;
  const selected = detail.nodes.find((node) => node.id === detail.analysis.selectedNodeId) || detail.nodes[0];
  return {
    analysis: detail.analysis,
    selectedNode: selected ? nodeToPublic(selected) : null,
    nodes: detail.nodes.map(nodeToPublic),
    tree: detail.tree,
  };
}

function findChildByColumn(node, column) {
  return db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ? AND parent_id = ? AND incoming_column = ?').get(node.analysisId, node.id, column);
}


function analysisNodeRowToState(row) {
  return {
    id: row.id,
    analysisId: row.analysis_id,
    parentId: row.parent_id,
    incomingColumn: row.incoming_column,
    color: row.color,
    row: row.row,
    cellIndex: row.cell_index,
    board: parseBoard(row.board_json),
    turn: row.turn,
    result: row.result,
    winningCells: parseMaybeJson(row.winning_cells_json, []),
    history: parseHistory(row.history_json),
  };
}

function createNodeForMove(analysisId, parentNode, column, color, board, history) {
  const applied = applyMove(board, history, column, color);
  if (applied.error) return { error: applied.error };
  const nodeStmt = db.prepare(`
    INSERT INTO analysis_nodes (
      analysis_id, parent_id, incoming_column, color, row, cell_index, board_json, turn, result, winning_cells_json, history_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = nodeStmt.run(
    analysisId,
    parentNode ? parentNode.id : null,
    column,
    color,
    applied.move.row,
    applied.move.index,
    JSON.stringify(applied.board),
    applied.turn,
    applied.result,
    JSON.stringify(applied.winningCells),
    JSON.stringify(history.concat([applied.move]))
  );
  return {
    nodeId: info.lastInsertRowid,
    applied,
  };
}

function buildAnalysisResponse(accountId, analysisId) {
  const detail = getAnalysisById(accountId, analysisId);
  if (!detail) return null;
  const selected = detail.nodes.find((node) => node.id === detail.analysis.selectedNodeId) || detail.nodes[0] || null;
  return {
    analysis: detail.analysis,
    nodes: detail.nodes.map(nodeToPublic),
    tree: detail.tree,
    selectedNode: selected ? nodeToPublic(selected) : null,
  };
}

function buildTreeIndex(root) {
  const map = new Map();
  const walk = (node) => {
    map.set(node.id, node);
    for (const child of node.children || []) walk(child);
  };
  if (root) walk(root);
  return map;
}

function seedDatabase() {
  const accountCount = db.prepare('SELECT COUNT(*) AS count FROM accounts').get().count;
  if (accountCount > 0) return;
  if (!fs.existsSync(SEED_XLSX)) {
    throw new Error(`Seed workbook not found at ${SEED_XLSX}`);
  }
  const workbook = xlsx.readFile(SEED_XLSX);
  const accountsSheet = xlsx.utils.sheet_to_json(workbook.Sheets['Accounts'], { header: 1, raw: true, defval: null });
  const initialSheet = xlsx.utils.sheet_to_json(workbook.Sheets['Initial Game State'], { header: 1, raw: true, defval: null });
  const completedSheet = xlsx.utils.sheet_to_json(workbook.Sheets['Completed Matches'], { header: 1, raw: true, defval: null });

  const accountStmt = db.prepare('INSERT INTO accounts (email, password_salt, password_hash, name) VALUES (?, ?, ?, ?)');
  const stateStmt = db.prepare(`
    INSERT INTO competitive_state (
      account_id, board_json, current_player, status, result, winning_cells_json,
      red_wins, yellow_wins, draws, applied_history_json, redo_history_json, revision, round_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const archiveStmt = db.prepare(`
    INSERT INTO competitive_archive (
      match_id, account_id, result, final_board_json, moves_json, winning_cells_json, completed_at, round_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const accountRows = accountsSheet.slice(1).filter((row) => row[0]);
  const insertedAccounts = new Map();
  const insertAccountsTx = db.transaction(() => {
    for (const row of accountRows) {
      const email = String(row[0]).trim();
      const password = String(row[1]);
      const name = String(row[2]).trim();
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPassword(password, salt);
      const info = accountStmt.run(email, salt, hash, name);
      insertedAccounts.set(email, info.lastInsertRowid);
    }
  });
  insertAccountsTx();

  const initialRows = initialSheet.slice(1).filter((row) => row[0]);
  const insertStateTx = db.transaction(() => {
    for (const row of initialRows) {
      const email = String(row[0]).trim();
      const accountId = insertedAccounts.get(email);
      if (!accountId) continue;
      stateStmt.run(
        accountId,
        JSON.stringify(parseBoard(row[1])),
        row[2],
        row[3],
        row[3] === 'active' ? null : row[3],
        JSON.stringify(row[4] === 'none' ? [] : parseMaybeJson(row[4], [])),
        Number(row[5] || 0),
        Number(row[6] || 0),
        Number(row[7] || 0),
        JSON.stringify(row[8] === 'none' ? [] : parseMaybeJson(row[8], [])),
        JSON.stringify(row[9] === 'none' ? [] : parseMaybeJson(row[9], [])),
        Number(row[10] || 0),
        String(row[11]),
        nowIso()
      );
    }
  });
  insertStateTx();

  const completedRows = completedSheet.slice(1).filter((row) => row[0]);
  const insertArchiveTx = db.transaction(() => {
    for (const row of completedRows) {
      const email = String(row[0]).trim();
      const accountId = insertedAccounts.get(email);
      if (!accountId) continue;
      const result = String(row[2]);
      const finalBoard = parseBoard(row[3]);
      const moves = parseMaybeJson(row[4], []);
      const winningCells = result === 'Draw' ? [] : winningCellsForBoard(finalBoard);
      archiveStmt.run(
        String(row[1]),
        accountId,
        result,
        JSON.stringify(finalBoard),
        JSON.stringify(moves),
        JSON.stringify(winningCells),
        String(row[5]),
        String(row[1])
      );
    }
  });
  insertArchiveTx();
}

function validateKeysAndValues(body, allowedKeys) {
  if (!assertAllowedKeys(body, allowedKeys)) {
    return 'Request contains unsupported fields or is not a JSON object.';
  }
  return null;
}

function operationReceipt(accountId, opId) {
  return db.prepare('SELECT * FROM operations WHERE account_id = ? AND op_id = ?').get(accountId, opId);
}

function recordOperation(accountId, opId, requestHash, result) {
  db.prepare('INSERT INTO operations (account_id, op_id, request_hash, status_code, response_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    accountId,
    opId,
    requestHash,
    result.statusCode,
    JSON.stringify(result.body),
    nowIso()
  );
}

function runOperation(accountId, opId, actionName, requestBody, handler) {
  const requestHash = sha256(stableStringify({ actionName, requestBody: jsonClone(requestBody) }));
  const existing = operationReceipt(accountId, opId);
  if (existing) {
    if (existing.request_hash !== requestHash) {
      return { statusCode: 409, body: { error: 'Operation identifier already used for different input.' } };
    }
    return { statusCode: existing.status_code, body: JSON.parse(existing.response_json) };
  }
  const tx = db.transaction(() => {
    const rawResult = handler();
    const result = rawResult && typeof rawResult === 'object' && 'statusCode' in rawResult && 'body' in rawResult
      ? rawResult
      : { statusCode: 200, body: rawResult };
    recordOperation(accountId, opId, requestHash, result);
    return result;
  });
  try {
    return tx();
  } catch (error) {
    console.error('operation failed', actionName, error);
    throw error;
  }
}

function getGameSnapshot(accountId) {
  const state = getCompetitiveState(accountId);
  if (!state) return null;
  return serializeCompetitiveState(state);
}

function maybeConflictWithGameState(accountId, expectedRevision, bodyMessage) {
  const state = getCompetitiveState(accountId);
  if (!state) return formatNotFoundError('Competitive game not found.');
  if (state.revision !== expectedRevision) {
    return formatConflictError(bodyMessage || 'Competitive game revision is stale.', {
      game: serializeCompetitiveState(state),
    });
  }
  return null;
}

function maybeConflictWithAnalysis(accountId, analysisId, expectedRevision, bodyMessage) {
  const detail = getAnalysisById(accountId, analysisId);
  if (!detail) return formatNotFoundError('Analysis not found.');
  if (detail.analysis.revision !== expectedRevision) {
    return formatConflictError(bodyMessage || 'Analysis revision is stale.', {
      analysis: detail.analysis,
      nodes: detail.nodes.map(nodeToPublic),
      tree: detail.tree,
    });
  }
  return null;
}

function getAnalysisNode(accountId, analysisId, nodeId) {
  const detail = nodeLookup(accountId, analysisId, nodeId);
  if (!detail) return null;
  return {
    analysis: detail.analysis,
    node: detail.node,
  };
}

function ensureAnalysisSelection(accountId, analysisId, nodeId) {
  const detail = nodeLookup(accountId, analysisId, nodeId);
  if (!detail) return null;
  return detail;
}

function createAnalysisFromMatch(accountId, payload) {
  const { sourceMatchId, sourceStep, name } = payload;
  const cleanName = validateName(name);
  if (!cleanName) return formatValidationError('Analysis name must be 1 to 60 trimmed characters long.');
  if (!Number.isInteger(sourceStep) || sourceStep < 0) return formatValidationError('Source step must be an integer from 0 upward.');
  const match = db.prepare('SELECT * FROM competitive_archive WHERE account_id = ? AND match_id = ?').get(accountId, sourceMatchId);
  if (!match) return formatNotFoundError('Source match not found.');
  const moves = parseHistory(match.moves_json);
  if (sourceStep > moves.length) {
    return formatValidationError('Source step is outside the replay range.');
  }
  const prefix = moves.slice(0, sourceStep);
  const state = deriveReplayState(prefix);
  const tx = db.transaction(() => {
    const analysisInfo = db.prepare(`
      INSERT INTO analyses (
        account_id, name, source_match_id, source_label, source_step, source_round_id,
        source_prefix_json, source_board_json, source_turn, source_result, source_winning_cells_json,
        revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      accountId,
      cleanName,
      match.match_id,
      match.match_id,
      sourceStep,
      match.round_id,
      JSON.stringify(prefix),
      JSON.stringify(state.board),
      state.turn,
      state.result,
      JSON.stringify(state.winningCells),
      nowIso(),
      nowIso()
    );
    const analysisId = analysisInfo.lastInsertRowid;
    const rootNodeInfo = db.prepare(`
      INSERT INTO analysis_nodes (
        analysis_id, parent_id, incoming_column, color, row, cell_index, board_json, turn, result, winning_cells_json, history_json
      ) VALUES (?, NULL, NULL, ?, NULL, NULL, ?, ?, ?, ?, ?)
    `).run(
      analysisId,
      state.turn === 'Red' ? 'Yellow' : 'Red',
      JSON.stringify(state.board),
      state.turn,
      state.result,
      JSON.stringify(state.winningCells),
      JSON.stringify(prefix)
    );
    db.prepare('UPDATE analyses SET root_node_id = ?, selected_node_id = ?, updated_at = ? WHERE id = ?').run(rootNodeInfo.lastInsertRowid, rootNodeInfo.lastInsertRowid, nowIso(), analysisId);
    return buildAnalysisResponse(accountId, analysisId);
  });
  return tx();
}

function deriveReplayState(history) {
  let board = createEmptyBoard();
  let result = null;
  let winningCells = [];
  for (let i = 0; i < history.length; i += 1) {
    const move = history[i];
    const applied = applyMove(board, history.slice(0, i), move.column, move.color);
    if (applied.error) {
      throw new Error(applied.error);
    }
    board = applied.board;
    result = applied.result;
    winningCells = applied.winningCells;
  }
  return {
    board,
    turn: currentPlayerAfterHistory(history),
    result,
    winningCells,
  };
}

function getNodeAndAnalysisOr404(accountId, analysisId, nodeId) {
  const detail = nodeLookup(accountId, analysisId, nodeId);
  if (!detail) return null;
  return detail;
}

function buildNodeMap(analysisId) {
  const rows = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ? ORDER BY id ASC').all(analysisId);
  const map = new Map();
  for (const node of rows) {
    map.set(node.id, node);
  }
  return map;
}

function previewBranch(accountId, payload) {
  const allowedKeys = ['opId', 'sourceAnalysisId', 'sourceNodeId', 'destinationAnalysisId', 'destinationNodeId'];
  const validation = validateKeysAndValues(payload, allowedKeys);
  if (validation) return formatValidationError(validation);
  const { sourceAnalysisId, sourceNodeId, destinationAnalysisId, destinationNodeId } = payload;
  if (![sourceAnalysisId, sourceNodeId, destinationAnalysisId, destinationNodeId].every((value) => Number.isInteger(value) && value > 0)) {
    return formatValidationError('Analysis and node identifiers must be positive integers.');
  }
  const source = getNodeAndAnalysisOr404(accountId, sourceAnalysisId, sourceNodeId);
  const destination = getNodeAndAnalysisOr404(accountId, destinationAnalysisId, destinationNodeId);
  if (!source || !destination) return formatNotFoundError('Source or destination node not found.');
  if (source.node.parentId === null) return formatValidationError('Source branch must be a non-root node.');
  const opId = payload.opId;
  if (!validateOpId(opId)) return formatValidationError('Operation identifier is missing or malformed.');
  return runOperation(accountId, opId, 'previewBranch', payload, () => {
    const sourceAnalysis = getAnalysisById(accountId, sourceAnalysisId);
    const destinationAnalysis = getAnalysisById(accountId, destinationAnalysisId);
    if (!sourceAnalysis || !destinationAnalysis) return formatNotFoundError('Source or destination analysis not found.');
    const stale = sourceAnalysis.analysis.revision !== sourceAnalysis.analysis.revision || destinationAnalysis.analysis.revision !== destinationAnalysis.analysis.revision;
    if (stale) return formatConflictError('Analysis revision is stale.');
    const previewId = randomId();
    const result = buildBranchPreview(
      sourceAnalysis,
      { ...source.node, analysisId: sourceAnalysisId, board_json: JSON.stringify(source.node.board), history_json: JSON.stringify(source.node.history) },
      destinationAnalysis,
      { ...destination.node, analysisId: destinationAnalysisId, board_json: JSON.stringify(destination.node.board), history_json: JSON.stringify(destination.node.history) }
    );
    const previewRow = {
      id: previewId,
      accountId,
      sourceAnalysisId,
      sourceNodeId,
      destinationAnalysisId,
      destinationNodeId,
      sourceRevision: sourceAnalysis.analysis.revision,
      destinationRevision: destinationAnalysis.analysis.revision,
      preview: result,
      committed: 0,
    };
    db.prepare(`
      INSERT INTO previews (
        id, account_id, source_analysis_id, source_node_id, destination_analysis_id, destination_node_id,
        source_revision, destination_revision, preview_json, committed, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      previewRow.id,
      previewRow.accountId,
      previewRow.sourceAnalysisId,
      previewRow.sourceNodeId,
      previewRow.destinationAnalysisId,
      previewRow.destinationNodeId,
      previewRow.sourceRevision,
      previewRow.destinationRevision,
      JSON.stringify(result),
      nowIso()
    );
    return {
      statusCode: 200,
      body: {
        previewId,
        sourceAnalysisId,
        sourceNodeId,
        destinationAnalysisId,
        destinationNodeId,
        sourceRevision: sourceAnalysis.analysis.revision,
        destinationRevision: destinationAnalysis.analysis.revision,
        ...result,
      },
    };
  });
}

function cloneMove(move) {
  return {
    color: move.color,
    column: move.column,
    row: move.row,
    index: move.index,
  };
}

function buildBranchPreview(sourceAnalysis, sourceNode, destinationAnalysis, destinationNode) {
  const sourceIndex = sourceNode.history.length - sourceAnalysis.analysis.sourcePrefix.length;
  const sourceBranchRootHistory = sourceNode.history.slice();
  const destinationPathHistory = destinationNode.history.slice();
  const mappingPreview = [];
  let newCount = 0;
  let reusedCount = 0;
  let illegal = null;

  function walk(sourceCurrent, destinationCurrent, relativeMoves) {
    const nextRelativeMoves = sourceCurrent.parentId === null ? relativeMoves : relativeMoves.concat([sourceCurrent.incomingColumn]);
    const currentBoard = destinationCurrent.board;
    const currentHistory = destinationCurrent.history;
    const currentTurn = destinationCurrent.turn;
    if (true) {
      const existingChildRow = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ? AND parent_id = ? AND incoming_column = ?').get(destinationCurrent.analysisId, destinationCurrent.id, sourceCurrent.incomingColumn);
      const existingChild = existingChildRow ? analysisNodeRowToState(existingChildRow) : null;
      if (existingChild) {
        reusedCount += 1;
        mappingPreview.push({
          sourceNodeId: sourceCurrent.id,
          destinationNodeId: existingChild.id,
          relativePath: nextRelativeMoves,
          board: existingChild.board,
          result: existingChild.result,
          reused: true,
        });
        for (const childRow of db.prepare('SELECT * FROM analysis_nodes WHERE parent_id = ? ORDER BY incoming_column ASC, id ASC').all(sourceCurrent.id)) {
          walk(analysisNodeRowToState(childRow), existingChild, nextRelativeMoves);
          if (illegal) return;
        }
        return;
      }
      const applied = applyMove(currentBoard, currentHistory, sourceCurrent.incomingColumn, currentTurn);
      if (applied.error) {
        illegal = {
          path: nextRelativeMoves,
          reason: applied.error,
        };
        return;
      }
      const newNode = {
        id: null,
        analysisId: destinationCurrent.analysisId,
        parentId: destinationCurrent.id,
        incomingColumn: sourceCurrent.incomingColumn,
        color: destinationCurrent.turn,
        row: applied.move.row,
        cellIndex: applied.move.index,
        board: applied.board,
        turn: applied.turn,
        result: applied.result,
        winningCells: applied.winningCells,
        history: parseHistory(destinationCurrent.history_json).concat([applied.move]),
      };
      newCount += 1;
      mappingPreview.push({
        sourceNodeId: sourceCurrent.id,
        destinationNodeId: null,
        relativePath: nextRelativeMoves,
        board: boardSummary(newNode.board),
        result: newNode.result,
        reused: false,
      });
      for (const childRow of db.prepare('SELECT * FROM analysis_nodes WHERE parent_id = ? ORDER BY incoming_column ASC, id ASC').all(sourceCurrent.id)) {
        walk(analysisNodeRowToState(childRow), { ...destinationCurrent, id: null, board: newNode.board, history: newNode.history, board_json: JSON.stringify(newNode.board), history_json: JSON.stringify(newNode.history), turn: newNode.turn, analysisId: destinationCurrent.analysisId }, nextRelativeMoves);
        if (illegal) return;
      }
    }
  }

  walk(sourceNode, destinationNode, []);
  return {
    preview: {
      sourceBranchRootNodeId: sourceNode.id,
      sourceBranchRootMove: sourceNode.incomingColumn,
      destinationNodeId: destinationNode.id,
      relativePaths: mappingPreview,
      newCount,
      reusedCount,
      illegal,
      sourceBranchLength: sourceNode.history.length - sourceAnalysis.analysis.sourcePrefix.length,
      destinationMoveCount: destinationNode.history.length,
    },
  };
}

function commitBranch(accountId, payload) {
  const allowedKeys = ['opId', 'previewId'];
  const validation = validateKeysAndValues(payload, allowedKeys);
  if (validation) return formatValidationError(validation);
  const { previewId, opId } = payload;
  if (typeof previewId !== 'string' || !previewId.trim()) return formatValidationError('Preview identifier is required.');
  if (!validateOpId(opId)) return formatValidationError('Operation identifier is missing or malformed.');
  return runOperation(accountId, opId, 'commitBranch', payload, () => {
    const preview = db.prepare('SELECT * FROM previews WHERE account_id = ? AND id = ?').get(accountId, previewId);
    if (!preview) return formatNotFoundError('Preview not found.');
    if (preview.committed) {
      return formatConflictError('Preview has already been committed.', { previewId });
    }
    const sourceAnalysis = getAnalysisById(accountId, preview.source_analysis_id);
    const destinationAnalysis = getAnalysisById(accountId, preview.destination_analysis_id);
    if (!sourceAnalysis || !destinationAnalysis) return formatNotFoundError('Source or destination analysis not found.');
    if (sourceAnalysis.analysis.revision !== preview.source_revision || destinationAnalysis.analysis.revision !== preview.destination_revision) {
      return formatConflictError('Preview is stale and must be regenerated.', {
        analysis: destinationAnalysis.analysis,
        nodes: destinationAnalysis.nodes.map(nodeToPublic),
      });
    }
    const previewData = JSON.parse(preview.preview_json);
    if (previewData.illegal) {
      return formatConflictError('Preview contains illegal moves and cannot be committed.', previewData.illegal);
    }
    const commitResult = commitBranchPreview(preview, sourceAnalysis, destinationAnalysis);
    return {
      statusCode: 200,
      body: commitResult,
    };
  });
}

function commitBranchPreview(preview, sourceAnalysis, destinationAnalysis) {
  const sourceRoot = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(preview.source_node_id, preview.source_analysis_id);
  const destinationRoot = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(preview.destination_node_id, preview.destination_analysis_id);
  const sourceChildren = db.prepare('SELECT * FROM analysis_nodes WHERE parent_id = ? ORDER BY incoming_column ASC, id ASC').all(sourceRoot.id);
  const mapping = [];
  let newCount = 0;
  let reusedCount = 0;

  const nodeCache = new Map();
  const ensureCommit = (sourceNodeId, destinationParentId) => {
    const sourceNode = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(sourceNodeId, preview.source_analysis_id);
    if (!sourceNode) return null;
    const sourceChildrenRows = db.prepare('SELECT * FROM analysis_nodes WHERE parent_id = ? ORDER BY incoming_column ASC, id ASC').all(sourceNode.id);
    if (false) {
      for (const child of sourceChildrenRows) {
        ensureCommit(child.id, destinationRoot.id);
      }
      return destinationRoot.id;
    }
    const destinationParent = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(destinationParentId, preview.destination_analysis_id);
    if (!destinationParent) return null;
    const existing = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ? AND parent_id = ? AND incoming_column = ?').get(preview.destination_analysis_id, destinationParent.id, sourceNode.incoming_column);
    if (existing) {
      reusedCount += 1;
      mapping.push({ sourceNodeId: sourceNode.id, destinationNodeId: existing.id, reused: true });
      for (const child of sourceChildrenRows) {
        ensureCommit(child.id, existing.id);
      }
      return existing.id;
    }
    const parentBoard = parseBoard(destinationParent.board_json);
    const parentHistory = parseHistory(destinationParent.history_json);
    const applied = applyMove(parentBoard, parentHistory, sourceNode.incoming_column, destinationParent.turn);
    if (applied.error) {
      return null;
    }
    const inserted = db.prepare(`
      INSERT INTO analysis_nodes (
        analysis_id, parent_id, incoming_column, color, row, cell_index, board_json, turn, result, winning_cells_json, history_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      preview.destination_analysis_id,
      destinationParent.id,
      sourceNode.incoming_column,
      destinationParent.turn,
      applied.move.row,
      applied.move.index,
      JSON.stringify(applied.board),
      applied.turn,
      applied.result,
      JSON.stringify(applied.winningCells),
      JSON.stringify(parentHistory.concat([applied.move]))
    );
    newCount += 1;
    const newId = inserted.lastInsertRowid;
    mapping.push({ sourceNodeId: sourceNode.id, destinationNodeId: newId, reused: false });
    for (const child of sourceChildrenRows) {
      ensureCommit(child.id, newId);
    }
    return newId;
  };

  ensureCommit(sourceRoot.id, destinationRoot.id);

  db.prepare('UPDATE analyses SET revision = revision + 1, updated_at = ? WHERE id = ?').run(nowIso(), preview.destination_analysis_id);
  const latest = buildAnalysisResponse(sourceAnalysis.analysis.accountId, preview.destination_analysis_id);
  db.prepare('UPDATE previews SET committed = 1, committed_at = ? WHERE id = ?').run(nowIso(), preview.id);
  return {
    previewId: preview.id,
    sourceAnalysisId: preview.source_analysis_id,
    destinationAnalysisId: preview.destination_analysis_id,
    newCount,
    reusedCount,
    mapping,
    analysis: latest.analysis,
    nodes: latest.nodes,
    tree: latest.tree,
  };
}

function mutateCompetitiveState(accountId, request, reducer) {
  const state = getCompetitiveState(accountId);
  if (!state) return formatNotFoundError('Competitive game not found.');
  const result = reducer(state);
  if (result.statusCode >= 400) return result;
  return result;
}

function updateCompetitiveState(accountId, state) {
  db.prepare(`
    UPDATE competitive_state SET
      board_json = ?, current_player = ?, status = ?, result = ?, winning_cells_json = ?,
      red_wins = ?, yellow_wins = ?, draws = ?, applied_history_json = ?, redo_history_json = ?,
      revision = ?, round_id = ?, updated_at = ?
    WHERE account_id = ?
  `).run(
    JSON.stringify(state.board),
    state.currentPlayer,
    state.status,
    state.result,
    JSON.stringify(state.winningCells),
    state.redWins,
    state.yellowWins,
    state.draws,
    JSON.stringify(state.history),
    JSON.stringify(state.redoHistory),
    state.revision,
    state.roundId,
    nowIso(),
    accountId
  );
}

function maybeUpdateArchiveForCurrentState(accountId, state) {
  const existing = db.prepare('SELECT * FROM competitive_archive WHERE account_id = ? AND round_id = ?').get(accountId, state.roundId);
  const completed = state.result === 'Draw' || state.result === 'Red wins' || state.result === 'Yellow wins';
  if (completed) {
    if (!existing) {
      db.prepare(`
        INSERT INTO competitive_archive (match_id, account_id, result, final_board_json, moves_json, winning_cells_json, completed_at, round_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        state.roundId,
        accountId,
        state.result,
        JSON.stringify(state.board),
        JSON.stringify(state.history),
        JSON.stringify(state.winningCells),
        nowIso(),
        state.roundId
      );
    } else {
      db.prepare(`
        UPDATE competitive_archive SET result = ?, final_board_json = ?, moves_json = ?, winning_cells_json = ?, completed_at = ? WHERE account_id = ? AND round_id = ?
      `).run(state.result, JSON.stringify(state.board), JSON.stringify(state.history), JSON.stringify(state.winningCells), nowIso(), accountId, state.roundId);
    }
  } else if (existing) {
    db.prepare('DELETE FROM competitive_archive WHERE account_id = ? AND round_id = ?').run(accountId, state.roundId);
  }
}

function applyCompetitiveMove(accountId, payload) {
  const allowedKeys = ['opId', 'expectedRevision', 'column'];
  const validation = validateKeysAndValues(payload, allowedKeys);
  if (validation) return formatValidationError(validation);
  const { opId, expectedRevision, column } = payload;
  if (!validateOpId(opId)) return formatValidationError('Operation identifier is missing or malformed.');
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return formatValidationError('Expected revision must be a non-negative integer.');
  if (!Number.isInteger(column) || column < 1 || column > BOARD_COLS) return formatValidationError('Column must be an integer from 1 to 7.');
  return runOperation(accountId, opId, 'competitiveMove', payload, () => {
    const current = getCompetitiveState(accountId);
    if (!current) return formatNotFoundError('Competitive game not found.');
    if (current.revision !== expectedRevision) {
      return formatConflictError('Competitive game revision is stale.', { game: serializeCompetitiveState(current) });
    }
    const applied = applyMove(current.board, current.history, column);
    if (applied.error) return formatValidationError(applied.error);
    current.board = applied.board;
    current.history = current.history.concat([applied.move]);
    current.redoHistory = [];
    current.currentPlayer = applied.turn;
    current.result = applied.result;
    current.winningCells = applied.winningCells;
    current.revision += 1;
    current.status = applied.result ? 'completed' : 'active';
    if (applied.result === 'Red wins') current.redWins += 1;
    if (applied.result === 'Yellow wins') current.yellowWins += 1;
    if (applied.result === 'Draw') current.draws += 1;
    maybeUpdateArchiveForCurrentState(accountId, current);
    updateCompetitiveState(accountId, current);
    return { statusCode: 200, body: { game: serializeCompetitiveState(current) } };
  });
}

function undoCompetitiveMove(accountId, payload) {
  const allowedKeys = ['opId', 'expectedRevision'];
  const validation = validateKeysAndValues(payload, allowedKeys);
  if (validation) return formatValidationError(validation);
  const { opId, expectedRevision } = payload;
  if (!validateOpId(opId)) return formatValidationError('Operation identifier is missing or malformed.');
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return formatValidationError('Expected revision must be a non-negative integer.');
  return runOperation(accountId, opId, 'competitiveUndo', payload, () => {
    const current = getCompetitiveState(accountId);
    if (!current) return formatNotFoundError('Competitive game not found.');
    if (current.revision !== expectedRevision) {
      return formatConflictError('Competitive game revision is stale.', { game: serializeCompetitiveState(current) });
    }
    if (!current.history.length) return formatValidationError('Undo is not available at the root.');
    const lastMove = current.history[current.history.length - 1];
    const nextBoard = cloneBoard(current.board);
    nextBoard[lastMove.index] = '';
    const previousResult = current.result;
    current.board = nextBoard;
    current.history = current.history.slice(0, -1);
    current.redoHistory = [lastMove].concat(current.redoHistory);
    current.currentPlayer = lastMove.color;
    current.result = null;
    current.winningCells = [];
    current.revision += 1;
    current.status = 'active';
    const derived = boardResult(current.board);
    if (derived.result) {
      current.result = derived.result;
      current.winningCells = derived.winningCells;
      current.status = 'completed';
    }
    if (previousResult === 'Red wins' && current.result !== 'Red wins' && current.redWins > 0) {
      current.redWins -= 1;
    }
    if (previousResult === 'Yellow wins' && current.result !== 'Yellow wins' && current.yellowWins > 0) {
      current.yellowWins -= 1;
    }
    if (previousResult === 'Draw' && current.result !== 'Draw' && current.draws > 0) {
      current.draws -= 1;
    }
    maybeUpdateArchiveForCurrentState(accountId, current);
    updateCompetitiveState(accountId, current);
    return { statusCode: 200, body: { game: serializeCompetitiveState(current) } };
  });
}

function redoCompetitiveMove(accountId, payload) {
  const allowedKeys = ['opId', 'expectedRevision'];
  const validation = validateKeysAndValues(payload, allowedKeys);
  if (validation) return formatValidationError(validation);
  const { opId, expectedRevision } = payload;
  if (!validateOpId(opId)) return formatValidationError('Operation identifier is missing or malformed.');
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return formatValidationError('Expected revision must be a non-negative integer.');
  return runOperation(accountId, opId, 'competitiveRedo', payload, () => {
    const current = getCompetitiveState(accountId);
    if (!current) return formatNotFoundError('Competitive game not found.');
    if (current.revision !== expectedRevision) {
      return formatConflictError('Competitive game revision is stale.', { game: serializeCompetitiveState(current) });
    }
    if (!current.redoHistory.length) return formatValidationError('Redo is not available.');
    const redoMove = current.redoHistory[0];
    const rest = current.redoHistory.slice(1);
    const applied = applyMove(current.board, current.history, redoMove.column, redoMove.color);
    if (applied.error) return formatValidationError(applied.error);
    const previousResult = current.result;
    current.board = applied.board;
    current.history = current.history.concat([applied.move]);
    current.redoHistory = rest;
    current.currentPlayer = applied.turn;
    current.result = applied.result;
    current.winningCells = applied.winningCells;
    current.revision += 1;
    current.status = applied.result ? 'completed' : 'active';
    if (previousResult !== 'Red wins' && applied.result === 'Red wins') current.redWins += 1;
    if (previousResult !== 'Yellow wins' && applied.result === 'Yellow wins') current.yellowWins += 1;
    if (previousResult !== 'Draw' && applied.result === 'Draw') current.draws += 1;
    maybeUpdateArchiveForCurrentState(accountId, current);
    updateCompetitiveState(accountId, current);
    return { statusCode: 200, body: { game: serializeCompetitiveState(current) } };
  });
}

function applyAnalysisCreate(accountId, payload) {
  const allowedKeys = ['opId', 'sourceMatchId', 'sourceStep', 'name'];
  const validation = validateKeysAndValues(payload, allowedKeys);
  if (validation) return formatValidationError(validation);
  const opId = payload.opId;
  if (!validateOpId(opId)) return formatValidationError('Operation identifier is missing or malformed.');
  return runOperation(accountId, opId, 'analysisCreate', payload, () => createAnalysisFromMatch(accountId, payload));
}

function applyAnalysisRename(accountId, analysisId, payload) {
  const allowedKeys = ['opId', 'expectedRevision', 'name'];
  const validation = validateKeysAndValues(payload, allowedKeys);
  if (validation) return formatValidationError(validation);
  const { opId, expectedRevision, name } = payload;
  if (!validateOpId(opId)) return formatValidationError('Operation identifier is missing or malformed.');
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return formatValidationError('Expected revision must be a non-negative integer.');
  const cleanName = validateName(name);
  if (!cleanName) return formatValidationError('Analysis name must be 1 to 60 trimmed characters long.');
  return runOperation(accountId, opId, 'analysisRename', payload, () => {
    const stale = maybeConflictWithAnalysis(accountId, analysisId, expectedRevision, 'Analysis revision is stale.');
    if (stale) return stale;
    const analysis = db.prepare('SELECT * FROM analyses WHERE account_id = ? AND id = ?').get(accountId, analysisId);
    if (!analysis) return formatNotFoundError('Analysis not found.');
    db.prepare('UPDATE analyses SET name = ?, revision = revision + 1, updated_at = ? WHERE id = ?').run(cleanName, nowIso(), analysisId);
    return { statusCode: 200, body: { analysis: getAnalysisById(accountId, analysisId).analysis } };
  });
}

function applyAnalysisSelect(accountId, analysisId, payload) {
  const allowedKeys = ['opId', 'expectedRevision', 'nodeId'];
  const validation = validateKeysAndValues(payload, allowedKeys);
  if (validation) return formatValidationError(validation);
  const { opId, expectedRevision, nodeId } = payload;
  if (!validateOpId(opId)) return formatValidationError('Operation identifier is missing or malformed.');
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return formatValidationError('Expected revision must be a non-negative integer.');
  if (!Number.isInteger(nodeId) || nodeId <= 0) return formatValidationError('Node identifier must be a positive integer.');
  return runOperation(accountId, opId, 'analysisSelect', payload, () => {
    const stale = maybeConflictWithAnalysis(accountId, analysisId, expectedRevision, 'Analysis revision is stale.');
    if (stale) return stale;
    const node = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(nodeId, analysisId);
    if (!node) return formatNotFoundError('Analysis node not found.');
    db.prepare('UPDATE analyses SET selected_node_id = ?, revision = revision + 1, updated_at = ? WHERE id = ?').run(nodeId, nowIso(), analysisId);
    return { statusCode: 200, body: buildAnalysisResponse(accountId, analysisId) };
  });
}

function applyAnalysisMove(accountId, analysisId, payload) {
  const allowedKeys = ['opId', 'expectedRevision', 'column'];
  const validation = validateKeysAndValues(payload, allowedKeys);
  if (validation) return formatValidationError(validation);
  const { opId, expectedRevision, column } = payload;
  if (!validateOpId(opId)) return formatValidationError('Operation identifier is missing or malformed.');
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return formatValidationError('Expected revision must be a non-negative integer.');
  if (!Number.isInteger(column) || column < 1 || column > BOARD_COLS) return formatValidationError('Column must be an integer from 1 to 7.');
  return runOperation(accountId, opId, 'analysisMove', payload, () => {
    const stale = maybeConflictWithAnalysis(accountId, analysisId, expectedRevision, 'Analysis revision is stale.');
    if (stale) return stale;
    const detail = getAnalysisById(accountId, analysisId);
    if (!detail) return formatNotFoundError('Analysis not found.');
    const selected = detail.nodes.find((node) => node.id === detail.analysis.selectedNodeId) || detail.nodes[0];
    if (!selected) return formatConflictError('Analysis has no selected node.');
    if (selected.result) return formatValidationError('The selected analysis node is terminal.');
    const existing = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ? AND parent_id = ? AND incoming_column = ?').get(analysisId, selected.id, column);
    let chosenNode;
    if (existing) {
      chosenNode = existing;
    } else {
      const parentHistory = parseHistory(selected.history_json || JSON.stringify(selected.history || []));
      const applied = applyMove(selected.board, selected.history, column, selected.turn);
      if (applied.error) return formatValidationError(applied.error);
      const inserted = db.prepare(`
        INSERT INTO analysis_nodes (
          analysis_id, parent_id, incoming_column, color, row, cell_index, board_json, turn, result, winning_cells_json, history_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        analysisId,
        selected.id,
        column,
        selected.turn,
        applied.move.row,
        applied.move.index,
        JSON.stringify(applied.board),
        applied.turn,
        applied.result,
        JSON.stringify(applied.winningCells),
        JSON.stringify(selected.history.concat([applied.move]))
      );
      chosenNode = db.prepare('SELECT * FROM analysis_nodes WHERE id = ?').get(inserted.lastInsertRowid);
    }
    db.prepare('UPDATE analyses SET selected_node_id = ?, revision = revision + 1, updated_at = ? WHERE id = ?').run(chosenNode.id, nowIso(), analysisId);
    return { statusCode: 200, body: buildAnalysisResponse(accountId, analysisId) };
  });
}

function applyAnalysisUndo(accountId, analysisId, payload) {
  const allowedKeys = ['opId', 'expectedRevision'];
  const validation = validateKeysAndValues(payload, allowedKeys);
  if (validation) return formatValidationError(validation);
  const { opId, expectedRevision } = payload;
  if (!validateOpId(opId)) return formatValidationError('Operation identifier is missing or malformed.');
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return formatValidationError('Expected revision must be a non-negative integer.');
  return runOperation(accountId, opId, 'analysisUndo', payload, () => {
    const stale = maybeConflictWithAnalysis(accountId, analysisId, expectedRevision, 'Analysis revision is stale.');
    if (stale) return stale;
    const detail = getAnalysisById(accountId, analysisId);
    if (!detail) return formatNotFoundError('Analysis not found.');
    const selected = detail.nodes.find((node) => node.id === detail.analysis.selectedNodeId) || detail.nodes[0];
    if (!selected || selected.parentId === null || selected.parentId === undefined) {
      return formatValidationError('Undo is not available at the source root.');
    }
    db.prepare('UPDATE analyses SET selected_node_id = ?, revision = revision + 1, updated_at = ? WHERE id = ?').run(selected.parentId, nowIso(), analysisId);
    return { statusCode: 200, body: buildAnalysisResponse(accountId, analysisId) };
  });
}

function applyAnalysisRedo(accountId, analysisId, payload) {
  const allowedKeys = ['opId', 'expectedRevision', 'childId'];
  const validation = validateKeysAndValues(payload, allowedKeys);
  if (validation) return formatValidationError(validation);
  const { opId, expectedRevision, childId } = payload;
  if (!validateOpId(opId)) return formatValidationError('Operation identifier is missing or malformed.');
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return formatValidationError('Expected revision must be a non-negative integer.');
  if (childId !== undefined && (!Number.isInteger(childId) || childId <= 0)) return formatValidationError('Child identifier must be a positive integer when provided.');
  return runOperation(accountId, opId, 'analysisRedo', payload, () => {
    const stale = maybeConflictWithAnalysis(accountId, analysisId, expectedRevision, 'Analysis revision is stale.');
    if (stale) return stale;
    const detail = getAnalysisById(accountId, analysisId);
    if (!detail) return formatNotFoundError('Analysis not found.');
    const selected = detail.nodes.find((node) => node.id === detail.analysis.selectedNodeId) || detail.nodes[0];
    const children = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ? AND parent_id = ? ORDER BY incoming_column ASC, id ASC').all(analysisId, selected.id);
    if (!children.length) return formatValidationError('Redo is not available.');
    let chosen = null;
    if (children.length === 1 && childId === undefined) {
      chosen = children[0];
    } else if (childId !== undefined) {
      chosen = children.find((child) => child.id === childId) || null;
      if (!chosen) return formatConflictError('The chosen child is not a direct continuation of the selected node.');
    } else {
      return formatConflictError('Redo is ambiguous; choose one of the available children.', {
        children: children.map((child) => nodeToPublic({
          id: child.id,
          analysisId,
          parentId: child.parent_id,
          incomingColumn: child.incoming_column,
          color: child.color,
          row: child.row,
          cellIndex: child.cell_index,
          board: parseBoard(child.board_json),
          turn: child.turn,
          result: child.result,
          winningCells: parseMaybeJson(child.winning_cells_json, []),
          history: parseHistory(child.history_json),
        })),
      });
    }
    db.prepare('UPDATE analyses SET selected_node_id = ?, revision = revision + 1, updated_at = ? WHERE id = ?').run(chosen.id, nowIso(), analysisId);
    return { statusCode: 200, body: buildAnalysisResponse(accountId, analysisId) };
  });
}

function applyAnalysisCompare(accountId, payload) {
  const allowedKeys = ['analysisId', 'leftNodeId', 'rightNodeId'];
  const validation = validateKeysAndValues(payload, allowedKeys);
  if (validation) return formatValidationError(validation);
  const { analysisId, leftNodeId, rightNodeId } = payload;
  if (![analysisId, leftNodeId, rightNodeId].every((value) => Number.isInteger(value) && value > 0)) {
    return formatValidationError('Analysis and node identifiers must be positive integers.');
  }
  const comparison = compareNodes(accountId, analysisId, leftNodeId, rightNodeId);
  if (!comparison) return formatNotFoundError('Analysis or node not found.');
  return { statusCode: 200, body: comparison };
}

function applyAnalysisReport(accountId, payload) {
  const allowedKeys = ['analysisId', 'nodeId', 'depth'];
  const validation = validateKeysAndValues(payload, allowedKeys);
  if (validation) return formatValidationError(validation);
  const { analysisId, nodeId, depth } = payload;
  if (![analysisId, nodeId].every((value) => Number.isInteger(value) && value > 0)) {
    return formatValidationError('Analysis and node identifiers must be positive integers.');
  }
  if (!Number.isInteger(depth) || depth < 1 || depth > 4) {
    return formatValidationError('Depth must be an integer from 1 to 4.');
  }
  const detail = getNodeAndAnalysisOr404(accountId, analysisId, nodeId);
  if (!detail) return formatNotFoundError('Analysis node not found.');
  const memo = new Map();
  const node = { ...detail.node, analysisId };
  const boardState = boardResult(node.board);
  const outcome = evaluatePosition(node.board, node.turn, depth, memo);
  const tree = reportTreeForNode(node, depth, memo, []);
  const playableColumns = [];
  if (!boardState.result) {
    for (let column = 1; column <= BOARD_COLS; column += 1) {
      const row = legalDropRow(node.board, column);
      if (!row) continue;
      const applied = applyMove(node.board, node.history, column);
      if (applied.error) continue;
      const childOutcome = evaluatePosition(applied.board, applied.turn, depth - 1, memo);
      let label = childOutcome.outcome;
      if (label === 'win' || label === 'loss') label += ` in ${childOutcome.distance + 1} plies`;
      playableColumns.push({ column, row, outcome: childOutcome.outcome, distance: childOutcome.distance, label, board: boardSummary(applied.board) });
    }
  }
  return {
    statusCode: 200,
    body: {
      analysisId,
      nodeId,
      depth,
      perspective: node.turn,
      terminalResult: boardState.result,
      outcome: outcome.outcome,
      distance: outcome.distance,
      winningCells: node.winningCells,
      playableColumns,
      proofTree: tree,
    },
  };
}

function authResponse(account) {
  const bootstrap = getBootstrap(account.id);
  return { account: { id: account.id, email: account.email, name: account.name }, ...bootstrap };
}

function getBootstrap(accountId) {
  const state = getCompetitiveState(accountId);
  if (!state) return null;
  return {
    game: serializeCompetitiveState(state),
    archive: getArchiveSummaries(accountId),
    analyses: getAnalysisMetadata(accountId),
  };
}

function loginRoute(req, res) {
  const allowedKeys = ['email', 'password'];
  if (!assertAllowedKeys(req.body, allowedKeys)) {
    return res.status(400).json({ error: 'Request contains unsupported fields or is not a JSON object.' });
  }
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email.trim());
  if (!account || !verifyPassword(password, account.password_salt, account.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const token = randomToken();
  db.prepare('INSERT INTO sessions (account_id, token_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?)').run(account.id, sha256(token), nowIso(), nowIso());
  return res.json({ token, ...authResponse(account) });
}

function logoutAllRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL').run(nowIso(), account.id);
  res.json({ ok: true });
}

function bootstrapRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  res.json({ tokenOk: true, account: { id: account.id, email: account.email, name: account.name }, ...getBootstrap(account.id) });
}

function getArchiveRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  const matchId = req.params.matchId;
  const detail = archiveDetail(account.id, matchId);
  if (!detail) return res.status(404).json({ error: 'Archive match not found.' });
  res.json(detail);
}

function getAnalysisRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  const analysisId = Number(req.params.analysisId);
  if (!Number.isInteger(analysisId) || analysisId <= 0) return res.status(400).json({ error: 'Analysis identifier must be a positive integer.' });
  const response = buildAnalysisResponse(account.id, analysisId);
  if (!response) return res.status(404).json({ error: 'Analysis not found.' });
  res.json(response);
}

function currentAnalysisSelectedNode(accountId, analysisId) {
  const detail = getAnalysisById(accountId, analysisId);
  if (!detail) return null;
  const selected = detail.nodes.find((node) => node.id === detail.analysis.selectedNodeId) || detail.nodes[0];
  return { detail, selected };
}

function analysisDetailForOperation(accountId, analysisId) {
  const detail = getAnalysisById(accountId, analysisId);
  if (!detail) return null;
  return detail;
}

function createAnalysisRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  const result = applyAnalysisCreate(account.id, req.body || {});
  res.status(result.statusCode).json(result.body);
}

function analysisRenameRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  const analysisId = Number(req.params.analysisId);
  if (!Number.isInteger(analysisId) || analysisId <= 0) return res.status(400).json({ error: 'Analysis identifier must be a positive integer.' });
  const result = applyAnalysisRename(account.id, analysisId, req.body || {});
  res.status(result.statusCode).json(result.body);
}

function analysisSelectRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  const analysisId = Number(req.params.analysisId);
  if (!Number.isInteger(analysisId) || analysisId <= 0) return res.status(400).json({ error: 'Analysis identifier must be a positive integer.' });
  const result = applyAnalysisSelect(account.id, analysisId, req.body || {});
  res.status(result.statusCode).json(result.body);
}

function analysisMoveRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  const analysisId = Number(req.params.analysisId);
  if (!Number.isInteger(analysisId) || analysisId <= 0) return res.status(400).json({ error: 'Analysis identifier must be a positive integer.' });
  const result = applyAnalysisMove(account.id, analysisId, req.body || {});
  res.status(result.statusCode).json(result.body);
}

function analysisUndoRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  const analysisId = Number(req.params.analysisId);
  if (!Number.isInteger(analysisId) || analysisId <= 0) return res.status(400).json({ error: 'Analysis identifier must be a positive integer.' });
  const result = applyAnalysisUndo(account.id, analysisId, req.body || {});
  res.status(result.statusCode).json(result.body);
}

function analysisRedoRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  const analysisId = Number(req.params.analysisId);
  if (!Number.isInteger(analysisId) || analysisId <= 0) return res.status(400).json({ error: 'Analysis identifier must be a positive integer.' });
  const result = applyAnalysisRedo(account.id, analysisId, req.body || {});
  res.status(result.statusCode).json(result.body);
}

function analysisCompareRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  const result = applyAnalysisCompare(account.id, req.body || {});
  res.status(result.statusCode).json(result.body);
}

function analysisReportRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  const result = applyAnalysisReport(account.id, req.body || {});
  res.status(result.statusCode).json(result.body);
}

function previewBranchRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  const result = previewBranch(account.id, req.body || {});
  res.status(result.statusCode).json(result.body);
}

function commitBranchRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  const result = commitBranch(account.id, req.body || {});
  res.status(result.statusCode).json(result.body);
}

function gameMoveRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  const result = applyCompetitiveMove(account.id, req.body || {});
  res.status(result.statusCode).json(result.body);
}

function gameUndoRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  const result = undoCompetitiveMove(account.id, req.body || {});
  res.status(result.statusCode).json(result.body);
}

function gameRedoRoute(req, res) {
  const account = requireAccount(req, res);
  if (!account) return;
  const result = redoCompetitiveMove(account.id, req.body || {});
  res.status(result.statusCode).json(result.body);
}

initSchema();
seedDatabase();

app.post('/api/auth/login', loginRoute);
app.post('/api/auth/logout-all', logoutAllRoute);
app.get('/api/bootstrap', bootstrapRoute);
app.get('/api/archive/:matchId', getArchiveRoute);
app.get('/api/analysis/:analysisId', getAnalysisRoute);
app.post('/api/game/move', gameMoveRoute);
app.post('/api/game/undo', gameUndoRoute);
app.post('/api/game/redo', gameRedoRoute);
app.post('/api/analysis/from-match', createAnalysisRoute);
app.post('/api/analysis/:analysisId/rename', analysisRenameRoute);
app.post('/api/analysis/:analysisId/select', analysisSelectRoute);
app.post('/api/analysis/:analysisId/move', analysisMoveRoute);
app.post('/api/analysis/:analysisId/undo', analysisUndoRoute);
app.post('/api/analysis/:analysisId/redo', analysisRedoRoute);
app.post('/api/analysis/compare', analysisCompareRoute);
app.post('/api/analysis/preview-branch', previewBranchRoute);
app.post('/api/analysis/commit-branch', commitBranchRoute);
app.post('/api/analysis/report', analysisReportRoute);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, () => {
  console.log(`DropLine listening on http://localhost:${PORT}`);
});

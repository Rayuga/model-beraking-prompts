const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');
const { authMiddleware } = require('./auth');
const { hashInput, checkReceipt, saveReceipt } = require('../receipts');
const engine = require('../gameEngine');

const router = express.Router();
router.use(authMiddleware);

function getGameState(db, accountId) {
  let row = db.prepare('SELECT * FROM game_states WHERE account_id = ?').get(accountId);
  if (!row) {
    // Initialize if somehow missing
    const emptyBoard = JSON.stringify(engine.createEmptyBoard());
    const initialRoundId = `round-${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO game_states (
        account_id, board, current_player, status, winning_cells,
        red_wins, yellow_wins, draws, applied_history, redo_history, revision, round_id
      ) VALUES (?, ?, 'Red', 'active', '[]', 0, 0, 0, '[]', '[]', 0, ?)
    `).run(accountId, emptyBoard, initialRoundId);
    row = db.prepare('SELECT * FROM game_states WHERE account_id = ?').get(accountId);
  }

  const board = typeof row.board === 'string' ? JSON.parse(row.board) : row.board;
  const appliedHistory = typeof row.applied_history === 'string' ? JSON.parse(row.applied_history) : row.applied_history;
  const redoHistory = typeof row.redo_history === 'string' ? JSON.parse(row.redo_history) : row.redo_history;
  const winningCells = row.winning_cells === 'none' || !row.winning_cells ? [] : (typeof row.winning_cells === 'string' ? JSON.parse(row.winning_cells) : row.winning_cells);

  return {
    board,
    currentPlayer: row.current_player,
    status: row.status,
    winningCells,
    redWins: row.red_wins,
    yellowWins: row.yellow_wins,
    draws: row.draws,
    appliedHistory,
    redoHistory,
    revision: row.revision,
    roundId: row.round_id,
    canUndo: appliedHistory.length > 0,
    canRedo: redoHistory.length > 0
  };
}

// GET /api/game
router.get('/game', (req, res) => {
  const db = getDb();
  const state = getGameState(db, req.account.id);
  return res.json(state);
});

// POST /api/game/move
router.post('/game/move', (req, res) => {
  const accountId = req.account.id;
  const { column, expectedRevision, operationId } = req.body || {};

  // Reject unexpected extra fields
  const allowedKeys = ['column', 'expectedRevision', 'operationId'];
  const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return res.status(400).json({ error: 'Unexpected additional fields' });
  }

  if (!operationId || typeof operationId !== 'string' || operationId.trim().length === 0) {
    return res.status(400).json({ error: 'Valid operationId is required' });
  }

  if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return res.status(400).json({ error: 'Valid integer expectedRevision is required' });
  }

  if (typeof column !== 'number' || !Number.isInteger(column) || column < 1 || column > engine.COLS) {
    return res.status(400).json({ error: 'Column must be an integer between 1 and 7' });
  }

  const inputHash = hashInput({ action: 'move', column, expectedRevision, operationId });
  const cached = checkReceipt(accountId, operationId, inputHash);
  if (cached) {
    return res.status(cached.statusCode).json(cached.responseJson);
  }

  const db = getDb();

  const performMove = db.transaction(() => {
    const state = getGameState(db, accountId);

    if (expectedRevision !== state.revision) {
      const resp = {
        error: 'Game updated in another tab',
        state
      };
      saveReceipt(accountId, operationId, 'game', inputHash, 409, resp);
      return { status: 409, body: resp };
    }

    if (state.status !== 'active') {
      const resp = { error: 'Game is already finished. Start a new game.', state };
      saveReceipt(accountId, operationId, 'game', inputHash, 400, resp);
      return { status: 400, body: resp };
    }

    if (engine.isColumnFull(state.board, column)) {
      const resp = { error: `Column ${column} is full`, state };
      saveReceipt(accountId, operationId, 'game', inputHash, 400, resp);
      return { status: 400, body: resp };
    }

    const moveRes = engine.applyMoveToBoard(state.board, column, state.currentPlayer);
    const moveRecord = {
      moveNumber: state.appliedHistory.length + 1,
      color: state.currentPlayer,
      column,
      row: moveRes.lastMove.row,
      index: moveRes.lastMove.index
    };

    const newAppliedHistory = [...state.appliedHistory, moveRecord];
    const newRedoHistory = [];
    let newRedWins = state.redWins;
    let newYellowWins = state.yellowWins;
    let newDraws = state.draws;
    const newStatus = moveRes.status;
    const newWinningCells = moveRes.winningCells;
    let nextPlayer = state.currentPlayer === 'Red' ? 'Yellow' : 'Red';

    if (newStatus === 'Red wins') {
      newRedWins++;
      db.prepare(`
        INSERT OR REPLACE INTO completed_matches (account_id, match_id, result, final_board, moves, completed_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(accountId, state.roundId, newStatus, JSON.stringify(moveRes.board), JSON.stringify(newAppliedHistory));
    } else if (newStatus === 'Yellow wins') {
      newYellowWins++;
      db.prepare(`
        INSERT OR REPLACE INTO completed_matches (account_id, match_id, result, final_board, moves, completed_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(accountId, state.roundId, newStatus, JSON.stringify(moveRes.board), JSON.stringify(newAppliedHistory));
    } else if (newStatus === 'Draw') {
      newDraws++;
      db.prepare(`
        INSERT OR REPLACE INTO completed_matches (account_id, match_id, result, final_board, moves, completed_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(accountId, state.roundId, newStatus, JSON.stringify(moveRes.board), JSON.stringify(newAppliedHistory));
    }

    const nextRevision = state.revision + 1;

    db.prepare(`
      UPDATE game_states SET
        board = ?,
        current_player = ?,
        status = ?,
        winning_cells = ?,
        red_wins = ?,
        yellow_wins = ?,
        draws = ?,
        applied_history = ?,
        redo_history = ?,
        revision = ?
      WHERE account_id = ?
    `).run(
      JSON.stringify(moveRes.board),
      nextPlayer,
      newStatus,
      JSON.stringify(newWinningCells),
      newRedWins,
      newYellowWins,
      newDraws,
      JSON.stringify(newAppliedHistory),
      JSON.stringify(newRedoHistory),
      nextRevision,
      accountId
    );

    const updatedState = {
      board: moveRes.board,
      currentPlayer: nextPlayer,
      status: newStatus,
      winningCells: newWinningCells,
      redWins: newRedWins,
      yellowWins: newYellowWins,
      draws: newDraws,
      appliedHistory: newAppliedHistory,
      redoHistory: newRedoHistory,
      revision: nextRevision,
      roundId: state.roundId,
      canUndo: newAppliedHistory.length > 0,
      canRedo: false
    };

    saveReceipt(accountId, operationId, 'game', inputHash, 200, updatedState);
    return { status: 200, body: updatedState };
  });

  const result = performMove();
  return res.status(result.status).json(result.body);
});

// POST /api/game/undo
router.post('/game/undo', (req, res) => {
  const accountId = req.account.id;
  const { expectedRevision, operationId } = req.body || {};

  const allowedKeys = ['expectedRevision', 'operationId'];
  const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return res.status(400).json({ error: 'Unexpected additional fields' });
  }

  if (!operationId || typeof operationId !== 'string' || operationId.trim().length === 0) {
    return res.status(400).json({ error: 'Valid operationId is required' });
  }

  if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return res.status(400).json({ error: 'Valid integer expectedRevision is required' });
  }

  const inputHash = hashInput({ action: 'undo', expectedRevision, operationId });
  const cached = checkReceipt(accountId, operationId, inputHash);
  if (cached) {
    return res.status(cached.statusCode).json(cached.responseJson);
  }

  const db = getDb();

  const performUndo = db.transaction(() => {
    const state = getGameState(db, accountId);

    if (expectedRevision !== state.revision) {
      const resp = { error: 'Game updated in another tab', state };
      saveReceipt(accountId, operationId, 'game', inputHash, 409, resp);
      return { status: 409, body: resp };
    }

    if (state.appliedHistory.length === 0) {
      const resp = { error: 'No moves to undo', state };
      saveReceipt(accountId, operationId, 'game', inputHash, 400, resp);
      return { status: 400, body: resp };
    }

    const poppedMove = state.appliedHistory[state.appliedHistory.length - 1];
    const newAppliedHistory = state.appliedHistory.slice(0, -1);
    const newRedoHistory = [poppedMove, ...state.redoHistory];

    let newRedWins = state.redWins;
    let newYellowWins = state.yellowWins;
    let newDraws = state.draws;

    if (state.status === 'Red wins') {
      newRedWins = Math.max(0, newRedWins - 1);
      db.prepare('DELETE FROM completed_matches WHERE account_id = ? AND match_id = ?').run(accountId, state.roundId);
    } else if (state.status === 'Yellow wins') {
      newYellowWins = Math.max(0, newYellowWins - 1);
      db.prepare('DELETE FROM completed_matches WHERE account_id = ? AND match_id = ?').run(accountId, state.roundId);
    } else if (state.status === 'Draw') {
      newDraws = Math.max(0, newDraws - 1);
      db.prepare('DELETE FROM completed_matches WHERE account_id = ? AND match_id = ?').run(accountId, state.roundId);
    }

    // Reconstruct board from newAppliedHistory
    const derived = engine.deriveStateFromMoves(newAppliedHistory);
    const nextRevision = state.revision + 1;
    const currentPlayer = poppedMove.color; // Give turn back to that piece's color

    db.prepare(`
      UPDATE game_states SET
        board = ?,
        current_player = ?,
        status = 'active',
        winning_cells = '[]',
        red_wins = ?,
        yellow_wins = ?,
        draws = ?,
        applied_history = ?,
        redo_history = ?,
        revision = ?
      WHERE account_id = ?
    `).run(
      JSON.stringify(derived.board),
      currentPlayer,
      newRedWins,
      newYellowWins,
      newDraws,
      JSON.stringify(newAppliedHistory),
      JSON.stringify(newRedoHistory),
      nextRevision,
      accountId
    );

    const updatedState = {
      board: derived.board,
      currentPlayer,
      status: 'active',
      winningCells: [],
      redWins: newRedWins,
      yellowWins: newYellowWins,
      draws: newDraws,
      appliedHistory: newAppliedHistory,
      redoHistory: newRedoHistory,
      revision: nextRevision,
      roundId: state.roundId,
      canUndo: newAppliedHistory.length > 0,
      canRedo: newRedoHistory.length > 0
    };

    saveReceipt(accountId, operationId, 'game', inputHash, 200, updatedState);
    return { status: 200, body: updatedState };
  });

  const result = performUndo();
  return res.status(result.status).json(result.body);
});

// POST /api/game/redo
router.post('/game/redo', (req, res) => {
  const accountId = req.account.id;
  const { expectedRevision, operationId } = req.body || {};

  const allowedKeys = ['expectedRevision', 'operationId'];
  const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return res.status(400).json({ error: 'Unexpected additional fields' });
  }

  if (!operationId || typeof operationId !== 'string' || operationId.trim().length === 0) {
    return res.status(400).json({ error: 'Valid operationId is required' });
  }

  if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return res.status(400).json({ error: 'Valid integer expectedRevision is required' });
  }

  const inputHash = hashInput({ action: 'redo', expectedRevision, operationId });
  const cached = checkReceipt(accountId, operationId, inputHash);
  if (cached) {
    return res.status(cached.statusCode).json(cached.responseJson);
  }

  const db = getDb();

  const performRedo = db.transaction(() => {
    const state = getGameState(db, accountId);

    if (expectedRevision !== state.revision) {
      const resp = { error: 'Game updated in another tab', state };
      saveReceipt(accountId, operationId, 'game', inputHash, 409, resp);
      return { status: 409, body: resp };
    }

    if (state.redoHistory.length === 0) {
      const resp = { error: 'No moves to redo', state };
      saveReceipt(accountId, operationId, 'game', inputHash, 400, resp);
      return { status: 400, body: resp };
    }

    const moveToRedo = state.redoHistory[0];
    const newRedoHistory = state.redoHistory.slice(1);
    const newAppliedHistory = [...state.appliedHistory, moveToRedo];

    const moveRes = engine.applyMoveToBoard(state.board, moveToRedo.column, moveToRedo.color);
    let newRedWins = state.redWins;
    let newYellowWins = state.yellowWins;
    let newDraws = state.draws;
    const newStatus = moveRes.status;
    const newWinningCells = moveRes.winningCells;
    let nextPlayer = moveToRedo.color === 'Red' ? 'Yellow' : 'Red';

    if (newStatus === 'Red wins') {
      newRedWins++;
      db.prepare(`
        INSERT OR REPLACE INTO completed_matches (account_id, match_id, result, final_board, moves, completed_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(accountId, state.roundId, newStatus, JSON.stringify(moveRes.board), JSON.stringify(newAppliedHistory));
    } else if (newStatus === 'Yellow wins') {
      newYellowWins++;
      db.prepare(`
        INSERT OR REPLACE INTO completed_matches (account_id, match_id, result, final_board, moves, completed_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(accountId, state.roundId, newStatus, JSON.stringify(moveRes.board), JSON.stringify(newAppliedHistory));
    } else if (newStatus === 'Draw') {
      newDraws++;
      db.prepare(`
        INSERT OR REPLACE INTO completed_matches (account_id, match_id, result, final_board, moves, completed_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(accountId, state.roundId, newStatus, JSON.stringify(moveRes.board), JSON.stringify(newAppliedHistory));
    }

    const nextRevision = state.revision + 1;

    db.prepare(`
      UPDATE game_states SET
        board = ?,
        current_player = ?,
        status = ?,
        winning_cells = ?,
        red_wins = ?,
        yellow_wins = ?,
        draws = ?,
        applied_history = ?,
        redo_history = ?,
        revision = ?
      WHERE account_id = ?
    `).run(
      JSON.stringify(moveRes.board),
      nextPlayer,
      newStatus,
      JSON.stringify(newWinningCells),
      newRedWins,
      newYellowWins,
      newDraws,
      JSON.stringify(newAppliedHistory),
      JSON.stringify(newRedoHistory),
      nextRevision,
      accountId
    );

    const updatedState = {
      board: moveRes.board,
      currentPlayer: nextPlayer,
      status: newStatus,
      winningCells: newWinningCells,
      redWins: newRedWins,
      yellowWins: newYellowWins,
      draws: newDraws,
      appliedHistory: newAppliedHistory,
      redoHistory: newRedoHistory,
      revision: nextRevision,
      roundId: state.roundId,
      canUndo: newAppliedHistory.length > 0,
      canRedo: newRedoHistory.length > 0
    };

    saveReceipt(accountId, operationId, 'game', inputHash, 200, updatedState);
    return { status: 200, body: updatedState };
  });

  const result = performRedo();
  return res.status(result.status).json(result.body);
});

// POST /api/game/new
router.post('/game/new', (req, res) => {
  const accountId = req.account.id;
  const { expectedRevision, operationId } = req.body || {};

  const allowedKeys = ['expectedRevision', 'operationId'];
  const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return res.status(400).json({ error: 'Unexpected additional fields' });
  }

  if (!operationId || typeof operationId !== 'string' || operationId.trim().length === 0) {
    return res.status(400).json({ error: 'Valid operationId is required' });
  }

  if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return res.status(400).json({ error: 'Valid integer expectedRevision is required' });
  }

  const inputHash = hashInput({ action: 'new', expectedRevision, operationId });
  const cached = checkReceipt(accountId, operationId, inputHash);
  if (cached) {
    return res.status(cached.statusCode).json(cached.responseJson);
  }

  const db = getDb();

  const performNew = db.transaction(() => {
    const state = getGameState(db, accountId);

    if (expectedRevision !== state.revision) {
      const resp = { error: 'Game updated in another tab', state };
      saveReceipt(accountId, operationId, 'game', inputHash, 409, resp);
      return { status: 409, body: resp };
    }

    const emptyBoard = engine.createEmptyBoard();
    const nextRevision = state.revision + 1;
    const newRoundId = `round-${crypto.randomUUID()}`;

    db.prepare(`
      UPDATE game_states SET
        board = ?,
        current_player = 'Red',
        status = 'active',
        winning_cells = '[]',
        applied_history = '[]',
        redo_history = '[]',
        revision = ?,
        round_id = ?
      WHERE account_id = ?
    `).run(
      JSON.stringify(emptyBoard),
      nextRevision,
      newRoundId,
      accountId
    );

    const updatedState = {
      board: emptyBoard,
      currentPlayer: 'Red',
      status: 'active',
      winningCells: [],
      redWins: state.redWins,
      yellowWins: state.yellowWins,
      draws: state.draws,
      appliedHistory: [],
      redoHistory: [],
      revision: nextRevision,
      roundId: newRoundId,
      canUndo: false,
      canRedo: false
    };

    saveReceipt(accountId, operationId, 'game', inputHash, 200, updatedState);
    return { status: 200, body: updatedState };
  });

  const result = performNew();
  return res.status(result.status).json(result.body);
});

// GET /api/archive
router.get('/archive', (req, res) => {
  const db = getDb();
  const accountId = req.account.id;

  const totalCount = db.prepare('SELECT COUNT(*) as count FROM completed_matches WHERE account_id = ?').get(accountId).count;
  const matches = db.prepare(`
    SELECT id, match_id, result, moves, completed_at
    FROM completed_matches
    WHERE account_id = ?
    ORDER BY id DESC
    LIMIT 10
  `).all(accountId);

  const formattedMatches = matches.map(m => {
    const moves = typeof m.moves === 'string' ? JSON.parse(m.moves) : m.moves;
    return {
      id: m.id,
      matchId: m.match_id,
      result: m.result,
      moveCount: moves.length,
      completedAt: m.completed_at
    };
  });

  return res.json({
    totalCount,
    matches: formattedMatches
  });
});

// GET /api/archive/:matchId
router.get('/archive/:matchId', (req, res) => {
  const db = getDb();
  const accountId = req.account.id;
  const { matchId } = req.params;

  const match = db.prepare(`
    SELECT id, match_id, result, final_board, moves, completed_at
    FROM completed_matches
    WHERE account_id = ? AND match_id = ?
  `).get(accountId, matchId);

  if (!match) {
    return res.status(404).json({ error: 'Completed match not found' });
  }

  const finalBoard = typeof match.final_board === 'string' ? JSON.parse(match.final_board) : match.final_board;
  const moves = typeof match.moves === 'string' ? JSON.parse(match.moves) : match.moves;

  return res.json({
    id: match.id,
    matchId: match.match_id,
    result: match.result,
    finalBoard,
    moves,
    completedAt: match.completed_at
  });
});

module.exports = {
  router,
  getGameState
};

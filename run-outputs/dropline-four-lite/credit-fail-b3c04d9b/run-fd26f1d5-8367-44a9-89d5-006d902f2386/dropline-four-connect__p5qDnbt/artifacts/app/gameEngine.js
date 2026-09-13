const crypto = require('crypto');

const ROWS = 6;
const COLS = 7;
const TOTAL_CELLS = 42;

function getCellIndex(row, col) {
  return (row - 1) * COLS + (col - 1);
}

function getCellCoords(index) {
  return {
    row: Math.floor(index / COLS) + 1,
    col: (index % COLS) + 1
  };
}

function createEmptyBoard() {
  return Array(TOTAL_CELLS).fill('');
}

function findLowestEmptyRow(board, col) {
  for (let row = ROWS; row >= 1; row--) {
    const idx = getCellIndex(row, col);
    if (!board[idx]) {
      return row;
    }
  }
  return null;
}

function checkWin(board, targetColor = null) {
  // Horizontal
  for (let r = 1; r <= ROWS; r++) {
    for (let c = 1; c <= COLS - 3; c++) {
      const idxs = [
        getCellIndex(r, c),
        getCellIndex(r, c + 1),
        getCellIndex(r, c + 2),
        getCellIndex(r, c + 3)
      ];
      const color = board[idxs[0]];
      if (color && (!targetColor || color === targetColor) &&
          color === board[idxs[1]] &&
          color === board[idxs[2]] &&
          color === board[idxs[3]]) {
        return { winner: color, winningCells: idxs };
      }
    }
  }

  // Vertical
  for (let r = 1; r <= ROWS - 3; r++) {
    for (let c = 1; c <= COLS; c++) {
      const idxs = [
        getCellIndex(r, c),
        getCellIndex(r + 1, c),
        getCellIndex(r + 2, c),
        getCellIndex(r + 3, c)
      ];
      const color = board[idxs[0]];
      if (color && (!targetColor || color === targetColor) &&
          color === board[idxs[1]] &&
          color === board[idxs[2]] &&
          color === board[idxs[3]]) {
        return { winner: color, winningCells: idxs };
      }
    }
  }

  // Diagonal Down-Right (\)
  for (let r = 1; r <= ROWS - 3; r++) {
    for (let c = 1; c <= COLS - 3; c++) {
      const idxs = [
        getCellIndex(r, c),
        getCellIndex(r + 1, c + 1),
        getCellIndex(r + 2, c + 2),
        getCellIndex(r + 3, c + 3)
      ];
      const color = board[idxs[0]];
      if (color && (!targetColor || color === targetColor) &&
          color === board[idxs[1]] &&
          color === board[idxs[2]] &&
          color === board[idxs[3]]) {
        return { winner: color, winningCells: idxs };
      }
    }
  }

  // Diagonal Down-Left (/)
  for (let r = 1; r <= ROWS - 3; r++) {
    for (let c = 4; c <= COLS; c++) {
      const idxs = [
        getCellIndex(r, c),
        getCellIndex(r + 1, c - 1),
        getCellIndex(r + 2, c - 2),
        getCellIndex(r + 3, c - 3)
      ];
      const color = board[idxs[0]];
      if (color && (!targetColor || color === targetColor) &&
          color === board[idxs[1]] &&
          color === board[idxs[2]] &&
          color === board[idxs[3]]) {
        return { winner: color, winningCells: idxs };
      }
    }
  }

  return null;
}

function isBoardFull(board) {
  return !board.some(cell => !cell);
}

function parseBoard(boardData) {
  if (Array.isArray(boardData)) return [...boardData];
  if (typeof boardData === 'string') {
    try {
      const parsed = JSON.parse(boardData);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  return createEmptyBoard();
}

function parseHistory(historyData) {
  if (Array.isArray(historyData)) return [...historyData];
  if (typeof historyData === 'string') {
    try {
      const parsed = JSON.parse(historyData);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  return [];
}

function applyMove(state, column) {
  if (state.status === 'Red wins' || state.status === 'Yellow wins' || state.status === 'Draw') {
    return { valid: false, error: 'Round is already finished' };
  }

  const col = parseInt(column, 10);
  if (isNaN(col) || col < 1 || col > COLS) {
    return { valid: false, error: 'Invalid column' };
  }

  const board = parseBoard(state.board);
  const row = findLowestEmptyRow(board, col);
  if (row === null) {
    return { valid: false, error: `Column ${col} is full` };
  }

  const color = state.current_player || 'Red';
  const index = getCellIndex(row, col);
  board[index] = color;

  const appliedHistory = parseHistory(state.applied_history);
  appliedHistory.push({
    color,
    column: col,
    row,
    index
  });

  const redoHistory = []; // Cleared on new move

  let status = 'active';
  let winningCells = null;
  let redWins = state.red_wins || 0;
  let yellowWins = state.yellow_wins || 0;
  let draws = state.draws || 0;
  let archiveMatch = null;
  let currentPlayer = color === 'Red' ? 'Yellow' : 'Red';

  const win = checkWin(board, color);
  if (win) {
    status = `${color} wins`;
    winningCells = win.winningCells;
    if (color === 'Red') {
      redWins += 1;
    } else {
      yellowWins += 1;
    }
    archiveMatch = {
      match_id: 'match-' + crypto.randomUUID(),
      round_id: state.round_id,
      result: status,
      final_board: JSON.stringify(board),
      moves: JSON.stringify(appliedHistory),
      winning_cells: JSON.stringify(winningCells),
      completed_at: new Date().toISOString()
    };
  } else if (isBoardFull(board)) {
    status = 'Draw';
    draws += 1;
    archiveMatch = {
      match_id: 'match-' + crypto.randomUUID(),
      round_id: state.round_id,
      result: 'Draw',
      final_board: JSON.stringify(board),
      moves: JSON.stringify(appliedHistory),
      winning_cells: null,
      completed_at: new Date().toISOString()
    };
  }

  return {
    valid: true,
    newState: {
      ...state,
      board: JSON.stringify(board),
      current_player: currentPlayer,
      status,
      winning_cells: winningCells ? JSON.stringify(winningCells) : null,
      red_wins: redWins,
      yellow_wins: yellowWins,
      draws,
      applied_history: JSON.stringify(appliedHistory),
      redo_history: JSON.stringify(redoHistory),
      revision: (state.revision || 0) + 1
    },
    archiveMatch
  };
}

function applyUndo(state) {
  const appliedHistory = parseHistory(state.applied_history);
  if (appliedHistory.length === 0) {
    return { valid: false, error: 'Nothing to undo' };
  }

  const lastMove = appliedHistory.pop();
  const board = parseBoard(state.board);
  board[lastMove.index] = '';

  const redoHistory = parseHistory(state.redo_history);
  redoHistory.push(lastMove);

  let redWins = state.red_wins || 0;
  let yellowWins = state.yellow_wins || 0;
  let draws = state.draws || 0;
  let unarchiveRoundId = null;

  if (state.status === 'Red wins') {
    redWins = Math.max(0, redWins - 1);
    unarchiveRoundId = state.round_id;
  } else if (state.status === 'Yellow wins') {
    yellowWins = Math.max(0, yellowWins - 1);
    unarchiveRoundId = state.round_id;
  } else if (state.status === 'Draw') {
    draws = Math.max(0, draws - 1);
    unarchiveRoundId = state.round_id;
  }

  return {
    valid: true,
    newState: {
      ...state,
      board: JSON.stringify(board),
      current_player: lastMove.color,
      status: 'active',
      winning_cells: null,
      red_wins: redWins,
      yellow_wins: yellowWins,
      draws,
      applied_history: JSON.stringify(appliedHistory),
      redo_history: JSON.stringify(redoHistory),
      revision: (state.revision || 0) + 1
    },
    unarchiveRoundId
  };
}

function applyRedo(state) {
  const redoHistory = parseHistory(state.redo_history);
  if (redoHistory.length === 0) {
    return { valid: false, error: 'Nothing to redo' };
  }

  const moveToRedo = redoHistory.pop();
  const board = parseBoard(state.board);
  board[moveToRedo.index] = moveToRedo.color;

  const appliedHistory = parseHistory(state.applied_history);
  appliedHistory.push(moveToRedo);

  let status = 'active';
  let winningCells = null;
  let redWins = state.red_wins || 0;
  let yellowWins = state.yellow_wins || 0;
  let draws = state.draws || 0;
  let archiveMatch = null;
  let currentPlayer = moveToRedo.color === 'Red' ? 'Yellow' : 'Red';

  const win = checkWin(board, moveToRedo.color);
  if (win) {
    status = `${moveToRedo.color} wins`;
    winningCells = win.winningCells;
    if (moveToRedo.color === 'Red') {
      redWins += 1;
    } else {
      yellowWins += 1;
    }
    archiveMatch = {
      match_id: 'match-' + crypto.randomUUID(),
      round_id: state.round_id,
      result: status,
      final_board: JSON.stringify(board),
      moves: JSON.stringify(appliedHistory),
      winning_cells: JSON.stringify(winningCells),
      completed_at: new Date().toISOString()
    };
  } else if (isBoardFull(board)) {
    status = 'Draw';
    draws += 1;
    archiveMatch = {
      match_id: 'match-' + crypto.randomUUID(),
      round_id: state.round_id,
      result: 'Draw',
      final_board: JSON.stringify(board),
      moves: JSON.stringify(appliedHistory),
      winning_cells: null,
      completed_at: new Date().toISOString()
    };
  }

  return {
    valid: true,
    newState: {
      ...state,
      board: JSON.stringify(board),
      current_player: currentPlayer,
      status,
      winning_cells: winningCells ? JSON.stringify(winningCells) : null,
      red_wins: redWins,
      yellow_wins: yellowWins,
      draws,
      applied_history: JSON.stringify(appliedHistory),
      redo_history: JSON.stringify(redoHistory),
      revision: (state.revision || 0) + 1
    },
    archiveMatch
  };
}

function applyNewGame(state) {
  const redWins = state.red_wins || 0;
  const yellowWins = state.yellow_wins || 0;
  const draws = state.draws || 0;

  return {
    valid: true,
    newState: {
      ...state,
      round_id: 'round-' + crypto.randomUUID(),
      board: JSON.stringify(createEmptyBoard()),
      current_player: 'Red',
      status: 'active',
      winning_cells: null,
      red_wins: redWins,
      yellow_wins: yellowWins,
      draws,
      applied_history: JSON.stringify([]),
      redo_history: JSON.stringify([]),
      revision: (state.revision || 0) + 1
    }
  };
}

module.exports = {
  ROWS,
  COLS,
  TOTAL_CELLS,
  getCellIndex,
  getCellCoords,
  createEmptyBoard,
  findLowestEmptyRow,
  checkWin,
  isBoardFull,
  parseBoard,
  parseHistory,
  applyMove,
  applyUndo,
  applyRedo,
  applyNewGame
};

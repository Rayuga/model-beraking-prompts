export const ROWS = 6;
export const COLUMNS = 7;
export const STORAGE_VERSION = 1;
export const STORAGE_KEY = "dropline:v1";
export const PLAYERS = ["red", "yellow"];

export function otherPlayer(player) {
  return player === "red" ? "yellow" : "red";
}

export function createInitialState() {
  return {
    version: STORAGE_VERSION,
    board: Array(ROWS * COLUMNS).fill(null),
    currentPlayer: "red",
    roundStarter: "red",
    status: "playing",
    winningCells: [],
    history: [],
    redo: [],
    scores: { red: 0, yellow: 0, draws: 0 },
  };
}

export function cellIndex(row, column) {
  return row * COLUMNS + column;
}

export function tokenAt(state, row, column) {
  return state.board[cellIndex(row, column)];
}

function cloneState(state) {
  return {
    ...state,
    board: [...state.board],
    winningCells: [...state.winningCells],
    history: state.history.map((move) => ({ ...move })),
    redo: state.redo.map((move) => ({ ...move })),
    scores: { ...state.scores },
  };
}

function availableRow(board, column) {
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (board[cellIndex(row, column)] === null) return row;
  }
  return -1;
}

function winningLine(board, row, column, player) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (const [rowStep, columnStep] of directions) {
    const line = [];
    let currentRow = row;
    let currentColumn = column;
    while (
      currentRow - rowStep >= 0 && currentRow - rowStep < ROWS &&
      currentColumn - columnStep >= 0 && currentColumn - columnStep < COLUMNS &&
      board[cellIndex(currentRow - rowStep, currentColumn - columnStep)] === player
    ) {
      currentRow -= rowStep;
      currentColumn -= columnStep;
    }
    while (
      currentRow >= 0 && currentRow < ROWS &&
      currentColumn >= 0 && currentColumn < COLUMNS &&
      board[cellIndex(currentRow, currentColumn)] === player
    ) {
      line.push({ row: currentRow, column: currentColumn });
      currentRow += rowStep;
      currentColumn += columnStep;
    }
    if (line.length >= 4) {
      const placedAt = line.findIndex((cell) => cell.row === row && cell.column === column);
      const start = Math.max(0, Math.min(placedAt, line.length - 4));
      return line.slice(start, start + 4).map((cell) => cellIndex(cell.row, cell.column));
    }
  }
  return [];
}

function applyTerminalResult(state, player, line) {
  if (line.length === 4) {
    state.status = `${player}-won`;
    state.winningCells = line;
    state.scores[player] += 1;
    return;
  }
  if (state.board.every(Boolean)) {
    state.status = "draw";
    state.winningCells = [];
    state.scores.draws += 1;
    return;
  }
  state.status = "playing";
  state.winningCells = [];
  state.currentPlayer = otherPlayer(player);
}

function reverseTerminalResult(state) {
  if (state.status === "red-won") state.scores.red = Math.max(0, state.scores.red - 1);
  if (state.status === "yellow-won") state.scores.yellow = Math.max(0, state.scores.yellow - 1);
  if (state.status === "draw") state.scores.draws = Math.max(0, state.scores.draws - 1);
  state.status = "playing";
  state.winningCells = [];
}

export function dropPiece(state, column) {
  if (!Number.isInteger(column) || column < 0 || column >= COLUMNS) {
    return { state, accepted: false, reason: "invalid-column" };
  }
  if (state.status !== "playing") {
    return { state, accepted: false, reason: "round-complete" };
  }
  const row = availableRow(state.board, column);
  if (row < 0) return { state, accepted: false, reason: "column-full" };

  const next = cloneState(state);
  const move = { player: next.currentPlayer, row, column };
  next.board[cellIndex(row, column)] = move.player;
  next.history.push(move);
  next.redo = [];
  const line = winningLine(next.board, row, column, move.player);
  applyTerminalResult(next, move.player, line);
  return { state: next, accepted: true, move };
}

export function undoMove(state) {
  if (state.history.length === 0) return { state, accepted: false, reason: "nothing-to-undo" };
  const next = cloneState(state);
  reverseTerminalResult(next);
  const move = next.history.pop();
  next.board[cellIndex(move.row, move.column)] = null;
  next.redo.push(move);
  next.currentPlayer = move.player;
  return { state: next, accepted: true, move };
}

export function redoMove(state) {
  if (state.redo.length === 0 || state.status !== "playing") {
    return { state, accepted: false, reason: "nothing-to-redo" };
  }
  const next = cloneState(state);
  const move = next.redo.pop();
  if (next.board[cellIndex(move.row, move.column)] !== null) {
    return { state, accepted: false, reason: "redo-cell-occupied" };
  }
  next.board[cellIndex(move.row, move.column)] = move.player;
  next.history.push(move);
  const line = winningLine(next.board, move.row, move.column, move.player);
  applyTerminalResult(next, move.player, line);
  return { state: next, accepted: true, move };
}

export function startNextRound(state) {
  if (state.status === "playing") return { state, accepted: false, reason: "round-in-progress" };
  const starter = otherPlayer(state.roundStarter);
  return {
    accepted: true,
    state: {
      ...createInitialState(),
      currentPlayer: starter,
      roundStarter: starter,
      scores: { ...state.scores },
    },
  };
}

export function resetMatch() {
  return { accepted: true, state: createInitialState() };
}

function validMove(move) {
  return move && PLAYERS.includes(move.player) && Number.isInteger(move.row) &&
    move.row >= 0 && move.row < ROWS && Number.isInteger(move.column) &&
    move.column >= 0 && move.column < COLUMNS;
}

export function normalizeState(value) {
  if (!value || value.version !== STORAGE_VERSION || !Array.isArray(value.board) ||
      value.board.length !== ROWS * COLUMNS ||
      value.board.some((cell) => cell !== null && !PLAYERS.includes(cell)) ||
      !PLAYERS.includes(value.currentPlayer) || !PLAYERS.includes(value.roundStarter) ||
      !["playing", "red-won", "yellow-won", "draw"].includes(value.status) ||
      !Array.isArray(value.winningCells) || !Array.isArray(value.history) ||
      !Array.isArray(value.redo) || value.history.some((move) => !validMove(move)) ||
      value.redo.some((move) => !validMove(move)) || !value.scores) {
    return createInitialState();
  }
  return {
    version: STORAGE_VERSION,
    board: [...value.board],
    currentPlayer: value.currentPlayer,
    roundStarter: value.roundStarter,
    status: value.status,
    winningCells: value.winningCells.filter((index) => Number.isInteger(index) && index >= 0 && index < ROWS * COLUMNS),
    history: value.history.map((move) => ({ ...move })),
    redo: value.redo.map((move) => ({ ...move })),
    scores: {
      red: Math.max(0, Number(value.scores.red) || 0),
      yellow: Math.max(0, Number(value.scores.yellow) || 0),
      draws: Math.max(0, Number(value.scores.draws) || 0),
    },
  };
}

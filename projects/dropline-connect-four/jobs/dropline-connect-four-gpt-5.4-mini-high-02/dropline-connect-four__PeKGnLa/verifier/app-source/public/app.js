const seed = await fetch('/assets/dropline_seed.json').then(r => r.json());
const STORAGE_KEY = seed.storageKey;
const rows = seed.rows;
const columns = seed.columns;
const players = Object.fromEntries(seed.players.map(p => [p.id, p]));
const boardEl = document.getElementById('board');
const controlsEl = document.getElementById('column-controls');
const historyEl = document.getElementById('history');
const statusEl = document.getElementById('status');
const feedbackEl = document.getElementById('feedback');
const redWinsEl = document.getElementById('red-wins');
const yellowWinsEl = document.getElementById('yellow-wins');
const drawsEl = document.getElementById('draws');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const nextRoundBtn = document.getElementById('next-round-btn');
const resetBtn = document.getElementById('reset-btn');
let state = loadState();
let boardCells = [];
let columnButtons = [];
let previewColumn = null;
function createInitialState() {
  return { version: seed.version, board: Array(rows * columns).fill(null), currentPlayer: seed.firstStarter, roundStarter: seed.firstStarter, roundStatus: 'active', winningCells: [], history: [], redo: [], scores: { red: 0, yellow: 0, draws: 0 }, invalidMessage: '' };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    return { ...createInitialState(), ...parsed, board: Array(rows * columns).fill(null).map((_, i) => parsed.board?.[i] ?? null), scores: { ...createInitialState().scores, ...(parsed.scores || {}) }, history: Array.isArray(parsed.history) ? parsed.history : [], redo: Array.isArray(parsed.redo) ? parsed.redo : [], winningCells: Array.isArray(parsed.winningCells) ? parsed.winningCells : [] };
  } catch {
    return createInitialState();
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function idx(row, col) { return row * columns + col; }
function getDropRow(col) { for (let row = rows - 1; row >= 0; row--) if (!state.board[idx(row, col)]) return row; return -1; }
function cellLabel(row, col, value) { return `Row ${row + 1}, Column ${col + 1}, ${value ? players[value].name : 'empty'}`; }
function currentPlayer() { return players[state.currentPlayer]; }
function renderBoard() {
  if (!boardCells.length) {
    boardEl.innerHTML = '';
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.setAttribute('role', 'gridcell');
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.addEventListener('click', () => dropInColumn(col));
        cell.addEventListener('focus', () => setPreview(col));
        cell.addEventListener('blur', clearPreview);
        boardEl.appendChild(cell);
        boardCells.push(cell);
      }
    }
  }
  boardCells.forEach((cell, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const value = state.board[index];
    cell.className = `cell ${value || ''} ${state.winningCells.includes(index) ? 'winner' : ''}`.trim();
    cell.textContent = value ? players[value].marker : '';
    cell.setAttribute('aria-label', cellLabel(row, col, value));
  });
}
function renderControls() {
  if (!columnButtons.length) {
    controlsEl.innerHTML = '';
    for (let col = 0; col < columns; col++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `Column ${col + 1}`;
      button.dataset.col = col;
      button.addEventListener('click', () => dropInColumn(col));
      button.addEventListener('focus', () => setPreview(col));
      button.addEventListener('blur', clearPreview);
      button.addEventListener('keydown', handleColumnKeydown);
      controlsEl.appendChild(button);
      columnButtons.push(button);
    }
  }
  columnButtons.forEach((button, col) => {
    button.disabled = state.roundStatus !== 'active' || getDropRow(col) === -1;
    button.setAttribute('aria-pressed', String(previewColumn === col));
  });
}
function renderMeta() {
  redWinsEl.textContent = state.scores.red;
  yellowWinsEl.textContent = state.scores.yellow;
  drawsEl.textContent = state.scores.draws;
  const turnText = state.roundStatus === 'active' ? `${currentPlayer().name}'s turn` : state.roundStatus === 'won' ? `${players[winnerPlayer()].name} wins the round` : 'Round drawn';
  statusEl.textContent = `${turnText}. Starter: ${players[state.roundStarter].name}.`;
  feedbackEl.textContent = state.invalidMessage;
  undoBtn.disabled = state.history.length === 0;
  redoBtn.disabled = state.redo.length === 0;
  nextRoundBtn.disabled = state.roundStatus === 'active';
}
function renderHistory() {
  historyEl.innerHTML = '';
  state.history.forEach(move => {
    const item = document.createElement('li');
    item.textContent = `${move.number}. ${players[move.player].name} - Column ${move.column + 1}`;
    historyEl.appendChild(item);
  });
}
function render() {
  renderBoard();
  renderControls();
  renderMeta();
  renderHistory();
  saveState();
}
function setPreview(col) {
  previewColumn = col;
  document.body.classList.toggle('preview-red', state.currentPlayer === 'red');
  document.body.classList.toggle('preview-yellow', state.currentPlayer === 'yellow');
}
function clearPreview() {
  previewColumn = null;
  document.body.classList.remove('preview-red', 'preview-yellow');
}
function checkWinner(row, col) {
  const player = state.board[idx(row, col)];
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dr, dc] of directions) {
    const line = [[row, col]];
    for (const step of [1, -1]) {
      let r = row + dr * step;
      let c = col + dc * step;
      while (r >= 0 && r < rows && c >= 0 && c < columns && state.board[idx(r, c)] === player) {
        line.push([r, c]);
        r += dr * step;
        c += dc * step;
      }
    }
    if (line.length >= 4) return line.slice(0, 4).map(([r, c]) => idx(r, c));
  }
  return null;
}
function isDraw() { return state.board.every(Boolean); }
function winnerPlayer() { return state.history.at(-1)?.player; }
function finishRound(kind, winningCells = []) {
  state.roundStatus = kind;
  state.winningCells = winningCells;
  if (kind === 'won') state.scores[state.currentPlayer] += 1;
  if (kind === 'draw') state.scores.draws += 1;
}
function dropInColumn(col) {
  state.invalidMessage = '';
  if (state.roundStatus !== 'active') {
    state.invalidMessage = 'Round complete. Use Undo, Next Round, or Reset Match.';
    renderMeta();
    saveState();
    return;
  }
  const row = getDropRow(col);
  if (row === -1) {
    state.invalidMessage = 'That column is full.';
    renderMeta();
    saveState();
    return;
  }
  const player = state.currentPlayer;
  state.board[idx(row, col)] = player;
  state.history.push({ number: state.history.length + 1, player, column: col, row });
  state.redo = [];
  const win = checkWinner(row, col);
  if (win) finishRound('won', win);
  else if (isDraw()) finishRound('draw', []);
  else state.currentPlayer = player === 'red' ? 'yellow' : 'red';
  render();
  columnButtons[col]?.focus();
}
function undo() {
  const move = state.history.pop();
  if (!move) return;
  state.board[idx(move.row, move.column)] = null;
  state.redo.push(move);
  state.currentPlayer = move.player;
  state.invalidMessage = '';
  state.roundStatus = 'active';
  state.winningCells = [];
  if (state.history.length) {
    const last = state.history.at(-1);
    const win = checkWinner(last.row, last.column);
    if (win && state.history.length >= 4) {
      state.roundStatus = 'won';
      state.winningCells = win;
    } else if (isDraw()) {
      state.roundStatus = 'draw';
    }
  }
  render();
  columnButtons[move.column]?.focus();
}
function redo() {
  const move = state.redo.pop();
  if (!move) return;
  state.currentPlayer = move.player;
  state.board[idx(move.row, move.column)] = move.player;
  state.history.push(move);
  state.invalidMessage = '';
  const win = checkWinner(move.row, move.column);
  if (win) finishRound('won', win);
  else if (isDraw()) finishRound('draw', []);
  else state.currentPlayer = move.player === 'red' ? 'yellow' : 'red';
  render();
  columnButtons[move.column]?.focus();
}
function nextRound() {
  if (state.roundStatus === 'active') return;
  state.roundStarter = state.roundStarter === 'red' ? 'yellow' : 'red';
  state.currentPlayer = state.roundStarter;
  state.roundStatus = 'active';
  state.board = Array(rows * columns).fill(null);
  state.history = [];
  state.redo = [];
  state.winningCells = [];
  state.invalidMessage = '';
  render();
}
function resetMatch() {
  state = createInitialState();
  previewColumn = null;
  render();
}
function handleColumnKeydown(event) {
  const col = Number(event.currentTarget.dataset.col);
  let next = col;
  if (event.key === 'ArrowLeft') next = Math.max(0, col - 1);
  else if (event.key === 'ArrowRight') next = Math.min(columns - 1, col + 1);
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = columns - 1;
  else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    dropInColumn(col);
    return;
  } else {
    return;
  }
  event.preventDefault();
  columnButtons[next]?.focus();
}
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);
nextRoundBtn.addEventListener('click', nextRound);
resetBtn.addEventListener('click', resetMatch);
render();

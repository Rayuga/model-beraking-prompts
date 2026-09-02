const loginView = document.getElementById('auth-view');
const gameView = document.getElementById('game-view');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginFeedback = document.getElementById('login-feedback');
const signedInName = document.getElementById('signed-in-name');
const signedInEmail = document.getElementById('signed-in-email');
const signOutButton = document.getElementById('sign-out-button');
const statusText = document.getElementById('game-status');
const feedbackText = document.getElementById('game-feedback');
const columnControls = document.getElementById('column-controls');
const boardGrid = document.getElementById('board-grid');
const redWinsEl = document.getElementById('red-wins');
const yellowWinsEl = document.getElementById('yellow-wins');
const drawsEl = document.getElementById('draws');
const newGameButton = document.getElementById('new-game-button');
const undoButton = document.getElementById('undo-button');
const redoButton = document.getElementById('redo-button');
const moveHistory = document.getElementById('move-history');

const BOARD_COLUMNS = 7;
const BOARD_ROWS = 6;
const TOKEN_KEY = 'dropline.authToken';

let authToken = localStorage.getItem(TOKEN_KEY) || '';
let currentState = null;
let isBusy = false;
let firstRenderDone = false;
const boardCells = [];
const columnButtons = [];

function createBoard() {
  boardGrid.replaceChildren();
  boardCells.length = 0;
  for (let index = 0; index < BOARD_COLUMNS * BOARD_ROWS; index += 1) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `Row ${Math.floor(index / BOARD_COLUMNS) + 1}, Column ${(index % BOARD_COLUMNS) + 1}, empty`);
    boardGrid.appendChild(cell);
    boardCells.push(cell);
  }
}

function createColumnControls() {
  columnControls.replaceChildren();
  columnButtons.length = 0;
  for (let column = 1; column <= BOARD_COLUMNS; column += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button';
    button.textContent = `Drop in column ${column}`;
    button.dataset.column = String(column);
    button.addEventListener('click', () => dropInColumn(column));
    button.addEventListener('keydown', (event) => handleColumnKeydown(event, column - 1));
    columnControls.appendChild(button);
    columnButtons.push(button);
  }
}

function handleColumnKeydown(event, index) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    const target = columnButtons[Math.max(0, index - 1)];
    if (target) target.focus();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    const target = columnButtons[Math.min(columnButtons.length - 1, index + 1)];
    if (target) target.focus();
  } else if (event.key === 'Home') {
    event.preventDefault();
    columnButtons[0]?.focus();
  } else if (event.key === 'End') {
    event.preventDefault();
    columnButtons[columnButtons.length - 1]?.focus();
  }
}

function setLoading(value) {
  isBusy = value;
  signOutButton.disabled = value || !authToken;
  newGameButton.disabled = value || !currentState;
  undoButton.disabled = value || !currentState || !currentState.canUndo;
  redoButton.disabled = value || !currentState || !currentState.canRedo;
  for (const button of columnButtons) {
    button.disabled = value || !currentState || currentState.status !== 'active';
  }
}

function showLogin(message = '') {
  loginView.hidden = false;
  gameView.hidden = true;
  loginFeedback.textContent = message;
  if (!authToken) {
    loginEmail.focus();
  }
}

function showGame() {
  loginView.hidden = true;
  gameView.hidden = false;
}

function setToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function authHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: authHeaders(options.body ? { 'Content-Type': 'application/json' } : {}),
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error(payload.error || payload.message || 'Request failed');
    error.status = response.status;
    throw error;
  }

  return payload;
}

function updateStatusMessage(state) {
  statusText.textContent = state.statusMessage;
}

function updateTotals(state) {
  redWinsEl.textContent = String(state.totals.redWins);
  yellowWinsEl.textContent = String(state.totals.yellowWins);
  drawsEl.textContent = String(state.totals.draws);
}

function renderBoard(state) {
  const winningCells = new Set(state.winningCells || []);
  for (let index = 0; index < boardCells.length; index += 1) {
    const value = state.board[index];
    const row = Math.floor(index / BOARD_COLUMNS) + 1;
    const column = (index % BOARD_COLUMNS) + 1;
    const cell = boardCells[index];
    cell.className = 'cell';
    if (value === 'Red') {
      cell.classList.add('red');
    } else if (value === 'Yellow') {
      cell.classList.add('yellow');
    }
    if (winningCells.has(index)) {
      cell.classList.add('winning');
    }
    const label = `${value || 'empty'}`;
    cell.setAttribute('aria-label', `Row ${row}, Column ${column}, ${label}${winningCells.has(index) ? ', winning' : ''}`);
  }
}

function renderHistory(state) {
  moveHistory.replaceChildren();
  if (!state.appliedMoves.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-history';
    empty.textContent = 'No moves yet';
    moveHistory.appendChild(empty);
    return;
  }

  for (const move of state.appliedMoves) {
    const entry = document.createElement('li');
    entry.className = 'history-item';
    const heading = document.createElement('strong');
    heading.textContent = `Move ${move.moveNumber}: ${move.color}`;
    const detail = document.createElement('span');
    detail.textContent = `Column ${move.column}, row ${move.row}`;
    entry.append(heading, detail);
    moveHistory.appendChild(entry);
  }
}

function renderSession(state) {
  currentState = state;
  signedInName.textContent = state.account.name;
  signedInEmail.textContent = state.account.email;
  updateStatusMessage(state);
  feedbackText.textContent = '';
  updateTotals(state);
  renderBoard(state);
  renderHistory(state);
  setLoading(false);
  showGame();

  if (!firstRenderDone || document.activeElement === document.body) {
    const target = state.status === 'active'
      ? columnButtons[0]
      : (state.canUndo ? undoButton : newGameButton);
    target?.focus();
  }
  firstRenderDone = true;
}

function renderLoggedOut(message = '') {
  currentState = null;
  feedbackText.textContent = '';
  setLoading(false);
  showLogin(message);
  loginPassword.value = '';
}

async function loadCurrentSession() {
  if (!authToken) {
    renderLoggedOut('');
    return;
  }

  setLoading(true);
  try {
    const state = await requestJson('/api/state');
    renderSession(state);
  } catch (error) {
    setToken('');
    renderLoggedOut(error.status === 401 ? 'Your session expired. Please sign in again.' : error.message);
  }
}

async function signIn(event) {
  event.preventDefault();
  loginFeedback.textContent = '';
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    loginFeedback.textContent = 'Please enter both email and password.';
    return;
  }

  setLoading(true);
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to sign in');
    }

    setToken(payload.token);
    loginFeedback.textContent = '';
    loginPassword.value = '';
    renderSession(payload.state);
  } catch (error) {
    setToken('');
    renderLoggedOut('');
    loginFeedback.textContent = error.message;
  } finally {
    setLoading(false);
  }
}

async function signOut() {
  if (!authToken) {
    renderLoggedOut('');
    return;
  }

  setLoading(true);
  try {
    await requestJson('/api/logout', { method: 'POST', body: {} });
  } catch {
    // Token may already be revoked; either way, leave the app signed out.
  } finally {
    setToken('');
    renderLoggedOut('');
  }
}

async function performAction(path, body = {}) {
  if (isBusy || !authToken) {
    return;
  }
  setLoading(true);
  feedbackText.textContent = '';
  try {
    const payload = await requestJson(path, { method: 'POST', body });
    renderSession(payload);
  } catch (error) {
    if (error.status === 401) {
      setToken('');
      renderLoggedOut('Your session expired. Please sign in again.');
      return;
    }
    feedbackText.textContent = error.message;
    setLoading(false);
  }
}

function dropInColumn(column) {
  performAction('/api/move', { column });
}

newGameButton.addEventListener('click', () => performAction('/api/new-game'));
undoButton.addEventListener('click', () => performAction('/api/undo'));
redoButton.addEventListener('click', () => performAction('/api/redo'));
signOutButton.addEventListener('click', signOut);
loginForm.addEventListener('submit', signIn);

createBoard();
createColumnControls();
setLoading(Boolean(authToken));
loadCurrentSession();

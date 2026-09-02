const state = {
  token: localStorage.getItem('droplineToken') || '',
  loading: false,
};

const authScreen = document.getElementById('authScreen');
const gameScreen = document.getElementById('gameScreen');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const authFeedback = document.getElementById('authFeedback');
const accountBadge = document.getElementById('accountBadge');
const statusText = document.getElementById('statusText');
const turnHint = document.getElementById('turnHint');
const redWinsValue = document.getElementById('redWinsValue');
const yellowWinsValue = document.getElementById('yellowWinsValue');
const drawsValue = document.getElementById('drawsValue');
const columnControls = document.getElementById('columnControls');
const board = document.getElementById('board');
const gameFeedback = document.getElementById('gameFeedback');
const newGameButton = document.getElementById('newGameButton');
const undoButton = document.getElementById('undoButton');
const redoButton = document.getElementById('redoButton');
const signOutButton = document.getElementById('signOutButton');
const historyList = document.getElementById('historyList');
const availabilityText = document.getElementById('availabilityText');

let columnButtons = [];
let boardCells = [];

function setFeedback(element, message) {
  element.textContent = message || '';
}

function ensureBoardCells() {
  if (boardCells.length) {
    return;
  }
  board.innerHTML = '';
  for (let index = 0; index < 42; index += 1) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', 'Row 1, Column 1, empty');
    cell.dataset.state = 'empty';
    board.appendChild(cell);
    boardCells.push(cell);
  }
}

function ensureColumnControls() {
  if (columnButtons.length) {
    return;
  }
  columnControls.innerHTML = '';
  for (let column = 1; column <= 7; column += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `Drop in column ${column}`;
    button.dataset.column = String(column);
    button.addEventListener('click', () => dropColumn(column));
    button.addEventListener('keydown', handleColumnKeydown);
    columnControls.appendChild(button);
    columnButtons.push(button);
  }
}

function handleColumnKeydown(event) {
  const index = columnButtons.indexOf(event.currentTarget);
  if (index === -1) {
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    columnButtons[Math.max(0, index - 1)].focus();
    return;
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    columnButtons[Math.min(columnButtons.length - 1, index + 1)].focus();
    return;
  }

  if (event.key === 'Home') {
    event.preventDefault();
    columnButtons[0].focus();
    return;
  }

  if (event.key === 'End') {
    event.preventDefault();
    columnButtons[columnButtons.length - 1].focus();
    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    dropColumn(index + 1);
  }
}

function cellLabel(row, column, cellState, winning) {
  let label = `Row ${row}, Column ${column}, ${cellState}`;
  if (winning) {
    label += ', winning';
  }
  return label;
}

function renderBoard(session) {
  ensureBoardCells();
  const winningSet = new Set(session.winningCells || []);
  for (let index = 0; index < boardCells.length; index += 1) {
    const cell = boardCells[index];
    const row = Math.floor(index / 7) + 1;
    const column = (index % 7) + 1;
    const cellState = session.board[index] || 'empty';
    const winning = winningSet.has(index);
    cell.dataset.state = cellState;
    cell.dataset.winning = winning ? 'true' : 'false';
    cell.setAttribute('aria-label', cellLabel(row, column, cellState, winning));
  }
}

function renderHistory(history) {
  historyList.innerHTML = '';
  if (!history.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No moves yet.';
    historyList.appendChild(empty);
    return;
  }

  for (const move of history) {
    const item = document.createElement('li');
    item.textContent = `${move.moveNumber}. ${move.color} — column ${move.column}, row ${move.row}`;
    historyList.appendChild(item);
  }
}

function setColumnControlsDisabled(disabled) {
  ensureColumnControls();
  for (const button of columnButtons) {
    button.disabled = disabled;
  }
}

function setSignedOut() {
  authScreen.classList.remove('hidden');
  gameScreen.classList.add('hidden');
  accountBadge.hidden = true;
  setFeedback(authFeedback, '');
  setFeedback(gameFeedback, '');
  loginForm.reset();
  passwordInput.focus();
}

function setSignedIn(session) {
  authScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  accountBadge.hidden = false;
  accountBadge.textContent = `Signed in as ${session.account.name} · ${session.account.email}`;
  renderSession(session);
}

function renderSession(session) {
  setFeedback(gameFeedback, session.feedback || '');
  statusText.textContent = session.statusText;
  turnHint.textContent = session.status === 'active'
    ? 'Drop a disc into any column.'
    : 'Use New game, Undo, or Redo to continue exploring the saved round.';
  redWinsValue.textContent = String(session.totals.redWins);
  yellowWinsValue.textContent = String(session.totals.yellowWins);
  drawsValue.textContent = String(session.totals.draws);
  renderBoard(session);
  renderHistory(session.history);
  undoButton.disabled = !session.canUndo;
  redoButton.disabled = !session.canRedo;
  newGameButton.disabled = false;
  signOutButton.disabled = false;
  setColumnControlsDisabled(session.status !== 'active');
  availabilityText.textContent = [
    session.canUndo ? 'Undo available' : 'Nothing to undo',
    session.canRedo ? 'Redo available' : 'Nothing to redo',
  ].join(' · ');
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.token) {
    headers.set('Authorization', `Bearer ${state.token}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = payload.error || 'Unexpected request failure.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function bootstrap() {
  ensureBoardCells();
  ensureColumnControls();

  if (!state.token) {
    setSignedOut();
    return;
  }

  try {
    const payload = await request('/api/bootstrap');
    state.token = payload.token || state.token;
    localStorage.setItem('droplineToken', state.token);
    setSignedIn(payload);
  } catch {
    state.token = '';
    localStorage.removeItem('droplineToken');
    setSignedOut();
    setFeedback(authFeedback, 'Your session expired. Please sign in again.');
  }
}

async function submitLogin(event) {
  event.preventDefault();
  setFeedback(authFeedback, '');
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    setFeedback(authFeedback, 'Enter both email and password.');
    return;
  }

  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const payload = await request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    state.token = payload.token;
    localStorage.setItem('droplineToken', state.token);
    setSignedIn(payload);
  } catch (error) {
    setFeedback(authFeedback, error.message);
  } finally {
    submitButton.disabled = false;
  }
}

async function performAction(path, body = {}) {
  if (state.loading) {
    return;
  }
  state.loading = true;
  setFeedback(gameFeedback, '');
  try {
    const payload = await request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setSignedIn(payload);
  } catch (error) {
    setFeedback(gameFeedback, error.message);
  } finally {
    state.loading = false;
  }
}

function dropColumn(column) {
  performAction('/api/move', { column });
}

loginForm.addEventListener('submit', submitLogin);
newGameButton.addEventListener('click', () => performAction('/api/new-game'));
undoButton.addEventListener('click', () => performAction('/api/undo'));
redoButton.addEventListener('click', () => performAction('/api/redo'));
signOutButton.addEventListener('click', async () => {
  if (state.loading) {
    return;
  }
  try {
    await request('/api/logout', { method: 'POST', body: '{}' });
  } catch {
    // Clear the local token even if the server already revoked it.
  } finally {
    state.token = '';
    localStorage.removeItem('droplineToken');
    setSignedOut();
  }
});

ensureBoardCells();
ensureColumnControls();
bootstrap();

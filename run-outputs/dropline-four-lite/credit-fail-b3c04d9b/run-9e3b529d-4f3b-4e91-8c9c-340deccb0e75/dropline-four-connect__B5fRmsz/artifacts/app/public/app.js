const BOARD_WIDTH = 7;
const BOARD_HEIGHT = 6;
const BOARD_SIZE = BOARD_WIDTH * BOARD_HEIGHT;

const appState = {
  token: localStorage.getItem('droplineToken') || '',
  state: null,
  pending: false,
  pendingColumn: null,
  replay: {
    match: null,
    step: 0,
    opener: null,
  },
};

const dom = {
  headerChip: document.getElementById('headerChip'),
  signInView: document.getElementById('signInView'),
  gameView: document.getElementById('gameView'),
  signInForm: document.getElementById('signInForm'),
  emailInput: document.getElementById('emailInput'),
  passwordInput: document.getElementById('passwordInput'),
  signInFeedback: document.getElementById('signInFeedback'),
  accountName: document.getElementById('accountName'),
  accountEmail: document.getElementById('accountEmail'),
  turnLabel: document.getElementById('turnLabel'),
  revisionLabel: document.getElementById('revisionLabel'),
  roundLabel: document.getElementById('roundLabel'),
  stateFeedback: document.getElementById('stateFeedback'),
  redWinsLabel: document.getElementById('redWinsLabel'),
  yellowWinsLabel: document.getElementById('yellowWinsLabel'),
  drawsLabel: document.getElementById('drawsLabel'),
  newGameButton: document.getElementById('newGameButton'),
  undoButton: document.getElementById('undoButton'),
  redoButton: document.getElementById('redoButton'),
  signOutButton: document.getElementById('signOutButton'),
  columnControls: document.getElementById('columnControls'),
  boardGrid: document.getElementById('boardGrid'),
  historyList: document.getElementById('historyList'),
  archiveSummary: document.getElementById('archiveSummary'),
  archiveList: document.getElementById('archiveList'),
  replayModal: document.getElementById('replayModal'),
  replayTitle: document.getElementById('replayTitle'),
  replayMeta: document.getElementById('replayMeta'),
  replayBoard: document.getElementById('replayBoard'),
  replayRange: document.getElementById('replayRange'),
  replayStepLabel: document.getElementById('replayStepLabel'),
  replayPreviousButton: document.getElementById('replayPreviousButton'),
  replayNextButton: document.getElementById('replayNextButton'),
  closeReplayButton: document.getElementById('closeReplayButton'),
};

function boardIndex(row, column) {
  return (row - 1) * BOARD_WIDTH + (column - 1);
}

function cellState(board, index) {
  const value = board[index];
  return value === null || value === '' ? 'empty' : value;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function escapeText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function focusColumnButton(column) {
  const button = dom.columnControls.querySelector(`[data-column="${column}"]`);
  if (button) {
    button.focus();
  }
}

function setAuthMessage(message = '') {
  dom.signInFeedback.textContent = message;
}

function setStateMessage(message = '') {
  if (appState.state) {
    appState.state.feedback = message;
  }
  dom.stateFeedback.textContent = message;
}

function setPending(nextPending, column = null) {
  appState.pending = nextPending;
  appState.pendingColumn = column;
  syncButtonStates();
}

function syncButtonStates() {
  const hasState = Boolean(appState.state);
  const hasUndo = hasState && appState.state.appliedHistory.length > 0;
  const hasRedo = hasState && appState.state.redoHistory.length > 0;
  const terminal = hasState && appState.state.status === 'terminal';

  dom.newGameButton.disabled = !hasState || appState.pending;
  dom.undoButton.disabled = !hasUndo || appState.pending;
  dom.redoButton.disabled = !hasRedo || appState.pending;
  dom.signOutButton.disabled = !hasState || appState.pending;

  for (const button of dom.columnControls.querySelectorAll('button[data-column]')) {
    button.disabled = !hasState || appState.pending;
    button.setAttribute('aria-disabled', terminal ? 'true' : 'false');
  }

  dom.replayPreviousButton.disabled = !appState.replay.match || appState.replay.step <= 0;
  dom.replayNextButton.disabled = !appState.replay.match || appState.replay.step >= (appState.replay.match ? appState.replay.match.moves.length : 0);
  dom.replayRange.disabled = !appState.replay.match;
}

function renderColumnControls() {
  dom.columnControls.replaceChildren();
  for (let column = 1; column <= BOARD_WIDTH; column += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'column-button';
    button.dataset.column = String(column);
    button.innerHTML = `<span>Drop in</span><span>column ${column}</span>`;
    button.setAttribute('aria-label', `Drop in column ${column}`);
    button.addEventListener('click', () => {
      dropPiece(column, button);
    });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (column > 1) {
          focusColumnButton(column - 1);
        }
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (column < BOARD_WIDTH) {
          focusColumnButton(column + 1);
        }
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        focusColumnButton(1);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        focusColumnButton(BOARD_WIDTH);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        dropPiece(column, button);
      }
    });
    dom.columnControls.appendChild(button);
  }
}

function renderBoardCells(container, board, winningCells = [], labelPrefix = '') {
  container.replaceChildren();
  for (let row = 1; row <= BOARD_HEIGHT; row += 1) {
    for (let column = 1; column <= BOARD_WIDTH; column += 1) {
      const index = boardIndex(row, column);
      const value = cellState(board, index);
      const isWinning = winningCells.includes(index);
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('role', 'gridcell');
      if (isWinning) {
        cell.classList.add('winning');
      }
      const prefix = labelPrefix ? `${labelPrefix} ` : '';
      cell.setAttribute(
        'aria-label',
        `${prefix}row ${row}, column ${column}, ${value}${isWinning ? ', winning' : ''}`,
      );
      const piece = document.createElement('span');
      piece.className = 'piece';
      if (value === 'Red') {
        piece.classList.add('red');
      } else if (value === 'Yellow') {
        piece.classList.add('yellow');
      }
      cell.appendChild(piece);
      container.appendChild(cell);
    }
  }
}

function renderHistory(history) {
  dom.historyList.replaceChildren();
  if (!history.length) {
    const item = document.createElement('li');
    item.textContent = 'No moves yet.';
    dom.historyList.appendChild(item);
    return;
  }
  history.forEach((move, index) => {
    const item = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'history-row';
    const meta = document.createElement('div');
    meta.className = 'history-meta';
    const title = document.createElement('div');
    title.className = 'history-title';
    title.textContent = `Move ${index + 1}: ${move.color}, column ${move.column}, row ${move.row}`;
    const detail = document.createElement('div');
    detail.textContent = `Landing cell index ${move.index + 1}`;
    meta.append(title, detail);
    row.appendChild(meta);
    item.appendChild(row);
    dom.historyList.appendChild(item);
  });
}

function renderArchive(archive) {
  dom.archiveSummary.textContent = `${archive.count} archived match${archive.count === 1 ? '' : 'es'}. Latest ten are shown first.`;
  dom.archiveList.replaceChildren();
  if (!archive.latest.length) {
    const empty = document.createElement('div');
    empty.className = 'archive-item';
    empty.textContent = 'No completed matches yet.';
    dom.archiveList.appendChild(empty);
    return;
  }

  archive.latest.forEach((match) => {
    const item = document.createElement('div');
    item.className = 'archive-item';
    const row = document.createElement('div');
    row.className = 'archive-row';

    const meta = document.createElement('div');
    meta.className = 'archive-meta';
    const title = document.createElement('div');
    title.className = 'archive-title';
    title.textContent = `${match.matchId} · ${match.result} · ${match.moveCount} move${match.moveCount === 1 ? '' : 's'}`;
    const detail = document.createElement('div');
    detail.textContent = formatDate(match.completedAt);
    meta.append(title, detail);

    const actions = document.createElement('div');
    actions.className = 'archive-actions';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'archive-button';
    button.textContent = 'Open replay';
    button.addEventListener('click', () => {
      openReplay(match.matchId, button);
    });
    actions.appendChild(button);

    row.append(meta, actions);
    item.appendChild(row);
    dom.archiveList.appendChild(item);
  });
}

function renderGameState(state) {
  dom.signInView.hidden = true;
  dom.gameView.hidden = false;
  dom.accountName.textContent = state.account.name;
  dom.accountEmail.textContent = state.account.email;
  dom.headerChip.textContent = `Revision ${state.revision} · Round ${state.roundId}`;
  dom.turnLabel.textContent = state.currentTurnLabel;
  dom.revisionLabel.textContent = String(state.revision);
  dom.roundLabel.textContent = state.roundId;
  dom.redWinsLabel.textContent = String(state.totals.redWins);
  dom.yellowWinsLabel.textContent = String(state.totals.yellowWins);
  dom.drawsLabel.textContent = String(state.totals.draws);
  setStateMessage(state.feedback || '');
  dom.newGameButton.disabled = appState.pending;
  dom.undoButton.disabled = appState.pending || state.appliedHistory.length === 0;
  dom.redoButton.disabled = appState.pending || state.redoHistory.length === 0;
  dom.signOutButton.disabled = appState.pending;
  renderBoardCells(dom.boardGrid, state.board, state.winningCells || [], '');
  renderHistory(state.appliedHistory);
  renderArchive(state.archive);
  syncButtonStates();
}

function showSignIn(message = '') {
  dom.signInView.hidden = false;
  dom.gameView.hidden = true;
  dom.headerChip.textContent = 'Sign in to continue';
  setAuthMessage(message);
  dom.passwordInput.value = '';
  dom.signInForm.querySelector('button[type="submit"]').disabled = false;
  window.requestAnimationFrame(() => dom.emailInput.focus());
}

async function apiRequest(path, { method = 'GET', body = null, auth = true } = {}) {
  const headers = {
    Accept: 'application/json',
  };
  if (body !== null) {
    headers['Content-Type'] = 'application/json';
  }
  if (auth && appState.token) {
    headers.Authorization = `Bearer ${appState.token}`;
  }

  try {
    const response = await fetch(path, {
      method,
      headers,
      body: body === null ? undefined : JSON.stringify(body),
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (response.status === 401 && auth) {
      handleUnauthorized();
    }
    return { response, data };
  } catch {
    return {
      response: { ok: false, status: 0 },
      data: { message: 'Unable to reach the server.' },
    };
  }
}

function handleUnauthorized(message = 'Your session ended. Please sign in again.') {
  localStorage.removeItem('droplineToken');
  appState.token = '';
  appState.state = null;
  appState.pending = false;
  appState.pendingColumn = null;
  appState.replay.match = null;
  appState.replay.step = 0;
  appState.replay.opener = null;
  dom.replayModal.hidden = true;
  renderColumnControls();
  showSignIn(message);
}

function applyState(state) {
  appState.state = state;
  if (appState.token) {
    localStorage.setItem('droplineToken', appState.token);
  }
  renderGameState(state);
}

async function loadState() {
  if (!appState.token) {
    showSignIn();
    renderColumnControls();
    syncButtonStates();
    return;
  }
  setAuthMessage('Restoring your saved game...');
  const { response, data } = await apiRequest('/api/state');
  if (!response.ok) {
    if (response.status !== 401) {
      setAuthMessage(data.message || 'Unable to restore the game.');
    }
    return;
  }
  applyState(data.state);
}

async function signIn(event) {
  event.preventDefault();
  const email = dom.emailInput.value.trim();
  const password = dom.passwordInput.value;
  setAuthMessage('Signing in...');
  dom.signInForm.querySelector('button[type="submit"]').disabled = true;
  const { response, data } = await apiRequest('/api/sign-in', {
    method: 'POST',
    auth: false,
    body: { email, password },
  });
  dom.signInForm.querySelector('button[type="submit"]').disabled = false;
  if (!response.ok) {
    showSignIn(data.message || 'Sign-in failed.');
    return;
  }
  appState.token = data.token;
  localStorage.setItem('droplineToken', data.token);
  appState.replay.match = null;
  appState.replay.step = 0;
  applyState(data.state);
  dom.passwordInput.value = '';
}

async function signOut() {
  if (!appState.token || appState.pending) {
    return;
  }
  setPending(true);
  const { response, data } = await apiRequest('/api/sign-out', { method: 'POST' });
  setPending(false);
  if (response.status === 401) {
    return;
  }
  if (response.ok) {
    handleUnauthorized('You signed out successfully.');
    return;
  }
  setStateMessage(data.message || 'Unable to sign out right now.');
}

async function submitMutation(path, payload, focusColumn = null) {
  if (!appState.state || appState.pending) {
    return;
  }
  const nextPayload = {
    ...payload,
    expectedRevision: appState.state.revision,
    operationId: crypto.randomUUID(),
  };
  setPending(true, focusColumn);
  const { response, data } = await apiRequest(path, {
    method: 'POST',
    body: nextPayload,
  });
  setPending(false, null);

  if (response.status === 401) {
    return;
  }

  if (data.state) {
    applyState(data.state);
  }

  if (!response.ok) {
    if (data.message) {
      setStateMessage(data.message);
    }
  } else {
    setStateMessage(data.state?.feedback || '');
  }

  if (focusColumn !== null) {
    window.requestAnimationFrame(() => {
      focusColumnButton(focusColumn);
    });
  }
}

async function dropPiece(column, button) {
  await submitMutation('/api/move', { column }, column);
  if (button && appState.state && appState.state.status === 'active') {
    window.requestAnimationFrame(() => button.focus());
  }
}

async function newGame() {
  await submitMutation('/api/new-game', {});
}

async function undoMove() {
  await submitMutation('/api/undo', {});
}

async function redoMove() {
  await submitMutation('/api/redo', {});
}

function replayBoardAtStep(match, step) {
  const board = Array.from({ length: BOARD_SIZE }, () => null);
  for (let index = 0; index < step; index += 1) {
    const move = match.moves[index];
    board[move.index] = move.color;
  }
  return board;
}

function renderReplay(match, step) {
  const safeStep = Math.max(0, Math.min(step, match.moves.length));
  const board = replayBoardAtStep(match, safeStep);
  const winningCells = safeStep === match.moves.length ? (match.winningCells || []) : [];
  dom.replayTitle.textContent = match.matchId;
  dom.replayMeta.textContent = `${match.result} · ${match.moveCount} move${match.moveCount === 1 ? '' : 's'} · ${formatDate(match.completedAt)}`;
  dom.replayRange.min = '0';
  dom.replayRange.max = String(match.moves.length);
  dom.replayRange.value = String(safeStep);
  dom.replayStepLabel.textContent =
    safeStep === 0 ? 'Empty step' : `Step ${safeStep} of ${match.moves.length}`;
  renderBoardCells(dom.replayBoard, board, winningCells, 'Replay');
  dom.replayPreviousButton.disabled = safeStep <= 0;
  dom.replayNextButton.disabled = safeStep >= match.moves.length;
}

function openReplay(matchId, opener) {
  if (!appState.token || appState.pending) {
    return;
  }
  dom.archiveSummary.textContent = dom.archiveSummary.textContent;
  apiRequest(`/api/archive/${encodeURIComponent(matchId)}`)
    .then(({ response, data }) => {
      if (response.status === 401) {
        return;
      }
      if (!response.ok) {
        setStateMessage(data.message || 'Unable to load the replay.');
        return;
      }
      appState.replay.match = data.match;
      appState.replay.step = data.match.moves.length;
      appState.replay.opener = opener || null;
      dom.replayModal.hidden = false;
      renderReplay(data.match, appState.replay.step);
      syncButtonStates();
      window.setTimeout(() => dom.closeReplayButton.focus(), 0);
    })
    .catch(() => {
      setStateMessage('Unable to load the replay.');
    });
}

function closeReplay() {
  dom.replayModal.hidden = true;
  const opener = appState.replay.opener;
  appState.replay.match = null;
  appState.replay.step = 0;
  appState.replay.opener = null;
  syncButtonStates();
  if (opener && typeof opener.focus === 'function') {
    opener.focus();
  }
}

function adjustReplayStep(delta) {
  if (!appState.replay.match) {
    return;
  }
  const nextStep = Math.max(0, Math.min(appState.replay.match.moves.length, appState.replay.step + delta));
  appState.replay.step = nextStep;
  renderReplay(appState.replay.match, nextStep);
}

function wireEvents() {
  dom.signInForm.addEventListener('submit', signIn);
  dom.signOutButton.addEventListener('click', signOut);
  dom.newGameButton.addEventListener('click', newGame);
  dom.undoButton.addEventListener('click', undoMove);
  dom.redoButton.addEventListener('click', redoMove);
  dom.replayPreviousButton.addEventListener('click', () => adjustReplayStep(-1));
  dom.replayNextButton.addEventListener('click', () => adjustReplayStep(1));
  dom.replayRange.addEventListener('input', () => {
    if (!appState.replay.match) {
      return;
    }
    appState.replay.step = Number(dom.replayRange.value);
    renderReplay(appState.replay.match, appState.replay.step);
  });
  dom.closeReplayButton.addEventListener('click', closeReplay);
  dom.replayModal.addEventListener('click', (event) => {
    if (event.target && event.target.dataset && event.target.dataset.closeModal === 'true') {
      closeReplay();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (!dom.replayModal.hidden && event.key === 'Escape') {
      event.preventDefault();
      closeReplay();
    }
  });
}

async function boot() {
  renderColumnControls();
  wireEvents();
  if (appState.token) {
    await loadState();
  } else {
    showSignIn();
    syncButtonStates();
  }
}

boot();

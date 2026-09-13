// Application State
let appState = {
  token: localStorage.getItem('auth_token'),
  playerName: localStorage.getItem('player_name'),
  playerEmail: localStorage.getItem('player_email'),
  gameState: null,
  pendingOperations: new Set(),
  currentArchiveMatchId: null,
  replayMoves: [],
  replayStep: 0,
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  if (appState.token) {
    await loadGameState();
  } else {
    showSignInScreen();
  }
});

function setupEventListeners() {
  // Sign in
  document.getElementById('signinForm').addEventListener('submit', handleSignIn);

  // Game controls
  document.getElementById('signOutBtn').addEventListener('click', handleSignOut);
  document.getElementById('newGameBtn').addEventListener('click', handleNewGame);
  document.getElementById('archiveBtn').addEventListener('click', handleArchiveClick);
  document.getElementById('undoBtn').addEventListener('click', handleUndo);
  document.getElementById('redoBtn').addEventListener('click', handleRedo);

  // Archive modal
  document.getElementById('closeArchiveBtn').addEventListener('click', closeArchiveModal);

  // Replay modal
  document.getElementById('closeReplayBtn').addEventListener('click', closeReplayModal);
  document.getElementById('replayStep').addEventListener('input', updateReplay);
  document.getElementById('replayPrevBtn').addEventListener('click', replayPrevious);
  document.getElementById('replayNextBtn').addEventListener('click', replayNext);

  // Generate board cells
  generateBoardCells();
  generateColumnControls();
  generateReplayBoard();
}

function generateBoardCells() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  for (let i = 0; i < 42; i++) {
    const cell = document.createElement('div');
    cell.className = 'board-cell';
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('data-index', i);
    board.appendChild(cell);
  }
}

function generateColumnControls() {
  const controls = document.getElementById('columnControls');
  controls.innerHTML = '';
  for (let col = 1; col <= 7; col++) {
    const btn = document.createElement('button');
    btn.className = 'column-btn';
    btn.textContent = `${col}`;
    btn.setAttribute('data-column', col);
    btn.setAttribute('aria-label', `Drop in column ${col}`);
    btn.addEventListener('click', () => makeMove(col));
    btn.addEventListener('keydown', handleColumnKeydown);
    controls.appendChild(btn);
  }
}

function generateReplayBoard() {
  const board = document.getElementById('replayBoard');
  board.innerHTML = '';
  for (let i = 0; i < 42; i++) {
    const cell = document.createElement('div');
    cell.className = 'replay-cell';
    cell.setAttribute('data-index', i);
    board.appendChild(cell);
  }
}

function handleColumnKeydown(e) {
  const column = parseInt(e.currentTarget.getAttribute('data-column'));
  const buttons = document.querySelectorAll('.column-btn');
  let newColumn = column;

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    newColumn = Math.max(1, column - 1);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    newColumn = Math.min(7, column + 1);
  } else if (e.key === 'Home') {
    e.preventDefault();
    newColumn = 1;
  } else if (e.key === 'End') {
    e.preventDefault();
    newColumn = 7;
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    makeMove(column);
    return;
  } else {
    return;
  }

  const newButton = document.querySelector(`.column-btn[data-column="${newColumn}"]`);
  if (newButton) {
    newButton.focus();
  }
}

async function handleSignIn(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('signinError');

  try {
    const response = await fetch('/api/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Invalid email or password');
    }

    const data = await response.json();
    appState.token = data.token;
    appState.playerName = data.name;
    appState.playerEmail = data.email;

    localStorage.setItem('auth_token', appState.token);
    localStorage.setItem('player_name', appState.playerName);
    localStorage.setItem('player_email', appState.playerEmail);

    errorDiv.classList.remove('show');
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';

    await loadGameState();
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.add('show');
  }
}

async function handleSignOut() {
  try {
    await fetch('/api/sign-out', {
      method: 'POST',
      headers: { Authorization: `Bearer ${appState.token}` },
    });
  } catch (error) {
    console.error('Sign out error:', error);
  }

  appState.token = null;
  appState.playerName = null;
  appState.playerEmail = null;
  appState.gameState = null;

  localStorage.removeItem('auth_token');
  localStorage.removeItem('player_name');
  localStorage.removeItem('player_email');

  showSignInScreen();
}

async function loadGameState() {
  try {
    const response = await fetch('/api/game', {
      method: 'GET',
      headers: { Authorization: `Bearer ${appState.token}` },
    });

    if (response.status === 401) {
      appState.token = null;
      localStorage.removeItem('auth_token');
      showSignInScreen();
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to load game state');
    }

    appState.gameState = await response.json();
    showGameScreen();
    updateUI();
  } catch (error) {
    console.error('Load game state error:', error);
    if (appState.token) {
      await handleSignOut();
    }
  }
}

function showSignInScreen() {
  document.getElementById('signinScreen').classList.add('active');
  document.getElementById('gameScreen').classList.remove('active');
  document.getElementById('email').focus();
}

function showGameScreen() {
  document.getElementById('signinScreen').classList.remove('active');
  document.getElementById('gameScreen').classList.add('active');
}

function updateUI() {
  const state = appState.gameState;

  // Update player info
  document.getElementById('playerName').textContent = appState.playerName;
  document.getElementById('playerEmail').textContent = appState.playerEmail;

  // Update status
  const statusEl = document.getElementById('gameStatus');
  statusEl.textContent = state.status || 'Red\'s turn';

  if (state.status.includes('wins')) {
    statusEl.className = state.status.includes('Red') ? 'status-red' : 'status-yellow';
  } else if (state.status === 'Draw') {
    statusEl.className = 'status-draw';
  } else {
    statusEl.className = state.currentPlayer === 'Red' ? 'status-red' : 'status-yellow';
  }

  // Update board
  updateBoard(state.board, state.winningCells);

  // Update stats
  document.getElementById('redWins').textContent = state.redWins;
  document.getElementById('yellowWins').textContent = state.yellowWins;
  document.getElementById('draws').textContent = state.draws;

  // Update move history
  updateMoveHistory(state.appliedHistory);

  // Update button states
  document.getElementById('undoBtn').disabled = state.appliedHistory.length === 0;
  document.getElementById('redoBtn').disabled = !state.redoHistory || state.redoHistory.length === 0;

  // Disable column buttons if game is terminal
  const isTerminal = state.status.includes('wins') || state.status === 'Draw';
  document.querySelectorAll('.column-btn').forEach(btn => {
    btn.disabled = isTerminal;
  });
}

function updateBoard(board, winningCells = []) {
  const cells = document.querySelectorAll('.board-cell');
  cells.forEach((cell, index) => {
    const piece = board[index];
    cell.className = 'board-cell';
    if (piece === 'Red') {
      cell.classList.add('red');
    } else if (piece === 'Yellow') {
      cell.classList.add('yellow');
    }
    if (winningCells && winningCells.includes(index)) {
      cell.classList.add('winning');
    }

    // Update accessibility
    const row = Math.floor(index / 7) + 1;
    const col = (index % 7) + 1;
    let state = piece === '' ? 'empty' : piece;
    if (winningCells && winningCells.includes(index)) {
      state += ' winning';
    }
    cell.setAttribute('aria-label', `Row ${row}, Column ${col}, ${state}`);
  });
}

function updateMoveHistory(moves) {
  const historyList = document.getElementById('historyList');
  if (!moves || moves.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No moves yet</div>';
    return;
  }

  historyList.innerHTML = moves
    .map(
      (move, idx) =>
        `<div class="history-item">${idx + 1}. ${move.color} → Column ${move.column_num}, Row ${move.row_num}</div>`
    )
    .join('');
}

async function makeMove(column) {
  if (appState.gameState.status !== 'active') {
    return;
  }

  const operationId = `move-${Date.now()}-${Math.random()}`;
  if (appState.pendingOperations.has(operationId)) {
    return;
  }

  appState.pendingOperations.add(operationId);

  try {
    const response = await fetch('/api/move', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${appState.token}`,
      },
      body: JSON.stringify({
        column,
        revision: appState.gameState.revision,
        operationId,
      }),
    });

    const data = await response.json();

    if (response.status === 409) {
      appState.gameState = data;
      updateUI();
      showGameUpdatedError();
      return;
    }

    if (data.error) {
      showGameUpdatedError(data.error);
      return;
    }

    appState.gameState = data;
    appState.gameState.appliedHistory = appState.gameState.appliedHistory || [];
    appState.gameState.redoHistory = [];
    updateUI();
  } catch (error) {
    console.error('Move error:', error);
  } finally {
    appState.pendingOperations.delete(operationId);
  }
}

async function handleUndo() {
  const operationId = `undo-${Date.now()}-${Math.random()}`;
  if (appState.pendingOperations.has(operationId)) {
    return;
  }

  appState.pendingOperations.add(operationId);

  try {
    const response = await fetch('/api/undo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${appState.token}`,
      },
      body: JSON.stringify({
        revision: appState.gameState.revision,
        operationId,
      }),
    });

    const data = await response.json();

    if (response.status === 409) {
      appState.gameState = data;
      updateUI();
      showGameUpdatedError();
      return;
    }

    if (data.error) {
      return;
    }

    appState.gameState = data;
    updateUI();
  } catch (error) {
    console.error('Undo error:', error);
  } finally {
    appState.pendingOperations.delete(operationId);
  }
}

async function handleRedo() {
  const operationId = `redo-${Date.now()}-${Math.random()}`;
  if (appState.pendingOperations.has(operationId)) {
    return;
  }

  appState.pendingOperations.add(operationId);

  try {
    const response = await fetch('/api/redo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${appState.token}`,
      },
      body: JSON.stringify({
        revision: appState.gameState.revision,
        operationId,
      }),
    });

    const data = await response.json();

    if (response.status === 409) {
      appState.gameState = data;
      updateUI();
      showGameUpdatedError();
      return;
    }

    if (data.error) {
      return;
    }

    appState.gameState = data;
    updateUI();
  } catch (error) {
    console.error('Redo error:', error);
  } finally {
    appState.pendingOperations.delete(operationId);
  }
}

async function handleNewGame() {
  const operationId = `newgame-${Date.now()}-${Math.random()}`;
  if (appState.pendingOperations.has(operationId)) {
    return;
  }

  appState.pendingOperations.add(operationId);

  try {
    const response = await fetch('/api/new-game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${appState.token}`,
      },
      body: JSON.stringify({
        revision: appState.gameState.revision,
        operationId,
      }),
    });

    const data = await response.json();

    if (response.status === 409) {
      appState.gameState = data;
      updateUI();
      showGameUpdatedError();
      return;
    }

    appState.gameState = data;
    appState.gameState.appliedHistory = [];
    appState.gameState.redoHistory = [];
    updateUI();
  } catch (error) {
    console.error('New game error:', error);
  } finally {
    appState.pendingOperations.delete(operationId);
  }
}

async function handleArchiveClick() {
  const archiveModal = document.getElementById('archiveModal');
  archiveModal.classList.add('active');
  await loadArchiveList();
}

async function loadArchiveList() {
  try {
    const response = await fetch('/api/archive', {
      method: 'GET',
      headers: { Authorization: `Bearer ${appState.token}` },
    });

    const data = await response.json();
    const container = document.getElementById('archiveListContainer');

    if (data.totalCount === 0) {
      container.innerHTML = '<div class="history-empty">No completed matches yet</div>';
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom: 12px; font-size: 13px; color: #666;">
        Total matches: ${data.totalCount} (showing latest 10)
      </div>
      <div class="archive-list">
        ${data.records
          .map(
            (record) => `
          <div class="archive-item" data-match-id="${record.match_id}">
            <div class="archive-result ${record.result.toLowerCase().includes('red') ? 'red' : record.result.toLowerCase().includes('yellow') ? 'yellow' : ''}">${record.result}</div>
            <div class="archive-date">${new Date(record.completed_at).toLocaleString()} • ${record.move_count} moves</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    document.querySelectorAll('.archive-item').forEach((item) => {
      item.addEventListener('click', async () => {
        const matchId = item.getAttribute('data-match-id');
        await loadReplay(matchId);
      });
    });
  } catch (error) {
    console.error('Load archive error:', error);
  }
}

async function loadReplay(matchId) {
  try {
    const response = await fetch(`/api/archive/${matchId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${appState.token}` },
    });

    const data = await response.json();
    appState.currentArchiveMatchId = matchId;
    appState.replayMoves = [];
    appState.replayStep = 0;

    // Reconstruct moves from the final board
    // For now, show the final board and basic replay controls
    document.getElementById('replayTitle').textContent = `${data.result}`;

    // Disable archive modal and show replay
    document.getElementById('archiveModal').classList.remove('active');
    document.getElementById('replayModal').classList.add('active');

    const step = document.getElementById('replayStep');
    step.max = 0;
    step.value = 0;

    updateReplayBoard(data.finalBoard);
  } catch (error) {
    console.error('Load replay error:', error);
  }
}

function updateReplayBoard(board) {
  const cells = document.querySelectorAll('.replay-cell');
  cells.forEach((cell, index) => {
    const piece = board[index];
    cell.className = 'replay-cell';
    if (piece === 'Red') {
      cell.classList.add('red');
    } else if (piece === 'Yellow') {
      cell.classList.add('yellow');
    }

    const row = Math.floor(index / 7) + 1;
    const col = (index % 7) + 1;
    const state = piece === '' ? 'empty' : piece;
    cell.setAttribute('aria-label', `Row ${row}, Column ${col}, ${state}`);
  });
}

function updateReplay() {
  const step = parseInt(document.getElementById('replayStep').value);
  appState.replayStep = step;
}

function replayPrevious() {
  const step = document.getElementById('replayStep');
  if (step.value > 0) {
    step.value = parseInt(step.value) - 1;
    updateReplay();
  }
}

function replayNext() {
  const step = document.getElementById('replayStep');
  if (step.value < step.max) {
    step.value = parseInt(step.value) + 1;
    updateReplay();
  }
}

function closeArchiveModal() {
  document.getElementById('archiveModal').classList.remove('active');
}

function closeReplayModal() {
  document.getElementById('replayModal').classList.remove('active');
}

function showGameUpdatedError(message = 'Game updated in another tab') {
  const statusEl = document.getElementById('gameStatus');
  const originalText = statusEl.textContent;
  statusEl.textContent = message;
  statusEl.style.background = '#fff5f5';
  statusEl.style.color = '#e53e3e';

  setTimeout(() => {
    statusEl.textContent = originalText;
    statusEl.style.background = '#f9f9f9';
    statusEl.style.color = '#333';
  }, 3000);
}

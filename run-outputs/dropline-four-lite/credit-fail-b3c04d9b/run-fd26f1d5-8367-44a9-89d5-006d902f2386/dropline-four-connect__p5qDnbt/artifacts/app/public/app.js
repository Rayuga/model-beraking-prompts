/**
 * DropLine - Connect Four Client Application
 */

(function () {
  'use strict';

  // State
  let authToken = localStorage.getItem('dropline_token') || null;
  let currentUser = null;
  let gameState = null;
  let archiveData = { totalCount: 0, matches: [] };
  let isActionPending = false;
  let lastTriggerElement = null;

  // Replay State
  let currentReplay = null;
  let currentReplayStep = 0;

  // DOM Elements
  const signinSection = document.getElementById('signin-section');
  const signinForm = document.getElementById('signin-form');
  const signinEmailInput = document.getElementById('signin-email');
  const signinPasswordInput = document.getElementById('signin-password');
  const signinErrorAlert = document.getElementById('signin-error');
  const demoFillBtns = document.querySelectorAll('.demo-fill-btn');

  const gameSection = document.getElementById('game-section');
  const userDisplayName = document.getElementById('user-display-name');
  const userDisplayEmail = document.getElementById('user-display-email');
  const serverRevisionNumber = document.getElementById('server-revision-number');
  const signoutBtn = document.getElementById('signout-btn');

  const statRedWins = document.getElementById('stat-red-wins');
  const statYellowWins = document.getElementById('stat-yellow-wins');
  const statDraws = document.getElementById('stat-draws');

  const gameTurnStatus = document.getElementById('game-turn-status');
  const gameFeedbackBanner = document.getElementById('game-feedback-banner');

  const gameBoardGrid = document.getElementById('game-board-grid');
  const dropColBtns = document.querySelectorAll('.drop-btn');

  const newGameBtn = document.getElementById('new-game-btn');
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');

  const historyList = document.getElementById('history-list');
  const historyStepCount = document.getElementById('history-step-count');
  const noHistoryMsg = document.getElementById('no-history-msg');

  const archiveItemsList = document.getElementById('archive-items-list');
  const archiveTotalCount = document.getElementById('archive-total-count');
  const noArchiveMsg = document.getElementById('no-archive-msg');

  // Replay Elements
  const replayModalOverlay = document.getElementById('replay-modal-overlay');
  const replayModalTitle = document.getElementById('replay-modal-title');
  const replaySubtitle = document.getElementById('replay-subtitle');
  const replayBoardGrid = document.getElementById('replay-board-grid');
  const replayStepCaption = document.getElementById('replay-step-caption');
  const replayRangeSlider = document.getElementById('replay-range-slider');
  const replayPrevBtn = document.getElementById('replay-prev-btn');
  const replayNextBtn = document.getElementById('replay-next-btn');
  const replayCloseXBtn = document.getElementById('replay-close-x-btn');
  const replayCloseBottomBtn = document.getElementById('replay-close-bottom-btn');

  // Utility to generate UUID for operationId
  function generateOpId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return 'op-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
  }

  // API Client Helper
  async function apiRequest(path, options = {}) {
    const headers = options.headers || {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const res = await fetch(path, { credentials: 'same-origin', ...options, headers });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, data };
    } catch (err) {
      console.error('API request error:', err);
      return { status: 0, ok: false, data: { error: 'Network error. Please try again.' } };
    }
  }

  // Authentication
  function handleUnauthorized() {
    authToken = null;
    localStorage.removeItem('dropline_token');
    currentUser = null;
    gameState = null;
    archiveData = { totalCount: 0, matches: [] };

    signinSection.classList.remove('hidden');
    gameSection.classList.add('hidden');
    closeReplay();
  }

  async function checkAuthOnLoad() {
    if (!authToken) {
      handleUnauthorized();
      return;
    }

    const res = await apiRequest('/api/auth/me');
    if (res.ok && res.data) {
      currentUser = res.data.user;
      gameState = res.data.gameState;
      archiveData = res.data.archive;
      showGameView();
    } else {
      handleUnauthorized();
    }
  }

  async function handleSignIn(e) {
    if (e) e.preventDefault();
    signinErrorAlert.classList.add('hidden');
    signinErrorAlert.textContent = '';

    const email = signinEmailInput.value.trim();
    const password = signinPasswordInput.value;

    if (!email || !password) {
      signinErrorAlert.textContent = 'Please enter both email and password.';
      signinErrorAlert.classList.remove('hidden');
      return;
    }

    const res = await apiRequest('/api/auth/signin', {
      method: 'POST',
      body: { email, password }
    });

    if (res.ok && res.data && res.data.token) {
      authToken = res.data.token;
      localStorage.setItem('dropline_token', authToken);
      currentUser = res.data.user;
      gameState = res.data.gameState;
      archiveData = res.data.archive;
      signinForm.reset();
      showGameView();
    } else {
      signinErrorAlert.textContent = res.data.error || 'Invalid email or password.';
      signinErrorAlert.classList.remove('hidden');
    }
  }

  async function handleSignOut() {
    if (authToken) {
      await apiRequest('/api/auth/signout', { method: 'POST' });
    }
    handleUnauthorized();
  }

  function showGameView() {
    signinSection.classList.add('hidden');
    gameSection.classList.remove('hidden');
    renderAll();
  }

  // Render Functions
  function renderAll() {
    if (!gameState || !currentUser) return;

    // User details
    userDisplayName.textContent = currentUser.name || 'User';
    userDisplayEmail.textContent = currentUser.email || '';
    serverRevisionNumber.textContent = gameState.revision !== undefined ? gameState.revision : '0';

    // Scores
    statRedWins.textContent = gameState.redWins || 0;
    statYellowWins.textContent = gameState.yellowWins || 0;
    statDraws.textContent = gameState.draws || 0;

    // Status & Turn
    renderStatus();

    // Board
    renderBoard();

    // Toolbar buttons
    undoBtn.disabled = !gameState.appliedHistory || gameState.appliedHistory.length === 0;
    redoBtn.disabled = !gameState.redoHistory || gameState.redoHistory.length === 0;

    // History
    renderHistory();

    // Archive
    renderArchive();
  }

  function renderStatus() {
    gameTurnStatus.className = 'turn-indicator';

    if (gameState.status === 'Red wins') {
      gameTurnStatus.textContent = 'Red wins';
      gameTurnStatus.classList.add('turn-red');
    } else if (gameState.status === 'Yellow wins') {
      gameTurnStatus.textContent = 'Yellow wins';
      gameTurnStatus.classList.add('turn-yellow');
    } else if (gameState.status === 'Draw') {
      gameTurnStatus.textContent = 'Draw';
      gameTurnStatus.classList.add('turn-draw');
    } else {
      const player = gameState.currentPlayer || 'Red';
      gameTurnStatus.textContent = `${player}'s turn`;
      gameTurnStatus.classList.add(player === 'Red' ? 'turn-red' : 'turn-yellow');
    }
  }

  function showFeedback(msg) {
    if (!msg) {
      clearFeedback();
      return;
    }
    gameFeedbackBanner.textContent = msg;
    gameFeedbackBanner.classList.remove('hidden');
  }

  function clearFeedback() {
    gameFeedbackBanner.textContent = '';
    gameFeedbackBanner.classList.add('hidden');
  }

  function renderBoard() {
    gameBoardGrid.innerHTML = '';
    const board = gameState.board || Array(42).fill('');
    const winningCells = gameState.winningCells || [];

    for (let row = 1; row <= 6; row++) {
      for (let col = 1; col <= 7; col++) {
        const index = (row - 1) * 7 + (col - 1);
        const color = board[index] || '';
        const isWinning = winningCells.includes(index);

        const cellEl = document.createElement('div');
        cellEl.className = 'grid-cell';
        cellEl.setAttribute('role', 'gridcell');

        let ariaLabel = `Row ${row}, Column ${col}, ${color ? color : 'empty'}`;
        if (isWinning) {
          ariaLabel += ', winning';
          cellEl.classList.add('cell-winning');
        }

        if (color === 'Red') {
          cellEl.classList.add('cell-red');
        } else if (color === 'Yellow') {
          cellEl.classList.add('cell-yellow');
        }

        cellEl.setAttribute('aria-label', ariaLabel);
        gameBoardGrid.appendChild(cellEl);
      }
    }
  }

  function renderHistory() {
    historyList.innerHTML = '';
    const moves = gameState.appliedHistory || [];
    historyStepCount.textContent = `${moves.length} move${moves.length === 1 ? '' : 's'}`;

    if (moves.length === 0) {
      noHistoryMsg.classList.remove('hidden');
      return;
    }

    noHistoryMsg.classList.add('hidden');
    moves.forEach((move, i) => {
      const item = document.createElement('li');
      item.className = 'history-item';

      const numSpan = document.createElement('span');
      numSpan.className = 'history-move-num';
      numSpan.textContent = `#${i + 1}`;

      const playerSpan = document.createElement('span');
      playerSpan.className = `history-move-player color-${move.color}`;
      playerSpan.textContent = move.color;

      const coordsSpan = document.createElement('span');
      coordsSpan.className = 'history-move-coords';
      coordsSpan.textContent = `Column ${move.column}, Row ${move.row}`;

      item.appendChild(numSpan);
      item.appendChild(playerSpan);
      item.appendChild(coordsSpan);
      historyList.appendChild(item);
    });

    // Auto scroll history to bottom
    const historyContainer = document.getElementById('history-list-container');
    if (historyContainer) {
      historyContainer.scrollTop = historyContainer.scrollHeight;
    }
  }

  function renderArchive() {
    archiveItemsList.innerHTML = '';
    const total = archiveData.totalCount || 0;
    archiveTotalCount.textContent = `${total} total`;

    const matches = archiveData.matches || [];
    if (matches.length === 0) {
      noArchiveMsg.classList.remove('hidden');
      return;
    }

    noArchiveMsg.classList.add('hidden');
    matches.forEach(m => {
      const card = document.createElement('div');
      card.className = 'archive-card';

      const meta = document.createElement('div');
      meta.className = 'archive-meta';

      const resSpan = document.createElement('span');
      resSpan.className = 'archive-result';
      if (m.result.startsWith('Red')) resSpan.classList.add('res-red');
      else if (m.result.startsWith('Yellow')) resSpan.classList.add('res-yellow');
      else resSpan.classList.add('res-draw');
      resSpan.textContent = m.result;

      const detailsSpan = document.createElement('span');
      detailsSpan.className = 'archive-details';
      let dateStr = '';
      try {
        const d = new Date(m.completedAt);
        dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        dateStr = m.completedAt || '';
      }
      detailsSpan.textContent = `${m.moveCount} moves • ${dateStr}`;

      meta.appendChild(resSpan);
      meta.appendChild(detailsSpan);

      const replayBtn = document.createElement('button');
      replayBtn.type = 'button';
      replayBtn.className = 'btn btn-sm btn-outline-secondary replay-open-btn';
      replayBtn.textContent = 'Replay';
      replayBtn.setAttribute('aria-label', `Replay match ${m.matchId}: ${m.result}, ${m.moveCount} moves`);
      replayBtn.addEventListener('click', (ev) => {
        lastTriggerElement = ev.currentTarget;
        openReplay(m);
      });

      card.appendChild(meta);
      card.appendChild(replayBtn);
      archiveItemsList.appendChild(card);
    });
  }

  // Game Mutations
  async function performMove(col) {
    if (isActionPending) return;
    isActionPending = true;

    const opId = generateOpId();
    const res = await apiRequest('/api/game/move', {
      method: 'POST',
      body: {
        column: col,
        expectedRevision: gameState.revision,
        operationId: opId
      }
    });

    isActionPending = false;

    if (res.status === 401) {
      handleUnauthorized();
      return;
    }

    if (res.status === 409) {
      gameState = res.data.gameState;
      archiveData = res.data.archive || archiveData;
      renderAll();
      showFeedback('Game updated in another tab');
      restoreColumnFocus(col);
      return;
    }

    if (res.status === 400) {
      if (res.data.gameState) {
        gameState = res.data.gameState;
        archiveData = res.data.archive || archiveData;
        renderAll();
      }
      showFeedback(res.data.message || `Column ${col} is full`);
      restoreColumnFocus(col);
      return;
    }

    if (res.ok && res.data) {
      clearFeedback();
      gameState = res.data.gameState;
      archiveData = res.data.archive || archiveData;
      renderAll();
      restoreColumnFocus(col);
    }
  }

  async function performUndo() {
    if (isActionPending) return;
    if (!gameState.appliedHistory || gameState.appliedHistory.length === 0) return;
    isActionPending = true;

    const opId = generateOpId();
    const res = await apiRequest('/api/game/undo', {
      method: 'POST',
      body: {
        expectedRevision: gameState.revision,
        operationId: opId
      }
    });

    isActionPending = false;

    if (res.status === 401) {
      handleUnauthorized();
      return;
    }

    if (res.status === 409) {
      gameState = res.data.gameState;
      archiveData = res.data.archive || archiveData;
      renderAll();
      showFeedback('Game updated in another tab');
      return;
    }

    if (res.ok && res.data) {
      clearFeedback();
      gameState = res.data.gameState;
      archiveData = res.data.archive || archiveData;
      renderAll();
    }
  }

  async function performRedo() {
    if (isActionPending) return;
    if (!gameState.redoHistory || gameState.redoHistory.length === 0) return;
    isActionPending = true;

    const opId = generateOpId();
    const res = await apiRequest('/api/game/redo', {
      method: 'POST',
      body: {
        expectedRevision: gameState.revision,
        operationId: opId
      }
    });

    isActionPending = false;

    if (res.status === 401) {
      handleUnauthorized();
      return;
    }

    if (res.status === 409) {
      gameState = res.data.gameState;
      archiveData = res.data.archive || archiveData;
      renderAll();
      showFeedback('Game updated in another tab');
      return;
    }

    if (res.ok && res.data) {
      clearFeedback();
      gameState = res.data.gameState;
      archiveData = res.data.archive || archiveData;
      renderAll();
    }
  }

  async function performNewGame() {
    if (isActionPending) return;
    isActionPending = true;

    const opId = generateOpId();
    const res = await apiRequest('/api/game/new', {
      method: 'POST',
      body: {
        expectedRevision: gameState.revision,
        operationId: opId
      }
    });

    isActionPending = false;

    if (res.status === 401) {
      handleUnauthorized();
      return;
    }

    if (res.status === 409) {
      gameState = res.data.gameState;
      archiveData = res.data.archive || archiveData;
      renderAll();
      showFeedback('Game updated in another tab');
      return;
    }

    if (res.ok && res.data) {
      clearFeedback();
      gameState = res.data.gameState;
      archiveData = res.data.archive || archiveData;
      renderAll();
    }
  }

  function restoreColumnFocus(col) {
    const btn = document.getElementById(`drop-col-${col}`);
    if (btn) {
      btn.focus();
    }
  }

  // Keyboard navigation for column drop controls
  function setupColumnKeyboardNav() {
    dropColBtns.forEach(btn => {
      const col = parseInt(btn.getAttribute('data-col'), 10);

      btn.addEventListener('click', () => {
        performMove(col);
      });

      btn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (col > 1) {
            const prevBtn = document.getElementById(`drop-col-${col - 1}`);
            if (prevBtn) prevBtn.focus();
          }
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (col < 7) {
            const nextBtn = document.getElementById(`drop-col-${col + 1}`);
            if (nextBtn) nextBtn.focus();
          }
        } else if (e.key === 'Home') {
          e.preventDefault();
          const firstBtn = document.getElementById('drop-col-1');
          if (firstBtn) firstBtn.focus();
        } else if (e.key === 'End') {
          e.preventDefault();
          const lastBtn = document.getElementById('drop-col-7');
          if (lastBtn) lastBtn.focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          performMove(col);
        }
      });
    });
  }

  // Replay Modal Handlers
  function openReplay(match) {
    currentReplay = match;
    currentReplayStep = 0;

    replayModalTitle.textContent = 'Match Replay';
    replaySubtitle.textContent = `${match.result} • ${match.moveCount} moves`;

    replayRangeSlider.min = 0;
    replayRangeSlider.max = match.moves.length;
    replayRangeSlider.value = 0;

    renderReplayStep();
    replayModalOverlay.classList.remove('hidden');
    replayRangeSlider.focus();
  }

  function closeReplay() {
    currentReplay = null;
    replayModalOverlay.classList.add('hidden');
    if (lastTriggerElement && typeof lastTriggerElement.focus === 'function') {
      lastTriggerElement.focus();
    }
  }

  function setReplayStep(step) {
    if (!currentReplay) return;
    const max = currentReplay.moves.length;
    currentReplayStep = Math.max(0, Math.min(max, step));
    replayRangeSlider.value = currentReplayStep;
    renderReplayStep();
  }

  function renderReplayStep() {
    if (!currentReplay) return;

    const maxMoves = currentReplay.moves.length;
    const step = currentReplayStep;

    // Compute board state at this step
    const board = Array(42).fill('');
    for (let i = 0; i < step; i++) {
      const m = currentReplay.moves[i];
      board[m.index] = m.color;
    }

    const isFinal = (step === maxMoves);
    const winCells = (isFinal && currentReplay.winningCells) ? currentReplay.winningCells : [];

    // Render 42 grid cells
    replayBoardGrid.innerHTML = '';
    for (let row = 1; row <= 6; row++) {
      for (let col = 1; col <= 7; col++) {
        const index = (row - 1) * 7 + (col - 1);
        const color = board[index] || '';
        const isWinning = winCells.includes(index);

        const cellEl = document.createElement('div');
        cellEl.className = 'grid-cell';
        cellEl.setAttribute('role', 'gridcell');

        let ariaLabel = `Row ${row}, Column ${col}, ${color ? color : 'empty'}`;
        if (isWinning) {
          ariaLabel += ', winning';
          cellEl.classList.add('cell-winning');
        }

        if (color === 'Red') {
          cellEl.classList.add('cell-red');
        } else if (color === 'Yellow') {
          cellEl.classList.add('cell-yellow');
        }

        cellEl.setAttribute('aria-label', ariaLabel);
        replayBoardGrid.appendChild(cellEl);
      }
    }

    // Step Caption
    if (step === 0) {
      replayStepCaption.textContent = `Step 0 of ${maxMoves}: Starting empty board`;
    } else {
      const lastMove = currentReplay.moves[step - 1];
      let cap = `Move ${step} of ${maxMoves}: ${lastMove.color} in Col ${lastMove.column}, Row ${lastMove.row}`;
      if (isFinal) {
        cap += ` (${currentReplay.result})`;
      }
      replayStepCaption.textContent = cap;
    }

    // Buttons
    replayPrevBtn.disabled = (step === 0);
    replayNextBtn.disabled = (step === maxMoves);
  }

  // Setup Event Listeners
  function setupEvents() {
    // Sign in form
    signinForm.addEventListener('submit', handleSignIn);

    // Demo Fill Buttons
    demoFillBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        signinEmailInput.value = btn.getAttribute('data-email');
        signinPasswordInput.value = btn.getAttribute('data-password');
        signinSubmit();
      });
    });

    function signinSubmit() {
      handleSignIn();
    }

    // Sign out button
    signoutBtn.addEventListener('click', handleSignOut);

    // Toolbar buttons
    newGameBtn.addEventListener('click', performNewGame);
    undoBtn.addEventListener('click', performUndo);
    redoBtn.addEventListener('click', performRedo);

    // Column Controls
    setupColumnKeyboardNav();

    // Replay Controls
    replayRangeSlider.addEventListener('input', (e) => {
      setReplayStep(parseInt(e.target.value, 10));
    });

    replayPrevBtn.addEventListener('click', () => {
      if (currentReplayStep > 0) setReplayStep(currentReplayStep - 1);
    });

    replayNextBtn.addEventListener('click', () => {
      if (currentReplay && currentReplayStep < currentReplay.moves.length) {
        setReplayStep(currentReplayStep + 1);
      }
    });

    replayCloseXBtn.addEventListener('click', closeReplay);
    replayCloseBottomBtn.addEventListener('click', closeReplay);

    replayModalOverlay.addEventListener('click', (e) => {
      if (e.target === replayModalOverlay) {
        closeReplay();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !replayModalOverlay.classList.contains('hidden')) {
        closeReplay();
      }
    });

    // Sync on tab focus / visibility change
    window.addEventListener('focus', syncStateIfVisible);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        syncStateIfVisible();
      }
    });
  }

  async function syncStateIfVisible() {
    if (!authToken || isActionPending) return;
    const res = await apiRequest('/api/game');
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (res.ok && res.data) {
      if (res.data.gameState && gameState && res.data.gameState.revision !== gameState.revision) {
        gameState = res.data.gameState;
        archiveData = res.data.archive || archiveData;
        renderAll();
      }
    }
  }

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    checkAuthOnLoad();
  });

})();

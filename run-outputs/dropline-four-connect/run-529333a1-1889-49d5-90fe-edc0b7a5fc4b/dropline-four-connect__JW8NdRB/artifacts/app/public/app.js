/**
 * DropLine — Client-side Application
 * Connect Four & Study Tools
 */

(function () {
  'use strict';

  // State
  let token = localStorage.getItem('dropline_token') || null;
  let account = null;
  let gameState = null;
  let archiveState = { totalCount: 0, matches: [] };
  let openReplay = null; // { matchId, moves, finalBoard, result, currentStep }
  let analysesList = [];
  let openAnalysis = null;
  let isPending = false;
  let lastTransplantPreview = null;

  // DOM Elements
  const srAnnouncements = document.getElementById('sr-announcements');
  const authBar = document.getElementById('auth-bar');
  const userNameDisplay = document.getElementById('user-name-display');
  const userEmailDisplay = document.getElementById('user-email-display');
  const signOutBtn = document.getElementById('sign-out-btn');

  const signInSection = document.getElementById('sign-in-section');
  const signInForm = document.getElementById('sign-in-form');
  const signInEmail = document.getElementById('sign-in-email');
  const signInPassword = document.getElementById('sign-in-password');
  const signInError = document.getElementById('sign-in-error');

  const appWorkspace = document.getElementById('app-workspace');
  const tabGameBtn = document.getElementById('tab-game-btn');
  const tabArchiveBtn = document.getElementById('tab-archive-btn');
  const tabAnalysisBtn = document.getElementById('tab-analysis-btn');

  const gameViewPanel = document.getElementById('game-view-panel');
  const archiveViewPanel = document.getElementById('archive-view-panel');
  const analysisViewPanel = document.getElementById('analysis-view-panel');

  // Competitive Game Elements
  const gameTurnResult = document.getElementById('game-turn-result');
  const gameRevisionBadge = document.getElementById('game-revision-badge');
  const redWinsDisplay = document.getElementById('red-wins-display');
  const yellowWinsDisplay = document.getElementById('yellow-wins-display');
  const drawsDisplay = document.getElementById('draws-display');
  const gameFeedbackAlert = document.getElementById('game-feedback-alert');
  const gameGrid = document.getElementById('game-grid');
  const gameUndoBtn = document.getElementById('game-undo-btn');
  const gameRedoBtn = document.getElementById('game-redo-btn');
  const gameNewBtn = document.getElementById('game-new-btn');
  const gameHistoryList = document.getElementById('game-history-list');

  // Archive Elements
  const archiveCountText = document.getElementById('archive-count-text');
  const archiveRefreshBtn = document.getElementById('archive-refresh-btn');
  const archiveTbody = document.getElementById('archive-tbody');
  const replayPanel = document.getElementById('replay-panel');
  const replayMatchMeta = document.getElementById('replay-match-meta');
  const replayCloseBtn = document.getElementById('replay-close-btn');
  const replayGrid = document.getElementById('replay-grid');
  const replayStepSlider = document.getElementById('replay-step-slider');
  const replayStepLabel = document.getElementById('replay-step-label');
  const replayPrevBtn = document.getElementById('replay-prev-btn');
  const replayNextBtn = document.getElementById('replay-next-btn');
  const replayMoveDesc = document.getElementById('replay-move-desc');
  const createAnalysisForm = document.getElementById('create-analysis-form');
  const analysisNameInput = document.getElementById('analysis-name-input');
  const createAnalysisFeedback = document.getElementById('create-analysis-feedback');

  // Analysis Workspace Elements
  const analysesListView = document.getElementById('analyses-list-view');
  const savedAnalysesContainer = document.getElementById('saved-analyses-container');
  const analysesRefreshBtn = document.getElementById('analyses-refresh-btn');
  const analysisWorkspaceView = document.getElementById('analysis-workspace-view');
  const analysisBackBtn = document.getElementById('analysis-back-btn');
  const openAnalysisName = document.getElementById('open-analysis-name');
  const analysisRenameToggleBtn = document.getElementById('analysis-rename-toggle-btn');
  const analysisRenameFormBox = document.getElementById('analysis-rename-form-box');
  const analysisRenameInput = document.getElementById('analysis-rename-input');
  const analysisSaveRenameBtn = document.getElementById('analysis-save-rename-btn');
  const analysisCancelRenameBtn = document.getElementById('analysis-cancel-rename-btn');
  const analysisSourceLabel = document.getElementById('analysis-source-label');
  const analysisRevisionBadge = document.getElementById('analysis-revision-badge');
  const analysisStatusIndicator = document.getElementById('analysis-status-indicator');
  const analysisFeedbackAlert = document.getElementById('analysis-feedback-alert');
  const analysisGrid = document.getElementById('analysis-grid');
  const analysisUndoBtn = document.getElementById('analysis-undo-btn');
  const analysisRedoBtn = document.getElementById('analysis-redo-btn');
  const redoChoicePanel = document.getElementById('redo-choice-panel');
  const redoChoiceButtons = document.getElementById('redo-choice-buttons');
  const analysisHistoryList = document.getElementById('analysis-history-list');
  const variationTreeContainer = document.getElementById('variation-tree-container');

  // Study Tools Sub-Tabs
  const subtabTreeBtn = document.getElementById('subtab-tree-btn');
  const subtabCompareBtn = document.getElementById('subtab-compare-btn');
  const subtabTransplantBtn = document.getElementById('subtab-transplant-btn');
  const subtabTacticalBtn = document.getElementById('subtab-tactical-btn');

  const subtabTreePanel = document.getElementById('subtab-tree-panel');
  const subtabComparePanel = document.getElementById('subtab-compare-panel');
  const subtabTransplantPanel = document.getElementById('subtab-transplant-panel');
  const subtabTacticalPanel = document.getElementById('subtab-tactical-panel');

  // Compare Elements
  const compareForm = document.getElementById('compare-form');
  const compareNodeASelect = document.getElementById('compare-node-a-select');
  const compareNodeBSelect = document.getElementById('compare-node-b-select');
  const compareSwapBtn = document.getElementById('compare-swap-btn');
  const compareResultBox = document.getElementById('compare-result-box');
  const compareSummaryBadge = document.getElementById('compare-summary-badge');
  const compareGridA = document.getElementById('compare-grid-a');
  const compareGridB = document.getElementById('compare-grid-b');
  const compareBoardATitle = document.getElementById('compare-board-a-title');
  const compareBoardBTitle = document.getElementById('compare-board-b-title');
  const compareDiffList = document.getElementById('compare-diff-list');

  // Transplant Elements
  const transplantPreviewForm = document.getElementById('transplant-preview-form');
  const transplantSourceNodeSelect = document.getElementById('transplant-source-node-select');
  const transplantDestAnalysisSelect = document.getElementById('transplant-dest-analysis-select');
  const transplantDestNodeSelect = document.getElementById('transplant-dest-node-select');
  const transplantFeedback = document.getElementById('transplant-feedback');
  const transplantPreviewResultBox = document.getElementById('transplant-preview-result-box');
  const transplantPreviewSummary = document.getElementById('transplant-preview-summary');
  const transplantPreviewTbody = document.getElementById('transplant-preview-tbody');
  const transplantCommitBtn = document.getElementById('transplant-commit-btn');
  const transplantCommitResultBox = document.getElementById('transplant-commit-result-box');

  // Tactical Elements
  const tacticalForm = document.getElementById('tactical-form');
  const tacticalNodeSelect = document.getElementById('tactical-node-select');
  const tacticalDepthSelect = document.getElementById('tactical-depth-select');
  const tacticalFeedback = document.getElementById('tactical-feedback');
  const tacticalResultsBox = document.getElementById('tactical-results-box');
  const tacticalHeaderBadge = document.getElementById('tactical-header-badge');
  const tacticalColumnsGrid = document.getElementById('tactical-columns-grid');
  const tacticalTreeContainer = document.getElementById('tactical-tree-container');

  // Proof Inspector Modal
  const proofInspectorModal = document.getElementById('proof-inspector-modal');
  const proofModalCloseBtn = document.getElementById('proof-modal-close-btn');
  const proofNodeMeta = document.getElementById('proof-node-meta');
  const proofInspectorGrid = document.getElementById('proof-inspector-grid');

  // ==========================================
  // Utility Functions
  // ==========================================

  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'op-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  }

  function announce(msg) {
    if (srAnnouncements) {
      srAnnouncements.textContent = '';
      setTimeout(() => {
        srAnnouncements.textContent = msg;
      }, 50);
    }
  }

  async function apiRequest(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    const config = { method, headers };
    if (body) {
      config.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(endpoint, config);
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        handleSignOut(false);
        return { status: 401, error: 'Session expired. Please sign in again.' };
      }

      return { status: res.status, ok: res.ok, data };
    } catch (err) {
      return { status: 0, ok: false, error: 'Network connection failed' };
    }
  }

  // ==========================================
  // Auth & Session Handling
  // ==========================================

  async function checkSession() {
    if (!token) {
      showSignIn();
      return;
    }

    const res = await apiRequest('/api/auth/session');
    if (res.ok && res.data.account) {
      account = res.data.account;
      showWorkspace();
      await loadInitialData();
    } else {
      handleSignOut(false);
    }
  }

  function showSignIn() {
    token = null;
    account = null;
    localStorage.removeItem('dropline_token');
    authBar.classList.add('hidden');
    appWorkspace.classList.add('hidden');
    signInSection.classList.remove('hidden');
    signInEmail.value = '';
    signInPassword.value = '';
    signInError.classList.add('hidden');
  }

  function showWorkspace() {
    signInSection.classList.add('hidden');
    authBar.classList.remove('hidden');
    appWorkspace.classList.remove('hidden');
    userNameDisplay.textContent = account.name;
    userEmailDisplay.textContent = account.email;
    switchTab('game');
  }

  async function handleSignIn(e) {
    e.preventDefault();
    signInError.classList.add('hidden');

    const email = signInEmail.value.trim();
    const password = signInPassword.value;

    if (!email || !password) {
      signInError.textContent = 'Please enter both email and password.';
      signInError.classList.remove('hidden');
      return;
    }

    const res = await apiRequest('/api/auth/login', 'POST', { email, password });
    if (res.ok && res.data.token) {
      token = res.data.token;
      account = res.data.account;
      localStorage.setItem('dropline_token', token);
      showWorkspace();
      announce(`Signed in as ${account.name}`);
      await loadInitialData();
    } else {
      signInError.textContent = res.data?.error || 'Invalid email or password.';
      signInError.classList.remove('hidden');
      announce(signInError.textContent);
    }
  }

  async function handleSignOut(callServer = true) {
    if (callServer && token) {
      await apiRequest('/api/auth/logout', 'POST');
    }
    showSignIn();
    announce('Signed out successfully');
  }

  // ==========================================
  // Navigation Tabs
  // ==========================================

  function switchTab(tabName) {
    tabGameBtn.classList.remove('active');
    tabArchiveBtn.classList.remove('active');
    tabAnalysisBtn.classList.remove('active');

    tabGameBtn.setAttribute('aria-selected', 'false');
    tabArchiveBtn.setAttribute('aria-selected', 'false');
    tabAnalysisBtn.setAttribute('aria-selected', 'false');

    gameViewPanel.classList.add('hidden');
    archiveViewPanel.classList.add('hidden');
    analysisViewPanel.classList.add('hidden');

    if (tabName === 'game') {
      tabGameBtn.classList.add('active');
      tabGameBtn.setAttribute('aria-selected', 'true');
      gameViewPanel.classList.remove('hidden');
    } else if (tabName === 'archive') {
      tabArchiveBtn.classList.add('active');
      tabArchiveBtn.setAttribute('aria-selected', 'true');
      archiveViewPanel.classList.remove('hidden');
      loadArchive();
    } else if (tabName === 'analysis') {
      tabAnalysisBtn.classList.add('active');
      tabAnalysisBtn.setAttribute('aria-selected', 'true');
      analysisViewPanel.classList.remove('hidden');
      loadAnalysesList();
    }
  }

  function switchStudyTab(subTabName) {
    subtabTreeBtn.classList.remove('active');
    subtabCompareBtn.classList.remove('active');
    subtabTransplantBtn.classList.remove('active');
    subtabTacticalBtn.classList.remove('active');

    subtabTreeBtn.setAttribute('aria-selected', 'false');
    subtabCompareBtn.setAttribute('aria-selected', 'false');
    subtabTransplantBtn.setAttribute('aria-selected', 'false');
    subtabTacticalBtn.setAttribute('aria-selected', 'false');

    subtabTreePanel.classList.add('hidden');
    subtabComparePanel.classList.add('hidden');
    subtabTransplantPanel.classList.add('hidden');
    subtabTacticalPanel.classList.add('hidden');

    if (subTabName === 'tree') {
      subtabTreeBtn.classList.add('active');
      subtabTreeBtn.setAttribute('aria-selected', 'true');
      subtabTreePanel.classList.remove('hidden');
    } else if (subTabName === 'compare') {
      subtabCompareBtn.classList.add('active');
      subtabCompareBtn.setAttribute('aria-selected', 'true');
      subtabComparePanel.classList.remove('hidden');
      populateCompareSelects();
    } else if (subTabName === 'transplant') {
      subtabTransplantBtn.classList.add('active');
      subtabTransplantBtn.setAttribute('aria-selected', 'true');
      subtabTransplantPanel.classList.remove('hidden');
      populateTransplantSelects();
    } else if (subTabName === 'tactical') {
      subtabTacticalBtn.classList.add('active');
      subtabTacticalBtn.setAttribute('aria-selected', 'true');
      subtabTacticalPanel.classList.remove('hidden');
      populateTacticalSelects();
    }
  }

  // ==========================================
  // Grid Rendering Helper
  // ==========================================

  function renderGrid(container, board, winningCells = [], diffCells = []) {
    container.innerHTML = '';
    const winSet = new Set(winningCells || []);
    const diffMap = new Map((diffCells || []).map(d => [d.index, d]));

    for (let r = 1; r <= 6; r++) {
      for (let c = 1; c <= 7; c++) {
        const idx = (r - 1) * 7 + (c - 1);
        const occupant = board[idx] || '';
        const isWin = winSet.has(idx);
        const diffInfo = diffMap.get(idx);

        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.setAttribute('role', 'gridcell');

        let cellStateDesc = occupant ? occupant : 'empty';
        if (isWin) {
          cellStateDesc += ', winning';
          cell.classList.add('winning-cell');
        }
        if (diffInfo) {
          cell.classList.add('diff-cell');
        }

        cell.setAttribute('aria-label', `Row ${r}, Column ${c}, ${cellStateDesc}`);

        if (occupant === 'Red') {
          const piece = document.createElement('div');
          piece.className = 'cell-piece piece-red';
          piece.textContent = 'R';
          piece.setAttribute('aria-hidden', 'true');
          cell.appendChild(piece);
        } else if (occupant === 'Yellow') {
          const piece = document.createElement('div');
          piece.className = 'cell-piece piece-yellow';
          piece.textContent = 'Y';
          piece.setAttribute('aria-hidden', 'true');
          cell.appendChild(piece);
        }

        if (isWin) {
          const winBadge = document.createElement('span');
          winBadge.className = 'winning-badge';
          winBadge.textContent = '★';
          winBadge.setAttribute('aria-hidden', 'true');
          cell.appendChild(winBadge);
        }

        if (diffInfo) {
          const diffBadge = document.createElement('span');
          diffBadge.className = 'diff-badge';
          diffBadge.textContent = 'Δ';
          diffBadge.setAttribute('aria-hidden', 'true');
          cell.appendChild(diffBadge);
        }

        container.appendChild(cell);
      }
    }
  }

  // ==========================================
  // Competitive Game Logic
  // ==========================================

  async function loadInitialData() {
    await Promise.all([loadGameState(), loadArchive(), loadAnalysesList()]);
  }

  async function loadGameState() {
    const res = await apiRequest('/api/game');
    if (res.ok && res.data) {
      gameState = res.data;
      renderGame();
    }
  }

  function renderGame() {
    if (!gameState) return;

    // Revision Badge
    gameRevisionBadge.textContent = `Revision: ${gameState.revision}`;

    // Scores
    redWinsDisplay.textContent = gameState.redWins;
    yellowWinsDisplay.textContent = gameState.yellowWins;
    drawsDisplay.textContent = gameState.draws;

    // Status indicator
    gameTurnResult.className = 'turn-indicator';
    if (gameState.status === 'active') {
      gameTurnResult.textContent = `${gameState.currentPlayer}'s turn`;
      gameTurnResult.classList.add(gameState.currentPlayer === 'Red' ? 'turn-red' : 'turn-yellow');
    } else if (gameState.status === 'Red wins') {
      gameTurnResult.textContent = 'Red wins';
      gameTurnResult.classList.add('turn-red');
    } else if (gameState.status === 'Yellow wins') {
      gameTurnResult.textContent = 'Yellow wins';
      gameTurnResult.classList.add('turn-yellow');
    } else if (gameState.status === 'Draw') {
      gameTurnResult.textContent = 'Draw';
      gameTurnResult.classList.add('turn-draw');
    }

    // Buttons availability
    gameUndoBtn.disabled = !gameState.canUndo || isPending;
    gameRedoBtn.disabled = !gameState.canRedo || isPending;
    gameNewBtn.disabled = isPending;

    // Render Grid
    renderGrid(gameGrid, gameState.board, gameState.winningCells);

    // Render History
    renderGameHistory();
  }

  function renderGameHistory() {
    gameHistoryList.innerHTML = '';
    if (!gameState.appliedHistory || gameState.appliedHistory.length === 0) {
      gameHistoryList.innerHTML = '<p class="empty-hint">No moves played yet in this round.</p>';
      return;
    }

    gameState.appliedHistory.forEach(m => {
      const item = document.createElement('div');
      item.className = `history-item ${m.color === 'Red' ? 'history-item-red' : 'history-item-yellow'}`;
      item.setAttribute('role', 'listitem');

      item.innerHTML = `
        <span class="history-move-num">Move ${m.moveNumber}</span>
        <span class="history-move-detail">${m.color} in column ${m.column}, row ${m.row}</span>
      `;
      gameHistoryList.appendChild(item);
    });

    // Auto scroll history to bottom
    gameHistoryList.scrollTop = gameHistoryList.scrollHeight;
  }

  function showGameFeedback(msg, isError = true) {
    if (!msg) {
      gameFeedbackAlert.classList.add('hidden');
      return;
    }
    gameFeedbackAlert.textContent = msg;
    gameFeedbackAlert.className = `alert ${isError ? 'alert-error' : 'alert-warning'}`;
    gameFeedbackAlert.classList.remove('hidden');
    announce(msg);
  }

  async function handleColumnDrop(col) {
    if (isPending || !gameState) return;
    showGameFeedback('');

    if (gameState.status !== 'active') {
      showGameFeedback('Game is already finished. Start a new game.');
      return;
    }

    isPending = true;
    renderGame();

    const opId = generateUUID();
    const res = await apiRequest('/api/game/move', 'POST', {
      column: col,
      expectedRevision: gameState.revision,
      operationId: opId
    });

    isPending = false;

    if (res.ok && res.data) {
      gameState = res.data;
      renderGame();
      announce(`${gameState.appliedHistory[gameState.appliedHistory.length - 1].color} dropped in column ${col}. ${gameState.status === 'active' ? gameState.currentPlayer + "'s turn" : gameState.status}`);
    } else if (res.status === 409) {
      if (res.data?.state) gameState = res.data.state;
      renderGame();
      showGameFeedback('Game updated in another tab');
    } else {
      showGameFeedback(res.data?.error || `Column ${col} is full`);
      renderGame();
    }
  }

  async function handleGameUndo() {
    if (isPending || !gameState || !gameState.canUndo) return;
    showGameFeedback('');
    isPending = true;
    renderGame();

    const opId = generateUUID();
    const res = await apiRequest('/api/game/undo', 'POST', {
      expectedRevision: gameState.revision,
      operationId: opId
    });

    isPending = false;

    if (res.ok && res.data) {
      gameState = res.data;
      renderGame();
      announce(`Undid move. ${gameState.currentPlayer}'s turn.`);
    } else if (res.status === 409) {
      if (res.data?.state) gameState = res.data.state;
      renderGame();
      showGameFeedback('Game updated in another tab');
    } else {
      showGameFeedback(res.data?.error || 'Undo failed');
      renderGame();
    }
  }

  async function handleGameRedo() {
    if (isPending || !gameState || !gameState.canRedo) return;
    showGameFeedback('');
    isPending = true;
    renderGame();

    const opId = generateUUID();
    const res = await apiRequest('/api/game/redo', 'POST', {
      expectedRevision: gameState.revision,
      operationId: opId
    });

    isPending = false;

    if (res.ok && res.data) {
      gameState = res.data;
      renderGame();
      announce(`Redid move.`);
    } else if (res.status === 409) {
      if (res.data?.state) gameState = res.data.state;
      renderGame();
      showGameFeedback('Game updated in another tab');
    } else {
      showGameFeedback(res.data?.error || 'Redo failed');
      renderGame();
    }
  }

  async function handleGameNew() {
    if (isPending || !gameState) return;
    showGameFeedback('');
    isPending = true;
    renderGame();

    const opId = generateUUID();
    const res = await apiRequest('/api/game/new', 'POST', {
      expectedRevision: gameState.revision,
      operationId: opId
    });

    isPending = false;

    if (res.ok && res.data) {
      gameState = res.data;
      renderGame();
      announce('Started a new game. Red\'s turn.');
    } else if (res.status === 409) {
      if (res.data?.state) gameState = res.data.state;
      renderGame();
      showGameFeedback('Game updated in another tab');
    } else {
      showGameFeedback(res.data?.error || 'New game failed');
      renderGame();
    }
  }

  // Keyboard Navigation for Column Drop Buttons
  function setupColumnKeyboardNav(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const btns = Array.from(container.querySelectorAll('.col-drop-btn'));

    btns.forEach((btn, idx) => {
      btn.addEventListener('keydown', (e) => {
        let targetIdx = null;

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (idx > 0) targetIdx = idx - 1;
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (idx < btns.length - 1) targetIdx = idx + 1;
        } else if (e.key === 'Home') {
          e.preventDefault();
          targetIdx = 0;
        } else if (e.key === 'End') {
          e.preventDefault();
          targetIdx = btns.length - 1;
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.click();
        }

        if (targetIdx !== null && btns[targetIdx]) {
          btns[targetIdx].focus();
        }
      });
    });
  }

  // ==========================================
  // Archive & Replay Logic
  // ==========================================

  async function loadArchive() {
    const res = await apiRequest('/api/archive');
    if (res.ok && res.data) {
      archiveState = res.data;
      renderArchive();
    }
  }

  function renderArchive() {
    archiveCountText.textContent = `Total completed matches: ${archiveState.totalCount} (showing latest ${archiveState.matches.length})`;
    archiveTbody.innerHTML = '';

    if (archiveState.matches.length === 0) {
      archiveTbody.innerHTML = '<tr><td colspan="5" class="empty-hint" style="text-align:center; padding: 1.5rem;">No completed matches recorded yet.</td></tr>';
      return;
    }

    archiveState.matches.forEach(m => {
      const tr = document.createElement('tr');

      let badgeClass = 'badge-draw';
      if (m.result === 'Red wins') badgeClass = 'badge-red-win';
      else if (m.result === 'Yellow wins') badgeClass = 'badge-yellow-win';

      const formattedDate = new Date(m.completedAt).toLocaleString();

      tr.innerHTML = `
        <td><code>${m.matchId}</code></td>
        <td><span class="badge ${badgeClass}">${m.result}</span></td>
        <td>${m.moveCount} moves</td>
        <td>${formattedDate}</td>
        <td>
          <button class="btn btn-secondary btn-sm replay-open-btn" data-id="${m.matchId}" aria-label="Replay match ${m.matchId}">
            View Replay
          </button>
        </td>
      `;

      tr.querySelector('.replay-open-btn').addEventListener('click', () => openMatchReplay(m.matchId));
      archiveTbody.appendChild(tr);
    });
  }

  async function openMatchReplay(matchId) {
    const res = await apiRequest(`/api/archive/${matchId}`);
    if (res.ok && res.data) {
      openReplay = {
        matchId: res.data.matchId,
        moves: res.data.moves || [],
        finalBoard: res.data.finalBoard || Array(42).fill(""),
        result: res.data.result,
        currentStep: (res.data.moves || []).length
      };

      replayMatchMeta.textContent = `Match ID: ${openReplay.matchId} • Result: ${openReplay.result} • Total Moves: ${openReplay.moves.length}`;
      replayStepSlider.max = openReplay.moves.length;
      replayStepSlider.value = openReplay.currentStep;
      replayPanel.classList.remove('hidden');

      renderReplayStep();
      replayPanel.scrollIntoView({ behavior: 'smooth' });
      announce(`Opened replay for match ${openReplay.matchId}`);
    }
  }

  function renderReplayStep() {
    if (!openReplay) return;
    const step = openReplay.currentStep;
    replayStepSlider.value = step;
    replayStepLabel.textContent = `Replay Step: ${step} of ${openReplay.moves.length}`;

    // Derive board for step
    let board = Array(42).fill("");
    for (let i = 0; i < step; i++) {
      const m = openReplay.moves[i];
      if (m && m.index !== undefined) {
        board[m.index] = m.color;
      }
    }

    renderGrid(replayGrid, board);

    replayPrevBtn.disabled = step <= 0;
    replayNextBtn.disabled = step >= openReplay.moves.length;

    if (step === 0) {
      replayMoveDesc.textContent = 'Step 0: Initial empty board position';
    } else {
      const m = openReplay.moves[step - 1];
      replayMoveDesc.textContent = `Step ${step}: ${m.color} dropped in column ${m.column}, row ${m.row}`;
    }
  }

  async function handleCreateAnalysisFromReplay(e) {
    e.preventDefault();
    if (!openReplay) return;
    createAnalysisFeedback.classList.add('hidden');

    const name = analysisNameInput.value.trim();
    if (!name) {
      createAnalysisFeedback.textContent = 'Please enter an analysis name.';
      createAnalysisFeedback.classList.remove('hidden');
      return;
    }

    const opId = generateUUID();
    const res = await apiRequest('/api/analyses', 'POST', {
      matchId: openReplay.matchId,
      step: openReplay.currentStep,
      name,
      operationId: opId
    });

    if (res.ok && res.data) {
      analysisNameInput.value = '';
      announce(`Created analysis "${res.data.name}". Switching to Analysis Workspace.`);
      switchTab('analysis');
      await openAnalysisById(res.data.id);
    } else {
      createAnalysisFeedback.textContent = res.data?.error || 'Failed to create analysis.';
      createAnalysisFeedback.classList.remove('hidden');
      announce(createAnalysisFeedback.textContent);
    }
  }

  // ==========================================
  // Analysis Workspace Logic
  // ==========================================

  async function loadAnalysesList() {
    const res = await apiRequest('/api/analyses');
    if (res.ok && res.data) {
      analysesList = res.data.analyses || [];
      renderAnalysesList();
    }
  }

  function renderAnalysesList() {
    savedAnalysesContainer.innerHTML = '';

    if (analysesList.length === 0) {
      savedAnalysesContainer.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
          <p class="empty-hint">No saved analyses yet.</p>
          <p class="text-muted" style="margin-top: 0.5rem;">To create one, go to Match Archive, open a replay step, and click "Create Saved Analysis".</p>
        </div>
      `;
      return;
    }

    analysesList.forEach(a => {
      const card = document.createElement('div');
      card.className = 'analysis-card-item';

      const updatedStr = new Date(a.updatedAt).toLocaleString();

      card.innerHTML = `
        <div>
          <h3 class="card-subtitle" style="margin-bottom: 0.25rem;">${a.name}</h3>
          <span class="badge badge-source">Source: ${a.sourceMatchId} (step ${a.sourceStep})</span>
          <div class="text-muted" style="margin-top: 0.5rem; font-size: 0.8rem;">
            Revision: ${a.revision} &bull; Updated: ${updatedStr}
          </div>
        </div>
        <button class="btn btn-primary btn-sm open-analysis-btn" data-id="${a.id}" aria-label="Open analysis ${a.name}">
          Open Analysis
        </button>
      `;

      card.querySelector('.open-analysis-btn').addEventListener('click', () => openAnalysisById(a.id));
      savedAnalysesContainer.appendChild(card);
    });
  }

  async function openAnalysisById(analysisId) {
    const res = await apiRequest(`/api/analyses/${analysisId}`);
    if (res.ok && res.data) {
      openAnalysis = res.data;
      analysesListView.classList.add('hidden');
      analysisWorkspaceView.classList.remove('hidden');
      renderOpenAnalysis();
      switchStudyTab('tree');
      announce(`Opened analysis "${openAnalysis.name}"`);
    }
  }

  function renderOpenAnalysis() {
    if (!openAnalysis) return;

    openAnalysisName.textContent = openAnalysis.name;
    analysisSourceLabel.textContent = `Source: ${openAnalysis.sourceMatchId} (Step ${openAnalysis.sourceStep})`;
    analysisRevisionBadge.textContent = `Revision: ${openAnalysis.revision}`;

    const sel = openAnalysis.selectedNode;

    // Status Indicator
    analysisStatusIndicator.className = 'turn-indicator';
    if (sel.status === 'active') {
      analysisStatusIndicator.textContent = `${sel.turn}'s turn`;
      analysisStatusIndicator.classList.add(sel.turn === 'Red' ? 'turn-red' : 'turn-yellow');
    } else if (sel.status === 'Red wins') {
      analysisStatusIndicator.textContent = 'Red wins';
      analysisStatusIndicator.classList.add('turn-red');
    } else if (sel.status === 'Yellow wins') {
      analysisStatusIndicator.textContent = 'Yellow wins';
      analysisStatusIndicator.classList.add('turn-yellow');
    } else if (sel.status === 'Draw') {
      analysisStatusIndicator.textContent = 'Draw';
      analysisStatusIndicator.classList.add('turn-draw');
    }

    // Board Grid
    renderGrid(analysisGrid, sel.board, sel.winningCells);

    // Undo / Redo
    analysisUndoBtn.disabled = !sel.canUndo || isPending;
    analysisRedoBtn.disabled = !sel.canRedo || isPending;

    // Hide choice panel by default
    redoChoicePanel.classList.add('hidden');

    // Render History & Tree
    renderAnalysisHistory();
    renderVariationTree();

    // Populate comparison & tactical dropdowns
    populateCompareSelects();
    populateTransplantSelects();
    populateTacticalSelects();
  }

  function renderAnalysisHistory() {
    analysisHistoryList.innerHTML = '';
    if (!openAnalysis.fullSelectedHistory || openAnalysis.fullSelectedHistory.length === 0) {
      analysisHistoryList.innerHTML = '<p class="empty-hint">At root step with no prior moves.</p>';
      return;
    }

    openAnalysis.fullSelectedHistory.forEach((m, idx) => {
      const item = document.createElement('div');
      item.className = `history-item ${m.color === 'Red' ? 'history-item-red' : 'history-item-yellow'}`;
      item.setAttribute('role', 'listitem');

      item.innerHTML = `
        <span class="history-move-num">Move ${idx + 1}</span>
        <span class="history-move-detail">${m.color} in column ${m.column}, row ${m.row}</span>
      `;
      analysisHistoryList.appendChild(item);
    });

    analysisHistoryList.scrollTop = analysisHistoryList.scrollHeight;
  }

  function renderVariationTree() {
    variationTreeContainer.innerHTML = '';
    if (!openAnalysis.treeNodes || openAnalysis.treeNodes.length === 0) return;

    // Build hierarchical tree from root
    const nodeMap = new Map(openAnalysis.treeNodes.map(n => [n.id, n]));
    const root = nodeMap.get(openAnalysis.rootNodeId);

    function renderSubtree(node, depth) {
      const row = document.createElement('div');
      row.className = `tree-node-item ${node.id === openAnalysis.selectedNodeId ? 'selected' : ''}`;
      row.setAttribute('role', 'treeitem');
      row.setAttribute('tabindex', '0');

      let labelText = '';
      if (!node.parentId) {
        labelText = `[Root] Step ${openAnalysis.sourceStep} (${node.turn}'s turn)`;
      } else {
        labelText = `Move ${node.moveNumber}: ${node.color} in col ${node.incomingColumn}, row ${node.landingRow}`;
        if (node.status !== 'active') {
          labelText += ` [${node.status}]`;
        }
      }

      row.setAttribute('aria-label', labelText + (node.id === openAnalysis.selectedNodeId ? ' (selected)' : ''));

      // Indent
      const indentSpan = document.createElement('span');
      indentSpan.innerHTML = '&nbsp;'.repeat(depth * 4);
      row.appendChild(indentSpan);

      // Dot
      const dot = document.createElement('span');
      dot.className = `tree-node-color-dot ${!node.parentId ? 'dot-root' : (node.color === 'Red' ? 'dot-red' : 'dot-yellow')}`;
      row.appendChild(dot);

      // Text
      const textSpan = document.createElement('span');
      textSpan.textContent = labelText;
      row.appendChild(textSpan);

      row.addEventListener('click', () => handleSelectAnalysisNode(node.id));
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelectAnalysisNode(node.id);
        }
      });

      variationTreeContainer.appendChild(row);

      const childNodes = (node.childrenIds || [])
        .map(cid => nodeMap.get(cid))
        .filter(Boolean)
        .sort((a, b) => a.incomingColumn - b.incomingColumn);

      childNodes.forEach(child => renderSubtree(child, depth + 1));
    }

    if (root) {
      renderSubtree(root, 0);
    }
  }

  function showAnalysisFeedback(msg, isError = true) {
    if (!msg) {
      analysisFeedbackAlert.classList.add('hidden');
      return;
    }
    analysisFeedbackAlert.textContent = msg;
    analysisFeedbackAlert.className = `alert ${isError ? 'alert-error' : 'alert-warning'}`;
    analysisFeedbackAlert.classList.remove('hidden');
    announce(msg);
  }

  async function handleAnalysisColumnDrop(col) {
    if (isPending || !openAnalysis) return;
    showAnalysisFeedback('');

    isPending = true;
    const opId = generateUUID();
    const res = await apiRequest(`/api/analyses/${openAnalysis.id}/move`, 'POST', {
      column: col,
      expectedRevision: openAnalysis.revision,
      operationId: opId
    });

    isPending = false;

    if (res.ok && res.data) {
      openAnalysis = res.data;
      renderOpenAnalysis();
      announce(`Placed piece in column ${col}.`);
    } else if (res.status === 409) {
      if (res.data?.analysis) openAnalysis = res.data.analysis;
      renderOpenAnalysis();
      showAnalysisFeedback('Analysis updated in another tab');
    } else {
      showAnalysisFeedback(res.data?.error || `Column ${col} is full`);
      renderOpenAnalysis();
    }
  }

  async function handleAnalysisUndo() {
    if (isPending || !openAnalysis || !openAnalysis.selectedNode.canUndo) return;
    showAnalysisFeedback('');

    isPending = true;
    const opId = generateUUID();
    const res = await apiRequest(`/api/analyses/${openAnalysis.id}/undo`, 'POST', {
      expectedRevision: openAnalysis.revision,
      operationId: opId
    });

    isPending = false;

    if (res.ok && res.data) {
      openAnalysis = res.data;
      renderOpenAnalysis();
      announce('Analysis undo: selected parent position.');
    } else if (res.status === 409) {
      if (res.data?.analysis) openAnalysis = res.data.analysis;
      renderOpenAnalysis();
      showAnalysisFeedback('Analysis updated in another tab');
    } else {
      showAnalysisFeedback(res.data?.error || 'Undo failed');
      renderOpenAnalysis();
    }
  }

  async function handleAnalysisRedo(childId = null) {
    if (isPending || !openAnalysis || !openAnalysis.selectedNode.canRedo) return;
    showAnalysisFeedback('');

    const children = openAnalysis.selectedNode.availableChildren || [];

    // If multiple children and no child chosen, show choice UI
    if (children.length > 1 && !childId) {
      redoChoiceButtons.innerHTML = '';
      children.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-sm';
        btn.textContent = `Col ${c.incomingColumn} (${c.color})`;
        btn.setAttribute('aria-label', `Choose continuation column ${c.incomingColumn}`);
        btn.addEventListener('click', () => {
          redoChoicePanel.classList.add('hidden');
          handleAnalysisRedo(c.id);
        });
        redoChoiceButtons.appendChild(btn);
      });
      redoChoicePanel.classList.remove('hidden');
      redoChoiceButtons.querySelector('button')?.focus();
      return;
    }

    isPending = true;
    const opId = generateUUID();
    const body = {
      expectedRevision: openAnalysis.revision,
      operationId: opId
    };
    if (childId) body.childNodeId = childId;

    const res = await apiRequest(`/api/analyses/${openAnalysis.id}/redo`, 'POST', body);
    isPending = false;

    if (res.ok && res.data) {
      openAnalysis = res.data;
      renderOpenAnalysis();
      announce('Analysis redo: selected child continuation.');
    } else if (res.status === 409) {
      if (res.data?.analysis) openAnalysis = res.data.analysis;
      renderOpenAnalysis();
      showAnalysisFeedback('Analysis updated in another tab');
    } else {
      showAnalysisFeedback(res.data?.error || 'Redo failed');
      renderOpenAnalysis();
    }
  }

  async function handleSelectAnalysisNode(nodeId) {
    if (isPending || !openAnalysis || nodeId === openAnalysis.selectedNodeId) return;
    showAnalysisFeedback('');

    isPending = true;
    const opId = generateUUID();
    const res = await apiRequest(`/api/analyses/${openAnalysis.id}/select`, 'POST', {
      nodeId,
      expectedRevision: openAnalysis.revision,
      operationId: opId
    });

    isPending = false;

    if (res.ok && res.data) {
      openAnalysis = res.data;
      renderOpenAnalysis();
      announce('Selected position node.');
    } else if (res.status === 409) {
      if (res.data?.analysis) openAnalysis = res.data.analysis;
      renderOpenAnalysis();
      showAnalysisFeedback('Analysis updated in another tab');
    } else {
      showAnalysisFeedback(res.data?.error || 'Select node failed');
      renderOpenAnalysis();
    }
  }

  async function handleSaveAnalysisRename() {
    if (isPending || !openAnalysis) return;
    const newName = analysisRenameInput.value.trim();
    if (!newName || newName.length > 60) {
      showAnalysisFeedback('Name must be between 1 and 60 characters');
      return;
    }

    isPending = true;
    const opId = generateUUID();
    const res = await apiRequest(`/api/analyses/${openAnalysis.id}/rename`, 'POST', {
      name: newName,
      expectedRevision: openAnalysis.revision,
      operationId: opId
    });

    isPending = false;

    if (res.ok && res.data) {
      openAnalysis = res.data;
      analysisRenameFormBox.classList.add('hidden');
      renderOpenAnalysis();
      announce(`Renamed analysis to "${openAnalysis.name}"`);
    } else if (res.status === 409) {
      if (res.data?.analysis) openAnalysis = res.data.analysis;
      renderOpenAnalysis();
      showAnalysisFeedback('Analysis updated in another tab');
    } else {
      showAnalysisFeedback(res.data?.error || 'Rename failed');
      renderOpenAnalysis();
    }
  }

  // ==========================================
  // Study Tools: Compare Positions
  // ==========================================

  function populateCompareSelects() {
    if (!openAnalysis || !openAnalysis.treeNodes) return;
    const currentA = compareNodeASelect.value;
    const currentB = compareNodeBSelect.value;

    compareNodeASelect.innerHTML = '';
    compareNodeBSelect.innerHTML = '';

    openAnalysis.treeNodes.forEach(n => {
      let desc = n.parentId ? `Move ${n.moveNumber}: ${n.color} in col ${n.incomingColumn} (Node ${n.id.slice(-6)})` : `[Root] Step ${openAnalysis.sourceStep}`;
      const optA = new Option(desc, n.id);
      const optB = new Option(desc, n.id);
      compareNodeASelect.appendChild(optA);
      compareNodeBSelect.appendChild(optB);
    });

    if (currentA && Array.from(compareNodeASelect.options).some(o => o.value === currentA)) {
      compareNodeASelect.value = currentA;
    } else {
      compareNodeASelect.value = openAnalysis.rootNodeId;
    }

    if (currentB && Array.from(compareNodeBSelect.options).some(o => o.value === currentB)) {
      compareNodeBSelect.value = currentB;
    } else {
      compareNodeBSelect.value = openAnalysis.selectedNodeId;
    }
  }

  async function handleCompareSubmit(e) {
    e.preventDefault();
    if (!openAnalysis) return;

    const nodeAId = compareNodeASelect.value;
    const nodeBId = compareNodeBSelect.value;

    const res = await apiRequest(`/api/analyses/${openAnalysis.id}/compare`, 'POST', {
      nodeAId,
      nodeBId
    });

    if (res.ok && res.data) {
      renderCompareResults(res.data);
    }
  }

  function renderCompareResults(data) {
    compareResultBox.classList.remove('hidden');

    compareSummaryBadge.textContent = `Shared Opening Moves: ${data.sharedOpeningMovesCount} • Differing Cells: ${data.differingCells.length}`;

    compareBoardATitle.textContent = `Position A (Move ${data.nodeA.moveNumber}, ${data.nodeA.turn}'s turn)`;
    compareBoardBTitle.textContent = `Position B (Move ${data.nodeB.moveNumber}, ${data.nodeB.turn}'s turn)`;

    renderGrid(compareGridA, data.nodeA.board, data.nodeA.winningCells, data.differingCells);
    renderGrid(compareGridB, data.nodeB.board, data.nodeB.winningCells, data.differingCells);

    compareDiffList.innerHTML = '';
    if (data.differingCells.length === 0) {
      compareDiffList.innerHTML = '<p class="empty-hint">Both positions have identical boards.</p>';
    } else {
      data.differingCells.forEach(d => {
        const item = document.createElement('div');
        item.className = 'diff-item';
        item.innerHTML = `
          <span><strong>Row ${d.row}, Col ${d.column}</strong> (Cell ${d.index})</span>
          <span>A: <em>${d.occupantA}</em> vs B: <em>${d.occupantB}</em></span>
        `;
        compareDiffList.appendChild(item);
      });
    }

    announce(`Comparison computed: ${data.sharedOpeningMovesCount} shared moves, ${data.differingCells.length} differences.`);
  }

  function handleSwapCompare() {
    const temp = compareNodeASelect.value;
    compareNodeASelect.value = compareNodeBSelect.value;
    compareNodeBSelect.value = temp;
    compareForm.requestSubmit();
  }

  // ==========================================
  // Study Tools: Branch Transplant
  // ==========================================

  function populateTransplantSelects() {
    if (!openAnalysis || !openAnalysis.treeNodes) return;

    // Source Branch: non-root nodes
    transplantSourceNodeSelect.innerHTML = '';
    const nonRootNodes = openAnalysis.treeNodes.filter(n => n.parentId);
    if (nonRootNodes.length === 0) {
      transplantSourceNodeSelect.appendChild(new Option('(No branch moves in this analysis)', ''));
      transplantSourceNodeSelect.disabled = true;
    } else {
      transplantSourceNodeSelect.disabled = false;
      nonRootNodes.forEach(n => {
        const desc = `Move ${n.moveNumber}: Col ${n.incomingColumn} (${n.color}) [Node ${n.id.slice(-6)}]`;
        transplantSourceNodeSelect.appendChild(new Option(desc, n.id));
      });
    }

    // Destination Analysis: all saved analyses
    transplantDestAnalysisSelect.innerHTML = '';
    analysesList.forEach(a => {
      const desc = `${a.name} (Rev ${a.revision})`;
      transplantDestAnalysisSelect.appendChild(new Option(desc, a.id));
    });
    transplantDestAnalysisSelect.value = openAnalysis.id;

    updateDestNodeSelect();
  }

  async function updateDestNodeSelect() {
    const destAnalysisId = transplantDestAnalysisSelect.value;
    if (!destAnalysisId) return;

    let targetAnalysis = openAnalysis;
    if (destAnalysisId !== openAnalysis.id) {
      const res = await apiRequest(`/api/analyses/${destAnalysisId}`);
      if (res.ok && res.data) targetAnalysis = res.data;
    }

    transplantDestNodeSelect.innerHTML = '';
    (targetAnalysis.treeNodes || []).forEach(n => {
      const desc = n.parentId ? `Move ${n.moveNumber}: Col ${n.incomingColumn} (${n.color})` : `[Root] Step ${targetAnalysis.sourceStep}`;
      transplantDestNodeSelect.appendChild(new Option(desc, n.id));
    });
  }

  async function handleTransplantPreview(e) {
    e.preventDefault();
    if (!openAnalysis) return;
    transplantFeedback.classList.add('hidden');
    transplantPreviewResultBox.classList.add('hidden');
    transplantCommitResultBox.classList.add('hidden');

    const sourceNodeId = transplantSourceNodeSelect.value;
    const destAnalysisId = transplantDestAnalysisSelect.value;
    const destNodeId = transplantDestNodeSelect.value;

    if (!sourceNodeId || !destAnalysisId || !destNodeId) {
      transplantFeedback.textContent = 'Please choose valid source branch and destination.';
      transplantFeedback.classList.remove('hidden');
      return;
    }

    const res = await apiRequest(`/api/analyses/${openAnalysis.id}/transplant/preview`, 'POST', {
      sourceNodeId,
      destAnalysisId,
      destNodeId
    });

    if (res.ok && res.data) {
      lastTransplantPreview = res.data;
      renderTransplantPreview(res.data);
    } else {
      let errMsg = res.data?.error || 'Transplant preview failed.';
      if (res.data?.illegalPath) {
        errMsg += ` (Illegal at path: [${res.data.illegalPath.join(', ')}])`;
      }
      transplantFeedback.textContent = errMsg;
      transplantFeedback.classList.remove('hidden');
      announce(errMsg);
    }
  }

  function renderTransplantPreview(preview) {
    transplantPreviewResultBox.classList.remove('hidden');
    transplantPreviewSummary.textContent = `New Nodes to Create: ${preview.newCount} • Reused Nodes: ${preview.reusedCount} • Total Copied: ${preview.previewNodes.length}`;

    transplantPreviewTbody.innerHTML = '';
    preview.previewNodes.forEach(n => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>[${n.relativePath.join(', ')}]</code></td>
        <td>${n.incomingColumn}</td>
        <td>${n.color}</td>
        <td>${n.landingRow}</td>
        <td>${n.status}</td>
        <td>${n.reused ? '<span class="badge badge-source">Reuse Existing</span>' : '<span class="badge badge-yellow-win">Create New</span>'}</td>
      `;
      transplantPreviewTbody.appendChild(tr);
    });

    announce(`Preview ready: ${preview.newCount} new nodes, ${preview.reusedCount} reused.`);
  }

  async function handleTransplantCommit() {
    if (!lastTransplantPreview || !openAnalysis) return;
    transplantFeedback.classList.add('hidden');

    const opId = generateUUID();
    const res = await apiRequest(`/api/analyses/${openAnalysis.id}/transplant/commit`, 'POST', {
      previewId: lastTransplantPreview.previewId,
      operationId: opId
    });

    if (res.ok && res.data) {
      transplantPreviewResultBox.classList.add('hidden');
      transplantCommitResultBox.textContent = `Transplant committed successfully! Created ${res.data.newCount} nodes, reused ${res.data.reusedCount} nodes.`;
      transplantCommitResultBox.classList.remove('hidden');
      announce(transplantCommitResultBox.textContent);

      // Reload analysis
      await openAnalysisById(openAnalysis.id);
      await loadAnalysesList();
    } else if (res.status === 409) {
      transplantFeedback.textContent = res.data?.error || 'Analysis state changed. Please re-preview before committing.';
      transplantFeedback.classList.remove('hidden');
      announce(transplantFeedback.textContent);
    } else {
      transplantFeedback.textContent = res.data?.error || 'Commit failed.';
      transplantFeedback.classList.remove('hidden');
      announce(transplantFeedback.textContent);
    }
  }

  // ==========================================
  // Study Tools: Bounded Tactical Reports
  // ==========================================

  function populateTacticalSelects() {
    if (!openAnalysis || !openAnalysis.treeNodes) return;
    const current = tacticalNodeSelect.value;
    tacticalNodeSelect.innerHTML = '';

    openAnalysis.treeNodes.forEach(n => {
      const desc = n.parentId ? `Move ${n.moveNumber}: Col ${n.incomingColumn} (${n.color})` : `[Root] Step ${openAnalysis.sourceStep}`;
      tacticalNodeSelect.appendChild(new Option(desc, n.id));
    });

    if (current && Array.from(tacticalNodeSelect.options).some(o => o.value === current)) {
      tacticalNodeSelect.value = current;
    } else {
      tacticalNodeSelect.value = openAnalysis.selectedNodeId;
    }
  }

  async function handleTacticalSubmit(e) {
    e.preventDefault();
    if (!openAnalysis) return;
    tacticalFeedback.classList.add('hidden');
    tacticalResultsBox.classList.add('hidden');

    const nodeId = tacticalNodeSelect.value;
    const depth = Number(tacticalDepthSelect.value);

    const res = await apiRequest(`/api/analyses/${openAnalysis.id}/tactical?nodeId=${nodeId}&depth=${depth}`);
    if (res.ok && res.data) {
      renderTacticalResults(res.data);
    } else {
      tacticalFeedback.textContent = res.data?.error || 'Tactical search failed.';
      tacticalFeedback.classList.remove('hidden');
      announce(tacticalFeedback.textContent);
    }
  }

  function renderTacticalResults(report) {
    tacticalResultsBox.classList.remove('hidden');

    tacticalHeaderBadge.textContent = `Search Depth: ${report.depth} ${report.depth === 1 ? 'ply' : 'plies'} • Perspective: ${report.playerToMove}`;

    tacticalColumnsGrid.innerHTML = '';
    if (report.isTerminal) {
      tacticalColumnsGrid.innerHTML = `<div class="card" style="grid-column: 1 / -1;"><p>Position is terminal: <strong>${report.rootOutcome}</strong>. No playable moves.</p></div>`;
    } else {
      report.columns.forEach(colInfo => {
        const card = document.createElement('div');
        card.className = 'tactical-col-card';

        let outcomeClass = 'outcome-unknown';
        if (colInfo.outcome === 'forced_win') outcomeClass = 'outcome-win';
        else if (colInfo.outcome === 'forced_loss') outcomeClass = 'outcome-loss';
        else if (colInfo.outcome === 'forced_draw') outcomeClass = 'outcome-draw';

        card.innerHTML = `
          <div class="tactical-col-header">Column ${colInfo.column}</div>
          <div class="tactical-outcome ${outcomeClass}">${colInfo.description}</div>
        `;
        tacticalColumnsGrid.appendChild(card);
      });
    }

    // Explanation Proof Tree
    tacticalTreeContainer.innerHTML = '';

    function renderProofSubtree(node, depth) {
      const row = document.createElement('div');
      row.className = 'tactical-node-row';
      row.setAttribute('role', 'treeitem');
      row.setAttribute('tabindex', '0');

      let outcomeClass = 'outcome-unknown';
      if (node.outcome === 'forced_win') outcomeClass = 'outcome-win';
      else if (node.outcome === 'forced_loss') outcomeClass = 'outcome-loss';
      else if (node.outcome === 'forced_draw') outcomeClass = 'outcome-draw';

      let leafTag = '';
      if (node.isTerminal) leafTag = ' [Terminal Leaf]';
      else if (node.isHorizon) leafTag = ' [Horizon Leaf]';

      let labelText = '';
      if (node.columnPath.length === 0) {
        labelText = `[Root] (${node.player}'s perspective): ${node.outcome} ${leafTag}`;
      } else {
        labelText = `Path [${node.columnPath.join(', ')}] (${node.perspective}'s perspective): ${node.outcome}${node.distance ? ' in ' + node.distance + ' plies' : ''} ${leafTag}`;
      }

      row.setAttribute('aria-label', labelText);

      const indentSpan = document.createElement('span');
      indentSpan.innerHTML = '&nbsp;'.repeat(depth * 4);
      row.appendChild(indentSpan);

      const dot = document.createElement('span');
      dot.className = `tree-node-color-dot ${node.player === 'Red' ? 'dot-red' : 'dot-yellow'}`;
      row.appendChild(dot);

      const textSpan = document.createElement('span');
      textSpan.className = outcomeClass;
      textSpan.textContent = labelText;
      row.appendChild(textSpan);

      row.addEventListener('click', () => openProofInspector(node));
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openProofInspector(node);
        }
      });

      tacticalTreeContainer.appendChild(row);

      (node.children || []).forEach(child => renderProofSubtree(child, depth + 1));
    }

    if (report.tree) {
      renderProofSubtree(report.tree, 0);
    }

    announce(`Tactical report generated for depth ${report.depth}`);
  }

  function openProofInspector(proofNode) {
    proofNodeMeta.textContent = `Relative Path: [${proofNode.columnPath.join(', ')}] • Player: ${proofNode.player} • Status: ${proofNode.status} • Proof Outcome: ${proofNode.outcome}`;
    renderGrid(proofInspectorGrid, proofNode.board, proofNode.winningCells);
    proofInspectorModal.classList.remove('hidden');
    proofModalCloseBtn.focus();
  }

  function closeProofInspector() {
    proofInspectorModal.classList.add('hidden');
  }

  // ==========================================
  // Event Listeners & Initialization
  // ==========================================

  function setupEventListeners() {
    // Auth
    signInForm.addEventListener('submit', handleSignIn);
    signOutBtn.addEventListener('click', () => handleSignOut(true));

    // Nav Tabs
    tabGameBtn.addEventListener('click', () => switchTab('game'));
    tabArchiveBtn.addEventListener('click', () => switchTab('archive'));
    tabAnalysisBtn.addEventListener('click', () => switchTab('analysis'));

    // Competitive Game Buttons
    gameUndoBtn.addEventListener('click', handleGameUndo);
    gameRedoBtn.addEventListener('click', handleGameRedo);
    gameNewBtn.addEventListener('click', handleGameNew);

    // Active Game Column Controls
    const gameColBtns = document.querySelectorAll('#game-view-panel .col-drop-btn');
    gameColBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const col = Number(btn.getAttribute('data-col'));
        handleColumnDrop(col);
      });
    });
    setupColumnKeyboardNav('#game-view-panel .column-controls');

    // Archive & Replay
    archiveRefreshBtn.addEventListener('click', loadArchive);
    replayCloseBtn.addEventListener('click', () => replayPanel.classList.add('hidden'));

    replayStepSlider.addEventListener('input', (e) => {
      if (openReplay) {
        openReplay.currentStep = Number(e.target.value);
        renderReplayStep();
      }
    });

    replayPrevBtn.addEventListener('click', () => {
      if (openReplay && openReplay.currentStep > 0) {
        openReplay.currentStep--;
        renderReplayStep();
      }
    });

    replayNextBtn.addEventListener('click', () => {
      if (openReplay && openReplay.currentStep < openReplay.moves.length) {
        openReplay.currentStep++;
        renderReplayStep();
      }
    });

    createAnalysisForm.addEventListener('submit', handleCreateAnalysisFromReplay);

    // Analyses List
    analysesRefreshBtn.addEventListener('click', loadAnalysesList);
    analysisBackBtn.addEventListener('click', () => {
      analysisWorkspaceView.classList.add('hidden');
      analysesListView.classList.remove('hidden');
      loadAnalysesList();
    });

    // Rename Analysis
    analysisRenameToggleBtn.addEventListener('click', () => {
      analysisRenameInput.value = openAnalysis?.name || '';
      analysisRenameFormBox.classList.toggle('hidden');
      if (!analysisRenameFormBox.classList.contains('hidden')) {
        analysisRenameInput.focus();
      }
    });
    analysisSaveRenameBtn.addEventListener('click', handleSaveAnalysisRename);
    analysisCancelRenameBtn.addEventListener('click', () => analysisRenameFormBox.classList.add('hidden'));

    // Analysis Practice Controls
    analysisUndoBtn.addEventListener('click', handleAnalysisUndo);
    analysisRedoBtn.addEventListener('click', () => handleAnalysisRedo());

    const analysisColBtns = document.querySelectorAll('#analysis-view-panel .analysis-col-btn');
    analysisColBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const col = Number(btn.getAttribute('data-col'));
        handleAnalysisColumnDrop(col);
      });
    });
    setupColumnKeyboardNav('#analysis-view-panel .column-controls');

    // Study Sub-tabs
    subtabTreeBtn.addEventListener('click', () => switchStudyTab('tree'));
    subtabCompareBtn.addEventListener('click', () => switchStudyTab('compare'));
    subtabTransplantBtn.addEventListener('click', () => switchStudyTab('transplant'));
    subtabTacticalBtn.addEventListener('click', () => switchStudyTab('tactical'));

    // Compare
    compareForm.addEventListener('submit', handleCompareSubmit);
    compareSwapBtn.addEventListener('click', handleSwapCompare);

    // Transplant
    transplantDestAnalysisSelect.addEventListener('change', updateDestNodeSelect);
    transplantPreviewForm.addEventListener('submit', handleTransplantPreview);
    transplantCommitBtn.addEventListener('click', handleTransplantCommit);

    // Tactical
    tacticalForm.addEventListener('submit', handleTacticalSubmit);

    // Modal
    proofModalCloseBtn.addEventListener('click', closeProofInspector);
    proofInspectorModal.addEventListener('click', (e) => {
      if (e.target === proofInspectorModal) closeProofInspector();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !proofInspectorModal.classList.contains('hidden')) {
        closeProofInspector();
      }
    });
  }

  // Initial Boot
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkSession();
  });
})();

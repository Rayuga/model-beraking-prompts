(() => {
  const $ = (id) => document.getElementById(id);
  const TOKEN_KEY = 'brickfall.token';
  const DEMO_PASSWORD = 'password123';

  const app = {
    token: localStorage.getItem(TOKEN_KEY) || '',
    bootstrap: null,
    currentUser: null,
    gameState: null,
    labState: null,
    leaderboard: [],
    recentRuns: [],
    levels: [],
    constants: [],
    drills: [],
    checkpoints: [],
    workbookDigest: '',
    saveInFlight: false,
    saveQueued: false,
    lastAutoSaveAt: 0,
    lastSaveKey: '',
    pausedFrom: 'playing',
    conflictFrozen: false,
    selectedRecord: null,
    input: { left: false, right: false, pointerActive: false, pointerX: 0, launch: false },
    keys: new Set(),
    raf: 0,
    lastFrameAt: 0,
    accumulator: 0,
    initialized: false,
  };

  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  const levelSelect = $('levelSelect');
  const labPresetSelect = $('labPresetSelect');
  const checkpointButtons = $('checkpointButtons');
  const eventList = $('eventList');
  const authPanel = $('authPanel');
  const appPanel = $('appPanel');
  const identityCard = $('identityCard');
  const authMessage = $('authMessage');
  const stateBanner = $('stateBanner');
  const canvasStatus = $('canvasStatus');
  const runStateValue = $('runStateValue');
  const revisionBadge = $('revisionBadge');
  const syncState = $('syncState');
  const workbookDigest = $('workbookDigest');
  const scoreValue = $('scoreValue');
  const livesValue = $('livesValue');
  const levelValue = $('levelValue');
  const comboValue = $('comboValue');
  const powerValue = $('powerValue');
  const timerValue = $('timerValue');
  const stepsValue = $('stepsValue');
  const bestScoreValue = $('bestScoreValue');
  const unlockedValue = $('unlockedValue');
  const revisionValue = $('revisionValue');
  const eventLatest = $('eventLatest');
  const leaderboardBody = $('leaderboardBody');
  const historyBody = $('historyBody');
  const recordDetail = $('recordDetail');
  const labPhase = $('labPhase');
  const labScore = $('labScore');
  const labLives = $('labLives');
  const labCombo = $('labCombo');
  const labPower = $('labPower');
  const labTimer = $('labTimer');
  const labSteps = $('labSteps');
  const labTelemetry = $('labTelemetry');
  const signInForm = $('signInForm');
  const emailInput = $('emailInput');
  const passwordInput = $('passwordInput');
  const demoMira = $('demoMira');
  const demoDev = $('demoDev');
  const demoPolly = $('demoPolly');
  const launchButton = $('launchButton');
  const pauseButton = $('pauseButton');
  const startButton = $('startButton');
  const restartButton = $('restartButton');
  const assistToggle = $('assistToggle');
  const signOutButton = $('signOutButton');
  const authMessageLine = $('authMessage');
  const labLoadButton = $('labLoadButton');
  const labAdvanceButton = $('labAdvanceButton');
  const levelsBody = $('levelsBody');
  const constantsBody = $('constantsBody');
  const identityName = $('identityName');
  const identityEmail = $('identityEmail');
  const identityInitials = $('identityInitials');
  const levelSelectLabel = $('levelSelect');
  const controlElements = [launchButton, pauseButton, startButton, restartButton, assistToggle, signOutButton, labLoadButton, labAdvanceButton];

  function randomHex(bytes = 16) {
    const buf = new Uint8Array(bytes);
    crypto.getRandomValues(buf);
    return Array.from(buf, (value) => value.toString(16).padStart(2, '0')).join('');
  }

  function setMessage(text, target = authMessageLine) {
    target.textContent = text || '';
  }

  function setSync(text) {
    syncState.textContent = text;
  }

  function setBanner(text) {
    stateBanner.textContent = text || '';
  }

  function safeClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function formatSeconds(value) {
    if (value === null || value === undefined) return '—';
    const n = Number(value);
    return Number.isFinite(n) ? `${Math.max(0, Math.ceil(n))}s` : '—';
  }

  async function fetchJson(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (options.auth !== false && app.token) headers.Authorization = `Bearer ${app.token}`;
    const response = await fetch(path, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (response.status === 401) {
      handleUnauthorized();
      const error = new Error(data.error || 'Unauthorized');
      error.status = 401;
      error.data = data;
      throw error;
    }
    if (!response.ok) {
      const error = new Error(data.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function handleUnauthorized() {
    app.token = '';
    localStorage.removeItem(TOKEN_KEY);
    app.bootstrap = null;
    app.currentUser = null;
    app.gameState = null;
    app.labState = null;
    app.conflictFrozen = false;
    setSync('Sign in required');
    setMessage('Your session expired. Please sign in again.');
    authPanel.classList.remove('hidden');
    appPanel.classList.add('hidden');
    identityCard.hidden = true;
    renderAuthOnly();
  }

  function updateDemoFields(email) {
    emailInput.value = email;
    passwordInput.value = DEMO_PASSWORD;
  }

  function populateLevelSelect(highestLevel, selectedLevel) {
    levelSelect.innerHTML = '';
    const maxLevel = Math.max(1, Number(highestLevel || 1));
    for (let level = 1; level <= maxLevel; level += 1) {
      const option = document.createElement('option');
      option.value = String(level);
      option.textContent = `Level ${level}`;
      levelSelect.appendChild(option);
    }
    levelSelect.value = String(Math.min(Number(selectedLevel || 1), maxLevel));
  }

  function populateLabSelects() {
    labPresetSelect.innerHTML = '';
    const drillGroup = document.createElement('optgroup');
    drillGroup.label = 'Drills';
    for (const drill of app.drills) {
      const option = document.createElement('option');
      option.value = `drill:${drill.id}`;
      option.textContent = drill.name;
      drillGroup.appendChild(option);
    }
    labPresetSelect.appendChild(drillGroup);
    const checkpointGroup = document.createElement('optgroup');
    checkpointGroup.label = 'Checkpoints';
    for (const checkpoint of app.checkpoints) {
      const option = document.createElement('option');
      option.value = `checkpoint:${checkpoint.id}`;
      option.textContent = `${checkpoint.id.toUpperCase()} checkpoint`;
      checkpointGroup.appendChild(option);
    }
    labPresetSelect.appendChild(checkpointGroup);
    if (!labPresetSelect.value && labPresetSelect.options.length) {
      labPresetSelect.selectedIndex = 0;
    }
  }

  function renderLevels() {
    levelsBody.innerHTML = app.levels
      .map((level) => {
        const stats = level.stats || { total: 0, normal: 0, strong: 0, solid: 0 };
        return `<tr><td>${level.level}</td><td>${level.name}</td><td>${level.base_speed}</td><td>${level.speed_cap}</td><td>${level.accent}</td><td>${stats.total} <span class="muted">(${stats.normal} normal, ${stats.strong} strong, ${stats.solid} solid)</span></td></tr>`;
      })
      .join('');
  }

  function renderConstants() {
    constantsBody.innerHTML = app.constants
      .map((row) => `<tr><td>${escapeHtml(String(row.key))}</td><td>${escapeHtml(String(row.value))}</td></tr>`)
      .join('');
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function renderLeaderboard() {
    leaderboardBody.innerHTML = app.leaderboard
      .map((row) => `<tr><td>${escapeHtml(row.initials)}</td><td>${row.score.toLocaleString()}</td><td>${row.level}</td><td>${escapeHtml(formatDate(row.achieved_at))}</td></tr>`)
      .join('');
  }

  function renderHistory() {
    historyBody.innerHTML = app.recentRuns
      .map((row, index) => `<tr class="clickable" data-history-index="${index}"><td>${escapeHtml(row.outcome)}</td><td>${row.level}</td><td>${row.score.toLocaleString()}</td><td>${escapeHtml(formatDate(row.finishedAt))}</td></tr>`)
      .join('');
    if (app.selectedRecord) {
      recordDetail.textContent = JSON.stringify(app.selectedRecord.snapshot, null, 2);
    } else {
      recordDetail.textContent = 'Select a run to inspect its terminal snapshot.';
    }
  }

  function renderIdentity() {
    if (!app.currentUser) return;
    identityCard.hidden = false;
    identityName.textContent = app.currentUser.name;
    identityEmail.textContent = app.currentUser.email;
    identityInitials.textContent = app.currentUser.initials;
  }

  function renderProfileNumbers() {
    const progress = app.bootstrap?.progress || {};
    bestScoreValue.textContent = Number(progress.bestScore || 0).toLocaleString();
    unlockedValue.textContent = String(progress.highestLevel || 1);
    revisionValue.textContent = String(progress.revision || 0);
    revisionBadge.textContent = `Revision ${progress.revision || 0}`;
    workbookDigest.textContent = app.workbookDigest ? `Digest ${app.workbookDigest.slice(0, 12)}…` : 'Digest pending';
  }

  function renderControls() {
    const state = app.gameState;
    const hasState = Boolean(state);
    launchButton.disabled = !hasState || !(state.mode === 'ready' || state.mode === 'life-lost' || (state.mode === 'paused' && state.balls.some((ball) => ball.state === 'waiting' || ball.state === 'held')));
    pauseButton.disabled = !hasState || (state.mode !== 'playing' && state.mode !== 'paused' && state.mode !== 'ready' && state.mode !== 'life-lost');
    restartButton.hidden = !(state && (state.mode === 'game-over' || state.mode === 'completed'));
    assistToggle.setAttribute('aria-pressed', state && state.assistPaddle ? 'true' : 'false');
    assistToggle.textContent = `Assist paddle: ${state && state.assistPaddle ? 'on' : 'off'}`;
    pauseButton.textContent = state && state.mode === 'paused' ? 'Resume' : 'Pause';
    runStateValue.textContent = state ? state.mode.toUpperCase() : 'MENU';
    canvasStatus.textContent = state ? describeMode(state) : 'Ready to sign in';
    setBanner(state ? latestEvent(state) : 'Sign in to begin.');
  }

  function describeMode(state) {
    switch (state.mode) {
      case 'ready': return `Ready on level ${state.level}`;
      case 'playing': return `Playing level ${state.level}`;
      case 'paused': return 'Paused';
      case 'life-lost': return 'Serve ready';
      case 'level-complete': return 'Level complete';
      case 'game-over': return 'Game over';
      case 'completed': return 'Run complete';
      default: return state.mode;
    }
  }

  function latestEvent(state) {
    return state.events && state.events.length ? state.events[0] : 'Sign in to begin.';
  }

  function renderHud() {
    const state = app.gameState;
    if (!state) {
      scoreValue.textContent = '0';
      livesValue.textContent = '0';
      levelValue.textContent = '1';
      comboValue.textContent = 'x1';
      powerValue.textContent = 'None';
      timerValue.textContent = '0';
      stepsValue.textContent = '0';
      eventLatest.textContent = 'Sign in to begin.';
      eventList.innerHTML = '';
      canvas.setAttribute('aria-label', 'Brickfall game canvas');
      return;
    }
    scoreValue.textContent = Number(state.score || 0).toLocaleString();
    livesValue.textContent = String(state.lives || 0);
    levelValue.textContent = `${state.level} — ${state.levelName || ''}`;
    comboValue.textContent = `x${state.combo || 1}`;
    powerValue.textContent = state.activePower ? state.activePower.type : 'None';
    timerValue.textContent = state.activePower ? formatSeconds(state.activePower.remaining) : '0s';
    stepsValue.textContent = String(state.stepCount || 0);
    eventLatest.textContent = latestEvent(state);
    eventList.innerHTML = (state.events || []).slice(0, 8).map((event) => `<li>${escapeHtml(event)}</li>`).join('');
    canvas.setAttribute('aria-label', `${describeMode(state)}; score ${state.score}; lives ${state.lives}; combo x${state.combo}; power ${state.activePower ? state.activePower.type : 'none'}`);
  }

  function renderGameAndLab() {
    renderLevels();
    renderConstants();
    renderLeaderboard();
    renderHistory();
    renderIdentity();
    renderProfileNumbers();
    renderControls();
    renderHud();
    renderLab();
    drawCanvas();
  }

  function applyBootstrap(data) {
    app.bootstrap = data;
    app.currentUser = data.user;
    app.levels = data.levels || [];
    app.constants = data.constants || [];
    app.leaderboard = data.leaderboard || [];
    app.recentRuns = data.recentRuns || [];
    app.drills = data.drills || [];
    app.checkpoints = data.checkpoints || [];
    app.workbookDigest = data.workbookDigest || '';
    BrickfallEngine.configure({ levels: app.levels, bricks: data.bricks || [], constants: app.constants });
    populateLevelSelect(data.progress?.highestLevel || 1, data.progress?.selectedLevel || 1);
    populateLabSelects();
    populateCheckpointButtons();
    if (data.activeRun && data.activeRun.snapshot) {
      app.gameState = BrickfallEngine.normalizeSnapshot(data.activeRun.snapshot);
      app.gameState.revision = data.activeRun.revision || data.activeRun.snapshot.revision || 0;
      app.gameState.runId = data.activeRun.run_id || data.activeRun.snapshot.runId;
      app.lastSaveKey = saveKey(app.gameState);
      app.conflictFrozen = false;
    } else if (app.gameState && app.gameState.mode === 'menu') {
      app.gameState = null;
    } else {
      app.gameState = null;
    }
    if (!app.labState && app.drills.length) {
      loadLabPreset(app.drills[0].id, 'drill');
      app.labState = BrickfallEngine.clone(app.labState);
    }
    authPanel.classList.add('hidden');
    appPanel.classList.remove('hidden');
    renderGameAndLab();
    startLoop();
  }

  function renderAuthOnly() {
    authPanel.classList.remove('hidden');
    appPanel.classList.add('hidden');
    renderHud();
  }

  async function signIn(email, password) {
    setMessage('Signing in…');
    try {
      const data = await fetchJson('/api/auth/signin', {
        method: 'POST',
        auth: false,
        body: { email, password },
      });
      app.token = data.token;
      localStorage.setItem(TOKEN_KEY, data.token);
      setMessage('Signed in. Loading profile…');
      applyBootstrap(data.bootstrap);
      setMessage(`Signed in as ${data.bootstrap.user.name}.`);
      setSync(`Revision ${data.bootstrap.progress.revision || 0} synced`);
    } catch (error) {
      setMessage(error.message || 'Sign-in failed');
    }
  }

  async function loadBootstrapFromToken() {
    if (!app.token) {
      renderAuthOnly();
      return;
    }
    setSync('Loading profile…');
    try {
      const data = await fetchJson('/api/bootstrap');
      applyBootstrap(data);
      setMessage(`Welcome back, ${data.user.name}.`);
      setSync(`Revision ${data.progress.revision || 0} synced`);
    } catch (error) {
      if (error.status !== 401) setMessage(error.message || 'Could not load profile');
    }
  }

  function chooseLevel() {
    return Number(levelSelect.value || app.bootstrap?.progress?.selectedLevel || 1);
  }

  async function startRun() {
    if (!app.bootstrap || !app.token) return;
    const level = chooseLevel();
    const selectedLevel = level;
    const runId = `run-${randomHex(16)}`;
    const snapshot = BrickfallEngine.createBaseState(level, selectedLevel, runId);
    snapshot.runId = runId;
    snapshot.selectedLevel = selectedLevel;
    snapshot.revision = app.bootstrap.progress.revision || 0;
    setSync('Starting run…');
    try {
      const data = await fetchJson('/api/run/start', {
        method: 'POST',
        body: {
          operationId: randomHex(16),
          expectedRevision: app.bootstrap.progress.revision || 0,
          snapshot,
        },
      });
      syncFromMutation(data, 'Run started');
    } catch (error) {
      handleMutationError(error, 'Could not start run');
    }
  }

  async function restartAfterGameOver() {
    if (!app.gameState) return startRun();
    const level = Number(levelSelect.value || app.gameState.selectedLevel || app.gameState.level || 1);
    const runId = `run-${randomHex(16)}`;
    const snapshot = BrickfallEngine.createBaseState(level, level, runId);
    snapshot.revision = app.gameState.revision || app.bootstrap?.progress?.revision || 0;
    setSync('Restarting…');
    try {
      const data = await fetchJson('/api/run/start', {
        method: 'POST',
        body: {
          operationId: randomHex(16),
          expectedRevision: app.gameState.revision || app.bootstrap?.progress?.revision || 0,
          snapshot,
        },
      });
      syncFromMutation(data, 'Run restarted');
    } catch (error) {
      handleMutationError(error, 'Could not restart run');
    }
  }

  async function continueLevel() {
    if (!app.gameState || app.gameState.mode !== 'level-complete') return;
    const nextState = BrickfallEngine.createNextLevelState(app.gameState, app.gameState.runId);
    nextState.revision = app.gameState.revision || 0;
    setSync('Continuing…');
    try {
      const data = await fetchJson('/api/run/progress', {
        method: 'POST',
        body: {
          operationId: randomHex(16),
          expectedRevision: app.gameState.revision || 0,
          snapshot: nextState,
        },
      });
      syncFromMutation(data, `Level ${nextState.level} unlocked`);
    } catch (error) {
      handleMutationError(error, 'Could not continue to the next level');
    }
  }

  async function saveRun(reason = 'Save', immediate = false) {
    if (!app.gameState || !app.token || app.gameState.mode === 'menu') return;
    const key = saveKey(app.gameState);
    if (!immediate && key === app.lastSaveKey) return;
    if (app.saveInFlight) {
      app.saveQueued = true;
      return;
    }
    app.saveInFlight = true;
    setSync(reason + '…');
    try {
      const data = await fetchJson('/api/run/save', {
        method: 'POST',
        body: {
          operationId: randomHex(16),
          expectedRevision: app.gameState.revision || app.bootstrap?.progress?.revision || 0,
          snapshot: BrickfallEngine.clone(app.gameState),
        },
      });
      syncFromMutation(data, 'Saved');
      app.lastSaveKey = saveKey(app.gameState);
      app.lastAutoSaveAt = performance.now();
    } catch (error) {
      handleMutationError(error, 'Could not save run');
    } finally {
      app.saveInFlight = false;
      if (app.saveQueued) {
        app.saveQueued = false;
        saveRun('Saving queued state', true);
      }
    }
  }

  async function finishRun(outcome) {
    if (!app.gameState || !app.token) return;
    const snapshot = BrickfallEngine.clone(app.gameState);
    snapshot.outcome = outcome;
    snapshot.terminal = outcome;
    snapshot.finishedAt = new Date().toISOString();
    snapshot.mode = outcome;
    snapshot.phase = outcome;
    setSync('Finishing run…');
    try {
      const data = await fetchJson('/api/run/finish', {
        method: 'POST',
        body: {
          operationId: randomHex(16),
          expectedRevision: app.gameState.revision || app.bootstrap?.progress?.revision || 0,
          snapshot,
        },
      });
      syncFromMutation(data, outcome === 'completed' ? 'Run completed' : 'Game over');
      app.lastSaveKey = saveKey(app.gameState);
    } catch (error) {
      handleMutationError(error, 'Could not finish run');
    }
  }

  function syncFromMutation(data, message) {
    if (data.progress) {
      app.bootstrap.progress = data.progress;
      revisionValue.textContent = String(data.progress.revision || 0);
      revisionBadge.textContent = `Revision ${data.progress.revision || 0}`;
      bestScoreValue.textContent = Number(data.progress.bestScore || 0).toLocaleString();
      unlockedValue.textContent = String(data.progress.highestLevel || 1);
    }
    if (data.leaderboard) {
      app.leaderboard = data.leaderboard;
      renderLeaderboard();
    }
    if (data.recentRuns) {
      app.recentRuns = data.recentRuns;
      renderHistory();
    }
    if (data.snapshot) {
      app.gameState = BrickfallEngine.normalizeSnapshot(data.snapshot.snapshot || data.snapshot);
      if (data.snapshot.revision) app.gameState.revision = data.snapshot.revision;
      if (data.snapshot.run_id) app.gameState.runId = data.snapshot.run_id;
      if (data.snapshot.runId) app.gameState.runId = data.snapshot.runId;
    }
    if (data.activeRun && data.activeRun.snapshot) {
      app.gameState = BrickfallEngine.normalizeSnapshot(data.activeRun.snapshot);
      app.gameState.revision = data.activeRun.revision || app.gameState.revision || 0;
      app.gameState.runId = data.activeRun.run_id || app.gameState.runId;
    }
    if (app.gameState) {
      app.gameState.revision = data.progress?.revision || app.gameState.revision || 0;
      app.lastSaveKey = saveKey(app.gameState);
      if (data.progress?.selectedLevel) levelSelect.value = String(data.progress.selectedLevel);
    }
    setMessage(message || data.message || 'Updated.');
    setSync(`Revision ${app.gameState ? app.gameState.revision : data.progress?.revision || 0} synced`);
    app.conflictFrozen = false;
    renderGameAndLab();
    startLoop();
  }

  function handleMutationError(error, fallbackMessage) {
    if (error.status === 409 && error.data) {
      if (error.data.activeRun && error.data.activeRun.snapshot) {
        app.gameState = BrickfallEngine.normalizeSnapshot(error.data.activeRun.snapshot);
        app.gameState.revision = error.data.currentRevision || app.gameState.revision || 0;
        app.gameState.mode = 'paused';
        app.gameState.phase = 'paused';
        BrickfallEngine.pushEvent(app.gameState, `Revision ${error.data.currentRevision} won on another tab`);
        app.conflictFrozen = true;
        app.lastSaveKey = saveKey(app.gameState);
      }
      app.bootstrap.progress = error.data.progress || app.bootstrap.progress;
      app.leaderboard = error.data.leaderboard || app.leaderboard;
      app.recentRuns = error.data.recentRuns || app.recentRuns;
      setMessage(`Revision ${error.data.currentRevision} won. Active play frozen.`);
      setSync(`Revision ${error.data.currentRevision} won`);
      renderGameAndLab();
      return;
    }
    if (error.status === 401) {
      handleUnauthorized();
      return;
    }
    setMessage(fallbackMessage || error.message || 'Request failed');
    setSync('Sync error');
  }

  function saveKey(state) {
    const effectRemaining = state.activePower ? Math.ceil(Number(state.activePower.remaining || 0)) : 0;
    const bricksLeft = (state.bricks || []).filter((brick) => !brick.destroyed).length;
    return [state.mode, state.level, state.score, state.lives, state.combo, state.nextExtraLife, state.activePower ? state.activePower.type : 'none', effectRemaining, bricksLeft, (state.drops || []).length].join('|');
  }

  function maybeAutoSave() {
    if (!app.gameState || app.gameState.mode !== 'playing' || !app.token || app.conflictFrozen) return;
    const now = performance.now();
    const key = saveKey(app.gameState);
    if (key !== app.lastSaveKey) {
      saveRun('Saving', false);
      return;
    }
    if (now - app.lastAutoSaveAt >= 2800) {
      saveRun('Auto-saving', true);
    }
  }

  function handleGameStateTransitions(prevMode, currentMode) {
    if (!app.gameState) return;
    if (currentMode !== prevMode) {
      if (currentMode === 'level-complete') {
        setMessage(`Level ${app.gameState.level} cleared. Continue to advance.`);
        saveRun('Saving level completion', true);
      } else if (currentMode === 'game-over') {
        setMessage('Game over. Restart to try again.');
        finishRun('game-over');
      } else if (currentMode === 'completed') {
        setMessage('Run complete! Your result was recorded.');
        finishRun('completed');
      } else if (currentMode === 'life-lost') {
        setMessage('One life lost. Launch the serve ball to continue.');
        saveRun('Saving life loss', true);
      } else if (currentMode === 'paused') {
        setMessage('Paused.');
      }
      renderControls();
    }
  }

  function stepGame(now) {
    if (!app.gameState || app.conflictFrozen) {
      app.lastFrameAt = now;
      app.raf = requestAnimationFrame(stepGame);
      return;
    }
    if (!app.lastFrameAt) app.lastFrameAt = now;
    const dtMs = Math.min(64, now - app.lastFrameAt);
    app.lastFrameAt = now;
    const prevMode = app.gameState.mode;
    if (app.gameState.mode === 'playing') {
      app.accumulator += dtMs / 1000;
      while (app.accumulator >= 1 / 120) {
        BrickfallEngine.stepOne(app.gameState, app.input, { force: false });
        app.accumulator -= 1 / 120;
        if (app.gameState.mode === 'game-over' || app.gameState.mode === 'completed' || app.gameState.mode === 'level-complete' || app.gameState.mode === 'life-lost') {
          break;
        }
      }
    } else if (app.gameState.mode === 'ready' || app.gameState.mode === 'life-lost') {
      BrickfallEngine.stepOne(app.gameState, app.input, { force: false });
      app.accumulator = 0;
    } else {
      app.accumulator = 0;
    }
    const currentMode = app.gameState.mode;
    handleGameStateTransitions(prevMode, currentMode);
    renderGameAndLab();
    maybeAutoSave();
    app.raf = requestAnimationFrame(stepGame);
  }

  function startLoop() {
    if (app.raf) cancelAnimationFrame(app.raf);
    app.lastFrameAt = 0;
    app.accumulator = 0;
    app.raf = requestAnimationFrame(stepGame);
  }

  function drawCanvas() {
    const state = app.gameState;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const accent = state ? (app.levels.find((level) => level.level === state.level)?.accent || '#6bd1ff') : '#6bd1ff';
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#06111e');
    bg.addColorStop(1, '#081323');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = '#9cc7ff';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }
    for (let x = 0; x < width; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }
    ctx.restore();

    if (!state) {
      drawOverlay('Sign in to start', 'Mira, Dev, and Polly have seeded demo profiles.');
      return;
    }

    drawBricks(state, accent);
    drawDrops(state);
    drawPaddle(state, accent);
    drawBalls(state, accent);
    drawBounds(accent);

    const overlay = overlayText(state);
    if (overlay) drawOverlay(overlay.title, overlay.subtitle, accent);
  }

  function drawBounds(accent) {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    ctx.restore();
  }

  function drawBricks(state, accent) {
    for (const brick of state.bricks || []) {
      if (brick.destroyed) continue;
      const palette = brick.type === 'solid'
        ? ['#303847', '#566173']
        : brick.type === 'strong'
          ? (brick.damaged ? ['#fbbf24', '#8b5cf6'] : ['#f59e0b', '#f97316'])
          : [accent, '#d7f7ff'];
      const gradient = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.height);
      gradient.addColorStop(0, palette[0]);
      gradient.addColorStop(1, palette[1]);
      ctx.fillStyle = gradient;
      roundRect(brick.x, brick.y, brick.width, brick.height, 7, true, true);
      if (brick.type === 'solid') {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        for (let i = brick.x - brick.height; i < brick.x + brick.width + brick.height; i += 16) {
          ctx.beginPath();
          ctx.moveTo(i, brick.y + brick.height);
          ctx.lineTo(i + 14, brick.y);
          ctx.stroke();
        }
        ctx.restore();
      } else if (brick.type === 'strong') {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#ffffff';
        if (brick.damaged) {
          ctx.fillRect(brick.x + 6, brick.y + brick.height - 7, brick.width - 12, 3);
        } else {
          ctx.fillRect(brick.x + 6, brick.y + 6, brick.width - 12, 3);
          ctx.fillRect(brick.x + 6, brick.y + brick.height - 9, brick.width - 12, 3);
        }
        ctx.restore();
      }
    }
  }

  function drawPaddle(state, accent) {
    const paddle = state.paddle;
    const gradient = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.height);
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(1, accent);
    ctx.fillStyle = gradient;
    roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 9, true, false);
    if (state.assistPaddle) {
      ctx.save();
      ctx.strokeStyle = '#9cf4a2';
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.strokeRect(paddle.x - 2, paddle.y - 2, paddle.width + 4, paddle.height + 4);
      ctx.restore();
    }
  }

  function drawBalls(state, accent) {
    for (const ball of state.balls || []) {
      ctx.save();
      if (ball.state === 'held') {
        ctx.strokeStyle = '#9cf4a2';
        ctx.lineWidth = 2;
      }
      ctx.fillStyle = ball.primary ? '#ffffff' : accent;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (ball.state === 'held') {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawDrops(state) {
    for (const drop of state.drops || []) {
      const style = dropStyle(drop.type);
      ctx.save();
      ctx.fillStyle = style.fill;
      ctx.strokeStyle = style.stroke;
      roundRect(drop.x, drop.y, 20, 20, 8, true, true);
      ctx.fillStyle = '#06111e';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(style.label, drop.x + 10, drop.y + 10.5);
      ctx.restore();
    }
  }

  function dropStyle(type) {
    switch (type) {
      case 'wide': return { fill: '#2dd4bf', stroke: '#0f766e', label: 'W' };
      case 'slow': return { fill: '#60a5fa', stroke: '#1d4ed8', label: 'S' };
      case 'multiball': return { fill: '#f59e0b', stroke: '#b45309', label: 'M' };
      case 'sticky': return { fill: '#fb7185', stroke: '#be123c', label: 'Y' };
      default: return { fill: '#a78bfa', stroke: '#6d28d9', label: '?' };
    }
  }

  function overlayText(state) {
    switch (state.mode) {
      case 'ready': return { title: 'Ready', subtitle: 'Press Launch or Space to begin the level.' };
      case 'paused': return { title: 'Paused', subtitle: 'Press P or Esc to resume.' };
      case 'life-lost': return { title: 'Serve ready', subtitle: 'Press Launch or Space to launch the next serve.' };
      case 'level-complete': return { title: 'Level complete', subtitle: 'Press Continue or Enter to advance.' };
      case 'game-over': return { title: 'Game over', subtitle: 'Press Restart to try again.' };
      case 'completed': return { title: 'Run complete', subtitle: 'Your score has been recorded.' };
      default: return null;
    }
  }

  function drawOverlay(title, subtitle, accent = '#6bd1ff') {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 42px Inter, sans-serif';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 18);
    ctx.font = '500 18px Inter, sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 24);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r, fill = true, stroke = false) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function renderLab() {
    if (!app.labState) {
      labPhase.textContent = '—';
      labScore.textContent = '—';
      labLives.textContent = '—';
      labCombo.textContent = '—';
      labPower.textContent = '—';
      labTimer.textContent = '—';
      labSteps.textContent = '—';
      labTelemetry.textContent = 'Load a drill to inspect the exact engine state.';
      return;
    }
    const summary = BrickfallEngine.renderSummary(app.labState);
    labPhase.textContent = summary.phase;
    labScore.textContent = Number(summary.score || 0).toLocaleString();
    labLives.textContent = String(summary.lives || 0);
    labCombo.textContent = `x${summary.combo || 1}`;
    labPower.textContent = summary.effect ? `${summary.effect.type}` : 'None';
    labTimer.textContent = formatSeconds(summary.effect ? summary.effect.remaining : 0);
    labSteps.textContent = String(summary.steps || 0);
    const ballLines = summary.balls.map((ball) => `${ball.id} | ${ball.state}${ball.primary ? ' primary' : ''} | (${ball.x.toFixed(1)}, ${ball.y.toFixed(1)}) | vx ${ball.vx.toFixed(1)} vy ${ball.vy.toFixed(1)}`).join('\n');
    const dropLines = summary.items.length ? summary.items.map((item) => `${item.id} | ${item.type} | (${item.x.toFixed(1)}, ${item.y.toFixed(1)})`).join('\n') : 'none';
    const brickLines = summary.bricks.map((brick) => `${brick.id} | ${brick.type} | destroyed=${brick.destroyed} damaged=${brick.damaged} hp=${brick.hp}`).join('\n');
    labTelemetry.textContent = [
      `Phase: ${summary.phase}`,
      `Score: ${summary.score}`,
      `Lives: ${summary.lives}`,
      `Combo: x${summary.combo}`,
      `Ball states:`,
      ballLines || 'none',
      `Items:`,
      dropLines,
      `Bricks:`,
      brickLines || 'none',
      `Paddle width: ${summary.paddle.width}`,
      `Effect: ${summary.effect ? `${summary.effect.type} (${formatSeconds(summary.effect.remaining)})` : 'none'}`,
      `Steps: ${summary.steps}`,
    ].join('\n');
  }

  function loadLabPreset(kindOrId, type = 'auto') {
    if (!app.bootstrap) return;
    let preset = null;
    if (type === 'drill' || kindOrId.startsWith('drill:')) {
      const drillId = kindOrId.replace('drill:', '');
      preset = app.drills.find((item) => item.id === drillId)?.preset;
    } else if (type === 'checkpoint' || kindOrId.startsWith('checkpoint:')) {
      const checkpointId = kindOrId.replace('checkpoint:', '');
      preset = app.checkpoints.find((item) => item.id === checkpointId)?.preset;
    } else {
      preset = app.drills.find((item) => item.id === kindOrId)?.preset || app.checkpoints.find((item) => item.id === kindOrId)?.preset;
    }
    if (!preset) return;
    app.labState = BrickfallEngine.normalizeSnapshot(preset);
    app.labState.events = Array.isArray(app.labState.events) ? app.labState.events : [];
    app.labState.stepCount = 0;
    app.labState.simulationSeconds = 0;
    app.labState.revision = 0;
    setMessage(`Loaded lab ${app.labState.levelName || kindOrId}.`);
    renderLab();
  }

  function populateCheckpointButtons() {
    checkpointButtons.innerHTML = '';
    for (const checkpoint of app.checkpoints) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${checkpoint.id.toUpperCase()} checkpoint`;
      button.addEventListener('click', () => {
        labPresetSelect.value = `checkpoint:${checkpoint.id}`;
        loadLabPreset(`checkpoint:${checkpoint.id}`, 'checkpoint');
      });
      checkpointButtons.appendChild(button);
    }
  }

  function togglePause() {
    if (!app.gameState) return;
    if (app.gameState.mode === 'paused') {
      app.gameState.mode = app.pausedFrom || 'playing';
      app.gameState.phase = app.gameState.mode;
      BrickfallEngine.pushEvent(app.gameState, 'Resumed');
      setMessage('Resumed.');
      renderGameAndLab();
      saveRun('Saving resume', true);
      return;
    }
    if (app.gameState.mode === 'playing' || app.gameState.mode === 'ready' || app.gameState.mode === 'life-lost') {
      app.pausedFrom = app.gameState.mode;
      app.gameState.mode = 'paused';
      app.gameState.phase = 'paused';
      BrickfallEngine.pushEvent(app.gameState, 'Paused');
      setMessage('Paused.');
      renderGameAndLab();
      saveRun('Saving pause', true);
    }
  }

  function toggleAssist() {
    if (!app.gameState) return;
    app.gameState.assistPaddle = !app.gameState.assistPaddle;
    if (app.gameState.assistPaddle) BrickfallEngine.pushEvent(app.gameState, 'Assist paddle enabled');
    else BrickfallEngine.pushEvent(app.gameState, 'Assist paddle disabled');
    renderGameAndLab();
    saveRun('Saving assist toggle', false);
  }

  function requestLaunch() {
    if (!app.gameState) return;
    if (app.gameState.mode === 'ready' || app.gameState.mode === 'life-lost' || (app.gameState.mode === 'paused' && app.gameState.balls.some((ball) => ball.state === 'waiting' || ball.state === 'held'))) {
      BrickfallEngine.handleLaunchKey(app.gameState);
      setMessage('Launch!');
      renderGameAndLab();
      saveRun('Saving launch', false);
    }
  }

  function maybeContinueOrRestart(event) {
    if (!app.gameState) return;
    if (event.key === 'Enter' && app.gameState.mode === 'level-complete') {
      event.preventDefault();
      continueLevel();
      return;
    }
    if ((event.key === 'r' || event.key === 'R') && (app.gameState.mode === 'game-over' || app.gameState.mode === 'completed')) {
      event.preventDefault();
      restartAfterGameOver();
    }
  }

  function onPointerMove(event) {
    if (!app.gameState) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    app.input.pointerActive = true;
    app.input.pointerX = x;
    app.input.left = false;
    app.input.right = false;
    app.gameState.assistPaddle = false;
  }

  function onPointerDown(event) {
    canvas.setPointerCapture?.(event.pointerId);
    onPointerMove(event);
  }

  function onPointerUp() {
    app.input.pointerActive = false;
  }

  function updateKeyboardInput(event, down) {
    const key = event.key;
    const target = event.target;
    const isTyping = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    if (isTyping) return;
    if (key === 'ArrowLeft') {
      app.input.left = down;
      if (down && app.gameState) app.gameState.assistPaddle = false;
      return;
    }
    if (key === 'ArrowRight') {
      app.input.right = down;
      if (down && app.gameState) app.gameState.assistPaddle = false;
      return;
    }
    if (!down) return;
    if (key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      requestLaunch();
      return;
    }
    if (key === 'p' || key === 'P' || key === 'Escape') {
      event.preventDefault();
      togglePause();
      return;
    }
    maybeContinueOrRestart(event);
  }

  function wireEvents() {
    signInForm.addEventListener('submit', (event) => {
      event.preventDefault();
      signIn(emailInput.value.trim(), passwordInput.value);
    });
    demoMira.addEventListener('click', () => updateDemoFields('mira@brickfall.test'));
    demoDev.addEventListener('click', () => updateDemoFields('dev@brickfall.test'));
    demoPolly.addEventListener('click', () => updateDemoFields('polly@brickfall.test'));
    signOutButton.addEventListener('click', async () => {
      if (!app.token) return handleUnauthorized();
      try {
        await fetchJson('/api/auth/signout', { method: 'POST' });
      } catch (error) {
        if (error.status !== 401) setMessage(error.message || 'Sign-out failed');
      }
      handleUnauthorized();
      setMessage('Signed out.');
    });
    startButton.addEventListener('click', startRun);
    launchButton.addEventListener('click', requestLaunch);
    pauseButton.addEventListener('click', togglePause);
    restartButton.addEventListener('click', restartAfterGameOver);
    assistToggle.addEventListener('click', toggleAssist);
    labLoadButton.addEventListener('click', () => loadLabPreset(labPresetSelect.value));
    labAdvanceButton.addEventListener('click', () => {
      if (!app.labState) return;
      BrickfallEngine.advanceForDrill(app.labState, 1, app.input);
      app.labState.mode = app.labState.mode === 'playing' ? 'paused' : app.labState.mode;
      renderLab();
    });
    labPresetSelect.addEventListener('change', () => loadLabPreset(labPresetSelect.value));
    levelSelect.addEventListener('change', () => {
      if (app.currentUser) {
        setMessage(`Selected ${levelSelect.value}. Start to begin from this unlocked level.`);
      }
    });
    historyBody.addEventListener('click', (event) => {
      const row = event.target.closest('tr[data-history-index]');
      if (!row) return;
      const index = Number(row.dataset.historyIndex);
      app.selectedRecord = app.recentRuns[index] || null;
      renderHistory();
    });
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);
    window.addEventListener('keydown', (event) => updateKeyboardInput(event, true));
    window.addEventListener('keyup', (event) => {
      if (event.key === 'ArrowLeft') app.input.left = false;
      if (event.key === 'ArrowRight') app.input.right = false;
      if (event.key === ' ') app.input.launch = false;
    });
    window.addEventListener('storage', (event) => {
      if (event.key === TOKEN_KEY) {
        app.token = event.newValue || '';
        if (!app.token) handleUnauthorized();
        else loadBootstrapFromToken();
      }
    });
  }

  function init() {
    if (app.initialized) return;
    app.initialized = true;
    wireEvents();
    if (app.token) {
      loadBootstrapFromToken();
    } else {
      renderAuthOnly();
      renderGameAndLab();
    }
    renderLab();
  }

  canvas.addEventListener('click', () => canvas.focus());

  window.addEventListener('resize', () => {
    renderGameAndLab();
  });

  document.addEventListener('DOMContentLoaded', init);

  if (document.readyState !== 'loading') init();
})();

// /app/public/game.js - Client Game Controller, Renderer, and Mechanics Lab

(function () {
  'use strict';

  // State Variables
  let currentUser = null;
  let authToken = localStorage.getItem('brickfall_token') || null;
  let activeRun = null;
  let engine = null;
  let labEngine = null;
  let labStepCounter = 0;
  let isLabActive = false;
  let isMutating = false;
  let assistEnabled = false;
  let lastFrameTime = performance.now();
  let accumulator = 0;
  let saveTimer = null;
  let levelsData = [];
  let constantsData = [];
  let drillsData = [];
  let keys = { left: false, right: false };

  // DOM Elements
  const authSection = document.getElementById('auth-section');
  const gameSection = document.getElementById('game-section');
  const authStatusBar = document.getElementById('auth-status-bar');
  const userInitials = document.getElementById('user-initials');
  const userName = document.getElementById('user-name');
  const userEmail = document.getElementById('user-email');
  const revTag = document.getElementById('rev-tag');
  const syncDot = document.getElementById('sync-dot');
  const syncText = document.getElementById('sync-text');
  const syncNotice = document.getElementById('sync-notice');

  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const btnLogout = document.getElementById('btn-logout');

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const canvasOverlay = document.getElementById('canvas-overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayDesc = document.getElementById('overlay-desc');
  const overlayButtons = document.getElementById('overlay-buttons');

  const hudScore = document.getElementById('hud-score');
  const hudLives = document.getElementById('hud-lives');
  const hudLevel = document.getElementById('hud-level');
  const hudCombo = document.getElementById('hud-combo');
  const hudPower = document.getElementById('hud-power');
  const hudStatus = document.getElementById('hud-status');
  const latestEventPill = document.getElementById('latest-event');
  const eventLogList = document.getElementById('event-log-list');

  const btnLaunch = document.getElementById('btn-launch');
  const btnPause = document.getElementById('btn-pause');
  const btnRestart = document.getElementById('btn-restart');
  const btnAssist = document.getElementById('btn-assist');
  const assistStateText = document.getElementById('assist-state-text');
  const selectLevel = document.getElementById('select-level');
  const btnNewRun = document.getElementById('btn-new-run');

  const touchLeft = document.getElementById('touch-left');
  const touchRight = document.getElementById('touch-right');
  const touchLaunch = document.getElementById('touch-launch');

  const leaderboardTbody = document.getElementById('leaderboard-tbody');
  const btnRefreshLb = document.getElementById('btn-refresh-lb');
  const runsTbody = document.getElementById('runs-tbody');
  const btnRefreshRuns = document.getElementById('btn-refresh-runs');

  // Lab Elements
  const labModal = document.getElementById('lab-modal');
  const btnLabToggle = document.getElementById('btn-lab-toggle');
  const btnCloseLab = document.getElementById('btn-close-lab');
  const tabDrillsBtn = document.getElementById('tab-drills-btn');
  const tabLevelsBtn = document.getElementById('tab-levels-btn');
  const tabConstantsBtn = document.getElementById('tab-constants-btn');
  const tabDrills = document.getElementById('tab-drills');
  const tabLevels = document.getElementById('tab-levels');
  const tabConstants = document.getElementById('tab-constants');
  const selectDrill = document.getElementById('select-drill');
  const drillDescText = document.getElementById('drill-desc-text');
  const btnLoadDrill = document.getElementById('btn-load-drill');
  const btnAdvanceDrill = document.getElementById('btn-advance-drill');
  const btnDrillLaunch = document.getElementById('btn-drill-launch');

  const tSteps = document.getElementById('t-steps');
  const tStatus = document.getElementById('t-status');
  const tScore = document.getElementById('t-score');
  const tLives = document.getElementById('t-lives');
  const tCombo = document.getElementById('t-combo');
  const tPaddleWidth = document.getElementById('t-paddle-width');
  const tPower = document.getElementById('t-power');
  const tBallsCount = document.getElementById('t-balls-count');
  const tBallsList = document.getElementById('t-balls-list');
  const tDropsCount = document.getElementById('t-drops-count');
  const tDropsList = document.getElementById('t-drops-list');
  const tBricksCount = document.getElementById('t-bricks-count');
  const tBricksList = document.getElementById('t-bricks-list');
  const levelsTableTbody = document.getElementById('levels-table-tbody');
  const constantsTableTbody = document.getElementById('constants-table-tbody');

  // Snapshot Modal
  const snapshotModal = document.getElementById('snapshot-modal');
  const btnCloseSnapshot = document.getElementById('btn-close-snapshot');
  const snapshotJson = document.getElementById('snapshot-json');

  // -------------------------------------------------------------
  // API Helpers
  // -------------------------------------------------------------
  function generateOpId() {
    return 'op_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
  }

  async function apiFetch(url, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (authToken) {
      headers['Authorization'] = 'Bearer ' + authToken;
    }

    const res = await fetch(url, Object.assign({}, options, { headers }));
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      // Discard token and show sign in
      handleSignOut();
      return { status: 401, error: 'Unauthorized', data };
    }

    return { status: res.status, data };
  }

  function setSyncStatus(state, msg = '') {
    syncDot.className = 'sync-dot ' + (state || '');
    if (state === 'conflict') {
      syncText.textContent = 'Conflict';
      syncNotice.textContent = msg || 'Sync conflict detected. Reconciled with server.';
      syncNotice.classList.remove('hidden');
    } else if (state === 'syncing') {
      syncText.textContent = 'Syncing...';
      syncNotice.classList.add('hidden');
    } else {
      syncText.textContent = 'Synced';
      syncNotice.classList.add('hidden');
    }
  }

  // -------------------------------------------------------------
  // Authentication Handlers
  // -------------------------------------------------------------
  async function handleLogin(email, password) {
    loginError.classList.add('hidden');
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (res.status === 200) {
      authToken = res.data.token;
      localStorage.setItem('brickfall_token', authToken);
      currentUser = res.data.user;
      activeRun = res.data.active_run;
      initUserSession();
    } else {
      loginError.textContent = res.data.error || 'Login failed';
      loginError.classList.remove('hidden');
    }
  }

  async function handleSignOut() {
    if (authToken) {
      await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    }
    authToken = null;
    currentUser = null;
    activeRun = null;
    localStorage.removeItem('brickfall_token');

    authStatusBar.classList.add('hidden');
    gameSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    labModal.classList.add('hidden');
    snapshotModal.classList.add('hidden');
  }

  async function checkExistingSession() {
    if (!authToken) {
      authSection.classList.remove('hidden');
      return;
    }

    const res = await apiFetch('/api/auth/me');
    if (res.status === 200) {
      currentUser = res.data.user;
      activeRun = res.data.active_run;
      initUserSession();
    } else {
      handleSignOut();
    }
  }

  function initUserSession() {
    authSection.classList.add('hidden');
    authStatusBar.classList.remove('hidden');
    gameSection.classList.remove('hidden');

    userInitials.textContent = currentUser.initials;
    userName.textContent = currentUser.name;
    userEmail.textContent = currentUser.email;
    revTag.textContent = `Rev #${currentUser.revision}`;
    setSyncStatus('synced');

    // Populate level select
    updateLevelSelect();
    loadLeaderboard();
    loadPersonalRuns();
    loadLevelsAndConstants();

    // Start game from active run or ready state
    if (activeRun) {
      engine = new GameEngine(activeRun);
      addEvent(`Resumed level ${engine.level} checkpoint`);
    } else {
      startNewGame(1);
    }

    updateUI();
  }

  function updateLevelSelect() {
    selectLevel.innerHTML = '';
    const maxLvl = currentUser ? currentUser.highest_level : 1;
    for (let i = 1; i <= 10; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Level ${i}` + (i > maxLvl ? ' (Locked)' : '');
      opt.disabled = i > maxLvl;
      if (engine && engine.level === i) opt.selected = true;
      selectLevel.appendChild(opt);
    }
  }

  // -------------------------------------------------------------
  // Game Actions & Server Coordination
  // -------------------------------------------------------------
  async function startNewGame(levelNum) {
    if (isMutating) return;
    isMutating = true;
    setSyncStatus('syncing');

    const opId = generateOpId();
    const res = await apiFetch('/api/game/start', {
      method: 'POST',
      body: JSON.stringify({
        expected_revision: currentUser.revision,
        operation_id: opId,
        level: levelNum
      })
    });

    isMutating = false;

    if (res.status === 200) {
      currentUser.revision = res.data.revision;
      revTag.textContent = `Rev #${currentUser.revision}`;
      activeRun = res.data.active_run;
      engine = new GameEngine(activeRun);
      setSyncStatus('synced');
      addEvent(`Started Level ${levelNum}`);
      updateUI();
    } else if (res.status === 409) {
      handleConflict(res.data);
    } else {
      setSyncStatus('conflict', res.data.error);
    }
  }

  async function saveActiveRun() {
    if (!engine || isMutating || engine.isMechanicsLab) return;
    if (engine.status === 'game-over' || engine.status === 'completed') return;

    const opId = generateOpId();
    const snapshot = engine.getSnapshot();

    const res = await apiFetch('/api/game/save', {
      method: 'POST',
      body: JSON.stringify({
        expected_revision: currentUser.revision,
        operation_id: opId,
        run_id: activeRun ? activeRun.run_id : 'active',
        state: snapshot
      })
    });

    if (res.status === 200) {
      currentUser.revision = res.data.revision;
      revTag.textContent = `Rev #${currentUser.revision}`;
      setSyncStatus('synced');
    } else if (res.status === 409) {
      handleConflict(res.data);
    }
  }

  async function progressLevel() {
    if (isMutating) return;
    isMutating = true;
    setSyncStatus('syncing');

    const completedLvl = engine.level;
    const currentScore = engine.score;
    const opId = generateOpId();

    const res = await apiFetch('/api/game/progress', {
      method: 'POST',
      body: JSON.stringify({
        expected_revision: currentUser.revision,
        operation_id: opId,
        run_id: activeRun ? activeRun.run_id : 'active',
        completed_level: completedLvl,
        score: currentScore,
        next_level: Math.min(10, completedLvl + 1),
        state: engine.getSnapshot()
      })
    });

    isMutating = false;

    if (res.status === 200) {
      currentUser.revision = res.data.revision;
      currentUser.highest_level = res.data.highest_level;
      currentUser.best_score = res.data.best_score;
      revTag.textContent = `Rev #${currentUser.revision}`;
      setSyncStatus('synced');
      updateLevelSelect();
      loadLeaderboard();

      if (completedLvl < 10) {
        startNewGame(completedLvl + 1);
      }
    } else if (res.status === 409) {
      handleConflict(res.data);
    }
  }

  async function finishRun(outcome) {
    if (isMutating) return;
    isMutating = true;
    setSyncStatus('syncing');

    const opId = generateOpId();
    const finalScore = engine.score;
    const finalLevel = engine.level;
    const snapshot = engine.getSnapshot();

    const res = await apiFetch('/api/game/finish', {
      method: 'POST',
      body: JSON.stringify({
        expected_revision: currentUser.revision,
        operation_id: opId,
        run_id: activeRun ? activeRun.run_id : `run_${Date.now()}`,
        outcome: outcome,
        level: finalLevel,
        score: finalScore,
        snapshot: snapshot
      })
    });

    isMutating = false;

    if (res.status === 200) {
      currentUser.revision = res.data.revision;
      currentUser.best_score = res.data.best_score;
      revTag.textContent = `Rev #${currentUser.revision}`;
      activeRun = null;
      setSyncStatus('synced');
      renderLeaderboardTable(res.data.leaderboard);
      loadPersonalRuns();
    } else if (res.status === 409) {
      handleConflict(res.data);
    }
  }

  function handleConflict(conflictData) {
    currentUser.revision = conflictData.current_revision;
    revTag.textContent = `Rev #${currentUser.revision}`;

    if (conflictData.active_run) {
      activeRun = conflictData.active_run;
      engine = new GameEngine(activeRun);
      engine.status = 'paused';
    }

    setSyncStatus('conflict', `Sync conflict: Server revision ${conflictData.current_revision} won. Game paused and reconciled.`);
    addEvent(`Conflict reconciled: Server revision #${conflictData.current_revision}`);
    updateUI();
  }

  // -------------------------------------------------------------
  // Leaderboard & Personal Runs
  // -------------------------------------------------------------
  async function loadLeaderboard() {
    const res = await apiFetch('/api/leaderboard');
    if (res.status === 200) {
      renderLeaderboardTable(res.data.leaderboard);
    }
  }

  function renderLeaderboardTable(rows) {
    leaderboardTbody.innerHTML = '';
    (rows || []).forEach((r, idx) => {
      const tr = document.createElement('tr');
      const d = r.achieved_at ? new Date(r.achieved_at).toLocaleDateString() : 'N/A';
      tr.innerHTML = `
        <td><strong>#${idx + 1}</strong></td>
        <td><span class="initials-avatar" style="font-size:0.65rem;padding:2px 4px;">${r.initials}</span></td>
        <td><strong>${r.score.toLocaleString()}</strong></td>
        <td>Lvl ${r.level}</td>
        <td><small>${d}</small></td>
      `;
      leaderboardTbody.appendChild(tr);
    });
  }

  async function loadPersonalRuns() {
    const res = await apiFetch('/api/runs');
    if (res.status === 200) {
      renderPersonalRunsTable(res.data.runs);
    }
  }

  function renderPersonalRunsTable(runs) {
    runsTbody.innerHTML = '';
    (runs || []).forEach(r => {
      const tr = document.createElement('tr');
      const d = r.finished_at ? new Date(r.finished_at).toLocaleDateString() : 'N/A';
      const outcomeBadge = r.outcome === 'completed'
        ? '<span style="color:var(--accent-green);font-weight:700;">Completed</span>'
        : '<span style="color:var(--accent-red);">Game Over</span>';

      tr.innerHTML = `
        <td>${outcomeBadge}</td>
        <td><strong>${r.score.toLocaleString()}</strong></td>
        <td>Lvl ${r.level}</td>
        <td><small>${d}</small></td>
        <td><button type="button" class="btn btn-xs btn-outline btn-inspect-run" data-runid="${r.run_id}">Inspect</button></td>
      `;
      runsTbody.appendChild(tr);
    });

    // Add inspect event listeners
    document.querySelectorAll('.btn-inspect-run').forEach(btn => {
      btn.addEventListener('click', async () => {
        const runId = btn.getAttribute('data-runid');
        const res = await apiFetch(`/api/runs/${runId}`);
        if (res.status === 200) {
          snapshotJson.textContent = JSON.stringify(res.data.run, null, 2);
          snapshotModal.classList.remove('hidden');
        }
      });
    });
  }

  async function loadLevelsAndConstants() {
    const [lvlRes, constRes, drillRes] = await Promise.all([
      apiFetch('/api/levels'),
      apiFetch('/api/constants'),
      apiFetch('/api/drills')
    ]);

    if (lvlRes.status === 200) {
      levelsData = lvlRes.data.levels;
      renderLevelsTable(levelsData);
    }
    if (constRes.status === 200) {
      constantsData = constRes.data.constants;
      renderConstantsTable(constantsData);
    }
    if (drillRes.status === 200) {
      drillsData = drillRes.data.drills;
      renderDrillSelect(drillsData);
    }
  }

  function renderLevelsTable(levels) {
    levelsTableTbody.innerHTML = '';
    levels.forEach(lvl => {
      const tr = document.createElement('tr');
      const totals = lvl.brick_totals || {};
      tr.innerHTML = `
        <td><strong>${lvl.level}</strong></td>
        <td>${lvl.name}</td>
        <td>${lvl.base_speed} / ${lvl.speed_cap}</td>
        <td><span style="display:inline-block;width:12px;height:12px;background:${lvl.accent};border-radius:2px;vertical-align:middle;margin-right:4px;"></span>${lvl.accent}</td>
        <td>${totals.normal || 0} / ${totals.strong || 0} / ${totals.solid || 0} / <strong>${totals.total || 0}</strong></td>
        <td><code style="font-size:0.7rem;word-break:break-all;">${lvl.digest}</code></td>
      `;
      levelsTableTbody.appendChild(tr);
    });
  }

  function renderConstantsTable(constants) {
    constantsTableTbody.innerHTML = '';
    constants.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>${c.key}</code></td>
        <td><strong>${c.value}</strong></td>
      `;
      constantsTableTbody.appendChild(tr);
    });
  }

  function renderDrillSelect(drills) {
    selectDrill.innerHTML = '';
    drills.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name;
      selectDrill.appendChild(opt);
    });
    if (drills.length > 0) {
      drillDescText.textContent = drills[0].description;
    }
  }

  // -------------------------------------------------------------
  // Mechanics Lab Handlers
  // -------------------------------------------------------------
  function loadSelectedDrill() {
    const drillId = selectDrill.value;
    const drillState = createDrillState(drillId);
    if (!drillState) return;

    labEngine = new GameEngine(drillState);
    labStepCounter = 0;
    isLabActive = true;
    updateLabTelemetry();
    addEvent(`Mechanics Lab: Loaded drill "${drillState.name}"`);
  }

  function advanceLabDrill() {
    if (!labEngine) loadSelectedDrill();
    const steps = labEngine.advanceSteps(120, true);
    labStepCounter += steps;
    updateLabTelemetry();
    addEvent(`Drill advanced ${steps} ticks (Total: ${labStepCounter})`);
  }

  function updateLabTelemetry() {
    if (!labEngine) return;
    tSteps.textContent = labStepCounter;
    tStatus.textContent = labEngine.status;
    tScore.textContent = labEngine.score.toLocaleString();
    tLives.textContent = labEngine.lives;
    tCombo.textContent = `x${labEngine.combo}`;
    tPaddleWidth.textContent = `${labEngine.paddle.width} px`;
    const sec = getWholeSeconds(labEngine.powerSeconds);
    tPower.textContent = labEngine.power ? `${labEngine.power.toUpperCase()} (${sec}s)` : 'None';

    // Balls list
    tBallsCount.textContent = labEngine.balls.length;
    tBallsList.innerHTML = '';
    labEngine.balls.forEach(b => {
      const li = document.createElement('li');
      li.textContent = `${b.id}: pos=(${Math.round(b.x)}, ${Math.round(b.y)}) vel=(${Math.round(b.vx)}, ${Math.round(b.vy)}) ${b.held ? '[HELD]' : ''} ${b.lost ? '[LOST]' : ''}`;
      tBallsList.appendChild(li);
    });

    // Drops list
    tDropsCount.textContent = labEngine.drops.length;
    tDropsList.innerHTML = '';
    labEngine.drops.forEach(d => {
      const li = document.createElement('li');
      li.textContent = `${d.type.toUpperCase()}: y=${Math.round(d.y)} (vy=${d.vy})`;
      tDropsList.appendChild(li);
    });

    // Bricks list
    const activeBricks = labEngine.bricks;
    tBricksCount.textContent = activeBricks.length;
    tBricksList.innerHTML = '';
    activeBricks.forEach(br => {
      const span = document.createElement('span');
      span.className = `brick-tag ${br.type} ${br.hp <= 0 ? 'broken' : ''}`;
      span.textContent = `${br.type[0].toUpperCase()}:${br.hp}`;
      tBricksList.appendChild(span);
    });
  }

  // -------------------------------------------------------------
  // Events Log
  // -------------------------------------------------------------
  function addEvent(msg) {
    latestEventPill.textContent = msg;
    const li = document.createElement('li');
    const timeStr = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    li.textContent = `[${timeStr}] ${msg}`;
    eventLogList.prepend(li);

    while (eventLogList.children.length > 30) {
      eventLogList.removeChild(eventLogList.lastChild);
    }
  }

  // -------------------------------------------------------------
  // UI & Canvas Renderer
  // -------------------------------------------------------------
  function updateUI() {
    if (!engine) return;

    hudScore.textContent = engine.score.toLocaleString();
    hudLives.textContent = engine.lives;

    const currentLvlInfo = levelsData.find(l => l.level === engine.level);
    const lvlName = currentLvlInfo ? currentLvlInfo.name : '';
    hudLevel.textContent = `${engine.level} - ${lvlName}`;

    hudCombo.textContent = `x${engine.combo}`;
    const sec = getWholeSeconds(engine.powerSeconds);
    hudPower.textContent = engine.power ? `${engine.power.toUpperCase()} (${sec}s)` : 'None';
    hudStatus.textContent = engine.status.toUpperCase();

    // Accessible canvas label
    canvas.setAttribute('aria-label', `Brickfall Game Screen: Level ${engine.level}, Score ${engine.score}, Lives ${engine.lives}, Status ${engine.status}`);

    // Overlay display
    if (engine.status === 'paused') {
      overlayTitle.textContent = 'PAUSED';
      overlayDesc.textContent = 'Game is paused. Press P, Esc, or Resume to continue.';
      overlayButtons.innerHTML = '<button type="button" class="btn btn-primary" id="btn-overlay-resume">Resume [P]</button>';
      canvasOverlay.classList.remove('hidden');
      document.getElementById('btn-overlay-resume').onclick = () => {
        engine.status = 'playing';
        updateUI();
      };
    } else if (engine.status === 'ready') {
      overlayTitle.textContent = `LEVEL ${engine.level}: ${lvlName.toUpperCase()}`;
      overlayDesc.textContent = 'Press Space or click Launch to serve the ball.';
      overlayButtons.innerHTML = '<button type="button" class="btn btn-primary" id="btn-overlay-launch">Launch Ball [Space]</button>';
      canvasOverlay.classList.remove('hidden');
      document.getElementById('btn-overlay-launch').onclick = () => {
        engine.launchBall();
        updateUI();
      };
    } else if (engine.status === 'life-lost') {
      overlayTitle.textContent = 'BALL LOST';
      overlayDesc.textContent = `Lives remaining: ${engine.lives}. Press Space to serve.`;
      overlayButtons.innerHTML = '<button type="button" class="btn btn-primary" id="btn-overlay-serve">Serve Ball [Space]</button>';
      canvasOverlay.classList.remove('hidden');
      document.getElementById('btn-overlay-serve').onclick = () => {
        engine.launchBall();
        updateUI();
      };
    } else if (engine.status === 'level-complete') {
      overlayTitle.textContent = 'LEVEL COMPLETE!';
      overlayDesc.textContent = `Cleared Level ${engine.level}! Bonus +${1000 * engine.level}. Total: ${engine.score.toLocaleString()}`;
      overlayButtons.innerHTML = '<button type="button" class="btn btn-primary" id="btn-overlay-continue">Next Level ▶</button>';
      canvasOverlay.classList.remove('hidden');
      document.getElementById('btn-overlay-continue').onclick = () => {
        progressLevel();
      };
    } else if (engine.status === 'game-over') {
      overlayTitle.textContent = 'GAME OVER';
      overlayDesc.textContent = `Final Score: ${engine.score.toLocaleString()} at Level ${engine.level}. Press R or Restart.`;
      overlayButtons.innerHTML = '<button type="button" class="btn btn-danger" id="btn-overlay-restart">Restart Run [R]</button>';
      canvasOverlay.classList.remove('hidden');
      document.getElementById('btn-overlay-restart').onclick = () => {
        startNewGame(1);
      };
    } else if (engine.status === 'completed') {
      overlayTitle.textContent = 'VICTORY!';
      overlayDesc.textContent = `Congratulations! You cleared all 10 levels! Final Score: ${engine.score.toLocaleString()}`;
      overlayButtons.innerHTML = '<button type="button" class="btn btn-primary" id="btn-overlay-restart-victory">Play Again [R]</button>';
      canvasOverlay.classList.remove('hidden');
      document.getElementById('btn-overlay-restart-victory').onclick = () => {
        startNewGame(1);
      };
    } else {
      canvasOverlay.classList.add('hidden');
    }
  }

  function renderGame(targetEngine) {
    if (!targetEngine) return;

    // Clear background
    ctx.fillStyle = '#06090e';
    ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);

    // Subtle arcade grid lines
    ctx.strokeStyle = 'rgba(48, 54, 61, 0.25)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CONSTANTS.CANVAS_WIDTH; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CONSTANTS.CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CONSTANTS.CANVAS_HEIGHT; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CONSTANTS.CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Level Accent Color
    const lvlInfo = levelsData.find(l => l.level === targetEngine.level);
    const accentColor = lvlInfo ? lvlInfo.accent : '#58a6ff';

    // Render Bricks
    for (const brick of targetEngine.bricks) {
      if (brick.hp <= 0) continue;

      const bx = brick.x !== undefined ? brick.x : getBrickRect(brick.row, brick.column).x;
      const by = brick.y !== undefined ? brick.y : getBrickRect(brick.row, brick.column).y;
      const bw = brick.width || CONSTANTS.BRICK_WIDTH;
      const bh = brick.height || CONSTANTS.BRICK_HEIGHT;

      if (brick.type === 'normal') {
        ctx.fillStyle = accentColor;
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);

        // Brick label / diamond
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('100', bx + bw / 2, by + bh / 2);
      } else if (brick.type === 'strong') {
        const isDamaged = brick.hp === 1;
        ctx.fillStyle = isDamaged ? '#d29922' : '#e3b341';
        ctx.fillRect(bx, by, bw, bh);

        // Double heavy border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);

        if (isDamaged) {
          // Visible damage crack lines
          ctx.strokeStyle = '#7a4e00';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx + 8, by + 4);
          ctx.lineTo(bx + bw / 2, by + bh - 4);
          ctx.lineTo(bx + bw - 10, by + 6);
          ctx.stroke();
        }

        ctx.fillStyle = '#000';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isDamaged ? 'CRACK' : 'STRONG', bx + bw / 2, by + bh / 2);
      } else if (brick.type === 'solid') {
        // Metallic slate with hazard stripes
        ctx.fillStyle = '#2d333b';
        ctx.fillRect(bx, by, bw, bh);

        // Diagonal hazard stripes
        ctx.strokeStyle = '#6e7681';
        ctx.lineWidth = 2;
        for (let sx = -bh; sx < bw; sx += 12) {
          ctx.beginPath();
          ctx.moveTo(bx + sx, by + bh);
          ctx.lineTo(bx + sx + bh, by);
          ctx.stroke();
        }

        ctx.strokeStyle = '#adbac7';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);

        ctx.fillStyle = '#f0f6fc';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SOLID', bx + bw / 2, by + bh / 2);
      }
    }

    // Render Drops
    for (const drop of targetEngine.drops) {
      ctx.save();
      let dropColor = '#58a6ff';
      let label = 'P';
      if (drop.type === 'wide') { dropColor = '#58a6ff'; label = 'WIDE'; }
      else if (drop.type === 'slow') { dropColor = '#3fb950'; label = 'SLOW'; }
      else if (drop.type === 'multiball') { dropColor = '#bc8cff'; label = 'MULTI'; }
      else if (drop.type === 'sticky') { dropColor = '#f778ba'; label = 'STICK'; }

      ctx.fillStyle = dropColor;
      ctx.beginPath();
      ctx.roundRect(drop.x, drop.y, drop.width, drop.height, 4);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#000';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, drop.x + drop.width / 2, drop.y + drop.height / 2);
      ctx.restore();
    }

    // Render Paddle
    const p = targetEngine.paddle;
    ctx.save();
    let paddleGradient = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height);
    paddleGradient.addColorStop(0, '#58a6ff');
    paddleGradient.addColorStop(1, '#1f6feb');

    if (targetEngine.power === 'wide') {
      paddleGradient = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height);
      paddleGradient.addColorStop(0, '#79c0ff');
      paddleGradient.addColorStop(1, '#388bfd');
    } else if (targetEngine.power === 'sticky') {
      paddleGradient = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height);
      paddleGradient.addColorStop(0, '#f778ba');
      paddleGradient.addColorStop(1, '#bf4b8a');
    }

    ctx.fillStyle = paddleGradient;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 6);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center guide line
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + p.width / 2, p.y + 2);
    ctx.lineTo(p.x + p.width / 2, p.y + p.height - 2);
    ctx.stroke();
    ctx.restore();

    // Render Balls
    for (const ball of targetEngine.balls) {
      if (ball.lost) continue;

      ctx.save();
      ctx.shadowColor = '#58a6ff';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#58a6ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  // -------------------------------------------------------------
  // Input Handling & Controls
  // -------------------------------------------------------------
  function handlePaddleMove(deltaX) {
    if (!engine) return;
    assistEnabled = false; // Turn off assist on manual input
    updateAssistButton();

    engine.paddle.vx = deltaX * 60; // Approximate velocity
    engine.paddle.x += deltaX;
    engine.paddle.x = clamp(engine.paddle.x, 0, CONSTANTS.CANVAS_WIDTH - engine.paddle.width);
  }

  function updateAssistButton() {
    btnAssist.setAttribute('aria-checked', assistEnabled ? 'true' : 'false');
    assistStateText.textContent = assistEnabled ? 'ON' : 'OFF';
  }

  function applyAssistAI(targetEngine, dt) {
    if (!assistEnabled || !targetEngine || targetEngine.status !== 'playing') return;

    // Find the most urgent threat (ball falling towards paddle or closest reachable item)
    const activeBalls = targetEngine.balls.filter(b => !b.lost && !b.held && b.vy > 0);
    let targetX = targetEngine.paddle.x + targetEngine.paddle.width / 2;

    if (activeBalls.length > 0) {
      // Pick lowest ball
      const lowestBall = activeBalls.reduce((prev, curr) => curr.y > prev.y ? curr : prev, activeBalls[0]);
      targetX = lowestBall.x;
    } else if (targetEngine.drops.length > 0) {
      const lowestDrop = targetEngine.drops.reduce((prev, curr) => curr.y > prev.y ? curr : prev, targetEngine.drops[0]);
      targetX = lowestDrop.x + lowestDrop.width / 2;
    }

    const paddleCenter = targetEngine.paddle.x + targetEngine.paddle.width / 2;
    const diff = targetX - paddleCenter;
    const maxSpeed = 700; // Ordinary control speed
    const stepDist = maxSpeed * dt;

    if (Math.abs(diff) > 2) {
      const move = Math.sign(diff) * Math.min(Math.abs(diff), stepDist);
      targetEngine.paddle.vx = move / dt;
      targetEngine.paddle.x += move;
      targetEngine.paddle.x = clamp(targetEngine.paddle.x, 0, CONSTANTS.CANVAS_WIDTH - targetEngine.paddle.width);
    } else {
      targetEngine.paddle.vx = 0;
    }
  }

  // -------------------------------------------------------------
  // Main Animation Loop
  // -------------------------------------------------------------
  function gameLoop(currentTime) {
    const elapsed = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    const dt = CONSTANTS.DT;
    const currentActiveEngine = isLabActive ? labEngine : engine;

    if (currentActiveEngine) {
      // Manual Keyboard Paddle Movement
      if (keys.left) handlePaddleMove(-450 * elapsed);
      if (keys.right) handlePaddleMove(450 * elapsed);

      // Assist AI
      applyAssistAI(currentActiveEngine, elapsed);

      // Fixed-timestep simulation steps during 'playing' state
      if (currentActiveEngine.status === 'playing') {
        accumulator += Math.min(elapsed, 0.1);
        while (accumulator >= dt) {
          const prevStatus = currentActiveEngine.status;
          currentActiveEngine.step(dt);
          accumulator -= dt;

          if (currentActiveEngine.status !== prevStatus) {
            // State transition occurred
            updateUI();
            if (currentActiveEngine.status === 'game-over') {
              finishRun('game-over');
            } else if (currentActiveEngine.status === 'completed') {
              finishRun('completed');
            }
            break;
          }
        }
      } else {
        accumulator = 0;
      }

      // Render
      renderGame(currentActiveEngine);
    }

    requestAnimationFrame(gameLoop);
  }

  // -------------------------------------------------------------
  // Event Listeners Setup
  // -------------------------------------------------------------
  function setupEvents() {
    // Demo login buttons
    document.querySelectorAll('.btn-demo').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.getAttribute('data-email');
        loginEmail.value = email;
        loginPassword.value = 'password123';
        handleLogin(email, 'password123');
      });
    });

    // Login Form
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleLogin(loginEmail.value, loginPassword.value);
    });

    // Logout
    btnLogout.addEventListener('click', handleSignOut);

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keys.left = true;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keys.right = true;
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (engine) {
          if (engine.status === 'ready' || engine.status === 'life-lost') {
            engine.launchBall();
            updateUI();
          } else if (engine.status === 'playing') {
            // Release sticky ball if any
            engine.launchBall();
          }
        }
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        e.preventDefault();
        if (engine) {
          if (engine.status === 'playing') {
            engine.status = 'paused';
            saveActiveRun();
            updateUI();
          } else if (engine.status === 'paused') {
            engine.status = 'playing';
            updateUI();
          }
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (engine && (engine.status === 'game-over' || engine.status === 'completed')) {
          e.preventDefault();
          startNewGame(1);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    });

    // Pointer / Mouse Canvas Movement
    canvas.addEventListener('pointermove', (e) => {
      if (!engine) return;
      assistEnabled = false;
      updateAssistButton();

      const rect = canvas.getBoundingClientRect();
      const scaleX = CONSTANTS.CANVAS_WIDTH / rect.width;
      const mouseX = (e.clientX - rect.left) * scaleX;
      engine.paddle.x = clamp(mouseX - engine.paddle.width / 2, 0, CONSTANTS.CANVAS_WIDTH - engine.paddle.width);
    });

    // Toolbar Buttons
    btnLaunch.addEventListener('click', () => {
      if (engine) {
        engine.launchBall();
        updateUI();
      }
    });

    btnPause.addEventListener('click', () => {
      if (!engine) return;
      if (engine.status === 'playing') {
        engine.status = 'paused';
        saveActiveRun();
      } else if (engine.status === 'paused') {
        engine.status = 'playing';
      }
      updateUI();
    });

    btnRestart.addEventListener('click', () => {
      startNewGame(1);
    });

    btnAssist.addEventListener('click', () => {
      assistEnabled = !assistEnabled;
      updateAssistButton();
      addEvent(`Assist Paddle: ${assistEnabled ? 'ENABLED' : 'DISABLED'}`);
    });

    btnNewRun.addEventListener('click', () => {
      const chosen = Number(selectLevel.value) || 1;
      startNewGame(chosen);
    });

    // Touch controls
    touchLeft.addEventListener('pointerdown', () => { keys.left = true; });
    touchLeft.addEventListener('pointerup', () => { keys.left = false; });
    touchRight.addEventListener('pointerdown', () => { keys.right = true; });
    touchRight.addEventListener('pointerup', () => { keys.right = false; });
    touchLaunch.addEventListener('click', () => {
      if (engine) {
        engine.launchBall();
        updateUI();
      }
    });

    // Refresh Buttons
    btnRefreshLb.addEventListener('click', loadLeaderboard);
    btnRefreshRuns.addEventListener('click', loadPersonalRuns);

    // Mechanics Lab Modal Toggle
    btnLabToggle.addEventListener('click', () => {
      labModal.classList.remove('hidden');
      loadSelectedDrill();
    });

    btnCloseLab.addEventListener('click', () => {
      labModal.classList.add('hidden');
      isLabActive = false;
    });

    // Snapshot Modal Close
    btnCloseSnapshot.addEventListener('click', () => {
      snapshotModal.classList.add('hidden');
    });

    // Lab Tabs
    tabDrillsBtn.addEventListener('click', () => {
      tabDrillsBtn.classList.add('active');
      tabLevelsBtn.classList.remove('active');
      tabConstantsBtn.classList.remove('active');
      tabDrills.classList.remove('hidden');
      tabLevels.classList.add('hidden');
      tabConstants.classList.add('hidden');
    });

    tabLevelsBtn.addEventListener('click', () => {
      tabLevelsBtn.classList.add('active');
      tabDrillsBtn.classList.remove('active');
      tabConstantsBtn.classList.remove('active');
      tabLevels.classList.remove('hidden');
      tabDrills.classList.add('hidden');
      tabConstants.classList.add('hidden');
    });

    tabConstantsBtn.addEventListener('click', () => {
      tabConstantsBtn.classList.add('active');
      tabDrillsBtn.classList.remove('active');
      tabLevelsBtn.classList.remove('active');
      tabConstants.classList.remove('hidden');
      tabDrills.classList.add('hidden');
      tabLevels.classList.add('hidden');
    });

    selectDrill.addEventListener('change', () => {
      const selected = drillsData.find(d => d.id === selectDrill.value);
      if (selected) drillDescText.textContent = selected.description;
    });

    btnLoadDrill.addEventListener('click', loadSelectedDrill);
    btnAdvanceDrill.addEventListener('click', advanceLabDrill);
    btnDrillLaunch.addEventListener('click', () => {
      if (labEngine) {
        labEngine.launchBall();
        updateLabTelemetry();
      }
    });

    // Periodic throttled save
    setInterval(() => {
      if (engine && engine.status === 'playing') {
        saveActiveRun();
      }
    }, 5000);
  }

  // -------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------
  setupEvents();
  checkExistingSession();
  requestAnimationFrame(gameLoop);

})();

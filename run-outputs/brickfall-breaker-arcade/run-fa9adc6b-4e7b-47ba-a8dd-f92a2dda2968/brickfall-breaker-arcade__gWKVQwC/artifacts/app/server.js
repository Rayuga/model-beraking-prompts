const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const xlsx = require('xlsx');
const Database = require('better-sqlite3');

const ROOT = '/app';
const DB_PATH = path.join(ROOT, 'brickfall.db');
const WORKBOOK_PATH = '/assets/artifacts/brickfall_seed.xlsx';
const SCENARIO_PATH = '/assets/artifacts/brickfall_scenarios.json';
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = 3000;

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function parseWorkbook() {
  const workbook = xlsx.readFile(WORKBOOK_PATH);
  const sheets = Object.fromEntries(workbook.SheetNames.map((name) => [name, xlsx.utils.sheet_to_json(workbook.Sheets[name], { defval: '' })]));
  const levels = sheets.Levels || [];
  const bricks = sheets.Bricks || [];
  const leaderboard = sheets.Leaderboard || [];
  const constants = sheets.Constants || [];
  const users = sheets.Users || [];
  const brickDigest = sha256(
    bricks
      .slice()
      .sort((a, b) => a.row - b.row || a.column - b.column)
      .map((row) => `${row.row}:${row.column}:${row.type}:${row.drop || ''}`)
      .join('|')
  );
  const brickStats = new Map();
  for (const level of levels) {
    brickStats.set(level.level, { normal: 0, strong: 0, solid: 0, total: 0 });
  }
  for (const brick of bricks) {
    const stats = brickStats.get(brick.level) || { normal: 0, strong: 0, solid: 0, total: 0 };
    stats.total += 1;
    stats[brick.type] = (stats[brick.type] || 0) + 1;
    brickStats.set(brick.level, stats);
  }
  return { workbook, sheets, levels, bricks, leaderboard, constants, users, brickDigest, brickStats };
}

function loadScenarioData() {
  return JSON.parse(fs.readFileSync(SCENARIO_PATH, 'utf8'));
}

function createDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

const seed = parseWorkbook();
const scenarios = loadScenarioData();
const db = createDb();

function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      initials TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      highest_level INTEGER NOT NULL,
      best_score INTEGER NOT NULL,
      selected_level INTEGER NOT NULL,
      last_revision INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS levels (
      level INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      base_speed INTEGER NOT NULL,
      speed_cap INTEGER NOT NULL,
      accent TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bricks (
      level INTEGER NOT NULL,
      row INTEGER NOT NULL,
      column INTEGER NOT NULL,
      type TEXT NOT NULL,
      drop_item TEXT NOT NULL,
      PRIMARY KEY (level, row, column),
      FOREIGN KEY (level) REFERENCES levels(level) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS constants (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leaderboard_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      initials TEXT NOT NULL,
      score INTEGER NOT NULL,
      level INTEGER NOT NULL,
      achieved_at TEXT NOT NULL,
      email TEXT,
      source TEXT NOT NULL DEFAULT 'seed'
    );

    CREATE TABLE IF NOT EXISTS terminal_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      run_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      level INTEGER NOT NULL,
      score INTEGER NOT NULL,
      finished_at TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS active_runs (
      user_id INTEGER PRIMARY KEY,
      run_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS operation_receipts (
      user_id INTEGER NOT NULL,
      operation_id TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      status INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, operation_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS finished_runs (
      run_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      operation_id TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      status INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS drill_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      initial_text TEXT NOT NULL,
      after_advance_text TEXT NOT NULL,
      after_second_advance_text TEXT,
      preset_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      revision INTEGER NOT NULL,
      preset_json TEXT NOT NULL,
      summary_text TEXT NOT NULL,
      next_outcome TEXT NOT NULL
    );
  `);
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha256').toString('hex');
}

function seedIfNeeded() {
  const meta = db.prepare('SELECT value FROM meta WHERE key = ?').get('seed_version');
  if (meta) return;

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, name, initials, password_salt, password_hash, highest_level, best_score, selected_level, last_revision)
    VALUES (@id, @email, @name, @initials, @password_salt, @password_hash, @highest_level, @best_score, @selected_level, @last_revision)
  `);
  const insertLevel = db.prepare(`
    INSERT INTO levels (level, name, base_speed, speed_cap, accent)
    VALUES (@level, @name, @base_speed, @speed_cap, @accent)
  `);
  const insertBrick = db.prepare(`
    INSERT INTO bricks (level, row, column, type, drop_item)
    VALUES (@level, @row, @column, @type, @drop_item)
  `);
  const insertConstant = db.prepare(`
    INSERT INTO constants (key, value)
    VALUES (?, ?)
  `);
  const insertLeaderboard = db.prepare(`
    INSERT INTO leaderboard_entries (initials, score, level, achieved_at, email, source)
    VALUES (@initials, @score, @level, @achieved_at, @email, @source)
  `);
  const insertTerminalRun = db.prepare(`
    INSERT INTO terminal_runs (user_id, run_id, outcome, level, score, finished_at, snapshot_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertActiveRun = db.prepare(`
    INSERT INTO active_runs (user_id, run_id, revision, snapshot_json, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertDrill = db.prepare(`
    INSERT INTO drill_presets (id, name, initial_text, after_advance_text, after_second_advance_text, preset_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertCheckpoint = db.prepare(`
    INSERT INTO checkpoints (id, user_email, revision, preset_json, summary_text, next_outcome)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const run = db.transaction(() => {
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('seed_version', String(scenarios.schema_version || '1'));
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('workbook_digest', seed.brickDigest);

    for (const user of seed.users) {
      const salt = randomHex(16);
      insertUser.run({
        id: user.id,
        email: user.email,
        name: user.name,
        initials: user.initials,
        password_salt: salt,
        password_hash: hashPassword(String(user.password), salt),
        highest_level: Number(user.highest_level),
        best_score: Number(user.best_score),
        selected_level: Math.min(Number(user.highest_level), Number(user.highest_level) || 1),
        last_revision: 0,
      });
    }

    for (const level of seed.levels) insertLevel.run(level);
    for (const brick of seed.bricks) {
      insertBrick.run({
        level: brick.level,
        row: brick.row,
        column: brick.column,
        type: brick.type,
        drop_item: brick.drop || '',
      });
    }
    for (const constant of seed.constants) insertConstant.run(String(constant.key), String(constant.value));

    for (const row of seed.leaderboard) {
      insertLeaderboard.run({
        initials: row.initials,
        score: Number(row.score),
        level: Number(row.level),
        achieved_at: row.achieved_at,
        email: row.email || null,
        source: 'workbook',
      });
    }
    for (const row of scenarios.guest_leaderboard || []) {
      insertLeaderboard.run({
        initials: row.initials,
        score: Number(row.score),
        level: Number(row.level),
        achieved_at: row.achieved_at,
        email: row.email || null,
        source: 'guest',
      });
    }

    for (const drill of scenarios.drills || []) {
      insertDrill.run(
        drill.id,
        drill.name,
        drill.initial,
        drill.after_advance,
        drill.after_second_advance || null,
        JSON.stringify(createDrillSnapshot(drill.id))
      );
    }

    for (const fixture of scenarios.personal_run_fixtures || []) {
      const user = seed.users.find((row) => row.email.toLowerCase().startsWith(fixture.user.toLowerCase()));
      const userId = user ? user.id : 0;
      const snapshot = {
        runId: fixture.run_id,
        mode: 'completed',
        terminal: fixture.outcome,
        level: Number(fixture.level),
        score: Number(fixture.score),
        finishedAt: fixture.finished_at,
      };
      insertLeaderboard.run({
        initials: user ? user.initials : fixture.user.toUpperCase().slice(0, 3),
        score: Number(fixture.score),
        level: Number(fixture.level),
        achieved_at: fixture.finished_at,
        email: user ? user.email : null,
        source: 'terminal-run',
      });
      if (userId && fixture.run_id !== 'polly-archive-01') {
        insertTerminalRun.run(userId, fixture.run_id, fixture.outcome, Number(fixture.level), Number(fixture.score), fixture.finished_at, JSON.stringify(snapshot));
      }
    }

    if (scenarios.checkpoints?.mira) {
      const miraUser = seed.users.find((row) => row.email === 'mira@brickfall.test');
      insertActiveRun.run(
        miraUser.id,
        'checkpoint-mira',
        Number(scenarios.checkpoints.mira.revision),
        JSON.stringify(createCheckpointSnapshot(miraUser, seed, scenarios.checkpoints.mira, 'mira')),
        nowIso()
      );
      db.prepare('UPDATE users SET last_revision = ?, selected_level = ? WHERE id = ?').run(
        Number(scenarios.checkpoints.mira.revision),
        Number(scenarios.checkpoints.mira.level),
        miraUser.id
      );
      insertCheckpoint.run(
        'mira',
        miraUser.email,
        Number(scenarios.checkpoints.mira.revision),
        JSON.stringify(createCheckpointSnapshot(miraUser, seed, scenarios.checkpoints.mira, 'mira')),
        'Mira paused checkpoint',
        scenarios.checkpoints.mira.next_outcome
      );
    }

    if (scenarios.checkpoints?.dev) {
      const devUser = seed.users.find((row) => row.email === 'dev@brickfall.test');
      insertActiveRun.run(
        devUser.id,
        'checkpoint-dev',
        Number(scenarios.checkpoints.dev.revision),
        JSON.stringify(createCheckpointSnapshot(devUser, seed, scenarios.checkpoints.dev, 'dev')),
        nowIso()
      );
      db.prepare('UPDATE users SET last_revision = ?, selected_level = ? WHERE id = ?').run(
        Number(scenarios.checkpoints.dev.revision),
        Number(scenarios.checkpoints.dev.level),
        devUser.id
      );
      insertCheckpoint.run(
        'dev',
        devUser.email,
        Number(scenarios.checkpoints.dev.revision),
        JSON.stringify(createCheckpointSnapshot(devUser, seed, scenarios.checkpoints.dev, 'dev')),
        'Dev paused checkpoint',
        scenarios.checkpoints.dev.next_outcome
      );
    }
  });

  run();
}

function createLevelLookup() {
  const rows = db.prepare('SELECT * FROM levels ORDER BY level').all();
  const byLevel = new Map();
  for (const row of rows) byLevel.set(row.level, row);
  return byLevel;
}

function createBrickLookup(level) {
  return db.prepare('SELECT * FROM bricks WHERE level = ? ORDER BY row, column').all(level).map((row) => ({
    level: row.level,
    row: row.row,
    column: row.column,
    type: row.type,
    drop: row.drop_item || '',
  }));
}

function createLeaderboard(limit = 10) {
  return db.prepare(`
    SELECT initials, score, level, achieved_at, email, source
    FROM leaderboard_entries
    ORDER BY score DESC, achieved_at ASC, id ASC
    LIMIT ?
  `).all(limit);
}

function createRecentRuns(userId) {
  return db.prepare(`
    SELECT run_id, outcome, level, score, finished_at, snapshot_json
    FROM terminal_runs
    WHERE user_id = ?
    ORDER BY finished_at DESC, id DESC
    LIMIT 10
  `).all(userId).map((row) => ({
    runId: row.run_id,
    outcome: row.outcome,
    level: row.level,
    score: row.score,
    finishedAt: row.finished_at,
    snapshot: JSON.parse(row.snapshot_json),
  }));
}

function getWorkbookMeta() {
  const digest = db.prepare('SELECT value FROM meta WHERE key = ?').get('workbook_digest');
  const seedVersion = db.prepare('SELECT value FROM meta WHERE key = ?').get('seed_version');
  return { digest: digest?.value || seed.brickDigest, seedVersion: seedVersion?.value || String(scenarios.schema_version || '1') };
}

function getUserByToken(token) {
  return db.prepare(`
    SELECT u.*
    FROM tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token = ? AND t.revoked_at IS NULL
  `).get(token);
}

function getUserById(userId) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

function getActiveRun(userId) {
  const row = db.prepare('SELECT * FROM active_runs WHERE user_id = ?').get(userId);
  return row ? { ...row, snapshot: JSON.parse(row.snapshot_json) } : null;
}

function storeActiveRun(userId, runId, revision, snapshot) {
  db.prepare(`
    INSERT INTO active_runs (user_id, run_id, revision, snapshot_json, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      run_id = excluded.run_id,
      revision = excluded.revision,
      snapshot_json = excluded.snapshot_json,
      updated_at = excluded.updated_at
  `).run(userId, runId, revision, JSON.stringify(snapshot), nowIso());
  db.prepare('UPDATE users SET last_revision = ?, selected_level = ? WHERE id = ?').run(revision, snapshot.selectedLevel || snapshot.level, userId);
}

function clearActiveRun(userId, revision, selectedLevel) {
  db.prepare('DELETE FROM active_runs WHERE user_id = ?').run(userId);
  db.prepare('UPDATE users SET last_revision = ?, selected_level = ? WHERE id = ?').run(revision, selectedLevel, userId);
}

function storeReceipt(userId, operationId, requestHash, status, body) {
  db.prepare(`
    INSERT OR REPLACE INTO operation_receipts (user_id, operation_id, request_hash, status, response_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, operationId, requestHash, status, JSON.stringify(body), nowIso());
}

function getReceipt(userId, operationId) {
  return db.prepare('SELECT * FROM operation_receipts WHERE user_id = ? AND operation_id = ?').get(userId, operationId);
}

function setFinishedRun(userId, runId, operationId, requestHash, status, body) {
  db.prepare(`
    INSERT OR REPLACE INTO finished_runs (run_id, user_id, operation_id, request_hash, status, response_json, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(runId, userId, operationId, requestHash, status, JSON.stringify(body), nowIso());
}

function getFinishedRun(runId) {
  return db.prepare('SELECT * FROM finished_runs WHERE run_id = ?').get(runId);
}

function createProfilePayload(userId) {
  const user = getUserById(userId);
  const active = getActiveRun(userId);
  const levelRows = seed.levels.map((row) => {
    const stats = seed.brickStats.get(row.level) || { normal: 0, strong: 0, solid: 0, total: 0 };
    return { ...row, stats };
  });
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      initials: user.initials,
    },
    progress: {
      highestLevel: user.highest_level,
      bestScore: user.best_score,
      selectedLevel: user.selected_level,
      revision: user.last_revision,
    },
    activeRun: active,
    levels: levelRows,
    bricks: seed.bricks,
    constants: seed.constants,
    workbookDigest: getWorkbookMeta().digest,
    leaderboard: createLeaderboard(),
    recentRuns: createRecentRuns(userId),
    drills: createDrillPayloads(),
    checkpoints: createCheckpointPayloads(),
  };
}

function createDrillPayloads() {
  return db.prepare('SELECT id, name, initial_text, after_advance_text, after_second_advance_text, preset_json FROM drill_presets ORDER BY id').all().map((row) => ({
    id: row.id,
    name: row.name,
    initial: row.initial_text,
    afterAdvance: row.after_advance_text,
    afterSecondAdvance: row.after_second_advance_text,
    preset: JSON.parse(row.preset_json),
  }));
}

function createCheckpointPayloads() {
  return db.prepare('SELECT id, user_email, revision, preset_json, summary_text, next_outcome FROM checkpoints ORDER BY id').all().map((row) => ({
    id: row.id,
    email: row.user_email,
    revision: row.revision,
    summary: row.summary_text,
    nextOutcome: row.next_outcome,
    preset: JSON.parse(row.preset_json),
  }));
}

function createCheckpointSnapshot(user, seedData, checkpoint, checkpointId) {
  const levelData = seedData.levels.find((row) => Number(row.level) === Number(checkpoint.level)) || seedData.levels[0];
  const bricks = createBrickLookup(Number(checkpoint.level)).map((brick) => ({
    id: `${checkpoint.level}-${brick.row}-${brick.column}`,
    row: brick.row,
    column: brick.column,
    type: brick.type,
    drop: brick.drop,
    hp: brick.type === 'strong' ? 2 : brick.type === 'solid' ? Infinity : 1,
    damaged: brick.type === 'strong' && brick.drop === '',
    destroyed: false,
  }));
  const ballCount = checkpoint.balls?.includes('two moving balls') ? 2 : 1;
  const balls = Array.from({ length: ballCount }, (_, index) => ({
    id: `${user.id}-checkpoint-ball-${index + 1}`,
    primary: index === 0,
    state: 'moving',
    x: 360 + index * 24,
    y: index === 0 ? 430 : 470,
    vx: index === 0 ? 120 : -140,
    vy: index === 0 ? -280 : 260,
    radius: Number(seed.constants.find((row) => row.key === 'ball_radius')?.value || 9),
  }));
  return {
    runId: `checkpoint-${user.id}`,
    checkpointId,
    advanceCount: 0,
    mode: 'paused',
    phase: 'paused',
    level: Number(checkpoint.level),
    levelName: levelData?.name || `Level ${checkpoint.level}`,
    score: Number(checkpoint.score),
    lives: Number(checkpoint.lives),
    combo: Number(checkpoint.combo),
    nextExtraLife: Number(checkpoint.next_extra_life),
    selectedLevel: Number(checkpoint.level),
    activePower: checkpoint.power ? { type: checkpoint.power, remaining: Number(checkpoint.power_seconds) } : null,
    paddle: {
      x: 330,
      y: 540,
      width: Number(checkpoint.paddle_width || seed.constants.find((row) => row.key === 'paddle_width')?.value || 118),
      height: Number(seed.constants.find((row) => row.key === 'paddle_height')?.value || 18),
      vx: 0,
      targetX: 330,
    },
    balls,
    drops: [],
    bricks,
    stepCount: 0,
    simulationSeconds: 0,
    assistPaddle: false,
    events: [checkpoint.next_outcome],
    terminal: null,
  };
}

function createDrillSnapshot(drillId) {
  const id = String(drillId);
  const ballRadius = Number(seed.constants.find((row) => row.key === 'ball_radius')?.value || 9);
  const paddleHeight = Number(seed.constants.find((row) => row.key === 'paddle_height')?.value || 18);
  const paddleWidth = Number(seed.constants.find((row) => row.key === 'paddle_width')?.value || 118);
  const levelData = seed.levels.find((row) => Number(row.level) === 1) || seed.levels[0];
  const base = {
    runId: `lab-${id}-${randomHex(4)}`,
    drillId: id,
    advanceCount: 0,
    mode: 'paused',
    phase: 'paused',
    level: 1,
    levelName: levelData.name,
    score: 0,
    lives: 3,
    combo: 1,
    nextExtraLife: 20000,
    selectedLevel: 1,
    activePower: null,
    paddle: { x: 360, y: 540, width: paddleWidth, height: paddleHeight, vx: 0, targetX: 360 },
    balls: [],
    drops: [],
    bricks: [],
    stepCount: 0,
    simulationSeconds: 0,
    assistPaddle: false,
    events: [],
    terminal: null,
  };

  const brick = (row, column, type, drop = '', hp = type === 'strong' ? 2 : 1) => ({
    id: `${id}-b-${row}-${column}-${type}`,
    row,
    column,
    type,
    drop,
    hp,
    damaged: type === 'strong' && hp === 1,
    destroyed: false,
  });

  if (id === 'brick-types') {
    base.level = 1;
    base.levelName = 'Foundation';
    base.score = 0;
    base.lives = 3;
    base.combo = 1;
    base.nextExtraLife = 20000;
    base.balls = [
      { id: `${id}-ball-1`, primary: true, state: 'moving', x: 260, y: 410, vx: 140, vy: -240, radius: ballRadius },
      { id: `${id}-ball-2`, primary: false, state: 'moving', x: 520, y: 360, vx: -120, vy: -210, radius: ballRadius },
      { id: `${id}-ball-3`, primary: false, state: 'moving', x: 700, y: 220, vx: 190, vy: 230, radius: ballRadius },
      { id: `${id}-ball-4`, primary: false, state: 'moving', x: 390, y: 146, vx: 0, vy: 1000, radius: ballRadius },
      { id: `${id}-ball-5`, primary: false, state: 'moving', x: 620, y: 280, vx: -170, vy: -250, radius: ballRadius },
      { id: `${id}-ball-6`, primary: false, state: 'moving', x: 690, y: 512, vx: -80, vy: 150, radius: ballRadius },
    ];
    base.bricks = [
      brick(1, 4, 'normal', ''),
      brick(1, 6, 'normal', ''),
      brick(2, 3, 'strong', '', 1),
      brick(2, 7, 'strong', ''),
      brick(3, 5, 'solid', ''),
    ];
    base.events = ['Targeted brick-contact drill loaded.'];
    return base;
  }

  if (id === 'power-relay') {
    base.balls = [{ id: `${id}-ball-1`, primary: true, state: 'moving', x: 360, y: 390, vx: 0, vy: -300, radius: ballRadius }];
    base.drops = [
      { id: `${id}-drop-1`, type: 'wide', x: 250, y: 200, vy: 120 },
      { id: `${id}-drop-2`, type: 'wide', x: 300, y: 160, vy: 120 },
      { id: `${id}-drop-3`, type: 'slow', x: 350, y: 120, vy: 120 },
      { id: `${id}-drop-4`, type: 'multiball', x: 400, y: 80, vy: 120 },
      { id: `${id}-drop-5`, type: 'multiball', x: 450, y: 40, vy: 120 },
      { id: `${id}-drop-6`, type: 'sticky', x: 500, y: 10, vy: 120 },
    ];
    base.activePower = null;
    base.events = ['Six item relay loaded.'];
    return base;
  }

  if (id === 'multiball') {
    base.lives = 3;
    base.activePower = { type: 'multiball', remaining: 10 };
    base.balls = [
      { id: `${id}-ball-1`, primary: true, state: 'moving', x: 400, y: 360, vx: 0, vy: -260, radius: ballRadius },
      { id: `${id}-ball-2`, primary: false, state: 'lost', x: 360, y: 590, vx: 0, vy: 260, radius: ballRadius },
    ];
    base.events = ['Multiball persistence drill loaded.'];
    return base;
  }

  if (id === 'sticky-catch') {
    base.activePower = { type: 'sticky', remaining: 1.5 };
    base.balls = [{ id: `${id}-ball-1`, primary: true, state: 'moving', x: 365, y: 490, vx: -15, vy: 220, radius: ballRadius }];
    base.events = ['Sticky catch drill loaded.'];
    return base;
  }

  if (id === 'extra-life') {
    base.score = 19950;
    base.lives = 3;
    base.combo = 1;
    base.nextExtraLife = 20000;
    base.balls = [{ id: `${id}-ball-1`, primary: true, state: 'moving', x: 360, y: 400, vx: 0, vy: -260, radius: ballRadius }];
    base.bricks = [brick(2, 4, 'normal', ''), brick(2, 7, 'normal', '')];
    base.events = ['Extra life threshold drill loaded.'];
    return base;
  }

  if (id === 'last-ball') {
    base.lives = 2;
    base.combo = 1;
    base.activePower = { type: 'wide', remaining: 10 };
    base.paddle.width = 177;
    base.balls = [{ id: `${id}-ball-1`, primary: true, state: 'lost', x: 330, y: 610, vx: 0, vy: 260, radius: ballRadius }];
    base.drops = [{ id: `${id}-drop-1`, type: 'slow', x: 450, y: 440, vy: 120 }];
    base.events = ['Last-ball failure drill loaded.'];
    return base;
  }

  if (id === 'final-wall') {
    base.level = 10;
    base.selectedLevel = 10;
    base.levelName = 'Brickfall';
    base.score = 5000;
    base.combo = 1;
    base.balls = [{ id: `${id}-ball-1`, primary: true, state: 'moving', x: 250, y: 430, vx: 120, vy: -230, radius: ballRadius }];
    base.bricks = [brick(3, 8, 'normal', ''), brick(4, 2, 'solid', '')];
    base.events = ['Final-wall completion drill loaded.'];
    return base;
  }

  return base;
}

function createBootstrapData(user) {
  const activeRun = getActiveRun(user.id);
  const levels = seed.levels.map((level) => ({
    ...level,
    stats: seed.brickStats.get(level.level) || { normal: 0, strong: 0, solid: 0, total: 0 },
  }));
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      initials: user.initials,
    },
    progress: {
      highestLevel: user.highest_level,
      bestScore: user.best_score,
      selectedLevel: user.selected_level,
      revision: user.last_revision,
    },
    activeRun,
    levels,
    bricks: seed.bricks,
    constants: seed.constants,
    workbookDigest: getWorkbookMeta().digest,
    leaderboard: createLeaderboard(),
    recentRuns: createRecentRuns(user.id),
    drills: createDrillPayloads(),
    checkpoints: createCheckpointPayloads(),
  };
}

function authMiddleware(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Sign-in required' });
  const user = getUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Sign-in required' });
  req.user = user;
  req.token = token;
  next();
}

function parseJsonBody(value) {
  return value && typeof value === 'object' ? value : {};
}

function mutationWrapper(kind, handler) {
  return (req, res) => {
    const user = req.user;
    const body = parseJsonBody(req.body);
    const operationId = String(body.operationId || '').trim();
    const expectedRevision = Number(body.expectedRevision);
    if (!operationId || !Number.isFinite(expectedRevision)) {
      return res.status(400).json({ error: 'operationId and expectedRevision are required' });
    }
    const payload = body.snapshot || body;
    const requestHash = sha256(JSON.stringify({ kind, expectedRevision, payload, runId: payload.runId || null, operationId }));
    const existing = getReceipt(user.id, operationId);
    if (existing) {
      if (existing.request_hash !== requestHash) {
        return res.status(409).json({ error: 'operationId already used for a different payload' });
      }
      return res.status(existing.status).json(JSON.parse(existing.response_json));
    }

    const result = db.transaction(() => handler({ req, res, user, body, payload, expectedRevision, operationId, requestHash }));
    const response = result();
    if (response && response.storeReceipt !== false) {
      storeReceipt(user.id, operationId, requestHash, response.status, response.body);
    }
    return res.status(response.status).json(response.body);
  };
}

function staleResponse(user) {
  const current = getUserById(user.id);
  return {
    status: 409,
    body: {
      error: 'Revision conflict',
      currentRevision: current.last_revision,
      activeRun: getActiveRun(user.id),
      progress: {
        highestLevel: current.highest_level,
        bestScore: current.best_score,
        selectedLevel: current.selected_level,
        revision: current.last_revision,
      },
      leaderboard: createLeaderboard(),
      recentRuns: createRecentRuns(user.id),
    },
  };
}

function validateRevision(user, expectedRevision) {
  const current = getUserById(user.id);
  if (Number(current.last_revision) !== Number(expectedRevision)) {
    return staleResponse(user);
  }
  return null;
}

function saveActiveSnapshot(user, snapshot, nextRevision) {
  storeActiveRun(user.id, snapshot.runId, nextRevision, snapshot);
  return {
    status: 200,
    body: {
      ok: true,
      progress: createBootstrapData(getUserById(user.id)).progress,
      activeRun: getActiveRun(user.id),
      leaderboard: createLeaderboard(),
      recentRuns: createRecentRuns(user.id),
      message: snapshot.events?.slice(-1)[0] || 'Saved',
    },
  };
}

function updateUserUnlocksOnProgress(user, snapshot, nextRevision) {
  const nextLevel = Math.min(10, Number(snapshot.level) + 1);
  const current = getUserById(user.id);
  const unlocked = Math.max(current.highest_level, nextLevel);
  db.prepare('UPDATE users SET highest_level = ?, selected_level = ?, last_revision = ? WHERE id = ?').run(
    unlocked,
    nextLevel,
    nextRevision,
    user.id
  );
}

function updateUserSelection(user, snapshot, nextRevision) {
  db.prepare('UPDATE users SET selected_level = ?, last_revision = ? WHERE id = ?').run(Number(snapshot.selectedLevel || snapshot.level), nextRevision, user.id);
}

function createMutationHandlers() {
  return {
    start: mutationWrapper('start', ({ user, payload, expectedRevision }) => {
      const conflict = validateRevision(user, expectedRevision);
      if (conflict) return conflict;
      const snapshot = { ...payload };
      const current = getUserById(user.id);
      const nextRevision = current.last_revision + 1;
      if (!snapshot.runId) snapshot.runId = `run-${randomHex(16)}`;
      snapshot.revision = nextRevision;
      snapshot.mode = snapshot.mode || 'ready';
      snapshot.phase = snapshot.phase || snapshot.mode;
      snapshot.selectedLevel = Number(snapshot.selectedLevel || snapshot.level || current.selected_level || 1);
      snapshot.events = Array.isArray(snapshot.events) ? snapshot.events : [];
      storeActiveRun(user.id, snapshot.runId, nextRevision, snapshot);
      db.prepare('UPDATE users SET selected_level = ?, last_revision = ? WHERE id = ?').run(snapshot.selectedLevel, nextRevision, user.id);
      return {
        status: 200,
        body: {
          ok: true,
          snapshot: getActiveRun(user.id),
          progress: createBootstrapData(getUserById(user.id)).progress,
          leaderboard: createLeaderboard(),
          recentRuns: createRecentRuns(user.id),
          message: 'Run started',
        },
      };
    }),
    save: mutationWrapper('save', ({ user, payload, expectedRevision }) => {
      const active = getActiveRun(user.id);
      if (!active) return { status: 409, body: { error: 'No active run', currentRevision: getUserById(user.id).last_revision } };
      if (payload.runId && payload.runId !== active.run_id) {
        return staleResponse(user);
      }
      const conflict = validateRevision(user, expectedRevision);
      if (conflict) return conflict;
      const nextRevision = getUserById(user.id).last_revision + 1;
      const snapshot = { ...payload, runId: active.run_id, revision: nextRevision };
      return saveActiveSnapshot(user, snapshot, nextRevision);
    }),
    progress: mutationWrapper('progress', ({ user, payload, expectedRevision }) => {
      const active = getActiveRun(user.id);
      if (!active) return { status: 409, body: { error: 'No active run', currentRevision: getUserById(user.id).last_revision } };
      if (payload.runId && payload.runId !== active.run_id) return staleResponse(user);
      const conflict = validateRevision(user, expectedRevision);
      if (conflict) return conflict;
      const nextRevision = getUserById(user.id).last_revision + 1;
      const snapshot = { ...payload, runId: active.run_id, revision: nextRevision };
      updateUserUnlocksOnProgress(user, snapshot, nextRevision);
      storeActiveRun(user.id, snapshot.runId, nextRevision, snapshot);
      return {
        status: 200,
        body: {
          ok: true,
          snapshot: getActiveRun(user.id),
          progress: createBootstrapData(getUserById(user.id)).progress,
          leaderboard: createLeaderboard(),
          recentRuns: createRecentRuns(user.id),
          message: `Advanced to level ${snapshot.level}`,
        },
      };
    }),
    finish: mutationWrapper('finish', ({ user, payload, expectedRevision, operationId, requestHash }) => {
      const active = getActiveRun(user.id);
      if (!active && !getFinishedRun(payload.runId)) {
        return { status: 409, body: { error: 'No active run', currentRevision: getUserById(user.id).last_revision } };
      }
      const finished = getFinishedRun(payload.runId);
      if (finished) {
        return { status: finished.status, body: JSON.parse(finished.response_json), storeReceipt: false };
      }
      if (active && payload.runId && payload.runId !== active.run_id) return staleResponse(user);
      const conflict = validateRevision(user, expectedRevision);
      if (conflict) return conflict;
      const current = getUserById(user.id);
      const nextRevision = current.last_revision + 1;
      const snapshot = { ...payload, revision: nextRevision };
      const outcome = String(snapshot.outcome || snapshot.terminal || 'game-over');
      const score = Number(snapshot.score || 0);
      const level = Number(snapshot.level || 1);
      const finishedAt = snapshot.finishedAt || nowIso();
      const leaderboardName = current.initials;
      const body = {
        ok: true,
        outcome,
        terminalRecord: {
          runId: snapshot.runId,
          outcome,
          level,
          score,
          finishedAt,
          snapshot,
        },
        leaderboard: null,
        progress: {
          highestLevel: current.highest_level,
          bestScore: Math.max(current.best_score, score),
          selectedLevel: current.selected_level,
          revision: nextRevision,
        },
        recentRuns: [],
        message: outcome === 'completed' ? 'Run completed' : 'Game over',
      };
      db.transaction(() => {
        db.prepare('UPDATE users SET best_score = MAX(best_score, ?), last_revision = ?, selected_level = ? WHERE id = ?').run(
          score,
          nextRevision,
          current.selected_level,
          user.id
        );
        clearActiveRun(user.id, nextRevision, current.selected_level);
        db.prepare(`
          INSERT INTO terminal_runs (user_id, run_id, outcome, level, score, finished_at, snapshot_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(user.id, snapshot.runId, outcome, level, score, finishedAt, JSON.stringify(snapshot));
        if (outcome === 'completed' || outcome === 'game-over') {
          db.prepare(`
            INSERT INTO leaderboard_entries (initials, score, level, achieved_at, email, source)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(leaderboardName, score, level, finishedAt, current.email, 'terminal-run');
        }
        if (outcome === 'completed') {
          const unlock = Math.min(10, level + 1);
          db.prepare('UPDATE users SET highest_level = MAX(highest_level, ?) WHERE id = ?').run(unlock, user.id);
        }
      })();
      body.progress = createBootstrapData(getUserById(user.id)).progress;
      body.leaderboard = createLeaderboard();
      body.recentRuns = createRecentRuns(user.id);
      setFinishedRun(user.id, snapshot.runId, operationId, requestHash, 200, body);
      return { status: 200, body };
    }),
  };
}

ensureSchema();
seedIfNeeded();
const handlers = createMutationHandlers();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(PUBLIC_DIR));

app.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.post('/api/auth/signin', (req, res) => {
  const body = parseJsonBody(req.body);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  const expected = hashPassword(password, user.password_salt);
  if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(user.password_hash, 'hex'))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = randomHex(32);
  db.prepare('INSERT INTO tokens (token, user_id, created_at) VALUES (?, ?, ?)').run(token, user.id, nowIso());
  return res.json({ token, bootstrap: createBootstrapData(user) });
});

app.post('/api/auth/signout', authMiddleware, (req, res) => {
  db.prepare('UPDATE tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(nowIso(), req.user.id);
  return res.json({ ok: true });
});

app.get('/api/bootstrap', authMiddleware, (req, res) => {
  return res.json(createBootstrapData(req.user));
});

app.post('/api/run/start', authMiddleware, handlers.start);
app.post('/api/run/save', authMiddleware, handlers.save);
app.post('/api/run/progress', authMiddleware, handlers.progress);
app.post('/api/run/finish', authMiddleware, handlers.finish);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Brickfall listening on http://localhost:${PORT}`);
});

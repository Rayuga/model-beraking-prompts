"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const Database = require("better-sqlite3");
const XLSX = require("xlsx");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "brickfall.db");
const W = 900;
const H = 600;
const BALL_RADIUS = 9;
const BASE_PADDLE_WIDTH = 118;
const PADDLE_HEIGHT = 18;
const WORKBOOK_PATH = process.env.SEED_PATH || [
  path.join(ROOT, "seed_data.xlsx"),
  "/assets/artifacts/brickfall_seed.xlsx",
].find((candidate) => fs.existsSync(candidate));
const SCENARIO_PATH = process.env.SCENARIO_PATH || [
  path.join(ROOT, "scenarios.json"),
  "/assets/artifacts/brickfall_scenarios.json",
].find((candidate) => fs.existsSync(candidate));

if (!WORKBOOK_PATH || !SCENARIO_PATH) {
  throw new Error("brickfall seed workbook and scenario manifest are required");
}
const scenarioSeed = JSON.parse(fs.readFileSync(SCENARIO_PATH, "utf8"));
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.exec([
  "CREATE TABLE IF NOT EXISTS users (",
  "  id INTEGER PRIMARY KEY,",
  "  email TEXT NOT NULL UNIQUE COLLATE NOCASE,",
  "  name TEXT NOT NULL,",
  "  initials TEXT NOT NULL,",
  "  password_salt TEXT NOT NULL,",
  "  password_hash TEXT NOT NULL,",
  "  highest_level INTEGER NOT NULL DEFAULT 1,",
  "  best_score INTEGER NOT NULL DEFAULT 0",
  ");",
  "CREATE TABLE IF NOT EXISTS sessions (",
  "  token TEXT PRIMARY KEY,",
  "  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,",
  "  created_at TEXT NOT NULL",
  ");",
  "CREATE TABLE IF NOT EXISTS levels (",
  "  level INTEGER PRIMARY KEY,",
  "  name TEXT NOT NULL,",
  "  base_speed REAL NOT NULL,",
  "  speed_cap REAL NOT NULL,",
  "  accent TEXT NOT NULL",
  ");",
  "CREATE TABLE IF NOT EXISTS bricks (",
  "  level INTEGER NOT NULL REFERENCES levels(level) ON DELETE CASCADE,",
  "  row_number INTEGER NOT NULL,",
  "  column_number INTEGER NOT NULL,",
  "  type TEXT NOT NULL,",
  "  drop_type TEXT NOT NULL DEFAULT '',",
  "  PRIMARY KEY (level, row_number, column_number)",
  ");",
  "CREATE TABLE IF NOT EXISTS constants (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
  "CREATE TABLE IF NOT EXISTS account_state (",
  "  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,",
  "  revision INTEGER NOT NULL DEFAULT 0",
  ");",
  "CREATE TABLE IF NOT EXISTS saves (",
  "  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,",
  "  state_json TEXT NOT NULL,",
  "  revision INTEGER NOT NULL DEFAULT 0,",
  "  updated_at TEXT NOT NULL",
  ");",
  "CREATE TABLE IF NOT EXISTS finished_runs (",
  "  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,",
  "  run_id TEXT NOT NULL,",
  "  score INTEGER NOT NULL,",
  "  level INTEGER NOT NULL,",
  "  outcome TEXT NOT NULL,",
  "  state_json TEXT NOT NULL DEFAULT '{}',",
  "  finished_at TEXT NOT NULL,",
  "  PRIMARY KEY (user_id, run_id)",
  ");",
  "CREATE TABLE IF NOT EXISTS terminal_run_ids (",
  "  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,",
  "  run_id TEXT NOT NULL,",
  "  PRIMARY KEY (user_id, run_id)",
  ");",
  "CREATE TABLE IF NOT EXISTS leaderboard (",
  "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
  "  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,",
  "  initials TEXT NOT NULL,",
  "  score INTEGER NOT NULL,",
  "  level INTEGER NOT NULL,",
  "  achieved_at TEXT NOT NULL",
  ");",
  "CREATE TABLE IF NOT EXISTS mutation_receipts (",
  "  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,",
  "  operation_id TEXT NOT NULL,",
  "  action TEXT NOT NULL,",
  "  request_hash TEXT NOT NULL,",
  "  status INTEGER NOT NULL,",
  "  body_json TEXT NOT NULL,",
  "  created_at TEXT NOT NULL,",
  "  PRIMARY KEY (user_id, operation_id)",
  ");",
  "CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
].join("\n"));

function ensureColumn(table, column, definition) {
  const columns = db.prepare("PRAGMA table_info(" + table + ")").all();
  if (!columns.some((item) => item.name === column)) {
    db.exec("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
  }
}
ensureColumn("saves", "revision", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("finished_runs", "state_json", "TEXT NOT NULL DEFAULT '{}'");
db.prepare([
  "INSERT OR IGNORE INTO terminal_run_ids (user_id, run_id)",
  "SELECT user_id, run_id FROM finished_runs",
].join(" ")).run();

function passwordRecord(value, salt = crypto.randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: crypto.scryptSync(String(value), salt, 64).toString("hex"),
  };
}

function passwordMatches(value, salt, expected) {
  const actual = crypto.scryptSync(String(value), salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length
    && crypto.timingSafeEqual(actual, expectedBuffer);
}

function workbookRows(workbook, name) {
  if (!workbook.Sheets[name]) throw new Error("Missing workbook sheet: " + name);
  return XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "" });
}

function seedDatabase() {
  if (db.prepare("SELECT COUNT(*) AS count FROM users").get().count > 0) {
    db.prepare("INSERT OR IGNORE INTO account_state (user_id, revision) SELECT id, 0 FROM users").run();
    return;
  }
  const workbook = XLSX.readFile(WORKBOOK_PATH);
  const users = workbookRows(workbook, "Users");
  const levels = workbookRows(workbook, "Levels");
  const bricks = workbookRows(workbook, "Bricks");
  const leaders = workbookRows(workbook, "Leaderboard");
  const constants = workbookRows(workbook, "Constants");
  const insertUser = db.prepare([
    "INSERT INTO users",
    "(id, email, name, initials, password_salt, password_hash, highest_level, best_score)",
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ].join(" "));
  const insertLevel = db.prepare(
    "INSERT INTO levels (level, name, base_speed, speed_cap, accent) VALUES (?, ?, ?, ?, ?)"
  );
  const insertBrick = db.prepare(
    "INSERT INTO bricks (level, row_number, column_number, type, drop_type) VALUES (?, ?, ?, ?, ?)"
  );
  const insertConstant = db.prepare("INSERT INTO constants (key, value) VALUES (?, ?)");
  const insertLeader = db.prepare(
    "INSERT INTO leaderboard (user_id, initials, score, level, achieved_at) VALUES (?, ?, ?, ?, ?)"
  );
  const findUser = db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE");
  db.transaction(() => {
    for (const row of users) {
      const password = passwordRecord(row.password);
      insertUser.run(
        Number(row.id),
        String(row.email).toLowerCase(),
        String(row.name),
        String(row.initials).toUpperCase(),
        password.salt,
        password.hash,
        Number(row.highest_level),
        Number(row.best_score)
      );
    }
    for (const row of levels) {
      insertLevel.run(
        Number(row.level),
        String(row.name),
        Number(row.base_speed),
        Number(row.speed_cap),
        String(row.accent)
      );
    }
    for (const row of bricks) {
      insertBrick.run(
        Number(row.level),
        Number(row.row),
        Number(row.column),
        String(row.type),
        String(row.drop || "")
      );
    }
    for (const row of constants) insertConstant.run(String(row.key), String(row.value));
    for (const row of leaders) {
      const owner = row.email ? findUser.get(String(row.email)) : null;
      insertLeader.run(
        owner ? owner.id : null,
        String(row.initials).toUpperCase(),
        Number(row.score),
        Number(row.level),
        String(row.achieved_at)
      );
    }
    for (const row of scenarioSeed.guest_leaderboard || []) {
      insertLeader.run(
        null,
        String(row.initials).toUpperCase(),
        Number(row.score),
        Number(row.level),
        String(row.achieved_at)
      );
    }
    db.prepare("INSERT INTO account_state (user_id, revision) SELECT id, 0 FROM users").run();
  })();
}

function brickGeometry(row, column) {
  const marginX = 42;
  const gap = 7;
  const width = (W - marginX * 2 - gap * 9) / 10;
  return {
    x: marginX + (column - 1) * (width + gap),
    y: 62 + (row - 1) * 34,
    width,
    height: 27,
  };
}

function levelRecord(levelNumber) {
  return db.prepare([
    "SELECT level, name, base_speed AS baseSpeed, speed_cap AS speedCap, accent",
    "FROM levels WHERE level = ?",
  ].join(" ")).get(levelNumber);
}

function levelBricks(levelNumber) {
  return db.prepare([
    "SELECT row_number AS row, column_number AS column, type, drop_type AS dropType",
    "FROM bricks WHERE level = ? ORDER BY row_number, column_number",
  ].join(" ")).all(levelNumber);
}

function levelManifestRows() {
  return db.prepare([
    "SELECT level, name, base_speed AS baseSpeed, speed_cap AS speedCap, accent",
    "FROM levels ORDER BY level",
  ].join(" ")).all().map((level) => {
    const bricks = levelBricks(level.level);
    const signature = bricks.map((brick) => (
      `${brick.row}:${brick.column}:${brick.type}:${brick.dropType || ""}`
    )).join("|");
    return {
      ...level,
      normal: bricks.filter((brick) => brick.type === "normal").length,
      strong: bricks.filter((brick) => brick.type === "strong").length,
      solid: bricks.filter((brick) => brick.type === "solid").length,
      digest: crypto.createHash("sha256").update(signature, "utf8").digest("hex"),
    };
  });
}

function buildInitialState(levelNumber, runId = "run-" + crypto.randomUUID()) {
  const level = levelRecord(levelNumber);
  if (!level) throw new Error("Unknown level " + levelNumber);
  const paddle = {
    x: W / 2,
    y: H - 38,
    width: BASE_PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    vx: 0,
  };
  return {
    runId,
    level: levelNumber,
    levelName: level.name,
    baseSpeed: level.baseSpeed,
    speedCap: level.speedCap,
    accent: level.accent,
    score: 0,
    lives: 3,
    combo: 1,
    nextExtraLife: 20000,
    phase: "ready",
    simulationTicks: 0,
    paddle,
    balls: [{
      id: 1,
      x: paddle.x,
      y: paddle.y - BALL_RADIUS - 2,
      vx: 0,
      vy: 0,
      r: BALL_RADIUS,
      stuck: true,
      offset: 0,
      primary: true,
    }],
    drops: [],
    power: null,
    bricks: levelBricks(levelNumber).map((brick, index) => ({
      id: String(levelNumber) + "-" + index,
      row: brick.row,
      column: brick.column,
      type: brick.type,
      dropType: brick.dropType,
      hp: brick.type === "solid" ? 99 : brick.type === "strong" ? 2 : 1,
      ...brickGeometry(brick.row, brick.column),
    })),
  };
}

function seedCheckpoints() {
  const checkpointMarker = db.prepare(
    "SELECT value FROM app_meta WHERE key = 'checkpoint_seed'"
  ).get();
  const historyMarker = db.prepare(
    "SELECT value FROM app_meta WHERE key = 'history_fixture_seed'"
  ).get();
  if (checkpointMarker?.value === "2.0" && historyMarker?.value === "2.1") return;
  const mira = db.prepare("SELECT id FROM users WHERE email = 'mira@brickfall.test'").get();
  const dev = db.prepare("SELECT id FROM users WHERE email = 'dev@brickfall.test'").get();
  const polly = db.prepare("SELECT id, initials FROM users WHERE email = 'polly@brickfall.test'").get();
  const miraConfig = scenarioSeed.checkpoints.mira;
  const devConfig = scenarioSeed.checkpoints.dev;
  const miraState = buildInitialState(miraConfig.level, "seed-mira-level8");
  miraState.score = miraConfig.score;
  miraState.lives = miraConfig.lives;
  miraState.combo = miraConfig.combo;
  miraState.nextExtraLife = miraConfig.next_extra_life;
  miraState.phase = "paused";
  miraState.power = { type: miraConfig.power, remaining: miraConfig.power_seconds };
  miraState.paddle.width = BASE_PADDLE_WIDTH * 1.5;
  const damaged = miraState.bricks.find((brick) => brick.type === "strong");
  damaged.hp = 1;
  miraState.drops = [{
    id: "seed-drop",
    type: "sticky",
    x: 130,
    y: 330,
    vy: 126,
  }];
  miraState.balls = [
    {
      id: 1,
      x: 70,
      y: H - 18,
      vx: 80,
      vy: 330,
      r: BALL_RADIUS,
      stuck: false,
      offset: 0,
      primary: true,
    },
    {
      id: 2,
      x: 820,
      y: H + 20,
      vx: -70,
      vy: 330,
      r: BALL_RADIUS,
      stuck: false,
      offset: 0,
      primary: false,
    },
  ];

  const devState = buildInitialState(devConfig.level, "seed-dev-level3");
  const target = devState.bricks
    .filter((brick) => brick.type === "normal")
    .sort((a, b) => b.row - a.row || a.column - b.column)[0];
  for (const brick of devState.bricks) {
    if (brick.type !== "solid") brick.hp = brick.id === target.id ? 1 : 0;
  }
  devState.score = devConfig.score;
  devState.lives = devConfig.lives;
  devState.combo = devConfig.combo;
  devState.nextExtraLife = devConfig.next_extra_life;
  devState.phase = "paused";
  devState.paddle.x = target.x + target.width / 2;
  devState.balls = [{
    id: 1,
    x: target.x + target.width / 2,
    y: target.y + target.height + BALL_RADIUS + 5,
    vx: 24,
    vy: -devState.baseSpeed,
    r: BALL_RADIUS,
    stuck: false,
    offset: 0,
    primary: true,
  }];

  const now = "2026-09-01T00:00:00.000Z";
  db.transaction(() => {
    if (checkpointMarker?.value !== "2.0") {
      db.prepare([
        "INSERT OR REPLACE INTO saves (user_id, state_json, revision, updated_at)",
        "VALUES (?, ?, 1, ?)",
      ].join(" ")).run(mira.id, JSON.stringify(miraState), now);
      db.prepare([
        "INSERT OR REPLACE INTO saves (user_id, state_json, revision, updated_at)",
        "VALUES (?, ?, 1, ?)",
      ].join(" ")).run(dev.id, JSON.stringify(devState), now);
      db.prepare("UPDATE account_state SET revision = 1 WHERE user_id IN (?, ?)")
        .run(mira.id, dev.id);
      db.prepare([
        "INSERT INTO app_meta (key, value) VALUES ('checkpoint_seed', '2.0')",
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ].join(" ")).run();
    }
    if (historyMarker?.value !== "2.1") {
      const insertTerminalId = db.prepare(
        "INSERT OR IGNORE INTO terminal_run_ids (user_id, run_id) VALUES (?, ?)"
      );
      const insertHistory = db.prepare([
        "INSERT OR IGNORE INTO finished_runs",
        "(user_id, run_id, score, level, outcome, state_json, finished_at)",
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
      ].join(" "));
      const insertLeaderboard = db.prepare([
        "INSERT INTO leaderboard (user_id, initials, score, level, achieved_at)",
        "VALUES (?, ?, ?, ?, ?)",
      ].join(" "));
      for (const fixture of scenarioSeed.personal_run_fixtures || []) {
        if (fixture.user !== "polly") continue;
        const terminal = buildInitialState(Number(fixture.level), String(fixture.run_id));
        terminal.score = Number(fixture.score);
        terminal.phase = String(fixture.outcome);
        terminal.balls = [];
        terminal.drops = [];
        terminal.power = null;
        if (fixture.outcome === "game-over") terminal.lives = 0;
        if (fixture.outcome === "completed") {
          for (const brick of terminal.bricks) {
            if (brick.type !== "solid") brick.hp = 0;
          }
        }
        insertTerminalId.run(polly.id, terminal.runId);
        insertHistory.run(
          polly.id,
          terminal.runId,
          terminal.score,
          terminal.level,
          terminal.phase,
          JSON.stringify(terminal),
          String(fixture.finished_at)
        );
        insertLeaderboard.run(
          polly.id,
          polly.initials,
          terminal.score,
          terminal.level,
          String(fixture.finished_at)
        );
      }
      trimFinishedRuns(polly.id);
      db.prepare([
        "INSERT INTO app_meta (key, value) VALUES ('history_fixture_seed', '2.1')",
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ].join(" ")).run();
    }
  })();
}

seedDatabase();
seedCheckpoints();

const app = express();
app.use(express.json({ limit: "2mb" }));

function publicUser(row) {
  return {
    name: row.name,
    email: row.email,
    initials: row.initials,
    highestLevel: row.highest_level,
    bestScore: row.best_score,
  };
}

function leaderboardRows() {
  return db.prepare([
    "SELECT initials, score, level, achieved_at AS achievedAt",
    "FROM leaderboard",
    "ORDER BY score DESC, achieved_at ASC, id ASC LIMIT 10",
  ].join(" ")).all();
}

function recentRunRows(userId) {
  return db.prepare([
    "SELECT run_id AS runId, score, level, outcome, state_json AS state,",
    "finished_at AS finishedAt FROM finished_runs WHERE user_id = ?",
    "ORDER BY finished_at DESC, rowid DESC LIMIT 10",
  ].join(" ")).all(userId).map((row) => ({
    ...row,
    state: JSON.parse(row.state),
  }));
}

function trimFinishedRuns(userId) {
  db.prepare([
    "DELETE FROM finished_runs WHERE user_id = ? AND run_id NOT IN (",
    "SELECT run_id FROM finished_runs WHERE user_id = ?",
    "ORDER BY finished_at DESC, rowid DESC LIMIT 10",
    ")",
  ].join(" ")).run(userId, userId);
}

function authenticate(req, res, next) {
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const session = match ? db.prepare([
    "SELECT u.* FROM sessions s",
    "JOIN users u ON u.id = s.user_id WHERE s.token = ?",
  ].join(" ")).get(match[1]) : null;
  if (!session) return res.status(401).json({ error: "Authentication required" });
  req.user = session;
  req.token = match[1];
  return next();
}

function integer(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validPoint(value) {
  return value && finite(value.x) && finite(value.y);
}

const PHASES = new Set([
  "menu",
  "ready",
  "playing",
  "paused",
  "life-lost",
  "level-complete",
  "game-over",
  "completed",
]);
const POWERUPS = new Set(["wide", "slow", "multiball", "sticky"]);

function nearly(left, right) {
  return Math.abs(Number(left) - Number(right)) < 0.02;
}

function validSave(state, highestLevel) {
  if (!state || typeof state !== "object" || Array.isArray(state) || state.practice) return false;
  if (typeof state.runId !== "string" || !/^[a-zA-Z0-9-]{8,80}$/.test(state.runId)) return false;
  if (!integer(state.level, 1, Math.min(10, highestLevel))) return false;
  const level = levelRecord(state.level);
  if (!level || state.levelName !== level.name || !nearly(state.baseSpeed, level.baseSpeed)
      || !nearly(state.speedCap, level.speedCap) || state.accent !== level.accent) return false;
  if (!integer(state.score, 0, 1_000_000_000) || !integer(state.lives, 0, 99)) return false;
  if (!integer(state.combo, 1, 5) || !integer(state.nextExtraLife, 20_000, 1_000_000_000)) return false;
  if (state.nextExtraLife % 20_000 !== 0 || !PHASES.has(state.phase)) return false;
  if (!integer(state.simulationTicks, 0, 10_000_000_000)) return false;
  if (!validPoint(state.paddle) || !finite(state.paddle.width)
      || state.paddle.width < 50 || state.paddle.width > 220
      || !finite(state.paddle.height) || !finite(state.paddle.vx)) return false;
  if (!Array.isArray(state.balls) || state.balls.length > 8
      || !state.balls.every((ball) => validPoint(ball)
        && finite(ball.vx) && finite(ball.vy) && finite(ball.r)
        && typeof ball.stuck === "boolean" && typeof ball.primary === "boolean")) return false;
  if (!Array.isArray(state.drops) || state.drops.length > 50
      || !state.drops.every((drop) => validPoint(drop)
        && finite(drop.vy) && POWERUPS.has(drop.type))) return false;
  if (state.power !== null && state.power !== undefined) {
    if (!state.power || !POWERUPS.has(state.power.type)
        || !finite(state.power.remaining)
        || state.power.remaining < 0 || state.power.remaining > 20.1) return false;
  }
  const expected = levelBricks(state.level);
  if (!Array.isArray(state.bricks) || state.bricks.length !== expected.length) return false;
  const actualByKey = new Map(state.bricks.map((brick) => [
    String(brick.row) + ":" + String(brick.column),
    brick,
  ]));
  if (actualByKey.size !== expected.length) return false;
  for (const record of expected) {
    const brick = actualByKey.get(String(record.row) + ":" + String(record.column));
    const geometry = brickGeometry(record.row, record.column);
    const allowedHp = record.type === "solid" ? [99] : record.type === "strong" ? [0, 1, 2] : [0, 1];
    if (!brick || brick.type !== record.type || brick.dropType !== record.dropType
        || !allowedHp.includes(brick.hp)
        || !nearly(brick.x, geometry.x) || !nearly(brick.y, geometry.y)
        || !nearly(brick.width, geometry.width) || !nearly(brick.height, geometry.height)) return false;
  }
  return true;
}

function currentRevision(userId) {
  return db.prepare("SELECT revision FROM account_state WHERE user_id = ?").get(userId).revision;
}

function currentSavedRun(userId) {
  const row = db.prepare([
    "SELECT state_json AS state, revision, updated_at AS updatedAt",
    "FROM saves WHERE user_id = ?",
  ].join(" ")).get(userId);
  return row ? { state: JSON.parse(row.state), revision: row.revision, updatedAt: row.updatedAt } : null;
}

function authoritative(userId) {
  return {
    currentRevision: currentRevision(userId),
    authoritativeState: currentSavedRun(userId),
  };
}

function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => (
      JSON.stringify(key) + ":" + canonical(value[key])
    )).join(",") + "}";
  }
  return JSON.stringify(value);
}

class KnownMutation extends Error {
  constructor(status, body) {
    super(body.error || "Mutation failed");
    this.status = status;
    this.body = body;
  }
}

function failMutation(status, body) {
  throw new KnownMutation(status, body);
}

function requireExpectedRevision(userId, value) {
  const current = currentRevision(userId);
  if (!integer(value, 0, 1_000_000_000)) {
    failMutation(400, { error: "Expected revision is required", ...authoritative(userId) });
  }
  if (value !== current) {
    failMutation(409, { error: "Stale run revision", ...authoritative(userId) });
  }
  return current;
}

function advanceRevision(userId, previous) {
  const next = previous + 1;
  db.prepare("UPDATE account_state SET revision = ? WHERE user_id = ?").run(next, userId);
  return next;
}

function handleMutation(req, res, action, execute) {
  const operationId = String(req.body && req.body.operationId || "");
  if (!/^[a-f0-9-]{32,80}$/i.test(operationId)) {
    return res.status(400).json({ error: "A fresh opaque operation id is required" });
  }
  const requestHash = crypto.createHash("sha256")
    .update(action + "\n" + canonical(req.body))
    .digest("hex");
  const result = db.transaction(() => {
    const prior = db.prepare([
      "SELECT action, request_hash AS requestHash, status, body_json AS body",
      "FROM mutation_receipts WHERE user_id = ? AND operation_id = ?",
    ].join(" ")).get(req.user.id, operationId);
    if (prior) {
      if (prior.action !== action || prior.requestHash !== requestHash) {
        return {
          status: 409,
          body: {
            error: "Operation id was already used for a different request",
            ...authoritative(req.user.id),
          },
        };
      }
      return { status: prior.status, body: JSON.parse(prior.body) };
    }
    let outcome;
    try {
      outcome = execute();
    } catch (error) {
      if (!(error instanceof KnownMutation)) throw error;
      outcome = { status: error.status, body: error.body };
    }
    db.prepare([
      "INSERT INTO mutation_receipts",
      "(user_id, operation_id, action, request_hash, status, body_json, created_at)",
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
    ].join(" ")).run(
      req.user.id,
      operationId,
      action,
      requestHash,
      outcome.status,
      JSON.stringify(outcome.body),
      new Date().toISOString()
    );
    return outcome;
  })();
  return res.status(result.status).json(result.body);
}

function countBreakable(state) {
  return state.bricks.filter((brick) => brick.type !== "solid" && brick.hp > 0).length;
}

function customBrick(id, type, hp, x, dropType = "") {
  return {
    id,
    row: 1,
    column: Number(id.replace(/\D/g, "")) || 1,
    type,
    dropType,
    hp,
    x,
    y: 150,
    width: 120,
    height: 27,
  };
}

function practiceState(drill) {
  const validDrills = new Set((scenarioSeed.drills || []).map((item) => item.id));
  if (!validDrills.has(drill)) return null;
  const state = buildInitialState(drill === "final-wall" ? 10 : 1, "practice-" + drill);
  state.practice = true;
  state.phase = "paused";
  state.simulationTicks = 0;
  state.bricks = [customBrick("practice1", "normal", 1, 390)];
  state.balls = [{
    id: 1,
    x: 450,
    y: 195,
    vx: 0,
    vy: -300,
    r: BALL_RADIUS,
    stuck: false,
    offset: 0,
    primary: true,
  }];
  if (drill === "brick-types") {
    state.bricks = [
      customBrick("practice1", "normal", 1, 75),
      customBrick("practice2", "strong", 2, 235),
      customBrick("practice3", "strong", 1, 390),
      customBrick("practice4", "normal", 1, 545),
      customBrick("practice5", "solid", 99, 705),
    ];
    state.balls = state.bricks.map((brick, index) => {
      const ball = {
        id: index + 1,
        x: brick.x + brick.width / 2,
        y: brick.y + brick.height + BALL_RADIUS + 1,
        vx: 0,
        vy: -300,
        r: BALL_RADIUS,
        stuck: false,
        offset: 0,
        primary: index === 0,
      };
      if (index === 2) {
        ball.x = brick.x + brick.width + 7;
        ball.y = brick.y + brick.height + 7;
        ball.vx = -100;
        ball.vy = -Math.sqrt(300 * 300 - 100 * 100);
      }
      if (index === 3) {
        ball.x = brick.x + 35;
        ball.y = 400;
        ball.vy = -1000;
      }
      return ball;
    });
    state.balls.push({
      id: 6,
      x: state.paddle.x + 40,
      y: 400,
      vx: -100,
      vy: Math.sqrt(300 * 300 - 100 * 100),
      r: BALL_RADIUS,
      stuck: false,
      offset: 0,
      primary: false,
    });
  } else if (drill === "power-relay") {
    state.bricks = [customBrick("practice1", "normal", 1, 20), customBrick("practice2", "solid", 99, 390)];
    state.balls = [{
      ...state.balls[0],
      x: 250,
      y: 330,
      vx: 100,
      vy: -Math.sqrt(300 * 300 - 100 * 100),
      stuck: false,
    }];
    state.drops = ["wide", "wide", "slow", "multiball", "multiball", "sticky"].map((type, index) => ({
      id: "relay-" + index,
      type,
      x: state.paddle.x,
      y: state.paddle.y - 7,
      vy: 126,
    }));
  } else if (drill === "multiball") {
    state.bricks = [customBrick("practice1", "normal", 1, 20), customBrick("practice2", "solid", 99, 390)];
    state.power = { type: "multiball", remaining: 10 };
    state.balls = [
      { ...state.balls[0], x: 250, y: 330, vx: 120, vy: -280, primary: true },
      { ...state.balls[0], id: 2, x: 760, y: H + 25, vx: -80, vy: 300, primary: false },
    ];
  } else if (drill === "sticky-catch") {
    state.bricks = [customBrick("practice1", "normal", 1, 20), customBrick("practice2", "solid", 99, 390)];
    state.power = { type: "sticky", remaining: 1.5 };
    state.balls = [{
      ...state.balls[0],
      x: state.paddle.x,
      y: state.paddle.y - 25,
      vx: 0,
      vy: 300,
    }];
  } else if (drill === "extra-life") {
    state.bricks = [customBrick("practice1", "normal", 1, 390), customBrick("practice2", "normal", 1, 20)];
    state.score = 19950;
    state.lives = 3;
    state.combo = 1;
    state.nextExtraLife = 20000;
  } else if (drill === "last-ball") {
    state.bricks = [customBrick("practice1", "normal", 1, 20), customBrick("practice2", "solid", 99, 390)];
    state.lives = 2;
    state.power = { type: "wide", remaining: 10 };
    state.paddle.width = BASE_PADDLE_WIDTH * 1.5;
    state.drops = [{ id: "last-drop", type: "slow", x: 100, y: 300, vy: 126 }];
    state.balls = [{
      ...state.balls[0],
      x: 80,
      y: H + 25,
      vx: 0,
      vy: 300,
    }];
  } else if (drill === "final-wall") {
    state.level = 10;
    state.levelName = levelRecord(10).name;
    state.baseSpeed = levelRecord(10).baseSpeed;
    state.speedCap = levelRecord(10).speedCap;
    state.accent = levelRecord(10).accent;
    state.score = 5000;
  }
  return state;
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/login", (req, res) => {
  const email = String(req.body && req.body.email || "").trim().toLowerCase();
  const password = String(req.body && req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email);
  if (!user || !passwordMatches(password, user.password_salt, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)")
    .run(token, user.id, new Date().toISOString());
  return res.json({ token, user: publicUser(user) });
});

app.post("/api/logout", authenticate, (req, res) => {
  const revoked = db.prepare("DELETE FROM sessions WHERE user_id = ?").run(req.user.id).changes;
  return res.json({ ok: true, revoked });
});

app.get("/api/bootstrap", authenticate, (req, res) => {
  const levels = db.prepare([
    "SELECT level, name, base_speed AS baseSpeed, speed_cap AS speedCap, accent",
    "FROM levels WHERE level <= ? ORDER BY level",
  ].join(" ")).all(req.user.highest_level);
  return res.json({
    user: publicUser(req.user),
    levels,
    constants: Object.fromEntries(
      db.prepare("SELECT key, value FROM constants ORDER BY key").all()
        .map((row) => [row.key, row.value])
    ),
    savedRun: currentSavedRun(req.user.id),
    revision: currentRevision(req.user.id),
    leaderboard: leaderboardRows(),
    recentRuns: recentRunRows(req.user.id),
    drills: scenarioSeed.drills,
    seedManifest: levelManifestRows(),
  });
});

app.get("/api/levels/:level", authenticate, (req, res) => {
  const levelNumber = Number(req.params.level);
  if (!integer(levelNumber, 1, Math.min(10, req.user.highest_level))) {
    return res.status(403).json({ error: "Level is locked" });
  }
  const level = levelRecord(levelNumber);
  if (!level) return res.status(404).json({ error: "Level not found" });
  return res.json({ level, bricks: levelBricks(levelNumber) });
});

app.get("/api/practice/:drill", authenticate, (req, res) => {
  const state = practiceState(String(req.params.drill));
  if (!state) return res.status(404).json({ error: "Unknown mechanics drill" });
  return res.json({ state });
});

app.post("/api/run/start", authenticate, (req, res) => (
  handleMutation(req, res, "start", () => {
    const previous = requireExpectedRevision(req.user.id, req.body.expectedRevision);
    const levelNumber = Number(req.body.level);
    if (!integer(levelNumber, 1, Math.min(10, req.user.highest_level))) {
      failMutation(403, { error: "Level is locked", ...authoritative(req.user.id) });
    }
    const state = buildInitialState(levelNumber);
    const revision = advanceRevision(req.user.id, previous);
    const now = new Date().toISOString();
    db.prepare([
      "INSERT INTO saves (user_id, state_json, revision, updated_at) VALUES (?, ?, ?, ?)",
      "ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json,",
      "revision = excluded.revision, updated_at = excluded.updated_at",
    ].join(" ")).run(req.user.id, JSON.stringify(state), revision, now);
    return { status: 200, body: { state, revision, savedAt: now } };
  })
));

app.put("/api/run/save", authenticate, (req, res) => (
  handleMutation(req, res, "save", () => {
    const previous = requireExpectedRevision(req.user.id, req.body.expectedRevision);
    const state = req.body.state;
    if (!validSave(state, req.user.highest_level)) {
      failMutation(400, { error: "Invalid run snapshot", ...authoritative(req.user.id) });
    }
    const saved = currentSavedRun(req.user.id);
    if (!saved || saved.state.runId !== state.runId) {
      failMutation(409, { error: "Run is no longer current", ...authoritative(req.user.id) });
    }
    if (db.prepare("SELECT 1 FROM terminal_run_ids WHERE user_id = ? AND run_id = ?")
      .get(req.user.id, state.runId)) {
      failMutation(409, { error: "Finished run cannot be saved", ...authoritative(req.user.id) });
    }
    const revision = advanceRevision(req.user.id, previous);
    const now = new Date().toISOString();
    db.prepare("UPDATE saves SET state_json = ?, revision = ?, updated_at = ? WHERE user_id = ?")
      .run(JSON.stringify(state), revision, now, req.user.id);
    return { status: 200, body: { revision, savedAt: now } };
  })
));

app.post("/api/run/clear", authenticate, (req, res) => (
  handleMutation(req, res, "clear", () => {
    const previous = requireExpectedRevision(req.user.id, req.body.expectedRevision);
    db.prepare("DELETE FROM saves WHERE user_id = ?").run(req.user.id);
    const revision = advanceRevision(req.user.id, previous);
    return { status: 200, body: { ok: true, revision } };
  })
));

app.post("/api/run/progress", authenticate, (req, res) => (
  handleMutation(req, res, "progress", () => {
    const previous = requireExpectedRevision(req.user.id, req.body.expectedRevision);
    const state = req.body.state;
    if (!validSave(state, req.user.highest_level)
        || state.phase !== "level-complete" || countBreakable(state) !== 0) {
      failMutation(400, { error: "Invalid level completion", ...authoritative(req.user.id) });
    }
    const saved = currentSavedRun(req.user.id);
    if (!saved || saved.state.runId !== state.runId || saved.state.level !== state.level) {
      failMutation(409, { error: "Run is no longer current", ...authoritative(req.user.id) });
    }
    if (state.score < saved.state.score + 1000 * state.level) {
      failMutation(400, { error: "Completion bonus is missing", ...authoritative(req.user.id) });
    }
    const unlockedLevel = Math.min(10, state.level + 1);
    db.prepare("UPDATE users SET highest_level = MAX(highest_level, ?) WHERE id = ?")
      .run(unlockedLevel, req.user.id);
    const revision = advanceRevision(req.user.id, previous);
    const now = new Date().toISOString();
    db.prepare("UPDATE saves SET state_json = ?, revision = ?, updated_at = ? WHERE user_id = ?")
      .run(JSON.stringify(state), revision, now, req.user.id);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    return {
      status: 200,
      body: { user: publicUser(user), unlockedLevel, revision, savedAt: now },
    };
  })
));

app.post("/api/run/finish", authenticate, (req, res) => (
  handleMutation(req, res, "finish", () => {
    const previous = requireExpectedRevision(req.user.id, req.body.expectedRevision);
    const state = req.body.state;
    const outcome = String(req.body.outcome || "");
    if (!validSave(state, req.user.highest_level) || !["game-over", "completed"].includes(outcome)) {
      failMutation(400, { error: "Invalid final result", ...authoritative(req.user.id) });
    }
    const validGameOver = outcome === "game-over" && state.phase === "game-over" && state.lives === 0;
    const validCompletion = outcome === "completed" && state.phase === "completed"
      && state.level === 10 && countBreakable(state) === 0;
    if (!validGameOver && !validCompletion) {
      failMutation(400, { error: "Terminal state does not match outcome", ...authoritative(req.user.id) });
    }
    const existing = db.prepare(
      "SELECT 1 FROM terminal_run_ids WHERE user_id = ? AND run_id = ?"
    ).get(req.user.id, state.runId);
    if (existing) {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
      return {
        status: 200,
        body: {
          recorded: false,
          revision: previous,
          user: publicUser(user),
          leaderboard: leaderboardRows(),
          recentRuns: recentRunRows(req.user.id),
        },
      };
    }
    const saved = currentSavedRun(req.user.id);
    if (!saved || saved.state.runId !== state.runId) {
      failMutation(409, { error: "Run is no longer current", ...authoritative(req.user.id) });
    }
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO terminal_run_ids (user_id, run_id) VALUES (?, ?)"
    ).run(req.user.id, state.runId);
    db.prepare([
      "INSERT INTO finished_runs",
      "(user_id, run_id, score, level, outcome, state_json, finished_at)",
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
    ].join(" ")).run(
      req.user.id,
      state.runId,
      state.score,
      state.level,
      outcome,
      JSON.stringify(state),
      now
    );
    db.prepare([
      "INSERT INTO leaderboard (user_id, initials, score, level, achieved_at)",
      "VALUES (?, ?, ?, ?, ?)",
    ].join(" ")).run(req.user.id, req.user.initials, state.score, state.level, now);
    db.prepare("UPDATE users SET best_score = MAX(best_score, ?) WHERE id = ?")
      .run(state.score, req.user.id);
    db.prepare("DELETE FROM saves WHERE user_id = ?").run(req.user.id);
    trimFinishedRuns(req.user.id);
    const revision = advanceRevision(req.user.id, previous);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    return {
      status: 200,
      body: {
        recorded: true,
        revision,
        user: publicUser(user),
        leaderboard: leaderboardRows(),
        recentRuns: recentRunRows(req.user.id),
      },
    };
  })
));

app.use(express.static(path.join(ROOT, "public"), { extensions: ["html"] }));
app.get("*path", (_req, res) => res.sendFile(path.join(ROOT, "public", "index.html")));

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("Brickfall listening on " + PORT);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

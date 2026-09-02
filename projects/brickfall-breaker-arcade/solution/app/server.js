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
const SEED_PATH = process.env.SEED_PATH || [
  path.join(ROOT, "seed_data.xlsx"),
  "/assets/artifacts/brickfall_seed.xlsx",
].find((candidate) => fs.existsSync(candidate));

if (!SEED_PATH) throw new Error("brickfall_seed.xlsx is required");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    initials TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    highest_level INTEGER NOT NULL DEFAULT 1,
    best_score INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS levels (
    level INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    base_speed REAL NOT NULL,
    speed_cap REAL NOT NULL,
    accent TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS bricks (
    level INTEGER NOT NULL REFERENCES levels(level) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    column_number INTEGER NOT NULL,
    type TEXT NOT NULL,
    drop_type TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (level, row_number, column_number)
  );
  CREATE TABLE IF NOT EXISTS constants (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS saves (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS finished_runs (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    run_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    level INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    finished_at TEXT NOT NULL,
    PRIMARY KEY (user_id, run_id)
  );
  CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    initials TEXT NOT NULL,
    score INTEGER NOT NULL,
    level INTEGER NOT NULL,
    achieved_at TEXT NOT NULL
  );
`);

function passwordRecord(value, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(String(value), salt, 64).toString("hex") };
}

function passwordMatches(value, salt, expected) {
  const actual = crypto.scryptSync(String(value), salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

function workbookRows(workbook, name) {
  if (!workbook.Sheets[name]) throw new Error(`Missing workbook sheet: ${name}`);
  return XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "" });
}

function seedDatabase() {
  if (db.prepare("SELECT COUNT(*) AS count FROM users").get().count > 0) return;
  const workbook = XLSX.readFile(SEED_PATH);
  const users = workbookRows(workbook, "Users");
  const levels = workbookRows(workbook, "Levels");
  const bricks = workbookRows(workbook, "Bricks");
  const leaderboard = workbookRows(workbook, "Leaderboard");
  const constants = workbookRows(workbook, "Constants");

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, name, initials, password_salt, password_hash, highest_level, best_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertLevel = db.prepare("INSERT INTO levels (level, name, base_speed, speed_cap, accent) VALUES (?, ?, ?, ?, ?)");
  const insertBrick = db.prepare("INSERT INTO bricks (level, row_number, column_number, type, drop_type) VALUES (?, ?, ?, ?, ?)");
  const insertConstant = db.prepare("INSERT INTO constants (key, value) VALUES (?, ?)");
  const insertLeader = db.prepare("INSERT INTO leaderboard (user_id, initials, score, level, achieved_at) VALUES (?, ?, ?, ?, ?)");
  const findUser = db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE");

  db.transaction(() => {
    for (const row of users) {
      const password = passwordRecord(row.password);
      insertUser.run(Number(row.id), String(row.email).toLowerCase(), String(row.name), String(row.initials).toUpperCase(), password.salt, password.hash, Number(row.highest_level), Number(row.best_score));
    }
    for (const row of levels) insertLevel.run(Number(row.level), String(row.name), Number(row.base_speed), Number(row.speed_cap), String(row.accent));
    for (const row of bricks) insertBrick.run(Number(row.level), Number(row.row), Number(row.column), String(row.type), String(row.drop || ""));
    for (const row of constants) insertConstant.run(String(row.key), String(row.value));
    for (const row of leaderboard) {
      const user = row.email ? findUser.get(String(row.email)) : null;
      insertLeader.run(user ? user.id : null, String(row.initials).toUpperCase(), Number(row.score), Number(row.level), String(row.achieved_at));
    }
  })();
}

seedDatabase();

const app = express();
app.use(express.json({ limit: "1mb" }));

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
  return db.prepare(`
    SELECT initials, score, level, achieved_at AS achievedAt
    FROM leaderboard
    ORDER BY score DESC, achieved_at ASC, id ASC
    LIMIT 10
  `).all();
}

function authenticate(req, res, next) {
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const session = match ? db.prepare(`
    SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?
  `).get(match[1]) : null;
  if (!session) return res.status(401).json({ error: "Authentication required" });
  req.user = session;
  req.token = match[1];
  next();
}

function integer(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

const PHASES = new Set(["menu", "ready", "playing", "paused", "life-lost", "level-complete", "game-over"]);
const POWERUPS = new Set(["wide", "slow", "multiball", "sticky"]);

function validPoint(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function validSave(state, highestLevel) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  if (typeof state.runId !== "string" || !/^[a-zA-Z0-9-]{8,80}$/.test(state.runId)) return false;
  if (!integer(state.level, 1, Math.min(10, highestLevel))) return false;
  if (!integer(state.score, 0, 1_000_000_000) || !integer(state.lives, 0, 99)) return false;
  if (!integer(state.combo, 1, 5) || !integer(state.nextExtraLife, 20_000, 1_000_000_000)) return false;
  if (!PHASES.has(state.phase) || !validPoint(state.paddle)) return false;
  if (!Array.isArray(state.balls) || state.balls.length > 8 || !state.balls.every((ball) => validPoint(ball) && Number.isFinite(ball.vx) && Number.isFinite(ball.vy))) return false;
  if (!Array.isArray(state.bricks) || state.bricks.length > 100 || !state.bricks.every((brick) => integer(brick.row, 1, 20) && integer(brick.column, 1, 20) && integer(brick.hp, 0, 99))) return false;
  if (!Array.isArray(state.drops) || state.drops.length > 50 || !state.drops.every((drop) => validPoint(drop) && POWERUPS.has(drop.type))) return false;
  if (state.power !== null && state.power !== undefined) {
    if (!state.power || !POWERUPS.has(state.power.type) || !Number.isFinite(state.power.remaining) || state.power.remaining < 0 || state.power.remaining > 20.1) return false;
  }
  return true;
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email);
  if (!user || !passwordMatches(password, user.password_salt, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(token, user.id, new Date().toISOString());
  res.json({ token, user: publicUser(user) });
});

app.post("/api/logout", authenticate, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(req.token);
  res.json({ ok: true });
});

app.get("/api/bootstrap", authenticate, (req, res) => {
  const levels = db.prepare("SELECT level, name, base_speed AS baseSpeed, speed_cap AS speedCap, accent FROM levels WHERE level <= ? ORDER BY level").all(req.user.highest_level);
  const saved = db.prepare("SELECT state_json AS state, updated_at AS updatedAt FROM saves WHERE user_id = ?").get(req.user.id);
  const constants = Object.fromEntries(db.prepare("SELECT key, value FROM constants").all().map((row) => [row.key, row.value]));
  res.json({
    user: publicUser(req.user),
    levels,
    constants,
    savedRun: saved ? { state: JSON.parse(saved.state), updatedAt: saved.updatedAt } : null,
    leaderboard: leaderboardRows(),
  });
});

app.get("/api/levels/:level", authenticate, (req, res) => {
  const levelNumber = Number(req.params.level);
  if (!integer(levelNumber, 1, Math.min(10, req.user.highest_level))) return res.status(403).json({ error: "Level is locked" });
  const level = db.prepare("SELECT level, name, base_speed AS baseSpeed, speed_cap AS speedCap, accent FROM levels WHERE level = ?").get(levelNumber);
  if (!level) return res.status(404).json({ error: "Level not found" });
  const bricks = db.prepare("SELECT row_number AS row, column_number AS column, type, drop_type AS dropType FROM bricks WHERE level = ? ORDER BY row_number, column_number").all(levelNumber);
  res.json({ level, bricks });
});

app.put("/api/save", authenticate, (req, res) => {
  const state = req.body?.state;
  if (!validSave(state, req.user.highest_level)) return res.status(400).json({ error: "Invalid run snapshot" });
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO saves (user_id, state_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
  `).run(req.user.id, JSON.stringify(state), now);
  res.json({ savedAt: now });
});

app.delete("/api/save", authenticate, (req, res) => {
  db.prepare("DELETE FROM saves WHERE user_id = ?").run(req.user.id);
  res.json({ ok: true });
});

app.post("/api/progress", authenticate, (req, res) => {
  const completedLevel = Number(req.body?.completedLevel);
  const score = Number(req.body?.score);
  if (!integer(completedLevel, 1, Math.min(10, req.user.highest_level)) || !integer(score, 0, 1_000_000_000)) {
    return res.status(400).json({ error: "Invalid progress update" });
  }
  const nextLevel = Math.min(10, completedLevel + 1);
  db.prepare("UPDATE users SET highest_level = MAX(highest_level, ?), best_score = MAX(best_score, ?) WHERE id = ?").run(nextLevel, score, req.user.id);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  res.json({ user: publicUser(user), unlockedLevel: nextLevel });
});

app.post("/api/finish", authenticate, (req, res) => {
  const runId = String(req.body?.runId || "");
  const score = Number(req.body?.score);
  const level = Number(req.body?.level);
  const outcome = String(req.body?.outcome || "");
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(runId) || !integer(score, 0, 1_000_000_000) || !integer(level, 1, 10) || !["game-over", "completed"].includes(outcome)) {
    return res.status(400).json({ error: "Invalid final result" });
  }
  const now = new Date().toISOString();
  const finish = db.transaction(() => {
    const result = db.prepare("INSERT OR IGNORE INTO finished_runs (user_id, run_id, score, level, outcome, finished_at) VALUES (?, ?, ?, ?, ?, ?)").run(req.user.id, runId, score, level, outcome, now);
    if (result.changes) {
      db.prepare("INSERT INTO leaderboard (user_id, initials, score, level, achieved_at) VALUES (?, ?, ?, ?, ?)").run(req.user.id, req.user.initials, score, level, now);
      db.prepare("UPDATE users SET best_score = MAX(best_score, ?) WHERE id = ?").run(score, req.user.id);
    }
    db.prepare("DELETE FROM saves WHERE user_id = ?").run(req.user.id);
    return result.changes === 1;
  })();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  res.json({ recorded: finish, user: publicUser(user), leaderboard: leaderboardRows() });
});

app.use(express.static(path.join(ROOT, "public"), { extensions: ["html"] }));
app.get("*path", (_req, res) => res.sendFile(path.join(ROOT, "public", "index.html")));

const server = app.listen(PORT, "0.0.0.0", () => console.log(`Brickfall listening on ${PORT}`));
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

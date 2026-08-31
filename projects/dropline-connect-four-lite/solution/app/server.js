"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const Database = require("better-sqlite3");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "dropline.db");
const EMPTY_BOARD = Array(42).fill("");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

const hashPassword = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const now = () => new Date().toISOString();

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS game_states (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      board_json TEXT NOT NULL,
      current_player TEXT NOT NULL,
      status TEXT NOT NULL,
      winning_json TEXT NOT NULL,
      red_wins INTEGER NOT NULL DEFAULT 0,
      yellow_wins INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  const insertUser = db.prepare("INSERT OR IGNORE INTO users(email,password_hash,name) VALUES(?,?,?)");
  const insertState = db.prepare(`
    INSERT OR IGNORE INTO game_states(
      user_id,board_json,current_player,status,winning_json,updated_at
    ) VALUES(?,?,?,?,?,?)
  `);
  const seed = db.transaction(() => {
    const accounts = [
      ["avery@dropline.test", "Avery Morgan"],
      ["jordan@dropline.test", "Jordan Lee"],
    ];
    for (const [email, name] of accounts) {
      insertUser.run(email, hashPassword("password123"), name);
      const user = db.prepare("SELECT id FROM users WHERE email=?").get(email);
      insertState.run(user.id, JSON.stringify(EMPTY_BOARD), "Red", "active", "[]", now());
    }
  });
  seed();
}

function serializeState(row) {
  return {
    board: JSON.parse(row.board_json),
    currentPlayer: row.current_player,
    status: row.status,
    winningCells: JSON.parse(row.winning_json),
    scores: {
      Red: row.red_wins,
      Yellow: row.yellow_wins,
      Draws: row.draws,
    },
    updatedAt: row.updated_at,
  };
}

function stateFor(userId) {
  return db.prepare("SELECT * FROM game_states WHERE user_id=?").get(userId);
}

function winningLine(board, index, color) {
  const row = Math.floor(index / 7);
  const column = index % 7;
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of directions) {
    const cells = [index];
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = column + dc * sign;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r * 7 + c] === color) {
        cells.push(r * 7 + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (cells.length >= 4) {
      return cells
        .sort((a, b) => a - b)
        .slice(0, 4);
    }
  }
  return [];
}

initialize();
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:",
  });
  next();
});
app.use(express.json({ limit: "32kb" }));

function authenticate(req, _res, next) {
  try {
    const match = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ""));
    const session = match
      ? db.prepare(`
          SELECT s.token,u.id,u.email,u.name
          FROM sessions s JOIN users u ON u.id=s.user_id
          WHERE s.token=?
        `).get(match[1])
      : null;
    if (!session) throw createError(401, "Authentication required");
    req.session = session;
    next();
  } catch (error) {
    next(error);
  }
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "DropLine" }));

app.post("/api/login", (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const user = db.prepare("SELECT * FROM users WHERE lower(email)=?").get(email);
    if (!user || user.password_hash !== hashPassword(password)) {
      throw createError(401, "Invalid email or password");
    }
    const token = crypto.randomBytes(24).toString("base64url");
    db.prepare("INSERT INTO sessions(token,user_id,created_at) VALUES(?,?,?)")
      .run(token, user.id, now());
    res.json({ token, user: { email: user.email, name: user.name } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/logout", authenticate, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token=?").run(req.session.token);
  res.json({ ok: true });
});

app.get("/api/game", authenticate, (req, res) => {
  res.json({
    user: { email: req.session.email, name: req.session.name },
    game: serializeState(stateFor(req.session.id)),
  });
});

app.post("/api/game/new", authenticate, (req, res) => {
  db.prepare(`
    UPDATE game_states
    SET board_json=?,current_player='Red',status='active',winning_json='[]',updated_at=?
    WHERE user_id=?
  `).run(JSON.stringify(EMPTY_BOARD), now(), req.session.id);
  res.json({ game: serializeState(stateFor(req.session.id)) });
});

app.post("/api/game/move", authenticate, (req, res, next) => {
  try {
    const column = Number(req.body?.column);
    if (!Number.isInteger(column) || column < 1 || column > 7) {
      throw createError(400, "Column must be an integer from 1 to 7");
    }

    const result = db.transaction(() => {
      const row = stateFor(req.session.id);
      if (row.status !== "active") throw createError(409, "The round is already complete");
      const board = JSON.parse(row.board_json);
      let target = -1;
      for (let r = 5; r >= 0; r -= 1) {
        const index = r * 7 + column - 1;
        if (!board[index]) {
          target = index;
          break;
        }
      }
      if (target < 0) throw createError(409, `Column ${column} is full`);

      const color = row.current_player;
      board[target] = color;
      const winningCells = winningLine(board, target, color);
      let status = "active";
      let nextPlayer = color === "Red" ? "Yellow" : "Red";
      let redWins = row.red_wins;
      let yellowWins = row.yellow_wins;
      let draws = row.draws;

      if (winningCells.length === 4) {
        status = color === "Red" ? "red_win" : "yellow_win";
        nextPlayer = color;
        if (color === "Red") redWins += 1;
        else yellowWins += 1;
      } else if (board.every(Boolean)) {
        status = "draw";
        nextPlayer = color;
        draws += 1;
      }

      db.prepare(`
        UPDATE game_states SET
          board_json=?,current_player=?,status=?,winning_json=?,
          red_wins=?,yellow_wins=?,draws=?,updated_at=?
        WHERE user_id=?
      `).run(
        JSON.stringify(board), nextPlayer, status, JSON.stringify(winningCells),
        redWins, yellowWins, draws, now(), req.session.id,
      );
      return { game: serializeState(stateFor(req.session.id)), placed: target };
    })();

    res.json(result);
  } catch (error) {
    if (error.status === 409) {
      error.state = serializeState(stateFor(req.session.id));
    }
    next(error);
  }
});

app.use(express.static(path.join(ROOT, "public"), { extensions: ["html"] }));
app.get("/", (_req, res) => res.sendFile(path.join(ROOT, "public", "index.html")));

app.use((error, _req, res, _next) => {
  const status = Number(error.status) || 500;
  res.status(status).json({ error: status === 500 ? "Unexpected server error" : error.message, game: error.state });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`DropLine listening on ${PORT}`);
});

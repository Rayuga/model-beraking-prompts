"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const Database = require("better-sqlite3");
const XLSX = require("xlsx");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "dropline.db");
const SEED_PATH = process.env.SEED_PATH || [
  path.join(ROOT, "seed_data.xlsx"),
  "/assets/artifacts/dropline_seed.xlsx",
].find((candidate) => fs.existsSync(candidate));
const EMPTY_BOARD = Array(42).fill("");

if (!SEED_PATH) throw new Error("dropline_seed.xlsx is required");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

function passwordRecord(value, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(String(value), salt, 64).toString("hex") };
}

function verifyPassword(value, salt, expected) {
  if (!salt || !expected) return false;
  const actual = Buffer.from(passwordRecord(value, salt).hash, "hex");
  const stored = Buffer.from(expected, "hex");
  return actual.length === stored.length && crypto.timingSafeEqual(actual, stored);
}

const now = () => new Date().toISOString();

function loadSeed() {
  const workbook = XLSX.readFile(SEED_PATH);
  const rows = (sheetName, required = true) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet && required) throw new Error(`Seed workbook is missing ${sheetName}`);
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  };
  const jsonValue = (value, fallback = []) => {
    if (value === null || value === undefined || String(value).trim().toLowerCase() === "none") {
      return fallback;
    }
    return JSON.parse(String(value));
  };
  const states = new Map(rows("Initial Game State").map((state) => [
    String(state["Account email"] || "").trim().toLowerCase(),
    state,
  ]));
  const accounts = rows("Accounts").map((account) => {
    const email = String(account.Email || "").trim().toLowerCase();
    const state = states.get(email);
    if (!email || !account.Password || !account.Name || !state) {
      throw new Error("Every seeded account needs credentials, a name, and initial state");
    }
    const board = String(state.Board).toLowerCase() === "42 empty cells"
      ? [...EMPTY_BOARD]
      : JSON.parse(String(state.Board));
    const winningCells = jsonValue(state["Winning cells"]);
    const history = jsonValue(state["Applied history"]);
    const redo = jsonValue(state["Redo history"]);
    if (board.length !== 42) throw new Error(`Seeded board for ${email} must have 42 cells`);
    return {
      email,
      password: String(account.Password),
      name: String(account.Name),
      board,
      currentPlayer: String(state["Current player"]),
      status: String(state.Status),
      winningCells,
      redWins: Number(state["Red wins"] || 0),
      yellowWins: Number(state["Yellow wins"] || 0),
      draws: Number(state.Draws || 0),
      history,
      redo,
      revision: Number(state.Revision || 0),
      roundId: String(state["Round id"] || `seed-${email}`),
    };
  });
  if (accounts.length === 0) throw new Error("Seed workbook contains no accounts");
  const matches = rows("Completed Matches", false).map((match) => ({
    email: String(match["Account email"] || "").trim().toLowerCase(),
    matchId: String(match["Match id"] || ""),
    result: String(match.Result || ""),
    finalBoard: jsonValue(match["Final board"]),
    moves: jsonValue(match.Moves),
    completedAt: String(match["Completed at"] || now()),
  }));
  return { accounts, matches };
}

const SEED_DATA = loadSeed();

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
      password_salt TEXT NOT NULL,
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
      history_json TEXT NOT NULL DEFAULT '[]',
      redo_json TEXT NOT NULL DEFAULT '[]',
      red_wins INTEGER NOT NULL DEFAULT 0,
      yellow_wins INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 0,
      round_id TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS completed_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      match_id TEXT NOT NULL,
      result TEXT NOT NULL,
      final_board_json TEXT NOT NULL,
      moves_json TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      UNIQUE(user_id, match_id)
    );
    CREATE TABLE IF NOT EXISTS mutation_receipts (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mutation_id TEXT NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 200,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY(user_id, mutation_id)
    );
  `);

  const userColumns = new Set(
    db.prepare("PRAGMA table_info(users)").all().map((column) => column.name),
  );
  if (!userColumns.has("password_salt")) {
    db.exec("ALTER TABLE users ADD COLUMN password_salt TEXT NOT NULL DEFAULT ''");
  }

  const stateColumns = new Set(
    db.prepare("PRAGMA table_info(game_states)").all().map((column) => column.name),
  );
  if (!stateColumns.has("history_json")) {
    db.exec("ALTER TABLE game_states ADD COLUMN history_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!stateColumns.has("redo_json")) {
    db.exec("ALTER TABLE game_states ADD COLUMN redo_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!stateColumns.has("revision")) {
    db.exec("ALTER TABLE game_states ADD COLUMN revision INTEGER NOT NULL DEFAULT 0");
  }
  if (!stateColumns.has("round_id")) {
    db.exec("ALTER TABLE game_states ADD COLUMN round_id TEXT NOT NULL DEFAULT ''");
  }
  const receiptColumns = new Set(
    db.prepare("PRAGMA table_info(mutation_receipts)").all().map((column) => column.name),
  );
  if (!receiptColumns.has("status_code")) {
    db.exec("ALTER TABLE mutation_receipts ADD COLUMN status_code INTEGER NOT NULL DEFAULT 200");
  }

  const insertUser = db.prepare(
    "INSERT OR IGNORE INTO users(email,password_salt,password_hash,name) VALUES(?,?,?,?)",
  );
  const insertState = db.prepare(`
    INSERT OR IGNORE INTO game_states(
      user_id,board_json,current_player,status,winning_json,
      history_json,redo_json,red_wins,yellow_wins,draws,revision,round_id,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insertMatch = db.prepare(`
    INSERT OR IGNORE INTO completed_matches(
      user_id,match_id,result,final_board_json,moves_json,completed_at
    ) VALUES(?,?,?,?,?,?)
  `);
  const seed = db.transaction(() => {
    for (const account of SEED_DATA.accounts) {
      const credentials = passwordRecord(account.password);
      insertUser.run(account.email, credentials.salt, credentials.hash, account.name);
      let user = db.prepare("SELECT * FROM users WHERE email=?").get(account.email);
      if (!user.password_salt) {
        db.prepare("UPDATE users SET password_salt=?,password_hash=? WHERE id=?")
          .run(credentials.salt, credentials.hash, user.id);
        user = db.prepare("SELECT * FROM users WHERE id=?").get(user.id);
      }
      insertState.run(
        user.id,
        JSON.stringify(account.board),
        account.currentPlayer,
        account.status,
        JSON.stringify(account.winningCells),
        JSON.stringify(account.history),
        JSON.stringify(account.redo),
        account.redWins,
        account.yellowWins,
        account.draws,
        account.revision,
        account.roundId,
        now(),
      );
    }
    for (const match of SEED_DATA.matches) {
      const user = db.prepare("SELECT id FROM users WHERE lower(email)=?").get(match.email);
      if (!user || !match.matchId || !["Red wins", "Yellow wins", "Draw"].includes(match.result)) {
        throw new Error("Every seeded completed match needs an account, id, and valid result");
      }
      insertMatch.run(
        user.id,
        match.matchId,
        match.result,
        JSON.stringify(match.finalBoard),
        JSON.stringify(match.moves),
        match.completedAt,
      );
    }
  });
  seed();
  db.prepare("UPDATE game_states SET round_id='legacy-' || user_id WHERE round_id='' ").run();
}

function serializeState(row) {
  const history = JSON.parse(row.history_json || "[]");
  const redo = JSON.parse(row.redo_json || "[]");
  return {
    board: JSON.parse(row.board_json),
    currentPlayer: row.current_player,
    status: row.status,
    winningCells: JSON.parse(row.winning_json),
    moveHistory: history.map((entry, index) => ({
      move: index + 1,
      color: entry.color,
      column: entry.column,
      row: entry.row,
    })),
    canUndo: history.length > 0,
    canRedo: redo.length > 0,
    scores: {
      Red: row.red_wins,
      Yellow: row.yellow_wins,
      Draws: row.draws,
    },
    revision: row.revision,
    roundId: row.round_id,
    updatedAt: row.updated_at,
  };
}

function stateFor(userId) {
  return db.prepare("SELECT * FROM game_states WHERE user_id=?").get(userId);
}

function stackFrom(row, field) {
  return JSON.parse(row[field] || "[]");
}

function completedMatchesFor(userId) {
  return db.prepare(`
    SELECT id,match_id,result,final_board_json,moves_json,completed_at
    FROM completed_matches
    WHERE user_id=?
    ORDER BY completed_at DESC,id DESC
    LIMIT 10
  `).all(userId).map((row) => {
    const moves = JSON.parse(row.moves_json);
    return {
      id: row.id,
      matchId: row.match_id,
      result: row.result,
      finalBoard: JSON.parse(row.final_board_json),
      moves,
      moveCount: moves.length,
      completedAt: row.completed_at,
    };
  });
}

function completedMatchCountFor(userId) {
  return db.prepare("SELECT count(*) AS count FROM completed_matches WHERE user_id=?")
    .get(userId).count;
}

function gamePayload(userId, extra = {}) {
  return {
    game: serializeState(stateFor(userId)),
    archive: completedMatchesFor(userId),
    archiveTotal: completedMatchCountFor(userId),
    ...extra,
  };
}

function mutationIdentity(req) {
  const mutationId = String(req.body?.mutationId || "");
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(mutationId)) {
    throw createError(400, "A valid mutation identifier is required");
  }
  return mutationId;
}

function requireCurrentRevision(req, row) {
  const revision = Number(req.body?.revision);
  if (!Number.isInteger(revision) || revision < 0) {
    throw createError(400, "A valid game revision is required");
  }
  if (revision !== row.revision) {
    const error = createError(409, "Game updated in another tab");
    error.state = serializeState(row);
    error.archive = completedMatchesFor(req.session.id);
    error.archiveTotal = completedMatchCountFor(req.session.id);
    throw error;
  }
}

function runMutation(req, operation) {
  const mutationId = mutationIdentity(req);
  try {
    return db.transaction(() => {
      const receipt = db.prepare(`
        SELECT status_code,response_json FROM mutation_receipts
        WHERE user_id=? AND mutation_id=?
      `).get(req.session.id, mutationId);
      if (receipt) {
        const payload = JSON.parse(receipt.response_json);
        if (receipt.status_code >= 400) {
          const error = createError(receipt.status_code, payload.error);
          error.state = payload.game;
          error.archive = payload.archive;
          error.archiveTotal = payload.archiveTotal;
          throw error;
        }
        return payload;
      }
      const response = operation();
      db.prepare(`
        INSERT INTO mutation_receipts(user_id,mutation_id,status_code,response_json,created_at)
        VALUES(?,?,?,?,?)
      `).run(req.session.id, mutationId, 200, JSON.stringify(response), now());
      return response;
    })();
  } catch (error) {
    const status = Number(error.status) || 500;
    if (status >= 400 && status < 500) {
      error.state ||= serializeState(stateFor(req.session.id));
      error.archive ||= completedMatchesFor(req.session.id);
      error.archiveTotal ??= completedMatchCountFor(req.session.id);
      const payload = {
        error: error.message,
        game: error.state,
        archive: error.archive,
        archiveTotal: error.archiveTotal,
      };
      db.prepare(`
        INSERT OR IGNORE INTO mutation_receipts(
          user_id,mutation_id,status_code,response_json,created_at
        ) VALUES(?,?,?,?,?)
      `).run(req.session.id, mutationId, status, JSON.stringify(payload), now());
    }
    throw error;
  }
}

function archiveResult(userId, row, board, history, status, restored = null) {
  if (!["red_win", "yellow_win", "draw"].includes(status)) return;
  const result = status === "red_win" ? "Red wins" : status === "yellow_win" ? "Yellow wins" : "Draw";
  const archive = restored || {
    result,
    finalBoard: board,
    moves: history,
    completedAt: now(),
  };
  db.prepare(`
    INSERT OR IGNORE INTO completed_matches(
      user_id,match_id,result,final_board_json,moves_json,completed_at
    ) VALUES(?,?,?,?,?,?)
  `).run(
    userId,
    row.round_id,
    archive.result,
    JSON.stringify(archive.finalBoard),
    JSON.stringify(archive.moves),
    archive.completedAt,
  );
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

function outcomeFor(board, index, color) {
  const winningCells = winningLine(board, index, color);
  if (winningCells.length === 4) {
    return {
      status: color === "Red" ? "red_win" : "yellow_win",
      winningCells,
    };
  }
  if (board.every(Boolean)) return { status: "draw", winningCells: [] };
  return { status: "active", winningCells: [] };
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
    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
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
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(req.session.id);
  res.json({ ok: true });
});

app.get("/api/game", authenticate, (req, res) => {
  res.json({
    user: { email: req.session.email, name: req.session.name },
    ...gamePayload(req.session.id),
  });
});

app.post("/api/game/new", authenticate, (req, res, next) => {
  try {
    const result = runMutation(req, () => {
      const row = stateFor(req.session.id);
      requireCurrentRevision(req, row);
      db.prepare(`
        UPDATE game_states
        SET board_json=?,current_player='Red',status='active',winning_json='[]',
            history_json='[]',redo_json='[]',revision=revision+1,round_id=?,updated_at=?
        WHERE user_id=?
      `).run(JSON.stringify(EMPTY_BOARD), crypto.randomUUID(), now(), req.session.id);
      return gamePayload(req.session.id);
    });
    res.json(result);
  } catch (error) {
    if (error.status === 409 && !error.state) {
      error.state = serializeState(stateFor(req.session.id));
      error.archive = completedMatchesFor(req.session.id);
      error.archiveTotal = completedMatchCountFor(req.session.id);
    }
    next(error);
  }
});

app.post("/api/game/move", authenticate, (req, res, next) => {
  try {
    const column = Number(req.body?.column);
    if (!Number.isInteger(column) || column < 1 || column > 7) {
      throw createError(400, "Column must be an integer from 1 to 7");
    }

    const result = runMutation(req, () => {
      const row = stateFor(req.session.id);
      requireCurrentRevision(req, row);
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
      const outcome = outcomeFor(board, target, color);
      const history = stackFrom(row, "history_json");
      history.push({
        color,
        column,
        row: Math.floor(target / 7) + 1,
        index: target,
      });
      const { status, winningCells } = outcome;
      let nextPlayer = color === "Red" ? "Yellow" : "Red";
      let redWins = row.red_wins;
      let yellowWins = row.yellow_wins;
      let draws = row.draws;

      if (status === "red_win" || status === "yellow_win") {
        nextPlayer = color;
        if (color === "Red") redWins += 1;
        else yellowWins += 1;
      } else if (status === "draw") {
        nextPlayer = color;
        draws += 1;
      }

      db.prepare(`
        UPDATE game_states SET
          board_json=?,current_player=?,status=?,winning_json=?,history_json=?,redo_json='[]',
          red_wins=?,yellow_wins=?,draws=?,revision=revision+1,updated_at=?
        WHERE user_id=?
      `).run(
        JSON.stringify(board), nextPlayer, status, JSON.stringify(winningCells), JSON.stringify(history),
        redWins, yellowWins, draws, now(), req.session.id,
      );
      archiveResult(req.session.id, row, board, history, status);
      return gamePayload(req.session.id, { placed: target });
    });

    res.json(result);
  } catch (error) {
    if (error.status === 409) {
      error.state ||= serializeState(stateFor(req.session.id));
      error.archive ||= completedMatchesFor(req.session.id);
      error.archiveTotal ??= completedMatchCountFor(req.session.id);
    }
    next(error);
  }
});

app.post("/api/game/undo", authenticate, (req, res, next) => {
  try {
    const result = runMutation(req, () => {
      const row = stateFor(req.session.id);
      requireCurrentRevision(req, row);
      const history = stackFrom(row, "history_json");
      const redo = stackFrom(row, "redo_json");
      if (history.length === 0) throw createError(409, "Nothing to undo");

      const entry = history.pop();
      const board = JSON.parse(row.board_json);
      if (board[entry.index] !== entry.color) {
        throw createError(409, "Saved move history does not match the board");
      }
      board[entry.index] = "";
      let redoEntry = entry;

      let redWins = row.red_wins;
      let yellowWins = row.yellow_wins;
      let draws = row.draws;
      if (row.status === "red_win") redWins = Math.max(0, redWins - 1);
      if (row.status === "yellow_win") yellowWins = Math.max(0, yellowWins - 1);
      if (row.status === "draw") draws = Math.max(0, draws - 1);
      if (["red_win", "yellow_win", "draw"].includes(row.status)) {
        const archived = db.prepare(`
          SELECT result,final_board_json,moves_json,completed_at
          FROM completed_matches WHERE user_id=? AND match_id=?
        `).get(req.session.id, row.round_id);
        if (archived) {
          redoEntry = {
            ...entry,
            terminalArchive: {
              result: archived.result,
              finalBoard: JSON.parse(archived.final_board_json),
              moves: JSON.parse(archived.moves_json),
              completedAt: archived.completed_at,
            },
          };
        }
        db.prepare("DELETE FROM completed_matches WHERE user_id=? AND match_id=?")
          .run(req.session.id, row.round_id);
      }
      redo.push(redoEntry);

      db.prepare(`
        UPDATE game_states SET
          board_json=?,current_player=?,status='active',winning_json='[]',
          history_json=?,redo_json=?,red_wins=?,yellow_wins=?,draws=?,
          revision=revision+1,updated_at=?
        WHERE user_id=?
      `).run(
        JSON.stringify(board), entry.color, JSON.stringify(history), JSON.stringify(redo),
        redWins, yellowWins, draws, now(), req.session.id,
      );
      return gamePayload(req.session.id);
    });
    res.json(result);
  } catch (error) {
    if (error.status === 409) {
      error.state ||= serializeState(stateFor(req.session.id));
      error.archive ||= completedMatchesFor(req.session.id);
      error.archiveTotal ??= completedMatchCountFor(req.session.id);
    }
    next(error);
  }
});

app.post("/api/game/redo", authenticate, (req, res, next) => {
  try {
    const result = runMutation(req, () => {
      const row = stateFor(req.session.id);
      requireCurrentRevision(req, row);
      if (row.status !== "active") throw createError(409, "The round is already complete");
      const history = stackFrom(row, "history_json");
      const redo = stackFrom(row, "redo_json");
      if (redo.length === 0) throw createError(409, "Nothing to redo");

      const storedEntry = redo.pop();
      const { terminalArchive = null, ...entry } = storedEntry;
      if (row.current_player !== entry.color) {
        throw createError(409, "Saved redo turn does not match the game");
      }
      const board = JSON.parse(row.board_json);
      let target = -1;
      for (let r = 5; r >= 0; r -= 1) {
        const index = r * 7 + entry.column - 1;
        if (!board[index]) {
          target = index;
          break;
        }
      }
      if (target !== entry.index) {
        throw createError(409, "Saved redo move no longer fits the board");
      }

      board[target] = entry.color;
      history.push(entry);
      const { status, winningCells } = outcomeFor(board, target, entry.color);
      let nextPlayer = entry.color === "Red" ? "Yellow" : "Red";
      let redWins = row.red_wins;
      let yellowWins = row.yellow_wins;
      let draws = row.draws;
      if (status === "red_win" || status === "yellow_win") {
        nextPlayer = entry.color;
        if (entry.color === "Red") redWins += 1;
        else yellowWins += 1;
      } else if (status === "draw") {
        nextPlayer = entry.color;
        draws += 1;
      }

      db.prepare(`
        UPDATE game_states SET
          board_json=?,current_player=?,status=?,winning_json=?,history_json=?,redo_json=?,
          red_wins=?,yellow_wins=?,draws=?,revision=revision+1,updated_at=?
        WHERE user_id=?
      `).run(
        JSON.stringify(board), nextPlayer, status, JSON.stringify(winningCells),
        JSON.stringify(history), JSON.stringify(redo), redWins, yellowWins, draws,
        now(), req.session.id,
      );
      archiveResult(req.session.id, row, board, history, status, terminalArchive);
      return gamePayload(req.session.id, { placed: target });
    });
    res.json(result);
  } catch (error) {
    if (error.status === 409) {
      error.state ||= serializeState(stateFor(req.session.id));
      error.archive ||= completedMatchesFor(req.session.id);
      error.archiveTotal ??= completedMatchCountFor(req.session.id);
    }
    next(error);
  }
});

app.use(express.static(path.join(ROOT, "public"), { extensions: ["html"] }));
app.get("/", (_req, res) => res.sendFile(path.join(ROOT, "public", "index.html")));

app.use((error, _req, res, _next) => {
  const status = Number(error.status) || 500;
  res.status(status).json({
    error: status === 500 ? "Unexpected server error" : error.message,
    game: error.state,
    archive: error.archive,
    archiveTotal: error.archiveTotal,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`DropLine listening on ${PORT}`);
});

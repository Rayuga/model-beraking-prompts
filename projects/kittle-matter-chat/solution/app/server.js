"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const Database = require("better-sqlite3");

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "app.db");
const PUBLIC_DIR = path.join(__dirname, "public");
const COOKIE = "kt_session";
const PASSWORD = "password123";
const DAY_MS = 86400000;
const ROLE_LABEL = { partner: "Partner", associate: "Associate", client: "Client" };

let CLOCK = "";
let booted = false;
let db = null;

function firstFile(candidates) {
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      /* try the next path */
    }
  }
  return null;
}

const seedPath = firstFile([
  process.env.SEED_PATH,
  path.join(__dirname, "seed", "kittle.json"),
  "/assets/kittle.json"
].filter(Boolean));
if (!seedPath) throw new Error("Kittle seed data not found");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
CLOCK = String(seed.clock);

const app = express();
app.disable("x-powered-by");
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true, booted, clock: CLOCK });
});

app.use("/api", (req, res, next) => {
  if (!booted) return res.status(503).json({ error: "The chambers database is unavailable." });
  res.set("Cache-Control", "no-store");
  next();
});

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString("hex");
}

function hashesMatch(expected, actual) {
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(actual, "hex");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function openDatabase() {
  const target = path.resolve(DB_PATH);
  const parent = path.dirname(target);
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
  db = new Database(target);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      pw_salt TEXT NOT NULL,
      pw_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS matters (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      client TEXT NOT NULL,
      timer_days INTEGER,
      walled TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL,
      author TEXT NOT NULL,
      at TEXT NOT NULL,
      body TEXT NOT NULL,
      hold INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, email TEXT NOT NULL);
  `);
}

function seedDatabase() {
  if (db.prepare("SELECT value FROM settings WHERE key = 'seeded'").get()) return;
  const tx = db.transaction(() => {
    const insertUser = db.prepare("INSERT INTO users (email, name, role, pw_salt, pw_hash) VALUES (?, ?, ?, ?, ?)");
    for (const account of seed.accounts) {
      const salt = crypto.randomBytes(16).toString("hex");
      insertUser.run(account.email, account.name, account.role, salt, hashPassword(PASSWORD, salt));
    }
    const insertMatter = db.prepare("INSERT INTO matters (id, title, client, timer_days, walled) VALUES (?, ?, ?, ?, ?)");
    const insertMessage = db.prepare("INSERT INTO messages (id, matter_id, author, at, body, hold) VALUES (?, ?, ?, ?, ?, ?)");
    for (const matter of seed.matters) {
      insertMatter.run(matter.id, matter.title, matter.client, matter.timer_days, JSON.stringify(matter.walled || []));
      for (const message of matter.messages) {
        insertMessage.run(message.id, matter.id, message.author, message.at, message.body, message.hold ? 1 : 0);
      }
    }
    db.prepare("INSERT INTO settings (key, value) VALUES ('seeded', '1')").run();
  });
  tx();
}

function init() {
  try {
    openDatabase();
    seedDatabase();
    booted = true;
  } catch (err) {
    console.error("Database initialisation failed:", err.message);
  }
}

function readCookie(req) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function currentUser(req) {
  if (!booted) return null;
  const token = readCookie(req);
  if (!token) return null;
  const session = db.prepare("SELECT email FROM sessions WHERE token = ?").get(token);
  if (!session) return null;
  return db.prepare("SELECT email, name, role FROM users WHERE email = ?").get(session.email);
}

function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Sign in first." });
  req.user = user;
  next();
}

function publicUser(user) {
  return { email: user.email, name: user.name, role: user.role, roleLabel: ROLE_LABEL[user.role] || user.role };
}

function personName(email) {
  const row = db.prepare("SELECT name FROM users WHERE email = ?").get(email);
  return row ? row.name : email;
}

function timerLabel(days) {
  if (days == null) return "Off";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function timerNotice(days) {
  if (days == null) return "Timer off";
  if (days === 1) return "Messages disappear after 1 day";
  return `Messages disappear after ${days} days`;
}

function formatStamp(iso) {
  const date = new Date(iso);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function walledFrom(matter) {
  try { return JSON.parse(matter.walled || "[]"); } catch { return []; }
}

function canSee(user, matter) {
  if (walledFrom(matter).includes(user.email)) return false;
  if (user.role === "client") return matter.client === user.email;
  return user.role === "partner" || user.role === "associate";
}

function purgeMatter(matterId) {
  const matter = db.prepare("SELECT timer_days FROM matters WHERE id = ?").get(matterId);
  if (!matter || matter.timer_days == null) return;
  const clock = Date.parse(CLOCK);
  const limit = matter.timer_days * DAY_MS;
  const rows = db.prepare("SELECT id, at FROM messages WHERE matter_id = ? AND hold = 0").all(matterId);
  const doomed = rows.filter((row) => clock - Date.parse(row.at) > limit);
  if (!doomed.length) return;
  const remove = db.prepare("DELETE FROM messages WHERE id = ?");
  const tx = db.transaction((items) => {
    for (const item of items) remove.run(item.id);
  });
  tx(doomed);
}

function matterRow(id) {
  return db.prepare("SELECT * FROM matters WHERE id = ?").get(id);
}

function publicMatter(matter) {
  return {
    id: matter.id,
    title: matter.title,
    client: matter.client,
    clientName: personName(matter.client),
    timerDays: matter.timer_days,
    timerLabel: timerLabel(matter.timer_days)
  };
}

function messagesFor(matterId) {
  purgeMatter(matterId);
  return db.prepare(`
    SELECT m.id, m.author, m.at, m.body, m.hold, u.name AS author_name
    FROM messages m
    LEFT JOIN users u ON u.email = m.author
    WHERE m.matter_id = ?
    ORDER BY m.at ASC, m.rowid ASC
  `).all(matterId);
}

function publicMessage(row) {
  return {
    id: row.id,
    author: row.author,
    authorName: row.author_name || row.author,
    body: row.body,
    at: formatStamp(row.at),
    hold: Boolean(row.hold)
  };
}

function matterDetail(matter) {
  return {
    ...publicMatter(matter),
    timerNotice: timerNotice(matter.timer_days),
    messages: messagesFor(matter.id).map(publicMessage)
  };
}

function visibleMatters(user) {
  return db.prepare("SELECT * FROM matters ORDER BY id").all().filter((matter) => canSee(user, matter));
}

function fail(res, status, error) {
  return res.status(status).json({ error });
}

function parseDays(value) {
  if (value === null || value === "" || value === "off" || value === 0 || value === "0") return null;
  if (value === 1 || value === 7 || value === 30) return value;
  if (value === "1" || value === "7" || value === "30") return Number(value);
  return undefined;
}

function parseHold(value) {
  if (value === true || value === false) return value;
  if (value === 1 || value === 0) return Boolean(value);
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function transcriptPayload(matter) {
  return {
    id: matter.id,
    title: matter.title,
    generated: formatStamp(CLOCK),
    lines: messagesFor(matter.id).map((row) => ({
      authorName: row.author_name || row.author,
      at: formatStamp(row.at),
      body: row.body,
      hold: Boolean(row.hold)
    }))
  };
}

function transcriptDocument(payload) {
  const lines = payload.lines.map((line) => `
    <article class="line">
      <div class="line-who">
        <div class="line-author">${esc(line.authorName)}${line.hold ? ' <span class="hold-badge">On hold</span>' : ""}</div>
        <div class="line-time">${esc(line.at)}</div>
      </div>
      <p class="line-body">${esc(line.body)}</p>
    </article>`).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Transcript ${esc(payload.id)}</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body class="transcript">
<main class="sheet">
  <header class="doc-head">
    <p class="doc-kicker">Matter ${esc(payload.id)}</p>
    <h1>${esc(payload.title)}</h1>
    <p class="doc-generated">Generated ${esc(payload.generated)}</p>
  </header>
  <div class="listing">${lines}</div>
</main>
</body>
</html>`;
}

function plainDocument(status, message) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unavailable</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body class="transcript">
<main class="sheet"><p>${esc(message)}</p></main>
</body>
</html>`;
  return { status, html };
}

app.post("/api/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const salt = user ? user.pw_salt : crypto.randomBytes(16).toString("hex");
  const expected = user ? user.pw_hash : hashPassword(PASSWORD, salt);
  const actual = hashPassword(password, salt);
  if (!user || !hashesMatch(expected, actual)) {
    return fail(res, 401, "That email and password did not match.");
  }
  const token = crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT INTO sessions (token, email) VALUES (?, ?)").run(token, user.email);
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/`);
  res.json({ user: publicUser(user) });
});

app.post("/api/logout", (req, res) => {
  const token = readCookie(req);
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const user = currentUser(req);
  res.json({ user: user ? publicUser(user) : null });
});

app.get("/api/matters", requireUser, (req, res) => {
  const matters = visibleMatters(req.user);
  for (const matter of matters) purgeMatter(matter.id);
  const fresh = visibleMatters(req.user);
  res.json(fresh.map(publicMatter));
});

app.get("/api/matters/:id", requireUser, (req, res) => {
  const matter = matterRow(req.params.id);
  if (!matter) return fail(res, 404, "No matter with that id.");
  if (!canSee(req.user, matter)) return fail(res, 403, "You cannot see that matter.");
  res.json(matterDetail(matter));
});

app.post("/api/matters/:id/messages", requireUser, (req, res) => {
  const matter = matterRow(req.params.id);
  if (!matter) return fail(res, 404, "No matter with that id.");
  if (!canSee(req.user, matter)) return fail(res, 403, "You cannot see that matter.");
  if (typeof req.body?.body !== "string" || !req.body.body.trim()) {
    return fail(res, 400, "Write a message before sending.");
  }
  const ids = db.prepare("SELECT id FROM messages").all();
  let max = 0;
  for (const row of ids) {
    const match = /^K-(\d+)$/.exec(row.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  db.prepare("INSERT INTO messages (id, matter_id, author, at, body, hold) VALUES (?, ?, ?, ?, ?, 0)")
    .run(`K-${max + 1}`, matter.id, req.user.email, CLOCK, req.body.body.trim());
  res.status(201).json(matterDetail(matterRow(matter.id)));
});

app.post("/api/matters/:id/timer", requireUser, (req, res) => {
  const matter = matterRow(req.params.id);
  if (!matter) return fail(res, 404, "No matter with that id.");
  if (!canSee(req.user, matter)) return fail(res, 403, "You cannot see that matter.");
  if (req.user.role !== "partner") return fail(res, 403, "Only a partner can change the timer.");
  const days = parseDays(req.body?.days);
  if (days === undefined) return fail(res, 400, "Choose off, 1 day, 7 days or 30 days.");
  db.prepare("UPDATE matters SET timer_days = ? WHERE id = ?").run(days, matter.id);
  purgeMatter(matter.id);
  res.json(matterDetail(matterRow(matter.id)));
});

app.post("/api/messages/:id/hold", requireUser, (req, res) => {
  const message = db.prepare("SELECT * FROM messages WHERE id = ?").get(req.params.id);
  if (!message) return fail(res, 404, "No message with that id.");
  const matter = matterRow(message.matter_id);
  if (!matter || !canSee(req.user, matter)) return fail(res, 403, "You cannot see that matter.");
  if (req.user.role !== "partner") return fail(res, 403, "Only a partner can change a hold.");
  const hold = parseHold(req.body?.hold);
  if (hold === undefined) return fail(res, 400, "Say whether the hold is on or off.");
  db.prepare("UPDATE messages SET hold = ? WHERE id = ?").run(hold ? 1 : 0, message.id);
  if (!hold) purgeMatter(matter.id);
  const still = db.prepare("SELECT id FROM messages WHERE id = ?").get(message.id);
  res.json({ ok: true, deleted: !still, matter: matterDetail(matterRow(matter.id)) });
});

app.get("/api/search", requireUser, (req, res) => {
  const query = String(req.query.q || "").trim().toLowerCase();
  if (!query) return res.json([]);
  const results = [];
  for (const matter of visibleMatters(req.user)) {
    for (const row of messagesFor(matter.id)) {
      if (!row.body.toLowerCase().includes(query)) continue;
      results.push({
        matterId: matter.id,
        title: matter.title,
        ...publicMessage(row)
      });
    }
  }
  res.json(results);
});

app.get("/api/matters/:id/transcript", requireUser, (req, res) => {
  const matter = matterRow(req.params.id);
  if (!matter) return fail(res, 404, "No matter with that id.");
  if (!canSee(req.user, matter)) return fail(res, 403, "You cannot see that matter.");
  res.json(transcriptPayload(matter));
});

app.get("/matters/:id/transcript", (req, res) => {
  if (!booted) {
    const page = plainDocument(503, "The chambers database is unavailable.");
    return res.status(page.status).type("html").send(page.html);
  }
  const user = currentUser(req);
  if (!user) {
    const page = plainDocument(401, "Sign in first.");
    return res.status(page.status).type("html").send(page.html);
  }
  const matter = matterRow(req.params.id);
  if (!matter) {
    const page = plainDocument(404, "No matter with that id.");
    return res.status(page.status).type("html").send(page.html);
  }
  if (!canSee(user, matter)) {
    const page = plainDocument(403, "You cannot see that matter.");
    return res.status(page.status).type("html").send(page.html);
  }
  res.type("html").send(transcriptDocument(transcriptPayload(matter)));
});

app.get("/favicon.ico", (_req, res) => res.status(204).end());
app.use(express.static(PUBLIC_DIR));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Kittle chambers listening on ${PORT}`);
  setImmediate(init);
});

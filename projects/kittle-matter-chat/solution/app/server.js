"use strict";

// Kittle & Rowe matter chat: Express + SQLite.
// Walls, retention, holds, threads, edits, unread positions and idempotent sends
// are all enforced here; the browser only renders what the server allows.

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
const TIMER_OPTIONS = [null, 1, 7, 30];
const NOT_AVAILABLE = "Not available.";

function firstFile(candidates) {
  for (const candidate of candidates) {
    try { if (fs.statSync(candidate).isFile()) return candidate; } catch { /* next */ }
  }
  return null;
}
const seedPath = firstFile([process.env.SEED_PATH, path.join(__dirname, "seed", "seed_data.json"), path.join(__dirname, "seed_data.json"), "/assets/seed_data.json"].filter(Boolean));
if (!seedPath) throw new Error("Kittle seed data not found");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const CLOCK = String(seed.clock);
const CLOCK_MS = Date.parse(CLOCK);

let db = null;
let booted = false;

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => res.status(200).json({ ok: true, booted, clock: CLOCK }));
app.use("/api", (req, res, next) => {
  if (!booted) return res.status(503).json({ error: "The chambers database is unavailable." });
  res.set("Cache-Control", "no-store");
  next();
});

/* ---------- database ---------- */

function hashPassword(password, salt) { return crypto.scryptSync(password, salt, 32).toString("hex"); }
function hashesMatch(expected, actual) {
  const a = Buffer.from(expected, "hex"), b = Buffer.from(actual, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function openDatabase() {
  const target = path.resolve(DB_PATH);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  db = new Database(target);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, pw_salt TEXT NOT NULL, pw_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS matters (id TEXT PRIMARY KEY, title TEXT NOT NULL, client TEXT NOT NULL, timer_days INTEGER);
    CREATE TABLE IF NOT EXISTS walls (matter_id TEXT NOT NULL, email TEXT NOT NULL, PRIMARY KEY (matter_id, email));
    CREATE TABLE IF NOT EXISTS messages (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT UNIQUE NOT NULL,
      matter_id TEXT NOT NULL,
      parent_id TEXT,
      author TEXT NOT NULL,
      at TEXT NOT NULL,
      body TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      hold INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      client_key TEXT UNIQUE
    );
    CREATE TABLE IF NOT EXISTS versions (message_id TEXT NOT NULL, n INTEGER NOT NULL, body TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (message_id, n));
    CREATE TABLE IF NOT EXISTS mentions (message_id TEXT NOT NULL, email TEXT NOT NULL, PRIMARY KEY (message_id, email));
    CREATE TABLE IF NOT EXISTS reads (email TEXT NOT NULL, matter_id TEXT NOT NULL, last_seq INTEGER NOT NULL, PRIMARY KEY (email, matter_id));
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, email TEXT NOT NULL);
  `);
}

function nextSeedNumber() {
  let max = 0;
  for (const m of seed.matters) for (const msg of m.messages) max = Math.max(max, Number(String(msg.id).replace(/\D/g, "")) || 0);
  return max + 1;
}

function seedDatabase() {
  if (db.prepare("SELECT value FROM settings WHERE key = 'seeded'").get()) return;
  db.transaction(() => {
    const insertUser = db.prepare("INSERT INTO users (email, name, role, pw_salt, pw_hash) VALUES (?, ?, ?, ?, ?)");
    for (const a of seed.accounts) {
      const salt = crypto.randomBytes(16).toString("hex");
      insertUser.run(a.email, a.name, a.role, salt, hashPassword(PASSWORD, salt));
    }
    const insertMatter = db.prepare("INSERT INTO matters (id, title, client, timer_days) VALUES (?, ?, ?, ?)");
    const insertWall = db.prepare("INSERT INTO walls (matter_id, email) VALUES (?, ?)");
    const insertMessage = db.prepare("INSERT INTO messages (id, matter_id, parent_id, author, at, body, version, hold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    const insertVersion = db.prepare("INSERT INTO versions (message_id, n, body, at) VALUES (?, ?, ?, ?)");
    const pending = [];
    for (const m of seed.matters) {
      insertMatter.run(m.id, m.title, m.client, m.timer_days ?? null);
      for (const w of m.walled || []) insertWall.run(m.id, w);
      for (const msg of m.messages) pending.push({ matter: m.id, msg });
    }
    pending.sort((x, y) => Date.parse(x.msg.at) - Date.parse(y.msg.at));
    for (const { matter, msg } of pending) {
      const earlier = msg.versions || [];
      insertMessage.run(msg.id, matter, msg.parent || null, msg.author, msg.at, msg.body, earlier.length + 1, msg.hold ? 1 : 0);
      earlier.forEach((v, i) => insertVersion.run(msg.id, i + 1, v.body, v.at));
      recordMentions(msg.id, matter, msg.body);
    }
    const insertRead = db.prepare("INSERT INTO reads (email, matter_id, last_seq) VALUES (?, ?, ?)");
    for (const [email, map] of Object.entries(seed.read_up_to || {})) {
      for (const [matterId, messageId] of Object.entries(map)) {
        const row = db.prepare("SELECT seq FROM messages WHERE id = ?").get(messageId);
        if (row) insertRead.run(email, matterId, row.seq);
      }
    }
    db.prepare("INSERT INTO settings (key, value) VALUES ('next_id', ?)").run(String(nextSeedNumber()));
    db.prepare("INSERT INTO settings (key, value) VALUES ('seeded', '1')").run();
  })();
}

function newMessageId() {
  const n = Number(db.prepare("SELECT value FROM settings WHERE key = 'next_id'").get().value);
  db.prepare("UPDATE settings SET value = ? WHERE key = 'next_id'").run(String(n + 1));
  return "K-" + n;
}

/* ---------- retention ---------- */

// A message is gone once it is as old as its matter's timer, unless it is held.
function sweep() {
  for (const m of db.prepare("SELECT id, timer_days FROM matters WHERE timer_days IS NOT NULL").all()) {
    const limit = m.timer_days * DAY_MS;
    for (const r of db.prepare("SELECT id, at FROM messages WHERE matter_id = ? AND deleted = 0 AND hold = 0").all(m.id)) {
      if (CLOCK_MS - Date.parse(r.at) >= limit) eraseMessage(r.id);
    }
  }
}
const sweepNow = () => db.transaction(sweep)();

// Everything about a deleted message goes: its text, earlier versions and mentions.
function eraseMessage(id) {
  db.prepare("UPDATE messages SET body = '', deleted = 1, hold = 0 WHERE id = ?").run(id);
  db.prepare("DELETE FROM versions WHERE message_id = ?").run(id);
  db.prepare("DELETE FROM mentions WHERE message_id = ?").run(id);
}

function init() {
  try {
    openDatabase();
    seedDatabase();
    sweepNow();
    booted = true;
  } catch (err) {
    console.error("Database initialisation failed:", err.message);
  }
}

/* ---------- people and visibility ---------- */

function readCookie(req) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}
function currentUser(req) {
  const token = readCookie(req);
  if (!token) return null;
  const s = db.prepare("SELECT email FROM sessions WHERE token = ?").get(token);
  return s ? db.prepare("SELECT email, name, role FROM users WHERE email = ?").get(s.email) : null;
}
function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) { res.status(401).json({ error: "Please sign in." }); return null; }
  return user;
}
const isStaff = u => u.role === "partner" || u.role === "associate";
const isWalled = (matterId, email) => !!db.prepare("SELECT 1 FROM walls WHERE matter_id = ? AND email = ?").get(matterId, email);
function canSee(user, matter) {
  if (!matter) return false;
  if (user.role === "client") return matter.client === user.email;
  return !isWalled(matter.id, user.email);
}
function visibleMatter(user, matterId) {
  const m = db.prepare("SELECT * FROM matters WHERE id = ?").get(String(matterId || ""));
  return m && canSee(user, m) ? m : null;
}
function visibleMessage(user, messageId) {
  const msg = db.prepare("SELECT * FROM messages WHERE id = ?").get(String(messageId || ""));
  return msg && visibleMatter(user, msg.matter_id) ? msg : null;
}
const people = () => db.prepare("SELECT email, name, role FROM users ORDER BY rowid").all();
function nameOf(email) { const u = db.prepare("SELECT name FROM users WHERE email = ?").get(email); return u ? u.name : email; }

/* ---------- mentions and message links ---------- */

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// "@Dev" or "@Dev Anand" mentions someone; only people who can see the matter count.
function mentionedEmails(matterId, body) {
  const matter = db.prepare("SELECT * FROM matters WHERE id = ?").get(matterId);
  const found = [];
  for (const u of people()) {
    const first = u.name.split(" ")[0];
    const re = new RegExp("(^|[^\\w@])@(" + escapeRe(u.name) + "|" + escapeRe(first) + ")(?![\\w])", "i");
    if (re.test(body) && canSee(u, matter)) found.push(u.email);
  }
  return found;
}
function recordMentions(messageId, matterId, body) {
  db.prepare("DELETE FROM mentions WHERE message_id = ?").run(messageId);
  for (const email of mentionedEmails(matterId, body)) db.prepare("INSERT OR IGNORE INTO mentions (message_id, email) VALUES (?, ?)").run(messageId, email);
}

const LINK_RE = /\/messages\/(K-\d+)(?![\w-])/g;
// Previews are worked out for the person reading, so walls and deletions apply.
function previewsFor(user, body) {
  const out = {};
  for (const match of String(body).matchAll(LINK_RE)) {
    const msg = visibleMessage(user, match[1]);
    if (!msg || msg.deleted) { out[match[1]] = { available: false }; continue; }
    const matter = db.prepare("SELECT id, title FROM matters WHERE id = ?").get(msg.matter_id);
    out[match[1]] = { available: true, matter_id: matter.id, matter_title: matter.title, author_name: nameOf(msg.author), text: msg.body.slice(0, 140) };
  }
  return out;
}

/* ---------- shaping ---------- */

function lastRead(email, matterId) {
  const r = db.prepare("SELECT last_seq FROM reads WHERE email = ? AND matter_id = ?").get(email, matterId);
  return r ? r.last_seq : 0;
}
function unreadCount(user, matterId) {
  return db.prepare("SELECT COUNT(*) AS n FROM messages WHERE matter_id = ? AND deleted = 0 AND seq > ? AND author != ?").get(matterId, lastRead(user.email, matterId), user.email).n;
}
const timerLabel = d => d ? `Messages disappear after ${d} day${d === 1 ? "" : "s"}` : "Disappearing messages off";
function matterSummary(user, m) {
  return { id: m.id, title: m.title, client_name: nameOf(m.client), timer_days: m.timer_days, timer_label: timerLabel(m.timer_days), unread: unreadCount(user, m.id) };
}
const visibleMatters = user => db.prepare("SELECT * FROM matters ORDER BY id").all().filter(m => canSee(user, m)).map(m => matterSummary(user, m));

// Thread in reply order. A deleted message appears only as a placeholder while replies to it survive.
function threadFor(user, matterId) {
  const rows = db.prepare("SELECT * FROM messages WHERE matter_id = ? ORDER BY seq").all(matterId);
  const byId = new Map(rows.map(r => [r.id, r]));
  const children = new Map();
  for (const r of rows) {
    const key = r.parent_id && byId.has(r.parent_id) ? r.parent_id : "";
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(r);
  }
  const live = new Map();
  const hasLive = id => {
    if (live.has(id)) return live.get(id);
    const v = (children.get(id) || []).some(c => !c.deleted || hasLive(c.id));
    live.set(id, v);
    return v;
  };
  const out = [];
  const walk = (key, depth) => {
    for (const r of children.get(key) || []) {
      if (r.deleted && !hasLive(r.id)) continue;
      out.push(shapeMessage(user, r, depth, byId));
      walk(r.id, depth + 1);
    }
  };
  walk("", 0);
  return out;
}
function shapeMessage(user, r, depth, byId) {
  const parent = r.parent_id ? byId.get(r.parent_id) : null;
  return {
    id: r.id, seq: r.seq, parent_id: r.parent_id, depth,
    author: r.author, author_name: nameOf(r.author), at: r.at,
    deleted: !!r.deleted, body: r.deleted ? "" : r.body,
    version: r.version, edited: !r.deleted && r.version > 1, hold: !!r.hold,
    quote: parent ? (parent.deleted ? { deleted: true } : { author_name: nameOf(parent.author), text: parent.body.slice(0, 120) }) : null,
    previews: r.deleted ? {} : previewsFor(user, r.body),
    mine: r.author === user.email
  };
}

/* ---------- auth ---------- */

app.post("/api/session", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !hashesMatch(user.pw_hash, hashPassword(String(req.body?.password || ""), user.pw_salt))) {
    return res.status(401).json({ error: "That email and password don't match an account." });
  }
  const token = crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT INTO sessions (token, email) VALUES (?, ?)").run(token, user.email);
  res.set("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax`);
  res.json({ email: user.email, name: user.name, role: user.role });
});
app.delete("/api/session", (req, res) => {
  const token = readCookie(req);
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  res.set("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});
app.get("/api/me", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const staff = people().filter(u => u.role !== "client").map(u => ({ email: u.email, name: u.name }));
  res.json({ email: user.email, name: user.name, role: user.role, role_label: ROLE_LABEL[user.role], clock: CLOCK, staff: user.role === "partner" ? staff : [] });
});

/* ---------- reading ---------- */

function mentionsFor(user) {
  return db.prepare("SELECT m.id, m.matter_id, m.author, m.body, m.at FROM mentions x JOIN messages m ON m.id = x.message_id WHERE x.email = ? AND m.deleted = 0 ORDER BY m.seq DESC").all(user.email)
    .filter(r => visibleMatter(user, r.matter_id))
    .map(r => ({ id: r.id, matter_id: r.matter_id, author_name: nameOf(r.author), at: r.at, text: r.body.slice(0, 140) }));
}

app.get("/api/matters", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  sweepNow();
  res.json({ matters: visibleMatters(user), mention_count: mentionsFor(user).length });
});
app.get("/api/matters/:id", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  sweepNow();
  const m = visibleMatter(user, req.params.id);
  if (!m) return res.status(404).json({ error: NOT_AVAILABLE });
  const walls = user.role === "partner" ? db.prepare("SELECT email FROM walls WHERE matter_id = ?").all(m.id).map(w => w.email) : undefined;
  res.json({ matter: matterSummary(user, m), last_read: lastRead(user.email, m.id), messages: threadFor(user, m.id), walls });
});
// Mention suggestions: only the other people who can see this matter, so walls and client scope hold here too.
app.get("/api/matters/:id/people", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const m = visibleMatter(user, req.params.id);
  if (!m) return res.status(404).json({ error: NOT_AVAILABLE });
  res.json({ people: people().filter(u => u.email !== user.email && canSee(u, m)).map(u => ({ name: u.name, mention: u.name.split(" ")[0] })) });
});
app.post("/api/matters/:id/read", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const m = visibleMatter(user, req.params.id);
  if (!m) return res.status(404).json({ error: NOT_AVAILABLE });
  let seq;
  if (req.body?.unread_from) {
    const msg = db.prepare("SELECT seq FROM messages WHERE id = ? AND matter_id = ? AND deleted = 0").get(String(req.body.unread_from), m.id);
    if (!msg) return res.status(404).json({ error: NOT_AVAILABLE });
    seq = msg.seq - 1;
  } else {
    seq = Number(req.body?.up_to_seq) || db.prepare("SELECT COALESCE(MAX(seq), 0) AS s FROM messages WHERE matter_id = ?").get(m.id).s;
  }
  db.prepare("INSERT INTO reads (email, matter_id, last_seq) VALUES (?, ?, ?) ON CONFLICT(email, matter_id) DO UPDATE SET last_seq = excluded.last_seq").run(user.email, m.id, seq);
  res.json({ matter: matterSummary(user, m), last_read: seq });
});
app.get("/api/messages/:id", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  sweepNow();
  const msg = visibleMessage(user, req.params.id);
  if (!msg || msg.deleted) return res.status(404).json({ error: NOT_AVAILABLE });
  res.json({ id: msg.id, matter_id: msg.matter_id, author_name: nameOf(msg.author), at: msg.at, body: msg.body, hold: !!msg.hold, version: msg.version });
});
app.get("/api/messages/:id/versions", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  sweepNow();
  const msg = visibleMessage(user, req.params.id);
  if (!msg || msg.deleted) return res.status(404).json({ error: NOT_AVAILABLE });
  if (!isStaff(user)) return res.status(403).json({ error: "Earlier versions are for firm staff only." });
  const earlier = db.prepare("SELECT n, body, at FROM versions WHERE message_id = ? ORDER BY n").all(msg.id);
  res.json({ id: msg.id, versions: [...earlier, { n: msg.version, body: msg.body, at: msg.at, current: true }] });
});
app.get("/api/mentions", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  sweepNow();
  res.json({ mentions: mentionsFor(user) });
});
app.get("/api/search", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  sweepNow();
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) return res.json({ results: [] });
  const results = db.prepare("SELECT id, matter_id, author, body, at FROM messages WHERE deleted = 0 ORDER BY seq").all()
    .filter(r => r.body.toLowerCase().includes(q) && visibleMatter(user, r.matter_id))
    .map(r => ({ id: r.id, matter_id: r.matter_id, matter_title: db.prepare("SELECT title FROM matters WHERE id = ?").get(r.matter_id).title, author_name: nameOf(r.author), at: r.at, text: r.body.slice(0, 200) }));
  res.json({ results });
});

/* ---------- writing ---------- */

app.post("/api/matters/:id/messages", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  sweepNow();
  const m = visibleMatter(user, req.params.id);
  if (!m) return res.status(404).json({ error: NOT_AVAILABLE });
  const body = String(req.body?.body ?? "").replace(/\r\n/g, "\n");
  if (!body.trim()) return res.status(400).json({ error: "Type a message before sending." });
  if (body.length > 4000) return res.status(400).json({ error: "Messages are limited to 4,000 characters." });
  const key = req.body?.client_key ? `${user.email}:${String(req.body.client_key).slice(0, 80)}` : null;
  let parentId = null;
  if (req.body?.parent_id) {
    // A reply belongs to its parent's matter: a parent from any other matter is simply not there.
    const parent = db.prepare("SELECT * FROM messages WHERE id = ? AND matter_id = ?").get(String(req.body.parent_id), m.id);
    if (!parent || parent.deleted) return res.status(404).json({ error: "The message you are replying to is no longer available." });
    parentId = parent.id;
  }
  const result = db.transaction(() => {
    if (key) {
      const existing = db.prepare("SELECT id FROM messages WHERE client_key = ?").get(key);
      if (existing) return { id: existing.id, duplicate: true };
    }
    const id = newMessageId();
    db.prepare("INSERT INTO messages (id, matter_id, parent_id, author, at, body, client_key) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, m.id, parentId, user.email, CLOCK, body, key);
    recordMentions(id, m.id, body);
    const seq = db.prepare("SELECT seq FROM messages WHERE id = ?").get(id).seq;
    db.prepare("INSERT INTO reads (email, matter_id, last_seq) VALUES (?, ?, ?) ON CONFLICT(email, matter_id) DO UPDATE SET last_seq = MAX(last_seq, excluded.last_seq)").run(user.email, m.id, seq);
    return { id, duplicate: false };
  })();
  res.status(result.duplicate ? 200 : 201).json(result);
});

app.patch("/api/messages/:id", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  sweepNow();
  const msg = visibleMessage(user, req.params.id);
  if (!msg || msg.deleted) return res.status(404).json({ error: NOT_AVAILABLE });
  if (msg.author !== user.email) return res.status(403).json({ error: "Only the author can edit this message." });
  const body = String(req.body?.body ?? "").replace(/\r\n/g, "\n");
  if (!body.trim()) return res.status(400).json({ error: "A message can't be empty." });
  if (Number(req.body?.version) !== msg.version) {
    return res.status(409).json({ error: "This message changed since you opened it. Reload to see the latest version; your text is still here.", current_version: msg.version });
  }
  db.transaction(() => {
    db.prepare("INSERT INTO versions (message_id, n, body, at) VALUES (?, ?, ?, ?)").run(msg.id, msg.version, msg.body, CLOCK);
    db.prepare("UPDATE messages SET body = ?, version = version + 1 WHERE id = ?").run(body, msg.id);
    recordMentions(msg.id, msg.matter_id, body);
  })();
  res.json({ id: msg.id, version: msg.version + 1 });
});

app.delete("/api/messages/:id", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  sweepNow();
  const msg = visibleMessage(user, req.params.id);
  if (!msg || msg.deleted) return res.status(404).json({ error: NOT_AVAILABLE });
  if (msg.author !== user.email) return res.status(403).json({ error: "Only the author can delete this message." });
  if (msg.hold) return res.status(409).json({ error: "This message is on legal hold and can't be deleted." });
  db.transaction(() => eraseMessage(msg.id))();
  res.json({ ok: true });
});

app.post("/api/messages/:id/hold", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const msg = visibleMessage(user, req.params.id);
  if (!msg || msg.deleted) return res.status(404).json({ error: NOT_AVAILABLE });
  if (user.role !== "partner") return res.status(403).json({ error: "Only a partner can place or release a hold." });
  const hold = !!req.body?.hold;
  db.transaction(() => { db.prepare("UPDATE messages SET hold = ? WHERE id = ?").run(hold ? 1 : 0, msg.id); sweep(); })();
  res.json({ id: msg.id, hold, deleted: !!db.prepare("SELECT deleted FROM messages WHERE id = ?").get(msg.id).deleted });
});

app.post("/api/matters/:id/timer", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const m = visibleMatter(user, req.params.id);
  if (!m) return res.status(404).json({ error: NOT_AVAILABLE });
  if (user.role !== "partner") return res.status(403).json({ error: "Only a partner can change the timer." });
  const raw = req.body?.days;
  const days = raw === null || raw === "off" || raw === "" ? null : Number(raw);
  if (!TIMER_OPTIONS.includes(days)) return res.status(400).json({ error: "Choose off, 1 day, 7 days or 30 days." });
  db.transaction(() => { db.prepare("UPDATE matters SET timer_days = ? WHERE id = ?").run(days, m.id); sweep(); })();
  res.json({ matter: matterSummary(user, db.prepare("SELECT * FROM matters WHERE id = ?").get(m.id)) });
});

app.post("/api/matters/:id/walls", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const m = visibleMatter(user, req.params.id);
  if (!m) return res.status(404).json({ error: NOT_AVAILABLE });
  if (user.role !== "partner") return res.status(403).json({ error: "Only a partner can change walls." });
  const target = db.prepare("SELECT email, role FROM users WHERE email = ?").get(String(req.body?.email || ""));
  if (!target || target.role === "client") return res.status(400).json({ error: "Walls apply to firm staff only." });
  if (target.email === user.email) return res.status(400).json({ error: "You can't wall yourself from a matter." });
  if (req.body?.walled) db.prepare("INSERT OR IGNORE INTO walls (matter_id, email) VALUES (?, ?)").run(m.id, target.email);
  else db.prepare("DELETE FROM walls WHERE matter_id = ? AND email = ?").run(m.id, target.email);
  res.json({ walls: db.prepare("SELECT email FROM walls WHERE matter_id = ?").all(m.id).map(w => w.email) });
});

/* ---------- transcript ---------- */

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = iso => iso.replace("T", " ").replace(/(\d\d:\d\d):\d\d(\.\d+)?Z$/, "$1 UTC");

app.get("/transcripts/:id", (req, res) => {
  res.set("Cache-Control", "no-store");
  const page = (title, inner, status = 200) => res.status(status).type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="/transcript.css"></head><body><main class="transcript">${inner}</main></body></html>`);
  if (!booted) return page("Unavailable", `<p class="na">The chambers database is unavailable.</p>`, 503);
  const user = currentUser(req);
  if (!user) return page("Not available", `<p class="na">Not available. Please sign in.</p>`, 401);
  sweepNow();
  const m = visibleMatter(user, req.params.id);
  if (!m) return page("Not available", `<p class="na">${NOT_AVAILABLE}</p>`, 404);
  const rows = threadFor(user, m.id).map(msg => {
    const indent = `style="--depth:${Math.min(msg.depth, 6)}"`;
    if (msg.deleted) return `<li class="row" ${indent}><p class="placeholder">Original message deleted</p></li>`;
    let versions = "";
    if (msg.hold && msg.version > 1) {
      const earlier = db.prepare("SELECT n, body FROM versions WHERE message_id = ? ORDER BY n").all(msg.id);
      versions = `<ol class="versions">${earlier.map(v => `<li><span class="vlabel">Version ${v.n}</span> <span class="vtext">${esc(v.body)}</span></li>`).join("")}<li><span class="vlabel">Version ${msg.version}, current</span> <span class="vtext">${esc(msg.body)}</span></li></ol>`;
    }
    const reply = msg.parent_id ? `<p class="inreply">In reply to ${msg.quote && !msg.quote.deleted ? esc(msg.quote.author_name) : "a deleted message"}</p>` : "";
    return `<li class="row" ${indent}><p class="meta"><strong>${esc(msg.author_name)}</strong> <time datetime="${esc(msg.at)}">${esc(fmt(msg.at))}</time>${msg.edited ? ` <span class="edited">edited</span>` : ""}${msg.hold ? ` <span class="hold">On hold</span>` : ""}</p>${reply}<p class="text">${esc(msg.body)}</p>${versions}</li>`;
  }).join("");
  page(`${m.id} transcript`, `<header><p class="firm">Kittle &amp; Rowe</p><h1>${esc(m.id)} · ${esc(m.title)}</h1><p class="generated">Generated ${esc(fmt(CLOCK))}</p></header><ol class="listing">${rows || `<li class="row"><p class="text">No messages.</p></li>`}</ol>`);
});

/* ---------- pages ---------- */

app.use(express.static(PUBLIC_DIR, { index: false, maxAge: 0 }));
const shell = (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html"));
for (const route of ["/", "/matters/:id", "/messages/:id", "/mentions", "/search"]) app.get(route, shell);
app.use("/api", (_req, res) => res.status(404).json({ error: NOT_AVAILABLE }));

init();
app.listen(PORT, "0.0.0.0", () => console.log(`Kittle & Rowe matter chat on port ${PORT}`));

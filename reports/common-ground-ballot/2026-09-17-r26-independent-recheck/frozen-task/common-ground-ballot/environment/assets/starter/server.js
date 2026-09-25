// Foundation: persistence, seed import, authentication, and HTTP shell.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const Database = require("better-sqlite3");

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || "/app/commonground.db";
const SEED_PATH = process.env.SEED_PATH || "/app/common_ground_seed.json";
const PASSWORD = "CommonGround!2026";
const SESSION_SECONDS = 8 * 60 * 60;

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "128kb", strict: true }));
app.use((request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "same-origin");
  if (request.path.startsWith("/api/")) response.setHeader("Cache-Control", "no-store");
  next();
});

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS seed_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('coordinator', 'observer', 'member')),
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS memberships (
    group_id TEXT NOT NULL REFERENCES groups(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    active INTEGER NOT NULL CHECK (active IN (0, 1)),
    revision INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (group_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS ballots (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    method TEXT NOT NULL CHECK (method IN ('single', 'approval')),
    max_selections INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'closed', 'published')),
    revision INTEGER NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    opened_at TEXT,
    closed_at TEXT,
    published_at TEXT
  );
  CREATE TABLE IF NOT EXISTS choices (
    id TEXT PRIMARY KEY,
    ballot_id TEXT NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    position INTEGER NOT NULL,
    UNIQUE (ballot_id, position)
  );
  CREATE TABLE IF NOT EXISTS eligibility (
    ballot_id TEXT NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    PRIMARY KEY (ballot_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS participation (
    ballot_id TEXT NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    submitted_at TEXT NOT NULL,
    receipt_id TEXT NOT NULL UNIQUE,
    PRIMARY KEY (ballot_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS anonymous_votes (
    id TEXT PRIMARY KEY,
    ballot_id TEXT NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
    choice_id TEXT NOT NULL REFERENCES choices(id) ON DELETE CASCADE,
    cast_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS operation_receipts (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation_id TEXT NOT NULL,
    action TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, operation_id)
  );
  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    actor_id TEXT REFERENCES users(id),
    actor_label TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ballots_status ON ballots(status);
  CREATE INDEX IF NOT EXISTS idx_choices_ballot ON choices(ballot_id, position);
  CREATE INDEX IF NOT EXISTS idx_votes_ballot ON anonymous_votes(ballot_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit(id DESC);
`);

class ApiError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.body = { error: message, ...extra };
  }
}

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const tokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const fingerprint = (value) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

function passwordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") };
}

function passwordMatches(password, salt, expected) {
  const actual = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(expected, "hex");
  return stored.length === actual.length && crypto.timingSafeEqual(actual, stored);
}

function seedApplication() {
  if (db.prepare("SELECT 1 FROM seed_state WHERE key = 'bootstrap-v1'").get()) return;
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  const fixed = {
    draft: "2026-08-04T09:00:00.000Z",
    open: "2026-08-05T10:00:00.000Z",
    closed: "2026-08-06T11:00:00.000Z",
    published: "2026-08-07T12:00:00.000Z",
    member: "2026-08-08T13:00:00.000Z",
  };
  db.transaction(() => {
    db.prepare("INSERT INTO groups (id, name) VALUES (?, ?)").run(seed.group.id, seed.group.name);
    const insertUser = db.prepare(
      "INSERT INTO users (id, name, email, role, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const user of seed.users) {
      const password = passwordRecord(PASSWORD);
      insertUser.run(user.id, user.name, user.email, user.role, password.hash, password.salt);
    }
    const insertMembership = db.prepare(
      "INSERT INTO memberships (group_id, user_id, active, revision, updated_at) VALUES (?, ?, ?, 1, ?)"
    );
    for (const member of seed.memberships) {
      insertMembership.run(seed.group.id, member.user_id, member.active ? 1 : 0, fixed.member);
    }
    const insertBallot = db.prepare(`
      INSERT INTO ballots
        (id, group_id, title, description, method, max_selections, status, revision,
         created_by, created_at, opened_at, closed_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user-ruth', ?, ?, ?, ?)
    `);
    const insertChoice = db.prepare(
      "INSERT INTO choices (id, ballot_id, label, position) VALUES (?, ?, ?, ?)"
    );
    const insertEligible = db.prepare(
      "INSERT INTO eligibility (ballot_id, user_id) VALUES (?, ?)"
    );
    const insertParticipant = db.prepare(
      "INSERT INTO participation (ballot_id, user_id, submitted_at, receipt_id) VALUES (?, ?, ?, ?)"
    );
    const insertVote = db.prepare(
      "INSERT INTO anonymous_votes (id, ballot_id, choice_id, cast_at) VALUES (?, ?, ?, ?)"
    );
    for (const ballot of seed.ballots) {
      const opened = ballot.status === "draft" ? null : fixed.open;
      const closed = ["closed", "published"].includes(ballot.status) ? fixed.closed : null;
      const published = ballot.status === "published" ? fixed.published : null;
      insertBallot.run(
        ballot.id,
        seed.group.id,
        ballot.title,
        ballot.description,
        ballot.method,
        ballot.max_selections,
        ballot.status,
        ballot.revision,
        fixed.draft,
        opened,
        closed,
        published
      );
      ballot.choices.forEach((choice, index) =>
        insertChoice.run(choice.id, ballot.id, choice.label, index)
      );
      for (const userId of ballot.eligible_user_ids || []) {
        insertEligible.run(ballot.id, userId);
      }
      (ballot.participant_user_ids || []).forEach((userId, index) => {
        insertParticipant.run(
          ballot.id,
          userId,
          fixed.closed,
          `seed-receipt-${ballot.id}-${index + 1}`
        );
      });
      (ballot.anonymous_choice_ids || []).forEach((choiceId, index) => {
        insertVote.run(`seed-vote-${ballot.id}-${index + 1}`, ballot.id, choiceId, fixed.closed);
      });
    }
    const insertAudit = db.prepare(`
      INSERT INTO audit (action, entity_type, entity_id, actor_id, actor_label, details, created_at)
      VALUES (?, 'ballot', ?, 'user-ruth', 'Ruth Adebayo', ?, ?)
    `);
    insertAudit.run("created", "ballot-draft-picnic", "Created draft Annual picnic date", fixed.draft);
    insertAudit.run("opened", "ballot-open-courtyard", "Opened Courtyard closing time with 2 eligible Members", fixed.open);
    insertAudit.run("closed", "ballot-closed-improvements", "Closed Shared-space improvements", fixed.closed);
    insertAudit.run("published", "ballot-published-garden", "Published anonymous results for Garden location", fixed.published);
    db.prepare(`
      INSERT INTO audit (action, entity_type, entity_id, actor_id, actor_label, details, created_at)
      VALUES ('membership_paused', 'member', 'user-owen', 'user-ruth', 'Ruth Adebayo',
              'Paused Owen Park for future eligibility snapshots', ?)
    `).run(fixed.member);
    db.prepare("INSERT INTO seed_state (key, value) VALUES ('bootstrap-v1', ?)").run(
      String(seed.schema_version)
    );
  })();
}

seedApplication();

function cleanExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now());
}

function parseCookies(request) {
  const values = {};
  for (const part of (request.headers.cookie || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    values[part.slice(0, separator).trim()] = decodeURIComponent(part.slice(separator + 1).trim());
  }
  return values;
}

function currentUser(request) {
  cleanExpiredSessions();
  const token = parseCookies(request).cg_session;
  if (!token) return null;
  return db.prepare(`
    SELECT u.id, u.name, u.email, u.role, s.token_hash
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash(token), now()) || null;
}

function requireUser(request, _response, next) {
  const user = currentUser(request);
  if (!user) return next(new ApiError(401, "Please sign in to continue."));
  request.user = user;
  next();
}

function requireRole(...roles) {
  return (request, _response, next) => {
    if (!roles.includes(request.user.role)) {
      return next(new ApiError(403, "Your role cannot perform this action."));
    }
    next();
  };
}

function requireObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "A valid request body is required.");
  }
}

function exactKeys(value, allowed) {
  requireObject(value);
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new ApiError(400, `Unexpected field: ${extras[0]}.`);
}

function text(value, label, max, required = true) {
  if (typeof value !== "string") throw new ApiError(400, `${label} must be text.`);
  const cleaned = value.trim();
  if (required && !cleaned) throw new ApiError(400, `${label} is required.`);
  if (cleaned.length > max) throw new ApiError(400, `${label} is too long.`);
  return cleaned;
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "common-ground-ballot" });
});

app.post("/api/auth/login", (request, response, next) => {
  try {
    exactKeys(request.body, ["email", "password"]);
    const email = text(request.body.email, "Email", 240).toLowerCase();
    const password = typeof request.body.password === "string" ? request.body.password : "";
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !passwordMatches(password, user.password_salt, user.password_hash)) {
      throw new ApiError(401, "Email or password is incorrect.");
    }
    const token = crypto.randomBytes(32).toString("base64url");
    const createdAt = now();
    const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
    db.prepare(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
    ).run(tokenHash(token), user.id, createdAt, expiresAt);
    response.setHeader(
      "Set-Cookie",
      `cg_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}`
    );
    response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", requireUser, (request, response) => {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(request.user.token_hash);
  response.setHeader("Set-Cookie", "cg_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
  response.json({ ok: true });
});

app.post("/api/auth/logout-all", requireUser, (request, response) => {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(request.user.id);
  response.setHeader("Set-Cookie", "cg_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
  response.json({ ok: true, message: "All Common Ground sessions were ended." });
});

app.get("/api/me", (request, response) => {
  const user = currentUser(request);
  response.json({
    user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
  });
});

// Add protected ballot, membership, turnout, results, and audit routes here.
// Call requireUser/requireRole and return role-appropriate projections.
app.use('/api', (_request, response) => response.status(501).json({error: 'This workflow is not implemented yet.'}));

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.get(/.*/, (_request, response) => response.sendFile(path.join(__dirname, "public", "index.html")));

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return response.status(400).json({ error: "Request body must be valid JSON." });
  }
  if (error instanceof ApiError) return response.status(error.status).json(error.body);
  console.error(error);
  response.status(500).json({ error: "Something went wrong on the server." });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Common Ground listening on ${PORT}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

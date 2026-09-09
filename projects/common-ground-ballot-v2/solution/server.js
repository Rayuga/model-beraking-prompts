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

function integer(value, label, minimum = 1) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new ApiError(400, `${label} must be a whole number of at least ${minimum}.`);
  }
  return value;
}

function operationId(body) {
  const value = text(body.operation_id, "Operation id", 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(value)) {
    throw new ApiError(400, "Operation id is invalid.");
  }
  return value;
}

function writeAudit(actor, action, entityType, entityId, details) {
  db.prepare(`
    INSERT INTO audit (action, entity_type, entity_id, actor_id, actor_label, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(action, entityType, entityId, actor.id, actor.name, details, now());
}

function idempotent(request, response, action, payload, work) {
  const opId = operationId(request.body);
  const digest = fingerprint({ action, payload });
  const prior = db.prepare(
    "SELECT action, fingerprint, status_code, response_json FROM operation_receipts WHERE user_id = ? AND operation_id = ?"
  ).get(request.user.id, opId);
  if (prior) {
    if (prior.action !== action || prior.fingerprint !== digest) {
      throw new ApiError(409, "This operation id was already used for different input.");
    }
    response.setHeader("X-Idempotent-Replay", "true");
    return response.status(prior.status_code).json(JSON.parse(prior.response_json));
  }

  let statusCode = 200;
  let body;
  try {
    db.transaction(() => {
      const result = work();
      statusCode = result.statusCode || 200;
      body = result.body;
      db.prepare(`
        INSERT INTO operation_receipts
          (user_id, operation_id, action, fingerprint, status_code, response_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(request.user.id, opId, action, digest, statusCode, JSON.stringify(body), now());
    })();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    statusCode = error.status;
    body = error.body;
    db.prepare(`
      INSERT OR IGNORE INTO operation_receipts
        (user_id, operation_id, action, fingerprint, status_code, response_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(request.user.id, opId, action, digest, statusCode, JSON.stringify(body), now());
  }
  return response.status(statusCode).json(body);
}

function choiceRows(ballotId) {
  return db.prepare(
    "SELECT id, label FROM choices WHERE ballot_id = ? ORDER BY position"
  ).all(ballotId);
}

function staffTurnout(ballotId) {
  return db.prepare(`
    SELECT u.id, u.name, u.email,
           CASE WHEN p.user_id IS NULL THEN 0 ELSE 1 END AS participated
    FROM eligibility e
    JOIN users u ON u.id = e.user_id
    LEFT JOIN participation p ON p.ballot_id = e.ballot_id AND p.user_id = e.user_id
    WHERE e.ballot_id = ?
    ORDER BY u.name
  `).all(ballotId).map((row) => ({ ...row, participated: Boolean(row.participated) }));
}

function ballotView(ballot, user) {
  const choices = choiceRows(ballot.id);
  const eligibleCount = db.prepare(
    "SELECT COUNT(*) AS count FROM eligibility WHERE ballot_id = ?"
  ).get(ballot.id).count;
  const participationCount = db.prepare(
    "SELECT COUNT(*) AS count FROM participation WHERE ballot_id = ?"
  ).get(ballot.id).count;
  const view = {
    id: ballot.id,
    title: ballot.title,
    description: ballot.description,
    method: ballot.method,
    max_selections: ballot.max_selections,
    status: ballot.status,
    revision: ballot.revision,
    created_at: ballot.created_at,
    opened_at: ballot.opened_at,
    closed_at: ballot.closed_at,
    published_at: ballot.published_at,
    choices,
  };

  if (user.role === "member") {
    view.eligible = Boolean(db.prepare(
      "SELECT 1 FROM eligibility WHERE ballot_id = ? AND user_id = ?"
    ).get(ballot.id, user.id));
    view.participated = Boolean(db.prepare(
      "SELECT 1 FROM participation WHERE ballot_id = ? AND user_id = ?"
    ).get(ballot.id, user.id));
  } else {
    view.turnout = {
      eligible: eligibleCount,
      participated: participationCount,
      percentage: eligibleCount ? Math.round((participationCount / eligibleCount) * 100) : 0,
      members: staffTurnout(ballot.id),
    };
  }

  if (ballot.status === "published") {
    const results = db.prepare(`
      SELECT c.id, c.label, c.position, COUNT(v.id) AS votes
      FROM choices c LEFT JOIN anonymous_votes v ON v.choice_id = c.id
      WHERE c.ballot_id = ? GROUP BY c.id, c.label, c.position ORDER BY c.position
    `).all(ballot.id);
    const top = results.length ? Math.max(...results.map((row) => row.votes)) : 0;
    const leaders = results.filter((row) => row.votes === top).map((row) => row.label);
    view.results = results.map((row) => ({
      label: row.label,
      votes: row.votes,
      percentage: participationCount ? Math.round((row.votes / participationCount) * 100) : 0,
    }));
    view.total_ballots = participationCount;
    view.outcome = leaders.length > 1 ? `Tie: ${leaders.join(", ")}` : `Leader: ${leaders[0] || "No votes"}`;
  }
  return view;
}

function visibleBallots(user) {
  if (user.role !== "member") {
    return db.prepare("SELECT * FROM ballots ORDER BY created_at DESC, id").all();
  }
  return db.prepare(`
    SELECT b.* FROM ballots b JOIN eligibility e ON e.ballot_id = b.id
    WHERE e.user_id = ? AND b.status IN ('open', 'closed', 'published')
    ORDER BY b.created_at DESC, b.id
  `).all(user.id);
}

function ballotOrThrow(id) {
  const ballot = db.prepare("SELECT * FROM ballots WHERE id = ?").get(id);
  if (!ballot) throw new ApiError(404, "Ballot not found.");
  return ballot;
}

function validateDraft(body) {
  const title = text(body.title, "Ballot title", 120);
  const description = text(body.description ?? "", "Description", 500, false);
  if (!["single", "approval"].includes(body.method)) {
    throw new ApiError(400, "Voting method must be single or approval.");
  }
  if (!Array.isArray(body.choices)) throw new ApiError(400, "Choices must be a list.");
  const choices = body.choices.map((choice) => text(choice, "Choice", 100));
  if (choices.length < 2 || choices.length > 8) {
    throw new ApiError(400, "Add between two and eight choices.");
  }
  if (new Set(choices.map((choice) => choice.toLocaleLowerCase())).size !== choices.length) {
    throw new ApiError(400, "Choice labels must be different.");
  }
  let maxSelections;
  if (body.method === "single") {
    if (body.max_selections !== 1) throw new ApiError(400, "Single choice uses a limit of one.");
    maxSelections = 1;
  } else {
    maxSelections = integer(body.max_selections, "Approval limit");
  }
  if (maxSelections > choices.length) {
    throw new ApiError(400, "Approval limit cannot exceed the number of choices.");
  }
  return { title, description, method: body.method, maxSelections, choices };
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

app.get("/api/ballots", requireUser, (request, response) => {
  response.json({ ballots: visibleBallots(request.user).map((ballot) => ballotView(ballot, request.user)) });
});

app.get("/api/members", requireUser, requireRole("coordinator", "observer"), (_request, response) => {
  const group = db.prepare("SELECT id, name FROM groups LIMIT 1").get();
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, m.active, m.revision, m.updated_at
    FROM memberships m JOIN users u ON u.id = m.user_id
    WHERE m.group_id = ? ORDER BY u.name
  `).all(group.id).map((member) => ({ ...member, active: Boolean(member.active) }));
  response.json({ group, members });
});

app.patch("/api/members/:id", requireUser, requireRole("coordinator"), (request, response, next) => {
  try {
    exactKeys(request.body, ["active", "expected_revision", "operation_id"]);
    if (typeof request.body.active !== "boolean") throw new ApiError(400, "Active must be true or false.");
    const expectedRevision = integer(request.body.expected_revision, "Expected revision");
    return idempotent(
      request,
      response,
      "membership.update",
      { id: request.params.id, active: request.body.active, expectedRevision },
      () => {
        const member = db.prepare(`
          SELECT m.*, u.name FROM memberships m JOIN users u ON u.id = m.user_id
          WHERE m.user_id = ?
        `).get(request.params.id);
        if (!member) throw new ApiError(404, "Member not found.");
        if (member.revision !== expectedRevision) {
          throw new ApiError(409, "This member record changed. Refresh before trying again.", { current_revision: member.revision });
        }
        const nextRevision = member.revision + 1;
        db.prepare("UPDATE memberships SET active = ?, revision = ?, updated_at = ? WHERE user_id = ?")
          .run(request.body.active ? 1 : 0, nextRevision, now(), member.user_id);
        writeAudit(
          request.user,
          request.body.active ? "membership_activated" : "membership_paused",
          "member",
          member.user_id,
          `${request.body.active ? "Activated" : "Paused"} ${member.name} for future eligibility snapshots`
        );
        return { statusCode: 200, body: { member: { id: member.user_id, name: member.name, active: request.body.active, revision: nextRevision } } };
      }
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/ballots", requireUser, requireRole("coordinator"), (request, response, next) => {
  try {
    exactKeys(request.body, ["title", "description", "method", "max_selections", "choices", "operation_id"]);
    const draft = validateDraft(request.body);
    return idempotent(
      request,
      response,
      "ballot.create",
      draft,
      () => {
        const ballotId = makeId("ballot");
        const createdAt = now();
        db.prepare(`
          INSERT INTO ballots
            (id, group_id, title, description, method, max_selections, status, revision, created_by, created_at)
          VALUES (?, 'group-riverside', ?, ?, ?, ?, 'draft', 1, ?, ?)
        `).run(ballotId, draft.title, draft.description, draft.method, draft.maxSelections, request.user.id, createdAt);
        const addChoice = db.prepare("INSERT INTO choices (id, ballot_id, label, position) VALUES (?, ?, ?, ?)");
        draft.choices.forEach((label, index) => addChoice.run(makeId("choice"), ballotId, label, index));
        writeAudit(request.user, "created", "ballot", ballotId, `Created draft ${draft.title}`);
        const ballot = ballotOrThrow(ballotId);
        return { statusCode: 201, body: { ballot: ballotView(ballot, request.user) } };
      }
    );
  } catch (error) {
    next(error);
  }
});

app.patch("/api/ballots/:id", requireUser, requireRole("coordinator"), (request, response, next) => {
  try {
    exactKeys(request.body, ["title", "description", "method", "max_selections", "choices", "expected_revision", "operation_id"]);
    const expectedRevision = integer(request.body.expected_revision, "Expected revision");
    const draft = validateDraft(request.body);
    return idempotent(
      request,
      response,
      "ballot.edit",
      { id: request.params.id, expectedRevision, ...draft },
      () => {
        const ballot = ballotOrThrow(request.params.id);
        if (ballot.revision !== expectedRevision) {
          throw new ApiError(409, "This ballot changed. Refresh before trying again.", { current_revision: ballot.revision });
        }
        if (ballot.status !== "draft") throw new ApiError(409, "Only a draft ballot can be edited.");
        const nextRevision = ballot.revision + 1;
        db.prepare(`
          UPDATE ballots SET title = ?, description = ?, method = ?, max_selections = ?, revision = ? WHERE id = ?
        `).run(draft.title, draft.description, draft.method, draft.maxSelections, nextRevision, ballot.id);
        db.prepare("DELETE FROM choices WHERE ballot_id = ?").run(ballot.id);
        const addChoice = db.prepare("INSERT INTO choices (id, ballot_id, label, position) VALUES (?, ?, ?, ?)");
        draft.choices.forEach((label, index) => addChoice.run(makeId("choice"), ballot.id, label, index));
        writeAudit(request.user, "edited", "ballot", ballot.id, `Updated draft ${draft.title}`);
        return { statusCode: 200, body: { ballot: ballotView(ballotOrThrow(ballot.id), request.user) } };
      }
    );
  } catch (error) {
    next(error);
  }
});

function lifecycle(action, fromStatus, toStatus, timestampField, auditAction) {
  app.post(`/api/ballots/:id/${action}`, requireUser, requireRole("coordinator"), (request, response, next) => {
    try {
      exactKeys(request.body, ["expected_revision", "operation_id"]);
      const expectedRevision = integer(request.body.expected_revision, "Expected revision");
      return idempotent(
        request,
        response,
        `ballot.${action}`,
        { id: request.params.id, expectedRevision },
        () => {
          const ballot = ballotOrThrow(request.params.id);
          if (ballot.revision !== expectedRevision) {
            throw new ApiError(409, "This ballot changed. Refresh before trying again.", { current_revision: ballot.revision });
          }
          if (ballot.status !== fromStatus) {
            const pastTense = { open: "opened", close: "closed", publish: "published" }[action];
            throw new ApiError(409, `Only a ${fromStatus} ballot can be ${pastTense}.`);
          }
          let eligibleCount = null;
          if (action === "open") {
            eligibleCount = db.prepare("SELECT COUNT(*) AS count FROM memberships WHERE group_id = ? AND active = 1")
              .get(ballot.group_id).count;
            if (!eligibleCount) throw new ApiError(409, "At least one active Member is needed before opening.");
            db.prepare(`
              INSERT INTO eligibility (ballot_id, user_id)
              SELECT ?, user_id FROM memberships WHERE group_id = ? AND active = 1
            `).run(ballot.id, ballot.group_id);
          }
          const nextRevision = ballot.revision + 1;
          db.prepare(`UPDATE ballots SET status = ?, revision = ?, ${timestampField} = ? WHERE id = ?`)
            .run(toStatus, nextRevision, now(), ballot.id);
          const detail = action === "open"
            ? `Opened ${ballot.title} with ${eligibleCount} eligible Member${eligibleCount === 1 ? "" : "s"}`
            : `${auditAction[0].toUpperCase() + auditAction.slice(1)} ${ballot.title}`;
          writeAudit(request.user, auditAction, "ballot", ballot.id, detail);
          return { statusCode: 200, body: { ballot: ballotView(ballotOrThrow(ballot.id), request.user) } };
        }
      );
    } catch (error) {
      next(error);
    }
  });
}

lifecycle("open", "draft", "open", "opened_at", "opened");
lifecycle("close", "open", "closed", "closed_at", "closed");
lifecycle("publish", "closed", "published", "published_at", "published");

app.post("/api/ballots/:id/vote", requireUser, requireRole("member"), (request, response, next) => {
  try {
    exactKeys(request.body, ["choice_ids", "expected_revision", "operation_id"]);
    const expectedRevision = integer(request.body.expected_revision, "Expected revision");
    if (!Array.isArray(request.body.choice_ids)) throw new ApiError(400, "Choices must be a list.");
    if (request.body.choice_ids.some((choice) => typeof choice !== "string")) {
      throw new ApiError(400, "Every choice id must be text.");
    }
    const choiceIds = [...request.body.choice_ids];
    return idempotent(
      request,
      response,
      "ballot.vote",
      { id: request.params.id, expectedRevision, choiceIds: [...choiceIds].sort() },
      () => {
        const ballot = ballotOrThrow(request.params.id);
        if (ballot.revision !== expectedRevision) {
          throw new ApiError(409, "This ballot changed. Refresh before trying again.", { current_revision: ballot.revision });
        }
        if (ballot.status !== "open") throw new ApiError(409, "This ballot is not accepting votes.");
        if (!db.prepare("SELECT 1 FROM eligibility WHERE ballot_id = ? AND user_id = ?").get(ballot.id, request.user.id)) {
          throw new ApiError(403, "You are not eligible for this ballot.");
        }
        if (db.prepare("SELECT 1 FROM participation WHERE ballot_id = ? AND user_id = ?").get(ballot.id, request.user.id)) {
          throw new ApiError(409, "Your final participation is already recorded.");
        }
        if (!choiceIds.length || new Set(choiceIds).size !== choiceIds.length) {
          throw new ApiError(400, "Choose one or more distinct available options.");
        }
        if (ballot.method === "single" && choiceIds.length !== 1) {
          throw new ApiError(400, "Single-choice ballots require exactly one option.");
        }
        if (ballot.method === "approval" && choiceIds.length > ballot.max_selections) {
          throw new ApiError(400, `Choose no more than ${ballot.max_selections} options.`);
        }
        const valid = db.prepare(
          `SELECT id FROM choices WHERE ballot_id = ? AND id IN (${choiceIds.map(() => "?").join(",")})`
        ).all(ballot.id, ...choiceIds);
        if (valid.length !== choiceIds.length) throw new ApiError(400, "Choose only options from this ballot.");
        const timestamp = now();
        const receiptId = makeId("receipt");
        choiceIds.forEach((choiceId) => {
          db.prepare("INSERT INTO anonymous_votes (id, ballot_id, choice_id, cast_at) VALUES (?, ?, ?, ?)")
            .run(makeId("vote"), ballot.id, choiceId, timestamp);
        });
        db.prepare(
          "INSERT INTO participation (ballot_id, user_id, submitted_at, receipt_id) VALUES (?, ?, ?, ?)"
        ).run(ballot.id, request.user.id, timestamp, receiptId);
        return {
          statusCode: 201,
          body: {
            participated: true,
            receipt_id: receiptId,
            message: "Your final participation was recorded. Your selection remains private.",
          },
        };
      }
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/audit", requireUser, requireRole("coordinator", "observer"), (_request, response) => {
  const events = db.prepare(`
    SELECT id, action, entity_type, entity_id, actor_label, details, created_at
    FROM audit ORDER BY id DESC LIMIT 200
  `).all();
  response.json({ events });
});

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

const crypto = require("crypto");
const path = require("path");
const express = require("express");
const Database = require("better-sqlite3");

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "commonground.db");
const PASSWORD = "CommonGround!2026";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "128kb" }));

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
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
    active INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (group_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS ballots (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'closed', 'published')),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    opened_at TEXT,
    closed_at TEXT,
    published_at TEXT
  );
  CREATE TABLE IF NOT EXISTS choices (
    id TEXT PRIMARY KEY,
    ballot_id TEXT NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
    label TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS eligibility (
    ballot_id TEXT NOT NULL REFERENCES ballots(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    PRIMARY KEY (ballot_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS participation (
    ballot_id TEXT NOT NULL REFERENCES ballots(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    submitted_at TEXT NOT NULL,
    PRIMARY KEY (ballot_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS anonymous_votes (
    id TEXT PRIMARY KEY,
    ballot_id TEXT NOT NULL REFERENCES ballots(id),
    choice_id TEXT NOT NULL REFERENCES choices(id),
    cast_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS turnout_events (
    id TEXT PRIMARY KEY,
    ballot_id TEXT NOT NULL REFERENCES ballots(id),
    event_type TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    actor_id TEXT NOT NULL REFERENCES users(id),
    details TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ballots_status ON ballots(status);
  CREATE INDEX IF NOT EXISTS idx_choices_ballot ON choices(ballot_id);
  CREATE INDEX IF NOT EXISTS idx_votes_ballot ON anonymous_votes(ballot_id);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit(created_at DESC);
`);

function passwordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function passwordMatches(password, salt, expected) {
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

function bootstrap() {
  const row = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  if (row.count > 0) return;

  const seed = db.transaction(() => {
    db.prepare("INSERT INTO groups (id, name) VALUES (?, ?)").run(
      "members-general",
      "General membership"
    );
    const accounts = [
      ["coordinator-ruth", "Ruth Adebayo", "ruth.adebayo@commonground.example", "coordinator"],
      ["observer-arun", "Arun Das", "arun.das@commonground.example", "observer"],
      ["member-leila", "Leila Ward", "leila.ward@commonground.example", "member"],
      ["member-owen", "Owen Park", "owen.park@commonground.example", "member"],
    ];
    const insertUser = db.prepare(
      "INSERT INTO users (id, name, email, role, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const insertMember = db.prepare(
      "INSERT INTO memberships (group_id, user_id, active) VALUES ('members-general', ?, 1)"
    );
    for (const [id, name, email, role] of accounts) {
      const { salt, hash } = passwordRecord(PASSWORD);
      insertUser.run(id, name, email, role, hash, salt);
      if (role === "member") insertMember.run(id);
    }
  });
  seed();
}

bootstrap();

const sessions = new Map();

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function cookies(request) {
  const values = {};
  for (const part of (request.headers.cookie || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    values[part.slice(0, separator).trim()] = decodeURIComponent(
      part.slice(separator + 1).trim()
    );
  }
  return values;
}

function currentUser(request) {
  const sessionId = cookies(request).cg_session;
  const userId = sessionId && sessions.get(sessionId);
  if (!userId) return null;
  return db
    .prepare("SELECT id, name, email, role FROM users WHERE id = ?")
    .get(userId);
}

function requireUser(request, response, next) {
  const user = currentUser(request);
  if (!user) return response.status(401).json({ error: "Please sign in to continue." });
  request.user = user;
  next();
}

function requireRole(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.user.role)) {
      return response.status(403).json({ error: "Your role cannot perform this action." });
    }
    next();
  };
}

function cleanText(value, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function audit(actorId, action, entityType, entityId, details) {
  db.prepare(
    "INSERT INTO audit (action, entity_type, entity_id, actor_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(action, entityType, entityId, actorId, details, now());
}

function choiceRows(ballotId) {
  return db
    .prepare("SELECT id, label FROM choices WHERE ballot_id = ? ORDER BY rowid")
    .all(ballotId);
}

function ballotView(ballot, user) {
  const choices = choiceRows(ballot.id);
  const eligibilityCount = db
    .prepare("SELECT COUNT(*) AS count FROM eligibility WHERE ballot_id = ?")
    .get(ballot.id).count;
  const participationCount = db
    .prepare("SELECT COUNT(*) AS count FROM participation WHERE ballot_id = ?")
    .get(ballot.id).count;
  const view = {
    id: ballot.id,
    title: ballot.title,
    description: ballot.description,
    status: ballot.status,
    created_at: ballot.created_at,
    opened_at: ballot.opened_at,
    closed_at: ballot.closed_at,
    published_at: ballot.published_at,
    choices,
    turnout: {
      eligible: eligibilityCount,
      participated: participationCount,
      percentage: eligibilityCount
        ? Math.round((participationCount / eligibilityCount) * 100)
        : 0,
    },
  };

  if (user.role === "member") {
    view.eligible = Boolean(
      db
        .prepare("SELECT 1 FROM eligibility WHERE ballot_id = ? AND user_id = ?")
        .get(ballot.id, user.id)
    );
    view.participated = Boolean(
      db
        .prepare("SELECT 1 FROM participation WHERE ballot_id = ? AND user_id = ?")
        .get(ballot.id, user.id)
    );
    delete view.turnout;
  }

  if (ballot.status === "published") {
    const total = db
      .prepare("SELECT COUNT(*) AS count FROM anonymous_votes WHERE ballot_id = ?")
      .get(ballot.id).count;
    view.results = db
      .prepare(`
        SELECT c.id, c.label, COUNT(v.id) AS votes
        FROM choices c
        LEFT JOIN anonymous_votes v ON v.choice_id = c.id
        WHERE c.ballot_id = ?
        GROUP BY c.id, c.label, c.rowid
        ORDER BY c.rowid
      `)
      .all(ballot.id)
      .map((result) => ({
        label: result.label,
        votes: result.votes,
        percentage: total ? Math.round((result.votes / total) * 100) : 0,
      }));
    view.total_votes = total;
  }
  return view;
}

function visibleBallots(user) {
  if (user.role !== "member") {
    return db.prepare("SELECT * FROM ballots ORDER BY created_at DESC").all();
  }
  return db
    .prepare(`
      SELECT b.*
      FROM ballots b
      JOIN eligibility e ON e.ballot_id = b.id
      WHERE e.user_id = ? AND b.status IN ('open', 'closed', 'published')
      ORDER BY b.created_at DESC
    `)
    .all(user.id);
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/auth/login", (request, response) => {
  const email = cleanText(request.body.email, 240).toLowerCase();
  const password = typeof request.body.password === "string" ? request.body.password : "";
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !passwordMatches(password, user.password_salt, user.password_hash)) {
    return response.status(401).json({ error: "Email or password is incorrect." });
  }
  const sessionId = crypto.randomBytes(32).toString("hex");
  sessions.set(sessionId, user.id);
  response.setHeader(
    "Set-Cookie",
    `cg_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`
  );
  response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post("/api/auth/logout", requireUser, (request, response) => {
  const sessionId = cookies(request).cg_session;
  if (sessionId) sessions.delete(sessionId);
  response.setHeader(
    "Set-Cookie",
    "cg_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
  );
  response.json({ ok: true });
});

app.get("/api/me", requireUser, (request, response) => {
  response.json({ user: request.user });
});

app.get("/api/ballots", requireUser, (request, response) => {
  response.json({
    ballots: visibleBallots(request.user).map((ballot) => ballotView(ballot, request.user)),
  });
});

app.post(
  "/api/ballots",
  requireUser,
  requireRole("coordinator"),
  (request, response) => {
    const title = cleanText(request.body.title, 120);
    const description = cleanText(request.body.description, 500);
    const choices = Array.isArray(request.body.choices)
      ? request.body.choices.map((value) => cleanText(value, 100)).filter(Boolean)
      : [];
    if (!title) return response.status(400).json({ error: "A ballot title is required." });
    if (choices.length < 2) {
      return response.status(400).json({ error: "Add at least two choices." });
    }
    if (new Set(choices.map((value) => value.toLowerCase())).size !== choices.length) {
      return response.status(400).json({ error: "Choice labels must be unique." });
    }

    const ballotId = id("ballot");
    const createdAt = now();
    db.transaction(() => {
      db.prepare(
        "INSERT INTO ballots (id, group_id, title, description, status, created_by, created_at) VALUES (?, 'members-general', ?, ?, 'draft', ?, ?)"
      ).run(ballotId, title, description, request.user.id, createdAt);
      const insertChoice = db.prepare(
        "INSERT INTO choices (id, ballot_id, label) VALUES (?, ?, ?)"
      );
      for (const label of choices) insertChoice.run(id("choice"), ballotId, label);
      audit(request.user.id, "created", "ballot", ballotId, `Created draft “${title}”`);
    })();
    const ballot = db.prepare("SELECT * FROM ballots WHERE id = ?").get(ballotId);
    response.status(201).json({ ballot: ballotView(ballot, request.user) });
  }
);

app.patch(
  "/api/ballots/:id",
  requireUser,
  requireRole("coordinator"),
  (request, response) => {
    const ballot = db.prepare("SELECT * FROM ballots WHERE id = ?").get(request.params.id);
    if (!ballot) return response.status(404).json({ error: "Ballot not found." });
    if (ballot.status !== "draft") {
      return response.status(409).json({ error: "Only draft ballots can be edited." });
    }
    const title = cleanText(request.body.title, 120);
    const description = cleanText(request.body.description, 500);
    const choices = Array.isArray(request.body.choices)
      ? request.body.choices.map((value) => cleanText(value, 100)).filter(Boolean)
      : [];
    if (!title || choices.length < 2) {
      return response.status(400).json({ error: "A title and at least two choices are required." });
    }
    if (new Set(choices.map((value) => value.toLowerCase())).size !== choices.length) {
      return response.status(400).json({ error: "Choice labels must be unique." });
    }
    db.transaction(() => {
      db.prepare("UPDATE ballots SET title = ?, description = ? WHERE id = ?").run(
        title,
        description,
        ballot.id
      );
      db.prepare("DELETE FROM choices WHERE ballot_id = ?").run(ballot.id);
      const insertChoice = db.prepare(
        "INSERT INTO choices (id, ballot_id, label) VALUES (?, ?, ?)"
      );
      for (const label of choices) insertChoice.run(id("choice"), ballot.id, label);
      audit(request.user.id, "edited", "ballot", ballot.id, `Updated draft “${title}”`);
    })();
    const updated = db.prepare("SELECT * FROM ballots WHERE id = ?").get(ballot.id);
    response.json({ ballot: ballotView(updated, request.user) });
  }
);

app.post(
  "/api/ballots/:id/open",
  requireUser,
  requireRole("coordinator"),
  (request, response) => {
    const ballot = db.prepare("SELECT * FROM ballots WHERE id = ?").get(request.params.id);
    if (!ballot) return response.status(404).json({ error: "Ballot not found." });
    if (ballot.status !== "draft") {
      return response.status(409).json({ error: "Only a draft ballot can be opened." });
    }
    const count = db
      .prepare("SELECT COUNT(*) AS count FROM choices WHERE ballot_id = ?")
      .get(ballot.id).count;
    if (count < 2) return response.status(400).json({ error: "Add at least two choices." });

    db.transaction(() => {
      db.prepare(`
        INSERT INTO eligibility (ballot_id, user_id)
        SELECT ?, user_id FROM memberships WHERE group_id = ? AND active = 1
      `).run(ballot.id, ballot.group_id);
      db.prepare("UPDATE ballots SET status = 'open', opened_at = ? WHERE id = ?").run(
        now(),
        ballot.id
      );
      audit(
        request.user.id,
        "opened",
        "ballot",
        ballot.id,
        "Opened ballot and captured eligibility snapshot"
      );
    })();
    const updated = db.prepare("SELECT * FROM ballots WHERE id = ?").get(ballot.id);
    response.json({ ballot: ballotView(updated, request.user) });
  }
);

app.post("/api/ballots/:id/vote", requireUser, requireRole("member"), (request, response) => {
  const ballot = db.prepare("SELECT * FROM ballots WHERE id = ?").get(request.params.id);
  if (!ballot) return response.status(404).json({ error: "Ballot not found." });
  if (ballot.status !== "open") {
    return response.status(409).json({ error: "This ballot is not accepting votes." });
  }
  const eligible = db
    .prepare("SELECT 1 FROM eligibility WHERE ballot_id = ? AND user_id = ?")
    .get(ballot.id, request.user.id);
  if (!eligible) return response.status(403).json({ error: "You are not eligible for this ballot." });
  const participated = db
    .prepare("SELECT 1 FROM participation WHERE ballot_id = ? AND user_id = ?")
    .get(ballot.id, request.user.id);
  if (participated) {
    return response.status(409).json({ error: "Your participation is already recorded." });
  }
  const choiceId = cleanText(request.body.choice_id, 100);
  const choice = db
    .prepare("SELECT id FROM choices WHERE id = ? AND ballot_id = ?")
    .get(choiceId, ballot.id);
  if (!choice) return response.status(400).json({ error: "Choose an available option." });

  try {
    db.transaction(() => {
      const timestamp = now();
      db.prepare(
        "INSERT INTO anonymous_votes (id, ballot_id, choice_id, cast_at) VALUES (?, ?, ?, ?)"
      ).run(id("vote"), ballot.id, choice.id, timestamp);
      db.prepare(
        "INSERT INTO participation (ballot_id, user_id, submitted_at) VALUES (?, ?, ?)"
      ).run(ballot.id, request.user.id, timestamp);
      db.prepare(
        "INSERT INTO turnout_events (id, ballot_id, event_type, created_at) VALUES (?, ?, 'ballot_received', ?)"
      ).run(id("turnout"), ballot.id, timestamp);
    })();
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) {
      return response.status(409).json({ error: "Your participation is already recorded." });
    }
    throw error;
  }
  response.status(201).json({
    participated: true,
    message: "Your participation was recorded. Your selection remains private.",
  });
});

app.post(
  "/api/ballots/:id/close",
  requireUser,
  requireRole("coordinator"),
  (request, response) => {
    const ballot = db.prepare("SELECT * FROM ballots WHERE id = ?").get(request.params.id);
    if (!ballot) return response.status(404).json({ error: "Ballot not found." });
    if (ballot.status !== "open") {
      return response.status(409).json({ error: "Only an open ballot can be closed." });
    }
    db.transaction(() => {
      db.prepare("UPDATE ballots SET status = 'closed', closed_at = ? WHERE id = ?").run(
        now(),
        ballot.id
      );
      audit(request.user.id, "closed", "ballot", ballot.id, "Closed voting");
    })();
    const updated = db.prepare("SELECT * FROM ballots WHERE id = ?").get(ballot.id);
    response.json({ ballot: ballotView(updated, request.user) });
  }
);

app.post(
  "/api/ballots/:id/publish",
  requireUser,
  requireRole("coordinator"),
  (request, response) => {
    const ballot = db.prepare("SELECT * FROM ballots WHERE id = ?").get(request.params.id);
    if (!ballot) return response.status(404).json({ error: "Ballot not found." });
    if (ballot.status !== "closed") {
      return response.status(409).json({ error: "Only a closed ballot can be published." });
    }
    db.transaction(() => {
      db.prepare("UPDATE ballots SET status = 'published', published_at = ? WHERE id = ?").run(
        now(),
        ballot.id
      );
      audit(request.user.id, "published", "ballot", ballot.id, "Published anonymous results");
    })();
    const updated = db.prepare("SELECT * FROM ballots WHERE id = ?").get(ballot.id);
    response.json({ ballot: ballotView(updated, request.user) });
  }
);

app.get("/api/audit", requireUser, requireRole("coordinator", "observer"), (_request, response) => {
  const events = db
    .prepare(`
      SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at,
             u.name AS actor_name, u.role AS actor_role
      FROM audit a
      JOIN users u ON u.id = a.actor_id
      ORDER BY a.id DESC
      LIMIT 200
    `)
    .all();
  response.json({ events });
});

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Common Ground listening on ${PORT}`);
});

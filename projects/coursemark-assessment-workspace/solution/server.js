const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const Database = require("better-sqlite3");

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "coursemark.db");
const PASSWORD = "Coursemark!2026";
const SEED_CANDIDATES = [
  process.env.SEED_PATH,
  "/assets/artifacts/coursemark_seed.json",
  path.join(__dirname, "seed_data.json"),
  path.join(__dirname, "src", "seed_data.json"),
].filter(Boolean);

const seedPath = SEED_CANDIDATES.find((candidate) => fs.existsSync(candidate));
if (!seedPath) throw new Error("Coursemark seed data was not found.");
const seedData = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const REFERENCE_MOMENT = seedData.reference_moment;

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('instructor', 'teaching_assistant', 'student')),
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    instructor_id TEXT NOT NULL REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS enrollments (
    course_id TEXT NOT NULL REFERENCES courses(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    PRIMARY KEY (course_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS accommodations (
    course_id TEXT NOT NULL REFERENCES courses(id),
    student_id TEXT NOT NULL REFERENCES users(id),
    extra_time_minutes INTEGER NOT NULL DEFAULT 0,
    deadline_extension_minutes INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (course_id, student_id)
  );
  CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
    opens_at TEXT NOT NULL,
    due_at TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    max_attempts INTEGER NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('multiple_choice', 'written')),
    prompt TEXT NOT NULL,
    options_json TEXT,
    answer TEXT,
    points REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rubric_criteria (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    max_points REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL REFERENCES assessments(id),
    student_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted', 'graded')),
    started_at TEXT NOT NULL,
    submitted_at TEXT,
    assigned_grader_id TEXT REFERENCES users(id),
    feedback_status TEXT NOT NULL CHECK (feedback_status IN ('hidden', 'released')),
    objective_score REAL,
    rubric_score REAL,
    UNIQUE (assessment_id, student_id, id)
  );
  CREATE TABLE IF NOT EXISTS answers (
    attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES items(id),
    value TEXT NOT NULL,
    PRIMARY KEY (attempt_id, item_id)
  );
  CREATE TABLE IF NOT EXISTS rubric_grades (
    attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    criterion_id TEXT NOT NULL REFERENCES rubric_criteria(id),
    score REAL NOT NULL,
    feedback TEXT NOT NULL DEFAULT '',
    graded_by TEXT NOT NULL REFERENCES users(id),
    graded_at TEXT NOT NULL,
    PRIMARY KEY (attempt_id, criterion_id)
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
  CREATE INDEX IF NOT EXISTS idx_assessments_course ON assessments(course_id);
  CREATE INDEX IF NOT EXISTS idx_attempts_assessment ON attempts(assessment_id);
  CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit(created_at DESC);
`);

function passwordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return {
    salt,
    hash: crypto.scryptSync(password, salt, 64).toString("hex"),
  };
}

function passwordMatches(password, salt, expected) {
  return crypto.timingSafeEqual(
    crypto.scryptSync(password, salt, 64),
    Buffer.from(expected, "hex")
  );
}

function bootstrap() {
  if (db.prepare("SELECT COUNT(*) AS count FROM users").get().count) return;
  db.transaction(() => {
    db.prepare("INSERT INTO settings (key, value) VALUES ('reference_moment', ?)").run(
      REFERENCE_MOMENT
    );
    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, role, password_hash, password_salt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const user of seedData.users) {
      const { salt, hash } = passwordRecord(PASSWORD);
      insertUser.run(user.id, user.name, user.email, user.role, hash, salt);
    }

    const insertCourse = db.prepare(
      "INSERT INTO courses (id, title, instructor_id) VALUES (?, ?, ?)"
    );
    for (const course of seedData.courses) {
      insertCourse.run(course.id, course.title, course.instructor_id);
    }
    const insertEnrollment = db.prepare(
      "INSERT INTO enrollments (course_id, user_id, kind) VALUES (?, ?, ?)"
    );
    for (const enrollment of seedData.enrollments) {
      insertEnrollment.run(enrollment.course_id, enrollment.user_id, enrollment.kind);
    }
    const insertAccommodation = db.prepare(`
      INSERT INTO accommodations
        (course_id, student_id, extra_time_minutes, deadline_extension_minutes)
      VALUES (?, ?, ?, ?)
    `);
    for (const accommodation of seedData.accommodations) {
      insertAccommodation.run(
        accommodation.course_id,
        accommodation.student_id,
        accommodation.extra_time_minutes,
        accommodation.deadline_extension_minutes
      );
    }
    const insertAssessment = db.prepare(`
      INSERT INTO assessments
        (id, course_id, title, status, opens_at, due_at, duration_minutes, max_attempts, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const assessment of seedData.assessments) {
      insertAssessment.run(
        assessment.id,
        assessment.course_id,
        assessment.title,
        assessment.status,
        assessment.opens_at,
        assessment.due_at,
        assessment.duration_minutes,
        assessment.max_attempts,
        seedData.courses.find((course) => course.id === assessment.course_id).instructor_id
      );
    }
    const insertItem = db.prepare(`
      INSERT INTO items
        (id, assessment_id, kind, prompt, options_json, answer, points)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of seedData.items) {
      insertItem.run(
        item.id,
        item.assessment_id,
        item.kind,
        item.prompt,
        item.options ? JSON.stringify(item.options) : null,
        item.answer || null,
        item.points
      );
    }
    const insertCriterion = db.prepare(
      "INSERT INTO rubric_criteria (id, item_id, label, max_points) VALUES (?, ?, ?, ?)"
    );
    for (const rubric of seedData.rubrics) {
      for (const criterion of rubric.criteria) {
        insertCriterion.run(
          criterion.id,
          rubric.item_id,
          criterion.label,
          criterion.max_points
        );
      }
    }
    const insertAttempt = db.prepare(`
      INSERT INTO attempts
        (id, assessment_id, student_id, status, started_at, submitted_at,
         assigned_grader_id, feedback_status, objective_score, rubric_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const attempt of seedData.attempts) {
      insertAttempt.run(
        attempt.id,
        attempt.assessment_id,
        attempt.student_id,
        attempt.status,
        attempt.started_at,
        attempt.submitted_at || null,
        attempt.assigned_grader_id || null,
        attempt.feedback_status,
        attempt.objective_score ?? null,
        attempt.rubric_score ?? null
      );
    }
    const insertAnswer = db.prepare(
      "INSERT INTO answers (attempt_id, item_id, value) VALUES (?, ?, ?)"
    );
    for (const answer of seedData.answers) {
      insertAnswer.run(answer.attempt_id, answer.item_id, String(answer.value));
    }
  })();

  for (const attempt of db
    .prepare("SELECT * FROM attempts WHERE status IN ('submitted', 'graded')")
    .all()) {
    if (attempt.objective_score == null) {
      db.prepare("UPDATE attempts SET objective_score = ? WHERE id = ?").run(
        objectiveScore(attempt.id),
        attempt.id
      );
    }
  }
}

function referenceNow() {
  return db
    .prepare("SELECT value FROM settings WHERE key = 'reference_moment'")
    .get().value;
}

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function cleanText(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function addMinutes(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function earlierIso(left, right) {
  return new Date(left) <= new Date(right) ? left : right;
}

function accommodation(courseId, studentId) {
  return (
    db
      .prepare(
        "SELECT extra_time_minutes, deadline_extension_minutes FROM accommodations WHERE course_id = ? AND student_id = ?"
      )
      .get(courseId, studentId) || {
      extra_time_minutes: 0,
      deadline_extension_minutes: 0,
    }
  );
}

function effectiveTiming(assessment, studentId, startedAt = null) {
  const adjustment = accommodation(assessment.course_id, studentId);
  const durationMinutes = assessment.duration_minutes + adjustment.extra_time_minutes;
  const dueAt = addMinutes(assessment.due_at, adjustment.deadline_extension_minutes);
  return {
    duration_minutes: durationMinutes,
    due_at: dueAt,
    extra_time_minutes: adjustment.extra_time_minutes,
    deadline_extension_minutes: adjustment.deadline_extension_minutes,
    expires_at: startedAt
      ? earlierIso(addMinutes(startedAt, durationMinutes), dueAt)
      : null,
  };
}

function objectiveScore(attemptId) {
  const rows = db
    .prepare(`
      SELECT i.points, i.answer, a.value
      FROM attempts t
      JOIN items i ON i.assessment_id = t.assessment_id AND i.kind = 'multiple_choice'
      LEFT JOIN answers a ON a.attempt_id = t.id AND a.item_id = i.id
      WHERE t.id = ?
    `)
    .all(attemptId);
  return rows.reduce(
    (sum, row) => sum + (row.value === row.answer ? Number(row.points) : 0),
    0
  );
}

function audit(actorId, action, entityType, entityId, details) {
  db.prepare(`
    INSERT INTO audit (action, entity_type, entity_id, actor_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(action, entityType, entityId, actorId, details, referenceNow());
}

function assessmentItems(assessmentId) {
  return db
    .prepare(
      "SELECT id, kind, prompt, options_json, points FROM items WHERE assessment_id = ? ORDER BY rowid"
    )
    .all(assessmentId)
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      prompt: item.prompt,
      options: item.options_json ? JSON.parse(item.options_json) : null,
      points: item.points,
      rubric: db
        .prepare(
          "SELECT id, label, max_points FROM rubric_criteria WHERE item_id = ? ORDER BY rowid"
        )
        .all(item.id),
    }));
}

function submitAttempt(attempt, actorId, automatic = false) {
  if (attempt.status !== "in_progress") return attempt;
  const score = objectiveScore(attempt.id);
  const rubricCount = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM rubric_criteria r
      JOIN items i ON i.id = r.item_id
      WHERE i.assessment_id = ?
    `)
    .get(attempt.assessment_id).count;
  const nextStatus = rubricCount ? "submitted" : "graded";
  db.prepare(`
    UPDATE attempts
    SET status = ?, submitted_at = ?, objective_score = ?, rubric_score = 0
    WHERE id = ?
  `).run(nextStatus, referenceNow(), score, attempt.id);
  audit(
    actorId,
    automatic ? "auto_submitted" : "submitted",
    "attempt",
    attempt.id,
    automatic ? "Submitted at the effective expiry" : "Student submitted attempt"
  );
  return db.prepare("SELECT * FROM attempts WHERE id = ?").get(attempt.id);
}

function ensureAttemptCurrent(attempt) {
  if (attempt.status !== "in_progress") return attempt;
  const assessment = db
    .prepare("SELECT * FROM assessments WHERE id = ?")
    .get(attempt.assessment_id);
  const timing = effectiveTiming(assessment, attempt.student_id, attempt.started_at);
  if (new Date(referenceNow()) >= new Date(timing.expires_at)) {
    return db.transaction(() => submitAttempt(attempt, attempt.student_id, true))();
  }
  return attempt;
}

bootstrap();

const sessions = new Map();

function cookies(request) {
  const result = {};
  for (const part of (request.headers.cookie || "").split(";")) {
    const position = part.indexOf("=");
    if (position > -1) {
      result[part.slice(0, position).trim()] = decodeURIComponent(
        part.slice(position + 1).trim()
      );
    }
  }
  return result;
}

function currentUser(request) {
  const sessionId = cookies(request).cm_session;
  const userId = sessionId && sessions.get(sessionId);
  return userId
    ? db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(userId)
    : null;
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

function courseVisible(courseId, user) {
  if (user.role === "instructor") {
    return Boolean(
      db.prepare("SELECT 1 FROM courses WHERE id = ? AND instructor_id = ?").get(
        courseId,
        user.id
      )
    );
  }
  return Boolean(
    db
      .prepare("SELECT 1 FROM enrollments WHERE course_id = ? AND user_id = ?")
      .get(courseId, user.id)
  );
}

function assessmentView(assessment, user) {
  const itemCount = db
    .prepare("SELECT COUNT(*) AS count FROM items WHERE assessment_id = ?")
    .get(assessment.id).count;
  const view = {
    id: assessment.id,
    course_id: assessment.course_id,
    title: assessment.title,
    status: assessment.status,
    opens_at: assessment.opens_at,
    due_at: assessment.due_at,
    duration_minutes: assessment.duration_minutes,
    max_attempts: assessment.max_attempts,
    item_count: itemCount,
  };
  if (user.role === "student") {
    const timing = effectiveTiming(assessment, user.id);
    const attempt = db
      .prepare(
        "SELECT * FROM attempts WHERE assessment_id = ? AND student_id = ? ORDER BY rowid DESC LIMIT 1"
      )
      .get(assessment.id, user.id);
    view.effective_duration_minutes = timing.duration_minutes;
    view.effective_due_at = timing.due_at;
    view.extra_time_minutes = timing.extra_time_minutes;
    view.deadline_extension_minutes = timing.deadline_extension_minutes;
    view.attempt = attempt ? attemptView(ensureAttemptCurrent(attempt), user) : null;
    const current = new Date(referenceNow());
    view.can_start =
      assessment.status === "published" &&
      current >= new Date(assessment.opens_at) &&
      current <= new Date(timing.due_at) &&
      !attempt;
  }
  return view;
}

function attemptView(rawAttempt, user) {
  const attempt =
    rawAttempt.status === "in_progress" ? ensureAttemptCurrent(rawAttempt) : rawAttempt;
  const assessment = db
    .prepare("SELECT * FROM assessments WHERE id = ?")
    .get(attempt.assessment_id);
  const student = db
    .prepare("SELECT id, name, email FROM users WHERE id = ?")
    .get(attempt.student_id);
  const items = assessmentItems(attempt.assessment_id);
  const answers = db
    .prepare("SELECT item_id, value FROM answers WHERE attempt_id = ?")
    .all(attempt.id);
  const grades = db
    .prepare(`
      SELECT g.criterion_id, g.score, g.feedback, g.graded_by, g.graded_at,
             r.label, r.max_points
      FROM rubric_grades g
      JOIN rubric_criteria r ON r.id = g.criterion_id
      WHERE g.attempt_id = ?
      ORDER BY r.rowid
    `)
    .all(attempt.id);
  const timing = effectiveTiming(assessment, attempt.student_id, attempt.started_at);
  const view = {
    id: attempt.id,
    assessment_id: attempt.assessment_id,
    assessment_title: assessment.title,
    student,
    status: attempt.status,
    started_at: attempt.started_at,
    submitted_at: attempt.submitted_at,
    feedback_status: attempt.feedback_status,
    assigned_grader_id: attempt.assigned_grader_id,
    expires_at: timing.expires_at,
    effective_duration_minutes: timing.duration_minutes,
    items,
    answers,
  };
  if (user.role !== "student" || attempt.feedback_status === "released") {
    view.objective_score = attempt.objective_score;
    view.rubric_score = attempt.rubric_score;
    view.total_score =
      attempt.objective_score == null
        ? null
        : Number(attempt.objective_score) + Number(attempt.rubric_score || 0);
    view.grades = grades;
  }
  return view;
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, reference_moment: REFERENCE_MOMENT });
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
    `cm_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`
  );
  response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post("/api/auth/logout", requireUser, (request, response) => {
  const sessionId = cookies(request).cm_session;
  if (sessionId) sessions.delete(sessionId);
  response.setHeader(
    "Set-Cookie",
    "cm_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
  );
  response.json({ ok: true });
});

app.get("/api/me", requireUser, (request, response) => {
  response.json({ user: request.user, reference_moment: referenceNow() });
});

app.get("/api/courses", requireUser, (request, response) => {
  const rows =
    request.user.role === "instructor"
      ? db.prepare("SELECT * FROM courses WHERE instructor_id = ?").all(request.user.id)
      : db
          .prepare(
            "SELECT c.* FROM courses c JOIN enrollments e ON e.course_id = c.id WHERE e.user_id = ?"
          )
          .all(request.user.id);
  const courses = rows.map((course) => ({
    ...course,
    assessment_count: db
      .prepare(
        `SELECT COUNT(*) AS count FROM assessments WHERE course_id = ? ${
          request.user.role === "student" ? "AND status = 'published'" : ""
        }`
      )
      .get(course.id).count,
    student_count: db
      .prepare(
        "SELECT COUNT(*) AS count FROM enrollments WHERE course_id = ? AND kind = 'student'"
      )
      .get(course.id).count,
  }));
  response.json({ courses });
});

app.get("/api/assessments", requireUser, (request, response) => {
  const rows = db
    .prepare(`
      SELECT a.*
      FROM assessments a
      JOIN courses c ON c.id = a.course_id
      LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = ?
      WHERE (c.instructor_id = ? OR e.user_id IS NOT NULL)
        ${request.user.role === "student" ? "AND a.status = 'published'" : ""}
      ORDER BY a.opens_at DESC
    `)
    .all(request.user.id, request.user.id);
  response.json({ assessments: rows.map((row) => assessmentView(row, request.user)) });
});

app.get("/api/assessments/:id/items", requireUser, (request, response) => {
  const assessment = db
    .prepare("SELECT * FROM assessments WHERE id = ?")
    .get(request.params.id);
  if (
    !assessment ||
    !courseVisible(assessment.course_id, request.user) ||
    (request.user.role === "student" && assessment.status !== "published")
  ) {
    return response.status(404).json({ error: "Assessment not found." });
  }
  response.json({ items: assessmentItems(assessment.id) });
});

app.post(
  "/api/assessments",
  requireUser,
  requireRole("instructor"),
  (request, response) => {
    const courseId = cleanText(request.body.course_id, 80);
    const title = cleanText(request.body.title, 140);
    const opensAt = cleanText(request.body.opens_at, 40);
    const dueAt = cleanText(request.body.due_at, 40);
    const duration = Number(request.body.duration_minutes);
    const maxAttempts = Number(request.body.max_attempts || 1);
    if (!courseVisible(courseId, request.user)) {
      return response.status(404).json({ error: "Course not found." });
    }
    if (
      !title ||
      !Number.isFinite(Date.parse(opensAt)) ||
      !Number.isFinite(Date.parse(dueAt)) ||
      new Date(opensAt) >= new Date(dueAt) ||
      !Number.isInteger(duration) ||
      duration <= 0 ||
      !Number.isInteger(maxAttempts) ||
      maxAttempts <= 0
    ) {
      return response.status(400).json({ error: "Provide valid assessment details." });
    }
    const assessmentId = id("assessment");
    db.prepare(`
      INSERT INTO assessments
        (id, course_id, title, status, opens_at, due_at, duration_minutes, max_attempts, created_by)
      VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)
    `).run(
      assessmentId,
      courseId,
      title,
      new Date(opensAt).toISOString(),
      new Date(dueAt).toISOString(),
      duration,
      maxAttempts,
      request.user.id
    );
    response.status(201).json({
      assessment: assessmentView(
        db.prepare("SELECT * FROM assessments WHERE id = ?").get(assessmentId),
        request.user
      ),
    });
  }
);

app.post(
  "/api/assessments/:id/items",
  requireUser,
  requireRole("instructor"),
  (request, response) => {
    const assessment = db
      .prepare("SELECT * FROM assessments WHERE id = ?")
      .get(request.params.id);
    if (!assessment || !courseVisible(assessment.course_id, request.user)) {
      return response.status(404).json({ error: "Assessment not found." });
    }
    if (assessment.status !== "draft") {
      return response.status(409).json({ error: "Published assessments cannot be edited." });
    }
    const kind = request.body.kind === "written" ? "written" : "multiple_choice";
    const prompt = cleanText(request.body.prompt, 500);
    const points = Number(request.body.points);
    const options =
      kind === "multiple_choice" && Array.isArray(request.body.options)
        ? request.body.options.map((value) => cleanText(value, 160)).filter(Boolean)
        : null;
    const answer = kind === "multiple_choice" ? cleanText(request.body.answer, 160) : null;
    if (
      !prompt ||
      !Number.isFinite(points) ||
      points <= 0 ||
      (kind === "multiple_choice" &&
        (options.length < 2 || !options.includes(answer)))
    ) {
      return response.status(400).json({ error: "Provide a valid question and point value." });
    }
    const itemId = id("item");
    db.prepare(`
      INSERT INTO items
        (id, assessment_id, kind, prompt, options_json, answer, points)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      itemId,
      assessment.id,
      kind,
      prompt,
      options ? JSON.stringify(options) : null,
      answer,
      points
    );
    if (kind === "written") {
      const criterionLabel = cleanText(request.body.criterion_label, 160) || "Response quality";
      db.prepare(
        "INSERT INTO rubric_criteria (id, item_id, label, max_points) VALUES (?, ?, ?, ?)"
      ).run(id("criterion"), itemId, criterionLabel, points);
    }
    response.status(201).json({ items: assessmentItems(assessment.id) });
  }
);

app.post(
  "/api/assessments/:id/publish",
  requireUser,
  requireRole("instructor"),
  (request, response) => {
    const assessment = db
      .prepare("SELECT * FROM assessments WHERE id = ?")
      .get(request.params.id);
    if (!assessment || !courseVisible(assessment.course_id, request.user)) {
      return response.status(404).json({ error: "Assessment not found." });
    }
    if (assessment.status !== "draft") {
      return response.status(409).json({ error: "Only a draft can be published." });
    }
    const count = db
      .prepare("SELECT COUNT(*) AS count FROM items WHERE assessment_id = ?")
      .get(assessment.id).count;
    if (!count || assessment.duration_minutes <= 0) {
      return response.status(400).json({
        error: "Add at least one question and a positive duration before publishing.",
      });
    }
    db.transaction(() => {
      db.prepare("UPDATE assessments SET status = 'published' WHERE id = ?").run(
        assessment.id
      );
      audit(
        request.user.id,
        "published",
        "assessment",
        assessment.id,
        `Published “${assessment.title}”`
      );
    })();
    response.json({
      assessment: assessmentView(
        db.prepare("SELECT * FROM assessments WHERE id = ?").get(assessment.id),
        request.user
      ),
    });
  }
);

app.post(
  "/api/assessments/:id/start",
  requireUser,
  requireRole("student"),
  (request, response) => {
    const assessment = db
      .prepare("SELECT * FROM assessments WHERE id = ?")
      .get(request.params.id);
    if (
      !assessment ||
      assessment.status !== "published" ||
      !courseVisible(assessment.course_id, request.user)
    ) {
      return response.status(404).json({ error: "Assessment not found." });
    }
    const active = db
      .prepare(
        "SELECT * FROM attempts WHERE assessment_id = ? AND student_id = ? AND status = 'in_progress'"
      )
      .get(assessment.id, request.user.id);
    if (active) return response.status(409).json({ error: "An attempt is already active." });
    const used = db
      .prepare("SELECT COUNT(*) AS count FROM attempts WHERE assessment_id = ? AND student_id = ?")
      .get(assessment.id, request.user.id).count;
    if (used >= assessment.max_attempts) {
      return response.status(409).json({ error: "No attempts remain." });
    }
    const timing = effectiveTiming(assessment, request.user.id);
    const current = new Date(referenceNow());
    if (current < new Date(assessment.opens_at) || current > new Date(timing.due_at)) {
      return response.status(409).json({ error: "This assessment is outside its available window." });
    }
    const attemptId = id("attempt");
    const grader = db
      .prepare(
        "SELECT u.id FROM users u JOIN enrollments e ON e.user_id = u.id WHERE e.course_id = ? AND u.role = 'teaching_assistant' LIMIT 1"
      )
      .get(assessment.course_id);
    db.prepare(`
      INSERT INTO attempts
        (id, assessment_id, student_id, status, started_at, assigned_grader_id, feedback_status)
      VALUES (?, ?, ?, 'in_progress', ?, ?, 'hidden')
    `).run(attemptId, assessment.id, request.user.id, referenceNow(), grader?.id || null);
    response.status(201).json({
      attempt: attemptView(
        db.prepare("SELECT * FROM attempts WHERE id = ?").get(attemptId),
        request.user
      ),
    });
  }
);

app.get("/api/attempts", requireUser, (request, response) => {
  let rows;
  if (request.user.role === "student") {
    rows = db
      .prepare("SELECT * FROM attempts WHERE student_id = ? ORDER BY started_at DESC")
      .all(request.user.id);
  } else if (request.user.role === "teaching_assistant") {
    rows = db
      .prepare(
        "SELECT * FROM attempts WHERE assigned_grader_id = ? ORDER BY started_at DESC"
      )
      .all(request.user.id);
  } else {
    rows = db
      .prepare(`
        SELECT t.*
        FROM attempts t
        JOIN assessments a ON a.id = t.assessment_id
        JOIN courses c ON c.id = a.course_id
        WHERE c.instructor_id = ?
        ORDER BY t.started_at DESC
      `)
      .all(request.user.id);
  }
  response.json({ attempts: rows.map((row) => attemptView(row, request.user)) });
});

app.patch(
  "/api/attempts/:id/answers",
  requireUser,
  requireRole("student"),
  (request, response) => {
    let attempt = db.prepare("SELECT * FROM attempts WHERE id = ?").get(request.params.id);
    if (!attempt || attempt.student_id !== request.user.id) {
      return response.status(404).json({ error: "Attempt not found." });
    }
    attempt = ensureAttemptCurrent(attempt);
    if (attempt.status !== "in_progress") {
      return response.status(409).json({ error: "This attempt no longer accepts answers." });
    }
    const supplied = Array.isArray(request.body.answers) ? request.body.answers : [];
    const validItems = new Set(
      db
        .prepare("SELECT id FROM items WHERE assessment_id = ?")
        .all(attempt.assessment_id)
        .map((item) => item.id)
    );
    if (!supplied.length || supplied.some((answer) => !validItems.has(answer.item_id))) {
      return response.status(400).json({ error: "One or more answers are invalid." });
    }
    const upsert = db.prepare(`
      INSERT INTO answers (attempt_id, item_id, value) VALUES (?, ?, ?)
      ON CONFLICT(attempt_id, item_id) DO UPDATE SET value = excluded.value
    `);
    db.transaction(() => {
      for (const answer of supplied) {
        upsert.run(attempt.id, answer.item_id, cleanText(answer.value, 4000));
      }
    })();
    response.json({ attempt: attemptView(attempt, request.user) });
  }
);

app.post(
  "/api/attempts/:id/submit",
  requireUser,
  requireRole("student"),
  (request, response) => {
    let attempt = db.prepare("SELECT * FROM attempts WHERE id = ?").get(request.params.id);
    if (!attempt || attempt.student_id !== request.user.id) {
      return response.status(404).json({ error: "Attempt not found." });
    }
    attempt = ensureAttemptCurrent(attempt);
    if (attempt.status !== "in_progress") {
      return response.status(409).json({ error: "This attempt is already submitted." });
    }
    const submitted = db.transaction(() =>
      submitAttempt(attempt, request.user.id, false)
    )();
    response.json({ attempt: attemptView(submitted, request.user) });
  }
);

app.put(
  "/api/attempts/:id/grades/:criterionId",
  requireUser,
  requireRole("instructor", "teaching_assistant"),
  (request, response) => {
    const attempt = db.prepare("SELECT * FROM attempts WHERE id = ?").get(request.params.id);
    if (!attempt) return response.status(404).json({ error: "Submission not found." });
    const assessment = db
      .prepare("SELECT * FROM assessments WHERE id = ?")
      .get(attempt.assessment_id);
    if (!courseVisible(assessment.course_id, request.user)) {
      return response.status(404).json({ error: "Submission not found." });
    }
    if (
      request.user.role === "teaching_assistant" &&
      attempt.assigned_grader_id !== request.user.id
    ) {
      return response.status(403).json({ error: "This submission is not assigned to you." });
    }
    if (attempt.status === "in_progress") {
      return response.status(409).json({ error: "The attempt has not been submitted." });
    }
    if (attempt.feedback_status === "released") {
      return response.status(409).json({ error: "Released feedback is immutable." });
    }
    const criterion = db
      .prepare(`
        SELECT r.*
        FROM rubric_criteria r
        JOIN items i ON i.id = r.item_id
        WHERE r.id = ? AND i.assessment_id = ?
      `)
      .get(request.params.criterionId, assessment.id);
    const score = Number(request.body.score);
    const feedback = cleanText(request.body.feedback, 1000);
    if (!criterion || !Number.isFinite(score) || score < 0 || score > criterion.max_points) {
      return response.status(400).json({ error: "Score must be within the rubric maximum." });
    }
    db.transaction(() => {
      db.prepare(`
        INSERT INTO rubric_grades
          (attempt_id, criterion_id, score, feedback, graded_by, graded_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(attempt_id, criterion_id) DO UPDATE SET
          score = excluded.score,
          feedback = excluded.feedback,
          graded_by = excluded.graded_by,
          graded_at = excluded.graded_at
      `).run(
        attempt.id,
        criterion.id,
        score,
        feedback,
        request.user.id,
        referenceNow()
      );
      const expected = db
        .prepare(`
          SELECT COUNT(*) AS count
          FROM rubric_criteria r
          JOIN items i ON i.id = r.item_id
          WHERE i.assessment_id = ?
        `)
        .get(assessment.id).count;
      const actual = db
        .prepare("SELECT COUNT(*) AS count FROM rubric_grades WHERE attempt_id = ?")
        .get(attempt.id).count;
      const rubricScore = db
        .prepare("SELECT COALESCE(SUM(score), 0) AS score FROM rubric_grades WHERE attempt_id = ?")
        .get(attempt.id).score;
      db.prepare("UPDATE attempts SET rubric_score = ?, status = ? WHERE id = ?").run(
        rubricScore,
        expected === actual ? "graded" : "submitted",
        attempt.id
      );
      audit(
        request.user.id,
        "graded",
        "attempt",
        attempt.id,
        `Scored rubric criterion “${criterion.label}”`
      );
    })();
    response.json({
      attempt: attemptView(
        db.prepare("SELECT * FROM attempts WHERE id = ?").get(attempt.id),
        request.user
      ),
    });
  }
);

app.post(
  "/api/attempts/:id/release",
  requireUser,
  requireRole("instructor"),
  (request, response) => {
    const attempt = db.prepare("SELECT * FROM attempts WHERE id = ?").get(request.params.id);
    if (!attempt) return response.status(404).json({ error: "Submission not found." });
    const assessment = db
      .prepare("SELECT * FROM assessments WHERE id = ?")
      .get(attempt.assessment_id);
    if (!courseVisible(assessment.course_id, request.user)) {
      return response.status(404).json({ error: "Submission not found." });
    }
    if (attempt.status !== "graded") {
      return response.status(409).json({ error: "Complete grading before release." });
    }
    if (attempt.feedback_status === "released") {
      return response.status(409).json({ error: "Feedback is already released." });
    }
    db.transaction(() => {
      db.prepare("UPDATE attempts SET feedback_status = 'released' WHERE id = ?").run(
        attempt.id
      );
      audit(
        request.user.id,
        "released",
        "attempt",
        attempt.id,
        `Released feedback for ${attempt.id}`
      );
    })();
    response.json({
      attempt: attemptView(
        db.prepare("SELECT * FROM attempts WHERE id = ?").get(attempt.id),
        request.user
      ),
    });
  }
);

app.get("/api/audit", requireUser, (request, response) => {
  let rows;
  if (request.user.role === "instructor") {
    rows = db
      .prepare(`
        SELECT a.*, u.name AS actor_name, u.role AS actor_role
        FROM audit a JOIN users u ON u.id = a.actor_id
        ORDER BY a.id DESC LIMIT 200
      `)
      .all();
  } else if (request.user.role === "teaching_assistant") {
    rows = db
      .prepare(`
        SELECT a.*, u.name AS actor_name, u.role AS actor_role
        FROM audit a JOIN users u ON u.id = a.actor_id
        WHERE a.actor_id = ? OR (a.entity_type = 'attempt' AND a.entity_id IN (
          SELECT id FROM attempts WHERE assigned_grader_id = ?
        ))
        ORDER BY a.id DESC LIMIT 200
      `)
      .all(request.user.id, request.user.id);
  } else {
    rows = db
      .prepare(`
        SELECT a.*, u.name AS actor_name, u.role AS actor_role
        FROM audit a JOIN users u ON u.id = a.actor_id
        WHERE a.entity_type = 'attempt' AND a.entity_id IN (
          SELECT id FROM attempts WHERE student_id = ?
        )
        ORDER BY a.id DESC LIMIT 100
      `)
      .all(request.user.id);
  }
  response.json({ events: rows });
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
  console.log(`Coursemark listening on ${PORT}`);
});

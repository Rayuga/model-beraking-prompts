const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'coursemark.db');
const SEED_PATH = '/assets/artifacts/coursemark_seed.json';
const FIXED_REFERENCE_MOMENT = '2026-09-02T12:00:00Z';
const DEFAULT_PASSWORD = 'Coursemark!2026';

function getDb(dbFilePath = DB_PATH) {
  const db = new Database(dbFilePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      instructor_id TEXT NOT NULL REFERENCES users(id),
      revision INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      PRIMARY KEY (course_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS accommodations (
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      extra_time_minutes INTEGER NOT NULL DEFAULT 0,
      deadline_extension_minutes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (course_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      opens_at TEXT NOT NULL,
      due_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      max_attempts INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      prompt TEXT NOT NULL,
      options_json TEXT,
      answer TEXT,
      points REAL NOT NULL,
      item_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS rubric_criteria (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      max_points REAL NOT NULL,
      criterion_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      submitted_at TEXT,
      assigned_grader_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      feedback_status TEXT NOT NULL DEFAULT 'hidden',
      objective_score REAL,
      rubric_score REAL
    );

    CREATE TABLE IF NOT EXISTS answers (
      attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      value TEXT,
      PRIMARY KEY (attempt_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS rubric_grades (
      attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
      criterion_id TEXT NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
      score REAL NOT NULL,
      feedback TEXT,
      graded_by TEXT NOT NULL REFERENCES users(id),
      graded_at TEXT NOT NULL,
      PRIMARY KEY (attempt_id, criterion_id)
    );

    CREATE TABLE IF NOT EXISTS assessment_weights (
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      weight_percent REAL NOT NULL,
      PRIMARY KEY (course_id, assessment_id)
    );

    CREATE TABLE IF NOT EXISTS student_exceptions (
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      excused INTEGER NOT NULL DEFAULT 1,
      reason TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (course_id, student_id, assessment_id)
    );

    CREATE TABLE IF NOT EXISTS batch_release_previews (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      instructor_id TEXT NOT NULL REFERENCES users(id),
      created_revision INTEGER NOT NULL,
      attempt_ids_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS operation_receipts (
      user_id TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      response_status INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, operation_id)
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      course_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT NOT NULL,
      attempt_id TEXT,
      assessment_id TEXT,
      student_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audit_course ON audit_events(course_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_attempt ON audit_events(attempt_id);
    CREATE INDEX IF NOT EXISTS idx_audit_student ON audit_events(student_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_assessment ON attempts(assessment_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id);
    CREATE INDEX IF NOT EXISTS idx_items_assessment ON items(assessment_id);
  `);
}

function seedDatabaseIfEmpty(db, seedFilePath = SEED_PATH) {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    return false; // already seeded
  }

  if (!fs.existsSync(seedFilePath)) {
    console.warn(`Seed file not found at ${seedFilePath}`);
    return false;
  }

  const seed = JSON.parse(fs.readFileSync(seedFilePath, 'utf8'));

  const insertUser = db.prepare('INSERT INTO users (id, name, email, role, password) VALUES (?, ?, ?, ?, ?)');
  const insertCourse = db.prepare('INSERT INTO courses (id, title, instructor_id, revision) VALUES (?, ?, ?, ?)');
  const insertEnrollment = db.prepare('INSERT INTO enrollments (course_id, user_id, kind) VALUES (?, ?, ?)');
  const insertAccommodation = db.prepare('INSERT INTO accommodations (course_id, student_id, extra_time_minutes, deadline_extension_minutes) VALUES (?, ?, ?, ?)');
  const insertAssessment = db.prepare('INSERT INTO assessments (id, course_id, title, status, opens_at, due_at, duration_minutes, max_attempts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertItem = db.prepare('INSERT INTO items (id, assessment_id, kind, prompt, options_json, answer, points, item_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertRubric = db.prepare('INSERT INTO rubric_criteria (id, item_id, label, max_points, criterion_order) VALUES (?, ?, ?, ?, ?)');
  const insertAttempt = db.prepare('INSERT INTO attempts (id, assessment_id, student_id, status, started_at, submitted_at, assigned_grader_id, feedback_status, objective_score, rubric_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertAnswer = db.prepare('INSERT INTO answers (attempt_id, item_id, value) VALUES (?, ?, ?)');
  const insertRubricGrade = db.prepare('INSERT INTO rubric_grades (attempt_id, criterion_id, score, feedback, graded_by, graded_at) VALUES (?, ?, ?, ?, ?, ?)');
  const insertWeight = db.prepare('INSERT INTO assessment_weights (course_id, assessment_id, weight_percent) VALUES (?, ?, ?)');

  const seedTransaction = db.transaction(() => {
    // 1. Users
    for (const u of seed.users) {
      insertUser.run(u.id, u.name, u.email, u.role, DEFAULT_PASSWORD);
    }

    // 2. Courses
    for (const c of seed.courses) {
      insertCourse.run(c.id, c.title, c.instructor_id, 0);
    }

    // 3. Enrollments
    for (const e of seed.enrollments) {
      insertEnrollment.run(e.course_id, e.user_id, e.kind);
    }

    // 4. Accommodations
    for (const a of seed.accommodations) {
      insertAccommodation.run(a.course_id, a.student_id, a.extra_time_minutes, a.deadline_extension_minutes);
    }

    // 5. Assessments
    for (const a of seed.assessments) {
      insertAssessment.run(a.id, a.course_id, a.title, a.status, a.opens_at, a.due_at, a.duration_minutes, a.max_attempts);
    }

    // 6. Items
    for (let i = 0; i < seed.items.length; i++) {
      const it = seed.items[i];
      insertItem.run(
        it.id,
        it.assessment_id,
        it.kind,
        it.prompt,
        it.options ? JSON.stringify(it.options) : null,
        it.answer || null,
        it.points,
        i
      );
    }

    // 7. Rubrics
    for (const r of seed.rubrics) {
      for (let j = 0; j < r.criteria.length; j++) {
        const rc = r.criteria[j];
        insertRubric.run(rc.id, r.item_id, rc.label, rc.max_points, j);
      }
    }

    // 8. Attempts
    for (const att of seed.attempts) {
      insertAttempt.run(
        att.id,
        att.assessment_id,
        att.student_id,
        att.status,
        att.started_at,
        att.submitted_at || null,
        att.assigned_grader_id || null,
        att.feedback_status || 'hidden',
        att.objective_score !== undefined ? att.objective_score : null,
        att.rubric_score !== undefined ? att.rubric_score : null
      );
    }

    // 9. Answers
    for (const ans of seed.answers) {
      insertAnswer.run(ans.attempt_id, ans.item_id, ans.value);
    }

    // 10. Rubric Grades
    for (const rg of seed.rubric_grades) {
      insertRubricGrade.run(rg.attempt_id, rg.criterion_id, rg.score, rg.feedback || null, rg.graded_by, rg.graded_at);
    }

    // 11. Initial weights: A-01: 40%, A-03: 40%, A-04: 20%
    insertWeight.run('BIO-214', 'A-01', 40.0);
    insertWeight.run('BIO-214', 'A-03', 40.0);
    insertWeight.run('BIO-214', 'A-04', 20.0);
  });

  seedTransaction();
  console.log('Database initialized and seeded successfully.');
  return true;
}

function initializeDatabase(dbFilePath = DB_PATH, seedFilePath = SEED_PATH) {
  const db = getDb(dbFilePath);
  initSchema(db);
  seedDatabaseIfEmpty(db, seedFilePath);
  return db;
}

module.exports = {
  getDb,
  initSchema,
  seedDatabaseIfEmpty,
  initializeDatabase,
  FIXED_REFERENCE_MOMENT,
  DEFAULT_PASSWORD,
  DB_PATH
};

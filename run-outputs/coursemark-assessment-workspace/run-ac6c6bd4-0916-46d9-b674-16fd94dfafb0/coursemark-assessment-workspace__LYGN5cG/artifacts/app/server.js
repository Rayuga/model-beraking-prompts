#!/usr/bin/env node
const express = require('express');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const DB_PATH = process.env.DB_PATH || '/app/coursemark.db';
const SEED_PATH = '/assets/artifacts/coursemark_seed.json';
const REFERENCE_MOMENT = new Date('2026-09-02T12:00:00Z');

// Database setup
let db;
let isSeeded = false;

function initDatabase() {
  const dbExists = fs.existsSync(DB_PATH);
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  if (!dbExists) {
    createSchema();
    seedData();
    isSeeded = true;
  }
}

function createSchema() {
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('instructor', 'teaching_assistant', 'student')),
      password_hash TEXT NOT NULL
    );

    CREATE TABLE courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      instructor_id TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY(instructor_id) REFERENCES users(id)
    );

    CREATE TABLE enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('staff', 'student')),
      FOREIGN KEY(course_id) REFERENCES courses(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(course_id, user_id)
    );

    CREATE TABLE accommodations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      extra_time_minutes INTEGER NOT NULL DEFAULT 0,
      deadline_extension_minutes INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(course_id) REFERENCES courses(id),
      FOREIGN KEY(student_id) REFERENCES users(id),
      UNIQUE(course_id, student_id)
    );

    CREATE TABLE assessments (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft', 'published')),
      opens_at TEXT NOT NULL,
      due_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      max_attempts INTEGER NOT NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id)
    );

    CREATE TABLE items (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('multiple_choice', 'written')),
      prompt TEXT NOT NULL,
      options TEXT,
      answer TEXT,
      points INTEGER NOT NULL,
      FOREIGN KEY(assessment_id) REFERENCES assessments(id)
    );

    CREATE TABLE rubrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      criteria_json TEXT NOT NULL,
      FOREIGN KEY(item_id) REFERENCES items(id)
    );

    CREATE TABLE attempts (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('in_progress', 'submitted', 'graded', 'released')),
      started_at TEXT NOT NULL,
      submitted_at TEXT,
      assigned_grader_id TEXT,
      feedback_status TEXT NOT NULL CHECK(feedback_status IN ('hidden', 'released')),
      objective_score REAL,
      rubric_score REAL,
      FOREIGN KEY(assessment_id) REFERENCES assessments(id),
      FOREIGN KEY(student_id) REFERENCES users(id),
      FOREIGN KEY(assigned_grader_id) REFERENCES users(id)
    );

    CREATE TABLE answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      value TEXT NOT NULL,
      FOREIGN KEY(attempt_id) REFERENCES attempts(id),
      FOREIGN KEY(item_id) REFERENCES items(id),
      UNIQUE(attempt_id, item_id)
    );

    CREATE TABLE rubric_grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id TEXT NOT NULL,
      criterion_id TEXT NOT NULL,
      score REAL NOT NULL,
      feedback TEXT NOT NULL,
      graded_by TEXT NOT NULL,
      graded_at TEXT NOT NULL,
      FOREIGN KEY(attempt_id) REFERENCES attempts(id),
      FOREIGN KEY(graded_by) REFERENCES users(id)
    );

    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      details TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id),
      FOREIGN KEY(actor_id) REFERENCES users(id)
    );

    CREATE TABLE outcome_weights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id TEXT NOT NULL,
      assessment_id TEXT NOT NULL,
      weight REAL NOT NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id),
      FOREIGN KEY(assessment_id) REFERENCES assessments(id),
      UNIQUE(course_id, assessment_id)
    );

    CREATE TABLE outcome_exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      assessment_id TEXT NOT NULL,
      excused INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      FOREIGN KEY(course_id) REFERENCES courses(id),
      FOREIGN KEY(student_id) REFERENCES users(id),
      FOREIGN KEY(assessment_id) REFERENCES assessments(id),
      UNIQUE(course_id, student_id, assessment_id)
    );

    CREATE TABLE release_previews (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      instructor_id TEXT NOT NULL,
      course_revision INTEGER NOT NULL,
      attempt_ids TEXT NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id),
      FOREIGN KEY(instructor_id) REFERENCES users(id)
    );

    CREATE TABLE operation_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      status INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(user_id, operation_id)
    );

    CREATE INDEX idx_assessments_course ON assessments(course_id);
    CREATE INDEX idx_attempts_assessment ON attempts(assessment_id);
    CREATE INDEX idx_attempts_student ON attempts(student_id);
    CREATE INDEX idx_audit_course ON audit(course_id);
    CREATE INDEX idx_audit_timestamp ON audit(timestamp DESC);
    CREATE INDEX idx_sessions_user ON sessions(user_id);
  `);
}

function seedData() {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  
  const passwordHash = hashPassword('Coursemark!2026');
  
  for (const user of seed.users) {
    db.prepare(`
      INSERT INTO users (id, name, email, role, password_hash)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, user.name, user.email, user.role, passwordHash);
  }
  
  for (const course of seed.courses) {
    db.prepare(`
      INSERT INTO courses (id, title, instructor_id, revision)
      VALUES (?, ?, ?, ?)
    `).run(course.id, course.title, course.instructor_id, 1);
  }
  
  for (const enrollment of seed.enrollments) {
    db.prepare(`
      INSERT INTO enrollments (course_id, user_id, kind)
      VALUES (?, ?, ?)
    `).run(enrollment.course_id, enrollment.user_id, enrollment.kind);
  }
  
  for (const accommodation of seed.accommodations) {
    db.prepare(`
      INSERT INTO accommodations (course_id, student_id, extra_time_minutes, deadline_extension_minutes)
      VALUES (?, ?, ?, ?)
    `).run(accommodation.course_id, accommodation.student_id, accommodation.extra_time_minutes, accommodation.deadline_extension_minutes);
  }
  
  for (const assessment of seed.assessments) {
    db.prepare(`
      INSERT INTO assessments (id, course_id, title, status, opens_at, due_at, duration_minutes, max_attempts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(assessment.id, assessment.course_id, assessment.title, assessment.status, assessment.opens_at, assessment.due_at, assessment.duration_minutes, assessment.max_attempts);
  }
  
  for (const item of seed.items) {
    const options = item.options ? JSON.stringify(item.options) : null;
    db.prepare(`
      INSERT INTO items (id, assessment_id, kind, prompt, options, answer, points)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.assessment_id, item.kind, item.prompt, options, item.answer || null, item.points);
  }
  
  for (const rubric of seed.rubrics) {
    const criteriaJson = JSON.stringify(rubric.criteria);
    db.prepare(`
      INSERT INTO rubrics (item_id, criteria_json)
      VALUES (?, ?)
    `).run(rubric.item_id, criteriaJson);
  }
  
  for (const attempt of seed.attempts) {
    db.prepare(`
      INSERT INTO attempts (id, assessment_id, student_id, status, started_at, submitted_at, assigned_grader_id, feedback_status, objective_score, rubric_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(attempt.id, attempt.assessment_id, attempt.student_id, attempt.status, attempt.started_at, attempt.submitted_at, attempt.assigned_grader_id, attempt.feedback_status, attempt.objective_score || null, attempt.rubric_score || null);
  }
  
  for (const answer of seed.answers) {
    db.prepare(`
      INSERT INTO answers (attempt_id, item_id, value)
      VALUES (?, ?, ?)
    `).run(answer.attempt_id, answer.item_id, answer.value);
  }
  
  for (const grade of seed.rubric_grades) {
    db.prepare(`
      INSERT INTO rubric_grades (attempt_id, criterion_id, score, feedback, graded_by, graded_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(grade.attempt_id, grade.criterion_id, grade.score, grade.feedback, grade.graded_by, grade.graded_at);
  }
  
  // Initialize default outcome weights
  const defaultWeights = [
    { assessment_id: 'A-01', weight: 0.4 },
    { assessment_id: 'A-03', weight: 0.4 },
    { assessment_id: 'A-04', weight: 0.2 }
  ];
  
  for (const weight of defaultWeights) {
    db.prepare(`
      INSERT INTO outcome_weights (course_id, assessment_id, weight)
      VALUES (?, ?, ?)
    `).run('BIO-214', weight.assessment_id, weight.weight);
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashOperationInput(method, path, input) {
  const key = `${method}:${path}:${JSON.stringify(input, Object.keys(input).sort())}`;
  return crypto.createHash('sha256').update(key).digest('hex');
}

function getCurrentUser(token) {
  if (!token) return null;
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  return db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(session.user_id);
}

function logAudit(courseId, actorId, eventType, resourceType, resourceId, details) {
  db.prepare(`
    INSERT INTO audit (course_id, actor_id, event_type, resource_type, resource_id, details, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(courseId, actorId, eventType, resourceType, resourceId, JSON.stringify(details), REFERENCE_MOMENT.toISOString());
}

function memoizeReceipt(user, operationId, method, path, input, status, response) {
  const inputHash = hashOperationInput(method, path, input);
  db.prepare(`
    INSERT OR IGNORE INTO operation_receipts (user_id, operation_id, method, path, input_hash, status, response_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, operationId, method, path, inputHash, status, JSON.stringify(response), REFERENCE_MOMENT.toISOString());
}

function getReceipt(user, operationId, method, path, input) {
  const inputHash = hashOperationInput(method, path, input);
  return db.prepare(`
    SELECT status, response_json FROM operation_receipts 
    WHERE user_id = ? AND operation_id = ? AND method = ? AND path = ? AND input_hash = ?
  `).get(user.id, operationId, method, path, inputHash);
}

function getCourseRevision(courseId) {
  const result = db.prepare('SELECT revision FROM courses WHERE id = ?').get(courseId);
  return result ? result.revision : null;
}

function incrementCourseRevision(courseId) {
  db.prepare('UPDATE courses SET revision = revision + 1 WHERE id = ?').run(courseId);
  return getCourseRevision(courseId);
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Authentication routes
app.post('/api/auth/sign-in', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE email = ?').get(email);
  if (!user || hashPassword(password) !== db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id).password_hash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = generateToken();
  db.prepare('INSERT INTO sessions (user_id, token, created_at) VALUES (?, ?, ?)').run(user.id, token, REFERENCE_MOMENT.toISOString());
  
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/auth/sign-out', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = getCurrentUser(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: REFERENCE_MOMENT.toISOString() });
});

// Protected middleware
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  const user = getCurrentUser(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  req.user = user;
  next();
}

app.use(requireAuth);

// Courses
app.get('/api/courses', (req, res) => {
  const courses = db.prepare(`
    SELECT c.id, c.title, c.instructor_id, c.revision
    FROM courses c
    WHERE c.id IN (
      SELECT course_id FROM enrollments WHERE user_id = ?
      UNION
      SELECT id FROM courses WHERE instructor_id = ?
    )
  `).all(req.user.id, req.user.id);
  
  res.json(courses);
});

app.get('/api/courses/:courseId', (req, res) => {
  const { courseId } = req.params;
  
  const hasAccess = db.prepare(`
    SELECT 1 FROM enrollments WHERE course_id = ? AND user_id = ?
    UNION
    SELECT 1 FROM courses WHERE id = ? AND instructor_id = ?
  `).get(courseId, req.user.id, courseId, req.user.id);
  
  if (!hasAccess) {
    return res.status(403).json({ error: 'Not enrolled' });
  }
  
  const course = db.prepare('SELECT id, title, instructor_id, revision FROM courses WHERE id = ?').get(courseId);
  res.json(course);
});

// Assessments
app.get('/api/assessments/:courseId', (req, res) => {
  const { courseId } = req.params;
  
  const hasAccess = db.prepare(`
    SELECT 1 FROM enrollments WHERE course_id = ? AND user_id = ?
    UNION
    SELECT 1 FROM courses WHERE id = ? AND instructor_id = ?
  `).get(courseId, req.user.id, courseId, req.user.id);
  
  if (!hasAccess) {
    return res.status(403).json({ error: 'Not enrolled' });
  }
  
  let query = 'SELECT id, title, status, opens_at, due_at, duration_minutes, max_attempts FROM assessments WHERE course_id = ?';
  const params = [courseId];
  
  if (req.user.role === 'student') {
    query += ' AND status = ?';
    params.push('published');
  }
  
  const assessments = db.prepare(query).all(...params);
  res.json(assessments);
});

app.get('/api/assessments/:courseId/:assessmentId', (req, res) => {
  const { courseId, assessmentId } = req.params;
  
  const hasAccess = db.prepare(`
    SELECT 1 FROM enrollments WHERE course_id = ? AND user_id = ?
    UNION
    SELECT 1 FROM courses WHERE id = ? AND instructor_id = ?
  `).get(courseId, req.user.id, courseId, req.user.id);
  
  if (!hasAccess) {
    return res.status(403).json({ error: 'Not enrolled' });
  }
  
  const assessment = db.prepare(`
    SELECT id, title, status, opens_at, due_at, duration_minutes, max_attempts FROM assessments 
    WHERE id = ? AND course_id = ?
  `).get(assessmentId, courseId);
  
  if (!assessment) {
    return res.status(404).json({ error: 'Assessment not found' });
  }
  
  if (req.user.role === 'student' && assessment.status !== 'published') {
    return res.status(403).json({ error: 'Not available' });
  }
  
  const items = db.prepare('SELECT id, kind, prompt, points FROM items WHERE assessment_id = ?').all(assessmentId);
  
  const itemsWithRubrics = items.map(item => {
    const rubric = db.prepare('SELECT criteria_json FROM rubrics WHERE item_id = ?').get(item.id);
    return {
      ...item,
      rubric: rubric ? JSON.parse(rubric.criteria_json) : null
    };
  });
  
  if (req.user.role === 'student') {
    itemsWithRubrics.forEach(item => {
      if (item.kind === 'multiple_choice') {
        const options = db.prepare('SELECT options FROM items WHERE id = ?').get(item.id);
        item.options = options ? JSON.parse(options.options) : [];
        delete item.rubric;
      }
    });
  } else {
    itemsWithRubrics.forEach(item => {
      const dbItem = db.prepare('SELECT options, answer FROM items WHERE id = ?').get(item.id);
      if (item.kind === 'multiple_choice' && dbItem) {
        item.options = dbItem.options ? JSON.parse(dbItem.options) : [];
        item.answer = dbItem.answer;
      }
    });
  }
  
  res.json({ ...assessment, items: itemsWithRubrics });
});

// Assessment authoring (instructor only)
app.post('/api/assessments/:courseId/create-draft', (req, res) => {
  const { courseId } = req.params;
  const { operationId, title, opens_at, due_at, duration_minutes, max_attempts } = req.body;
  
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Instructor only' });
  }
  
  const course = db.prepare('SELECT instructor_id, revision FROM courses WHERE id = ?').get(courseId);
  if (!course || course.instructor_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  // Check receipt
  const receipt = getReceipt(req.user, operationId, 'POST', `/api/assessments/${courseId}/create-draft`, req.body);
  if (receipt) {
    return res.status(receipt.status).json(JSON.parse(receipt.response_json));
  }
  
  // Validate input
  const errors = [];
  if (!title || typeof title !== 'string' || title.trim() === '') errors.push('Title required');
  if (!opens_at || isNaN(new Date(opens_at).getTime())) errors.push('Valid opening time required');
  if (!due_at || isNaN(new Date(due_at).getTime())) errors.push('Valid due time required');
  if (new Date(opens_at) >= new Date(due_at)) errors.push('Opening must be before due time');
  if (!Number.isInteger(duration_minutes) || duration_minutes <= 0) errors.push('Positive whole minute duration required');
  if (!Number.isInteger(max_attempts) || max_attempts <= 0) errors.push('Positive attempt limit required');
  
  if (errors.length > 0) {
    const response = { errors };
    memoizeReceipt(req.user, operationId, 'POST', `/api/assessments/${courseId}/create-draft`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  const assessmentId = 'A-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  
  db.prepare(`
    INSERT INTO assessments (id, course_id, title, status, opens_at, due_at, duration_minutes, max_attempts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(assessmentId, courseId, title, 'draft', opens_at, due_at, duration_minutes, max_attempts);
  
  const response = { id: assessmentId, status: 'draft', title, opens_at, due_at, duration_minutes, max_attempts };
  memoizeReceipt(req.user, operationId, 'POST', `/api/assessments/${courseId}/create-draft`, req.body, 201, response);
  res.status(201).json(response);
});

app.post('/api/assessments/:courseId/:assessmentId/add-item', (req, res) => {
  const { courseId, assessmentId } = req.params;
  const { operationId, kind, prompt, options, answer, points } = req.body;
  
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Instructor only' });
  }
  
  const assessment = db.prepare('SELECT status, course_id FROM assessments WHERE id = ?').get(assessmentId);
  if (!assessment || assessment.course_id !== courseId) {
    return res.status(404).json({ error: 'Assessment not found' });
  }
  
  const course = db.prepare('SELECT instructor_id FROM courses WHERE id = ?').get(courseId);
  if (!course || course.instructor_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  if (assessment.status !== 'draft') {
    return res.status(400).json({ error: 'Can only add items to draft' });
  }
  
  // Check receipt
  const receipt = getReceipt(req.user, operationId, 'POST', `/api/assessments/${courseId}/${assessmentId}/add-item`, req.body);
  if (receipt) {
    return res.status(receipt.status).json(JSON.parse(receipt.response_json));
  }
  
  // Validate
  const errors = [];
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') errors.push('Prompt required');
  if (!Number.isInteger(points) || points <= 0) errors.push('Positive points required');
  if (kind === 'multiple_choice') {
    if (!Array.isArray(options) || options.length < 2) errors.push('At least two options required');
    else {
      const trimmed = options.map(o => (typeof o === 'string' ? o.trim() : '')).filter(o => o);
      const unique = new Set(trimmed);
      if (trimmed.length !== unique.size) errors.push('Options must be unique');
      if (trimmed.length < 2) errors.push('At least two distinct options required');
    }
    if (!answer || !options.includes(answer)) errors.push('Answer must match an option');
  }
  
  if (errors.length > 0) {
    const response = { errors };
    memoizeReceipt(req.user, operationId, 'POST', `/api/assessments/${courseId}/${assessmentId}/add-item`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  const itemId = 'I-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  const optionsJson = kind === 'multiple_choice' ? JSON.stringify(options) : null;
  
  db.prepare(`
    INSERT INTO items (id, assessment_id, kind, prompt, options, answer, points)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(itemId, assessmentId, kind, prompt, optionsJson, answer || null, points);
  
  if (kind === 'written') {
    const criteriaJson = JSON.stringify([
      { id: `RC-${Math.random().toString(36).substr(2, 5).toUpperCase()}`, label: 'Response quality', max_points: points }
    ]);
    db.prepare('INSERT INTO rubrics (item_id, criteria_json) VALUES (?, ?)').run(itemId, criteriaJson);
  }
  
  const response = { id: itemId, kind, prompt, options, answer, points };
  memoizeReceipt(req.user, operationId, 'POST', `/api/assessments/${courseId}/${assessmentId}/add-item`, req.body, 201, response);
  res.status(201).json(response);
});

app.post('/api/assessments/:courseId/:assessmentId/publish', (req, res) => {
  const { courseId, assessmentId } = req.params;
  const { operationId, expectedRevision } = req.body;
  
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Instructor only' });
  }
  
  const assessment = db.prepare('SELECT status, course_id FROM assessments WHERE id = ?').get(assessmentId);
  if (!assessment || assessment.course_id !== courseId) {
    return res.status(404).json({ error: 'Assessment not found' });
  }
  
  const course = db.prepare('SELECT instructor_id, revision FROM courses WHERE id = ?').get(courseId);
  if (!course || course.instructor_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  // Check receipt
  const receipt = getReceipt(req.user, operationId, 'POST', `/api/assessments/${courseId}/${assessmentId}/publish`, req.body);
  if (receipt) {
    return res.status(receipt.status).json(JSON.parse(receipt.response_json));
  }
  
  if (assessment.status !== 'draft') {
    const response = { error: 'Already published' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/assessments/${courseId}/${assessmentId}/publish`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  const items = db.prepare('SELECT id FROM items WHERE assessment_id = ?').all(assessmentId);
  if (items.length === 0) {
    const response = { error: 'At least one question required' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/assessments/${courseId}/${assessmentId}/publish`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  db.prepare('UPDATE assessments SET status = ? WHERE id = ?').run('published', assessmentId);
  
  const newRevision = incrementCourseRevision(courseId);
  logAudit(courseId, req.user.id, 'publish', 'assessment', assessmentId, { assessment: assessmentId });
  
  const response = { id: assessmentId, status: 'published', courseRevision: newRevision };
  memoizeReceipt(req.user, operationId, 'POST', `/api/assessments/${courseId}/${assessmentId}/publish`, req.body, 200, response);
  res.json(response);
});

// Attempts
app.post('/api/attempts/:courseId/start', (req, res) => {
  const { courseId } = req.params;
  const { operationId, assessmentId, expectedRevision } = req.body;
  
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Students only' });
  }
  
  // Check receipt
  const receipt = getReceipt(req.user, operationId, 'POST', `/api/attempts/${courseId}/start`, req.body);
  if (receipt) {
    return res.status(receipt.status).json(JSON.parse(receipt.response_json));
  }
  
  const assessment = db.prepare('SELECT id, status, opens_at, due_at, duration_minutes, max_attempts FROM assessments WHERE id = ? AND course_id = ?').get(assessmentId, courseId);
  
  if (!assessment) {
    const response = { error: 'Assessment not found' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${courseId}/start`, req.body, 404, response);
    return res.status(404).json(response);
  }
  
  if (assessment.status !== 'published') {
    const response = { error: 'Assessment not published' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${courseId}/start`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  const now = REFERENCE_MOMENT;
  const openTime = new Date(assessment.opens_at);
  const dueTime = new Date(assessment.due_at);
  
  if (now < openTime) {
    const response = { error: 'Assessment not yet open' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${courseId}/start`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  const accommodation = db.prepare('SELECT extra_time_minutes, deadline_extension_minutes FROM accommodations WHERE course_id = ? AND student_id = ?').get(courseId, req.user.id);
  const extraTime = accommodation ? accommodation.extra_time_minutes : 0;
  const deadlineExt = accommodation ? accommodation.deadline_extension_minutes : 0;
  
  const effectiveDue = new Date(dueTime.getTime() + deadlineExt * 60000);
  
  if (now > effectiveDue) {
    const response = { error: 'Assessment closed' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${courseId}/start`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  const activeAttempt = db.prepare('SELECT id FROM attempts WHERE assessment_id = ? AND student_id = ? AND status != ?').get(assessmentId, req.user.id, 'submitted');
  if (activeAttempt) {
    const response = { id: activeAttempt.id, error: 'Attempt already in progress' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${courseId}/start`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  const attemptCount = db.prepare('SELECT COUNT(*) as cnt FROM attempts WHERE assessment_id = ? AND student_id = ?').get(assessmentId, req.user.id).cnt;
  if (attemptCount >= assessment.max_attempts) {
    const response = { error: 'Attempt limit reached' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${courseId}/start`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  const attemptId = 'AT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  db.prepare(`
    INSERT INTO attempts (id, assessment_id, student_id, status, started_at, assigned_grader_id, feedback_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(attemptId, assessmentId, req.user.id, 'in_progress', now.toISOString(), null, 'hidden');
  
  const course = db.prepare('SELECT revision FROM courses WHERE id = ?').get(courseId);
  logAudit(courseId, req.user.id, 'start', 'attempt', attemptId, { assessment: assessmentId });
  
  const response = { id: attemptId, assessmentId, startedAt: now.toISOString(), expiresAt: new Date(now.getTime() + (assessment.duration_minutes + extraTime) * 60000).toISOString() };
  memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${courseId}/start`, req.body, 201, response);
  res.status(201).json(response);
});

app.post('/api/attempts/:attemptId/save-answer', (req, res) => {
  const { attemptId } = req.params;
  const { operationId, itemId, value } = req.body;
  
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Students only' });
  }
  
  // Check receipt
  const receipt = getReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/save-answer`, req.body);
  if (receipt) {
    return res.status(receipt.status).json(JSON.parse(receipt.response_json));
  }
  
  const attempt = db.prepare('SELECT assessment_id, student_id, status, started_at FROM attempts WHERE id = ?').get(attemptId);
  
  if (!attempt) {
    const response = { error: 'Attempt not found' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/save-answer`, req.body, 404, response);
    return res.status(404).json(response);
  }
  
  if (attempt.student_id !== req.user.id) {
    const response = { error: 'Not your attempt' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/save-answer`, req.body, 403, response);
    return res.status(403).json(response);
  }
  
  if (attempt.status !== 'in_progress') {
    const response = { error: 'Attempt not in progress' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/save-answer`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  const assessment = db.prepare('SELECT due_at, duration_minutes, course_id FROM assessments WHERE id = ?').get(attempt.assessment_id);
  const accommodation = db.prepare('SELECT extra_time_minutes, deadline_extension_minutes FROM accommodations WHERE course_id = ? AND student_id = ?').get(assessment.course_id, req.user.id);
  
  const extraTime = accommodation ? accommodation.extra_time_minutes : 0;
  const deadlineExt = accommodation ? accommodation.deadline_extension_minutes : 0;
  
  const startTime = new Date(attempt.started_at);
  const dueTime = new Date(assessment.due_at);
  const effectiveDue = new Date(dueTime.getTime() + deadlineExt * 60000);
  const expireTime = new Date(startTime.getTime() + (assessment.duration_minutes + extraTime) * 60000);
  const expiryDeadline = Math.min(expireTime.getTime(), effectiveDue.getTime());
  
  if (REFERENCE_MOMENT.getTime() >= expiryDeadline) {
    const response = { error: 'Attempt expired' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/save-answer`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  db.prepare('INSERT OR REPLACE INTO answers (attempt_id, item_id, value) VALUES (?, ?, ?)').run(attemptId, itemId, value);
  
  const response = { saved: true };
  memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/save-answer`, req.body, 200, response);
  res.json(response);
});

app.post('/api/attempts/:attemptId/submit', (req, res) => {
  const { attemptId } = req.params;
  const { operationId } = req.body;
  
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Students only' });
  }
  
  // Check receipt
  const receipt = getReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/submit`, req.body);
  if (receipt) {
    return res.status(receipt.status).json(JSON.parse(receipt.response_json));
  }
  
  const attempt = db.prepare('SELECT assessment_id, student_id, status, started_at FROM attempts WHERE id = ?').get(attemptId);
  
  if (!attempt) {
    const response = { error: 'Attempt not found' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/submit`, req.body, 404, response);
    return res.status(404).json(response);
  }
  
  if (attempt.student_id !== req.user.id) {
    const response = { error: 'Not your attempt' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/submit`, req.body, 403, response);
    return res.status(403).json(response);
  }
  
  if (attempt.status !== 'in_progress') {
    const response = { error: 'Attempt already submitted' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/submit`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  const assessment = db.prepare('SELECT course_id FROM assessments WHERE id = ?').get(attempt.assessment_id);
  
  // Calculate objective score from multiple choice
  const items = db.prepare('SELECT id, kind, answer FROM items WHERE assessment_id = ?').all(attempt.assessment_id);
  let objectiveScore = 0;
  
  for (const item of items) {
    if (item.kind === 'multiple_choice') {
      const answer = db.prepare('SELECT value FROM answers WHERE attempt_id = ? AND item_id = ?').get(attemptId, item.id);
      if (answer && answer.value === item.answer) {
        const points = db.prepare('SELECT points FROM items WHERE id = ?').get(item.id).points;
        objectiveScore += points;
      }
    }
  }
  
  db.prepare('UPDATE attempts SET status = ?, submitted_at = ?, objective_score = ? WHERE id = ?').run('submitted', REFERENCE_MOMENT.toISOString(), objectiveScore, attemptId);
  
  const course = db.prepare('SELECT revision FROM courses WHERE id = ?').get(assessment.course_id);
  logAudit(assessment.course_id, req.user.id, 'submit', 'attempt', attemptId, { assessment: attempt.assessment_id, score: objectiveScore });
  
  const response = { submitted: true, objectiveScore };
  memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/submit`, req.body, 200, response);
  res.json(response);
});

// Get attempt for student
app.get('/api/attempts/:attemptId', (req, res) => {
  const { attemptId } = req.params;
  
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId);
  
  if (!attempt) {
    return res.status(404).json({ error: 'Attempt not found' });
  }
  
  if (req.user.role === 'student' && attempt.student_id !== req.user.id) {
    return res.status(403).json({ error: 'Not your attempt' });
  }
  
  if (req.user.role === 'teaching_assistant' && attempt.assigned_grader_id !== req.user.id) {
    return res.status(403).json({ error: 'Not assigned' });
  }
  
  const assessment = db.prepare('SELECT id, title, duration_minutes FROM assessments WHERE id = ?').get(attempt.assessment_id);
  
  const result = {
    id: attempt.id,
    assessmentId: attempt.assessment_id,
    assessmentTitle: assessment.title,
    studentId: attempt.student_id,
    status: attempt.status,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at,
    feedbackStatus: attempt.feedback_status,
    objectiveScore: attempt.objective_score,
    rubricScore: attempt.rubric_score
  };
  
  if (req.user.role === 'student' && attempt.status === 'in_progress') {
    const items = db.prepare('SELECT id FROM items WHERE assessment_id = ?').all(attempt.assessment_id);
    const answers = {};
    for (const item of items) {
      const answer = db.prepare('SELECT value FROM answers WHERE attempt_id = ? AND item_id = ?').get(attemptId, item.id);
      answers[item.id] = answer ? answer.value : null;
    }
    result.answers = answers;
  }
  
  if (attempt.feedback_status === 'released' && req.user.role === 'student') {
    const grades = db.prepare('SELECT criterion_id, score, feedback FROM rubric_grades WHERE attempt_id = ?').all(attemptId);
    result.grades = grades;
  }
  
  res.json(result);
});

// Grading
app.post('/api/attempts/:attemptId/grade', (req, res) => {
  const { attemptId } = req.params;
  const { operationId, expectedRevision, criterionId, score, feedback } = req.body;
  
  if (req.user.role === 'student') {
    return res.status(403).json({ error: 'Cannot grade' });
  }
  
  // Check receipt
  const receipt = getReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/grade`, req.body);
  if (receipt) {
    return res.status(receipt.status).json(JSON.parse(receipt.response_json));
  }
  
  const attempt = db.prepare('SELECT assessment_id, status, assigned_grader_id FROM attempts WHERE id = ?').get(attemptId);
  
  if (!attempt) {
    const response = { error: 'Attempt not found' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/grade`, req.body, 404, response);
    return res.status(404).json(response);
  }
  
  if (attempt.status !== 'submitted' && attempt.status !== 'graded') {
    const response = { error: 'Attempt not gradeable' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/grade`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  if (req.user.role === 'teaching_assistant' && attempt.assigned_grader_id !== req.user.id) {
    const response = { error: 'Not assigned' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/grade`, req.body, 403, response);
    return res.status(403).json(response);
  }
  
  if (!Number.isFinite(score) || score < 0) {
    const response = { error: 'Invalid score' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/grade`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  // Get max points for criterion
  const items = db.prepare('SELECT id FROM items WHERE assessment_id = ?').all(attempt.assessment_id);
  let maxPoints = 0;
  let foundCriterion = false;
  
  for (const item of items) {
    const rubric = db.prepare('SELECT criteria_json FROM rubrics WHERE item_id = ?').get(item.id);
    if (rubric) {
      const criteria = JSON.parse(rubric.criteria_json);
      for (const criterion of criteria) {
        if (criterion.id === criterionId) {
          maxPoints = criterion.max_points;
          foundCriterion = true;
          break;
        }
      }
    }
    if (foundCriterion) break;
  }
  
  if (!foundCriterion || score > maxPoints) {
    const response = { error: 'Invalid criterion or score out of range' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/grade`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  db.prepare(`
    INSERT OR REPLACE INTO rubric_grades (attempt_id, criterion_id, score, feedback, graded_by, graded_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(attemptId, criterionId, score, feedback, req.user.id, REFERENCE_MOMENT.toISOString());
  
  // Check if all rubric criteria are graded
  let allGraded = true;
  for (const item of items) {
    if (item.kind === 'written') {
      const rubric = db.prepare('SELECT criteria_json FROM rubrics WHERE item_id = ?').get(item.id);
      if (rubric) {
        const criteria = JSON.parse(rubric.criteria_json);
        for (const criterion of criteria) {
          const grade = db.prepare('SELECT id FROM rubric_grades WHERE attempt_id = ? AND criterion_id = ?').get(attemptId, criterion.id);
          if (!grade) {
            allGraded = false;
            break;
          }
        }
      }
    }
    if (!allGraded) break;
  }
  
  if (allGraded) {
    const rubricGrades = db.prepare('SELECT score FROM rubric_grades WHERE attempt_id = ?').all(attemptId);
    const rubricScore = rubricGrades.reduce((sum, g) => sum + g.score, 0);
    db.prepare('UPDATE attempts SET status = ?, rubric_score = ? WHERE id = ?').run('graded', rubricScore, attemptId);
  }
  
  const assessment = db.prepare('SELECT course_id FROM assessments WHERE id = ?').get(attempt.assessment_id);
  const course = db.prepare('SELECT revision FROM courses WHERE id = ?').get(assessment.course_id);
  
  const newRevision = incrementCourseRevision(assessment.course_id);
  logAudit(assessment.course_id, req.user.id, 'grade', 'attempt', attemptId, { criterion: criterionId, score });
  
  const response = { id: attemptId, graded: true, courseRevision: newRevision };
  memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/grade`, req.body, 200, response);
  res.json(response);
});

// Release
app.post('/api/attempts/:attemptId/release', (req, res) => {
  const { attemptId } = req.params;
  const { operationId, expectedRevision } = req.body;
  
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Instructor only' });
  }
  
  // Check receipt
  const receipt = getReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/release`, req.body);
  if (receipt) {
    return res.status(receipt.status).json(JSON.parse(receipt.response_json));
  }
  
  const attempt = db.prepare('SELECT assessment_id, feedback_status, status FROM attempts WHERE id = ?').get(attemptId);
  
  if (!attempt) {
    const response = { error: 'Attempt not found' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/release`, req.body, 404, response);
    return res.status(404).json(response);
  }
  
  if (attempt.feedback_status === 'released') {
    const response = { success: true };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/release`, req.body, 200, response);
    return res.json(response);
  }
  
  if (attempt.status !== 'graded') {
    const response = { error: 'Attempt must be graded' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/release`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  const assessment = db.prepare('SELECT course_id FROM assessments WHERE id = ?').get(attempt.assessment_id);
  const course = db.prepare('SELECT instructor_id FROM courses WHERE id = ?').get(assessment.course_id);
  
  if (course.instructor_id !== req.user.id) {
    const response = { error: 'Not authorized' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/release`, req.body, 403, response);
    return res.status(403).json(response);
  }
  
  db.prepare('UPDATE attempts SET feedback_status = ? WHERE id = ?').run('released', attemptId);
  
  const newRevision = incrementCourseRevision(assessment.course_id);
  logAudit(assessment.course_id, req.user.id, 'release', 'attempt', attemptId, {});
  
  const response = { released: true, courseRevision: newRevision };
  memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/release`, req.body, 200, response);
  res.json(response);
});

// Outcomes
app.get('/api/courses/:courseId/outcomes', (req, res) => {
  const { courseId } = req.params;
  
  const course = db.prepare('SELECT instructor_id FROM courses WHERE id = ?').get(courseId);
  
  if (req.user.role === 'student') {
    return res.status(403).json({ error: 'Students cannot view full outcomes' });
  }
  
  if (req.user.role === 'teaching_assistant') {
    return res.status(403).json({ error: 'TAs cannot view full outcomes' });
  }
  
  if (course.instructor_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  const weights = db.prepare('SELECT assessment_id, weight FROM outcome_weights WHERE course_id = ? ORDER BY assessment_id').all(courseId);
  
  const students = db.prepare(`
    SELECT DISTINCT u.id, u.name, u.email
    FROM users u
    JOIN enrollments e ON u.id = e.user_id
    WHERE e.course_id = ? AND e.kind = 'student'
    ORDER BY u.name
  `).all(courseId);
  
  const outcomes = students.map(student => {
    const row = { studentId: student.id, name: student.name, email: student.email, assessments: {} };
    
    for (const weight of weights) {
      const attempt = db.prepare(`
        SELECT a.id, a.status, a.objective_score, a.rubric_score, a.feedback_status
        FROM attempts a
        WHERE a.assessment_id = ? AND a.student_id = ?
        ORDER BY a.started_at DESC
        LIMIT 1
      `).get(weight.assessment_id, student.id);
      
      const exception = db.prepare(`
        SELECT excused FROM outcome_exceptions
        WHERE course_id = ? AND student_id = ? AND assessment_id = ?
      `).get(courseId, student.id, weight.assessment_id);
      
      const assessment = db.prepare('SELECT title FROM assessments WHERE id = ?').get(weight.assessment_id);
      
      row.assessments[weight.assessment_id] = {
        title: assessment.title,
        weight: weight.weight,
        status: attempt ? attempt.status : 'missing',
        feedbackStatus: attempt ? attempt.feedback_status : null,
        objectiveScore: attempt ? attempt.objective_score : null,
        rubricScore: attempt ? attempt.rubric_score : null,
        excused: exception ? exception.excused === 1 : false
      };
    }
    
    return row;
  });
  
  res.json({ weights, outcomes });
});

// Audit
app.get('/api/audit/:courseId', (req, res) => {
  const { courseId } = req.params;
  
  const course = db.prepare('SELECT instructor_id FROM courses WHERE id = ?').get(courseId);
  
  let query = 'SELECT id, actor_id, event_type, resource_type, resource_id, details, timestamp FROM audit WHERE course_id = ? ';
  let params = [courseId];
  
  if (req.user.role === 'teaching_assistant') {
    query += 'AND (actor_id = ? OR (resource_type = ? AND resource_id IN (SELECT id FROM attempts WHERE assigned_grader_id = ?))) ';
    params.push(req.user.id, 'attempt', req.user.id);
  } else if (req.user.role === 'student') {
    query += 'AND resource_id IN (SELECT id FROM attempts WHERE student_id = ?) ';
    params.push(req.user.id);
  } else if (req.user.role === 'instructor' && course.instructor_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  query += 'ORDER BY timestamp DESC';
  
  const events = db.prepare(query).all(...params);
  res.json(events);
});

// Worksheet grading
app.post('/api/attempts/:attemptId/grade-worksheet', (req, res) => {
  const { attemptId } = req.params;
  const { operationId, expectedRevision, grades } = req.body;
  
  if (req.user.role === 'student') {
    return res.status(403).json({ error: 'Cannot grade' });
  }
  
  // Check receipt
  const receipt = getReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/grade-worksheet`, req.body);
  if (receipt) {
    return res.status(receipt.status).json(JSON.parse(receipt.response_json));
  }
  
  const attempt = db.prepare('SELECT assessment_id, status, assigned_grader_id FROM attempts WHERE id = ?').get(attemptId);
  
  if (!attempt) {
    const response = { error: 'Attempt not found' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/grade-worksheet`, req.body, 404, response);
    return res.status(404).json(response);
  }
  
  if (attempt.status !== 'submitted' && attempt.status !== 'graded') {
    const response = { error: 'Attempt not gradeable' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/grade-worksheet`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  if (req.user.role === 'teaching_assistant' && attempt.assigned_grader_id !== req.user.id) {
    const response = { error: 'Not assigned' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/grade-worksheet`, req.body, 403, response);
    return res.status(403).json(response);
  }
  
  // Validate all grades
  const items = db.prepare('SELECT id FROM items WHERE assessment_id = ?').all(attempt.assessment_id);
  
  for (const grade of grades) {
    if (!Number.isFinite(grade.score) || grade.score < 0) {
      const response = { error: 'Invalid score' };
      memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/grade-worksheet`, req.body, 400, response);
      return res.status(400).json(response);
    }
    
    let maxPoints = 0;
    let foundCriterion = false;
    
    for (const item of items) {
      const rubric = db.prepare('SELECT criteria_json FROM rubrics WHERE item_id = ?').get(item.id);
      if (rubric) {
        const criteria = JSON.parse(rubric.criteria_json);
        for (const criterion of criteria) {
          if (criterion.id === grade.criterionId) {
            maxPoints = criterion.max_points;
            foundCriterion = true;
            break;
          }
        }
      }
      if (foundCriterion) break;
    }
    
    if (!foundCriterion || grade.score > maxPoints) {
      const response = { error: 'Invalid criterion or score out of range' };
      memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/grade-worksheet`, req.body, 400, response);
      return res.status(400).json(response);
    }
  }
  
  // Save all grades
  for (const grade of grades) {
    db.prepare(`
      INSERT OR REPLACE INTO rubric_grades (attempt_id, criterion_id, score, feedback, graded_by, graded_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(attemptId, grade.criterionId, grade.score, grade.feedback, req.user.id, REFERENCE_MOMENT.toISOString());
  }
  
  // Check if all rubric criteria are graded
  let allGraded = true;
  for (const item of items) {
    if (item.kind === 'written') {
      const rubric = db.prepare('SELECT criteria_json FROM rubrics WHERE item_id = ?').get(item.id);
      if (rubric) {
        const criteria = JSON.parse(rubric.criteria_json);
        for (const criterion of criteria) {
          const gradeRecord = db.prepare('SELECT id FROM rubric_grades WHERE attempt_id = ? AND criterion_id = ?').get(attemptId, criterion.id);
          if (!gradeRecord) {
            allGraded = false;
            break;
          }
        }
      }
    }
    if (!allGraded) break;
  }
  
  if (allGraded) {
    const rubricGrades = db.prepare('SELECT score FROM rubric_grades WHERE attempt_id = ?').all(attemptId);
    const rubricScore = rubricGrades.reduce((sum, g) => sum + g.score, 0);
    db.prepare('UPDATE attempts SET status = ?, rubric_score = ? WHERE id = ?').run('graded', rubricScore, attemptId);
  }
  
  const assessment = db.prepare('SELECT course_id FROM assessments WHERE id = ?').get(attempt.assessment_id);
  
  const newRevision = incrementCourseRevision(assessment.course_id);
  logAudit(assessment.course_id, req.user.id, 'grade', 'attempt', attemptId, { grades });
  
  const response = { id: attemptId, graded: true, courseRevision: newRevision };
  memoizeReceipt(req.user, operationId, 'POST', `/api/attempts/${attemptId}/grade-worksheet`, req.body, 200, response);
  res.json(response);
});

// Batch release preview
app.post('/api/courses/:courseId/release-preview', (req, res) => {
  const { courseId } = req.params;
  const { attemptIds } = req.body;
  
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Instructor only' });
  }
  
  const course = db.prepare('SELECT instructor_id, revision FROM courses WHERE id = ?').get(courseId);
  
  if (course.instructor_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  if (!Array.isArray(attemptIds) || attemptIds.length === 0) {
    return res.status(400).json({ error: 'Empty selection' });
  }
  
  if (new Set(attemptIds).size !== attemptIds.length) {
    return res.status(400).json({ error: 'Duplicate attempts' });
  }
  
  const preview = [];
  const errors = [];
  
  for (const attemptId of attemptIds) {
    const attempt = db.prepare('SELECT assessment_id, student_id, status, feedback_status, objective_score, rubric_score FROM attempts WHERE id = ?').get(attemptId);
    
    if (!attempt) {
      errors.push(`Attempt ${attemptId} not found`);
      continue;
    }
    
    if (attempt.feedback_status === 'released') {
      errors.push(`Attempt ${attemptId} already released`);
      continue;
    }
    
    if (attempt.status !== 'graded') {
      errors.push(`Attempt ${attemptId} not graded`);
      continue;
    }
    
    const assessment = db.prepare('SELECT title FROM assessments WHERE id = ?').get(attempt.assessment_id);
    const student = db.prepare('SELECT name, email FROM users WHERE id = ?').get(attempt.student_id);
    
    const total = (attempt.objective_score || 0) + (attempt.rubric_score || 0);
    
    preview.push({
      attemptId,
      studentId: attempt.student_id,
      studentName: student.name,
      studentEmail: student.email,
      assessmentTitle: assessment.title,
      total
    });
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ errors, validAttempts: preview });
  }
  
  const previewId = 'PREV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  db.prepare(`
    INSERT INTO release_previews (id, course_id, instructor_id, course_revision, attempt_ids, consumed, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(previewId, courseId, req.user.id, course.revision, JSON.stringify(attemptIds), 0, REFERENCE_MOMENT.toISOString());
  
  res.json({ previewId, preview });
});

// Batch release commit
app.post('/api/courses/:courseId/release-commit', (req, res) => {
  const { courseId } = req.params;
  const { operationId, previewId, expectedRevision } = req.body;
  
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Instructor only' });
  }
  
  // Check receipt
  const receipt = getReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/release-commit`, req.body);
  if (receipt) {
    return res.status(receipt.status).json(JSON.parse(receipt.response_json));
  }
  
  const course = db.prepare('SELECT instructor_id, revision FROM courses WHERE id = ?').get(courseId);
  
  if (course.instructor_id !== req.user.id) {
    const response = { error: 'Not authorized' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/release-commit`, req.body, 403, response);
    return res.status(403).json(response);
  }
  
  if (course.revision !== expectedRevision) {
    const response = { error: 'Stale revision', currentRevision: course.revision };
    memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/release-commit`, req.body, 409, response);
    return res.status(409).json(response);
  }
  
  const preview = db.prepare('SELECT attempt_ids, consumed, course_revision FROM release_previews WHERE id = ? AND course_id = ?').get(previewId, courseId);
  
  if (!preview) {
    const response = { error: 'Preview not found' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/release-commit`, req.body, 404, response);
    return res.status(404).json(response);
  }
  
  if (preview.consumed === 1) {
    const response = { error: 'Preview already used' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/release-commit`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  if (preview.course_revision !== course.revision) {
    const response = { error: 'Preview stale', currentRevision: course.revision };
    memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/release-commit`, req.body, 412, response);
    return res.status(412).json(response);
  }
  
  const attemptIds = JSON.parse(preview.attempt_ids);
  
  for (const attemptId of attemptIds) {
    db.prepare('UPDATE attempts SET feedback_status = ? WHERE id = ?').run('released', attemptId);
    logAudit(courseId, req.user.id, 'release', 'attempt', attemptId, {});
  }
  
  db.prepare('UPDATE release_previews SET consumed = ? WHERE id = ?').run(1, previewId);
  
  const newRevision = incrementCourseRevision(courseId);
  
  const response = { released: attemptIds.length, courseRevision: newRevision };
  memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/release-commit`, req.body, 200, response);
  res.json(response);
});

// Outcome weights and exceptions
app.post('/api/courses/:courseId/outcome-weights', (req, res) => {
  const { courseId } = req.params;
  const { operationId, expectedRevision, weights } = req.body;
  
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Instructor only' });
  }
  
  // Check receipt
  const receipt = getReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/outcome-weights`, req.body);
  if (receipt) {
    return res.status(receipt.status).json(JSON.parse(receipt.response_json));
  }
  
  const course = db.prepare('SELECT instructor_id, revision FROM courses WHERE id = ?').get(courseId);
  
  if (course.instructor_id !== req.user.id) {
    const response = { error: 'Not authorized' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/outcome-weights`, req.body, 403, response);
    return res.status(403).json(response);
  }
  
  if (course.revision !== expectedRevision) {
    const response = { error: 'Stale revision', currentRevision: course.revision };
    memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/outcome-weights`, req.body, 409, response);
    return res.status(409).json(response);
  }
  
  // Validate weights
  const errors = [];
  let total = 0;
  const seen = new Set();
  
  if (!Array.isArray(weights)) {
    errors.push('Weights must be an array');
  } else {
    for (const w of weights) {
      if (!w.assessmentId || typeof w.assessmentId !== 'string') {
        errors.push('Assessment ID required');
        continue;
      }
      
      if (seen.has(w.assessmentId)) {
        errors.push('Duplicate assessments');
        continue;
      }
      seen.add(w.assessmentId);
      
      if (!Number.isFinite(w.weight) || w.weight < 0) {
        errors.push('Non-negative numeric weight required');
        continue;
      }
      
      total += w.weight;
      
      const assessment = db.prepare('SELECT status FROM assessments WHERE id = ? AND course_id = ?').get(w.assessmentId, courseId);
      if (!assessment) {
        errors.push(`Assessment ${w.assessmentId} not found`);
      } else if (assessment.status !== 'published') {
        errors.push(`Assessment ${w.assessmentId} not published`);
      }
    }
  }
  
  if (Math.abs(total - 1.0) > 0.01) {
    errors.push('Weights must total 100%');
  }
  
  if (errors.length > 0) {
    const response = { errors };
    memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/outcome-weights`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  db.prepare('DELETE FROM outcome_weights WHERE course_id = ?').run(courseId);
  
  for (const w of weights) {
    db.prepare('INSERT INTO outcome_weights (course_id, assessment_id, weight) VALUES (?, ?, ?)').run(courseId, w.assessmentId, w.weight);
  }
  
  const newRevision = incrementCourseRevision(courseId);
  logAudit(courseId, req.user.id, 'update_weights', 'course', courseId, { weights });
  
  const response = { success: true, courseRevision: newRevision };
  memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/outcome-weights`, req.body, 200, response);
  res.json(response);
});

app.post('/api/courses/:courseId/outcome-exception', (req, res) => {
  const { courseId } = req.params;
  const { operationId, expectedRevision, studentId, assessmentId, excused, reason } = req.body;
  
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Instructor only' });
  }
  
  // Check receipt
  const receipt = getReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/outcome-exception`, req.body);
  if (receipt) {
    return res.status(receipt.status).json(JSON.parse(receipt.response_json));
  }
  
  const course = db.prepare('SELECT instructor_id, revision FROM courses WHERE id = ?').get(courseId);
  
  if (course.instructor_id !== req.user.id) {
    const response = { error: 'Not authorized' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/outcome-exception`, req.body, 403, response);
    return res.status(403).json(response);
  }
  
  if (course.revision !== expectedRevision) {
    const response = { error: 'Stale revision', currentRevision: course.revision };
    memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/outcome-exception`, req.body, 409, response);
    return res.status(409).json(response);
  }
  
  const student = db.prepare('SELECT id FROM users WHERE id = ?').get(studentId);
  if (!student) {
    const response = { error: 'Student not found' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/outcome-exception`, req.body, 404, response);
    return res.status(404).json(response);
  }
  
  const assessment = db.prepare('SELECT status FROM assessments WHERE id = ? AND course_id = ?').get(assessmentId, courseId);
  if (!assessment || assessment.status !== 'published') {
    const response = { error: 'Assessment not published' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/outcome-exception`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  if (excused && !reason) {
    const response = { error: 'Reason required for excuse' };
    memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/outcome-exception`, req.body, 400, response);
    return res.status(400).json(response);
  }
  
  if (excused) {
    db.prepare('INSERT OR REPLACE INTO outcome_exceptions (course_id, student_id, assessment_id, excused, reason) VALUES (?, ?, ?, ?, ?)').run(courseId, studentId, assessmentId, 1, reason);
  } else {
    db.prepare('DELETE FROM outcome_exceptions WHERE course_id = ? AND student_id = ? AND assessment_id = ?').run(courseId, studentId, assessmentId);
  }
  
  const newRevision = incrementCourseRevision(courseId);
  logAudit(courseId, req.user.id, excused ? 'excuse' : 'restore', 'outcome_exception', `${studentId}-${assessmentId}`, { excused, reason });
  
  const response = { success: true, courseRevision: newRevision };
  memoizeReceipt(req.user, operationId, 'POST', `/api/courses/${courseId}/outcome-exception`, req.body, 200, response);
  res.json(response);
});

const PORT = 3000;
initDatabase();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Coursemark server listening on port ${PORT}`);
});

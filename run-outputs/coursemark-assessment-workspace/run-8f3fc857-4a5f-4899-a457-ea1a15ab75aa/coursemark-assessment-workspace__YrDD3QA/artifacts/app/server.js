const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const APP_DIR = '/app';
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const DEFAULT_DB_PATH = path.join(APP_DIR, 'coursemark.db');
const DB_PATH = process.env.DB_PATH || DEFAULT_DB_PATH;
const PORT = Number(process.env.PORT || 3000);
const SEED_PATH = '/assets/artifacts/coursemark_seed.json';

const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
const referenceMoment = seed.reference_moment;
const referenceDate = new Date(referenceMoment);
const FIXED_NOW_MS = referenceDate.getTime();

fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

function stableClone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stableClone);
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = stableClone(value[key]);
  return out;
}

function canonicalStringify(value) {
  return JSON.stringify(stableClone(value));
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function randomOpId() {
  return crypto.randomUUID();
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function responseJson(status, body) {
  return { status, body };
}

function parseJsonNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function parseWholeNumber(value) {
  const num = parseJsonNumber(value);
  if (num === null || !Number.isInteger(num)) return null;
  return num;
}

function parseNonNegativeInteger(value) {
  const num = parseWholeNumber(value);
  if (num === null || num < 0) return null;
  return num;
}

function parsePositiveInteger(value) {
  const num = parseWholeNumber(value);
  if (num === null || num <= 0) return null;
  return num;
}

function parseFiniteNumber(value) {
  const num = parseJsonNumber(value);
  if (num === null) return null;
  return num;
}

function parseDateIso(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function addMinutesIso(iso, minutes) {
  return new Date(Date.parse(iso) + minutes * 60000).toISOString();
}

function formatUtc(iso) {
  return new Date(iso).toISOString().replace('.000Z', 'Z');
}

function badRequest(code, message, extra = {}) {
  return responseJson(400, { ok: false, error: { code, message, ...extra } });
}

function unauthorized(message = 'Sign-in required.') {
  return responseJson(401, { ok: false, error: { code: 'unauthorized', message } });
}

function forbidden(message = 'You do not have permission for that action.') {
  return responseJson(403, { ok: false, error: { code: 'forbidden', message } });
}

function notFound(message = 'Not found.') {
  return responseJson(404, { ok: false, error: { code: 'not_found', message } });
}

function conflict(message, extra = {}) {
  return responseJson(409, { ok: false, error: { code: 'conflict', message, ...extra } });
}

function unprocessable(message, extra = {}) {
  return responseJson(422, { ok: false, error: { code: 'validation_error', message, ...extra } });
}

function currentRevision() {
  const value = db.prepare("SELECT value FROM settings WHERE key = 'course_revision'").get()?.value ?? 0;
  return Number(value);
}

function bumpRevision(tx) {
  tx.prepare("UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'course_revision'").run();
  return currentRevision();
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(tx, key, value) {
  tx.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}

function getCourse() {
  return db.prepare('SELECT * FROM courses LIMIT 1').get();
}

function getUserById(id) {
  return db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(id) || null;
}

function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email) || null;
}

function userSummary(user) {
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
}

function hashToken(token) {
  return sha256(token);
}

function hashRequest(op) {
  return sha256(canonicalStringify(op));
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
}

function verifyPassword(password, user) {
  const actual = hashPassword(password, user.password_salt);
  const expected = Buffer.from(user.password_hash, 'hex');
  const got = Buffer.from(actual, 'hex');
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

function nextSequence(tx, name) {
  const row = tx.prepare('SELECT value FROM sequences WHERE name = ?').get(name);
  if (!row) throw new Error(`Missing sequence ${name}`);
  const next = Number(row.value) + 1;
  tx.prepare('UPDATE sequences SET value = ? WHERE name = ?').run(next, name);
  return next;
}

function nextReadableId(tx, prefix, sequenceName) {
  return `${prefix}-${String(nextSequence(tx, sequenceName)).padStart(3, '0')}`;
}

function toNumberString(value) {
  return Number(value).toFixed(2).replace(/\.00$/, '');
}

function parseOpId(req) {
  const opId = req.get('X-Operation-Id');
  if (typeof opId !== 'string' || opId.trim().length < 16) return null;
  return opId.trim();
}

function parseExpectedRevision(req) {
  const raw = req.get('X-Coursemark-Revision');
  if (raw === undefined) return null;
  if (raw === '') return null;
  const num = parseNonNegativeInteger(raw);
  return num;
}

function readJsonBody(req) {
  return isPlainObject(req.body) ? req.body : null;
}

function validateRequestShape(value) {
  return isPlainObject(value) ? value : null;
}

function getAuthToken(req) {
  const auth = req.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function resolveTokenUser(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = db.prepare(`
    SELECT t.user_id, u.name, u.email, u.role
    FROM auth_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ? AND t.revoked_at IS NULL
  `).get(tokenHash);
  return row ? { id: row.user_id, name: row.name, email: row.email, role: row.role } : null;
}

function requireAuth(req) {
  const token = getAuthToken(req);
  const user = resolveTokenUser(token);
  if (!user) return null;
  return { user, token };
}

function hasRole(user, role) {
  return user && user.role === role;
}

function courseForUser(user) {
  const course = getCourse();
  if (!course) return null;
  if (user.role === 'instructor' && course.instructor_id === user.id) return course;
  const enrollment = db.prepare('SELECT * FROM enrollments WHERE course_id = ? AND user_id = ?').get(course.id, user.id);
  if (!enrollment && user.role !== 'instructor') return null;
  return course;
}

function assessmentRows(courseId) {
  return db.prepare('SELECT * FROM assessments WHERE course_id = ? ORDER BY id').all(courseId);
}

function assessmentItems(assessmentId) {
  return db.prepare('SELECT * FROM items WHERE assessment_id = ? ORDER BY id').all(assessmentId).map(item => ({
    ...item,
    options: item.options_json ? JSON.parse(item.options_json) : [],
  }));
}

function itemCriteria(itemId) {
  return db.prepare('SELECT * FROM rubric_criteria WHERE item_id = ? ORDER BY id').all(itemId);
}

function rubricGradesForAttempt(attemptId) {
  return db.prepare('SELECT * FROM rubric_grades WHERE attempt_id = ? ORDER BY criterion_id').all(attemptId);
}

function answersForAttempt(attemptId) {
  return db.prepare('SELECT * FROM answers WHERE attempt_id = ? ORDER BY item_id').all(attemptId);
}

function attemptsByCourse(courseId) {
  return db.prepare(`
    SELECT a.*, ass.title AS assessment_title, ass.status AS assessment_status, ass.duration_minutes, ass.max_attempts, ass.opens_at, ass.due_at
    FROM attempts a
    JOIN assessments ass ON ass.id = a.assessment_id
    WHERE ass.course_id = ?
    ORDER BY a.started_at DESC, a.id DESC
  `).all(courseId);
}

function attemptsForAssessmentStudent(assessmentId, studentId) {
  return db.prepare('SELECT * FROM attempts WHERE assessment_id = ? AND student_id = ? ORDER BY started_at DESC, id DESC').all(assessmentId, studentId);
}

function latestAttemptForAssessmentStudent(assessmentId, studentId) {
  return db.prepare('SELECT * FROM attempts WHERE assessment_id = ? AND student_id = ? ORDER BY started_at DESC, id DESC LIMIT 1').get(assessmentId, studentId) || null;
}

function accommodationForStudent(courseId, studentId) {
  return db.prepare('SELECT * FROM accommodations WHERE course_id = ? AND student_id = ?').get(courseId, studentId) || { extra_time_minutes: 0, deadline_extension_minutes: 0 };
}

function defaultGraderId(courseId) {
  const row = db.prepare(`
    SELECT u.id
    FROM enrollments e
    JOIN users u ON u.id = e.user_id
    WHERE e.course_id = ? AND u.role = 'teaching_assistant'
    ORDER BY u.name
    LIMIT 1
  `).get(courseId);
  return row ? row.id : null;
}


function outcomePolicy(courseId) {
  return db.prepare('SELECT assessment_id, weight_pct FROM outcome_policy WHERE course_id = ? ORDER BY assessment_id').all(courseId);
}

function outcomeExceptionRows(courseId) {
  return db.prepare('SELECT * FROM outcome_exceptions WHERE course_id = ? ORDER BY student_id, assessment_id').all(courseId);
}

function auditRows(courseId) {
  return db.prepare('SELECT * FROM audit_events WHERE course_id = ? ORDER BY id DESC').all(courseId);
}

function releasePreviewById(id) {
  return db.prepare('SELECT * FROM release_previews WHERE id = ?').get(id) || null;
}

function latestRubricByAttempt(attemptId) {
  return db.prepare('SELECT * FROM rubric_grades WHERE attempt_id = ?').all(attemptId);
}

function computeExpiryIso(attempt, assessment, accommodation) {
  const started = Date.parse(attempt.started_at);
  const durationExpiry = new Date(started + (assessment.duration_minutes + (accommodation.extra_time_minutes || 0)) * 60000).toISOString();
  const dueExpiry = new Date(Date.parse(assessment.due_at) + (accommodation.deadline_extension_minutes || 0) * 60000).toISOString();
  return new Date(Math.min(Date.parse(durationExpiry), Date.parse(dueExpiry))).toISOString();
}

function attemptExpiry(attempt, assessment, accommodation) {
  return computeExpiryIso(attempt, assessment, accommodation);
}

function attemptIsExpired(attempt, assessment, accommodation) {
  return FIXED_NOW_MS >= Date.parse(attemptExpiry(attempt, assessment, accommodation));
}

function computeObjectiveScore(assessmentId, answersByItem) {
  const items = db.prepare('SELECT * FROM items WHERE assessment_id = ? AND kind = ? ORDER BY id').all(assessmentId, 'multiple_choice');
  let total = 0;
  for (const item of items) {
    const answer = answersByItem.get(item.id);
    if (typeof answer === 'string' && answer.trim() === String(item.answer).trim()) total += Number(item.points);
  }
  return total;
}

function criterionCompleteMap(attemptId) {
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId);
  if (!attempt) return { complete: false, total: 0, count: 0, expected: 0 };
  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(attempt.assessment_id);
  const criteria = db.prepare(`
    SELECT c.*
    FROM rubric_criteria c
    JOIN items i ON i.id = c.item_id
    WHERE i.assessment_id = ?
    ORDER BY c.id
  `).all(attempt.assessment_id);
  const grades = rubricGradesForAttempt(attemptId);
  const gradeMap = new Map(grades.map(g => [g.criterion_id, g]));
  let complete = true;
  let total = 0;
  for (const criterion of criteria) {
    const grade = gradeMap.get(criterion.id);
    if (!grade) {
      complete = false;
      continue;
    }
    total += Number(grade.score);
  }
  return { complete, total, count: grades.length, expected: criteria.length };
}

function recalcAttemptScores(tx, attemptId) {
  const attempt = tx.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId);
  const assessment = tx.prepare('SELECT * FROM assessments WHERE id = ?').get(attempt.assessment_id);
  const answers = tx.prepare('SELECT item_id, value FROM answers WHERE attempt_id = ?').all(attemptId);
  const answersByItem = new Map(answers.map(a => [a.item_id, a.value]));
  const objective = computeObjectiveScore(attempt.assessment_id, answersByItem);
  const criteria = tx.prepare(`
    SELECT c.*
    FROM rubric_criteria c
    JOIN items i ON i.id = c.item_id
    WHERE i.assessment_id = ?
    ORDER BY c.id
  `).all(attempt.assessment_id);
  const grades = tx.prepare('SELECT * FROM rubric_grades WHERE attempt_id = ?').all(attemptId);
  const gradeMap = new Map(grades.map(g => [g.criterion_id, g]));
  let complete = true;
  let rubricTotal = 0;
  for (const criterion of criteria) {
    const grade = gradeMap.get(criterion.id);
    if (!grade) {
      complete = false;
      continue;
    }
    rubricTotal += Number(grade.score);
  }
  const status = criteria.length === 0 ? 'graded' : complete ? 'graded' : 'submitted';
  const total = complete ? objective + rubricTotal : null;
  tx.prepare(`
    UPDATE attempts
    SET objective_score = ?, rubric_score = ?, total_score = ?, status = ?, submitted_at = COALESCE(submitted_at, ?)
    WHERE id = ?
  `).run(objective, complete ? rubricTotal : null, total, status, attempt.submitted_at || referenceMoment, attemptId);
  return { objective, rubricTotal: complete ? rubricTotal : null, total, status, complete };
}

function ensureGradeableAttempt(user, attempt) {
  if (!attempt) return notFound('Attempt not found.');
  if (attempt.feedback_status === 'released') return conflict('Released attempts are immutable.');
  if (user.role === 'instructor') return null;
  if (user.role === 'teaching_assistant' && attempt.assigned_grader_id === user.id) return null;
  return forbidden('You may only grade assigned submissions.');
}

function ensureCourseAccess(user, course) {
  if (!course) return notFound('Course not found.');
  if (user.role === 'instructor' && course.instructor_id === user.id) return null;
  const enrollment = db.prepare('SELECT * FROM enrollments WHERE course_id = ? AND user_id = ?').get(course.id, user.id);
  if (!enrollment) return forbidden('You are not enrolled in this course.');
  return null;
}

function createAudit(tx, { course_id, actor_user_id, actor_role, event_type, target_type, target_id, summary }) {
  tx.prepare(`
    INSERT INTO audit_events (course_id, actor_user_id, actor_role, event_type, target_type, target_id, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(course_id, actor_user_id, actor_role, event_type, target_type, target_id, summary, referenceMoment);
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildAssessmentPayload(assessment, user) {
  const items = assessmentItems(assessment.id).map(item => {
    const base = {
      id: item.id,
      kind: item.kind,
      prompt: item.prompt,
      points: item.points,
    };
    if (item.kind === 'multiple_choice') {
      base.options = item.options;
      if (user.role !== 'student') base.answer = item.answer;
    } else {
      const criteria = itemCriteria(item.id).map(c => ({ id: c.id, label: c.label, maxPoints: c.max_points }));
      if (user.role !== 'student') base.criteria = criteria;
    }
    return base;
  });
  const policyRow = db.prepare('SELECT weight_pct FROM outcome_policy WHERE course_id = ? AND assessment_id = ?').get(assessment.course_id, assessment.id);
  return {
    id: assessment.id,
    courseId: assessment.course_id,
    title: assessment.title,
    status: assessment.status,
    opensAt: assessment.opens_at,
    dueAt: assessment.due_at,
    durationMinutes: assessment.duration_minutes,
    maxAttempts: assessment.max_attempts,
    publishedAt: assessment.published_at,
    weightPct: policyRow ? Number(policyRow.weight_pct) : (assessment.status === 'published' ? 0 : null),
    itemCount: items.length,
    items,
  };
}

function buildAttemptPayload(attempt, user, course) {
  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(attempt.assessment_id);
  const accommodation = accommodationForStudent(course.id, attempt.student_id);
  const expiry = attemptExpiry(attempt, assessment, accommodation);
  const base = {
    id: attempt.id,
    assessmentId: attempt.assessment_id,
    assessmentTitle: assessment.title,
    studentId: attempt.student_id,
    studentName: getUserById(attempt.student_id)?.name || null,
    studentEmail: getUserById(attempt.student_id)?.email || null,
    status: attempt.status,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at,
    assignedGraderId: attempt.assigned_grader_id,
    assignedGraderName: attempt.assigned_grader_id ? getUserById(attempt.assigned_grader_id)?.name || null : null,
    feedbackStatus: attempt.feedback_status,
    objectiveScore: attempt.feedback_status === 'released' || user.role !== 'student' ? attempt.objective_score : null,
    rubricScore: attempt.feedback_status === 'released' || user.role !== 'student' ? attempt.rubric_score : null,
    totalScore: attempt.feedback_status === 'released' || user.role !== 'student' ? attempt.total_score : null,
    isExpired: attempt.status === 'in_progress' ? attemptIsExpired(attempt, assessment, accommodation) : false,
    expiresAt: expiry,
  };
  const savedAnswers = answersForAttempt(attempt.id).reduce((acc, row) => {
    acc[row.item_id] = row.value;
    return acc;
  }, {});
  const items = assessmentItems(attempt.assessment_id).map(item => {
    const entry = {
      id: item.id,
      kind: item.kind,
      prompt: item.prompt,
      points: item.points,
      savedValue: savedAnswers[item.id] || '',
    };
    if (item.kind === 'multiple_choice') {
      entry.options = item.options;
      if (user.role !== 'student' || attempt.feedback_status === 'released') entry.answer = user.role === 'student' && attempt.feedback_status !== 'released' ? undefined : item.answer;
    } else if (user.role !== 'student') {
      entry.criteria = itemCriteria(item.id).map(c => ({ id: c.id, label: c.label, maxPoints: c.max_points }));
    }
    return entry;
  });
  const rubricGrades = rubricGradesForAttempt(attempt.id).map(g => ({
    criterionId: g.criterion_id,
    score: attempt.feedback_status === 'released' || user.role !== 'student' ? g.score : null,
    feedback: attempt.feedback_status === 'released' || user.role !== 'student' ? g.feedback : null,
    gradedBy: attempt.feedback_status === 'released' || user.role !== 'student' ? getUserById(g.graded_by)?.name || null : null,
    gradedAt: attempt.feedback_status === 'released' || user.role !== 'student' ? g.graded_at : null,
  }));
  return {
    ...base,
    items: user.role === 'student' && attempt.feedback_status !== 'released'
      ? items.map(item => {
        const copy = { ...item };
        delete copy.answer;
        delete copy.criteria;
        return copy;
      })
      : items,
    rubricGrades: user.role === 'student' && attempt.feedback_status !== 'released' ? [] : rubricGrades,
  };
}

function buildOutcomeLedger(user, course, assessments, attempts, policyRows, exceptionRows) {
  const students = db.prepare(`
    SELECT u.id, u.name, u.email
    FROM enrollments e
    JOIN users u ON u.id = e.user_id
    WHERE e.course_id = ? AND e.kind = 'student'
    ORDER BY u.name
  `).all(course.id);
  const publishedAssessments = assessments.filter(a => a.status === 'published');
  const weightByAssessment = new Map(policyRows.map(r => [r.assessment_id, Number(r.weight_pct)]));
  const excMap = new Map(exceptionRows.map(r => [`${r.student_id}:${r.assessment_id}`, r]));
  const rows = [];
  for (const student of students) {
    const row = {
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      assessments: [],
      availableTotal: 0,
      finalPercentage: null,
      finalStatus: 'pending',
      explanation: '',
    };
    let includedWeight = 0;
    let weightedSum = 0;
    let pending = false;
    for (const assessment of publishedAssessments) {
      const weight = weightByAssessment.get(assessment.id) ?? 0;
      const exception = excMap.get(`${student.id}:${assessment.id}`) || null;
      const attempt = latestAttemptForAssessmentStudent(assessment.id, student.id);
      const released = attempt && attempt.feedback_status === 'released';
      const included = weight > 0 && !(exception && exception.excused);
      const cell = {
        assessmentId: assessment.id,
        assessmentTitle: assessment.title,
        weightPct: weight,
        state: 'missing',
        score: null,
        maxPoints: null,
        released: released,
        excused: exception ? Boolean(exception.excused) : false,
      };
      if (weight <= 0) {
        cell.state = 'unweighted';
      } else if (exception && exception.excused) {
        cell.state = 'excused';
      } else if (!attempt) {
        cell.state = 'missing';
        pending = true;
      } else if (!released) {
        cell.state = 'pending';
        pending = true;
      } else {
        const maxPoints = db.prepare('SELECT COALESCE(SUM(points), 0) AS total FROM items WHERE assessment_id = ?').get(assessment.id).total;
        const totalScore = attempt.total_score ?? ((attempt.objective_score || 0) + (attempt.rubric_score || 0));
        cell.state = 'released';
        cell.score = totalScore;
        cell.maxPoints = maxPoints;
        const percentage = maxPoints > 0 ? (totalScore / maxPoints) : 0;
        weightedSum += weight * percentage;
      }
      if (included) {
        includedWeight += weight;
        if (!attempt || !released) pending = true;
      }
      row.assessments.push(cell);
    }
    row.availableTotal = includedWeight;
    if (!pending && includedWeight > 0) {
      row.finalPercentage = Number((100 * weightedSum / includedWeight).toFixed(2));
      row.finalStatus = 'calculated';
      row.explanation = 'All included published work has released scores.';
    } else if (includedWeight === 0) {
      row.finalStatus = 'unavailable';
      row.explanation = 'No weighted published assessments are currently included.';
    } else {
      row.finalStatus = 'pending';
      row.explanation = 'One or more included published assessments are missing or unreleased.';
    }
    rows.push(row);
  }
  if (user.role === 'student') {
    return rows.filter(row => row.studentId === user.id);
  }
  return rows;
}

function filterAuditForUser(user, course, events) {
  if (user.role === 'instructor') return events;
  const attemptsById = new Map(attemptsByCourse(course.id).map(a => [a.id, a]));
  return events.filter(event => {
    if (event.actor_user_id === user.id) return true;
    if (event.target_type !== 'attempt') return false;
    const attempt = attemptsById.get(event.target_id);
    if (!attempt) return false;
    if (user.role === 'teaching_assistant' && attempt.assigned_grader_id === user.id) return true;
    if (user.role === 'student' && attempt.student_id === user.id) return true;
    return false;
  });
}

function buildWorkspace(user) {
  const course = courseForUser(user);
  if (!course) return null;
  const assessments = assessmentRows(course.id).map(a => buildAssessmentPayload(a, user));
  const attempts = attemptsByCourse(course.id)
    .filter(attempt => {
      if (user.role === 'instructor') return true;
      if (user.role === 'teaching_assistant') return attempt.assigned_grader_id === user.id;
      return attempt.student_id === user.id;
    })
    .map(attempt => buildAttemptPayload(attempt, user, course));
  const policyRows = outcomePolicy(course.id);
  const exceptionRows = outcomeExceptionRows(course.id);
  const ledger = user.role === 'teaching_assistant' ? [] : buildOutcomeLedger(user, course, assessments.map(a => ({ id: a.id, title: a.title, status: a.status })), attemptsByCourse(course.id), policyRows, exceptionRows);
  const audit = filterAuditForUser(user, course, auditRows(course.id)).map(event => ({
    id: event.id,
    eventType: event.event_type,
    targetType: event.target_type,
    targetId: event.target_id,
    summary: event.summary,
    actorUserId: event.actor_user_id,
    actorRole: event.actor_role,
    createdAt: event.created_at,
  }));
  const queue = user.role === 'teaching_assistant'
    ? attemptsByCourse(course.id)
        .filter(attempt => attempt.assigned_grader_id === user.id && attempt.feedback_status !== 'released' && attempt.status !== 'in_progress')
        .map(attempt => buildAttemptPayload(attempt, user, course))
    : [];
  const releasedPreviews = user.role === 'instructor'
    ? db.prepare('SELECT * FROM release_previews WHERE course_id = ? ORDER BY id DESC').all(course.id).map(row => ({
      id: row.id,
      instructorId: row.instructor_id,
      revisionAtPreview: row.revision_at_preview,
      attempts: JSON.parse(row.selection_json),
      consumedAt: row.consumed_at,
      createdAt: row.created_at,
    }))
    : [];
  return {
    user: userSummary(user),
    course: {
      id: course.id,
      title: course.title,
      instructorId: course.instructor_id,
      revision: currentRevision(),
      referenceMoment,
    },
    assessments,
    attempts,
    gradebook: user.role === 'teaching_assistant' ? queue : ledger,
    outcomePolicy: user.role === 'teaching_assistant' ? [] : policyRows.map(r => ({ assessmentId: r.assessment_id, weightPct: Number(r.weight_pct) })),
    outcomeExceptions: user.role === 'teaching_assistant' ? [] : exceptionRows.map(r => ({
      studentId: r.student_id,
      assessmentId: r.assessment_id,
      excused: Boolean(r.excused),
      reason: r.reason,
    })),
    audit,
    releasePreviews: releasedPreviews,
    permissions: {
      canAuthorAssessments: user.role === 'instructor',
      canGrade: user.role === 'instructor' || user.role === 'teaching_assistant',
      canRelease: user.role === 'instructor',
      canEditOutcomes: user.role === 'instructor',
    },
  };
}

function validateOperationIdentity(req, body) {
  const opId = parseOpId(req);
  if (!opId) return null;
  const expectedRevision = parseExpectedRevision(req);
  return { opId, expectedRevision, bodyHash: hashRequest(body) };
}

function handleWrite(req, res, { requireUser = true, signIn = false, handler }) {
  const body = validateRequestShape(req.body);
  if (!body) return res.status(400).json({ ok: false, error: { code: 'bad_body', message: 'Request body must be a JSON object.' } });
  const identity = validateOperationIdentity(req, body);
  if (!identity) return res.status(400).json({ ok: false, error: { code: 'bad_operation_id', message: 'X-Operation-Id must be a nonempty random string.' } });
  if (!signIn && identity.expectedRevision === null) {
    return res.status(400).json({ ok: false, error: { code: 'bad_revision', message: 'X-Coursemark-Revision must be a nonnegative whole number.' } });
  }
  const auth = signIn ? null : requireAuth(req);
  if (requireUser && !auth) return res.status(401).json({ ok: false, error: { code: 'unauthorized', message: 'Sign-in required.' } });
  const user = auth ? auth.user : null;
  const opMethod = req.method;
  const opPath = req.path;
  const run = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM operations WHERE op_id = ?').get(identity.opId);
    if (existing) {
      if (existing.method !== opMethod || existing.path !== opPath || existing.body_hash !== identity.bodyHash || (!signIn && (existing.user_id || null) !== (user ? user.id : null))) {
        return conflict('Operation identifier was reused for a different request.', { code: 'operation_mismatch' });
      }
      return { status: existing.status, body: JSON.parse(existing.response_json), replay: true };
    }
    const result = handler({
      tx: db,
      user,
      body,
      expectedRevision: identity.expectedRevision,
      opId: identity.opId,
    });
    if (!result || typeof result.status !== 'number' || !result.body) {
      throw new Error('Invalid handler response.');
    }
    db.prepare(`
      INSERT INTO operations (op_id, user_id, method, path, body_hash, status, response_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(identity.opId, user ? user.id : null, opMethod, opPath, identity.bodyHash, result.status, JSON.stringify(result.body), referenceMoment);
    return result;
  });
  try {
    const result = run();
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('write handler failed', error);
    res.status(500).json({ ok: false, error: { code: 'server_error', message: 'An unexpected server error occurred.' } });
  }
}

function ensureAuthorCanEditAssessment(user, course) {
  if (user.role !== 'instructor' || course.instructor_id !== user.id) return forbidden('Only the instructor can author assessments.');
  return null;
}

function ensureStaffCanGrade(user, attempt) {
  if (user.role === 'instructor') return null;
  if (user.role === 'teaching_assistant' && attempt.assigned_grader_id === user.id) return null;
  return forbidden('You may only grade assigned submissions.');
}

function workEvaluationSnapshot() {
  return {
    revision: currentRevision(),
    referenceMoment,
    course: getCourse(),
  };
}

function findAssessmentById(id) {
  return db.prepare('SELECT * FROM assessments WHERE id = ?').get(id) || null;
}

function findAttemptById(id) {
  return db.prepare('SELECT * FROM attempts WHERE id = ?').get(id) || null;
}

function releasePreviewSnapshot(user, previewId) {
  const preview = releasePreviewById(previewId);
  if (!preview) return notFound('Preview not found.');
  if (preview.course_id !== getCourse().id) return forbidden('Preview does not belong to this course.');
  if (preview.instructor_id !== user.id) return forbidden('Only the instructor may commit this preview.');
  return preview;
}

function validateAssessmentCreate(body) {
  if (!isPlainObject(body)) return badRequest('bad_body', 'Request body must be a JSON object.');
  const title = normalizeText(body.title);
  const opensAt = parseDateIso(body.opensAt);
  const dueAt = parseDateIso(body.dueAt);
  const durationMinutes = parsePositiveInteger(body.durationMinutes);
  const maxAttempts = parsePositiveInteger(body.maxAttempts);
  if (!title) return unprocessable('Assessment title is required.');
  if (!opensAt || !dueAt) return unprocessable('Opening and due times must be parseable dates in UTC.');
  if (Date.parse(opensAt) >= Date.parse(dueAt)) return unprocessable('Opening time must be before due time.');
  if (!durationMinutes) return unprocessable('Duration must be a positive whole minute value.');
  if (!maxAttempts) return unprocessable('Attempt limit must be a positive whole number.');
  return { title, opensAt, dueAt, durationMinutes, maxAttempts };
}

function validateQuestionCreate(body) {
  if (!isPlainObject(body)) return badRequest('bad_body', 'Request body must be a JSON object.');
  const kind = normalizeText(body.kind);
  const prompt = normalizeText(body.prompt);
  const points = parseFiniteNumber(body.points);
  if (!['multiple_choice', 'written'].includes(kind)) return unprocessable('Question kind must be multiple_choice or written.');
  if (!prompt) return unprocessable('Question prompt is required.');
  if (!(points > 0)) return unprocessable('Question points must be positive.');
  if (kind === 'multiple_choice') {
    const options = Array.isArray(body.options) ? body.options.map(option => normalizeText(option)).filter(Boolean) : null;
    const answer = normalizeText(body.answer);
    if (!options || options.length < 2) return unprocessable('Multiple-choice questions need at least two distinct options.');
    const unique = new Set(options.map(opt => opt.trim()));
    if (unique.size !== options.length) return unprocessable('Multiple-choice options must be unique after trimming.');
    if (!answer || !unique.has(answer)) return unprocessable('Multiple-choice key must match one option.');
    return { kind, prompt, points, options, answer };
  }
  const rubricCriteria = Array.isArray(body.rubricCriteria) ? body.rubricCriteria : [];
  if (!rubricCriteria.length) return unprocessable('Written questions need at least one positive rubric criterion.');
  const criteria = [];
  for (const criterion of rubricCriteria) {
    if (!isPlainObject(criterion)) return unprocessable('Rubric criteria must be objects.');
    const label = normalizeText(criterion.label);
    const maxPoints = parseFiniteNumber(criterion.maxPoints);
    if (!label) return unprocessable('Rubric criteria require labels.');
    if (!(maxPoints > 0)) return unprocessable('Rubric criteria require positive maximum points.');
    criteria.push({ label, maxPoints });
  }
  return { kind, prompt, points, criteria };
}

function validatePolicyBody(body, publishedAssessments) {
  if (!isPlainObject(body)) return badRequest('bad_body', 'Request body must be a JSON object.');
  const rows = Array.isArray(body.weights) ? body.weights : null;
  if (!rows) return unprocessable('Policy weights must be provided as an array.');
  if (rows.length !== publishedAssessments.length) return unprocessable('Policy must include every published assessment exactly once.');
  const seen = new Set();
  let total = 0;
  const parsed = [];
  for (const row of rows) {
    if (!isPlainObject(row)) return unprocessable('Policy rows must be objects.');
    const assessmentId = normalizeText(row.assessmentId);
    const weightPct = parseFiniteNumber(row.weightPct);
    if (!assessmentId) return unprocessable('Policy rows require assessment IDs.');
    if (seen.has(assessmentId)) return unprocessable('Policy cannot include duplicate assessments.');
    seen.add(assessmentId);
    const assessment = publishedAssessments.find(a => a.id === assessmentId);
    if (!assessment) return unprocessable('Policy may include only published assessments in this course.');
    if (!(weightPct >= 0)) return unprocessable('Policy weights must be nonnegative percentages.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(String(row.weightPct).trim())) {
      const numericText = String(row.weightPct).trim();
      if (!/^\d+(?:\.\d+)?$/.test(numericText)) return unprocessable('Policy weights must have at most two decimal places.');
      const decimals = numericText.split('.')[1] || '';
      if (decimals.length > 2) return unprocessable('Policy weights must have at most two decimal places.');
    }
    total += weightPct;
    parsed.push({ assessmentId, weightPct });
  }
  if (Math.abs(total - 100) > 0.00001) return unprocessable('Policy weights must total exactly 100%.');
  return parsed;
}

function validateExceptionBody(body, course) {
  if (!isPlainObject(body)) return badRequest('bad_body', 'Request body must be a JSON object.');
  const studentId = normalizeText(body.studentId);
  const assessmentId = normalizeText(body.assessmentId);
  const excused = Boolean(body.excused);
  const reason = normalizeText(body.reason);
  if (!studentId || !assessmentId) return unprocessable('Student and assessment IDs are required.');
  const assessment = findAssessmentById(assessmentId);
  if (!assessment || assessment.course_id !== course.id || assessment.status !== 'published') return unprocessable('Only published assessments in this course may be excused.');
  const enrollment = db.prepare("SELECT * FROM enrollments WHERE course_id = ? AND user_id = ? AND kind = 'student'").get(course.id, studentId);
  if (!enrollment) return unprocessable('Exception student must be enrolled in this course.');
  if (excused && !reason) return unprocessable('Excusing an assessment requires a reason.');
  return { studentId, assessmentId, excused, reason: excused ? reason : null };
}

function validateWorksheetBody(body, attempt) {
  if (!isPlainObject(body)) return badRequest('bad_body', 'Request body must be a JSON object.');
  const rows = Array.isArray(body.rows) ? body.rows : null;
  if (!rows || !rows.length) return unprocessable('At least one rubric row must be selected.');
  const rubricCriteria = db.prepare(`
    SELECT c.*
    FROM rubric_criteria c
    JOIN items i ON i.id = c.item_id
    WHERE i.assessment_id = ?
    ORDER BY c.id
  `).all(attempt.assessment_id);
  const criteriaMap = new Map(rubricCriteria.map(c => [c.id, c]));
  const seen = new Set();
  const parsed = [];
  for (const row of rows) {
    if (!isPlainObject(row)) return unprocessable('Worksheet rows must be objects.');
    const criterionId = normalizeText(row.criterionId);
    const selected = row.selected !== false;
    if (!criterionId) return unprocessable('Worksheet rows require criterion IDs.');
    if (seen.has(criterionId)) return unprocessable('Worksheet cannot include duplicate criteria.');
    seen.add(criterionId);
    const criterion = criteriaMap.get(criterionId);
    if (!criterion) return unprocessable('Worksheet cannot include foreign criteria.');
    if (!selected) continue;
    const score = parseFiniteNumber(row.score);
    const feedback = typeof row.feedback === 'string' ? row.feedback : '';
    if (score === null || !Number.isFinite(score)) return unprocessable('Rubric scores must be numeric.');
    if (score < 0 || score > Number(criterion.max_points)) return unprocessable('Rubric scores must be within the criterion maximum.');
    parsed.push({ criterionId, score, feedback });
  }
  if (!parsed.length) return unprocessable('No rubric rows were selected.');
  return { rows: parsed };
}

function settleExpiredAttempts() {
  const course = getCourse();
  if (!course) return;
  const tx = db.transaction(() => {
    const inProgress = db.prepare(`
      SELECT a.*
      FROM attempts a
      JOIN assessments ass ON ass.id = a.assessment_id
      WHERE ass.course_id = ? AND a.status = 'in_progress'
      ORDER BY a.started_at ASC, a.id ASC
    `).all(course.id);
    let changed = false;
    for (const attempt of inProgress) {
      const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(attempt.assessment_id);
      const accommodation = accommodationForStudent(course.id, attempt.student_id);
      if (!attemptIsExpired(attempt, assessment, accommodation)) continue;
      const answers = db.prepare('SELECT item_id, value FROM answers WHERE attempt_id = ?').all(attempt.id);
      const answersByItem = new Map(answers.map(a => [a.item_id, a.value]));
      const objective = computeObjectiveScore(attempt.assessment_id, answersByItem);
      const criteria = db.prepare(`
        SELECT c.*
        FROM rubric_criteria c
        JOIN items i ON i.id = c.item_id
        WHERE i.assessment_id = ?
      `).all(attempt.assessment_id);
      const finalStatus = criteria.length === 0 ? 'graded' : 'submitted';
      db.prepare(`
        UPDATE attempts
        SET status = ?, submitted_at = ?, objective_score = ?, rubric_score = ?, total_score = ?, feedback_status = 'hidden'
        WHERE id = ?
      `).run(finalStatus, referenceMoment, objective, criteria.length === 0 ? 0 : null, criteria.length === 0 ? objective : null, attempt.id);
      createAudit(db, {
        course_id: course.id,
        actor_user_id: 'system',
        actor_role: 'system',
        event_type: 'attempt_auto_submitted',
        target_type: 'attempt',
        target_id: attempt.id,
        summary: `Auto-submitted ${attempt.id}`,
      });
      changed = true;
    }
    if (changed) {
      bumpRevision(db);
    }
  });
  tx();
}

function seedIfNeeded() {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'").get();
  if (tables) return;
  db.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE sequences (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      instructor_id TEXT NOT NULL
    );
    CREATE TABLE enrollments (
      course_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      PRIMARY KEY (course_id, user_id)
    );
    CREATE TABLE accommodations (
      course_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      extra_time_minutes INTEGER NOT NULL DEFAULT 0,
      deadline_extension_minutes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (course_id, student_id)
    );
    CREATE TABLE assessments (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      opens_at TEXT NOT NULL,
      due_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      max_attempts INTEGER NOT NULL,
      published_at TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL
    );
    CREATE TABLE items (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      prompt TEXT NOT NULL,
      points REAL NOT NULL,
      options_json TEXT,
      answer TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE rubric_criteria (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      label TEXT NOT NULL,
      max_points REAL NOT NULL
    );
    CREATE TABLE attempts (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      submitted_at TEXT,
      assigned_grader_id TEXT,
      feedback_status TEXT NOT NULL,
      submission_kind TEXT,
      objective_score REAL,
      rubric_score REAL,
      total_score REAL,
      released_at TEXT,
      auto_submitted_at TEXT
    );
    CREATE TABLE answers (
      attempt_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (attempt_id, item_id)
    );
    CREATE TABLE rubric_grades (
      attempt_id TEXT NOT NULL,
      criterion_id TEXT NOT NULL,
      score REAL NOT NULL,
      feedback TEXT NOT NULL,
      graded_by TEXT NOT NULL,
      graded_at TEXT NOT NULL,
      PRIMARY KEY (attempt_id, criterion_id)
    );
    CREATE TABLE auth_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE TABLE operations (
      op_id TEXT PRIMARY KEY,
      user_id TEXT,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      body_hash TEXT NOT NULL,
      status INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      event_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE outcome_policy (
      course_id TEXT NOT NULL,
      assessment_id TEXT NOT NULL,
      weight_pct REAL NOT NULL,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (course_id, assessment_id)
    );
    CREATE TABLE outcome_exceptions (
      course_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      assessment_id TEXT NOT NULL,
      excused INTEGER NOT NULL,
      reason TEXT,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (course_id, student_id, assessment_id)
    );
    CREATE TABLE release_previews (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      instructor_id TEXT NOT NULL,
      revision_at_preview INTEGER NOT NULL,
      selection_json TEXT NOT NULL,
      preview_body_json TEXT,
      consumed_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const tx = db.transaction(() => {
    db.prepare("INSERT INTO settings (key, value) VALUES ('reference_moment', ?)").run(referenceMoment);
    db.prepare("INSERT INTO settings (key, value) VALUES ('course_revision', '0')").run();
    db.prepare('INSERT INTO sequences (name, value) VALUES (?, ?)').run('assessment', 4);
    db.prepare('INSERT INTO sequences (name, value) VALUES (?, ?)').run('attempt', 103);
    db.prepare('INSERT INTO sequences (name, value) VALUES (?, ?)').run('item', 5);
    db.prepare('INSERT INTO sequences (name, value) VALUES (?, ?)').run('criterion', 4);
    db.prepare('INSERT INTO sequences (name, value) VALUES (?, ?)').run('preview', 0);
    db.prepare('INSERT INTO sequences (name, value) VALUES (?, ?)').run('token', 0);

    const userInsert = db.prepare('INSERT INTO users (id, name, email, role, password_salt, password_hash) VALUES (?, ?, ?, ?, ?, ?)');
    for (const user of seed.users) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPassword('Coursemark!2026', salt);
      userInsert.run(user.id, user.name, user.email, user.role, salt, hash);
    }

    db.prepare('INSERT INTO courses (id, title, instructor_id) VALUES (?, ?, ?)').run(seed.courses[0].id, seed.courses[0].title, seed.courses[0].instructor_id);

    const enrollmentInsert = db.prepare('INSERT INTO enrollments (course_id, user_id, kind) VALUES (?, ?, ?)');
    for (const enrollment of seed.enrollments) enrollmentInsert.run(enrollment.course_id, enrollment.user_id, enrollment.kind);

    const accommodationInsert = db.prepare('INSERT INTO accommodations (course_id, student_id, extra_time_minutes, deadline_extension_minutes) VALUES (?, ?, ?, ?)');
    for (const accommodation of seed.accommodations) accommodationInsert.run(accommodation.course_id, accommodation.student_id, accommodation.extra_time_minutes, accommodation.deadline_extension_minutes);

    const assessmentInsert = db.prepare('INSERT INTO assessments (id, course_id, title, status, opens_at, due_at, duration_minutes, max_attempts, published_at, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const assessment of seed.assessments) {
      assessmentInsert.run(assessment.id, assessment.course_id, assessment.title, assessment.status, assessment.opens_at, assessment.due_at, assessment.duration_minutes, assessment.max_attempts, assessment.status === 'published' ? referenceMoment : null, referenceMoment, seed.courses[0].instructor_id);
    }

    const itemInsert = db.prepare('INSERT INTO items (id, assessment_id, kind, prompt, points, options_json, answer, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const item of seed.items) {
      itemInsert.run(item.id, item.assessment_id, item.kind, item.prompt, item.points, item.kind === 'multiple_choice' ? JSON.stringify(item.options) : null, item.answer || null, referenceMoment);
    }

    const criterionInsert = db.prepare('INSERT INTO rubric_criteria (id, item_id, label, max_points) VALUES (?, ?, ?, ?)');
    for (const rubric of seed.rubrics) {
      for (const criterion of rubric.criteria) criterionInsert.run(criterion.id, rubric.item_id, criterion.label, criterion.max_points);
    }

    const attemptInsert = db.prepare('INSERT INTO attempts (id, assessment_id, student_id, status, started_at, submitted_at, assigned_grader_id, feedback_status, submission_kind, objective_score, rubric_score, total_score, released_at, auto_submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const attempt of seed.attempts) {
      const objective = attempt.id === 'AT-102' ? 5 : null;
      const rubricScore = attempt.id === 'AT-102' ? 0 : null;
      const total = attempt.id === 'AT-102' ? 5 : null;
      attemptInsert.run(attempt.id, attempt.assessment_id, attempt.student_id, attempt.status, attempt.started_at, attempt.submitted_at, attempt.assigned_grader_id, attempt.feedback_status, attempt.status === 'graded' ? 'submitted' : null, objective, rubricScore, total, attempt.feedback_status === 'released' ? referenceMoment : null, null);
    }

    const answerInsert = db.prepare('INSERT INTO answers (attempt_id, item_id, value, updated_at) VALUES (?, ?, ?, ?)');
    for (const answer of seed.answers) answerInsert.run(answer.attempt_id, answer.item_id, answer.value, referenceMoment);

    const gradeInsert = db.prepare('INSERT INTO rubric_grades (attempt_id, criterion_id, score, feedback, graded_by, graded_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const grade of seed.rubric_grades) gradeInsert.run(grade.attempt_id, grade.criterion_id, grade.score, grade.feedback, grade.graded_by, grade.graded_at);

    const policyInsert = db.prepare('INSERT INTO outcome_policy (course_id, assessment_id, weight_pct, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)');
    policyInsert.run('BIO-214', 'A-01', 40, 'user_1', referenceMoment);
    policyInsert.run('BIO-214', 'A-03', 40, 'user_1', referenceMoment);
    policyInsert.run('BIO-214', 'A-04', 20, 'user_1', referenceMoment);
  });
  tx();
}

function maybeFinalizeExpiredAtBoot() {
  settleExpiredAttempts();
}

function recordToken(tx, userId) {
  const token = randomToken();
  tx.prepare('INSERT INTO auth_tokens (token_hash, user_id, issued_at) VALUES (?, ?, ?)').run(hashToken(token), userId, referenceMoment);
  return token;
}

function invalidateAllTokens(tx, userId) {
  tx.prepare('UPDATE auth_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(referenceMoment, userId);
}

function signInHandler({ tx, body }) {
  const email = normalizeText(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) return badRequest('missing_credentials', 'Email and password are required.');
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email);
  if (!user || !verifyPassword(password, user)) return unauthorized('Invalid email or password.');
  const token = recordToken(tx, user.id);
  return responseJson(200, {
    ok: true,
    token,
    tokenType: 'Bearer',
    user: userSummary(user),
    referenceMoment,
    revision: currentRevision(),
  });
}

function signOutHandler({ tx, user }) {
  invalidateAllTokens(tx, user.id);
  return responseJson(200, { ok: true, signedOut: true, revision: currentRevision() });
}

function createAssessmentHandler({ tx, user, body, expectedRevision }) {
  const course = courseForUser(user);
  const access = ensureAuthorCanEditAssessment(user, course);
  if (access) return access;
  if (expectedRevision !== currentRevision()) {
    return responseJson(409, { ok: false, error: { code: 'stale_revision', message: 'Another tab updated the course. Refresh and try again.' }, revision: currentRevision(), workspace: buildWorkspace(user) });
  }
  const parsed = validateAssessmentCreate(body);
  if (parsed.status) return parsed;
  const assessmentId = nextReadableId(tx, 'A', 'assessment');
  tx.prepare('INSERT INTO assessments (id, course_id, title, status, opens_at, due_at, duration_minutes, max_attempts, published_at, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(assessmentId, course.id, parsed.title, 'draft', parsed.opensAt, parsed.dueAt, parsed.durationMinutes, parsed.maxAttempts, null, referenceMoment, user.id);
  bumpRevision(tx);
  createAudit(tx, { course_id: course.id, actor_user_id: user.id, actor_role: user.role, event_type: 'assessment_created', target_type: 'assessment', target_id: assessmentId, summary: `Created draft ${assessmentId}` });
  return responseJson(201, { ok: true, revision: currentRevision(), assessmentId, workspace: buildWorkspace(user) });
}

function addItemHandler({ tx, user, body, expectedRevision }, assessmentId) {
  const course = courseForUser(user);
  const access = ensureAuthorCanEditAssessment(user, course);
  if (access) return access;
  const assessment = findAssessmentById(assessmentId);
  if (!assessment || assessment.course_id !== course.id) return notFound('Assessment not found.');
  if (assessment.status !== 'draft') return conflict('Published assessments cannot accept additional questions.');
  if (expectedRevision !== currentRevision()) {
    return responseJson(409, { ok: false, error: { code: 'stale_revision', message: 'Another tab updated the course. Refresh and try again.' }, revision: currentRevision(), workspace: buildWorkspace(user) });
  }
  const parsed = validateQuestionCreate(body);
  if (parsed.status) return parsed;
  const itemId = nextReadableId(tx, 'I', 'item');
  tx.prepare('INSERT INTO items (id, assessment_id, kind, prompt, points, options_json, answer, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(itemId, assessmentId, parsed.kind, parsed.prompt, parsed.points, parsed.kind === 'multiple_choice' ? JSON.stringify(parsed.options) : null, parsed.kind === 'multiple_choice' ? parsed.answer : null, referenceMoment);
  if (parsed.kind === 'written') {
    const criterionInsert = tx.prepare('INSERT INTO rubric_criteria (id, item_id, label, max_points) VALUES (?, ?, ?, ?)');
    for (const criterion of parsed.criteria) criterionInsert.run(nextReadableId(tx, 'RC', 'criterion'), itemId, criterion.label, criterion.maxPoints);
  }
  bumpRevision(tx);
  createAudit(tx, { course_id: course.id, actor_user_id: user.id, actor_role: user.role, event_type: 'question_added', target_type: 'assessment', target_id: assessmentId, summary: `Added question to ${assessmentId}` });
  return responseJson(201, { ok: true, revision: currentRevision(), itemId, workspace: buildWorkspace(user) });
}

function publishAssessmentHandler({ tx, user, expectedRevision }, assessmentId) {
  const course = courseForUser(user);
  const access = ensureAuthorCanEditAssessment(user, course);
  if (access) return access;
  const assessment = findAssessmentById(assessmentId);
  if (!assessment || assessment.course_id !== course.id) return notFound('Assessment not found.');
  if (assessment.status === 'published') return conflict('Assessment was already published.');
  if (expectedRevision !== currentRevision()) {
    return responseJson(409, { ok: false, error: { code: 'stale_revision', message: 'Another tab updated the course. Refresh and try again.' }, revision: currentRevision(), workspace: buildWorkspace(user) });
  }
  const itemCount = db.prepare('SELECT COUNT(*) AS count FROM items WHERE assessment_id = ?').get(assessmentId).count;
  if (!itemCount) return unprocessable('Publishing requires at least one question.');
  if (!(assessment.duration_minutes > 0)) return unprocessable('Publishing requires a positive duration.');
  tx.prepare('UPDATE assessments SET status = ?, published_at = ? WHERE id = ?').run('published', referenceMoment, assessmentId);
  tx.prepare('INSERT INTO outcome_policy (course_id, assessment_id, weight_pct, updated_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(course_id, assessment_id) DO NOTHING').run(course.id, assessmentId, 0, user.id, referenceMoment);
  bumpRevision(tx);
  createAudit(tx, { course_id: course.id, actor_user_id: user.id, actor_role: user.role, event_type: 'assessment_published', target_type: 'assessment', target_id: assessmentId, summary: `Published ${assessmentId}` });
  return responseJson(200, { ok: true, revision: currentRevision(), assessmentId, workspace: buildWorkspace(user) });
}

function startAttemptHandler({ tx, user, body, expectedRevision }, assessmentId) {
  const course = courseForUser(user);
  const access = ensureCourseAccess(user, course);
  if (access) return access;
  if (user.role !== 'student') return forbidden('Only students may start attempts.');
  const assessment = findAssessmentById(assessmentId);
  if (!assessment || assessment.course_id !== course.id) return notFound('Assessment not found.');
  if (assessment.status !== 'published') return conflict('Assessment is not published.');
  const accommodation = accommodationForStudent(course.id, user.id);
  const startedAllowed = Date.parse(referenceMoment) >= Date.parse(assessment.opens_at);
  const effectiveDue = new Date(Date.parse(assessment.due_at) + (accommodation.deadline_extension_minutes || 0) * 60000).toISOString();
  if (!startedAllowed) return conflict('Assessment has not opened yet.');
  if (Date.parse(referenceMoment) > Date.parse(effectiveDue)) return conflict('The adjusted due time has passed.');
  if (expectedRevision !== currentRevision()) {
    return responseJson(409, { ok: false, error: { code: 'stale_revision', message: 'Another tab updated the course. Refresh and try again.' }, revision: currentRevision(), workspace: buildWorkspace(user) });
  }
  const used = db.prepare('SELECT COUNT(*) AS count FROM attempts WHERE assessment_id = ? AND student_id = ?').get(assessmentId, user.id).count;
  const active = db.prepare('SELECT * FROM attempts WHERE assessment_id = ? AND student_id = ? AND status = ?').get(assessmentId, user.id, 'in_progress');
  if (active) {
    return responseJson(200, { ok: true, revision: currentRevision(), attemptId: active.id, workspace: buildWorkspace(user) });
  }
  if (used >= assessment.max_attempts) return conflict('No attempts remain for this assessment.');
  const attemptId = nextReadableId(tx, 'AT', 'attempt');
  const assignedGraderId = db.prepare('SELECT assigned_grader_id FROM attempts WHERE assessment_id = ? AND student_id = ? ORDER BY started_at DESC, id DESC LIMIT 1').get(assessmentId, user.id)?.assigned_grader_id || defaultGraderId(course.id);
  tx.prepare('INSERT INTO attempts (id, assessment_id, student_id, status, started_at, submitted_at, assigned_grader_id, feedback_status, submission_kind, objective_score, rubric_score, total_score, released_at, auto_submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(attemptId, assessmentId, user.id, 'in_progress', referenceMoment, null, assignedGraderId, 'hidden', null, null, null, null, null, null);
  bumpRevision(tx);
  createAudit(tx, { course_id: course.id, actor_user_id: user.id, actor_role: user.role, event_type: 'attempt_started', target_type: 'attempt', target_id: attemptId, summary: `Started ${attemptId}` });
  return responseJson(201, { ok: true, revision: currentRevision(), attemptId, workspace: buildWorkspace(user) });
}

function saveAnswerHandler({ tx, user, body, expectedRevision }, attemptId, itemId) {
  const attempt = findAttemptById(attemptId);
  if (!attempt) return notFound('Attempt not found.');
  if (attempt.student_id !== user.id) return forbidden('You may only save your own attempt.');
  if (attempt.status !== 'in_progress') return conflict('Only in-progress attempts accept answer saves.');
  const assessment = findAssessmentById(attempt.assessment_id);
  const course = courseForUser(user);
  const access = ensureCourseAccess(user, course);
  if (access) return access;
  const accommodation = accommodationForStudent(course.id, user.id);
  if (attemptIsExpired(attempt, assessment, accommodation)) return conflict('The attempt has expired and no longer accepts answers.');
  if (expectedRevision !== currentRevision()) {
    return responseJson(409, { ok: false, error: { code: 'stale_revision', message: 'Another tab updated the course. Refresh and try again.' }, revision: currentRevision(), workspace: buildWorkspace(user) });
  }
  const item = db.prepare('SELECT * FROM items WHERE id = ? AND assessment_id = ?').get(itemId, attempt.assessment_id);
  if (!item) return notFound('Question not found.');
  const value = typeof body.value === 'string' ? body.value : '';
  if (item.kind === 'multiple_choice') {
    if (!value || !JSON.parse(item.options_json).includes(value)) return unprocessable('Answer must match one of the available options.');
  }
  tx.prepare('INSERT INTO answers (attempt_id, item_id, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(attempt_id, item_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(attemptId, itemId, value, referenceMoment);
  bumpRevision(tx);
  createAudit(tx, { course_id: course.id, actor_user_id: user.id, actor_role: user.role, event_type: 'answer_saved', target_type: 'attempt', target_id: attemptId, summary: `Saved answer for ${attemptId}` });
  return responseJson(200, { ok: true, revision: currentRevision(), attemptId, itemId, workspace: buildWorkspace(user) });
}

function submitAttemptHandler({ tx, user, expectedRevision }, attemptId, auto = false) {
  const attempt = findAttemptById(attemptId);
  if (!attempt) return notFound('Attempt not found.');
  if (attempt.student_id !== user.id && user.role !== 'instructor') return forbidden('You may only submit your own attempt.');
  if (attempt.status !== 'in_progress') {
    if (attempt.status === 'submitted' || attempt.status === 'graded') {
      return responseJson(200, { ok: true, revision: currentRevision(), attemptId, submitted: true, replay: true, workspace: buildWorkspace(user) });
    }
    return conflict('This attempt cannot be submitted again.');
  }
  const assessment = findAssessmentById(attempt.assessment_id);
  const course = courseForUser(user);
  if (user.role !== 'instructor') {
    const access = ensureCourseAccess(user, course);
    if (access) return access;
    const accommodation = accommodationForStudent(course.id, user.id);
    if (!auto && attemptIsExpired(attempt, assessment, accommodation)) return conflict('The attempt has expired and auto-submitted already.');
  }
  if (expectedRevision !== currentRevision()) {
    return responseJson(409, { ok: false, error: { code: 'stale_revision', message: 'Another tab updated the course. Refresh and try again.' }, revision: currentRevision(), workspace: buildWorkspace(user) });
  }
  const answers = db.prepare('SELECT item_id, value FROM answers WHERE attempt_id = ?').all(attemptId);
  const answersByItem = new Map(answers.map(a => [a.item_id, a.value]));
  const objective = computeObjectiveScore(attempt.assessment_id, answersByItem);
  const criteria = db.prepare(`
    SELECT c.*
    FROM rubric_criteria c
    JOIN items i ON i.id = c.item_id
    WHERE i.assessment_id = ?
  `).all(attempt.assessment_id);
  const complete = criteria.length === 0;
  tx.prepare(`
    UPDATE attempts
    SET status = ?, submitted_at = ?, objective_score = ?, rubric_score = ?, total_score = ?, feedback_status = 'hidden', submission_kind = ?, auto_submitted_at = ?
    WHERE id = ?
  `).run(complete ? 'graded' : 'submitted', referenceMoment, objective, complete ? 0 : null, complete ? objective : null, auto ? 'auto-submitted' : 'submitted', auto ? referenceMoment : null, attemptId);
  bumpRevision(tx);
  createAudit(tx, { course_id: course.id, actor_user_id: user.id, actor_role: user.role, event_type: auto ? 'attempt_auto_submitted' : 'attempt_submitted', target_type: 'attempt', target_id: attemptId, summary: auto ? `Auto-submitted ${attemptId}` : `Submitted ${attemptId}` });
  return responseJson(200, { ok: true, revision: currentRevision(), attemptId, submitted: true, workspace: buildWorkspace(user) });
}

function gradeWorksheetHandler({ tx, user, body, expectedRevision }, attemptId) {
  const attempt = findAttemptById(attemptId);
  if (!attempt) return notFound('Attempt not found.');
  const access = ensureStaffCanGrade(user, attempt);
  if (access) return access;
  if (attempt.feedback_status === 'released') return conflict('Released grades are immutable.');
  if (expectedRevision !== currentRevision()) {
    return responseJson(409, { ok: false, error: { code: 'stale_revision', message: 'Another tab updated the course. Refresh and try again.' }, revision: currentRevision(), workspace: buildWorkspace(user) });
  }
  const validation = validateWorksheetBody(body, attempt);
  if (validation.status) return validation;
  const rows = validation.rows;
  for (const row of rows) {
    tx.prepare('INSERT INTO rubric_grades (attempt_id, criterion_id, score, feedback, graded_by, graded_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(attempt_id, criterion_id) DO UPDATE SET score = excluded.score, feedback = excluded.feedback, graded_by = excluded.graded_by, graded_at = excluded.graded_at').run(attemptId, row.criterionId, row.score, row.feedback, user.id, referenceMoment);
  }
  const recalc = recalcAttemptScores(tx, attemptId);
  bumpRevision(tx);
  createAudit(tx, { course_id: courseForUser(user).id, actor_user_id: user.id, actor_role: user.role, event_type: 'grade_saved', target_type: 'attempt', target_id: attemptId, summary: `Saved rubric grades for ${attemptId}` });
  return responseJson(200, { ok: true, revision: currentRevision(), attemptId, graded: recalc.complete, workspace: buildWorkspace(user) });
}

function releaseAttemptHandler({ tx, user, expectedRevision }, attemptId) {
  const course = courseForUser(user);
  if (user.role !== 'instructor') return forbidden('Only the instructor may release grades.');
  const attempt = findAttemptById(attemptId);
  if (!attempt) return notFound('Attempt not found.');
  if (!course || attempt.assessment_id && findAssessmentById(attempt.assessment_id)?.course_id !== course.id) return forbidden('Attempt does not belong to this course.');
  if (attempt.feedback_status === 'released') return responseJson(200, { ok: true, revision: currentRevision(), attemptId, released: true, workspace: buildWorkspace(user) });
  if (attempt.status !== 'graded') return conflict('Only fully graded attempts may be released.');
  if (expectedRevision !== currentRevision()) {
    return responseJson(409, { ok: false, error: { code: 'stale_revision', message: 'Another tab updated the course. Refresh and try again.' }, revision: currentRevision(), workspace: buildWorkspace(user) });
  }
  tx.prepare('UPDATE attempts SET feedback_status = ?, released_at = ? WHERE id = ?').run('released', referenceMoment, attemptId);
  bumpRevision(tx);
  createAudit(tx, { course_id: course.id, actor_user_id: user.id, actor_role: user.role, event_type: 'grade_released', target_type: 'attempt', target_id: attemptId, summary: `Released ${attemptId}` });
  return responseJson(200, { ok: true, revision: currentRevision(), attemptId, released: true, workspace: buildWorkspace(user) });
}

function savePolicyHandler({ tx, user, body, expectedRevision }) {
  const course = courseForUser(user);
  if (user.role !== 'instructor' || course.instructor_id !== user.id) return forbidden('Only the instructor may edit the outcome ledger.');
  const publishedAssessments = assessmentRows(course.id).filter(a => a.status === 'published').map(a => ({ id: a.id, title: a.title, status: a.status }));
  if (expectedRevision !== currentRevision()) {
    return responseJson(409, { ok: false, error: { code: 'stale_revision', message: 'Another tab updated the course. Refresh and try again.' }, revision: currentRevision(), workspace: buildWorkspace(user) });
  }
  const parsed = validatePolicyBody(body, publishedAssessments);
  if (parsed.status) return parsed;
  for (const row of parsed) {
    tx.prepare('INSERT INTO outcome_policy (course_id, assessment_id, weight_pct, updated_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(course_id, assessment_id) DO UPDATE SET weight_pct = excluded.weight_pct, updated_by = excluded.updated_by, updated_at = excluded.updated_at').run(course.id, row.assessmentId, row.weightPct, user.id, referenceMoment);
  }
  bumpRevision(tx);
  createAudit(tx, { course_id: course.id, actor_user_id: user.id, actor_role: user.role, event_type: 'outcome_policy_saved', target_type: 'course', target_id: course.id, summary: 'Updated weighted outcome policy' });
  return responseJson(200, { ok: true, revision: currentRevision(), workspace: buildWorkspace(user) });
}

function saveExceptionHandler({ tx, user, body, expectedRevision }) {
  const course = courseForUser(user);
  if (user.role !== 'instructor' || course.instructor_id !== user.id) return forbidden('Only the instructor may edit outcome exceptions.');
  if (expectedRevision !== currentRevision()) {
    return responseJson(409, { ok: false, error: { code: 'stale_revision', message: 'Another tab updated the course. Refresh and try again.' }, revision: currentRevision(), workspace: buildWorkspace(user) });
  }
  const parsed = validateExceptionBody(body, course);
  if (parsed.status) return parsed;
  tx.prepare('INSERT INTO outcome_exceptions (course_id, student_id, assessment_id, excused, reason, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(course_id, student_id, assessment_id) DO UPDATE SET excused = excluded.excused, reason = excluded.reason, updated_by = excluded.updated_by, updated_at = excluded.updated_at').run(course.id, parsed.studentId, parsed.assessmentId, parsed.excused ? 1 : 0, parsed.reason, user.id, referenceMoment);
  bumpRevision(tx);
  createAudit(tx, { course_id: course.id, actor_user_id: user.id, actor_role: user.role, event_type: 'outcome_exception_saved', target_type: 'course', target_id: course.id, summary: `Updated outcome exception for ${parsed.studentId}` });
  return responseJson(200, { ok: true, revision: currentRevision(), workspace: buildWorkspace(user) });
}

function createReleasePreviewHandler({ tx, user, body, expectedRevision }) {
  const course = courseForUser(user);
  if (user.role !== 'instructor' || course.instructor_id !== user.id) return forbidden('Only the instructor may create release previews.');
  if (expectedRevision !== currentRevision()) {
    return responseJson(409, { ok: false, error: { code: 'stale_revision', message: 'Another tab updated the course. Refresh and try again.' }, revision: currentRevision(), workspace: buildWorkspace(user) });
  }
  const selection = Array.isArray(body.attemptIds) ? body.attemptIds.map(v => normalizeText(v)).filter(Boolean) : null;
  if (!selection || !selection.length) return unprocessable('Preview requires at least one attempt.');
  const seen = new Set();
  const attempts = [];
  for (const id of selection) {
    if (seen.has(id)) return unprocessable('Preview selections cannot contain duplicates.');
    seen.add(id);
    const attempt = findAttemptById(id);
    if (!attempt) return unprocessable('Preview selections must reference existing attempts.');
    const assessment = findAssessmentById(attempt.assessment_id);
    if (!assessment || assessment.course_id !== course.id) return unprocessable('Preview selections must stay within the course.');
    if (attempt.feedback_status === 'released') return unprocessable('Preview selections cannot include released attempts.');
    if (attempt.status !== 'graded') return unprocessable('Preview selections must be fully graded.');
    attempts.push({
      attemptId: attempt.id,
      studentId: attempt.student_id,
      studentName: getUserById(attempt.student_id)?.name || null,
      assessmentId: attempt.assessment_id,
      assessmentTitle: assessment.title,
      totalScore: attempt.total_score,
    });
  }
  const previewId = nextReadableId(tx, 'PR', 'preview');
  const payload = { previewId, attempts, revision: currentRevision() };
  tx.prepare('INSERT INTO release_previews (id, course_id, instructor_id, revision_at_preview, selection_json, preview_body_json, consumed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(previewId, course.id, user.id, currentRevision(), JSON.stringify(selection), JSON.stringify(payload), null, referenceMoment);
  return responseJson(201, { ok: true, revision: currentRevision(), preview: payload, workspace: buildWorkspace(user) });
}

function commitReleasePreviewHandler({ tx, user, body, expectedRevision }, previewId) {
  const course = courseForUser(user);
  if (user.role !== 'instructor' || course.instructor_id !== user.id) return forbidden('Only the instructor may commit release previews.');
  const preview = releasePreviewById(previewId);
  if (!preview) return notFound('Preview not found.');
  if (preview.course_id !== course.id) return forbidden('Preview does not belong to this course.');
  if (preview.instructor_id !== user.id) return forbidden('Preview does not belong to this instructor.');
  if (preview.consumed_at) return conflict('This preview was already consumed.');
  if (preview.revision_at_preview !== currentRevision()) {
    return responseJson(412, { ok: false, error: { code: 'stale_preview', message: 'The preview is stale. Generate a fresh preview before committing.' }, revision: currentRevision(), workspace: buildWorkspace(user) });
  }
  if (expectedRevision !== currentRevision()) {
    return responseJson(409, { ok: false, error: { code: 'stale_revision', message: 'Another tab updated the course. Refresh and try again.' }, revision: currentRevision(), workspace: buildWorkspace(user) });
  }
  const selection = JSON.parse(preview.selection_json);
  if (!Array.isArray(selection) || !selection.length) return unprocessable('Preview selection is invalid.');
  const attempts = [];
  for (const attemptId of selection) {
    const attempt = findAttemptById(attemptId);
    if (!attempt || attempt.assessment_id == null) return unprocessable('Preview selection contains invalid attempts.');
    const assessment = findAssessmentById(attempt.assessment_id);
    if (!assessment || assessment.course_id !== course.id) return unprocessable('Preview selection contains foreign attempts.');
    if (attempt.feedback_status === 'released') return unprocessable('Preview selection contains already released attempts.');
    if (attempt.status !== 'graded') return unprocessable('Preview selection contains ungraded attempts.');
    attempts.push(attempt);
  }
  for (const attempt of attempts) {
    tx.prepare('UPDATE attempts SET feedback_status = ?, released_at = ? WHERE id = ?').run('released', referenceMoment, attempt.id);
    createAudit(tx, { course_id: course.id, actor_user_id: user.id, actor_role: user.role, event_type: 'grade_released', target_type: 'attempt', target_id: attempt.id, summary: `Released ${attempt.id}` });
  }
  tx.prepare('UPDATE release_previews SET consumed_at = ? WHERE id = ?').run(referenceMoment, previewId);
  bumpRevision(tx);
  return responseJson(200, { ok: true, revision: currentRevision(), released: attempts.map(a => a.id), workspace: buildWorkspace(user) });
}

function getProtectedWorkspace(req, res) {
  const auth = requireAuth(req);
  if (!auth) return res.status(401).json({ ok: false, error: { code: 'unauthorized', message: 'Sign-in required.' } });
  const workspace = buildWorkspace(auth.user);
  if (!workspace) return res.status(403).json({ ok: false, error: { code: 'forbidden', message: 'You are not enrolled in this course.' } });
  return res.json({ ok: true, ...workspace });
}

function listAssessmentsRoute(req, res) {
  const auth = requireAuth(req);
  if (!auth) return res.status(401).json({ ok: false, error: { code: 'unauthorized', message: 'Sign-in required.' } });
  const workspace = buildWorkspace(auth.user);
  if (!workspace) return res.status(403).json({ ok: false, error: { code: 'forbidden', message: 'You are not enrolled in this course.' } });
  return res.json({ ok: true, assessments: workspace.assessments, revision: workspace.course.revision });
}

function getAssessmentRoute(req, res) {
  const auth = requireAuth(req);
  if (!auth) return res.status(401).json({ ok: false, error: { code: 'unauthorized', message: 'Sign-in required.' } });
  const course = courseForUser(auth.user);
  if (!course) return res.status(403).json({ ok: false, error: { code: 'forbidden', message: 'You are not enrolled in this course.' } });
  const assessment = findAssessmentById(req.params.assessmentId);
  if (!assessment || assessment.course_id !== course.id) return res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Assessment not found.' } });
  if (auth.user.role === 'student' && assessment.status !== 'published') return res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Assessment not found.' } });
  return res.json({ ok: true, assessment: buildAssessmentPayload(assessment, auth.user), revision: currentRevision() });
}

function getAttemptRoute(req, res) {
  const auth = requireAuth(req);
  if (!auth) return res.status(401).json({ ok: false, error: { code: 'unauthorized', message: 'Sign-in required.' } });
  const course = courseForUser(auth.user);
  if (!course) return res.status(403).json({ ok: false, error: { code: 'forbidden', message: 'You are not enrolled in this course.' } });
  const attempt = findAttemptById(req.params.attemptId);
  if (!attempt) return res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Attempt not found.' } });
  if (auth.user.role === 'student' && attempt.student_id !== auth.user.id) return res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Attempt not found.' } });
  if (auth.user.role === 'teaching_assistant' && attempt.assigned_grader_id !== auth.user.id) return res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Attempt not found.' } });
  return res.json({ ok: true, attempt: buildAttemptPayload(attempt, auth.user, course), revision: currentRevision() });
}

function getGradebookRoute(req, res) {
  const auth = requireAuth(req);
  if (!auth) return res.status(401).json({ ok: false, error: { code: 'unauthorized', message: 'Sign-in required.' } });
  const workspace = buildWorkspace(auth.user);
  if (!workspace) return res.status(403).json({ ok: false, error: { code: 'forbidden', message: 'You are not enrolled in this course.' } });
  return res.json({ ok: true, gradebook: workspace.gradebook, outcomePolicy: workspace.outcomePolicy, outcomeExceptions: workspace.outcomeExceptions, revision: workspace.course.revision });
}

function getAuditRoute(req, res) {
  const auth = requireAuth(req);
  if (!auth) return res.status(401).json({ ok: false, error: { code: 'unauthorized', message: 'Sign-in required.' } });
  const workspace = buildWorkspace(auth.user);
  if (!workspace) return res.status(403).json({ ok: false, error: { code: 'forbidden', message: 'You are not enrolled in this course.' } });
  return res.json({ ok: true, audit: workspace.audit, revision: workspace.course.revision });
}

seedIfNeeded();
maybeFinalizeExpiredAtBoot();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(PUBLIC_DIR));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'coursemark', revision: currentRevision(), referenceMoment, dbPath: DB_PATH });
});

app.post('/api/auth/sign-in', (req, res) => handleWrite(req, res, { requireUser: false, signIn: true, handler: signInHandler }));
app.post('/api/auth/sign-out', (req, res) => handleWrite(req, res, { requireUser: true, handler: signOutHandler }));
app.get('/api/auth/me', (req, res) => {
  const auth = requireAuth(req);
  if (!auth) return res.status(401).json({ ok: false, error: { code: 'unauthorized', message: 'Sign-in required.' } });
  return res.json({ ok: true, user: userSummary(auth.user), revision: currentRevision(), referenceMoment });
});

app.get('/api/workspace', getProtectedWorkspace);
app.get('/api/assessments', listAssessmentsRoute);
app.get('/api/gradebook', getGradebookRoute);
app.get('/api/audit', getAuditRoute);
app.get('/api/assessments/:assessmentId', getAssessmentRoute);
app.get('/api/attempts/:attemptId', getAttemptRoute);

app.post('/api/assessments', (req, res) => handleWrite(req, res, { requireUser: true, handler: createAssessmentHandler }));
app.post('/api/assessments/:assessmentId/items', (req, res) => handleWrite(req, res, { requireUser: true, handler: (ctx) => addItemHandler(ctx, req.params.assessmentId) }));
app.post('/api/assessments/:assessmentId/publish', (req, res) => handleWrite(req, res, { requireUser: true, handler: (ctx) => publishAssessmentHandler(ctx, req.params.assessmentId) }));
app.post('/api/assessments/:assessmentId/start', (req, res) => handleWrite(req, res, { requireUser: true, handler: (ctx) => startAttemptHandler(ctx, req.params.assessmentId) }));
app.put('/api/attempts/:attemptId/answers/:itemId', (req, res) => handleWrite(req, res, { requireUser: true, handler: (ctx) => saveAnswerHandler(ctx, req.params.attemptId, req.params.itemId) }));
app.post('/api/attempts/:attemptId/submit', (req, res) => handleWrite(req, res, { requireUser: true, handler: (ctx) => submitAttemptHandler(ctx, req.params.attemptId, false) }));
app.post('/api/attempts/:attemptId/grades', (req, res) => handleWrite(req, res, { requireUser: true, handler: (ctx) => gradeWorksheetHandler(ctx, req.params.attemptId) }));
app.post('/api/attempts/:attemptId/release', (req, res) => handleWrite(req, res, { requireUser: true, handler: (ctx) => releaseAttemptHandler(ctx, req.params.attemptId) }));
app.post('/api/outcomes/policy', (req, res) => handleWrite(req, res, { requireUser: true, handler: savePolicyHandler }));
app.post('/api/outcomes/exceptions', (req, res) => handleWrite(req, res, { requireUser: true, handler: saveExceptionHandler }));
app.post('/api/release-previews', (req, res) => handleWrite(req, res, { requireUser: true, handler: createReleasePreviewHandler }));
app.post('/api/release-previews/:previewId/commit', (req, res) => handleWrite(req, res, { requireUser: true, handler: (ctx) => commitReleasePreviewHandler(ctx, req.params.previewId) }));

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.use((req, res) => {
  res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Route not found.' } });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Coursemark listening on http://0.0.0.0:${PORT}`);
});

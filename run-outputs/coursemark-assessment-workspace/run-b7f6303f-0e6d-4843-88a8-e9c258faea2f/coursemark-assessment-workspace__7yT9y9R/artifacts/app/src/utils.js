const crypto = require('crypto');
const { FIXED_REFERENCE_MOMENT } = require('./db');

function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  const keys = Object.keys(obj).sort();
  const sortedObj = {};
  for (const k of keys) {
    sortedObj[k] = canonicalize(obj[k]);
  }
  return sortedObj;
}

function computeInputHash(method, path, body) {
  const canonicalBody = canonicalize(body || {});
  const payload = JSON.stringify({
    method: String(method).toUpperCase(),
    path: String(path),
    body: canonicalBody
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function parseExpectedRevision(val) {
  if (val === null || val === undefined || typeof val === 'boolean' || Array.isArray(val) || typeof val === 'object') {
    return { valid: false, error: 'Expected revision is required and must be a non-negative whole integer' };
  }
  const str = String(val).trim();
  if (!/^\d+$/.test(str)) {
    return { valid: false, error: 'Expected revision must be a non-negative whole integer' };
  }
  const num = Number(str);
  if (!Number.isSafeInteger(num) || num < 0) {
    return { valid: false, error: 'Expected revision must be a non-negative whole integer' };
  }
  return { valid: true, revision: num };
}

function validateOperationId(val) {
  if (typeof val !== 'string' || val.trim().length < 4) {
    return { valid: false, error: 'Operation identifier must be a non-empty string with sufficient randomness' };
  }
  return { valid: true, operationId: val.trim() };
}

function isValidIsoDate(str) {
  if (typeof str !== 'string') return false;
  const d = new Date(str);
  return !isNaN(d.getTime()) && str.length >= 10;
}

function getCourseRevision(db, courseId = 'BIO-214') {
  const row = db.prepare('SELECT revision FROM courses WHERE id = ?').get(courseId);
  return row ? row.revision : 0;
}

function incrementCourseRevision(db, courseId = 'BIO-214') {
  db.prepare('UPDATE courses SET revision = revision + 1 WHERE id = ?').run(courseId);
  return getCourseRevision(db, courseId);
}

function recordAuditEvent(db, {
  timestamp = FIXED_REFERENCE_MOMENT,
  courseId = 'BIO-214',
  actorId,
  action,
  targetType = null,
  targetId = null,
  details,
  attemptId = null,
  assessmentId = null,
  studentId = null
}) {
  const stmt = db.prepare(`
    INSERT INTO audit_events (
      timestamp, course_id, actor_id, action, target_type, target_id, details, attempt_id, assessment_id, student_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    timestamp,
    courseId,
    actorId,
    action,
    targetType,
    targetId,
    details,
    attemptId,
    assessmentId,
    studentId
  );
}

module.exports = {
  canonicalize,
  computeInputHash,
  parseExpectedRevision,
  validateOperationId,
  isValidIsoDate,
  getCourseRevision,
  incrementCourseRevision,
  recordAuditEvent
};

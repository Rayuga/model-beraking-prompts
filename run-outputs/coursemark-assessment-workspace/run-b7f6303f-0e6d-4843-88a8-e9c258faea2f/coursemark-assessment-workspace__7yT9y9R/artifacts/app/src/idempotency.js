const { computeInputHash, validateOperationId, parseExpectedRevision, getCourseRevision } = require('./utils');
const { FIXED_REFERENCE_MOMENT } = require('./db');

/**
 * Validates operation_id and expected_revision for write operations,
 * and checks if an existing receipt matches or conflicts.
 * 
 * Returns:
 * - { replay: true } if exact match was found and response has already been sent
 * - { error: true } if validation or conflict occurred and error response has been sent
 * - { operationId, expectedRevision, currentRevision, inputHash } if request is valid and new to execute
 */
function checkIdempotencyAndRevision(db, req, res, options = { checkRevision: true, courseId: 'BIO-214' }) {
  const operationIdRaw = (req.body && req.body.operation_id) || req.headers['x-operation-id'] || req.headers['idempotency-key'];
  const opCheck = validateOperationId(operationIdRaw);
  if (!opCheck.valid) {
    const errBody = { error: opCheck.error };
    res.status(400).json(errBody);
    return { error: true };
  }
  const operationId = opCheck.operationId;
  const inputHash = computeInputHash(req.method, req.path, req.body);

  // Check if operation receipt exists
  const existingReceipt = db.prepare('SELECT * FROM operation_receipts WHERE operation_id = ?').get(operationId);
  if (existingReceipt) {
    if (existingReceipt.user_id !== req.user.id) {
      const errBody = { error: 'Operation identifier belongs to another user' };
      res.status(409).json(errBody);
      return { error: true };
    }
    if (existingReceipt.method !== req.method.toUpperCase() || existingReceipt.path !== req.path || existingReceipt.input_hash !== inputHash) {
      const errBody = { error: 'Operation identifier reused for different input or target' };
      res.status(409).json(errBody);
      return { error: true };
    }
    // Exact replay: return saved response
    res.status(existingReceipt.response_status).json(JSON.parse(existingReceipt.response_body));
    return { replay: true };
  }

  // Check revision if required
  let expectedRevision = null;
  const currentRevision = getCourseRevision(db, options.courseId);

  if (options.checkRevision) {
    const revisionRaw = (req.body && req.body.expected_revision !== undefined) ? req.body.expected_revision : req.headers['x-expected-revision'];
    const revCheck = parseExpectedRevision(revisionRaw);
    if (!revCheck.valid) {
      const errBody = { error: revCheck.error, current_revision: currentRevision };
      saveReceipt(db, req.user.id, operationId, req.method, req.path, inputHash, 400, errBody);
      res.status(400).json(errBody);
      return { error: true };
    }
    expectedRevision = revCheck.revision;

    if (expectedRevision !== currentRevision) {
      const errBody = {
        error: 'Stale revision: another user or tab has updated the course data. Please refresh and retry.',
        expected_revision: expectedRevision,
        current_revision: currentRevision
      };
      // Save stale failure receipt so exact replay returns same failure
      saveReceipt(db, req.user.id, operationId, req.method, req.path, inputHash, 409, errBody);
      res.status(409).json(errBody);
      return { error: true };
    }
  }

  return {
    valid: true,
    operationId,
    expectedRevision,
    currentRevision,
    inputHash
  };
}

function saveReceipt(db, userId, operationId, method, path, inputHash, status, responseBodyObj) {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO operation_receipts (
        user_id, operation_id, method, path, input_hash, response_status, response_body, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      userId,
      operationId,
      method.toUpperCase(),
      path,
      inputHash,
      status,
      JSON.stringify(responseBodyObj),
      FIXED_REFERENCE_MOMENT
    );
  } catch (err) {
    console.error('Failed to save operation receipt:', err);
  }
}

function sendAndRecord(db, req, res, status, data, operationContext) {
  if (operationContext && operationContext.operationId) {
    saveReceipt(
      db,
      req.user.id,
      operationContext.operationId,
      req.method,
      req.path,
      operationContext.inputHash,
      status,
      data
    );
  }
  return res.status(status).json(data);
}

module.exports = {
  checkIdempotencyAndRevision,
  saveReceipt,
  sendAndRecord
};

const FORBIDDEN_WRITE_FIELDS = new Set([
  'history',
  'stage_history',
  'funnel',
  'attribution',
  'revision',
  'revisions',
  'assessment_version',
  'capacity',
  'reserved',
  'filled',
  'available',
  'days_since_applied',
  'created_at',
  'updated_at'
]);

function checkForServerOwnedFields(body, allowedFields = []) {
  if (!body || typeof body !== 'object') return null;

  for (const key of Object.keys(body)) {
    if (FORBIDDEN_WRITE_FIELDS.has(key)) {
      return `Server-owned field '${key}' cannot be supplied in client write requests`;
    }
  }

  // If allowedFields is provided, ensure only allowed fields (plus expected_revision, operation_id, idempotency_key) are present
  if (allowedFields && allowedFields.length > 0) {
    const allowed = new Set([...allowedFields, 'expected_revision', 'operation_id', 'idempotency_key']);
    for (const key of Object.keys(body)) {
      if (!allowed.has(key)) {
        return `Unexpected or server-owned field '${key}' in write request`;
      }
    }
  }

  return null;
}

function parseExpectedRevision(req) {
  // Check header first
  const ifMatch = req.headers['if-match'];
  const headerRevision = req.headers['x-expected-revision'] || (ifMatch ? ifMatch.replace(/"/g, '') : null);

  if (headerRevision !== null && headerRevision !== undefined) {
    if (!/^\d+$/.test(String(headerRevision).trim())) {
      return { error: 'Malformed revision in request header: must be a non-negative integer' };
    }
    return { revision: parseInt(String(headerRevision).trim(), 10) };
  }

  // Check JSON body
  if (req.body && 'expected_revision' in req.body) {
    const rev = req.body.expected_revision;
    if (typeof rev !== 'number' || !Number.isInteger(rev) || rev < 0) {
      return { error: 'Invalid expected_revision in JSON body: must be a non-negative integer number' };
    }
    return { revision: rev };
  }

  // If revision is required and not provided
  return { revision: null };
}

function getOperationKey(req) {
  const headerKey = req.headers['idempotency-key'] || req.headers['x-operation-id'];
  if (headerKey) return String(headerKey).trim();
  if (req.body && (req.body.idempotency_key || req.body.operation_id)) {
    return String(req.body.idempotency_key || req.body.operation_id).trim();
  }
  return null;
}

module.exports = {
  FORBIDDEN_WRITE_FIELDS,
  checkForServerOwnedFields,
  parseExpectedRevision,
  getOperationKey
};

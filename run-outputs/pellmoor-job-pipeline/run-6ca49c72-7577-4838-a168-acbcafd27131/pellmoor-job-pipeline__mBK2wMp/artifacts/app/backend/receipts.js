const { getDb, computePayloadHash } = require('./db');
const { getOperationKey } = require('./validation');

function handleIdempotency(req, res, next) {
  const opKey = getOperationKey(req);
  if (!opKey || !req.user) {
    return next();
  }

  const db = getDb();
  const existing = db.prepare(`
    SELECT status_code, response_json, payload_hash
    FROM operation_receipts
    WHERE user_email = ? AND operation_key = ?
  `).get(req.user.email, opKey);

  if (existing) {
    const currentHash = computePayloadHash(req.method, req.originalUrl, req.body);
    if (existing.payload_hash === currentHash) {
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(existing.response_json);
      } catch (e) {
        parsedResponse = { message: existing.response_json };
      }
      return res.status(existing.status_code).json(parsedResponse);
    } else {
      return res.status(409).json({
        error: 'Operation key mismatch: this operation identity was previously used with different parameters or payload array ordering.'
      });
    }
  }

  // Attach a helper to save receipt
  res.saveReceipt = (statusCode, responseBody) => {
    try {
      const payloadHash = computePayloadHash(req.method, req.originalUrl, req.body);
      const now = new Date().toISOString();
      db.prepare(`
        INSERT OR REPLACE INTO operation_receipts
        (user_email, operation_key, method, path, payload_hash, status_code, response_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.email,
        opKey,
        (req.method || '').toUpperCase(),
        (req.originalUrl || '').split('?')[0],
        payloadHash,
        statusCode,
        JSON.stringify(responseBody),
        now
      );
    } catch (e) {
      console.error('Error saving operation receipt:', e);
    }
  };

  next();
}

function sendResponseWithReceipt(res, statusCode, body) {
  if (res.saveReceipt) {
    res.saveReceipt(statusCode, body);
  }
  return res.status(statusCode).json(body);
}

module.exports = {
  handleIdempotency,
  sendResponseWithReceipt
};

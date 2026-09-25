const crypto = require('crypto');
const { getDb } = require('./db');

function hashInput(data) {
  const str = JSON.stringify(data, Object.keys(data || {}).sort());
  return crypto.createHash('sha256').update(str).digest('hex');
}

function checkReceipt(accountId, operationId, inputHash) {
  if (!operationId) return null;
  const db = getDb();
  const receipt = db.prepare(`
    SELECT status_code, response_json, input_hash
    FROM operation_receipts
    WHERE account_id = ? AND operation_id = ?
  `).get(accountId, operationId);

  if (!receipt) return null;

  if (receipt.input_hash !== inputHash) {
    return {
      conflict: true,
      statusCode: 409,
      responseJson: { error: 'Operation identifier reused with different input' }
    };
  }

  return {
    conflict: false,
    statusCode: receipt.status_code,
    responseJson: JSON.parse(receipt.response_json)
  };
}

function saveReceipt(accountId, operationId, scope, inputHash, statusCode, responseObj) {
  if (!operationId) return;
  const db = getDb();
  try {
    db.prepare(`
      INSERT OR REPLACE INTO operation_receipts (
        account_id, operation_id, scope, input_hash, status_code, response_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      accountId,
      operationId,
      scope,
      inputHash,
      statusCode,
      JSON.stringify(responseObj)
    );
  } catch (err) {
    console.error('Failed to save receipt:', err);
  }
}

module.exports = {
  hashInput,
  checkReceipt,
  saveReceipt
};

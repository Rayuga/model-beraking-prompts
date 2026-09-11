import crypto from 'crypto';
import { db } from './db.js';

export function writeAudit(user, action, entity, entityId, previousState, newState, reason) {
  db.prepare(`
    INSERT INTO audit_log (
      id, actor_id, actor_name, actor_role, action, entity, entity_id,
      previous_state, new_state, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    user.id,
    user.full_name,
    user.role,
    action,
    entity,
    entityId,
    previousState == null ? null : String(previousState),
    newState == null ? null : String(newState),
    reason || null
  );
}

export function listAudit({ entity, entityId, limit = 200 } = {}) {
  if (entity && entityId) {
    return db.prepare(`
      SELECT * FROM audit_log
      WHERE entity = ? AND entity_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(entity, entityId, limit);
  }
  if (entity) {
    return db.prepare(`
      SELECT * FROM audit_log WHERE entity = ? ORDER BY created_at DESC LIMIT ?
    `).all(entity, limit);
  }
  return db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').all(limit);
}

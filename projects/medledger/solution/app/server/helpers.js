import { db, getNowMs } from './db.js';
import { forbidden, notFound } from './errors.js';

export function uid(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

export function iso(ms) {
  if (ms === null || ms === undefined) return null;
  return new Date(Number(ms)).toISOString();
}

export function insertAudit({ actorUserId, action, entityType, entityId, previousState, newState, reason }) {
  db.prepare(`
    INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, previous_state, new_state, reason, created_at_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uid('AE'), actorUserId, action, entityType, entityId, previousState || null, newState || null, reason || null, getNowMs());
}

// Citywide roles reach every site; the rest are scoped to their assigned site.
const CITYWIDE_ROLES = new Set(['ADMINISTRATOR', 'BILLING_CLERK', 'COMPLIANCE_OFFICER', 'TRANSPORT_DISPATCHER']);

export function userSiteIds(user) {
  if (!user) return [];
  if (CITYWIDE_ROLES.has(user.role)) {
    return db.prepare(`SELECT id FROM sites`).all().map((s) => s.id);
  }
  return db.prepare(`SELECT site_id FROM user_site_assignments WHERE user_id = ?`).all(user.id).map((r) => r.site_id);
}

export function userHasSite(user, siteId) {
  if (!user || !siteId) return false;
  if (CITYWIDE_ROLES.has(user.role)) return true;
  return userSiteIds(user).includes(siteId);
}

export function isCitywide(user) {
  return Boolean(user) && CITYWIDE_ROLES.has(user.role);
}

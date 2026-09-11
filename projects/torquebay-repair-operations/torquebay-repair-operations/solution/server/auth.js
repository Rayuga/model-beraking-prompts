import { db, publicUser } from './db.js';
import { DEFAULT_USER_ID, ROLES } from './ids.js';
import { forbidden, unauthorized } from './errors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getCurrentUser(req) {
  const requestedId = req.get('x-demo-user-id') || DEFAULT_USER_ID;
  if (!UUID_RE.test(requestedId)) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(requestedId) || null;
}

export function requireUser(req, _res, next) {
  const user = getCurrentUser(req);
  if (!user) return next(unauthorized('Select a valid demo user to continue'));
  req.user = user;
  next();
}

export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(forbidden(`${roles.join(' or ')} access required`));
    }
    next();
  };
}

export function isStaff(user) {
  return user.role !== ROLES.CUSTOMER;
}

export function assertCustomerScope(user, customerId) {
  if (user.role === ROLES.CUSTOMER && user.customer_id !== customerId) {
    throw forbidden('Cannot access another customer account');
  }
}

export function sessionPayload(user) {
  return { user: publicUser(user) };
}

export { ROLES };

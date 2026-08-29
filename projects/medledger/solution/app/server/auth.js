import { getUserById } from './db.js';
import { unauthorized, forbidden } from './errors.js';

export function requireAuth(req, _res, next) {
  try {
    const id = req.headers['x-user-id'] || req.headers['X-User-Id'];
    if (!id) throw unauthorized('Missing X-User-Id header');
    const user = getUserById(String(id));
    // An unknown identity gets nothing — never a silent fallback to the
    // Administrator's session.
    if (!user) throw unauthorized('Unknown user');
    if (user.disabled) throw forbidden('User disabled');
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireRoles(roles) {
  const list = Array.isArray(roles) ? roles : [roles];
  return (req, _res, next) => {
    if (!req.user) return next(forbidden('No session'));
    if (!list.includes(req.user.role)) return next(forbidden(`Role ${req.user.role} not allowed`));
    return next();
  };
}

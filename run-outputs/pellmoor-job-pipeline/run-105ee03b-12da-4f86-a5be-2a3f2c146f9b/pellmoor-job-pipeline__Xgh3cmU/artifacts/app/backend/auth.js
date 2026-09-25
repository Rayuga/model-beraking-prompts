import crypto from 'crypto';
import { dbRun, dbGet } from './database.js';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function createSession(email) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  await dbRun(
    `INSERT INTO sessions (token, email, created_at, expires_at)
     VALUES (?, ?, ?, ?)`,
    [token, email, now.toISOString(), expiresAt.toISOString()]
  );

  return token;
}

export async function validateSession(token) {
  if (!token) return null;

  const session = await dbGet(
    `SELECT s.email, u.name, u.role
     FROM sessions s
     JOIN users u ON s.email = u.email
     WHERE s.token = ? AND s.expires_at > datetime('now')`,
    [token]
  );

  return session || null;
}

export async function revokeSession(token) {
  await dbRun(`DELETE FROM sessions WHERE token = ?`, [token]);
}

export async function authenticateUser(email, password) {
  const passwordHash = hashPassword(password);
  const user = await dbGet(
    `SELECT email, name, role FROM users WHERE email = ? AND password_hash = ?`,
    [email, passwordHash]
  );

  return user || null;
}

export function sessionMiddleware(req, res, next) {
  const authHeader = req.get('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  req.sessionToken = token;
  req.user = null;

  if (token) {
    validateSession(token).then((session) => {
      req.user = session;
      next();
    });
  } else {
    next();
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

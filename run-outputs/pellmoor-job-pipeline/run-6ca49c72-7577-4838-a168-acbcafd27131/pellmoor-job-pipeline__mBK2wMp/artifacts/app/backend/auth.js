const crypto = require('crypto');
const { getDb } = require('./db');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(userEmail) {
  const db = getDb();
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  db.prepare(`
    INSERT INTO sessions (token, user_email, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userEmail, now.toISOString(), expiresAt.toISOString());

  return token;
}

function revokeSession(token) {
  if (!token) return;
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function getSessionUser(token) {
  if (!token) return null;
  const db = getDb();
  const row = db.prepare(`
    SELECT s.token, s.expires_at, p.email, p.name, p.role
    FROM sessions s
    JOIN people p ON s.user_email = p.email
    WHERE s.token = ?
  `).get(token);

  if (!row) return null;

  if (new Date(row.expires_at) < new Date()) {
    revokeSession(token);
    return null;
  }

  return {
    email: row.email,
    name: row.name,
    role: row.role
  };
}

function authMiddleware(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies.session_token) {
    token = req.cookies.session_token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = getSessionUser(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.user = user;
  req.sessionToken = token;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Action unauthorized for role '${req.user.role}'` });
    }
    next();
  };
}

module.exports = {
  generateToken,
  createSession,
  revokeSession,
  getSessionUser,
  authMiddleware,
  requireRole
};

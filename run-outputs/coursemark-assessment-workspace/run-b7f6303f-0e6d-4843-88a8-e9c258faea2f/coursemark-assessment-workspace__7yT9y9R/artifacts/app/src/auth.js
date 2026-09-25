const crypto = require('crypto');
const { FIXED_REFERENCE_MOMENT } = require('./db');
const { getCourseRevision } = require('./utils');

function authMiddleware(db) {
  const findTokenStmt = db.prepare(`
    SELECT t.token, t.user_id, u.id, u.name, u.email, u.role
    FROM tokens t
    JOIN users u ON t.user_id = u.id
    WHERE t.token = ?
  `);

  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required: missing Authorization header' });
    }

    const parts = authHeader.split(' ');
    const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : parts[0];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required: missing token' });
    }

    const user = findTokenStmt.get(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: invalid or expired session token' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    req.token = token;
    next();
  };
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }
    next();
  };
}

const requireInstructor = requireRole('instructor');
const requireStaff = requireRole('instructor', 'teaching_assistant');
const requireStudent = requireRole('student');

function handleLogin(db, req, res) {
  const { email, password } = req.body || {};
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT id, name, email, role, password FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO tokens (token, user_id, created_at) VALUES (?, ?, ?)').run(
    token,
    user.id,
    FIXED_REFERENCE_MOMENT
  );

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
}

function handleLogout(db, req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Revoke ALL tokens for this account
  db.prepare('DELETE FROM tokens WHERE user_id = ?').run(req.user.id);

  return res.json({
    success: true,
    message: 'All active sessions for this account have been revoked'
  });
}

function handleMe(db, req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const course = db.prepare('SELECT id, title, instructor_id, revision FROM courses WHERE id = ?').get('BIO-214');
  return res.json({
    user: req.user,
    course: course || { id: 'BIO-214', title: 'Ecology and Field Methods', revision: 0 }
  });
}

module.exports = {
  authMiddleware,
  requireRole,
  requireInstructor,
  requireStaff,
  requireStudent,
  handleLogin,
  handleLogout,
  handleMe
};

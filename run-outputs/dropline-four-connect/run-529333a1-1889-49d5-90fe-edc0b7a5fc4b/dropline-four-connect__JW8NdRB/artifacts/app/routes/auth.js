const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');

const router = express.Router();

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const db = getDb();
  const session = db.prepare(`
    SELECT t.token, a.id, a.email, a.name
    FROM tokens t
    JOIN accounts a ON t.account_id = a.id
    WHERE t.token = ?
  `).get(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or revoked token' });
  }

  req.account = {
    id: session.id,
    email: session.email,
    name: session.name
  };
  req.token = token;

  next();
}

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = getDb();
  const account = db.prepare('SELECT id, email, password, name FROM accounts WHERE email = ? COLLATE NOCASE').get(email.trim());

  if (!account || account.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO tokens (token, account_id) VALUES (?, ?)').run(token, account.id);

  return res.json({
    token,
    account: {
      id: account.id,
      email: account.email,
      name: account.name
    }
  });
});

router.post('/logout', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM tokens WHERE account_id = ?').run(req.account.id);
  return res.json({ success: true, message: 'Signed out everywhere' });
});

router.get('/session', authMiddleware, (req, res) => {
  return res.json({
    account: req.account
  });
});

module.exports = {
  router,
  authMiddleware
};

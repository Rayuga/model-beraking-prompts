const express = require('express');
const { getDb } = require('../db');
const { createSession, revokeSession, authMiddleware } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = getDb();
  const person = db.prepare('SELECT email, name, role, password FROM people WHERE email = ?').get(email.trim().toLowerCase());

  if (!person || person.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = createSession(person.email);
  return res.json({
    token,
    user: {
      email: person.email,
      name: person.name,
      role: person.role
    }
  });
});

router.post('/logout', authMiddleware, (req, res) => {
  revokeSession(req.sessionToken);
  return res.json({ success: true, message: 'Logged out successfully' });
});

router.get('/me', authMiddleware, (req, res) => {
  return res.json({
    user: req.user
  });
});

router.get('/people', authMiddleware, (req, res) => {
  const db = getDb();
  const people = db.prepare('SELECT email, name, role FROM people').all();
  return res.json({ people });
});

module.exports = router;

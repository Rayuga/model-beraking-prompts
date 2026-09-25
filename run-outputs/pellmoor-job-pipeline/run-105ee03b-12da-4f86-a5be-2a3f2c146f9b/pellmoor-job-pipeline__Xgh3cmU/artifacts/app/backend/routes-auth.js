import express from 'express';
import { authenticateUser, createSession, revokeSession, validateSession } from './auth.js';
import { requireAuth } from './auth.js';

const router = express.Router();

// Login endpoint
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await authenticateUser(email, password);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = await createSession(email);

    res.json({
      token,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
router.post('/auth/logout', requireAuth, async (req, res) => {
  try {
    await revokeSession(req.sessionToken);
    res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check session endpoint
router.get('/auth/session', async (req, res) => {
  const authHeader = req.get('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const session = await validateSession(token);

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    res.json({
      user: {
        email: session.email,
        name: session.name,
        role: session.role,
      },
    });
  } catch (err) {
    console.error('Session check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

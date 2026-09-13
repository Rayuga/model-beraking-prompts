const db = require('./db');

async function signin(email, password) {
  try {
    const user = await db.getUserByEmail(email);
    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    const hash = db.hashPassword(password, user.password_salt);
    if (hash !== user.password_hash) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    const token = await db.createToken(user.id);
    
    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        initials: user.initials
      }
    };
  } catch (err) {
    console.error('Signin error:', err);
    return { success: false, error: 'Server error' };
  }
}

async function signout(userId) {
  try {
    await db.revokeUserTokens(userId);
  } catch (err) {
    console.error('Signout error:', err);
  }
}

async function authenticateToken(token) {
  try {
    if (!token) return null;
    
    const result = await db.getTokenUser(token);
    if (!result) return null;
    
    const user = await db.getUserById(result.user_id);
    return user;
  } catch (err) {
    console.error('Auth error:', err);
    return null;
  }
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.slice(7);
  
  authenticateToken(token).then(user => {
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    req.user = user;
    next();
  }).catch(err => {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Server error' });
  });
}

module.exports = {
  signin,
  signout,
  authenticateToken,
  requireAuth
};

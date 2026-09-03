const crypto = require('crypto');
const { getDb } = require('./db');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function signIn(email, password) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    db.get(
      "SELECT id, email, name, initials, password_hash, password_salt FROM users WHERE email = ?",
      [email],
      (err, user) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }

        if (!user) {
          db.close();
          resolve(null);
          return;
        }

        const hash = hashPassword(password, user.password_salt);
        if (hash !== user.password_hash) {
          db.close();
          resolve(null);
          return;
        }

        // Generate token
        const token = generateToken();
        
        // Revoke existing tokens for this user
        db.run("DELETE FROM tokens WHERE user_id = ?", [user.id], (err) => {
          if (err) {
            db.close();
            reject(err);
            return;
          }

          // Store new token
          db.run(
            "INSERT INTO tokens (user_id, token) VALUES (?, ?)",
            [user.id, token],
            (err) => {
              db.close();
              if (err) {
                reject(err);
              } else {
                resolve({
                  token,
                  user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    initials: user.initials
                  }
                });
              }
            }
          );
        });
      }
    );
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    db.get(
      `SELECT u.id, u.email, u.name, u.initials, u.highest_level, u.best_score
       FROM tokens t
       JOIN users u ON t.user_id = u.id
       WHERE t.token = ?`,
      [token],
      (err, row) => {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      }
    );
  });
}

function signOut(token) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    db.run(
      "DELETE FROM tokens WHERE token = ?",
      [token],
      (err) => {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

function getRunRevision(userId) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    db.get(
      "SELECT MAX(revision) as max_revision FROM run_snapshots WHERE user_id = ?",
      [userId],
      (err, row) => {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve((row?.max_revision || 0) + 1);
        }
      }
    );
  });
}

module.exports = {
  hashPassword,
  generateToken,
  signIn,
  verifyToken,
  signOut,
  getRunRevision
};

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const XLSX = require('xlsx');
const crypto = require('crypto');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'brickfall.db');
let db;

// ============ INITIALIZATION ============

function init() {
  const dbExists = fs.existsSync(DB_PATH);
  
  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Database error:', err);
      process.exit(1);
    }
    console.log('Connected to SQLite database');
  });
  
  db.serialize(() => {
    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        initials TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        highest_level INTEGER DEFAULT 1,
        best_score INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS levels (
        id INTEGER PRIMARY KEY,
        level INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        base_speed INTEGER NOT NULL,
        speed_cap INTEGER NOT NULL,
        accent TEXT NOT NULL
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS bricks (
        id INTEGER PRIMARY KEY,
        level INTEGER NOT NULL,
        row INTEGER NOT NULL,
        column INTEGER NOT NULL,
        type TEXT NOT NULL,
        drop_type TEXT,
        FOREIGN KEY (level) REFERENCES levels(level)
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        run_id TEXT UNIQUE NOT NULL,
        revision INTEGER NOT NULL,
        level INTEGER NOT NULL,
        score INTEGER DEFAULT 0,
        lives INTEGER DEFAULT 3,
        combo INTEGER DEFAULT 1,
        next_extra_life INTEGER DEFAULT 20000,
        power_type TEXT,
        power_seconds REAL,
        paddle_width INTEGER,
        state TEXT,
        finished_at TEXT,
        outcome TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS run_history (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        run_id TEXT NOT NULL,
        outcome TEXT NOT NULL,
        level INTEGER NOT NULL,
        score INTEGER NOT NULL,
        snapshot TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        run_id TEXT UNIQUE NOT NULL,
        initials TEXT NOT NULL,
        score INTEGER NOT NULL,
        level INTEGER NOT NULL,
        achieved_at TEXT NOT NULL
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS constants (
        id INTEGER PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS operation_receipts (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        operation_id TEXT NOT NULL,
        status INTEGER NOT NULL,
        response TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, operation_id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS drills (
        id INTEGER PRIMARY KEY,
        drill_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        state TEXT NOT NULL,
        step_counter INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Only seed if database is new
    if (!dbExists) {
      seedDatabase();
    }
  });
}

function seedDatabase() {
  console.log('Seeding database...');
  
  // Read seed data
  const seedPath = path.join(__dirname, '..', 'assets', 'artifacts', 'brickfall_seed.xlsx');
  const workbook = XLSX.readFile(seedPath);
  
  // Seed users
  const usersSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Users']);
  usersSheet.forEach(row => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(row.password, salt);
    db.run(
      'INSERT OR IGNORE INTO users (email, name, initials, password_hash, password_salt, highest_level, best_score) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [row.email, row.name, row.initials, hash, salt, row.highest_level, row.best_score]
    );
  });
  
  // Add polly user
  const pollySalt = crypto.randomBytes(16).toString('hex');
  const pollyHash = hashPassword('password123', pollySalt);
  db.run(
    'INSERT OR IGNORE INTO users (email, name, initials, password_hash, password_salt, highest_level, best_score) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['polly@brickfall.test', 'Polly Green', 'PLY', pollyHash, pollySalt, 10, 31800]
  );
  
  // Seed levels
  const levelsSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Levels']);
  levelsSheet.forEach(row => {
    db.run(
      'INSERT OR IGNORE INTO levels (level, name, base_speed, speed_cap, accent) VALUES (?, ?, ?, ?, ?)',
      [row.level, row.name, row.base_speed, row.speed_cap, row.accent]
    );
  });
  
  // Seed bricks
  const bricksSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Bricks']);
  bricksSheet.forEach(row => {
    const drop = row.drop === '' || row.drop === null ? null : row.drop;
    db.run(
      'INSERT OR IGNORE INTO bricks (level, row, column, type, drop_type) VALUES (?, ?, ?, ?, ?)',
      [row.level, row.row, row.column, row.type, drop]
    );
  });
  
  // Seed constants
  const constantsSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Constants']);
  constantsSheet.forEach(row => {
    db.run(
      'INSERT OR IGNORE INTO constants (key, value) VALUES (?, ?)',
      [row.key, String(row.value)]
    );
  });
  
  // Seed leaderboard
  const leaderboardSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Leaderboard']);
  leaderboardSheet.forEach(row => {
    db.run(
      'INSERT OR IGNORE INTO leaderboard (user_id, run_id, initials, score, level, achieved_at) VALUES ((SELECT id FROM users WHERE email = ?), ?, ?, ?, ?, ?)',
      [row.email, `${row.email}-${Date.now()}`, row.initials, row.score, row.level, row.achieved_at]
    );
  });
  
  // Seed scenarios/drills
  const scenariosPath = path.join(__dirname, '..', 'assets', 'artifacts', 'brickfall_scenarios.json');
  const scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'));
  
  scenarios.drills.forEach(drill => {
    const state = JSON.stringify(drill);
    db.run(
      'INSERT OR IGNORE INTO drills (drill_id, name, state, step_counter) VALUES (?, ?, ?, 0)',
      [drill.id, drill.name, state]
    );
  });
  
  // Seed guest leaderboard
  scenarios.guest_leaderboard.forEach(record => {
    db.run(
      'INSERT OR IGNORE INTO leaderboard (initials, score, level, achieved_at) VALUES (?, ?, ?, ?)',
      [record.initials, record.score, record.level, record.achieved_at]
    );
  });
  
  // Seed polly run history
  scenarios.personal_run_fixtures.forEach(fixture => {
    if (fixture.user === 'polly') {
      db.run(
        'INSERT OR IGNORE INTO run_history (user_id, run_id, outcome, level, score, snapshot, finished_at) VALUES ((SELECT id FROM users WHERE email = ?), ?, ?, ?, ?, ?, ?)',
        ['polly@brickfall.test', fixture.run_id, fixture.outcome, fixture.level, fixture.score, '{}', fixture.finished_at]
      );
    }
  });
  
  console.log('Database seeded');
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
}

// ============ USER QUERIES ============

function getUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
}

function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, email, name, initials FROM users WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
}

function getUserProfile(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id, email, name, initials, highest_level, best_score FROM users WHERE id = ?',
      [userId],
      (err, row) => {
        if (err) reject(err);
        resolve(row);
      }
    );
  });
}

// ============ TOKEN QUERIES ============

function createToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO tokens (user_id, token) VALUES (?, ?)',
      [userId, token],
      function(err) {
        if (err) reject(err);
        resolve(token);
      }
    );
  });
}

function getTokenUser(token) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT user_id FROM tokens WHERE token = ?',
      [token],
      (err, row) => {
        if (err) reject(err);
        resolve(row);
      }
    );
  });
}

function revokeUserTokens(userId) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM tokens WHERE user_id = ?',
      [userId],
      function(err) {
        if (err) reject(err);
        resolve();
      }
    );
  });
}

// ============ GAME STATE QUERIES ============

function getRunState(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM runs WHERE user_id = ? AND finished_at IS NULL ORDER BY created_at DESC LIMIT 1',
      [userId],
      (err, row) => {
        if (err) reject(err);
        if (!row) resolve(null);
        else resolve({
          ...row,
          state: JSON.parse(row.state || '{}')
        });
      }
    );
  });
}

function startRun(userId, level, expectedRevision, operationId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Check for duplicate operation
      db.get(
        'SELECT status, response FROM operation_receipts WHERE user_id = ? AND operation_id = ?',
        [userId, operationId],
        (err, receipt) => {
          if (err) return reject(err);
          if (receipt) {
            // Idempotent: return cached response
            return resolve(JSON.parse(receipt.response));
          }
          
          // Get current revision
          db.get(
            'SELECT COALESCE(MAX(revision), 0) as current_revision FROM runs WHERE user_id = ?',
            [userId],
            (err, revRow) => {
              if (err) return reject(err);
              
              const currentRevision = revRow.current_revision;
              if (expectedRevision !== currentRevision) {
                const result = {
                  success: false,
                  status: 409,
                  error: 'Stale revision',
                  revision: currentRevision + 1,
                  state: null
                };
                db.run(
                  'INSERT OR REPLACE INTO operation_receipts (user_id, operation_id, status, response) VALUES (?, ?, ?, ?)',
                  [userId, operationId, 409, JSON.stringify(result)]
                );
                return resolve(result);
              }
              
              // Get level info
              db.get(
                'SELECT base_speed, speed_cap FROM levels WHERE level = ?',
                [level],
                (err, levelRow) => {
                  if (err) return reject(err);
                  
                  const newRevision = currentRevision + 1;
                  const runId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                  const initialState = {
                    level,
                    score: 0,
                    lives: 3,
                    combo: 1,
                    nextExtraLife: 20000,
                    balls: [{ x: 400, y: 400, vx: 0, vy: 0, stuck: true }],
                    paddle: { x: 300, y: 720, width: 118, height: 15 },
                    bricks: [],
                    drops: [],
                    power: null,
                    powerSeconds: 0
                  };
                  
                  db.run(
                    'INSERT INTO runs (user_id, run_id, revision, level, state) VALUES (?, ?, ?, ?, ?)',
                    [userId, runId, newRevision, level, JSON.stringify(initialState)],
                    function(err) {
                      if (err) return reject(err);
                      
                      const result = {
                        success: true,
                        revision: newRevision,
                        run: { runId, state: initialState }
                      };
                      
                      db.run(
                        'INSERT INTO operation_receipts (user_id, operation_id, status, response) VALUES (?, ?, ?, ?)',
                        [userId, operationId, 200, JSON.stringify(result)],
                        (err) => {
                          if (err) return reject(err);
                          resolve(result);
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
}

function saveRun(userId, state, expectedRevision, operationId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get(
        'SELECT status, response FROM operation_receipts WHERE user_id = ? AND operation_id = ?',
        [userId, operationId],
        (err, receipt) => {
          if (err) return reject(err);
          if (receipt) {
            return resolve(JSON.parse(receipt.response));
          }
          
          db.get(
            'SELECT revision FROM runs WHERE user_id = ? AND finished_at IS NULL ORDER BY created_at DESC LIMIT 1',
            [userId],
            (err, runRow) => {
              if (err) return reject(err);
              if (!runRow) {
                const result = { success: false, status: 404, error: 'No active run' };
                return resolve(result);
              }
              
              if (runRow.revision !== expectedRevision) {
                const result = {
                  success: false,
                  status: 409,
                  error: 'Stale revision',
                  revision: runRow.revision + 1
                };
                db.run(
                  'INSERT OR REPLACE INTO operation_receipts (user_id, operation_id, status, response) VALUES (?, ?, ?, ?)',
                  [userId, operationId, 409, JSON.stringify(result)]
                );
                return resolve(result);
              }
              
              db.run(
                'UPDATE runs SET state = ? WHERE user_id = ? AND finished_at IS NULL',
                [JSON.stringify(state), userId],
                function(err) {
                  if (err) return reject(err);
                  
                  const result = {
                    success: true,
                    revision: expectedRevision
                  };
                  
                  db.run(
                    'INSERT INTO operation_receipts (user_id, operation_id, status, response) VALUES (?, ?, ?, ?)',
                    [userId, operationId, 200, JSON.stringify(result)],
                    (err) => {
                      if (err) return reject(err);
                      resolve(result);
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
}

function finishRun(userId, { outcome, level, score, snapshot }, expectedRevision, operationId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get(
        'SELECT status, response FROM operation_receipts WHERE user_id = ? AND operation_id = ?',
        [userId, operationId],
        (err, receipt) => {
          if (err) return reject(err);
          if (receipt) {
            return resolve(JSON.parse(receipt.response));
          }
          
          db.get(
            'SELECT run_id, revision FROM runs WHERE user_id = ? AND finished_at IS NULL ORDER BY created_at DESC LIMIT 1',
            [userId],
            (err, runRow) => {
              if (err) return reject(err);
              if (!runRow) {
                const result = { success: false, status: 404, error: 'No active run' };
                return resolve(result);
              }
              
              if (runRow.revision !== expectedRevision) {
                const result = {
                  success: false,
                  status: 409,
                  error: 'Stale revision',
                  revision: runRow.revision + 1
                };
                return resolve(result);
              }
              
              db.run(
                'UPDATE runs SET outcome = ?, finished_at = CURRENT_TIMESTAMP WHERE run_id = ?',
                [outcome, runRow.run_id],
                function(err) {
                  if (err) return reject(err);
                  
                  // Add to run history
                  db.run(
                    'INSERT INTO run_history (user_id, run_id, outcome, level, score, snapshot, finished_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [userId, runRow.run_id, outcome, level, score, JSON.stringify(snapshot)]
                  );
                  
                  // Update best score if needed
                  db.get(
                    'SELECT best_score FROM users WHERE id = ?',
                    [userId],
                    (err, userRow) => {
                      if (err) return reject(err);
                      
                      if (score > userRow.best_score) {
                        db.run('UPDATE users SET best_score = ? WHERE id = ?', [score, userId]);
                      }
                      
                      // Add to leaderboard if completed or better
                      if (outcome === 'completed' || (outcome === 'game-over' && score > userRow.best_score)) {
                        db.run(
                          'INSERT INTO leaderboard (user_id, run_id, initials, score, level, achieved_at) VALUES ((SELECT id FROM users WHERE id = ?), ?, (SELECT initials FROM users WHERE id = ?), ?, ?, CURRENT_TIMESTAMP)',
                          [userId, runRow.run_id, userId, score, level]
                        );
                      }
                      
                      // Unlock next level if completed
                      if (outcome === 'completed' && level < 10) {
                        db.get(
                          'SELECT highest_level FROM users WHERE id = ?',
                          [userId],
                          (err, userRow2) => {
                            if (err) return reject(err);
                            if (level >= userRow2.highest_level) {
                              db.run(
                                'UPDATE users SET highest_level = ? WHERE id = ?',
                                [level + 1, userId]
                              );
                            }
                            
                            // Get leaderboard
                            getLeaderboard().then(leaderboard => {
                              const result = {
                                success: true,
                                leaderboard
                              };
                              
                              db.run(
                                'INSERT INTO operation_receipts (user_id, operation_id, status, response) VALUES (?, ?, ?, ?)',
                                [userId, operationId, 200, JSON.stringify(result)],
                                (err) => {
                                  if (err) return reject(err);
                                  resolve(result);
                                }
                              );
                            });
                          }
                        );
                      } else {
                        getLeaderboard().then(leaderboard => {
                          const result = {
                            success: true,
                            leaderboard
                          };
                          
                          db.run(
                            'INSERT INTO operation_receipts (user_id, operation_id, status, response) VALUES (?, ?, ?, ?)',
                            [userId, operationId, 200, JSON.stringify(result)],
                            (err) => {
                              if (err) return reject(err);
                              resolve(result);
                            }
                          );
                        });
                      }
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
}

// ============ LEVEL QUERIES ============

function getLevels() {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT level, name, base_speed, speed_cap, accent FROM levels ORDER BY level',
      (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      }
    );
  });
}

function getLevelBricks(level) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT row, column, type, drop_type as drop FROM bricks WHERE level = ? ORDER BY row, column',
      [level],
      (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      }
    );
  });
}

function getUnlockedLevels(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT highest_level FROM users WHERE id = ?',
      [userId],
      (err, row) => {
        if (err) reject(err);
        resolve(row ? row.highest_level : 1);
      }
    );
  });
}

// ============ LEADERBOARD QUERIES ============

function getLeaderboard() {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT initials, score, level, achieved_at FROM leaderboard ORDER BY score DESC, achieved_at ASC LIMIT 10',
      (err, rows) => {
        if (err) reject(err);
        resolve(rows || []);
      }
    );
  });
}

function getRunHistory(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT run_id, outcome, level, score, finished_at FROM run_history WHERE user_id = ? ORDER BY finished_at DESC LIMIT 10',
      [userId],
      (err, rows) => {
        if (err) reject(err);
        resolve(rows || []);
      }
    );
  });
}

// ============ CONSTANTS QUERIES ============

function getConstants() {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT key, value FROM constants ORDER BY key',
      (err, rows) => {
        if (err) reject(err);
        const constants = {};
        rows.forEach(row => {
          constants[row.key] = row.value;
        });
        resolve(constants);
      }
    );
  });
}

// ============ MECHANICS LAB QUERIES ============

function getDrills() {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT drill_id as id, name FROM drills ORDER BY drill_id',
      (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      }
    );
  });
}

function getDrillState(drillId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT drill_id, name, state, step_counter FROM drills WHERE drill_id = ?',
      [drillId],
      (err, row) => {
        if (err) reject(err);
        if (!row) resolve(null);
        else resolve({
          id: row.drill_id,
          name: row.name,
          initial: JSON.parse(row.state).initial,
          stepCounter: row.step_counter
        });
      }
    );
  });
}

function advanceDrill(drillId, maxSteps) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT state, step_counter FROM drills WHERE drill_id = ?',
      [drillId],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve({ success: false, error: 'Drill not found' });
        
        const drillDef = JSON.parse(row.state);
        // Advance logic would call the physics engine
        // For now, return placeholder
        resolve({
          success: true,
          steps: maxSteps,
          state: drillDef
        });
      }
    );
  });
}

// ============ EXPORTS ============

module.exports = {
  init,
  getUserByEmail: (email) => getUserByEmail(email),
  getUserById: (id) => getUserById(id),
  getUserProfile: (id) => getUserProfile(id),
  createToken: (userId) => createToken(userId),
  getTokenUser: (token) => getTokenUser(token),
  revokeUserTokens: (userId) => revokeUserTokens(userId),
  getRunState: (userId) => getRunState(userId),
  startRun: (userId, level, expectedRevision, operationId) => 
    startRun(userId, level, expectedRevision, operationId),
  saveRun: (userId, state, expectedRevision, operationId) => 
    saveRun(userId, state, expectedRevision, operationId),
  finishRun: (userId, info, expectedRevision, operationId) => 
    finishRun(userId, info, expectedRevision, operationId),
  getLevels: () => getLevels(),
  getLevelBricks: (level) => getLevelBricks(level),
  getUnlockedLevels: (userId) => getUnlockedLevels(userId),
  getLeaderboard: () => getLeaderboard(),
  getRunHistory: (userId) => getRunHistory(userId),
  getConstants: () => getConstants(),
  getDrills: () => getDrills(),
  getDrillState: (drillId) => getDrillState(drillId),
  advanceDrill: (drillId, maxSteps) => advanceDrill(drillId, maxSteps),
  hashPassword
};

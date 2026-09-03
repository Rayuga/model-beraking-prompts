const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { getDb, initializeDatabase, seedDatabase } = require('./src/db');
const { signIn, verifyToken, signOut, getRunRevision } = require('./src/auth');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to verify token
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const user = await verifyToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ error: 'Token verification failed' });
  }
}

// Helper to get constants
function getConstants() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all("SELECT key, value FROM constants", (err, rows) => {
      db.close();
      if (err) {
        reject(err);
      } else {
        const constants = {};
        rows.forEach(row => {
          const val = isNaN(row.value) ? row.value : parseInt(row.value);
          constants[row.key] = val;
        });
        resolve(constants);
      }
    });
  });
}

// Helper to get level data
function getLevelData(level) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get("SELECT * FROM levels WHERE level = ?", [level], (err, levelRow) => {
      if (err) {
        db.close();
        reject(err);
        return;
      }

      db.all("SELECT level, row, column, type, drop_type as \"drop\" FROM bricks WHERE level = ? ORDER BY row, column", [level], (err, brickRows) => {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve({
            level: levelRow,
            bricks: brickRows
          });
        }
      });
    });
  });
}

// Helper to create brick objects for game state
function createBrickObjects(brickRows) {
  const BRICK_WIDTH = 80;
  const BRICK_HEIGHT = 20;
  const BRICK_PADDING = 5;
  const START_X = 10;
  const START_Y = 50;

  return brickRows.map(brick => ({
    x: START_X + (brick.column - 1) * (BRICK_WIDTH + BRICK_PADDING),
    y: START_Y + (brick.row - 1) * (BRICK_HEIGHT + BRICK_PADDING),
    width: BRICK_WIDTH,
    height: BRICK_HEIGHT,
    type: brick.type,
    drop: brick.drop
  }));
}

// Sign in endpoint
app.post('/api/signin', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const result = await signIn(email, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      token: result.token,
      user: result.user
    });
  } catch (err) {
    console.error('Sign in error:', err);
    res.status(500).json({ error: 'Sign in failed' });
  }
});

// Sign out endpoint
app.post('/api/signout', authenticateToken, async (req, res) => {
  try {
    await signOut(req.token);
    res.json({ success: true });
  } catch (err) {
    console.error('Sign out error:', err);
    res.status(500).json({ error: 'Sign out failed' });
  }
});

// Get user profile
app.get('/api/profile', authenticateToken, (req, res) => {
  res.json({
    user: req.user
  });
});

// Start new run
app.post('/api/run/start', authenticateToken, async (req, res) => {
  const { level } = req.body;

  if (!level || level < 1 || level > 10) {
    return res.status(400).json({ error: 'Invalid level' });
  }

  try {
    const constants = await getConstants();
    const levelData = await getLevelData(level);
    const brickObjects = createBrickObjects(levelData.bricks);

    const revision = await getRunRevision(req.user.id);
    const runId = `run-${req.user.id}-${Date.now()}`;
    const operationId = crypto.randomBytes(16).toString('hex');

    // Create initial game state snapshot
    const snapshot = {
      level: level,
      score: 0,
      lives: constants.initial_lives,
      combo: 1,
      next_extra_life: constants.extra_life_step,
      power: null,
      power_seconds: 0,
      paddle_width: 118,
      balls: [{
        id: 'primary',
        x: 450,
        y: 540,
        vx: 0,
        vy: -levelData.level.base_speed,
        stuck: true
      }],
      drops: [],
      bricks: brickObjects.map(b => ({
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        type: b.type,
        drop: b.drop,
        health: b.type === 'strong' ? 2 : (b.type === 'normal' ? 1 : 0),
        damaged: false
      })),
      state: 'ready',
      simulation_time: 0
    };

    const db = getDb();
    db.run(
      `INSERT INTO run_snapshots (user_id, run_id, revision, level, score, lives, combo, next_extra_life, power, power_seconds, paddle_width, balls, drops, bricks, simulation_time, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        runId,
        revision,
        snapshot.level,
        snapshot.score,
        snapshot.lives,
        snapshot.combo,
        snapshot.next_extra_life,
        snapshot.power,
        snapshot.power_seconds,
        snapshot.paddle_width,
        JSON.stringify(snapshot.balls),
        JSON.stringify(snapshot.drops),
        JSON.stringify(snapshot.bricks),
        snapshot.simulation_time,
        snapshot.state
      ],
      (err) => {
        db.close();
        if (err) {
          console.error('Run start error:', err);
          return res.status(500).json({ error: 'Failed to start run' });
        }

        res.json({
          runId,
          revision,
          operationId,
          snapshot
        });
      }
    );
  } catch (err) {
    console.error('Run start error:', err);
    res.status(500).json({ error: 'Failed to start run' });
  }
});

// Get current run
app.get('/api/run/current', authenticateToken, (req, res) => {
  const db = getDb();
  db.get(
    "SELECT * FROM run_snapshots WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
    [req.user.id],
    (err, row) => {
      db.close();
      if (err) {
        console.error('Get run error:', err);
        return res.status(500).json({ error: 'Failed to get run' });
      }

      if (!row) {
        return res.status(404).json({ error: 'No active run' });
      }

      res.json({
        runId: row.run_id,
        revision: row.revision,
        snapshot: {
          level: row.level,
          score: row.score,
          lives: row.lives,
          combo: row.combo,
          next_extra_life: row.next_extra_life,
          power: row.power,
          power_seconds: row.power_seconds,
          paddle_width: row.paddle_width,
          balls: JSON.parse(row.balls),
          drops: JSON.parse(row.drops),
          bricks: JSON.parse(row.bricks),
          state: row.state,
          simulation_time: row.simulation_time
        }
      });
    }
  );
});

// Save run
app.post('/api/run/save', authenticateToken, async (req, res) => {
  const { runId, revision, operationId, snapshot } = req.body;

  if (!runId || !revision || !operationId || !snapshot) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const db = getDb();

    // Check for duplicate operation
    db.get(
      "SELECT * FROM request_receipts WHERE user_id = ? AND operation_id = ?",
      [req.user.id, operationId],
      (err, receipt) => {
        if (err) {
          db.close();
          return res.status(500).json({ error: 'Database error' });
        }

        if (receipt) {
          // Return cached response
          db.close();
          return res.status(receipt.status).json(JSON.parse(receipt.response));
        }

        // Check revision
        db.get(
          "SELECT revision FROM run_snapshots WHERE user_id = ? AND run_id = ?",
          [req.user.id, runId],
          (err, row) => {
            if (err) {
              db.close();
              return res.status(500).json({ error: 'Database error' });
            }

            if (row && row.revision !== revision) {
              // Stale revision
              db.close();
              return res.status(409).json({
                error: 'Stale revision',
                currentRevision: row.revision,
                snapshot: snapshot
              });
            }

            // Update run
            const newRevision = revision + 1;
            db.run(
              `UPDATE run_snapshots SET revision = ?, level = ?, score = ?, lives = ?, combo = ?, next_extra_life = ?, power = ?, power_seconds = ?, paddle_width = ?, balls = ?, drops = ?, bricks = ?, simulation_time = ?, state = ?, updated_at = CURRENT_TIMESTAMP
               WHERE user_id = ? AND run_id = ?`,
              [
                newRevision,
                snapshot.level,
                snapshot.score,
                snapshot.lives,
                snapshot.combo,
                snapshot.next_extra_life,
                snapshot.power,
                snapshot.power_seconds,
                snapshot.paddle_width,
                JSON.stringify(snapshot.balls),
                JSON.stringify(snapshot.drops),
                JSON.stringify(snapshot.bricks),
                snapshot.simulation_time,
                snapshot.state,
                req.user.id,
                runId
              ],
              (err) => {
                if (err) {
                  db.close();
                  return res.status(500).json({ error: 'Failed to save run' });
                }

                // Store receipt
                const response = { success: true, revision: newRevision };
                db.run(
                  "INSERT INTO request_receipts (user_id, operation_id, revision, status, response) VALUES (?, ?, ?, ?, ?)",
                  [req.user.id, operationId, newRevision, 200, JSON.stringify(response)],
                  (err) => {
                    db.close();
                    if (err) {
                      console.error('Receipt storage error:', err);
                    }
                    res.json(response);
                  }
                );
              }
            );
          }
        );
      }
    );
  } catch (err) {
    console.error('Run save error:', err);
    res.status(500).json({ error: 'Failed to save run' });
  }
});

// Finish run
app.post('/api/run/finish', authenticateToken, async (req, res) => {
  const { runId, revision, operationId, snapshot, outcome } = req.body;

  if (!runId || !revision || !operationId || !snapshot || !outcome) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const db = getDb();

    // Check for duplicate operation
    db.get(
      "SELECT * FROM request_receipts WHERE user_id = ? AND operation_id = ?",
      [req.user.id, operationId],
      (err, receipt) => {
        if (err) {
          db.close();
          return res.status(500).json({ error: 'Database error' });
        }

        if (receipt) {
          // Return cached response
          db.close();
          return res.status(receipt.status).json(JSON.parse(receipt.response));
        }

        // Update best score if needed
        const updateBestScore = snapshot.score > req.user.best_score;
        const nextLevel = Math.min(snapshot.level + 1, 10);

        db.run(
          `UPDATE users SET best_score = ?, highest_level = ? WHERE id = ?`,
          [
            updateBestScore ? snapshot.score : req.user.best_score,
            Math.max(req.user.highest_level, nextLevel),
            req.user.id
          ],
          (err) => {
            if (err) {
              db.close();
              return res.status(500).json({ error: 'Failed to update user' });
            }

            // Insert leaderboard entry if completed
            if (outcome === 'completed') {
              db.run(
                `INSERT INTO leaderboard (user_id, initials, score, level, achieved_at, email)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [req.user.id, req.user.initials, snapshot.score, snapshot.level, new Date().toISOString(), req.user.email],
                (err) => {
                  if (err) {
                    console.error('Leaderboard insert error:', err);
                  }

                  // Insert run history
                  db.run(
                    `INSERT INTO run_history (user_id, run_id, outcome, level, score, snapshot, finished_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [req.user.id, runId, outcome, snapshot.level, snapshot.score, JSON.stringify(snapshot), new Date().toISOString()],
                    (err) => {
                      if (err) {
                        console.error('Run history insert error:', err);
                      }

                      // Delete run snapshot
                      db.run(
                        "DELETE FROM run_snapshots WHERE user_id = ? AND run_id = ?",
                        [req.user.id, runId],
                        (err) => {
                          if (err) {
                            console.error('Run snapshot delete error:', err);
                          }

                          // Get top 10 leaderboard
                          db.all(
                            `SELECT initials, score, level, achieved_at FROM leaderboard ORDER BY score DESC, achieved_at ASC LIMIT 10`,
                            (err, leaderboard) => {
                              db.close();
                              if (err) {
                                console.error('Leaderboard fetch error:', err);
                                leaderboard = [];
                              }

                              const response = {
                                success: true,
                                revision: revision + 1,
                                leaderboard: leaderboard || []
                              };

                              // Store receipt
                              const db2 = getDb();
                              db2.run(
                                "INSERT INTO request_receipts (user_id, operation_id, revision, status, response) VALUES (?, ?, ?, ?, ?)",
                                [req.user.id, operationId, revision + 1, 200, JSON.stringify(response)],
                                (err) => {
                                  db2.close();
                                  if (err) {
                                    console.error('Receipt storage error:', err);
                                  }
                                  res.json(response);
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
            } else {
              // Game over - just delete run snapshot
              db.run(
                "DELETE FROM run_snapshots WHERE user_id = ? AND run_id = ?",
                [req.user.id, runId],
                (err) => {
                  if (err) {
                    console.error('Run snapshot delete error:', err);
                  }

                  // Insert run history
                  db.run(
                    `INSERT INTO run_history (user_id, run_id, outcome, level, score, snapshot, finished_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [req.user.id, runId, outcome, snapshot.level, snapshot.score, JSON.stringify(snapshot), new Date().toISOString()],
                    (err) => {
                      if (err) {
                        console.error('Run history insert error:', err);
                      }

                      db.close();

                      const response = { success: true, revision: revision + 1 };

                      // Store receipt
                      const db2 = getDb();
                      db2.run(
                        "INSERT INTO request_receipts (user_id, operation_id, revision, status, response) VALUES (?, ?, ?, ?, ?)",
                        [req.user.id, operationId, revision + 1, 200, JSON.stringify(response)],
                        (err) => {
                          db2.close();
                          if (err) {
                            console.error('Receipt storage error:', err);
                          }
                          res.json(response);
                        }
                      );
                    }
                  );
                }
              );
            }
          }
        );
      }
    );
  } catch (err) {
    console.error('Run finish error:', err);
    res.status(500).json({ error: 'Failed to finish run' });
  }
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  const db = getDb();
  db.all(
    `SELECT initials, score, level, achieved_at FROM leaderboard ORDER BY score DESC, achieved_at ASC LIMIT 10`,
    (err, rows) => {
      db.close();
      if (err) {
        console.error('Leaderboard fetch error:', err);
        return res.status(500).json({ error: 'Failed to fetch leaderboard' });
      }

      res.json({ leaderboard: rows || [] });
    }
  );
});

// Get run history
app.get('/api/run/history', authenticateToken, (req, res) => {
  const db = getDb();
  db.all(
    `SELECT run_id, outcome, level, score, finished_at FROM run_history WHERE user_id = ? ORDER BY finished_at DESC LIMIT 10`,
    [req.user.id],
    (err, rows) => {
      db.close();
      if (err) {
        console.error('Run history fetch error:', err);
        return res.status(500).json({ error: 'Failed to fetch run history' });
      }

      res.json({ history: rows || [] });
    }
  );
});

// Get mechanics lab drills
app.get('/api/lab/drills', (req, res) => {
  const db = getDb();
  db.all("SELECT id, name FROM drills", (err, rows) => {
    db.close();
    if (err) {
      console.error('Drills fetch error:', err);
      return res.status(500).json({ error: 'Failed to fetch drills' });
    }

    res.json({ drills: rows || [] });
  });
});

// Get drill details
app.get('/api/lab/drill/:id', (req, res) => {
  const db = getDb();
  db.get("SELECT * FROM drills WHERE id = ?", [req.params.id], (err, row) => {
    db.close();
    if (err) {
      console.error('Drill fetch error:', err);
      return res.status(500).json({ error: 'Failed to fetch drill' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Drill not found' });
    }

    res.json({
      id: row.id,
      name: row.name,
      initial: row.initial,
      after_advance: row.after_advance,
      after_second_advance: row.after_second_advance
    });
  });
});

// Get constants
app.get('/api/constants', async (req, res) => {
  try {
    const constants = await getConstants();
    res.json({ constants });
  } catch (err) {
    console.error('Constants fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch constants' });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start server
async function start() {
  try {
    await initializeDatabase();
    console.log('Database initialized');
    
    await seedDatabase();
    console.log('Database seeded');

    app.listen(PORT, () => {
      console.log(`Brickfall server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

start();

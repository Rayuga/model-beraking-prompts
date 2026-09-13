// /app/server.js - Express server for Brickfall arcade game

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { initDb, hashPassword, computeLevelDigest } = require('./db');
const { GameEngine, CONSTANTS, getBrickRect } = require('./physics');
const { createDrillState, DRILL_SUMMARIES } = require('./drills');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = initDb();

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve physics and drills shared modules
app.get('/physics.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'physics.js'));
});
app.get('/drills.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'drills.js'));
});

// Helper: authenticate bearer token
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.substring(7).trim();
  const tokenRow = db.prepare('SELECT user_id FROM auth_tokens WHERE token = ?').get(token);
  if (!tokenRow) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  const user = db.prepare('SELECT id, email, name, initials, highest_level, best_score, revision FROM users WHERE id = ?').get(tokenRow.user_id);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  req.token = token;
  next();
}

// Helper: handle game mutations with transactional revision & idempotency checks
function executeGameMutation(req, res, mutationHandler) {
  const user = req.user;
  const body = req.body || {};
  const { expected_revision, operation_id } = body;

  if (!operation_id || typeof operation_id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid operation_id' });
  }
  if (expected_revision === undefined || expected_revision === null || typeof expected_revision !== 'number') {
    return res.status(400).json({ error: 'Missing or invalid expected_revision' });
  }

  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');

  // Check idempotency receipt first
  const existingReceipt = db.prepare('SELECT * FROM operation_receipts WHERE operation_id = ?').get(operation_id);
  if (existingReceipt) {
    if (existingReceipt.request_hash === payloadHash && existingReceipt.user_id === user.id) {
      return res.status(existingReceipt.status_code).json(JSON.parse(existingReceipt.response_body));
    } else {
      return res.status(400).json({ error: 'Operation ID reused with different payload or user' });
    }
  }

  // Execute in transaction
  const tx = db.transaction(() => {
    // Reload user to get latest authoritative revision
    const freshUser = db.prepare('SELECT id, email, name, initials, highest_level, best_score, revision FROM users WHERE id = ?').get(user.id);
    const activeRunRow = db.prepare('SELECT run_id, state_json, updated_at FROM active_runs WHERE user_id = ?').get(user.id);
    const authoritativeRun = activeRunRow ? JSON.parse(activeRunRow.state_json) : null;

    if (freshUser.revision !== expected_revision) {
      const conflictBody = {
        error: 'Stale revision conflict',
        current_revision: freshUser.revision,
        expected_revision: expected_revision,
        active_run: authoritativeRun,
        user: {
          id: freshUser.id,
          email: freshUser.email,
          name: freshUser.name,
          initials: freshUser.initials,
          highest_level: freshUser.highest_level,
          best_score: freshUser.best_score,
          revision: freshUser.revision
        }
      };

      db.prepare(`
        INSERT INTO operation_receipts (operation_id, user_id, request_hash, status_code, response_body, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(operation_id, freshUser.id, payloadHash, 409, JSON.stringify(conflictBody), new Date().toISOString());

      return { status: 409, body: conflictBody };
    }

    // Advance revision
    const newRevision = freshUser.revision + 1;
    db.prepare('UPDATE users SET revision = ? WHERE id = ?').run(newRevision, freshUser.id);

    // Run specific mutation logic
    const mutationResult = mutationHandler(db, freshUser, newRevision, req.body);

    const successBody = Object.assign({
      success: true,
      revision: newRevision
    }, mutationResult);

    db.prepare(`
      INSERT INTO operation_receipts (operation_id, user_id, request_hash, status_code, response_body, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(operation_id, freshUser.id, payloadHash, 200, JSON.stringify(successBody), new Date().toISOString());

    return { status: 200, body: successBody };
  });

  try {
    const result = tx();
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Mutation error:', err);
    return res.status(500).json({ error: 'Internal server error during mutation' });
  }
}

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const hash = hashPassword(String(password), user.salt);
  if (hash !== user.password_hash) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // 64-character lowercase hexadecimal bearer token
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO auth_tokens (token, user_id, created_at) VALUES (?, ?, ?)').run(
    token,
    user.id,
    new Date().toISOString()
  );

  const activeRunRow = db.prepare('SELECT run_id, state_json, updated_at FROM active_runs WHERE user_id = ?').get(user.id);
  const activeRun = activeRunRow ? JSON.parse(activeRunRow.state_json) : null;

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      initials: user.initials,
      highest_level: user.highest_level,
      best_score: user.best_score,
      revision: user.revision
    },
    active_run: activeRun
  });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  // Revoke all active tokens for this user
  db.prepare('DELETE FROM auth_tokens WHERE user_id = ?').run(req.user.id);
  return res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const freshUser = db.prepare('SELECT id, email, name, initials, highest_level, best_score, revision FROM users WHERE id = ?').get(req.user.id);
  const activeRunRow = db.prepare('SELECT run_id, state_json, updated_at FROM active_runs WHERE user_id = ?').get(req.user.id);
  const activeRun = activeRunRow ? JSON.parse(activeRunRow.state_json) : null;

  return res.json({
    user: freshUser,
    active_run: activeRun
  });
});

// -------------------------------------------------------------
// Game Data & Config Endpoints
// -------------------------------------------------------------
app.get('/api/levels', (req, res) => {
  const levels = db.prepare('SELECT level, name, base_speed, speed_cap, accent, digest FROM levels ORDER BY level ASC').all();
  const allBricks = db.prepare('SELECT id, level, row, column, type, "drop" FROM bricks ORDER BY level ASC, row ASC, column ASC').all();

  const enrichedLevels = levels.map(lvl => {
    const lvlBricks = allBricks.filter(b => b.level === lvl.level);
    const brickTotals = {
      normal: lvlBricks.filter(b => b.type === 'normal').length,
      strong: lvlBricks.filter(b => b.type === 'strong').length,
      solid: lvlBricks.filter(b => b.type === 'solid').length,
      total: lvlBricks.length
    };
    return Object.assign({}, lvl, {
      bricks: lvlBricks,
      brick_totals: brickTotals
    });
  });

  return res.json({ levels: enrichedLevels });
});

app.get('/api/constants', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM constants').all();
  return res.json({ constants: rows });
});

app.get('/api/leaderboard', (req, res) => {
  const rows = db.prepare('SELECT initials, score, level, achieved_at FROM leaderboard ORDER BY score DESC, achieved_at ASC LIMIT 10').all();
  return res.json({ leaderboard: rows });
});

app.get('/api/drills', requireAuth, (req, res) => {
  return res.json({ drills: DRILL_SUMMARIES });
});

app.get('/api/drills/:id', requireAuth, (req, res) => {
  const drill = createDrillState(req.params.id);
  if (!drill) {
    return res.status(404).json({ error: 'Drill not found' });
  }
  return res.json({ drill });
});

app.get('/api/runs', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT run_id, outcome, level, score, finished_at, snapshot_json FROM personal_runs WHERE user_id = ? ORDER BY finished_at DESC LIMIT 10').all(req.user.id);
  const runs = rows.map(r => ({
    run_id: r.run_id,
    outcome: r.outcome,
    level: r.level,
    score: r.score,
    finished_at: r.finished_at,
    snapshot: JSON.parse(r.snapshot_json)
  }));
  return res.json({ runs });
});

app.get('/api/runs/:run_id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT run_id, outcome, level, score, finished_at, snapshot_json FROM personal_runs WHERE user_id = ? AND run_id = ?').get(req.user.id, req.params.run_id);
  if (!row) {
    return res.status(404).json({ error: 'Run record not found' });
  }
  return res.json({
    run: {
      run_id: row.run_id,
      outcome: row.outcome,
      level: row.level,
      score: row.score,
      finished_at: row.finished_at,
      snapshot: JSON.parse(row.snapshot_json)
    }
  });
});

// -------------------------------------------------------------
// Protected Game Mutation Endpoints
// -------------------------------------------------------------
app.post('/api/game/start', requireAuth, (req, res) => {
  executeGameMutation(req, res, (database, user, newRevision, body) => {
    const { level, run_id } = body;
    const chosenLevel = Math.max(1, Math.min(Number(level) || 1, user.highest_level));
    const runId = run_id || `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const levelData = database.prepare('SELECT * FROM levels WHERE level = ?').get(chosenLevel);
    const brickRows = database.prepare('SELECT id, level, row, column, type, "drop" FROM bricks WHERE level = ?').all(chosenLevel);

    const initialState = {
      run_id: runId,
      status: 'ready',
      level: chosenLevel,
      score: 0,
      lives: CONSTANTS.INITIAL_LIVES,
      combo: 1,
      next_extra_life: CONSTANTS.EXTRA_LIFE_STEP,
      paddle: {
        x: (CONSTANTS.CANVAS_WIDTH - CONSTANTS.PADDLE_WIDTH) / 2,
        y: CONSTANTS.PADDLE_Y,
        width: CONSTANTS.PADDLE_WIDTH,
        height: CONSTANTS.PADDLE_HEIGHT,
        vx: 0
      },
      paddle_width: CONSTANTS.PADDLE_WIDTH,
      power: null,
      power_seconds: 0,
      baseSpeed: levelData ? levelData.base_speed : 300,
      speedCap: levelData ? levelData.speed_cap : 520,
      balls: [
        {
          id: 'primary',
          isPrimary: true,
          x: CONSTANTS.CANVAS_WIDTH / 2,
          y: CONSTANTS.PADDLE_Y - CONSTANTS.BALL_RADIUS,
          vx: 0,
          vy: 0,
          radius: CONSTANTS.BALL_RADIUS,
          held: true,
          heldOffset: 0,
          lost: false
        }
      ],
      drops: [],
      bricks: brickRows.map(b => ({
        row: b.row,
        column: b.column,
        type: b.type,
        hp: b.type === 'strong' ? 2 : (b.type === 'normal' ? 1 : Infinity),
        drop: b.drop || ''
      }))
    };

    database.prepare(`
      INSERT OR REPLACE INTO active_runs (user_id, run_id, state_json, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(user.id, runId, JSON.stringify(initialState), new Date().toISOString());

    return {
      active_run: initialState
    };
  });
});

app.post('/api/game/save', requireAuth, (req, res) => {
  executeGameMutation(req, res, (database, user, newRevision, body) => {
    const { run_id, state } = body;
    if (!state) {
      return {};
    }

    database.prepare(`
      INSERT OR REPLACE INTO active_runs (user_id, run_id, state_json, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(user.id, run_id || state.run_id || 'active', JSON.stringify(state), new Date().toISOString());

    return { saved: true };
  });
});

app.post('/api/game/progress', requireAuth, (req, res) => {
  executeGameMutation(req, res, (database, user, newRevision, body) => {
    const { completed_level, score, next_level, state } = body;
    const completedLvl = Number(completed_level) || 1;
    const currentScore = Number(score) || 0;

    let newHighestLevel = user.highest_level;
    if (completedLvl >= user.highest_level && completedLvl < 10) {
      newHighestLevel = completedLvl + 1;
      database.prepare('UPDATE users SET highest_level = ? WHERE id = ?').run(newHighestLevel, user.id);
    }

    let newBestScore = user.best_score;
    if (currentScore > user.best_score) {
      newBestScore = currentScore;
      database.prepare('UPDATE users SET best_score = ? WHERE id = ?').run(newBestScore, user.id);
    }

    if (state) {
      database.prepare(`
        INSERT OR REPLACE INTO active_runs (user_id, run_id, state_json, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(user.id, state.run_id || 'active', JSON.stringify(state), new Date().toISOString());
    }

    return {
      highest_level: newHighestLevel,
      best_score: newBestScore
    };
  });
});

app.post('/api/game/finish', requireAuth, (req, res) => {
  executeGameMutation(req, res, (database, user, newRevision, body) => {
    const { run_id, outcome, level, score, snapshot } = body;
    const finalScore = Number(score) || 0;
    const finalLevel = Number(level) || 1;
    const finalOutcome = outcome === 'completed' ? 'completed' : 'game-over';
    const finishedAt = new Date().toISOString();

    // Check if this run_id was already recorded
    const existingPersonal = database.prepare('SELECT id FROM personal_runs WHERE user_id = ? AND run_id = ?').get(user.id, run_id);
    if (!existingPersonal) {
      // Insert personal run
      database.prepare(`
        INSERT INTO personal_runs (user_id, run_id, outcome, level, score, finished_at, snapshot_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        user.id,
        String(run_id),
        finalOutcome,
        finalLevel,
        finalScore,
        finishedAt,
        JSON.stringify(snapshot || {})
      );

      // Keep only newest 10 personal runs
      database.prepare(`
        DELETE FROM personal_runs
        WHERE user_id = ?
        AND id NOT IN (
          SELECT id FROM personal_runs
          WHERE user_id = ?
          ORDER BY finished_at DESC, id DESC
          LIMIT 10
        )
      `).run(user.id, user.id);

      // Insert into global leaderboard
      database.prepare(`
        INSERT INTO leaderboard (user_id, initials, score, level, achieved_at, run_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        user.id,
        user.initials,
        finalScore,
        finalLevel,
        finishedAt,
        String(run_id)
      );
    }

    // Update best score
    let newBestScore = user.best_score;
    if (finalScore > user.best_score) {
      newBestScore = finalScore;
      database.prepare('UPDATE users SET best_score = ? WHERE id = ?').run(newBestScore, user.id);
    }

    // Clear resumable run
    database.prepare('DELETE FROM active_runs WHERE user_id = ?').run(user.id);

    // Fetch top 10 leaderboard
    const top10 = database.prepare('SELECT initials, score, level, achieved_at FROM leaderboard ORDER BY score DESC, achieved_at ASC LIMIT 10').all();

    return {
      best_score: newBestScore,
      leaderboard: top10
    };
  });
});

app.post('/api/game/clear', requireAuth, (req, res) => {
  executeGameMutation(req, res, (database, user, newRevision, body) => {
    database.prepare('DELETE FROM active_runs WHERE user_id = ?').run(user.id);
    return { cleared: true };
  });
});

// Fallback: serve index.html for client-side navigation
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Brickfall arcade server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

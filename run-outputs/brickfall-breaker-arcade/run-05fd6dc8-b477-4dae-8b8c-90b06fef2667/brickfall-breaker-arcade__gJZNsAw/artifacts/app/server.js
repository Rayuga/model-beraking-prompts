const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { initDB, getDB, authenticateUser, getUserFromToken, revokeToken } = require('./db');

const app = express();
const PORT = 3000;

// Initialize database on startup
const mainDB = initDB();
mainDB.close();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to check authentication
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const db = getDB();
  const user = getUserFromToken(db, token);
  db.close();
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  req.user = user;
  req.token = token;
  next();
}

// Sign in
app.post('/api/sign-in', (req, res) => {
  const { email, password } = req.body;
  
  const db = getDB();
  const result = authenticateUser(db, email, password);
  db.close();
  
  if (!result) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const user = result.user;
  res.json({
    token: result.token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      initials: user.initials
    }
  });
});

// Sign out
app.post('/api/sign-out', authMiddleware, (req, res) => {
  const db = getDB();
  revokeToken(db, req.token);
  db.close();
  
  res.json({ success: true });
});

// Get game state
app.get('/api/game-state', authMiddleware, (req, res) => {
  const db = getDB();
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const activeRun = db.prepare('SELECT * FROM active_runs WHERE user_id = ?').get(req.user.id);
  
  const levels = db.prepare('SELECT * FROM levels ORDER BY level_number').all();
  
  const leaderboard = db.prepare(`
    SELECT initials, score, level, achieved_at 
    FROM leaderboard 
    ORDER BY score DESC, achieved_at ASC
    LIMIT 10
  `).all();
  
  const unlockedLevels = user.highest_level || 1;
  
  const runHistory = db.prepare(`
    SELECT run_id, outcome, level, score, finished_at
    FROM run_records
    WHERE user_id = ?
    ORDER BY finished_at DESC
    LIMIT 10
  `).all(req.user.id);
  
  db.close();
  
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      initials: user.initials,
      best_score: user.best_score
    },
    levels: levels.map(l => ({
      level_number: l.level_number,
      name: l.name,
      base_speed: l.base_speed,
      speed_cap: l.speed_cap,
      accent: l.accent
    })),
    unlockedLevels,
    activeRun: activeRun ? {
      run_id: activeRun.run_id,
      revision: activeRun.revision,
      level: activeRun.level,
      score: activeRun.score,
      lives: activeRun.lives,
      combo: activeRun.combo,
      next_extra_life: activeRun.next_extra_life,
      power_up: activeRun.power_up,
      power_seconds: activeRun.power_seconds,
      paddle_width: activeRun.paddle_width,
      balls: JSON.parse(activeRun.balls),
      drops: JSON.parse(activeRun.drops),
      bricks: JSON.parse(activeRun.bricks),
      accumulated_time: activeRun.accumulated_time,
      unlocked_levels: JSON.parse(activeRun.unlocked_levels)
    } : null,
    leaderboard,
    runHistory
  });
});

// Start new run
app.post('/api/start-run', authMiddleware, (req, res) => {
  const { levelNumber, operationId } = req.body;
  const db = getDB();
  
  try {
    // Check for duplicate operation
    const existing = db.prepare(`
      SELECT * FROM operation_receipts 
      WHERE user_id = ? AND operation_id = ?
    `).get(req.user.id, operationId);
    
    if (existing) {
      return res.status(existing.status_code).json(JSON.parse(existing.response));
    }
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const level = db.prepare('SELECT * FROM levels WHERE level_number = ?').get(levelNumber);
    
    if (!level) {
      const err = { error: 'Level not found' };
      db.prepare(`
        INSERT INTO operation_receipts (user_id, operation_id, request_hash, status_code, response)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.user.id, operationId, '', 404, JSON.stringify(err));
      db.close();
      return res.status(404).json(err);
    }
    
    if (levelNumber > user.highest_level) {
      const err = { error: 'Level not unlocked' };
      db.prepare(`
        INSERT INTO operation_receipts (user_id, operation_id, request_hash, status_code, response)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.user.id, operationId, '', 403, JSON.stringify(err));
      db.close();
      return res.status(403).json(err);
    }
    
    // Load bricks for this level
    const bricks = db.prepare(`
      SELECT row_idx, col_idx, type, drop_type
      FROM bricks
      WHERE level_number = ?
      ORDER BY row_idx, col_idx
    `).all(levelNumber);
    
    const brickState = {};
    for (const brick of bricks) {
      const key = `${brick.row_idx},${brick.col_idx}`;
      brickState[key] = {
        type: brick.type,
        health: brick.type === 'strong' ? 2 : (brick.type === 'solid' ? 999 : 1),
        drop: brick.drop_type || null
      };
    }
    
    // Create run
    const runId = `run-${req.user.id}-${Date.now()}`;
    const revision = 1;
    const unlockedLevels = Array.from({ length: user.highest_level }, (_, i) => i + 1);
    
    const initialBalls = [{
      x: 189,
      y: 540,
      vx: 0,
      vy: 0,
      stuck: true,
      primary: true
    }];
    
    db.prepare(`
      INSERT OR REPLACE INTO active_runs (
        user_id, run_id, revision, level, score, lives, combo, next_extra_life,
        power_up, power_seconds, paddle_width, balls, drops, bricks, accumulated_time, unlocked_levels
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      runId,
      revision,
      levelNumber,
      0,
      3,
      1,
      20000,
      null,
      null,
      118,
      JSON.stringify(initialBalls),
      JSON.stringify([]),
      JSON.stringify(brickState),
      0,
      JSON.stringify(unlockedLevels)
    );
    
    const response = {
      run_id: runId,
      revision,
      level: levelNumber,
      score: 0,
      lives: 3,
      combo: 1,
      next_extra_life: 20000,
      power_up: null,
      power_seconds: null,
      paddle_width: 118,
      balls: initialBalls,
      drops: [],
      bricks: brickState,
      accumulated_time: 0,
      unlocked_levels: unlockedLevels
    };
    
    db.prepare(`
      INSERT INTO operation_receipts (user_id, operation_id, request_hash, status_code, response)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, operationId, '', 200, JSON.stringify(response));
    
    db.close();
    res.json(response);
  } catch (err) {
    console.error('Error starting run:', err);
    db.close();
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save run state
app.post('/api/save-run', authMiddleware, (req, res) => {
  const { run_id, revision, operationId, state } = req.body;
  const db = getDB();
  
  try {
    // Check for duplicate operation
    const existing = db.prepare(`
      SELECT * FROM operation_receipts 
      WHERE user_id = ? AND operation_id = ?
    `).get(req.user.id, operationId);
    
    if (existing) {
      return res.status(existing.status_code).json(JSON.parse(existing.response));
    }
    
    // Check revision
    const activeRun = db.prepare('SELECT * FROM active_runs WHERE user_id = ? AND run_id = ?')
      .get(req.user.id, run_id);
    
    if (!activeRun) {
      const err = { error: 'Run not found' };
      db.prepare(`
        INSERT INTO operation_receipts (user_id, operation_id, request_hash, status_code, response)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.user.id, operationId, '', 404, JSON.stringify(err));
      db.close();
      return res.status(404).json(err);
    }
    
    if (activeRun.revision !== revision) {
      const err = {
        error: 'Stale revision',
        current_revision: activeRun.revision,
        state: {
          level: activeRun.level,
          score: activeRun.score,
          lives: activeRun.lives,
          combo: activeRun.combo,
          next_extra_life: activeRun.next_extra_life,
          power_up: activeRun.power_up,
          power_seconds: activeRun.power_seconds,
          paddle_width: activeRun.paddle_width,
          balls: JSON.parse(activeRun.balls),
          drops: JSON.parse(activeRun.drops),
          bricks: JSON.parse(activeRun.bricks),
          accumulated_time: activeRun.accumulated_time
        }
      };
      db.prepare(`
        INSERT INTO operation_receipts (user_id, operation_id, request_hash, status_code, response)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.user.id, operationId, '', 409, JSON.stringify(err));
      db.close();
      return res.status(409).json(err);
    }
    
    // Update run state
    const newRevision = revision + 1;
    db.prepare(`
      UPDATE active_runs SET
        revision = ?, level = ?, score = ?, lives = ?, combo = ?, next_extra_life = ?,
        power_up = ?, power_seconds = ?, paddle_width = ?, balls = ?, drops = ?, bricks = ?,
        accumulated_time = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND run_id = ?
    `).run(
      newRevision,
      state.level,
      state.score,
      state.lives,
      state.combo,
      state.next_extra_life,
      state.power_up || null,
      state.power_seconds || null,
      state.paddle_width,
      JSON.stringify(state.balls),
      JSON.stringify(state.drops),
      JSON.stringify(state.bricks),
      state.accumulated_time,
      req.user.id,
      run_id
    );
    
    const response = { revision: newRevision, success: true };
    db.prepare(`
      INSERT INTO operation_receipts (user_id, operation_id, request_hash, status_code, response)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, operationId, '', 200, JSON.stringify(response));
    
    db.close();
    res.json(response);
  } catch (err) {
    console.error('Error saving run:', err);
    db.close();
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Finish run
app.post('/api/finish-run', authMiddleware, (req, res) => {
  const { run_id, revision, operationId, outcome, level, score } = req.body;
  const db = getDB();
  
  try {
    // Check for duplicate operation
    const existing = db.prepare(`
      SELECT * FROM operation_receipts 
      WHERE user_id = ? AND operation_id = ?
    `).get(req.user.id, operationId);
    
    if (existing) {
      return res.status(existing.status_code).json(JSON.parse(existing.response));
    }
    
    // Check revision
    const activeRun = db.prepare('SELECT * FROM active_runs WHERE user_id = ? AND run_id = ?')
      .get(req.user.id, run_id);
    
    if (!activeRun) {
      const err = { error: 'Run not found' };
      db.prepare(`
        INSERT INTO operation_receipts (user_id, operation_id, request_hash, status_code, response)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.user.id, operationId, '', 404, JSON.stringify(err));
      db.close();
      return res.status(404).json(err);
    }
    
    if (activeRun.revision !== revision) {
      const err = {
        error: 'Stale revision',
        current_revision: activeRun.revision
      };
      db.prepare(`
        INSERT INTO operation_receipts (user_id, operation_id, request_hash, status_code, response)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.user.id, operationId, '', 409, JSON.stringify(err));
      db.close();
      return res.status(409).json(err);
    }
    
    // Record the run
    const finishedAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO run_records (user_id, run_id, revision, outcome, level, score, finished_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, run_id, revision, outcome, level, score, finishedAt);
    
    // Update user's best score and highest level if this is better
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (score > user.best_score) {
      db.prepare('UPDATE users SET best_score = ? WHERE id = ?').run(score, req.user.id);
    }
    if (level === 10 && outcome === 'completed' && level > user.highest_level) {
      db.prepare('UPDATE users SET highest_level = ? WHERE id = ?').run(level, req.user.id);
    } else if (level > user.highest_level) {
      db.prepare('UPDATE users SET highest_level = ? WHERE id = ?').run(level, req.user.id);
    }
    
    // Add to leaderboard if completed or game-over at level 10
    if ((outcome === 'completed' && level === 10) || (outcome === 'game-over' && level >= 1)) {
      db.prepare(`
        INSERT INTO leaderboard (user_id, initials, score, level, achieved_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.user.id, user.initials, score, level, finishedAt);
    }
    
    // Delete the active run
    db.prepare('DELETE FROM active_runs WHERE user_id = ?').run(req.user.id);
    
    // Get updated leaderboard
    const leaderboard = db.prepare(`
      SELECT initials, score, level, achieved_at
      FROM leaderboard
      ORDER BY score DESC, achieved_at ASC
      LIMIT 10
    `).all();
    
    const response = {
      success: true,
      outcome,
      level,
      score,
      leaderboard
    };
    
    db.prepare(`
      INSERT INTO operation_receipts (user_id, operation_id, request_hash, status_code, response)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, operationId, '', 200, JSON.stringify(response));
    
    db.close();
    res.json(response);
  } catch (err) {
    console.error('Error finishing run:', err);
    db.close();
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Brickfall server running on port ${PORT}`);
});

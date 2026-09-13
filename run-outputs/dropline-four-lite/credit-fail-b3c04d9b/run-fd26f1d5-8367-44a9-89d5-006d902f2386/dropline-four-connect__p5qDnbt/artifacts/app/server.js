const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { initDb, getDbPath } = require('./db.js');
const gameEngine = require('./gameEngine.js');

const app = express();
const PORT = process.env.PORT || 3000;

const db = initDb();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: format game state for response
function formatGameState(row) {
  if (!row) return null;
  return {
    roundId: row.round_id,
    board: JSON.parse(row.board),
    currentPlayer: row.current_player,
    status: row.status,
    winningCells: row.winning_cells ? JSON.parse(row.winning_cells) : null,
    redWins: row.red_wins,
    yellowWins: row.yellow_wins,
    draws: row.draws,
    appliedHistory: JSON.parse(row.applied_history),
    redoHistory: JSON.parse(row.redo_history),
    revision: row.revision
  };
}

// Helper: get archive for user
function getArchiveForUser(userId) {
  const totalCount = db.prepare('SELECT COUNT(*) as total FROM completed_matches WHERE user_id = ?').get(userId).total;
  const rows = db.prepare(`
    SELECT id, match_id, round_id, result, final_board, moves, winning_cells, completed_at
    FROM completed_matches
    WHERE user_id = ?
    ORDER BY completed_at DESC, id DESC
    LIMIT 10
  `).all(userId);

  const matches = rows.map(r => {
    const moves = JSON.parse(r.moves);
    return {
      matchId: r.match_id,
      roundId: r.round_id,
      result: r.result,
      finalBoard: JSON.parse(r.final_board),
      moves: moves,
      moveCount: moves.length,
      winningCells: r.winning_cells ? JSON.parse(r.winning_cells) : null,
      completedAt: r.completed_at
    };
  });

  return {
    totalCount,
    matches
  };
}

// Auth middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(session.user_id);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = user;
  req.sessionToken = token;
  next();
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auth endpoints
app.post('/api/auth/signin', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();

  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, user.id, now);

  const stateRow = db.prepare('SELECT * FROM game_states WHERE user_id = ?').get(user.id);
  const archive = getArchiveForUser(user.id);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    },
    gameState: formatGameState(stateRow),
    archive
  });
});

app.post('/api/auth/signout', requireAuth, (req, res) => {
  // Revoke ALL active sessions for this account
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const stateRow = db.prepare('SELECT * FROM game_states WHERE user_id = ?').get(req.user.id);
  const archive = getArchiveForUser(req.user.id);

  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name
    },
    gameState: formatGameState(stateRow),
    archive
  });
});

// Game state read
app.get('/api/game', requireAuth, (req, res) => {
  const stateRow = db.prepare('SELECT * FROM game_states WHERE user_id = ?').get(req.user.id);
  const archive = getArchiveForUser(req.user.id);

  res.json({
    gameState: formatGameState(stateRow),
    archive
  });
});

// Mutation helper
function handleMutation(req, res, mutationFn) {
  const userId = req.user.id;
  const { expectedRevision, operationId } = req.body || {};

  // 1. Idempotency check
  if (operationId) {
    const cachedOp = db.prepare('SELECT status_code, response_json FROM operations WHERE user_id = ? AND op_id = ?').get(userId, operationId);
    if (cachedOp) {
      return res.status(cachedOp.status_code).json(JSON.parse(cachedOp.response_json));
    }
  }

  // 2. Fetch current state
  const stateRow = db.prepare('SELECT * FROM game_states WHERE user_id = ?').get(userId);
  if (!stateRow) {
    return res.status(500).json({ error: 'Game state not found' });
  }

  // 3. Concurrency check
  if (typeof expectedRevision === 'number' && expectedRevision !== stateRow.revision) {
    return res.status(409).json({
      message: 'Game updated in another tab',
      gameState: formatGameState(stateRow),
      archive: getArchiveForUser(userId)
    });
  }

  // 4. Execute mutation in transaction
  let responsePayload = null;
  let statusCode = 200;

  try {
    const tx = db.transaction(() => {
      const result = mutationFn(stateRow);
      if (!result.valid) {
        statusCode = 400;
        responsePayload = {
          message: result.error,
          gameState: formatGameState(stateRow),
          archive: getArchiveForUser(userId)
        };
        return;
      }

      const { newState, archiveMatch, unarchiveRoundId } = result;

      // Update game state
      db.prepare(`
        UPDATE game_states
        SET round_id = ?, board = ?, current_player = ?, status = ?, winning_cells = ?,
            red_wins = ?, yellow_wins = ?, draws = ?, applied_history = ?, redo_history = ?, revision = ?
        WHERE user_id = ?
      `).run(
        newState.round_id,
        newState.board,
        newState.current_player,
        newState.status,
        newState.winning_cells,
        newState.red_wins,
        newState.yellow_wins,
        newState.draws,
        newState.applied_history,
        newState.redo_history,
        newState.revision,
        userId
      );

      // Handle archive addition
      if (archiveMatch) {
        db.prepare(`
          INSERT INTO completed_matches (
            user_id, match_id, round_id, result, final_board, moves, winning_cells, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          archiveMatch.match_id,
          archiveMatch.round_id,
          archiveMatch.result,
          archiveMatch.final_board,
          archiveMatch.moves,
          archiveMatch.winning_cells,
          archiveMatch.completed_at
        );
      }

      // Handle archive removal (on undo of terminal state)
      if (unarchiveRoundId) {
        db.prepare('DELETE FROM completed_matches WHERE user_id = ? AND round_id = ?').run(userId, unarchiveRoundId);
      }

      const updatedStateRow = db.prepare('SELECT * FROM game_states WHERE user_id = ?').get(userId);
      const updatedArchive = getArchiveForUser(userId);

      responsePayload = {
        gameState: formatGameState(updatedStateRow),
        archive: updatedArchive
      };

      // Store in operations for idempotency
      if (operationId) {
        db.prepare(`
          INSERT OR REPLACE INTO operations (user_id, op_id, status_code, response_json, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, operationId, 200, JSON.stringify(responsePayload), new Date().toISOString());
      }
    });

    tx();
  } catch (err) {
    console.error('Mutation transaction error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }

  return res.status(statusCode).json(responsePayload);
}

// Move mutation
app.post('/api/game/move', requireAuth, (req, res) => {
  const column = req.body.column;
  handleMutation(req, res, (stateRow) => {
    return gameEngine.applyMove(stateRow, column);
  });
});

// Undo mutation
app.post('/api/game/undo', requireAuth, (req, res) => {
  handleMutation(req, res, (stateRow) => {
    return gameEngine.applyUndo(stateRow);
  });
});

// Redo mutation
app.post('/api/game/redo', requireAuth, (req, res) => {
  handleMutation(req, res, (stateRow) => {
    return gameEngine.applyRedo(stateRow);
  });
});

// New game mutation
app.post('/api/game/new', requireAuth, (req, res) => {
  handleMutation(req, res, (stateRow) => {
    return gameEngine.applyNewGame(stateRow);
  });
});

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DropLine server listening on http://0.0.0.0:${PORT}`);
    console.log(`SQLite path: ${getDbPath()}`);
  });
}

module.exports = app;

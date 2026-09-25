const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { getDb, getReceipt, saveReceipt } = require('./db.js');
const {
  scoreHand,
  scorePeggingPlay,
  normalizeCard,
  parseCard
} = require('./scoring.js');
const {
  loadPracticeDeals,
  createNewGame,
  handleDiscard,
  handlePlayCard,
  handleGo,
  handleNextHand,
  sanitizeGameForSeat
} = require('./gameEngine.js');
const { SCORED_HANDS } = require('/assets/club/scored-hands.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'www')));

// Favicon handler
app.get('/favicon.ico', (req, res) => res.status(204).end());

// --- Health Probe ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- Members & Ladder ---
app.get('/api/members', (req, res) => {
  const db = getDb();
  const members = db.prepare('SELECT * FROM members ORDER BY won DESC, played DESC').all();
  res.json({ members });
});

app.get('/api/ladder', (req, res) => {
  const db = getDb();
  const members = db.prepare('SELECT * FROM members ORDER BY won DESC, played DESC').all();
  const metaTarget = db.prepare('SELECT value FROM meta WHERE key = ?').get('target');
  const target = metaTarget ? parseInt(metaTarget.value, 10) : 121;
  res.json({ target, members });
});

// --- Historical Summaries ---
app.get('/api/history', (req, res) => {
  const db = getDb();
  const hist = db.prepare(`
    SELECT h.*, 
           m1.name as dealer_name, 
           m2.name as pone_name
    FROM historical_games h
    LEFT JOIN members m1 ON h.dealer = m1.no
    LEFT JOIN members m2 ON h.pone = m2.no
    ORDER BY h.created_at DESC
  `).all();
  res.json({ history: hist });
});

// --- Reference Scored Hands (All 40) ---
app.get('/api/reference-hands', (req, res) => {
  res.json({ hands: SCORED_HANDS });
});

// --- Practice Deals ---
app.get('/api/practice-deals', (req, res) => {
  const deals = loadPracticeDeals();
  res.json({ deals });
});

// --- Scoring Bench APIs ---
app.post('/api/score/hand', (req, res) => {
  try {
    const { hand, cut, crib = false } = req.body;
    if (!hand || !Array.isArray(hand) || hand.length !== 4) {
      return res.status(400).json({ error: 'Hand must contain exactly 4 cards' });
    }
    if (!cut || typeof cut !== 'string') {
      return res.status(400).json({ error: 'Cut card is required' });
    }
    const result = scoreHand(hand, cut, Boolean(crib));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/score/pegging', (req, res) => {
  try {
    const { pile, next_card, cards } = req.body;
    let cardList = [];
    if (Array.isArray(cards)) {
      cardList = cards;
    } else if (Array.isArray(pile)) {
      cardList = next_card ? [...pile, next_card] : [...pile];
    } else {
      return res.status(400).json({ error: 'Invalid pile or cards' });
    }

    if (cardList.length === 0) {
      return res.status(400).json({ error: 'At least one card required' });
    }

    const result = scorePeggingPlay(cardList);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Games CRUD ---

// List playable / active games
app.get('/api/games', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT g.id, g.player_a, g.player_b, g.score_a, g.score_b, 
           g.hand_number, g.dealer, g.stage, g.practice_mode, g.revision, 
           g.winner, g.created_at, g.updated_at,
           m1.name as player_a_name,
           m2.name as player_b_name
    FROM games g
    LEFT JOIN members m1 ON g.player_a = m1.no
    LEFT JOIN members m2 ON g.player_b = m2.no
    ORDER BY g.updated_at DESC
  `).all();
  res.json({ games: rows });
});

// Create new game
app.post('/api/games', (req, res) => {
  const actionId = req.headers['x-action-id'] || req.body.action_id;
  if (!actionId) {
    return res.status(400).json({ error: 'Missing client action_id' });
  }

  const db = getDb();
  const existingReceipt = getReceipt(actionId);
  if (existingReceipt) {
    // Check if input matches
    const payloadStr = JSON.stringify(req.body);
    if (existingReceipt.request_payload === payloadStr && existingReceipt.action_type === 'create_game') {
      return res.status(existingReceipt.response_status).json(JSON.parse(existingReceipt.response_body));
    } else {
      return res.status(409).json({ error: 'action_id reused with different parameters' });
    }
  }

  const {
    player_a,
    player_b,
    practice_mode,
    start_score_a = 0,
    start_score_b = 0
  } = req.body;

  if (!player_a || !player_b) {
    return res.status(400).json({ error: 'Both player_a and player_b are required' });
  }

  const gameId = 'G-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

  try {
    const newGame = createNewGame({
      id: gameId,
      playerA: player_a,
      playerB: player_b,
      practiceMode: practice_mode || null,
      startScoreA: start_score_a,
      startScoreB: start_score_b
    });

    const createTx = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO games (
          id, player_a, player_b, score_a, score_b, hand_number,
          dealer, stage, practice_mode, practice_round_index,
          state_json, revision, winner, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        newGame.id,
        newGame.player_a,
        newGame.player_b,
        newGame.score_a,
        newGame.score_b,
        newGame.hand_number,
        newGame.dealer,
        newGame.stage,
        newGame.practice_mode,
        newGame.practice_round_index,
        newGame.state_json,
        newGame.revision,
        newGame.winner,
        newGame.created_at,
        newGame.updated_at
      );

      const seat = req.query.seat || 'A';
      const sanitized = sanitizeGameForSeat(newGame, seat);

      saveReceipt(actionId, gameId, 'create_game', req.body, 201, sanitized);
      return sanitized;
    });

    const result = createTx();
    return res.status(201).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Get game state
app.get('/api/games/:id', (req, res) => {
  const db = getDb();
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const seat = req.query.seat || 'A';
  const sanitized = sanitizeGameForSeat(game, seat);
  res.json(sanitized);
});

// Perform game action (discard, play_card, go, next_hand)
app.post('/api/games/:id/action', (req, res) => {
  const actionId = req.headers['x-action-id'] || req.body.action_id;
  if (!actionId) {
    return res.status(400).json({ error: 'Missing client action_id' });
  }

  const db = getDb();
  const existingReceipt = getReceipt(actionId);
  if (existingReceipt) {
    const payloadStr = JSON.stringify(req.body);
    if (existingReceipt.game_id === req.params.id && existingReceipt.request_payload === payloadStr) {
      return res.status(existingReceipt.response_status).json(JSON.parse(existingReceipt.response_body));
    } else {
      return res.status(409).json({ error: 'action_id reused with different target game or payload' });
    }
  }

  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const {
    expected_revision,
    action,
    seat = 'A',
    payload = {}
  } = req.body;

  if (expected_revision === undefined || expected_revision === null) {
    return res.status(400).json({ error: 'Missing expected_revision' });
  }

  if (game.revision !== expected_revision) {
    return res.status(409).json({
      error: 'stale_revision',
      message: 'Game state has been updated in another tab or window. Table refreshed.',
      current_revision: game.revision
    });
  }

  const activeSeat = (seat || 'A').toUpperCase();

  try {
    const actionTx = db.transaction(() => {
      let updatedGame = { ...game };
      const wasFinished = game.stage === 'finished' || game.winner !== null;

      if (wasFinished && action !== 'view') {
        throw new Error('Game is already finished; no further actions allowed.');
      }

      switch (action) {
        case 'discard': {
          const { cards } = payload;
          updatedGame = handleDiscard(updatedGame, activeSeat, cards);
          break;
        }
        case 'play_card': {
          const { card } = payload;
          updatedGame = handlePlayCard(updatedGame, activeSeat, card);
          break;
        }
        case 'go': {
          updatedGame = handleGo(updatedGame, activeSeat);
          break;
        }
        case 'next_hand': {
          updatedGame = handleNextHand(updatedGame);
          break;
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Advance revision
      updatedGame.revision = game.revision + 1;
      updatedGame.updated_at = new Date().toISOString();

      // Check if game just finished
      const isNowFinished = updatedGame.stage === 'finished' || updatedGame.winner !== null;
      if (!wasFinished && isNowFinished) {
        const winnerNo = updatedGame.winner === 'A' ? updatedGame.player_a : updatedGame.player_b;
        const loserNo = updatedGame.winner === 'A' ? updatedGame.player_b : updatedGame.player_a;

        // Update ladder members
        db.prepare('UPDATE members SET played = played + 1, won = won + 1 WHERE no = ?').run(winnerNo);
        db.prepare('UPDATE members SET played = played + 1 WHERE no = ?').run(loserNo);

        // Record in historical_games
        const dealerNo = updatedGame.dealer === 'A' ? updatedGame.player_a : updatedGame.player_b;
        const poneNo = updatedGame.dealer === 'A' ? updatedGame.player_b : updatedGame.player_a;
        const dealerScore = updatedGame.dealer === 'A' ? updatedGame.score_a : updatedGame.score_b;
        const poneScore = updatedGame.dealer === 'A' ? updatedGame.score_b : updatedGame.score_a;

        db.prepare(`
          INSERT INTO historical_games (id, dealer, pone, dealer_score, pone_score, finished, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET 
            dealer_score = excluded.dealer_score,
            pone_score = excluded.pone_score,
            finished = excluded.finished
        `).run(
          updatedGame.id,
          dealerNo,
          poneNo,
          dealerScore,
          poneScore,
          1,
          updatedGame.updated_at
        );
      }

      // Save game
      db.prepare(`
        UPDATE games SET
          score_a = ?,
          score_b = ?,
          hand_number = ?,
          dealer = ?,
          stage = ?,
          practice_mode = ?,
          practice_round_index = ?,
          state_json = ?,
          revision = ?,
          winner = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        updatedGame.score_a,
        updatedGame.score_b,
        updatedGame.hand_number,
        updatedGame.dealer,
        updatedGame.stage,
        updatedGame.practice_mode,
        updatedGame.practice_round_index,
        updatedGame.state_json,
        updatedGame.revision,
        updatedGame.winner,
        updatedGame.updated_at,
        updatedGame.id
      );

      const sanitized = sanitizeGameForSeat(updatedGame, activeSeat);
      saveReceipt(actionId, updatedGame.id, action, req.body, 200, sanitized);
      return sanitized;
    });

    const result = actionTx();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start listening
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gambit Hollow server listening on http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;

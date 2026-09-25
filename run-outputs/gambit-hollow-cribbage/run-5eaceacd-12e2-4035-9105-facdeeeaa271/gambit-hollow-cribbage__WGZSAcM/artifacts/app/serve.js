const express = require('express');
const path = require('path');
const fs = require('fs');
const {
  getDb,
  getMemberById,
  getMemberByNo,
  getAllMembers,
  getGameById,
  getGameByGameId,
  getActiveGames,
  createGame,
  updateGameScore,
  finishGame,
  incrementRevision,
  getReceipt,
  saveReceipt
} = require('./db');
const { scoreHand, scorePegging } = require('./scoring');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('www'));

// Generate a simple UUID
function generateId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `${timestamp}-${random}`;
}

// ============================================================================
// Health check
// ============================================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ============================================================================
// Get ladder (all members)
// ============================================================================
app.get('/api/ladder', (req, res) => {
  const members = getAllMembers();
  res.json({ members });
});

// ============================================================================
// Get active games
// ============================================================================
app.get('/api/games', (req, res) => {
  const games = getActiveGames();
  res.json({ games });
});

// ============================================================================
// Create new game
// ============================================================================
app.post('/api/games/new', (req, res) => {
  const { dealerMemberNo, poneMemberNo, dealerScore = 0, poneScore = 0, isPractice = false, practiceName = null } = req.body;
  
  const dealer = getMemberByNo(dealerMemberNo);
  const pone = getMemberByNo(poneMemberNo);
  
  if (!dealer || !pone) {
    return res.status(400).json({ error: 'Invalid member numbers' });
  }
  
  const gameId = `G-${generateId()}`;
  createGame(gameId, dealer.id, pone.id, isPractice, practiceName);
  
  const game = getGameByGameId(gameId);
  res.json({ game });
});

// ============================================================================
// Get game state
// ============================================================================
app.get('/api/games/:gameId', (req, res) => {
  const game = getGameByGameId(req.params.gameId);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  res.json({ game });
});

// ============================================================================
// Scoring bench
// ============================================================================
app.post('/api/score', (req, res) => {
  const { hand, cut, isCrib = false } = req.body;
  
  if (!Array.isArray(hand) || hand.length !== 4 || !cut) {
    return res.status(400).json({ error: 'Invalid hand or cut' });
  }
  
  const result = scoreHand(hand, cut, isCrib);
  if (!result) {
    return res.status(400).json({ error: 'Invalid cards' });
  }
  
  res.json(result);
});

// ============================================================================
// Get practice deals
// ============================================================================
app.get('/api/practice-deals', (req, res) => {
  const dealsPath = '/assets/club/practice-deals.json';
  const deals = JSON.parse(fs.readFileSync(dealsPath, 'utf8'));
  res.json(deals);
});

// ============================================================================
// Get 40 scored hands for bench
// ============================================================================
app.get('/api/scored-hands', (req, res) => {
  const handsPath = '/assets/club/scored-hands.js';
  const content = fs.readFileSync(handsPath, 'utf8');
  
  // Extract SCORED_HANDS from the JS file
  const match = content.match(/const SCORED_HANDS = (\[[\s\S]*?\]);/);
  if (!match) {
    return res.status(500).json({ error: 'Could not parse scored hands' });
  }
  
  // Safely evaluate the array
  const hands = eval('(' + match[1] + ')');
  res.json({ hands });
});

// ============================================================================
// Start server
// ============================================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cribbage board listening on port ${PORT}`);
});

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || '/app/gambit.db';

let db = null;

function getDb() {
  if (!db) {
    const isNew = !fs.existsSync(DB_PATH);
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    if (isNew) {
      initializeDatabase();
    }
  }
  return db;
}

function initializeDatabase() {
  const db = getDb();
  
  // Members
  db.exec(`
    CREATE TABLE members (
      id INTEGER PRIMARY KEY,
      member_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      played INTEGER DEFAULT 0,
      won INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Games
  db.exec(`
    CREATE TABLE games (
      id INTEGER PRIMARY KEY,
      game_id TEXT UNIQUE NOT NULL,
      dealer_member_id INTEGER NOT NULL,
      pone_member_id INTEGER NOT NULL,
      dealer_score INTEGER DEFAULT 0,
      pone_score INTEGER DEFAULT 0,
      finished INTEGER DEFAULT 0,
      hand_number INTEGER DEFAULT 0,
      revision INTEGER DEFAULT 0,
      is_practice INTEGER DEFAULT 0,
      practice_deal_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dealer_member_id) REFERENCES members(id),
      FOREIGN KEY (pone_member_id) REFERENCES members(id)
    )
  `);
  
  // Hands
  db.exec(`
    CREATE TABLE hands (
      id INTEGER PRIMARY KEY,
      game_id INTEGER NOT NULL,
      hand_number INTEGER NOT NULL,
      dealer_member_id INTEGER NOT NULL,
      pone_member_id INTEGER NOT NULL,
      dealer_cards TEXT NOT NULL,
      pone_cards TEXT NOT NULL,
      crib_cards TEXT,
      cut_card TEXT,
      pegging_log TEXT,
      dealer_pegging_score INTEGER DEFAULT 0,
      pone_pegging_score INTEGER DEFAULT 0,
      dealer_show_score INTEGER DEFAULT 0,
      pone_show_score INTEGER DEFAULT 0,
      dealer_crib_score INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id),
      FOREIGN KEY (dealer_member_id) REFERENCES members(id),
      FOREIGN KEY (pone_member_id) REFERENCES members(id)
    )
  `);
  
  // Actions (for history and recovery)
  db.exec(`
    CREATE TABLE actions (
      id INTEGER PRIMARY KEY,
      game_id INTEGER NOT NULL,
      action_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      player_member_id INTEGER,
      card TEXT,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id),
      FOREIGN KEY (player_member_id) REFERENCES members(id)
    )
  `);
  
  // Receipts (to prevent duplicate action processing)
  db.exec(`
    CREATE TABLE receipts (
      id INTEGER PRIMARY KEY,
      action_id TEXT UNIQUE NOT NULL,
      game_id INTEGER NOT NULL,
      response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id)
    )
  `);
  
  // Load seed data
  loadSeedData();
}

function loadSeedData() {
  const db = getDb();
  
  // Check if already seeded
  const count = db.prepare('SELECT COUNT(*) as count FROM members').get();
  if (count.count > 0) return;
  
  const seedPath = '/assets/club/records/gambit_seed_data.json';
  if (!fs.existsSync(seedPath)) return;
  
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  
  // Insert members
  const insertMember = db.prepare(`
    INSERT INTO members (member_no, name, played, won)
    VALUES (?, ?, ?, ?)
  `);
  
  const members = {};
  for (const member of seed.members) {
    const stmt = insertMember.run(member.no, member.name, member.played, member.won);
    members[member.no] = stmt.lastInsertRowid;
  }
  
  // Insert finished games
  const insertGame = db.prepare(`
    INSERT INTO games (game_id, dealer_member_id, pone_member_id, dealer_score, pone_score, finished)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  
  for (const game of seed.games) {
    if (game.finished) {
      insertGame.run(
        game.id,
        members[game.dealer],
        members[game.pone],
        game.dealer_score,
        game.pone_score
      );
    }
  }
}

// Query helpers
function getMemberById(id) {
  return getDb().prepare('SELECT * FROM members WHERE id = ?').get(id);
}

function getMemberByNo(no) {
  return getDb().prepare('SELECT * FROM members WHERE member_no = ?').get(no);
}

function getAllMembers() {
  return getDb().prepare('SELECT * FROM members ORDER BY played DESC, won DESC').all();
}

function getGameById(id) {
  const game = getDb().prepare('SELECT * FROM games WHERE id = ?').get(id);
  if (!game) return null;
  
  game.dealer = getMemberById(game.dealer_member_id);
  game.pone = getMemberById(game.pone_member_id);
  return game;
}

function getGameByGameId(gameId) {
  const game = getDb().prepare('SELECT * FROM games WHERE game_id = ?').get(gameId);
  if (!game) return null;
  
  game.dealer = getMemberById(game.dealer_member_id);
  game.pone = getMemberById(game.pone_member_id);
  return game;
}

function getActiveGames() {
  return getDb().prepare('SELECT * FROM games WHERE finished = 0 ORDER BY updated_at DESC').all().map(g => {
    g.dealer = getMemberById(g.dealer_member_id);
    g.pone = getMemberById(g.pone_member_id);
    return g;
  });
}

function createGame(gameId, dealerMemberId, poneMemberId, isPractice = false, practiceName = null) {
  const stmt = getDb().prepare(`
    INSERT INTO games (game_id, dealer_member_id, pone_member_id, is_practice, practice_deal_name)
    VALUES (?, ?, ?, ?, ?)
  `);
  return stmt.run(gameId, dealerMemberId, poneMemberId, isPractice ? 1 : 0, practiceName);
}

function updateGameScore(gameId, dealerScore, poneScore) {
  getDb().prepare(`
    UPDATE games SET dealer_score = ?, pone_score = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(dealerScore, poneScore, gameId);
}

function finishGame(gameId) {
  getDb().prepare(`
    UPDATE games SET finished = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(gameId);
}

function incrementHandNumber(gameId) {
  getDb().prepare(`
    UPDATE games SET hand_number = hand_number + 1, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(gameId);
}

function incrementRevision(gameId) {
  getDb().prepare(`
    UPDATE games SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(gameId);
}

function getReceipt(actionId) {
  return getDb().prepare('SELECT * FROM receipts WHERE action_id = ?').get(actionId);
}

function saveReceipt(actionId, gameId, response) {
  getDb().prepare(`
    INSERT INTO receipts (action_id, game_id, response)
    VALUES (?, ?, ?)
  `).run(actionId, gameId, response);
}

module.exports = {
  getDb,
  initializeDatabase,
  getMemberById,
  getMemberByNo,
  getAllMembers,
  getGameById,
  getGameByGameId,
  getActiveGames,
  createGame,
  updateGameScore,
  finishGame,
  incrementHandNumber,
  incrementRevision,
  getReceipt,
  saveReceipt
};

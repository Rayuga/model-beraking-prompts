const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_FILE = process.env.DB_PATH || '/app/gambit.db';
const SEED_FILE = '/assets/club/records/gambit_seed_data.json';

let db = null;

function getDb() {
  if (!db) {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_FILE);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS members (
      no TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      played INTEGER NOT NULL DEFAULT 0,
      won INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS historical_games (
      id TEXT PRIMARY KEY,
      dealer TEXT NOT NULL,
      pone TEXT NOT NULL,
      dealer_score INTEGER NOT NULL,
      pone_score INTEGER NOT NULL,
      finished INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      player_a TEXT NOT NULL,
      player_b TEXT NOT NULL,
      score_a INTEGER NOT NULL DEFAULT 0,
      score_b INTEGER NOT NULL DEFAULT 0,
      hand_number INTEGER NOT NULL DEFAULT 1,
      dealer TEXT NOT NULL DEFAULT 'A',
      stage TEXT NOT NULL DEFAULT 'discard',
      practice_mode TEXT,
      practice_round_index INTEGER DEFAULT 0,
      state_json TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      winner TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS action_receipts (
      action_id TEXT PRIMARY KEY,
      game_id TEXT,
      action_type TEXT NOT NULL,
      request_payload TEXT NOT NULL,
      response_status INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Check if seeded
  const seedRow = db.prepare('SELECT value FROM meta WHERE key = ?').get('seeded');
  if (!seedRow) {
    seedDatabase();
  }
}

function seedDatabase() {
  if (!fs.existsSync(SEED_FILE)) {
    console.warn(`Seed file not found at ${SEED_FILE}`);
    return;
  }

  const raw = fs.readFileSync(SEED_FILE, 'utf8');
  const data = JSON.parse(raw);

  const insertMember = db.prepare(`
    INSERT INTO members (no, name, played, won)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(no) DO NOTHING
  `);

  const insertHist = db.prepare(`
    INSERT INTO historical_games (id, dealer, pone, dealer_score, pone_score, finished, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);

  const setMeta = db.prepare(`
    INSERT INTO meta (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const seedTx = db.transaction(() => {
    if (Array.isArray(data.members)) {
      for (const m of data.members) {
        insertMember.run(m.no, m.name, m.played, m.won);
      }
    }
    if (Array.isArray(data.games)) {
      for (const g of data.games) {
        insertHist.run(
          g.id,
          g.dealer,
          g.pone,
          g.dealer_score,
          g.pone_score,
          g.finished ? 1 : 0,
          new Date().toISOString()
        );
      }
    }
    setMeta.run('seeded', '1');
    setMeta.run('target', String(data.target || 121));
  });

  seedTx();
  console.log('Database seeded successfully.');
}

function getReceipt(actionId) {
  const stmt = getDb().prepare('SELECT * FROM action_receipts WHERE action_id = ?');
  return stmt.get(actionId);
}

function saveReceipt(actionId, gameId, actionType, requestPayload, responseStatus, responseBody) {
  const stmt = getDb().prepare(`
    INSERT INTO action_receipts (action_id, game_id, action_type, request_payload, response_status, response_body, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    actionId,
    gameId || null,
    actionType,
    typeof requestPayload === 'string' ? requestPayload : JSON.stringify(requestPayload),
    responseStatus,
    typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody),
    new Date().toISOString()
  );
}

module.exports = {
  DB_FILE,
  getDb,
  getReceipt,
  saveReceipt
};

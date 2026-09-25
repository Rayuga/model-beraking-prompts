const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { SCORED_HANDS } = require('/assets/club/scored-hands.js');
const PRACTICE_DEALS = JSON.parse(fs.readFileSync('/assets/club/practice-deals.json', 'utf8'));
const SEED_DATA = JSON.parse(fs.readFileSync('/assets/club/records/gambit_seed_data.json', 'utf8'));
const Rules = require('./www/shared.js');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DB_PATH = path.resolve(process.env.DB_PATH || '/app/gambit.db');
const WWW_DIR = path.join(__dirname, 'www');
const TARGET = Number(SEED_DATA.target || 121);

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

let STMT_INSERT_LADDER;
let STMT_INSERT_HISTORY;
let STMT_INSERT_GAME;
let STMT_UPDATE_GAME;
let STMT_INSERT_RECEIPT;
let STMT_UPDATE_PLAYED;
let STMT_UPDATE_WON;

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '256kb' }));
app.use(express.static(WWW_DIR, { extensions: ['html'], maxAge: 0 }));

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function otherSeat(seat) {
  return seat === 'A' ? 'B' : 'A';
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = canonical(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function hashRequest(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
}

function jsonResponse(res, status, payload) {
  return res.status(status).json(payload);
}

function parseActionHeaders(req) {
  return {
    actionId: req.get('X-Action-Id') || req.body?.actionId || null,
    expectedRevision: req.get('X-Expected-Revision') ?? req.body?.expectedRevision ?? null,
  };
}

function intInRange(value, min, max) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function loadMembers() {
  return SEED_DATA.members.map((member) => ({
    no: member.no,
    name: member.name,
    played: member.played,
    won: member.won,
  }));
}

function seedDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ladder_members (
      no TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      played INTEGER NOT NULL,
      won INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS historical_games (
      id TEXT PRIMARY KEY,
      raw_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL,
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS action_receipts (
      action_id TEXT PRIMARY KEY,
      game_id TEXT,
      kind TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      response_code INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const countMembers = db.prepare('SELECT COUNT(*) AS c FROM ladder_members').get().c;
  if (countMembers === 0) {
    const insertLadder = db.prepare('INSERT INTO ladder_members (no, name, played, won) VALUES (?, ?, ?, ?)');
    const tx = db.transaction((members) => {
      for (const member of members) insertLadder.run(member.no, member.name, member.played, member.won);
    });
    tx(loadMembers());
  }

  const countHistory = db.prepare('SELECT COUNT(*) AS c FROM historical_games').get().c;
  if (countHistory === 0) {
    const insertHistory = db.prepare('INSERT INTO historical_games (id, raw_json) VALUES (?, ?)');
    const tx = db.transaction((games) => {
      for (const game of games) insertHistory.run(game.id, JSON.stringify(game));
    });
    tx(SEED_DATA.games || []);
  }
}

seedDatabase();
STMT_INSERT_LADDER = db.prepare('INSERT INTO ladder_members (no, name, played, won) VALUES (?, ?, ?, ?)');
STMT_INSERT_HISTORY = db.prepare('INSERT INTO historical_games (id, raw_json) VALUES (?, ?)');
STMT_INSERT_GAME = db.prepare('INSERT INTO games (id, revision, state_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
STMT_UPDATE_GAME = db.prepare('UPDATE games SET revision = ?, state_json = ?, updated_at = ? WHERE id = ?');
STMT_INSERT_RECEIPT = db.prepare('INSERT INTO action_receipts (action_id, game_id, kind, request_hash, response_code, response_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
STMT_UPDATE_PLAYED = db.prepare('UPDATE ladder_members SET played = played + 1 WHERE no IN (?, ?)');
STMT_UPDATE_WON = db.prepare('UPDATE ladder_members SET won = won + 1 WHERE no = ?');


function readLadder() {
  return db.prepare('SELECT no, name, played, won FROM ladder_members ORDER BY no').all().map((row) => ({
    no: row.no,
    name: row.name,
    played: row.played,
    won: row.won,
  }));
}

function readHistory() {
  return db.prepare('SELECT id, raw_json FROM historical_games ORDER BY id').all().map((row) => JSON.parse(row.raw_json));
}

function getGameRow(id) {
  return db.prepare('SELECT id, revision, state_json, created_at, updated_at FROM games WHERE id = ?').get(id);
}

function loadGame(id) {
  const row = getGameRow(id);
  if (!row) return null;
  const state = JSON.parse(row.state_json);
  state.id = row.id;
  state.revision = row.revision;
  state.createdAt = row.created_at;
  state.updatedAt = row.updated_at;
  return state;
}

function saveGame(state) {
  const updatedAt = nowIso();
  const stored = clone(state);
  delete stored.id;
  delete stored.revision;
  delete stored.createdAt;
  delete stored.updatedAt;
  STMT_UPDATE_GAME.run(state.revision, JSON.stringify(stored), updatedAt, state.id);
  state.updatedAt = updatedAt;
}

function insertGame(state) {
  const createdAt = nowIso();
  state.createdAt = createdAt;
  state.updatedAt = createdAt;
  const stored = clone(state);
  delete stored.id;
  delete stored.revision;
  delete stored.createdAt;
  delete stored.updatedAt;
  STMT_INSERT_GAME.run(state.id, state.revision, JSON.stringify(stored), createdAt, createdAt);
}

function buildSeatMembers(body) {
  const members = readLadder();
  const defaultA = members[0];
  const defaultB = members[1] || members[0];
  const seatA = members.find((m) => m.no === body.seatA) || defaultA;
  const seatB = members.find((m) => m.no === body.seatB) || defaultB;
  if (!seatA || !seatB) throw new Error('Need at least two ladder members');
  if (seatA.no === seatB.no) throw new Error('Seats must be different members');
  return { A: seatA, B: seatB };
}

function buildNormalDeal() {
  const deck = Rules.shuffleDeck(Rules.createDeck(), () => crypto.randomInt(0, 0x7fffffff) / 0x80000000);
  return {
    A: deck.slice(0, 6),
    B: deck.slice(6, 12),
    cut: deck[12],
  };
}

function buildPracticeDeal(practiceKey, dealerSeat) {
  const practice = PRACTICE_DEALS[practiceKey];
  if (!practice) throw new Error(`Unknown practice deal: ${practiceKey}`);
  if (practiceKey === 'club_series') {
    const rounds = practice.rounds || [];
    if (!rounds.length) throw new Error('club_series needs rounds');
    return { practice, deal: roundDeal(practice, dealerSeat, 0) };
  }
  return {
    practice,
    deal: {
      A: practice.a.slice(),
      B: practice.b.slice(),
      cut: practice.cut,
    },
  };
}

function roundDeal(practice, dealerSeat, roundIndex) {
  const rounds = practice.rounds || [];
  const roundName = rounds[roundIndex % rounds.length];
  const round = practice[roundName];
  if (!round) throw new Error(`Missing practice round: ${roundName}`);
  if (dealerSeat === 'A') {
    return {
      A: round.a.slice(),
      B: round.b.slice(),
      cut: round.cut,
      roundName,
    };
  }
  return {
    A: round.b.slice(),
    B: round.a.slice(),
    cut: round.cut,
    roundName,
  };
}

function createGameState(body) {
  const mode = body.mode === 'practice' ? 'practice' : 'normal';
  const seats = buildSeatMembers(body);
  const scoreA = intInRange(body.scoreA ?? body.scores?.A ?? 0, 0, 120);
  const scoreB = intInRange(body.scoreB ?? body.scores?.B ?? 0, 0, 120);
  if (scoreA === null || scoreB === null) throw new Error('Starting scores must be whole numbers from 0 to 120');
  const practiceKey = mode === 'practice' ? String(body.practiceKey || 'pegging') : null;
  const practiceScope = practiceKey === 'club_series' ? 'series' : (practiceKey ? 'single' : null);
  const gameId = `G-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  let deal;
  let practiceRoundIndex = 0;
  if (practiceKey) {
    if (practiceKey === 'club_series') {
      const info = buildPracticeDeal(practiceKey, 'A');
      deal = info.deal;
    } else {
      const info = buildPracticeDeal(practiceKey, 'A');
      deal = info.deal;
    }
  } else {
    deal = buildNormalDeal();
  }
  const state = {
    id: gameId,
    revision: 0,
    mode,
    practice: {
      key: practiceKey,
      scope: practiceScope,
      roundIndex: practiceRoundIndex,
    },
    members: seats,
    dealerSeat: 'A',
    handNo: 1,
    phase: 'discard',
    target: TARGET,
    scores: { A: scoreA, B: scoreB },
    winnerSeat: null,
    ladderApplied: false,
    hand: {
      initial: { A: deal.A.slice(), B: deal.B.slice() },
      kept: { A: [], B: [] },
      discards: { A: [], B: [] },
      pendingCut: deal.cut,
      cut: null,
      crib: [],
      roundName: deal.roundName || null,
    },
    pegging: {
      count: 0,
      pile: [],
      remaining: { A: [], B: [] },
      passed: { A: false, B: false },
      turnSeat: null,
      lastPlayer: null,
      commentary: [],
    },
    show: {
      results: [],
      complete: false,
      stoppedAt: null,
    },
    commentary: [],
    notes: [],
  };
  if (practiceKey === 'club_series') {
    state.hand.roundName = buildPracticeDeal(practiceKey, 'A').deal.roundName || null;
  }
  if (practiceKey && practiceKey !== 'club_series') {
    state.hand.recommendedDiscards = {
      A: state.hand.initial.A.slice(4),
      B: state.hand.initial.B.slice(4),
    };
  }
  return state;
}

function recordCommentary(state, message) {
  state.commentary.push(message);
  if (state.commentary.length > 24) state.commentary.shift();
}

function addPoints(state, seat, points, source) {
  if (!points) return false;
  const before = state.scores[seat];
  state.scores[seat] = Math.min(TARGET, state.scores[seat] + points);
  recordCommentary(state, `${state.members[seat].name} scores ${points} for ${source} (${before} → ${state.scores[seat]}).`);
  if (state.scores[seat] >= TARGET) {
    state.phase = 'finished';
    state.winnerSeat = seat;
    return true;
  }
  return false;
}

function finishIfNeeded(state) {
  if (state.scores.A >= TARGET || state.scores.B >= TARGET) {
    const winnerSeat = state.scores.A >= TARGET ? 'A' : 'B';
    state.phase = 'finished';
    state.winnerSeat = winnerSeat;
    return true;
  }
  return false;
}

function currentPlayerCanPlay(state, seat) {
  return Rules.legalPegCards(state.pegging.remaining[seat], state.pegging.count, state.pegging.passed[seat]).length > 0;
}

function resolveLeadAfterReset(state, preferredSeat) {
  const other = otherSeat(preferredSeat);
  const prefLegal = Rules.legalPegCards(state.pegging.remaining[preferredSeat], 0, false).length > 0;
  const otherLegal = Rules.legalPegCards(state.pegging.remaining[other], 0, false).length > 0;
  if (otherLegal) return other;
  if (prefLegal) return preferredSeat;
  return null;
}

function computeShowOrder(state) {
  const poneSeat = otherSeat(state.dealerSeat);
  return [
    { kind: 'hand', seat: poneSeat, label: 'Non-dealer' },
    { kind: 'hand', seat: state.dealerSeat, label: 'Dealer' },
    { kind: 'crib', seat: state.dealerSeat, label: 'Crib' },
  ];
}

function runShow(state) {
  state.show = { results: [], complete: false, stoppedAt: null };
  const order = computeShowOrder(state);
  for (const stage of order) {
    const cards = stage.kind === 'crib' ? state.hand.crib.map((item) => item.card) : state.hand.kept[stage.seat];
    const scoring = Rules.scoreHand(cards, state.hand.cut, stage.kind === 'crib');
    const result = {
      kind: stage.kind,
      seat: stage.seat,
      label: stage.label,
      cards: cards.slice(),
      cut: state.hand.cut,
      total: scoring.total,
      parts: scoring.parts,
      details: scoring.details,
    };
    state.show.results.push(result);
    const seat = stage.seat;
    const before = state.scores[seat];
    state.scores[seat] = Math.min(TARGET, state.scores[seat] + scoring.total);
    recordCommentary(state, `${stage.label} counts ${scoring.total} (${before} → ${state.scores[seat]}).`);
    if (state.scores[seat] >= TARGET) {
      state.phase = 'finished';
      state.winnerSeat = seat;
      state.show.stoppedAt = stage.kind;
      return;
    }
  }
  state.show.complete = true;
  state.phase = 'show';
}

function startPegging(state) {
  state.phase = 'pegging';
  state.hand.cut = state.hand.pendingCut;
  state.pegging = {
    count: 0,
    pile: [],
    remaining: {
      A: state.hand.kept.A.slice(),
      B: state.hand.kept.B.slice(),
    },
    passed: { A: false, B: false },
    turnSeat: otherSeat(state.dealerSeat),
    lastPlayer: null,
    commentary: [],
  };
  const cutCard = Rules.parseCard(state.hand.cut);
  if (cutCard.rank === 'J') {
    const dealer = state.dealerSeat;
    recordCommentary(state, `${state.members[dealer].name} turns the jack and scores his heels for 2.`);
    addPoints(state, dealer, 2, 'his heels');
    if (!finishIfNeeded(state)) {
      state.pegging.turnSeat = otherSeat(state.dealerSeat);
    }
    return;
  }
  recordCommentary(state, `Cut is ${state.hand.cut}. ${state.members[otherSeat(state.dealerSeat)].name} leads pegging.`);
}

function completeDiscardIfReady(state) {
  const ready = state.hand.discards.A.length === 2 && state.hand.discards.B.length === 2;
  if (!ready || state.phase !== 'discard') return;
  state.hand.cut = state.hand.pendingCut;
  state.hand.crib = [
    { seat: 'A', card: state.hand.discards.A[0] },
    { seat: 'A', card: state.hand.discards.A[1] },
    { seat: 'B', card: state.hand.discards.B[0] },
    { seat: 'B', card: state.hand.discards.B[1] },
  ];
  recordCommentary(state, `Both players discard. The cut card is ${state.hand.pendingCut}.`);
  state.hand.kept = {
    A: state.hand.initial.A.filter((card) => !state.hand.discards.A.includes(card)),
    B: state.hand.initial.B.filter((card) => !state.hand.discards.B.includes(card)),
  };
  startPegging(state);
  if (state.phase !== 'finished' && state.phase !== 'show') {
    state.pegging.remaining = {
      A: state.hand.kept.A.slice(),
      B: state.hand.kept.B.slice(),
    };
  }
}

function maybeEndPegging(state, justPlayedSeat) {
  if (state.phase === 'finished') return;
  const remainingA = state.pegging.remaining.A.length;
  const remainingB = state.pegging.remaining.B.length;
  const totalRemaining = remainingA + remainingB;
  const count = state.pegging.count;
  const lastPlayer = justPlayedSeat || state.pegging.lastPlayer;

  if (count === 31) {
    state.pegging.count = 0;
    state.pegging.pile = [];
    state.pegging.passed = { A: false, B: false };
    const lead = resolveLeadAfterReset(state, otherSeat(lastPlayer || state.dealerSeat));
    if (!lead) {
      if (totalRemaining === 0) {
        state.pegging.turnSeat = null;
        runShow(state);
      }
      return;
    }
    state.pegging.turnSeat = lead;
    return;
  }

  if (totalRemaining === 0) {
    if (lastPlayer && count < 31) {
      addPoints(state, lastPlayer, 1, 'last card');
    }
    state.pegging.turnSeat = null;
    runShow(state);
    return;
  }

  const legalA = Rules.legalPegCards(state.pegging.remaining.A, count, state.pegging.passed.A);
  const legalB = Rules.legalPegCards(state.pegging.remaining.B, count, state.pegging.passed.B);

  if (legalA.length === 0 && legalB.length === 0) {
    if (lastPlayer && totalRemaining > 0) {
      addPoints(state, lastPlayer, 1, 'go');
      if (state.phase === 'finished') return;
    }
    state.pegging.count = 0;
    state.pegging.pile = [];
    state.pegging.passed = { A: false, B: false };
    const lead = resolveLeadAfterReset(state, otherSeat(lastPlayer || state.dealerSeat));
    if (lead) {
      state.pegging.turnSeat = lead;
      recordCommentary(state, `${state.members[lead].name} leads the new count.`);
    } else if (totalRemaining === 0) {
      state.pegging.turnSeat = null;
      runShow(state);
    }
    return;
  }

  const current = state.pegging.turnSeat;
  const other = otherSeat(current);
  const currentLegal = Rules.legalPegCards(state.pegging.remaining[current], count, state.pegging.passed[current]);
  const otherLegal = Rules.legalPegCards(state.pegging.remaining[other], count, state.pegging.passed[other]);
  if (otherLegal.length > 0) {
    state.pegging.turnSeat = other;
    return;
  }
  if (currentLegal.length > 0) {
    state.pegging.turnSeat = current;
    return;
  }
  if (lastPlayer && totalRemaining > 0) {
    addPoints(state, lastPlayer, 1, 'go');
    if (state.phase === 'finished') return;
  }
  state.pegging.count = 0;
  state.pegging.pile = [];
  state.pegging.passed = { A: false, B: false };
  const lead = resolveLeadAfterReset(state, otherSeat(lastPlayer || state.dealerSeat));
  if (lead) {
    state.pegging.turnSeat = lead;
    recordCommentary(state, `${state.members[lead].name} leads the new count.`);
  } else if (totalRemaining === 0) {
    state.pegging.turnSeat = null;
    runShow(state);
  }
}

function applyDiscard(state, seat, cards) {
  if (state.phase !== 'discard') throw new Error('This hand is no longer at discard.');
  if (!['A', 'B'].includes(seat)) throw new Error('Invalid seat.');
  if (state.hand.discards[seat].length) throw new Error(`${state.members[seat].name} has already discarded.`);
  const parsed = cards.map((card) => Rules.parseCard(card).code);
  if (parsed.length !== 2) throw new Error('Discard exactly two cards.');
  const unique = new Set(parsed);
  if (unique.size !== 2) throw new Error('Discard cards must be different.');
  const initial = state.hand.initial[seat];
  for (const card of parsed) {
    if (!initial.includes(card)) throw new Error(`${card} is not in ${state.members[seat].name}'s hand.`);
  }
  state.hand.discards[seat] = parsed;
  state.hand.kept[seat] = initial.filter((card) => !parsed.includes(card));
  recordCommentary(state, `${state.members[seat].name} discards ${parsed.join(' ')}.`);
  completeDiscardIfReady(state);
  if (!finishIfNeeded(state) && state.phase === 'pegging') {
    state.pegging.remaining = {
      A: state.hand.kept.A.slice(),
      B: state.hand.kept.B.slice(),
    };
  }
}

function applyPlay(state, seat, cardCode) {
  if (state.phase !== 'pegging') throw new Error('Pegging is not active.');
  if (state.pegging.turnSeat !== seat) throw new Error(`It is not ${state.members[seat].name}'s turn.`);
  if (state.pegging.passed[seat]) throw new Error(`${state.members[seat].name} has already said go for this count.`);
  const card = Rules.parseCard(cardCode).code;
  const remaining = state.pegging.remaining[seat];
  if (!remaining.includes(card)) throw new Error(`${card} is not in ${state.members[seat].name}'s pegging hand.`);
  const score = Rules.scorePeggingPlay(state.pegging.pile.map((item) => item.card), card, state.pegging.count);
  if (score.countAfter > 31) throw new Error('That play would exceed thirty-one.');
  remaining.splice(remaining.indexOf(card), 1);
  state.pegging.pile.push({ seat, card, points: score.points, reasons: score.reasons });
  state.pegging.count = score.countAfter;
  state.pegging.lastPlayer = seat;
  state.pegging.commentary.push(`${state.members[seat].name} plays ${card} for ${score.points || 0}.`);
  if (state.pegging.commentary.length > 24) state.pegging.commentary.shift();
  recordCommentary(state, `${state.members[seat].name} lays ${card}${score.points ? ` for ${score.points}` : ''}.`);
  for (const reason of score.reasons) {
    if (addPoints(state, seat, reason.points, reason.text)) {
      return;
    }
  }
  if (state.phase === 'finished') return;
  if (state.pegging.count === 31) {
    maybeEndPegging(state, seat);
    return;
  }
  maybeEndPegging(state, seat);
}

function applyGo(state, seat) {
  if (state.phase !== 'pegging') throw new Error('Pegging is not active.');
  if (state.pegging.turnSeat !== seat) throw new Error(`It is not ${state.members[seat].name}'s turn.`);
  const legal = Rules.legalPegCards(state.pegging.remaining[seat], state.pegging.count, state.pegging.passed[seat]);
  if (legal.length) throw new Error(`${state.members[seat].name} still has legal plays.`);
  state.pegging.passed[seat] = true;
  const other = otherSeat(seat);
  recordCommentary(state, `${state.members[seat].name} says go.`);
  const otherLegal = Rules.legalPegCards(state.pegging.remaining[other], state.pegging.count, state.pegging.passed[other]);
  if (otherLegal.length) {
    state.pegging.turnSeat = other;
    return;
  }
  maybeEndPegging(state, state.pegging.lastPlayer || seat);
}

function applyNextHand(state) {
  if (state.phase !== 'show') throw new Error('The hand is not ready for the next deal yet.');
  if (!state.show.complete) throw new Error('Finish reading the count before starting the next hand.');
  const nextDealer = otherSeat(state.dealerSeat);
  state.dealerSeat = nextDealer;
  state.handNo += 1;
  state.phase = 'discard';
  state.winnerSeat = null;
  state.hand = {
    initial: { A: [], B: [] },
    kept: { A: [], B: [] },
    discards: { A: [], B: [] },
    pendingCut: null,
    cut: null,
    crib: [],
    roundName: null,
  };
  state.pegging = {
    count: 0,
    pile: [],
    remaining: { A: [], B: [] },
    passed: { A: false, B: false },
    turnSeat: null,
    lastPlayer: null,
    commentary: [],
  };
  state.show = { results: [], complete: false, stoppedAt: null };
  const usePractice = state.practice.key && state.practice.scope === 'series';
  if (usePractice) {
    const practice = PRACTICE_DEALS[state.practice.key];
    const round = roundDeal(practice, state.dealerSeat, state.practice.roundIndex);
    state.practice.roundIndex += 1;
    state.hand.initial = {
      A: round.A.slice(),
      B: round.B.slice(),
    };
    state.hand.pendingCut = round.cut;
    state.hand.roundName = round.roundName || null;
  } else {
    if (state.practice.key && state.practice.scope === 'single') {
      state.practice = { key: null, scope: null, roundIndex: 0 };
      state.mode = 'normal';
    }
    const deal = buildNormalDeal();
    state.hand.initial = { A: deal.A.slice(), B: deal.B.slice() };
    state.hand.pendingCut = deal.cut;
  }
  if (state.practice.key && state.practice.scope === 'single') {
    state.hand.recommendedDiscards = {
      A: state.hand.initial.A.slice(4),
      B: state.hand.initial.B.slice(4),
    };
  } else {
    delete state.hand.recommendedDiscards;
  }
  recordCommentary(state, `Hand ${state.handNo} begins. ${state.members[state.dealerSeat].name} deals.`);
}

function updateLadderForWinner(state) {
  if (state.ladderApplied || !state.winnerSeat) return;
  const winnerMember = state.members[state.winnerSeat].no;
  const loserSeat = otherSeat(state.winnerSeat);
  const loserMember = state.members[loserSeat].no;
  STMT_UPDATE_PLAYED.run(winnerMember, loserMember);
  STMT_UPDATE_WON.run(winnerMember);
  state.ladderApplied = true;
}

function receiptLookup(actionId) {
  return db.prepare('SELECT action_id, game_id, kind, request_hash, response_code, response_json FROM action_receipts WHERE action_id = ?').get(actionId);
}

function storeReceipt(receipt) {
  STMT_INSERT_RECEIPT.run(
    receipt.actionId,
    receipt.gameId,
    receipt.kind,
    receipt.requestHash,
    receipt.responseCode,
    JSON.stringify(receipt.responseBody),
    nowIso(),
  );
}

function makeResponseBody(state, seat, extra = {}) {
  return {
    ok: true,
    revision: state.revision,
    game: redactGame(state, seat),
    ...extra,
  };
}

function redactGame(state, seat) {
  const game = clone(state);
  const revealAll = Boolean(game.show && game.show.complete);
  if (revealAll) return game;
  const other = otherSeat(seat || 'A');
  if (game.hand) {
    if (game.hand.initial?.[other]) game.hand.initial[other] = game.hand.initial[other].map(() => 'XX');
    if (game.hand.kept?.[other]) game.hand.kept[other] = game.hand.kept[other].map(() => 'XX');
    if (game.hand.discards?.[other]) game.hand.discards[other] = [];
    if (game.hand.recommendedDiscards) {
      game.hand.recommendedDiscards = { [seat || 'A']: game.hand.recommendedDiscards[seat || 'A'] || [] };
    }
    if (game.hand.crib) game.hand.crib = game.hand.crib.map(() => ({ seat: '?', card: 'XX' }));
    if (game.hand.pendingCut && game.phase === 'discard') game.hand.pendingCut = null;
  }
  if (game.pegging) {
    if (game.pegging.remaining?.[other]) game.pegging.remaining[other] = game.pegging.remaining[other].map(() => 'XX');
  }
  return game;
}

function buildGameSummary(state, meta = {}) {
  return {
    id: state.id || meta.id,
    revision: state.revision ?? meta.revision ?? 0,
    mode: state.mode,
    practice: state.practice,
    phase: state.phase,
    target: state.target,
    handNo: state.handNo,
    dealerSeat: state.dealerSeat,
    dealerName: state.members[state.dealerSeat].name,
    poneName: state.members[otherSeat(state.dealerSeat)].name,
    scores: state.scores,
    winnerSeat: state.winnerSeat,
    winnerName: state.winnerSeat ? state.members[state.winnerSeat].name : null,
    updatedAt: state.updatedAt || meta.updated_at || null,
  };
}

function isGameFinished(state) {
  return state.phase === 'finished' || state.winnerSeat || state.scores.A >= TARGET || state.scores.B >= TARGET;
}

function handleReceipt(actionId, kind, requestHash, gameId, responseCode, responseBody) {
  storeReceipt({
    actionId,
    gameId,
    kind,
    requestHash,
    responseCode,
    responseBody,
  });
}

function createGame(req, res) {
  const headers = parseActionHeaders(req);
  if (!headers.actionId) return jsonResponse(res, 400, { ok: false, error: 'Missing X-Action-Id.' });
  const requestHash = hashRequest({ kind: 'create_game', body: req.body || {}, expectedRevision: headers.expectedRevision });
  const existing = receiptLookup(headers.actionId);
  if (existing) {
    if (existing.kind !== 'create_game' || existing.request_hash !== requestHash) {
      return jsonResponse(res, 409, { ok: false, error: 'That action id was already used for different create-game input.' });
    }
    return jsonResponse(res, existing.response_code, JSON.parse(existing.response_json));
  }

  let state;
  try {
    state = createGameState(req.body || {});
  } catch (error) {
    return jsonResponse(res, 400, { ok: false, error: error.message });
  }

  const tx = db.transaction((gameState) => {
    insertGame(gameState);
    const response = makeResponseBody(gameState, req.body?.viewerSeat || 'A', { message: 'New game created.' });
    handleReceipt(headers.actionId, 'create_game', requestHash, gameState.id, 201, response);
    return response;
  });

  try {
    const response = tx(state);
    return jsonResponse(res, 201, response);
  } catch (error) {
    return jsonResponse(res, 500, { ok: false, error: error.message });
  }
}

function applyGameAction(req, res) {
  const gameId = req.params.id;
  const headers = parseActionHeaders(req);
  if (!headers.actionId) return jsonResponse(res, 400, { ok: false, error: 'Missing X-Action-Id.' });
  const body = req.body || {};
  const kind = body.kind;
  if (!kind) return jsonResponse(res, 400, { ok: false, error: 'Missing action kind.' });
  const requestHash = hashRequest({ gameId, kind, body, expectedRevision: headers.expectedRevision });
  const existing = receiptLookup(headers.actionId);
  if (existing) {
    if (existing.game_id !== gameId || existing.kind !== kind || existing.request_hash !== requestHash) {
      return jsonResponse(res, 409, { ok: false, error: 'That action id was already used for different game input.' });
    }
    return jsonResponse(res, existing.response_code, JSON.parse(existing.response_json));
  }

  const state = loadGame(gameId);
  if (!state) return jsonResponse(res, 404, { ok: false, error: 'Unknown game.' });
  const expectedRevision = intInRange(headers.expectedRevision, 0, Number.MAX_SAFE_INTEGER);
  if (expectedRevision === null || expectedRevision !== state.revision) {
    return jsonResponse(res, 409, {
      ok: false,
      error: 'Revision mismatch. Refresh the game and try again.',
      revision: state.revision,
      game: redactGame(state, body.seat || 'A'),
    });
  }
  if (isGameFinished(state) && kind !== 'next_hand') {
    return jsonResponse(res, 409, { ok: false, error: 'This game has already finished.', revision: state.revision, game: redactGame(state, body.seat || 'A') });
  }

  const tx = db.transaction((gameState) => {
    const seat = body.seat || 'A';
    let message = '';
    if (kind === 'discard') {
      applyDiscard(gameState, seat, body.cards || []);
      message = 'Discard saved.';
    } else if (kind === 'play') {
      applyPlay(gameState, seat, body.card);
      message = 'Play accepted.';
    } else if (kind === 'go') {
      applyGo(gameState, seat);
      message = 'Go accepted.';
    } else if (kind === 'next_hand') {
      applyNextHand(gameState);
      message = 'Next hand ready.';
    } else {
      throw new Error(`Unknown action kind: ${kind}`);
    }
    gameState.revision += 1;
    if (gameState.phase === 'finished' && gameState.winnerSeat && !gameState.ladderApplied) {
      updateLadderForWinner(gameState);
    }
    saveGame(gameState);
    const response = makeResponseBody(gameState, seat, { message });
    handleReceipt(headers.actionId, kind, requestHash, gameState.id, 200, response);
    return response;
  });

  try {
    const response = tx(state);
    return jsonResponse(res, 200, response);
  } catch (error) {
    return jsonResponse(res, 400, { ok: false, error: error.message, revision: state.revision, game: redactGame(state, body.seat || 'A') });
  }
}

app.get('/api/health', (req, res) => {
  jsonResponse(res, 200, { ok: true, dbPath: DB_PATH });
});

app.get('/api/bootstrap', (req, res) => {
  jsonResponse(res, 200, {
    ok: true,
    target: TARGET,
    ladder: readLadder(),
    history: readHistory(),
    scoredHands: SCORED_HANDS,
    practiceDeals: PRACTICE_DEALS,
    games: db.prepare('SELECT id, revision, state_json, created_at, updated_at FROM games ORDER BY updated_at DESC').all().map((row) => buildGameSummary(JSON.parse(row.state_json), row)),
  });
});

app.get('/api/ladder', (req, res) => {
  jsonResponse(res, 200, { ok: true, target: TARGET, members: readLadder() });
});

app.get('/api/history', (req, res) => {
  jsonResponse(res, 200, { ok: true, games: readHistory() });
});

app.get('/api/history/:id', (req, res) => {
  const row = db.prepare('SELECT raw_json FROM historical_games WHERE id = ?').get(req.params.id);
  if (!row) return jsonResponse(res, 404, { ok: false, error: 'Unknown historical summary.' });
  jsonResponse(res, 200, { ok: true, game: JSON.parse(row.raw_json) });
});

app.get('/api/games', (req, res) => {
  const rows = db.prepare('SELECT id, revision, state_json, created_at, updated_at FROM games ORDER BY updated_at DESC').all();
  jsonResponse(res, 200, {
    ok: true,
    games: rows.map((row) => buildGameSummary(JSON.parse(row.state_json), row)),
  });
});

app.get('/api/games/:id', (req, res) => {
  const state = loadGame(req.params.id);
  if (!state) return jsonResponse(res, 404, { ok: false, error: 'Unknown game.' });
  jsonResponse(res, 200, {
    ok: true,
    revision: state.revision,
    game: redactGame(state, req.query.seat || 'A'),
  });
});

app.post('/api/games', createGame);
app.post('/api/games/:id/actions', applyGameAction);

app.get('/', (req, res) => {
  res.sendFile(path.join(WWW_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  jsonResponse(res, 500, { ok: false, error: err.message || 'Unexpected error.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gambit Hollow listening on 0.0.0.0:${PORT}`);
});

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const Database = require('better-sqlite3');

const APP_ROOT = '/app';
const DATA_ROOT = '/assets/club';
const DB_PATH = process.env.DB_PATH || path.join(APP_ROOT, 'gambit.db');
const PORT = Number(process.env.PORT || 3000);
const TARGET_SCORE = 121;

const seedData = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, 'records', 'gambit_seed_data.json'), 'utf8'));
const practiceData = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, 'practice-deals.json'), 'utf8'));
const scoredHands = require(path.join(DATA_ROOT, 'scored-hands.js')).SCORED_HANDS;

const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
const RANK_VALUE = Object.fromEntries(RANKS.map((rank, index) => [rank, index + 1]));
const CARD_VALUE = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 10, Q: 10, K: 10,
};

const app = express();
const db = new Database(DB_PATH);

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(APP_ROOT, 'www')));

function nowIso() {
  return new Date().toISOString();
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => stableStringify(item)).join(',') + ']';
  }
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function hashPayload(payload) {
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function randInt(max) {
  return crypto.randomInt(max);
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`.toUpperCase();
}

function parseCard(code) {
  if (typeof code !== 'string' || !/^[A23456789TJQK][SHDC]$/.test(code)) {
    throw new Error(`Invalid card: ${code}`);
  }
  return { code, rank: code[0], suit: code[1], value: CARD_VALUE[code[0]], rankValue: RANK_VALUE[code[0]] };
}

function cardToCode(card) {
  return typeof card === 'string' ? card : card.code;
}

function ensureUniqueCards(cards, label = 'cards') {
  const codes = cards.map(cardToCode);
  const seen = new Set();
  for (const code of codes) {
    if (seen.has(code)) {
      throw new Error(`Duplicate ${label}: ${code}`);
    }
    seen.add(code);
  }
  return codes;
}

function fullDeck() {
  const deck = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(rank + suit);
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = randInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function dealNormalHand() {
  const deck = shuffleDeck(fullDeck());
  const a = deck.splice(0, 6);
  const b = deck.splice(0, 6);
  return { a, b, cut: deck[0], deck };
}

function cardRank(card) {
  return card[0];
}

function cardSuit(card) {
  return card[1];
}

function cardValue(card) {
  return CARD_VALUE[card[0]];
}

function scoreFifteens(cards) {
  const values = cards.map(cardValue);
  let total = 0;
  const count = cards.length;
  for (let mask = 1; mask < (1 << count); mask += 1) {
    if ((mask & (mask - 1)) === 0) continue;
    let sum = 0;
    for (let i = 0; i < count; i += 1) {
      if (mask & (1 << i)) sum += values[i];
    }
    if (sum === 15) total += 2;
  }
  return total;
}

function scorePairs(cards) {
  let total = 0;
  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      if (cardRank(cards[i]) === cardRank(cards[j])) total += 2;
    }
  }
  return total;
}

function scoreRuns(cards) {
  const counts = Array(14).fill(0);
  for (const card of cards) counts[RANK_VALUE[cardRank(card)]] += 1;
  for (let length = cards.length; length >= 3; length -= 1) {
    let total = 0;
    for (let start = 1; start <= 13 - length + 1; start += 1) {
      let product = 1;
      let ok = true;
      for (let rank = start; rank < start + length; rank += 1) {
        if (!counts[rank]) {
          ok = false;
          break;
        }
        product *= counts[rank];
      }
      if (ok) total += length * product;
    }
    if (total) return total;
  }
  return 0;
}

function scoreFlush(hand, cut, isCrib) {
  const suits = hand.map(cardSuit);
  if (!suits.every((suit) => suit === suits[0])) return 0;
  if (isCrib) {
    return cardSuit(cut) === suits[0] ? 5 : 0;
  }
  return cardSuit(cut) === suits[0] ? 5 : 4;
}

function scoreNobs(hand, cut) {
  return hand.some((card) => cardRank(card) === 'J' && cardSuit(card) === cardSuit(cut)) ? 1 : 0;
}

function scoreHand(hand, cut, isCrib = false) {
  const validatedHand = hand.map(parseCard).map((card) => card.code);
  const validatedCut = parseCard(cut).code;
  const all = [...validatedHand, validatedCut];
  ensureUniqueCards(all, 'hand and cut');
  const fifteens = scoreFifteens(all);
  const pairs = scorePairs(all);
  const runs = scoreRuns(all);
  const flush = scoreFlush(validatedHand, validatedCut, isCrib);
  const nobs = scoreNobs(validatedHand, validatedCut);
  const total = fifteens + pairs + runs + flush + nobs;
  return {
    total,
    breakdown: { fifteens, pairs, runs, flush, nobs },
  };
}

function scorePeggingPile(pile, nextCard) {
  const existing = pile.map(parseCard).map((card) => card.code);
  const card = parseCard(nextCard).code;
  ensureUniqueCards([...existing, card], 'pegging cards');
  const countBefore = existing.reduce((sum, code) => sum + cardValue(code), 0);
  const countAfter = countBefore + cardValue(card);
  if (countAfter > 31) {
    throw new Error('Pegging card exceeds 31');
  }
  const cards = [...existing, card];
  const breakdown = { fifteen: 0, thirtyOne: 0, pairs: 0, runs: 0 };
  const reasons = [];
  let points = 0;

  if (countAfter === 15) {
    breakdown.fifteen = 2;
    points += 2;
    reasons.push('fifteen');
  }
  if (countAfter === 31) {
    breakdown.thirtyOne = 2;
    points += 2;
    reasons.push('thirty-one');
  }

  let streak = 1;
  for (let i = cards.length - 2; i >= 0; i -= 1) {
    if (cardRank(cards[i]) === cardRank(card)) streak += 1;
    else break;
  }
  if (streak > 1) {
    const pairPoints = streak === 2 ? 2 : streak === 3 ? 6 : 12;
    breakdown.pairs = pairPoints;
    points += pairPoints;
    reasons.push(streak === 2 ? 'pair' : streak === 3 ? 'pair royal' : 'double pair royal');
  }

  const runs = scoreRuns(cards);
  if (runs) {
    breakdown.runs = runs;
    points += runs;
    reasons.push(`run of ${Math.max(...findRunLengths(cards))}`);
  }

  return {
    countBefore,
    countAfter,
    points,
    reasons,
    breakdown,
  };
}

function findRunLengths(cards) {
  const counts = Array(14).fill(0);
  for (const card of cards) counts[RANK_VALUE[cardRank(card)]] += 1;
  const lengths = [];
  for (let length = cards.length; length >= 3; length -= 1) {
    let total = 0;
    for (let start = 1; start <= 13 - length + 1; start += 1) {
      let product = 1;
      let ok = true;
      for (let rank = start; rank < start + length; rank += 1) {
        if (!counts[rank]) {
          ok = false;
          break;
        }
        product *= counts[rank];
      }
      if (ok) total += length * product;
    }
    if (total) lengths.push(length);
  }
  return lengths;
}

function createPlayer(member) {
  return {
    memberNo: member.no,
    name: member.name,
    score: 0,
    played: member.played,
    won: member.won,
    pegs: [0, 0],
    hand: [],
    discards: [],
    playedCards: [],
    passed: false,
  };
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function createInitialState({ kind, practiceKey, members, dealer, scores, seriesRoundIndex = 0 }) {
  const state = {
    kind,
    practiceKey,
    seriesRoundIndex,
    handNumber: 1,
    revision: 0,
    status: 'open',
    phase: 'discard',
    dealer,
    turn: null,
    count: 0,
    cut: null,
    winner: null,
    lastPlayer: null,
    cardsPlayed: [],
    pile: [],
    crib: { A: [], B: [] },
    showBreakdown: [],
    events: [],
    players: {
      A: createPlayer(members.A),
      B: createPlayer(members.B),
    },
    pendingSeat: null,
    dealt: null,
    deck: [],
  };
  state.players.A.score = scores.A;
  state.players.B.score = scores.B;
  state.players.A.pegs = [scores.A, scores.A];
  state.players.B.pegs = [scores.B, scores.B];
  return state;
}

function seatLabel(seat) {
  return seat === 'A' ? 'Seat A' : 'Seat B';
}

function opponentSeat(seat) {
  return seat === 'A' ? 'B' : 'A';
}

function currentDealerInfo(state) {
  return state.dealer === 'A' ? state.players.A : state.players.B;
}

function memberLookup() {
  const members = new Map();
  for (const member of seedData.members) members.set(member.no, member);
  return members;
}

function selectPracticeDeal(state) {
  if (state.practiceKey === 'club_series') {
    const roundNames = practiceData.club_series.rounds;
    const roundName = roundNames[state.seriesRoundIndex % roundNames.length];
    const round = practiceData[roundName];
    if (!round) throw new Error(`Missing club series round: ${roundName}`);
    return { roundName, deal: round };
  }
  if (state.practiceKey) {
    const deal = practiceData[state.practiceKey];
    if (!deal) throw new Error(`Missing practice deal: ${state.practiceKey}`);
    return { roundName: state.practiceKey, deal };
  }
  return null;
}

function dealCardsIntoState(state) {
  const practice = selectPracticeDeal(state);
  if (practice) {
    const dealerSeat = state.dealer;
    const otherSeat = opponentSeat(dealerSeat);
    const dealerCards = practice.deal.a.slice(0, 6);
    const otherCards = practice.deal.b.slice(0, 6);
    state.players[dealerSeat].hand = clone(dealerCards);
    state.players[otherSeat].hand = clone(otherCards);
    state.dealt = {
      source: practice.roundName,
      cut: practice.deal.cut,
      dealerCards,
      otherCards,
    };
    state.deck = [];
    state.cut = null;
    state.turn = null;
    state.phase = 'discard';
    state.count = 0;
    state.pile = [];
    state.lastPlayer = null;
    state.players.A.discards = [];
    state.players.B.discards = [];
    state.players.A.playedCards = [];
    state.players.B.playedCards = [];
    state.players.A.passed = false;
    state.players.B.passed = false;
    state.crib = { A: [], B: [] };
    state.events.push({ at: nowIso(), type: 'deal', text: `${practice.roundName} deal: ${seatLabel(state.dealer)} is dealer.` });
    return state;
  }

  const normal = dealNormalHand();
  state.players.A.hand = clone(normal.a);
  state.players.B.hand = clone(normal.b);
  state.dealt = { source: 'normal', cut: null, dealerCards: normal.a, otherCards: normal.b };
  state.deck = normal.deck.slice();
  state.cut = null;
  state.turn = null;
  state.phase = 'discard';
  state.count = 0;
  state.pile = [];
  state.lastPlayer = null;
  state.players.A.discards = [];
  state.players.B.discards = [];
  state.players.A.playedCards = [];
  state.players.B.playedCards = [];
  state.players.A.passed = false;
  state.players.B.passed = false;
  state.crib = { A: [], B: [] };
  state.events.push({ at: nowIso(), type: 'deal', text: `Fresh deal: ${seatLabel(state.dealer)} is dealer.` });
  return state;
}

function canPlayCard(state, seat, card) {
  if (state.phase !== 'play') return false;
  if (state.turn !== seat) return false;
  if (state.players[seat].passed) return false;
  if (!state.players[seat].hand.includes(card)) return false;
  return state.count + cardValue(card) <= 31;
}

function legalPlayCards(state, seat) {
  if (state.phase !== 'play' || state.players[seat].passed) return [];
  return state.players[seat].hand.filter((card) => state.count + cardValue(card) <= 31);
}

function awardPoints(state, seat, points, reason) {
  if (!points) return;
  const player = state.players[seat];
  const nextScore = Math.min(TARGET_SCORE, player.score + points);
  player.pegs = [player.pegs[1], nextScore];
  player.score = nextScore;
  state.events.push({ at: nowIso(), type: 'score', text: `${player.name} scores ${points} for ${reason}.` });
}

function maybeFinish(state, winnerSeat, reason) {
  if (state.players[winnerSeat].score >= TARGET_SCORE) {
    state.players[winnerSeat].score = TARGET_SCORE;
    state.players[winnerSeat].pegs[1] = TARGET_SCORE;
    state.status = 'finished';
    state.phase = 'finished';
    state.winner = winnerSeat;
    state.events.push({ at: nowIso(), type: 'finish', text: `${state.players[winnerSeat].name} wins at ${TARGET_SCORE} (${reason}).` });
    return true;
  }
  return false;
}

function showHands(state) {
  const nonDealer = opponentSeat(state.dealer);
  const dealer = state.dealer;
  const cribCards = [...state.crib.A, ...state.crib.B];
  const entries = [];
  let finished = false;

  const order = [nonDealer, dealer, 'crib'];
  for (const entry of order) {
    if (entry === 'crib') {
      const score = scoreHand(cribCards.slice(), state.cut, true);
      entries.push({ seat: 'crib', name: 'Crib', hand: clone(cribCards), score });
      if (state.players[dealer].score + score.total >= TARGET_SCORE) {
        awardPoints(state, dealer, score.total, 'crib');
        maybeFinish(state, dealer, 'crib');
        finished = true;
        break;
      }
      awardPoints(state, dealer, score.total, 'crib');
      if (maybeFinish(state, dealer, 'crib')) {
        finished = true;
        break;
      }
      continue;
    }

    const hand = state.players[entry].hand.slice();
    const score = scoreHand(hand.slice(), state.cut, false);
    entries.push({ seat: entry, name: state.players[entry].name, hand: clone(hand), discards: clone(state.players[entry].discards), score });
    awardPoints(state, entry, score.total, entry === nonDealer ? 'non-dealer hand' : 'dealer hand');
    if (maybeFinish(state, entry, entry === nonDealer ? 'non-dealer hand' : 'dealer hand')) {
      finished = true;
      break;
    }
  }

  state.showBreakdown = entries;
  state.phase = finished ? 'finished' : 'show';
  return state;
}

function resetForShowOrFinish(state) {
  state.turn = null;
  state.count = 0;
  state.pile = [];
  state.players.A.passed = false;
  state.players.B.passed = false;
}

function maybeResolvePeggingEnd(state) {
  const aEmpty = state.players.A.hand.length === 0;
  const bEmpty = state.players.B.hand.length === 0;
  if (!aEmpty || !bEmpty) return false;
  if (state.phase !== 'play') return false;
  const last = state.lastPlayer;
  if (last && state.count > 0 && state.count !== 31) {
    awardPoints(state, last, 1, 'last card');
    if (maybeFinish(state, last, 'last card')) {
      resetForShowOrFinish(state);
      return true;
    }
  }
  resetForShowOrFinish(state);
  state.phase = 'show';
  showHands(state);
  return true;
}

function maybeSetNextTurnAfterPlay(state, seat) {
  const other = opponentSeat(seat);
  const seatHasCards = state.players[seat].hand.length > 0;
  const otherHasCards = state.players[other].hand.length > 0;

  if (state.count === 31) {
    state.count = 0;
    state.pile = [];
    state.players.A.passed = false;
    state.players.B.passed = false;
    if (otherHasCards) {
      state.turn = other;
    } else if (seatHasCards) {
      state.turn = seat;
    } else {
      state.turn = null;
    }
    return;
  }

  if (otherHasCards && !state.players[other].passed) {
    state.turn = other;
  } else if (seatHasCards) {
    state.turn = seat;
  } else if (otherHasCards) {
    state.turn = other;
  } else {
    state.turn = null;
  }
}

function completeDiscardsIfReady(state) {
  const aDone = state.players.A.discards.length === 2;
  const bDone = state.players.B.discards.length === 2;
  if (!aDone || !bDone) return false;
  if (state.practiceKey) {
    state.cut = selectPracticeDeal(state).deal.cut;
  } else if (state.deck && state.deck.length) {
    state.cut = state.deck.shift();
  } else {
    state.cut = drawCutCard(state);
  }
  if (state.dealt) state.dealt.cut = state.cut;
  const dealer = state.dealer;
  const nonDealer = opponentSeat(dealer);
  state.events.push({ at: nowIso(), type: 'cut', text: `Cut is ${state.cut}.` });
  if (cardRank(state.cut) === 'J') {
    awardPoints(state, dealer, 2, 'his heels');
    if (maybeFinish(state, dealer, 'his heels')) {
      resetForShowOrFinish(state);
      return true;
    }
  }
  state.phase = 'play';
  state.turn = nonDealer;
  state.pile = [];
  state.count = 0;
  return true;
}

function drawCutCard(state) {
  if (!state.deck || !state.deck.length) {
    const deck = fullDeck().filter((card) => !state.players.A.hand.includes(card) && !state.players.B.hand.includes(card) && !state.crib.A.includes(card) && !state.crib.B.includes(card));
    return deck[0];
  }
  return state.deck[0];
}

function safeCards(cards) {
  return cards.map((card) => parseCard(card).code);
}

function removeFromArray(arr, cards) {
  const next = arr.slice();
  for (const card of cards) {
    const index = next.indexOf(card);
    if (index < 0) throw new Error(`Card not in hand: ${card}`);
    next.splice(index, 1);
  }
  return next;
}

function legalDiscardCards(state, seat) {
  if (state.phase !== 'discard') return [];
  return state.players[seat].hand.slice();
}

function serializeSummary(game) {
  const state = game.state;
  return {
    id: game.id,
    revision: game.revision,
    status: game.status,
    kind: state.kind,
    practiceKey: state.practiceKey,
    handNumber: state.handNumber,
    dealer: state.dealer,
    turn: state.turn,
    cut: state.cut,
    count: state.count,
    scores: { A: state.players.A.score, B: state.players.B.score },
    names: { A: state.players.A.name, B: state.players.B.name },
    winner: state.winner,
    phase: state.phase,
    updatedAt: game.updated_at,
  };
}

function serializeHistoryRow(row) {
  return {
    id: row.id,
    type: row.type,
    createdAt: row.created_at,
    summary: JSON.parse(row.summary_json),
  };
}

function visiblePlayer(state, seat, viewer) {
  const player = state.players[seat];
  const reveal = state.phase === 'show' || state.phase === 'finished' || viewer === seat;
  return {
    seat,
    memberNo: player.memberNo,
    name: player.name,
    score: player.score,
    played: player.played,
    won: player.won,
    pegs: player.pegs.slice(),
    handCount: player.hand.length,
    hand: reveal ? player.hand.slice() : [],
    discards: reveal ? player.discards.slice() : [],
    playedCards: player.playedCards.slice(),
    passed: player.passed,
    reveal,
  };
}

function visibleGame(game, viewer = 'A') {
  const state = game.state;
  const reveal = state.phase === 'show' || state.phase === 'finished';
  const nonDealer = opponentSeat(state.dealer);
  const legalCards = state.phase === 'play' && state.turn === viewer ? legalPlayCards(state, viewer) : [];
  const canGo = state.phase === 'play' && state.turn === viewer && legalCards.length === 0 && state.players[viewer].hand.length > 0;
  return {
    id: game.id,
    revision: game.revision,
    status: game.status,
    kind: state.kind,
    practiceKey: state.practiceKey,
    handNumber: state.handNumber,
    dealer: state.dealer,
    dealerName: state.players[state.dealer].name,
    nonDealer,
    nonDealerName: state.players[nonDealer].name,
    turn: state.turn,
    turnName: state.turn ? state.players[state.turn].name : 'none',
    count: state.count,
    cut: reveal ? state.cut : null,
    phase: state.phase,
    winner: state.winner,
    target: TARGET_SCORE,
    viewer,
    players: {
      A: visiblePlayer(state, 'A', viewer),
      B: visiblePlayer(state, 'B', viewer),
    },
    crib: {
      reveal,
      cards: reveal ? [...state.crib.A, ...state.crib.B] : [],
      A: reveal || viewer === 'A' ? state.crib.A.slice() : [],
      B: reveal || viewer === 'B' ? state.crib.B.slice() : [],
      knownByViewer: viewer === 'A' ? state.crib.A.slice() : state.crib.B.slice(),
    },
    pile: state.pile.slice(),
    playedCards: state.cardsPlayed.slice(),
    showBreakdown: state.showBreakdown,
    events: state.events.slice(-24),
    legalCards,
    canGo,
    canNextHand: state.phase === 'show' && state.status !== 'finished',
    seatAOwnCards: viewer === 'A' ? state.players.A.hand.slice() : [],
    seatBOwnCards: viewer === 'B' ? state.players.B.hand.slice() : [],
  };
}

function loadGamesTable() {
  return db.prepare('SELECT id, revision, status, state_json, created_at, updated_at FROM games ORDER BY created_at DESC').all();
}

function getGameRow(id) {
  const row = db.prepare('SELECT id, revision, status, state_json, created_at, updated_at FROM games WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id,
    revision: row.revision,
    status: row.status,
    state: JSON.parse(row.state_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function saveGame(game) {
  db.prepare('UPDATE games SET revision = ?, status = ?, state_json = ?, updated_at = ? WHERE id = ?').run(
    game.revision,
    game.status,
    JSON.stringify(game.state),
    nowIso(),
    game.id,
  );
}

function insertReceipt(actionId, fingerprint, response) {
  db.prepare('INSERT INTO receipts (action_id, fingerprint, response_json, created_at) VALUES (?, ?, ?, ?)').run(
    actionId,
    fingerprint,
    JSON.stringify(response),
    nowIso(),
  );
}

function getReceipt(actionId) {
  const row = db.prepare('SELECT action_id, fingerprint, response_json FROM receipts WHERE action_id = ?').get(actionId);
  if (!row) return null;
  return row;
}

function withActionReceipt(actionId, fingerprint, work) {
  const existing = getReceipt(actionId);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      return { ok: false, status: 409, error: 'That action identifier was already used for different input.' };
    }
    return JSON.parse(existing.response_json);
  }

  const run = db.transaction(() => {
    const again = getReceipt(actionId);
    if (again) {
      if (again.fingerprint !== fingerprint) {
        return { ok: false, status: 409, error: 'That action identifier was already used for different input.' };
      }
      return JSON.parse(again.response_json);
    }
    const response = work();
    insertReceipt(actionId, fingerprint, response);
    return response;
  });

  return run();
}

function prepareStateForAction(game) {
  return game;
}

function assertGameOpen(game) {
  if (!game) throw new Error('Game not found');
}

function maybeRecordFinish(game) {
  if (game.status !== 'finished') return false;
  const existing = db.prepare('SELECT id FROM history WHERE id = ?').get(game.id);
  if (existing) return false;
  const summary = {
    id: game.id,
    kind: game.state.kind,
    practiceKey: game.state.practiceKey,
    handNumber: game.state.handNumber,
    dealer: game.state.dealer,
    dealerName: game.state.players[game.state.dealer].name,
    pone: opponentSeat(game.state.dealer),
    poneName: game.state.players[opponentSeat(game.state.dealer)].name,
    dealer_score: game.state.players[game.state.dealer].score,
    pone_score: game.state.players[opponentSeat(game.state.dealer)].score,
    finished: true,
    winner: game.state.winner,
    finalScores: { A: game.state.players.A.score, B: game.state.players.B.score },
  };
  db.prepare('INSERT INTO history (id, type, created_at, summary_json) VALUES (?, ?, ?, ?)').run(
    game.id,
    'game',
    nowIso(),
    JSON.stringify(summary),
  );
  const state = game.state;
  const winner = state.winner;
  if (winner) {
    db.prepare('UPDATE members SET played = played + 1 WHERE no IN (?, ?)').run(state.players.A.memberNo, state.players.B.memberNo);
    db.prepare('UPDATE members SET won = won + 1 WHERE no = ?').run(state.players[winner].memberNo);
  }
  return true;
}

function updateLadderForFinish(game) {
  const state = game.state;
  const winner = state.winner;
  if (!winner) return;
  const playedUpdate = db.prepare('UPDATE members SET played = played + 1 WHERE no IN (?, ?)');
  const wonUpdate = db.prepare('UPDATE members SET won = won + 1 WHERE no = ?');
  playedUpdate.run(state.players.A.memberNo, state.players.B.memberNo);
  wonUpdate.run(state.players[winner].memberNo);
}

function concludeIfNeeded(game, reason) {
  const state = game.state;
  const winnerSeat = state.winner;
  if (!winnerSeat) return;
  state.status = 'finished';
  state.phase = 'finished';
  state.events.push({ at: nowIso(), type: 'finish', text: `${state.players[winnerSeat].name} wins at ${TARGET_SCORE} (${reason}).` });
  game.status = 'finished';
  maybeRecordFinish(game);
  updateLadderForFinish(game);
}

function validateSeat(seat) {
  if (seat !== 'A' && seat !== 'B') throw new Error('Seat must be A or B');
}

function startGameFromBody(body) {
  const actionId = body.actionId;
  if (!actionId) throw new Error('Missing actionId');
  const fingerprint = hashPayload({
    route: 'create-game',
    mode: body.mode || 'normal',
    practiceKey: body.practiceKey || null,
    dealer: body.dealer || 'A',
    members: body.members,
    scores: body.scores,
  });
  return withActionReceipt(actionId, fingerprint, () => {
    const mode = body.mode === 'practice' ? 'practice' : 'normal';
    const practiceKey = body.practiceKey || null;
    const members = body.members || { A: seedData.members[0].no, B: seedData.members[1].no };
    const scores = body.scores || { A: 0, B: 0 };
    const dealer = body.dealer === 'B' ? 'B' : 'A';
    validateSeat(dealer);
    if (!members.A || !members.B || members.A === members.B) {
      return { ok: false, status: 400, error: 'Choose two distinct members.' };
    }
    const lookup = memberLookup();
    const memberA = lookup.get(members.A);
    const memberB = lookup.get(members.B);
    if (!memberA || !memberB) {
      return { ok: false, status: 400, error: 'Unknown member selection.' };
    }
    if (!Number.isInteger(scores.A) || !Number.isInteger(scores.B) || scores.A < 0 || scores.A > 120 || scores.B < 0 || scores.B > 120) {
      return { ok: false, status: 400, error: 'Starting scores must be whole numbers from 0 to 120.' };
    }
    if (mode === 'practice' && practiceKey && !practiceData[practiceKey]) {
      return { ok: false, status: 400, error: 'Unknown practice deal.' };
    }
    const gameId = makeId('G');
    const state = createInitialState({
      kind: mode,
      practiceKey,
      members: { A: memberA, B: memberB },
      dealer,
      scores,
      seriesRoundIndex: practiceKey === 'club_series' ? 0 : 0,
    });
    dealCardsIntoState(state);
    const game = {
      id: gameId,
      revision: 0,
      status: 'open',
      state,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.prepare('INSERT INTO games (id, revision, status, state_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      game.id,
      game.revision,
      game.status,
      JSON.stringify(game.state),
      game.created_at,
      game.updated_at,
    );
    const response = { ok: true, actionId, game: visibleGame(game, 'A') };
    return response;
  });
}

function loadGameAction(body, gameId) {
  const actionId = body.actionId;
  const expectedRevision = body.expectedRevision;
  if (!actionId) throw new Error('Missing actionId');
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error('Missing expected revision');
  const fingerprint = hashPayload({
    route: 'game-action',
    gameId,
    type: body.type,
    seat: body.seat,
    cards: body.cards || null,
    expectedRevision,
  });

  return withActionReceipt(actionId, fingerprint, () => {
    const game = getGameRow(gameId);
    if (!game) {
      return { ok: false, status: 404, error: 'Game not found.' };
    }
    if (game.revision !== expectedRevision) {
      return {
        ok: false,
        status: 409,
        error: `Stale revision: expected ${expectedRevision}, current is ${game.revision}.`,
        currentRevision: game.revision,
        game: visibleGame(game, body.seat === 'B' ? 'B' : 'A'),
      };
    }
    if (game.status === 'finished') {
      return { ok: false, status: 409, error: 'That game has already finished.', game: visibleGame(game, body.seat === 'B' ? 'B' : 'A') };
    }

    const state = game.state;
    const seat = body.seat === 'B' ? 'B' : 'A';
    validateSeat(seat);
    const type = body.type;

    const run = db.transaction(() => {
      const latest = getGameRow(gameId);
      if (!latest) return { ok: false, status: 404, error: 'Game not found.' };
      if (latest.revision !== expectedRevision) {
        return {
          ok: false,
          status: 409,
          error: `Stale revision: expected ${expectedRevision}, current is ${latest.revision}.`,
          currentRevision: latest.revision,
          game: visibleGame(latest, seat),
        };
      }
      const working = latest;
      const st = working.state;
      let message = '';

      if (type === 'discard') {
        if (st.phase !== 'discard') {
          return { ok: false, status: 409, error: 'You can only discard before the cut.' };
        }
        const cards = Array.isArray(body.cards) ? body.cards.map((card) => parseCard(card).code) : [];
        if (cards.length !== 2) {
          return { ok: false, status: 400, error: 'Discard exactly two cards.' };
        }
        ensureUniqueCards(cards, 'discard cards');
        for (const card of cards) {
          if (!st.players[seat].hand.includes(card)) {
            return { ok: false, status: 400, error: `Card is not in ${seatLabel(seat)} hand: ${card}` };
          }
        }
        st.players[seat].hand = removeFromArray(st.players[seat].hand, cards);
        st.players[seat].discards = cards.slice();
        st.crib[seat] = cards.slice();
        st.events.push({ at: nowIso(), type: 'discard', text: `${st.players[seat].name} discards ${cards.join(' ')}.` });
        message = `${st.players[seat].name} discarded ${cards.join(' ')}.`;
        working.revision += 1;
        working.status = st.status;
        st.revision = working.revision;
        if (st.players.A.discards.length === 2 && st.players.B.discards.length === 2) {
          st.events.push({ at: nowIso(), type: 'cut', text: 'Both players have discarded.' });
          completeDiscardsIfReady(st);
          if (st.phase === 'play') {
            st.events.push({ at: nowIso(), type: 'play', text: `${st.players[st.turn].name} leads the count.` });
          }
          if (st.phase === 'finished') {
            working.status = 'finished';
            game.status = 'finished';
          }
        }
      } else if (type === 'play') {
        if (st.phase !== 'play') {
          return { ok: false, status: 409, error: 'You can only play after the cut.' };
        }
        if (st.turn !== seat) {
          return { ok: false, status: 409, error: `It is ${st.players[st.turn].name}'s turn.` };
        }
        const card = parseCard(body.card).code;
        if (!st.players[seat].hand.includes(card)) {
          return { ok: false, status: 400, error: `Card is not in hand: ${card}` };
        }
        if (st.players[seat].passed) {
          return { ok: false, status: 409, error: 'You already said go in this count.' };
        }
        if (st.count + cardValue(card) > 31) {
          return { ok: false, status: 400, error: 'That card would exceed thirty-one.' };
        }
        const scoreInfo = scorePeggingPile(st.pile, card);
        st.players[seat].hand = removeFromArray(st.players[seat].hand, [card]);
        st.pile.push(card);
        st.cardsPlayed.push(card);
        st.players[seat].playedCards.push(card);
        st.lastPlayer = seat;
        st.count = scoreInfo.countAfter;
        if (scoreInfo.points) {
          awardPoints(st, seat, scoreInfo.points, scoreInfo.reasons.join(' and '));
          if (maybeFinish(st, seat, scoreInfo.reasons.join(' and '))) {
            working.revision += 1;
            working.status = 'finished';
            st.revision = working.revision;
            saveGame(working);
            maybeRecordFinish(working);
            return { ok: true, actionId: body.actionId, game: visibleGame(working, seat), note: message };
          }
        }
        message = `${st.players[seat].name} plays ${card}${scoreInfo.points ? ` for ${scoreInfo.points}` : ''}.`;
        if (st.count === 31) {
          st.events.push({ at: nowIso(), type: 'count', text: 'Count resets at thirty-one.' });
          st.players.A.passed = false;
          st.players.B.passed = false;
          st.count = 0;
          st.pile = [];
        }
        working.revision += 1;
        st.revision = working.revision;
        maybeSetNextTurnAfterPlay(st, seat);
        if (maybeResolvePeggingEnd(st)) {
          if (st.phase === 'finished') {
            working.status = 'finished';
          }
        }
      } else if (type === 'go') {
        if (st.phase !== 'play') {
          return { ok: false, status: 409, error: 'You can only say go during pegging.' };
        }
        if (st.turn !== seat) {
          return { ok: false, status: 409, error: `It is ${st.players[st.turn].name}'s turn.` };
        }
        if (legalPlayCards(st, seat).length > 0) {
          return { ok: false, status: 409, error: 'A legal card is still available.' };
        }
        st.players[seat].passed = true;
        st.events.push({ at: nowIso(), type: 'go', text: `${st.players[seat].name} says go.` });
        const other = opponentSeat(seat);
        if (legalPlayCards(st, other).length > 0) {
          st.turn = other;
        } else {
          if (st.lastPlayer && st.count > 0 && st.count !== 31) {
            awardPoints(st, st.lastPlayer, 1, 'go');
            if (maybeFinish(st, st.lastPlayer, 'go')) {
              working.revision += 1;
              working.status = 'finished';
              st.revision = working.revision;
              saveGame(working);
              maybeRecordFinish(working);
              return { ok: true, actionId: body.actionId, game: visibleGame(working, seat) };
            }
          }
          st.count = 0;
          st.pile = [];
          st.players.A.passed = false;
          st.players.B.passed = false;
          if (st.players[seat].hand.length > 0) {
            st.turn = seat;
          } else if (st.players[other].hand.length > 0) {
            st.turn = other;
          } else {
            st.turn = null;
          }
          if (maybeResolvePeggingEnd(st)) {
            if (st.phase === 'finished') working.status = 'finished';
          }
        }
        working.revision += 1;
        st.revision = working.revision;
      } else if (type === 'next-hand') {
        if (st.phase !== 'show') {
          return { ok: false, status: 409, error: 'Next hand is only available after the show.' };
        }
        if (st.status === 'finished') {
          return { ok: false, status: 409, error: 'The game has already finished.' };
        }
        st.handNumber += 1;
        st.dealer = opponentSeat(st.dealer);
        st.turn = null;
        st.cut = null;
        st.count = 0;
        st.pile = [];
        st.crib = { A: [], B: [] };
        st.showBreakdown = [];
        st.players.A.discards = [];
        st.players.B.discards = [];
        st.players.A.playedCards = [];
        st.players.B.playedCards = [];
        st.players.A.passed = false;
        st.players.B.passed = false;
        st.phase = 'discard';
        st.winner = null;
        if (st.practiceKey === 'club_series') {
          st.seriesRoundIndex = (st.seriesRoundIndex + 1) % practiceData.club_series.rounds.length;
        }
        dealCardsIntoState(st);
        st.events.push({ at: nowIso(), type: 'next-hand', text: `Hand ${st.handNumber} begins with ${seatLabel(st.dealer)} as dealer.` });
        working.revision += 1;
        st.revision = working.revision;
      } else {
        return { ok: false, status: 400, error: `Unknown action type: ${type}` };
      }

      if (st.phase === 'discard' && st.players.A.discards.length === 2 && st.players.B.discards.length === 2) {
        completeDiscardsIfReady(st);
      }
      if (st.phase === 'finished') {
        working.status = 'finished';
        maybeRecordFinish(working);
      }
      working.state = st;
      working.updated_at = nowIso();
      if (st.phase === 'finished') working.status = 'finished';
      saveGame(working);
      if (st.phase === 'finished') {
        maybeRecordFinish(working);
      }
      const response = {
        ok: true,
        actionId: body.actionId,
        game: visibleGame(working, seat),
        note: message,
      };
      return response;
    });

    return run();
  });
}

function validateBootstrap() {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM members').get();
  if (existing.count) return;
  const insertMember = db.prepare('INSERT INTO members (no, name, played, won) VALUES (?, ?, ?, ?)');
  for (const member of seedData.members) {
    insertMember.run(member.no, member.name, member.played, member.won);
  }
  const insertHistory = db.prepare('INSERT INTO history (id, type, created_at, summary_json) VALUES (?, ?, ?, ?)');
  for (const game of seedData.games) {
    insertHistory.run(game.id, 'seed', nowIso(), JSON.stringify(game));
  }
}

function initDatabase() {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      no TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      played INTEGER NOT NULL,
      won INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL,
      status TEXT NOT NULL,
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS receipts (
      action_id TEXT PRIMARY KEY,
      fingerprint TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      summary_json TEXT NOT NULL
    );
  `);
  validateBootstrap();
}

function listOpenGames() {
  return db.prepare('SELECT id, revision, status, state_json, created_at, updated_at FROM games WHERE status = ? ORDER BY updated_at DESC').all('open').map((row) => serializeSummary({
    id: row.id,
    revision: row.revision,
    status: row.status,
    state: JSON.parse(row.state_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

function listAllGames() {
  return db.prepare('SELECT id, revision, status, state_json, created_at, updated_at FROM games ORDER BY updated_at DESC').all().map((row) => serializeSummary({
    id: row.id,
    revision: row.revision,
    status: row.status,
    state: JSON.parse(row.state_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

function listHistory(limit = 50) {
  return db.prepare('SELECT id, type, created_at, summary_json FROM history ORDER BY created_at DESC LIMIT ?').all(limit).map(serializeHistoryRow);
}

function loadMembers() {
  return db.prepare('SELECT no, name, played, won FROM members ORDER BY no').all();
}

function loadGame(id) {
  const row = getGameRow(id);
  if (!row) return null;
  return row;
}

app.get('/api/health', (req, res) => {
  sendJson(res, 200, { ok: true });
});

app.get('/api/bootstrap', (req, res) => {
  sendJson(res, 200, {
    ok: true,
    target: TARGET_SCORE,
    members: loadMembers(),
    scoredHands,
    practices: practiceData,
    openGames: listOpenGames(),
    games: listAllGames(),
    history: listHistory(),
    dbPath: DB_PATH,
  });
});

app.get('/api/games', (req, res) => {
  sendJson(res, 200, { ok: true, games: listAllGames(), openGames: listOpenGames() });
});

app.get('/api/games/:id', (req, res) => {
  const game = loadGame(req.params.id);
  if (!game) return sendJson(res, 404, { ok: false, error: 'Game not found' });
  const viewer = req.query.viewer === 'B' ? 'B' : 'A';
  sendJson(res, 200, { ok: true, game: visibleGame(game, viewer) });
});

app.get('/api/history', (req, res) => {
  sendJson(res, 200, { ok: true, history: listHistory() });
});

app.get('/api/history/:id', (req, res) => {
  const row = db.prepare('SELECT id, type, created_at, summary_json FROM history WHERE id = ?').get(req.params.id);
  if (!row) return sendJson(res, 404, { ok: false, error: 'History record not found' });
  sendJson(res, 200, { ok: true, history: serializeHistoryRow(row) });
});

app.post('/api/games', (req, res) => {
  try {
    const response = startGameFromBody(req.body || {});
    sendJson(res, response.status || 200, response);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message });
  }
});

app.post('/api/games/:id/actions', (req, res) => {
  try {
    const response = loadGameAction(req.body || {}, req.params.id);
    sendJson(res, response.status || 200, response);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message });
  }
});

app.post('/api/score/hand', (req, res) => {
  try {
    const body = req.body || {};
    const hand = Array.isArray(body.hand) ? body.hand.map((card) => parseCard(card).code) : [];
    const cut = parseCard(body.cut).code;
    if (hand.length !== 4) throw new Error('Enter exactly four hand cards.');
    ensureUniqueCards([...hand, cut], 'hand cards');
    const result = scoreHand(hand, cut, !!body.crib);
    sendJson(res, 200, { ok: true, hand, cut, crib: !!body.crib, ...result });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message });
  }
});

app.post('/api/score/pegging', (req, res) => {
  try {
    const body = req.body || {};
    const pile = Array.isArray(body.pile) ? body.pile.map((card) => parseCard(card).code) : [];
    const card = parseCard(body.card).code;
    const result = scorePeggingPile(pile, card);
    sendJson(res, 200, { ok: true, pile, card, ...result });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message });
  }
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});


app.get('/', (req, res) => {
  res.sendFile(path.join(APP_ROOT, 'www', 'index.html'));
});

initDatabase();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gambit Hollow listening on http://0.0.0.0:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});

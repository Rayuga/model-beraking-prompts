const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const Database = require('better-sqlite3');

const APP_ROOT = __dirname;
const WWW_ROOT = path.join(APP_ROOT, 'www');
const DATA_ROOT = path.join(APP_ROOT, 'data');
const DB_PATH = process.env.DB_PATH || path.join(APP_ROOT, 'gambit.db');
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const TARGET = 121;

const SCORED_HANDS = require('./data/scored-hands.js').SCORED_HANDS;
const PRACTICE_DEALS = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, 'practice-deals.json'), 'utf8'));
const SEED_DATA = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, 'gambit_seed_data.json'), 'utf8'));
const HOUSE_RULES = fs.readFileSync(path.join(DATA_ROOT, 'house-rules.md'), 'utf8');
const RECOVERY_NOTES = fs.readFileSync(path.join(DATA_ROOT, 'recovery.md'), 'utf8');

const RANKS = 'A23456789TJQK';
const SUITS = 'SHDC';
const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED_SUITS = new Set(['H', 'D']);

function nowIso() {
  return new Date().toISOString();
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function randomId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function otherSeat(seat) {
  return seat === 'A' ? 'B' : 'A';
}

function cardToCode(card) {
  return typeof card === 'string' ? card.toUpperCase() : card.code;
}

function parseCard(code) {
  if (typeof code !== 'string') throw new Error('Card codes must be strings.');
  const clean = code.trim().toUpperCase();
  if (!/^[A2-9TJQK][SHDC]$/.test(clean)) throw new Error(`Invalid card code: ${code}`);
  const rank = clean[0];
  const suit = clean[1];
  const rankIndex = RANKS.indexOf(rank) + 1;
  return {
    code: clean,
    rank,
    suit,
    rankIndex,
    value: rank === 'A' ? 1 : 'TJQK'.includes(rank) ? 10 : Number(rank),
    face: `${rank}${SUIT_SYMBOL[suit]}`,
  };
}

function cardValue(code) {
  const rank = cardToCode(code)[0];
  if (rank === 'A') return 1;
  if ('TJQK'.includes(rank)) return 10;
  return Number(rank);
}

function cardRankIndex(code) {
  return RANKS.indexOf(cardToCode(code)[0]) + 1;
}

function cardSuit(code) {
  return cardToCode(code)[1];
}

function cardRank(code) {
  return cardToCode(code)[0];
}

function cardLabel(code) {
  const parsed = parseCard(code);
  return `${parsed.rank}${SUIT_SYMBOL[parsed.suit]}`;
}

function fullDeck() {
  const deck = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) deck.push(`${rank}${suit}`);
  }
  return deck;
}

function shuffleDeck(deck) {
  const copy = deck.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function uniqueList(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function validateCardsList(cards, expectedLength, label) {
  if (!Array.isArray(cards) || cards.length !== expectedLength) throw new Error(`${label} must contain ${expectedLength} cards.`);
  const parsed = cards.map(parseCard);
  const codes = parsed.map((card) => card.code);
  if (new Set(codes).size !== codes.length) throw new Error(`${label} contains duplicate cards.`);
  return codes;
}

function scoreHand(handCodes, cutCode, isCrib = false) {
  const hand = validateCardsList(handCodes, 4, 'Hand');
  const cut = parseCard(cutCode).code;
  const allCodes = [...hand, cut];
  if (new Set(allCodes).size !== 5) throw new Error('Hand and cut must all be distinct cards.');
  const cards = allCodes.map(parseCard);
  const values = cards.map((card) => card.value);
  const fifteens = [];
  for (let mask = 1; mask < (1 << cards.length); mask++) {
    let sum = 0;
    const combo = [];
    for (let i = 0; i < cards.length; i++) {
      if (mask & (1 << i)) {
        sum += values[i];
        combo.push(cards[i].code);
      }
    }
    if (sum === 15) fifteens.push(combo);
  }
  const fifteensPoints = fifteens.length * 2;

  const rankCounts = new Map();
  for (const card of cards) rankCounts.set(card.rankIndex, (rankCounts.get(card.rankIndex) || 0) + 1);
  const pairs = [];
  for (const [rankIndex, count] of [...rankCounts.entries()].sort((a, b) => a[0] - b[0])) {
    if (count >= 2) pairs.push({ rank: RANKS[rankIndex - 1], count, points: count * (count - 1) });
  }
  const pairPoints = pairs.reduce((sum, entry) => sum + entry.points, 0);

  const uniqueRanks = [...rankCounts.keys()].sort((a, b) => a - b);
  const runs = [];
  let start = 0;
  while (start < uniqueRanks.length) {
    let end = start;
    while (end + 1 < uniqueRanks.length && uniqueRanks[end + 1] === uniqueRanks[end] + 1) end += 1;
    const length = end - start + 1;
    if (length >= 3) {
      const runRanks = uniqueRanks.slice(start, end + 1);
      const multiplicity = runRanks.reduce((product, rankIndex) => product * rankCounts.get(rankIndex), 1);
      runs.push({ ranks: runRanks.map((rankIndex) => RANKS[rankIndex - 1]), length, multiplicity, points: length * multiplicity });
    }
    start = end + 1;
  }
  const maxRunLength = runs.length ? Math.max(...runs.map((run) => run.length)) : 0;
  const runEntries = runs.filter((run) => run.length === maxRunLength);
  const runPoints = runEntries.reduce((sum, run) => sum + run.points, 0);

  let flushPoints = 0;
  let flushSuit = null;
  const handSuits = hand.map(cardSuit);
  if (handSuits.every((suit) => suit === handSuits[0])) {
    flushSuit = handSuits[0];
    const cutSuit = cardSuit(cut);
    if (cutSuit === flushSuit) {
      flushPoints = 5;
    } else if (!isCrib) {
      flushPoints = 4;
    }
  }

  const nobsCard = hand.find((code) => cardRank(code) === 'J' && cardSuit(code) === cardSuit(cut));
  const nobsPoints = nobsCard ? 1 : 0;

  const total = fifteensPoints + pairPoints + runPoints + flushPoints + nobsPoints;
  return {
    total,
    cards: hand,
    cut,
    crib: Boolean(isCrib),
    fifteens: {
      points: fifteensPoints,
      count: fifteens.length,
      combos: fifteens,
    },
    pairs: {
      points: pairPoints,
      groups: pairs,
    },
    runs: {
      points: runPoints,
      groups: runEntries,
    },
    flush: {
      points: flushPoints,
      suit: flushSuit,
    },
    nobs: {
      points: nobsPoints,
      card: nobsCard || null,
    },
  };
}

function scorePegging(pile, currentCount) {
  if (!pile.length) return { total: 0, count: currentCount, reasons: [] };
  const last = pile[pile.length - 1];
  let total = 0;
  const reasons = [];
  if (currentCount === 15) {
    total += 2;
    reasons.push('15 for 2');
  }
  if (currentCount === 31) {
    total += 2;
    reasons.push('31 for 2');
  }
  let same = 1;
  for (let i = pile.length - 2; i >= 0; i--) {
    if (cardRank(pile[i].card) === cardRank(last.card)) same += 1;
    else break;
  }
  if (same === 2) {
    total += 2;
    reasons.push('pair for 2');
  } else if (same === 3) {
    total += 6;
    reasons.push('pair royal for 6');
  } else if (same === 4) {
    total += 12;
    reasons.push('double pair royal for 12');
  }
  const maxLen = Math.min(7, pile.length);
  for (let len = maxLen; len >= 3; len--) {
    const slice = pile.slice(-len).map((entry) => cardRankIndex(entry.card));
    if (new Set(slice).size !== slice.length) continue;
    const sorted = slice.slice().sort((a, b) => a - b);
    let consecutive = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) {
      total += len;
      reasons.push(`run of ${len}`);
      break;
    }
  }
  return { total, count: currentCount, reasons };
}

function canPlayCard(state, seat, code) {
  if (!state.hands[seat].includes(code)) return false;
  return state.pegging.count + cardValue(code) <= 31;
}

function anyLegalPlay(state, seat) {
  return state.hands[seat].some((code) => canPlayCard(state, seat, code));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createPracticePlan(kind) {
  const practice = PRACTICE_DEALS[kind];
  if (!practice) return null;
  if (Array.isArray(practice.rounds) && practice.rounds.length) {
    return {
      key: kind,
      cycle: true,
      sequence: [kind, ...practice.rounds],
      nextIndex: 0,
    };
  }
  return {
    key: kind,
    cycle: false,
    sequence: [kind],
    nextIndex: 0,
  };
}

function getPracticeDeal(plan) {
  if (!plan) return null;
  const key = plan.sequence[plan.nextIndex % plan.sequence.length];
  const deal = PRACTICE_DEALS[key];
  if (!deal) throw new Error(`Unknown practice deal: ${key}`);
  plan.nextIndex += 1;
  return { key, deal: clone(deal) };
}

function makeNormalDeal() {
  const deck = shuffleDeck(fullDeck());
  return {
    key: 'normal',
    deal: {
      name: 'Random deal',
      a: deck.slice(0, 6),
      b: deck.slice(6, 12),
      cut: deck[12],
    },
  };
}

function handKeepCards(dealt, discards) {
  return dealt.filter((code) => !discards.includes(code));
}

function createFreshState({ gameId, kind, memberA, memberB, startScores = { A: 0, B: 0 }, practicePlan = null }) {
  let dealInfo;
  if (kind === 'practice') {
    dealInfo = getPracticeDeal(practicePlan);
  } else {
    dealInfo = makeNormalDeal();
  }
  const deal = dealInfo.deal;
  const dealer = 'A';
  return {
    id: gameId,
    revision: 0,
    kind,
    practiceKey: kind === 'practice' ? dealInfo.key : null,
    practicePlan,
    target: TARGET,
    memberA: memberA.no,
    memberB: memberB.no,
    dealer,
    handNo: 1,
    phase: 'discard',
    turn: null,
    cut: null,
    cribOwner: dealer,
    dealt: {
      A: deal.a.slice(),
      B: deal.b.slice(),
    },
    hands: {
      A: deal.a.slice(),
      B: deal.b.slice(),
    },
    discards: {
      A: [],
      B: [],
    },
    crib: [],
    kept: {
      A: [],
      B: [],
    },
    pegging: {
      count: 0,
      pile: [],
      passed: {
        A: false,
        B: false,
      },
      lastPlayer: null,
    },
    show: {
      step: 0,
      breakdowns: {
        nonDealer: null,
        dealer: null,
        crib: null,
      },
      revealed: [],
    },
    scores: {
      A: Number(startScores.A || 0),
      B: Number(startScores.B || 0),
    },
    pegs: {
      A: { lead: Number(startScores.A || 0), trail: Number(startScores.A || 0) },
      B: { lead: Number(startScores.B || 0), trail: Number(startScores.B || 0) },
    },
    winner: null,
    finished: false,
    message: 'Discard two cards each to start the hand.',
    log: [],
  };
}

function memberMapFromRows(rows) {
  const map = new Map();
  for (const row of rows) map.set(row.no, row);
  return map;
}

function scoreRef(hand, cut, isCrib) {
  const breakdown = scoreHand(hand, cut, isCrib);
  return {
    total: breakdown.total,
    fifteens: breakdown.fifteens.points,
    pairs: breakdown.pairs.points,
    runs: breakdown.runs.points,
    flush: breakdown.flush.points,
    nobs: breakdown.nobs.points,
    breakdown,
  };
}

function handSummaryRow(gameRow, memberMap) {
  const state = JSON.parse(gameRow.state_json);
  const memberA = memberMap.get(state.memberA);
  const memberB = memberMap.get(state.memberB);
  return {
    id: gameRow.id,
    kind: gameRow.kind,
    resumable: Boolean(gameRow.resumable),
    revision: gameRow.revision,
    finished: Boolean(gameRow.finished_at),
    phase: state.phase,
    handNo: state.handNo,
    dealer: state.dealer,
    memberA: memberA ? { no: memberA.no, name: memberA.name } : { no: state.memberA },
    memberB: memberB ? { no: memberB.no, name: memberB.name } : { no: state.memberB },
    scores: state.scores,
    winner: state.winner,
    updatedAt: gameRow.updated_at,
    message: state.message,
  };
}

function visibleGameState(state, seat, memberMap) {
  const other = otherSeat(seat);
  const dealerSeat = state.dealer;
  const nonDealer = otherSeat(dealerSeat);
  const memberA = memberMap.get(state.memberA) || { no: state.memberA, name: state.memberA };
  const memberB = memberMap.get(state.memberB) || { no: state.memberB, name: state.memberB };
  const showVisible = [];
  if (state.show.step >= 1) {
    showVisible.push({ who: nonDealer, label: nonDealer === dealerSeat ? 'Dealer' : 'Non-dealer', cards: state.kept[nonDealer].slice() });
  }
  if (state.show.step >= 2) {
    showVisible.push({ who: dealerSeat, label: 'Dealer', cards: state.kept[dealerSeat].slice() });
  }
  if (state.show.step >= 3) {
    showVisible.push({ who: 'crib', label: 'Crib', cards: state.crib.slice() });
  }

  return {
    id: state.id,
    kind: state.kind,
    practiceKey: state.practiceKey,
    target: state.target,
    revision: state.revision,
    finished: state.finished,
    winner: state.winner,
    phase: state.phase,
    handNo: state.handNo,
    seat,
    dealer: dealerSeat,
    nonDealer,
    turn: state.turn,
    message: state.message,
    log: state.log.slice(-10),
    memberA: { ...memberA, score: state.scores.A },
    memberB: { ...memberB, score: state.scores.B },
    scores: state.scores,
    cut: state.cut,
    cribOwner: state.cribOwner,
    hands: {
      A: seat === 'A' || state.phase === 'show' || state.phase === 'show-complete' || state.phase === 'finished' ? state.hands.A.slice() : state.hands.A.map(() => null),
      B: seat === 'B' || state.phase === 'show' || state.phase === 'show-complete' || state.phase === 'finished' ? state.hands.B.slice() : state.hands.B.map(() => null),
    },
    kept: {
      A: state.kept.A.slice(),
      B: state.kept.B.slice(),
    },
    revealedHands: showVisible,
    pegs: clone(state.pegs),
    discards: {
      A: state.discards.A.slice(),
      B: state.discards.B.slice(),
    },
    dealtCounts: {
      A: state.dealt.A.length,
      B: state.dealt.B.length,
    },
    crib: state.phase === 'show' || state.phase === 'finished' ? state.crib.slice() : seat === dealerSeat ? state.discards[dealerSeat].slice() : [],
    pegging: {
      count: state.pegging.count,
      pile: state.pegging.pile.slice(),
      passed: clone(state.pegging.passed),
      lastPlayer: state.pegging.lastPlayer,
    },
    show: clone(state.show),
    legalActions: buildLegalActions(state, seat),
  };
}

function buildLegalActions(state, seat) {
  if (state.finished) return [];
  if (state.phase === 'discard') {
    const discardCount = state.discards[seat].length;
    if (discardCount < 2) return ['discard'];
    return [];
  }
  if (state.phase === 'pegging') {
    const legal = state.hands[seat].filter((code) => canPlayCard(state, seat, code));
    if (seat === state.turn && legal.length) return ['play'];
    if (seat === state.turn && !legal.length) return ['go'];
    return [];
  }
  if (state.phase === 'show') {
    return ['show', 'next-hand'];
  }
  if (state.phase === 'show-complete') {
    return ['next-hand'];
  }
  return [];
}

function logMessage(state, message) {
  state.message = message;
  state.log.push({ at: nowIso(), message });
  if (state.log.length > 20) state.log.splice(0, state.log.length - 20);
}

function awardPoints(state, seat, points) {
  const before = state.scores[seat];
  const next = Math.min(TARGET, before + points);
  state.pegs[seat] = { lead: next, trail: before };
  state.scores[seat] = next;
  if (state.scores[seat] >= TARGET) {
    state.scores[seat] = TARGET;
    state.pegs[seat] = { lead: TARGET, trail: before };
    state.winner = seat;
    state.finished = true;
    state.phase = 'finished';
    return true;
  }
  return false;
}

function finalizeIfWon(state, seat, reason) {
  if (state.scores[seat] >= TARGET) {
    state.scores[seat] = TARGET;
    state.winner = seat;
    state.finished = true;
    state.phase = 'finished';
    logMessage(state, `${seat === 'A' ? 'Seat A' : 'Seat B'} reaches 121 from ${reason}.`);
    return true;
  }
  return false;
}

function performDiscard(state, seat, cards) {
  if (state.phase !== 'discard') throw new Error('Discards are only allowed before the cut.');
  if (state.discards[seat].length >= 2) throw new Error(`${seat} has already discarded.`);
  const codes = validateCardsList(cards, 2, 'Discard');
  for (const code of codes) {
    if (!state.hands[seat].includes(code)) throw new Error(`Card ${code} is not in seat ${seat}'s hand.`);
  }
  for (const code of codes) {
    const idx = state.hands[seat].indexOf(code);
    state.hands[seat].splice(idx, 1);
    state.discards[seat].push(code);
  }
  logMessage(state, `${seat === 'A' ? 'Seat A' : 'Seat B'} discards ${codes.map(cardLabel).join(' and ')}.`);

  if (state.discards.A.length === 2 && state.discards.B.length === 2) {
    state.crib = [...state.discards.A, ...state.discards.B];
    state.kept = { A: state.hands.A.slice(), B: state.hands.B.slice() };
    state.cut = determineCut(state);
    state.cribOwner = state.dealer;
    const heels = cardRank(state.cut) === 'J' ? 2 : 0;
    if (heels) {
      const winner = state.dealer;
      const finished = awardPoints(state, winner, heels);
      logMessage(state, `${winner === 'A' ? 'Seat A' : 'Seat B'} cuts his heels for 2.`);
      if (finished) return state;
    }
    state.phase = 'pegging';
    state.turn = otherSeat(state.dealer);
    state.pegging = {
      count: 0,
      pile: [],
      passed: { A: false, B: false },
      lastPlayer: null,
    };
    logMessage(state, `${state.turn === 'A' ? 'Seat A' : 'Seat B'} leads pegging.`);
  }
  return state;
}

function determineCut(state) {
  if (state.kind !== 'practice') {
    const deck = shuffleDeck(fullDeck());
    const used = new Set([...state.dealt.A, ...state.dealt.B, ...state.discards.A, ...state.discards.B]);
    const cut = deck.find((code) => !used.has(code));
    if (!cut) throw new Error('Unable to determine a cut card.');
    return cut;
  }
  if (!state.practicePlan) {
    const deal = PRACTICE_DEALS[state.practiceKey];
    if (!deal) throw new Error(`Unknown practice deal: ${state.practiceKey}`);
    return deal.cut;
  }
  const currentKey = state.practicePlan.sequence[Math.max(0, state.practicePlan.nextIndex - 1) % state.practicePlan.sequence.length];
  const deal = PRACTICE_DEALS[currentKey];
  if (!deal) throw new Error(`Unknown practice deal: ${currentKey}`);
  return deal.cut;
}

function resolveGo(state, seat) {
  const other = otherSeat(seat);
  state.pegging.passed[seat] = true;
  const otherHasPlay = anyLegalPlay(state, other);
  if (otherHasPlay) {
    state.turn = other;
    logMessage(state, `${seat === 'A' ? 'Seat A' : 'Seat B'} says go; ${other === 'A' ? 'seat A' : 'seat B'} may still play.`);
    return state;
  }
  const lastPlayer = state.pegging.lastPlayer;
  if (lastPlayer && state.pegging.count < 31) {
    const finished = awardPoints(state, lastPlayer, 1);
    logMessage(state, `${lastPlayer === 'A' ? 'Seat A' : 'Seat B'} scores 1 for go.`);
    if (finished) return state;
  }
  state.pegging.count = 0;
  state.pegging.pile = [];
  state.pegging.passed = { A: false, B: false };
  if (state.hands.A.length === 0 && state.hands.B.length === 0) {
    state.phase = 'show';
    state.turn = null;
    state.show = {
      step: 0,
      breakdowns: { nonDealer: null, dealer: null, crib: null },
      revealed: [],
    };
    logMessage(state, 'Pegging is complete; move to the show.');
    return state;
  }
  state.turn = lastPlayer ? otherSeat(lastPlayer) : other;
  logMessage(state, `${state.turn === 'A' ? 'Seat A' : 'Seat B'} leads the next count.`);
  return state;
}

function performPlay(state, seat, card) {
  if (state.phase !== 'pegging') throw new Error('Playing cards is only allowed during pegging.');
  if (state.turn !== seat) throw new Error(`It is not seat ${seat}'s turn.`);
  const codes = validateCardsList([card], 1, 'Play card');
  const code = codes[0];
  if (!state.hands[seat].includes(code)) throw new Error(`Card ${code} is not in seat ${seat}'s hand.`);
  const value = cardValue(code);
  if (state.pegging.count + value > 31) throw new Error(`Card ${code} would count past 31.`);

  state.hands[seat].splice(state.hands[seat].indexOf(code), 1);
  state.pegging.count += value;
  state.pegging.pile.push({ seat, card: code });
  state.pegging.lastPlayer = seat;
  state.pegging.passed = { A: false, B: false };

  const peggingScore = scorePegging(state.pegging.pile, state.pegging.count);
  if (peggingScore.total > 0) {
    const finished = awardPoints(state, seat, peggingScore.total);
    logMessage(state, `${seat === 'A' ? 'Seat A' : 'Seat B'} scores ${peggingScore.total} for ${peggingScore.reasons.join(', ')}.`);
    if (finished) return state;
  } else {
    logMessage(state, `${seat === 'A' ? 'Seat A' : 'Seat B'} plays ${cardLabel(code)} at ${state.pegging.count}.`);
  }

  if (state.pegging.count === 31) {
    state.pegging.count = 0;
    state.pegging.pile = [];
    if (state.hands.A.length === 0 && state.hands.B.length === 0) {
      state.phase = 'show';
      state.turn = null;
      state.show = {
        step: 0,
        breakdowns: { nonDealer: null, dealer: null, crib: null },
        revealed: []
      };
      logMessage(state, 'Pegging is complete; move to the show.');
    } else {
      state.turn = otherSeat(seat);
      logMessage(state, `${seat === 'A' ? 'Seat A' : 'Seat B'} makes 31; ${state.turn === 'A' ? 'seat A' : 'seat B'} leads next.`);
    }
  } else if (state.hands.A.length === 0 && state.hands.B.length === 0) {
    state.pegging.count = 0;
    state.pegging.pile = [];
    state.phase = 'show';
    state.turn = null;
    state.show = {
      step: 0,
      breakdowns: { nonDealer: null, dealer: null, crib: null },
      revealed: []
    };
    logMessage(state, 'Pegging is complete; move to the show.');
  } else {
    state.turn = otherSeat(seat);
  }
  return state;
}

function performShow(state) {
  if (state.phase !== 'show') throw new Error('The show is only available after pegging is finished.');
  const nonDealer = otherSeat(state.dealer);
  const dealer = state.dealer;
  if (state.show.step === 0) {
    const result = scoreRef(state.kept[nonDealer], state.cut, false);
    state.show.breakdowns.nonDealer = result.breakdown;
    state.show.revealed.push({ who: nonDealer, label: 'Non-dealer', cards: state.hands[nonDealer].slice(), total: result.total });
    if (awardPoints(state, nonDealer, result.total)) {
      logMessage(state, `${nonDealer === 'A' ? 'Seat A' : 'Seat B'} scores ${result.total} in the show.`);
      return state;
    }
    state.show.step = 1;
    logMessage(state, `${nonDealer === 'A' ? 'Seat A' : 'Seat B'} scores ${result.total} in the show.`);
    return state;
  }
  if (state.show.step === 1) {
    const result = scoreRef(state.kept[dealer], state.cut, false);
    state.show.breakdowns.dealer = result.breakdown;
    state.show.revealed.push({ who: dealer, label: 'Dealer', cards: state.hands[dealer].slice(), total: result.total });
    if (awardPoints(state, dealer, result.total)) {
      logMessage(state, `${dealer === 'A' ? 'Seat A' : 'Seat B'} scores ${result.total} in the show.`);
      return state;
    }
    state.show.step = 2;
    logMessage(state, `${dealer === 'A' ? 'Seat A' : 'Seat B'} scores ${result.total} in the show.`);
    return state;
  }
  if (state.show.step === 2) {
    const result = scoreRef(state.crib, state.cut, true);
    state.show.breakdowns.crib = result.breakdown;
    state.show.revealed.push({ who: 'crib', label: 'Crib', cards: state.crib.slice(), total: result.total });
    if (awardPoints(state, dealer, result.total)) {
      logMessage(state, `${dealer === 'A' ? 'Seat A' : 'Seat B'} scores ${result.total} for the crib.`);
      return state;
    }
    state.show.step = 3;
    state.phase = 'show-complete';
    logMessage(state, `${dealer === 'A' ? 'Seat A' : 'Seat B'} scores ${result.total} for the crib. Next hand is ready.`);
    return state;
  }
  throw new Error('The show is already complete.');
}

function performNextHand(state) {
  if (state.finished) throw new Error('The game is already finished.');
  if (state.phase !== 'show-complete' && state.phase !== 'show') throw new Error('Next hand is only available after the show.');
  state.handNo += 1;
  state.dealer = otherSeat(state.dealer);
  state.cribOwner = state.dealer;
  state.turn = null;
  state.phase = 'discard';
  state.cut = null;
  state.crib = [];
  state.discards = { A: [], B: [] };
  state.pegging = { count: 0, pile: [], passed: { A: false, B: false }, lastPlayer: null };
  state.kept = { A: [], B: [] };
  state.show = { step: 0, breakdowns: { nonDealer: null, dealer: null, crib: null }, revealed: [] };
  state.message = 'Discard two cards each to start the next hand.';

  let dealInfo;
  if (state.kind === 'practice' && state.practicePlan && state.practicePlan.sequence.length > 1) {
    dealInfo = getPracticeDeal(state.practicePlan);
  } else {
    dealInfo = makeNormalDeal();
  }
  state.practiceKey = dealInfo.key === 'normal' ? state.practiceKey : dealInfo.key;
  state.dealt = { A: dealInfo.deal.a.slice(), B: dealInfo.deal.b.slice() };
  state.hands = { A: dealInfo.deal.a.slice(), B: dealInfo.deal.b.slice() };
  logMessage(state, `Hand ${state.handNo} begins; ${state.dealer === 'A' ? 'seat A' : 'seat B'} deals.`);
  return state;
}

function startGameRecord(db, members, body) {
  const actionId = body.actionId;
  if (!actionId) throw new Error('actionId is required to start a game.');
  const payloadHash = sha256(stableStringify(body));
  const existing = db.prepare('SELECT * FROM action_receipts WHERE action_id = ?').get(actionId);
  if (existing) {
    if (existing.payload_hash !== payloadHash) throw new Error('That action identifier was already used for a different request.');
    return JSON.parse(existing.response_json);
  }

  const memberRows = members;
  const memberA = memberRows.find((row) => row.no === body.memberA) || memberRows[0];
  const memberB = memberRows.find((row) => row.no === body.memberB && row.no !== memberA.no) || memberRows.find((row) => row.no !== memberA.no) || memberRows[1];
  if (!memberA || !memberB || memberA.no === memberB.no) throw new Error('Choose two different members.');

  const kind = body.kind === 'practice' ? 'practice' : 'normal';
  const startScores = kind === 'practice'
    ? { A: clampWholeNumber(body.startScores?.A, 0, 120, 0), B: clampWholeNumber(body.startScores?.B, 0, 120, 0) }
    : { A: 0, B: 0 };
  const gameId = body.gameId || randomId('G');
  const requestedPracticeKey = body.practiceKey || 'pegging';
  const practicePlan = kind === 'practice' ? createPracticePlan(requestedPracticeKey) : null;
  if (kind === 'practice' && !practicePlan) throw new Error(`Unknown practice deal: ${requestedPracticeKey}`);
  const state = createFreshState({ gameId, kind, memberA, memberB, startScores, practicePlan });
  state.message = kind === 'practice'
    ? `Practice game ${state.practiceKey} loaded. Discard two cards each to start.`
    : 'New game started. Discard two cards each to start.';
  state.log = [{ at: nowIso(), message: state.message }];

  const response = db.transaction(() => {
    db.prepare(`INSERT INTO games (id, kind, resumable, revision, state_json, created_at, updated_at, finished_at, finish_recorded)
                 VALUES (?, ?, 1, 0, ?, ?, ?, NULL, 0)`).run(
      gameId,
      kind,
      JSON.stringify(state),
      nowIso(),
      nowIso(),
    );

    const response = {
      ok: true,
      gameId,
      revision: 0,
      state: visibleGameState(state, body.seat || 'A', memberMapFromRows(members)),
      message: state.message,
    };
    db.prepare(`INSERT INTO action_receipts (action_id, game_id, payload_hash, response_status, response_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?)`).run(actionId, gameId, payloadHash, 200, JSON.stringify(response), nowIso());
    return response;
  })();
  return response;
}

function clampWholeNumber(value, min, max, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n)) throw new Error('Scores must be whole numbers.');
  if (n < min || n > max) throw new Error(`Scores must be between ${min} and ${max}.`);
  return n;
}

function applyGameAction(db, members, gameId, body) {
  const actionId = body.actionId;
  if (!actionId) throw new Error('actionId is required.');
  const payloadHash = sha256(stableStringify(body));
  const existing = db.prepare('SELECT * FROM action_receipts WHERE action_id = ?').get(actionId);
  if (existing) {
    if (existing.payload_hash !== payloadHash) throw new Error('That action identifier was already used for a different request.');
    return JSON.parse(existing.response_json);
  }

  const row = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  if (!row) throw new Error('Game not found.');
  const state = JSON.parse(row.state_json);
  if (state.finished) throw new Error('That game is already finished.');

  if (!Number.isInteger(body.expectedRevision)) throw new Error('expectedRevision must be a whole number.');
  if (body.expectedRevision !== row.revision) {
    const conflict = {
      ok: false,
      status: 409,
      error: 'stale-revision',
      message: `The game is now at revision ${row.revision}; refresh and try again.`,
      revision: row.revision,
      game: visibleGameState(state, body.seat || 'A', memberMapFromRows(members)),
    };
    return conflict;
  }

  const actionType = body.type;
  const seat = body.seat;
  if (seat !== 'A' && seat !== 'B') throw new Error('seat must be A or B.');

  const response = db.transaction(() => {
    const mutated = clone(state);
    mutated.revision = row.revision + 1;

    if (actionType === 'discard') {
      performDiscard(mutated, seat, body.cards || []);
    } else if (actionType === 'play') {
      performPlay(mutated, seat, body.card);
    } else if (actionType === 'go') {
      if (mutated.phase !== 'pegging') throw new Error('Go is only allowed during pegging.');
      if (mutated.turn !== seat) throw new Error(`It is not seat ${seat}'s turn.`);
      if (anyLegalPlay(mutated, seat)) throw new Error('That seat still has a legal card to play.');
      resolveGo(mutated, seat);
    } else if (actionType === 'show') {
      performShow(mutated);
    } else if (actionType === 'next-hand') {
      performNextHand(mutated);
    } else {
      throw new Error(`Unknown action type: ${actionType}`);
    }

    mutated.revision = row.revision + 1;
    const updatedAt = nowIso();
    db.prepare(`UPDATE games SET revision = ?, state_json = ?, updated_at = ?, finished_at = CASE WHEN ? = 1 AND finished_at IS NULL THEN ? ELSE finished_at END, finish_recorded = CASE WHEN ? = 1 THEN finish_recorded ELSE finish_recorded END, resumable = CASE WHEN ? = 1 THEN 0 ELSE 1 END
                WHERE id = ?`).run(
      mutated.revision,
      JSON.stringify(mutated),
      updatedAt,
      mutated.finished ? 1 : 0,
      mutated.finished ? updatedAt : null,
      mutated.finished ? 1 : 0,
      mutated.finished ? 1 : 0,
      gameId,
    );

    if (mutated.finished && row.finish_recorded === 0) {
      const winner = mutated.winner;
      db.prepare('UPDATE members SET played = played + 1 WHERE no IN (?, ?)').run(state.memberA, state.memberB);
      db.prepare('UPDATE members SET won = won + 1 WHERE no = ?').run(winner === 'A' ? state.memberA : state.memberB);
      db.prepare('UPDATE games SET finish_recorded = 1 WHERE id = ?').run(gameId);
    }

    const response = {
      ok: true,
      revision: mutated.revision,
      gameId,
      finished: mutated.finished,
      winner: mutated.winner,
      message: mutated.message,
      game: visibleGameState(mutated, seat, memberMapFromRows(members)),
    };
    db.prepare(`INSERT INTO action_receipts (action_id, game_id, payload_hash, response_status, response_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?)`).run(actionId, gameId, payloadHash, 200, JSON.stringify(response), nowIso());
    return response;
  })();
  return response;
}

function seedDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      no TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      played INTEGER NOT NULL DEFAULT 0,
      won INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      resumable INTEGER NOT NULL DEFAULT 1,
      revision INTEGER NOT NULL DEFAULT 0,
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      finished_at TEXT,
      finish_recorded INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS action_receipts (
      action_id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      response_status INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const insertMember = db.prepare('INSERT OR IGNORE INTO members (no, name, played, won) VALUES (?, ?, ?, ?)');
  for (const member of SEED_DATA.members) insertMember.run(member.no, member.name, member.played, member.won);

  const memberMap = memberMapFromRows(db.prepare('SELECT * FROM members').all());
  const insertGame = db.prepare(`INSERT OR IGNORE INTO games (id, kind, resumable, revision, state_json, created_at, updated_at, finished_at, finish_recorded)
                                  VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`);
  for (const summary of SEED_DATA.games) {
    const state = {
      id: summary.id,
      kind: 'historical',
      practiceKey: null,
      target: SEED_DATA.target,
      memberA: summary.dealer,
      memberB: summary.pone,
      dealer: 'A',
      handNo: 0,
      phase: summary.finished ? 'finished' : 'historical',
      turn: null,
      cut: null,
      cribOwner: summary.dealer,
      dealt: { A: [], B: [] },
      hands: { A: [], B: [] },
      kept: { A: [], B: [] },
      discards: { A: [], B: [] },
      crib: [],
      pegging: { count: 0, pile: [], passed: { A: false, B: false }, lastPlayer: null },
      show: { step: 0, breakdowns: { nonDealer: null, dealer: null, crib: null }, revealed: [] },
      scores: { A: summary.dealer_score, B: summary.pone_score },
      winner: summary.finished ? (summary.dealer_score >= TARGET ? 'A' : 'B') : null,
      finished: Boolean(summary.finished),
      message: summary.finished ? 'Historical summary.' : 'Historical summary without a deal to resume.',
      log: [{ at: nowIso(), message: summary.finished ? 'Historical summary.' : 'Historical summary without a deal to resume.' }],
      revision: 0,
    };
    insertGame.run(summary.id, 'historical', 0, JSON.stringify(state), nowIso(), nowIso(), summary.finished ? nowIso() : null, summary.finished ? 1 : 0);
  }
}

function readGameRow(db, gameId) {
  return db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
}

function listGames(db) {
  return db.prepare('SELECT * FROM games ORDER BY created_at DESC').all();
}

function parseSeat(value) {
  return value === 'B' ? 'B' : 'A';
}

function asJson(res, code, payload) {
  res.status(code).json(payload);
}

function createApp() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  seedDatabase(db);

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(WWW_ROOT, { extensions: ['html'] }));

  app.get('/api/health', (req, res) => {
    asJson(res, 200, { ok: true, dbPath: DB_PATH, target: TARGET });
  });

  app.get('/api/bootstrap', (req, res) => {
    const seat = parseSeat(req.query.seat);
    const gameId = typeof req.query.gameId === 'string' ? req.query.gameId : null;
    const members = db.prepare('SELECT * FROM members ORDER BY played DESC, won DESC, name ASC').all();
    const memberMap = memberMapFromRows(members);
    const games = listGames(db).map((row) => handSummaryRow(row, memberMap));
    let selectedGame = null;
    if (gameId) {
      const row = readGameRow(db, gameId);
      if (row) selectedGame = visibleGameState(JSON.parse(row.state_json), seat, memberMap);
    }
    asJson(res, 200, {
      ok: true,
      target: TARGET,
      seat,
      members,
      games,
      selectedGame,
      scoredHands: SCORED_HANDS,
      practiceDeals: PRACTICE_DEALS,
      houseRules: HOUSE_RULES,
      recoveryNotes: RECOVERY_NOTES,
    });
  });

  app.get('/api/games', (req, res) => {
    const playable = req.query.playable === '1' || req.query.playable === 'true';
    const members = db.prepare('SELECT * FROM members ORDER BY played DESC, won DESC, name ASC').all();
    const memberMap = memberMapFromRows(members);
    const rows = listGames(db);
    const filtered = playable ? rows.filter((row) => {
      const state = JSON.parse(row.state_json);
      return !state.finished && row.resumable === 1;
    }) : rows;
    asJson(res, 200, { ok: true, games: filtered.map((row) => handSummaryRow(row, memberMap)) });
  });

  app.get('/api/games/:id', (req, res) => {
    const row = readGameRow(db, req.params.id);
    if (!row) return asJson(res, 404, { ok: false, error: 'not-found', message: 'Game not found.' });
    const seat = parseSeat(req.query.seat);
    const members = db.prepare('SELECT * FROM members ORDER BY played DESC, won DESC, name ASC').all();
    const memberMap = memberMapFromRows(members);
    asJson(res, 200, { ok: true, game: visibleGameState(JSON.parse(row.state_json), seat, memberMap), row: handSummaryRow(row, memberMap) });
  });

  app.get('/api/history/:id', (req, res) => {
    const row = readGameRow(db, req.params.id);
    if (!row) return asJson(res, 404, { ok: false, error: 'not-found', message: 'History record not found.' });
    const state = JSON.parse(row.state_json);
    if (state.kind !== 'historical') return asJson(res, 400, { ok: false, error: 'wrong-kind', message: 'That record is not a historical summary.' });
    asJson(res, 200, { ok: true, history: state });
  });

  app.post('/api/games', (req, res) => {
    try {
      const members = db.prepare('SELECT * FROM members ORDER BY played DESC, won DESC, name ASC').all();
      const response = startGameRecord(db, members, req.body || {});
      asJson(res, 200, response);
    } catch (error) {
      asJson(res, 400, { ok: false, error: 'bad-request', message: error.message });
    }
  });

  app.post('/api/games/:id/actions', (req, res) => {
    try {
      const members = db.prepare('SELECT * FROM members ORDER BY played DESC, won DESC, name ASC').all();
      const response = applyGameAction(db, members, req.params.id, req.body || {});
      if (response.status === 409) return asJson(res, 409, response);
      asJson(res, 200, response);
    } catch (error) {
      asJson(res, 400, { ok: false, error: 'bad-request', message: error.message });
    }
  });

  app.post('/api/scoring/hand', (req, res) => {
    try {
      const hand = validateCardsList(req.body.hand || [], 4, 'Hand');
      const cut = parseCard(req.body.cut).code;
      const crib = Boolean(req.body.crib);
      const result = scoreHand(hand, cut, crib);
      asJson(res, 200, { ok: true, result });
    } catch (error) {
      asJson(res, 400, { ok: false, error: 'bad-request', message: error.message });
    }
  });

  app.post('/api/scoring/pegging', (req, res) => {
    try {
      const pile = Array.isArray(req.body.pile) ? req.body.pile.map((entry) => ({ seat: entry.seat, card: parseCard(entry.card).code })) : [];
      const count = Number(req.body.count);
      if (!Number.isInteger(count) || count < 0 || count > 31) throw new Error('Count must be a whole number from 0 to 31.');
      const result = scorePegging(pile, count);
      asJson(res, 200, { ok: true, result });
    } catch (error) {
      asJson(res, 400, { ok: false, error: 'bad-request', message: error.message });
    }
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(WWW_ROOT, 'index.html'));
  });

  return { app, db };
}

function startServer() {
  const { app } = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`Gambit Hollow listening on http://${HOST}:${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  scoreHand,
  scorePegging,
  parseCard,
  TARGET,
};

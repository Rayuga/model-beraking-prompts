'use strict';

const S = require('./scoring.js');

const TARGET = 121;
const PHASES = ['deal', 'discard', 'cut', 'play', 'show', 'between', 'over'];

function award(scores, who, points) {
  scores[who] = Math.min(TARGET, scores[who] + points);
  return scores[who] >= TARGET;
}

function freshDeck(rng) {
  const deck = [];
  for (const r of S.RANKS) for (const s of S.SUITS) deck.push(r + s);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function deal(dealer, rng) {
  const deck = freshDeck(rng);
  return {
    phase: 'discard',
    hand_no: 1,
    dealer,
    turn: dealer === 'a' ? 'b' : 'a',
    hands: { a: deck.slice(0, 6), b: deck.slice(6, 12) },
    kept: { a: null, b: null },
    crib: [],
    cribBy: { a: [], b: [] },
    stock: deck.slice(12),
    cut: null,
    pile: [],
    count: 0,
    laid: { a: [], b: [] },
    goBy: null,
    shown: [],
    events: [],
  };
}

function discard(g, who, cards) {
  if (g.phase !== 'discard') return { error: 'not the moment to discard' };
  if (g.kept[who]) return { error: 'you have already laid your crib cards' };
  if (!Array.isArray(cards) || cards.length !== 2) {
    return { error: 'two cards to the crib' };
  }
  if (new Set(cards).size !== 2) return { error: 'the same card twice' };
  for (const c of cards) {
    if (!g.hands[who].includes(c)) return { error: `${c} is not in your hand` };
  }
  g.kept[who] = g.hands[who].filter((c) => !cards.includes(c));
  g.crib = g.crib.concat(cards);
  if (!g.cribBy) g.cribBy = { a: [], b: [] };
  g.cribBy[who] = cards.slice();
  if (g.kept.a && g.kept.b) {
    g.phase = 'cut';
  }
  return { ok: true };
}

function cutCard(g, scores) {
  if (g.phase !== 'cut') return { error: 'not the moment to cut' };
  g.cut = g.stock.shift();
  g.phase = 'play';
  if (g.cut[0] === 'J') {
    g.events.push({who:g.dealer,points:2,why:'His heels: jack cut'});
    if (award(scores, g.dealer, 2)) g.phase = 'over';
  }
  return { ok: true, cut: g.cut };
}

const remaining = (g, who) => g.kept[who].filter((c) => !g.laid[who].includes(c));

function canLay(g, who) {
  return remaining(g, who).some((c) => g.count + S.value(c) <= 31);
}

function play(g, who, card, scores) {
  if (g.phase !== 'play') return { error: 'not the moment to lay a card' };
  if (g.turn !== who) return { error: 'not your turn' };
  if (!remaining(g, who).includes(card)) return { error: `${card} is not yours to lay` };
  if (g.count + S.value(card) > 31) {
    return { error: 'that would take the count past thirty-one' };
  }

  const got = S.scorePlay(g.pile, card);
  if (got.error) return { error: got.error };
  g.pile.push(card);
  g.laid[who].push(card);
  g.count = got.total;
  if (got.points) {
    g.events.push({who,points:got.points,why:got.why.join('; ')});
    if (award(scores, who, got.points)) {
      g.phase = 'over';
      return { ok: true, ...got };
    }
  }
  g.goBy = who;

  const other = who === 'a' ? 'b' : 'a';
  const bothOut = !remaining(g, 'a').length && !remaining(g, 'b').length;

  if (g.count === 31 || bothOut || (!canLay(g, other) && !canLay(g, who))) {
    if (g.count !== 31) {
      g.events.push({who,points:1,why:bothOut?'Last card':'Go: neither player can lay'});
      if (award(scores, who, 1)) {
        g.phase = 'over';
        return { ok: true, ...got };
      }
    }
    g.pile = [];
    g.count = 0;
    g.turn = bothOut ? null : (remaining(g, other).length ? other : who);
    if (bothOut) g.phase = 'show';
  } else {
    g.turn = canLay(g, other) ? other : who;
  }
  return { ok: true, ...got };
}

function show(g, scores) {
  if (g.phase !== 'show') return { error: 'not the moment to show' };
  const pone = g.dealer === 'a' ? 'b' : 'a';
  const order = [
    { who: pone, cards: g.kept[pone], crib: false, label: 'non-dealer' },
    { who: g.dealer, cards: g.kept[g.dealer], crib: false, label: 'dealer' },
    { who: g.dealer, cards: g.crib, crib: true, label: 'crib' },
  ];
  for (let i = g.shown.length; i < order.length; i++) {
    const step = order[i];
    const r = S.scoreHand(step.cards, g.cut, step.crib);
    const won = award(scores, step.who, r.total);
    g.shown.push({ ...step, total: r.total, breakdown: r.breakdown });
    g.events.push({ who: step.who, points: r.total, why: `${step.label}'s show` });
    if (won) {
      g.phase = 'over';
      return { ok: true, stoppedAt: step.label, shown: g.shown };
    }
  }
  g.phase = 'between';
  return { ok: true, shown: g.shown, handComplete: true };
}

function nextHand(g, rng) {
  if (g.phase !== 'between') return { error: 'the hand is not finished' };
  const next = deal(g.dealer === 'a' ? 'b' : 'a', rng);
  next.hand_no = (g.hand_no || 1) + 1;
  next.revision = g.revision || 0;
  if (g.series) next.series = g.series.slice();
  for (const k of Object.keys(g)) delete g[k];
  Object.assign(g, next);
  return { ok: true, hand_no: next.hand_no, dealer: next.dealer };
}

module.exports = { TARGET, PHASES, deal, discard, cutCard, play, show, nextHand,
                   canLay, remaining };

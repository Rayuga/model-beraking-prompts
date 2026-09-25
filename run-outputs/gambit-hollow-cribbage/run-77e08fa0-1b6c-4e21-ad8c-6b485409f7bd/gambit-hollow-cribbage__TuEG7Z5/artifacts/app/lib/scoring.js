'use strict';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];

function value(card) {
  const r = card[0];
  if (r === 'A') return 1;
  if (r === 'T' || r === 'J' || r === 'Q' || r === 'K') return 10;
  return Number(r);
}

function order(card) {
  return RANKS.indexOf(card[0]) + 1;
}

const suitOf = (card) => card[1];

function isCard(c) {
  return typeof c === 'string' && c.length === 2
    && RANKS.includes(c[0]) && SUITS.includes(c[1]);
}

function subsets(cards) {
  const out = [];
  for (let mask = 1; mask < (1 << cards.length); mask++) {
    const pick = [];
    for (let i = 0; i < cards.length; i++) if (mask & (1 << i)) pick.push(cards[i]);
    if (pick.length >= 2) out.push(pick);
  }
  return out;
}

function fifteens(cards) {
  const hits = subsets(cards).filter(
    (s) => s.reduce((t, c) => t + value(c), 0) === 15);
  return { points: hits.length * 2, count: hits.length, sets: hits };
}

function pairs(cards) {
  let n = 0;
  const found = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cards[i][0] === cards[j][0]) { n += 1; found.push([cards[i], cards[j]]); }
    }
  }
  return { points: n * 2, count: n, sets: found };
}

function runs(cards) {
  const byOrder = new Map();
  for (const c of cards) {
    const o = order(c);
    byOrder.set(o, (byOrder.get(o) || 0) + 1);
  }
  const present = [...byOrder.keys()].sort((a, b) => a - b);

  let best = 0;
  let points = 0;
  let length = 0;
  for (let i = 0; i < present.length; i++) {
    let run = [present[i]];
    while (byOrder.has(run[run.length - 1] + 1)) run.push(run[run.length - 1] + 1);
    if (run.length < 3) continue;
    const mult = run.reduce((t, o) => t * byOrder.get(o), 1);
    const scored = run.length * mult;
    if (run.length > best || (run.length === best && scored > points)) {
      best = run.length;
      points = scored;
      length = run.length;
    }
    i += run.length - 1;
  }
  return { points, length, multiplier: length ? points / length : 0 };
}

function flush(hand, cut, isCrib) {
  const s = suitOf(hand[0]);
  const allHand = hand.every((c) => suitOf(c) === s);
  if (!allHand) return { points: 0, suit: null };
  const withCut = cut && suitOf(cut) === s;
  if (isCrib) return withCut ? { points: 5, suit: s } : { points: 0, suit: null };
  return withCut ? { points: 5, suit: s } : { points: 4, suit: s };
}

function nobs(hand, cut) {
  if (!cut) return { points: 0, card: null };
  const j = hand.find((c) => c[0] === 'J' && suitOf(c) === suitOf(cut));
  return j ? { points: 1, card: j } : { points: 0, card: null };
}

function scoreHand(hand, cut, isCrib = false) {
  if (!Array.isArray(hand) || !isCard(cut)) return {error:'Four hand cards and one cut card are required'};
  const bad = [...hand, cut].filter((c) => !isCard(c));
  if (bad.length) return { error: `not a card: ${bad.join(', ')}` };
  if (hand.length !== 4) return { error: 'a hand at the show is four cards' };
  const all = cut ? hand.concat([cut]) : hand.slice();
  if (new Set(all).size !== all.length) return { error: 'the same card twice' };

  const f = fifteens(all);
  const p = pairs(all);
  const r = runs(all);
  const fl = flush(hand, cut, isCrib);
  const n = nobs(hand, cut);
  const total = f.points + p.points + r.points + fl.points + n.points;
  return {
    total,
    breakdown: {
      fifteens: f.points, pairs: p.points, runs: r.points,
      flush: fl.points, nobs: n.points,
    },
    detail: { fifteens: f.count, run_length: r.length, run_multiplier: r.multiplier,
              flush_suit: fl.suit, nobs_card: n.card },
  };
}

function scorePlay(pile, card) {
  if (!Array.isArray(pile) || !pile.every(isCard)) return {error:'Every pile item must be a card'};
  if (new Set([...pile,card]).size !== pile.length+1) return {error:'The same card twice'};
  if (!isCard(card)) return { error: `not a card: ${card}` };
  const seq = pile.concat([card]);
  const total = seq.reduce((t, c) => t + value(c), 0);
  if (total > 31) return { error: 'that would take the count past thirty-one' };

  let points = 0;
  const why = [];
  if (total === 15) { points += 2; why.push('fifteen for two'); }
  if (total === 31) { points += 2; why.push('thirty-one for two'); }

  let same = 1;
  for (let i = seq.length - 2; i >= 0 && seq[i][0] === card[0]; i--) same += 1;
  if (same >= 2) {
    const pts = same * (same - 1);
    points += pts;
    why.push(same === 2 ? 'a pair for two'
      : same === 3 ? 'three of a kind for six' : 'four of a kind for twelve');
  }

  for (let len = seq.length; len >= 3; len--) {
    const tail = seq.slice(-len).map(order).sort((a, b) => a - b);
    const consecutive = tail.every((o, i) => i === 0 || o === tail[i - 1] + 1);
    if (consecutive && new Set(tail).size === tail.length) {
      points += len;
      why.push(`a run of ${len}`);
      break;
    }
  }
  return { points, total, why };
}

module.exports = { RANKS, SUITS, value, order, isCard, fifteens, pairs, runs,
                   flush, nobs, scoreHand, scorePlay };

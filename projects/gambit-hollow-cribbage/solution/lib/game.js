'use strict';
// Gambit Hollow — the game around the scoring.
//
// A cribbage game is a small state machine and most of the bugs live in the
// transitions, not the arithmetic: whose turn it is after a go, when the count
// resets, who shows first, and the fact that reaching 121 stops everything
// immediately rather than at the end of the hand.

const S = require('./scoring.js');

const TARGET = 121;
// `between` is a finished HAND in an unfinished game: the three counts stay on
// screen until the next hand is asked for, rather than the board being
// snatched away the instant the crib is counted.
const PHASES = ['deal', 'discard', 'cut', 'play', 'show', 'between', 'over'];

/**
 * Award points, and say whether that won the game.
 *
 * The score is CAPPED at the target: a cribbage board has 121 holes and the
 * game stops the moment the last one is reached, so a hand worth ten counted
 * from 115 finishes at 121 rather than 125. Four separate `+=` sites used to do
 * this by hand and none of them capped.
 */
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

/** A new hand. The dealer alternates, which is the caller's business. */
function deal(dealer, rng) {
  const deck = freshDeck(rng);
  return {
    phase: 'discard',
    hand_no: 1,
    dealer,
    turn: dealer === 'a' ? 'b' : 'a',   // non-dealer leads the play
    hands: { a: deck.slice(0, 6), b: deck.slice(6, 12) },
    kept: { a: null, b: null },
    crib: [],
    // Who contributed which two. A player knows their own discards, so the
    // crib is only half-hidden from each of them, and the crib is built by
    // concatenation -- the order depends on who laid first, so ownership has
    // to be recorded rather than inferred from position.
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

/** Two cards each into the crib. Neither player may see the other's. */
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

/**
 * Turn the cut. His heels: a jack scores the DEALER two, immediately, before a
 * card is laid — and if that takes them to the target the game is over there.
 */
function cutCard(g, scores) {
  if (g.phase !== 'cut') return { error: 'not the moment to cut' };
  g.cut = g.stock.shift();
  g.phase = 'play';
  if (g.cut[0] === 'J') {
    if (award(scores, g.dealer, 2)) g.phase = 'over';
  }
  return { ok: true, cut: g.cut };
}

const remaining = (g, who) => g.kept[who].filter((c) => !g.laid[who].includes(c));

/** Can this player lay anything at all without passing thirty-one? */
function canLay(g, who) {
  return remaining(g, who).some((c) => g.count + S.value(c) <= 31);
}

/**
 * Lay one card in the play.
 *
 * Handles the go: when the player to move cannot lay, the other continues; when
 * NEITHER can, the last to lay takes one, the count resets, and the lead passes
 * to the other player. Getting that wrong is the classic pegging bug.
 */
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
    if (award(scores, who, got.points)) {
      g.phase = 'over';
      return { ok: true, ...got };
    }
  }
  g.goBy = who;

  const other = who === 'a' ? 'b' : 'a';
  const bothOut = !remaining(g, 'a').length && !remaining(g, 'b').length;

  if (g.count === 31 || bothOut || (!canLay(g, other) && !canLay(g, who))) {
    // the go, or a natural thirty-one, or nobody has a card left
    if (g.count !== 31) {
      if (award(scores, who, 1)) {
        g.phase = 'over';
        return { ok: true, ...got };
      }
    }
    g.pile = [];
    g.count = 0;
    // The lead goes to whoever still HAS cards. Handing it to `other`
    // unconditionally jammed the hand whenever `other` had just laid their
    // last one and this player had not: an empty hand can never lay, so the
    // turn sat there for ever. `bothOut` only catches both being empty.
    g.turn = bothOut ? null : (remaining(g, other).length ? other : who);
    if (bothOut) g.phase = 'show';
  } else {
    g.turn = canLay(g, other) ? other : who;
  }
  return { ok: true, ...got };
}

/**
 * The show, in order: non-dealer, dealer, crib.
 *
 * Returned one step at a time rather than all at once, because a game can end
 * part way through and the later counts must not happen.
 */
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
  // Nobody reached the target, so the HAND is over and the GAME is not. This
  // used to set 'over', which ended every game after one hand -- around 11
  // points -- and made the target unreachable.
  g.phase = 'between';
  return { ok: true, shown: g.shown, handComplete: true };
}

/**
 * Deal the next hand of the same game.
 *
 * The deal alternates, which is what makes a cribbage game a sequence of hands
 * rather than one hand: the crib is worth having, so who gets it has to move.
 * Scores live outside this object and simply carry.
 */
function nextHand(g, rng) {
  if (g.phase !== 'between') return { error: 'the hand is not finished' };
  const next = deal(g.dealer === 'a' ? 'b' : 'a', rng);
  next.hand_no = (g.hand_no || 1) + 1;
  // Mutated in place: the caller holds this object and persists it.
  for (const k of Object.keys(g)) delete g[k];
  Object.assign(g, next);
  return { ok: true, hand_no: next.hand_no, dealer: next.dealer };
}

module.exports = { TARGET, PHASES, deal, discard, cutCard, play, show, nextHand,
                   canLay, remaining };

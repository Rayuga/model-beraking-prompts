(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CribbageRules = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
  const SUITS = ['S', 'H', 'D', 'C'];
  const RANK_TO_VALUE = Object.fromEntries(RANKS.map((rank, index) => [rank, index + 1]));
  const RANK_TO_PIP = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 10, Q: 10, K: 10 };

  function parseCard(code) {
    if (typeof code !== 'string' || code.length !== 2) {
      throw new Error(`Invalid card code: ${code}`);
    }
    const rank = code[0].toUpperCase();
    const suit = code[1].toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(RANK_TO_VALUE, rank) || !SUITS.includes(suit)) {
      throw new Error(`Invalid card code: ${code}`);
    }
    return {
      code: rank + suit,
      rank,
      suit,
      rankValue: RANK_TO_VALUE[rank],
      pipValue: RANK_TO_PIP[rank],
    };
  }

  function normalizeCards(codes) {
    if (!Array.isArray(codes)) throw new Error('Expected an array of cards');
    const parsed = codes.map(parseCard);
    const seen = new Set();
    for (const card of parsed) {
      if (seen.has(card.code)) throw new Error(`Duplicate card: ${card.code}`);
      seen.add(card.code);
    }
    return parsed;
  }

  function cardValue(code) {
    return parseCard(code).pipValue;
  }

  function sortCards(codes) {
    return [...codes].sort((a, b) => {
      const pa = parseCard(a);
      const pb = parseCard(b);
      if (pa.rankValue !== pb.rankValue) return pa.rankValue - pb.rankValue;
      return pa.suit.localeCompare(pb.suit);
    });
  }

  function subsetCodes(cards, mask) {
    const out = [];
    for (let i = 0; i < cards.length; i += 1) {
      if (mask & (1 << i)) out.push(cards[i].code);
    }
    return out;
  }

  function scoreFifteens(cards) {
    const combos = [];
    const len = cards.length;
    for (let mask = 1; mask < (1 << len); mask += 1) {
      let sum = 0;
      const codes = [];
      for (let i = 0; i < len; i += 1) {
        if (mask & (1 << i)) {
          sum += cards[i].pipValue;
          codes.push(cards[i].code);
        }
      }
      if (sum === 15) combos.push({ cards: codes, points: 2 });
    }
    return combos;
  }

  function scorePairs(cards) {
    const counts = new Map();
    for (const card of cards) counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
    const groups = [];
    for (const [rank, count] of counts.entries()) {
      if (count >= 2) groups.push({ rank, count, points: count * (count - 1) });
    }
    groups.sort((a, b) => RANK_TO_VALUE[a.rank] - RANK_TO_VALUE[b.rank]);
    return groups;
  }

  function scoreRuns(cards) {
    const counts = new Map();
    for (const card of cards) counts.set(card.rankValue, (counts.get(card.rankValue) || 0) + 1);
    const ranks = [...counts.keys()].sort((a, b) => a - b);
    const segments = [];
    let start = 0;
    while (start < ranks.length) {
      let end = start;
      while (end + 1 < ranks.length && ranks[end + 1] === ranks[end] + 1) end += 1;
      const length = end - start + 1;
      if (length >= 3) segments.push({ start, end, length });
      start = end + 1;
    }
    if (!segments.length) return [];
    const longest = Math.max(...segments.map((segment) => segment.length));
    return segments
      .filter((segment) => segment.length === longest)
      .map((segment) => {
        const ranksInRun = ranks.slice(segment.start, segment.end + 1);
        const multiplicity = ranksInRun.reduce((product, rank) => product * counts.get(rank), 1);
        const codes = [];
        for (const rank of ranksInRun) {
          const cardsOfRank = cards.filter((card) => card.rankValue === rank).map((card) => card.code).sort();
          codes.push(cardsOfRank[0]);
        }
        return {
          cards: codes,
          length: segment.length,
          multiplicity,
          points: segment.length * multiplicity,
        };
      });
  }

  function scoreFlush(cards, crib) {
    const handCards = cards.slice(0, 4);
    const handSuit = handCards[0].suit;
    const handFlush = handCards.every((card) => card.suit === handSuit);
    if (!handFlush) return { points: 0, cards: [], crib };
    if (cards[4].suit === handSuit) {
      return { points: 5, cards: cards.map((card) => card.code), crib };
    }
    if (crib) return { points: 0, cards: [], crib };
    return { points: 4, cards: handCards.map((card) => card.code), crib };
  }

  function scoreNobs(handCards, cutCard) {
    const jack = handCards.find((card) => card.rank === 'J' && card.suit === cutCard.suit);
    return jack ? { points: 1, card: jack.code } : { points: 0, card: null };
  }

  function scoreHand(handCodes, cutCode, crib = false) {
    const handCards = normalizeCards(handCodes);
    if (handCards.length !== 4) throw new Error('Hand scoring needs exactly four cards');
    const cutCard = parseCard(cutCode);
    const allCodes = handCards.map((card) => card.code).concat(cutCard.code);
    const seen = new Set();
    for (const code of allCodes) {
      if (seen.has(code)) throw new Error(`Duplicate card: ${code}`);
      seen.add(code);
    }
    const full = [...handCards, cutCard];
    const fifteens = scoreFifteens(full);
    const pairs = scorePairs(full);
    const runs = scoreRuns(full);
    const flush = scoreFlush(full, crib);
    const nobs = scoreNobs(handCards, cutCard);
    const fifteensPoints = fifteens.reduce((sum, item) => sum + item.points, 0);
    const pairsPoints = pairs.reduce((sum, item) => sum + item.points, 0);
    const runsPoints = runs.reduce((sum, item) => sum + item.points, 0);
    const total = fifteensPoints + pairsPoints + runsPoints + flush.points + nobs.points;
    return {
      total,
      parts: {
        fifteens: fifteensPoints,
        pairs: pairsPoints,
        runs: runsPoints,
        flush: flush.points,
        nobs: nobs.points,
      },
      details: {
        fifteens,
        pairs,
        runs,
        flush,
        nobs,
      },
      cards: full.map((card) => card.code),
    };
  }

  function asParsedCards(cards) {
    return cards.map((card) => (typeof card === 'string' ? parseCard(card) : card));
  }

  function longestRunEndingAt(cards) {
    const parsed = asParsedCards(cards);
    for (let length = parsed.length; length >= 3; length -= 1) {
      const suffix = parsed.slice(parsed.length - length);
      const uniqueRanks = new Set(suffix.map((card) => card.rankValue));
      if (uniqueRanks.size !== suffix.length) continue;
      const sorted = [...uniqueRanks].sort((a, b) => a - b);
      let ok = true;
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i] !== sorted[i - 1] + 1) {
          ok = false;
          break;
        }
      }
      if (ok) {
        return {
          length,
          cards: suffix.map((card) => card.code),
          points: length,
        };
      }
    }
    return null;
  }

  function sameRankSuffix(cards) {
    const parsed = asParsedCards(cards);
    const newest = parsed[parsed.length - 1];
    let count = 1;
    for (let i = parsed.length - 2; i >= 0; i -= 1) {
      if (parsed[i].rank !== newest.rank) break;
      count += 1;
    }
    return count;
  }

  function scorePeggingPlay(pileCodes, nextCode, currentCount = 0) {
    const next = parseCard(nextCode);
    const pile = normalizeCards(pileCodes);
    const after = currentCount + next.pipValue;
    if (after > 31) {
      throw new Error(`Play would exceed 31: ${currentCount} + ${next.code}`);
    }
    const cards = pile.concat(next);
    const reasons = [];
    if (after === 15) reasons.push({ type: 'fifteen', points: 2, text: '15 for 2' });
    if (after === 31) reasons.push({ type: 'thirty-one', points: 2, text: '31 for 2' });
    const pairCount = sameRankSuffix(cards);
    if (pairCount >= 2) {
      reasons.push({
        type: 'pair',
        points: pairCount * (pairCount - 1),
        text: pairCount === 2 ? 'pair for 2' : pairCount === 3 ? 'pair royal for 6' : 'double pair royal for 12',
        count: pairCount,
      });
    }
    const run = longestRunEndingAt(cards);
    if (run) reasons.push({ type: 'run', points: run.points, text: `run of ${run.length}`, cards: run.cards });
    return {
      countAfter: after,
      points: reasons.reduce((sum, item) => sum + item.points, 0),
      reasons,
      pile: cards.map((card) => card.code),
    };
  }

  function legalPegCards(handCodes, count = 0, passed = false) {
    if (passed) return [];
    const hand = normalizeCards(handCodes);
    return hand.filter((card) => card.pipValue + count <= 31).map((card) => card.code);
  }

  function createDeck() {
    const deck = [];
    for (const rank of RANKS) {
      for (const suit of SUITS) deck.push(rank + suit);
    }
    return deck;
  }

  function shuffleDeck(deck, rng = Math.random) {
    const out = deck.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function cardLabel(code) {
    const card = parseCard(code);
    const rankLabels = { A: 'A', T: '10', J: 'J', Q: 'Q', K: 'K' };
    const suitLabels = { S: '♠', H: '♥', D: '♦', C: '♣' };
    return `${rankLabels[card.rank] || card.rank}${suitLabels[card.suit]}`;
  }

  return {
    RANKS,
    SUITS,
    parseCard,
    normalizeCards,
    cardValue,
    sortCards,
    scoreHand,
    scorePeggingPlay,
    legalPegCards,
    createDeck,
    shuffleDeck,
    cardLabel,
  };
});

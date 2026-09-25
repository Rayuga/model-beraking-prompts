// Cribbage scoring engine for Gambit Hollow

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];

const RANK_VALUES = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, '10': 10, 'J': 10, 'Q': 10, 'K': 10
};

const RANK_ORDER = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, '10': 10, 'J': 11, 'Q': 12, 'K': 13
};

function normalizeCard(card) {
  if (!card || typeof card !== 'string') return null;
  card = card.trim().toUpperCase();
  // Map suit symbols if present
  card = card.replace('♠', 'S').replace('♥', 'H').replace('♦', 'D').replace('♣', 'C');
  if (card.startsWith('10')) {
    card = 'T' + card.slice(2);
  }
  if (card.length !== 2) return null;
  const rank = card[0];
  const suit = card[1];
  if (!RANKS.includes(rank) || !SUITS.includes(suit)) return null;
  return rank + suit;
}

function parseCard(cardStr) {
  const norm = normalizeCard(cardStr);
  if (!norm) return null;
  return {
    raw: norm,
    rank: norm[0],
    suit: norm[1],
    value: RANK_VALUES[norm[0]],
    order: RANK_ORDER[norm[0]]
  };
}

// Generate all combinations of array k items
function getCombinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  const head = arr[0];
  const tail = arr.slice(1);
  const withHead = getCombinations(tail, k - 1).map(c => [head, ...c]);
  const withoutHead = getCombinations(tail, k);
  return [...withHead, ...withoutHead];
}

/**
 * Score a hand with cut card.
 * @param {Array<string>} handCards - 4 card strings
 * @param {string} cutCard - 1 card string
 * @param {boolean} isCrib - whether this is the crib
 * @returns {object} breakdown and total score
 */
function scoreHand(handCards, cutCard, isCrib = false) {
  if (!Array.isArray(handCards) || handCards.length !== 4 || !cutCard) {
    throw new Error('Invalid hand or cut card');
  }

  const parsedHand = handCards.map(parseCard);
  const parsedCut = parseCard(cutCard);

  if (parsedHand.some(c => !c) || !parsedCut) {
    throw new Error('Invalid card in hand or cut');
  }

  const allCards = [...parsedHand, parsedCut];
  // Check for duplicate cards
  const cardCodes = allCards.map(c => c.raw);
  const uniqueCodes = new Set(cardCodes);
  if (uniqueCodes.size !== 5) {
    throw new Error('Duplicate cards found');
  }

  // 1. Fifteens
  const fifteenCombos = [];
  for (let k = 2; k <= 5; k++) {
    const combos = getCombinations(allCards, k);
    for (const combo of combos) {
      const sum = combo.reduce((acc, c) => acc + c.value, 0);
      if (sum === 15) {
        fifteenCombos.push(combo.map(c => c.raw));
      }
    }
  }
  const fifteensScore = fifteenCombos.length * 2;

  // 2. Pairs
  const pairCombos = [];
  const twoCombos = getCombinations(allCards, 2);
  for (const combo of twoCombos) {
    if (combo[0].rank === combo[1].rank) {
      pairCombos.push(combo.map(c => c.raw));
    }
  }
  const pairsScore = pairCombos.length * 2;

  // 3. Runs
  // Check for runs of length 5, then 4, then 3
  const runCombos = [];
  let runsScore = 0;
  for (let len = 5; len >= 3; len--) {
    const combos = getCombinations(allCards, len);
    const validRuns = [];
    for (const combo of combos) {
      const orders = combo.map(c => c.order).sort((a, b) => a - b);
      let isConsecutive = true;
      for (let i = 0; i < orders.length - 1; i++) {
        if (orders[i + 1] !== orders[i] + 1) {
          isConsecutive = false;
          break;
        }
      }
      if (isConsecutive) {
        validRuns.push(combo.map(c => c.raw));
      }
    }
    if (validRuns.length > 0) {
      runCombos.push(...validRuns);
      runsScore = validRuns.length * len;
      break; // Only score the longest valid run length
    }
  }

  // 4. Flush
  let flushScore = 0;
  let flushCards = [];
  const handSuits = parsedHand.map(c => c.suit);
  const handSameSuit = handSuits.every(s => s === handSuits[0]);

  if (isCrib) {
    // In crib, all 5 cards (hand + cut) must match suit
    if (handSameSuit && parsedCut.suit === handSuits[0]) {
      flushScore = 5;
      flushCards = allCards.map(c => c.raw);
    }
  } else {
    // In normal hand, 4 cards in hand must match suit
    if (handSameSuit) {
      if (parsedCut.suit === handSuits[0]) {
        flushScore = 5;
        flushCards = allCards.map(c => c.raw);
      } else {
        flushScore = 4;
        flushCards = parsedHand.map(c => c.raw);
      }
    }
  }

  // 5. His Nobs (Jack in hand/crib matching suit of cut card)
  let nobsScore = 0;
  let nobsCard = null;
  for (const card of parsedHand) {
    if (card.rank === 'J' && card.suit === parsedCut.suit) {
      nobsScore = 1;
      nobsCard = card.raw;
      break;
    }
  }

  const total = fifteensScore + pairsScore + runsScore + flushScore + nobsScore;

  return {
    hand: handCards.map(normalizeCard),
    cut: normalizeCard(cutCard),
    isCrib,
    total,
    breakdown: {
      fifteens: { points: fifteensScore, count: fifteenCombos.length, combinations: fifteenCombos },
      pairs: { points: pairsScore, count: pairCombos.length, combinations: pairCombos },
      runs: { points: runsScore, count: runCombos.length, combinations: runCombos },
      flush: { points: flushScore, count: flushScore > 0 ? 1 : 0, cards: flushCards },
      nobs: { points: nobsScore, card: nobsCard }
    }
  };
}

/**
 * Score a card played in pegging.
 * @param {Array<string>} playedCardsInRound - All cards played in this count cycle up to and including the current card
 * @returns {object} { count, points, reasons, isThirtyOne, isFifteen }
 */
function scorePeggingPlay(playedCardsInRound) {
  if (!Array.isArray(playedCardsInRound) || playedCardsInRound.length === 0) {
    throw new Error('No cards in pegging play');
  }

  const parsedList = playedCardsInRound.map(parseCard);
  if (parsedList.some(c => !c)) {
    throw new Error('Invalid card in pegging play');
  }

  const currentCard = parsedList[parsedList.length - 1];
  const count = parsedList.reduce((acc, c) => acc + c.value, 0);

  if (count > 31) {
    throw new Error('Count exceeds 31');
  }

  let points = 0;
  const reasons = [];

  // 1. Fifteen
  const isFifteen = count === 15;
  if (isFifteen) {
    points += 2;
    reasons.push({ type: 'fifteen', points: 2, description: 'Fifteen for 2' });
  }

  // 2. Thirty-one
  const isThirtyOne = count === 31;
  if (isThirtyOne) {
    points += 2;
    reasons.push({ type: 'thirtyone', points: 2, description: 'Thirty-one for 2' });
  }

  // 3. Pairs (check consecutive identical ranks from the end)
  let matchingRankCount = 1;
  for (let i = parsedList.length - 2; i >= 0; i--) {
    if (parsedList[i].rank === currentCard.rank) {
      matchingRankCount++;
    } else {
      break;
    }
  }

  if (matchingRankCount === 2) {
    points += 2;
    reasons.push({ type: 'pair', points: 2, description: `Pair of ${currentCard.rank}s for 2` });
  } else if (matchingRankCount === 3) {
    points += 6;
    reasons.push({ type: 'pair_royal', points: 6, description: `Three ${currentCard.rank}s for 6` });
  } else if (matchingRankCount === 4) {
    points += 12;
    reasons.push({ type: 'double_pair_royal', points: 12, description: `Four ${currentCard.rank}s for 12` });
  }

  // 4. Runs (check suffix of length 3, 4, ..., parsedList.length)
  let bestRun = 0;
  for (let len = parsedList.length; len >= 3; len--) {
    const sub = parsedList.slice(parsedList.length - len);
    const orders = sub.map(c => c.order);
    const min = Math.min(...orders);
    const max = Math.max(...orders);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size === len && max - min === len - 1) {
      bestRun = len;
      break; // Longest valid run
    }
  }

  if (bestRun >= 3) {
    points += bestRun;
    reasons.push({ type: 'run', points: bestRun, description: `Run of ${bestRun} for ${bestRun}` });
  }

  return {
    count,
    points,
    reasons,
    isFifteen,
    isThirtyOne
  };
}

module.exports = {
  RANKS,
  SUITS,
  RANK_VALUES,
  RANK_ORDER,
  normalizeCard,
  parseCard,
  scoreHand,
  scorePeggingPlay
};

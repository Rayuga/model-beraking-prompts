// Cribbage scoring engine

const RANKS = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13 };
const SUITS = ['S', 'H', 'D', 'C'];

function parseCard(card) {
  if (!card || card.length < 2) return null;
  const rank = card.slice(0, -1);
  const suit = card[card.length - 1];
  if (!RANKS[rank] || !SUITS.includes(suit)) return null;
  return { rank, suit, card, value: RANKS[rank] };
}

function value(card) {
  const p = parseCard(card);
  return p ? (p.value > 10 ? 10 : p.value) : null;
}

// Find all combinations of cards that sum to target
function findCombinations(cards, target) {
  const combos = [];
  const n = cards.length;
  
  for (let mask = 0; mask < (1 << n); mask++) {
    if (!mask || (mask & (mask - 1)) === mask) continue; // Skip empty and single cards
    let sum = 0;
    let combo = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        combo.push(cards[i]);
        sum += value(cards[i]);
      }
    }
    if (sum === target) {
      combos.push(combo);
    }
  }
  
  return combos;
}

// Count fifteens
function countFifteens(cards) {
  return findCombinations(cards, 15).length * 2;
}

// Count pairs (same rank)
function countPairs(cards) {
  const parsed = cards.map(parseCard);
  let count = 0;
  
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      if (parsed[i].rank === parsed[j].rank) {
        count += 2;
      }
    }
  }
  
  return count;
}

// Find runs (sequences of 3+ consecutive cards)
function findRuns(cards) {
  const parsed = cards.map(parseCard);
  if (cards.length < 3) return [];
  
  // Group by rank value and count occurrences
  const rankCounts = {};
  parsed.forEach(p => {
    rankCounts[p.value] = (rankCounts[p.value] || 0) + 1;
  });
  
  const uniqueValues = Object.keys(rankCounts).map(Number).sort((a, b) => a - b);
  
  // Find consecutive sequences
  const runs = [];
  
  function findSequence(values) {
    for (let len = Math.min(values.length, cards.length); len >= 3; len--) {
      for (let start = 0; start <= values.length - len; start++) {
        const seq = values.slice(start, start + len);
        
        // Check if consecutive
        let consecutive = true;
        for (let i = 1; i < seq.length; i++) {
          if (seq[i] !== seq[i - 1] + 1) {
            consecutive = false;
            break;
          }
        }
        
        if (consecutive) {
          runs.push(seq);
        }
      }
    }
  }
  
  findSequence(uniqueValues);
  
  return runs;
}

// Count all runs, accounting for duplicates
function countRuns(cards) {
  const runs = findRuns(cards);
  if (runs.length === 0) return 0;
  
  const parsed = cards.map(parseCard);
  const rankCounts = {};
  parsed.forEach(p => {
    rankCounts[p.value] = (rankCounts[p.value] || 0) + 1;
  });
  
  // Find the longest run(s)
  let longestRun = null;
  let maxLen = 0;
  
  for (const run of runs) {
    if (run.length > maxLen) {
      maxLen = run.length;
      longestRun = run;
    }
  }
  
  if (!longestRun) return 0;
  
  // Count multiplicity: product of card counts in the run
  let multiplicity = 1;
  for (const val of longestRun) {
    multiplicity *= rankCounts[val];
  }
  
  return longestRun.length * multiplicity;
}

// Count flush (all 4 cards in hand same suit, or 5 with cut)
function countFlush(hand, cut, isCrib) {
  const allCards = hand.concat([cut]);
  const parsed = allCards.map(parseCard);
  
  if (isCrib) {
    // Crib flush needs all 5 cards same suit
    const suit = parsed[0].suit;
    if (parsed.every(p => p.suit === suit)) {
      return 5;
    }
    return 0;
  } else {
    // Hand flush: 4 cards in hand same suit (with or without cut)
    const handParsed = hand.map(parseCard);
    const handSuit = handParsed[0].suit;
    
    const handMatches = handParsed.filter(p => p.suit === handSuit).length;
    if (handMatches === 4) {
      // All 4 hand cards match
      if (parsed[parsed.length - 1].suit === handSuit) {
        return 5; // Cut also matches
      }
      return 4; // Just the hand
    }
    
    return 0;
  }
}

// Count nobs (jack in hand with same suit as cut)
function countNobs(hand, cut) {
  const cutParsed = parseCard(cut);
  
  for (const card of hand) {
    const p = parseCard(card);
    if (p.rank === 'J' && p.suit === cutParsed.suit) {
      return 1;
    }
  }
  
  return 0;
}

// Score a complete hand
function scoreHand(hand, cut, isCrib) {
  const allCards = hand.concat([cut]);
  
  // Validate
  if (allCards.length < 5) return null;
  const seen = new Set();
  for (const card of allCards) {
    if (!parseCard(card)) return null;
    if (seen.has(card)) return null;
    seen.add(card);
  }
  
  const fifteens = countFifteens(allCards);
  const pairs = countPairs(allCards);
  const runs = countRuns(allCards);
  const flush = countFlush(hand, cut, isCrib);
  const nobs = isCrib ? 0 : countNobs(hand, cut);
  
  const total = fifteens + pairs + runs + flush + nobs;
  
  return {
    fifteens,
    pairs,
    runs,
    flush,
    nobs,
    total,
    breakdown: {
      fifteens: fifteens ? `${fifteens}` : null,
      pairs: pairs ? `${pairs}` : null,
      runs: runs ? `${runs}` : null,
      flush: flush ? `${flush}` : null,
      nobs: nobs ? `${nobs}` : null
    }
  };
}

// Score the play (pegging)
function scorePegging(pile) {
  if (pile.length === 0) return { total: 0 };
  
  // Calculate running total
  const runningTotal = pile.reduce((sum, card) => sum + value(card), 0);
  
  if (runningTotal > 31) return null; // Invalid pile
  
  let score = 0;
  
  // Two for thirty-one
  if (runningTotal === 31) {
    score += 2;
  }
  
  // Fifteens in the pile
  if (runningTotal === 15) {
    score += 2;
  }
  
  // Pairs (last 2, 3, or 4 cards)
  for (let i = pile.length - 1; i >= 1; i--) {
    const p1 = parseCard(pile[i]);
    const p2 = parseCard(pile[i - 1]);
    
    if (p1.rank === p2.rank) {
      score += 2;
    } else {
      break; // Pair broken
    }
  }
  
  // Runs (last 3, 4, or 5 cards)
  if (pile.length >= 3) {
    const lastCards = pile.slice(-5); // Check up to last 5
    const runs = countRuns(lastCards);
    if (runs > 0) {
      score += runs;
    }
  }
  
  return {
    total: score,
    count: runningTotal,
    fifteens: runningTotal === 15 ? 2 : 0,
    pairs: 0, // Already counted above
    runs: 0   // Already counted above
  };
}

module.exports = {
  parseCard,
  value,
  scoreHand,
  scorePegging,
  countFifteens,
  countPairs,
  countRuns,
  countFlush,
  countNobs,
  findCombinations
};

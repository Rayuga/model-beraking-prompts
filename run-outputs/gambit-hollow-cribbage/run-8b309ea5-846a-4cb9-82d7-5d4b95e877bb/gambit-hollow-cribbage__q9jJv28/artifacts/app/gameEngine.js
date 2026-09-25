const fs = require('fs');
const { scoreHand, scorePeggingPlay, RANK_VALUES, normalizeCard } = require('./scoring.js');

const PRACTICE_DEALS_FILE = '/assets/club/practice-deals.json';
let practiceDealsCache = null;

function loadPracticeDeals() {
  if (!practiceDealsCache) {
    if (fs.existsSync(PRACTICE_DEALS_FILE)) {
      practiceDealsCache = JSON.parse(fs.readFileSync(PRACTICE_DEALS_FILE, 'utf8'));
    } else {
      practiceDealsCache = {};
    }
  }
  return practiceDealsCache;
}

function createStandardDeck() {
  const suits = ['S', 'H', 'D', 'C'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
  const deck = [];
  for (const s of suits) {
    for (const r of ranks) {
      deck.push(r + s);
    }
  }
  return deck;
}

function shuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cardValue(card) {
  const norm = normalizeCard(card);
  if (!norm) return 0;
  return RANK_VALUES[norm[0]] || 0;
}

/**
 * Initialize a new game.
 */
function createNewGame({
  id,
  playerA,
  playerB,
  practiceMode = null,
  startScoreA = 0,
  startScoreB = 0
}) {
  const deals = loadPracticeDeals();
  const scoreA = Math.max(0, Math.min(120, parseInt(startScoreA, 10) || 0));
  const scoreB = Math.max(0, Math.min(120, parseInt(startScoreB, 10) || 0));

  let handA = [];
  let handB = [];
  let cutCard = null;
  let deck = [];
  let practiceRoundIndex = 0;

  if (practiceMode && deals[practiceMode]) {
    const deal = deals[practiceMode];
    if (practiceMode === 'club_series') {
      practiceRoundIndex = 0;
      const firstRoundKey = deal.rounds[0];
      const firstDeal = deals[firstRoundKey] || deal;
      handA = [...firstDeal.a];
      handB = [...firstDeal.b];
      cutCard = firstDeal.cut;
    } else {
      handA = [...deal.a];
      handB = [...deal.b];
      cutCard = deal.cut;
    }
  } else {
    deck = shuffle(createStandardDeck());
    handA = deck.slice(0, 6);
    handB = deck.slice(6, 12);
    cutCard = deck[12]; // Pre-select cut card from remaining deck
    deck = deck.slice(13);
  }

  const state = {
    hands: {
      a: handA,
      b: handB,
      a_initial: [...handA],
      b_initial: [...handB]
    },
    discards: {
      a: null,
      b: null
    },
    crib: [],
    cut: cutCard,
    cut_revealed: false,
    pegging: {
      turn: 'B', // Non-dealer leads first (Seat A is dealer for hand 1)
      current_count: 0,
      current_play_pile: [],
      played_cards_history: [],
      played_cards_a: [],
      played_cards_b: [],
      go_player: null,
      last_laid_by: null
    },
    show: null,
    events: [
      { type: 'deal', text: `Hand 1 dealt. Marion/Seat A deals. Both players discard 2 cards.` }
    ]
  };

  return {
    id,
    player_a: playerA,
    player_b: playerB,
    score_a: scoreA,
    score_b: scoreB,
    hand_number: 1,
    dealer: 'A',
    stage: 'discard',
    practice_mode: practiceMode || null,
    practice_round_index: practiceRoundIndex,
    state_json: JSON.stringify(state),
    revision: 0,
    winner: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Handle Discard action.
 */
function handleDiscard(game, player, cards) {
  if (game.stage !== 'discard') {
    throw new Error(`Cannot discard in stage '${game.stage}'`);
  }
  if (player !== 'A' && player !== 'B') {
    throw new Error('Invalid seat player');
  }
  if (!Array.isArray(cards) || cards.length !== 2) {
    throw new Error('Must discard exactly 2 cards');
  }

  const normCards = cards.map(normalizeCard);
  if (normCards.some(c => !c)) {
    throw new Error('Invalid card in discard');
  }

  const state = JSON.parse(game.state_json);
  const seatKey = player.toLowerCase();

  if (state.discards[seatKey] !== null) {
    throw new Error(`Player ${player} has already discarded`);
  }

  const currentHand = state.hands[seatKey];
  for (const c of normCards) {
    if (!currentHand.includes(c)) {
      throw new Error(`Card ${c} is not in Player ${player}'s hand`);
    }
  }

  // Remove discarded cards from hand
  state.hands[seatKey] = currentHand.filter(c => !normCards.includes(c));
  state.discards[seatKey] = normCards;
  state.crib.push(...normCards);

  state.events.push({
    type: 'discard',
    text: `Seat ${player} discarded 2 cards to the crib.`
  });

  // Check if both players have discarded
  if (state.discards.a !== null && state.discards.b !== null) {
    // Reveal cut card
    state.cut_revealed = true;
    const cut = state.cut;

    state.events.push({
      type: 'cut',
      text: `Cut card turned: ${cut}.`
    });

    // Check His Heels (Jack cut)
    if (cut && cut[0] === 'J') {
      const dealer = game.dealer; // 'A' or 'B'
      const dealerScoreKey = `score_${dealer.toLowerCase()}`;
      game[dealerScoreKey] = Math.min(121, game[dealerScoreKey] + 2);

      state.events.push({
        type: 'heels',
        text: `His Heels! Dealer (Seat ${dealer}) scores 2 points for turning a Jack.`
      });

      if (game[dealerScoreKey] >= 121) {
        game.stage = 'finished';
        game.winner = dealer;
        state.events.push({
          type: 'win',
          text: `Seat ${dealer} reaches 121 points and wins the game!`
        });
        game.state_json = JSON.stringify(state);
        game.updated_at = new Date().toISOString();
        return game;
      }
    }

    // Move to pegging
    game.stage = 'pegging';
    const nonDealer = game.dealer === 'A' ? 'B' : 'A';
    state.pegging = {
      turn: nonDealer,
      current_count: 0,
      current_play_pile: [],
      played_cards_history: [],
      played_cards_a: [],
      played_cards_b: [],
      go_player: null,
      last_laid_by: null
    };

    state.events.push({
      type: 'pegging_start',
      text: `Play begins. Non-dealer (Seat ${nonDealer}) leads.`
    });
  }

  game.state_json = JSON.stringify(state);
  game.updated_at = new Date().toISOString();
  return game;
}

/**
 * Handle Play Card in Pegging.
 */
function handlePlayCard(game, player, card) {
  if (game.stage !== 'pegging') {
    throw new Error(`Cannot play card in stage '${game.stage}'`);
  }
  if (player !== 'A' && player !== 'B') {
    throw new Error('Invalid seat player');
  }

  const state = JSON.parse(game.state_json);
  const peg = state.pegging;

  if (peg.turn !== player) {
    throw new Error(`It is not Player ${player}'s turn`);
  }

  const normCard = normalizeCard(card);
  if (!normCard) {
    throw new Error('Invalid card');
  }

  const seatKey = player.toLowerCase();
  const playerHand = state.hands[seatKey];
  const playedCards = peg[`played_cards_${seatKey}`];

  if (!playerHand.includes(normCard)) {
    throw new Error(`Card ${normCard} is not in Player ${player}'s hand`);
  }
  if (playedCards.includes(normCard)) {
    throw new Error(`Card ${normCard} has already been played`);
  }

  const cVal = cardValue(normCard);
  if (peg.current_count + cVal > 31) {
    throw new Error(`Card ${normCard} (${cVal}) exceeds 31 (current count: ${peg.current_count})`);
  }

  // Play the card
  peg[`played_cards_${seatKey}`].push(normCard);
  peg.current_play_pile.push({ card: normCard, player });
  peg.last_laid_by = player;
  peg.go_player = null; // reset go status

  // Score the card play
  const pileCardCodes = peg.current_play_pile.map(x => x.card);
  const playScore = scorePeggingPlay(pileCardCodes);
  peg.current_count = playScore.count;

  // Award points
  if (playScore.points > 0) {
    const scoreKey = `score_${seatKey}`;
    game[scoreKey] = Math.min(121, game[scoreKey] + playScore.points);

    const reasonsText = playScore.reasons.map(r => r.description).join(', ');
    state.events.push({
      type: 'pegging_score',
      text: `Seat ${player} played ${normCard} for count ${playScore.count}: ${reasonsText} (+${playScore.points} pts).`
    });

    if (game[scoreKey] >= 121) {
      game.stage = 'finished';
      game.winner = player;
      state.events.push({
        type: 'win',
        text: `Seat ${player} reaches 121 points and wins the game!`
      });
      game.state_json = JSON.stringify(state);
      game.updated_at = new Date().toISOString();
      return game;
    }
  } else {
    state.events.push({
      type: 'pegging_play',
      text: `Seat ${player} played ${normCard} (count: ${playScore.count}).`
    });
  }

  peg.played_cards_history.push({
    card: normCard,
    player,
    count_after: playScore.count,
    points: playScore.points,
    reasons: playScore.reasons,
    is_thirtyone: playScore.isThirtyOne
  });

  // Check if all 8 cards are played
  const totalPlayed = peg.played_cards_a.length + peg.played_cards_b.length;
  if (totalPlayed === 8) {
    // All cards played!
    if (!playScore.isThirtyOne) {
      // 1 point for the last card (go / last card)
      const scoreKey = `score_${seatKey}`;
      game[scoreKey] = Math.min(121, game[scoreKey] + 1);
      state.events.push({
        type: 'last_card',
        text: `Seat ${player} takes 1 point for the last card (+1 pt).`
      });

      if (game[scoreKey] >= 121) {
        game.stage = 'finished';
        game.winner = player;
        state.events.push({
          type: 'win',
          text: `Seat ${player} reaches 121 points and wins the game!`
        });
        game.state_json = JSON.stringify(state);
        game.updated_at = new Date().toISOString();
        return game;
      }
    }

    // Advance to show phase
    performShowPhase(game, state);
    game.state_json = JSON.stringify(state);
    game.updated_at = new Date().toISOString();
    return game;
  }

  // If 31 reached exactly
  if (playScore.isThirtyOne) {
    // Reset count cycle
    peg.current_count = 0;
    peg.current_play_pile = [];
    peg.last_laid_by = null;

    // The OTHER player leads next count
    const opp = player === 'A' ? 'B' : 'A';
    const oppPlayed = peg[`played_cards_${opp.toLowerCase()}`].length;
    if (oppPlayed < 4) {
      peg.turn = opp;
      state.events.push({
        type: 'count_reset',
        text: `Count reached 31 and resets to 0. Seat ${opp} leads.`
      });
    } else {
      peg.turn = player;
      state.events.push({
        type: 'count_reset',
        text: `Count reached 31 and resets to 0. Seat ${opp} has no cards; Seat ${player} leads.`
      });
    }

    game.state_json = JSON.stringify(state);
    game.updated_at = new Date().toISOString();
    return game;
  }

  // Count < 31: check who can play next
  advancePeggingTurn(game, state, player);

  game.state_json = JSON.stringify(state);
  game.updated_at = new Date().toISOString();
  return game;
}

/**
 * Handle Go / Pass action or auto-advance turn.
 */
function advancePeggingTurn(game, state, playerWhoJustPlayed) {
  const peg = state.pegging;
  const opp = playerWhoJustPlayed === 'A' ? 'B' : 'A';
  const oppKey = opp.toLowerCase();
  const playerKey = playerWhoJustPlayed.toLowerCase();

  const oppRemaining = state.hands[oppKey].filter(c => !peg[`played_cards_${oppKey}`].includes(c));
  const oppLegal = oppRemaining.filter(c => peg.current_count + cardValue(c) <= 31);

  if (oppLegal.length > 0) {
    // Opponent can play
    peg.turn = opp;
    return;
  }

  // Opponent cannot play
  const playerRemaining = state.hands[playerKey].filter(c => !peg[`played_cards_${playerKey}`].includes(c));
  const playerLegal = playerRemaining.filter(c => peg.current_count + cardValue(c) <= 31);

  if (playerLegal.length > 0) {
    // Player continues
    peg.turn = playerWhoJustPlayed;
    peg.go_player = opp;
    state.events.push({
      type: 'go_pass',
      text: `Seat ${opp} cannot play (Go). Seat ${playerWhoJustPlayed} continues.`
    });
    return;
  }

  // Neither player can play without exceeding 31:
  // Last player to lay a card takes 1 point for the Go
  const scoreKey = `score_${playerKey}`;
  game[scoreKey] = Math.min(121, game[scoreKey] + 1);
  state.events.push({
    type: 'go_point',
    text: `Neither player can lay a card. Seat ${playerWhoJustPlayed} takes 1 point for the Go (+1 pt).`
  });

  if (game[scoreKey] >= 121) {
    game.stage = 'finished';
    game.winner = playerWhoJustPlayed;
    state.events.push({
      type: 'win',
      text: `Seat ${playerWhoJustPlayed} reaches 121 points and wins the game!`
    });
    return;
  }

  // Reset count cycle
  peg.current_count = 0;
  peg.current_play_pile = [];
  peg.last_laid_by = null;
  peg.go_player = null;

  // The OTHER player (opp) leads the new count if they have remaining cards
  if (oppRemaining.length > 0) {
    peg.turn = opp;
    state.events.push({
      type: 'count_reset',
      text: `Count resets to 0. Seat ${opp} leads.`
    });
  } else if (playerRemaining.length > 0) {
    peg.turn = playerWhoJustPlayed;
    state.events.push({
      type: 'count_reset',
      text: `Count resets to 0. Seat ${opp} has no cards; Seat ${playerWhoJustPlayed} leads.`
    });
  }
}

/**
 * Handle explicit Go action if client calls it when player has no legal moves.
 */
function handleGo(game, player) {
  if (game.stage !== 'pegging') {
    throw new Error(`Cannot say Go in stage '${game.stage}'`);
  }
  const state = JSON.parse(game.state_json);
  const peg = state.pegging;

  if (peg.turn !== player) {
    throw new Error(`It is not Player ${player}'s turn`);
  }

  const seatKey = player.toLowerCase();
  const playerRemaining = state.hands[seatKey].filter(c => !peg[`played_cards_${seatKey}`].includes(c));
  const playerLegal = playerRemaining.filter(c => peg.current_count + cardValue(c) <= 31);

  if (playerLegal.length > 0) {
    throw new Error(`Cannot claim Go when you have legal cards to play (${playerLegal.join(', ')})`);
  }

  const opp = player === 'A' ? 'B' : 'A';
  const oppKey = opp.toLowerCase();
  const oppRemaining = state.hands[oppKey].filter(c => !peg[`played_cards_${oppKey}`].includes(c));
  const oppLegal = oppRemaining.filter(c => peg.current_count + cardValue(c) <= 31);

  if (oppLegal.length > 0) {
    // Opponent can play
    peg.turn = opp;
    peg.go_player = player;
    state.events.push({
      type: 'go_pass',
      text: `Seat ${player} called Go. Seat ${opp}'s turn.`
    });
  } else {
    // Opponent also cannot play: last player who laid gets 1 go point
    const lastPlayer = peg.last_laid_by || opp;
    const lastKey = lastPlayer.toLowerCase();
    const scoreKey = `score_${lastKey}`;
    game[scoreKey] = Math.min(121, game[scoreKey] + 1);

    state.events.push({
      type: 'go_point',
      text: `Neither player can play. Seat ${lastPlayer} takes 1 point for the Go (+1 pt).`
    });

    if (game[scoreKey] >= 121) {
      game.stage = 'finished';
      game.winner = lastPlayer;
      state.events.push({
        type: 'win',
        text: `Seat ${lastPlayer} reaches 121 points and wins the game!`
      });
      game.state_json = JSON.stringify(state);
      game.updated_at = new Date().toISOString();
      return game;
    }

    // Reset count
    peg.current_count = 0;
    peg.current_play_pile = [];
    peg.last_laid_by = null;
    peg.go_player = null;

    // The other player leads (the one who did NOT lay the last card)
    const nextLead = lastPlayer === 'A' ? 'B' : 'A';
    const nextLeadRemaining = state.hands[nextLead.toLowerCase()].filter(c => !peg[`played_cards_${nextLead.toLowerCase()}`].includes(c));
    const lastRemaining = state.hands[lastKey].filter(c => !peg[`played_cards_${lastKey}`].includes(c));

    if (nextLeadRemaining.length > 0) {
      peg.turn = nextLead;
      state.events.push({
        type: 'count_reset',
        text: `Count resets to 0. Seat ${nextLead} leads.`
      });
    } else if (lastRemaining.length > 0) {
      peg.turn = lastPlayer;
      state.events.push({
        type: 'count_reset',
        text: `Count resets to 0. Seat ${nextLead} has no cards; Seat ${lastPlayer} leads.`
      });
    }
  }

  game.state_json = JSON.stringify(state);
  game.updated_at = new Date().toISOString();
  return game;
}

/**
 * Execute the Show Phase in exact order:
 * 1. Non-dealer hand
 * 2. Dealer hand
 * 3. Dealer crib
 */
function performShowPhase(game, state) {
  game.stage = 'show';
  const dealer = game.dealer; // 'A' or 'B'
  const nonDealer = dealer === 'A' ? 'B' : 'A';
  const cut = state.cut;

  const nonDealerHand = state.hands[nonDealer.toLowerCase()];
  const dealerHand = state.hands[dealer.toLowerCase()];
  const cribCards = state.crib;

  // 1. Score Non-Dealer
  const nonDealerResult = scoreHand(nonDealerHand, cut, false);
  const ndScoreKey = `score_${nonDealer.toLowerCase()}`;
  game[ndScoreKey] = Math.min(121, game[ndScoreKey] + nonDealerResult.total);

  state.events.push({
    type: 'show_hand',
    text: `Show: Non-dealer (Seat ${nonDealer}) counts ${nonDealerResult.total} points.`
  });

  const showData = {
    cut,
    non_dealer: {
      player: nonDealer,
      hand: nonDealerHand,
      result: nonDealerResult,
      points_awarded: nonDealerResult.total,
      score_after: game[ndScoreKey]
    },
    dealer: null,
    crib: null
  };

  if (game[ndScoreKey] >= 121) {
    game.stage = 'finished';
    game.winner = nonDealer;
    state.events.push({
      type: 'win',
      text: `Seat ${nonDealer} reaches 121 points and wins the game!`
    });
    state.show = showData;
    return;
  }

  // 2. Score Dealer
  const dealerResult = scoreHand(dealerHand, cut, false);
  const dScoreKey = `score_${dealer.toLowerCase()}`;
  game[dScoreKey] = Math.min(121, game[dScoreKey] + dealerResult.total);

  state.events.push({
    type: 'show_hand',
    text: `Show: Dealer (Seat ${dealer}) counts ${dealerResult.total} points.`
  });

  showData.dealer = {
    player: dealer,
    hand: dealerHand,
    result: dealerResult,
    points_awarded: dealerResult.total,
    score_after: game[dScoreKey]
  };

  if (game[dScoreKey] >= 121) {
    game.stage = 'finished';
    game.winner = dealer;
    state.events.push({
      type: 'win',
      text: `Seat ${dealer} reaches 121 points and wins the game!`
    });
    state.show = showData;
    return;
  }

  // 3. Score Crib
  const cribResult = scoreHand(cribCards, cut, true);
  game[dScoreKey] = Math.min(121, game[dScoreKey] + cribResult.total);

  state.events.push({
    type: 'show_crib',
    text: `Show: Dealer's crib (Seat ${dealer}) counts ${cribResult.total} points.`
  });

  showData.crib = {
    player: dealer,
    hand: cribCards,
    result: cribResult,
    points_awarded: cribResult.total,
    score_after: game[dScoreKey]
  };

  if (game[dScoreKey] >= 121) {
    game.stage = 'finished';
    game.winner = dealer;
    state.events.push({
      type: 'win',
      text: `Seat ${dealer} reaches 121 points and wins the game!`
    });
  }

  state.show = showData;
}

/**
 * Handle Next Hand action.
 */
function handleNextHand(game) {
  if (game.stage !== 'show') {
    throw new Error(`Cannot start next hand in stage '${game.stage}'`);
  }
  if (game.winner !== null || game.stage === 'finished') {
    throw new Error('Game is finished');
  }

  const deals = loadPracticeDeals();
  const nextDealer = game.dealer === 'A' ? 'B' : 'A';
  const nextHandNumber = game.hand_number + 1;

  let handA = [];
  let handB = [];
  let cutCard = null;
  let nextRoundIndex = game.practice_round_index;

  if (game.practice_mode === 'club_series') {
    const seriesDeal = deals['club_series'];
    const rounds = seriesDeal.rounds;
    nextRoundIndex = (game.practice_round_index + 1) % rounds.length;
    const roundKey = rounds[nextRoundIndex];
    const roundDeal = deals[roundKey];

    // "For each new hand, use that round's a cards for the current dealer and b cards for the other player, with its listed cut. Seat A deals hand one; seats and member identities stay fixed while the dealer alternates. Keep the first four and discard the last two for the exercise."
    if (nextDealer === 'A') {
      handA = [...roundDeal.a];
      handB = [...roundDeal.b];
    } else {
      handB = [...roundDeal.a]; // dealer gets round's 'a' cards
      handA = [...roundDeal.b]; // non-dealer gets round's 'b' cards
    }
    cutCard = roundDeal.cut;
  } else {
    // Normal game or other practice deal
    const deck = shuffle(createStandardDeck());
    handA = deck.slice(0, 6);
    handB = deck.slice(6, 12);
    cutCard = deck[12];
  }

  const state = {
    hands: {
      a: handA,
      b: handB,
      a_initial: [...handA],
      b_initial: [...handB]
    },
    discards: {
      a: null,
      b: null
    },
    crib: [],
    cut: cutCard,
    cut_revealed: false,
    pegging: {
      turn: nextDealer === 'A' ? 'B' : 'A',
      current_count: 0,
      current_play_pile: [],
      played_cards_history: [],
      played_cards_a: [],
      played_cards_b: [],
      go_player: null,
      last_laid_by: null
    },
    show: null,
    events: [
      { type: 'deal', text: `Hand ${nextHandNumber} dealt. Seat ${nextDealer} deals. Both players discard 2 cards.` }
    ]
  };

  game.dealer = nextDealer;
  game.hand_number = nextHandNumber;
  game.stage = 'discard';
  game.practice_round_index = nextRoundIndex;
  game.state_json = JSON.stringify(state);
  game.updated_at = new Date().toISOString();

  return game;
}

/**
 * Filter game state for seat privacy.
 */
function sanitizeGameForSeat(game, seat = null) {
  const parsedState = JSON.parse(game.state_json);
  const activeSeat = (seat || 'A').toUpperCase();
  const otherSeat = activeSeat === 'A' ? 'B' : 'A';

  const seatKey = activeSeat.toLowerCase();
  const otherKey = otherSeat.toLowerCase();

  const isFinished = game.stage === 'finished' || game.winner !== null;
  const isShow = game.stage === 'show';
  const revealAll = isFinished || isShow;

  const publicHands = {
    [seatKey]: parsedState.hands[seatKey]
  };

  if (revealAll) {
    publicHands[otherKey] = parsedState.hands[otherKey];
  } else {
    // In discard or pegging: other hand cards stay face down / hidden
    const unplayedCount = parsedState.hands[otherKey].length - (parsedState.pegging ? parsedState.pegging[`played_cards_${otherKey}`].length : 0);
    publicHands[otherKey] = Array(Math.max(0, unplayedCount)).fill('??');
  }

  const publicDiscards = {
    [seatKey]: parsedState.discards[seatKey],
    [otherKey]: revealAll ? parsedState.discards[otherKey] : (parsedState.discards[otherKey] !== null ? ['??', '??'] : null),
    discards_done: {
      a: parsedState.discards.a !== null,
      b: parsedState.discards.b !== null
    }
  };

  const publicCrib = revealAll
    ? parsedState.crib
    : Array(parsedState.crib.length).fill('??');

  const publicCut = parsedState.cut_revealed ? parsedState.cut : null;

  return {
    id: game.id,
    player_a: game.player_a,
    player_b: game.player_b,
    score_a: game.score_a,
    score_b: game.score_b,
    hand_number: game.hand_number,
    dealer: game.dealer,
    stage: game.stage,
    practice_mode: game.practice_mode,
    practice_round_index: game.practice_round_index,
    revision: game.revision,
    winner: game.winner,
    created_at: game.created_at,
    updated_at: game.updated_at,
    active_seat: activeSeat,
    state: {
      hands: publicHands,
      discards: publicDiscards,
      crib: publicCrib,
      cut: publicCut,
      cut_revealed: parsedState.cut_revealed,
      pegging: parsedState.pegging,
      show: parsedState.show,
      events: parsedState.events
    }
  };
}

module.exports = {
  loadPracticeDeals,
  createNewGame,
  handleDiscard,
  handlePlayCard,
  handleGo,
  handleNextHand,
  sanitizeGameForSeat,
  performShowPhase
};

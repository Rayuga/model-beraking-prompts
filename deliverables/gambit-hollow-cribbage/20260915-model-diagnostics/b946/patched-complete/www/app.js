const state = {
  bootstrap: null,
  currentSeat: localStorage.getItem('gambit-seat') === 'B' ? 'B' : 'A',
  currentGameId: localStorage.getItem('gambit-gameId') || '',
  selectedCards: new Set(),
  pendingAction: loadPendingAction(),
  loading: false,
};

const el = {
  connectionStatus: document.getElementById('connectionStatus'),
  seatButtons: [...document.querySelectorAll('.seat-button')],
  memberA: document.getElementById('memberA'),
  memberB: document.getElementById('memberB'),
  gameKind: document.getElementById('gameKind'),
  practiceKey: document.getElementById('practiceKey'),
  startScoreA: document.getElementById('startScoreA'),
  startScoreB: document.getElementById('startScoreB'),
  newGameForm: document.getElementById('newGameForm'),
  createGameButton: document.getElementById('createGameButton'),
  pendingSave: document.getElementById('pendingSave'),
  gamesList: document.getElementById('gamesList'),
  currentGameLabel: document.getElementById('currentGameLabel'),
  handNo: document.getElementById('handNo'),
  phaseLabel: document.getElementById('phaseLabel'),
  dealerLabel: document.getElementById('dealerLabel'),
  turnLabel: document.getElementById('turnLabel'),
  countLabel: document.getElementById('countLabel'),
  cutLabel: document.getElementById('cutLabel'),
  announcer: document.getElementById('announcer'),
  nameA: document.getElementById('nameA'),
  nameB: document.getElementById('nameB'),
  metaA: document.getElementById('metaA'),
  metaB: document.getElementById('metaB'),
  scoreA: document.getElementById('scoreA'),
  scoreB: document.getElementById('scoreB'),
  pegBoard: document.getElementById('pegBoard'),
  handArea: document.getElementById('handArea'),
  tableArea: document.getElementById('tableArea'),
  cardsHelp: document.getElementById('cardsHelp'),
  discardButton: document.getElementById('discardButton'),
  playButton: document.getElementById('playButton'),
  goButton: document.getElementById('goButton'),
  showButton: document.getElementById('showButton'),
  nextHandButton: document.getElementById('nextHandButton'),
  refreshButton: document.getElementById('refreshButton'),
  handExample: document.getElementById('handExample'),
  loadHandExample: document.getElementById('loadHandExample'),
  handBenchForm: document.getElementById('handBenchForm'),
  handBenchResult: document.getElementById('handBenchResult'),
  handCard1: document.getElementById('handCard1'),
  handCard2: document.getElementById('handCard2'),
  handCard3: document.getElementById('handCard3'),
  handCard4: document.getElementById('handCard4'),
  handCut: document.getElementById('handCut'),
  handCrib: document.getElementById('handCrib'),
  pegExample: document.getElementById('pegExample'),
  loadPegExample: document.getElementById('loadPegExample'),
  peggingBenchForm: document.getElementById('peggingBenchForm'),
  pegBenchResult: document.getElementById('pegBenchResult'),
  pegCount: document.getElementById('pegCount'),
  pegPile: document.getElementById('pegPile'),
  pegNext: document.getElementById('pegNext'),
  ladderTable: document.getElementById('ladderTable'),
  historyList: document.getElementById('historyList'),
};

const PEG_EXAMPLES = [
  {
    name: 'Pair and run',
    count: 13,
    pile: ['7H', '8D'],
    next: '9S',
  },
  {
    name: 'Pair royal',
    count: 10,
    pile: ['5S', '5H'],
    next: '5D',
  },
  {
    name: 'Thirty-one',
    count: 28,
    pile: ['5S', '6H', '9D', 'AC', '8C'],
    next: 'KD',
  },
  {
    name: 'Fifteen and run',
    count: 8,
    pile: ['2S', '3H', '4D'],
    next: '6C',
  },
];

const pendingButton = document.createElement('button');
pendingButton.type = 'button';
pendingButton.textContent = 'Retry pending save';
pendingButton.addEventListener('click', retryPendingAction);

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cardRank(code) {
  return code[0].toUpperCase();
}

function cardSuit(code) {
  return code[1].toUpperCase();
}

function suitSymbol(code) {
  return { S: '♠', H: '♥', D: '♦', C: '♣' }[cardSuit(code)] || '?';
}

function isRed(code) {
  return ['H', 'D'].includes(cardSuit(code));
}

function cardValue(code) {
  const rank = cardRank(code);
  if (rank === 'A') return 1;
  if ('TJQK'.includes(rank)) return 10;
  return Number(rank);
}

function deckLabel(code) {
  return `${cardRank(code)}${suitSymbol(code)}`;
}

function uniqueId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function savePendingAction(action) {
  state.pendingAction = action;
  localStorage.setItem('gambit.pendingAction', JSON.stringify(action));
  renderPending();
}

function clearPendingAction() {
  state.pendingAction = null;
  localStorage.removeItem('gambit.pendingAction');
  renderPending();
}

function loadPendingAction() {
  try {
    const raw = localStorage.getItem('gambit.pendingAction');
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem('gambit.pendingAction');
    return null;
  }
}

function setStatus(text, tone = 'normal') {
  el.connectionStatus.textContent = text;
  el.connectionStatus.dataset.tone = tone;
}

function announce(text) {
  el.announcer.textContent = text;
  el.announcer.focus({ preventScroll: true });
}

function setBusy(busy) {
  state.loading = busy;
  el.createGameButton.disabled = busy;
  el.refreshButton.disabled = busy;
  el.discardButton.disabled = busy;
  el.playButton.disabled = busy;
  el.goButton.disabled = busy;
  el.showButton.disabled = busy;
  el.nextHandButton.disabled = busy;
}

function currentMemberMap() {
  const map = new Map();
  (state.bootstrap?.members || []).forEach((member) => map.set(member.no, member));
  return map;
}

function currentGame() {
  return state.bootstrap?.selectedGame || null;
}

function currentHand() {
  const game = currentGame();
  if (!game) return [];
  return (game.hands?.[state.currentSeat] || []).filter(Boolean);
}

function currentOppositeSeat() {
  return state.currentSeat === 'A' ? 'B' : 'A';
}

function seatName(seat) {
  return seat === 'A' ? 'Seat A' : 'Seat B';
}

function memberLabel(member, seat) {
  if (!member) return seatName(seat);
  return `${member.name} (${member.no})`;
}

function renderCardSvg(code, { faceDown = false, selected = false, width = 84, height = 116 } = {}) {
  const border = faceDown ? '#6783a1' : '#d7ddea';
  const fill = faceDown ? '#1f3248' : '#f8f9fc';
  const suitColor = isRed(code) ? '#c8354f' : '#1d2430';
  const rank = esc(cardRank(code));
  const suit = esc(suitSymbol(code));
  const extra = faceDown
    ? `<rect x="10" y="10" width="64" height="96" rx="8" fill="none" stroke="#89a3c1" stroke-width="2" stroke-dasharray="8 7" opacity="0.7"></rect>
       <circle cx="42" cy="58" r="16" fill="#89a3c1" opacity="0.45"></circle>
       <text x="42" y="64" text-anchor="middle" font-size="22" fill="#dce7f5" font-weight="700">♣</text>`
    : `<text x="14" y="24" font-size="20" fill="${suitColor}" font-weight="700">${rank}</text>
       <text x="14" y="42" font-size="18" fill="${suitColor}">${suit}</text>
       <text x="70" y="100" font-size="20" text-anchor="end" transform="rotate(180 42 58)" fill="${suitColor}" font-weight="700">${rank}</text>
       <text x="70" y="82" font-size="18" text-anchor="end" transform="rotate(180 42 58)" fill="${suitColor}">${suit}</text>
       <text x="42" y="69" text-anchor="middle" font-size="28" fill="${suitColor}" opacity="0.95">${suit}</text>`;
  return `
    <svg viewBox="0 0 84 116" width="${width}" height="${height}" aria-hidden="true">
      <rect x="2" y="2" width="80" height="112" rx="12" fill="${fill}" stroke="${border}" stroke-width="2"></rect>
      ${extra}
      ${selected ? '<rect x="2" y="2" width="80" height="112" rx="12" fill="none" stroke="#84c4ff" stroke-width="3"></rect>' : ''}
    </svg>`;
}

function renderCardButton(code, options = {}) {
  const { faceDown = false, selected = false, disabled = false, title = '', width = 84, height = 116 } = options;
  const label = faceDown ? 'Face down card' : `${deckLabel(code)} card`;
  return `
    <button type="button" class="card-button ${selected ? 'selected-card' : ''}" data-card="${esc(code)}" aria-label="${esc(title || label)}" ${disabled ? 'disabled' : ''}>
      ${renderCardSvg(code, { faceDown, selected, width, height })}
    </button>`;
}

function renderCardRow(cards, { faceDown = false, selectedSet = new Set(), interactive = false, label = '' } = {}) {
  if (!cards.length) return `<div class="small-note">${esc(label || 'No cards to show yet.')}</div>`;
  return cards.map((code) => {
    if (faceDown) return `<div class="card-display card-back">${renderCardSvg(code, { faceDown: true, width: 56, height: 78 })}</div>`;
    return renderCardButton(code, { selected: selectedSet.has(code), disabled: !interactive, title: `${deckLabel(code)} ${label}` , width: 56, height: 78 });
  }).join('');
}

function renderPegBoard(game) {
  if (!game) return '<div class="small-note">No pegs yet.</div>';
  const pegs = game.pegs || {
    A: { lead: game.scores?.A || 0, trail: game.scores?.A || 0 },
    B: { lead: game.scores?.B || 0, trail: game.scores?.B || 0 },
  };
  const xFor = (score) => 60 + (Math.max(0, Math.min(121, Number(score) || 0)) / 121) * 880;
  const ticks = [];
  for (let i = 0; i <= 120; i += 10) {
    const x = xFor(i);
    ticks.push(`<line x1="${x}" y1="18" x2="${x}" y2="156" stroke="rgba(255,255,255,0.15)" stroke-width="1"></line>`);
    ticks.push(`<text x="${x}" y="172" text-anchor="middle" fill="#9fb0c7" font-size="12">${i}</text>`);
  }
  const rows = [
    { seat: 'A', y: 54, color: '#7de6b6', label: game.memberA?.name || 'Seat A' },
    { seat: 'B', y: 108, color: '#84c4ff', label: game.memberB?.name || 'Seat B' },
  ].map(({ seat, y, color, label }) => {
    const trail = pegs[seat]?.trail ?? game.scores?.[seat] ?? 0;
    const lead = pegs[seat]?.lead ?? game.scores?.[seat] ?? 0;
    const trailX = xFor(trail);
    const leadX = xFor(lead);
    const leadOffset = Math.abs(leadX - trailX) < 8 ? 8 : 0;
    const trailOffset = Math.abs(leadX - trailX) < 8 ? -8 : 0;
    return `
      <g>
        <text x="12" y="${y + 4}" fill="#eef4ff" font-size="13" font-weight="700">${esc(label)}</text>
        <line x1="60" y1="${y}" x2="940" y2="${y}" stroke="rgba(255,255,255,0.18)" stroke-width="5" stroke-linecap="round"></line>
        <circle cx="${trailX + trailOffset}" cy="${y}" r="8" fill="rgba(255,255,255,0.45)" stroke="rgba(255,255,255,0.6)" stroke-width="1"></circle>
        <circle cx="${leadX + leadOffset}" cy="${y}" r="10" fill="${color}" stroke="#08111a" stroke-width="2"></circle>
        <text x="${Math.min(960, leadX + 20)}" y="${y + 4}" fill="#eef4ff" font-size="12">${Number(game.scores?.[seat] ?? 0)}</text>
      </g>`;
  }).join('');
  return `
    <div class="peg-track">
      <svg viewBox="0 0 1000 180" width="100%" height="180" aria-label="Peg board">
        ${ticks.join('')}
        ${rows}
      </svg>
    </div>`;
}

function renderBenchResult(container, result, kind) {
  if (!result || result.ok === false) {
    container.innerHTML = `<div class="small-note">No result yet.</div>`;
    return;
  }
  if (kind === 'hand') {
    const breakdown = result.result;
    container.innerHTML = `
      <div class="total">${breakdown.total} points</div>
      <ul>
        <li>Fifteens: ${breakdown.fifteens.points} (${breakdown.fifteens.count} ways)</li>
        <li>Pairs: ${breakdown.pairs.points}</li>
        <li>Runs: ${breakdown.runs.points}</li>
        <li>Flush: ${breakdown.flush.points}</li>
        <li>Nobs: ${breakdown.nobs.points}</li>
      </ul>
      <div class="small-note">${formatHandDetails(breakdown)}</div>`;
    return;
  }
  const breakdown = result.result;
  container.innerHTML = `
    <div class="total">${breakdown.total} points</div>
    <ul>
      <li>Count: ${breakdown.count}</li>
      <li>Reasons: ${breakdown.reasons.length ? breakdown.reasons.join(', ') : 'none'}</li>
    </ul>`;
}

function formatHandDetails(result) {
  const parts = [];
  if (result.fifteens.combos.length) parts.push(`Fifteens: ${result.fifteens.combos.map((combo) => combo.join(' ')).join('; ')}`);
  if (result.pairs.groups.length) parts.push(`Pairs: ${result.pairs.groups.map((group) => `${group.rank}×${group.count}`).join(', ')}`);
  if (result.runs.groups.length) parts.push(`Runs: ${result.runs.groups.map((run) => `${run.ranks.join('-')}×${run.multiplicity}`).join(', ')}`);
  if (result.flush.points) parts.push(`Flush: ${result.flush.suit}`);
  if (result.nobs.points) parts.push(`Nobs: ${result.nobs.card}`);
  return parts.join(' · ') || 'No extra breakdown.';
}

function renderGameList() {
  const games = state.bootstrap?.games || [];
  const currentId = state.currentGameId;
  const playable = games.filter((game) => game.resumable && !game.finished);
  el.gamesList.innerHTML = playable.length
    ? playable.map((game) => `
        <article class="game-card ${game.id === currentId ? 'active' : ''}">
          <div><strong>${esc(game.id)}</strong> · Hand ${game.handNo} · Rev ${game.revision}</div>
          <div class="small-note">${esc(memberLabel(game.memberA, 'A'))} vs ${esc(memberLabel(game.memberB, 'B'))}</div>
          <div class="small-note">Dealer: ${game.dealer === 'A' ? 'Seat A' : 'Seat B'} · Phase: ${esc(game.phase)}</div>
          <div class="small-note">Scores: A ${game.scores.A} · B ${game.scores.B}</div>
          <button type="button" data-game-id="${esc(game.id)}">Open table</button>
        </article>`).join('')
    : '<div class="small-note">No playable games are waiting.</div>';
  el.gamesList.querySelectorAll('button[data-game-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.currentGameId = button.dataset.gameId;
      localStorage.setItem('gambit-gameId', state.currentGameId);
      loadBootstrap();
    });
  });
}

function renderHistoryList() {
  const games = state.bootstrap?.games || [];
  const history = games.filter((game) => game.kind === 'historical' || game.finished);
  el.historyList.innerHTML = history.length
    ? history.map((game) => `
        <article class="history-card">
          <div><strong>${esc(game.id)}</strong> · ${game.kind === 'historical' ? 'Seeded summary' : 'Finished game'}</div>
          <div class="small-note">${esc(memberLabel(game.memberA, 'A'))} vs ${esc(memberLabel(game.memberB, 'B'))}</div>
          <div class="small-note">Scores: A ${game.scores.A} · B ${game.scores.B}</div>
          <div class="small-note">${game.winner ? `${game.winner === 'A' ? 'Seat A' : 'Seat B'} won` : 'Unfinished summary'}</div>
        </article>`).join('')
    : '<div class="small-note">No history yet.</div>';
}

function renderLadder() {
  const members = state.bootstrap?.members || [];
  const rows = members.slice().sort((a, b) => b.played - a.played || b.won - a.won || a.name.localeCompare(b.name));
  el.ladderTable.innerHTML = `
    <div class="ladder-head">
      <div>Name</div>
      <div class="score">Played</div>
      <div class="score">Won</div>
      <div class="score">No.</div>
    </div>
    ${rows.map((member) => `
      <div class="ladder-row">
        <div><strong>${esc(member.name)}</strong></div>
        <div class="score">${member.played}</div>
        <div class="score">${member.won}</div>
        <div class="score">${esc(member.no)}</div>
      </div>`).join('')}
  `;
}

function renderSeatButtons() {
  el.seatButtons.forEach((button) => {
    button.dataset.active = button.dataset.seat === state.currentSeat ? 'true' : 'false';
  });
}

function renderPending() {
  if (!state.pendingAction) {
    el.pendingSave.hidden = true;
    el.pendingSave.innerHTML = '';
    return;
  }
  el.pendingSave.hidden = false;
  el.pendingSave.innerHTML = `
    <div><strong>Pending save:</strong> ${esc(state.pendingAction.label || 'Action')} is waiting for confirmation.</div>
    <div class="small-note">Game ${esc(state.pendingAction.gameId)} · action ${esc(state.pendingAction.actionId)}</div>
  `;
  if (!el.pendingSave.contains(pendingButton)) {
    el.pendingSave.appendChild(document.createElement('br'));
    el.pendingSave.appendChild(pendingButton);
  }
}

function renderGame() {
  const game = currentGame();
  const filteredCards = new Set([...state.selectedCards].filter((card) => game && currentHand().includes(card)));
  state.selectedCards = filteredCards;
  renderSeatButtons();

  if (!game) {
    el.currentGameLabel.textContent = 'No game selected.';
    el.handNo.textContent = '—';
    el.phaseLabel.textContent = '—';
    el.dealerLabel.textContent = '—';
    el.turnLabel.textContent = '—';
    el.countLabel.textContent = '—';
    el.cutLabel.textContent = '—';
    el.nameA.textContent = 'Seat A';
    el.nameB.textContent = 'Seat B';
    el.metaA.textContent = '—';
    el.metaB.textContent = '—';
    el.scoreA.textContent = '0';
    el.scoreB.textContent = '0';
    el.handArea.innerHTML = '<div class="small-note">Choose or create a table.</div>';
    el.tableArea.innerHTML = '<div class="small-note">The board will appear here.</div>';
    el.pegBoard.innerHTML = '<div class="small-note">No pegs yet.</div>';
    announce('No game selected.');
    return;
  }

  el.currentGameLabel.textContent = `${game.id} · ${game.finished ? 'Finished' : 'In play'} · ${game.phase}`;
  el.handNo.textContent = String(game.handNo);
  el.phaseLabel.textContent = game.phase.replace(/-/g, ' ');
  el.dealerLabel.textContent = seatName(game.dealer);
  el.turnLabel.textContent = game.turn ? seatName(game.turn) : (game.phase === 'discard' ? 'Discard' : '—');
  el.countLabel.textContent = String(game.pegging?.count ?? 0);
  el.cutLabel.textContent = game.cut || '—';

  el.nameA.textContent = game.memberA?.name || 'Seat A';
  el.nameB.textContent = game.memberB?.name || 'Seat B';
  el.metaA.textContent = `${game.memberA?.no || 'A'} · played ${game.memberA?.played ?? '—'} · won ${game.memberA?.won ?? '—'}`;
  el.metaB.textContent = `${game.memberB?.no || 'B'} · played ${game.memberB?.played ?? '—'} · won ${game.memberB?.won ?? '—'}`;
  el.scoreA.textContent = String(game.scores?.A ?? 0);
  el.scoreB.textContent = String(game.scores?.B ?? 0);
  el.pegBoard.innerHTML = renderPegBoard(game);

  const myCards = currentHand();
  const blocked = state.loading || Boolean(state.pendingAction);
  const interactiveDiscard = game.phase === 'discard' && !game.finished && !blocked;
  const interactivePlay = game.phase === 'pegging' && game.turn === state.currentSeat && !game.finished && !blocked;
  const interactive = interactiveDiscard || interactivePlay;
  const cardLabelText = game.phase === 'discard'
    ? 'Choose two cards to discard.'
    : game.phase === 'pegging'
      ? (game.turn === state.currentSeat ? 'Choose a card to play, or go if you cannot.' : 'Wait for the other seat to play.')
      : game.phase === 'show'
        ? 'The show is ready.'
        : game.phase === 'show-complete'
          ? 'Show complete; the next hand is ready.'
          : 'The game is finished.';
  el.cardsHelp.textContent = cardLabelText;

  el.handArea.innerHTML = myCards.length
    ? myCards.map((code) => renderCardButton(code, {
        selected: state.selectedCards.has(code),
        disabled: !interactive,
        title: `${deckLabel(code)} ${interactive ? 'selectable' : 'card'}`,
      })).join('')
    : '<div class="small-note">No cards remain in this hand.</div>';

  const otherSeat = currentOppositeSeat();
  const revealHands = [];
  if (game.phase === 'show' || game.phase === 'show-complete' || game.finished) {
    if (game.show?.step >= 1 || game.phase === 'show-complete' || game.finished) {
      revealHands.push(`<div class="small-note"><strong>Non-dealer:</strong> ${formatVisibleHand(game.kept?.[game.nonDealer] || [], false)}</div>`);
    }
    if (game.show?.step >= 2 || game.phase === 'show-complete' || game.finished) {
      revealHands.push(`<div class="small-note"><strong>Dealer:</strong> ${formatVisibleHand(game.kept?.[game.dealer] || [], false)}</div>`);
    }
    if (game.show?.step >= 3 || game.phase === 'show-complete' || game.finished) {
      revealHands.push(`<div class="small-note"><strong>Crib:</strong> ${formatVisibleHand(game.crib || [], false)}</div>`);
    }
  }
  const ownDiscards = formatVisibleHand(game.discards?.[state.currentSeat] || [], false);
  const hiddenOppositeCount = (game.discards?.[otherSeat] || []).length;
  const hiddenOpposite = Array.from({ length: hiddenOppositeCount }, () => renderCardSvg('AS', { faceDown: true, width: 40, height: 56 })).join('');
  const pile = (game.pegging?.pile || []).map((entry) => renderCardSvg(entry.card, { faceDown: false, width: 40, height: 56 })).join('');
  const cut = game.cut ? renderCardSvg(game.cut, { faceDown: false, width: 40, height: 56 }) : '<div class="small-note">Cut card hidden until both seats discard.</div>';
  el.tableArea.innerHTML = `
    <div class="stack">
      <div>
        <strong>Cut</strong>
        <div class="hand-area">${cut}</div>
      </div>
      <div>
        <strong>Your discards</strong>
        <div class="hand-area">${ownDiscards || '<div class="small-note">None yet.</div>'}</div>
      </div>
      <div>
        <strong>Other seat discards</strong>
        <div class="hand-area">${game.phase === 'show' || game.phase === 'show-complete' || game.finished ? formatVisibleHand(game.discards?.[otherSeat] || [], false) : hiddenOpposite || '<div class="small-note">Hidden.</div>'}</div>
      </div>
      <div>
        <strong>Pegging pile</strong>
        <div class="hand-area">${pile || '<div class="small-note">No pegging cards yet.</div>'}</div>
      </div>
      ${revealHands.length ? `<div><strong>Show</strong>${revealHands.join('')}</div>` : ''}
    </div>`;

  el.discardButton.disabled = blocked || !interactiveDiscard || state.selectedCards.size !== 2;
  el.playButton.disabled = blocked || !interactivePlay || state.selectedCards.size !== 1;
  el.goButton.disabled = blocked || !(game.phase === 'pegging' && game.turn === state.currentSeat && (game.legalActions || []).includes('go'));
  el.showButton.disabled = blocked || !(game.phase === 'show' && (game.legalActions || []).includes('show'));
  el.nextHandButton.disabled = blocked || !(game.phase === 'show-complete' || (game.phase === 'show' && game.show?.step >= 3));

  announce(game.message || 'Table refreshed.');
}

function formatVisibleHand(cards, faceDown) {
  if (!cards.length) return '<div class="small-note">None.</div>';
  return cards.map((code) => faceDown ? renderCardSvg(code, { faceDown: true, width: 40, height: 56 }) : renderCardSvg(code, { faceDown: false, width: 40, height: 56 })).join('');
}

function populateSelectors() {
  const members = state.bootstrap?.members || [];
  const existingA = el.memberA.value;
  const existingB = el.memberB.value;
  el.memberA.innerHTML = members.map((member) => `<option value="${esc(member.no)}">${esc(member.name)} (${esc(member.no)})</option>`).join('');
  el.memberB.innerHTML = members.map((member) => `<option value="${esc(member.no)}">${esc(member.name)} (${esc(member.no)})</option>`).join('');
  if (members.length) {
    el.memberA.value = existingA || members[0].no;
    el.memberB.value = existingB || members[1]?.no || members[0].no;
  }

  const practiceDeals = state.bootstrap?.practiceDeals || {};
  const practiceOptions = Object.entries(practiceDeals).map(([key, deal]) => `<option value="${esc(key)}">${esc(deal.name || key)}</option>`);
  el.practiceKey.innerHTML = practiceOptions.join('');
  if (practiceOptions.length && !el.practiceKey.value) el.practiceKey.value = Object.keys(practiceDeals)[0];

  const handOptions = (state.bootstrap?.scoredHands || []).map((example, index) => {
    const label = `${example.total} — ${example.rule}`;
    return `<option value="${index}">${esc(label)}</option>`;
  });
  el.handExample.innerHTML = handOptions.join('');

  const pegOptions = PEG_EXAMPLES.map((example, index) => `<option value="${index}">${esc(example.name)}</option>`);
  el.pegExample.innerHTML = pegOptions.join('');
}

function applyPracticeVisibility() {
  const isPractice = el.gameKind.value === 'practice';
  el.practiceKey.closest('label').style.display = isPractice ? '' : 'none';
  el.startScoreA.closest('label').style.display = isPractice ? '' : 'none';
  el.startScoreB.closest('label').style.display = isPractice ? '' : 'none';
}

async function loadBootstrap() {
  setBusy(true);
  setStatus('Connecting…');
  try {
    const query = new URLSearchParams({ seat: state.currentSeat });
    if (state.currentGameId) query.set('gameId', state.currentGameId);
    const response = await fetch(`/api/bootstrap?${query.toString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load the table.');
    state.bootstrap = data;
    if (!state.currentGameId || !data.games.some((game) => game.id === state.currentGameId)) {
      const firstOpen = data.games.find((game) => game.resumable && !game.finished);
      const firstGame = firstOpen || data.games.find(game => game.resumable) || null;
      state.currentGameId = firstGame ? firstGame.id : '';
      if (state.currentGameId) localStorage.setItem('gambit-gameId', state.currentGameId);
    }
    if (data.selectedGame && data.selectedGame.id !== state.currentGameId) {
      state.currentGameId = data.selectedGame.id;
      localStorage.setItem('gambit-gameId', state.currentGameId);
    }
    if ((!data.selectedGame || data.selectedGame.id !== state.currentGameId) && state.currentGameId) {
      const selectedResponse = await fetch(`/api/games/${state.currentGameId}?seat=${state.currentSeat}`);
      const selectedJson = await selectedResponse.json();
      if (selectedResponse.ok && selectedJson.game) data.selectedGame = selectedJson.game;
    }
    populateSelectors();
    renderLadder();
    renderGameList();
    renderHistoryList();
    renderPending();
    renderGame();
    renderBenchResult(el.handBenchResult, null, 'hand');
    renderBenchResult(el.pegBenchResult, null, 'peg');
    setStatus('Table ready', 'ok');
  } catch (error) {
    setStatus('Offline or unavailable', 'danger');
    announce(error.message);
  } finally {
    setBusy(false);
    renderPending();
    renderGame();
  }
}

async function submitJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return { response, json };
}

async function createGame(event) {
  event.preventDefault();
  if (state.pendingAction) return;
  const body = {
    actionId: uniqueId('create'),
    kind: el.gameKind.value,
    practiceKey: el.practiceKey.value,
    memberA: el.memberA.value,
    memberB: el.memberB.value,
    seat: state.currentSeat,
    startScores: {
      A: Number(el.startScoreA.value || 0),
      B: Number(el.startScoreB.value || 0),
    },
  };
  savePendingAction({
    actionId: body.actionId,
    gameId: '__new__',
    expectedRevision: 0,
    body: { ...body },
    label: 'Create game',
  });
  setBusy(true);
  try {
    const { response, json } = await submitJson('/api/games', body);
    if (!response.ok) throw new Error(json.message || 'Could not create a game.');
    clearPendingAction();
    state.currentGameId = json.gameId;
    localStorage.setItem('gambit-gameId', state.currentGameId);
    await loadBootstrap();
    announce(json.message || 'Game created.');
  } catch (error) {
    announce(error.message);
    setStatus(error.message, 'danger');
  } finally {
    setBusy(false);
  }
}

function prepareGameAction(type, extra = {}, label = '') {
  const game = currentGame();
  if (!game || game.finished) return;
  const action = {
    actionId: uniqueId(type),
    gameId: game.id,
    expectedRevision: game.revision,
    body: {
      actionId: uniqueId(type),
      seat: state.currentSeat,
      expectedRevision: game.revision,
      type,
      ...extra,
    },
    label: label || type,
  };
  action.body.actionId = action.actionId;
  savePendingAction(action);
  return action;
}

async function sendGameAction(type, extra = {}, label = '') {
  const action = prepareGameAction(type, extra, label);
  if (!action) return;
  setBusy(true);
  try {
    const { response, json } = await submitJson(`/api/games/${action.gameId}/actions`, action.body);
    if (!response.ok) {
      clearPendingAction();
      if (response.status === 409) {
        await loadBootstrap();
        throw new Error(json.message || 'The table was stale.');
      }
      throw new Error(json.message || 'Action refused.');
    }
    clearPendingAction();
    state.currentGameId = action.gameId;
    localStorage.setItem('gambit-gameId', action.gameId);
    await loadBootstrap();
    announce(json.message || 'Action applied.');
  } catch (error) {
    if (!state.pendingAction) {
      setStatus(error.message, 'danger');
    } else {
      setStatus('Response lost; pending save kept.', 'danger');
    }
    announce(error.message);
  } finally {
    setBusy(false);
  }
}

async function retryPendingAction() {
  if (!state.pendingAction) return;
  const action = state.pendingAction;
  setBusy(true);
  try {
    const { response, json } = await submitJson(action.gameId === '__new__' ? '/api/games' : `/api/games/${action.gameId}/actions`, action.body);
    if (!response.ok) {
      clearPendingAction();
      throw new Error(json.message || 'Pending action was refused.');
    }
    clearPendingAction();
    if (json.gameId) {
      state.currentGameId = json.gameId;
      localStorage.setItem('gambit-gameId', state.currentGameId);
    }
    await loadBootstrap();
    announce(json.message || 'Pending action confirmed.');
  } catch (error) {
    setStatus(error.message, 'danger');
    announce(error.message);
  } finally {
    setBusy(false);
  }
}

function pickSelectedCards() {
  return [...state.selectedCards];
}

function resetSelection() {
  state.selectedCards = new Set();
  renderGame();
}

function bindGameAreaClicks() {
  el.handArea.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-card]');
    if (!button || button.disabled) return;
    const card = button.dataset.card;
    const game = currentGame();
    if (!game || game.finished) return;
    if (game.phase !== 'discard' && !(game.phase === 'pegging' && game.turn === state.currentSeat)) return;
    if (state.selectedCards.has(card)) {
      state.selectedCards.delete(card);
    } else {
      if (game.phase === 'discard' && state.selectedCards.size >= 2) return;
      if (game.phase === 'pegging') state.selectedCards.clear();
      state.selectedCards.add(card);
    }
    renderGame();
  });
}

function bindBenchExamples() {
  el.loadHandExample.addEventListener('click', () => {
    const example = (state.bootstrap?.scoredHands || [])[Number(el.handExample.value) || 0];
    if (!example) return;
    [el.handCard1.value, el.handCard2.value, el.handCard3.value, el.handCard4.value] = example.hand;
    el.handCut.value = example.cut;
    el.handCrib.checked = Boolean(example.crib);
    el.handBenchResult.innerHTML = '<div class="small-note">Example loaded. Score it to check the table.</div>';
  });

  el.loadPegExample.addEventListener('click', () => {
    const example = PEG_EXAMPLES[Number(el.pegExample.value) || 0];
    if (!example) return;
    el.pegCount.value = example.count;
    el.pegPile.value = example.pile.join(', ');
    el.pegNext.value = example.next;
    el.pegBenchResult.innerHTML = '<div class="small-note">Example loaded. Score it to check the table.</div>';
  });
}

function normalizeCardListInput(values) {
  return values.map((value) => String(value).trim().toUpperCase()).filter(Boolean);
}

async function scoreHandBench(event) {
  event.preventDefault();
  try {
    const body = {
      hand: normalizeCardListInput([el.handCard1.value, el.handCard2.value, el.handCard3.value, el.handCard4.value]),
      cut: String(el.handCut.value).trim().toUpperCase(),
      crib: el.handCrib.checked,
    };
    const { response, json } = await submitJson('/api/scoring/hand', body);
    if (!response.ok) throw new Error(json.message || 'Could not score the hand.');
    renderBenchResult(el.handBenchResult, json, 'hand');
  } catch (error) {
    el.handBenchResult.innerHTML = `<div class="small-note" style="color: var(--danger)">${esc(error.message)}</div>`;
  }
}

async function scorePegBench(event) {
  event.preventDefault();
  try {
    const pile = normalizeCardListInput(el.pegPile.value.split(/[\s,]+/));
    const next = String(el.pegNext.value).trim().toUpperCase();
    if (!next) throw new Error('Enter the next card.');
    const body = {
      pile: pile.map((card) => ({ seat: 'A', card })),
      count: Number(el.pegCount.value || 0) + cardValue(next),
      next,
    };
    body.pile.push({ seat: 'B', card: next });
    const { response, json } = await submitJson('/api/scoring/pegging', body);
    if (!response.ok) throw new Error(json.message || 'Could not score the pegging pile.');
    renderBenchResult(el.pegBenchResult, json, 'peg');
  } catch (error) {
    el.pegBenchResult.innerHTML = `<div class="small-note" style="color: var(--danger)">${esc(error.message)}</div>`;
  }
}

function bindActions() {
  document.querySelectorAll('.seat-button').forEach((button) => {
    button.addEventListener('click', () => {
      state.currentSeat = button.dataset.seat === 'B' ? 'B' : 'A';
      localStorage.setItem('gambit-seat', state.currentSeat);
      loadBootstrap();
    });
  });

  el.newGameForm.addEventListener('submit', createGame);
  el.gameKind.addEventListener('change', applyPracticeVisibility);
  el.discardButton.addEventListener('click', () => {
    const cards = pickSelectedCards();
    if (cards.length !== 2) return;
    sendGameAction('discard', { cards }, `Discard ${cards.join(', ')}`);
    state.selectedCards = new Set();
  });
  el.playButton.addEventListener('click', () => {
    const cards = pickSelectedCards();
    if (cards.length !== 1) return;
    sendGameAction('play', { card: cards[0] }, `Play ${cards[0]}`);
    state.selectedCards = new Set();
  });
  el.goButton.addEventListener('click', () => sendGameAction('go', {}, 'Go'));
  el.showButton.addEventListener('click', () => sendGameAction('show', {}, 'Show next'));
  el.nextHandButton.addEventListener('click', () => sendGameAction('next-hand', {}, 'Next hand'));
  el.refreshButton.addEventListener('click', () => loadBootstrap());
  el.handBenchForm.addEventListener('submit', scoreHandBench);
  el.peggingBenchForm.addEventListener('submit', scorePegBench);
  bindGameAreaClicks();
  bindBenchExamples();

  window.addEventListener('storage', (event) => {
    if (event.key === 'gambit.pendingAction') {
      state.pendingAction = loadPendingAction();
      renderPending();
    }
  });
}

function renderInitialUI() {
  applyPracticeVisibility();
  renderPending();
  renderSeatButtons();
}

(async function init() {
  renderInitialUI();
  bindActions();
  await loadBootstrap();
})();

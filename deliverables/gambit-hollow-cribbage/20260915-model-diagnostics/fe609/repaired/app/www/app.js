(() => {
  const Rules = globalThis.CribbageRules;
  const $ = (id) => document.getElementById(id);
  const state = {
    bootstrap: null,
    currentGame: null,
    selectedGameId: null,
    viewerSeat: localStorage.getItem('gambit-viewer-seat') || 'A',
    pending: JSON.parse(localStorage.getItem('gambit-pending-action') || 'null'),
    discardChoice: [],
    playChoice: null,
  };

  const els = {
    connectionBadge: $('connectionBadge'),
    seatBadge: $('seatBadge'),
    gameBadge: $('gameBadge'),
    status: $('status'),
    seatAButton: $('seatAButton'),
    seatBButton: $('seatBButton'),
    reloadGameButton: $('reloadGameButton'),
    phaseChip: $('phaseChip'),
    dealerChip: $('dealerChip'),
    turnChip: $('turnChip'),
    gameSummary: $('gameSummary'),
    pegBoard: $('pegBoard'),
    gameList: $('gameList'),
    historyList: $('historyList'),
    playerPanels: $('playerPanels'),
    currentHandPanel: $('currentHandPanel'),
    actionPanel: $('actionPanel'),
    commentary: $('commentary'),
    newGameForm: $('newGameForm'),
    seatASelect: $('seatASelect'),
    seatBSelect: $('seatBSelect'),
    modeSelect: $('modeSelect'),
    practiceSelect: $('practiceSelect'),
    viewerSelect: $('viewerSelect'),
    scoreAInput: $('scoreAInput'),
    scoreBInput: $('scoreBInput'),
    createGameButton: $('createGameButton'),
    reopenSelectedButton: $('reopenSelectedButton'),
    pendingRetryButton: $('pendingRetryButton'),
    clearPendingButton: $('clearPendingButton'),
    exampleList: $('exampleList'),
    bench1: $('bench1'),
    bench2: $('bench2'),
    bench3: $('bench3'),
    bench4: $('bench4'),
    benchCut: $('benchCut'),
    benchCrib: $('benchCrib'),
    scoreHandButton: $('scoreHandButton'),
    handBenchResult: $('handBenchResult'),
    pegPile: $('pegPile'),
    pegCount: $('pegCount'),
    pegNext: $('pegNext'),
    scorePegButton: $('scorePegButton'),
    pegBenchResult: $('pegBenchResult'),
    gameIntro: $('gameIntro'),
    tableSubline: $('tableSubline'),
  };

  const memberLookup = new Map();
  const gameLookup = new Map();
  const practiceLookup = new Map();

  function newActionId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `aid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function seatName(game, seat) {
    return game?.members?.[seat]?.name || seat;
  }

  function memberStats(no) {
    return memberLookup.get(no) || null;
  }

  function setStatus(message, tone = 'muted') {
    els.status.className = `status ${tone === 'bad' ? 'error' : tone === 'good' ? 'good-text' : 'muted'}`;
    els.status.textContent = message;
  }

  function setConnection(text, tone = 'muted') {
    els.connectionBadge.textContent = text;
    els.connectionBadge.style.borderColor = tone === 'good' ? 'var(--good)' : tone === 'bad' ? 'var(--bad)' : 'var(--line)';
  }

  function setPending(pending) {
    state.pending = pending;
    if (pending) {
      localStorage.setItem('gambit-pending-action', JSON.stringify(pending));
      els.pendingRetryButton.classList.remove('hidden');
    } else {
      localStorage.removeItem('gambit-pending-action');
      els.pendingRetryButton.classList.add('hidden');
    }
  }

  function isHiddenCard(code) {
    return !code || code === 'XX' || code === '??';
  }

  function suitSymbol(suit) {
    return { S: '♠', H: '♥', D: '♦', C: '♣' }[suit] || '?';
  }

  function cardFrontSvg(code) {
    const rank = code[0];
    const suit = code[1];
    const color = suit === 'H' || suit === 'D' ? '#c84f4f' : '#1a2430';
    const suitGlyph = suitSymbol(suit);
    const rankLabel = rank === 'T' ? '10' : rank;
    return `
      <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="2" y="2" width="96" height="136" rx="12" fill="#fefcf7" stroke="#c2c8d0" stroke-width="3"/>
        <text x="14" y="26" font-size="18" font-weight="700" fill="${color}">${rankLabel}</text>
        <text x="14" y="46" font-size="18" fill="${color}">${suitGlyph}</text>
        <text x="50" y="82" font-size="38" text-anchor="middle" fill="${color}">${suitGlyph}</text>
        <text x="86" y="124" font-size="18" font-weight="700" text-anchor="end" fill="${color}">${rankLabel}</text>
        <text x="86" y="104" font-size="18" text-anchor="end" fill="${color}">${suitGlyph}</text>
      </svg>`;
  }

  function cardBackSvg() {
    return `
      <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="2" y="2" width="96" height="136" rx="12" fill="#254a7a" stroke="#9cb6d8" stroke-width="3"/>
        <circle cx="24" cy="28" r="4" fill="#6bd4ff" opacity="0.7"/>
        <circle cx="50" cy="28" r="4" fill="#6bd4ff" opacity="0.7"/>
        <circle cx="76" cy="28" r="4" fill="#6bd4ff" opacity="0.7"/>
        <circle cx="24" cy="56" r="4" fill="#6bd4ff" opacity="0.7"/>
        <circle cx="50" cy="56" r="4" fill="#6bd4ff" opacity="0.7"/>
        <circle cx="76" cy="56" r="4" fill="#6bd4ff" opacity="0.7"/>
        <circle cx="24" cy="84" r="4" fill="#6bd4ff" opacity="0.7"/>
        <circle cx="50" cy="84" r="4" fill="#6bd4ff" opacity="0.7"/>
        <circle cx="76" cy="84" r="4" fill="#6bd4ff" opacity="0.7"/>
        <circle cx="24" cy="112" r="4" fill="#6bd4ff" opacity="0.7"/>
        <circle cx="50" cy="112" r="4" fill="#6bd4ff" opacity="0.7"/>
        <circle cx="76" cy="112" r="4" fill="#6bd4ff" opacity="0.7"/>
      </svg>`;
  }

  function cardButton(code, opts = {}) {
    const hidden = isHiddenCard(code) || opts.hidden;
    const selected = opts.selected ? ' selected' : '';
    const disabled = opts.disabled ? ' disabled' : '';
    const label = hidden ? 'Face down card' : `Card ${Rules.cardLabel(code)}`;
    return `
      <button class="card-btn${selected}" type="button" data-card="${escapeHtml(code)}" aria-label="${escapeHtml(label)}"${disabled}>
        <div class="card${hidden ? ' face-down' : ''}">
          ${hidden ? cardBackSvg() : cardFrontSvg(code)}
        </div>
      </button>`;
  }

  function cardListHtml(cards, opts = {}) {
    return `<div class="cards">${cards.map((code) => cardButton(code, { hidden: opts.hidden, selected: opts.selected?.includes(code), disabled: opts.disabled })).join('')}</div>`;
  }

  function boardPosition(score) {
    const max = 120;
    const n = Math.max(0, Math.min(max, Number(score) || 0));
    const cols = 11;
    const row = Math.floor(n / cols);
    const col = row % 2 === 0 ? n % cols : cols - 1 - (n % cols);
    const x = 50 + (col * 78);
    const y = 58 + (row * 30);
    return { x, y };
  }

  function renderBoard(game) {
    if (!game) {
      els.pegBoard.innerHTML = '';
      return;
    }
    const aScore = Number(game.scores?.A || 0);
    const bScore = Number(game.scores?.B || 0);
    const pegs = [
      { seat: 'A', score: Math.max(0, aScore - 1), color: '#7bd6ff', fill: '#7bd6ff' },
      { seat: 'A', score: aScore, color: '#7bd6ff', fill: '#d7f4ff' },
      { seat: 'B', score: Math.max(0, bScore - 1), color: '#ff9d7b', fill: '#ff9d7b' },
      { seat: 'B', score: bScore, color: '#ff9d7b', fill: '#ffe0d2' },
    ];
    const holes = [];
    for (let i = 0; i <= 120; i += 1) {
      const { x, y } = boardPosition(i);
      holes.push(`<circle cx="${x}" cy="${y}" r="6" fill="#0d131b" stroke="#51667f" stroke-width="1.3"></circle>`);
    }
    const labels = [];
    for (let i = 0; i <= 120; i += 10) {
      const { x, y } = boardPosition(i);
      labels.push(`<text x="${x}" y="${y - 14}" text-anchor="middle" font-size="13" fill="#8fa3ba">${i}</text>`);
    }
    const pegMarks = pegs.map((peg, index) => {
      const { x, y } = boardPosition(peg.score);
      const dy = index % 2 === 0 ? -8 : 8;
      return `<circle cx="${x + (index % 2 === 0 ? -10 : 10)}" cy="${y + dy}" r="7" fill="${peg.fill}" stroke="${peg.color}" stroke-width="3"></circle>`;
    }).join('');
    els.pegBoard.innerHTML = `
      <defs>
        <linearGradient id="boardGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1a2a3d"/>
          <stop offset="100%" stop-color="#0d131b"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="960" height="460" rx="18" fill="url(#boardGlow)"/>
      ${holes.join('')}
      ${labels.join('')}
      ${pegMarks}
      <text x="24" y="28" font-size="18" fill="#d8e7ff">Seat A</text>
      <text x="900" y="28" text-anchor="end" font-size="18" fill="#ffd5c0">Seat B</text>
    `;
  }

  function renderMemberSelects() {
    const members = state.bootstrap?.ladder || [];
    const options = members.map((member) => `<option value="${member.no}">${escapeHtml(member.no)} — ${escapeHtml(member.name)}</option>`).join('');
    els.seatASelect.innerHTML = options;
    els.seatBSelect.innerHTML = options;
    if (members[0]) els.seatASelect.value = members[0].no;
    if (members[1]) els.seatBSelect.value = members[1].no;
    els.viewerSelect.value = state.viewerSeat;
    els.practiceSelect.innerHTML = Object.entries(state.bootstrap?.practiceDeals || {}).map(([key, practice]) => `<option value="${escapeHtml(key)}">${escapeHtml(practice.name || key)}</option>`).join('');
    if (!els.practiceSelect.value && state.bootstrap?.practiceDeals) {
      els.practiceSelect.value = 'pegging';
    }
  }

  function renderHistory() {
    const history = state.bootstrap?.history || [];
    if (!history.length) {
      els.historyList.innerHTML = '<div class="item">No historical summaries loaded.</div>';
      return;
    }
    els.historyList.innerHTML = history.map((game) => `
      <div class="item">
        <div class="inline">
          <strong>${escapeHtml(game.id)}</strong>
          <span class="badge">${game.finished ? 'Finished' : 'Open'}</span>
        </div>
        <div>${escapeHtml(game.dealer)} vs ${escapeHtml(game.pone)}</div>
        <div>Dealer ${game.dealer_score} — Pone ${game.pone_score}</div>
        <div class="small muted">${game.finished ? 'Historic finished summary.' : 'Historic summary without a recoverable deal.'}</div>
      </div>
    `).join('');
  }

  function renderGameList() {
    const games = state.bootstrap?.games || [];
    if (!games.length) {
      els.gameList.innerHTML = '<div class="item">No saved games yet.</div>';
      return;
    }
    els.gameList.innerHTML = games.map((game) => {
      const active = game.id === state.selectedGameId ? ' active' : '';
      const phase = game.phase || 'unknown';
      return `
        <div class="item${active}">
          <div class="inline">
            <strong>${escapeHtml(game.id)}</strong>
            <span class="badge">${escapeHtml(phase)}</span>
          </div>
          <div>${escapeHtml(game.dealerName)} deals hand ${game.handNo}</div>
          <div>Seat A ${game.scores.A} — Seat B ${game.scores.B}</div>
          <div class="actions">
            <button type="button" data-open-game="${escapeHtml(game.id)}">Open</button>
          </div>
        </div>
      `;
    }).join('');
    els.gameList.querySelectorAll('[data-open-game]').forEach((button) => {
      button.addEventListener('click', () => loadGame(button.getAttribute('data-open-game')));
    });
  }

  function renderBootstrapSummary() {
    const members = state.bootstrap?.ladder || [];
    els.gameSummary.innerHTML = members.slice(0, 3).map((member) => `
      <div class="item">
        <div class="inline"><strong>${escapeHtml(member.name)}</strong> <span class="badge">${escapeHtml(member.no)}</span></div>
        <div>Played ${member.played}</div>
        <div>Won ${member.won}</div>
      </div>
    `).join('');
  }

  function renderPlayerPanels(game) {
    if (!game) {
      els.playerPanels.innerHTML = '<div class="item">Open or create a game to begin.</div>';
      return;
    }
    els.playerPanels.innerHTML = ['A', 'B'].map((seat) => {
      const member = game.members?.[seat] || {};
      const stats = memberStats(member.no) || {};
      const score = game.scores?.[seat] ?? 0;
      const remaining = game.phase === 'pegging' ? (game.pegging?.remaining?.[seat] || []) : (game.hand?.kept?.[seat] || game.hand?.initial?.[seat] || []);
      const discards = game.hand?.discards?.[seat] || [];
      return `
        <div class="item">
          <div class="inline">
            <strong>${escapeHtml(member.name || seat)}</strong>
            <span class="badge">Seat ${seat}</span>
            <span class="badge">${escapeHtml(member.no || '')}</span>
          </div>
          <div>Score: ${score}</div>
          <div class="small muted">Played ${stats.played ?? '—'} · Won ${stats.won ?? '—'}</div>
          <div class="small">Remaining: ${remaining.length}</div>
          <div class="small">Discards: ${discards.length ? discards.join(' ') : '—'}</div>
        </div>
      `;
    }).join('');
  }

  function renderShowResults(game) {
    const results = game.show?.results || [];
    if (!results.length) return '<div class="item">No show results yet.</div>';
    return `<div class="results">${results.map((result) => {
      const breakdown = renderBreakdown(result.details, result.parts, result.total);
      return `
        <div class="result-card">
          <div class="inline">
            <strong>${escapeHtml(result.label)}</strong>
            <span class="badge">${escapeHtml(result.kind)}</span>
            <span class="badge">${escapeHtml(result.seat === 'A' ? 'Seat A' : result.seat === 'B' ? 'Seat B' : result.seat)}</span>
            <span class="badge">${result.total} points</span>
          </div>
          <div class="small muted">${result.cards.map((card) => escapeHtml(Rules.cardLabel(card))).join(' · ')} + cut ${escapeHtml(Rules.cardLabel(result.cut))}</div>
          ${breakdown}
        </div>`;
    }).join('')}</div>`;
  }

  function renderBreakdown(details, parts, total) {
    const pieces = [];
    if (details.fifteens?.length) {
      pieces.push(`<li>Fifteens: ${parts.fifteens} (${details.fifteens.map((entry) => entry.cards.map((card) => Rules.cardLabel(card)).join(' + ')).join('; ')})</li>`);
    }
    if (details.pairs?.length) {
      pieces.push(`<li>Pairs: ${parts.pairs} (${details.pairs.map((entry) => `${entry.count} ${entry.rank}${entry.count === 2 ? '' : 's'}`).join('; ')})</li>`);
    }
    if (details.runs?.length) {
      pieces.push(`<li>Runs: ${parts.runs} (${details.runs.map((entry) => `${entry.length} ×${entry.multiplicity}`).join('; ')})</li>`);
    }
    if (details.flush?.points) {
      pieces.push(`<li>Flush: ${details.flush.points}</li>`);
    }
    if (details.nobs?.points) {
      pieces.push(`<li>Nobs: ${details.nobs.points} (${Rules.cardLabel(details.nobs.card)})</li>`);
    }
    if (!pieces.length) pieces.push('<li>Nothing scores here.</li>');
    return `<ul class="reasons">${pieces.join('')}</ul><div class="small muted">Total ${total}</div>`;
  }

  function renderCommentary(game) {
    const lines = game.commentary || [];
    if (!lines.length) {
      els.commentary.innerHTML = '<div class="item">No commentary yet.</div>';
      return;
    }
    els.commentary.innerHTML = lines.slice().reverse().map((line) => `<div class="item">${escapeHtml(line)}</div>`).join('');
  }

  function renderCurrentHand(game) {
    if (!game) {
      els.currentHandPanel.innerHTML = '<div class="item">Select or create a game to see the table.</div>';
      return;
    }
    const viewer = state.viewerSeat;
    const other = viewer === 'A' ? 'B' : 'A';
    const phase = game.phase;
    const cut = game.hand?.cut || game.hand?.pendingCut || null;
    const currentTurn = game.pegging?.turnSeat || '—';
    const count = game.pegging?.count ?? 0;
    const turnName = currentTurn === '—' ? '—' : seatName(game, currentTurn);
    const ownCards = phase === 'pegging'
      ? (game.pegging?.remaining?.[viewer] || [])
      : (game.hand?.initial?.[viewer] || []);
    const otherCards = phase === 'pegging'
      ? (game.pegging?.remaining?.[other] || [])
      : (game.hand?.initial?.[other] || []);
    const ownHidden = ownCards.some(isHiddenCard) ? ownCards.map((code) => (isHiddenCard(code) ? 'XX' : code)) : ownCards;
    const otherDisplay = otherCards.map((code) => (isHiddenCard(code) ? 'XX' : code));
    const cribDisplay = game.show?.complete ? (game.hand?.crib?.map((entry) => entry.card) || []) : (game.hand?.crib?.map(() => 'XX') || []);
    const played = game.pegging?.pile?.map((entry) => entry.card) || [];
    const showResults = game.show?.results || [];
    const suggested = game.hand?.recommendedDiscards || null;
    const currentDiscardChoice = state.discardChoice.slice();

    let html = `
      <div class="grid-2">
        <div class="item">
          <div class="inline"><strong>Hand ${game.handNo}</strong> <span class="badge">${escapeHtml(game.phase)}</span></div>
          <div>Dealer: ${escapeHtml(seatName(game, game.dealerSeat))}</div>
          <div>Turn: ${currentTurn === '—' ? '—' : escapeHtml(turnName)}</div>
          <div>Count: ${count}</div>
          <div>Cut: ${cut ? escapeHtml(Rules.cardLabel(cut)) : 'Hidden'}</div>
        </div>
        <div class="item">
          <div class="inline"><strong>Crib</strong> <span class="badge">${game.hand?.crib?.length || 0} cards</span></div>
          <div class="cards">${cribDisplay.map((code) => cardButton(code, { hidden: !game.show?.complete })).join('')}</div>
        </div>
      </div>
      <div class="sep"></div>
      <div class="grid-2">
        <div class="item">
          <div class="inline"><strong>Your view: Seat ${viewer}</strong> <span class="badge">${escapeHtml(seatName(game, viewer))}</span></div>
          <div class="small muted">Opponent remains face down until the show.</div>
          <div class="sep"></div>
          <div class="cards">${ownHidden.map((code) => cardButton(code, { hidden: isHiddenCard(code), selected: currentDiscardChoice.includes(code) })).join('')}</div>
        </div>
        <div class="item">
          <div class="inline"><strong>Opponent</strong> <span class="badge">Seat ${other}</span></div>
          <div class="small muted">${phase === 'show' && game.show?.complete ? 'Revealed at the show.' : 'Kept cards are hidden.'}</div>
          <div class="sep"></div>
          <div class="cards">${otherDisplay.map((code) => cardButton(code, { hidden: isHiddenCard(code), disabled: true })).join('')}</div>
        </div>
      </div>
    `;

    if (phase === 'discard') {
      html += `
        <div class="sep"></div>
        <div class="item">
          <div class="inline"><strong>Discard stage</strong> ${suggested ? '<span class="badge">Practice deal</span>' : ''}</div>
          <div class="small muted">Select exactly two of your cards to move into the crib.</div>
          ${suggested ? `<div class="small muted">Suggested discards: ${suggested[viewer].join(' ')}</div>` : ''}
          <div class="actions">
            <button type="button" id="useSuggestedDiscardButton">Use suggested discards</button>
            <button type="button" id="clearDiscardChoiceButton">Clear selection</button>
          </div>
        </div>`;
    } else if (phase === 'pegging') {
      const playable = (game.pegging?.remaining?.[viewer] || []).filter((card) => !isHiddenCard(card) && Rules.legalPegCards([card], count, false).length > 0);
      const canGo = game.pegging?.turnSeat === viewer && playable.length === 0;
      html += `
        <div class="sep"></div>
        <div class="item">
          <div class="inline"><strong>Pegging</strong> <span class="badge">${count}</span> <span class="badge">${turnName}</span></div>
          <div class="small muted">Play one card or say go when you cannot play.</div>
        </div>`;
      if (game.pegging?.turnSeat === viewer) {
        html += `<div class="sep"></div><div class="item"><div class="inline"><strong>Your playable cards</strong></div><div class="cards">${ownCards.map((code) => {
          const legal = !isHiddenCard(code) && Rules.legalPegCards([code], count, false).length > 0;
          return cardButton(code, { hidden: false, disabled: !legal, selected: state.playChoice === code });
        }).join('')}</div></div>`;
      }
      html += `<div class="sep"></div><div class="item"><div class="inline"><strong>Played cards</strong> <span class="badge">${played.length}</span></div><div class="cards">${played.map((code) => cardButton(code, { hidden: false, disabled: true })).join('')}</div></div>`;
    } else if (phase === 'show' || phase === 'finished') {
      html += `
        <div class="sep"></div>
        <div class="item">
          <div class="inline"><strong>Show</strong> <span class="badge">${game.show?.complete ? 'Complete' : 'Stopped early'}</span></div>
          ${renderShowResults(game)}
        </div>`;
    }

    els.currentHandPanel.innerHTML = html;
    const discardButtons = els.currentHandPanel.querySelectorAll('.card-btn[data-card]');
    discardButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const card = button.getAttribute('data-card');
        if (phase === 'discard' && ownHidden.includes(card)) {
          toggleDiscardChoice(card);
        } else if (phase === 'pegging' && game.pegging?.turnSeat === viewer && ownCards.includes(card) && !isHiddenCard(card)) {
          submitPlay(card);
        }
      });
    });

    if (phase === 'discard') {
      const useSuggested = $('useSuggestedDiscardButton');
      const clearChoice = $('clearDiscardChoiceButton');
      if (useSuggested && suggested) {
        useSuggested.addEventListener('click', () => {
          state.discardChoice = (suggested[viewer] || []).slice();
          renderAll();
        });
      }
      if (clearChoice) {
        clearChoice.addEventListener('click', () => {
          state.discardChoice = [];
          renderAll();
        });
      }
    }

    if (phase === 'pegging') {
      els.currentHandPanel.dataset.canGo = String(game.pegging?.turnSeat === viewer && (game.pegging?.remaining?.[viewer] || []).filter((card) => !isHiddenCard(card) && Rules.legalPegCards([card], count, false).length > 0).length === 0);
    }
  }

  function renderActions(game) {
    if (!game) {
      els.actionPanel.innerHTML = '<div class="muted">No game selected.</div>';
      return;
    }
    const viewer = state.viewerSeat;
    const phase = game.phase;
    const buttons = [];
    if (phase === 'discard') {
      buttons.push(`<button type="button" id="submitDiscardButton" class="primary" ${state.discardChoice.length === 2 ? '' : 'disabled'}>Submit discards</button>`);
    } else if (phase === 'pegging') {
      if (game.pegging?.turnSeat === viewer) {
        const legal = (game.pegging?.remaining?.[viewer] || []).filter((card) => !isHiddenCard(card) && Rules.legalPegCards([card], game.pegging.count, false).length > 0);
        if (legal.length) {
          buttons.push(`<span class="badge">Choose a card above to play it.</span>`);
        } else {
          buttons.push(`<button type="button" id="goButton" class="warn">Go</button>`);
        }
      } else {
        buttons.push(`<span class="badge">Waiting for ${escapeHtml(seatName(game, game.pegging?.turnSeat))}.</span>`);
      }
    } else if (phase === 'show') {
      buttons.push(`<button type="button" id="nextHandButton" class="primary">Next hand</button>`);
    } else if (phase === 'finished') {
      buttons.push(`<span class="badge">${escapeHtml(seatName(game, game.winnerSeat))} has won. The table is closed.</span>`);
    }
    els.actionPanel.innerHTML = buttons.join('');
    const submitDiscardButton = $('submitDiscardButton');
    const goButton = $('goButton');
    const nextHandButton = $('nextHandButton');
    if (submitDiscardButton) submitDiscardButton.addEventListener('click', () => submitDiscards().catch(() => {}));
    if (goButton) goButton.addEventListener('click', () => submitGo().catch(() => {}));
    if (nextHandButton) nextHandButton.addEventListener('click', () => nextHand().catch(() => {}));
  }

  function renderGame(game) {
    state.currentGame = game;
    if (game) state.selectedGameId = game.id;
    els.gameBadge.textContent = game ? `${game.id} · rev ${game.revision}` : 'No game selected';
    els.seatBadge.textContent = `Seat ${state.viewerSeat}`;
    els.phaseChip.textContent = `Phase: ${game?.phase || '—'}`;
    els.dealerChip.textContent = `Dealer: ${game ? seatName(game, game.dealerSeat) : '—'}`;
    els.turnChip.textContent = `Turn: ${game?.pegging?.turnSeat ? seatName(game, game.pegging.turnSeat) : '—'}`;
    els.gameIntro.textContent = game ? `${seatName(game, 'A')} vs ${seatName(game, 'B')} · ${game.mode}${game.practice?.key ? ` · ${game.practice.key}` : ''}` : 'Choose a game or create a new one.';
    els.tableSubline.textContent = game ? `Hand ${game.handNo} · scores ${game.scores.A} to ${game.scores.B} · count ${game.pegging?.count ?? 0}` : 'Open games, seats, dealer, peg count, and show.';
    renderBoard(game);
    renderPlayerPanels(game);
    renderCurrentHand(game);
    renderActions(game);
    renderCommentary(game);
    renderGameList();
  }

  function renderBenchExamples() {
    const examples = state.bootstrap?.scoredHands || [];
    els.exampleList.innerHTML = examples.map((example, index) => `<button type="button" data-example-index="${index}">${index + 1}</button>`).join('');
    els.exampleList.querySelectorAll('[data-example-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const example = examples[Number(button.getAttribute('data-example-index'))];
        if (!example) return;
        const hand = example.hand || [];
        [els.bench1, els.bench2, els.bench3, els.bench4].forEach((input, idx) => { input.value = hand[idx] || ''; });
        els.benchCut.value = example.cut || '';
        els.benchCrib.value = String(Boolean(example.crib));
        scoreHandBench();
      });
    });
  }

  function parseCardsInput(text) {
    return text.trim().split(/[\s,]+/).filter(Boolean).map((card) => Rules.parseCard(card).code);
  }

  function scoreHandBench() {
    try {
      const hand = [els.bench1.value, els.bench2.value, els.bench3.value, els.bench4.value].map((value) => Rules.parseCard(value).code);
      const cut = Rules.parseCard(els.benchCut.value).code;
      const crib = els.benchCrib.value === 'true';
      const score = Rules.scoreHand(hand, cut, crib);
      els.handBenchResult.innerHTML = `
        <div class="inline"><strong>Total ${score.total}</strong> <span class="badge">${crib ? 'Crib' : 'Hand'}</span></div>
        ${renderBreakdown(score.details, score.parts, score.total)}
      `;
      setStatus(`Hand bench scored ${score.total}.`, 'good');
    } catch (error) {
      els.handBenchResult.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
      setStatus(error.message, 'bad');
    }
  }

  function scorePegBench() {
    try {
      const pile = parseCardsInput(els.pegPile.value);
      const count = Number(els.pegCount.value || 0);
      const next = Rules.parseCard(els.pegNext.value).code;
      const score = Rules.scorePeggingPlay(pile, next, count);
      const reasons = score.reasons.map((reason) => `<li>${escapeHtml(reason.text)} for ${reason.points}</li>`).join('') || '<li>No points</li>';
      els.pegBenchResult.innerHTML = `
        <div class="inline"><strong>After ${Rules.cardLabel(next)}</strong> <span class="badge">Count ${score.countAfter}</span> <span class="badge">${score.points} points</span></div>
        <ul class="reasons">${reasons}</ul>
      `;
      setStatus(`Pegging bench scored ${score.points}.`, 'good');
    } catch (error) {
      els.pegBenchResult.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
      setStatus(error.message, 'bad');
    }
  }

  function validatePending() {
    if (!state.pending) return;
    els.pendingRetryButton.classList.remove('hidden');
  }

  function buildPending(action) {
    return {
      actionId: action.actionId,
      route: action.route,
      body: action.body,
      expectedRevision: action.expectedRevision,
      seat: action.seat,
      label: action.label,
    };
  }

  async function sendRequest(route, method, body, expectedRevision, actionId) {
    const response = await fetch(route, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Action-Id': actionId,
        'X-Expected-Revision': String(expectedRevision ?? 0),
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Request failed with ${response.status}`);
      error.payload = payload;
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function performAction(route, body, expectedRevision, label) {
    if (!state.currentGame && route !== '/api/games') return;
    const actionId = newActionId();
    const pending = buildPending({ actionId, route, body, expectedRevision, seat: body.viewerSeat || body.seat || state.viewerSeat, label });
    setPending(pending);
    setConnection(`${label} saving…`, 'muted');
    try {
      const payload = await sendRequest(route, 'POST', body, expectedRevision, actionId);
      setPending(null);
      setConnection('Saved', 'good');
      setStatus(payload.message || `${label} saved.`, 'good');
      await refreshBootstrap();
      if (payload.game?.id) {
        await loadGame(payload.game.id, pending.seat);
      } else if (state.currentGame?.id) {
        await loadGame(state.currentGame.id, state.viewerSeat);
      }
      focusPrimaryAfterAction();
    } catch (error) {
      setConnection('Save failed', 'bad');
      setStatus(error.message, 'bad');
      if (error.status === 409 && error.payload?.game) {
        await loadGame(error.payload.game.id || state.currentGame?.id, state.viewerSeat);
      }
      throw error;
    }
  }

  async function submitDiscards() {
    if (!state.currentGame || state.discardChoice.length !== 2) return;
    const body = { kind: 'discard', seat: state.viewerSeat, cards: state.discardChoice.slice() };
    await performAction(`/api/games/${state.currentGame.id}/actions`, body, state.currentGame.revision, 'Discard');
    state.discardChoice = [];
  }

  async function submitPlay(card) {
    if (!state.currentGame) return;
    const body = { kind: 'play', seat: state.viewerSeat, card };
    await performAction(`/api/games/${state.currentGame.id}/actions`, body, state.currentGame.revision, 'Play');
    state.playChoice = null;
  }

  async function submitGo() {
    if (!state.currentGame) return;
    const body = { kind: 'go', seat: state.viewerSeat };
    await performAction(`/api/games/${state.currentGame.id}/actions`, body, state.currentGame.revision, 'Go');
  }

  async function nextHand() {
    if (!state.currentGame) return;
    const body = { kind: 'next_hand', seat: state.viewerSeat };
    await performAction(`/api/games/${state.currentGame.id}/actions`, body, state.currentGame.revision, 'Next hand');
    state.discardChoice = [];
    state.playChoice = null;
  }

  function toggleDiscardChoice(card) {
    const index = state.discardChoice.indexOf(card);
    if (index >= 0) {
      state.discardChoice.splice(index, 1);
    } else if (state.discardChoice.length < 2) {
      state.discardChoice.push(card);
    } else {
      state.discardChoice.shift();
      state.discardChoice.push(card);
    }
    renderAll();
  }

  async function createGame(event) {
    event.preventDefault();
    const body = {
      mode: els.modeSelect.value,
      practiceKey: els.modeSelect.value === 'practice' ? els.practiceSelect.value : null,
      seatA: els.seatASelect.value,
      seatB: els.seatBSelect.value,
      scoreA: Number(els.scoreAInput.value || 0),
      scoreB: Number(els.scoreBInput.value || 0),
      viewerSeat: els.viewerSelect.value,
    };
    setConnection('Creating game…', 'muted');
    await performAction('/api/games', body, 0, 'Create game');
    state.viewerSeat = body.viewerSeat;
    localStorage.setItem('gambit-viewer-seat', state.viewerSeat);
    els.viewerSelect.value = state.viewerSeat;
  }

  async function loadGame(id, seat = state.viewerSeat) {
    if (!id) return;
    state.selectedGameId = id;
    localStorage.setItem('gambit-selected-game', id);
    state.viewerSeat = seat;
    localStorage.setItem('gambit-viewer-seat', seat);
    els.viewerSelect.value = seat;
    setConnection('Loading game…', 'muted');
    const response = await fetch(`/api/games/${encodeURIComponent(id)}?seat=${encodeURIComponent(seat)}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to load game.');
    }
    state.currentGame = payload.game;
    state.selectedGameId = payload.game.id;
    state.discardChoice = [];
    state.playChoice = null;
    setConnection('Loaded', 'good');
    setStatus(`Loaded ${payload.game.id}.`, 'good');
    syncFormFromGame(payload.game);
    renderAll();
  }

  function syncFormFromGame(game) {
    if (!game) return;
    els.seatASelect.value = game.members?.A?.no || els.seatASelect.value;
    els.seatBSelect.value = game.members?.B?.no || els.seatBSelect.value;
    els.scoreAInput.value = game.scores?.A ?? 0;
    els.scoreBInput.value = game.scores?.B ?? 0;
    els.modeSelect.value = game.mode || 'normal';
    if (game.practice?.key && practiceLookup.has(game.practice.key)) {
      els.practiceSelect.value = game.practice.key;
    }
  }

  async function refreshBootstrap() {
    const response = await fetch('/api/bootstrap');
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Bootstrap failed.');
    state.bootstrap = payload;
    payload.ladder.forEach((member) => memberLookup.set(member.no, member));
    payload.games.forEach((game) => gameLookup.set(game.id, game));
    Object.entries(payload.practiceDeals || {}).forEach(([key, value]) => practiceLookup.set(key, value));
    renderMemberSelects();
    renderBootstrapSummary();
    renderHistory();
    renderGameList();
    renderBenchExamples();
    validatePending();
  }

  function renderAll() {
    renderGame(state.currentGame);
    renderBoard(state.currentGame);
    renderGameList();
    renderPendingUI();
  }

  function renderPendingUI() {
    if (state.pending) {
      els.pendingRetryButton.classList.remove('hidden');
    } else {
      els.pendingRetryButton.classList.add('hidden');
    }
  }

  function focusPrimaryAfterAction() {
    window.setTimeout(() => {
      if (state.currentGame?.phase === 'discard') {
        $('submitDiscardButton')?.focus();
      } else if (state.currentGame?.phase === 'pegging') {
        const goButton = $('goButton');
        if (goButton) goButton.focus();
      } else if (state.currentGame?.phase === 'show') {
        $('nextHandButton')?.focus();
      }
    }, 0);
  }

  async function retryPendingAction() {
    if (!state.pending) return;
    const pending = state.pending;
    setConnection('Retrying pending save…', 'muted');
    try {
      const payload = await sendRequest(pending.route, 'POST', pending.body, pending.expectedRevision, pending.actionId);
      setPending(null);
      setStatus(payload.message || 'Pending action confirmed.', 'good');
      await refreshBootstrap();
      if (payload.game?.id) {
        await loadGame(payload.game.id, pending.seat || state.viewerSeat);
      } else if (state.currentGame?.id) {
        await loadGame(state.currentGame.id, pending.seat || state.viewerSeat);
      }
    } catch (error) {
      setStatus(error.message, 'bad');
      if (error.status === 409 && error.payload?.game) {
        await loadGame(error.payload.game.id || state.currentGame?.id, state.viewerSeat);
      }
    }
  }

  function clearPendingAction() {
    setPending(null);
    setStatus('Pending save cleared.', 'good');
  }

  function autoPickPracticeDefaults() {
    if (els.modeSelect.value !== 'practice') return;
    const selected = practiceLookup.get(els.practiceSelect.value);
    if (!selected) return;
    if (selected.a) {
      els.scoreAInput.value = 0;
      els.scoreBInput.value = 0;
    }
  }

  async function reopenSelectedGame() {
    if (!state.selectedGameId) return;
    await loadGame(state.selectedGameId, state.viewerSeat);
  }

  function wireEvents() {
    els.seatAButton.addEventListener('click', () => {
      state.viewerSeat = 'A';
      localStorage.setItem('gambit-viewer-seat', 'A');
      els.viewerSelect.value = 'A';
      if (state.currentGame) loadGame(state.currentGame.id, 'A').catch(() => {});
      else renderAll();
    });
    els.seatBButton.addEventListener('click', () => {
      state.viewerSeat = 'B';
      localStorage.setItem('gambit-viewer-seat', 'B');
      els.viewerSelect.value = 'B';
      if (state.currentGame) loadGame(state.currentGame.id, 'B').catch(() => {});
      else renderAll();
    });
    els.reloadGameButton.addEventListener('click', () => {
      if (state.currentGame) loadGame(state.currentGame.id, state.viewerSeat).catch(() => {});
    });
    els.viewerSelect.addEventListener('change', () => {
      state.viewerSeat = els.viewerSelect.value;
      localStorage.setItem('gambit-viewer-seat', state.viewerSeat);
      if (state.currentGame) loadGame(state.currentGame.id, state.viewerSeat).catch(() => {});
      else renderAll();
    });
    els.newGameForm.addEventListener('submit', (event) => createGame(event).catch(() => {}));
    els.reopenSelectedButton.addEventListener('click', reopenSelectedGame);
    els.modeSelect.addEventListener('change', autoPickPracticeDefaults);
    els.practiceSelect.addEventListener('change', autoPickPracticeDefaults);
    els.scoreHandButton.addEventListener('click', scoreHandBench);
    els.scorePegButton.addEventListener('click', scorePegBench);
    els.pendingRetryButton.addEventListener('click', retryPendingAction);
    els.clearPendingButton.addEventListener('click', clearPendingAction);
  }

  async function initialise() {
    wireEvents();
    setConnection('Connecting…', 'muted');
    try {
      await refreshBootstrap();
      const savedGame = localStorage.getItem('gambit-selected-game');
      if (savedGame) {
        state.selectedGameId = savedGame;
      }
      if (state.pending) {
        setStatus('A pending save was found. You can retry it.', 'muted');
      }
      if (state.selectedGameId) {
        await loadGame(state.selectedGameId, state.viewerSeat);
      } else if (state.bootstrap?.games?.[0]) {
        state.selectedGameId = state.bootstrap.games[0].id;
        localStorage.setItem('gambit-selected-game', state.selectedGameId);
        await loadGame(state.selectedGameId, state.viewerSeat);
      } else {
        renderAll();
        setConnection('Ready', 'good');
      }
      setConnection('Ready', 'good');
    } catch (error) {
      setConnection('Offline', 'bad');
      setStatus(error.message, 'bad');
      renderAll();
    }
  }

  window.addEventListener('beforeunload', () => {
    if (state.selectedGameId) localStorage.setItem('gambit-selected-game', state.selectedGameId);
  });

  initialise();
})();

// Gambit Hollow Client Application

let currentGame = null;
let activeSeat = localStorage.getItem('activeSeat') || 'A';
let selectedCards = new Set();
let membersList = [];
let memberMap = {};
let practiceDeals = {};
let referenceHands = [];
let pendingSave = null;
let prevScoreA = 0;
let prevScoreB = 0;

// Unique UUID helper
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

// Banner Announcement Helper
function showBanner(message, type = 'info', actionBtn = null) {
  const banner = document.getElementById('status-banner');
  if (!banner) return;
  if (!message) {
    banner.innerHTML = '';
    return;
  }

  const div = document.createElement('div');
  div.className = `banner banner-${type}`;
  div.innerHTML = `<span>${message}</span>`;

  if (actionBtn) {
    const btn = document.createElement('button');
    btn.className = 'banner-btn';
    btn.textContent = actionBtn.label;
    btn.onclick = actionBtn.onClick;
    div.appendChild(btn);
  }

  banner.innerHTML = '';
  banner.appendChild(div);
}

function clearBanner() {
  showBanner('');
}

// --- Navigation Tabs ---
function initTabs() {
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === tabId);
  });

  if (tabId === 'tab-saved') {
    loadSavedGames();
  } else if (tabId === 'tab-ladder') {
    loadLadderAndHistory();
  }
}

// --- Seat Switcher ---
function initSeatSwitcher() {
  const btnA = document.getElementById('seat-btn-a');
  const btnB = document.getElementById('seat-btn-b');

  btnA.addEventListener('click', () => {
    setActiveSeat('A');
  });

  btnB.addEventListener('click', () => {
    setActiveSeat('B');
  });
}

function setActiveSeat(seat) {
  activeSeat = seat;
  localStorage.setItem('activeSeat', seat);
  selectedCards.clear();

  document.getElementById('seat-btn-a').classList.toggle('active-seat', seat === 'A');
  document.getElementById('seat-btn-a').setAttribute('aria-pressed', seat === 'A');
  document.getElementById('seat-btn-b').classList.toggle('active-seat', seat === 'B');
  document.getElementById('seat-btn-b').setAttribute('aria-pressed', seat === 'B');

  if (currentGame) {
    fetchGame(currentGame.id, seat);
  }
}

// --- Data Fetching ---
async function loadInitialData() {
  try {
    const [mRes, dRes, hRes] = await Promise.all([
      fetch('/api/members'),
      fetch('/api/practice-deals'),
      fetch('/api/reference-hands')
    ]);

    const mData = await mRes.json();
    membersList = mData.members || [];
    memberMap = {};
    for (const m of membersList) {
      memberMap[m.no] = m.name;
    }

    const dData = await dRes.json();
    practiceDeals = dData.deals || {};

    const hData = await hRes.json();
    referenceHands = hData.hands || [];

    populatePracticeForm();
    populateReferenceHandsList();

    // Check if there was an active game saved in localStorage
    const savedGameId = localStorage.getItem('activeGameId');
    if (savedGameId) {
      await fetchGame(savedGameId, activeSeat);
    } else {
      // Start or show default
      loadSavedGames();
    }
  } catch (err) {
    console.error('Failed to load initial data:', err);
  }
}

async function fetchGame(gameId, seat = activeSeat) {
  try {
    const res = await fetch(`/api/games/${gameId}?seat=${seat}`);
    if (!res.ok) {
      if (res.status === 404) {
        localStorage.removeItem('activeGameId');
        currentGame = null;
        renderGameTable();
        return;
      }
      throw new Error(`Failed to load game: ${res.statusText}`);
    }

    const game = await res.json();
    currentGame = game;
    localStorage.setItem('activeGameId', game.id);
    renderGameTable();
  } catch (err) {
    showBanner(`Error loading game: ${err.message}`, 'error');
  }
}

// --- Execute Game Actions with Idempotency & Revision Checks ---
async function executeAction(actionType, payload = {}) {
  if (!currentGame) return;

  const actionId = generateUUID();
  const body = {
    action_id: actionId,
    expected_revision: currentGame.revision,
    action: actionType,
    seat: activeSeat,
    payload
  };

  pendingSave = {
    gameId: currentGame.id,
    body
  };

  showBanner('Saving move to club table...', 'info');
  setControlsDisabled(true);

  try {
    const res = await fetch(`/api/games/${currentGame.id}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Action-Id': actionId
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409 && data.error === 'stale_revision') {
        showBanner(data.message || 'Game updated elsewhere. Table refreshed.', 'error');
        await fetchGame(currentGame.id, activeSeat);
        pendingSave = null;
        setControlsDisabled(false);
        return;
      }
      throw new Error(data.error || 'Failed to execute move');
    }

    clearBanner();
    pendingSave = null;
    selectedCards.clear();
    currentGame = data;
    renderGameTable();
  } catch (err) {
    showBanner(`Network error: ${err.message}`, 'error', {
      label: 'Retry Move',
      onClick: () => retryPendingAction()
    });
  } finally {
    setControlsDisabled(false);
  }
}

async function retryPendingAction() {
  if (!pendingSave) return;
  showBanner('Retrying move...', 'info');
  setControlsDisabled(true);

  try {
    const res = await fetch(`/api/games/${pendingSave.gameId}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Action-Id': pendingSave.body.action_id
      },
      body: JSON.stringify(pendingSave.body)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Retry failed');
    }

    clearBanner();
    pendingSave = null;
    selectedCards.clear();
    currentGame = data;
    renderGameTable();
  } catch (err) {
    showBanner(`Retry failed: ${err.message}`, 'error', {
      label: 'Retry Again',
      onClick: () => retryPendingAction()
    });
  } finally {
    setControlsDisabled(false);
  }
}

function setControlsDisabled(disabled) {
  const btns = document.querySelectorAll('#player-cards-row button, #action-bar button, #btn-next-hand');
  btns.forEach(b => {
    b.disabled = disabled;
  });
}

// --- Table Rendering ---
function renderGameTable() {
  if (!currentGame) {
    document.getElementById('tag-game-id').textContent = 'No Game Loaded';
    document.getElementById('tag-hand-num').textContent = 'Hand -';
    document.getElementById('tag-dealer').textContent = 'Dealer: -';
    document.getElementById('tag-stage').textContent = 'Stage: -';
    document.getElementById('score-name-a').textContent = 'Seat A';
    document.getElementById('score-name-b').textContent = 'Seat B';
    document.getElementById('score-pts-a').textContent = '0';
    document.getElementById('score-pts-b').textContent = '0';
    document.getElementById('peg-board-wrap').innerHTML = renderPegBoardSvg(0, 0, 121);
    document.getElementById('opponent-cards-row').innerHTML = '';
    document.getElementById('player-cards-row').innerHTML = '<p style="color:#94a3b8; font-size:0.9rem;">Start a new game or open a saved match to begin play.</p>';
    document.getElementById('cut-card-slot').innerHTML = renderCardSvg('??', { width: 75, height: 108 });
    document.getElementById('crib-card-slot').innerHTML = renderCardSvg('??', { width: 75, height: 108 });
    document.getElementById('action-bar').innerHTML = '';
    document.getElementById('show-breakdown-card').style.display = 'none';
    return;
  }

  const nameA = memberMap[currentGame.player_a] || currentGame.player_a;
  const nameB = memberMap[currentGame.player_b] || currentGame.player_b;

  document.getElementById('seat-btn-a').textContent = `Seat A (${nameA})`;
  document.getElementById('seat-btn-b').textContent = `Seat B (${nameB})`;

  document.getElementById('tag-game-id').textContent = currentGame.id;
  document.getElementById('tag-hand-num').textContent = `Hand ${currentGame.hand_number}`;
  document.getElementById('tag-dealer').textContent = `Dealer: ${currentGame.dealer === 'A' ? nameA : nameB} (Seat ${currentGame.dealer})`;
  document.getElementById('tag-stage').textContent = `Stage: ${currentGame.stage.toUpperCase()}`;

  // Update Scoreboard & Pegboard
  document.getElementById('score-name-a').textContent = nameA;
  document.getElementById('score-name-b').textContent = nameB;
  document.getElementById('score-pts-a').textContent = currentGame.score_a;
  document.getElementById('score-pts-b').textContent = currentGame.score_b;

  document.getElementById('peg-board-wrap').innerHTML = renderPegBoardSvg(
    currentGame.score_a,
    currentGame.score_b,
    121,
    prevScoreA,
    prevScoreB
  );
  prevScoreA = currentGame.score_a;
  prevScoreB = currentGame.score_b;

  // Render Cut Card & Crib
  const st = currentGame.state;
  const cutSlot = document.getElementById('cut-card-slot');
  if (st.cut_revealed && st.cut) {
    cutSlot.innerHTML = renderCardSvg(st.cut, { width: 75, height: 108 });
  } else {
    cutSlot.innerHTML = renderCardSvg('??', { width: 75, height: 108 });
  }

  const cribSlot = document.getElementById('crib-card-slot');
  if (currentGame.stage === 'show' || currentGame.stage === 'finished') {
    // Show crib cards
    const cribHtml = st.crib.map(c => renderCardSvg(c, { width: 55, height: 80 })).join('');
    cribSlot.innerHTML = `<div style="display:flex; gap:4px;">${cribHtml}</div>`;
  } else {
    const cribCount = (st.discards.discards_done.a ? 2 : 0) + (st.discards.discards_done.b ? 2 : 0);
    cribSlot.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center;">
        ${renderCardSvg('??', { width: 75, height: 108 })}
        <span style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">${cribCount} / 4 cards</span>
      </div>
    `;
  }

  // Render Pegging Pile
  const pileRow = document.getElementById('pegging-pile-row');
  const countBadge = document.getElementById('count-badge');
  const turnBadge = document.getElementById('turn-badge');

  if (currentGame.stage === 'pegging') {
    countBadge.textContent = `Count: ${st.pegging.current_count} / 31`;
    const turnName = st.pegging.turn === 'A' ? nameA : nameB;
    turnBadge.textContent = `Turn: ${turnName} (Seat ${st.pegging.turn})`;
    turnBadge.style.color = st.pegging.turn === activeSeat ? '#86efac' : '#cbd5e1';

    if (st.pegging.current_play_pile && st.pegging.current_play_pile.length > 0) {
      pileRow.innerHTML = st.pegging.current_play_pile.map(item => `
        <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
          ${renderCardSvg(item.card, { width: 65, height: 95 })}
          <span style="font-size:0.75rem; font-weight:bold; color:${item.player === 'A' ? '#eab308' : '#38bdf8'};">Seat ${item.player}</span>
        </div>
      `).join('');
    } else {
      pileRow.innerHTML = '<span style="color:#94a3b8; font-size:0.85rem;">New count started. Waiting for lead card.</span>';
    }
  } else {
    countBadge.textContent = 'Count: - / 31';
    turnBadge.textContent = 'Turn: -';
    pileRow.innerHTML = '<span style="color:#94a3b8; font-size:0.85rem;">Not in pegging play.</span>';
  }

  // Render Opponent Hand
  const oppKey = activeSeat === 'A' ? 'b' : 'a';
  const oppName = activeSeat === 'A' ? nameB : nameA;
  document.getElementById('opponent-name-label').textContent = `Opponent (${oppName} - Seat ${oppKey.toUpperCase()})`;

  const oppCards = st.hands[oppKey] || [];
  const oppRow = document.getElementById('opponent-cards-row');
  oppRow.innerHTML = oppCards.map(c => renderCardSvg(c, { width: 65, height: 95 })).join('');

  // Render Player Hand
  const playerKey = activeSeat.toLowerCase();
  const playerName = activeSeat === 'A' ? nameA : nameB;
  document.getElementById('player-name-label').textContent = `Your Hand (${playerName} - Seat ${activeSeat})`;

  renderPlayerHandInteractive();

  // Render Show breakdown if in show or finished
  renderShowBreakdown();

  // Render Event Log
  renderEventLog();
}

function renderPlayerHandInteractive() {
  const playerKey = activeSeat.toLowerCase();
  const handCards = currentGame.state.hands[playerKey] || [];
  const playedCards = (currentGame.state.pegging && currentGame.state.pegging[`played_cards_${playerKey}`]) || [];
  const unplayedHand = handCards.filter(c => !playedCards.includes(c));

  const cardsRow = document.getElementById('player-cards-row');
  const instruction = document.getElementById('hand-instruction-label');
  const actionBar = document.getElementById('action-bar');
  actionBar.innerHTML = '';

  if (currentGame.stage === 'discard') {
    const hasDiscarded = currentGame.state.discards[playerKey] !== null;

    if (hasDiscarded) {
      instruction.textContent = 'You have discarded. Waiting for opponent...';
      cardsRow.innerHTML = handCards.map(c => renderCardSvg(c, { width: 80, height: 116 })).join('');
    } else {
      instruction.textContent = `Select 2 cards to discard into Dealer's Crib (${selectedCards.size}/2 selected)`;
      cardsRow.innerHTML = '';

      const discardBtn = document.createElement('button');
      discardBtn.className = 'btn-primary';
      discardBtn.textContent = 'Discard 2 Cards to Crib';
      discardBtn.disabled = selectedCards.size !== 2;
      discardBtn.addEventListener('click', () => {
        if (selectedCards.size === 2) {
          executeAction('discard', { cards: Array.from(selectedCards) });
        }
      });

      handCards.forEach(card => {
        const isSelected = selectedCards.has(card);
        const btn = document.createElement('button');
        btn.className = `card-btn${isSelected ? ' selected' : ''}`;
        btn.setAttribute('aria-pressed', isSelected);
        btn.setAttribute('aria-label', `Card ${card}${isSelected ? ', selected' : ''}`);
        btn.setAttribute('data-card', card);
        btn.innerHTML = renderCardSvg(card, { width: 80, height: 116, selected: isSelected });

        btn.addEventListener('click', () => {
          if (selectedCards.has(card)) {
            selectedCards.delete(card);
            btn.classList.remove('selected');
            btn.setAttribute('aria-pressed', 'false');
            btn.innerHTML = renderCardSvg(card, { width: 80, height: 116, selected: false });
          } else {
            if (selectedCards.size < 2) {
              selectedCards.add(card);
              btn.classList.add('selected');
              btn.setAttribute('aria-pressed', 'true');
              btn.innerHTML = renderCardSvg(card, { width: 80, height: 116, selected: true });
            }
          }
          instruction.textContent = `Select 2 cards to discard into Dealer's Crib (${selectedCards.size}/2 selected)`;
          discardBtn.disabled = selectedCards.size !== 2;
        });

        cardsRow.appendChild(btn);
      });

      actionBar.appendChild(discardBtn);
    }
  } else if (currentGame.stage === 'pegging') {
    const isMyTurn = currentGame.state.pegging.turn === activeSeat;
    const currentCount = currentGame.state.pegging.current_count;

    if (unplayedHand.length === 0) {
      instruction.textContent = 'All your cards have been played this hand.';
      cardsRow.innerHTML = '<span style="color:#94a3b8; font-size:0.85rem;">No cards remaining in hand.</span>';
    } else {
      instruction.textContent = isMyTurn ? 'Your turn: Click a legal card to play.' : 'Waiting for opponent to play...';
      cardsRow.innerHTML = '';

      let legalCardCount = 0;

      unplayedHand.forEach(card => {
        const val = getCardValue(card);
        const canPlay = isMyTurn && (currentCount + val <= 31);
        if (canPlay) legalCardCount++;

        const btn = document.createElement('button');
        btn.className = 'card-btn';
        btn.disabled = !canPlay;
        btn.setAttribute('aria-label', `Play card ${card} (value ${val})${!canPlay ? ' unplayable' : ''}`);
        btn.innerHTML = renderCardSvg(card, { width: 80, height: 116, disabled: !canPlay });

        if (canPlay) {
          btn.addEventListener('click', () => {
            executeAction('play_card', { card });
          });
        }

        cardsRow.appendChild(btn);
      });

      if (isMyTurn && legalCardCount === 0) {
        instruction.textContent = 'No playable cards under 31. Say Go!';
        const goBtn = document.createElement('button');
        goBtn.className = 'btn-primary';
        goBtn.textContent = 'Say Go';
        goBtn.addEventListener('click', () => {
          executeAction('go');
        });
        actionBar.appendChild(goBtn);
      }
    }
  } else if (currentGame.stage === 'show' || currentGame.stage === 'finished') {
    instruction.textContent = currentGame.stage === 'finished' ? 'Game Finished!' : 'Hand counting completed.';
    cardsRow.innerHTML = handCards.map(c => renderCardSvg(c, { width: 80, height: 116 })).join('');
  }
}

function getCardValue(card) {
  const norm = card.trim().toUpperCase();
  const r = norm[0] === '1' ? 'T' : norm[0];
  const vals = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 10, 'Q': 10, 'K': 10
  };
  return vals[r] || 0;
}

// --- Show Breakdown Rendering ---
function renderShowBreakdown() {
  const card = document.getElementById('show-breakdown-card');
  const sections = document.getElementById('show-breakdown-sections');
  const statusTag = document.getElementById('show-status-tag');
  const nextHandBtn = document.getElementById('btn-next-hand');

  if (!currentGame || !currentGame.state.show) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'flex';
  sections.innerHTML = '';

  const show = currentGame.state.show;
  const nameA = memberMap[currentGame.player_a] || currentGame.player_a;
  const nameB = memberMap[currentGame.player_b] || currentGame.player_b;

  if (currentGame.winner) {
    const winnerName = currentGame.winner === 'A' ? nameA : nameB;
    statusTag.textContent = `Winner: ${winnerName} (Seat ${currentGame.winner}) reaches 121!`;
    statusTag.style.color = '#86efac';
    nextHandBtn.style.display = 'none';
  } else {
    statusTag.textContent = 'Review counts, then start Next Hand';
    statusTag.style.color = '#fef08a';
    nextHandBtn.style.display = 'inline-block';
    nextHandBtn.onclick = () => executeAction('next_hand');
  }

  // 1. Non-dealer Hand
  if (show.non_dealer) {
    sections.appendChild(createShowSectionElement(
      `1. Non-Dealer Hand (${show.non_dealer.player === 'A' ? nameA : nameB} - Seat ${show.non_dealer.player})`,
      show.non_dealer.hand,
      show.non_dealer.result,
      show.non_dealer.score_after
    ));
  }

  // 2. Dealer Hand
  if (show.dealer) {
    sections.appendChild(createShowSectionElement(
      `2. Dealer Hand (${show.dealer.player === 'A' ? nameA : nameB} - Seat ${show.dealer.player})`,
      show.dealer.hand,
      show.dealer.result,
      show.dealer.score_after
    ));
  }

  // 3. Dealer Crib
  if (show.crib) {
    sections.appendChild(createShowSectionElement(
      `3. Dealer's Crib (${show.crib.player === 'A' ? nameA : nameB} - Seat ${show.crib.player})`,
      show.crib.hand,
      show.crib.result,
      show.crib.score_after,
      true
    ));
  }
}

function createShowSectionElement(title, cards, result, scoreAfter, isCrib = false) {
  const div = document.createElement('div');
  div.className = 'show-section';

  const cardsHtml = cards.map(c => renderCardSvg(c, { width: 50, height: 72 })).join('');
  const cutHtml = renderCardSvg(currentGame.state.cut, { width: 50, height: 72 });

  const b = result.breakdown;
  const rows = [];
  if (b.fifteens.points > 0) rows.push(`<tr><td>Fifteens (${b.fifteens.count} × 2)</td><td class="pts-cell">+${b.fifteens.points}</td></tr>`);
  if (b.pairs.points > 0) rows.push(`<tr><td>Pairs (${b.pairs.count} pairs)</td><td class="pts-cell">+${b.pairs.points}</td></tr>`);
  if (b.runs.points > 0) rows.push(`<tr><td>Runs (${b.runs.combinations.length} runs)</td><td class="pts-cell">+${b.runs.points}</td></tr>`);
  if (b.flush.points > 0) rows.push(`<tr><td>Flush (${b.flush.cards.length} cards)</td><td class="pts-cell">+${b.flush.points}</td></tr>`);
  if (b.nobs.points > 0) rows.push(`<tr><td>His Nobs (${b.nobs.card})</td><td class="pts-cell">+${b.nobs.points}</td></tr>`);
  if (rows.length === 0) rows.push(`<tr><td colspan="2" style="color:#94a3b8;">Nothing scored (0 pts)</td></tr>`);

  div.innerHTML = `
    <div class="show-section-title">
      <span>${title}</span>
      <span style="color:var(--accent-gold); font-size:1.1rem;">+${result.total} pts (Score: ${scoreAfter})</span>
    </div>
    <div style="display:flex; gap:12px; align-items:center; margin:4px 0;">
      <div style="display:flex; gap:4px;">${cardsHtml}</div>
      <span style="font-size:0.75rem; color:#94a3b8;">+ Cut:</span>
      <div>${cutHtml}</div>
    </div>
    <table class="breakdown-table">
      ${rows.join('')}
    </table>
  `;

  return div;
}

// --- Event Log ---
function renderEventLog() {
  const logBox = document.getElementById('event-log-box');
  if (!currentGame || !currentGame.state.events) {
    logBox.innerHTML = '<span style="color:#94a3b8; font-size:0.8rem;">No events recorded.</span>';
    return;
  }

  logBox.innerHTML = '';
  const evts = [...currentGame.state.events].reverse();
  evts.forEach(ev => {
    const entry = document.createElement('div');
    let cl = 'event-log-entry';
    if (ev.type === 'pegging_score' || ev.type === 'show_hand' || ev.type === 'show_crib' || ev.type === 'heels') {
      cl += ' score-event';
    } else if (ev.type === 'win') {
      cl += ' win-event';
    }
    entry.className = cl;
    entry.textContent = ev.text;
    logBox.appendChild(entry);
  });
}

// --- Scoring Bench Logic ---
function initScoringBench() {
  const btnCalc = document.getElementById('btn-bench-calc');
  btnCalc.addEventListener('click', calculateBenchScore);

  const btnPegCalc = document.getElementById('btn-peg-calc');
  btnPegCalc.addEventListener('click', calculatePeggingScore);

  // Auto update card previews on input change
  ['bench-c1', 'bench-c2', 'bench-c3', 'bench-c4', 'bench-cut'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateBenchPreview);
  });

  updateBenchPreview();
}

function updateBenchPreview() {
  const c1 = document.getElementById('bench-c1').value.trim();
  const c2 = document.getElementById('bench-c2').value.trim();
  const c3 = document.getElementById('bench-c3').value.trim();
  const c4 = document.getElementById('bench-c4').value.trim();
  const cut = document.getElementById('bench-cut').value.trim();

  const preview = document.getElementById('bench-cards-preview');
  preview.innerHTML = `
    ${renderCardSvg(c1, { width: 70, height: 100 })}
    ${renderCardSvg(c2, { width: 70, height: 100 })}
    ${renderCardSvg(c3, { width: 70, height: 100 })}
    ${renderCardSvg(c4, { width: 70, height: 100 })}
    <span style="font-size:0.85rem; color:#94a3b8; align-self:center;">+ Cut:</span>
    ${renderCardSvg(cut, { width: 70, height: 100 })}
  `;
}

async function calculateBenchScore() {
  const hand = [
    document.getElementById('bench-c1').value.trim(),
    document.getElementById('bench-c2').value.trim(),
    document.getElementById('bench-c3').value.trim(),
    document.getElementById('bench-c4').value.trim()
  ];
  const cut = document.getElementById('bench-cut').value.trim();
  const isCrib = document.getElementById('bench-crib').checked;

  try {
    const res = await fetch('/api/score/hand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hand, cut, crib: isCrib })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Scoring error');
    }

    renderBenchResult(data);
  } catch (err) {
    alert(`Scoring error: ${err.message}`);
  }
}

function renderBenchResult(data) {
  const resBox = document.getElementById('bench-score-result');
  const totalLabel = document.getElementById('bench-total-pts');
  const table = document.getElementById('bench-breakdown-table');

  resBox.style.display = 'block';
  totalLabel.textContent = `Total: ${data.total} pts`;

  const b = data.breakdown;
  const rows = [];
  if (b.fifteens.points > 0) {
    const desc = b.fifteens.combinations.map(c => c.join('+')).join(', ');
    rows.push(`<tr><td><strong>Fifteens</strong> (${desc})</td><td class="pts-cell">+${b.fifteens.points}</td></tr>`);
  }
  if (b.pairs.points > 0) {
    const desc = b.pairs.combinations.map(c => c.join('=')).join(', ');
    rows.push(`<tr><td><strong>Pairs</strong> (${desc})</td><td class="pts-cell">+${b.pairs.points}</td></tr>`);
  }
  if (b.runs.points > 0) {
    const desc = b.runs.combinations.map(c => c.join('-')).join(', ');
    rows.push(`<tr><td><strong>Runs</strong> (${desc})</td><td class="pts-cell">+${b.runs.points}</td></tr>`);
  }
  if (b.flush.points > 0) {
    rows.push(`<tr><td><strong>Flush</strong> (${b.flush.cards.join(', ')})</td><td class="pts-cell">+${b.flush.points}</td></tr>`);
  }
  if (b.nobs.points > 0) {
    rows.push(`<tr><td><strong>His Nobs</strong> (${b.nobs.card})</td><td class="pts-cell">+${b.nobs.points}</td></tr>`);
  }
  if (rows.length === 0) {
    rows.push(`<tr><td colspan="2" style="color:#94a3b8;">Nothing scored (0 points). The nineteen hand!</td></tr>`);
  }

  table.innerHTML = rows.join('');
}

function populateReferenceHandsList() {
  const list = document.getElementById('reference-hands-list');
  list.innerHTML = '';

  referenceHands.forEach((item, index) => {
    const btn = document.createElement('button');
    btn.className = 'ref-item-btn';
    btn.innerHTML = `
      <div>
        <strong>#${index + 1}: ${item.hand.join(' ')}</strong> + cut <strong>${item.cut}</strong> ${item.crib ? '(Crib)' : ''}
        <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">${item.rule}</div>
      </div>
      <div class="ref-pts">${item.total} pts</div>
    `;

    btn.addEventListener('click', () => {
      document.getElementById('bench-c1').value = item.hand[0];
      document.getElementById('bench-c2').value = item.hand[1];
      document.getElementById('bench-c3').value = item.hand[2];
      document.getElementById('bench-c4').value = item.hand[3];
      document.getElementById('bench-cut').value = item.cut;
      document.getElementById('bench-crib').checked = Boolean(item.crib);
      updateBenchPreview();
      calculateBenchScore();
    });

    list.appendChild(btn);
  });
}

async function calculatePeggingScore() {
  const inputStr = document.getElementById('peg-calc-input').value;
  const cards = inputStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

  if (cards.length === 0) {
    alert('Please enter at least one card code');
    return;
  }

  try {
    const res = await fetch('/api/score/pegging', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Pegging scoring error');
    }

    const out = document.getElementById('peg-calc-result');
    const reasonsStr = data.reasons.length > 0
      ? data.reasons.map(r => r.description).join(', ')
      : 'No points scored on this play.';

    out.innerHTML = `
      <div style="background:#0f172a; padding:10px; border-radius:6px; border:1px solid #334155;">
        <div><strong>Running Count:</strong> ${data.count} / 31</div>
        <div><strong>Points Scored:</strong> <span style="color:var(--accent-gold); font-weight:bold;">+${data.points} pts</span></div>
        <div style="font-size:0.85rem; color:#cbd5e1; margin-top:4px;"><strong>Reasons:</strong> ${reasonsStr}</div>
      </div>
    `;
  } catch (err) {
    alert(`Pegging score error: ${err.message}`);
  }
}

// --- Practice & New Game Logic ---
function populatePracticeForm() {
  const selA = document.getElementById('practice-player-a');
  const selB = document.getElementById('practice-player-b');
  selA.innerHTML = '';
  selB.innerHTML = '';

  membersList.forEach((m, idx) => {
    const optA = document.createElement('option');
    optA.value = m.no;
    optA.textContent = `${m.name} (${m.no}) - Won: ${m.won}/${m.played}`;
    if (idx === 0) optA.selected = true;
    selA.appendChild(optA);

    const optB = document.createElement('option');
    optB.value = m.no;
    optB.textContent = `${m.name} (${m.no}) - Won: ${m.won}/${m.played}`;
    if (idx === 1) optB.selected = true;
    selB.appendChild(optB);
  });

  const dealSelect = document.getElementById('practice-deal-select');
  dealSelect.addEventListener('change', () => {
    const k = dealSelect.value;
    const descBox = document.getElementById('practice-deal-desc');
    if (k && practiceDeals[k]) {
      const d = practiceDeals[k];
      descBox.style.display = 'block';
      descBox.innerHTML = `
        <strong>${d.name}</strong><br>
        Seat A hand: <code>${d.a ? d.a.join(' ') : 'Rotates'}</code><br>
        Seat B hand: <code>${d.b ? d.b.join(' ') : 'Rotates'}</code><br>
        Cut: <code>${d.cut || 'Rotates'}</code>
      `;
    } else {
      descBox.style.display = 'none';
    }
  });

  document.getElementById('btn-start-game').addEventListener('click', startNewGameFromForm);
}

async function startNewGameFromForm() {
  const playerA = document.getElementById('practice-player-a').value;
  const playerB = document.getElementById('practice-player-b').value;
  const practiceMode = document.getElementById('practice-deal-select').value || null;
  const startScoreA = parseInt(document.getElementById('practice-score-a').value, 10) || 0;
  const startScoreB = parseInt(document.getElementById('practice-score-b').value, 10) || 0;

  if (playerA === playerB) {
    alert('Please choose two different members for Seat A and Seat B.');
    return;
  }

  const actionId = generateUUID();
  const payload = {
    action_id: actionId,
    player_a: playerA,
    player_b: playerB,
    practice_mode: practiceMode,
    start_score_a: startScoreA,
    start_score_b: startScoreB
  };

  showBanner('Creating new game...', 'info');

  try {
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Action-Id': actionId
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create game');
    }

    clearBanner();
    currentGame = data;
    localStorage.setItem('activeGameId', data.id);
    switchTab('tab-table');
    renderGameTable();
  } catch (err) {
    showBanner(`Failed to start game: ${err.message}`, 'error');
  }
}

// --- Saved Games List ---
async function loadSavedGames() {
  try {
    const res = await fetch('/api/games');
    const data = await res.json();
    const tbody = document.getElementById('saved-games-tbody');
    tbody.innerHTML = '';

    if (!data.games || data.games.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8;">No saved games found.</td></tr>';
      return;
    }

    data.games.forEach(g => {
      const tr = document.createElement('tr');
      const nameA = g.player_a_name || g.player_a;
      const nameB = g.player_b_name || g.player_b;
      const dateStr = new Date(g.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      tr.innerHTML = `
        <td><strong>${g.id}</strong></td>
        <td>${nameA}</td>
        <td>${nameB}</td>
        <td><strong>${g.score_a} - ${g.score_b}</strong></td>
        <td>Seat ${g.dealer}</td>
        <td><span style="font-weight:bold; color:${g.stage === 'finished' ? '#86efac' : '#38bdf8'}">${g.stage.toUpperCase()}</span></td>
        <td>${g.practice_mode || 'Normal'}</td>
        <td style="font-size:0.8rem; color:#94a3b8;">${dateStr}</td>
        <td>
          <button class="btn-secondary resume-btn" data-id="${g.id}" style="padding:4px 10px; font-size:0.8rem;">
            Resume
          </button>
        </td>
      `;

      tr.querySelector('.resume-btn').addEventListener('click', () => {
        fetchGame(g.id, activeSeat);
        switchTab('tab-table');
      });

      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load saved games:', err);
  }
}

// --- Ladder & Match History ---
async function loadLadderAndHistory() {
  try {
    const [lRes, hRes] = await Promise.all([
      fetch('/api/ladder'),
      fetch('/api/history')
    ]);

    const lData = await lRes.json();
    const hData = await hRes.json();

    // Render Ladder
    const ladderTbody = document.getElementById('ladder-tbody');
    ladderTbody.innerHTML = '';
    (lData.members || []).forEach(m => {
      const winPct = m.played > 0 ? Math.round((m.won / m.played) * 100) : 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>${m.no}</code></td>
        <td><strong>${m.name}</strong></td>
        <td>${m.played}</td>
        <td><strong>${m.won}</strong></td>
        <td>${winPct}%</td>
      `;
      ladderTbody.appendChild(tr);
    });

    // Render History
    const histTbody = document.getElementById('history-tbody');
    histTbody.innerHTML = '';
    (hData.history || []).forEach(h => {
      const dName = h.dealer_name || h.dealer;
      const pName = h.pone_name || h.pone;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${h.id}</strong></td>
        <td>${dName}</td>
        <td>${pName}</td>
        <td><strong>${h.dealer_score} - ${h.pone_score}</strong></td>
        <td><span style="color:${h.finished ? '#86efac' : '#f59e0b'}">${h.finished ? 'Finished' : 'In Progress'}</span></td>
      `;
      histTbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load ladder & history:', err);
  }
}

// Clear log button
document.getElementById('btn-clear-log').addEventListener('click', () => {
  document.getElementById('event-log-box').innerHTML = '';
});

// App Initialization
window.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initSeatSwitcher();
  initScoringBench();
  loadInitialData();
});

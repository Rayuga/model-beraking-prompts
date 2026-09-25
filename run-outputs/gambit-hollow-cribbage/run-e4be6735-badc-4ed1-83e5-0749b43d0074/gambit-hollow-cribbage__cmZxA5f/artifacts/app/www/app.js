const app = {
  boot: null,
  game: null,
  viewer: localStorage.getItem('club.viewerSeat') || 'A',
  gameId: localStorage.getItem('club.gameId') || '',
  pending: loadPending(),
  saving: false,
  status: { text: 'Loading club table…', kind: 'info' },
  discardSelections: { A: new Set(), B: new Set() },
  bench: {
    example: '',
    hand: ['', '', '', ''],
    cut: '',
    crib: false,
    pile: '',
    card: '',
  },
  benchResult: null,
};

function loadPending() {
  try {
    const raw = localStorage.getItem('club.pendingAction');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePending(pending) {
  app.pending = pending;
  if (pending) localStorage.setItem('club.pendingAction', JSON.stringify(pending));
  else localStorage.removeItem('club.pendingAction');
  renderPending();
}

function setStatus(text, kind = 'info') {
  app.status = { text, kind };
  const node = document.getElementById('status');
  if (node) {
    node.className = `status ${kind}`;
    node.textContent = text;
  }
}

function setViewer(seat) {
  app.viewer = seat === 'B' ? 'B' : 'A';
  localStorage.setItem('club.viewerSeat', app.viewer);
  renderSeatButtons();
  if (app.gameId) {
    loadGame(app.gameId, { keepMessage: true });
  } else {
    renderGame();
  }
}

function resetSelections() {
  app.discardSelections.A = new Set();
  app.discardSelections.B = new Set();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function suitSymbol(suit) {
  return { S: '♠', H: '♥', D: '♦', C: '♣' }[suit] || suit;
}

function suitColor(suit) {
  return suit === 'H' || suit === 'D' ? '#d24a43' : '#1f2b23';
}

function cardLabel(code) {
  return `${code[0]}${suitSymbol(code[1])}`;
}

function cardSvg(code, hidden = false) {
  if (hidden) {
    return `
      <svg class="card" viewBox="0 0 92 132" aria-hidden="true">
        <rect x="1" y="1" width="90" height="130" rx="12" fill="#27406f" stroke="#f5efe3" stroke-width="2"></rect>
        <rect x="10" y="10" width="72" height="112" rx="10" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"></rect>
        <path d="M14 18l64 96M14 40l44 66M34 18l44 66M14 62l64 48" stroke="rgba(255,255,255,0.18)" stroke-width="3"></path>
        <circle cx="46" cy="66" r="18" fill="rgba(255,255,255,0.16)"></circle>
        <text x="46" y="74" text-anchor="middle" font-size="18" fill="#fff" font-weight="700">?</text>
      </svg>`;
  }
  const rank = code[0];
  const suit = code[1];
  const glyph = suitSymbol(suit);
  const color = suitColor(suit);
  return `
    <svg class="card" viewBox="0 0 92 132" aria-hidden="true">
      <rect x="1" y="1" width="90" height="130" rx="12" fill="#fff6ea" stroke="#30271e" stroke-width="2"></rect>
      <text x="13" y="23" font-size="18" font-weight="700" fill="${color}">${rank}</text>
      <text x="13" y="40" font-size="18" fill="${color}">${glyph}</text>
      <text x="79" y="119" font-size="18" font-weight="700" fill="${color}" text-anchor="end" transform="rotate(180 79 119)">${rank}</text>
      <text x="79" y="102" font-size="18" fill="${color}" text-anchor="end" transform="rotate(180 79 102)">${glyph}</text>
      <text x="46" y="78" text-anchor="middle" font-size="34" fill="${color}" font-weight="700">${glyph}</text>
    </svg>`;
}

function renderCardButton(code, { selectable = false, selected = false, action = 'discard', disabled = false, label = '' } = {}) {
  const title = label || cardLabel(code);
  const actionAttr = action === 'play' ? `data-play-card="${code}"` : `data-discard-card="${code}"`;
  const cls = ['card-btn'];
  if (selected) cls.push('selected');
  if (disabled) cls.push('disabled');
  return `
    <button type="button" class="${cls.join(' ')}" aria-label="${escapeHtml(title)}" ${selectable ? actionAttr : ''} ${disabled ? 'disabled' : ''}>
      <div class="card-wrap">
        ${cardSvg(code, false)}
        <span class="card-caption">${escapeHtml(title)}</span>
      </div>
    </button>`;
}

function renderFaceDownCards(count, caption = '') {
  const cards = [];
  for (let i = 0; i < count; i += 1) cards.push(cardSvg(`back-${i}`, true));
  return `
    <div class="hidden-hand">
      <div class="card-grid" style="grid-template-columns: repeat(auto-fit, minmax(64px, 64px)); gap: 0.35rem;">${cards.map((svg) => `<div>${svg}</div>`).join('')}</div>
      <span class="small">${escapeHtml(caption || `${count} cards face down`)}</span>
    </div>`;
}

function formatBreakdown(score) {
  const b = score.breakdown || {};
  const parts = [];
  if (b.fifteens) parts.push(`fifteens ${b.fifteens}`);
  if (b.pairs) parts.push(`pairs ${b.pairs}`);
  if (b.runs) parts.push(`runs ${b.runs}`);
  if (b.flush) parts.push(`flush ${b.flush}`);
  if (b.nobs) parts.push(`nobs ${b.nobs}`);
  return parts.length ? parts.join(', ') : 'nothing scores';
}

function formatPegBreakdown(breakdown) {
  const parts = [];
  if (breakdown.fifteen) parts.push(`15=${breakdown.fifteen}`);
  if (breakdown.thirtyOne) parts.push(`31=${breakdown.thirtyOne}`);
  if (breakdown.pairs) parts.push(`pairs ${breakdown.pairs}`);
  if (breakdown.runs) parts.push(`runs ${breakdown.runs}`);
  return parts.length ? parts.join(', ') : 'no score';
}

function scoreToX(score) {
  const minX = 72;
  const maxX = 1128;
  return minX + ((maxX - minX) * Math.max(0, Math.min(121, score))) / 121;
}

function renderPegBoard(game) {
  const width = 1200;
  const height = 220;
  if (!game) {
    return `
      <div class="board">
        <div class="board-top">
          <div class="board-stat"><span class="small">No game selected</span><span class="value">Start or open a game</span></div>
        </div>
        <svg class="peg-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Empty cribbage board"></svg>
      </div>`;
  }
  const players = [game.players.A, game.players.B];
  const rows = [70, 150];
  const pegRows = players.map((player, index) => {
    const y = rows[index];
    const current = player.pegs[1];
    const previous = player.pegs[0];
    return `
      <g>
        <text x="20" y="${y + 6}" fill="#bfd0c3" font-size="15" font-weight="700">${escapeHtml(player.name)}</text>
        <line x1="72" y1="${y}" x2="1128" y2="${y}" stroke="rgba(255,255,255,0.18)" stroke-width="8" stroke-linecap="round"></line>
        ${Array.from({ length: 122 }, (_, score) => {
          const x = scoreToX(score);
          const emphasis = score % 10 === 0 ? 3.4 : 2;
          return `<circle cx="${x.toFixed(1)}" cy="${y}" r="${emphasis}" fill="rgba(255,255,255,0.25)"></circle>`;
        }).join('')}
        ${Array.from({ length: 13 }, (_, i) => {
          const score = i * 10;
          const x = scoreToX(score);
          return `<text x="${x.toFixed(1)}" y="${y - 14}" text-anchor="middle" font-size="11" fill="#bfd0c3">${score}</text>`;
        }).join('')}
        <circle cx="${scoreToX(previous).toFixed(1)}" cy="${y - 9}" r="7" fill="#f3c96a" stroke="#4c3811" stroke-width="2"></circle>
        <circle cx="${scoreToX(current).toFixed(1)}" cy="${y + 9}" r="7" fill="#8fd4a8" stroke="#1f4730" stroke-width="2"></circle>
        <text x="1146" y="${y + 6}" fill="#f3c96a" font-size="15" font-weight="700">${current}</text>
      </g>`;
  }).join('');

  return `
    <div class="board">
      <div class="board-top">
        <div class="board-stat"><span class="small">Hand</span><span class="value">${game.handNumber}</span></div>
        <div class="board-stat"><span class="small">Dealer</span><span class="value">${escapeHtml(game.dealerName)}</span></div>
        <div class="board-stat"><span class="small">Turn</span><span class="value">${escapeHtml(game.turnName)}</span></div>
        <div class="board-stat"><span class="small">Count</span><span class="value">${game.count}</span></div>
      </div>
      <svg class="peg-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Cribbage peg board">
        <rect x="8" y="18" width="1184" height="184" rx="20" fill="#214f36" stroke="rgba(255,255,255,0.12)"></rect>
        ${pegRows}
      </svg>
    </div>`;
}

function renderGameActions(game) {
  if (!game) {
    return `<div class="info">Open a saved table or start a new game to begin.</div>`;
  }
  if (game.status === 'finished') {
    const winner = game.winner === 'A' ? game.players.A.name : game.players.B.name;
    return `
      <div class="notice">
        <strong>${escapeHtml(winner)}</strong> has won the game. The table is locked until you start another one.
      </div>`;
  }

  const viewer = game.players[app.viewer];
  const seat = app.viewer;
  const ownHand = viewer.hand || [];
  const opponent = game.players[seat === 'A' ? 'B' : 'A'];
  const canDiscard = game.phase === 'discard';
  const canPlay = game.phase === 'play' && game.turn === seat;
  const selection = app.discardSelections[seat] || new Set();
  const selectedCards = Array.from(selection);
  const legal = new Set(game.legalCards || []);

  let controls = '';
  if (canDiscard) {
    controls = `
      <div class="row between">
        <div class="small">Select exactly two cards from your own hand, then discard them.</div>
        <button type="button" data-action-discard ${selectedCards.length === 2 ? '' : 'disabled'}>Discard selected</button>
      </div>`;
  } else if (canPlay) {
    if (game.legalCards.length) {
      controls = `<div class="small">Tap a legal card to play it. Count must stay at 31 or below.</div>`;
    } else if (game.canGo) {
      controls = `
        <div class="row between">
          <div class="small">No legal card fits. Say go to pass the count.</div>
          <button type="button" data-action-go>Go</button>
        </div>`;
    } else {
      controls = `<div class="small">Waiting for the other seat.</div>`;
    }
  } else if (game.phase === 'show') {
    controls = `<div class="row between"><div class="small">Show complete. Start the next hand when ready.</div><button type="button" data-action-next-hand>Next hand</button></div>`;
  }

  return `
    <div class="grid-two">
      <div class="player-cards">
        ${renderSeatBox('A', game, seat, legal, selectedCards)}
        ${renderSeatBox('B', game, seat, legal, selectedCards)}
      </div>
      <div class="stack">
        <div class="player-box">
          <div class="player-head"><strong>Crib</strong><span class="small">${game.crib.reveal ? 'revealed' : 'face down'}</span></div>
          <div class="card-grid">
            ${renderCribCards(game, seat)}
          </div>
        </div>
        <div class="player-box">
          <div class="player-head"><strong>Turn and play</strong><span class="small">Revision ${game.revision}</span></div>
          <div class="small">Phase: ${escapeHtml(game.phase)} · Dealer: ${escapeHtml(game.dealerName)} · Turn: ${escapeHtml(game.turnName)} · Cut: ${game.cut ? escapeHtml(cardLabel(game.cut)) : 'hidden'}</div>
          <div style="margin-top:0.75rem">${controls}</div>
        </div>
        <div class="player-box">
          <div class="player-head"><strong>Played cards</strong><span class="small">Public pegging pile</span></div>
          <div class="card-grid">
            ${game.pile.length ? game.pile.map((code) => `<div class="card-wrap">${cardSvg(code, false)}<span class="card-caption">${escapeHtml(cardLabel(code))}</span></div>`).join('') : '<div class="small">No cards on the pile yet.</div>'}
          </div>
        </div>
      </div>
    </div>
    ${game.showBreakdown && game.showBreakdown.length ? renderShowBreakdown(game) : ''}
    ${renderActionLog(game)}
  `;
}

function renderSeatBox(seat, game, viewerSeat, legal, selectedCards) {
  const player = game.players[seat];
  const reveal = player.reveal;
  const isViewer = seat === viewerSeat;
  const title = `${player.name} · Seat ${seat}`;
  const scoreText = `${player.score} points`;
  let cardsHtml = '';
  if (reveal) {
    const hand = player.hand || [];
    if (game.phase === 'discard') {
      cardsHtml = `
        <div class="card-grid">
          ${hand.length ? hand.map((code) => renderSeatCard(code, seat, game, isViewer, legal, selectedCards)).join('') : '<div class="small">No cards left.</div>'}
        </div>`;
    } else if (game.phase === 'play') {
      cardsHtml = `
        <div class="card-grid">
          ${hand.length ? hand.map((code) => renderSeatCard(code, seat, game, isViewer, legal, selectedCards)).join('') : '<div class="small">No cards left.</div>'}
        </div>`;
      if (game.turn === seat && game.phase === 'play') {
        cardsHtml += `<div class="small" style="margin-top:0.4rem">${legal.size ? 'Legal cards are clickable.' : 'No legal card fits right now.'}</div>`;
      }
    } else {
      cardsHtml = `<div class="card-grid">${hand.length ? hand.map((code) => `<div class="card-wrap">${cardSvg(code, false)}<span class="card-caption">${escapeHtml(cardLabel(code))}</span></div>`).join('') : '<div class="small">No cards.</div>'}</div>`;
    }
  } else {
    cardsHtml = renderFaceDownCards(player.handCount, `${player.handCount} cards hidden`);
  }

  const discards = game.crib.reveal || isViewer ? player.discards || [] : [];
  const discardHtml = discards.length
    ? `<div class="small" style="margin-top:0.6rem">Discarded: ${discards.map(escapeHtml).join(' ')}</div>`
    : '';

  const played = player.playedCards && player.playedCards.length
    ? `<div class="small" style="margin-top:0.45rem">Played: ${player.playedCards.map(escapeHtml).join(' ')}</div>`
    : '';

  return `
    <div class="player-box">
      <div class="player-head">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <div class="small">Played ${player.played} · Won ${player.won} · Pegs ${player.pegs[0]} → ${player.pegs[1]}</div>
        </div>
        <div>${scoreText}</div>
      </div>
      <div class="small">${reveal ? 'Hand visible' : 'Hand hidden from this seat view'}</div>
      <div style="margin-top:0.6rem">${cardsHtml}</div>
      ${discardHtml}
      ${played}
    </div>`;
}

function renderSeatCard(code, seat, game, isViewer, legal, selectedCards) {
  if (game.phase === 'discard' && isViewer && seat === app.viewer) {
    const selected = selectedCards.includes(code);
    return renderCardButton(code, { selectable: true, selected, action: 'discard', label: cardLabel(code) });
  }
  if (game.phase === 'play' && isViewer && seat === app.viewer && game.turn === seat && legal.has(code)) {
    return renderCardButton(code, { selectable: true, action: 'play', label: cardLabel(code) });
  }
  return `<div class="card-wrap">${cardSvg(code, false)}<span class="card-caption">${escapeHtml(cardLabel(code))}</span></div>`;
}

function renderCribCards(game, viewerSeat) {
  if (game.crib.reveal) {
    const cards = game.crib.cards || [];
    return cards.length ? cards.map((code) => `<div class="card-wrap">${cardSvg(code, false)}<span class="card-caption">${escapeHtml(cardLabel(code))}</span></div>`).join('') : '<div class="small">No crib cards yet.</div>';
  }
  const own = game.crib.knownByViewer || [];
  const oppCount = (game.players.A.discards || []).length + (game.players.B.discards || []).length - own.length;
  const known = own.map((code) => `<div class="card-wrap">${cardSvg(code, false)}<span class="card-caption">${escapeHtml(cardLabel(code))}</span></div>`).join('');
  const hidden = oppCount > 0 ? renderFaceDownCards(oppCount, `${oppCount} hidden from Seat ${viewerSeat}`) : '';
  return `${known}${hidden}` || '<div class="small">Crib will be revealed at the show.</div>';
}

function renderShowBreakdown(game) {
  const rows = game.showBreakdown.map((entry) => {
    const label = entry.seat === 'crib' ? 'Crib' : `${entry.name} (${entry.seat === game.dealer ? 'dealer' : 'non-dealer'})`;
    return `
      <div class="log-item">
        <div class="row between"><strong>${escapeHtml(label)}</strong><span>${entry.score.total} points</span></div>
        <div class="small">${escapeHtml(formatBreakdown(entry.score))}</div>
      </div>`;
  }).join('');
  return `
    <div class="player-box" style="margin-top:0.9rem">
      <div class="player-head"><strong>Show breakdown</strong><span class="small">Non-dealer, dealer, crib</span></div>
      <div class="log">${rows}</div>
    </div>`;
}

function renderActionLog(game) {
  const events = (game.events || []).slice().reverse().slice(0, 10);
  return `
    <div class="player-box" style="margin-top:0.9rem">
      <div class="player-head"><strong>Commentary</strong><span class="small">Latest events</span></div>
      <div class="log">
        ${events.length ? events.map((event) => `<div class="log-item"><div class="small">${escapeHtml(event.at || '')}</div><div>${escapeHtml(event.text || '')}</div></div>`).join('') : '<div class="small">No commentary yet.</div>'}
      </div>
    </div>`;
}

function renderOpenGames() {
  const host = document.getElementById('open-games');
  if (!host) return;
  const games = (app.boot && app.boot.openGames) || [];
  if (!games.length) {
    host.innerHTML = '<div class="info">No open games yet. Start a fresh table below.</div>';
    return;
  }
  host.innerHTML = games.map((game) => {
    const selected = game.id === app.gameId;
    return `
      <button type="button" class="player-box" data-open-game="${game.id}" style="text-align:left; width:100%; ${selected ? 'border-color: var(--accent);' : ''}">
        <div class="row between"><strong>${escapeHtml(game.id)}</strong><span class="small">rev ${game.revision}</span></div>
        <div class="small">${escapeHtml(game.names.A)} vs ${escapeHtml(game.names.B)} · ${escapeHtml(game.phase)} · Hand ${game.handNumber}</div>
        <div class="small">Dealer: ${escapeHtml(game.names[game.dealer])} · Count ${game.count} · Scores ${game.scores.A}-${game.scores.B}</div>
      </button>`;
  }).join('');
}

function renderSeatButtons() {
  const a = document.getElementById('seat-a');
  const b = document.getElementById('seat-b');
  if (a) a.classList.toggle('active', app.viewer === 'A');
  if (b) b.classList.toggle('active', app.viewer === 'B');
}

function renderPending() {
  const box = document.getElementById('pending-box');
  if (!box) return;
  if (!app.pending) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const label = app.pending.body?.type || 'pending action';
  box.hidden = false;
  box.innerHTML = `
    <span>Pending save: ${escapeHtml(label)}</span>
    <button type="button" data-pending-retry>Retry</button>`;
}

function renderNewGameForm() {
  const host = document.getElementById('new-game-form');
  const members = (app.boot && app.boot.members) || [];
  const practices = app.boot ? Object.keys(app.boot.practices || {}).filter((key) => key !== '_note') : [];
  const optionsA = members.map((member, index) => `<option value="${escapeHtml(member.no)}"${index === 0 ? ' selected' : ''}>${escapeHtml(member.no)} · ${escapeHtml(member.name)}</option>`).join('');
  const optionsB = members.map((member, index) => `<option value="${escapeHtml(member.no)}"${index === 1 ? ' selected' : ''}>${escapeHtml(member.no)} · ${escapeHtml(member.name)}</option>`).join('');
  const practiceOptions = ['<option value="">Normal game</option>'].concat(practices.map((key) => `<option value="${escapeHtml(key)}">Practice: ${escapeHtml(app.boot.practices[key].name || key)}</option>`)).join('');
  if (!host) return;
  host.innerHTML = `
    <form id="new-game-form-el" class="stack">
      <div class="form-grid three">
        <div class="field">
          <label for="member-a">Seat A member</label>
          <select id="member-a" name="memberA">${optionsA}</select>
        </div>
        <div class="field">
          <label for="member-b">Seat B member</label>
          <select id="member-b" name="memberB">${optionsB}</select>
        </div>
        <div class="field">
          <label for="dealer">Dealer for hand one</label>
          <select id="dealer" name="dealer">
            <option value="A">Seat A</option>
            <option value="B">Seat B</option>
          </select>
        </div>
      </div>
      <div class="form-grid three">
        <div class="field">
          <label for="practice">Deal</label>
          <select id="practice" name="practice">${practiceOptions}</select>
        </div>
        <div class="field">
          <label for="score-a">Seat A score</label>
          <input id="score-a" name="scoreA" type="number" min="0" max="120" value="0">
        </div>
        <div class="field">
          <label for="score-b">Seat B score</label>
          <input id="score-b" name="scoreB" type="number" min="0" max="120" value="0">
        </div>
      </div>
      <div class="row between">
        <div class="small">Practice starts may begin near 121 for finish drills.</div>
        <button type="submit" ${app.saving ? 'disabled' : ''}>Start game</button>
      </div>
    </form>`;
}

function renderBoard() {
  const host = document.getElementById('board');
  if (!host) return;
  host.innerHTML = renderPegBoard(app.game);
}

function renderGame() {
  const host = document.getElementById('game-view');
  if (!host) return;
  if (!app.game) {
    host.innerHTML = `
      <div class="player-box">
        <div class="player-head"><strong>No game loaded</strong><span class="small">Choose one or start fresh</span></div>
        <div class="small">Open a saved game on the left or start a new deal. The table will preserve the crib, cut, scores, turn and revision across reloads.</div>
      </div>`;
    return;
  }
  host.innerHTML = renderGameActions(app.game);
}

function renderBench() {
  const host = document.getElementById('bench');
  if (!host) return;
  const examples = (app.boot && app.boot.scoredHands) || [];
  const exampleOptions = ['<option value="">Choose a reference example</option>'].concat(examples.map((example, index) => {
    const name = `${example.total} points · ${example.hand.join(' ')} / ${example.cut}`;
    const selected = String(index) === app.bench.example ? ' selected' : '';
    return `<option value="${index}"${selected}>${escapeHtml(name)} — ${escapeHtml(example.rule)}</option>`;
  })).join('');
  host.innerHTML = `
    <div class="stack">
      <div class="notice">Scoring bench: enter four cards and a cut, then score hand or crib without touching any game.</div>
      <div class="field">
        <label for="bench-example">Reference example</label>
        <select id="bench-example">${exampleOptions}</select>
      </div>
      <form id="bench-hand-form" class="stack">
        <div class="form-grid three">
          <div class="field"><label>Card 1</label><input name="hand1" maxlength="2" value="${escapeHtml(app.bench.hand[0])}"></div>
          <div class="field"><label>Card 2</label><input name="hand2" maxlength="2" value="${escapeHtml(app.bench.hand[1])}"></div>
          <div class="field"><label>Card 3</label><input name="hand3" maxlength="2" value="${escapeHtml(app.bench.hand[2])}"></div>
        </div>
        <div class="form-grid three">
          <div class="field"><label>Card 4</label><input name="hand4" maxlength="2" value="${escapeHtml(app.bench.hand[3])}"></div>
          <div class="field"><label>Cut</label><input name="cut" maxlength="2" value="${escapeHtml(app.bench.cut)}"></div>
          <div class="field">
            <label>Crib?</label>
            <select name="crib">
              <option value="false" ${app.bench.crib ? '' : 'selected'}>Hand</option>
              <option value="true" ${app.bench.crib ? 'selected' : ''}>Crib</option>
            </select>
          </div>
        </div>
        <div class="row between">
          <div class="small">Hand example totals and show breakdowns appear below.</div>
          <button type="submit">Score hand</button>
        </div>
      </form>
      <form id="bench-pegging-form" class="stack">
        <div class="field">
          <label for="bench-pile">Pegging pile</label>
          <textarea id="bench-pile" name="pile" placeholder="7H TH 2S">${escapeHtml(app.bench.pile)}</textarea>
        </div>
        <div class="form-grid three">
          <div class="field"><label>Next card</label><input name="card" maxlength="2" value="${escapeHtml(app.bench.card)}"></div>
          <div class="field"><label>Action</label><input value="Current count and next card" disabled></div>
          <div class="field"><label>&nbsp;</label><button type="submit">Score pegging</button></div>
        </div>
      </form>
      <div id="bench-results" class="bench-results">${renderBenchResults()}</div>
    </div>`;
}

function renderBenchResults() {
  if (!app.benchResult) {
    return '<div class="info">Bench results will appear here after scoring.</div>';
  }
  const result = app.benchResult;
  if (result.mode === 'hand') {
    return `
      <div class="player-box">
        <div class="player-head"><strong>Hand result</strong><span>${result.total ?? '…'} points</span></div>
        <div class="small">${escapeHtml((result.hand || []).join(' '))} / ${escapeHtml(result.cut || '')}${result.crib ? ' · crib' : ''}</div>
        <div class="small">${result.breakdown ? escapeHtml(formatBreakdown(result)) : 'Scoring example loaded.'}</div>
      </div>`;
  }
  return `
    <div class="player-box">
      <div class="player-head"><strong>Pegging result</strong><span>${result.points} points</span></div>
      <div class="small">Count ${result.countBefore} → ${result.countAfter} · ${escapeHtml((result.pile || []).join(' '))} + ${escapeHtml(result.card || '')}</div>
      <div class="small">${escapeHtml((result.reasons || []).join(', ') || 'no score')} · ${escapeHtml(formatPegBreakdown(result.breakdown || {}))}</div>
    </div>`;
}

function renderLadder() {
  const host = document.getElementById('ladder');
  if (!host) return;
  const members = (app.boot && app.boot.members) || [];
  const history = (app.boot && app.boot.history) || [];
  host.innerHTML = `
    <div class="stack">
      <div>
        <h3>Members</h3>
        <table class="table">
          <thead><tr><th>No</th><th>Name</th><th>Played</th><th>Won</th></tr></thead>
          <tbody>
            ${members.map((member) => `<tr><td>${escapeHtml(member.no)}</td><td>${escapeHtml(member.name)}</td><td>${member.played}</td><td>${member.won}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div>
        <h3>History</h3>
        <table class="table">
          <thead><tr><th>Record</th><th>Kind</th><th>Summary</th></tr></thead>
          <tbody>
            ${history.slice(0, 8).map((row) => `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.summary.finished ? `${row.summary.dealerName} beat ${row.summary.poneName} ${row.summary.dealer_score}-${row.summary.pone_score}` : JSON.stringify(row.summary))}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderAll() {
  renderSeatButtons();
  renderPending();
  renderOpenGames();
  renderNewGameForm();
  renderBoard();
  renderGame();
  renderBench();
  renderLadder();
  setStatus(app.status.text, app.status.kind);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || `Request failed: ${response.status}`);
    error.data = data;
    error.status = response.status;
    throw error;
  }
  return data;
}

async function loadBootstrap() {
  app.boot = await fetchJson('/api/bootstrap');
  if (!app.gameId && app.boot.openGames && app.boot.openGames.length) {
    app.gameId = app.boot.openGames[0].id;
  }
  if (!app.bench.example && app.boot.scoredHands && app.boot.scoredHands.length) {
    applyBenchExample(0, false);
  }
  renderAll();
  if (app.gameId) {
    await loadGame(app.gameId, { keepMessage: false });
  } else {
    setStatus('Choose a saved game or start a new one.', 'info');
  }
}

async function loadGame(gameId, { keepMessage = false } = {}) {
  if (!gameId) return;
  app.gameId = gameId;
  localStorage.setItem('club.gameId', gameId);
  if (!keepMessage) setStatus(`Loading game ${gameId}…`, 'info');
  const data = await fetchJson(`/api/games/${encodeURIComponent(gameId)}?viewer=${app.viewer}`);
  app.game = data.game;
  resetSelections();
  renderAll();
  setStatus(`Loaded ${gameId}. ${app.game.phase === 'finished' ? 'The game is finished.' : 'The table is ready.'}`, 'info');
}

function buildStartBody(form) {
  const formData = new FormData(form);
  const practice = formData.get('practice') || '';
  const members = {
    A: String(formData.get('memberA') || ''),
    B: String(formData.get('memberB') || ''),
  };
  const scores = {
    A: Number(formData.get('scoreA') || 0),
    B: Number(formData.get('scoreB') || 0),
  };
  const body = {
    actionId: crypto.randomUUID(),
    mode: practice ? 'practice' : 'normal',
    practiceKey: practice || null,
    members,
    scores,
    dealer: String(formData.get('dealer') || 'A'),
  };
  return body;
}

async function startGame(form) {
  const body = buildStartBody(form);
  if (app.saving) return;
  app.saving = true;
  savePending({ url: '/api/games', body, label: 'create game', gameId: '' });
  renderAll();
  try {
    const data = await fetchJson('/api/games', { method: 'POST', body: JSON.stringify(body) });
    savePending(null);
    app.gameId = data.game.id;
    localStorage.setItem('club.gameId', app.gameId);
    app.game = data.game;
    resetSelections();
    setStatus(`Started ${data.game.kind} game ${data.game.id}.`, 'notice');
    renderAll();
  } catch (error) {
    setStatus(error.message, 'error');
    renderAll();
  } finally {
    app.saving = false;
    renderAll();
  }
}

async function submitAction(type, extra = {}) {
  if (!app.game || app.saving) return;
  const seat = app.viewer;
  const body = {
    actionId: crypto.randomUUID(),
    expectedRevision: app.game.revision,
    seat,
    type,
    ...extra,
  };
  app.saving = true;
  savePending({ url: `/api/games/${app.game.id}/actions`, body, label: type, gameId: app.game.id });
  renderAll();
  try {
    const data = await fetchJson(`/api/games/${app.game.id}/actions`, { method: 'POST', body: JSON.stringify(body) });
    savePending(null);
    app.game = data.game;
    resetSelections();
    setStatus(data.note || `${type} accepted.`, 'notice');
    renderAll();
  } catch (error) {
    if (error.data && error.data.currentRevision != null && error.data.game) {
      app.game = error.data.game;
      localStorage.setItem('club.gameId', app.game.id);
      resetSelections();
      setStatus(error.message, 'error');
      renderAll();
    } else {
      setStatus(error.message, 'error');
      renderAll();
    }
  } finally {
    app.saving = false;
    renderAll();
  }
}

function discardSelectionToggle(card) {
  if (!app.game || app.saving) return;
  const seat = app.viewer;
  const phase = app.game.phase;
  if (phase !== 'discard') return;
  const set = app.discardSelections[seat] || new Set();
  if (set.has(card)) set.delete(card);
  else {
    if (set.size >= 2) return;
    set.add(card);
  }
  app.discardSelections[seat] = set;
  renderAll();
}

async function discardSelected() {
  if (!app.game) return;
  const seat = app.viewer;
  const cards = Array.from(app.discardSelections[seat] || []);
  if (cards.length !== 2) {
    setStatus('Select exactly two cards to discard.', 'error');
    return;
  }
  await submitAction('discard', { cards });
}

async function retryPending() {
  if (!app.pending || app.saving) return;
  const label = app.pending.label || 'pending action';
  app.saving = true;
  renderAll();
  try {
    const data = await fetchJson(app.pending.url, { method: 'POST', body: JSON.stringify(app.pending.body) });
    savePending(null);
    if (data.game) {
      app.game = data.game;
      localStorage.setItem('club.gameId', data.game.id);
    }
    resetSelections();
    setStatus(`${label} confirmed.`, 'notice');
    renderAll();
  } catch (error) {
    setStatus(error.message, 'error');
    renderAll();
  } finally {
    app.saving = false;
    renderAll();
  }
}

async function scoreBenchHand(form) {
  const formData = new FormData(form);
  const hand = [formData.get('hand1'), formData.get('hand2'), formData.get('hand3'), formData.get('hand4')].map((card) => String(card || '').trim().toUpperCase());
  const cut = String(formData.get('cut') || '').trim().toUpperCase();
  const crib = String(formData.get('crib') || 'false') === 'true';
  const body = { hand, cut, crib };
  try {
    const data = await fetchJson('/api/score/hand', { method: 'POST', body: JSON.stringify(body) });
    app.bench.hand = hand;
    app.bench.cut = cut;
    app.bench.crib = crib;
    app.benchResult = { ...data, mode: 'hand' };
    setStatus(`Bench hand scored: ${data.total} points.`, 'notice');
    renderAll();
  } catch (error) {
    setStatus(error.message, 'error');
    renderAll();
  }
}

async function scoreBenchPegging(form) {
  const formData = new FormData(form);
  const pile = String(formData.get('pile') || '')
    .split(/[\s,]+/)
    .map((card) => card.trim().toUpperCase())
    .filter(Boolean);
  const card = String(formData.get('card') || '').trim().toUpperCase();
  const body = { pile, card };
  try {
    const data = await fetchJson('/api/score/pegging', { method: 'POST', body: JSON.stringify(body) });
    app.bench.pile = pile.join(' ');
    app.bench.card = card;
    app.benchResult = { ...data, mode: 'peg' };
    setStatus(`Pegging bench scored: ${data.points} points.`, 'notice');
    renderAll();
  } catch (error) {
    setStatus(error.message, 'error');
    renderAll();
  }
}

function applyBenchExample(index, scoreIt = true) {
  if (!app.boot || !app.boot.scoredHands || !app.boot.scoredHands[index]) return;
  const example = app.boot.scoredHands[index];
  app.bench.example = String(index);
  app.bench.hand = example.hand.slice();
  app.bench.cut = example.cut;
  app.bench.crib = !!example.crib;
  app.benchResult = scoreIt ? { mode: 'hand', hand: example.hand.slice(), cut: example.cut, crib: !!example.crib, total: example.total, breakdown: null } : app.benchResult;
  const handForm = document.getElementById('bench-hand-form');
  if (handForm) {
    handForm.elements.hand1.value = example.hand[0];
    handForm.elements.hand2.value = example.hand[1];
    handForm.elements.hand3.value = example.hand[2];
    handForm.elements.hand4.value = example.hand[3];
    handForm.elements.cut.value = example.cut;
    handForm.elements.crib.value = String(!!example.crib);
  }
  if (scoreIt) {
    scoreBenchHand(document.getElementById('bench-hand-form'));
  } else {
    renderAll();
  }
}

function bindEvents() {
  document.getElementById('seat-a')?.addEventListener('click', () => setViewer('A'));
  document.getElementById('seat-b')?.addEventListener('click', () => setViewer('B'));

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-open-game], [data-discard-card], [data-play-card], [data-action-discard], [data-action-go], [data-action-next-hand], [data-pending-retry]');
    if (!target) return;
    if (target.hasAttribute('data-open-game')) {
      loadGame(target.getAttribute('data-open-game'));
      return;
    }
    if (target.hasAttribute('data-discard-card')) {
      discardSelectionToggle(target.getAttribute('data-discard-card'));
      return;
    }
    if (target.hasAttribute('data-play-card')) {
      const card = target.getAttribute('data-play-card');
      submitAction('play', { card });
      return;
    }
    if (target.hasAttribute('data-action-discard')) {
      discardSelected();
      return;
    }
    if (target.hasAttribute('data-action-go')) {
      submitAction('go');
      return;
    }
    if (target.hasAttribute('data-action-next-hand')) {
      submitAction('next-hand');
      return;
    }
    if (target.hasAttribute('data-pending-retry')) {
      retryPending();
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === 'new-game-form-el') {
      event.preventDefault();
      startGame(form);
      return;
    }
    if (form.id === 'bench-hand-form') {
      event.preventDefault();
      scoreBenchHand(form);
      return;
    }
    if (form.id === 'bench-pegging-form') {
      event.preventDefault();
      scoreBenchPegging(form);
    }
  });

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.id === 'bench-example') {
      const index = Number(target.value);
      if (!Number.isNaN(index)) applyBenchExample(index, true);
      return;
    }
  });
}

async function init() {
  bindEvents();
  renderAll();
  try {
    await loadBootstrap();
    if (app.pending) {
      setStatus('A save is pending. You can retry it now.', 'info');
    }
    if (app.gameId && !app.game) {
      await loadGame(app.gameId);
    }
  } catch (error) {
    setStatus(error.message, 'error');
    renderAll();
  }
}

init();

// Gambit Hollow — the browser side.
//
// The server owns every rule. This picks cards up and puts them down and shows
// what the server said scored; it never decides a total itself, because two
// scorers that disagree is worse than one that is wrong.

const $ = (id) => document.getElementById(id);
let gameId = null;
let selected = [];
let view = null;

const api = async (method, url, body) => {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
};

const say = (m) => { $('err').textContent = m || ''; };
const seat = () => ($('seatb').checked ? 'b' : 'a');

const PHASE_HINT = {
  between: 'the hand is counted — deal the next one',
  discard: 'pick two cards for the crib',
  cut: 'turn the cut',
  play: 'lay a card',
  show: 'count the show',
  over: 'the game is over',
};

// Every control that needs a game, and the phase it belongs to. All of them
// used to be live with no game at all, firing /api/games/null/... and showing
// the server's refusal as though the player had done something wrong.
const CONTROL_PHASE = {
  discard: 'discard',
  cut: 'cut',
  show: 'show',
  deal: 'between',
};

function setControls(phase) {
  for (const [id, want] of Object.entries(CONTROL_PHASE)) {
    $(id).disabled = phase !== want;
  }
}

// The board and the hand before any game exists. Without this the page opened
// on a large empty gap where the peg board belongs, and a blank space under
// "Your hand" while everything around it said what it was waiting for.
function paintIdle() {
  $('board').innerHTML = boardSVG(0, 0, 121);
  $('s-crib').textContent = '0';
  $('crib').innerHTML = '<span class="empty">Nothing in it yet.</span>';
  $('hand').innerHTML = '<span class="empty">No game yet — start one above.</span>';
  $('handhint').textContent = '';
  setControls(null);
}

// Which two cards are marked for the crib, without touching the DOM around them.
function markSelected() {
  for (const b of $('hand').querySelectorAll('button')) {
    const code = b.dataset.card;
    b.setAttribute('aria-pressed', String(selected.includes(code)));
  }
  // Said in words too. A lift and a colour are easy to miss and impossible to
  // rely on; "two of two chosen" is not.
  const words = ['none', 'one', 'two'][selected.length] || String(selected.length);
  $('chosen').textContent = selected.length === 2
    ? 'two of two chosen'
    : `${words} chosen — pick ${2 - selected.length} more`;
}

function paint(v) {
  view = v;
  $('phase').textContent = v.phase;
  $('handno').textContent = `hand ${v.hand_no || 1}`;
  setControls(v.phase);
  $('s-a').textContent = v.scores.a;
  $('s-b').textContent = v.scores.b;
  $('s-count').textContent = v.count;
  $('s-cut').textContent = v.cut || '—';
  $('n-a').textContent = v.dealer === 'a' ? 'Dealer' : 'Non-dealer';
  $('n-b').textContent = v.dealer === 'b' ? 'Dealer' : 'Non-dealer';
  $('board').innerHTML = boardSVG(v.scores.a, v.scores.b, v.target);
  $('handhint').textContent = '— ' + (PHASE_HINT[v.phase] || '');

  // the play. The pile is the CURRENT count and empties on a go or at
  // thirty-one, which is correct cribbage but means a card can appear and
  // vanish on the same click -- so what each player has laid this hand is drawn
  // separately and stays until the show.
  const pile = $('pile');
  pile.innerHTML = v.pile.length
    ? v.pile.map((c) => cardSVG(c, { w: 54 })).join('')
    : '<span class="empty">Nothing played yet.</span>';
  // The crib: a COUNT while it is face down, the real cards once the show has
  // been counted. Either way it has to be visible -- putting two cards in it was
  // previously indistinguishable from losing them.
  const cribCards = Array.isArray(v.crib) ? v.crib : [];
  const cribCount = Array.isArray(v.crib) ? v.crib.length : (v.crib || 0);
  $('s-crib').textContent = String(cribCount);
  $('n-crib').textContent = v.dealer === v.seat ? 'In your crib' : 'In their crib';
  // Once the show has been counted the whole crib is face up. Before that, a
  // seat still sees the two IT contributed -- you know what you discarded -- and
  // the other player's two stay face down.
  const mine = v.you.cribCards || [];
  $('crib').innerHTML = cribCount === 0
    ? '<span class="empty">Nothing in it yet.</span>'
    : (cribCards.length
        ? cribCards.map((c) => cardSVG(c, { w: 38 })).join('')
        : mine.map((c) => cardSVG(c, { w: 38 })).join('')
          + Array.from({ length: Math.max(0, cribCount - mine.length) },
                       () => cardSVG(null, { w: 38 })).join(''));
  $('cribhint').textContent = cribCards.length
    ? '— counted at the show, and it belongs to the dealer'
    : (mine.length
        ? `— your ${mine.length === 1 ? 'card' : 'two'} face up, theirs face down until the show`
        : '— two from each of you, face down until the show');

  for (const [el, cards] of [['laid-you', v.you.laid], ['laid-them', v.them.laid]]) {
    $(el).innerHTML = (cards && cards.length)
      ? cards.map((c) => cardSVG(c, { w: 38 })).join('')
      : '<span class="empty">Nothing yet.</span>';
  }

  // your hand: selectable in the discard, layable in the play
  const hand = $('hand');
  hand.innerHTML = '';
  const cards = v.phase === 'discard' ? v.you.hand : v.you.remaining;
  for (const c of cards) {
    const b = document.createElement('button');
    b.className = 'slot';
    b.innerHTML = cardSVG(c);
    b.setAttribute('aria-pressed', String(selected.includes(c)));
    b.setAttribute('aria-label', cardName(c));
    b.dataset.card = c;
    b.disabled = v.phase === 'play' && v.turn !== v.seat;
    b.addEventListener('click', () => onCard(c));
    hand.appendChild(b);
  }
  if (!cards.length) {
    hand.innerHTML = v.phase === 'over'
      ? '<span class="empty">The game is over.</span>'
      : '<span class="empty">No cards in hand.</span>';
  }

  $('discard').disabled = v.phase !== 'discard' || v.you.discarded;
  $('cut').disabled = v.phase !== 'cut';
  $('show').disabled = v.phase !== 'show';

  // what scored, in words, straight from the server
  const ev = $('events');
  ev.innerHTML = v.events.length
    ? v.events.slice().reverse().map((e) =>
        `<li class="evt"><b>${e.points}</b> to ${e.who === v.dealer ? 'the dealer' : 'the non-dealer'} — ${e.why}</li>`).join('')
    : '<li class="empty">Nothing yet.</li>';

  // the show, hand by hand
  const sh = $('shown');
  sh.innerHTML = v.shown.length
    ? v.shown.map((s) => `
        <div style="margin-bottom:10px">
          <div><b>${s.label}</b> — ${s.total} point${s.total === 1 ? '' : 's'}</div>
          <div class="row" style="gap:4px;margin:5px 0">
            ${s.cards.map((c) => cardSVG(c, { w: 38 })).join('')}
          </div>
          <div class="evt">${Object.entries(s.breakdown)
            .filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ') || 'nothing scores'}</div>
        </div>`).join('')
    : '<span class="empty">Not counted yet.</span>';
}

async function onCard(c) {
  if (!view) return;
  if (view.phase === 'discard') {
    selected = selected.includes(c)
      ? selected.filter((x) => x !== c)
      : selected.concat([c]).slice(-2);
    // Marked in place rather than repainted. Choosing cards for the crib
    // changes nothing about the game, and rebuilding the hand threw away the
    // button that was just pressed -- focus fell to <body>, so a keyboard
    // player had to tab back in for the second card.
    markSelected();
    return;
  }
  if (view.phase === 'play') {
    const r = await api('POST', `/api/games/${gameId}/play`, { card: c, seat: seat() });
    say(r.ok ? '' : (r.data.error || 'refused'));
    if (r.ok) paint(r.data);
    return;
  }
  say('Not the moment for that.');
}

async function refresh() {
  if (!gameId) return;
  const r = await api('GET', `/api/games/${gameId}?seat=${seat()}`);
  if (r.ok) paint(r.data);
}

async function ladder() {
  const r = await api('GET', '/api/ladder');
  if (!r.ok) return;
  $('ladder').innerHTML = r.data.members.map((m) =>
    `<tr><td>${m.name}<div class="evt">${m.no}</div></td>
         <td>${m.played}</td><td><b>${m.won}</b></td></tr>`).join('');
}

// The id lives in the URL fragment. A game that exists only in a JS variable is
// lost the moment the page reloads, which is what emptied the board.
function remember(id) {
  gameId = id;
  if (location.hash.slice(1) !== id) {
    history.replaceState(null, '', `#${id}`);
  }
}

$('new').addEventListener('click', async () => {
  const r = await api('POST', '/api/games', {});
  if (!r.ok) { say(r.data.error || 'refused'); return; }
  remember(r.data.id);
  selected = [];
  say('');
  paint(r.data);
});

$('discard').addEventListener('click', async () => {
  if (selected.length !== 2) { say('Pick two cards for the crib.'); return; }
  const r = await api('POST', `/api/games/${gameId}/discard`,
    { cards: selected, seat: seat() });
  say(r.ok ? '' : (r.data.error || 'refused'));
  if (r.ok) { selected = []; paint(r.data); }
});

$('cut').addEventListener('click', async () => {
  const r = await api('POST', `/api/games/${gameId}/cut`, { seat: seat() });
  say(r.ok ? '' : (r.data.error || 'refused'));
  if (r.ok) paint(r.data);
});

$('show').addEventListener('click', async () => {
  const r = await api('POST', `/api/games/${gameId}/show`, { seat: seat() });
  say(r.ok ? '' : (r.data.error || 'refused'));
  if (r.ok) { paint(r.data); ladder(); }
});

$('deal').addEventListener('click', async () => {
  const r = await api('POST', `/api/games/${gameId}/deal`, { seat: seat() });
  say(r.ok ? '' : (r.data.error || 'refused'));
  if (r.ok) { selected = []; paint(r.data); }
});

// Starting near the target is the only practical way to watch the game stop the
// instant somebody reaches it: from nothing that is about eleven hands.
$('practice').addEventListener('click', async () => {
  const r = await api('POST', '/api/games', { start_scores: { a: 115, b: 113 } });
  if (!r.ok) { say(r.data.error || 'refused'); return; }
  remember(r.data.id);
  selected = [];
  say('Practising the finish — 115 to 113, first to 121.');
  paint(r.data);
});

$('seatb').addEventListener('change', refresh);

// Come back to whatever game the URL names. This is what makes a reload
// survivable: the state was always safe on the server, the page just had no way
// of knowing which game was its own.
(async () => {
  paintIdle();
  await ladder();
  const fromUrl = location.hash.slice(1);
  if (!fromUrl) return;
  const r = await api('GET', `/api/games/${fromUrl}?seat=${seat()}`);
  if (r.ok) {
    remember(fromUrl);
    say('');
    paint(r.data);
  } else {
    say('That game is no longer in play.');
    history.replaceState(null, '', location.pathname);
  }
})();


const $ = (id) => document.getElementById(id);
let gameId = null;
let selected = [];
let view = null;
let saving = false;
let pendingSave = JSON.parse(sessionStorage.getItem('gambit-pending') || 'null');
document.addEventListener('click',e=>{if(saving&&e.target.closest('button')){e.preventDefault();e.stopImmediatePropagation();}},true);

function saveStatus(message) {
  $('save-status').textContent = message;
  $('retry-save').hidden = !pendingSave || saving;
}
function setSaving(value) {
  saving = value;
  $('seatb').disabled = value;
  for (const id of ['new','practice','fixed-practice']) $(id).disabled = value || Boolean(pendingSave);
  if (value) document.querySelector('main').setAttribute('aria-busy','true');
  else document.querySelector('main').removeAttribute('aria-busy');
  saveStatus(value ? 'Saving your action…' : pendingSave ? 'Save not confirmed. Retry safely before making another move.' : 'All changes saved');
}
function clearPending() {
  pendingSave = null;
  sessionStorage.removeItem('gambit-pending');
}
async function sendSave(request) {
  setSaving(true);
  try {
    const response = await fetch(request.url, {method:'POST', headers:request.headers, body:JSON.stringify(request.body)});
    let data;
    try { data = await response.json(); } catch { throw new Error('Unconfirmed response'); }
    if (response.status >= 500) throw new Error('Unconfirmed save');
    if (response.ok) {
      const latest = await fetch(`/api/games/${data.id}?seat=${data.seat || 'a'}`);
      if (!latest.ok) throw new Error('Unable to refresh the saved table');
      data = await latest.json();
    }
    clearPending();
    if (!response.ok && data.code === 'stale_revision') {
      selected = [];
      await refresh();
    }
    return {ok:response.ok, status:response.status, data};
  } catch {
    return {ok:false, data:{error:'Save not confirmed. Use Retry save; your action will not be counted twice.'}};
  } finally {
    setTimeout(() => setSaving(false), 0);
  }
}
const api = async (method, url, body) => {
  const mutation=method==='POST'&&url.startsWith('/api/games');
  if(mutation) {
    if(saving || pendingSave)return {ok:false,data:{error:'Please finish or retry the current save first'}};
    const headers = {'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()};
    if (url !== '/api/games') headers['If-Match'] = String(view?.revision ?? -1);
    pendingSave = {url, body:body || {}, headers};
    sessionStorage.setItem('gambit-pending', JSON.stringify(pendingSave));
    return sendSave(pendingSave);
  }
  try {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
  } catch(error){return {ok:false,data:{error:'The server could not be reached. Reload before trying the action again.'}};}
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
function paintIdle() {
  $('board').innerHTML = boardSVG(0, 0, 121);
  $('s-crib').textContent = '0';
  $('crib').innerHTML = '<span class="empty">Nothing in it yet.</span>';
  $('hand').innerHTML = '<span class="empty">No game yet — start one above.</span>';
  $('handhint').textContent = '';
  setControls(null);
}
function markSelected() {
  for (const b of $('hand').querySelectorAll('button')) {
    const code = b.dataset.card;
    b.setAttribute('aria-pressed', String(selected.includes(code)));
  }
  const words = ['none', 'one', 'two'][selected.length] || String(selected.length);
  $('chosen').textContent = selected.length === 2
    ? 'two of two chosen'
    : `${words} chosen — pick ${2 - selected.length} more`;
}

function paint(v) {
  const oldFocus=document.activeElement;
  const changedGame=view?.id!==v.id;
  view = v;
  $('phase').textContent = v.phase;
  $('handno').textContent = `hand ${v.hand_no || 1}`;
  const playerName=s=>v.players?.[s]?.name || `Seat ${s.toUpperCase()}`;
  $('turnhint').textContent=`${playerName(v.seat)} · Seat ${v.seat.toUpperCase()} · ${v.phase==='over'?`${playerName(v.scores.a===121?'a':'b')} wins — game over`:v.phase==='play'?`${playerName(v.turn)} to play`:PHASE_HINT[v.phase]} · Dealer ${v.dealer.toUpperCase()}`;
  $('seat-label').textContent=`View seat B · ${playerName('b')} (unchecked: seat A · ${playerName('a')})`;
  setControls(v.phase);
  $('s-a').textContent = v.scores.a;
  $('s-b').textContent = v.scores.b;
  $('s-count').textContent = v.count;
  $('s-cut').textContent = v.cut || '—';
  $('n-a').textContent = `${playerName('a')} · ${v.dealer === 'a' ? 'Dealer' : 'Non-dealer'}`;
  $('n-b').textContent = `${playerName('b')} · ${v.dealer === 'b' ? 'Dealer' : 'Non-dealer'}`;
  $('board').innerHTML = boardSVG(v.scores.a, v.scores.b, v.target);
  $('board').setAttribute('aria-label',`${playerName('a')}: ${v.scores.a}; ${playerName('b')}: ${v.scores.b}; target 121`);
  $('opponent-hand').innerHTML = v.them.cards
    ? Array.from({length:v.them.cards},()=>cardSVG(null,{w:34})).join('')
    : '<span class="empty">All opponent cards have been played.</span>';
  $('handhint').textContent = '— ' + (PHASE_HINT[v.phase] || '');
  const pile = $('pile');
  pile.innerHTML = v.pile.length
    ? v.pile.map((c) => cardSVG(c, { w: 54 })).join('')
    : '<span class="empty">Nothing played yet.</span>';
  const cribCards = Array.isArray(v.crib) ? v.crib : [];
  const cribCount = Array.isArray(v.crib) ? v.crib.length : (v.crib || 0);
  $('s-crib').textContent = String(cribCount);
  $('n-crib').textContent = v.dealer === v.seat ? 'In your crib' : 'In their crib';
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
  const ev = $('events');
  ev.innerHTML = v.events.length
    ? v.events.slice().reverse().map((e) =>
        `<li class="evt"><b>${e.points}</b> to ${e.who === v.dealer ? 'the dealer' : 'the non-dealer'} — ${e.why}</li>`).join('')
    : '<li class="empty">Nothing yet.</li>';
  const sh = $('shown');
  sh.innerHTML = v.shown.length
    ? v.shown.map((s) => `
        <div class="show-entry">
          <div><b>${s.label}</b> — ${s.total} point${s.total === 1 ? '' : 's'}</div>
          <div class="row" style="gap:4px;margin:5px 0">
            ${s.cards.map((c) => cardSVG(c, { w: 38 })).join('')}
          </div>
          <div class="evt">${Object.entries(s.breakdown)
            .filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ') || 'nothing scores'}</div>
        </div>`).join('')
    : '<span class="empty">Not counted yet.</span>';
  if(changedGame||!document.contains(oldFocus)||oldFocus.disabled){
    const next=$('hand').querySelector('button:not(:disabled)')||['cut','show','deal','new'].map($).find(x=>!x.disabled);
    if(next)next.focus();
  }
  if(v.phase==='over')ladder();
}

async function onCard(c) {
  if (saving || pendingSave) { say('Finish or retry the pending save first.'); return; }
  if (!view) return;
  if (view.phase === 'discard') {
    selected = selected.includes(c)
      ? selected.filter((x) => x !== c)
      : selected.concat([c]).slice(-2);
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
function remember(id) {
  gameId = id;
  if (location.hash.slice(1) !== id) {
    history.replaceState(null, '', `#${id}`);
  }
}

$('new').addEventListener('click', async () => {
  const r = await api('POST', '/api/games', {});
  if (!r.ok) { say(r.data.error || 'refused'); return; }
  $('seatb').checked=false;
  sessionStorage.setItem('gambit-seat','a');
  remember(r.data.id);
  selected = [];
  say('');
  paint(r.data);
  await savedGames();
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
$('practice').addEventListener('click', async () => {
  const r = await api('POST', '/api/games', { start_scores: { a: 115, b: 113 } });
  if (!r.ok) { say(r.data.error || 'refused'); return; }
  $('seatb').checked=false;
  sessionStorage.setItem('gambit-seat','a');
  remember(r.data.id);
  selected = [];
  say('Practising the finish — 115 to 113, first to 121.');
  paint(r.data);
});

$('seatb').addEventListener('change', refresh);
$('seatb').checked=sessionStorage.getItem('gambit-seat')==='b';
$('seatb').addEventListener('change',()=>{selected=[];sessionStorage.setItem('gambit-seat',seat());});
$('retry-save').addEventListener('click',async()=>{
  if (!pendingSave || saving) return;
  const r = await sendSave(pendingSave);
  say(r.ok ? 'Save confirmed. The table is up to date.' : r.data.error);
  if (r.ok) {
    remember(r.data.id);
    selected = [];
    await refresh();
    await ladder();
    await savedGames();
  }
});
(async () => {
  paintIdle();
  setSaving(false);
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

window.matchMedia('(max-width:640px)').addEventListener('change',()=>{
  $('board').innerHTML=boardSVG(view?.scores.a||0,view?.scores.b||0,121);
});

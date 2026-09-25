// Gambit Hollow - Client-side application

const SUITS = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SUIT_COLORS = { S: 'black', H: 'red', D: 'red', C: 'black' };

// State
let state = {
  currentView: 'board',
  currentGame: null,
  selectedCards: [],
  scoredHands: [],
  practices: {},
  members: []
};

// ============================================================================
// Navigation
// ============================================================================
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.id.replace('nav-', '');
    switchView(view);
  });
});

function switchView(viewName) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  // Show selected view
  const view = document.getElementById(viewName + '-view');
  if (view) {
    view.classList.add('active');
    document.getElementById('nav-' + viewName)?.classList.add('active');
    
    // Load view-specific data
    if (viewName === 'bench') {
      loadBench();
    } else if (viewName === 'ladder') {
      loadLadder();
    }
  }
  
  state.currentView = viewName;
}

// ============================================================================
// API Communication
// ============================================================================
async function api(method, path, body = null) {
  const opts = { method };
  if (body) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  
  try {
    const res = await fetch(path, opts);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (e) {
    console.error(`API error: ${method} ${path}`, e);
    throw e;
  }
}

// ============================================================================
// Scoring Bench
// ============================================================================
async function loadBench() {
  // Load examples
  if (state.scoredHands.length === 0) {
    const data = await api('GET', '/api/scored-hands');
    state.scoredHands = data.hands;
  }
  
  // Populate examples select
  const select = document.getElementById('bench-examples');
  if (select.children.length === 1) {
    state.scoredHands.forEach((hand, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `Hand ${idx + 1}: ${hand.rule.substring(0, 50)}...`;
      select.appendChild(opt);
    });
  }
  
  // Event listeners
  document.getElementById('btn-bench-score').onclick = scoreBench;
  document.getElementById('btn-bench-clear').onclick = clearBench;
  document.getElementById('bench-examples').onchange = selectExample;
}

function selectExample(e) {
  const idx = parseInt(e.target.value);
  if (idx === '' || isNaN(idx)) return;
  
  const hand = state.scoredHands[idx];
  document.getElementById('bench-hand').value = hand.hand.join(' ');
  document.getElementById('bench-cut').value = hand.cut;
  document.getElementById('bench-is-crib').checked = hand.crib;
  scoreBench();
}

async function scoreBench() {
  const handInput = document.getElementById('bench-hand').value.trim().toUpperCase();
  const cutInput = document.getElementById('bench-cut').value.trim().toUpperCase();
  const isCrib = document.getElementById('bench-is-crib').checked;
  
  const cards = handInput.split(/\s+/).filter(c => c.length > 0);
  
  if (cards.length !== 4 || !cutInput) {
    alert('Enter 4 hand cards and a cut card');
    return;
  }
  
  try {
    const result = await api('POST', '/api/score', {
      hand: cards,
      cut: cutInput,
      isCrib
    });
    
    showBenchResult(result, cards, cutInput);
  } catch (e) {
    alert('Scoring error: ' + e.message);
  }
}

function showBenchResult(result, cards, cut) {
  const breakdown = document.getElementById('bench-breakdown');
  const items = [];
  
  if (result.fifteens > 0) {
    items.push(`Fifteens: ${result.fifteens}`);
  }
  if (result.pairs > 0) {
    items.push(`Pairs: ${result.pairs}`);
  }
  if (result.runs > 0) {
    items.push(`Runs: ${result.runs}`);
  }
  if (result.flush > 0) {
    items.push(`Flush: ${result.flush}`);
  }
  if (result.nobs > 0) {
    items.push(`Nobs: ${result.nobs}`);
  }
  
  breakdown.innerHTML = items.length > 0 
    ? items.map(i => `<div class="bench-breakdown-item">${i}</div>`).join('')
    : '<div class="bench-breakdown-item">No points</div>';
  
  document.getElementById('bench-total').textContent = result.total;
  document.getElementById('bench-result').style.display = 'block';
}

function clearBench() {
  document.getElementById('bench-hand').value = '';
  document.getElementById('bench-cut').value = '';
  document.getElementById('bench-is-crib').checked = false;
  document.getElementById('bench-result').style.display = 'none';
  document.getElementById('bench-examples').value = '';
}

// ============================================================================
// Ladder
// ============================================================================
async function loadLadder() {
  try {
    const data = await api('GET', '/api/ladder');
    state.members = data.members;
    
    const tbody = document.getElementById('ladder-body');
    tbody.innerHTML = state.members.map((m, idx) => {
      const pct = m.played > 0 ? ((m.won / m.played) * 100).toFixed(1) : '0.0';
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${m.name}</td>
          <td>${m.played}</td>
          <td>${m.won}</td>
          <td>${pct}%</td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    console.error('Failed to load ladder', e);
  }
}

// ============================================================================
// Card rendering
// ============================================================================
function renderCard(cardCode) {
  if (!cardCode || cardCode.length < 2) return '';
  
  const rank = cardCode.slice(0, -1);
  const suit = cardCode[cardCode.length - 1];
  const color = SUIT_COLORS[suit] || 'black';
  
  const div = document.createElement('div');
  div.className = `card ${color}`;
  div.textContent = `${rank}${SUITS[suit] || suit}`;
  div.dataset.card = cardCode;
  
  return div;
}

function renderCardInto(container, cardCode, clickable = false) {
  const card = renderCard(cardCode);
  if (clickable && card) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => toggleCardSelection(cardCode));
  }
  container.appendChild(card);
  return card;
}

// ============================================================================
// Game creation and management
// ============================================================================
document.getElementById('btn-new-game')?.addEventListener('click', showNewGameDialog);
document.getElementById('btn-open-game')?.addEventListener('click', showOpenGamesDialog);
document.getElementById('btn-practice')?.addEventListener('click', showPracticeDealsDialog);

async function showNewGameDialog() {
  // TODO: Show dialog to select players
  alert('Game creation UI coming soon');
}

async function showOpenGamesDialog() {
  // TODO: Show list of active games
  alert('Open games UI coming soon');
}

async function showPracticeDealsDialog() {
  // TODO: Show list of practice deals
  alert('Practice deals UI coming soon');
}

// ============================================================================
// Card selection
// ============================================================================
function toggleCardSelection(cardCode) {
  const idx = state.selectedCards.indexOf(cardCode);
  if (idx >= 0) {
    state.selectedCards.splice(idx, 1);
  } else {
    state.selectedCards.push(cardCode);
  }
  
  // Update UI
  document.querySelectorAll('.card').forEach(card => {
    if (state.selectedCards.includes(card.dataset.card)) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
}

// ============================================================================
// Initialization
// ============================================================================
window.addEventListener('DOMContentLoaded', async () => {
  // Check health
  try {
    await api('GET', '/api/health');
    console.log('Server is healthy');
  } catch (e) {
    console.error('Server health check failed', e);
    alert('Cannot connect to server');
    return;
  }
  
  // Load initial data
  try {
    await loadLadder();
  } catch (e) {
    console.error('Failed to load initial data', e);
  }
});

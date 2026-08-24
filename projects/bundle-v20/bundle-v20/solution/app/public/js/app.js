const DEFAULT_USER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
let currentUser = null;
let demoUsers = [];
let catalogUnits = [];
let noticeTabData = null;
let activeNoticeTab = 'paper';

function userId() {
  return localStorage.getItem('gearvault_demo_user') || DEFAULT_USER;
}

// Anything that changes something carries a fresh Idempotency-Key, so a retry
// after a dropped connection replays the same act rather than performing a second
// one. A fresh key per call is right here: each click is a distinct act. Retrying
// a specific act means re-sending its key, which is what retryWithKey() does.
function newIdempotencyKey() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function api(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const extra = {};
  if (MUTATING.has(method)) extra['Idempotency-Key'] = options.idempotencyKey || newIdempotencyKey();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Demo-User-Id': userId(),
      ...extra,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showToast(msg, type = 'info') {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-atomic', 'true');
    document.body.appendChild(root);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 4200);
}

function isAssociate() {
  return currentUser?.role === 'rental_associate';
}

function isPaidReservation(status) {
  return ['CONFIRMED', 'CHECKED_OUT', 'RETURNED', 'CLOSED'].includes(status);
}

function shopMatchesFilter(shop, filter) {
  if (!filter || filter === 'all') return true;
  const value = String(shop || '').toLowerCase();
  if (filter === 'riverside') return value.includes('riverside');
  if (filter === 'downtown') return value.includes('downtown');
  if (filter === 'pier') return value.includes('pier') || value.includes('harbour');
  return true;
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadSession();
    const sessionId = new URLSearchParams(location.search).get('session_id');
    if (sessionId) await confirmReservation(sessionId);
    else await loadDashboard();
  } catch (error) {
    document.getElementById('main-content').innerHTML =
      `<section class="page container"><p class="error">${escapeHtml(error.message)}</p></section>`;
  }
});

async function loadSession() {
  const [session, users] = await Promise.all([
    api('/api/session'),
    api('/api/demo-users')
  ]);
  currentUser = session.user;
  demoUsers = users.users;
  renderNavigation();
}

function renderNavigation() {
  const customerLinks = `
    <a href="#" onclick="loadCatalog(); return false;">Browse Gear</a>
    <a href="#" onclick="showReservations(); return false;">My Reservations</a>
    <a href="#" onclick="showCertifications(); return false;">My Certifications</a>
    <a href="#" onclick="showNotices(); return false;">Receipts</a>
  `;
  const associateLinks = `
    <a href="#" onclick="showReservations(); return false;">Counter</a>
    <a href="#" onclick="loadCatalog(); return false;">Catalog</a>
    <a href="#" onclick="showNotices(); return false;">Receipts</a>
  `;
  const assessorLinks = `
    <a href="#" onclick="showInspections(); return false;">Inspections</a>
    <a href="#" onclick="showDamageQueue(); return false;">Damage Reports</a>
  `;
  const managerLinks = `
    <a href="#" onclick="showDamageQueue(); return false;">Approvals</a>
    <a href="#" onclick="showCustomers(); return false;">Customers</a>
    <a href="#" onclick="loadCatalog(); return false;">Inventory</a>
    <a href="#" onclick="showAuditLog('main-content'); return false;">Audit</a>
  `;
  const transferLinks = `
    <a href="#" onclick="loadCatalog(); return false;">Transfers</a>
  `;
  const bayTechLinks = `
    <a href="#" onclick="showReservations(); return false;">Counter</a>
    <a href="#" onclick="loadCatalog(); return false;">Catalog</a>
  `;
  const nightAuditorLinks = `
    <a href="#" onclick="showAuditLog('main-content'); return false;">Audit log</a>
    <a href="#" onclick="showNotices(); return false;">Receipts</a>
  `;
  const insuranceLinks = `
    <a href="#" onclick="showHullBindsList('main-content'); return false;">Hull binds</a>
    <a href="#" onclick="showNotices(); return false;">Receipts</a>
  `;
  const lotRunnerLinks = `
    <a href="#" onclick="loadCatalog(); return false;">Catalog</a>
  `;
  const roleLinks = {
    customer: customerLinks,
    rental_associate: associateLinks,
    damage_assessor: assessorLinks,
    shop_manager: managerLinks,
    transfer_clerk: transferLinks,
    bay_technician: bayTechLinks,
    night_auditor: nightAuditorLinks,
    insurance_liaison: insuranceLinks,
    lot_runner: lotRunnerLinks
  };

  document.getElementById('nav').innerHTML = `
    <span id="current-user">${escapeHtml(currentUser.full_name)} · ${escapeHtml(labelRole(currentUser.role))}</span>
    <a href="#" onclick="loadDashboard(); return false;">Dashboard</a>
    ${roleLinks[currentUser.role] || ''}
    <label for="demo-user-select">Switch demo user</label>
    <select id="demo-user-select" aria-label="Switch demo user" onchange="switchDemoUser(this.value)">
      ${demoUsers.map((user) => `
        <option value="${user.id}" ${user.id === currentUser.id ? 'selected' : ''}>
          ${escapeHtml(user.full_name)} (${escapeHtml(labelRole(user.role))})
        </option>
      `).join('')}
    </select>
  `;
}

async function switchDemoUser(id) {
  localStorage.setItem('gearvault_demo_user', id);
  await loadSession();
  await loadDashboard();
}

function labelRole(role) {
  return {
    customer: 'customer',
    rental_associate: 'rental associate',
    damage_assessor: 'damage assessor',
    shop_manager: 'shop manager',
    transfer_clerk: 'transfer clerk',
    bay_technician: 'bay technician',
    night_auditor: 'night auditor',
    insurance_liaison: 'insurance liaison',
    lot_runner: 'lot runner'
  }[role] || role;
}

function memberBadgeHtml() {
  if (!currentUser?.member) return '';
  return ' <span class="badge-member">Member</span>';
}

async function loadDashboard() {
  document.getElementById('main-content').innerHTML = `
    <section class="page container">
      <div class="eyebrow">Demo workspace · signed in automatically</div>
      <h2>Welcome, ${escapeHtml(currentUser.full_name)}${memberBadgeHtml()}</h2>
      <p class="muted">Use Switch demo user in the header to move between customers and staff. No login is required.</p>
      <div class="actions" id="dash-actions"></div>
      <div id="dashboard-content"></div>
    </section>`;
  const actions = document.getElementById('dash-actions');
  if (currentUser.role === 'customer') {
    actions.innerHTML = `
      <button type="button" onclick="loadCatalog()" class="btn">Browse Gear</button>
      <button type="button" onclick="showReservations()" class="btn secondary">My Reservations</button>
      <button type="button" onclick="showCertifications()" class="btn secondary">My Certifications</button>`;
    await showReservationsList('dashboard-content');
  } else if (isAssociate()) {
    actions.innerHTML = `
      <button type="button" onclick="showReservations()" class="btn">Today's counter</button>
      <button type="button" onclick="loadCatalog()" class="btn secondary">Catalog</button>`;
    await showReservationsList('dashboard-content');
  } else if (currentUser.role === 'damage_assessor') {
    actions.innerHTML = `
      <button type="button" onclick="showInspections()" class="btn">Inspections</button>
      <button type="button" onclick="showDamageQueue()" class="btn secondary">Damage reports</button>`;
    await showInspectionsList('dashboard-content');
  } else if (currentUser.role === 'transfer_clerk') {
    actions.innerHTML = `
      <button type="button" onclick="loadCatalog()" class="btn">Move a kit</button>`;
    document.getElementById('dashboard-content').innerHTML =
      '<p class="muted">Noah moves kits between shops after the transfer bureau stamps the van. He does not work the counter or the deposit.</p>';
  } else if (currentUser.role === 'bay_technician') {
    actions.innerHTML = `
      <button type="button" onclick="showReservations()" class="btn">Open counter</button>
      <button type="button" onclick="loadCatalog()" class="btn secondary">Catalog</button>`;
    document.getElementById('dashboard-content').innerHTML = `
      <article class="card">
        <h3>Bay serial desk</h3>
        <p class="muted">Omar issues live bay serial scans when associates hand kits out. Check-out on the counter spends a ticket from this desk — not a typed code.</p>
        <button type="button" class="btn" onclick="showReservations()">Go to counter</button>
      </article>`;
  } else if (currentUser.role === 'night_auditor') {
    actions.innerHTML = `
      <button type="button" onclick="showAuditLog('dashboard-content')" class="btn">Night audit</button>
      <button type="button" onclick="showNotices()" class="btn secondary">Receipts</button>`;
    await showAuditLog('dashboard-content');
  } else if (currentUser.role === 'insurance_liaison') {
    actions.innerHTML = `
      <button type="button" onclick="showHullBindsList('dashboard-content')" class="btn">Hull binds</button>
      <button type="button" onclick="showNotices()" class="btn secondary">Receipts</button>`;
    await showHullBindsList('dashboard-content');
  } else if (currentUser.role === 'lot_runner') {
    actions.innerHTML = `
      <button type="button" onclick="loadCatalog()" class="btn">View catalog</button>`;
    document.getElementById('dashboard-content').innerHTML =
      '<p class="muted">Casey can browse serialized units on the lot but cannot stamp transfer-bureau van moves — those stay with the transfer clerk.</p>';
  } else {
    actions.innerHTML = `
      <button type="button" onclick="showDamageQueue()" class="btn">Approvals</button>
      <button type="button" onclick="showCustomers()" class="btn secondary">Customers</button>`;
    await showDamageList('dashboard-content');
  }
}

function renderCatalogCards(units) {
  return units.map((unit) => `
    <article class="card" data-unit-id="${unit.id}" data-asset-tag="${escapeHtml(unit.asset_tag)}">
      <h3>${escapeHtml(unit.asset_tag)}</h3>
      <p class="accent">${escapeHtml(unit.category)}</p>
      <p>${escapeHtml(unit.model)}</p>
      <p><strong>Shop:</strong> ${escapeHtml(unit.shop)}</p>
      <p><strong>Daily rate:</strong> $${money(unit.daily_rate_usd)}</p>
      <p><strong>Deposit:</strong> $${money(unit.deposit_usd)}</p>
      <p><strong>Replacement:</strong> $${money(unit.replacement_value_usd)}</p>
      <p><strong>Certification:</strong> ${escapeHtml(unit.required_certification || 'None')}</p>
      <span class="status">${escapeHtml(prettyStatus(unit.status))}</span>
      <button type="button" class="btn view-unit-btn"
        aria-label="View ${escapeHtml(unit.asset_tag)}"
        onclick="viewUnit('${unit.id}')">View unit</button>
    </article>
  `).join('');
}

function applyCatalogFilters() {
  const shopFilter = document.getElementById('filter-shop')?.value || 'all';
  const categoryFilter = (document.getElementById('filter-category')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('filter-status')?.value || 'all';
  const filtered = catalogUnits.filter((unit) => {
    if (!shopMatchesFilter(unit.shop, shopFilter)) return false;
    if (categoryFilter && !String(unit.category || '').toLowerCase().includes(categoryFilter)) return false;
    if (statusFilter !== 'all' && String(unit.status || '').toUpperCase() !== statusFilter) return false;
    return true;
  });
  const host = document.getElementById('units-list');
  if (!host) return;
  host.innerHTML = filtered.length
    ? renderCatalogCards(filtered)
    : '<div class="empty">No units match these filters.</div>';
}

async function loadCatalog() {
  const lotRunnerNote = currentUser.role === 'lot_runner'
    ? '<p class="muted">Lot runners can view the catalog but cannot stamp transfer-bureau van moves.</p>'
    : '';
  document.getElementById('main-content').innerHTML = `
    <section class="page container">
      <h2>Gear catalog</h2>
      <p class="muted">Eighteen serialized units across Riverside Rental Center, Downtown Studio Annex, and Harbour Pier Desk. Status, rate, and deposit are on each card.</p>
      ${lotRunnerNote}
      <div class="filters" id="catalog-filters">
        <label for="filter-shop">Shop</label>
        <select id="filter-shop" aria-label="Filter by shop" onchange="applyCatalogFilters()">
          <option value="all">All shops</option>
          <option value="riverside">Riverside</option>
          <option value="downtown">Downtown</option>
          <option value="pier">Harbour Pier</option>
        </select>
        <label for="filter-category">Category</label>
        <input id="filter-category" type="text" placeholder="e.g. Lens, Drone" aria-label="Filter by category" oninput="applyCatalogFilters()">
        <label for="filter-status">Status</label>
        <select id="filter-status" aria-label="Filter by status" onchange="applyCatalogFilters()">
          <option value="all">Any status</option>
          <option value="AVAILABLE">Available</option>
          <option value="IN_REPAIR">In repair</option>
          <option value="RETIRED">Retired</option>
          <option value="CHECKED_OUT">Checked out</option>
        </select>
      </div>
      <div id="units-list" class="cards"><div class="empty">Loading catalog…</div></div>
    </section>`;
  try {
    const { units } = await api('/api/units');
    catalogUnits = units;
    document.getElementById('units-list').innerHTML = units.length
      ? renderCatalogCards(units)
      : '<div class="empty">No units in the catalog.</div>';
  } catch (error) {
    showError('units-list', error);
  }
}

function renderQuotePanel(quote) {
  if (!quote) {
    return '<p class="muted">Pick start and end dates to see a live quote.</p>';
  }
  const weekRate = Number(quote.week_rate_relief_usd || 0) > 0
    ? `<li><span>Week rate (${quote.days} days)</span><strong>-$${money(quote.week_rate_relief_usd)}</strong></li>`
    : '';
  return `
    <h4>Live quote · ${quote.days} day(s)</h4>
    <ul class="quote-lines">
      <li><span>Kit line at full price</span><strong>$${money(quote.gross_rental_usd)}</strong></li>
      ${weekRate}
      <li><span>Rental charged</span><strong>$${money(quote.rental_usd)}</strong></li>
      <li><span>Weekend</span><strong>$${money(quote.surcharge_usd)}</strong></li>
      <li><span>Tax</span><strong>$${money(quote.tax_usd)}</strong></li>
      <li><span>Hull</span><strong>$${money(quote.hull_usd)}</strong></li>
      <li><span>Deposit</span><strong>$${money(quote.deposit_usd)}</strong></li>
      <li class="quote-total"><span>Total</span><strong>$${money(quote.total_usd)}</strong></li>
    </ul>`;
}

async function updateLiveQuote(unitId) {
  const errorEl = document.getElementById('booking-error');
  const panelEl = document.getElementById('quote-panel');
  if (!panelEl) return;
  if (errorEl) errorEl.textContent = '';
  const startDate = document.getElementById('start-date')?.value;
  const endDate = document.getElementById('end-date')?.value;
  if (!startDate || !endDate) {
    panelEl.innerHTML = renderQuotePanel(null);
    return;
  }
  panelEl.innerHTML = '<p class="muted">Fetching live quote…</p>';
  try {
    const quote = await api(`/api/quote?unitId=${encodeURIComponent(unitId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
    panelEl.innerHTML = renderQuotePanel(quote);
  } catch (error) {
    panelEl.innerHTML = renderQuotePanel(null);
    if (errorEl) errorEl.textContent = error.message;
  }
}

function wireQuoteDateListeners(unitId) {
  const startEl = document.getElementById('start-date');
  const endEl = document.getElementById('end-date');
  const handler = () => updateLiveQuote(unitId);
  startEl?.addEventListener('change', handler);
  endEl?.addEventListener('change', handler);
}

async function viewUnit(id) {
  document.getElementById('main-content').innerHTML = `
    <section class="page container">
      <div id="unit-profile"><div class="empty">Loading unit…</div></div>
    </section>`;
  try {
    const { unit } = await api(`/api/units/${id}`);
    document.getElementById('unit-profile').innerHTML = `
      <button type="button" onclick="loadCatalog()" class="link-button">← Back to catalog</button>
      <article class="card profile" data-unit-id="${unit.id}">
        <h2>${escapeHtml(unit.asset_tag)}</h2>
        <p class="accent">${escapeHtml(unit.category)}</p>
        <p>${escapeHtml(unit.model)}</p>
        <p><strong>Shop:</strong> ${escapeHtml(unit.shop)}</p>
        <p><strong>Daily rate:</strong> $${money(unit.daily_rate_usd)}</p>
        <p><strong>Deposit:</strong> $${money(unit.deposit_usd)}</p>
        <p><strong>Replacement value:</strong> $${money(unit.replacement_value_usd)}</p>
        <p><strong>Certification required:</strong> ${escapeHtml(unit.required_certification || 'None')}</p>
        <span class="status">${escapeHtml(prettyStatus(unit.status))}</span>
        ${currentUser.role === 'customer' ? `
          <hr>
          <h3>Reserve these dates</h3>
          <form onsubmit="bookUnit(event, '${unit.id}')">
            <label for="start-date">Start date</label>
            <input id="start-date" type="date" required>
            <label for="end-date">End date</label>
            <input id="end-date" type="date" required>
            <div id="quote-panel" class="quote-panel" aria-live="polite">${renderQuotePanel(null)}</div>
            <p id="quote-preview" class="muted"></p>
            <p id="booking-error" class="error" role="alert"></p>
            <button type="button" class="btn secondary" onclick="previewQuote('${unit.id}')">Refresh live quote</button>
            <button class="btn" type="submit">Pay rental and deposit</button>
          </form>
        ` : ''}
        ${currentUser.role === 'transfer_clerk' ? `
          <hr>
          <h3>Van move</h3>
          <p id="unit-action-error" class="error" role="alert"></p>
          <button type="button" class="btn" aria-label="Transfer ${escapeHtml(unit.asset_tag)} to Downtown"
            onclick="transferUnit('${unit.id}', 'downtown')">Transfer ${escapeHtml(unit.asset_tag)} to Downtown</button>
          <button type="button" class="btn secondary" aria-label="Transfer ${escapeHtml(unit.asset_tag)} to Riverside"
            onclick="transferUnit('${unit.id}', 'riverside')">Transfer ${escapeHtml(unit.asset_tag)} to Riverside</button>
        ` : ''}
        ${currentUser.role === 'shop_manager' ? `
          <hr>
          <h3>Inventory actions</h3>
          <p id="unit-action-error" class="error" role="alert"></p>
          <button type="button" class="btn" onclick="unitAction('${unit.id}', 'repair')">Send to repair</button>
          <button type="button" class="btn secondary" onclick="unitAction('${unit.id}', 'restore')">Restore to floor</button>
          <button type="button" class="btn secondary" onclick="unitAction('${unit.id}', 'retire')">Retire</button>
          <form onsubmit="changeRate(event, '${unit.id}')">
            <label for="new-rate">Daily rate (USD)</label>
            <input id="new-rate" type="number" min="1" step="1" value="${unit.daily_rate_usd}">
            <button class="btn secondary" type="submit">Update rate</button>
          </form>
        ` : ''}
      </article>`;
    if (currentUser.role === 'customer') wireQuoteDateListeners(unit.id);
  } catch (error) {
    showError('unit-profile', error);
  }
}

async function previewQuote(unitId) {
  const errorEl = document.getElementById('booking-error');
  const previewEl = document.getElementById('quote-preview');
  errorEl.textContent = '';
  previewEl.textContent = '';
  try {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const quote = await api(`/api/quote?unitId=${encodeURIComponent(unitId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
    const panelEl = document.getElementById('quote-panel');
    if (panelEl) panelEl.innerHTML = renderQuotePanel(quote);
    previewEl.textContent =
      `${quote.days} day(s) · rental $${money(quote.rental_usd)} (week rate -$${money(quote.week_rate_relief_usd || 0)}) · weekend $${money(quote.surcharge_usd)} · tax $${money(quote.tax_usd)} · hull $${money(quote.hull_usd)} · deposit $${money(quote.deposit_usd)} · total $${money(quote.total_usd)}`;
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

async function bookUnit(event, unitId) {
  event.preventDefault();
  const errorEl = document.getElementById('booking-error');
  errorEl.textContent = '';
  try {
    const data = await api('/api/reservations', {
      method: 'POST',
      body: JSON.stringify({
        unitId,
        startDate: document.getElementById('start-date').value,
        endDate: document.getElementById('end-date').value
      })
    });
    window.location.href = data.sessionUrl;
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

async function confirmReservation(sessionId) {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <section class="page container">
      <article class="card" id="payment-verifying"><p>Verifying payment…</p></article>
    </section>`;
  try {
    await api('/api/reservations/confirm', {
      method: 'POST',
      body: JSON.stringify({ sessionId })
    });
    history.replaceState({}, '', '/booking-success');
    showToast('Booking confirmed — dates are now held.', 'success');
    main.innerHTML = `
      <section class="page container">
        <article class="card success-card" id="booking-confirmed">
          <h2>Booking confirmed</h2>
          <p>Payment verified. Those dates are now held.</p>
          <p class="muted">You can review the reservation under My Reservations.</p>
          <button type="button" class="btn" onclick="showReservations()">View my reservations</button>
        </article>
      </section>`;
  } catch (error) {
    main.innerHTML = `
      <section class="page container">
        <p class="error">${escapeHtml(error.message)}</p>
        <button type="button" class="btn" onclick="loadDashboard()">Back to dashboard</button>
      </section>`;
  }
}

function renderNoticeTabContent(tab) {
  if (!noticeTabData) return '<div class="empty">Loading…</div>';
  const { receipts, texts, emails, punches, holds } = noticeTabData;
  if (tab === 'paper') {
    return receipts.length
      ? `<div class="cards">${receipts.map((row) => `
        <article class="card">
          <h3>${escapeHtml(row.asset_tag || row.reservation_id)}</h3>
          <p>Total $${Number(row.total_cents / 100).toFixed(2)} · tax $${Number(row.tax_cents / 100).toFixed(2)} · hull $${Number(row.hull_cents / 100).toFixed(2)} · weekend $${Number((row.surcharge_cents || 0) / 100).toFixed(2)}</p>
        </article>`).join('')}</div>`
      : '<div class="empty">No receipts on the notice desk for this identity.</div>';
  }
  if (tab === 'sms') {
    return texts.length
      ? `<div class="cards">${texts.map((row) => `
        <article class="card">
          <h3>SMS · ${escapeHtml(row.asset_tag || row.reservation_id)}</h3>
          <p>Total $${Number(row.total_cents / 100).toFixed(2)} · tax $${Number(row.tax_cents / 100).toFixed(2)} · hull $${Number(row.hull_cents / 100).toFixed(2)}</p>
        </article>`).join('')}</div>`
      : '<div class="empty">No texts on the SMS desk for this identity.</div>';
  }
  if (tab === 'email') {
    return emails.length
      ? `<div class="cards">${emails.map((row) => `
        <article class="card">
          <h3>Email · ${escapeHtml(row.asset_tag || row.reservation_id || row.subject || 'Receipt')}</h3>
          <p>${escapeHtml(row.subject || row.body || 'Paid booking copy')}</p>
          <p>Total $${Number((row.total_cents || 0) / 100).toFixed(2)}</p>
        </article>`).join('')}</div>`
      : '<div class="empty">No emails on the mail desk for this identity.</div>';
  }
  if (tab === 'loyalty') {
    return punches.length
      ? `<div class="cards">${punches.map((row) => `
        <article class="card">
          <h4>Loyalty punch</h4>
          <p>Reservation ${escapeHtml(row.reservation_id)}</p>
        </article>`).join('')}</div>`
      : '<div class="empty">No loyalty punches for this identity.</div>';
  }
  if (tab === 'diary') {
    return holds.length
      ? `<div class="cards">${holds.map((row) => `
        <article class="card">
          <h4>Diary hold · ${escapeHtml(row.asset_tag || row.reservation_id)}</h4>
          <p>${escapeHtml(row.start_date)} through ${escapeHtml(row.end_date)}</p>
        </article>`).join('')}</div>`
      : '<div class="empty">No shop-diary holds for this identity.</div>';
  }
  return '<div class="empty">Unknown tab.</div>';
}

function switchNoticeTab(tab) {
  activeNoticeTab = tab;
  document.querySelectorAll('#notice-tabs button').forEach((button) => {
    button.classList.toggle('tab-active', button.dataset.tab === tab);
  });
  const host = document.getElementById('notice-tab-content');
  if (host) host.innerHTML = renderNoticeTabContent(tab);
}

async function showNotices() {
  activeNoticeTab = 'paper';
  document.getElementById('main-content').innerHTML = `
    <section class="page container">
      <h2>Paid receipts</h2>
      <p class="muted">Notice-desk copies, texts, emails, loyalty punches, and shop-diary holds visible to ${escapeHtml(currentUser.full_name)}.</p>
      <div class="tabs" id="notice-tabs" role="tablist" aria-label="Communications">
        <button type="button" class="tab-active" data-tab="paper" role="tab" aria-selected="true" onclick="switchNoticeTab('paper')">Paper</button>
        <button type="button" data-tab="sms" role="tab" onclick="switchNoticeTab('sms')">SMS</button>
        <button type="button" data-tab="email" role="tab" onclick="switchNoticeTab('email')">Email</button>
        <button type="button" data-tab="loyalty" role="tab" onclick="switchNoticeTab('loyalty')">Loyalty</button>
        <button type="button" data-tab="diary" role="tab" onclick="switchNoticeTab('diary')">Diary</button>
      </div>
      <div id="notice-tab-content"><div class="empty">Loading…</div></div>
    </section>`;
  try {
    const [noticeData, smsData, emailData, loyaltyData, holdData] = await Promise.all([
      api('/api/notices'),
      api('/api/sms'),
      api('/api/emails').catch(() => ({ receipts: [] })),
      api('/api/loyalty'),
      api('/api/calendar-holds')
    ]);
    noticeTabData = {
      receipts: noticeData.receipts || [],
      texts: smsData.receipts || [],
      emails: emailData.receipts || emailData.emails || [],
      punches: loyaltyData.punches || [],
      holds: holdData.holds || []
    };
    switchNoticeTab(activeNoticeTab);
  } catch (error) {
    document.getElementById('notice-tab-content').innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function showAuditLog(hostId) {
  let host = document.getElementById(hostId);
  if (!host && hostId !== 'main-content') return;
  if (hostId === 'main-content') {
    document.getElementById('main-content').innerHTML = `
      <section class="page container">
        <h2>Night audit log</h2>
        <p class="muted">Read-only ledger entries for ${escapeHtml(currentUser.full_name)}.</p>
        <div id="dashboard-content"><div class="empty">Loading audit…</div></div>
      </section>`;
    host = document.getElementById('dashboard-content');
  } else {
    host.innerHTML = '<div class="empty">Loading audit…</div>';
  }
  try {
    const { entries } = await api('/api/audit');
    host.innerHTML = entries?.length ? `
      <div class="audit-table-wrap">
        <table class="audit-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Previous</th>
              <th>New</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map((row) => `
              <tr>
                <td>${escapeHtml(String(row.created_at || '').slice(0, 19).replace('T', ' '))}</td>
                <td>${escapeHtml(row.action)}</td>
                <td>${escapeHtml(row.entity_type)} · ${escapeHtml(String(row.entity_id || '').slice(0, 8))}</td>
                <td>${escapeHtml(row.previous_state || '—')}</td>
                <td>${escapeHtml(row.new_state || '—')}</td>
                <td>${escapeHtml(row.reason || '—')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<div class="empty">No audit entries yet.</div>';
  } catch (error) {
    host.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function showHullBindsList(hostId) {
  let host = document.getElementById(hostId);
  if (!host && hostId !== 'main-content') return;
  if (hostId === 'main-content') {
    document.getElementById('main-content').innerHTML = `
      <section class="page container">
        <h2>Insurance bureau · hull binds</h2>
        <p class="muted">Signed hull riders visible to ${escapeHtml(currentUser.full_name)}.</p>
        <div id="dashboard-content"><div class="empty">Loading hull binds…</div></div>
      </section>`;
    host = document.getElementById('dashboard-content');
  } else {
    host.innerHTML = '<div class="empty">Loading hull binds…</div>';
  }
  try {
    const bindData = await api('/api/hull-binds');
    const binds = bindData.binds || [];
    host.innerHTML = binds.length
      ? `<div class="cards">${binds.map((row) => `
        <article class="card">
          <h4>Hull bind · ${escapeHtml(row.asset_tag || row.reservation_id || row.sessionId || 'Session')}</h4>
          <p>Premium $${Number((row.premium_cents || 0) / 100).toFixed(2)} · session ${escapeHtml(row.sessionId || '')}</p>
        </article>`).join('')}</div>`
      : '<div class="empty">No hull binds on the insurance bureau for this identity.</div>';
  } catch (error) {
    host.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function downloadHireWaiver(reservationId) {
  try {
    const response = await fetch(`/api/reservations/${reservationId}/hire-waiver.pdf`, {
      headers: { 'X-Demo-User-Id': userId() }
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Unable to download hire waiver');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gearvault-hire-waiver-${reservationId.slice(0, 8)}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Hire waiver downloaded.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function downloadCalendarIcs(reservationId) {
  try {
    const response = await fetch(`/api/reservations/${reservationId}/calendar.ics`, {
      headers: { 'X-Demo-User-Id': userId() }
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Unable to download calendar file');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gearvault-${reservationId.slice(0, 8)}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Calendar file downloaded.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function showReservations() {
  document.getElementById('main-content').innerHTML = `
    <section class="page container">
      <h2>${currentUser.role === 'customer' ? 'My reservations' : 'Counter'}</h2>
      <p class="muted">Showing bookings visible to ${escapeHtml(currentUser.full_name)}.</p>
      <div id="dashboard-content"><div class="empty">Loading…</div></div>
    </section>`;
  await showReservationsList('dashboard-content');
}

async function showReservationsList(hostId) {
  const host = document.getElementById(hostId);
  try {
    const { reservations } = await api('/api/reservations');
    host.innerHTML = reservations.length ? `<div class="cards">${reservations.map((row) => `
      <article class="card" data-reservation-id="${row.id}" data-asset-tag="${escapeHtml(row.asset_tag)}">
        <h4>${escapeHtml(row.asset_tag)} · ${escapeHtml(row.category)}</h4>
        <p><strong>Customer:</strong> ${escapeHtml(row.customer_name)}</p>
        <p><strong>Shop:</strong> ${escapeHtml(row.location_name)}</p>
        <p><strong>Dates:</strong> ${escapeHtml(row.start_date)} to ${escapeHtml(row.end_date)}</p>
        <p><strong>Rental:</strong> $${money(row.rental_subtotal_usd)}</p>
        <p><strong>Tax:</strong> $${money(row.tax_usd)}</p>
        <p><strong>Hull:</strong> $${money(row.hull_usd)}</p>
        <p><strong>Weekend:</strong> $${money(row.surcharge_usd)}</p>
        <p><strong>Deposit held:</strong> $${money(row.deposit_held_usd)}</p>
        <p><strong>Captured / released:</strong> $${money(row.deposit_captured_usd)} / $${money(row.deposit_released_usd)}</p>
        <span class="status">${escapeHtml(prettyStatus(row.status))}</span>
        ${currentUser.role === 'customer' && isPaidReservation(row.status)
          ? `<button type="button" class="btn secondary" aria-label="Download hire waiver for ${escapeHtml(row.asset_tag)}" onclick="downloadHireWaiver('${row.id}')">Download hire waiver (PDF)</button>
             <button type="button" class="btn secondary" aria-label="Download calendar for ${escapeHtml(row.asset_tag)}" onclick="downloadCalendarIcs('${row.id}')">Add to calendar (.ics)</button>`
          : ''}
        ${currentUser.role === 'customer' && row.status === 'CONFIRMED'
          ? `<button type="button" class="btn secondary" onclick="cancelReservation('${row.id}')">Cancel reservation</button>`
          : ''}
        ${isAssociate() && row.status === 'CONFIRMED'
          ? `<button type="button" class="btn" aria-label="Check out ${escapeHtml(row.asset_tag)}" onclick="checkoutReservation('${row.id}')">Check out ${escapeHtml(row.asset_tag)}</button>`
          : ''}
        ${isAssociate() && row.status === 'CHECKED_OUT'
          ? `<button type="button" class="btn" aria-label="Receive return of ${escapeHtml(row.asset_tag)}" onclick="returnReservation('${row.id}')">Receive return of ${escapeHtml(row.asset_tag)}</button>`
          : ''}
        <p id="res-error-${row.id}" class="error" role="alert"></p>
      </article>
    `).join('')}</div>` : `<div class="empty">No reservations found for this user.</div>`;
  } catch (error) {
    host.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function cancelReservation(id) {
  try {
    await api(`/api/reservations/${id}/cancel`, { method: 'POST', body: '{}' });
    showToast('Reservation cancelled.', 'success');
    await showReservations();
  } catch (error) {
    setResError(id, error);
  }
}

async function checkoutReservation(id) {
  try {
    const ticket = await api(`/api/reservations/${id}/scan-ticket`, { method: 'POST', body: '{}' });
    await api(`/api/reservations/${id}/checkout`, {
      method: 'POST',
      body: JSON.stringify({ scanTicket: ticket.ticketId })
    });
    showToast('Kit checked out.', 'success');
    await showReservations();
  } catch (error) {
    setResError(id, error);
  }
}

async function transferUnit(id, toShop) {
  const errorEl = document.getElementById('unit-action-error');
  if (errorEl) errorEl.textContent = '';
  try {
    const stamp = await api(`/api/units/${id}/transfer-stamp`, {
      method: 'POST',
      body: JSON.stringify({ to_shop: toShop })
    });
    await api(`/api/units/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ transferStamp: stamp.stampId, to_shop: toShop })
    });
    showToast(`Transfer to ${toShop} complete.`, 'success');
    await viewUnit(id);
  } catch (error) {
    if (errorEl) errorEl.textContent = error.message;
    else alert(error.message);
  }
}

async function returnReservation(id) {
  try {
    await api(`/api/reservations/${id}/return`, { method: 'POST', body: '{}' });
    showToast('Return received.', 'success');
    await showReservations();
  } catch (error) {
    setResError(id, error);
  }
}

function setResError(id, error) {
  const el = document.getElementById(`res-error-${id}`);
  if (el) el.textContent = error.message;
  else alert(error.message);
}

async function showCertifications() {
  document.getElementById('main-content').innerHTML = `
    <section class="page container">
      <h2>Certifications on file</h2>
      <div id="cert-list"><div class="empty">Loading…</div></div>
    </section>`;
  try {
    const { certifications } = await api('/api/certifications');
    document.getElementById('cert-list').innerHTML = certifications.length ? `<div class="cards">${certifications.map((row) => `
      <article class="card">
        <h4>${escapeHtml(row.certification_type)}</h4>
        <p><strong>Holder:</strong> ${escapeHtml(row.customer_name)}</p>
        <p><strong>Issued:</strong> ${escapeHtml(row.issued_on)}</p>
        <p><strong>Expires:</strong> ${escapeHtml(row.expires_on)}</p>
      </article>
    `).join('')}</div>` : '<div class="empty">No certifications on file.</div>';
  } catch (error) {
    showError('cert-list', error);
  }
}

async function showInspections() {
  document.getElementById('main-content').innerHTML = `
    <section class="page container">
      <h2>Returned kits awaiting inspection</h2>
      <div id="dashboard-content"><div class="empty">Loading…</div></div>
    </section>`;
  await showInspectionsList('dashboard-content');
}

async function showInspectionsList(hostId) {
  const host = document.getElementById(hostId);
  try {
    const { reservations } = await api('/api/reservations');
    const pending = reservations.filter((row) => row.status === 'RETURNED');
    host.innerHTML = pending.length ? `<div class="cards">${pending.map((row) => `
      <article class="card" data-reservation-id="${row.id}">
        <h4>${escapeHtml(row.asset_tag)}</h4>
        <p>${escapeHtml(row.customer_name)} · ${escapeHtml(row.start_date)} to ${escapeHtml(row.end_date)}</p>
        <p><strong>Deposit held:</strong> $${money(row.deposit_held_usd)}</p>
        <form onsubmit="fileDamage(event, '${row.id}')">
          <label for="dmg-desc-${row.id}">Damage description</label>
          <textarea id="dmg-desc-${row.id}" required></textarea>
          <label for="dmg-sev-${row.id}">Severity</label>
          <input id="dmg-sev-${row.id}" value="moderate" required>
          <label for="dmg-amt-${row.id}">Proposed deduction (USD)</label>
          <input id="dmg-amt-${row.id}" type="number" min="1" step="1" required>
          <p id="insp-error-${row.id}" class="error" role="alert"></p>
          <button class="btn" type="submit">File damage report</button>
        </form>
        <button type="button" class="btn secondary" onclick="clearInspection('${row.id}')">No damage — clear and release deposit</button>
      </article>
    `).join('')}</div>` : '<div class="empty">No returns waiting for inspection.</div>';
  } catch (error) {
    host.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function clearInspection(id) {
  try {
    await api(`/api/reservations/${id}/inspect-clear`, { method: 'POST', body: '{}' });
    await showInspections();
  } catch (error) {
    const el = document.getElementById(`insp-error-${id}`);
    if (el) el.textContent = error.message;
    else alert(error.message);
  }
}

async function fileDamage(event, reservationId) {
  event.preventDefault();
  const errorEl = document.getElementById(`insp-error-${reservationId}`);
  errorEl.textContent = '';
  try {
    const ticket = await api(`/api/reservations/${reservationId}/media-ticket`, { method: 'POST', body: '{}' });
    await api(`/api/reservations/${reservationId}/damage`, {
      method: 'POST',
      body: JSON.stringify({
        description: document.getElementById(`dmg-desc-${reservationId}`).value,
        severity: document.getElementById(`dmg-sev-${reservationId}`).value,
        proposedUsd: Number(document.getElementById(`dmg-amt-${reservationId}`).value),
        mediaTicket: ticket.ticketId
      })
    });
    await showInspections();
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

async function showDamageQueue() {
  document.getElementById('main-content').innerHTML = `
    <section class="page container">
      <h2>Damage reports</h2>
      <div id="dashboard-content"><div class="empty">Loading…</div></div>
    </section>`;
  await showDamageList('dashboard-content');
}

async function showDamageList(hostId) {
  const host = document.getElementById(hostId);
  try {
    const { reports } = await api('/api/damage-reports');
    host.innerHTML = reports.length ? `<div class="cards">${reports.map((row) => `
      <article class="card" data-report-id="${row.id}">
        <h4>${escapeHtml(row.asset_tag)} · ${escapeHtml(row.customer_name)}</h4>
        <p>${escapeHtml(row.description)}</p>
        <p><strong>Severity:</strong> ${escapeHtml(row.severity)}</p>
        <p><strong>Proposed:</strong> $${money(row.proposed_usd)}</p>
        <span class="status">${escapeHtml(prettyStatus(row.status))}</span>
        ${currentUser.role === 'shop_manager' && row.status === 'FILED' ? `
          <p id="dec-error-${row.id}" class="error" role="alert"></p>
          <button type="button" class="btn" onclick="decideDamage('${row.id}', 'approve')">Approve deduction</button>
          <button type="button" class="btn secondary" onclick="decideDamage('${row.id}', 'deny')">Deny</button>
        ` : ''}
      </article>
    `).join('')}</div>` : '<div class="empty">No damage reports.</div>';
  } catch (error) {
    host.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function decideDamage(id, action) {
  try {
    await api(`/api/damage-reports/${id}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ reason: action })
    });
    await showDamageQueue();
  } catch (error) {
    const el = document.getElementById(`dec-error-${id}`);
    if (el) el.textContent = error.message;
    else alert(error.message);
  }
}

async function showCustomers() {
  document.getElementById('main-content').innerHTML = `
    <section class="page container">
      <h2>Customers</h2>
      <div id="customer-list"><div class="empty">Loading…</div></div>
    </section>`;
  const customers = demoUsers.filter((user) => user.role === 'customer');
  document.getElementById('customer-list').innerHTML = `<div class="cards">${customers.map((user) => `
    <article class="card" data-customer-id="${user.id}">
      <h4>${escapeHtml(user.full_name)}</h4>
      <p>${escapeHtml(user.email)}</p>
      <span class="status">${escapeHtml(prettyStatus(user.account_status || 'ACTIVE'))}</span>
      <p id="hold-error-${user.id}" class="error" role="alert"></p>
      <button type="button" class="btn" onclick="setHold('${user.id}', true)">Place on hold</button>
      <button type="button" class="btn secondary" onclick="setHold('${user.id}', false)">Lift hold</button>
    </article>
  `).join('')}</div>`;
}

async function setHold(id, hold) {
  try {
    await api(`/api/customers/${id}/${hold ? 'hold' : 'release-hold'}`, {
      method: 'POST',
      body: JSON.stringify({ reason: hold ? 'unresolved damage' : 'balance cleared' })
    });
    await loadSession();
    await showCustomers();
  } catch (error) {
    const el = document.getElementById(`hold-error-${id}`);
    if (el) el.textContent = error.message;
    else alert(error.message);
  }
}

async function unitAction(id, action) {
  const errorEl = document.getElementById('unit-action-error');
  if (errorEl) errorEl.textContent = '';
  try {
    await api(`/api/units/${id}/${action}`, { method: 'POST', body: JSON.stringify({ reason: action }) });
    await viewUnit(id);
  } catch (error) {
    if (errorEl) errorEl.textContent = error.message;
    else alert(error.message);
  }
}

async function changeRate(event, id) {
  event.preventDefault();
  const errorEl = document.getElementById('unit-action-error');
  if (errorEl) errorEl.textContent = '';
  try {
    await api(`/api/units/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ dailyRateUsd: Number(document.getElementById('new-rate').value) })
    });
    await viewUnit(id);
  } catch (error) {
    if (errorEl) errorEl.textContent = error.message;
    else alert(error.message);
  }
}

function prettyStatus(value) {
  return String(value || '').replaceAll('_', ' ').toLowerCase();
}

function money(amount) {
  return Number(amount).toFixed(2).replace(/\.00$/, '');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function showError(id, error) {
  document.getElementById(id).innerHTML =
    `<p class="error">${escapeHtml(error.message)}</p>`;
}

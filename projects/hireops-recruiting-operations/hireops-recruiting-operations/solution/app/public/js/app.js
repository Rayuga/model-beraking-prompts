'use strict';
/* HireOps transaction desk: shared record views and accessible operation forms. */

const ROLE_LABELS = {
  recruiter: 'Recruiter',
  comp_partner: 'Comp partner',
  approver: 'Approver',
  finance_controller: 'Finance controller',
  auditor: 'Auditor',
};
const ROMAN = { 1: 'I', 2: 'II', 3: 'III' };

const WORKSPACES = [
  { id: 'changes', label: 'Coordinated Changes' },
  { id: 'requisitions', label: 'Requisitions' },
  { id: 'offers', label: 'Offers' },
  { id: 'equity', label: 'Equity Table' },
  { id: 'referrals', label: 'Referrals' },
  { id: 'audit', label: 'Audit Trail' },
];

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const kid of [].concat(kids)) if (kid != null) n.append(kid);
  return n;
};

let STATE = { user: null, boot: null, view: 'changes' };

async function api(method, path, body) {
  let res;
  try { res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  }); } catch { return { ok: false, status: 0, data: { error: 'The server could not be reached. Your entries are still here; try again.' } }; }
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  if (res.status === 401 && STATE.user && !path.startsWith('/api/auth/')) sessionLost();
  return { ok: res.ok, status: res.status, data };
}

function money(cents) {
  if (cents === null || cents === undefined || Number.isNaN(Number(cents))) return '—';
  const c = Number(cents);
  const s = c < 0 ? '-' : '';
  const a = Math.abs(c);
  return `${s}$${Math.floor(a / 100).toLocaleString('en-US')}.${String(a % 100).padStart(2, '0')}`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', { timeZone: 'UTC', timeZoneName: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return iso; }
}

function userName(id) {
  if (!id) return '—';
  const u = (STATE.boot && STATE.boot.users || []).find((x) => x.id === id);
  return u ? u.name : id;
}
function roleLabel(u) {
  if (!u) return '';
  const base = ROLE_LABELS[u.role] || u.role;
  if (u.role === 'approver' && u.authority_tier) return `${base} · Band ${ROMAN[u.authority_tier] || u.authority_tier}`;
  return base;
}

/* Human-readable summary of an action response (never a raw JSON dump). */
function summarize(obj) {
  if (obj == null) return 'Done.';
  if (typeof obj === 'string') return obj;
  if (obj.error) return obj.error;
  const bits = [];
  if (obj.approved) bits.push(`Approved ${obj.id || ''}`.trim());
  if (obj.revised) bits.push(`Revised → ${obj.revised_offer_id} (supersedes ${obj.superseded_offer_id})`);
  if (obj.rescinded) bits.push(`Rescinded ${obj.id || ''}`.trim());
  if (obj.created) bits.push(`Created ${obj.id || ''}`.trim());
  if (obj.composition && obj.composition.committed_run_rate_display)
    bits.push(`run-rate ${obj.composition.committed_run_rate_display}`);
  if (obj.fresh_commit_display) bits.push(`new commit ${obj.fresh_commit_display}`);
  if (obj.reversal_display) bits.push(`reversal ${obj.reversal_display}`);
  if (obj.clawback_display) bits.push(`clawback ${obj.clawback_display}`);
  if (obj.signing_vested_display) bits.push(`vested retained ${obj.signing_vested_display}`);
  if (obj.req_headroom_display) bits.push(`headroom ${obj.req_headroom_display}`);
  if (obj.headroom_display) bits.push(`headroom ${obj.headroom_display}`);
  if (!bits.length) return 'Action completed successfully.';
  return bits.join(' · ');
}

function flash(msg, kind = 'info') {
  const box = $('#flash');
  box.innerHTML = '';
  box.append(el('div', { class: `flash ${kind}`, text: summarize(msg) }));
}

function pendingState(button, container, message) {
  const label = button ? button.textContent : null;
  if (button) { button.disabled = true; button.textContent = message; button.setAttribute('aria-busy', 'true'); }
  if (container) container.setAttribute('aria-busy', 'true');
  const status = el('p', { class: 'pending-status', role: 'status', 'aria-live': 'polite', text: message });
  if (container) container.prepend(status);
  return () => {
    if (button) { button.disabled = false; button.textContent = label; button.removeAttribute('aria-busy'); }
    if (container) container.removeAttribute('aria-busy');
    status.remove();
  };
}

/* actionButton: POST/GET, show a readable summary, then refresh. */
function actionButton(label, method, path, bodyFn, opts = {}) {
  return el('button', {
    class: `action${opts.secondary ? ' secondary' : ''}${opts.danger ? ' danger' : ''}`,
    type: 'button',
    onclick: async (event) => {
      const button = event.currentTarget;
      const container = button.closest('.panel');
      if (container && [...container.querySelectorAll('input, select')].some((input) => !input.reportValidity())) return;
      let body;
      try { body = bodyFn ? bodyFn() : undefined; } catch (err) { flash(err.message || String(err), 'error'); return; }
      if (body === false) return;
      const done = pendingState(button, container, 'Saving changes…');
      const r = await api(method, typeof path === 'function' ? path() : path, body);
      done();
      flash(r.data || `${r.status}`, r.ok ? 'ok' : 'error');
      if (r.ok) { await refresh(); focusWorkspace(); }
    },
  }, [label]);
}

/* Details drawer (read-only content). */
let detailOpener = null;
function showDetail() {
  detailOpener = document.activeElement;
  $('#detail-backdrop').hidden = false;
  $('#main').inert = true;
  $('#topbar').inert = true;
  ($('#detail-body input') || $('#detail-close')).focus();
}
function focusWorkspace() {
  const heading = $('#workspace .page.active h1');
  if (heading) { heading.tabIndex = -1; heading.focus(); }
}
function openDetail(title, nodes) {
  $('#detail-title').textContent = title;
  const body = $('#detail-body');
  body.innerHTML = '';
  for (const node of [].concat(nodes)) if (node != null) body.append(node);
  showDetail();
}
function closeDetail() {
  if ($('#detail-backdrop').hidden) return;
  $('#detail-backdrop').hidden = true;
  $('#detail-body').innerHTML = '';
  $('#main').inert = false;
  $('#topbar').inert = false;
  if (detailOpener && detailOpener.isConnected) detailOpener.focus();
  else focusWorkspace();
}

/* openForm: a labelled form inside the drawer (replaces window.prompt). fields is
 * an array of { name, label, type, value, options }. onSubmit(values) returns a
 * {method, path, body} descriptor; the response is summarised into the flash. */
function openForm(title, fields, submitLabel, buildRequest) {
  $('#detail-title').textContent = title;
  const body = $('#detail-body');
  body.innerHTML = '';
  const inputs = {};
  const form = el('form', { class: 'drawer-form' });
  for (const f of fields) {
    let input;
    if (f.type === 'select') {
      input = el('select', { name: f.name }, (f.options || []).map((o) =>
        el('option', { value: o.value, text: o.label, ...(o.value === f.value ? { selected: 'selected' } : {}) })));
    } else {
      input = el('input', { name: f.name, type: f.type || 'text', value: f.value == null ? '' : String(f.value), required: '', min: f.type === 'number' ? '0' : null, step: f.step || (f.type === 'number' ? '0.01' : null) });
    }
    inputs[f.name] = input;
    form.append(el('label', {}, [el('span', { text: f.label }), input]));
  }
  form.append(el('div', { class: 'actionbar' }, [el('button', { class: 'action', type: 'submit', text: submitLabel })]));
  const error = el('p', { class: 'error', role: 'alert' });
  form.append(error);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = {};
    for (const [k, node] of Object.entries(inputs)) values[k] = node.value;
    let req;
    try { req = buildRequest(values); } catch (err) { error.textContent = String(err && err.message || err); return; }
    if (!req) return;
    const submit = form.querySelector('button[type="submit"]');
    const done = pendingState(submit, form, 'Saving changes…');
    error.textContent = '';
    const r = await api(req.method, req.path, req.body);
    done();
    if (!r.ok) { error.textContent = summarize(r.data || `${r.status}`); return; }
    flash(r.data || `${r.status}`, r.ok ? 'ok' : 'error');
    closeDetail();
    await refresh();
    focusWorkspace();
  });
  body.append(form);
  showDetail();
}

const HELPERS = () => ({ el, actionButton, openDetail, openForm, api, flash, refresh, money, fmtTime, userName, roleLabel, romanTier: (t) => ROMAN[t] || t });

function setView(view) {
  STATE.view = view;
  $('#flash').innerHTML = '';
  renderAll();
  focusWorkspace();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = '';
  for (const ws of WORKSPACES) {
    nav.append(el('button', {
      type: 'button',
      'data-view': ws.id,
      class: STATE.view === ws.id ? 'active' : '',
      onclick: () => setView(ws.id),
    }, [ws.label]));
  }
}

function renderAll() {
  const boot = STATE.boot || {};
  for (const btn of $('#nav').querySelectorAll('button')) {
    btn.classList.toggle('active', btn.dataset.view === STATE.view);
    if (btn.dataset.view === STATE.view) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
  const root = $('#workspace');
  const pages = window.renderWorkspaces ? window.renderWorkspaces(boot, HELPERS()) : [];
  const byId = Object.fromEntries(pages.map((p) => [p.dataset.workspace, p]));
  // The change desk is one long-lived node patched in place; it is never detached,
  // so a refresh cannot take the operator's typing, focus or scroll with it.
  byId.changes = window.renderChangeSets(boot, HELPERS());
  for (const old of [...root.children]) if (old !== byId.changes) old.remove();
  for (const ws of WORKSPACES) {
    const page = byId[ws.id];
    if (!page) continue;
    page.classList.toggle('active', STATE.view === ws.id);
    for (const scroll of page.querySelectorAll('.table-wrap')) {
      scroll.tabIndex = 0;
      scroll.setAttribute('role', 'region');
      const heading = scroll.closest('.panel')?.querySelector('h2');
      scroll.setAttribute('aria-label', (heading ? heading.textContent : ws.label) + ' table; scroll horizontally for more columns');
    }
    if (page !== byId.changes || !page.isConnected) root.append(page);
  }
}

async function refresh(opts = {}) {
  // On the change desk nothing is inserted above the editor while loading.
  const quiet = opts.quiet || (STATE.view === 'changes' && STATE.boot);
  const done = quiet ? () => {} : pendingState(null, $('#workspace'), 'Loading workspace…');
  const r = await api('GET', '/api/bootstrap');
  done();
  if (!STATE.user) return r;
  if (r.ok) { STATE.boot = r.data; if (!$('#nav').children.length) renderNav(); renderAll(); }
  else if (!quiet) flash(r.data || 'The workspace could not be loaded. Please try again.', 'error');
  return r;
}

/* Live desk. One tab per browser profile holds the event stream and relays it to
 * the others, so any number of open tabs costs one connection. */
let liveTimer = null, stream = null, relay = null, releaseStream = null, lockWait = null;
function liveUpdate() {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(async () => {
    if (!STATE.user) return;
    // The other workspaces rebuild, so an update waits while one of their forms holds unsent entries.
    const dirty = STATE.view !== 'changes' && (!$('#detail-backdrop').hidden
      || [...$('#workspace').querySelectorAll('.page.active input, .page.active select')].some((n) =>
        n.tagName === 'SELECT' ? n.selectedIndex !== Math.max(0, [...n.options].findIndex((o) => o.defaultSelected)) : n.value !== n.defaultValue));
    if (dirty) return liveUpdate();
    const x = window.scrollX, y = window.scrollY;
    await refresh({ quiet: true });
    if (STATE.view !== 'changes') window.scrollTo(x, y);
  }, 400);
}
function startLive() {
  stopLive();
  if (window.BroadcastChannel) { relay = new BroadcastChannel('hireops-books'); relay.onmessage = liveUpdate; }
  const open = () => {
    if (!STATE.user) return;
    stream = new EventSource('/api/events');
    stream.onopen = liveUpdate;               // catch up on anything posted while no stream was open
    stream.addEventListener('books', () => { liveUpdate(); if (relay) relay.postMessage('changed'); });
    stream.onerror = () => {
      if (stream && stream.readyState === EventSource.CLOSED) { stream = null; setTimeout(() => { if (!stream && (releaseStream || !navigator.locks)) open(); }, 3000); }
    };
  };
  if (navigator.locks) {
    lockWait = new AbortController();
    navigator.locks.request('hireops-events', { signal: lockWait.signal }, () => {
      lockWait = null;
      if (!STATE.user) return undefined;      // signed out while queued: do not hold the stream for nobody
      return new Promise((resolve) => { releaseStream = resolve; open(); });
    }).catch(() => {});
  } else open();
}
function stopLive() {
  clearTimeout(liveTimer);
  if (stream) { stream.close(); stream = null; }
  if (relay) { relay.close(); relay = null; }
  if (releaseStream) { releaseStream(); releaseStream = null; }
  if (lockWait) { lockWait.abort(); lockWait = null; }
}
/* A session that ends mid-edit returns to sign-in. Unsent change entries stay in
 * this browser for the same person and are never shown to anyone else. */
function sessionLost() {
  const email = STATE.user && STATE.user.email;
  STATE = { user: null, boot: null, view: STATE.view };
  closeDetail();
  showLogin();
  if (email) $('#email').value = email;
  $('#login-error').textContent = 'Your session has ended. Sign in again to continue; your unsent coordinated-change entries are kept for you.';
}

function showApp() {
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  $('#logout').hidden = false;
  $('#who').textContent = STATE.user ? `${STATE.user.name} · ${roleLabel(STATE.user)}` : '';
  startLive();
}
function showLogin() {
  $('#login-view').hidden = false;
  $('#app-view').hidden = true;
  $('#logout').hidden = true;
  $('#who').textContent = '';
  $('#nav').innerHTML = '';
  $('#workspace').innerHTML = '';
  window.resetChangeDesk();
  stopLive();
  $('#flash').innerHTML = '';
  $('#email').focus();
}

async function boot() {
  const done = pendingState($('#login-form button[type="submit"]'), $('#login-form'), 'Checking sign-in…');
  const me = await api('GET', '/api/auth/me');
  done();
  if (me.ok) { STATE.user = me.data; showApp(); await refresh(); }
  else showLogin();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  const done = pendingState($('#login-form button[type="submit"]'), $('#login-form'), 'Signing in…');
  const r = await api('POST', '/api/auth/login', { email: $('#email').value, password: $('#password').value });
  done();
  if (r.ok) { STATE.user = r.data; showApp(); await refresh(); }
  else $('#login-error').textContent = (r.data && r.data.error) || 'sign-in failed';
});

$('#logout').addEventListener('click', async () => {
  await api('POST', '/api/auth/logout');
  STATE = { user: null, boot: null, view: 'changes' };
  closeDetail();
  showLogin();
});

$('#detail-close').addEventListener('click', closeDetail);
$('#detail-backdrop').addEventListener('click', (e) => { if (e.target === $('#detail-backdrop')) closeDetail(); });
document.addEventListener('keydown', (e) => {
  if ($('#detail-backdrop').hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); closeDetail(); }
  if (e.key === 'Tab') {
    const stops = [...$('#detail-drawer').querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter((n) => !n.disabled && !n.hidden);
    const first = stops[0], last = stops[stops.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

boot();

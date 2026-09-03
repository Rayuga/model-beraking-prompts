'use strict';

const ROLE_LABELS = {
  proxy: 'Submitter-proxy',
  approver: 'Approver',
  finance: 'Finance',
  auditor: 'Auditor',
};

const ALL_WORKSPACES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'reports', label: 'Reports' },
  { id: 'cost-centers', label: 'Cost Centers' },
  { id: 'audit', label: 'Audit' },
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

let STATE = { user: null, boot: null, view: 'dashboard' };

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  return { ok: res.ok, status: res.status, data };
}

function flash(msg, kind = 'info') {
  const box = $('#flash');
  box.innerHTML = '';
  const text = typeof msg === 'string' ? msg : (msg && msg.error) || summarize(msg);
  box.append(el('div', { class: `flash ${kind}`, text, role: 'status' }));
}

function summarize(obj) {
  if (!obj || typeof obj !== 'object') return String(obj);
  const bits = [];
  for (const key of ['error', 'report_id', 'line_id', 'state', 'required_tier', 'approved_tier']) {
    if (obj[key] != null) bits.push(`${key.replace(/_/g, ' ')}: ${obj[key]}`);
  }
  if (!bits.length) return 'Action completed successfully.';
  return bits.join(' · ');
}

function actionButton(label, method, path, bodyFn, opts = {}) {
  return el('button', {
    class: `action${opts.secondary ? ' secondary' : ''} small`,
    type: 'button',
    onclick: async () => {
      let body;
      try { body = bodyFn ? bodyFn() : undefined; } catch { return; }
      if (body === false) return;
      const r = await api(method, typeof path === 'function' ? path() : path, body);
      flash(r.data || `${r.status}`, r.ok ? 'ok' : 'error');
      await refresh();
    },
  }, [label]);
}

function openDetail(title, nodes) {
  $('#detail-title').textContent = title;
  const body = $('#detail-body');
  body.innerHTML = '';
  for (const node of nodes) body.append(node);
  $('#detail-backdrop').hidden = false;
}
function closeDetail() {
  $('#detail-backdrop').hidden = true;
  $('#detail-body').innerHTML = '';
}

function visibleWorkspaces() {
  return ALL_WORKSPACES;
}

function setView(view) {
  STATE.view = view;
  $('#flash').innerHTML = '';
  for (const btn of $('#nav').querySelectorAll('button')) {
    btn.classList.toggle('active', btn.dataset.view === view);
  }
  renderAll();
}

function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = '';
  for (const ws of visibleWorkspaces()) {
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
  const root = $('#workspace');
  root.innerHTML = '';
  const pages = window.renderWorkspaces
    ? window.renderWorkspaces(boot, { el, actionButton, openDetail, closeDetail, api, flash, refresh })
    : [];
  const byId = Object.fromEntries(pages.map((p) => [p.dataset.workspace, p]));
  for (const ws of visibleWorkspaces()) {
    const page = byId[ws.id];
    if (!page) continue;
    page.classList.toggle('active', STATE.view === ws.id);
    root.append(page);
  }
}

async function refresh() {
  const r = await api('GET', '/api/bootstrap');
  if (r.ok) { STATE.boot = r.data; STATE.user = r.data.user; renderNav(); renderAll(); showApp(); }
  return r;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('expenseflow-theme', theme);
  $('#theme-toggle').textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
}

// Approvers all share the role "approver"; the tier NAME (not just the dollar
// limit) is what a demo-account check reads, so spell it out using the same
// policy thresholds the server already sent in bootstrap.
function approverTierLabel(limitCents) {
  const pol = (STATE.boot || {}).policy || {};
  if (limitCents == null || pol.tier_manager_max_cents == null) return 'Approver';
  if (limitCents <= pol.tier_manager_max_cents) return 'Manager-tier approver';
  if (limitCents <= pol.tier_director_max_cents) return 'Director-tier approver';
  return 'Controller-tier approver';
}
function showApp() {
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  $('#logout').hidden = false;
  const u = STATE.user || {};
  const role = u.role === 'approver' ? approverTierLabel(u.approval_limit_cents) : (ROLE_LABELS[u.role] || u.role || '');
  const tier = u.approval_limit_display ? ` · limit ${u.approval_limit_display}` : '';
  $('#who').textContent = STATE.user ? `${u.name} · ${role}${tier}` : '';
}
function showLogin() {
  $('#login-view').hidden = false;
  $('#app-view').hidden = true;
  $('#logout').hidden = true;
  $('#who').textContent = '';
}

async function boot() {
  applyTheme(localStorage.getItem('expenseflow-theme') || 'light');
  $('#theme-toggle').textContent = document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode';
  const me = await api('GET', '/api/auth/me');
  if (me.ok) { STATE.user = me.data; await refresh(); }
  else showLogin();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  const r = await api('POST', '/api/auth/login', { email: $('#email').value, password: $('#password').value });
  if (r.ok) { STATE.user = r.data; await refresh(); }
  else $('#login-error').textContent = (r.data && r.data.error) || 'sign-in failed';
});

$('#logout').addEventListener('click', async () => {
  await api('POST', '/api/auth/logout');
  STATE = { user: null, boot: null, view: 'dashboard' };
  showLogin();
});

$('#theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
});

$('#detail-close').addEventListener('click', closeDetail);
$('#detail-backdrop').addEventListener('click', (e) => {
  if (e.target === $('#detail-backdrop')) closeDetail();
});

boot();

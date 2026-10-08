'use strict';
/* HireOps shell: sign-in, navigation, live updates and the Activity view.
 *
 * Each workspace is built once per signed-in person and then patched in place, so a
 * live update never takes away what someone is typing, where their cursor is or how
 * far they have scrolled. */
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of [].concat(kids)) if (kid != null) n.append(kid);
  return n;
};
const STAGE_NAMES = { APPLIED: 'Applied', SCREEN: 'Screen', INTERVIEW: 'Interview', OFFER: 'Offer', HIRED: 'Hired', REJECTED: 'Rejected' };
const ROLE_NAMES = { recruiter: 'Recruiter', hiring_manager: 'Hiring manager', observer: 'Observer', candidate: 'Candidate' };
const when = (iso) => new Date(iso).toLocaleString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' UTC';

let STATE = { user: null, boot: null, view: null };
let views = null;   // { id: { label, node, update(boot), badge?(boot), shown?() } }

async function api(method, path, body) {
  let res;
  try {
    res = await fetch(path, { method, credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  } catch { return { ok: false, status: 0, data: { error: 'The server could not be reached. Nothing was sent; what you entered is still here.' } }; }
  let data = null;
  try { data = await res.json(); } catch { /* not json */ }
  if (res.status === 401 && STATE.user && !path.startsWith('/api/auth/')) sessionLost();
  return { ok: res.ok, status: res.status, data };
}

/* Per-person keepsakes in this browser: drafts, the chosen job, the open conversation. */
const keep = {
  key: (name) => `hireops.${STATE.user ? STATE.user.id : 'none'}.${name}`,
  get(name) { try { return localStorage.getItem(this.key(name)); } catch { return null; } },
  set(name, value) { try { if (value === '' || value == null) localStorage.removeItem(this.key(name)); else localStorage.setItem(this.key(name), value); } catch { /* storage unavailable */ } },
};

function activityView() {
  const state = { job: '', shown: 50 };
  const filter = el('select', { 'aria-label': 'Show activity for' });
  const list = el('ol', { class: 'activity-list' });
  const more = el('button', { type: 'button', class: 'secondary', text: 'Show more' });
  const node = el('section', { class: 'page', 'data-view': 'activity' }, [
    el('h1', { text: 'Activity' }),
    el('label', { class: 'field inline' }, [el('span', { text: 'Show activity for' }), filter]),
    list, more]);
  const rows = new Map();
  let boot = null;
  function render() {
    const jobs = boot.jobs;
    const options = [['', 'All jobs'], ...jobs.map((j) => [j.id, j.title])];
    const sig = JSON.stringify(options);
    if (filter.dataset.sig !== sig) {
      filter.dataset.sig = sig;
      filter.replaceChildren(...options.map(([value, text]) => el('option', { value, text })));
      filter.value = state.job;
    }
    const items = boot.activity.filter((a) => !state.job || a.job_id === state.job);
    const wanted = items.slice(0, state.shown);
    const seen = new Set();
    wanted.forEach((a, i) => {
      seen.add(a.id);
      let row = rows.get(a.id);
      if (!row) {
        const job = jobs.find((j) => j.id === a.job_id);
        row = el('li', {}, [el('span', { class: 'what', text: a.detail }), el('span', { class: 'muted', text: `${job ? job.title : a.job_id} · ${when(a.created_at)}` })]);
        rows.set(a.id, row);
      }
      if (list.children[i] !== row) list.insertBefore(row, list.children[i] || null);
    });
    for (const [id, row] of rows) if (!seen.has(id)) { row.remove(); rows.delete(id); }
    more.hidden = items.length <= state.shown;
    more.textContent = `Show more (${items.length - state.shown} earlier)`;
  }
  filter.addEventListener('change', () => { state.job = filter.value; state.shown = 50; render(); });
  more.addEventListener('click', () => { state.shown += 50; render(); });
  return { label: 'Activity', node, update(b) { boot = b; render(); } };
}

function buildViews(boot) {
  const H = { el, api, refresh, keep, when, STAGE_NAMES, ROLE_NAMES, go: setView, user: boot.user };
  if (boot.user.role === 'candidate') return { threads: window.threadsView(H, true) };
  return { board: window.boardView(H), threads: window.threadsView(H, false), activity: activityView() };
}

function setView(id, detail) {
  STATE.view = id;
  keep.set('view', id);
  for (const [key, v] of Object.entries(views)) v.node.classList.toggle('active', key === id);
  for (const b of $('#nav').children) { if (b.dataset.view === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
  if (views[id].shown) views[id].shown(detail);
}

function render() {
  const boot = STATE.boot;
  if (!views) {
    views = buildViews(boot);
    const root = $('#app-view');
    root.replaceChildren(...Object.values(views).map((v) => v.node));
    $('#nav').replaceChildren(...Object.entries(views).map(([id, v]) =>
      el('button', { type: 'button', 'data-view': id, onclick: () => setView(id) }, [el('span', { text: v.label }), el('span', { class: 'badge', hidden: true })])));
    const saved = keep.get('view');
    for (const v of Object.values(views)) v.update(boot);
    setView(views[saved] ? saved : Object.keys(views)[0]);
  } else {
    for (const v of Object.values(views)) v.update(boot);
  }
  paintNavBadges();
}

/* The nav totals follow the per-conversation counts, including a conversation that a view
 * has just marked read locally, so the total never lags behind the row it adds up. */
function paintNavBadges() {
  if (!views || !STATE.boot) return;
  for (const b of $('#nav').children) {
    const v = views[b.dataset.view], badge = b.querySelector('.badge');
    const n = v.badge ? v.badge(STATE.boot) : 0;
    badge.hidden = !n;
    badge.textContent = n ? String(n) : '';
    if (n) badge.setAttribute('aria-label', `${n} unread`); else badge.removeAttribute('aria-label');
  }
}
window.paintNavBadges = paintNavBadges;

async function refresh() {
  const r = await api('GET', '/api/bootstrap');
  if (r.ok && STATE.user) { STATE.boot = r.data; render(); }
  return r;
}

/* Live updates. One tab per browser profile holds the event stream and relays it to
 * the others, so any number of open tabs costs one connection. */
let liveTimer = null, stream = null, relay = null, releaseStream = null, lockWait = null;
function liveUpdate() {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { if (STATE.user) refresh(); }, 300);
}
function startLive() {
  stopLive();
  if (window.BroadcastChannel) { relay = new BroadcastChannel('hireops-live'); relay.onmessage = liveUpdate; }
  const open = () => {
    if (!STATE.user) return;
    stream = new EventSource('/api/events');
    stream.onopen = liveUpdate;
    stream.addEventListener('changed', () => { liveUpdate(); if (relay) relay.postMessage('changed'); });
    stream.onerror = () => {
      if (stream && stream.readyState === EventSource.CLOSED) { stream = null; setTimeout(() => { if (!stream && (releaseStream || !navigator.locks)) open(); }, 3000); }
    };
  };
  if (navigator.locks) {
    lockWait = new AbortController();
    navigator.locks.request('hireops-events', { signal: lockWait.signal }, () => {
      lockWait = null;
      if (!STATE.user) return undefined;
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

function showApp() {
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  $('#logout').hidden = false;
  $('#who').textContent = `${STATE.user.name} · ${ROLE_NAMES[STATE.user.role]}`;
  startLive();
}
function showLogin(note) {
  stopLive();
  views = null;
  $('#login-view').hidden = false;
  $('#app-view').hidden = true;
  $('#app-view').replaceChildren();
  $('#nav').replaceChildren();
  $('#logout').hidden = true;
  $('#who').textContent = '';
  $('#login-note').textContent = note || '';
  $('#login-error').textContent = '';
  $('#password').value = '';
  $('#email').focus();
}
/* A session that ends mid-work returns to sign-in. Drafts stay in this browser for
 * the same person and are never shown to anyone else. */
function sessionLost() {
  const email = STATE.user.email;
  STATE = { user: null, boot: null, view: null };
  showLogin('Your session has ended. Sign in again to carry on; anything you had not sent is kept for you.');
  $('#email').value = email;
  $('#password').focus();
}

async function start() {
  const me = await api('GET', '/api/auth/me');
  if (me.ok) { STATE.user = me.data; showApp(); await refresh(); } else showLogin();
}
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  const r = await api('POST', '/api/auth/login', { email: $('#email').value, password: $('#password').value });
  if (r.ok) { STATE.user = r.data; showApp(); await refresh(); }
  else $('#login-error').textContent = (r.data && r.data.error) || 'Sign-in failed.';
});
$('#logout').addEventListener('click', async () => {
  await api('POST', '/api/auth/logout');
  STATE = { user: null, boot: null, view: null };
  showLogin();
});
start();

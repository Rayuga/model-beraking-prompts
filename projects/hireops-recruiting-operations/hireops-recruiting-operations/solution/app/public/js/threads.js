'use strict';
/* Conversations. The message list is appended to, never rebuilt, so a message that
 * arrives while someone is reading or writing leaves their place, their draft and
 * their cursor alone. Drafts are kept per person and per conversation. */
window.threadsView = function (H, candidate) {
  const { el, api, refresh, keep, when, user } = H;
  let boot = null, openId = candidate ? null : keep.get('thread') || null, loading = false, sending = false, wasBottom = true, savedTop = 0;
  const cache = new Map();     // application id -> { messages, earlier, seenUpTo, pending }
  const rows = new Map();      // application id -> list entry
  const items = new Map();     // message id -> node (open conversation only)

  const list = el('ul', { class: 'thread-list', 'aria-label': 'Conversations' });
  const head = el('h2', { tabindex: '-1' });
  const sub = el('p', { class: 'muted' });
  const earlier = el('button', { type: 'button', class: 'secondary', hidden: true });
  const log = el('ol', { class: 'messages', 'aria-label': 'Messages', tabindex: '0' });
  const fresh = el('button', { type: 'button', class: 'new-pill', hidden: true });
  const box = el('textarea', { rows: '3', 'aria-label': 'Write a message' });
  const sendBtn = el('button', { type: 'submit', class: 'primary', text: 'Send' });
  const error = el('p', { class: 'error', role: 'alert' });
  const hint = el('p', { class: 'muted', text: 'Enter sends. Shift+Enter starts a new line.' });
  const composer = el('form', { class: 'composer' }, [box, el('div', { class: 'actionbar' }, [sendBtn, hint]), error]);
  const readOnly = el('p', { class: 'note', text: 'You can read this conversation but cannot write in it.', hidden: true });
  const empty = el('p', { class: 'muted', text: 'Choose a conversation.' });
  const pane = el('div', { class: 'thread-pane panel' }, [empty, head, sub, earlier, log, fresh, composer, readOnly]);
  const node = el('section', { class: 'page', 'data-view': 'threads' }, [
    el('h1', { text: candidate ? 'My applications' : 'Conversations' }),
    el('div', { class: 'threads' }, [el('div', { class: 'panel list-panel' }, [list]), pane])]);

  const threads = () => boot.applications.filter((a) => candidate || a.thread);
  const jobTitle = (a) => (candidate ? a.job_title : (boot.jobs.find((j) => j.id === a.job_id) || {}).title);
  const atBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  const toBottom = () => { log.scrollTop = log.scrollHeight; };

  /* ---------------------------------------------------------------- list of conversations */
  function renderList() {
    const held = document.activeElement;      // moving a row's node drops focus; hand it back
    const sorted = [...threads()].sort((x, y) => ((y.last_message ? y.last_message.id : 0) - (x.last_message ? x.last_message.id : 0)) || x.id.localeCompare(y.id));
    const seen = new Set();
    sorted.forEach((a, i) => {
      seen.add(a.id);
      let row = rows.get(a.id);
      if (!row) {
        row = { name: el('strong'), where: el('span', { class: 'muted' }), preview: el('span', { class: 'preview' }), badge: el('span', { class: 'badge', hidden: true }) };
        row.button = el('button', { type: 'button', class: 'thread-row', onclick: () => open(a.id, true) }, [el('span', { class: 'thread-top' }, [row.name, row.badge]), row.where, row.preview]);
        row.node = el('li', {}, [row.button]);
        rows.set(a.id, row);
      }
      const sig = JSON.stringify([a.candidate_name, a.status, a.unread, a.last_message && a.last_message.id, openId === a.id]);
      if (row.sig !== sig) {
        row.sig = sig;
        row.name.textContent = candidate ? jobTitle(a) : a.candidate_name;
        row.where.textContent = candidate ? `${a.team} · ${a.status}` : jobTitle(a);
        row.preview.textContent = a.last_message ? `${a.last_message.sender_name}: ${a.last_message.body}` : 'No messages yet.';
        row.badge.hidden = !a.unread;
        row.badge.textContent = a.unread ? String(a.unread) : '';
        if (a.unread) row.badge.setAttribute('aria-label', `${a.unread} unread`);
        if (openId === a.id) row.button.setAttribute('aria-current', 'true'); else row.button.removeAttribute('aria-current');
      }
      if (list.children[i] !== row.node) list.insertBefore(row.node, list.children[i] || null);
    });
    for (const [id, row] of rows) if (!seen.has(id)) { row.node.remove(); rows.delete(id); }
    if (held && held !== document.activeElement && held.isConnected && list.contains(held)) held.focus();
    if (!sorted.length && !list.querySelector('.none')) list.append(el('li', { class: 'muted none', text: 'No conversations yet.' }));
  }

  /* ---------------------------------------------------------------- messages */
  function messageNode(m) {
    const state = el('span', { class: 'muted receipt' });
    const n = el('li', { class: 'message' + (m.mine ? ' mine' : ''), 'data-message': m.id }, [
      el('div', { class: 'message-head' }, [el('strong', { text: m.mine ? 'You' : m.sender_name }), el('span', { class: 'muted', text: when(m.created_at) })]),
      el('p', { class: 'body', text: m.body }), state]);
    n.receipt = state;
    return n;
  }
  function paint(c) {
    // The newest message of mine says whether the other side has opened it yet.
    const mine = c.messages.filter((m) => m.mine);
    const last = mine[mine.length - 1];
    for (const m of mine) {
      const n = items.get(m.id);
      if (n) n.receipt.textContent = m === last ? (m.id <= c.seenUpTo ? 'Seen' : 'Sent') : '';
    }
    // The button stays in place at the start of the conversation so the list never shifts under the reader.
    earlier.hidden = false;
    earlier.disabled = !c.earlier;
    earlier.textContent = c.earlier ? `Show earlier messages (${c.earlier} more)` : 'Start of conversation';
    fresh.hidden = !c.pending;
    fresh.textContent = c.pending === 1 ? '1 new message' : `${c.pending} new messages`;
  }
  function append(c, messages) {
    for (const m of messages) {
      if (items.has(m.id)) continue;
      c.messages.push(m);
      const n = messageNode(m);
      items.set(m.id, n);
      log.append(n);
    }
  }
  async function markRead(id) {
    const c = cache.get(id);
    if (!c || !c.messages.length) return;
    const a = threads().find((x) => x.id === id);
    if (!a || !a.unread) return;
    a.unread = 0;
    c.pending = 0;
    renderList(); paint(c);
    if (window.paintNavBadges) window.paintNavBadges();
    await api('POST', `/api/applications/${encodeURIComponent(id)}/read`, { up_to: c.messages[c.messages.length - 1].id });
  }
  async function open(id, focus) {
    if (loading) return;
    if (openId && openId !== id) keep.set('draft.' + openId, box.value);
    const a = threads().find((x) => x.id === id);
    if (!a) return;
    loading = true;
    const r = await api('GET', `/api/applications/${encodeURIComponent(id)}/messages`);
    loading = false;
    if (!r.ok) return;
    openId = id; keep.set('thread', id);
    const c = { messages: [], earlier: r.data.earlier_count, seenUpTo: r.data.seen_up_to, pending: 0 };
    cache.set(id, c);
    items.clear(); log.replaceChildren();
    append(c, r.data.messages);
    box.value = keep.get('draft.' + id) || '';
    error.textContent = '';
    showPane();
    renderList(); paint(c);
    toBottom(); wasBottom = true;
    if (focus) head.focus();
    markRead(id);
  }
  function showPane() {
    const a = threads().find((x) => x.id === openId);
    const has = !!a;
    empty.hidden = has;
    for (const n of [head, sub, log]) n.hidden = !has;
    if (!has) { composer.hidden = true; readOnly.hidden = true; earlier.hidden = true; fresh.hidden = true; return; }
    head.textContent = candidate ? jobTitle(a) : a.candidate_name;
    sub.textContent = candidate ? `${a.team} · Status: ${a.status}` : `${jobTitle(a)} · ${a.candidate_email}`;
    const write = candidate || a.thread === 'write';
    composer.hidden = !write;
    readOnly.hidden = write;
  }
  /* Called on every live update while a conversation is open. */
  async function catchUp() {
    const id = openId, c = cache.get(id);
    if (!c || loading) return;
    const lastId = c.messages.length ? c.messages[c.messages.length - 1].id : 0;
    const r = await api('GET', `/api/applications/${encodeURIComponent(id)}/messages?after=${lastId}`);
    if (!r.ok || openId !== id) return;
    const active = node.classList.contains('active') && !document.hidden;
    const stay = active ? atBottom() : wasBottom;
    const incoming = r.data.messages.filter((m) => !items.has(m.id));
    append(c, incoming);
    c.seenUpTo = r.data.seen_up_to;
    const theirs = incoming.filter((m) => !m.mine).length;
    if (stay) { toBottom(); paint(c); if (theirs && active) markRead(id); }
    else { c.pending += theirs; paint(c); }       // reading earlier messages: stay put, say that more arrived
  }
  earlier.addEventListener('click', async () => {
    const id = openId, c = cache.get(id);
    if (!c || !c.messages.length || earlier.dataset.busy) return;
    earlier.dataset.busy = '1';
    const r = await api('GET', `/api/applications/${encodeURIComponent(id)}/messages?before=${c.messages[0].id}`);
    delete earlier.dataset.busy;
    if (!r.ok || openId !== id) return;
    const height = log.scrollHeight, top = log.scrollTop;
    const nodes = r.data.messages.map((m) => { const n = messageNode(m); items.set(m.id, n); return n; });
    c.messages.unshift(...r.data.messages);
    log.prepend(...nodes);
    log.scrollTop = top + (log.scrollHeight - height);     // what was on screen stays where it was
    c.earlier = r.data.earlier_count;
    paint(c);
    log.focus();
  });
  fresh.addEventListener('click', () => { toBottom(); markRead(openId); box.focus(); });
  log.addEventListener('scroll', () => {
    if (!node.classList.contains('active')) return;
    wasBottom = atBottom(); savedTop = log.scrollTop;
    const c = cache.get(openId); if (c && c.pending && wasBottom) markRead(openId);
  });
  box.addEventListener('input', () => { if (openId) keep.set('draft.' + openId, box.value); });
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); composer.requestSubmit(); } });
  composer.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = openId, body = box.value;
    if (sending) return;
    error.textContent = '';
    if (!body.trim()) { error.textContent = 'Write a message before sending.'; box.focus(); return; }
    sendBtn.disabled = true; sending = true;
    const r = await api('POST', `/api/applications/${encodeURIComponent(id)}/messages`, { body });
    sendBtn.disabled = false; sending = false;
    if (r.status === 401) return;
    if (!r.ok) { error.textContent = (r.status === 0 ? 'Not sent. ' : '') + ((r.data && r.data.error) || 'The message was not sent; it is still here.'); box.focus(); return; }
    if (openId === id) { box.value = ''; }
    keep.set('draft.' + id, '');
    await catchUp();
    toBottom();
    await refresh();
    box.focus();
  });

  function update(next) {
    boot = next;
    if (openId && !threads().some((a) => a.id === openId)) { openId = null; cache.clear(); items.clear(); log.replaceChildren(); }
    const c = cache.get(openId);
    const a = c && threads().find((x) => x.id === openId);
    /* Open at the newest message: what just arrived is read, so no badge or total ever counts it. */
    let held = 0;
    if (a && a.unread && atBottom() && node.classList.contains('active') && !document.hidden) { held = a.unread; a.unread = 0; }
    renderList();
    showPane();
    if (c) {
      paint(c);
      catchUp().then(() => { if (held && a.unread === 0) { a.unread = held; markRead(openId); } });
    } else if (openId && node.classList.contains('active')) open(openId, false);
  }
  function shown(target) {
    if (target) return open(target, true);
    if (cache.get(openId)) { log.scrollTop = wasBottom ? log.scrollHeight : savedTop; const c = cache.get(openId); if (c) paint(c); }
    if (openId && !cache.get(openId)) return open(openId, false);
    if (openId) { const a = threads().find((x) => x.id === openId); if (a && a.unread && atBottom()) markRead(openId); }
  }
  const badge = (b) => b.applications.reduce((n, a) => n + ((candidate || a.thread) ? (a.unread || 0) : 0), 0);
  return { label: candidate ? 'My applications' : 'Conversations', node, update, shown, badge };
};

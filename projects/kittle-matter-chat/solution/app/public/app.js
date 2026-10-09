"use strict";

// Kittle & Rowe matter chat, browser side. No outside libraries: every message
// is rendered from text with our own small formatter, which escapes everything first.

const $ = id => document.getElementById(id);
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
const state = {
  me: null, matters: [], current: null, thread: [], newLineSeq: null,
  replyTo: null, editing: null, clientKey: newKey(), focusMessage: null, threadSig: "", listSig: "", messageErrors: {},
  confirmDelete: null, suggestions: []
};

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, data };
}

/* ---------- formatting ---------- */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ESC[c]);

// Inline formatting on already-escaped text: `code`, *bold* and http(s) links only.
function inline(escaped) {
  return escaped.split(/(`[^`\n]+`)/g).map(part => {
    if (/^`[^`\n]+`$/.test(part)) return `<code>${part.slice(1, -1)}</code>`;
    return part
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,;:!?])/g, "$1<strong>$2</strong>")
      .replace(/\bhttps?:\/\/[^\s<>"']+/g, url => {
        const clean = url.replace(/[.,;:!?)]+$/, "");
        return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${url.slice(clean.length)}`;
      });
  }).join("");
}

function renderBody(text) {
  const out = [];
  let quote = [];
  const flush = () => { if (quote.length) { out.push({ q: true, html: quote.join("<br>") }); quote = []; } };
  for (const line of String(text).split("\n")) {
    if (line.startsWith("> ")) { quote.push(inline(escapeHtml(line.slice(2)))); continue; }
    flush();
    out.push({ q: false, html: inline(escapeHtml(line)) });
  }
  flush();
  let html = "";
  out.forEach((part, i) => {
    if (part.q) html += `<blockquote>${part.html}</blockquote>`;
    else html += (i && !out[i - 1].q ? "<br>" : "") + part.html;
  });
  return html;
}

const fmtTime = iso => iso.replace("T", " ").replace(/(\d\d:\d\d):\d\d(\.\d+)?Z$/, "$1 UTC");

/* ---------- sign-in ---------- */

async function boot() {
  const me = await api("/api/me");
  if (!me.ok) return showSignin();
  state.me = me.data;
  $("signin").hidden = true;
  $("app").hidden = false;
  $("who").textContent = `${me.data.name} · ${me.data.role_label}`;
  await refreshMatters();
  await route(location.pathname + location.search, false);
  startPolling();
}

function showSignin() {
  state.me = null;
  state.current = null;
  $("app").hidden = true;
  $("signin").hidden = false;
  $("matter-list").innerHTML = "";
  $("thread").innerHTML = "";
  $("mentions").innerHTML = "";
  $("results").innerHTML = "";
  state.listSig = ""; state.threadSig = "";
  $("email").focus();
}

$("signin-form").addEventListener("submit", async event => {
  event.preventDefault();
  const r = await api("/api/session", { method: "POST", body: JSON.stringify({ email: $("email").value, password: $("password").value }) });
  if (!r.ok) { showError("signin-error", r.data.error || "Sign-in failed."); return; }
  $("password").value = "";
  hideError("signin-error");
  if (!/^\/(matters|messages)\//.test(location.pathname)) history.replaceState(null, "", "/");
  boot();
});
for (const id of ["email", "password"]) $(id).addEventListener("input", () => hideError("signin-error"));

$("signout").addEventListener("click", async () => {
  await api("/api/session", { method: "DELETE" });
  stopPolling();
  history.replaceState(null, "", "/");
  showSignin();
});

function showError(id, text) { const el = $(id); el.textContent = text; el.hidden = false; }
function hideError(id) { const el = $(id); el.hidden = true; el.textContent = ""; }

/* ---------- navigation ---------- */

document.addEventListener("click", event => {
  const link = event.target.closest("[data-nav]");
  if (!link || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  route(link.getAttribute("data-nav"), true);
});
window.addEventListener("popstate", () => route(location.pathname + location.search, false));

function showView(name) {
  for (const v of ["empty-view", "matter-view", "mentions-view", "search-view"]) $(v).hidden = v !== name;
}

async function route(target, push) {
  if (push) history.pushState(null, "", target);
  const url = new URL(target, location.origin);
  const m = url.pathname.match(/^\/matters\/([^/]+)$/);
  const msg = url.pathname.match(/^\/messages\/([^/]+)$/);
  if (m) return openMatter(decodeURIComponent(m[1]));
  if (msg) return openMessageLink(decodeURIComponent(msg[1]));
  if (url.pathname === "/mentions") return openMentions();
  if (url.pathname === "/search") { $("search-input").value = url.searchParams.get("q") || ""; return runSearch(); }
  state.current = null;
  renderMatterList();
  showView("empty-view");
}

/* ---------- matter list ---------- */

async function refreshMatters() {
  const r = await api("/api/matters");
  if (r.status === 401) { stopPolling(); return showSignin(); }
  if (!r.ok) return;
  state.matters = r.data.matters;
  const count = r.data.mention_count;
  $("mention-count").hidden = !count;
  $("mention-count").textContent = count ? String(count) : "";
  renderMatterList();
}

function renderMatterList() {
  const sig = JSON.stringify([state.matters, state.current]);
  if (sig === state.listSig) return;
  state.listSig = sig;
  const list = $("matter-list");
  list.innerHTML = "";
  for (const m of state.matters) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `/matters/${encodeURIComponent(m.id)}`;
    a.setAttribute("data-nav", a.getAttribute("href"));
    a.className = "matter-link" + (state.current === m.id ? " current" : "");
    if (state.current === m.id) a.setAttribute("aria-current", "page");
    a.innerHTML = `<span class="matter-top"><span class="matter-id">${escapeHtml(m.id)}</span><span class="matter-name">${escapeHtml(m.title)}</span></span><span class="matter-client">${escapeHtml(m.client_name)} · ${escapeHtml(m.timer_days ? m.timer_days + "-day timer" : "no timer")}</span>`;
    if (m.unread) {
      const b = document.createElement("span");
      b.className = "badge unread";
      b.textContent = String(m.unread);
      b.setAttribute("aria-label", `${m.unread} unread`);
      a.appendChild(b);
    }
    li.appendChild(a);
    list.appendChild(li);
  }
}

/* ---------- matter view ---------- */

async function openMatter(id, focusMessage = null) {
  const switching = state.current !== id;
  state.current = id;
  state.focusMessage = focusMessage;
  if (switching) { resetComposer(); state.threadSig = ""; state.confirmDelete = null; }
  showView("matter-view");
  const r = await api(`/api/matters/${encodeURIComponent(id)}`);
  if (!r.ok) return showUnavailable(r.status);
  $("matter-unavailable").hidden = true;
  $("composer").hidden = false;
  // The new-messages line sits where I stopped reading when I opened the matter.
  const firstUnread = r.data.messages.find(x => x.seq > r.data.last_read && !x.mine && !x.deleted);
  state.newLineSeq = firstUnread ? firstUnread.seq : null;
  applyMatter(r.data, true);
  const read = await api(`/api/matters/${encodeURIComponent(id)}/read`, { method: "POST", body: JSON.stringify({}) });
  if (read.ok) {
    const s = state.matters.find(x => x.id === id);
    if (s) s.unread = read.data.matter.unread;
    renderMatterList();
  }
}

function showUnavailable(status) {
  if (status === 401) { stopPolling(); return showSignin(); }
  state.current = null;
  showView("matter-view");
  $("matter-title").textContent = "Not available";
  $("matter-timer").textContent = "";
  $("partner-tools").hidden = true;
  $("thread").innerHTML = "";
  $("composer").hidden = true;
  $("matter-unavailable").hidden = false;
  $("transcript-link").removeAttribute("href");
  state.threadSig = "";
  refreshMatters();
}

function applyMatter(data, scrollToFocus) {
  const m = data.matter;
  $("matter-title").textContent = `${m.id} · ${m.title}`;
  $("matter-timer").textContent = m.timer_label;
  $("transcript-link").href = `/transcripts/${encodeURIComponent(m.id)}`;
  const partner = state.me.role === "partner";
  $("partner-tools").hidden = !partner;
  if (partner) {
    if (document.activeElement !== $("timer-select")) $("timer-select").value = m.timer_days ? String(m.timer_days) : "off";
    renderWalls(data.walls || []);
  }
  renderMatterList();
  const sig = JSON.stringify([data.messages, state.newLineSeq]);
  if (sig !== state.threadSig) {
    state.threadSig = sig;
    const thread = $("thread");
    const keep = thread.scrollTop;
    const openVersions = [...thread.querySelectorAll(".versions[data-for]")].map(el => el.getAttribute("data-for"));
    state.thread = data.messages;
    renderThread();
    thread.scrollTop = keep;
    for (const id of openVersions) {
      const li = document.getElementById("msg-" + id);
      const msg = state.thread.find(x => x.id === id);
      if (li && msg && msg.edited) showVersions(msg, li, true);
    }
  }
  if (scrollToFocus) {
    const target = state.focusMessage ? document.getElementById("msg-" + state.focusMessage) : null;
    if (target) { target.classList.add("focused"); target.scrollIntoView({ block: "center" }); }
    else if (state.newLineSeq) document.querySelector(".new-line")?.scrollIntoView({ block: "center" });
    else $("thread").scrollTop = $("thread").scrollHeight;
  }
}

function renderWalls(walls) {
  const sig = JSON.stringify(walls);
  if ($("wall-list").dataset.sig === sig) return;
  $("wall-list").dataset.sig = sig;
  const list = $("wall-list");
  list.innerHTML = "";
  if (!walls.length) list.textContent = "None";
  for (const email of walls) {
    const person = state.me.staff.find(s => s.email === email);
    const chip = document.createElement("span");
    chip.className = "chip";
    const name = person ? person.name : email;
    chip.append(name + " ");
    const lift = document.createElement("button");
    lift.type = "button";
    lift.className = "quiet";
    lift.textContent = "Lift wall";
    lift.setAttribute("aria-label", `Lift wall for ${name}`);
    lift.addEventListener("click", () => setWall(email, false));
    chip.appendChild(lift);
    list.appendChild(chip);
  }
  const select = $("wall-select");
  select.innerHTML = "";
  for (const s of state.me.staff) {
    if (s.email === state.me.email || walls.includes(s.email)) continue;
    const o = document.createElement("option");
    o.value = s.email; o.textContent = s.name;
    select.appendChild(o);
  }
  $("wall-add").disabled = !select.options.length;
}

function renderThread() {
  const thread = $("thread");
  thread.innerHTML = "";
  for (const msg of state.thread) {
    if (state.newLineSeq && msg.seq === state.newLineSeq) {
      const line = document.createElement("li");
      line.className = "new-line";
      line.innerHTML = "<span>New messages</span>";
      thread.appendChild(line);
    }
    thread.appendChild(renderMessage(msg));
  }
}

function renderMessage(msg) {
  const li = document.createElement("li");
  li.className = "message" + (msg.depth ? " reply" : "") + (msg.deleted ? " deleted" : "") + (state.focusMessage === msg.id ? " focused" : "");
  li.id = "msg-" + msg.id;
  li.style.setProperty("--depth", Math.min(msg.depth, 6));
  if (msg.deleted) {
    li.innerHTML = `<p class="placeholder">Original message deleted</p>`;
    return li;
  }
  let quote = "";
  if (msg.quote) {
    quote = msg.quote.deleted
      ? `<p class="quote deleted-quote">Replying to a message that was deleted</p>`
      : `<p class="quote"><span class="quote-author">Replying to ${escapeHtml(msg.quote.author_name)}:</span> ${escapeHtml(msg.quote.text)}</p>`;
  }
  const badges = (msg.edited ? `<span class="edited">edited</span>` : "") + (msg.hold ? `<span class="hold-badge">On hold</span>` : "");
  li.innerHTML = `${quote}<div class="meta"><strong class="author">${escapeHtml(msg.author_name)}</strong> <time datetime="${escapeHtml(msg.at)}">${escapeHtml(fmtTime(msg.at))}</time> ${badges}</div><div class="body">${renderBody(msg.body)}</div>`;
  for (const [id, p] of Object.entries(msg.previews || {})) {
    const box = document.createElement("div");
    box.className = "preview" + (p.available ? "" : " unavailable");
    if (p.available) {
      const a = document.createElement("a");
      a.href = `/messages/${id}`;
      a.setAttribute("data-nav", `/messages/${id}`);
      const where = document.createElement("span"); where.className = "preview-where"; where.textContent = `${p.matter_id} · ${p.matter_title}`;
      const who = document.createElement("span"); who.className = "preview-who"; who.textContent = p.author_name;
      const text = document.createElement("span"); text.className = "preview-text"; text.textContent = p.text;
      a.append(where, who, text);
      box.appendChild(a);
    } else {
      box.textContent = "Linked message not available";
    }
    li.appendChild(box);
  }
  const actions = document.createElement("div");
  actions.className = "actions";
  const add = (label, handler, aria) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label; b.className = "quiet";
    if (aria) b.setAttribute("aria-label", aria);
    b.addEventListener("click", handler);
    actions.appendChild(b);
  };
  if (state.confirmDelete === msg.id) {
    const ask = document.createElement("span");
    ask.className = "confirm-text";
    ask.textContent = "Delete this message? This can't be undone.";
    actions.appendChild(ask);
    add("Yes, delete", () => deleteMessage(msg));
    add("Keep it", () => askDelete(msg, false));
    actions.classList.add("confirming");
  } else {
    add("Reply", () => startReply(msg), `Reply to ${msg.author_name}`);
    if (msg.mine) { add("Edit", () => startEdit(msg)); add("Delete", () => askDelete(msg, true)); }
    add("Copy link", () => copyLink(msg));
    add("Mark unread", () => markUnread(msg));
    if (msg.edited && state.me.role !== "client") add("Versions", () => showVersions(msg, li));
    if (state.me.role === "partner") add(msg.hold ? "Release hold" : "Place hold", () => setHold(msg, !msg.hold));
  }
  li.appendChild(actions);
  const err = document.createElement("p");
  err.className = "error action-error";
  const kept = state.messageErrors[msg.id];
  err.textContent = kept || "";
  err.hidden = !kept;
  li.appendChild(err);
  return li;
}

/* ---------- actions ---------- */

// A refusal on a message stays until that person does something else with the message.
function clearMessageError(msg) {
  delete state.messageErrors[msg.id];
  const el = document.querySelector(`#msg-${CSS.escape(msg.id)} .action-error`);
  if (el) { el.textContent = ""; el.hidden = true; }
}
function messageError(msg, text) {
  state.messageErrors[msg.id] = text;
  const el = document.querySelector(`#msg-${CSS.escape(msg.id)} .action-error`);
  if (el) { el.textContent = text; el.hidden = false; }
}

function startReply(msg) {
  clearMessageError(msg);
  state.editing = null;
  state.replyTo = { id: msg.id };
  $("composer-context-text").textContent = `Replying to ${msg.author_name}: ${msg.body.slice(0, 80)}`;
  $("composer-context").hidden = false;
  $("composer-send").textContent = "Send reply";
  hideError("composer-error");
  $("composer-input").focus();
}
function startEdit(msg) {
  clearMessageError(msg);
  state.replyTo = null;
  state.editing = { id: msg.id, version: msg.version };
  $("composer-context-text").textContent = "Editing your message";
  $("composer-context").hidden = false;
  $("composer-send").textContent = "Save edit";
  $("composer-input").value = msg.body;
  hideError("composer-error");
  $("composer-input").focus();
}
function resetComposer() {
  hideSuggestions();
  state.replyTo = null; state.editing = null; state.clientKey = newKey();
  $("composer-context").hidden = true;
  $("composer-send").textContent = "Send";
  $("composer-input").value = "";
  hideError("composer-error");
}
$("composer-cancel").addEventListener("click", resetComposer);
$("composer-input").addEventListener("input", () => { hideError("composer-error"); suggestMentions(); });
$("composer-input").addEventListener("click", suggestMentions);
// Enter sends, Shift+Enter is a new line, Escape closes an edit or reply without saving.
$("composer-input").addEventListener("keydown", event => {
  if (event.isComposing) return;
  const open = !$("mention-suggest").hidden;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (open && state.suggestions.length) return pickMention(state.suggestions[0]);
    $("composer").requestSubmit();
  } else if (event.key === "Escape") {
    if (open) { event.preventDefault(); return hideSuggestions(); }
    if (state.editing || state.replyTo) { event.preventDefault(); resetComposer(); }
  }
});

/* ---------- mention suggestions ---------- */

// The @word being typed just before the caret, if any.
function mentionToken() {
  const input = $("composer-input");
  const before = input.value.slice(0, input.selectionStart);
  const m = before.match(/(^|[^\w@])@([^\s@]*)$/);
  return m ? { start: before.length - m[2].length - 1, query: m[2].toLowerCase() } : null;
}
let suggestSeq = 0;
async function suggestMentions() {
  const token = mentionToken();
  if (!token || !state.current) return hideSuggestions();
  const seq = ++suggestSeq;
  const r = await api(`/api/matters/${encodeURIComponent(state.current)}/people`);
  if (seq !== suggestSeq) return;
  if (!r.ok) return hideSuggestions();
  state.suggestions = r.data.people.filter(p => p.name.toLowerCase().split(" ").some(w => w.startsWith(token.query)));
  const list = $("mention-suggest");
  list.innerHTML = "";
  for (const p of state.suggestions) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button"; b.className = "suggestion"; b.setAttribute("role", "option");
    b.textContent = p.name;
    b.addEventListener("mousedown", e => e.preventDefault());
    b.addEventListener("click", () => pickMention(p));
    li.appendChild(b);
    list.appendChild(li);
  }
  list.hidden = !state.suggestions.length;
}
function pickMention(p) {
  const input = $("composer-input");
  const token = mentionToken();
  if (!token) return hideSuggestions();
  const end = input.selectionStart;
  input.value = input.value.slice(0, token.start) + "@" + p.mention + " " + input.value.slice(end);
  const caret = token.start + p.mention.length + 2;
  input.setSelectionRange(caret, caret);
  input.focus();
  hideSuggestions();
}
function hideSuggestions() {
  suggestSeq++;
  state.suggestions = [];
  $("mention-suggest").hidden = true;
  $("mention-suggest").innerHTML = "";
}

$("composer").addEventListener("submit", async event => {
  event.preventDefault();
  if (!state.current) return;
  const text = $("composer-input").value;
  let r;
  if (state.editing) {
    r = await api(`/api/messages/${encodeURIComponent(state.editing.id)}`, { method: "PATCH", body: JSON.stringify({ body: text, version: state.editing.version }) });
  } else {
    r = await api(`/api/matters/${encodeURIComponent(state.current)}/messages`, { method: "POST", body: JSON.stringify({ body: text, parent_id: state.replyTo ? state.replyTo.id : null, client_key: state.clientKey }) });
  }
  if (!r.ok) {
    if (r.status === 404 && !state.editing && !state.replyTo) return showUnavailable(404);
    return showError("composer-error", r.data.error || "That didn't go through.");
  }
  const sentId = r.data.id;
  resetComposer();
  await reloadCurrent();
  document.getElementById("msg-" + sentId)?.scrollIntoView({ block: "nearest" });
  $("composer-input").focus();
});

function askDelete(msg, asking) {
  clearMessageError(msg);
  state.confirmDelete = asking ? msg.id : null;
  document.getElementById("msg-" + msg.id)?.replaceWith(renderMessage(msg));
}
async function deleteMessage(msg) {
  clearMessageError(msg);
  state.confirmDelete = null;
  const r = await api(`/api/messages/${encodeURIComponent(msg.id)}`, { method: "DELETE" });
  if (!r.ok) {
    document.getElementById("msg-" + msg.id)?.replaceWith(renderMessage(msg));
    return messageError(msg, r.data.error || "That message can't be deleted.");
  }
  reloadCurrent();
}
async function setHold(msg, hold) {
  clearMessageError(msg);
  const r = await api(`/api/messages/${encodeURIComponent(msg.id)}/hold`, { method: "POST", body: JSON.stringify({ hold }) });
  if (!r.ok) return messageError(msg, r.data.error || "That didn't go through.");
  reloadCurrent();
}
async function markUnread(msg) {
  clearMessageError(msg);
  const r = await api(`/api/matters/${encodeURIComponent(state.current)}/read`, { method: "POST", body: JSON.stringify({ unread_from: msg.id }) });
  if (!r.ok) return messageError(msg, r.data.error || "That didn't go through.");
  state.newLineSeq = msg.seq;
  state.threadSig = "";
  await refreshMatters();
  reloadCurrent();
}
function copyLink(msg) {
  clearMessageError(msg);
  const url = `${location.origin}/messages/${msg.id}`;
  $("link-value").value = url;
  $("link-box").hidden = false;
  $("link-value").focus();
  $("link-value").select();
  try { navigator.clipboard?.writeText(url).catch(() => {}); } catch { /* clipboard may be unavailable */ }
}
$("link-close").addEventListener("click", () => { $("link-box").hidden = true; });

async function showVersions(msg, li, keepOpen = false) {
  const existing = li.querySelector(".versions");
  if (existing && !keepOpen) { existing.remove(); return; }
  if (existing) existing.remove();
  const r = await api(`/api/messages/${encodeURIComponent(msg.id)}/versions`);
  if (!r.ok) return messageError(msg, r.data.error || "Versions are not available.");
  const box = document.createElement("ol");
  box.className = "versions";
  box.setAttribute("data-for", msg.id);
  for (const v of r.data.versions) {
    const item = document.createElement("li");
    const label = document.createElement("span"); label.className = "vlabel"; label.textContent = `Version ${v.n}${v.current ? ", current" : ""}`;
    const text = document.createElement("span"); text.className = "vtext"; text.textContent = v.body;
    item.append(label, " ", text);
    box.appendChild(item);
  }
  li.insertBefore(box, li.querySelector(".actions"));
}

$("timer-form").addEventListener("submit", async event => {
  event.preventDefault();
  const v = $("timer-select").value;
  const r = await api(`/api/matters/${encodeURIComponent(state.current)}/timer`, { method: "POST", body: JSON.stringify({ days: v === "off" ? null : Number(v) }) });
  if (!r.ok) return showError("timer-error", r.data.error || "That didn't go through.");
  hideError("timer-error");
  await refreshMatters();
  reloadCurrent();
});
$("timer-select").addEventListener("change", () => hideError("timer-error"));

async function setWall(email, walled) {
  const r = await api(`/api/matters/${encodeURIComponent(state.current)}/walls`, { method: "POST", body: JSON.stringify({ email, walled }) });
  if (!r.ok) return showError("wall-error", r.data.error || "That didn't go through.");
  hideError("wall-error");
  reloadCurrent();
}
$("wall-form").addEventListener("submit", event => { event.preventDefault(); if ($("wall-select").value) setWall($("wall-select").value, true); });

async function reloadCurrent() {
  if (!state.current) return;
  const r = await api(`/api/matters/${encodeURIComponent(state.current)}`);
  if (!r.ok) return showUnavailable(r.status);
  applyMatter(r.data, false);
}

/* ---------- message links, mentions, search ---------- */

async function openMessageLink(id) {
  const r = await api(`/api/messages/${encodeURIComponent(id)}`);
  if (!r.ok) {
    if (r.status === 401) return showSignin();
    return showUnavailable(404);
  }
  history.replaceState(null, "", `/matters/${encodeURIComponent(r.data.matter_id)}`);
  return openMatter(r.data.matter_id, id);
}

async function openMentions() {
  state.current = null;
  renderMatterList();
  showView("mentions-view");
  const r = await api("/api/mentions");
  const list = $("mentions");
  list.innerHTML = "";
  if (!r.ok) return;
  if (!r.data.mentions.length) list.innerHTML = `<li class="none">Nobody has mentioned you yet.</li>`;
  for (const m of r.data.mentions) list.appendChild(resultItem(m, `${m.matter_id} · ${m.author_name}`));
}

$("search-form").addEventListener("submit", event => {
  event.preventDefault();
  route(`/search?q=${encodeURIComponent($("search-input").value)}`, true);
});

async function runSearch() {
  state.current = null;
  renderMatterList();
  showView("search-view");
  const q = $("search-input").value.trim();
  $("search-title").textContent = q ? `Search: ${q}` : "Search";
  const list = $("results");
  list.innerHTML = "";
  if (!q) return;
  const r = await api(`/api/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) return;
  if (!r.data.results.length) list.innerHTML = `<li class="none">No messages match.</li>`;
  for (const m of r.data.results) list.appendChild(resultItem(m, `${m.matter_id} · ${m.matter_title} · ${m.author_name}`));
}

function resultItem(m, label) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = `/messages/${encodeURIComponent(m.id)}`;
  a.setAttribute("data-nav", a.getAttribute("href"));
  const where = document.createElement("span"); where.className = "result-where"; where.textContent = label;
  const text = document.createElement("span"); text.className = "result-text"; text.textContent = m.text;
  a.append(where, text);
  li.appendChild(a);
  return li;
}

/* ---------- live updates ---------- */

let timer = null;
function startPolling() {
  stopPolling();
  timer = setInterval(async () => {
    if (!state.me) return;
    await refreshMatters();
    if (state.current && !$("matter-view").hidden) {
      const r = await api(`/api/matters/${encodeURIComponent(state.current)}`);
      if (!r.ok) return showUnavailable(r.status);
      applyMatter(r.data, false);
    }
  }, 2000);
}
function stopPolling() { if (timer) clearInterval(timer); timer = null; }

boot();

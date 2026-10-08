"use strict";

const state = { user: null, matters: [], matterId: null, matter: null, results: null };

const $ = (id) => document.getElementById(id);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: res.status });
  return data;
}

function showFormError(id, err) {
  const el = $(id);
  el.hidden = false;
  el.textContent = err.message;
}

function renderWho() {
  const who = $("who");
  who.replaceChildren();
  if (!state.user) return;
  const name = document.createElement("span");
  name.className = "who-name";
  name.textContent = state.user.name;
  const role = document.createElement("span");
  role.className = "who-role";
  role.textContent = state.user.roleLabel;
  const button = document.createElement("button");
  button.type = "button";
  button.id = "sign-out";
  button.textContent = "Sign out";
  who.append(name, role, button);
}

function renderResults() {
  const host = $("results");
  if (!state.results) {
    host.innerHTML = "";
    return;
  }
  if (!state.results.length) {
    host.innerHTML = "<p>No matching messages.</p>";
    return;
  }
  host.innerHTML = state.results.map((row) => `
    <article class="result">
      <p><strong>${esc(row.matterId)}</strong> ${esc(row.title)}</p>
      <p>${esc(row.authorName)} · ${esc(row.at)}${row.hold ? ' <span class="hold-badge">On hold</span>' : ""}</p>
      <p>${esc(row.body)}</p>
    </article>`).join("");
}

function renderMatters() {
  const host = $("matter-pane");
  host.innerHTML = `<div class="matter-list">${state.matters.map((matter) => `
    <button type="button" class="matter${matter.id === state.matterId ? " is-selected" : ""}" data-matter="${esc(matter.id)}" ${matter.id === state.matterId ? 'aria-current="true"' : ""}>
      <span class="matter-id">${esc(matter.id)}</span>
      <span class="matter-title">${esc(matter.title)}</span>
      <span class="matter-client">${esc(matter.clientName)}</span>
      <span class="timer-label">${esc(matter.timerLabel)}</span>
      ${matter.id === state.matterId ? '<span class="selected-flag">Selected</span>' : ""}
    </button>`).join("")}</div>`;
}

function renderThread() {
  const host = $("thread");
  const matter = state.matter;
  if (!matter) {
    host.innerHTML = "";
    return;
  }
  const partner = state.user && state.user.role === "partner";
  const messages = matter.messages.map((message) => `
    <article class="message">
      <header>
        <span class="author">${esc(message.authorName)}</span>
        <time class="time">${esc(message.at)}</time>
        ${message.hold ? '<span class="hold-badge">On hold</span>' : ""}
      </header>
      <p class="body">${esc(message.body)}</p>
      ${partner ? `<button type="button" class="hold-btn secondary" data-hold-id="${esc(message.id)}" data-hold="${message.hold ? "false" : "true"}">${message.hold ? "Release hold" : "Place hold"}</button>` : ""}
    </article>`).join("");
  const days = matter.timerDays == null ? "" : String(matter.timerDays);
  host.innerHTML = `
    <div class="thread-heading">
      <h2>${esc(matter.id)} ${esc(matter.title)}</h2>
      <p class="timer-notice">${esc(matter.timerNotice)}</p>
    </div>
    <p><a class="transcript-link" href="/matters/${esc(matter.id)}/transcript">Open transcript</a></p>
    ${partner ? `<fieldset class="partner"><legend>Partner controls</legend>
      <form id="timer-form">
        <label>Timer
          <select name="days">
            <option value=""${days === "" ? " selected" : ""}>Off</option>
            <option value="1"${days === "1" ? " selected" : ""}>1 day</option>
            <option value="7"${days === "7" ? " selected" : ""}>7 days</option>
            <option value="30"${days === "30" ? " selected" : ""}>30 days</option>
          </select>
        </label>
        <button type="submit">Set timer</button>
        <p id="timer-error" class="refusal" hidden></p>
      </form>
    </fieldset>` : ""}
    <div class="messages">${messages}</div>
    <form id="post-form" class="composer">
      <label>Message <textarea name="body"></textarea></label>
      <button type="submit">Send</button>
      <p id="post-error" class="refusal" hidden></p>
    </form>`;
  scrollThreadToLatest();
}

function scrollThreadToLatest() {
  requestAnimationFrame(() => {
    const box = document.querySelector(".messages");
    if (box) box.scrollTop = box.scrollHeight;
  });
}

async function reloadDesk() {
  state.matters = await api("/api/matters");
  if (!state.matterId || !state.matters.some((matter) => matter.id === state.matterId)) {
    state.matterId = state.matters[0] ? state.matters[0].id : null;
  }
  state.matter = state.matterId ? await api(`/api/matters/${encodeURIComponent(state.matterId)}`) : null;
  renderMatters();
  renderThread();
}

function clearPrivate() {
  state.matters = [];
  state.matter = null;
  state.matterId = null;
  state.results = null;
  $("matter-pane").innerHTML = "";
  $("thread").innerHTML = "";
  $("results").innerHTML = "";
  $("thread-error").hidden = true;
  $("thread-error").textContent = "";
  $("search-form").reset();
  $("search-error").hidden = true;
  $("search-error").textContent = "";
}

async function refresh(attempt) {
  let me;
  try {
    me = await api("/api/me");
  } catch (err) {
    if (err.status === 503 && attempt < 20) {
      setTimeout(() => refresh(attempt + 1), 200);
      return;
    }
    return;
  }
  state.user = me.user;
  $("signin").hidden = Boolean(state.user);
  $("desk").hidden = !state.user;
  renderWho();
  if (!state.user) {
    $("signin").reset();
    $("signin-error").hidden = true;
    $("signin-error").textContent = "";
    clearPrivate();
    return;
  }
  await reloadDesk();
  renderResults();
}

$("signin").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("signin-error").hidden = true;
  const body = Object.fromEntries(new FormData(event.target));
  try {
    await api("/api/login", { method: "POST", body: JSON.stringify(body) });
    await refresh(0);
  } catch (err) {
    showFormError("signin-error", err);
  }
});

document.body.addEventListener("click", async (event) => {
  if (event.target.id === "sign-out") {
    await api("/api/logout", { method: "POST", body: "{}" });
    await refresh(0);
    return;
  }
  const matterButton = event.target.closest("[data-matter]");
  if (matterButton) {
    state.matterId = matterButton.dataset.matter;
    state.matter = await api(`/api/matters/${encodeURIComponent(state.matterId)}`);
    $("thread-error").hidden = true;
    renderMatters();
    renderThread();
    return;
  }
  const holdButton = event.target.closest("[data-hold-id]");
  if (!holdButton) return;
  try {
    await api(`/api/messages/${encodeURIComponent(holdButton.dataset.holdId)}/hold`, {
      method: "POST",
      body: JSON.stringify({ hold: holdButton.dataset.hold === "true" })
    });
    $("thread-error").hidden = true;
    await reloadDesk();
  } catch (err) {
    $("thread-error").hidden = false;
    $("thread-error").textContent = err.message;
  }
});

document.body.addEventListener("submit", async (event) => {
  const form = event.target;
  if (form.id === "search-form") {
    event.preventDefault();
    $("search-error").hidden = true;
    const q = String(new FormData(form).get("q") || "");
    try {
      state.results = await api(`/api/search?q=${encodeURIComponent(q)}`);
      renderResults();
    } catch (err) {
      showFormError("search-error", err);
    }
    return;
  }
  if (form.id === "timer-form") {
    event.preventDefault();
    const raw = String(new FormData(form).get("days") ?? "");
    const days = raw === "" ? null : Number(raw);
    try {
      state.matter = await api(`/api/matters/${encodeURIComponent(state.matterId)}/timer`, {
        method: "POST",
        body: JSON.stringify({ days })
      });
      $("timer-error") && ($("timer-error").hidden = true);
      await reloadDesk();
    } catch (err) {
      const el = $("timer-error");
      if (el) showFormError("timer-error", err);
      else {
        $("thread-error").hidden = false;
        $("thread-error").textContent = err.message;
      }
    }
    return;
  }
  if (form.id === "post-form") {
    event.preventDefault();
    const body = String(new FormData(form).get("body") || "");
    try {
      state.matter = await api(`/api/matters/${encodeURIComponent(state.matterId)}/messages`, {
        method: "POST",
        body: JSON.stringify({ body })
      });
      await reloadDesk();
    } catch (err) {
      showFormError("post-error", err);
    }
  }
});

document.body.addEventListener("input", (event) => {
  const form = event.target.closest("form");
  if (form) {
    const err = form.querySelector(".refusal");
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }
  }
  if (event.target.closest(".thread-pane")) {
    $("thread-error").hidden = true;
    $("thread-error").textContent = "";
  }
});

refresh(0);

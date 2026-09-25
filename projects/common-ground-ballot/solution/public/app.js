const state = {
  user: null,
  ballots: [],
  members: [],
  audit: [],
  activeView: "ballots",
  selectedBallot: null,
  editingBallot: null,
};

const byId = (id) => document.getElementById(id);
const loginView = byId("login-view");
const appView = byId("app-view");
const ballotDialog = byId("ballot-dialog");
const voteDialog = byId("vote-dialog");
const roundDialog = byId("round-dialog");
let roundReview = null;
let roundGeneration = 0;
let authenticationPending = false;
let ballotSubmission = null;
let draftReview = null;
const pendingPrefix = "common-ground-pending:v1:";
const identityKey = "common-ground-browser-identity:v1";
const pendingInFlight = new Set();

function setAuthenticationPending(pending) {
  authenticationPending = pending;
  byId("login-form").querySelector("button[type=submit]").disabled = pending;
  byId("logout-button").disabled = pending;
  byId("logout-all-button").disabled = pending;
}

const dialogFocusSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function showModal(dialog, initialFocus) {
  dialog.returnFocus = document.activeElement;
  dialog.showModal();
  initialFocus?.focus();
}

[ballotDialog, voteDialog, roundDialog].forEach((dialog) => {
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll(dialogFocusSelector)]
      .filter((element) => !element.hidden && element.getClientRects().length > 0);
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener("close", () => {
    if (dialog.returnFocus?.isConnected) dialog.returnFocus.focus();
  });
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const roleLabel = (role) => ({ coordinator: "Coordinator", observer: "Observer", member: "Member" })[role] || role;
const operationId = () => crypto.randomUUID();

function formatDate(value) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "The request could not be completed.");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function pendingKey(actorId, id) {
  return `${pendingPrefix}${encodeURIComponent(actorId)}:${id}`;
}

function currentCoordinator(actorId) {
  if (state.user?.role !== "coordinator" || state.user.id !== actorId) return false;
  try {
    const identity = JSON.parse(localStorage.getItem(identityKey) || "null");
    return !identity || identity.actorId === actorId;
  } catch {
    return false;
  }
}

function currentStaffSession(user) {
  return state.user === user && currentCoordinator(user?.id);
}

function announceIdentity(actorId) {
  try { localStorage.setItem(identityKey, JSON.stringify({ actorId, change: operationId() })); } catch {}
}

function readPending(actorId, id) {
  const raw = localStorage.getItem(pendingKey(actorId, id));
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw);
    if (entry.actorId !== actorId || entry.id !== id || typeof entry.body !== "string" || typeof entry.title !== "string" || typeof entry.action !== "string" || typeof entry.createdAt !== "string" || !Number.isFinite(Date.parse(entry.createdAt))) return null;
    if (!["POST", "PATCH"].includes(entry.method) || !/^\/api\/(?:ballots(?:\/[^/?#]+(?:\/(?:open|close|publish))?)?|members\/[^/?#]+|rounds\/open)$/.test(entry.url)) return null;
    return entry;
  } catch {
    return null;
  }
}

function pendingFor(actorId) {
  const prefix = `${pendingPrefix}${encodeURIComponent(actorId)}:`;
  const entries = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const entry = readPending(actorId, key.slice(prefix.length));
    if (entry) entries.push(entry);
  }
  return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

function renderPending() {
  const tray = byId("pending-actions");
  const list = byId("pending-actions-list");
  const focused = document.activeElement;
  const focusedAction = list.contains(focused) ? { retry: focused.dataset.pendingRetry, dismiss: focused.dataset.pendingDismiss } : null;
  const actorId = state.user?.id;
  if (!currentCoordinator(actorId)) {
    tray.classList.add("hidden");
    list.replaceChildren();
    byId("pending-actions-count").textContent = "";
    return;
  }
  let entries;
  try { entries = pendingFor(actorId); } catch { entries = []; }
  tray.classList.toggle("hidden", entries.length === 0);
  byId("pending-actions-count").textContent = `${entries.length} pending`;
  list.innerHTML = entries.map((entry) => {
    const sending = pendingInFlight.has(pendingKey(actorId, entry.id));
    return `<li class="pending-item" data-pending-id="${escapeHtml(entry.id)}"><div class="pending-copy"><h3>${escapeHtml(entry.action)} — ${escapeHtml(entry.title)}</h3><p>${sending ? "Waiting for an outcome…" : "Outcome not confirmed. Retry when you are ready."}</p><p>Started ${escapeHtml(formatDate(entry.createdAt))}</p></div><div class="pending-controls"><button class="button primary" type="button" data-pending-retry="${escapeHtml(entry.id)}" ${sending ? "disabled" : ""}>Retry</button><button class="button secondary" type="button" data-pending-dismiss="${escapeHtml(entry.id)}" ${sending ? "disabled" : ""}>Dismiss</button></div></li>`;
  }).join("");
  if (focusedAction) {
    const replacement = [...list.querySelectorAll("button:not([disabled])")].find((button) => (focusedAction.retry && button.dataset.pendingRetry === focusedAction.retry) || (focusedAction.dismiss && button.dataset.pendingDismiss === focusedAction.dismiss));
    (replacement || (entries.length ? byId("pending-actions-title") : byId("main-content"))).focus({ preventScroll: true });
  }
}

function uncertainAction() {
  const error = new Error("The outcome could not be confirmed. This action is saved in Pending actions. Retry there to recover its original outcome; submitting the form again starts a new action.");
  error.uncertain = true;
  return error;
}

async function verifyStaffActor(actorId, user) {
  if (!currentStaffSession(user) || user.id !== actorId) throw new Error("Sign in as the person who started this action to continue.");
  let data;
  try { data = await api("/api/me"); } catch (error) {
    if (error.status === 401 || error.status === 403) { if (currentStaffSession(user)) showLogin(); throw error; }
    throw uncertainAction();
  }
  if (!currentStaffSession(user)) throw new Error("Your sign-in changed. Recover this action from the original account when you are ready.");
  if (data.user?.id !== actorId || data.user?.role !== "coordinator") {
    showLogin();
    throw new Error("Your sign-in changed. Sign in again before continuing this action.");
  }
}

async function withPendingLock(entry, work) {
  const key = pendingKey(entry.actorId, entry.id);
  if (pendingInFlight.has(key)) return { busy: true };
  pendingInFlight.add(key);
  renderPending();
  try {
    if (navigator.locks?.request) {
      return await navigator.locks.request(key, { ifAvailable: true }, (lock) => lock ? work() : { busy: true });
    }
    return await work();
  } finally {
    pendingInFlight.delete(key);
    renderPending();
  }
}

async function sendPending(entry) {
  const user = state.user;
  return withPendingLock(entry, async () => {
    await verifyStaffActor(entry.actorId, user);
    // Re-read after the asynchronous identity check. Another tab may have resolved it.
    const saved = readPending(entry.actorId, entry.id);
    if (!saved || !currentStaffSession(user)) return { gone: true };
    let response;
    try {
      response = await fetch(saved.url, { method: saved.method, headers: { "Content-Type": "application/json" }, body: saved.body });
    } catch {
      throw uncertainAction();
    }
    if (response.status === 401 || response.status === 403) {
      if (currentStaffSession(user)) showLogin();
      const error = new Error("Your session or access changed. Sign in again as the original person to recover the saved action.");
      error.status = response.status;
      throw error;
    }
    let data;
    try { data = await response.json(); } catch { throw uncertainAction(); }
    const objectBody = data && typeof data === "object" && !Array.isArray(data);
    const roundIds = saved.url === "/api/rounds/open" ? JSON.parse(saved.body).ballots.map(b => b.id).sort() : null;
    const accepted = response.ok && objectBody && (roundIds
      ? Array.isArray(data.ballots) && data.ballots.every(b => b && typeof b.id === "string") && JSON.stringify(data.ballots.map(b => b.id).sort()) === JSON.stringify(roundIds)
      : typeof (saved.url.startsWith("/api/members/") ? data.member?.id : data.ballot?.id) === "string");
    const refused = response.status >= 400 && response.status < 500 && objectBody && typeof data.error === "string" && data.error.length > 0;
    if (!accepted && !refused) throw uncertainAction();
    // Resolve this entry before any separate refresh; do not apply an old receipt to current records.
    localStorage.removeItem(pendingKey(saved.actorId, saved.id));
    if (refused) {
      const error = new Error(data.error);
      error.status = response.status;
      error.data = data;
      error.definitive = true;
      throw error;
    }
    return { data };
  });
}

async function staffMutation(url, method, payload, action, title) {
  const actorId = state.user?.id;
  if (!currentCoordinator(actorId)) throw new Error("Sign in as the Coordinator before making changes.");
  const entry = { actorId, id: payload.operation_id, url, method, body: JSON.stringify(payload), action, title, createdAt: new Date().toISOString() };
  try {
    localStorage.setItem(pendingKey(actorId, entry.id), JSON.stringify(entry));
  } catch {
    throw new Error("This browser could not save recovery information. No action was sent. Enable browser storage and try again.");
  }
  renderPending();
  return sendPending(entry);
}

async function refreshRecovered(entry, refusal = null, user = state.user) {
  if (!currentStaffSession(user)) return;
  const outcome = refusal
    ? `${refusal.message} The original action was refused. Review the current record before starting a new action.`
    : `Original action confirmed: ${entry.action} — ${entry.title}.`;
  try {
    await refresh();
    if (!currentStaffSession(user)) return;
    if (state.activeView !== "members" && state.members.length) await loadMembers();
    if (currentStaffSession(user)) notify(`${outcome} Current records have been refreshed.`, refusal ? "error" : "success");
  } catch (error) {
    if (!currentStaffSession(user)) return;
    if (error.status === 401) showLogin();
    else notify(`${outcome} Current records could not be refreshed: ${error.message}`, "error");
  }
}

byId("pending-actions-list").addEventListener("click", async (event) => {
  const retry = event.target.closest("[data-pending-retry]");
  const dismiss = event.target.closest("[data-pending-dismiss]");
  if (!retry && !dismiss) return;
  const actorId = state.user?.id;
  const user = state.user;
  if (!currentCoordinator(actorId)) { renderPending(); return; }
  const id = retry?.dataset.pendingRetry || dismiss.dataset.pendingDismiss;
  let entry;
  try {
    entry = readPending(actorId, id);
    if (!entry) { renderPending(); notify("This reminder was already resolved or dismissed in another tab."); return; }
    if (dismiss) {
      const result = await withPendingLock(entry, () => {
        if (!currentStaffSession(user) || !readPending(actorId, id)) return { gone: true };
        localStorage.removeItem(pendingKey(actorId, id));
        return {};
      });
      if (!currentStaffSession(user)) return;
      if (result.busy) notify("This action is being checked in another tab. Wait for its outcome before dismissing it.", "error");
      else notify(`Reminder dismissed: ${entry.action} — ${entry.title}. No request was sent; accepted work has not been cancelled or undone.`);
    } else {
      const result = await sendPending(entry);
      if (!currentStaffSession(user)) return;
      if (result.busy) notify("This action is already being checked in another tab.");
      else if (result.gone) notify("This reminder was already resolved or dismissed in another tab.");
      else await refreshRecovered(entry, null, user);
    }
  } catch (error) {
    if (currentStaffSession(user)) {
      if (error.definitive && entry) await refreshRecovered(entry, error, user);
      else notify(error.message, "error");
    }
  } finally {
    renderPending();
    if (currentStaffSession(user)) {
      const next = byId("pending-actions-list").querySelector("button:not([disabled])");
      (next || byId("main-content")).focus({ preventScroll: true });
    }
  }
});

window.addEventListener("storage", (event) => {
  if (event.key === identityKey && state.user) {
    let actorId;
    try { actorId = JSON.parse(localStorage.getItem(identityKey) || "null")?.actorId; } catch {}
    if (actorId !== state.user.id) { showLogin(false); return; }
  }
  if (!event.key || event.key === identityKey || event.key.startsWith(pendingPrefix)) renderPending();
});
window.addEventListener("focus", renderPending);

function notify(message, type = "success") {
  byId("feedback-text").textContent = message;
  byId("feedback-icon").textContent = type === "error" ? "!" : "✓";
  byId("feedback").className = `feedback ${type === "error" ? "error" : "success"}`;
  byId("feedback").scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function clearNotice() {
  byId("feedback").className = "feedback hidden";
  byId("feedback-text").textContent = "";
}

function emptyState(symbol, title, message, action = "") {
  return `<div class="empty-state"><div class="empty-icon" aria-hidden="true">${symbol}</div><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(message)}</p>${action}</div>`;
}

function statusTag(status) {
  return `<span class="status ${escapeHtml(status)}"><span aria-hidden="true"></span>${escapeHtml(status)}</span>`;
}

function methodLabel(ballot) {
  return ballot.method === "single" ? "Single choice" : `Approval · up to ${ballot.max_selections}`;
}

function showLogin(broadcast = true) {
  state.user = null;
  state.ballots = [];
  state.members = [];
  state.audit = [];
  state.editingBallot = null;
  state.selectedBallot = null;
  ballotSubmission = null;
  resetDraftReview();
  roundGeneration++;
  roundReview = null;
  if (roundDialog.open) roundDialog.close();
  byId("ballot-form").querySelector("button[type=submit]").disabled = false;
  if (ballotDialog.open) ballotDialog.close();
  if (voteDialog.open) voteDialog.close();
  renderPending();
  clearNotice();
  if (broadcast) announceIdentity(null);
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
  document.querySelector(".demo-access").open = false;
  byId("login-password").value = "";
  byId("login-email").focus();
}

function showApp() {
  announceIdentity(state.user.id);
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  byId("user-name").textContent = state.user.name;
  byId("user-role").textContent = roleLabel(state.user.role);
  byId("user-initials").textContent = state.user.name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  byId("new-ballot-button").classList.toggle("hidden", state.user.role !== "coordinator");
  byId("open-round-button").classList.toggle("hidden", state.user.role !== "coordinator");
  renderPending();
}

async function loadBallots() {
  const user = state.user;
  const data = await api("/api/ballots");
  if (!user || state.user !== user) return;
  state.ballots = data.ballots;
  renderBallots();
  renderVote();
  renderTurnout();
  renderResults();
}

async function loadMembers() {
  const user = state.user;
  if (!user) return;
  if (user.role === "member") {
    state.members = [];
  } else {
    const data = await api("/api/members");
    if (state.user !== user) return;
    state.members = data.members;
  }
  renderMembers();
}

async function loadAudit() {
  const user = state.user;
  if (!user) return;
  if (user.role === "member") {
    state.audit = [];
  } else {
    const data = await api("/api/audit");
    if (state.user !== user) return;
    state.audit = data.events;
  }
  renderAudit();
}

async function refresh(message) {
  const user = state.user;
  await loadBallots();
  if (!user || state.user !== user) return;
  if (["members", "audit"].includes(state.activeView)) {
    if (state.activeView === "members") await loadMembers();
    if (state.activeView === "audit") await loadAudit();
  }
  if (state.user !== user) return;
  if (message) notify(message);
  renderPending();
}

async function setView(view) {
  renderPending();
  state.activeView = view;
  document.querySelectorAll(".nav-item").forEach((item) => {
    const active = item.dataset.view === view;
    item.classList.toggle("active", active);
    item.setAttribute("aria-current", active ? "page" : "false");
  });
  document.querySelectorAll(".view").forEach((section) => section.classList.toggle("active-view", section.id === `view-${view}`));
  if (view === "members") await loadMembers();
  if (view === "audit") await loadAudit();
  byId("main-content").focus({ preventScroll: true });
}

function coordinatorActions(ballot) {
  if (state.user.role !== "coordinator") return "";
  if (ballot.status === "draft") {
    return `<button class="button secondary compact" type="button" data-ballot-edit="${escapeHtml(ballot.id)}">Edit draft</button><button class="button primary compact" type="button" data-ballot-action="open" data-id="${escapeHtml(ballot.id)}">Open ballot</button><p class="action-guidance">Closing and publishing are unavailable while this ballot is a draft. Open it to begin voting.</p>`;
  }
  if (ballot.status === "open") return `<button class="button secondary compact" type="button" data-ballot-action="close" data-id="${escapeHtml(ballot.id)}">Close voting</button><p class="action-guidance">The ballot definition is locked. Close voting before publishing results.</p>`;
  if (ballot.status === "closed") return `<button class="button primary compact" type="button" data-ballot-action="publish" data-id="${escapeHtml(ballot.id)}">Publish results</button><p class="action-guidance">Voting is closed and cannot reopen. The ballot definition is locked; publish to share results.</p>`;
  return '<span class="locked-note">Published · no further edits or lifecycle actions</span>';
}

function renderBallots() {
  if (!state.user) return;
  byId("ballots-subtitle").textContent = {
    coordinator: "Prepare decisions and guide them from draft to publication.",
    observer: "Review ballot setup and lifecycle without changing records.",
    member: "Review the ballots captured in your eligibility snapshots.",
  }[state.user.role];
  const statuses = ["draft", "open", "closed", "published"];
  byId("ballot-stats").innerHTML = statuses.map((status) => `<article class="stat"><span>${status}</span><strong>${state.ballots.filter((ballot) => ballot.status === status).length}</strong></article>`).join("");
  const list = byId("ballots-list");
  if (!state.ballots.length) {
    list.innerHTML = emptyState("◇", "No ballots here", state.user.role === "coordinator" ? "Create the group's first draft ballot." : "Eligible ballots will appear here.", state.user.role === "coordinator" ? '<button class="button primary" type="button" data-open-new-ballot>New ballot</button>' : "");
    return;
  }
  list.innerHTML = state.ballots.map((ballot) => {
    const participation = ballot.turnout
      ? `${ballot.turnout.participated} of ${ballot.turnout.eligible} participated`
      : ballot.participated ? "Your participation is recorded" : ballot.eligible ? "You are eligible" : "Not eligible";
    return `<article class="ballot-card" data-ballot-card="${escapeHtml(ballot.id)}">
      <div class="card-top"><div><p class="method-label">${escapeHtml(methodLabel(ballot))}</p><h2>${escapeHtml(ballot.title)}</h2><p class="muted">${escapeHtml(ballot.description || "No additional context.")}</p></div>${statusTag(ballot.status)}</div>
      <ol class="choice-preview">${ballot.choices.map((choice) => `<li>${escapeHtml(choice.label)}</li>`).join("")}</ol>
      <div class="card-meta"><span>Revision ${ballot.revision}</span><span>${escapeHtml(participation)}</span></div>
      <div class="card-actions">${coordinatorActions(ballot)}</div>
    </article>`;
  }).join("");
}

function renderVote() {
  if (!state.user) return;
  const list = byId("vote-list");
  if (state.user.role !== "member") {
    list.innerHTML = emptyState("✓", "Member voting", "Sign in as an eligible Member to cast a ballot. Staff can monitor participation without voting.");
    return;
  }
  const ballots = state.ballots.filter((ballot) => ballot.status === "open" || ballot.participated);
  if (!ballots.length) {
    list.innerHTML = emptyState("○", "Nothing waiting", "There are no open ballots in your eligibility snapshots.");
    return;
  }
  list.innerHTML = ballots.map((ballot) => `<article class="panel vote-panel"><div class="panel-heading"><div><p class="method-label">${escapeHtml(methodLabel(ballot))}</p><h2>${escapeHtml(ballot.title)}</h2><p class="muted">${escapeHtml(ballot.description)}</p></div>${statusTag(ballot.status)}</div>${ballot.participated ? '<p class="participated"><span aria-hidden="true">✓</span><span><strong>Participation recorded</strong><small>Your selection remains private.</small></span></p>' : `<button class="button primary" type="button" data-vote-id="${escapeHtml(ballot.id)}">Cast your ballot</button>`}</article>`).join("");
}

function renderTurnout() {
  if (!state.user) return;
  const list = byId("turnout-list");
  if (state.user.role === "member") {
    list.innerHTML = emptyState("◔", "Your participation", "Your own status appears under Vote. Identified staff turnout is kept apart from anonymous selections.");
    return;
  }
  const ballots = state.ballots.filter((ballot) => ballot.status !== "draft");
  if (!ballots.length) {
    list.innerHTML = emptyState("◔", "No turnout yet", "Turnout starts when the first ballot opens.");
    return;
  }
  list.innerHTML = ballots.map((ballot) => `<article class="panel"><div class="panel-heading"><div><p class="method-label">${escapeHtml(ballot.status)} ballot</p><h2>${escapeHtml(ballot.title)}</h2><p class="muted">${ballot.turnout.participated} of ${ballot.turnout.eligible} eligible Members participated</p></div><strong class="metric">${ballot.turnout.percentage}%</strong></div><div class="progress-track" role="img" aria-label="${ballot.turnout.percentage}% turnout"><span style="width:${ballot.turnout.percentage}%"></span></div><ul class="turnout-members">${ballot.turnout.members.map((member) => `<li><span class="member-avatar" aria-hidden="true">${escapeHtml(member.name.split(/\s+/).map((part) => part[0]).join(""))}</span><span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.email)}</small></span><span class="participation-state ${member.participated ? "done" : "pending"}">${member.participated ? "Participated" : "Pending"}</span></li>`).join("")}</ul></article>`).join("");
}

function renderResults() {
  if (!state.user) return;
  const list = byId("results-list");
  const ballots = state.ballots.filter((ballot) => ballot.status === "published");
  if (!ballots.length) {
    list.innerHTML = emptyState("▥", "No published results", "Closed ballots remain private until a Coordinator publishes them.");
    return;
  }
  list.innerHTML = ballots.map((ballot) => `<article class="panel result-panel"><div class="panel-heading"><div><p class="method-label">Published ${escapeHtml(formatDate(ballot.published_at))}</p><h2>${escapeHtml(ballot.title)}</h2><p class="outcome">${escapeHtml(ballot.outcome)}</p></div><div class="ballot-total"><strong>${ballot.total_ballots}</strong><span>ballots</span></div></div><div class="result-table">${ballot.results.map((result) => `<div class="result-row"><div><span>${escapeHtml(result.label)}</span><strong>${result.votes} ${result.votes === 1 ? "vote" : "votes"}</strong></div><div class="progress-track" role="img" aria-label="${escapeHtml(result.label)} ${result.percentage}%"><span style="width:${Math.min(result.percentage, 100)}%"></span></div><span>${result.percentage}%</span></div>`).join("")}</div>${ballot.method === "approval" ? '<p class="footnote">Percentages use participating ballots and may total more than 100%.</p>' : ""}</article>`).join("");
}

function renderMembers() {
  if (!state.user) return;
  const list = byId("members-list");
  if (state.user.role === "member") {
    list.innerHTML = emptyState("◉", "Membership roster", "Coordinators and Observers can review the staff roster. Your captured ballot eligibility appears under Vote.");
    return;
  }
  list.innerHTML = `<article class="panel"><div class="panel-heading"><div><p class="method-label">Riverside Residents Association</p><h2>Eligibility roster</h2><p class="muted">${state.members.filter((member) => member.active).length} active of ${state.members.length} Members</p></div></div><ul class="member-list">${state.members.map((member) => `<li><span class="member-avatar" aria-hidden="true">${escapeHtml(member.name.split(/\s+/).map((part) => part[0]).join(""))}</span><span class="member-copy"><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.email)} · Revision ${member.revision}</small></span><span class="membership-state ${member.active ? "active" : "paused"}">${member.active ? "Active" : "Paused"}</span>${state.user.role === "coordinator" ? `<button class="button secondary compact" type="button" data-member-id="${escapeHtml(member.id)}">${member.active ? "Pause" : "Activate"}</button>` : '<span class="read-only">Read only</span>'}</li>`).join("")}</ul></article>`;
}

function renderAudit() {
  if (!state.user) return;
  const list = byId("audit-list");
  if (state.user.role === "member") {
    list.innerHTML = emptyState("≡", "Administrative audit", "Coordinators and Observers can review lifecycle activity. Ballot selections never appear here.");
    return;
  }
  if (!state.audit.length) {
    list.innerHTML = emptyState("≡", "No activity yet", "Successful ballot and membership changes will appear here.");
    return;
  }
  list.innerHTML = state.audit.map((event) => `<article class="timeline-item"><span class="timeline-dot" aria-hidden="true"></span><div><div class="timeline-heading"><h2>${escapeHtml(event.details)}</h2><span>${escapeHtml(event.action.replaceAll("_", " "))}</span></div><p>${escapeHtml(event.actor_label)} · ${escapeHtml(event.entity_type)} · ${escapeHtml(event.entity_id)}</p><time datetime="${escapeHtml(event.created_at)}">${escapeHtml(formatDate(event.created_at))}</time></div></article>`).join("");
}

function choiceField(value = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "choice-field";
  wrapper.innerHTML = `<input name="choice" maxlength="100" value="${escapeHtml(value)}" aria-label="Ballot choice" required /><button class="icon-button remove-choice" type="button" aria-label="Remove choice">×</button>`;
  return wrapper;
}

function resetChoiceFields(values = ["", ""]) {
  const container = byId("choice-fields");
  container.replaceChildren(...values.map((value) => choiceField(value)));
}

function syncMethodFields() {
  const single = byId("ballot-method").value === "single";
  byId("limit-field").classList.toggle("faded", single);
  byId("ballot-limit").disabled = single;
  if (single) byId("ballot-limit").value = "1";
}

function openBallotForm(ballot = null) {
  resetDraftReview();
  state.editingBallot = ballot;
  byId("ballot-form").reset();
  byId("ballot-form-error").textContent = "";
  byId("ballot-id").value = ballot?.id || "";
  byId("ballot-dialog-eyebrow").textContent = ballot ? `Draft · revision ${ballot.revision}` : "New draft";
  byId("ballot-dialog-title").textContent = ballot ? "Edit ballot" : "Create a ballot";
  byId("ballot-title").value = ballot?.title || "";
  byId("ballot-description").value = ballot?.description || "";
  byId("ballot-method").value = ballot?.method || "single";
  byId("ballot-limit").value = String(ballot?.max_selections || 1);
  resetChoiceFields(ballot ? ballot.choices.map((choice) => choice.label) : ["", ""]);
  syncMethodFields();
  showModal(ballotDialog, byId("ballot-title"));
}

// Keep the viewed version separate from the working copy. The voting definition
// is one unit: independently merging its choices and limit could invent a ballot.
function draftFields(ballot) {
  return {
    title: ballot.title,
    description: ballot.description || "",
    voting: {
      method: ballot.method,
      max_selections: ballot.method === "single" ? 1 : ballot.max_selections,
      choices: ballot.choices.map((choice) => typeof choice === "string" ? choice : choice.label),
    },
  };
}

function resetDraftReview() {
  draftReview = null;
  byId("discard-draft-review").disabled = false;
  byId("ballot-form").classList.remove("hidden");
  byId("draft-review-form").classList.add("hidden");
  byId("review-draft-button").classList.add("hidden");
  byId("draft-review-fields").replaceChildren();
}

function offerDraftReview(base, mine) {
  draftReview = { base, mine: draftFields(mine), current: null, picks: {} };
  byId("discard-draft-review").disabled = false;
  byId("ballot-form").classList.remove("hidden");
  byId("draft-review-form").classList.add("hidden");
  byId("review-draft-button").classList.remove("hidden");
}

const reviewLabels = { title: "Title", description: "Context", voting: "Voting definition" };
const sameDraftField = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function draftFieldText(key, value) {
  if (key !== "voting") return value || "(empty)";
  return `${value.method === "single" ? "Single choice" : `Approval, maximum ${value.max_selections}`}\n${value.choices.map((label, i) => `${i + 1}. ${label}`).join("\n")}`;
}

function renderDraftReview() {
  const review = draftReview;
  if (!review?.current) return;
  const locked = review.current.status !== "draft";
  byId("ballot-form").classList.add("hidden");
  byId("draft-review-form").classList.remove("hidden");
  byId("draft-review-error").textContent = "";
  byId("draft-review-summary").textContent = locked
    ? `This ballot is now ${review.current.status}. Its definition is locked; these draft changes cannot be saved.`
    : `Reviewing revision ${review.current.revision}. Changes to different fields are combined below. Choose which version to keep wherever both copies changed. Nothing is saved until you confirm.`;
  const base = draftFields(review.base), latest = draftFields(review.current);
  let unresolved = false;
  byId("draft-review-fields").innerHTML = Object.keys(reviewLabels).map((key) => {
    const mine = review.mine[key], theirs = latest[key];
    const conflict = !sameDraftField(mine, base[key]) && !sameDraftField(theirs, base[key]) && !sameDraftField(mine, theirs);
    if (conflict && !review.picks[key]) unresolved = true;
    const merged = sameDraftField(mine, base[key]) ? theirs : mine;
    const columns = `<div class="review-columns">${[["When opened", base[key]], ["Your changes", mine], ["Latest saved", theirs]].map(([label, value]) => `<div><strong>${label}</strong><p class="review-value">${escapeHtml(draftFieldText(key, value))}</p></div>`).join("")}</div>`;
    const decision = conflict && !locked
      ? `<div class="review-choices">${["yours", "latest"].map((pick) => `<label><input type="radio" name="review-${key}" value="${pick}" ${review.picks[key] === pick ? "checked" : ""} required />Keep ${pick} for ${reviewLabels[key]}</label>`).join("")}</div>`
      : locked ? "" : `<p class="review-result"><strong>Combined ${reviewLabels[key]}:</strong> ${escapeHtml(draftFieldText(key, merged))}</p>`;
    return `<fieldset class="review-field"><legend>${reviewLabels[key]}${conflict ? " — choose a version" : ""}</legend>${columns}${decision}</fieldset>`;
  }).join("");
  byId("save-draft-review").hidden = locked;
  byId("save-draft-review").classList.toggle("hidden", locked);
  byId("save-draft-review").disabled = locked || unresolved;
}

byId("review-draft-button").addEventListener("click", async () => {
  const review = draftReview, user = state.user;
  if (!review || !currentStaffSession(user)) return;
  const button = byId("review-draft-button");
  button.disabled = true;
  try {
    const data = await api("/api/ballots");
    if (draftReview !== review || !currentStaffSession(user)) return;
    const current = data.ballots.find((item) => item.id === review.base.id);
    if (!current) throw new Error("This ballot is no longer available. Discard these changes and refresh.");
    review.current = current;
    review.picks = {};
    renderDraftReview();
    byId("discard-draft-review").focus();
  } catch (error) {
    if (currentStaffSession(user)) byId("ballot-form-error").textContent = error.message;
  } finally { button.disabled = false; }
});

byId("draft-review-fields").addEventListener("change", (event) => {
  const input = event.target;
  if (!draftReview || draftReview.saving || !input.name?.startsWith("review-")) return;
  draftReview.picks[input.name.slice(7)] = input.value;
  const missing = [...byId("draft-review-fields").querySelectorAll("input[type=radio]")]
    .some((radio) => !draftReview.picks[radio.name.slice(7)]);
  byId("save-draft-review").disabled = missing;
});

byId("discard-draft-review").addEventListener("click", async () => {
  if (draftReview?.saving) return;
  const user = state.user;
  resetDraftReview();
  ballotDialog.close();
  try { await refresh(); } catch {}
  if (currentStaffSession(user)) notify("Your unsaved draft changes were discarded. No change was sent.");
});

byId("draft-review-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const review = draftReview, user = state.user, button = byId("save-draft-review");
  if (!review?.current || review.saving || review.current.status !== "draft" || button.disabled || !currentStaffSession(user)) return;
  const base = draftFields(review.base), latest = draftFields(review.current), merged = {};
  for (const key of Object.keys(reviewLabels)) {
    const mine = review.mine[key], theirs = latest[key];
    if (sameDraftField(mine, base[key])) merged[key] = theirs;
    else if (sameDraftField(theirs, base[key]) || sameDraftField(mine, theirs)) merged[key] = mine;
    else if (review.picks[key]) merged[key] = review.picks[key] === "yours" ? mine : theirs;
    else return;
  }
  const payload = { title: merged.title, description: merged.description, ...merged.voting,
    expected_revision: review.current.revision, operation_id: operationId() };
  review.saving = true;
  button.disabled = true;
  byId("discard-draft-review").disabled = true;
  byId("draft-review-fields").querySelectorAll("input").forEach(input => { input.disabled = true; });
  byId("draft-review-error").textContent = "";
  let accepted = false;
  try {
    const result = await staffMutation(`/api/ballots/${review.current.id}`, "PATCH", payload, "Review draft", payload.title);
    if (result.busy || result.gone || !currentStaffSession(user)) return;
    accepted = true;
    if (draftReview === review) {
      resetDraftReview();
      if (ballotDialog.open) ballotDialog.close();
    }
    await refresh("Reviewed draft saved. Current records have been refreshed.");
  } catch (error) {
    if (!currentStaffSession(user)) return;
    if (accepted) notify(`The reviewed draft was saved, but current records could not be refreshed: ${error.message}`, "error");
    else if (draftReview !== review || !ballotDialog.open) notify(error.message, "error");
    else if (error.uncertain) { ballotDialog.close(); notify(error.message, "error"); }
    else if (error.definitive && error.status === 409) {
      offerDraftReview(review.current, payload);
      byId("ballot-form-error").textContent = "The ballot changed again. Your reviewed changes are kept; review the latest version before saving.";
      // The ordinary form remains an accurate copy if the person edits it again.
      state.editingBallot = review.current;
      byId("ballot-title").value = payload.title;
      byId("ballot-description").value = payload.description;
      byId("ballot-method").value = payload.method;
      byId("ballot-limit").value = payload.max_selections;
      resetChoiceFields(payload.choices);
      syncMethodFields();
    } else byId("draft-review-error").textContent = error.message;
  } finally {
    review.saving = false;
    if (draftReview === review) {
      button.disabled = false;
      byId("discard-draft-review").disabled = false;
      byId("draft-review-fields").querySelectorAll("input").forEach(input => { input.disabled = false; });
    }
  }
});

function openVoteForm(ballot) {
  state.selectedBallot = ballot;
  byId("vote-form").reset();
  byId("vote-form-error").textContent = "";
  byId("vote-dialog-title").textContent = ballot.title;
  byId("vote-dialog-description").textContent = ballot.description;
  byId("vote-dialog-help").textContent = ballot.method === "single" ? "Choose one option." : `Choose one or more options, up to ${ballot.max_selections}.`;
  const type = ballot.method === "single" ? "radio" : "checkbox";
  byId("vote-options").innerHTML = '<legend class="sr-only">Ballot choices</legend>' + ballot.choices.map((choice) => `<label class="choice-option"><input type="${type}" name="choice_id" value="${escapeHtml(choice.id)}" /><span>${escapeHtml(choice.label)}</span></label>`).join("");
  showModal(voteDialog, voteDialog.querySelector("input[name=choice_id]"));
}

byId("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (authenticationPending) return;
  byId("login-error").textContent = "";
  const form = new FormData(event.currentTarget);
  setAuthenticationPending(true);
  try {
    const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    state.user = data.user;
    await loadBallots();
    showApp();
    await setView("ballots");
    notify(`Signed in as ${state.user.name}.`);
  } catch (error) {
    byId("login-error").textContent = error.message;
  } finally {
    setAuthenticationPending(false);
  }
});

document.querySelectorAll(".demo-user").forEach((button) => button.addEventListener("click", () => {
  byId("login-email").value = button.dataset.email;
  byId("login-password").value = "CommonGround!2026";
  byId("login-password").focus();
}));

async function signOut(allSessions) {
  if (authenticationPending) return;
  if (allSessions && !confirm("End every Common Ground session for this account?")) return;
  setAuthenticationPending(true);
  try {
    await api(allSessions ? "/api/auth/logout-all" : "/api/auth/logout", { method: "POST" });
    showLogin();
  } catch (error) {
    if (error.status === 401) showLogin();
    else notify(error.message, "error");
  } finally {
    setAuthenticationPending(false);
  }
}

byId("logout-button").addEventListener("click", () => signOut(false));
byId("logout-all-button").addEventListener("click", () => signOut(true));

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", (event) => {
  event.preventDefault();
  setView(button.dataset.view).catch((error) => notify(error.message, "error"));
}));

byId("feedback-close").addEventListener("click", clearNotice);
byId("new-ballot-button").addEventListener("click", () => openBallotForm());
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-open-new-ballot]")) openBallotForm();
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
byId("ballot-method").addEventListener("change", syncMethodFields);
byId("add-choice-button").addEventListener("click", () => {
  const container = byId("choice-fields");
  if (container.children.length >= 8) return;
  const field = choiceField();
  container.append(field);
  field.querySelector("input").focus();
});
byId("choice-fields").addEventListener("click", (event) => {
  const button = event.target.closest(".remove-choice");
  if (!button) return;
  if (byId("choice-fields").children.length <= 2) {
    byId("ballot-form-error").textContent = "A ballot needs at least two choices.";
    return;
  }
  button.closest(".choice-field").remove();
});

byId("ballot-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = event.currentTarget.querySelector("button[type=submit]");
  if (submit.disabled) return;
  const user = state.user;
  const editingBallot = state.editingBallot;
  const form = new FormData(event.currentTarget);
  const payload = {
    title: form.get("title"),
    description: form.get("description"),
    method: form.get("method"),
    max_selections: form.get("method") === "single" ? 1 : Number(form.get("max_selections")),
    choices: form.getAll("choice"),
    operation_id: operationId(),
  };
  if (editingBallot) payload.expected_revision = editingBallot.revision;
  byId("ballot-form-error").textContent = "";
  submit.disabled = true;
  const submission = {};
  ballotSubmission = submission;
  let accepted = false;
  try {
    const result = await staffMutation(editingBallot ? `/api/ballots/${editingBallot.id}` : "/api/ballots", editingBallot ? "PATCH" : "POST", payload, editingBallot ? "Edit draft" : "Create draft", payload.title);
    if (result.busy || result.gone || !currentStaffSession(user)) return;
    accepted = true;
    ballotDialog.close();
    await refresh(editingBallot ? "Draft changes saved." : "Draft ballot created.");
  } catch (error) {
    if (error.status === 401 && currentStaffSession(user)) showLogin();
    else if (currentStaffSession(user)) {
      if (error.uncertain || accepted) {
        ballotDialog.close();
        notify(accepted ? `The draft was saved, but current records could not be refreshed: ${error.message}` : error.message, "error");
      } else {
        byId("ballot-form-error").textContent = error.message;
        if (editingBallot && error.definitive && error.status === 409) offerDraftReview(editingBallot, payload);
      }
    }
  } finally {
    if (ballotSubmission === submission) {
      ballotSubmission = null;
      submit.disabled = false;
    }
  }
});

byId("ballots-list").addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-ballot-edit]");
  if (editButton) {
    const ballot = state.ballots.find((item) => item.id === editButton.dataset.ballotEdit);
    if (ballot) openBallotForm(ballot);
    return;
  }
  const button = event.target.closest("[data-ballot-action]");
  if (!button || button.disabled) return;
  const ballot = state.ballots.find((item) => item.id === button.dataset.id);
  if (!ballot) return;
  const labels = { open: "Ballot opened with a fixed eligibility snapshot.", close: "Voting closed; tallies remain hidden.", publish: "Anonymous results published." };
  const actionNames = { open: "Open ballot", close: "Close voting", publish: "Publish results" };
  const user = state.user;
  button.disabled = true;
  let accepted = false;
  try {
    const result = await staffMutation(`/api/ballots/${ballot.id}/${button.dataset.ballotAction}`, "POST", { expected_revision: ballot.revision, operation_id: operationId() }, actionNames[button.dataset.ballotAction], ballot.title);
    if (result.busy || result.gone || !currentStaffSession(user)) return;
    accepted = true;
    await refresh(labels[button.dataset.ballotAction]);
  } catch (error) {
    if (error.status === 401 && currentStaffSession(user)) showLogin();
    else if (currentStaffSession(user)) notify(accepted ? `The action was accepted, but current records could not be refreshed: ${error.message}` : error.message, "error");
  } finally {
    button.disabled = false;
  }
});

function roundOptions(selected = []) {
  byId("round-options").innerHTML = state.ballots.filter(b => b.status === "draft").map(b =>
    `<label class="choice-option"><input type="checkbox" name="round-ballot" value="${escapeHtml(b.id)}" ${selected.includes(b.id) ? "checked" : ""}/><span>${escapeHtml(b.title)}</span></label>`).join("") || '<p>No drafts available.</p>';
}

byId("open-round-button").addEventListener("click", async () => {
  const user = state.user, generation = ++roundGeneration;
  try {
    await loadBallots();
    if (!currentStaffSession(user) || generation !== roundGeneration) return;
    roundReview = null;
    roundOptions();
    byId("round-error").textContent = "";
    byId("round-selection").classList.remove("hidden");
    for (const id of ["round-preview", "round-change", "round-confirm"]) byId(id).classList.add("hidden");
    byId("round-review").textContent = "Review round";
    byId("round-review").disabled = false;
    byId("round-change").disabled = false;
    showModal(roundDialog, byId("round-options").querySelector("input") || byId("round-review"));
  } catch (error) { if (currentStaffSession(user)) notify(error.message, "error"); }
});

roundDialog.addEventListener("close", () => { roundGeneration++; roundReview = null; });

byId("round-change").addEventListener("click", async () => {
  const user = state.user, generation = ++roundGeneration;
  const selected = [...byId("round-options").querySelectorAll("input:checked")].map(i => i.value);
  roundReview = null;
  byId("round-confirm").disabled = true;
  try {
    await loadBallots();
    if (!currentStaffSession(user) || generation !== roundGeneration) return;
    roundOptions(selected);
    byId("round-selection").classList.remove("hidden");
    for (const id of ["round-preview", "round-change", "round-confirm"]) byId(id).classList.add("hidden");
    byId("round-review").textContent = "Review round";
    byId("round-error").textContent = "Review your selection before opening. No ballots were opened by changing the selection.";
  } catch (error) { if (currentStaffSession(user)) byId("round-error").textContent = error.message; }
});

byId("round-review").addEventListener("click", async () => {
  const user = state.user, generation = ++roundGeneration, button = byId("round-review");
  const selected = [...byId("round-options").querySelectorAll("input:checked")].map(i => i.value);
  roundReview = null;
  byId("round-confirm").disabled = true;
  if (selected.length < 2) { byId("round-error").textContent = "Choose at least two drafts."; return; }
  button.disabled = true;
  try {
    const data = await api("/api/rounds/preview", { method: "POST", body: JSON.stringify({ ballot_ids: selected }) });
    if (!currentStaffSession(user) || generation !== roundGeneration) return;
    roundReview = data;
    const active = data.roster.filter(m => m.active);
    byId("round-summary").innerHTML = `<h3>Review before opening</h3><ul>${data.ballots.map(b => `<li><strong>${escapeHtml(b.title)}</strong> — revision ${b.revision}<p>${escapeHtml(b.description)} · ${escapeHtml(methodLabel(b))}</p><p>${b.choices.map(c => escapeHtml(c.label)).join(" · ")}</p></li>`).join("")}</ul><h3>Eligible Members for every ballot</h3><p>${active.length ? active.map(m => escapeHtml(m.name)).join(", ") : "No active Members. Activate a Member, then review again."}</p>`;
    byId("round-selection").classList.add("hidden");
    for (const id of ["round-preview", "round-change", "round-confirm"]) byId(id).classList.remove("hidden");
    byId("round-confirm").disabled = !active.length;
    byId("round-error").textContent = "";
    button.textContent = "Refresh round review";
  } catch (error) {
    if (currentStaffSession(user) && generation === roundGeneration) byId("round-error").textContent = error.message;
  } finally { if (generation === roundGeneration) button.disabled = false; }
});

byId("round-confirm").addEventListener("click", async () => {
  const review = roundReview, user = state.user, generation = roundGeneration, button = byId("round-confirm");
  if (!review || button.disabled) return;
  const payload = { ballots: review.ballots.map(b => ({ id: b.id, revision: b.revision })), roster: review.roster.map(m => ({ id: m.id, revision: m.revision })), operation_id: operationId() };
  button.disabled = true;
  byId("round-review").disabled = true;
  byId("round-change").disabled = true;
  let accepted = false;
  try {
    const result = await staffMutation("/api/rounds/open", "POST", payload, "Open round", review.ballots.map(b => b.title).join("; "));
    if (result.busy || result.gone || !currentStaffSession(user)) return;
    accepted = true;
    if (generation === roundGeneration) roundDialog.close();
    await refresh("All reviewed ballots opened together.");
  } catch (error) {
    if (!currentStaffSession(user)) return;
    if (accepted) notify(`The round opened, but current records could not be refreshed: ${error.message}`, "error");
    else if (generation === roundGeneration) {
      roundReview = null;
      byId("round-error").textContent = error.message;
      if (error.uncertain) roundDialog.close();
    }
  } finally {
    if (generation === roundGeneration) {
      byId("round-review").disabled = false;
      byId("round-change").disabled = false;
    }
  }
});

byId("vote-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-vote-id]");
  if (!button) return;
  const ballot = state.ballots.find((item) => item.id === button.dataset.voteId);
  if (ballot) openVoteForm(ballot);
});

byId("vote-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const chosen = [...event.currentTarget.querySelectorAll("input[name=choice_id]:checked")].map((input) => input.value);
  if (!chosen.length) {
    byId("vote-form-error").textContent = "Choose at least one option.";
    return;
  }
  if (state.selectedBallot.method === "approval" && chosen.length > state.selectedBallot.max_selections) {
    byId("vote-form-error").textContent = `Choose no more than ${state.selectedBallot.max_selections} options.`;
    return;
  }
  byId("vote-form-error").textContent = "";
  try {
    await api(`/api/ballots/${state.selectedBallot.id}/vote`, { method: "POST", body: JSON.stringify({ choice_ids: chosen, expected_revision: state.selectedBallot.revision, operation_id: operationId() }) });
    voteDialog.close();
    await refresh("Your final participation was recorded. Your selection remains private.");
  } catch (error) {
    byId("vote-form-error").textContent = error.message;
  }
});

byId("members-list").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-member-id]");
  if (!button || button.disabled) return;
  const member = state.members.find((item) => item.id === button.dataset.memberId);
  if (!member) return;
  const user = state.user;
  button.disabled = true;
  let accepted = false;
  try {
    const result = await staffMutation(`/api/members/${member.id}`, "PATCH", { active: !member.active, expected_revision: member.revision, operation_id: operationId() }, member.active ? "Pause member" : "Activate member", member.name);
    if (result.busy || result.gone || !currentStaffSession(user)) return;
    accepted = true;
    await loadMembers();
    if (!currentStaffSession(user)) return;
    await loadBallots();
    if (currentStaffSession(user)) notify(`${member.name} is now ${member.active ? "paused" : "active"} for future ballots.`);
  } catch (error) {
    if (error.status === 401 && currentStaffSession(user)) showLogin();
    else if (currentStaffSession(user)) notify(accepted ? `The membership change was accepted, but current records could not be refreshed: ${error.message}` : error.message, "error");
  } finally {
    button.disabled = false;
  }
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  byId("theme-button").setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
  try { localStorage.setItem("common-ground-theme", theme); } catch {}
}

byId("theme-button").addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

window.addEventListener("DOMContentLoaded", async () => {
  let theme = "light";
  try { theme = localStorage.getItem("common-ground-theme") || "light"; } catch {}
  applyTheme(theme);
  try {
    const data = await api("/api/me");
    if (!data.user) throw new Error("Signed out");
    state.user = data.user;
    await loadBallots();
    showApp();
    await setView("ballots");
  } catch {
    showLogin();
  }
});

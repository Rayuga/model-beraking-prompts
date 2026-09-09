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

[ballotDialog, voteDialog].forEach((dialog) => {
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

function showLogin() {
  state.user = null;
  state.ballots = [];
  state.members = [];
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
  document.querySelector(".demo-access").open = false;
  byId("login-password").value = "";
  byId("login-email").focus();
}

function showApp() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  byId("user-name").textContent = state.user.name;
  byId("user-role").textContent = roleLabel(state.user.role);
  byId("user-initials").textContent = state.user.name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  byId("new-ballot-button").classList.toggle("hidden", state.user.role !== "coordinator");
}

async function loadBallots() {
  const data = await api("/api/ballots");
  state.ballots = data.ballots;
  renderBallots();
  renderVote();
  renderTurnout();
  renderResults();
}

async function loadMembers() {
  if (state.user.role === "member") {
    state.members = [];
  } else {
    state.members = (await api("/api/members")).members;
  }
  renderMembers();
}

async function loadAudit() {
  if (state.user.role === "member") {
    state.audit = [];
  } else {
    state.audit = (await api("/api/audit")).events;
  }
  renderAudit();
}

async function refresh(message) {
  await loadBallots();
  if (["members", "audit"].includes(state.activeView)) {
    if (state.activeView === "members") await loadMembers();
    if (state.activeView === "audit") await loadAudit();
  }
  if (message) notify(message);
}

async function setView(view) {
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
    return `<button class="button secondary compact" type="button" data-ballot-edit="${escapeHtml(ballot.id)}">Edit draft</button><button class="button primary compact" type="button" data-ballot-action="open" data-id="${escapeHtml(ballot.id)}">Open ballot</button>`;
  }
  if (ballot.status === "open") return `<button class="button secondary compact" type="button" data-ballot-action="close" data-id="${escapeHtml(ballot.id)}">Close voting</button>`;
  if (ballot.status === "closed") return `<button class="button primary compact" type="button" data-ballot-action="publish" data-id="${escapeHtml(ballot.id)}">Publish results</button>`;
  return '<span class="locked-note">Published · no further lifecycle actions</span>';
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
  byId("login-error").textContent = "";
  const form = new FormData(event.currentTarget);
  try {
    const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    state.user = data.user;
    await loadBallots();
    showApp();
    await setView("ballots");
    notify(`Signed in as ${state.user.name}.`);
  } catch (error) {
    byId("login-error").textContent = error.message;
  }
});

document.querySelectorAll(".demo-user").forEach((button) => button.addEventListener("click", () => {
  byId("login-email").value = button.dataset.email;
  byId("login-password").value = "CommonGround!2026";
  byId("login-password").focus();
}));

byId("logout-button").addEventListener("click", async () => {
  try { await api("/api/auth/logout", { method: "POST" }); } finally { showLogin(); }
});

byId("logout-all-button").addEventListener("click", async () => {
  if (!confirm("End every Common Ground session for this account?")) return;
  try { await api("/api/auth/logout-all", { method: "POST" }); } finally { showLogin(); }
});

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
  const form = new FormData(event.currentTarget);
  const payload = {
    title: form.get("title"),
    description: form.get("description"),
    method: form.get("method"),
    max_selections: form.get("method") === "single" ? 1 : Number(form.get("max_selections")),
    choices: form.getAll("choice"),
    operation_id: operationId(),
  };
  if (state.editingBallot) payload.expected_revision = state.editingBallot.revision;
  byId("ballot-form-error").textContent = "";
  try {
    await api(state.editingBallot ? `/api/ballots/${state.editingBallot.id}` : "/api/ballots", { method: state.editingBallot ? "PATCH" : "POST", body: JSON.stringify(payload) });
    ballotDialog.close();
    await refresh(state.editingBallot ? "Draft changes saved." : "Draft ballot created.");
  } catch (error) {
    byId("ballot-form-error").textContent = error.message;
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
  if (!button) return;
  const ballot = state.ballots.find((item) => item.id === button.dataset.id);
  if (!ballot) return;
  const labels = { open: "Ballot opened with a fixed eligibility snapshot.", close: "Voting closed; tallies remain hidden.", publish: "Anonymous results published." };
  button.disabled = true;
  try {
    await api(`/api/ballots/${ballot.id}/${button.dataset.ballotAction}`, { method: "POST", body: JSON.stringify({ expected_revision: ballot.revision, operation_id: operationId() }) });
    await refresh(labels[button.dataset.ballotAction]);
  } catch (error) {
    notify(error.message, "error");
    button.disabled = false;
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
  if (!button) return;
  const member = state.members.find((item) => item.id === button.dataset.memberId);
  if (!member) return;
  button.disabled = true;
  try {
    await api(`/api/members/${member.id}`, { method: "PATCH", body: JSON.stringify({ active: !member.active, expected_revision: member.revision, operation_id: operationId() }) });
    await loadMembers();
    await loadBallots();
    notify(`${member.name} is now ${member.active ? "paused" : "active"} for future ballots.`);
  } catch (error) {
    notify(error.message, "error");
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

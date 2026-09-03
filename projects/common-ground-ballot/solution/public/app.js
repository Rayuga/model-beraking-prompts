const state = {
  user: null,
  ballots: [],
  audit: [],
  activeView: "ballots",
  selectedBallot: null,
};

const byId = (id) => document.getElementById(id);
const loginView = byId("login-view");
const appView = byId("app-view");
const toast = byId("toast");
const ballotDialog = byId("ballot-dialog");
const voteDialog = byId("vote-dialog");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function roleLabel(role) {
  return {
    coordinator: "Coordinator",
    observer: "Observer",
    member: "Member",
  }[role] || role;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function notify(message, type = "success") {
  toast.textContent = message;
  toast.className = `toast show ${type === "error" ? "error" : ""}`;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => {
    toast.className = "toast";
  }, 3200);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

function emptyState(icon, title, message, action = "") {
  return `
    <div class="empty-state">
      <div class="empty-icon" aria-hidden="true">${icon}</div>
      <h2>${escapeHtml(title)}</h2>
      <p class="muted">${escapeHtml(message)}</p>
      ${action}
    </div>
  `;
}

function showLogin() {
  state.user = null;
  state.ballots = [];
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
  byId("login-email").focus();
}

function showApp() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  byId("user-name").textContent = state.user.name;
  byId("user-role").textContent = roleLabel(state.user.role);
  byId("user-initials").textContent = state.user.name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  byId("new-ballot-button").classList.toggle(
    "hidden",
    state.user.role !== "coordinator"
  );
}

async function loadBallots() {
  const data = await api("/api/ballots");
  state.ballots = data.ballots;
  renderAll();
}

async function loadAudit() {
  if (!["coordinator", "observer"].includes(state.user.role)) {
    state.audit = [];
    renderAudit();
    return;
  }
  const data = await api("/api/audit");
  state.audit = data.events;
  renderAudit();
}

function setView(view) {
  state.activeView = view;
  document.querySelectorAll(".nav-item").forEach((item) => {
    const active = item.dataset.view === view;
    item.classList.toggle("active", active);
    item.setAttribute("aria-current", active ? "page" : "false");
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active-view", section.id === `view-${view}`);
  });
  byId("main-content").focus();
  if (view === "audit") loadAudit().catch((error) => notify(error.message, "error"));
}

function statusTag(status) {
  return `<span class="status ${escapeHtml(status)}">${escapeHtml(status)}</span>`;
}

function ballotActions(ballot) {
  if (state.user.role !== "coordinator") return "";
  if (ballot.status === "draft") {
    return `<button class="button primary small-button" data-ballot-action="open" data-id="${ballot.id}">Open ballot</button>`;
  }
  if (ballot.status === "open") {
    return `<button class="button secondary small-button" data-ballot-action="close" data-id="${ballot.id}">Close voting</button>`;
  }
  if (ballot.status === "closed") {
    return `<button class="button primary small-button" data-ballot-action="publish" data-id="${ballot.id}">Publish results</button>`;
  }
  return "";
}

function renderBallots() {
  const subtitle = {
    coordinator: "Create and move ballots through their lifecycle.",
    observer: "Review ballot setup and lifecycle without making changes.",
    member: "Ballots for which your eligibility has been captured.",
  }[state.user.role];
  byId("ballots-subtitle").textContent = subtitle;

  const counts = ["draft", "open", "closed", "published"].map((status) => ({
    status,
    count: state.ballots.filter((ballot) => ballot.status === status).length,
  }));
  byId("ballot-stats").innerHTML = counts
    .map(
      ({ status, count }) => `
        <article class="stat">
          <span>${status[0].toUpperCase() + status.slice(1)}</span>
          <strong>${count}</strong>
        </article>
      `
    )
    .join("");

  const list = byId("ballots-list");
  if (!state.ballots.length) {
    const action =
      state.user.role === "coordinator"
        ? '<button class="button primary" data-open-new-ballot>Start the first ballot</button>'
        : "";
    list.innerHTML = emptyState(
      "◇",
      "No ballots yet",
      state.user.role === "member"
        ? "Eligible ballots will appear here once a coordinator opens them."
        : "The workspace is ready for its first member decision.",
      action
    );
    return;
  }

  list.innerHTML = state.ballots
    .map((ballot) => {
      const turnout = ballot.turnout
        ? `${ballot.turnout.participated} of ${ballot.turnout.eligible} participated`
        : ballot.participated
          ? "Your participation is recorded"
          : ballot.eligible
            ? "You are eligible"
            : "Not eligible";
      return `
        <article class="ballot-card">
          <div class="card-top">
            <div>
              <h3>${escapeHtml(ballot.title)}</h3>
              <p class="muted">${escapeHtml(ballot.description || "No description provided.")}</p>
            </div>
            ${statusTag(ballot.status)}
          </div>
          <ul class="choice-preview">
            ${ballot.choices.map((choice) => `<li>${escapeHtml(choice.label)}</li>`).join("")}
          </ul>
          <div class="card-meta">
            <span>${ballot.choices.length} choices</span>
            <span>${escapeHtml(turnout)}</span>
          </div>
          <div class="card-actions">${ballotActions(ballot)}</div>
        </article>
      `;
    })
    .join("");
}

function renderVote() {
  const list = byId("vote-list");
  if (state.user.role !== "member") {
    list.innerHTML = emptyState(
      "✓",
      "Member voting",
      "Voting controls are available only to eligible Member accounts."
    );
    return;
  }
  const eligible = state.ballots.filter(
    (ballot) => ballot.status === "open" || ballot.participated
  );
  if (!eligible.length) {
    list.innerHTML = emptyState(
      "○",
      "Nothing to vote on",
      "When a ballot opens for your group, it will appear here."
    );
    return;
  }
  list.innerHTML = eligible
    .map(
      (ballot) => `
        <article class="panel">
          <div class="panel-heading">
            <div>
              <h2>${escapeHtml(ballot.title)}</h2>
              <p class="muted">${escapeHtml(ballot.description || "Choose one option.")}</p>
            </div>
            ${statusTag(ballot.status)}
          </div>
          ${
            ballot.participated
              ? '<p class="participated"><span aria-hidden="true">✓</span> Participation recorded privately</p>'
              : `<button class="button primary" data-vote-id="${ballot.id}">Cast your vote</button>`
          }
        </article>
      `
    )
    .join("");
}

function renderTurnout() {
  const list = byId("turnout-list");
  if (state.user.role === "member") {
    list.innerHTML = emptyState(
      "◔",
      "Aggregate view",
      "Detailed turnout is available to coordinators and observers. Your own participation appears under Vote."
    );
    return;
  }
  const opened = state.ballots.filter((ballot) => ballot.status !== "draft");
  if (!opened.length) {
    list.innerHTML = emptyState(
      "◔",
      "No turnout to report",
      "Turnout begins after the first ballot is opened."
    );
    return;
  }
  list.innerHTML = opened
    .map(
      (ballot) => `
        <article class="panel">
          <div class="panel-heading">
            <div>
              <h2>${escapeHtml(ballot.title)}</h2>
              <p class="muted">${ballot.turnout.participated} of ${ballot.turnout.eligible} eligible members have participated</p>
            </div>
            <strong>${ballot.turnout.percentage}%</strong>
          </div>
          <div class="progress-track" aria-label="${ballot.turnout.percentage}% turnout">
            <div class="progress-fill" style="width: ${ballot.turnout.percentage}%"></div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderResults() {
  const list = byId("results-list");
  const published = state.ballots.filter((ballot) => ballot.status === "published");
  if (!published.length) {
    list.innerHTML = emptyState(
      "▥",
      "No published results",
      "Choice totals stay private until a coordinator publishes a closed ballot."
    );
    return;
  }
  list.innerHTML = published
    .map(
      (ballot) => `
        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Published ${escapeHtml(formatDate(ballot.published_at))}</p>
              <h2>${escapeHtml(ballot.title)}</h2>
            </div>
            <strong>${ballot.total_votes} vote${ballot.total_votes === 1 ? "" : "s"}</strong>
          </div>
          ${ballot.results
            .map(
              (result) => `
                <div class="result-row">
                  <span>${escapeHtml(result.label)}</span>
                  <div class="progress-track" aria-label="${escapeHtml(result.label)} ${result.percentage}%">
                    <div class="progress-fill" style="width: ${result.percentage}%"></div>
                  </div>
                  <strong>${result.votes} · ${result.percentage}%</strong>
                </div>
              `
            )
            .join("")}
        </article>
      `
    )
    .join("");
}

function renderAudit() {
  const list = byId("audit-list");
  if (state.user.role === "member") {
    list.innerHTML = emptyState(
      "≡",
      "Administrative audit",
      "This view is available to Coordinators and Observers. Your ballot choice is never written to it."
    );
    return;
  }
  if (!state.audit.length) {
    list.innerHTML = emptyState(
      "≡",
      "No activity yet",
      "Ballot creation and lifecycle changes will appear here."
    );
    return;
  }
  list.innerHTML = state.audit
    .map(
      (event) => `
        <article class="timeline-item">
          <div class="timeline-dot" aria-hidden="true">◆</div>
          <div class="timeline-content">
            <h3>${escapeHtml(event.actor_name)} ${escapeHtml(event.action)} a ${escapeHtml(event.entity_type)}</h3>
            <p>${escapeHtml(event.details)}</p>
            <time datetime="${escapeHtml(event.created_at)}">${escapeHtml(formatDate(event.created_at))} · ${escapeHtml(roleLabel(event.actor_role))}</time>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAll() {
  renderBallots();
  renderVote();
  renderTurnout();
  renderResults();
  if (state.activeView === "audit") renderAudit();
}

async function refresh(message) {
  await loadBallots();
  if (message) notify(message);
}

byId("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = byId("login-error");
  error.textContent = "";
  const form = new FormData(event.currentTarget);
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    state.user = data.user;
    showApp();
    await loadBallots();
    setView("ballots");
  } catch (loginError) {
    error.textContent = loginError.message;
  }
});

document.querySelectorAll(".demo-user").forEach((button) => {
  button.addEventListener("click", () => {
    byId("login-email").value = button.dataset.email;
    byId("login-password").value = "CommonGround!2026";
    byId("login-password").focus();
  });
});

byId("logout-button").addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    showLogin();
  }
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    setView(button.dataset.view);
  });
});

function openNewBallot() {
  byId("ballot-form").reset();
  byId("ballot-form-error").textContent = "";
  byId("choice-fields").innerHTML = `
    <label>Choice 1<input name="choice" maxlength="100" required /></label>
    <label>Choice 2<input name="choice" maxlength="100" required /></label>
  `;
  ballotDialog.showModal();
  ballotDialog.querySelector('input[name="title"]').focus();
}

byId("new-ballot-button").addEventListener("click", openNewBallot);
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-open-new-ballot]")) openNewBallot();
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

byId("add-choice-button").addEventListener("click", () => {
  const container = byId("choice-fields");
  const count = container.querySelectorAll('input[name="choice"]').length + 1;
  const label = document.createElement("label");
  label.innerHTML = `Choice ${count}<input name="choice" maxlength="100" required />`;
  container.append(label);
  label.querySelector("input").focus();
});

byId("ballot-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const error = byId("ballot-form-error");
  error.textContent = "";
  try {
    await api("/api/ballots", {
      method: "POST",
      body: JSON.stringify({
        title: form.get("title"),
        description: form.get("description"),
        choices: form.getAll("choice"),
      }),
    });
    ballotDialog.close();
    await refresh("Draft ballot saved.");
  } catch (formError) {
    error.textContent = formError.message;
  }
});

byId("ballots-list").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-ballot-action]");
  if (!button) return;
  const action = button.dataset.ballotAction;
  const labels = {
    open: "Ballot opened with a fixed eligibility snapshot.",
    close: "Voting closed. Choice totals remain hidden.",
    publish: "Anonymous results published.",
  };
  button.disabled = true;
  try {
    await api(`/api/ballots/${button.dataset.id}/${action}`, { method: "POST" });
    await refresh(labels[action]);
  } catch (error) {
    notify(error.message, "error");
    button.disabled = false;
  }
});

byId("vote-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-vote-id]");
  if (!button) return;
  const ballot = state.ballots.find((item) => item.id === button.dataset.voteId);
  if (!ballot) return;
  state.selectedBallot = ballot;
  byId("vote-dialog-title").textContent = ballot.title;
  byId("vote-dialog-description").textContent =
    ballot.description || "Choose one option below.";
  byId("vote-form-error").textContent = "";
  byId("vote-options").innerHTML = `
    <legend class="sr-only">Select one choice</legend>
    ${ballot.choices
      .map(
        (choice) => `
          <label class="choice-option">
            <input type="radio" name="choice_id" value="${escapeHtml(choice.id)}" required />
            <span>${escapeHtml(choice.label)}</span>
          </label>
        `
      )
      .join("")}
  `;
  voteDialog.showModal();
});

byId("vote-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const error = byId("vote-form-error");
  error.textContent = "";
  try {
    await api(`/api/ballots/${state.selectedBallot.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ choice_id: form.get("choice_id") }),
    });
    voteDialog.close();
    await refresh("Participation recorded. Your selection remains private.");
  } catch (voteError) {
    error.textContent = voteError.message;
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await api("/api/me");
    state.user = data.user;
    showApp();
    await loadBallots();
    setView("ballots");
  } catch {
    showLogin();
  }
});

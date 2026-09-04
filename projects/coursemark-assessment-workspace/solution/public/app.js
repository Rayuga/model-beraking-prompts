const TOKEN_KEY = "coursemark_bearer_token";
const SESSION_EVENT_KEY = "coursemark_session_event";
const sessionChannel = "BroadcastChannel" in window
  ? new BroadcastChannel("coursemark-session")
  : null;

const state = {
  user: null,
  token: sessionStorage.getItem(TOKEN_KEY) || "",
  referenceMoment: null,
  revision: 0,
  courses: [],
  assessments: [],
  attempts: [],
  audit: [],
  activeView: "courses",
  assessmentFilter: "all",
  activeAttempt: null,
  activeGrade: null,
};

const pendingWrites = new Set();

const $ = (id) => document.getElementById(id);
const toast = $("toast");

document.addEventListener(
  "keydown",
  (event) => {
    if (event.key !== "Tab") return;
    const openDialogs = [...document.querySelectorAll("dialog[open]")];
    const dialog = openDialogs.at(-1);
    if (!dialog) return;
    const focusable = [...dialog.querySelectorAll(
      'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )].filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    const outside = !dialog.contains(document.activeElement);
    if (event.shiftKey && (outside || document.activeElement === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (outside || document.activeElement === last)) {
      event.preventDefault();
      first.focus();
    }
  },
  true
);

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
    instructor: "Instructor",
    teaching_assistant: "Teaching assistant",
    student: "Student",
  }[role] || role;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function notify(message, type = "success") {
  toast.textContent = message;
  toast.className = `toast show ${type === "error" ? "error-toast" : ""}`;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => {
    toast.className = "toast";
  }, 3200);
}

async function api(url, options = {}) {
  const { trackRevision = true, ...requestOptions } = options;
  const headers = { "Content-Type": "application/json", ...(requestOptions.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(url, {
    ...requestOptions,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.token) {
      state.token = "";
      sessionStorage.removeItem(TOKEN_KEY);
      showLogin();
    }
    const error = new Error(data.error || "The request could not be completed.");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  if (trackRevision) applyRevision(data.revision);
  return data;
}

function applyRevision(value) {
  const revision = Number(value);
  if (Number.isInteger(revision) && revision >= 0) state.revision = revision;
  if ($("revision")) $("revision").textContent = `Revision ${state.revision}`;
}

function operationId() {
  if (crypto.randomUUID) return crypto.randomUUID().replaceAll("-", "");
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function mutate(key, url, method, payload = {}) {
  if (pendingWrites.has(key)) return null;
  pendingWrites.add(key);
  $("sync-status").textContent = "Saving...";
  try {
    const data = await api(url, {
      method,
      body: JSON.stringify({
        ...payload,
        expected_revision: state.revision,
        operation_id: operationId(),
      }),
    });
    $("sync-status").textContent = "Synced";
    return data;
  } catch (error) {
    applyRevision(error.data?.revision);
    $("sync-status").textContent =
      error.status === 409 && error.data?.snapshot
        ? "Updated elsewhere - refresh applied"
        : "Not saved";
    throw error;
  } finally {
    pendingWrites.delete(key);
  }
}

function emptyState(title, message) {
  return `
    <div class="empty">
      <div class="empty-icon" aria-hidden="true">◇</div>
      <h2>${escapeHtml(title)}</h2>
      <p class="muted">${escapeHtml(message)}</p>
    </div>
  `;
}

function status(value) {
  return `<span class="status ${escapeHtml(value)}">${escapeHtml(value.replaceAll("_", " "))}</span>`;
}

function showLogin() {
  state.user = null;
  $("app-view").classList.add("hidden");
  $("login-view").classList.remove("hidden");
  window.scrollTo(0, 0);
  $("login-email").focus();
}

function clearSession() {
  state.token = "";
  sessionStorage.removeItem(TOKEN_KEY);
  showLogin();
}

function acceptAccountSignout(userId) {
  if (userId && state.user?.id === userId) clearSession();
}

sessionChannel?.addEventListener("message", (event) => {
  if (event.data?.type === "account-signout") {
    acceptAccountSignout(event.data.user_id);
  }
});

window.addEventListener("storage", (event) => {
  if (event.key !== SESSION_EVENT_KEY || !event.newValue) return;
  try {
    const message = JSON.parse(event.newValue);
    if (message.type === "account-signout") acceptAccountSignout(message.user_id);
  } catch {
    // Ignore unrelated or malformed local storage values.
  }
});

function showApp() {
  $("login-view").classList.add("hidden");
  $("app-view").classList.remove("hidden");
  $("user-name").textContent = state.user.name;
  $("user-role").textContent = roleLabel(state.user.role);
  $("user-email").textContent = state.user.email;
  $("clock").textContent = `Reference time · ${formatDate(state.referenceMoment)}`;
  $("mobile-user-name").textContent = state.user.name;
  $("mobile-user-role").textContent = roleLabel(state.user.role);
  $("mobile-user-email").textContent = state.user.email;
  $("mobile-reference-time").textContent = `Reference · ${formatDate(state.referenceMoment)}`;
  applyRevision(state.revision);
  $("new-assessment").classList.toggle("hidden", state.user.role !== "instructor");
}

async function loadWorkspace() {
  const [courses, assessments, attempts] = await Promise.all([
    api("/api/courses"),
    api("/api/assessments"),
    api("/api/attempts"),
  ]);
  state.courses = courses.courses;
  state.assessments = assessments.assessments;
  state.attempts = attempts.attempts;
  applyRevision(Math.max(courses.revision, assessments.revision, attempts.revision));
  renderAll();
}

async function loadAudit() {
  const data = await api("/api/audit");
  state.audit = data.events;
  renderAudit();
}

function setView(view) {
  state.activeView = view;
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active-view", section.id === `view-${view}`);
  });
  $("main-content").focus({ preventScroll: true });
  window.scrollTo(0, 0);
  if (view === "audit") loadAudit().catch((error) => notify(error.message, "error"));
}

function renderCourses() {
  const list = $("courses-list");
  if (!state.courses.length) {
    list.innerHTML = emptyState("No courses", "There are no courses available for this account.");
    return;
  }
  list.innerHTML = state.courses
    .map(
      (course) => `
        <article class="course-card">
          <span class="course-code">${escapeHtml(course.id)}</span>
          <h2>${escapeHtml(course.title)}</h2>
          <div class="course-meta">
            <span>${course.assessment_count} assessment${course.assessment_count === 1 ? "" : "s"}</span>
            <span>${course.student_count} enrolled students</span>
          </div>
        </article>
      `
    )
    .join("");
}

function accommodationText(assessment) {
  if (state.user.role !== "student") return "";
  const parts = [];
  if (assessment.extra_time_minutes) {
    parts.push(`+${assessment.extra_time_minutes} minutes accommodation`);
  }
  if (assessment.deadline_extension_minutes) {
    parts.push(`deadline extended ${assessment.deadline_extension_minutes} minutes`);
  }
  return parts.length
    ? `<p class="adjustment">${escapeHtml(parts.join(" · "))}</p>`
    : "";
}

function assessmentActions(assessment) {
  if (state.user.role === "instructor" && assessment.status === "draft") {
    return `
      <button class="button ghost small" data-review-items="${assessment.id}">Review questions</button>
      <button class="button secondary small" data-add-item="${assessment.id}">Add question</button>
      <button class="button primary small" data-publish="${assessment.id}" ${
        assessment.item_count ? "" : "disabled title=\"Add a question first\""
      }>Publish assessment</button>
    `;
  }
  if (state.user.role !== "student") {
    return `<button class="button secondary small" data-review-items="${assessment.id}">Review questions</button>`;
  }
  if (state.user.role === "student") {
    if (assessment.attempt?.status === "in_progress") {
      return `<button class="button primary small" data-open-attempt="${assessment.attempt.id}">Continue attempt</button>`;
    }
    if (assessment.can_start) {
      return `<button class="button primary small" data-start="${assessment.id}">Start attempt</button>`;
    }
    if (assessment.attempt) {
      return `<span class="muted">Attempt ${escapeHtml(assessment.attempt.status.replaceAll("_", " "))}</span>`;
    }
  }
  return "";
}

function renderAssessments() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.assessmentFilter);
  });
  const visible = state.assessments.filter(
    (assessment) =>
      state.assessmentFilter === "all" || assessment.status === state.assessmentFilter
  );
  const list = $("assessments-list");
  if (!visible.length) {
    list.innerHTML = emptyState(
      "No matching assessments",
      state.user.role === "student"
        ? "Published assessments will appear here."
        : "Create a draft or choose a different filter."
    );
    return;
  }
  list.innerHTML = visible
    .map((assessment) => {
      const duration =
        state.user.role === "student"
          ? assessment.effective_duration_minutes
          : assessment.duration_minutes;
      const due =
        state.user.role === "student" ? assessment.effective_due_at : assessment.due_at;
      return `
        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">${escapeHtml(assessment.course_id)}</p>
              <h2>${escapeHtml(assessment.title)}</h2>
            </div>
            ${status(assessment.status)}
          </div>
          <div class="facts">
            <span class="fact"><strong>${duration} min</strong>effective duration</span>
            <span class="fact"><strong>${escapeHtml(formatDate(assessment.opens_at))}</strong>opens</span>
            <span class="fact"><strong>${escapeHtml(formatDate(due))}</strong>effective due</span>
            <span class="fact"><strong>${assessment.item_count}</strong>questions</span>
            ${
              state.user.role === "student"
                ? `<span class="fact"><strong>${assessment.attempts_remaining} of ${assessment.max_attempts}</strong>attempts remaining</span>`
                : `<span class="fact"><strong>${assessment.max_attempts}</strong>attempt limit</span>`
            }
          </div>
          ${accommodationText(assessment)}
          <div class="actions">${assessmentActions(assessment)}</div>
        </article>
      `;
    })
    .join("");
}

function renderAttempts() {
  $("attempts-description").textContent =
    state.user.role === "student"
      ? "Your own attempts and submission state."
      : state.user.role === "teaching_assistant"
        ? "Submissions assigned to you."
        : "All submissions in your course.";
  const list = $("attempts-list");
  if (!state.attempts.length) {
    list.innerHTML = emptyState("No attempts", "There are no attempts in this view yet.");
    return;
  }
  list.innerHTML = state.attempts
    .map(
      (attempt) => `
        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">${escapeHtml(attempt.student.name)} · ${escapeHtml(attempt.id)}</p>
              <h2>${escapeHtml(attempt.assessment_title)}</h2>
            </div>
            ${status(attempt.status)}
          </div>
          <div class="facts">
            <span class="fact"><strong>${escapeHtml(formatDate(attempt.started_at))}</strong>started</span>
            <span class="fact"><strong>${escapeHtml(formatDate(attempt.expires_at))}</strong>effective expiry</span>
            <span class="fact"><strong>${attempt.effective_duration_minutes} min</strong>allowed time</span>
          </div>
          ${
            state.user.role === "student" && attempt.status === "in_progress"
              ? `<div class="actions"><button class="button primary small" data-open-attempt="${attempt.id}">Continue attempt</button></div>`
              : ""
          }
        </article>
      `
    )
    .join("");
}

function maxPoints(attempt) {
  return attempt.items.reduce((sum, item) => sum + Number(item.points), 0);
}

function renderGradebook() {
  $("gradebook-description").textContent =
    state.user.role === "student"
      ? "Scores and feedback appear only after release."
      : "Review scoring progress and release completed feedback.";
  const list = $("gradebook-list");
  const rows =
    state.user.role === "student"
      ? state.attempts.filter((attempt) => attempt.status !== "in_progress")
      : state.attempts.filter((attempt) => attempt.status !== "in_progress");
  if (!rows.length) {
    list.innerHTML = emptyState("No gradebook entries", "Submitted work will appear here.");
    return;
  }
  list.innerHTML = rows
    .map((attempt) => {
      const released = attempt.feedback_status === "released";
      const canGrade =
        state.user.role !== "student" &&
        !released &&
        attempt.items.some((item) => item.rubric.length);
      const canRelease =
        state.user.role === "instructor" && attempt.status === "graded" && !released;
      return `
        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">${escapeHtml(attempt.student.name)} · ${escapeHtml(attempt.id)}</p>
              <h2>${escapeHtml(attempt.assessment_title)}</h2>
              <p class="muted">${released ? "Feedback released" : "Feedback is still hidden"}</p>
            </div>
            <div class="grade-summary">
              ${status(attempt.status)}
              ${
                attempt.total_score == null
                  ? ""
                  : `<div class="score"><strong>${attempt.total_score}/${maxPoints(attempt)}</strong><span>total score</span></div>`
              }
            </div>
          </div>
          ${
            released && attempt.grades?.length
              ? `<div class="released-feedback" aria-label="Released rubric feedback">${attempt.grades
                  .map(
                    (grade) =>
                      `<p><strong>${escapeHtml(grade.label)}: ${grade.score}/${grade.max_points}</strong><span>${escapeHtml(grade.feedback || "No written feedback")}</span></p>`
                  )
                  .join("")}</div>`
              : ""
          }
          <div class="actions">
            ${
              canGrade
                ? `<button class="button secondary small" data-grade="${attempt.id}">Grade rubric</button>`
                : ""
            }
            ${
              canRelease
                ? `<button class="button primary small" data-release="${attempt.id}">Release feedback</button>`
                : ""
            }
            ${
              state.user.role === "student" && !released
                ? '<span class="muted">Your score will appear after release.</span>'
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAudit() {
  const list = $("audit-list");
  if (!state.audit.length) {
    list.innerHTML = emptyState(
      "No recorded activity",
      "Publishing, submission, grading, and release will be recorded here."
    );
    return;
  }
  list.innerHTML = state.audit
    .map(
      (event) => `
        <article class="timeline-item">
          <span class="timeline-dot" aria-hidden="true">◆</span>
          <div class="timeline-content">
            <h3>${escapeHtml(event.actor_name)} ${escapeHtml(event.action)} an ${escapeHtml(event.entity_type)}</h3>
            <p>${escapeHtml(event.details)}</p>
            <time datetime="${escapeHtml(event.created_at)}">${escapeHtml(formatDate(event.created_at))} · ${escapeHtml(roleLabel(event.actor_role))}</time>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAll() {
  renderCourses();
  renderAssessments();
  renderAttempts();
  renderGradebook();
  if (state.activeView === "audit") renderAudit();
}

async function refresh(message) {
  await loadWorkspace();
  if (message) notify(message);
}

function answerValue(attempt, itemId) {
  return attempt.answers.find((answer) => answer.item_id === itemId)?.value || "";
}

function openAttempt(attemptId) {
  const attempt = state.attempts.find((row) => row.id === attemptId);
  if (!attempt || attempt.status !== "in_progress") return;
  state.activeAttempt = attempt;
  $("attempt-title").textContent = `${attempt.assessment_title} · ${attempt.id}`;
  $("attempt-timer").textContent = `Due ${formatDate(attempt.expires_at)}`;
  $("attempt-form").elements.attempt_id.value = attempt.id;
  $("attempt-error").textContent = "";
  $("attempt-questions").innerHTML = attempt.items
    .map((item, index) => {
      const current = answerValue(attempt, item.id);
      const control =
        item.kind === "multiple_choice"
          ? item.options
              .map(
                (option) => `
                  <label class="radio-option">
                    <input type="radio" name="answer-${item.id}" value="${escapeHtml(option)}" ${
                      current === option ? "checked" : ""
                    } />
                    <span>${escapeHtml(option)}</span>
                  </label>
                `
              )
              .join("")
          : `<textarea name="answer-${item.id}" rows="4" placeholder="Write your response">${escapeHtml(current)}</textarea>`;
      return `
        <section class="question">
          <p class="question-number">Question ${index + 1} · ${item.points} points</p>
          <h3>${escapeHtml(item.prompt)}</h3>
          ${control}
        </section>
      `;
    })
    .join("");
  $("attempt-dialog").showModal();
}

function collectAnswers() {
  const form = new FormData($("attempt-form"));
  return state.activeAttempt.items.map((item) => ({
    item_id: item.id,
    value: form.get(`answer-${item.id}`) || "",
  }));
}

async function saveAnswers(showMessage = true) {
  const data = await mutate(
    `answers:${state.activeAttempt.id}`,
    `/api/attempts/${state.activeAttempt.id}/answers`,
    "PATCH",
    { answers: collectAnswers() }
  );
  if (!data) return null;
  state.activeAttempt = data.attempt;
  if (showMessage) notify("Answers saved.");
  return data;
}

function openItemDialog(assessmentId) {
  $("item-form").reset();
  $("item-form").elements.assessment_id.value = assessmentId;
  $("item-error").textContent = "";
  $("multiple-choice-fields").classList.remove("hidden");
  $("criterion-field").classList.add("hidden");
  $("item-dialog").showModal();
}

async function openItemsDialog(assessmentId) {
  const assessment = state.assessments.find((row) => row.id === assessmentId);
  const data = await api(`/api/assessments/${assessmentId}/items`);
  $("items-title").textContent = assessment?.title || "Questions";
  $("items-content").innerHTML = data.items.length
    ? data.items
        .map(
          (item, index) => `
            <article class="question">
              <p class="question-number">Question ${index + 1} · ${item.kind.replaceAll("_", " ")} · ${item.points} points</p>
              <h3>${escapeHtml(item.prompt)}</h3>
              ${item.options ? `<p class="muted">Options: ${item.options.map(escapeHtml).join(" · ")}</p>` : ""}
              ${item.answer ? `<p><strong>Stored key:</strong> ${escapeHtml(item.answer)}</p>` : ""}
              ${item.rubric.length ? `<p><strong>Rubric:</strong> ${item.rubric.map((row) => `${escapeHtml(row.label)} (${row.max_points})`).join(" · ")}</p>` : ""}
            </article>
          `
        )
        .join("")
    : emptyState("No questions yet", "Add a question before publishing this draft.");
  $("items-dialog").showModal();
}

function openGrade(attemptId) {
  const attempt = state.attempts.find((row) => row.id === attemptId);
  if (!attempt) return;
  state.activeGrade = attempt;
  $("grade-title").textContent = `${attempt.student.name} · ${attempt.assessment_title} · ${attempt.id}`;
  $("grade-error").textContent = "";
  const grades = new Map((attempt.grades || []).map((grade) => [grade.criterion_id, grade]));
  const answerMap = new Map(attempt.answers.map((answer) => [answer.item_id, answer.value]));
  const written = attempt.items.filter((item) => item.rubric.length);
  $("grade-content").innerHTML = written
    .map(
      (item) => `
        <section class="question">
          <p class="question-number">Written response</p>
          <h3>${escapeHtml(item.prompt)}</h3>
          <div class="response">${escapeHtml(answerMap.get(item.id) || "No response")}</div>
          ${item.rubric
            .map((criterion) => {
              const grade = grades.get(criterion.id);
              return `
                <div class="rubric-row">
                  <label>${escapeHtml(criterion.label)}<span class="hint"> · max ${criterion.max_points}</span></label>
                  <label>Score<input data-score="${criterion.id}" type="number" min="0" max="${criterion.max_points}" step="0.5" value="${grade?.score ?? ""}" /></label>
                  <label class="feedback-field">Feedback<input data-feedback="${criterion.id}" value="${escapeHtml(grade?.feedback || "")}" /></label>
                  <button class="button primary small" type="button" data-save-grade="${criterion.id}">Save</button>
                </div>
              `;
            })
            .join("")}
        </section>
      `
    )
    .join("");
  if (!$("grade-dialog").open) $("grade-dialog").showModal();
}

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("login-error").textContent = "";
  const form = new FormData(event.currentTarget);
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    state.token = data.token;
    sessionStorage.setItem(TOKEN_KEY, data.token);
    state.user = data.user;
    applyRevision(data.revision);
    const me = await api("/api/me");
    state.referenceMoment = me.reference_moment;
    showApp();
    await loadWorkspace();
    setView("courses");
  } catch (error) {
    $("login-error").textContent = error.message;
  }
});

document.querySelectorAll("[data-demo]").forEach((button) => {
  button.addEventListener("click", () => {
    $("login-email").value = button.dataset.demo;
    $("login-password").value = "Coursemark!2026";
    $("login-password").focus();
  });
});

$("logout").addEventListener("click", async () => {
  const userId = state.user?.id;
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    const message = { type: "account-signout", user_id: userId, nonce: operationId() };
    sessionChannel?.postMessage(message);
    try {
      localStorage.setItem(SESSION_EVENT_KEY, JSON.stringify(message));
    } catch {
      // The BroadcastChannel and next protected request remain authoritative.
    }
    clearSession();
  }
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      await api("/api/me", { trackRevision: false });
      setView(button.dataset.view);
    } catch (error) {
      if (error.status !== 401) notify(error.message, "error");
    }
  });
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.assessmentFilter = button.dataset.filter;
    renderAssessments();
  });
});

$("new-assessment").addEventListener("click", () => {
  $("assessment-form").reset();
  $("assessment-error").textContent = "";
  $("assessment-form").elements.opens_at.value = "2026-09-02T12:00";
  $("assessment-form").elements.due_at.value = "2026-09-03T17:00";
  $("assessment-dialog").showModal();
});

$("assessment-form").addEventListener(
  "invalid",
  () => {
    $("assessment-error").textContent = "Complete the required assessment fields before creating it.";
  },
  true
);

$("assessment-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const submitButton = event.submitter;
  const submitLabel = submitButton?.textContent;
  $("assessment-error").textContent = "";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Creating draft...";
  }
  try {
    const data = await mutate("create-assessment", "/api/assessments", "POST", {
        course_id: state.courses[0].id,
        title: form.get("title"),
        opens_at: new Date(form.get("opens_at")).toISOString(),
        due_at: new Date(form.get("due_at")).toISOString(),
        duration_minutes: Number(form.get("duration_minutes")),
        max_attempts: Number(form.get("max_attempts")),
    });
    if (!data) return;
    $("assessment-dialog").close();
    state.assessmentFilter = "draft";
    await refresh("Draft assessment created.");
  } catch (error) {
    $("assessment-error").textContent = error.message;
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = submitLabel;
    }
  }
});

$("item-form").elements.kind.addEventListener("change", (event) => {
  const written = event.target.value === "written";
  $("multiple-choice-fields").classList.toggle("hidden", written);
  $("criterion-field").classList.toggle("hidden", !written);
});

$("item-form").addEventListener(
  "invalid",
  () => {
    $("item-error").textContent = "Complete the required question fields before adding it.";
  },
  true
);

$("item-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const submitButton = event.submitter;
  const submitLabel = submitButton?.textContent;
  $("item-error").textContent = "";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Adding question...";
  }
  try {
    const data = await mutate(
      `add-item:${form.get("assessment_id")}`,
      `/api/assessments/${form.get("assessment_id")}/items`,
      "POST",
      {
        kind: form.get("kind"),
        prompt: form.get("prompt"),
        points: Number(form.get("points")),
        options: String(form.get("options") || "")
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        answer: form.get("answer"),
        criterion_label: form.get("criterion_label"),
      }
    );
    if (!data) return;
    $("item-dialog").close();
    await refresh("Question added to the draft.");
  } catch (error) {
    $("item-error").textContent = error.message;
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = submitLabel;
    }
  }
});

$("assessments-list").addEventListener("click", async (event) => {
  const reviewItems = event.target.closest("[data-review-items]");
  if (reviewItems) {
    try {
      await openItemsDialog(reviewItems.dataset.reviewItems);
    } catch (error) {
      notify(error.message, "error");
    }
    return;
  }
  const addItem = event.target.closest("[data-add-item]");
  if (addItem) return openItemDialog(addItem.dataset.addItem);
  const publish = event.target.closest("[data-publish]");
  if (publish) {
    publish.disabled = true;
    try {
      const data = await mutate(
        `publish:${publish.dataset.publish}`,
        `/api/assessments/${publish.dataset.publish}/publish`,
        "POST"
      );
      if (!data) return;
      await refresh("Assessment published.");
    } catch (error) {
      notify(error.message, "error");
      publish.disabled = false;
    }
    return;
  }
  const start = event.target.closest("[data-start]");
  if (start) {
    start.disabled = true;
    try {
      const data = await mutate(
        `start:${start.dataset.start}`,
        `/api/assessments/${start.dataset.start}/start`,
        "POST"
      );
      if (!data) return;
      await loadWorkspace();
      openAttempt(data.attempt.id);
    } catch (error) {
      notify(error.message, "error");
      start.disabled = false;
    }
  }
  const open = event.target.closest("[data-open-attempt]");
  if (open) openAttempt(open.dataset.openAttempt);
});

$("attempts-list").addEventListener("click", (event) => {
  const open = event.target.closest("[data-open-attempt]");
  if (open) openAttempt(open.dataset.openAttempt);
});

$("save-answers").addEventListener("click", async () => {
  const button = $("save-answers");
  const label = button.textContent;
  $("attempt-error").textContent = "";
  button.disabled = true;
  button.textContent = "Saving answers...";
  try {
    await saveAnswers();
    await loadWorkspace();
  } catch (error) {
    $("attempt-error").textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
});

$("attempt-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter;
  const submitLabel = submitButton?.textContent;
  $("attempt-error").textContent = "";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Submitting attempt...";
  }
  try {
    const submitted = await mutate(
      `submit:${state.activeAttempt.id}`,
      `/api/attempts/${state.activeAttempt.id}/submit`,
      "POST",
      { answers: collectAnswers() }
    );
    if (!submitted) return;
    $("attempt-dialog").close();
    await refresh("Attempt submitted. Your score stays hidden until release.");
  } catch (error) {
    $("attempt-error").textContent = error.message;
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = submitLabel;
    }
  }
});

$("gradebook-list").addEventListener("click", async (event) => {
  const grade = event.target.closest("[data-grade]");
  if (grade) return openGrade(grade.dataset.grade);
  const release = event.target.closest("[data-release]");
  if (!release) return;
  release.disabled = true;
  try {
    const data = await mutate(
      `release:${release.dataset.release}`,
      `/api/attempts/${release.dataset.release}/release`,
      "POST"
    );
    if (!data) return;
    await refresh("Feedback released to the student.");
  } catch (error) {
    notify(error.message, "error");
    release.disabled = false;
  }
});

$("grade-content").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-save-grade]");
  if (!button) return;
  const criterionId = button.dataset.saveGrade;
  const scoreInput = $(`grade-content`).querySelector(`[data-score="${criterionId}"]`);
  const score = scoreInput.value;
  const feedback = $(`grade-content`).querySelector(
    `[data-feedback="${criterionId}"]`
  ).value;
  $("grade-error").textContent = "";
  const numericScore = Number(score);
  const maximum = Number(scoreInput.max);
  if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > maximum) {
    scoreInput.setCustomValidity(`Enter a score from 0 to ${maximum}.`);
    scoreInput.reportValidity();
    $("grade-error").textContent = `Score must be from 0 to ${maximum}. Nothing was saved.`;
    return;
  }
  scoreInput.setCustomValidity("");
  button.disabled = true;
  try {
    const data = await mutate(
      `grade:${state.activeGrade.id}:${criterionId}`,
      `/api/attempts/${state.activeGrade.id}/grades/${criterionId}`,
      "PUT",
      { score: numericScore, feedback }
    );
    if (!data) return;
    state.activeGrade = data.attempt;
    notify("Rubric score saved.");
    await loadWorkspace();
    openGrade(state.activeGrade.id);
  } catch (error) {
    $("grade-error").textContent = error.message;
    button.disabled = false;
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const me = await api("/api/me");
    state.user = me.user;
    state.referenceMoment = me.reference_moment;
    showApp();
    await loadWorkspace();
    setView("courses");
  } catch {
    showLogin();
  }
});

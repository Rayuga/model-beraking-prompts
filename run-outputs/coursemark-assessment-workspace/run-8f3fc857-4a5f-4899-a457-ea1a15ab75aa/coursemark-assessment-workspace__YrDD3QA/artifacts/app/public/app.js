const app = document.getElementById('app');
const modal = document.getElementById('modal');

const state = {
  token: localStorage.getItem('coursemark_token') || '',
  user: null,
  workspace: null,
  view: 'courses',
  message: 'Ready.',
  messageKind: 'info',
  lastTrigger: null,
  modal: null,
  refreshing: false,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeText(value) {
  return escapeHtml(value ?? '');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date) + ' UTC';
}

function fmtNumber(value, digits = 2) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function viewLabel(view) {
  return ({
    courses: 'Courses',
    assessments: 'Assessments',
    attempts: 'Attempts',
    gradebook: 'Gradebook',
    audit: 'Audit',
  })[view] || view;
}

function badge(label, cls) {
  return `<span class="badge ${cls}">${safeText(label)}</span>`;
}

function currentRevision() {
  return state.workspace?.course?.revision ?? 0;
}

function setMessage(message, kind = 'info') {
  state.message = message;
  state.messageKind = kind;
  const live = document.getElementById('status-live');
  if (live) live.textContent = message;
}

function showLogin(message = 'Sign in to continue.') {
  if (modal.open) closeModal();
  state.user = null;
  state.workspace = null;
  state.view = 'courses';
  state.message = message;
  state.messageKind = 'info';
  render();
}

function saveToken(token) {
  state.token = token;
  localStorage.setItem('coursemark_token', token);
}

function clearToken() {
  state.token = '';
  localStorage.removeItem('coursemark_token');
}

function operationId() {
  return crypto.randomUUID();
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.token && options.auth !== false) {
    headers.set('Authorization', `Bearer ${state.token}`);
  }
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.write) {
    headers.set('X-Operation-Id', options.operationId || operationId());
    if (!options.signIn) headers.set('X-Coursemark-Revision', String(currentRevision()));
  } else if (options.signIn) {
    headers.set('X-Operation-Id', options.operationId || operationId());
  }
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, error: { code: 'bad_json', message: text } };
    }
  }
  if (!response.ok) {
    const error = new Error(data?.error?.message || response.statusText || 'Request failed.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function actionBusy(button, fn) {
  const target = button instanceof HTMLElement ? button : null;
  if (target) target.disabled = true;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (target) target.disabled = false;
    });
}

function openModal(html) {
  state.lastTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.innerHTML = `<div class="modal-inner"><div class="modal-head">${html.head}<button type="button" class="ghost" data-action="close-modal">Close</button></div><div class="modal-content">${html.body}</div></div>`;
  modal.showModal();
  const focusTarget = modal.querySelector('[data-focus="true"]') || modal.querySelector('button, input, select, textarea');
  if (focusTarget) focusTarget.focus();
}

function closeModal() {
  if (modal.open) modal.close();
  modal.innerHTML = '';
  const trigger = state.lastTrigger;
  state.lastTrigger = null;
  if (trigger && typeof trigger.focus === 'function') trigger.focus();
  state.modal = null;
}

function render(options = {}) {
  const preserveModal = Boolean(options.preserveModal);
  if (!state.token || !state.user) {
    app.innerHTML = renderLogin();
    setMessage(state.message || 'Sign in to continue.');
    return;
  }

  const ws = state.workspace;
  const nav = ['courses', 'assessments', 'attempts', 'gradebook', 'audit'];
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="topbar-inner">
          <div class="branding">
            <div>
              <h1>Coursemark</h1>
              <div class="helper">BIO-214 · Ecology and Field Methods</div>
            </div>
            <div class="row">
              <button type="button" class="ghost" data-action="refresh">Refresh</button>
              <button type="button" class="danger" data-action="sign-out">Sign out</button>
            </div>
          </div>
          <div class="meta-row">
            <span class="pill"><strong>${safeText(state.user.name)}</strong> · ${safeText(state.user.email)} · ${safeText(state.user.role.replaceAll('_', ' '))}</span>
            <span class="pill">Reference time: ${safeText(fmtDate(ws?.course?.referenceMoment || '2026-09-02T12:00:00Z'))}</span>
            <span class="pill">Revision: ${safeText(String(ws?.course?.revision ?? 0))}</span>
          </div>
          <nav class="nav" aria-label="Workspace navigation">
            ${nav.map(view => `<button type="button" data-view="${view}" ${state.view === view ? 'aria-current="page"' : ''}>${viewLabel(view)}</button>`).join('')}
          </nav>
          <div class="statusbar">
            <strong>Current identity:</strong>
            <span>${safeText(state.user.name)} (${safeText(state.user.role.replaceAll('_', ' '))})</span>
            <span class="status-live" id="status-live" role="status" aria-live="polite">${safeText(state.message)}</span>
          </div>
        </div>
      </header>
      <main id="main" class="main" tabindex="-1">
        <section class="view ${state.view === 'courses' ? '' : 'hidden'}" data-view-panel="courses">${renderCoursesView(ws)}</section>
        <section class="view ${state.view === 'assessments' ? '' : 'hidden'}" data-view-panel="assessments">${renderAssessmentsView(ws)}</section>
        <section class="view ${state.view === 'attempts' ? '' : 'hidden'}" data-view-panel="attempts">${renderAttemptsView(ws)}</section>
        <section class="view ${state.view === 'gradebook' ? '' : 'hidden'}" data-view-panel="gradebook">${renderGradebookView(ws)}</section>
        <section class="view ${state.view === 'audit' ? '' : 'hidden'}" data-view-panel="audit">${renderAuditView(ws)}</section>
      </main>
    </div>
  `;
  if (state.modal && !preserveModal) renderModal();
  syncLiveRegion();
}

function renderLogin() {
  return `
    <main id="main" class="main" tabindex="-1">
      <section class="card grid two">
        <div class="stack">
          <div>
            <h1 class="heading">Coursemark sign in</h1>
            <p class="subheading">Use the demo account below. All sessions live on the local server and reloads restore the same course state.</p>
          </div>
          <form data-form="sign-in" id="sign-in-form">
            <label>
              Email
              <input name="email" type="email" autocomplete="email" required value="ada.mensah@coursemark.example" />
            </label>
            <label>
              Password
              <input name="password" type="password" autocomplete="current-password" required value="Coursemark!2026" />
            </label>
            <button class="primary" type="submit">Sign in</button>
          </form>
          <div class="helper">Bad passwords are rejected visibly. Sign out revokes every active session for the account.</div>
        </div>
        <aside class="card stack">
          <h2 class="heading">Demo accounts</h2>
          <div class="compact">
            <div><strong>Ada Mensah</strong> — ada.mensah@coursemark.example — instructor</div>
            <div><strong>Luis Ortega</strong> — luis.ortega@coursemark.example — teaching assistant</div>
            <div><strong>Nora Kim</strong> — nora.kim@coursemark.example — student</div>
            <div><strong>Ben Okafor</strong> — ben.okafor@coursemark.example — student</div>
          </div>
          <div class="helper">Shared password: <strong>Coursemark!2026</strong></div>
        </aside>
      </section>
      <div class="status-live" role="status" aria-live="polite">${safeText(state.message)}</div>
    </main>
  `;
}

function renderCoursesView(ws) {
  if (!ws) return emptyState('No workspace available.');
  const course = ws.course;
  return `
    <section class="section-card stack">
      <div class="space-between">
        <div>
          <h2 class="heading">Course</h2>
          <p class="subheading">The local workspace for BIO-214 keeps assessments, attempts, grading and release work together.</p>
        </div>
        ${badge(course.revision >= 0 ? 'Live' : 'Offline', 'ok')}
      </div>
      <div class="grid two">
        <div class="card stack">
          <h3 class="heading">${safeText(course.title)}</h3>
          <div class="metrics">
            <span><strong>Course ID:</strong> ${safeText(course.id)}</span>
            <span><strong>Instructor:</strong> ${safeText(ws.user.role === 'instructor' ? ws.user.name : 'Ada Mensah')}</span>
            <span><strong>Reference moment:</strong> ${safeText(fmtDate(course.referenceMoment))}</span>
            <span><strong>Revision:</strong> ${safeText(String(course.revision))}</span>
          </div>
          <p class="helper">Authentication is real and token-backed. A later sign-in restores your server-side work, while sign-out revokes every session for the account.</p>
        </div>
        <div class="card stack">
          <h3 class="heading">Identity and sync</h3>
          <div class="compact">
            <div><strong>Name:</strong> ${safeText(ws.user.name)}</div>
            <div><strong>Email:</strong> ${safeText(ws.user.email)}</div>
            <div><strong>Role:</strong> ${safeText(ws.user.role.replaceAll('_', ' '))}</div>
            <div><strong>Sync:</strong> state lives in SQLite and all accepted writes are revisioned.</div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderAssessmentsView(ws) {
  if (!ws) return emptyState('No assessments available.');
  const canAuthor = ws.permissions.canAuthorAssessments;
  return `
    <section class="section-card stack">
      <div class="space-between">
        <div>
          <h2 class="heading">Assessments</h2>
          <p class="subheading">Staff can inspect drafts and author new questions. Students see only published assessments.</p>
        </div>
        <div class="row">
          <span class="pill">${badge(canAuthor ? 'Instructor authoring' : 'Read-only', canAuthor ? 'ok' : 'unweighted')}</span>
        </div>
      </div>
      ${canAuthor ? renderAssessmentCreateForm() : ''}
      <div class="cards ${ws.assessments.length > 1 ? 'two' : ''}">
        ${ws.assessments.map(assessment => renderAssessmentCard(assessment, ws.user, ws.permissions)).join('') || emptyCard('No assessments yet.')}
      </div>
    </section>
  `;
}

function renderAssessmentCreateForm() {
  return `
    <div class="card stack">
      <h3 class="heading">Create draft assessment</h3>
      <p class="helper">Opening and due times are interpreted as UTC. Duration and attempt limits must be positive whole minutes and attempts.</p>
      <form data-form="create-assessment" id="create-assessment-form">
        <div class="grid two">
          <label>Title <input name="title" required placeholder="e.g. Stream ecology quiz" /></label>
          <label>Attempts allowed <input name="maxAttempts" type="number" min="1" step="1" required value="1" /></label>
        </div>
        <div class="grid two">
          <label>Opens at <input name="opensAt" type="datetime-local" required /></label>
          <label>Due at <input name="dueAt" type="datetime-local" required /></label>
        </div>
        <div class="grid two">
          <label>Duration (minutes) <input name="durationMinutes" type="number" min="1" step="1" required value="30" /></label>
          <div class="helper">UTC timezone only. Seed times use UTC.</div>
        </div>
        <button class="primary" type="submit">Create draft</button>
      </form>
    </div>
  `;
}

function renderAssessmentCard(assessment, user, permissions) {
  return `
    <article class="list-item">
      <header>
        <div class="stack">
          <div class="row">
            <h3>${safeText(assessment.title)}</h3>
            ${badge(assessment.status, assessment.status)}
          </div>
          <div class="metrics">
            <span><strong>ID:</strong> ${safeText(assessment.id)}</span>
            <span><strong>Opens:</strong> ${safeText(fmtDate(assessment.opensAt))}</span>
            <span><strong>Due:</strong> ${safeText(fmtDate(assessment.dueAt))}</span>
            <span><strong>Duration:</strong> ${safeText(String(assessment.durationMinutes))} min</span>
            <span><strong>Attempts:</strong> ${safeText(String(assessment.maxAttempts))}</span>
            <span><strong>Weight:</strong> ${assessment.weightPct === null ? 'draft' : `${fmtNumber(assessment.weightPct, 2)}%`}</span>
          </div>
        </div>
        <div class="actions">
          <button type="button" data-action="open-assessment" data-id="${safeText(assessment.id)}">Details</button>
          ${user.role === 'student' ? renderStudentAssessmentAction(assessment) : ''}
          ${permissions.canAuthorAssessments && assessment.status === 'draft' ? `<button type="button" class="primary" data-action="publish-assessment" data-id="${safeText(assessment.id)}">Publish</button>` : ''}
          ${permissions.canAuthorAssessments && assessment.status === 'draft' ? `<button type="button" data-action="open-add-question" data-id="${safeText(assessment.id)}">Add question</button>` : ''}
        </div>
      </header>
      <div class="compact small">
        <div>Question count: <strong>${safeText(String(assessment.itemCount))}</strong></div>
      </div>
    </article>
  `;
}

function renderStudentAssessmentAction(assessment) {
  if (assessment.status !== 'published') return '';
  const inProgress = (state.workspace.attempts || []).find(attempt => attempt.assessmentId === assessment.id && attempt.status === 'in_progress');
  const label = inProgress ? 'Resume attempt' : 'Start attempt';
  const action = inProgress ? 'open-attempt' : 'start-assessment';
  const id = inProgress ? inProgress.id : assessment.id;
  return `<button type="button" class="primary" data-action="${action}" data-id="${safeText(id)}">${safeText(label)}</button>`;
}

function renderAttemptsView(ws) {
  if (!ws) return emptyState('No attempts available.');
  const attempts = ws.attempts || [];
  return `
    <section class="section-card stack">
      <div class="space-between">
        <div>
          <h2 class="heading">Attempts</h2>
          <p class="subheading">Timed attempts respect accommodations, expiration, submission, and private feedback release.</p>
        </div>
        <span class="pill">${badge(ws.permissions.canGrade ? 'Grading enabled' : 'Student workspace', ws.permissions.canGrade ? 'ok' : 'unweighted')}</span>
      </div>
      <div class="list">
        ${attempts.map(attempt => renderAttemptCard(attempt, ws.user)).join('') || emptyCard('No attempts to show.').replace('list-item', '')}
      </div>
    </section>
  `;
}

function renderAttemptCard(attempt, user) {
  const canGrade = user.role === 'instructor' || user.role === 'teaching_assistant';
  const canEdit = user.role === 'student' && attempt.studentId === user.id && attempt.status === 'in_progress';
  const openButton = canEdit
    ? `<button type="button" class="primary" data-action="open-attempt" data-id="${safeText(attempt.id)}">Resume</button>`
    : `<button type="button" data-action="open-attempt" data-id="${safeText(attempt.id)}">Open</button>`;
  const gradeButton = canGrade && attempt.feedbackStatus !== 'released' && attempt.status !== 'in_progress'
    ? `<button type="button" class="primary" data-action="grade-attempt" data-id="${safeText(attempt.id)}">Grade</button>`
    : '';
  return `
    <article class="list-item">
      <header>
        <div class="stack">
          <div class="row">
            <h3>${safeText(attempt.assessmentTitle)}</h3>
            ${badge(attempt.status, attempt.status)}
            ${badge(attempt.feedbackStatus, attempt.feedbackStatus)}
          </div>
          <div class="metrics">
            <span><strong>ID:</strong> ${safeText(attempt.id)}</span>
            <span><strong>Student:</strong> ${safeText(attempt.studentName || attempt.studentId)}</span>
            <span><strong>Started:</strong> ${safeText(fmtDate(attempt.startedAt))}</span>
            <span><strong>Submitted:</strong> ${safeText(fmtDate(attempt.submittedAt))}</span>
            <span><strong>Expires:</strong> ${safeText(fmtDate(attempt.expiresAt))}</span>
          </div>
        </div>
        <div class="actions">
          ${openButton}
          ${gradeButton}
          ${canGrade && attempt.feedbackStatus !== 'released' && attempt.status === 'graded' ? `<button type="button" data-action="release-attempt" data-id="${safeText(attempt.id)}">Release</button>` : ''}
        </div>
      </header>
      <div class="compact small">
        <div><strong>Objective score:</strong> ${attempt.objectiveScore === null ? 'private' : fmtNumber(attempt.objectiveScore, 0)}</div>
        <div><strong>Rubric score:</strong> ${attempt.rubricScore === null ? 'private' : fmtNumber(attempt.rubricScore, 0)}</div>
        <div><strong>Total:</strong> ${attempt.totalScore === null ? 'private' : fmtNumber(attempt.totalScore, 0)}</div>
      </div>
    </article>
  `;
}

function renderGradebookView(ws) {
  if (!ws) return emptyState('No gradebook available.');
  if (ws.user.role === 'teaching_assistant') return renderTAGradebook(ws);
  if (ws.user.role === 'student') return renderStudentGradebook(ws);
  return renderInstructorGradebook(ws);
}

function renderInstructorGradebook(ws) {
  const publishedAssessments = ws.assessments.filter(a => a.status === 'published');
  const assignable = ws.attempts.filter(attempt => attempt.feedbackStatus !== 'released' && attempt.status !== 'in_progress');
  return `
    <section class="section-card stack">
      <div>
        <h2 class="heading">Gradebook</h2>
        <p class="subheading">Weighted outcome ledger, policy editing, exceptions, grading worksheet, and reviewed batch release.</p>
      </div>
      ${renderPolicyCard(ws, publishedAssessments)}
      ${renderExceptionCard(ws)}
      <div class="grid two">
        <div class="card stack">
          <h3 class="heading">Atomic grading worksheet</h3>
          <p class="helper">Open a submitted, unreleased attempt to save one or more rubric rows together.</p>
          <div class="list">
            ${assignable.map(attempt => renderQueueAttemptCard(attempt, true)).join('') || emptyCard('No submitted attempts require grading.').replace('list-item', '')}
          </div>
        </div>
        <div class="card stack">
          <h3 class="heading">Reviewed batch release</h3>
          <p class="helper">Select fully graded, unreleased attempts and preview the reviewed release batch.</p>
          <div class="stack">
            ${assignable.filter(a => a.status === 'graded').map(attempt => `
              <label class="row" style="align-items:flex-start;">
                <input type="checkbox" name="release-selection" value="${safeText(attempt.id)}" />
                <span>
                  <strong>${safeText(attempt.assessmentTitle)}</strong><br />
                  ${safeText(attempt.studentName)} · ${safeText(attempt.id)} · total ${attempt.totalScore === null ? 'private' : fmtNumber(attempt.totalScore, 0)}
                </span>
              </label>
            `).join('') || '<div class="helper">No graded attempts are ready for batch release.</div>'}
            <button type="button" class="primary" data-action="preview-release">Preview release batch</button>
          </div>
        </div>
      </div>
      <div class="cards ${ws.gradebook.length > 1 ? 'two' : ''}">
        ${ws.gradebook.map(row => renderOutcomeCard(row)).join('') || emptyCard('No outcome rows available.').replace('list-item', '')}
      </div>
    </section>
  `;
}

function renderTAGradebook(ws) {
  return `
    <section class="section-card stack">
      <div>
        <h2 class="heading">Assigned grading queue</h2>
        <p class="subheading">The teaching assistant sees only assigned submissions and can grade them with the shared worksheet.</p>
      </div>
      <div class="list">
        ${ws.gradebook.map(attempt => renderQueueAttemptCard(attempt, false)).join('') || emptyCard('No assigned submissions are ready.').replace('list-item', '')}
      </div>
    </section>
  `;
}

function renderStudentGradebook(ws) {
  const row = ws.gradebook[0];
  if (!row) return emptyState('No personal outcome row yet.');
  return `
    <section class="section-card stack">
      <div>
        <h2 class="heading">My outcomes</h2>
        <p class="subheading">Students see only their own row, explanation, and policy. Unreleased awarded values stay absent or null.</p>
      </div>
      ${renderOutcomeCard(row, true)}
      <div class="card stack">
        <h3 class="heading">Policy</h3>
        <div class="compact">
          ${ws.outcomePolicy.map(row => `<div>${safeText(row.assessmentId)} — ${fmtNumber(row.weightPct, 2)}%</div>`).join('') || '<div class="helper">No published weights yet.</div>'}
        </div>
      </div>
    </section>
  `;
}

function renderPolicyCard(ws, publishedAssessments) {
  return `
    <div class="card stack">
      <h3 class="heading">Weighted outcome ledger</h3>
      <p class="helper">Published assessments must appear exactly once. Weights must total 100.00%.</p>
      <form data-form="save-policy" id="policy-form">
        <div class="stack">
          ${publishedAssessments.map(assessment => {
            const existing = ws.outcomePolicy.find(row => row.assessmentId === assessment.id);
            const weight = existing ? existing.weightPct : 0;
            return `<label>
              ${safeText(assessment.title)} (${safeText(assessment.id)})
              <input name="weight-${safeText(assessment.id)}" type="number" min="0" step="0.01" value="${safeText(String(weight))}" />
            </label>`;
          }).join('')}
        </div>
        <button class="primary" type="submit">Save policy</button>
      </form>
    </div>
  `;
}

function renderExceptionCard(ws) {
  const students = ws.gradebook.map(row => row.studentId ? row : null).filter(Boolean);
  const assessments = ws.assessments.filter(a => a.status === 'published');
  return `
    <div class="card stack">
      <h3 class="heading">Exceptions</h3>
      <p class="helper">Excusing a published assessment removes it from the denominator without deleting attempts or grades.</p>
      <form data-form="save-exception" id="exception-form">
        <div class="grid two">
          <label>
            Student
            <select name="studentId" required>
              <option value="">Choose student</option>
              ${students.map(student => `<option value="${safeText(student.studentId)}">${safeText(student.studentName)} (${safeText(student.studentEmail)})</option>`).join('')}
            </select>
          </label>
          <label>
            Assessment
            <select name="assessmentId" required>
              <option value="">Choose assessment</option>
              ${assessments.map(assessment => `<option value="${safeText(assessment.id)}">${safeText(assessment.title)} (${safeText(assessment.id)})</option>`).join('')}
            </select>
          </label>
        </div>
        <label>
          Reason
          <textarea name="reason" placeholder="Required when excusing an assessment."></textarea>
        </label>
        <label class="row"><input type="checkbox" name="excused" value="1" /> Excuse this assessment for the selected student</label>
        <button class="primary" type="submit">Save exception</button>
      </form>
    </div>
  `;
}

function renderOutcomeCard(row, studentView = false) {
  return `
    <article class="list-item">
      <header>
        <div>
          <h3>${safeText(row.studentName)}</h3>
          <div class="metrics">
            <span><strong>Email:</strong> ${safeText(row.studentEmail)}</span>
            <span><strong>Available total:</strong> ${safeText(fmtNumber(row.availableTotal, 2))}%</span>
            <span><strong>Status:</strong> ${safeText(row.finalStatus)}</span>
          </div>
        </div>
        ${badge(row.finalStatus, row.finalStatus === 'calculated' ? 'ok' : row.finalStatus === 'pending' ? 'warn' : 'unweighted')}
      </header>
      <p class="helper">${safeText(row.explanation)}</p>
      <div class="stack">
        ${row.assessments.map(cell => `
          <div class="row" style="align-items:flex-start;">
            <div style="min-width: 220px; flex: 1 1 220px;">
              <strong>${safeText(cell.assessmentTitle)}</strong><br />
              <span class="helper">${safeText(cell.assessmentId)} · weight ${fmtNumber(cell.weightPct, 2)}%</span>
            </div>
            <div>${badge(cell.state, cell.state)}</div>
            <div class="helper">${cell.state === 'released' ? `${fmtNumber(cell.score, 0)} / ${fmtNumber(cell.maxPoints, 0)}` : cell.state === 'excused' ? 'Excused from denominator' : cell.state === 'unweighted' ? 'Unweighted' : 'Pending privacy'}</div>
          </div>
        `).join('')}
      </div>
      ${studentView && row.finalPercentage !== null ? `<div class="row"><strong>Final percentage:</strong> ${fmtNumber(row.finalPercentage, 2)}%</div>` : ''}
    </article>
  `;
}

function renderQueueAttemptCard(attempt, instructorPreview) {
  return `
    <article class="list-item">
      <header>
        <div class="stack">
          <div class="row">
            <h4>${safeText(attempt.assessmentTitle)}</h4>
            ${badge(attempt.status, attempt.status)}
            ${badge(attempt.feedbackStatus, attempt.feedbackStatus)}
          </div>
          <div class="metrics">
            <span><strong>Student:</strong> ${safeText(attempt.studentName)}</span>
            <span><strong>Attempt:</strong> ${safeText(attempt.id)}</span>
            <span><strong>Submitted:</strong> ${safeText(fmtDate(attempt.submittedAt))}</span>
            <span><strong>Total:</strong> ${attempt.totalScore === null ? 'private' : fmtNumber(attempt.totalScore, 0)}</span>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="primary" data-action="grade-attempt" data-id="${safeText(attempt.id)}">Open worksheet</button>
          ${instructorPreview && attempt.status === 'graded' && attempt.feedbackStatus !== 'released' ? `<button type="button" data-action="release-attempt" data-id="${safeText(attempt.id)}">Release</button>` : ''}
        </div>
      </header>
    </article>
  `;
}

function renderAuditView(ws) {
  if (!ws) return emptyState('No audit entries.');
  return `
    <section class="section-card stack">
      <div>
        <h2 class="heading">Audit</h2>
        <p class="subheading">Newest first. Visibility is filtered by role and assignment.</p>
      </div>
      <div class="list">
        ${ws.audit.map(event => `
          <article class="list-item">
            <header>
              <div class="stack">
                <div class="row">
                  <strong>${safeText(event.summary)}</strong>
                  ${badge(event.eventType, 'unweighted')}
                </div>
                <div class="metrics">
                  <span><strong>Target:</strong> ${safeText(event.targetType)} ${safeText(event.targetId)}</span>
                  <span><strong>Actor:</strong> ${safeText(event.actorUserId)} · ${safeText(event.actorRole)}</span>
                  <span><strong>Time:</strong> ${safeText(fmtDate(event.createdAt))}</span>
                </div>
              </div>
            </header>
          </article>
        `).join('') || emptyCard('No audit entries are visible for this role.').replace('list-item', '')}
      </div>
    </section>
  `;
}

function emptyCard(text) {
  return `<article class="list-item"><div class="helper">${safeText(text)}</div></article>`;
}

function emptyState(text) {
  return `<section class="section-card"><div class="helper">${safeText(text)}</div></section>`;
}

function syncLiveRegion() {
  const live = document.getElementById('status-live');
  if (live) live.textContent = state.message;
}

function assessmentById(id) {
  return state.workspace?.assessments?.find(item => item.id === id) || null;
}

function attemptById(id) {
  return state.workspace?.attempts?.find(item => item.id === id) || null;
}

function getAttemptData(id) {
  const attempt = attemptById(id);
  if (attempt) return attempt;
  const fromGradebook = state.workspace?.gradebook?.find(row => row.id === id || row.attemptId === id);
  return fromGradebook || null;
}

function openAssessmentModal(id) {
  const assessment = assessmentById(id);
  if (!assessment) return setMessage('Assessment not found.', 'error');
  state.modal = { type: 'assessment', id };
  renderModal();
}

function openAttemptModal(id) {
  const attempt = attemptById(id) || state.workspace?.attempts?.find(a => a.id === id) || null;
  if (!attempt) return setMessage('Attempt not found.', 'error');
  state.modal = { type: 'attempt', id };
  renderModal();
}

function renderModal() {
  if (!state.modal) return;
  const { type, id } = state.modal;
  let head = '';
  let body = '';
  if (type === 'assessment') {
    const assessment = assessmentById(id);
    head = `<h2 id="modal-title" class="heading">${safeText(assessment.title)}</h2>`;
    body = renderAssessmentModalBody(assessment);
  } else if (type === 'attempt') {
    const attempt = getAttemptData(id) || attemptById(id);
    head = `<h2 id="modal-title" class="heading">${safeText(attempt.assessmentTitle)} · ${safeText(attempt.id)}</h2>`;
    body = renderAttemptModalBody(attempt);
  } else if (type === 'preview') {
    head = `<h2 id="modal-title" class="heading">Reviewed batch release</h2>`;
    body = renderPreviewModalBody();
  }
  openModal({ head, body });
}

function renderAssessmentModalBody(assessment) {
  const items = assessment.items || [];
  const canAuthor = state.user?.role === 'instructor' && assessment.status === 'draft';
  return `
    <div class="stack">
      <div class="metrics">
        <span><strong>ID:</strong> ${safeText(assessment.id)}</span>
        <span><strong>Status:</strong> ${safeText(assessment.status)}</span>
        <span><strong>Weight:</strong> ${assessment.weightPct === null ? 'draft' : `${fmtNumber(assessment.weightPct, 2)}%`}</span>
      </div>
      <div class="assessment-items">
        ${items.map(item => renderAssessmentItem(item, assessment)).join('')}
      </div>
      ${canAuthor ? renderAddQuestionForm(assessment) : ''}
    </div>
  `;
}

function renderAssessmentItem(item, assessment) {
  return `
    <div class="item-card">
      <div class="row">
        <strong>${safeText(item.prompt)}</strong>
        <span class="badge ${item.kind === 'multiple_choice' ? 'published' : 'draft'}">${safeText(item.kind.replace('_', ' '))}</span>
      </div>
      <div><strong>Points:</strong> ${safeText(fmtNumber(item.points, 0))}</div>
      ${item.kind === 'multiple_choice' ? `<ul class="option-list">${item.options.map(option => `<li>${safeText(option)}</li>`).join('')}</ul>` : ''}
      ${state.user?.role !== 'student' && item.answer ? `<div class="helper"><strong>Answer key:</strong> ${safeText(item.answer)}</div>` : ''}
      ${state.user?.role !== 'student' && item.criteria ? `<div class="helper"><strong>Rubric:</strong> ${item.criteria.map(c => `${safeText(c.label)} (${safeText(fmtNumber(c.maxPoints, 0))})`).join('; ')}</div>` : ''}
    </div>
  `;
}

function renderAddQuestionForm(assessment) {
  return `
    <div class="card stack">
      <h3 class="heading">Add question to draft</h3>
      <form data-form="add-question" data-assessment-id="${safeText(assessment.id)}" id="add-question-form">
        <div class="grid two">
          <label>
            Kind
            <select name="kind" required data-focus="true">
              <option value="multiple_choice">Multiple choice</option>
              <option value="written">Written</option>
            </select>
          </label>
          <label>
            Points
            <input name="points" type="number" min="0.01" step="0.01" required value="1" />
          </label>
        </div>
        <label>
          Prompt
          <textarea name="prompt" required></textarea>
        </label>
        <label>
          Options, one per line
          <textarea name="options" placeholder="Only for multiple choice."></textarea>
        </label>
        <label>
          Answer key
          <input name="answer" placeholder="Only for multiple choice." />
        </label>
        <label>
          Written rubric criteria as label|maxPoints, one per line
          <textarea name="criteria" placeholder="Only for written questions. Example: Identifies bias|3"></textarea>
        </label>
        <button class="primary" type="submit">Add question</button>
      </form>
    </div>
  `;
}

function renderAttemptModalBody(attempt) {
  if (!attempt) return '<div class="helper">Attempt unavailable.</div>';
  const canStudentEdit = state.user.role === 'student' && attempt.studentId === state.user.id && attempt.status === 'in_progress';
  const canGrade = (state.user.role === 'instructor' || state.user.role === 'teaching_assistant') && attempt.feedbackStatus !== 'released' && attempt.status !== 'in_progress';
  const canRelease = state.user.role === 'instructor' && attempt.status === 'graded' && attempt.feedbackStatus !== 'released';
  return `
    <div class="stack">
      <div class="metrics">
        <span><strong>Status:</strong> ${safeText(attempt.status)}</span>
        <span><strong>Feedback:</strong> ${safeText(attempt.feedbackStatus)}</span>
        <span><strong>Started:</strong> ${safeText(fmtDate(attempt.startedAt))}</span>
        <span><strong>Expires:</strong> ${safeText(fmtDate(attempt.expiresAt))}</span>
      </div>
      <div class="attempt-items">
        ${attempt.items.map(item => renderAttemptItem(item, attempt, canStudentEdit)).join('')}
      </div>
      ${canStudentEdit ? `<div class="row"><button type="button" class="primary" data-action="submit-attempt" data-id="${safeText(attempt.id)}">Submit attempt</button></div>` : ''}
      ${canGrade ? renderGradingWorksheet(attempt) : ''}
      ${canRelease ? `<div class="row"><button type="button" class="primary" data-action="release-attempt" data-id="${safeText(attempt.id)}">Release graded attempt</button></div>` : ''}
      <div class="compact small">
        <div><strong>Objective:</strong> ${attempt.objectiveScore === null ? 'private' : fmtNumber(attempt.objectiveScore, 0)}</div>
        <div><strong>Rubric:</strong> ${attempt.rubricScore === null ? 'private' : fmtNumber(attempt.rubricScore, 0)}</div>
        <div><strong>Total:</strong> ${attempt.totalScore === null ? 'private' : fmtNumber(attempt.totalScore, 0)}</div>
      </div>
    </div>
  `;
}

function renderAttemptItem(item, attempt, editable) {
  return `
    <div class="item-card">
      <div class="row">
        <strong>${safeText(item.prompt)}</strong>
        <span class="badge ${item.kind === 'multiple_choice' ? 'published' : 'draft'}">${safeText(item.kind.replace('_', ' '))}</span>
      </div>
      <div><strong>Points:</strong> ${safeText(fmtNumber(item.points, 0))}</div>
      ${item.kind === 'multiple_choice' ? renderMultipleChoiceAttemptItem(item, attempt, editable) : renderWrittenAttemptItem(item, attempt, editable)}
      ${attempt.feedbackStatus === 'released' && state.user.role === 'student' ? `<div class="helper"><strong>Released score:</strong> ${safeText(item.savedValue || 'See grade summary')}</div>` : ''}
    </div>
  `;
}

function renderMultipleChoiceAttemptItem(item, attempt, editable) {
  return editable
    ? `<form data-form="save-answer" data-attempt-id="${safeText(attempt.id)}" data-item-id="${safeText(item.id)}" class="stack">
        ${item.options.map(option => `<label class="row"><input type="radio" name="value" value="${safeText(option)}" ${item.savedValue === option ? 'checked' : ''} /> ${safeText(option)}</label>`).join('')}
        <button type="submit">Save answer</button>
      </form>`
    : `<div class="helper"><strong>Saved answer:</strong> ${safeText(item.savedValue || 'No answer saved')}</div>`;
}

function renderWrittenAttemptItem(item, attempt, editable) {
  return editable
    ? `<form data-form="save-answer" data-attempt-id="${safeText(attempt.id)}" data-item-id="${safeText(item.id)}" class="stack">
        <label>
          Your answer
          <textarea name="value" required>${safeText(item.savedValue || '')}</textarea>
        </label>
        <button type="submit">Save answer</button>
      </form>`
    : `<div class="helper"><strong>Saved answer:</strong> ${safeText(item.savedValue || 'No answer saved')}</div>`;
}

function renderGradingWorksheet(attempt) {
  const graded = attempt.rubricGrades || [];
  const rows = attempt.items.filter(item => item.criteria && item.criteria.length);
  if (!rows.length) return '<div class="helper">No rubric criteria available for this attempt.</div>';
  return `
    <form data-form="save-grades" data-attempt-id="${safeText(attempt.id)}" class="stack">
      <h3 class="heading">Atomic grading worksheet</h3>
      ${rows.map(item => `<div class="item-card">
        <strong>${safeText(item.prompt)}</strong>
        ${item.criteria.map(criterion => {
          const existing = graded.find(grade => grade.criterionId === criterion.id) || {};
          return `
            <div class="worksheet-row">
              <label class="row"><input type="checkbox" name="selected-${safeText(criterion.id)}" ${existing.score !== undefined ? 'checked' : ''} /> Select</label>
              <div>
                <div><strong>${safeText(criterion.label)}</strong></div>
                <div class="helper">Criterion ${safeText(criterion.id)} · max ${safeText(fmtNumber(criterion.maxPoints, 0))}</div>
              </div>
              <label>Score <input name="score-${safeText(criterion.id)}" type="number" min="0" max="${safeText(String(criterion.maxPoints))}" step="0.01" value="${existing.score ?? ''}" /></label>
              <label>Feedback <textarea name="feedback-${safeText(criterion.id)}">${safeText(existing.feedback || '')}</textarea></label>
            </div>`;
        }).join('')}
      </div>`).join('')}
      <button type="submit" class="primary">Save selected rubric rows</button>
    </form>
  `;
}

function renderPreviewModalBody() {
  const preview = state.modalPreview;
  if (!preview) return '<div class="helper">No preview loaded.</div>';
  return `
    <div class="stack">
      <div class="helper">Preview binding persists on the server. Commit releases every selected attempt atomically.</div>
      <div class="list">
        ${preview.attempts.map(item => `<article class="list-item"><strong>${safeText(item.assessmentTitle)}</strong><div class="metrics"><span>${safeText(item.studentName)}</span><span>${safeText(item.attemptId)}</span><span>Total ${safeText(fmtNumber(item.totalScore, 0))}</span></div></article>`).join('')}
      </div>
      <div class="row"><button type="button" class="primary" data-action="commit-release">Commit release</button></div>
    </div>
  `;
}

function showStatusFromError(error) {
  const message = error?.data?.error?.message || error?.message || 'Request failed.';
  setMessage(message, 'error');
}

async function refreshWorkspace() {
  if (!state.token) return;
  try {
    const data = await request('/api/workspace');
    state.workspace = data;
    state.user = data.user;
    state.view = state.view || 'courses';
    state.message = 'Workspace synchronized.';
    state.messageKind = 'success';
    render();
  } catch (error) {
    if (error.status === 401) {
      clearToken();
      showLogin('Your session ended. Please sign in again.');
      return;
    }
    showStatusFromError(error);
  }
}

async function initializeSession() {
  if (!state.token) {
    render();
    return;
  }
  try {
    const me = await request('/api/auth/me');
    state.user = me.user;
    await refreshWorkspace();
  } catch (error) {
    clearToken();
    showLogin(error.status === 401 ? 'Your session expired. Please sign in again.' : 'Sign in to continue.');
  }
}

async function handleSignIn(form, button) {
  const data = Object.fromEntries(new FormData(form).entries());
  await actionBusy(button, async () => {
    try {
      const result = await request('/api/auth/sign-in', {
        method: 'POST',
        body: { email: data.email, password: data.password },
        write: true,
        signIn: true,
      });
      saveToken(result.token);
      state.user = result.user;
      state.message = `Signed in as ${result.user.name}.`;
      state.messageKind = 'success';
      await refreshWorkspace();
    } catch (error) {
      showStatusFromError(error);
    }
  });
}

async function handleSignOut(button) {
  await actionBusy(button, async () => {
    try {
      await request('/api/auth/sign-out', {
        method: 'POST',
        body: {},
        write: true,
      });
      clearToken();
      state.user = null;
      state.workspace = null;
      state.modal = null;
      showLogin('Signed out. Every session for this account has been revoked.');
    } catch (error) {
      showStatusFromError(error);
    }
  });
}

function parseQuestionForm(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const kind = String(data.kind || 'multiple_choice');
  const points = Number(data.points);
  if (kind === 'multiple_choice') {
    const options = String(data.options || '').split('\n').map(value => value.trim()).filter(Boolean);
    return { kind, prompt: data.prompt, points, options, answer: data.answer };
  }
  const rubricCriteria = String(data.criteria || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const [label, maxPoints] = line.split('|').map(part => part.trim());
    return { label, maxPoints: Number(maxPoints) };
  });
  return { kind, prompt: data.prompt, points, rubricCriteria };
}

async function submitWrite(path, body, successMessage, options = {}) {
  return actionBusy(options.button, async () => {
    try {
      const result = await request(path, {
        method: options.method || 'POST',
        body,
        write: true,
        operationId: options.operationId,
      });
      state.message = successMessage;
      state.messageKind = 'success';
      state.workspace = result.workspace || state.workspace;
      if (result.workspace) state.user = result.workspace.user;
      closeModal();
      await refreshWorkspace();
    } catch (error) {
      if (error.status === 401) {
        clearToken();
        showLogin('Your session ended. Please sign in again.');
        return;
      }
      if (error.data?.workspace) {
        state.workspace = error.data.workspace;
        state.user = error.data.workspace.user;
        render({ preserveModal: true });
      }
      showStatusFromError(error);
    }
  });
}

function getCheckedReleaseIds() {
  return [...app.querySelectorAll('input[name="release-selection"]:checked')].map(input => input.value);
}

function renderModalIfOpen() {
  if (state.modal) renderModal();
}

app.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === 'close-modal') {
    closeModal();
    return;
  }
  if (action === 'refresh') {
    await refreshWorkspace();
    return;
  }
  if (action === 'sign-out') {
    await handleSignOut(button);
    return;
  }
  if (action === 'start-assessment') {
    await submitWrite(`/api/assessments/${encodeURIComponent(id)}/start`, {}, 'Attempt started.');
    return;
  }
  if (action === 'open-attempt') {
    openAttemptModal(id);
    return;
  }
  if (action === 'open-assessment') {
    openAssessmentModal(id);
    return;
  }
  if (action === 'publish-assessment') {
    await submitWrite(`/api/assessments/${encodeURIComponent(id)}/publish`, {}, 'Assessment published.');
    return;
  }
  if (action === 'grade-attempt') {
    openAttemptModal(id);
    return;
  }
  if (action === 'release-attempt') {
    await submitWrite(`/api/attempts/${encodeURIComponent(id)}/release`, {}, 'Grade released.');
    return;
  }
  if (action === 'commit-release') {
    if (!state.modalPreview?.previewId) return setMessage('No preview is ready.', 'error');
    await submitWrite(`/api/release-previews/${encodeURIComponent(state.modalPreview.previewId)}/commit`, {}, 'Batch release committed.');
    state.modalPreview = null;
    return;
  }
  if (action === 'preview-release') {
    const ids = getCheckedReleaseIds();
    if (!ids.length) {
      setMessage('Select at least one graded attempt to preview.', 'error');
      return;
    }
    await actionBusy(button, async () => {
      try {
        const result = await request('/api/release-previews', {
          method: 'POST',
          body: { attemptIds: ids },
          write: true,
        });
        state.modalPreview = result.preview;
        state.message = `Preview ready for ${result.preview.attempts.length} attempt(s).`;
        state.messageKind = 'success';
        openModal({ head: `<h2 id="modal-title" class="heading">Reviewed batch release</h2>`, body: renderPreviewModalBody() });
      } catch (error) {
        showStatusFromError(error);
      }
    });
    return;
  }
  if (action === 'open-add-question') {
    openAssessmentModal(id);
    return;
  }
  if (action === 'submit-attempt') {
    await submitWrite(`/api/attempts/${encodeURIComponent(id)}/submit`, {}, 'Attempt submitted.');
    return;
  }
});

app.addEventListener('submit', async event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const formName = form.dataset.form;
  if (formName === 'sign-in') {
    await handleSignIn(form, form.querySelector('button[type="submit"]'));
    return;
  }
  if (formName === 'create-assessment') {
    const data = Object.fromEntries(new FormData(form).entries());
    await submitWrite('/api/assessments', {
      title: data.title,
      opensAt: data.opensAt,
      dueAt: data.dueAt,
      durationMinutes: data.durationMinutes,
      maxAttempts: data.maxAttempts,
    }, 'Draft assessment created.', { button: form.querySelector('button[type="submit"]') });
    return;
  }
  if (formName === 'add-question') {
    const assessmentId = form.dataset.assessmentId;
    const payload = parseQuestionForm(form);
    await submitWrite(`/api/assessments/${encodeURIComponent(assessmentId)}/items`, payload, 'Question added to draft.', { button: form.querySelector('button[type="submit"]') });
    return;
  }
  if (formName === 'save-answer') {
    const attemptId = form.dataset.attemptId;
    const itemId = form.dataset.itemId;
    const data = new FormData(form);
    const value = data.get('value');
    await submitWrite(`/api/attempts/${encodeURIComponent(attemptId)}/answers/${encodeURIComponent(itemId)}`, { value }, 'Answer saved.', { button: form.querySelector('button[type="submit"]'), method: 'PUT' });
    return;
  }
  if (formName === 'save-grades') {
    const attemptId = form.dataset.attemptId;
    const rows = [];
    const formData = new FormData(form);
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith('selected-')) continue;
      const criterionId = key.replace('selected-', '');
      if (!formData.get(key)) continue;
      rows.push({
        criterionId,
        selected: true,
        score: formData.get(`score-${criterionId}`),
        feedback: formData.get(`feedback-${criterionId}`),
      });
    }
    await submitWrite(`/api/attempts/${encodeURIComponent(attemptId)}/grades`, { rows }, 'Rubric rows saved.', { button: form.querySelector('button[type="submit"]') });
    return;
  }
  if (formName === 'save-policy') {
    const published = state.workspace.assessments.filter(item => item.status === 'published');
    const weights = published.map(assessment => ({
      assessmentId: assessment.id,
      weightPct: form.elements[`weight-${assessment.id}`].value,
    }));
    await submitWrite('/api/outcomes/policy', { weights }, 'Outcome policy saved.', { button: form.querySelector('button[type="submit"]') });
    return;
  }
  if (formName === 'save-exception') {
    const data = Object.fromEntries(new FormData(form).entries());
    await submitWrite('/api/outcomes/exceptions', {
      studentId: data.studentId,
      assessmentId: data.assessmentId,
      excused: Boolean(data.excused),
      reason: data.reason,
    }, 'Outcome exception saved.', { button: form.querySelector('button[type="submit"]') });
    return;
  }
});

modal.addEventListener('close', () => {
  state.modal = null;
  if (state.lastTrigger && typeof state.lastTrigger.focus === 'function') state.lastTrigger.focus();
  state.lastTrigger = null;
});

modal.addEventListener('click', event => {
  if (event.target === modal) closeModal();
});

window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && modal.open) {
    closeModal();
  }
});

render();
initializeSession();

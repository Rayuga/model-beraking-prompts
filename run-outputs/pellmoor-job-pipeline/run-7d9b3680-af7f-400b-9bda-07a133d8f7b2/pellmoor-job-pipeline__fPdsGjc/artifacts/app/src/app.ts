import * as d3 from 'd3';

const root = document.getElementById('app');
if (!root) throw new Error('App root missing');

const DEMO_ACCOUNTS = [
  { email: 'hiring@pellmoor.test', name: 'Ruth Aldane', role: 'hiring manager' },
  { email: 'panel1@pellmoor.test', name: 'Otis Barre', role: 'panel' },
  { email: 'panel2@pellmoor.test', name: 'Wren Foss', role: 'panel' },
  { email: 'coord@pellmoor.test', name: 'Cal Meriden', role: 'coordinator' },
];

const state = {
  loading: true,
  user: null,
  vacancies: [],
  selectedVacancyCode: sessionStorage.getItem('pellmoor:selectedVacancy') || '',
  vacancy: null,
  selectedCandidateId: '',
  candidate: null,
  theme: localStorage.getItem('pellmoor:theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  flash: '',
  flashKind: 'info',
  batchMode: false,
  batchSelection: [],
  batchPreview: null,
  batchOpen: false,
  batchOperationId: '',
  batchRevision: 0,
  batchWorking: false,
  batchError: '',
  formBusy: false,
};

applyTheme(state.theme);

window.addEventListener('storage', (event) => {
  if (event.key === 'pellmoor:theme' && (event.newValue === 'dark' || event.newValue === 'light')) {
    state.theme = event.newValue;
    applyTheme(state.theme);
    render();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.batchOpen) {
    closeBatchModal();
  }
});

bootstrap();

async function bootstrap() {
  state.loading = true;
  render();
  try {
    const response = await api('/api/bootstrap');
    state.user = response.user;
    state.vacancies = response.vacancies || [];
    state.loading = false;
    if (!state.selectedVacancyCode || !state.vacancies.find((vacancy) => vacancy.code === state.selectedVacancyCode)) {
      state.selectedVacancyCode = state.vacancies[0] ? state.vacancies[0].code : '';
    }
    if (state.selectedVacancyCode) {
      await loadVacancy(state.selectedVacancyCode, { preserveCandidate: false });
    }
    render();
  } catch (error) {
    state.loading = false;
    if (error.status === 401) {
      state.user = null;
      state.vacancies = [];
      state.vacancy = null;
      state.candidate = null;
      state.selectedCandidateId = '';
      render();
      return;
    }
    state.flash = errorMessage(error);
    state.flashKind = 'bad';
    render();
  }
}

async function loadVacancy(code, options = { preserveCandidate: false, preserveBatch: false }) {
  if (!code) return;
  try {
    const vacancy = await api(`/api/vacancies/${encodeURIComponent(code)}`);
    state.vacancy = vacancy;
    state.selectedVacancyCode = code;
    sessionStorage.setItem('pellmoor:selectedVacancy', code);
    state.batchRevision = vacancy.revision;
    if (!options.preserveBatch) {
      state.batchPreview = null;
      state.batchOpen = false;
    }
    if (!options.preserveCandidate || !state.selectedCandidateId || !vacancy.candidates?.find((candidate) => candidate.id === state.selectedCandidateId)) {
      state.selectedCandidateId = '';
      state.candidate = null;
    }
    state.vacancies = state.vacancies.map((item) => (item.code === code ? vacancySummaryFromDetail(vacancy) : item));
    render();
  } catch (error) {
    if (error.status === 404) {
      state.flash = 'That vacancy no longer exists.';
      state.flashKind = 'bad';
    } else {
      state.flash = errorMessage(error);
      state.flashKind = 'bad';
    }
    render();
  }
}

async function loadCandidate(candidateId) {
  if (!candidateId) {
    state.selectedCandidateId = '';
    state.candidate = null;
    render();
    return;
  }
  try {
    const candidate = await api(`/api/candidates/${encodeURIComponent(candidateId)}`);
    state.selectedCandidateId = candidateId;
    state.candidate = candidate;
    render();
  } catch (error) {
    state.flash = errorMessage(error);
    state.flashKind = 'bad';
    render();
  }
}

async function refreshAfterWrite(candidateId = state.selectedCandidateId, options = {}) {
  if (state.selectedVacancyCode) {
    await loadVacancy(state.selectedVacancyCode, { preserveCandidate: false, preserveBatch: Boolean(options.preserveBatch) });
  }
  if (candidateId) {
    await loadCandidate(candidateId);
  }
}

async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const init = {
    credentials: 'same-origin',
    ...options,
    headers,
  };
  if (init.body && typeof init.body !== 'string' && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(init.body);
  }
  const response = await fetch(url, init);
  const contentType = response.headers.get('content-type') || '';
  let body = null;
  if (contentType.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }
  if (!response.ok) {
    const error = new Error((body && body.error) || response.statusText || 'Request failed');
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function errorMessage(error) {
  return error && error.body && typeof error.body.error === 'string' ? error.body.error : error.message || 'Something went wrong';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('pellmoor:theme', theme);
}

function setTheme(theme) {
  state.theme = theme;
  applyTheme(theme);
  render();
}

function vacancySummaryFromDetail(detail) {
  return {
    code: detail.code,
    title: detail.title,
    team: detail.team,
    openings: detail.openings,
    revision: detail.revision,
    capacity: detail.capacity,
    candidateCount: detail.candidateCount,
    funnel: detail.funnel,
    summary: detail.summary,
    activity: detail.activity,
  };
}

function render() {
  if (state.loading) {
    root.innerHTML = `
      <div class="loading-screen">
        <div class="panel">
          <h1>Pellmoor hiring workspace</h1>
          <p class="muted">Loading the current workspace…</p>
        </div>
      </div>`;
    return;
  }

  if (!state.user) {
    root.innerHTML = renderLogin();
    bindLogin();
    return;
  }

  root.innerHTML = `
    <div class="workspace-shell">
      ${renderTopBar()}
      <div class="workspace">
        <aside class="sidebar">${renderSidebar()}</aside>
        <main class="main">${renderMain()}</main>
        <aside class="drawer">${renderDrawer()}</aside>
      </div>
      ${state.batchOpen ? renderBatchModal() : ''}
      ${state.flash ? renderFlash() : ''}
    </div>
  `;
  bindWorkspace();
  drawFunnel();
}

function renderLogin() {
  return `
    <div class="login-screen">
      <div class="login-card">
        <h1>Pellmoor hiring workspace</h1>
        <p class="helper">Sign in with the demo accounts from the hosting note. Password: <strong>password123</strong>.</p>
        <form id="login-form" class="login-grid">
          <label>
            <span>Email</span>
            <input name="email" type="email" autocomplete="email" required placeholder="hiring@pellmoor.test" />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" autocomplete="current-password" required placeholder="password123" />
          </label>
          <button class="primary" type="submit">Sign in</button>
        </form>
        <div class="panel" style="margin-top: 1rem;">
          <h2>Demo accounts</h2>
          <div class="scroll-list">
            ${DEMO_ACCOUNTS.map((account) => `
              <div class="panel-chip">
                <div class="row"><strong>${esc(account.name)}</strong><span class="permission-pill">${esc(account.role)}</span></div>
                <div class="muted">${esc(account.email)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

function renderTopBar() {
  return `
    <header class="panel" style="margin: 1rem 1rem 0;">
      <div class="workspace-header">
        <div>
          <h1>Pellmoor hiring workspace</h1>
          <div class="user-meta">
            <span class="badge">${esc(state.user.name)}</span>
            <span class="badge">${esc(state.user.role)}</span>
            <span class="badge">${esc(state.user.email)}</span>
            <span class="badge">Revision ${state.vacancy ? esc(String(state.vacancy.revision)) : '—'}</span>
          </div>
        </div>
        <div class="user-meta">
          <button data-toggle-theme type="button" class="secondary">Theme: ${state.theme === 'dark' ? 'Dark' : 'Light'}</button>
          ${state.user ? `<button data-sign-out type="button" class="danger">Sign out</button>` : ''}
        </div>
      </div>
    </header>`;
}

function renderSidebar() {
  return `
    <div class="panel vacancy-panel">
      <div class="inline-row" style="justify-content: space-between;">
        <h2>Vacancies</h2>
        <span class="badge">${state.vacancies.length} open</span>
      </div>
      <div class="vacancy-list">
        ${state.vacancies.map((vacancy) => `
          <button type="button" class="${vacancy.code === state.selectedVacancyCode ? 'selected' : ''}" data-vacancy-code="${esc(vacancy.code)}">
            <div class="vacancy-title"><strong>${esc(vacancy.title)}</strong><span class="badge">${esc(vacancy.code)}</span></div>
            <div class="muted">${esc(vacancy.team)} · openings ${vacancy.openings}</div>
            <div class="inline-row" style="margin-top: 0.35rem;">
              <span class="metric-pill">reserved ${vacancy.capacity?.reserved ?? 0}</span>
              <span class="metric-pill">filled ${vacancy.capacity?.filled ?? 0}</span>
              <span class="metric-pill">available ${vacancy.capacity?.available ?? 0}</span>
            </div>
          </button>
        `).join('')}
      </div>
    </div>`;
}

function renderMain() {
  if (!state.vacancy) {
    return `
      <section class="panel">
        <div class="empty-state">Select a vacancy to see its funnel, candidates, and activity trail.</div>
      </section>`;
  }

  const vacancy = state.vacancy;
  const canCreate = state.user.role === 'coordinator';
  const canBatch = state.user.role === 'hiring manager';
  return `
    <section class="panel vacancy-card">
      <div class="workspace-header">
        <div>
          <h2>${esc(vacancy.title)}</h2>
          <div class="user-meta">
            <span class="stage-pill" data-stage="applied">${esc(vacancy.code)}</span>
            <span class="badge">${esc(vacancy.team)}</span>
            <span class="badge">openings ${vacancy.openings}</span>
            <span class="badge">revision ${vacancy.revision}</span>
          </div>
        </div>
        <div class="user-meta">
          <span class="count-pill">reserved ${vacancy.capacity.reserved}</span>
          <span class="count-pill">filled ${vacancy.capacity.filled}</span>
          <span class="count-pill">available ${vacancy.capacity.available}</span>
        </div>
      </div>

      ${canCreate ? renderCreateCandidateForm() : ''}

      ${canBatch ? renderBatchBar() : ''}

      <div class="summary-grid">
        <div class="summary-stat"><span class="muted">Candidates</span><strong>${vacancy.candidateCount}</strong></div>
        <div class="summary-stat"><span class="muted">Pipeline</span><strong>${vacancy.summary.pipelineCount}</strong></div>
        <div class="summary-stat"><span class="muted">Terminal</span><strong>${vacancy.summary.terminalCount}</strong></div>
      </div>

      <div class="chart-wrap">
        <div class="inline-row" style="justify-content: space-between; margin-bottom: 0.5rem;">
          <h3 class="section-title">Pipeline funnel</h3>
          <span class="muted">Built from stage history</span>
        </div>
        <div id="funnel-chart"></div>
      </div>

      <div class="funnel-wrap">
        <div class="inline-row" style="justify-content: space-between; margin-bottom: 0.5rem;">
          <h3 class="section-title">Candidates</h3>
          <span class="muted">Select a card to open the drawer</span>
        </div>
        ${vacancy.candidates.length ? `<div class="candidate-grid">${vacancy.candidates.map(renderCandidateCard).join('')}</div>` : `<div class="empty-state">This vacancy is intentionally empty for now.</div>`}
      </div>

      <div class="panel" style="padding: 0; background: transparent; box-shadow: none; border: none;">
        <div class="inline-row" style="justify-content: space-between; margin-bottom: 0.5rem;">
          <h3 class="section-title">Recent activity</h3>
          <span class="muted">Latest vacancy trail</span>
        </div>
        <div class="activity-list scroll-list">${renderActivityList(vacancy.activity)}</div>
      </div>
    </section>`;
}

function renderCreateCandidateForm() {
  return `
    <div class="status-card good">
      <div class="inline-row" style="justify-content: space-between; margin-bottom: 0.5rem;">
        <h3 class="section-title">Add candidate</h3>
        <span class="permission-pill">Coordinator</span>
      </div>
      <form id="candidate-create-form" class="form-grid">
        <label>
          <span>Name</span>
          <input name="name" required placeholder="Candidate name" />
        </label>
        <label>
          <span>Initial note</span>
          <textarea name="noteText" placeholder="Optional note"></textarea>
        </label>
        <button type="submit" class="primary">Add candidate at applied</button>
      </form>
    </div>`;
}

function renderBatchBar() {
  const count = state.batchSelection.length;
  const current = state.vacancy.capacity;
  return `
    <div class="batch-summary">
      <div class="inline-row" style="justify-content: space-between;">
        <div>
          <strong>Batch offer planning</strong>
          <div class="muted">Ruth can select interview candidates, review them, and confirm them as one operation.</div>
        </div>
        <button type="button" class="secondary" data-batch-toggle>${state.batchMode ? 'Hide selection' : 'Plan batch offer'}</button>
      </div>
      <div class="inline-row">
        <span class="metric-pill">selected ${count}</span>
        <span class="metric-pill">reserved ${current.reserved}</span>
        <span class="metric-pill">available ${current.available}</span>
        <span class="metric-pill">projected reserved ${current.reserved + count}</span>
      </div>
      <div class="inline-row">
        <button type="button" class="primary" data-batch-review ${count ? '' : 'disabled'}>Review selection</button>
        <button type="button" class="ghost" data-batch-clear ${count ? '' : 'disabled'}>Clear selection</button>
      </div>
      ${state.batchMode ? `<div class="small-note">Selection is read-only until you open the review step.</div>` : ''}
    </div>`;
}

function renderCandidateCard(candidate) {
  const selected = candidate.id === state.selectedCandidateId;
  const batchChecked = state.batchSelection.includes(candidate.id);
  const batchEligible = candidate.stage === 'interview';
  return `
    <article class="candidate-card ${selected ? 'selected' : ''}" data-open-candidate="${esc(candidate.id)}">
      <div class="name-row">
        ${state.user.role === 'hiring manager' && state.batchMode ? `<label class="inline-row" style="gap: 0.35rem;" onclick="event.stopPropagation()"><input type="checkbox" data-batch-pick="${esc(candidate.id)}" ${batchEligible ? '' : 'disabled'} ${batchChecked ? 'checked' : ''} /></label>` : ''}
        <div>
          <div class="candidate-name"><strong>${esc(candidate.name)}</strong><span class="badge">${esc(candidate.id)}</span></div>
          <div class="muted">${esc(candidate.stage)} · version ${candidate.assessmentVersion}</div>
        </div>
      </div>
      <div class="meta-row">
        <span class="stage-pill" data-stage="${esc(candidate.stage)}">${esc(stageShape(candidate.stage))} ${esc(candidate.stage)}</span>
        <span class="badge">scores ${candidate.currentScores.length}/${candidate.activePanel.length}</span>
        <span class="badge ${candidate.offerReady ? 'good' : 'bad'}">${candidate.offerReady ? 'offer ready' : 'blocked'}</span>
      </div>
      <div class="muted">${candidate.blockedReasons.length ? esc(candidate.blockedReasons.join(' · ')) : 'Complete current assessment'}</div>
    </article>`;
}

function renderDrawer() {
  if (!state.candidate) {
    return `
      <div class="panel">
        <h2>Candidate drawer</h2>
        <div class="empty-state">Open a candidate to see their stage history, panel, scores, notes, and activity.</div>
      </div>`;
  }

  const candidate = state.candidate;
  const scoreByMember = new Map(candidate.currentScores.map((row) => [row.member_email, row.score]));
  const panelMembers = candidate.activePanel || [];
  const currentUserScore = scoreByMember.get(state.user.email) || '';
  const canMove = state.user.role === 'hiring manager';
  const canPanel = state.user.role === 'coordinator';
  const canScore = candidate.stage === 'interview' && panelMembers.includes(state.user.email);
  const frozenMessage = candidate.frozen
    ? 'Panel and score edits are frozen here because this candidate is at a terminal or offer stage.'
    : 'Panel edits are only available at applied, screening, and interview.';
  const stageActions = stageTargets(candidate.stage);

  return `
    <div class="panel">
      <div class="inline-row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <h2>${esc(candidate.name)}</h2>
          <div class="inline-row">
            <span class="badge">${esc(candidate.id)}</span>
            <span class="stage-pill" data-stage="${esc(candidate.stage)}">${esc(stageShape(candidate.stage))} ${esc(candidate.stage)}</span>
            <span class="badge">version ${candidate.assessmentVersion}</span>
          </div>
        </div>
        <button type="button" class="ghost" data-close-candidate>Close</button>
      </div>

      <div class="status-card ${candidate.offer.ready ? 'good' : 'bad'}">
        <strong>${candidate.offer.ready ? 'Offer ready' : 'Offer blocked'}</strong>
        <div class="muted">${candidate.offer.ready ? 'This candidate meets the current offer gate.' : candidate.offer.blockedReasons.join(' · ')}</div>
      </div>

      <div class="meta-grid">
        <div class="summary-stat"><span class="muted">Vacancy</span><strong>${esc(candidate.vacancy.title)}</strong><span class="muted">${esc(candidate.vacancy.code)} · ${esc(candidate.vacancy.team)}</span></div>
        <div class="summary-stat"><span class="muted">Capacity</span><strong>reserved ${candidate.capacity.reserved} · filled ${candidate.capacity.filled} · available ${candidate.capacity.available}</strong></div>
        <div class="summary-stat"><span class="muted">Assessment freshness</span><strong>Current version ${candidate.assessmentVersion}</strong><span class="muted">Historical scores remain visible by version and scorer.</span></div>
      </div>

      ${canMove ? renderStageControls(candidate, stageActions) : ''}
      ${canPanel ? renderPanelControls(candidate) : ''}
      ${canScore ? renderScoreForm(candidate, currentUserScore) : ''}
      <div class="status-card"><strong>Why controls may be blocked</strong><div class="muted">${esc(frozenMessageForStage(candidate.stage))}</div></div>
      ${renderNoteForm(candidate)}
      ${renderScoreSections(candidate)}
      ${renderPanelTrail(candidate)}
      ${renderStageTrail(candidate)}
      ${renderNotes(candidate)}
      ${renderActivity(candidate)}
    </div>`;
}

function renderStageControls(candidate, actions) {
  return `
    <div class="status-card">
      <div class="inline-row" style="justify-content: space-between; margin-bottom: 0.5rem;">
        <strong>Stage controls</strong>
        <span class="permission-pill">Hiring manager</span>
      </div>
      <div class="inline-row">
        ${actions.map((action) => `<button type="button" class="secondary" data-stage-action="${esc(action)}">${esc(stageLabel(action))}</button>`).join('')}
      </div>
    </div>`;
}

function renderPanelControls(candidate) {
  const active = candidate.activePanel || [];
  const eligible = ['hiring@pellmoor.test', 'panel1@pellmoor.test', 'panel2@pellmoor.test'].filter((email) => !active.includes(email));
  return `
    <div class="status-card">
      <div class="inline-row" style="justify-content: space-between; margin-bottom: 0.5rem;">
        <strong>Panel controls</strong>
        <span class="permission-pill">Coordinator</span>
      </div>
      <div class="helper">${esc(frozenMessageForStage(candidate.stage))}</div>
      <div class="panel-row">
        ${active.map((email) => `<span class="panel-chip"><span>${esc(email)}</span><button type="button" class="ghost" data-panel-remove="${esc(email)}">Remove</button></span>`).join('') || '<span class="muted">No active panel members.</span>'}
      </div>
      <div class="inline-row" style="margin-top: 0.75rem;">
        <select data-panel-add-select>
          ${eligible.map((email) => `<option value="${esc(email)}">${esc(email)}</option>`).join('')}
        </select>
        <button type="button" class="primary" data-panel-add ${eligible.length ? '' : 'disabled'}>Add member</button>
      </div>
    </div>`;
}

function renderScoreForm(candidate, currentUserScore) {
  return `
    <div class="status-card good">
      <div class="inline-row" style="justify-content: space-between; margin-bottom: 0.5rem;">
        <strong>Your score</strong>
        <span class="permission-pill">Panel member</span>
      </div>
      <form id="score-form" class="inline-row">
        <label style="flex: 1; min-width: 0;">
          <span class="muted">Score 1–5</span>
          <select name="score">
            ${[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${String(value) === String(currentUserScore) ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </label>
        <button type="submit" class="primary">Save score</button>
      </form>
    </div>`;
}

function renderNoteForm(candidate) {
  return `
    <div class="status-card">
      <strong>Note</strong>
      <form id="note-form" class="form-grid" style="margin-top: 0.75rem;">
        <textarea name="text" placeholder="Add a note about this candidate"></textarea>
        <button type="submit" class="secondary">Add note</button>
      </form>
    </div>`;
}

function renderScoreSections(candidate) {
  const currentScoreRows = candidate.currentScores.map((row) => `
    <div class="score-card">
      <div class="row"><strong>${esc(row.member_email)}</strong><span class="badge">current version</span></div>
      <div>Score ${row.score}</div>
      <div class="muted">Recorded by ${esc(row.recorded_by)} at ${formatTime(row.recorded_at)}</div>
    </div>`).join('');
  const historical = candidate.historicalScores.map((version) => `
    <div class="score-card">
      <div class="row"><strong>Version ${version.assessmentVersion}</strong><span class="badge">historical</span></div>
      ${version.scores.map((score) => `<div class="muted">${esc(score.memberEmail)} scored ${score.score} · ${formatTime(score.recordedAt)}</div>`).join('')}
    </div>`).join('');
  return `
    <div class="status-card">
      <h3 class="section-title">Current scores</h3>
      <div class="scroll-list" style="margin-top: 0.75rem;">${currentScoreRows || '<div class="empty-state">No current scores yet.</div>'}</div>
      <h3 class="section-title" style="margin-top: 1rem;">Historical scores</h3>
      <div class="scroll-list" style="margin-top: 0.75rem;">${historical || '<div class="empty-state">No historical scores yet.</div>'}</div>
    </div>`;
}

function renderPanelTrail(candidate) {
  return `
    <div class="status-card">
      <h3 class="section-title">Panel</h3>
      <div class="scroll-list" style="margin-top: 0.75rem;">
        ${candidate.panelAssignments.map((assignment) => `
          <div class="panel-chip">
            <div class="row"><strong>${esc(assignment.memberEmail)}</strong><span class="badge">${assignment.active ? 'active' : 'historical'}</span></div>
            <div class="muted">Added by ${esc(assignment.addedBy)} at ${formatTime(assignment.addedAt)}</div>
            ${assignment.removedBy ? `<div class="muted">Removed by ${esc(assignment.removedBy)} at ${formatTime(assignment.removedAt)}</div>` : ''}
          </div>`).join('') || '<div class="empty-state">No panel history yet.</div>'}
      </div>
    </div>`;
}

function renderStageTrail(candidate) {
  return `
    <div class="status-card">
      <h3 class="section-title">Stage history</h3>
      <div class="history-list scroll-list" style="margin-top: 0.75rem;">
        ${candidate.stageHistory.map((entry, index) => `
          <div class="history-item">
            <div class="row"><strong>${index + 1}. ${esc(entry.stage)}</strong><span class="badge">version ${entry.assessmentVersion}</span></div>
            <div class="muted">${esc(entry.reason)} · ${esc(entry.actorEmail)} · ${formatTime(entry.createdAt)}</div>
            ${entry.batchId ? `<div class="muted">Batch ${esc(entry.batchId)} · item ${entry.batchPosition}/${entry.batchSize}</div>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
}

function renderNotes(candidate) {
  return `
    <div class="status-card">
      <h3 class="section-title">Notes</h3>
      <div class="note-list scroll-list" style="margin-top: 0.75rem;">
        ${candidate.notes.map((note) => `
          <div class="note-item">
            <div class="row"><strong>${esc(note.actorEmail)}</strong><span class="muted">${formatTime(note.createdAt)}</span></div>
            <div>${esc(note.text)}</div>
          </div>`).join('') || '<div class="empty-state">No notes yet.</div>'}
      </div>
    </div>`;
}

function renderActivity(candidate) {
  return `
    <div class="status-card">
      <h3 class="section-title">Activity trail</h3>
      <div class="activity-list scroll-list" style="margin-top: 0.75rem;">
        ${candidate.activity.map((event) => `
          <div class="activity-item">
            <div class="row"><strong>${esc(event.title)}</strong><span class="badge">r${event.revision}</span></div>
            <div class="muted">${esc(event.actorEmail)} · ${formatTime(event.createdAt)}</div>
            <div>${esc(event.body)}</div>
          </div>`).join('') || '<div class="empty-state">No activity yet.</div>'}
      </div>
    </div>`;
}

function renderBatchModal() {
  const preview = state.batchPreview;
  return `
    <div class="batch-review" role="dialog" aria-modal="true" aria-labelledby="batch-review-title">
      <div class="modal-card">
        <div class="inline-row" style="justify-content: space-between;">
          <h2 id="batch-review-title">Review batch offer</h2>
          <button type="button" class="ghost" data-batch-close>Close</button>
        </div>
        <div class="small-note">Selection is read-only until you confirm. Reopen review after any stale conflict.</div>
        ${state.batchError ? `<div class="status-card bad">${esc(state.batchError)}</div>` : ''}
        ${preview ? `
          <div class="batch-summary">
            <div class="inline-row">
              <span class="metric-pill">selection ${preview.selectionCount}</span>
              <span class="metric-pill">current reserved ${preview.currentCapacity.reserved}</span>
              <span class="metric-pill">projected reserved ${preview.projectedCapacity.reserved}</span>
              <span class="metric-pill">current available ${preview.currentCapacity.available}</span>
              <span class="metric-pill">projected available ${preview.projectedCapacity.available}</span>
            </div>
            <div class="identifier"><strong>Selection id</strong> <span>${esc(state.batchOperationId || 'pending')}</span></div>
            <div class="scroll-list">
              ${preview.selection.map((candidate) => `
                <div class="batch-item">
                  <div class="row"><strong>${esc(candidate.name)}</strong><span class="badge">${esc(candidate.id)}</span></div>
                  <div class="muted">Version ${candidate.assessmentVersion} · ${candidate.eligible ? 'eligible' : 'blocked'}</div>
                  <div class="muted">${candidate.reasons.length ? esc(candidate.reasons.join(' · ')) : 'Ready to offer'}</div>
                </div>`).join('')}
            </div>
          </div>` : '<div class="empty-state">No selection preview yet.</div>'}
        <div class="inline-row" style="justify-content: flex-end;">
          <button type="button" class="secondary" data-batch-refresh>Review current selection</button>
          <button type="button" class="ghost" data-batch-close>Cancel</button>
          <button type="button" class="primary" data-batch-confirm ${preview && preview.selection.every((candidate) => candidate.eligible) ? '' : 'disabled'}>${state.batchWorking ? 'Confirming…' : 'Confirm offers'}</button>
        </div>
      </div>
    </div>`;
}

function renderFlash() {
  return `<div class="toast ${state.flashKind === 'bad' ? 'bad' : 'good'}"><strong>${state.flashKind === 'bad' ? 'Action blocked' : 'Update'}</strong><div>${esc(state.flash)}</div></div>`;
}

function bindLogin() {
  const form = document.getElementById('login-form');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await api('/api/login', {
        method: 'POST',
        body: {
          email: String(data.get('email') || '').trim(),
          password: String(data.get('password') || ''),
        },
      });
      state.flash = 'Signed in successfully.';
      state.flashKind = 'info';
      await bootstrap();
    } catch (error) {
      state.flash = errorMessage(error);
      state.flashKind = 'bad';
      render();
    }
  });
}

function bindWorkspace() {
  document.querySelectorAll('[data-toggle-theme]').forEach((button) => button.addEventListener('click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark')));
  document.querySelectorAll('[data-sign-out]').forEach((button) => button.addEventListener('click', onSignOut));
  document.querySelectorAll('[data-vacancy-code]').forEach((button) => button.addEventListener('click', () => selectVacancy(button.getAttribute('data-vacancy-code') || '')));
  document.querySelectorAll('[data-open-candidate]').forEach((card) => card.addEventListener('click', () => loadCandidate(card.getAttribute('data-open-candidate') || '')));
  document.querySelectorAll('[data-close-candidate]').forEach((button) => button.addEventListener('click', () => loadCandidate('')));
  document.querySelectorAll('[data-stage-action]').forEach((button) => button.addEventListener('click', () => submitStage(button.getAttribute('data-stage-action') || '')));
  document.querySelectorAll('[data-panel-add]').forEach((button) => button.addEventListener('click', onAddPanelMember));
  document.querySelectorAll('[data-panel-remove]').forEach((button) => button.addEventListener('click', () => submitPanel('remove', button.getAttribute('data-panel-remove') || '')));
  document.querySelectorAll('[data-batch-toggle]').forEach((button) => button.addEventListener('click', () => {
    state.batchMode = !state.batchMode;
    if (!state.batchMode) {
      state.batchSelection = [];
      state.batchPreview = null;
      state.batchOpen = false;
    }
    render();
  }));
  document.querySelectorAll('[data-batch-clear]').forEach((button) => button.addEventListener('click', () => {
    state.batchSelection = [];
    state.batchPreview = null;
    state.batchError = '';
    render();
  }));
  document.querySelectorAll('[data-batch-review]').forEach((button) => button.addEventListener('click', openBatchReview));
  document.querySelectorAll('[data-batch-close]').forEach((button) => button.addEventListener('click', closeBatchModal));
  document.querySelectorAll('[data-batch-refresh]').forEach((button) => button.addEventListener('click', refreshBatchPreview));
  document.querySelectorAll('[data-batch-confirm]').forEach((button) => button.addEventListener('click', confirmBatch));
  document.querySelectorAll('[data-batch-pick]').forEach((input) => input.addEventListener('change', onBatchPick));

  const createForm = document.getElementById('candidate-create-form');
  if (createForm) {
    createForm.addEventListener('submit', onCreateCandidate);
  }
  const scoreForm = document.getElementById('score-form');
  if (scoreForm) {
    scoreForm.addEventListener('submit', onScoreSubmit);
  }
  const noteForm = document.getElementById('note-form');
  if (noteForm) {
    noteForm.addEventListener('submit', onNoteSubmit);
  }
}

async function onSignOut() {
  try {
    await api('/api/logout', { method: 'POST', body: {} });
  } catch (error) {
    // ignore network issues during sign-out
  }
  state.user = null;
  state.vacancies = [];
  state.vacancy = null;
  state.candidate = null;
  state.selectedCandidateId = '';
  state.selectedVacancyCode = '';
  state.batchSelection = [];
  state.batchMode = false;
  state.flash = 'Signed out.';
  state.flashKind = 'info';
  render();
}

async function selectVacancy(code) {
  state.selectedVacancyCode = code;
  state.selectedCandidateId = '';
  state.candidate = null;
  state.batchSelection = [];
  state.batchMode = false;
  sessionStorage.setItem('pellmoor:selectedVacancy', code);
  await loadVacancy(code, { preserveCandidate: false });
}

async function onCreateCandidate(event) {
  event.preventDefault();
  if (!state.vacancy) return;
  const form = event.currentTarget;
  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  const noteText = String(data.get('noteText') || '').trim();
  if (!name) return;
  state.formBusy = true;
  render();
  try {
    await api(`/api/vacancies/${encodeURIComponent(state.vacancy.code)}/candidates`, {
      method: 'POST',
      headers: {
        'X-Expected-Revision': String(state.vacancy.revision),
        'X-Operation-Id': crypto.randomUUID(),
      },
      body: {
        name,
        noteText,
      },
    });
    state.flash = `Added ${name}.`;
    state.flashKind = 'info';
    form.reset();
    await refreshAfterWrite();
  } catch (error) {
    if (error.status === 409 && error.body && error.body.currentVacancy) {
      state.vacancy = error.body.currentVacancy;
    }
    state.flash = errorMessage(error);
    state.flashKind = 'bad';
    await refreshAfterWrite();
  } finally {
    state.formBusy = false;
    render();
  }
}

async function submitStage(nextStage) {
  if (!state.candidate || !state.vacancy || !nextStage) return;
  try {
    await api(`/api/candidates/${encodeURIComponent(state.candidate.id)}/stage`, {
      method: 'POST',
      headers: {
        'X-Expected-Revision': String(state.vacancy.revision),
        'X-Operation-Id': crypto.randomUUID(),
      },
      body: { nextStage },
    });
    state.flash = `Moved ${state.candidate.name} to ${nextStage}.`;
    state.flashKind = 'info';
    await refreshAfterWrite(state.candidate.id);
  } catch (error) {
    if (error.status === 409 && error.body && error.body.currentVacancy) {
      state.vacancy = error.body.currentVacancy;
    }
    state.flash = errorMessage(error);
    state.flashKind = 'bad';
    await refreshAfterWrite(state.candidate.id);
  }
}

async function submitPanel(action, memberEmail) {
  if (!state.candidate || !state.vacancy) return;
  try {
    await api(`/api/candidates/${encodeURIComponent(state.candidate.id)}/panel`, {
      method: 'POST',
      headers: {
        'X-Expected-Revision': String(state.vacancy.revision),
        'X-Operation-Id': crypto.randomUUID(),
      },
      body: { action, memberEmail },
    });
    state.flash = `${action === 'add' ? 'Added' : 'Removed'} ${memberEmail}.`;
    state.flashKind = 'info';
    await refreshAfterWrite(state.candidate.id);
  } catch (error) {
    if (error.status === 409 && error.body && error.body.currentVacancy) {
      state.vacancy = error.body.currentVacancy;
    }
    state.flash = errorMessage(error);
    state.flashKind = 'bad';
    await refreshAfterWrite(state.candidate.id);
  }
}

function onAddPanelMember() {
  const select = document.querySelector('[data-panel-add-select]');
  if (!(select instanceof HTMLSelectElement)) return;
  submitPanel('add', select.value);
}

async function onScoreSubmit(event) {
  event.preventDefault();
  if (!state.candidate || !state.vacancy) return;
  const form = event.currentTarget;
  const data = new FormData(form);
  const score = Number(data.get('score'));
  if (!Number.isInteger(score) || score < 1 || score > 5) return;
  try {
    await api(`/api/candidates/${encodeURIComponent(state.candidate.id)}/scores`, {
      method: 'POST',
      headers: {
        'X-Expected-Revision': String(state.vacancy.revision),
        'X-Operation-Id': crypto.randomUUID(),
      },
      body: { score },
    });
    state.flash = `Saved score ${score}.`;
    state.flashKind = 'info';
    await refreshAfterWrite(state.candidate.id);
  } catch (error) {
    if (error.status === 409 && error.body && error.body.currentVacancy) {
      state.vacancy = error.body.currentVacancy;
    }
    state.flash = errorMessage(error);
    state.flashKind = 'bad';
    await refreshAfterWrite(state.candidate.id);
  }
}

async function onNoteSubmit(event) {
  event.preventDefault();
  if (!state.candidate || !state.vacancy) return;
  const form = event.currentTarget;
  const data = new FormData(form);
  const text = String(data.get('text') || '').trim();
  if (!text) return;
  try {
    await api(`/api/candidates/${encodeURIComponent(state.candidate.id)}/notes`, {
      method: 'POST',
      headers: {
        'X-Expected-Revision': String(state.vacancy.revision),
        'X-Operation-Id': crypto.randomUUID(),
      },
      body: { text },
    });
    state.flash = 'Note added.';
    state.flashKind = 'info';
    form.reset();
    await refreshAfterWrite(state.candidate.id);
  } catch (error) {
    if (error.status === 409 && error.body && error.body.currentVacancy) {
      state.vacancy = error.body.currentVacancy;
    }
    state.flash = errorMessage(error);
    state.flashKind = 'bad';
    await refreshAfterWrite(state.candidate.id);
  }
}

function onBatchPick(event) {
  const input = event.currentTarget;
  if (!(input instanceof HTMLInputElement)) return;
  const candidateId = input.getAttribute('data-batch-pick') || '';
  if (!candidateId) return;
  if (input.checked) {
    if (!state.batchSelection.includes(candidateId)) {
      state.batchSelection = [...state.batchSelection, candidateId];
    }
  } else {
    state.batchSelection = state.batchSelection.filter((id) => id !== candidateId);
  }
  render();
}

async function openBatchReview() {
  if (!state.vacancy || !state.batchSelection.length) return;
  state.batchError = '';
  state.batchOperationId = crypto.randomUUID();
  state.batchRevision = state.vacancy.revision;
  try {
    const preview = await api(`/api/vacancies/${encodeURIComponent(state.vacancy.code)}/batch-preview`, {
      method: 'POST',
      body: { candidateIds: state.batchSelection },
    });
    state.batchPreview = preview;
    state.batchOpen = true;
    render();
  } catch (error) {
    state.batchError = errorMessage(error);
    state.batchPreview = null;
    state.batchOpen = true;
    render();
  }
}

function closeBatchModal() {
  state.batchOpen = false;
  state.batchError = '';
  render();
}

async function refreshBatchPreview() {
  if (!state.vacancy || !state.batchSelection.length) return;
  state.batchRevision = state.vacancy.revision;
  state.batchOperationId = crypto.randomUUID();
  state.batchWorking = false;
  state.batchError = '';
  try {
    const preview = await api(`/api/vacancies/${encodeURIComponent(state.vacancy.code)}/batch-preview`, {
      method: 'POST',
      body: { candidateIds: state.batchSelection },
    });
    state.batchPreview = preview;
  } catch (error) {
    state.batchError = errorMessage(error);
  }
  render();
}

async function confirmBatch() {
  if (!state.vacancy || !state.batchSelection.length || !state.batchPreview) return;
  state.batchWorking = true;
  state.batchError = '';
  render();
  try {
    const response = await api(`/api/vacancies/${encodeURIComponent(state.vacancy.code)}/batch-offers`, {
      method: 'POST',
      headers: {
        'X-Expected-Revision': String(state.batchRevision),
        'X-Operation-Id': state.batchOperationId,
      },
      body: { candidateIds: state.batchSelection },
    });
    state.flash = `Confirmed ${response.selection.length} offers.`;
    state.flashKind = 'info';
    state.batchWorking = false;
    state.batchOpen = false;
    state.batchSelection = [];
    state.batchPreview = null;
    state.batchMode = false;
    await refreshAfterWrite();
  } catch (error) {
    if (error.status === 409 && error.body && error.body.currentVacancy) {
      state.vacancy = error.body.currentVacancy;
    }
    state.batchWorking = false;
    state.batchError = errorMessage(error);
    if (error.body && error.body.currentVacancy) {
      state.batchRevision = error.body.currentVacancy.revision;
    }
    await refreshAfterWrite(state.selectedCandidateId, { preserveBatch: true });
    render();
  }
}

function drawFunnel() {
  const container = document.getElementById('funnel-chart');
  if (!container || !state.vacancy) return;
  const data = state.vacancy.funnel || [];
  const width = Math.max(container.clientWidth || 640, 280);
  const rowHeight = 54;
  const height = Math.max(data.length * rowHeight + 32, 180);
  container.innerHTML = '';
  if (!data.length || data.every((item) => item.reached === 0 && item.remain === 0 && item.lost === 0)) {
    container.innerHTML = '<div class="empty-state">No historical pipeline data yet. This vacancy is intentionally quiet.</div>';
    return;
  }
  const svg = d3.select(container).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Vacancy funnel');
  const maxReached = d3.max(data, (item) => item.reached) || 1;
  const scale = d3.scaleLinear().domain([0, maxReached]).range([44, width - 160]);
  const y = 18;
  const row = svg.selectAll('g.row').data(data).enter().append('g').attr('class', 'row').attr('transform', (_, index) => `translate(18, ${index * rowHeight + y})`);
  row.append('text')
    .attr('x', 0)
    .attr('y', 14)
    .attr('fill', 'currentColor')
    .attr('font-size', 14)
    .attr('font-weight', 700)
    .text((item) => item.stage);
  row.append('rect')
    .attr('x', 108)
    .attr('y', 0)
    .attr('height', 14)
    .attr('rx', 7)
    .attr('width', (item) => scale(item.reached))
    .attr('fill', 'rgba(49, 94, 251, 0.25)');
  row.append('rect')
    .attr('x', 108)
    .attr('y', 18)
    .attr('height', 14)
    .attr('rx', 7)
    .attr('width', (item) => Math.max(0, scale(item.remain)))
    .attr('fill', 'rgba(14, 159, 110, 0.35)');
  row.append('rect')
    .attr('x', 108)
    .attr('y', 36)
    .attr('height', 14)
    .attr('rx', 7)
    .attr('width', (item) => Math.max(0, scale(item.lost)))
    .attr('fill', 'rgba(180, 35, 24, 0.35)');
  row.append('text')
    .attr('x', (item) => 118 + scale(item.reached) + 8)
    .attr('y', 12)
    .attr('fill', 'currentColor')
    .attr('font-size', 12)
    .text((item) => `reached ${item.reached}`);
  row.append('text')
    .attr('x', (item) => 118 + scale(item.remain) + 8)
    .attr('y', 30)
    .attr('fill', 'currentColor')
    .attr('font-size', 12)
    .text((item) => `remain ${item.remain}`);
  row.append('text')
    .attr('x', (item) => 118 + scale(item.lost) + 8)
    .attr('y', 48)
    .attr('fill', 'currentColor')
    .attr('font-size', 12)
    .text((item) => `lost ${item.lost}`);
}

function stageTargets(stage) {
  if (stage === 'applied') return ['screening', 'withdrawn', 'rejected'];
  if (stage === 'screening') return ['applied', 'interview', 'withdrawn', 'rejected'];
  if (stage === 'interview') return ['screening', 'offer', 'withdrawn', 'rejected'];
  if (stage === 'offer') return ['interview', 'hired', 'withdrawn', 'rejected'];
  if (stage === 'hired') return ['offer', 'withdrawn', 'rejected'];
  return [];
}

function stageLabel(stage) {
  return {
    applied: 'Move to screening',
    screening: 'Move to applied / interview',
    interview: 'Move to screening / offer',
    offer: 'Move to interview / hired',
    hired: 'Move to offer',
    rejected: 'Reject',
    withdrawn: 'Withdraw',
  }[stage] || stage;
}

function stageShape(stage) {
  return {
    applied: '●',
    screening: '◐',
    interview: '◆',
    offer: '■',
    hired: '★',
    rejected: '×',
    withdrawn: '↩',
  }[stage] || '•';
}

function frozenMessageForStage(stage) {
  if (['offer', 'hired', 'rejected', 'withdrawn'].includes(stage)) {
    return 'Panel and score edits are unavailable here because this stage is frozen.';
  }
  return 'Panel edits are available while the candidate is applied, screening, or interview.';
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export class UI {
  private app: any;
  private store: any;

  constructor(app: any) {
    this.app = app;
    this.store = app.store;
    this.setupTheme();
  }

  private setupTheme() {
    const theme = this.store.getTheme();
    document.documentElement.setAttribute('data-theme', theme);
  }

  toggleTheme() {
    const current = this.store.getTheme();
    const newTheme = current === 'light' ? 'dark' : 'light';
    this.store.setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }

  showLoginPage(onLogin: (email: string, password: string) => void) {
    const root = document.getElementById('app')!;
    root.innerHTML = `
      <div class="login-container">
        <div class="login-box">
          <h1>Pellmoor Hiring</h1>
          <form id="login-form">
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" name="email" required>
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" name="password" required>
            </div>
            <button type="submit" class="btn btn-primary">Sign In</button>
          </form>
          <div class="demo-accounts">
            <p>Demo Accounts:</p>
            <ul>
              <li>hiring@pellmoor.test (Ruth Aldane, Hiring Manager)</li>
              <li>panel1@pellmoor.test (Otis Barre, Panel)</li>
              <li>panel2@pellmoor.test (Wren Foss, Panel)</li>
              <li>coord@pellmoor.test (Cal Meriden, Coordinator)</li>
            </ul>
            <p>Password: password123</p>
          </div>
        </div>
      </div>
    `;

    const form = document.getElementById('login-form')!;
    form.addEventListener('submit', (e: Event) => {
      e.preventDefault();
      const email = (document.getElementById('email') as HTMLInputElement)
        .value;
      const password = (document.getElementById('password') as HTMLInputElement)
        .value;
      onLogin(email, password);
    });
  }

  showWorkspace(currentUser: any, onLogout: () => void) {
    const root = document.getElementById('app')!;
    root.innerHTML = `
      <div class="workspace">
        <header class="workspace-header">
          <div class="header-left">
            <h1>Pellmoor Hiring</h1>
          </div>
          <div class="header-right">
            <button class="btn-theme" aria-label="Toggle theme">🌙</button>
            <div class="user-info">
              <span class="user-name">${currentUser.name}</span>
              <span class="user-role">${currentUser.role}</span>
            </div>
            <button class="btn btn-logout">Sign Out</button>
          </div>
        </header>
        <div class="workspace-body">
          <aside class="vacancies-sidebar">
            <div class="sidebar-header">
              <h2>Vacancies</h2>
            </div>
            <div id="vacancies-list" class="vacancies-list"></div>
          </aside>
          <main class="main-content">
            <div id="main-view" class="main-view">
              <div class="loading">Loading vacancies...</div>
            </div>
          </main>
          <aside id="candidate-drawer" class="candidate-drawer hidden">
            <div id="candidate-content"></div>
          </aside>
        </div>
      </div>
    `;

    // Theme button
    const themeBtn = document.querySelector('.btn-theme')!;
    themeBtn.addEventListener('click', () => {
      this.toggleTheme();
      const theme = this.store.getTheme();
      themeBtn.textContent = theme === 'light' ? '☀️' : '🌙';
    });

    // Logout button
    const logoutBtn = document.querySelector('.btn-logout')!;
    logoutBtn.addEventListener('click', onLogout);
  }

  updateVacanciesList(
    vacancies: any[],
    onSelect: (code: string) => void
  ) {
    const list = document.getElementById('vacancies-list')!;
    if (vacancies.length === 0) {
      list.innerHTML = '<p class="empty">No vacancies</p>';
      return;
    }

    list.innerHTML = vacancies
      .map(
        (v) => `
      <button class="vacancy-item" data-code="${v.code}">
        <div class="vacancy-title">${v.title}</div>
        <div class="vacancy-meta">${v.team} • ${v.openings} opening${v.openings !== 1 ? 's' : ''}</div>
        <div class="vacancy-stats">
          <span class="stat">📍 ${v.stageCounts.applied || 0}</span>
          <span class="stat">📋 ${v.stageCounts.screening || 0}</span>
          <span class="stat">💬 ${v.stageCounts.interview || 0}</span>
          <span class="stat">✅ ${v.stageCounts.hired || 0}</span>
        </div>
      </button>
    `
      )
      .join('');

    const items = list.querySelectorAll('.vacancy-item');
    items.forEach((item) => {
      item.addEventListener('click', () => {
        items.forEach((i) => i.classList.remove('active'));
        item.classList.add('active');
        const code = (item as HTMLElement).dataset.code!;
        onSelect(code);
      });
    });
  }

  showVacancyDetails(
    vacancy: any,
    currentUser: any,
    app: any
  ) {
    const main = document.getElementById('main-view')!;
    const candidateLists = this.groupCandidatesByStage(vacancy.candidates);

    main.innerHTML = `
      <div class="vacancy-view">
        <div class="vacancy-header">
          <div>
            <h2>${vacancy.title}</h2>
            <p class="vacancy-meta">${vacancy.team} • Role: ${vacancy.code}</p>
          </div>
          <div class="capacity-display">
            <div class="capacity-item">
              <span class="capacity-label">Filled</span>
              <span class="capacity-value">${vacancy.capacity.filled}</span>
            </div>
            <div class="capacity-item">
              <span class="capacity-label">Reserved</span>
              <span class="capacity-value">${vacancy.capacity.reserved}</span>
            </div>
            <div class="capacity-item">
              <span class="capacity-label">Available</span>
              <span class="capacity-value ${vacancy.capacity.available === 0 ? 'critical' : ''}">${vacancy.capacity.available}</span>
            </div>
            <div class="capacity-item">
              <span class="capacity-label">Total</span>
              <span class="capacity-value">${vacancy.capacity.total}</span>
            </div>
          </div>
        </div>

        ${currentUser.role === 'coordinator' ? `
          <div class="add-candidate-section">
            <form id="add-candidate-form" class="add-candidate-form">
              <input type="text" id="candidate-name" placeholder="Add new candidate" required>
              <button type="submit" class="btn btn-small">Add</button>
            </form>
          </div>
        ` : ''}

        <div class="funnel-section">
          <div id="funnel-chart" class="funnel-chart"></div>
        </div>

        <div class="pipeline-view">
          ${['applied', 'screening', 'interview', 'offer', 'hired'].map(stage => `
            <div class="pipeline-stage">
              <h3>${this.stageName(stage)}</h3>
              <div class="candidate-list">
                ${(candidateLists[stage] || []).map(c => `
                  <button class="candidate-card" data-id="${c.id}">
                    <div class="candidate-name">${c.name}</div>
                    <div class="candidate-meta">${c.daysInStage} days</div>
                  </button>
                `).join('')}
                ${(candidateLists[stage] || []).length === 0 ? '<p class="empty">No candidates</p>' : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Add candidate form
    if (currentUser.role === 'coordinator') {
      const form = document.getElementById('add-candidate-form') as HTMLFormElement;
      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = (document.getElementById('candidate-name') as HTMLInputElement).value;
        app.addCandidate(vacancy.code, name);
        form.reset();
      });
    }

    // Candidate selection
    const cards = main.querySelectorAll('.candidate-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const id = (card as HTMLElement).dataset.id!;
        app.selectCandidate(id);
      });
    });

    // Render funnel
    this.renderFunnel(vacancy.funnel);
  }

  private groupCandidatesByStage(candidates: any[]) {
    const grouped: Record<string, any[]> = {
      applied: [],
      screening: [],
      interview: [],
      offer: [],
      hired: [],
      rejected: [],
      withdrawn: [],
    };

    candidates.forEach((c) => {
      if (grouped[c.currentStage]) {
        grouped[c.currentStage].push({
          ...c,
          daysInStage: Math.floor(
            (Date.now() - new Date(c.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
          ),
        });
      }
    });

    return grouped;
  }

  private stageName(stage: string): string {
    const names: Record<string, string> = {
      applied: '📝 Applied',
      screening: '👁️ Screening',
      interview: '💬 Interview',
      offer: '💼 Offer',
      hired: '✅ Hired',
      rejected: '❌ Rejected',
      withdrawn: '↩️ Withdrawn',
    };
    return names[stage] || stage;
  }

  private renderFunnel(funnel: any) {
    const chart = document.getElementById('funnel-chart')!;
    if (!chart) return;

    const stages = ['applied', 'screening', 'interview', 'offer', 'hired'];
    const html = `
      <div class="funnel">
        ${stages.map((stage, i) => {
          const data = funnel[stage];
          const width = data.reached > 0 ? 100 - i * 15 : 0;
          return `
            <div class="funnel-stage" style="width: ${width}%">
              <div class="funnel-label">${this.stageName(stage)}</div>
              <div class="funnel-stats">
                <span>${data.reached} reached</span>
                ${data.remaining > 0 ? `<span>${data.remaining} remaining</span>` : ''}
                ${data.lost > 0 ? `<span class="lost">${data.lost} lost</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    chart.innerHTML = html;
  }

  showCandidateDetails(
    candidate: any,
    vacancy: any,
    currentUser: any,
    app: any
  ) {
    const drawer = document.getElementById('candidate-drawer')!;
    drawer.classList.remove('hidden');

    const content = document.getElementById('candidate-content')!;
    content.innerHTML = `
      <div class="candidate-details">
        <div class="candidate-header">
          <button class="btn-close" aria-label="Close">✕</button>
          <h2>${candidate.name}</h2>
          <p class="candidate-id">${candidate.id}</p>
        </div>

        <div class="candidate-stage-info">
          <div class="stage-badge" data-stage="${candidate.currentStage}">
            ${this.stageName(candidate.currentStage)}
          </div>
          <div class="assessment-version">v${candidate.assessmentVersion}</div>
        </div>

        <div class="candidate-timeline">
          <h3>Timeline</h3>
          ${candidate.history.map((h: any) => `
            <div class="timeline-item">
              <span class="timeline-stage">${this.stageName(h.stage)}</span>
              <span class="timeline-date">${new Date(h.timestamp).toLocaleDateString()}</span>
            </div>
          `).join('')}
        </div>

        ${candidate.panel ? `
          <div class="candidate-panel">
            <h3>Panel ${candidate.assessmentVersion > 1 ? `(v${candidate.assessmentVersion})` : ''}</h3>
            <div class="panel-members">
              ${candidate.panel.members.map((m: any) => `
                <div class="panel-member">
                  <div class="member-info">
                    <span class="member-name">${m.name}</span>
                    <span class="member-email">${m.email}</span>
                  </div>
                  <div class="member-score">
                    ${m.score ? `<span class="score">${m.score}/5</span>` : '<span class="no-score">No score</span>'}
                  </div>
                  ${currentUser.role === 'coordinator' && candidate.panelCanEdit ? `
                    <button class="btn-remove-member" data-member-id="${m.id}">Remove</button>
                  ` : ''}
                </div>
              `).join('')}
            </div>
            ${candidate.panelCanEdit ? `
              <div class="add-panel-member">
                <select id="panel-select">
                  <option value="">Add panel member...</option>
                  <option value="hiring@pellmoor.test">Ruth Aldane (Hiring Manager)</option>
                  <option value="panel1@pellmoor.test">Otis Barre</option>
                  <option value="panel2@pellmoor.test">Wren Foss</option>
                </select>
                <button class="btn btn-small" id="add-member-btn">Add</button>
              </div>
            ` : ''}
          </div>
        ` : `<p class="empty">No panel assigned</p>`}

        ${candidate.currentStage === 'interview' ? `
          <div class="scoring-section">
            <h3>Score</h3>
            <input type="number" id="score-input" min="1" max="5" placeholder="Enter score (1-5)">
            <button class="btn btn-small" id="submit-score">Record Score</button>
          </div>
        ` : ''}

        <div class="candidate-actions">
          ${this.getAvailableActions(candidate, currentUser).map(action => `
            <button class="btn btn-action" data-action="${action.id}">
              ${action.label}
            </button>
          `).join('')}
        </div>

        <div class="candidate-notes">
          <h3>Notes</h3>
          <div class="notes-list">
            ${candidate.notes.map((n: any) => `
              <div class="note">
                <div class="note-header">
                  <span class="note-author">${n.author_name}</span>
                  <span class="note-date">${new Date(n.created_at).toLocaleDateString()}</span>
                </div>
                <div class="note-content">${this.escapeHtml(n.content)}</div>
              </div>
            `).join('')}
          </div>
          <div class="add-note-form">
            <textarea id="note-input" placeholder="Add a note..."></textarea>
            <button class="btn btn-small" id="add-note-btn">Add Note</button>
          </div>
        </div>
      </div>
    `;

    // Close button
    content.querySelector('.btn-close')!.addEventListener('click', () => {
      drawer.classList.add('hidden');
    });

    // Actions
    const actionButtons = content.querySelectorAll('[data-action]');
    actionButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = (btn as HTMLElement).dataset.action!;
        this.handleCandidateAction(action, candidate, vacancy, app);
      });
    });

    // Score submission
    const scoreBtn = document.getElementById('submit-score');
    scoreBtn?.addEventListener('click', () => {
      const input = document.getElementById('score-input') as HTMLInputElement;
      const score = parseInt(input.value, 10);
      if (score >= 1 && score <= 5) {
        app.recordScore(candidate.id, score);
      }
    });

    // Add note
    const noteBtn = document.getElementById('add-note-btn');
    noteBtn?.addEventListener('click', () => {
      const textarea = document.getElementById('note-input') as HTMLTextAreaElement;
      if (textarea.value.trim()) {
        app.addNote(candidate.id, textarea.value.trim());
      }
    });

    // Add panel member
    const addMemberBtn = document.getElementById('add-member-btn');
    addMemberBtn?.addEventListener('click', () => {
      const select = document.getElementById('panel-select') as HTMLSelectElement;
      if (select.value) {
        app.addPanelMember(candidate.id, select.value);
      }
    });

    // Remove panel member
    const removeButtons = content.querySelectorAll('.btn-remove-member');
    removeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const memberId = (btn as HTMLElement).dataset.memberId!;
        app.removePanelMember(candidate.id, parseInt(memberId, 10));
      });
    });
  }

  private getAvailableActions(candidate: any, currentUser: any) {
    const actions = [];
    const stage = candidate.currentStage;

    if (currentUser.role === 'hiring manager') {
      if (stage === 'applied') actions.push({ id: 'to-screening', label: '→ Screening' });
      if (stage === 'screening') {
        actions.push({ id: 'to-interview', label: '→ Interview' });
        actions.push({ id: 'reject', label: '→ Rejected' });
      }
      if (stage === 'interview') {
        actions.push({ id: 'to-offer', label: '→ Offer' });
        actions.push({ id: 'to-screening', label: '← Back to Screening' });
        actions.push({ id: 'reject', label: '→ Rejected' });
      }
      if (stage === 'offer') {
        actions.push({ id: 'to-hired', label: '→ Hired' });
        actions.push({ id: 'to-interview', label: '← Back to Interview' });
      }
      if (stage === 'hired') {
        actions.push({ id: 'to-offer', label: '← Back to Offer' });
      }
    }

    if (stage !== 'rejected' && stage !== 'withdrawn') {
      actions.push({ id: 'withdraw', label: '→ Withdrawn' });
    }

    return actions;
  }

  private handleCandidateAction(
    action: string,
    candidate: any,
    vacancy: any,
    app: any
  ) {
    const stageMap: Record<string, string> = {
      'to-screening': 'screening',
      'to-interview': 'interview',
      'to-offer': 'offer',
      'to-hired': 'hired',
      reject: 'rejected',
      withdraw: 'withdrawn',
    };

    const nextStage = stageMap[action];
    if (nextStage) {
      app.moveCandidate(vacancy.code, candidate.id, nextStage, vacancy.revision);
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showError(message: string) {
    this.showNotification(message, 'error');
  }

  showSuccess(message: string) {
    this.showNotification(message, 'success');
  }

  private showNotification(message: string, type: string) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

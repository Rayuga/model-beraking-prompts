import {
  Candidate,
  User,
  VacancyFullDetails,
  ScoreRecord,
  NoteRecord,
  ActivityEvent
} from '../types';
import {
  updateCandidateStage,
  updatePanelAssignment,
  submitScore,
  addNote,
  generateOperationId,
  ApiError
} from '../api';

export interface CandidateDrawerCallbacks {
  onUpdated: (vacancy: VacancyFullDetails, updatedCandidate: Candidate) => void;
  onClose: () => void;
  onError: (error: ApiError | Error) => void;
}

export class CandidateDrawer {
  private container: HTMLElement;
  private candidate: Candidate | null = null;
  private vacancy: VacancyFullDetails | null = null;
  private currentUser: User | null = null;
  private callbacks: CandidateDrawerCallbacks;
  private isSubmitting: boolean = false;

  constructor(container: HTMLElement, callbacks: CandidateDrawerCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  public show(candidate: Candidate, vacancy: VacancyFullDetails, currentUser: User) {
    this.candidate = candidate;
    this.vacancy = vacancy;
    this.currentUser = currentUser;
    this.render();
  }

  public updateData(candidate: Candidate, vacancy: VacancyFullDetails) {
    this.candidate = candidate;
    this.vacancy = vacancy;
    this.render();
  }

  public close() {
    this.candidate = null;
    this.container.innerHTML = '';
    this.container.classList.remove('open');
    this.callbacks.onClose();
  }

  private render() {
    if (!this.candidate || !this.vacancy || !this.currentUser) {
      this.container.innerHTML = '';
      this.container.classList.remove('open');
      return;
    }

    const c = this.candidate;
    const v = this.vacancy.vacancy;
    const u = this.currentUser;

    this.container.classList.add('open');
    this.container.innerHTML = `
      <div class="drawer-backdrop" id="drawer-backdrop"></div>
      <div class="drawer-content" role="dialog" aria-modal="true" aria-labelledby="drawer-candidate-title">
        <div class="drawer-header">
          <div class="drawer-header-meta">
            <span class="cand-id-badge">${c.id}</span>
            <span class="cand-stage-badge stage-${c.stage}">${c.stage.toUpperCase()}</span>
            <span class="cand-version-badge">Assessment v${c.assessment_version}</span>
          </div>
          <h2 id="drawer-candidate-title" class="drawer-title">${c.name}</h2>
          <div class="drawer-subtitle">
            <span>Vacancy: <strong>${v.title} (${v.code})</strong></span>
            <span>•</span>
            <span>Applied: ${c.days_since_applied} days ago</span>
          </div>
          <button class="drawer-close-btn" id="drawer-close-btn" aria-label="Close drawer">&times;</button>
        </div>

        <div class="drawer-body">
          <!-- Stage Progress Bar -->
          <div class="drawer-section">
            <h3 class="section-heading">Pipeline Stage</h3>
            <div class="stage-stepper" role="list">
              ${['applied', 'screening', 'interview', 'offer', 'hired'].map(st => {
                const isCurrent = c.stage === st;
                const wasVisited = c.history.includes(st as any);
                const isTerminal = c.stage === 'rejected' || c.stage === 'withdrawn';
                return `
                  <div class="step-item ${isCurrent ? 'current' : ''} ${wasVisited ? 'visited' : ''}" role="listitem">
                    <div class="step-circle">${wasVisited ? '✓' : ''}</div>
                    <span class="step-name">${st}</span>
                  </div>
                `;
              }).join('')}
            </div>
            ${c.is_terminal ? `
              <div class="terminal-banner terminal-${c.stage}">
                <strong>Application ${c.stage.toUpperCase()}</strong>
                <p>This is a terminal record. Further stage progression is closed.</p>
              </div>
            ` : ''}
          </div>

          <!-- Offer Gate / Readiness Block -->
          ${c.stage === 'interview' ? `
            <div class="drawer-section offer-readiness-card ${c.offer_eligibility.eligible ? 'ready' : 'blocked'}">
              <div class="readiness-header">
                <span class="readiness-badge ${c.offer_eligibility.eligible ? 'badge-ready' : 'badge-blocked'}">
                  ${c.offer_eligibility.eligible ? '✓ OFFER READY' : '⚠ OFFER BLOCKED'}
                </span>
                <span class="readiness-summary">
                  ${c.offer_eligibility.eligible
                    ? `Assessment complete with ${c.current_scores.length} scores. ${v.available} opening(s) available.`
                    : 'Prerequisites must be met before an offer can be extended.'}
                </span>
              </div>
              ${!c.offer_eligibility.eligible ? `
                <ul class="blocked-reasons-list">
                  ${c.offer_eligibility.reasons.map(r => `<li>${r}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          ` : ''}

          <!-- Stage Actions (Ruth - Hiring Manager) -->
          <div class="drawer-section">
            <h3 class="section-heading">Stage Actions</h3>
            ${u.role === 'hiring manager' ? `
              ${!c.is_terminal ? `
                <div class="action-buttons-group">
                  ${this.renderStageButtons(c, v.available)}
                </div>
              ` : `
                <p class="section-hint">Terminal applications cannot be transitioned.</p>
              `}
            ` : `
              <div class="role-notice">
                <span>🔒 Only the hiring manager (Ruth Aldane) can change applicant stages.</span>
              </div>
            `}
          </div>

          <!-- Assessment Freshness & Scores -->
          <div class="drawer-section">
            <div class="section-heading-row">
              <h3 class="section-heading">Assessment Freshness & Scores</h3>
              <span class="version-tag">Current Version: ${c.assessment_version}</span>
            </div>
            <p class="section-hint">
              Advancing into interview or modifying the panel creates a fresh assessment version.
              Every assigned panel member must score again in the current version.
            </p>

            <div class="scores-container">
              <h4 class="sub-heading">Current Assessment (v${c.assessment_version})</h4>
              ${c.panel.length === 0 ? `
                <div class="empty-panel-notice">No panel members assigned yet.</div>
              ` : `
                <div class="scores-list">
                  ${c.panel.map(member => {
                    const scoreObj = c.current_scores.find(s => s.scorer_email === member.email);
                    return `
                      <div class="score-card">
                        <div class="score-card-member">
                          <strong>${member.name}</strong>
                          <span class="member-email">${member.email}</span>
                        </div>
                        <div class="score-card-val">
                          ${scoreObj ? `
                            <span class="score-badge val-${scoreObj.score}">${scoreObj.score} / 5</span>
                          ` : `
                            <span class="score-badge val-pending">Pending Score</span>
                          `}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}

              <!-- Interactive Scoring Controls -->
              ${this.renderScoringInput(c, u)}

              <!-- Historical Scores -->
              ${c.historical_scores.length > 0 ? `
                <div class="historical-scores-section">
                  <h4 class="sub-heading">Historical Scores</h4>
                  <div class="historical-scores-list">
                    ${c.historical_scores.map(s => `
                      <div class="historical-score-item">
                        <span class="hist-version">Version ${s.assessment_version}</span>
                        <span class="hist-scorer">${s.scorer_name}</span>
                        <span class="hist-score">${s.score} / 5</span>
                        <span class="hist-tag">Historical</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Interview Panel Arrangement (Coordinator - Cal) -->
          <div class="drawer-section">
            <h3 class="section-heading">Interview Panel</h3>
            ${c.is_frozen ? `
              <div class="frozen-banner">
                <span>🔒 Panel assignments are frozen in stage <strong>${c.stage}</strong>. Reopen interview to revise.</span>
              </div>
            ` : ''}

            <div class="panel-members-list">
              ${c.panel.length === 0 ? `
                <div class="empty-panel-notice">No panel members assigned. Minimum 2 required for offer.</div>
              ` : `
                ${c.panel.map(p => `
                  <div class="panel-member-row">
                    <div class="member-info">
                      <span class="member-name">${p.name}</span>
                      <span class="member-email">${p.email}</span>
                    </div>
                    ${(u.role === 'coordinator' && !c.is_frozen) ? `
                      <button class="btn btn-sm btn-danger remove-panel-btn" data-email="${p.email}">Remove</button>
                    ` : ''}
                  </div>
                `).join('')}
              `}
            </div>

            ${(u.role === 'coordinator' && !c.is_frozen) ? `
              <div class="add-panel-box">
                <label for="panel-member-select">Assign Panel Member:</label>
                <div class="add-panel-controls">
                  <select id="panel-member-select" class="form-select">
                    <option value="">-- Select eligible member --</option>
                    <option value="hiring@pellmoor.test" ${c.panel.some(p => p.email === 'hiring@pellmoor.test') ? 'disabled' : ''}>Ruth Aldane (Hiring Manager)</option>
                    <option value="panel1@pellmoor.test" ${c.panel.some(p => p.email === 'panel1@pellmoor.test') ? 'disabled' : ''}>Otis Barre (Panel)</option>
                    <option value="panel2@pellmoor.test" ${c.panel.some(p => p.email === 'panel2@pellmoor.test') ? 'disabled' : ''}>Wren Foss (Panel)</option>
                  </select>
                  <button id="add-panel-btn" class="btn btn-sm btn-primary">Add Member</button>
                </div>
              </div>
            ` : (u.role !== 'coordinator' ? `
              <div class="role-notice">
                <span>🔒 Only the coordinator (Cal Meriden) can modify panel assignments.</span>
              </div>
            ` : '')}
          </div>

          <!-- Notes Section (All Roles) -->
          <div class="drawer-section">
            <h3 class="section-heading">Notes</h3>
            <div class="notes-list">
              ${c.notes.length === 0 ? `
                <div class="empty-notes-notice">No notes recorded yet.</div>
              ` : `
                ${c.notes.map(n => `
                  <div class="note-card">
                    <div class="note-meta">
                      <strong>${n.author_name}</strong>
                      <span class="note-time">${new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <div class="note-text">${n.text}</div>
                  </div>
                `).join('')}
              `}
            </div>

            <div class="add-note-box">
              <label for="new-note-text">Add a note (append-only):</label>
              <textarea id="new-note-text" class="form-textarea" placeholder="Enter note observations..." rows="3"></textarea>
              <button id="submit-note-btn" class="btn btn-sm btn-secondary">Post Note</button>
            </div>
          </div>

          <!-- Activity Trail for Candidate -->
          <div class="drawer-section">
            <h3 class="section-heading">Candidate Activity Log</h3>
            <div class="candidate-activity-list">
              ${this.renderCandidateActivity(c.id, this.vacancy.activity)}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderStageButtons(c: Candidate, availableOpenings: number): string {
    const buttons: string[] = [];

    // Forward buttons
    if (c.stage === 'applied') {
      buttons.push(`<button class="btn btn-primary stage-action-btn" data-target="screening">Advance to Screening</button>`);
    } else if (c.stage === 'screening') {
      buttons.push(`<button class="btn btn-primary stage-action-btn" data-target="interview">Advance to Interview</button>`);
    } else if (c.stage === 'interview') {
      const isReady = c.offer_eligibility.eligible;
      buttons.push(`
        <button class="btn btn-success stage-action-btn ${!isReady ? 'disabled-btn' : ''}"
          data-target="offer"
          ${!isReady ? 'disabled' : ''}
          title="${!isReady ? c.offer_eligibility.reasons.join(', ') : 'Extend offer'}">
          Extend Offer
        </button>
      `);
    } else if (c.stage === 'offer') {
      buttons.push(`<button class="btn btn-success stage-action-btn" data-target="hired">Mark as Hired</button>`);
    }

    // Backstep buttons
    if (c.stage === 'screening') {
      buttons.push(`<button class="btn btn-outline stage-action-btn" data-target="applied">Return to Applied</button>`);
    } else if (c.stage === 'interview') {
      buttons.push(`<button class="btn btn-outline stage-action-btn" data-target="screening">Return to Screening</button>`);
    } else if (c.stage === 'offer') {
      buttons.push(`<button class="btn btn-outline stage-action-btn" data-target="interview">Reopen Interview</button>`);
    } else if (c.stage === 'hired') {
      buttons.push(`<button class="btn btn-outline stage-action-btn" data-target="offer">Reopen Offer</button>`);
    }

    // Terminal buttons
    buttons.push(`<button class="btn btn-danger-outline stage-action-btn" data-target="rejected">Reject</button>`);
    buttons.push(`<button class="btn btn-neutral-outline stage-action-btn" data-target="withdrawn">Withdraw</button>`);

    return buttons.join('');
  }

  private renderScoringInput(c: Candidate, u: User): string {
    if (c.stage !== 'interview') {
      return ``;
    }

    const isAssigned = c.panel.some(p => p.email === u.email);
    if (!isAssigned) {
      return ``;
    }

    const currentScore = c.current_scores.find(s => s.scorer_email === u.email);

    return `
      <div class="submit-score-box">
        <label><strong>Your Score as ${u.name} (v${c.assessment_version}):</strong></label>
        <div class="score-input-row">
          <div class="score-radios" role="radiogroup" aria-label="Score from 1 to 5">
            ${[1, 2, 3, 4, 5].map(val => `
              <label class="score-radio-label ${currentScore?.score === val ? 'selected' : ''}">
                <input type="radio" name="candidate-score" value="${val}" ${currentScore?.score === val ? 'checked' : ''}>
                <span>${val}</span>
              </label>
            `).join('')}
          </div>
          <button id="submit-score-btn" class="btn btn-primary btn-sm">
            ${currentScore ? 'Update Score' : 'Submit Score'}
          </button>
        </div>
      </div>
    `;
  }

  private renderCandidateActivity(candidateId: string, activityList: ActivityEvent[]): string {
    const events = activityList.filter(a => a.candidate_id === candidateId);
    if (events.length === 0) {
      return `<div class="empty-activity-notice">No recorded activity for this candidate.</div>`;
    }

    return events.map(a => `
      <div class="activity-timeline-item">
        <div class="activity-header">
          <span class="activity-type-tag tag-${a.action_type}">${a.action_type.replace('_', ' ')}</span>
          <span class="activity-time">${new Date(a.created_at).toLocaleString()}</span>
        </div>
        <div class="activity-desc">${a.description}</div>
        <div class="activity-actor">by ${a.actor_name} (${a.actor_email})</div>
      </div>
    `).join('');
  }

  private bindEvents() {
    if (!this.candidate || !this.vacancy || !this.currentUser) return;
    const c = this.candidate;
    const v = this.vacancy;

    // Close buttons
    const closeBtn = this.container.querySelector('#drawer-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
    const backdrop = this.container.querySelector('#drawer-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => this.close());
    }

    // Stage Action Buttons
    const stageBtns = this.container.querySelectorAll('.stage-action-btn');
    stageBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (this.isSubmitting) return;
        const targetStage = (e.currentTarget as HTMLElement).getAttribute('data-target');
        if (!targetStage) return;

        try {
          this.isSubmitting = true;
          const opId = generateOperationId();
          const res = await updateCandidateStage(c.id, targetStage, v.vacancy.revision, opId);
          this.isSubmitting = false;
          this.callbacks.onUpdated(res.vacancy, res.candidate);
        } catch (err: any) {
          this.isSubmitting = false;
          this.callbacks.onError(err);
        }
      });
    });

    // Score Submission
    const submitScoreBtn = this.container.querySelector('#submit-score-btn');
    if (submitScoreBtn) {
      submitScoreBtn.addEventListener('click', async () => {
        if (this.isSubmitting) return;
        const selectedRadio = this.container.querySelector('input[name="candidate-score"]:checked') as HTMLInputElement;
        if (!selectedRadio) {
          alert('Please select a score from 1 to 5');
          return;
        }
        const scoreVal = parseInt(selectedRadio.value, 10);

        try {
          this.isSubmitting = true;
          const opId = generateOperationId();
          const res = await submitScore(c.id, scoreVal, v.vacancy.revision, opId);
          this.isSubmitting = false;
          this.callbacks.onUpdated(res.vacancy, res.candidate);
        } catch (err: any) {
          this.isSubmitting = false;
          this.callbacks.onError(err);
        }
      });
    }

    // Add Panel Member
    const addPanelBtn = this.container.querySelector('#add-panel-btn');
    if (addPanelBtn) {
      addPanelBtn.addEventListener('click', async () => {
        if (this.isSubmitting) return;
        const select = this.container.querySelector('#panel-member-select') as HTMLSelectElement;
        const email = select?.value;
        if (!email) {
          alert('Please select an eligible panel member');
          return;
        }

        try {
          this.isSubmitting = true;
          const opId = generateOperationId();
          const res = await updatePanelAssignment(c.id, 'add', email, v.vacancy.revision, opId);
          this.isSubmitting = false;
          this.callbacks.onUpdated(res.vacancy, res.candidate);
        } catch (err: any) {
          this.isSubmitting = false;
          this.callbacks.onError(err);
        }
      });
    }

    // Remove Panel Member
    const removeBtns = this.container.querySelectorAll('.remove-panel-btn');
    removeBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (this.isSubmitting) return;
        const email = (e.currentTarget as HTMLElement).getAttribute('data-email');
        if (!email) return;

        try {
          this.isSubmitting = true;
          const opId = generateOperationId();
          const res = await updatePanelAssignment(c.id, 'remove', email, v.vacancy.revision, opId);
          this.isSubmitting = false;
          this.callbacks.onUpdated(res.vacancy, res.candidate);
        } catch (err: any) {
          this.isSubmitting = false;
          this.callbacks.onError(err);
        }
      });
    });

    // Add Note
    const submitNoteBtn = this.container.querySelector('#submit-note-btn');
    if (submitNoteBtn) {
      submitNoteBtn.addEventListener('click', async () => {
        if (this.isSubmitting) return;
        const textarea = this.container.querySelector('#new-note-text') as HTMLTextAreaElement;
        const noteText = textarea?.value?.trim();
        if (!noteText) {
          alert('Please enter note text');
          return;
        }

        try {
          this.isSubmitting = true;
          const opId = generateOperationId();
          const res = await addNote(c.id, noteText, v.vacancy.revision, opId);
          this.isSubmitting = false;
          this.callbacks.onUpdated(res.vacancy, res.candidate);
        } catch (err: any) {
          this.isSubmitting = false;
          this.callbacks.onError(err);
        }
      });
    }
  }
}

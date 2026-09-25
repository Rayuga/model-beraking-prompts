import {
  VacancySummary,
  VacancyFullDetails,
  Candidate,
  User,
  Stage
} from '../types';
import { renderFunnel } from './funnel';

export interface VacancyViewCallbacks {
  onSelectVacancy: (code: string) => void;
  onOpenCandidate: (candidate: Candidate) => void;
  onOpenAddCandidate: () => void;
  onOpenBatchOffers: () => void;
  onRefresh: () => void;
}

const STAGES_LIST: Stage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn'];

export class VacancyView {
  private container: HTMLElement;
  private vacancies: VacancySummary[];
  private currentDetails: VacancyFullDetails | null;
  private currentUser: User;
  private callbacks: VacancyViewCallbacks;
  private activeTab: 'pipeline' | 'activity' = 'pipeline';

  constructor(
    container: HTMLElement,
    vacancies: VacancySummary[],
    currentDetails: VacancyFullDetails | null,
    currentUser: User,
    callbacks: VacancyViewCallbacks
  ) {
    this.container = container;
    this.vacancies = vacancies;
    this.currentDetails = currentDetails;
    this.currentUser = currentUser;
    this.callbacks = callbacks;
    this.render();
  }

  public update(vacancies: VacancySummary[], currentDetails: VacancyFullDetails | null) {
    this.vacancies = vacancies;
    this.currentDetails = currentDetails;
    this.render();
  }

  public render() {
    if (!this.currentDetails) {
      this.container.innerHTML = `<div class="loading-state">Loading vacancy workspace...</div>`;
      return;
    }

    const v = this.currentDetails.vacancy;
    const candidates = this.currentDetails.candidates;
    const activity = this.currentDetails.activity;
    const u = this.currentUser;

    this.container.innerHTML = `
      <div class="workspace-layout">
        <!-- Vacancy Selector Tabs -->
        <nav class="vacancy-nav-tabs" aria-label="Vacancies">
          ${this.vacancies.map(vac => {
            const isSelected = vac.code === v.code;
            return `
              <button class="vacancy-tab-btn ${isSelected ? 'active' : ''}" data-code="${vac.code}">
                <div class="tab-top-row">
                  <span class="tab-role-title">${vac.title}</span>
                  <span class="tab-code-badge">${vac.code}</span>
                </div>
                <div class="tab-meta-row">
                  <span class="tab-team">${vac.team}</span>
                  <span class="tab-cand-count">${vac.candidate_count} applicants</span>
                  <span class="tab-avail-badge ${vac.available === 0 ? 'full' : ''}">${vac.available} open</span>
                </div>
              </button>
            `;
          }).join('')}
        </nav>

        <!-- Main Vacancy Area -->
        <main class="vacancy-main-content">
          <!-- Vacancy Header Card -->
          <div class="vacancy-header-card">
            <div class="vacancy-title-section">
              <div class="vacancy-badges">
                <span class="vacancy-code-tag">${v.code}</span>
                <span class="vacancy-team-tag">${v.team} Team</span>
                <span class="vacancy-revision-tag" title="Revision counter for optimistic concurrency">Rev ${v.revision}</span>
              </div>
              <h2 class="vacancy-main-title">${v.title}</h2>
            </div>

            <!-- Capacity Control -->
            <div class="vacancy-capacity-bar-card">
              <div class="cap-header">
                <span class="cap-title"><strong>Openings & Capacity:</strong> ${v.openings} Total</span>
                <span class="cap-status ${v.available > 0 ? 'has-openings' : 'no-openings'}">
                  ${v.available > 0 ? `${v.available} Opening(s) Available` : 'All Openings Committed'}
                </span>
              </div>
              <div class="segmented-capacity-bar" role="progressbar" aria-valuenow="${v.reserved + v.filled}" aria-valuemin="0" aria-valuemax="${v.openings}">
                <div class="seg seg-filled" style="width: ${(v.filled / Math.max(1, v.openings)) * 100}%;" title="${v.filled} Hired / Filled"></div>
                <div class="seg seg-reserved" style="width: ${(v.reserved / Math.max(1, v.openings)) * 100}%;" title="${v.reserved} Offer Reserved"></div>
                <div class="seg seg-available" style="width: ${(v.available / Math.max(1, v.openings)) * 100}%;" title="${v.available} Available"></div>
              </div>
              <div class="cap-legend">
                <span class="legend-item"><span class="dot dot-filled"></span> ${v.filled} Filled (Hired)</span>
                <span class="legend-item"><span class="dot dot-reserved"></span> ${v.reserved} Reserved (Offer)</span>
                <span class="legend-item"><span class="dot dot-available"></span> ${v.available} Available</span>
              </div>
            </div>

            <!-- Header Action Buttons -->
            <div class="vacancy-actions-row">
              ${u.role === 'coordinator' ? `
                <button id="add-candidate-btn" class="btn btn-primary" title="Add new candidate to this vacancy">
                  + Add Candidate
                </button>
              ` : ''}

              ${u.role === 'hiring manager' ? `
                <button id="batch-offers-btn" class="btn btn-secondary" title="Review and extend batch offers">
                  ⚡ Batch Offers
                </button>
              ` : ''}

              <button id="refresh-vacancy-btn" class="btn btn-outline btn-icon" title="Refresh latest state">
                ↻ Refresh
              </button>
            </div>
          </div>

          <!-- Funnel Chart Section -->
          <section class="vacancy-section funnel-section">
            <div class="section-header">
              <h3 class="section-title">Pipeline Funnel (D3)</h3>
              <span class="section-sub">Derived directly from candidate stage visit history</span>
            </div>
            <div id="funnel-container" class="funnel-container"></div>
          </section>

          <!-- Workspace View Tabs (Pipeline vs Activity) -->
          <div class="view-switch-tabs">
            <button class="view-tab-btn ${this.activeTab === 'pipeline' ? 'active' : ''}" id="tab-pipeline-btn">
              Candidates Pipeline (${candidates.length})
            </button>
            <button class="view-tab-btn ${this.activeTab === 'activity' ? 'active' : ''}" id="tab-activity-btn">
              Vacancy Activity Trail (${activity.length})
            </button>
          </div>

          <!-- Tab 1: Candidates Pipeline Board -->
          ${this.activeTab === 'pipeline' ? `
            <div class="pipeline-board">
              ${this.renderPipelineBoard(candidates)}
            </div>
          ` : `
            <!-- Tab 2: Activity Trail -->
            <div class="activity-trail-view">
              ${this.renderActivityTrail(activity)}
            </div>
          `}
        </main>
      </div>
    `;

    // Render D3 Funnel
    const funnelContainer = this.container.querySelector('#funnel-container') as HTMLElement;
    if (funnelContainer) {
      renderFunnel(funnelContainer, this.currentDetails.funnel);
    }

    this.bindEvents();
  }

  private renderPipelineBoard(candidates: Candidate[]): string {
    const activeStages: Stage[] = ['applied', 'screening', 'interview', 'offer', 'hired'];
    const terminalStages: Stage[] = ['rejected', 'withdrawn'];

    return `
      <div class="pipeline-stages-grid">
        ${activeStages.map(st => {
          const stageCands = candidates.filter(c => c.stage === st);
          return `
            <div class="pipeline-column stage-col-${st}">
              <div class="col-header">
                <span class="col-title">${st.toUpperCase()}</span>
                <span class="col-count">${stageCands.length}</span>
              </div>
              <div class="col-cards-list">
                ${stageCands.length === 0 ? `
                  <div class="col-empty-card">No candidates</div>
                ` : `
                  ${stageCands.map(c => this.renderCandidateCard(c)).join('')}
                `}
              </div>
            </div>
          `;
        }).join('')}

        <!-- Terminal Column -->
        <div class="pipeline-column stage-col-terminal">
          <div class="col-header">
            <span class="col-title">TERMINAL</span>
            <span class="col-count">${candidates.filter(c => terminalStages.includes(c.stage)).length}</span>
          </div>
          <div class="col-cards-list">
            ${candidates.filter(c => terminalStages.includes(c.stage)).map(c => this.renderCandidateCard(c)).join('')}
          </div>
        </div>
      </div>
    `;
  }

  private renderCandidateCard(c: Candidate): string {
    const isInterview = c.stage === 'interview';
    const isReady = c.offer_eligibility?.eligible;

    return `
      <div class="candidate-card ${c.is_terminal ? 'card-terminal' : ''}" data-cand-id="${c.id}" tabindex="0" role="button" aria-label="Candidate ${c.name}, ${c.stage}">
        <div class="card-top-row">
          <strong class="cand-name">${c.name}</strong>
          <span class="cand-id">${c.id}</span>
        </div>

        <div class="card-meta-row">
          <span class="cand-stage-pill stage-${c.stage}">${c.stage}</span>
          <span class="cand-version-pill">v${c.assessment_version}</span>
          <span class="cand-days">${c.days_since_applied}d</span>
        </div>

        ${isInterview ? `
          <div class="card-readiness-row">
            ${isReady ? `
              <span class="readiness-pill ready">✓ Offer Ready</span>
            ` : `
              <span class="readiness-pill blocked" title="${c.offer_eligibility?.reasons?.join('; ')}">⚠ Blocked</span>
            `}
            <span class="score-summary">
              ${c.current_scores.length}/${c.panel.length} scored
            </span>
          </div>
        ` : ''}

        ${c.panel.length > 0 ? `
          <div class="card-panel-row">
            <span class="panel-icon" aria-hidden="true">👥</span>
            <span class="panel-names">${c.panel.map(p => p.name.split(' ')[0]).join(', ')}</span>
          </div>
        ` : ''}

        ${c.notes.length > 0 ? `
          <div class="card-notes-count">
            💬 ${c.notes.length} note${c.notes.length === 1 ? '' : 's'}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderActivityTrail(activity: any[]): string {
    if (activity.length === 0) {
      return `<div class="empty-activity-box">No recorded activity for this vacancy yet.</div>`;
    }

    return `
      <div class="activity-table-wrapper">
        <table class="activity-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Description</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            ${activity.map(a => `
              <tr>
                <td class="cell-time">${new Date(a.created_at).toLocaleTimeString()}</td>
                <td class="cell-type"><span class="activity-badge badge-${a.action_type}">${a.action_type.replace('_', ' ')}</span></td>
                <td class="cell-desc">${a.description}</td>
                <td class="cell-actor">${a.actor_name}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  private bindEvents() {
    // Vacancy nav tabs click
    const tabBtns = this.container.querySelectorAll('.vacancy-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.getAttribute('data-code');
        if (code) this.callbacks.onSelectVacancy(code);
      });
    });

    // Add Candidate button
    const addCandBtn = this.container.querySelector('#add-candidate-btn');
    if (addCandBtn) {
      addCandBtn.addEventListener('click', () => {
        this.callbacks.onOpenAddCandidate();
      });
    }

    // Batch Offers button
    const batchBtn = this.container.querySelector('#batch-offers-btn');
    if (batchBtn) {
      batchBtn.addEventListener('click', () => {
        this.callbacks.onOpenBatchOffers();
      });
    }

    // Refresh button
    const refreshBtn = this.container.querySelector('#refresh-vacancy-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.callbacks.onRefresh();
      });
    }

    // Candidate card click
    const candCards = this.container.querySelectorAll('.candidate-card');
    candCards.forEach(card => {
      const openCard = () => {
        const id = card.getAttribute('data-cand-id');
        if (!id || !this.currentDetails) return;
        const cand = this.currentDetails.candidates.find(c => c.id === id);
        if (cand) this.callbacks.onOpenCandidate(cand);
      };

      card.addEventListener('click', openCard);
      card.addEventListener('keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          e.preventDefault();
          openCard();
        }
      });
    });

    // Tab Switchers (Pipeline vs Activity)
    const pipelineTabBtn = this.container.querySelector('#tab-pipeline-btn');
    if (pipelineTabBtn) {
      pipelineTabBtn.addEventListener('click', () => {
        this.activeTab = 'pipeline';
        this.render();
      });
    }
    const activityTabBtn = this.container.querySelector('#tab-activity-btn');
    if (activityTabBtn) {
      activityTabBtn.addEventListener('click', () => {
        this.activeTab = 'activity';
        this.render();
      });
    }
  }
}

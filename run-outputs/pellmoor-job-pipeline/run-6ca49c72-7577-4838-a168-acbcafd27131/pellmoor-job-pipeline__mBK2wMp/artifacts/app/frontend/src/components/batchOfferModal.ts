import {
  VacancyFullDetails,
  Candidate,
  BatchPreviewResponse
} from '../types';
import {
  previewBatchOffers,
  commitBatchOffers,
  generateOperationId,
  ApiError
} from '../api';

export interface BatchOfferModalCallbacks {
  onCompleted: (updatedVacancy: VacancyFullDetails) => void;
  onClose: () => void;
  onError: (error: ApiError | Error) => void;
}

type Step = 'select' | 'review' | 'success';

export class BatchOfferModal {
  private container: HTMLElement;
  private vacancy: VacancyFullDetails;
  private callbacks: BatchOfferModalCallbacks;
  private currentStep: Step = 'select';
  private selectedCandidateIds: string[] = [];
  private previewData: BatchPreviewResponse | null = null;
  private isSubmitting: boolean = false;
  private currentOperationId: string = '';
  private lastReviewedRevision: number = 0;
  private successResult: { batch_id: string; batch_size: number } | null = null;
  private conflictMessage: string | null = null;

  constructor(container: HTMLElement, vacancy: VacancyFullDetails, callbacks: BatchOfferModalCallbacks) {
    this.container = container;
    this.vacancy = vacancy;
    this.callbacks = callbacks;
    this.currentOperationId = generateOperationId();
    this.lastReviewedRevision = vacancy.vacancy.revision;
  }

  public show() {
    // By default, select all currently eligible interview candidates
    const interviewCandidates = this.vacancy.candidates.filter(c => c.stage === 'interview');
    this.selectedCandidateIds = interviewCandidates
      .filter(c => c.offer_eligibility.eligible)
      .map(c => c.id);

    this.currentStep = 'select';
    this.render();
  }

  public updateVacancy(vacancy: VacancyFullDetails) {
    this.vacancy = vacancy;
    this.render();
  }

  public close() {
    this.container.innerHTML = '';
    this.container.classList.remove('open');
    this.callbacks.onClose();
  }

  private render() {
    this.container.classList.add('open');
    this.container.innerHTML = `
      <div class="modal-backdrop" id="modal-backdrop"></div>
      <div class="modal-dialog modal-batch" role="dialog" aria-modal="true" aria-labelledby="batch-modal-title">
        <div class="modal-header">
          <div>
            <h2 id="batch-modal-title" class="modal-title">Atomic Batch Offers</h2>
            <div class="modal-subtitle">
              <span>Vacancy: <strong>${this.vacancy.vacancy.title} (${this.vacancy.vacancy.code})</strong></span>
              <span>•</span>
              <span>Revision: ${this.vacancy.vacancy.revision}</span>
            </div>
          </div>
          <button class="modal-close-btn" id="modal-close-btn" aria-label="Close modal">&times;</button>
        </div>

        <div class="modal-body">
          ${this.conflictMessage ? `
            <div class="conflict-alert" role="alert">
              <strong>⚠ State Conflict (409)</strong>
              <p>${this.conflictMessage}</p>
            </div>
          ` : ''}

          ${this.currentStep === 'select' ? this.renderSelectStep() : ''}
          ${this.currentStep === 'review' ? this.renderReviewStep() : ''}
          ${this.currentStep === 'success' ? this.renderSuccessStep() : ''}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderSelectStep(): string {
    const v = this.vacancy.vacancy;
    const interviewCandidates = this.vacancy.candidates.filter(c => c.stage === 'interview');
    const selectedCount = this.selectedCandidateIds.length;
    const projectedReserved = v.reserved + selectedCount;
    const projectedAvailable = Math.max(0, v.openings - projectedReserved - v.filled);

    return `
      <div class="batch-step-content">
        <div class="batch-capacity-preview">
          <div class="capacity-box">
            <span class="cap-lbl">Current Openings</span>
            <span class="cap-val">${v.openings} Total</span>
            <div class="cap-breakdown">
              <span>${v.reserved} Reserved</span> • <span>${v.filled} Filled</span> • <strong class="available-txt">${v.available} Available</strong>
            </div>
          </div>
          <div class="capacity-arrow">➜</div>
          <div class="capacity-box projected">
            <span class="cap-lbl">Projected Capacity</span>
            <span class="cap-val">${selectedCount} Selected</span>
            <div class="cap-breakdown">
              <span>${projectedReserved} Reserved</span> • <span>${v.filled} Filled</span> • <strong class="${projectedAvailable < 0 || selectedCount > v.available ? 'overbooked-txt' : 'available-txt'}">${projectedAvailable} Available</strong>
            </div>
          </div>
        </div>

        <h3 class="sub-heading">Select Interview Applicants for Offer</h3>
        <p class="section-hint">
          Every selected candidate must have at least 2 panel members, no lone hiring manager, and full scores in their current assessment version.
        </p>

        ${interviewCandidates.length === 0 ? `
          <div class="empty-batch-notice">
            No candidates are currently in the <strong>Interview</strong> stage for this vacancy.
          </div>
        ` : `
          <div class="batch-candidate-checklist">
            ${interviewCandidates.map(c => {
              const isChecked = this.selectedCandidateIds.includes(c.id);
              const isEligible = c.offer_eligibility.eligible;
              return `
                <label class="batch-cand-row ${!isEligible ? 'ineligible-row' : ''} ${isChecked ? 'checked' : ''}">
                  <input type="checkbox" class="batch-cand-checkbox" value="${c.id}" ${isChecked ? 'checked' : ''}>
                  <div class="batch-cand-info">
                    <div class="cand-name-row">
                      <strong>${c.name}</strong>
                      <span class="cand-id">${c.id}</span>
                      <span class="cand-ver">v${c.assessment_version}</span>
                    </div>
                    <div class="cand-details-row">
                      <span>Panel: ${c.panel.length} assigned (${c.panel.map(p => p.name.split(' ')[0]).join(', ') || 'None'})</span>
                      <span>•</span>
                      <span>Scores: ${c.current_scores.length}/${c.panel.length} submitted</span>
                    </div>
                    ${!isEligible ? `
                      <div class="ineligible-reasons-inline">
                        ⚠ ${c.offer_eligibility.reasons.join('; ')}
                      </div>
                    ` : `
                      <div class="eligible-badge-inline">✓ Complete Assessment</div>
                    `}
                  </div>
                </label>
              `;
            }).join('')}
          </div>
        `}

        <div class="modal-footer">
          <button id="cancel-batch-btn" class="btn btn-outline">Cancel</button>
          <button id="review-batch-btn" class="btn btn-primary" ${selectedCount === 0 ? 'disabled' : ''}>
            Review ${selectedCount} Selected Offer${selectedCount === 1 ? '' : 's'} ➜
          </button>
        </div>
      </div>
    `;
  }

  private renderReviewStep(): string {
    if (!this.previewData) return '';
    const p = this.previewData;

    return `
      <div class="batch-step-content">
        <div class="review-summary-card ${p.batch_eligible ? 'ready' : 'blocked'}">
          <div class="summary-header">
            <span class="summary-status-badge ${p.batch_eligible ? 'badge-ready' : 'badge-blocked'}">
              ${p.batch_eligible ? '✓ BATCH READY TO EXTEND' : '⚠ BATCH INELIGIBLE'}
            </span>
            <span class="summary-count-txt">
              ${p.selected_count} applicant${p.selected_count === 1 ? '' : 's'} selected
            </span>
          </div>

          <div class="capacity-review-grid">
            <div class="cap-review-item">
              <span class="rev-lbl">Available Before</span>
              <span class="rev-val">${p.current_capacity.available}</span>
            </div>
            <div class="cap-review-item">
              <span class="rev-lbl">Offers Requested</span>
              <span class="rev-val">${p.selected_count}</span>
            </div>
            <div class="cap-review-item">
              <span class="rev-lbl">Available After</span>
              <span class="rev-val ${p.projected_capacity.available < 0 ? 'overbooked-txt' : ''}">${p.projected_capacity.available}</span>
            </div>
          </div>

          ${!p.batch_eligible ? `
            <div class="batch-blockers-box">
              <strong>Batch cannot be confirmed for the following reasons:</strong>
              <ul>
                ${p.batch_ineligible_reasons.map(r => `<li>${r}</li>`).join('')}
              </ul>
            </div>
          ` : `
            <div class="batch-guarantee-note">
              This batch offer executes atomically. All ${p.selected_count} candidate(s) will move to Offer, reserving ${p.selected_count} opening(s) and advancing the vacancy revision exactly once.
            </div>
          `}
        </div>

        <h3 class="sub-heading">Selected Applicants (${p.candidates.length})</h3>
        <div class="review-candidates-list">
          ${p.candidates.map((cand, idx) => `
            <div class="review-cand-item ${!cand.eligible ? 'item-ineligible' : ''}">
              <div class="cand-item-header">
                <span class="cand-order">#${idx + 1}</span>
                <strong class="cand-name">${cand.name}</strong>
                <span class="cand-id">${cand.id}</span>
                <span class="cand-ver">Assessment v${cand.assessment_version}</span>
                <span class="cand-elig-badge ${cand.eligible ? 'elig-yes' : 'elig-no'}">
                  ${cand.eligible ? 'Eligible' : 'Ineligible'}
                </span>
              </div>
              ${!cand.eligible ? `
                <div class="cand-reasons-box">
                  ${cand.reasons.map(r => `<span>• ${r}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div class="modal-footer">
          <button id="back-to-select-btn" class="btn btn-outline" ${this.isSubmitting ? 'disabled' : ''}>← Back to Selection</button>
          <button id="confirm-batch-btn" class="btn btn-success"
            ${(!p.batch_eligible || this.isSubmitting) ? 'disabled' : ''}>
            ${this.isSubmitting ? 'Confirming Batch Offers...' : `Confirm & Extend ${p.selected_count} Offer${p.selected_count === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    `;
  }

  private renderSuccessStep(): string {
    const res = this.successResult;
    if (!res) return '';

    return `
      <div class="batch-step-content success-step">
        <div class="success-icon" aria-hidden="true">✓</div>
        <h3 class="success-title">Batch Offers Successfully Extended!</h3>
        <p class="success-desc">
          ${res.batch_size} candidate(s) have been transitioned to the <strong>Offer</strong> stage.
        </p>

        <div class="batch-receipt-card">
          <div class="receipt-row">
            <span class="receipt-lbl">Batch Operation ID</span>
            <span class="receipt-val batch-id-txt">${res.batch_id}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-lbl">Vacancy</span>
            <span class="receipt-val">${this.vacancy.vacancy.title} (${this.vacancy.vacancy.code})</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-lbl">Offers Extended</span>
            <span class="receipt-val">${res.batch_size}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-lbl">New Vacancy Revision</span>
            <span class="receipt-val">${this.vacancy.vacancy.revision}</span>
          </div>
        </div>

        <div class="modal-footer center-footer">
          <button id="finish-batch-btn" class="btn btn-primary">Done & View Pipeline</button>
        </div>
      </div>
    `;
  }

  private bindEvents() {
    // Close / Backdrop
    const closeBtn = this.container.querySelector('#modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
    const backdrop = this.container.querySelector('#modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        if (!this.isSubmitting) this.close();
      });
    }

    // Checkbox toggles in Select step
    const checkboxes = this.container.querySelectorAll('.batch-cand-checkbox');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', (e) => {
        const input = e.target as HTMLInputElement;
        const val = input.value;
        if (input.checked) {
          if (!this.selectedCandidateIds.includes(val)) {
            this.selectedCandidateIds.push(val);
          }
        } else {
          this.selectedCandidateIds = this.selectedCandidateIds.filter(id => id !== val);
        }
        this.render();
      });
    });

    // Cancel Button
    const cancelBtn = this.container.querySelector('#cancel-batch-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }

    // Review Button
    const reviewBtn = this.container.querySelector('#review-batch-btn');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', async () => {
        if (this.selectedCandidateIds.length === 0) return;
        try {
          this.conflictMessage = null;
          const preview = await previewBatchOffers(this.vacancy.vacancy.code, this.selectedCandidateIds);
          this.previewData = preview;
          this.lastReviewedRevision = this.vacancy.vacancy.revision;
          this.currentStep = 'review';
          this.render();
        } catch (err: any) {
          this.callbacks.onError(err);
        }
      });
    }

    // Back Button
    const backBtn = this.container.querySelector('#back-to-select-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.currentStep = 'select';
        this.render();
      });
    }

    // Confirm Batch Offers Button
    const confirmBtn = this.container.querySelector('#confirm-batch-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (this.isSubmitting || !this.previewData || !this.previewData.batch_eligible) return;

        try {
          this.isSubmitting = true;
          this.render();

          const result = await commitBatchOffers(
            this.vacancy.vacancy.code,
            this.selectedCandidateIds,
            this.lastReviewedRevision,
            this.currentOperationId
          );

          this.isSubmitting = false;
          this.successResult = { batch_id: result.batch_id, batch_size: result.batch_size };
          this.vacancy = result.vacancy;
          this.currentStep = 'success';
          this.callbacks.onCompleted(result.vacancy);
          this.render();
        } catch (err: any) {
          this.isSubmitting = false;
          if (err.status === 409) {
            this.conflictMessage = 'Vacancy revision has changed since you reviewed this batch. Please re-review the current pipeline before proceeding.';
            // Generate a fresh operation ID for a subsequent attempt
            this.currentOperationId = generateOperationId();
            // Refresh preview data
            try {
              const freshPreview = await previewBatchOffers(this.vacancy.vacancy.code, this.selectedCandidateIds);
              this.previewData = freshPreview;
              this.lastReviewedRevision = freshPreview.current_capacity.revision;
            } catch (e) {
              // ignore
            }
          }
          this.render();
          this.callbacks.onError(err);
        }
      });
    }

    // Finish Button
    const finishBtn = this.container.querySelector('#finish-batch-btn');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        this.close();
      });
    }
  }
}

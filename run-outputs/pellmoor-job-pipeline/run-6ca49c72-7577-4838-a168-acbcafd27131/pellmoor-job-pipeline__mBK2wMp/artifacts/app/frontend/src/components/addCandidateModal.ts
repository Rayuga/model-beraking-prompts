import {
  VacancySummary,
  VacancyFullDetails,
  Candidate
} from '../types';
import {
  createCandidate,
  generateOperationId,
  ApiError
} from '../api';

export interface AddCandidateModalCallbacks {
  onCreated: (newCandidate: Candidate, updatedVacancy: VacancyFullDetails) => void;
  onClose: () => void;
  onError: (error: ApiError | Error) => void;
}

export class AddCandidateModal {
  private container: HTMLElement;
  private vacancies: VacancySummary[];
  private selectedVacancyCode: string;
  private currentRevision: number;
  private callbacks: AddCandidateModalCallbacks;
  private isSubmitting: boolean = false;

  constructor(
    container: HTMLElement,
    vacancies: VacancySummary[],
    selectedVacancyCode: string,
    currentRevision: number,
    callbacks: AddCandidateModalCallbacks
  ) {
    this.container = container;
    this.vacancies = vacancies;
    this.selectedVacancyCode = selectedVacancyCode;
    this.currentRevision = currentRevision;
    this.callbacks = callbacks;
  }

  public show() {
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
      <div class="modal-backdrop" id="add-cand-backdrop"></div>
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="add-cand-title">
        <div class="modal-header">
          <h2 id="add-cand-title" class="modal-title">Add Candidate to Pipeline</h2>
          <button class="modal-close-btn" id="add-cand-close-btn" aria-label="Close modal">&times;</button>
        </div>

        <form id="add-cand-form" class="modal-form">
          <div class="form-group">
            <label for="cand-name-input">Candidate Full Name:</label>
            <input type="text" id="cand-name-input" class="form-input" placeholder="e.g. Robin Sterling" required autofocus>
          </div>

          <div class="form-group">
            <label for="cand-vacancy-select">Target Vacancy:</label>
            <select id="cand-vacancy-select" class="form-select">
              ${this.vacancies.map(v => `
                <option value="${v.code}" ${v.code === this.selectedVacancyCode ? 'selected' : ''}>
                  ${v.title} (${v.code}) - ${v.available} opening(s) available
                </option>
              `).join('')}
            </select>
          </div>

          <div class="modal-info-box">
            <span>ℹ Candidate will enter the pipeline at stage <strong>Applied</strong> with <strong>Assessment Version 1</strong>.</span>
          </div>

          <div class="modal-footer">
            <button type="button" id="add-cand-cancel-btn" class="btn btn-outline">Cancel</button>
            <button type="submit" id="add-cand-submit-btn" class="btn btn-primary" ${this.isSubmitting ? 'disabled' : ''}>
              ${this.isSubmitting ? 'Adding Candidate...' : 'Add Candidate'}
            </button>
          </div>
        </form>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    const closeBtn = this.container.querySelector('#add-cand-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    const cancelBtn = this.container.querySelector('#add-cand-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());

    const backdrop = this.container.querySelector('#add-cand-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        if (!this.isSubmitting) this.close();
      });
    }

    const form = this.container.querySelector('#add-cand-form') as HTMLFormElement;
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (this.isSubmitting) return;

        const nameInput = this.container.querySelector('#cand-name-input') as HTMLInputElement;
        const vacancySelect = this.container.querySelector('#cand-vacancy-select') as HTMLSelectElement;

        const name = nameInput?.value?.trim();
        const vacancyCode = vacancySelect?.value;

        if (!name || !vacancyCode) return;

        try {
          this.isSubmitting = true;
          this.render();

          const opId = generateOperationId();
          const result = await createCandidate(vacancyCode, name, this.currentRevision, opId);
          this.isSubmitting = false;
          this.close();
          this.callbacks.onCreated(result.candidate, result.vacancy);
        } catch (err: any) {
          this.isSubmitting = false;
          this.render();
          this.callbacks.onError(err);
        }
      });
    }
  }
}

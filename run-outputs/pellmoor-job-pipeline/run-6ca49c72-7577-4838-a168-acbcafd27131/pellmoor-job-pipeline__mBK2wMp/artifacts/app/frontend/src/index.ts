import {
  User,
  VacancySummary,
  VacancyFullDetails,
  Candidate
} from './types';
import {
  fetchCurrentUser,
  fetchVacancies,
  fetchVacancyDetails,
  logout,
  ApiError
} from './api';
import { initTheme } from './theme';
import { renderHeader } from './components/header';
import { renderLogin } from './components/login';
import { VacancyView } from './components/vacancyView';
import { CandidateDrawer } from './components/candidateDrawer';
import { BatchOfferModal } from './components/batchOfferModal';
import { AddCandidateModal } from './components/addCandidateModal';

class App {
  private headerContainer: HTMLElement;
  private appContainer: HTMLElement;
  private drawerContainer: HTMLElement;
  private modalContainer: HTMLElement;
  private notificationContainer: HTMLElement;

  private currentUser: User | null = null;
  private vacancies: VacancySummary[] = [];
  private selectedVacancyCode: string = '';
  private currentVacancyDetails: VacancyFullDetails | null = null;
  private selectedCandidateId: string | null = null;

  private vacancyView: VacancyView | null = null;
  private candidateDrawer: CandidateDrawer | null = null;
  private batchOfferModal: BatchOfferModal | null = null;
  private addCandidateModal: AddCandidateModal | null = null;

  constructor() {
    this.headerContainer = document.getElementById('header-root')!;
    this.appContainer = document.getElementById('app-root')!;
    this.drawerContainer = document.getElementById('drawer-root')!;
    this.modalContainer = document.getElementById('modal-root')!;
    this.notificationContainer = document.getElementById('notification-root')!;

    this.candidateDrawer = new CandidateDrawer(this.drawerContainer, {
      onUpdated: (vacancy, candidate) => {
        this.currentVacancyDetails = vacancy;
        this.updateVacanciesSummary(vacancy.vacancy);
        this.selectedCandidateId = candidate.id;
        this.updateHash();
        this.renderWorkspace();
        if (this.candidateDrawer) {
          this.candidateDrawer.updateData(candidate, vacancy);
        }
        this.showToast('Candidate updated successfully', 'success');
      },
      onClose: () => {
        this.selectedCandidateId = null;
        this.updateHash();
      },
      onError: (err) => {
        this.handleError(err);
      }
    });

    window.addEventListener('hashchange', () => {
      this.readHash();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.batchOfferModal) {
          this.batchOfferModal.close();
          this.batchOfferModal = null;
        } else if (this.addCandidateModal) {
          this.addCandidateModal.close();
          this.addCandidateModal = null;
        } else if (this.candidateDrawer) {
          this.candidateDrawer.close();
        }
      }
    });
  }

  public async init() {
    initTheme();
    try {
      this.currentUser = await fetchCurrentUser();
    } catch (e) {
      this.currentUser = null;
    }

    if (!this.currentUser) {
      this.renderLoginPage();
    } else {
      await this.loadWorkspace();
    }
  }

  private renderHeader() {
    renderHeader(this.headerContainer, this.currentUser, {
      onLogout: async () => {
        await logout();
        this.currentUser = null;
        this.currentVacancyDetails = null;
        this.selectedCandidateId = null;
        this.renderLoginPage();
      }
    });
  }

  private renderLoginPage() {
    this.renderHeader();
    this.vacancyView = null;
    this.drawerContainer.innerHTML = '';
    this.modalContainer.innerHTML = '';
    renderLogin(this.appContainer, {
      onLoginSuccess: async (user) => {
        this.currentUser = user;
        await this.loadWorkspace();
      }
    });
  }

  private async loadWorkspace() {
    this.renderHeader();
    this.appContainer.innerHTML = `<div class="loading-state">Loading workspace records...</div>`;

    try {
      this.vacancies = await fetchVacancies();
      if (this.vacancies.length === 0) {
        this.appContainer.innerHTML = `<div class="empty-state">No vacancies found.</div>`;
        return;
      }

      this.readHash();
      if (!this.selectedVacancyCode || !this.vacancies.some(v => v.code === this.selectedVacancyCode)) {
        this.selectedVacancyCode = this.vacancies[0].code;
      }

      await this.loadVacancy(this.selectedVacancyCode);
    } catch (err: any) {
      this.handleError(err);
    }
  }

  private async loadVacancy(code: string) {
    try {
      this.selectedVacancyCode = code;
      this.currentVacancyDetails = await fetchVacancyDetails(code);
      this.updateVacanciesSummary(this.currentVacancyDetails.vacancy);
      this.updateHash();
      this.renderWorkspace();

      // If candidate was selected in hash, open drawer
      if (this.selectedCandidateId) {
        const cand = this.currentVacancyDetails.candidates.find(c => c.id === this.selectedCandidateId);
        if (cand && this.candidateDrawer && this.currentUser) {
          this.candidateDrawer.show(cand, this.currentVacancyDetails, this.currentUser);
        }
      }
    } catch (err: any) {
      this.handleError(err);
    }
  }

  private renderWorkspace() {
    if (!this.currentUser || !this.currentVacancyDetails) return;

    if (!this.vacancyView) {
      this.vacancyView = new VacancyView(
        this.appContainer,
        this.vacancies,
        this.currentVacancyDetails,
        this.currentUser,
        {
          onSelectVacancy: (code) => {
            this.loadVacancy(code);
          },
          onOpenCandidate: (candidate) => {
            this.selectedCandidateId = candidate.id;
            this.updateHash();
            if (this.candidateDrawer && this.currentVacancyDetails && this.currentUser) {
              this.candidateDrawer.show(candidate, this.currentVacancyDetails, this.currentUser);
            }
          },
          onOpenAddCandidate: () => {
            this.openAddCandidateModal();
          },
          onOpenBatchOffers: () => {
            this.openBatchOffersModal();
          },
          onRefresh: () => {
            this.loadVacancy(this.selectedVacancyCode);
            this.showToast('Workspace refreshed', 'info');
          }
        }
      );
    } else {
      this.vacancyView.update(this.vacancies, this.currentVacancyDetails);
    }
  }

  private openAddCandidateModal() {
    if (!this.currentVacancyDetails) return;
    this.addCandidateModal = new AddCandidateModal(
      this.modalContainer,
      this.vacancies,
      this.selectedVacancyCode,
      this.currentVacancyDetails.vacancy.revision,
      {
        onCreated: (candidate, updatedVacancy) => {
          this.currentVacancyDetails = updatedVacancy;
          this.updateVacanciesSummary(updatedVacancy.vacancy);
          this.renderWorkspace();
          this.showToast(`Candidate ${candidate.name} (${candidate.id}) added!`, 'success');
          // Automatically open candidate drawer
          this.selectedCandidateId = candidate.id;
          this.updateHash();
          if (this.candidateDrawer && this.currentUser) {
            this.candidateDrawer.show(candidate, updatedVacancy, this.currentUser);
          }
        },
        onClose: () => {
          this.addCandidateModal = null;
        },
        onError: (err) => {
          this.handleError(err);
        }
      }
    );
    this.addCandidateModal.show();
  }

  private openBatchOffersModal() {
    if (!this.currentVacancyDetails) return;
    this.batchOfferModal = new BatchOfferModal(
      this.modalContainer,
      this.currentVacancyDetails,
      {
        onCompleted: (updatedVacancy) => {
          this.currentVacancyDetails = updatedVacancy;
          this.updateVacanciesSummary(updatedVacancy.vacancy);
          this.renderWorkspace();
          this.showToast('Batch offers successfully extended!', 'success');
        },
        onClose: () => {
          this.batchOfferModal = null;
        },
        onError: (err) => {
          this.handleError(err);
        }
      }
    );
    this.batchOfferModal.show();
  }

  private updateVacanciesSummary(summary: VacancySummary) {
    const idx = this.vacancies.findIndex(v => v.code === summary.code);
    if (idx !== -1) {
      this.vacancies[idx] = { ...this.vacancies[idx], ...summary };
    }
  }

  private updateHash() {
    const params = new URLSearchParams();
    if (this.selectedVacancyCode) {
      params.set('vacancy', this.selectedVacancyCode);
    }
    if (this.selectedCandidateId) {
      params.set('candidate', this.selectedCandidateId);
    }
    const hash = '#' + params.toString();
    if (window.location.hash !== hash) {
      history.replaceState(null, '', hash);
    }
  }

  private readHash() {
    const raw = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(raw);
    const vCode = params.get('vacancy');
    const cId = params.get('candidate');
    if (vCode) {
      this.selectedVacancyCode = vCode;
    }
    this.selectedCandidateId = cId;
  }

  private handleError(err: ApiError | Error | any) {
    const message = err.message || 'An unexpected error occurred';
    if (err.status === 409) {
      this.showToast(`Concurrency Conflict: ${message}`, 'warning');
      // Refresh current vacancy state on conflict
      if (this.selectedVacancyCode) {
        this.loadVacancy(this.selectedVacancyCode);
      }
    } else if (err.status === 401) {
      this.showToast('Session expired. Please sign in again.', 'danger');
      this.currentUser = null;
      this.renderLoginPage();
    } else {
      this.showToast(message, 'danger');
    }
  }

  private showToast(message: string, type: 'success' | 'warning' | 'danger' | 'info' = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✓' : type === 'warning' ? '⚠' : type === 'danger' ? '✖' : 'ℹ'}</span>
      <span class="toast-msg">${message}</span>
      <button class="toast-dismiss" aria-label="Dismiss">&times;</button>
    `;

    toast.querySelector('.toast-dismiss')?.addEventListener('click', () => {
      toast.remove();
    });

    this.notificationContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});

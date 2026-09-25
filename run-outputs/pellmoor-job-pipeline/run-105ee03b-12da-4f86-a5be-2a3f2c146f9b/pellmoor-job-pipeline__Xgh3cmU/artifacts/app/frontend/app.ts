import { API } from './api';
import { UI } from './ui';
import { Store } from './store';

export class App {
  private api: API;
  private ui: UI;
  private store: Store;
  private currentUser: any = null;

  constructor() {
    this.api = new API();
    this.store = new Store();
    this.ui = new UI(this);
  }

  async init() {
    // Check if user is already logged in
    const token = this.store.getToken();
    if (token) {
      try {
        this.currentUser = await this.api.validateSession(token);
        this.showWorkspace();
        return;
      } catch (err) {
        this.store.clearToken();
      }
    }

    this.showLoginPage();
  }

  async login(email: string, password: string) {
    try {
      const result = await this.api.login(email, password);
      this.store.setToken(result.token);
      this.currentUser = result.user;
      this.showWorkspace();
    } catch (err: any) {
      this.ui.showError(err.message || 'Login failed');
    }
  }

  async logout() {
    try {
      const token = this.store.getToken();
      if (token) {
        await this.api.logout(token);
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
    this.store.clearToken();
    this.currentUser = null;
    this.showLoginPage();
  }

  showLoginPage() {
    this.ui.showLoginPage((email, password) => this.login(email, password));
  }

  showWorkspace() {
    this.ui.showWorkspace(this.currentUser, () => this.logout());
    this.loadVacancies();
  }

  async loadVacancies() {
    try {
      const result = await this.api.getVacancies();
      this.store.setVacancies(result.vacancies);
      this.ui.updateVacanciesList(result.vacancies, (code) => this.selectVacancy(code));
    } catch (err: any) {
      this.ui.showError(err.message || 'Failed to load vacancies');
    }
  }

  async selectVacancy(roleCode: string) {
    try {
      const result = await this.api.getVacancy(roleCode);
      this.store.setCurrentVacancy(result.vacancy);
      this.ui.showVacancyDetails(result.vacancy, this.currentUser, this);
    } catch (err: any) {
      this.ui.showError(err.message || 'Failed to load vacancy');
    }
  }

  async selectCandidate(candidateId: string) {
    try {
      const vacancy = this.store.getCurrentVacancy();
      const candidate = vacancy.candidates.find((c: any) => c.id === candidateId);

      if (!candidate) {
        throw new Error('Candidate not found');
      }

      // Load full candidate data including panel and notes
      const [panelData, notesData] = await Promise.all([
        this.api.getPanel(candidateId),
        this.api.getNotes(candidateId),
      ]);

      const fullCandidate = {
        ...candidate,
        panel: panelData.panel,
        panelCanEdit: panelData.canEdit,
        assessmentVersion: panelData.assessmentVersion,
        notes: notesData.notes,
      };

      this.ui.showCandidateDetails(fullCandidate, vacancy, this.currentUser, this);
    } catch (err: any) {
      this.ui.showError(err.message || 'Failed to load candidate');
    }
  }

  async moveCandidate(
    roleCode: string,
    candidateId: string,
    nextStage: string,
    expectedRevision: number
  ) {
    try {
      const result = await this.api.moveCandidate(
        roleCode,
        candidateId,
        nextStage,
        expectedRevision
      );
      await this.selectVacancy(roleCode);
      this.ui.showSuccess('Candidate moved successfully');
    } catch (err: any) {
      if (err.status === 409) {
        this.ui.showError('Vacancy was updated. Please refresh and try again.');
        await this.selectVacancy(roleCode);
      } else {
        this.ui.showError(err.message || 'Failed to move candidate');
      }
    }
  }

  async addCandidate(roleCode: string, name: string) {
    try {
      await this.api.addCandidate(roleCode, name);
      await this.selectVacancy(roleCode);
      this.ui.showSuccess('Candidate added successfully');
    } catch (err: any) {
      this.ui.showError(err.message || 'Failed to add candidate');
    }
  }

  async addNote(candidateId: string, content: string) {
    try {
      await this.api.addNote(candidateId, content);
      this.ui.showSuccess('Note added');
      // Refresh current candidate view
      const vacancy = this.store.getCurrentVacancy();
      if (vacancy) {
        const candidate = vacancy.candidates.find((c: any) => c.id === candidateId);
        if (candidate) {
          await this.selectCandidate(candidateId);
        }
      }
    } catch (err: any) {
      this.ui.showError(err.message || 'Failed to add note');
    }
  }

  async addPanelMember(candidateId: string, memberEmail: string) {
    try {
      const vacancy = this.store.getCurrentVacancy();
      const candidate = vacancy.candidates.find((c: any) => c.id === candidateId);

      await this.api.addPanelMember(candidateId, memberEmail, candidate.revision);
      await this.selectCandidate(candidateId);
      this.ui.showSuccess('Panel member added');
    } catch (err: any) {
      if (err.status === 409) {
        this.ui.showError('Candidate was updated. Refreshing...');
        await this.selectCandidate(candidateId);
      } else {
        this.ui.showError(err.message || 'Failed to add panel member');
      }
    }
  }

  async removePanelMember(candidateId: string, memberId: string) {
    try {
      const vacancy = this.store.getCurrentVacancy();
      const candidate = vacancy.candidates.find((c: any) => c.id === candidateId);

      await this.api.removePanelMember(candidateId, memberId, candidate.revision);
      await this.selectCandidate(candidateId);
      this.ui.showSuccess('Panel member removed');
    } catch (err: any) {
      if (err.status === 409) {
        this.ui.showError('Candidate was updated. Refreshing...');
        await this.selectCandidate(candidateId);
      } else {
        this.ui.showError(err.message || 'Failed to remove panel member');
      }
    }
  }

  async recordScore(candidateId: string, score: number) {
    try {
      await this.api.recordScore(candidateId, score);
      await this.selectCandidate(candidateId);
      this.ui.showSuccess('Score recorded');
    } catch (err: any) {
      this.ui.showError(err.message || 'Failed to record score');
    }
  }

  async previewBatchOffer(
    roleCode: string,
    candidateIds: string[],
    expectedRevision: number
  ) {
    try {
      const result = await this.api.previewBatchOffer(
        roleCode,
        candidateIds,
        expectedRevision
      );
      return result;
    } catch (err: any) {
      if (err.status === 409) {
        throw new Error('Vacancy was updated. Please refresh and try again.');
      }
      throw err;
    }
  }

  async commitBatchOffer(
    roleCode: string,
    candidateIds: string[],
    operationId: string,
    expectedRevision: number
  ) {
    try {
      const result = await this.api.commitBatchOffer(
        roleCode,
        candidateIds,
        operationId,
        expectedRevision
      );
      await this.selectVacancy(roleCode);
      return result;
    } catch (err: any) {
      if (err.status === 409) {
        const currentRevision = err.response?.currentRevision;
        throw new Error(
          `Vacancy was updated. Current revision: ${currentRevision}. Please refresh and try again.`
        );
      }
      throw err;
    }
  }
}

import { Store } from './store';

export class API {
  private store: Store;

  constructor() {
    this.store = new Store();
  }

  private async request(
    method: string,
    path: string,
    data?: any,
    customHeaders: Record<string, string> = {}
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    const token = this.store.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(path, options);
      const responseData = await response.json();

      if (!response.ok) {
        const error: any = new Error(
          responseData.error || `HTTP ${response.status}`
        );
        error.status = response.status;
        error.response = responseData;
        throw error;
      }

      return responseData;
    } catch (err: any) {
      if (err.status === 401) {
        this.store.clearToken();
      }
      throw err;
    }
  }

  // Auth
  async login(email: string, password: string) {
    return this.request('POST', '/auth/login', { email, password });
  }

  async logout(token: string) {
    return this.request('POST', '/auth/logout');
  }

  async validateSession(token: string) {
    return this.request('GET', '/auth/session', undefined, {
      Authorization: `Bearer ${token}`,
    });
  }

  // Vacancies
  async getVacancies() {
    return this.request('GET', '/api/vacancies');
  }

  async getVacancy(roleCode: string) {
    return this.request('GET', `/api/vacancies/${roleCode}`);
  }

  async addCandidate(roleCode: string, name: string) {
    return this.request('POST', `/api/vacancies/${roleCode}/candidates`, {
      name,
    });
  }

  async moveCandidate(
    roleCode: string,
    candidateId: string,
    nextStage: string,
    expectedRevision?: number
  ) {
    return this.request(
      'POST',
      `/api/vacancies/${roleCode}/candidates/${candidateId}/move`,
      { nextStage, expectedRevision }
    );
  }

  // Panels
  async getPanel(candidateId: string) {
    return this.request('GET', `/api/candidates/${candidateId}/panel`);
  }

  async addPanelMember(
    candidateId: string,
    memberEmail: string,
    expectedRevision?: number
  ) {
    return this.request(
      'POST',
      `/api/candidates/${candidateId}/panel/add`,
      { memberEmail, expectedRevision }
    );
  }

  async removePanelMember(
    candidateId: string,
    memberId: string,
    expectedRevision?: number
  ) {
    return this.request(
      'POST',
      `/api/candidates/${candidateId}/panel/remove`,
      { memberId, expectedRevision }
    );
  }

  async recordScore(candidateId: string, score: number) {
    return this.request('POST', `/api/candidates/${candidateId}/score`, {
      score,
    });
  }

  // Notes
  async addNote(candidateId: string, content: string) {
    return this.request('POST', `/api/candidates/${candidateId}/note`, {
      content,
    });
  }

  async getNotes(candidateId: string) {
    return this.request('GET', `/api/candidates/${candidateId}/notes`);
  }

  // Batch offers
  async previewBatchOffer(
    roleCode: string,
    candidateIds: string[],
    expectedRevision?: number
  ) {
    return this.request(
      'POST',
      `/api/vacancies/${roleCode}/batch-offer/preview`,
      { candidateIds, expectedRevision }
    );
  }

  async commitBatchOffer(
    roleCode: string,
    candidateIds: string[],
    operationId: string,
    expectedRevision?: number
  ) {
    return this.request(
      'POST',
      `/api/vacancies/${roleCode}/batch-offer/commit`,
      { candidateIds, operationId, expectedRevision }
    );
  }
}

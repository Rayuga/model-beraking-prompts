class APIClient {
  constructor() {
    this.token = localStorage.getItem('auth_token');
    this.baseURL = '/api';
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  async request(method, endpoint, body = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (this.token) {
      options.headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, options);

    if (response.status === 401) {
      this.clearToken();
      window.location.reload();
    }

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'Request failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  async signIn(email, password) {
    return this.request('POST', '/sign-in', { email, password });
  }

  async signOut() {
    return this.request('POST', '/sign-out');
  }

  async getGameState() {
    return this.request('GET', '/game-state');
  }

  async startRun(levelNumber) {
    const operationId = this.generateOperationId();
    return this.request('POST', '/start-run', {
      levelNumber,
      operationId
    });
  }

  async saveRun(runId, revision, state) {
    const operationId = this.generateOperationId();
    return this.request('POST', '/save-run', {
      run_id: runId,
      revision,
      operationId,
      state
    });
  }

  async finishRun(runId, revision, outcome, level, score) {
    const operationId = this.generateOperationId();
    return this.request('POST', '/finish-run', {
      run_id: runId,
      revision,
      operationId,
      outcome,
      level,
      score
    });
  }

  generateOperationId() {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

window.api = new APIClient();

class ApiClient {
  constructor() {
    this.baseUrl = '';
  }

  async getWorkbook(workbookId) {
    const res = await fetch(`/api/workbooks/${workbookId}`);
    if (!res.ok) throw new Error('Failed to load workbook');
    return res.json();
  }

  async getRevisions(workbookId) {
    const res = await fetch(`/api/workbooks/${workbookId}/revisions`);
    if (!res.ok) throw new Error('Failed to load revisions');
    return res.json();
  }

  async getRevision(workbookId, revision) {
    const res = await fetch(`/api/workbooks/${workbookId}/revisions/${revision}`);
    if (!res.ok) throw new Error('Failed to load revision');
    return res.json();
  }

  async getCellHistory(workbookId, sheetId, address) {
    const res = await fetch(`/api/workbooks/${workbookId}/sheets/${sheetId}/cells/${address}/history`);
    if (!res.ok) throw new Error('Failed to load cell history');
    return res.json();
  }

  async createSession(workbookId, userId) {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workbookId, userId })
    });
    if (!res.ok) throw new Error('Failed to create session');
    return res.json();
  }

  async deleteSession(sessionId) {
    const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete session');
    return res.json();
  }

  async saveWorkbook(workbookId, snapshot, basedOnRevision, sessionId) {
    const res = await fetch(`/api/workbooks/${workbookId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot, basedOnRevision, sessionId })
    });
    if (!res.ok) {
      const data = await res.json();
      throw { status: res.status, ...data };
    }
    return res.json();
  }

  async getPresence(workbookId) {
    const res = await fetch(`/api/presence/${workbookId}`);
    if (!res.ok) throw new Error('Failed to load presence');
    return res.json();
  }

  async updatePresence(sessionId, cell, range) {
    const res = await fetch(`/api/presence/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cell, range })
    });
    if (!res.ok) throw new Error('Failed to update presence');
    return res.json();
  }

  async calculate(cells, address) {
    const res = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cells, address })
    });
    if (!res.ok) throw new Error('Failed to calculate');
    return res.json();
  }
}

const api = new ApiClient();

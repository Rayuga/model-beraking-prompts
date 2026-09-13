// API client for PatchPad backend

const Api = {
  async listReports() {
    const res = await fetch('/api/reports');
    if (!res.ok) throw new Error(`Failed to list reports: ${res.statusText}`);
    return await res.json();
  },

  async getReport(id) {
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const err = new Error(errData.error || `Failed to fetch report: ${res.statusText}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  },

  async saveReport(id, baseRevision, content, comment = '') {
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        documentId: id,
        baseRevision,
        content,
        comment
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.error || `Save failed: ${res.statusText}`);
      err.status = res.status;
      err.serverRevision = data.serverRevision;
      throw err;
    }

    return data;
  },

  async listRevisions(id) {
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}/revisions`);
    if (!res.ok) throw new Error(`Failed to list revisions: ${res.statusText}`);
    return await res.json();
  },

  async getRevisionContent(id, revNum) {
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}/revisions/${revNum}`);
    if (!res.ok) throw new Error(`Failed to fetch revision: ${res.statusText}`);
    return await res.json();
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Api };
}

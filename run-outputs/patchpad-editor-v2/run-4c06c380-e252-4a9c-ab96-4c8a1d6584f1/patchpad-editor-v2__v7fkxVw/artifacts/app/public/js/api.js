// API Client for PatchPad
(function(window) {
  'use strict';

  class ApiClient {
    constructor(baseUrl = '') {
      this.baseUrl = baseUrl;
    }

    async listDocuments() {
      const res = await fetch(`${this.baseUrl}/api/documents`);
      if (!res.ok) {
        throw new Error(`Failed to list documents: ${res.statusText}`);
      }
      return await res.json();
    }

    async getDocument(documentId) {
      const res = await fetch(`${this.baseUrl}/api/documents/${encodeURIComponent(documentId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch document: ${res.statusText}`);
      }
      return await res.json();
    }

    async getRevisions(documentId) {
      const res = await fetch(`${this.baseUrl}/api/documents/${encodeURIComponent(documentId)}/revisions`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch revisions: ${res.statusText}`);
      }
      return await res.json();
    }

    async getRevision(documentId, revisionNum) {
      const res = await fetch(`${this.baseUrl}/api/documents/${encodeURIComponent(documentId)}/revisions/${revisionNum}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch revision ${revisionNum}: ${res.statusText}`);
      }
      return await res.json();
    }

    async saveDocument({ documentId, baseRevision, content, author, summary }) {
      const res = await fetch(`${this.baseUrl}/api/documents/${encodeURIComponent(documentId)}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentId,
          baseRevision,
          content,
          author,
          summary
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        return {
          conflict: true,
          status: 'conflict',
          currentRevision: data.currentRevision,
          currentContent: data.currentContent,
          message: data.message || 'Conflict: Document has been modified by another session'
        };
      }

      if (!res.ok) {
        return {
          error: true,
          status: res.status,
          message: data.error || data.message || `Save failed with status ${res.status}`
        };
      }

      return {
        success: true,
        status: data.status,
        revision: data.revision,
        timestamp: data.timestamp,
        message: data.message
      };
    }
  }

  window.ApiClient = ApiClient;
})(typeof window !== 'undefined' ? window : global);

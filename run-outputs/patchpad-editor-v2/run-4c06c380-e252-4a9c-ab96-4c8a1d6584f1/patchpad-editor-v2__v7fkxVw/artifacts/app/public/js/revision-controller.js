// Revision History Controller
(function(window) {
  'use strict';

  class RevisionController {
    constructor(api, editorView, containerElement, options = {}) {
      this.api = api;
      this.editor = editorView;
      this.container = containerElement;
      this.options = Object.assign({
        onPreviewStart: null,
        onPreviewEnd: null,
        onRestore: null,
        documentId: 'incident-alpha'
      }, options);

      this.revisions = [];
      this.currentDocumentRevision = 1;
      this.previewingRevision = null;
      this.savedDraftBeforePreview = null;
      this.isOpen = false;
    }

    setDocumentId(id, currentRevision) {
      this.options.documentId = id;
      this.currentDocumentRevision = currentRevision;
      this.loadRevisions();
    }

    async loadRevisions() {
      if (!this.options.documentId) return;
      try {
        this.container.classList.add('loading');
        this.revisions = await this.api.getRevisions(this.options.documentId);
        this.render();
      } catch (err) {
        this.container.innerHTML = `<div class="history-error">Failed to load revision history: ${err.message}</div>`;
      } finally {
        this.container.classList.remove('loading');
      }
    }

    formatTimestamp(isoString) {
      try {
        const d = new Date(isoString);
        return d.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      } catch (e) {
        return isoString;
      }
    }

    render() {
      if (this.revisions.length === 0) {
        this.container.innerHTML = `<div class="history-empty">No revisions recorded yet.</div>`;
        return;
      }

      let html = `<div class="history-list">`;
      for (const rev of this.revisions) {
        const isCurrent = rev.revision === this.currentDocumentRevision;
        const isPreviewing = this.previewingRevision === rev.revision;

        html += `
          <div class="history-item${isCurrent ? ' current' : ''}${isPreviewing ? ' previewing' : ''}" data-revision="${rev.revision}">
            <div class="history-item-header">
              <div class="history-rev-badge">Rev ${rev.revision}</div>
              ${isCurrent ? '<span class="history-tag current-tag">Active</span>' : ''}
              ${isPreviewing ? '<span class="history-tag preview-tag">Previewing</span>' : ''}
              <span class="history-timestamp">${this.formatTimestamp(rev.timestamp)}</span>
            </div>
            <div class="history-item-meta">
              <span class="history-author">👤 ${rev.author || 'Anonymous'}</span>
              <span class="history-chars">${rev.charCount ? rev.charCount.toLocaleString() + ' chars' : ''}</span>
            </div>
            ${rev.summary ? `<div class="history-summary">${rev.summary}</div>` : ''}
            <div class="history-actions">
              ${isPreviewing ? `
                <button class="btn btn-sm btn-secondary btn-exit-preview" data-revision="${rev.revision}">Exit Preview</button>
                <button class="btn btn-sm btn-primary btn-restore-rev" data-revision="${rev.revision}">Restore</button>
              ` : `
                <button class="btn btn-sm btn-secondary btn-preview-rev" data-revision="${rev.revision}">Preview</button>
                <button class="btn btn-sm btn-outline btn-restore-rev" data-revision="${rev.revision}">Restore</button>
              `}
            </div>
          </div>
        `;
      }
      html += `</div>`;
      this.container.innerHTML = html;
      this._bindItemEvents();
    }

    _bindItemEvents() {
      const previewBtns = this.container.querySelectorAll('.btn-preview-rev');
      previewBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const revNum = parseInt(btn.getAttribute('data-revision'), 10);
          this.startPreview(revNum);
        });
      });

      const exitBtns = this.container.querySelectorAll('.btn-exit-preview');
      exitBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.exitPreview();
        });
      });

      const restoreBtns = this.container.querySelectorAll('.btn-restore-rev');
      restoreBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const revNum = parseInt(btn.getAttribute('data-revision'), 10);
          this.restoreRevision(revNum);
        });
      });
    }

    async startPreview(revNum) {
      if (this.previewingRevision === null) {
        // Save current draft text and history state
        this.savedDraftBeforePreview = {
          text: this.editor.getText(),
          selections: this.editor.selectionManager.selections.map(s => s.clone())
        };
      }

      try {
        const revData = await this.api.getRevision(this.options.documentId, revNum);
        this.previewingRevision = revNum;
        this.editor.options.readOnly = true;
        this.editor.setText(revData.content, false);
        this.render();

        if (this.options.onPreviewStart) {
          this.options.onPreviewStart(revData);
        }
      } catch (err) {
        alert(`Failed to preview revision ${revNum}: ${err.message}`);
      }
    }

    exitPreview() {
      if (this.previewingRevision === null) return;
      this.editor.options.readOnly = false;
      this.previewingRevision = null;

      if (this.savedDraftBeforePreview) {
        this.editor.setText(this.savedDraftBeforePreview.text, false);
        this.editor.selectionManager.selections = this.savedDraftBeforePreview.selections;
        this.savedDraftBeforePreview = null;
      }

      this.render();
      if (this.options.onPreviewEnd) {
        this.options.onPreviewEnd();
      }
    }

    async restoreRevision(revNum) {
      try {
        let revContent;
        if (this.previewingRevision === revNum) {
          revContent = this.editor.getText();
        } else {
          const revData = await this.api.getRevision(this.options.documentId, revNum);
          revContent = revData.content;
        }

        // Exit preview mode first
        this.editor.options.readOnly = false;
        this.previewingRevision = null;
        this.savedDraftBeforePreview = null;

        // Restore content into editor as unsaved action
        this.editor.restoreRevisionContent(revContent);
        this.render();

        if (this.options.onRestore) {
          this.options.onRestore(revNum);
        }
      } catch (err) {
        alert(`Failed to restore revision ${revNum}: ${err.message}`);
      }
    }
  }

  window.RevisionController = RevisionController;
})(typeof window !== 'undefined' ? window : global);

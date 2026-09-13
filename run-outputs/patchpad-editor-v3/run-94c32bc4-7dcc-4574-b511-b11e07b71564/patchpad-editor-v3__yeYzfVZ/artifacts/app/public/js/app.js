// Main Application Controller for PatchPad

document.addEventListener('DOMContentLoaded', async () => {
  const state = {
    currentDocId: 'incident-alpha',
    docMetadata: null,
    baseRevision: 1,
    lastSavedContent: '',
    reportsList: [],
    isDirty: false,
    previewRevision: null
  };

  // UI Elements
  const el = {
    // Header & Document Info
    docTitle: document.getElementById('doc-title'),
    docAuthor: document.getElementById('doc-author'),
    reportSelect: document.getElementById('report-select'),
    
    // Toolbar Buttons
    btnSave: document.getElementById('btn-save'),
    btnUndo: document.getElementById('btn-undo'),
    btnRedo: document.getElementById('btn-redo'),
    btnFind: document.getElementById('btn-find'),
    btnHistory: document.getElementById('btn-history'),
    saveBadge: document.getElementById('save-badge'),
    
    // Find & Replace Panel
    findPanel: document.getElementById('find-panel'),
    findInput: document.getElementById('find-input'),
    replaceInput: document.getElementById('replace-input'),
    matchCount: document.getElementById('match-count'),
    btnFindPrev: document.getElementById('btn-find-prev'),
    btnFindNext: document.getElementById('btn-find-next'),
    btnReplaceCurrent: document.getElementById('btn-replace-current'),
    btnReplaceAll: document.getElementById('btn-replace-all'),
    btnCloseFind: document.getElementById('btn-close-find'),
    caseSensitiveCheckbox: document.getElementById('find-case-sensitive'),
    
    // Editor Container
    editorContainer: document.getElementById('editor-container'),
    
    // Revision History Sidebar
    historySidebar: document.getElementById('history-sidebar'),
    historyList: document.getElementById('history-list'),
    btnCloseHistory: document.getElementById('btn-close-history'),
    
    // Status Bar
    statusCursor: document.getElementById('status-cursor'),
    statusStats: document.getElementById('status-stats'),
    statusRevision: document.getElementById('status-revision'),
    statusSaveState: document.getElementById('status-save-state'),
    
    // Modals
    previewModal: document.getElementById('preview-modal'),
    previewTitle: document.getElementById('preview-title'),
    previewMeta: document.getElementById('preview-meta'),
    previewContent: document.getElementById('preview-content'),
    btnRestorePreview: document.getElementById('btn-restore-preview'),
    btnClosePreview: document.getElementById('btn-close-preview'),
    
    conflictModal: document.getElementById('conflict-modal'),
    conflictMessage: document.getElementById('conflict-message'),
    btnConflictKeep: document.getElementById('btn-conflict-keep'),
    btnConflictPreview: document.getElementById('btn-conflict-preview'),
    btnConflictReload: document.getElementById('btn-conflict-reload'),

    // Toast Container
    toastContainer: document.getElementById('toast-container')
  };

  // Toast notification helper
  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `patchpad-toast toast-${type}`;
    toast.innerHTML = `<span class="toast-text">${message}</span>`;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // Initialize Core Models
  const docModel = new DocumentModel('');
  const undoManager = new UndoManager();
  const findEngine = new FindReplaceEngine();

  // Initialize Custom Editor View
  const editorView = new PatchPadEditorView(el.editorContainer, docModel, undoManager, {
    onCursorChange: (info) => {
      if (info.caretCount > 1) {
        el.statusCursor.textContent = `${info.caretCount} carets (Primary Ln ${info.line}, Col ${info.col})`;
      } else if (info.hasSelection) {
        const charCount = info.selectedText.length;
        el.statusCursor.textContent = `Ln ${info.line}, Col ${info.col} (${charCount} selected)`;
      } else {
        el.statusCursor.textContent = `Ln ${info.line}, Col ${info.col}`;
      }
    },
    onContentChange: (text, type) => {
      updateDirtyState();
      updateDocumentStats();
      if (findEngine.query) {
        updateFindMatches();
      }
    },
    onSaveRequest: () => {
      saveCurrentReport();
    },
    onFindRequest: () => {
      toggleFindPanel(true);
    },
    onEscape: () => {
      // Escape from editing area focuses Find input
      if (!el.findPanel.classList.contains('hidden')) {
        el.findInput.focus();
        el.findInput.select();
      } else {
        toggleFindPanel(true);
      }
    }
  });

  // Undo/Redo button status listener
  undoManager.setOnChange(({ canUndo, canRedo }) => {
    el.btnUndo.disabled = !canUndo;
    el.btnRedo.disabled = !canRedo;
  });

  function updateDocumentStats() {
    const lineCount = docModel.getLineCount();
    const charCount = docModel.getText().length;
    el.statusStats.textContent = `${lineCount.toLocaleString()} lines, ${charCount.toLocaleString()} characters`;
  }

  function updateDirtyState() {
    const currentText = docModel.getText();
    const isDirty = currentText !== state.lastSavedContent;
    state.isDirty = isDirty;

    if (isDirty) {
      el.saveBadge.textContent = 'Unsaved changes';
      el.saveBadge.className = 'status-badge badge-unsaved';
      el.statusSaveState.textContent = '● Unsaved changes';
      el.statusSaveState.className = 'status-unsaved';
    } else {
      el.saveBadge.textContent = 'Saved';
      el.saveBadge.className = 'status-badge badge-saved';
      el.statusSaveState.textContent = '✓ Saved';
      el.statusSaveState.className = 'status-saved';
    }
  }

  // Load Document from Server
  async function loadDocument(id) {
    try {
      const doc = await Api.getReport(id);
      state.currentDocId = doc.id;
      state.docMetadata = doc;
      state.baseRevision = doc.current_revision;
      state.lastSavedContent = doc.content;

      // Update Header
      el.docTitle.textContent = doc.title;
      el.docAuthor.textContent = doc.author ? `Author: ${doc.author}` : '';
      el.statusRevision.textContent = `Revision ${doc.current_revision}`;

      // Update Editor
      docModel.setText(doc.content);
      undoManager.clear();
      editorView.setSelections([{ anchor: { line: 0, col: 0 }, head: { line: 0, col: 0 } }]);
      editorView.render();

      updateDirtyState();
      updateDocumentStats();
      refreshRevisionsList();

      showToast(`Loaded "${doc.title}" (Rev ${doc.current_revision})`, 'info', 2000);
    } catch (err) {
      console.error('Failed to load report:', err);
      showToast(`Error loading report: ${err.message}`, 'error', 5000);
    }
  }

  // Load Reports List
  async function loadReportsList() {
    try {
      const reports = await Api.listReports();
      state.reportsList = reports;
      el.reportSelect.innerHTML = '';
      for (const r of reports) {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = `${r.title} (${r.author || 'Unknown'})`;
        if (r.id === state.currentDocId) {
          opt.selected = true;
        }
        el.reportSelect.appendChild(opt);
      }
    } catch (err) {
      console.error('Failed to load reports list:', err);
    }
  }

  // Save Report
  async function saveCurrentReport() {
    const currentText = docModel.getText();

    if (!state.isDirty) {
      showToast('Document is already up to date (no changes to save)', 'info', 2500);
      return;
    }

    el.btnSave.disabled = true;
    el.saveBadge.textContent = 'Saving...';
    el.saveBadge.className = 'status-badge badge-saving';
    el.statusSaveState.textContent = '⟳ Saving...';

    try {
      const res = await Api.saveReport(
        state.currentDocId,
        state.baseRevision,
        currentText,
        'Saved from PatchPad editor'
      );

      if (res.saved) {
        state.baseRevision = res.revision;
        state.lastSavedContent = currentText;
        el.statusRevision.textContent = `Revision ${res.revision}`;
        updateDirtyState();
        refreshRevisionsList();
        showToast(`Report saved successfully as Revision ${res.revision}`, 'success');
      } else {
        updateDirtyState();
        showToast('Document unchanged', 'info');
      }
    } catch (err) {
      if (err.status === 409) {
        // Save conflict
        el.saveBadge.textContent = 'Conflict';
        el.saveBadge.className = 'status-badge badge-conflict';
        el.statusSaveState.textContent = '⚠ Conflict';
        el.statusSaveState.className = 'status-conflict';

        el.conflictMessage.innerHTML = `
          Another user or browser tab saved a newer version of this report (<strong>Revision ${err.serverRevision || 'newer'}</strong>).<br><br>
          Your current unsaved edits have been preserved in the editor. Choose an action below:
        `;
        el.conflictModal.classList.remove('hidden');
      } else {
        showToast(`Save failed: ${err.message}`, 'error', 5000);
        updateDirtyState();
      }
    } finally {
      el.btnSave.disabled = false;
    }
  }

  // Revision History
  async function refreshRevisionsList() {
    try {
      const revs = await Api.listRevisions(state.currentDocId);
      el.historyList.innerHTML = '';

      for (const r of revs) {
        const item = document.createElement('div');
        item.className = 'history-item';
        if (r.revision_number === state.baseRevision) {
          item.classList.add('current-revision');
        }

        const dateStr = new Date(r.created_at).toLocaleString();
        item.innerHTML = `
          <div class="history-item-header">
            <span class="history-rev-badge">Rev ${r.revision_number}</span>
            ${r.revision_number === state.baseRevision ? '<span class="history-current-tag">Current Base</span>' : ''}
          </div>
          <div class="history-item-meta">
            <span class="history-date">${dateStr}</span>
            <span class="history-chars">${(r.char_count || 0).toLocaleString()} chars</span>
          </div>
          ${r.comment ? `<div class="history-comment">${r.comment}</div>` : ''}
          <div class="history-item-actions">
            <button class="btn btn-sm btn-secondary btn-preview-rev" data-rev="${r.revision_number}">Preview</button>
            <button class="btn btn-sm btn-primary btn-restore-rev" data-rev="${r.revision_number}">Restore</button>
          </div>
        `;
        el.historyList.appendChild(item);
      }

      // Bind Preview and Restore buttons
      el.historyList.querySelectorAll('.btn-preview-rev').forEach(btn => {
        btn.addEventListener('click', () => {
          const revNum = parseInt(btn.dataset.rev, 10);
          previewRevision(revNum);
        });
      });

      el.historyList.querySelectorAll('.btn-restore-rev').forEach(btn => {
        btn.addEventListener('click', () => {
          const revNum = parseInt(btn.dataset.rev, 10);
          restoreRevision(revNum);
        });
      });
    } catch (err) {
      console.error('Failed to load revisions:', err);
    }
  }

  async function previewRevision(revNum) {
    try {
      const rev = await Api.getRevisionContent(state.currentDocId, revNum);
      state.previewRevision = rev;

      el.previewTitle.textContent = `Preview: ${state.docMetadata?.title || 'Report'} (Revision ${revNum})`;
      el.previewMeta.textContent = `Saved on ${new Date(rev.created_at).toLocaleString()} · ${rev.content.length.toLocaleString()} characters`;

      // Render line-numbered preview
      const lines = rev.content.split('\n');
      let previewHtml = '<div class="preview-line-container">';
      for (let i = 0; i < lines.length; i++) {
        const escaped = editorView._escapeHtml(lines[i]);
        previewHtml += `
          <div class="preview-line">
            <span class="preview-line-num">${i + 1}</span>
            <span class="preview-line-text">${escaped || '&nbsp;'}</span>
          </div>
        `;
      }
      previewHtml += '</div>';
      el.previewContent.innerHTML = previewHtml;

      el.previewModal.classList.remove('hidden');
    } catch (err) {
      showToast(`Failed to preview revision: ${err.message}`, 'error');
    }
  }

  async function restoreRevision(revNum) {
    try {
      const rev = await Api.getRevisionContent(state.currentDocId, revNum);
      const beforeText = docModel.getText();
      const beforeSelections = JSON.parse(JSON.stringify(editorView.selections));

      docModel.setText(rev.content);
      editorView.setSelections([{ anchor: { line: 0, col: 0 }, head: { line: 0, col: 0 } }]);

      // Record restore as an unsaved Undo action
      undoManager.recordAction({
        beforeText,
        afterText: rev.content,
        beforeSelections,
        afterSelections: editorView.selections,
        type: 'restore_revision',
        forceNewGroup: true
      });

      updateDirtyState();
      updateDocumentStats();
      editorView.render();
      editorView.focus();

      if (!el.previewModal.classList.contains('hidden')) {
        el.previewModal.classList.add('hidden');
      }

      showToast(`Revision ${revNum} restored as an unsaved edit. Press Ctrl+Z to undo or Save to commit.`, 'info', 4500);
    } catch (err) {
      showToast(`Failed to restore revision: ${err.message}`, 'error');
    }
  }

  // Find and Replace Controls
  function toggleFindPanel(show) {
    if (show === undefined) {
      show = el.findPanel.classList.contains('hidden');
    }
    if (show) {
      el.findPanel.classList.remove('hidden');
      // If there's selected text in editor, populate find input
      const selected = docModel.getSelectedText(editorView.getPrimarySelection());
      if (selected && !selected.includes('\n')) {
        el.findInput.value = selected;
      }
      el.findInput.focus();
      el.findInput.select();
      updateFindMatches();
    } else {
      el.findPanel.classList.add('hidden');
      findEngine.setQuery('');
      editorView.setSearchHighlights([], -1);
      editorView.focus();
    }
  }

  function updateFindMatches() {
    const query = el.findInput.value;
    const caseSensitive = el.caseSensitiveCheckbox.checked;
    findEngine.setQuery(query, caseSensitive);
    const matches = findEngine.updateMatches(docModel);

    if (!query) {
      el.matchCount.textContent = '';
      editorView.setSearchHighlights([], -1);
      return;
    }

    if (matches.length === 0) {
      el.matchCount.textContent = 'No matches';
      editorView.setSearchHighlights([], -1);
      return;
    }

    // Determine nearest match
    const primary = editorView.getPrimarySelection();
    findEngine.currentIndex = findEngine.findNearestMatchIndex(primary.head, docModel);
    const current = findEngine.getCurrentMatch();

    el.matchCount.textContent = `${findEngine.currentIndex + 1} of ${matches.length}`;
    editorView.setSearchHighlights(matches, findEngine.currentIndex);
  }

  function jumpToCurrentMatch() {
    const match = findEngine.getCurrentMatch();
    if (!match) return;
    el.matchCount.textContent = `${findEngine.currentIndex + 1} of ${findEngine.matches.length}`;
    editorView.setSelections([{ anchor: match.start, head: match.end }]);
    editorView.setSearchHighlights(findEngine.matches, findEngine.currentIndex);
    editorView.scrollToCursor();
  }

  // Find Event Listeners
  el.btnFind.addEventListener('click', () => toggleFindPanel());
  el.btnCloseFind.addEventListener('click', () => toggleFindPanel(false));

  el.findInput.addEventListener('input', () => {
    updateFindMatches();
    if (findEngine.matches.length > 0) {
      jumpToCurrentMatch();
    }
  });

  el.caseSensitiveCheckbox.addEventListener('change', () => {
    updateFindMatches();
    if (findEngine.matches.length > 0) {
      jumpToCurrentMatch();
    }
  });

  el.findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        findEngine.prevMatch();
      } else {
        findEngine.nextMatch();
      }
      jumpToCurrentMatch();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // "When the Find input has focus, Escape should return focus to the editing area without changing the current document selection"
      editorView.focus();
    }
  });

  el.replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      replaceCurrentMatch();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      editorView.focus();
    }
  });

  el.btnFindNext.addEventListener('click', () => {
    findEngine.nextMatch();
    jumpToCurrentMatch();
  });

  el.btnFindPrev.addEventListener('click', () => {
    findEngine.prevMatch();
    jumpToCurrentMatch();
  });

  function replaceCurrentMatch() {
    findEngine.setReplaceText(el.replaceInput.value);
    const res = findEngine.replaceCurrent(docModel);
    if (!res) return;

    undoManager.recordAction({
      beforeText: res.beforeText,
      afterText: res.afterText,
      beforeSelections: [res.selection],
      afterSelections: [res.selection],
      type: 'replace',
      forceNewGroup: true
    });

    updateDirtyState();
    updateDocumentStats();
    jumpToCurrentMatch();
    editorView.render();
  }

  function replaceAllMatches() {
    findEngine.setReplaceText(el.replaceInput.value);
    const res = findEngine.replaceAll(docModel);
    if (res.count === 0) {
      showToast('No matches to replace', 'info');
      return;
    }

    undoManager.recordAction({
      beforeText: res.beforeText,
      afterText: res.afterText,
      beforeSelections: JSON.parse(JSON.stringify(editorView.selections)),
      afterSelections: JSON.parse(JSON.stringify(editorView.selections)),
      type: 'replace_all',
      forceNewGroup: true
    });

    updateDirtyState();
    updateDocumentStats();
    updateFindMatches();
    editorView.render();
    showToast(`Replaced ${res.count} occurrence(s)`, 'success');
  }

  el.btnReplaceCurrent.addEventListener('click', replaceCurrentMatch);
  el.btnReplaceAll.addEventListener('click', replaceAllMatches);

  // Toolbar & General Action Listeners
  el.btnSave.addEventListener('click', () => saveCurrentReport());
  el.btnUndo.addEventListener('click', () => editorView.performUndo());
  el.btnRedo.addEventListener('click', () => editorView.performRedo());

  el.btnHistory.addEventListener('click', () => {
    const isHidden = el.historySidebar.classList.contains('hidden');
    if (isHidden) {
      refreshRevisionsList();
      el.historySidebar.classList.remove('hidden');
    } else {
      el.historySidebar.classList.add('hidden');
    }
  });

  el.btnCloseHistory.addEventListener('click', () => {
    el.historySidebar.classList.add('hidden');
  });

  // Report Switcher
  el.reportSelect.addEventListener('change', (e) => {
    const selectedId = e.target.value;
    if (state.isDirty) {
      if (!confirm('You have unsaved changes in the current report. Switch report anyway and discard unsaved edits?')) {
        e.target.value = state.currentDocId;
        return;
      }
    }
    loadDocument(selectedId);
  });

  // Conflict Modal Actions
  el.btnConflictKeep.addEventListener('click', () => {
    el.conflictModal.classList.add('hidden');
    showToast('Keeping unsaved draft in editor. You may review and save when ready.', 'info', 3500);
    editorView.focus();
  });

  el.btnConflictPreview.addEventListener('click', async () => {
    el.conflictModal.classList.add('hidden');
    try {
      const doc = await Api.getReport(state.currentDocId);
      previewRevision(doc.current_revision);
    } catch (err) {
      showToast('Failed to fetch server revision for preview', 'error');
    }
  });

  el.btnConflictReload.addEventListener('click', () => {
    el.conflictModal.classList.add('hidden');
    loadDocument(state.currentDocId);
  });

  // Preview Modal Actions
  el.btnClosePreview.addEventListener('click', () => {
    el.previewModal.classList.add('hidden');
    editorView.focus();
  });

  el.btnRestorePreview.addEventListener('click', () => {
    if (state.previewRevision) {
      restoreRevision(state.previewRevision.revision_number);
    }
  });

  // Initial Load
  await loadReportsList();
  await loadDocument('incident-alpha');
});

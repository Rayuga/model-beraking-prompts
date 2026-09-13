/**
 * PatchPad Application Controller
 * Handles document state, persistence, conflict safety, revisions, and UI interactions.
 */

(function () {
  'use strict';

  let currentDoc = null;
  let baseRevision = 1;
  let lastSavedContent = '';
  let editor = null;
  let isSaving = false;
  let currentPreviewRev = null;
  let currentPreviewContent = '';

  // DOM Elements
  const docTitleDisplay = document.getElementById('doc-title-display');
  const docAuthorDisplay = document.getElementById('doc-author-display');
  const docIdDisplay = document.getElementById('doc-id-display');
  const saveStatusBadge = document.getElementById('save-status-badge');
  const saveStatusText = document.getElementById('save-status-text');
  const revisionBadge = document.getElementById('revision-badge');
  const cursorBadge = document.getElementById('cursor-badge');
  const reportsDropdown = document.getElementById('reports-dropdown');

  const btnSave = document.getElementById('btn-save');
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  const btnFindToggle = document.getElementById('btn-find-toggle');
  const btnHistoryToggle = document.getElementById('btn-history-toggle');
  const historyCountBadge = document.getElementById('history-count-badge');

  const findReplacePanel = document.getElementById('find-replace-panel');
  const findInput = document.getElementById('find-input');
  const replaceInput = document.getElementById('replace-input');
  const findCountDisplay = document.getElementById('find-count-display');
  const btnFindNext = document.getElementById('btn-find-next');
  const btnFindPrev = document.getElementById('btn-find-prev');
  const btnReplaceOne = document.getElementById('btn-replace-one');
  const btnReplaceAll = document.getElementById('btn-replace-all');
  const btnFindClose = document.getElementById('btn-find-close');

  const alertBanner = document.getElementById('alert-banner');
  const alertMessage = document.getElementById('alert-message');
  const alertActions = document.getElementById('alert-actions');

  const historyDrawer = document.getElementById('history-drawer');
  const historyListContainer = document.getElementById('history-list-container');
  const btnHistoryClose = document.getElementById('btn-history-close');

  const previewModal = document.getElementById('preview-modal');
  const previewModalTitle = document.getElementById('preview-modal-title');
  const previewModalMeta = document.getElementById('preview-modal-meta');
  const previewModalContent = document.getElementById('preview-modal-content');
  const btnPreviewClose = document.getElementById('btn-preview-close');
  const btnPreviewDismiss = document.getElementById('btn-preview-dismiss');
  const btnPreviewRestore = document.getElementById('btn-preview-restore');

  const conflictModal = document.getElementById('conflict-modal');
  const conflictModalDetails = document.getElementById('conflict-modal-details');
  const btnConflictKeep = document.getElementById('btn-conflict-keep');
  const btnConflictReload = document.getElementById('btn-conflict-reload');

  const editorContainer = document.getElementById('editor-container');

  /* ----------------------------------------------------
     Initialization
     ---------------------------------------------------- */
  function init() {
    initEditor();
    bindUIEvents();
    loadReportsList();
    loadDocument('incident-alpha');
  }

  function initEditor() {
    editor = new PatchPadEditor(editorContainer, {
      onDirtyChange: (content) => {
        checkDirtyState(content);
      },
      onCursorChange: (info) => {
        if (info.caretCount > 1) {
          cursorBadge.textContent = `${info.caretCount} Carets | Ln ${info.line}, Col ${info.col}`;
        } else {
          cursorBadge.textContent = `Ln ${info.line}, Col ${info.col}`;
        }
      },
      onHistoryChange: (canUndo, canRedo) => {
        btnUndo.disabled = !canUndo;
        btnRedo.disabled = !canRedo;
      },
      onEscape: () => {
        // "Escape from the editing area should focus the Find input so people can use Tab and Shift+Tab to move through the surrounding controls again."
        openFindPanel();
        findInput.focus();
        findInput.select();
      },
      onFindRequest: () => {
        openFindPanel();
        const selected = editor.getAllSelectedText();
        if (selected && !selected.includes('\n')) {
          findInput.value = selected;
        }
        findInput.focus();
        findInput.select();
        updateFind();
      },
      onSaveRequest: () => {
        saveDocument();
      }
    });
    window.editor = editor;
  }

  /* ----------------------------------------------------
     Document Loading & Reports API
     ---------------------------------------------------- */
  async function loadReportsList() {
    try {
      const res = await fetch('/api/reports');
      if (!res.ok) throw new Error(`Failed to fetch reports list: ${res.statusText}`);
      const reports = await res.json();

      reportsDropdown.innerHTML = '';
      reports.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = `${r.title} (${r.author || 'Unknown'})`;
        if (currentDoc && currentDoc.id === r.id) opt.selected = true;
        reportsDropdown.appendChild(opt);
      });
    } catch (err) {
      console.error('Error fetching reports list:', err);
    }
  }

  async function loadDocument(docId) {
    try {
      hideAlert();
      const res = await fetch(`/api/reports/${encodeURIComponent(docId)}`);
      if (!res.ok) throw new Error(`Report not found (${res.status})`);

      const doc = await res.json();
      currentDoc = doc;
      baseRevision = doc.current_revision;
      lastSavedContent = doc.current_content;

      // Update Header Info
      docTitleDisplay.textContent = doc.title || 'Untitled Incident Report';
      docAuthorDisplay.textContent = `Author: ${doc.author || 'Riley Stone'}`;
      docIdDisplay.textContent = doc.id;
      document.title = `PatchPad - ${doc.title}`;

      // Load Content into Editor (external load resets undo)
      editor.setText(doc.current_content, true);

      // Update Badges
      setSaveStatus(true);
      revisionBadge.textContent = `Revision ${baseRevision}`;

      // Refresh Revisions list
      fetchRevisionHistory();
    } catch (err) {
      console.error('Error loading report:', err);
      showAlert(`Error loading document: ${err.message}`, 'error');
    }
  }

  function checkDirtyState(content) {
    const isClean = (content === lastSavedContent);
    setSaveStatus(isClean);
  }

  function setSaveStatus(isClean) {
    if (isClean) {
      saveStatusBadge.className = 'badge badge-saved';
      saveStatusText.textContent = 'Saved';
    } else {
      saveStatusBadge.className = 'badge badge-unsaved';
      saveStatusText.textContent = 'Unsaved changes';
    }
  }

  /* ----------------------------------------------------
     Save & Conflict Safety
     ---------------------------------------------------- */
  async function saveDocument() {
    if (!currentDoc || isSaving) return;

    const content = editor.getText();

    // If unchanged, no new revision will be created on server
    isSaving = true;
    btnSave.disabled = true;
    saveStatusText.textContent = 'Saving...';

    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(currentDoc.id)}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseRevision: baseRevision,
          content: content,
          documentId: currentDoc.id
        })
      });

      const data = await res.json();

      if (res.status === 409) {
        // CONFLICT: Stale save!
        // "If another tab has already saved a newer version, refuse the stale save and keep that newer content on the server.
        // Keep the rejected tab's unsaved draft in its editor and show a useful conflict message. Only discard that draft when
        // the user chooses to reload or discard it; do not silently replace it with the server's content."
        handleSaveConflict(data);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || `Save failed with HTTP ${res.status}`);
      }

      // Success
      baseRevision = data.revision;
      lastSavedContent = content;
      currentDoc.current_revision = data.revision;
      currentDoc.current_content = content;

      setSaveStatus(true);
      revisionBadge.textContent = `Revision ${baseRevision}`;
      hideAlert();
      fetchRevisionHistory();
    } catch (err) {
      console.error('Error saving document:', err);
      showAlert(`Save failed: ${err.message}`, 'error');
      setSaveStatus(false);
    } finally {
      isSaving = false;
      btnSave.disabled = false;
    }
  }

  function handleSaveConflict(conflictData) {
    setSaveStatus(false);
    const serverRev = conflictData.currentRevision;

    // Show persistent Banner
    showAlert(
      `⚠️ Save Conflict: Another session saved Revision ${serverRev}. Your unsaved draft is preserved here.`,
      'conflict',
      [
        { text: 'Review Conflict', onClick: () => showConflictModal(serverRev) },
        { text: 'Reload Server Version', onClick: () => reloadServerVersion(serverRev) }
      ]
    );

    // Also pop open Conflict Modal for immediate clarity
    showConflictModal(serverRev);
  }

  function showConflictModal(serverRev) {
    conflictModalDetails.innerHTML = `
      <span>Your base revision: <strong>Rev ${baseRevision}</strong></span> • 
      <span>Server's current revision: <strong>Rev ${serverRev}</strong></span>
    `;
    conflictModal.classList.remove('hidden');
  }

  function hideConflictModal() {
    conflictModal.classList.add('hidden');
  }

  async function reloadServerVersion() {
    if (!currentDoc) return;
    hideConflictModal();
    hideAlert();
    await loadDocument(currentDoc.id);
  }

  /* ----------------------------------------------------
     Revision History
     ---------------------------------------------------- */
  async function fetchRevisionHistory() {
    if (!currentDoc) return;

    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(currentDoc.id)}/revisions`);
      if (!res.ok) return;

      const revisions = await res.json();
      historyCountBadge.textContent = revisions.length;
      renderRevisionList(revisions);
    } catch (err) {
      console.error('Error fetching revisions:', err);
    }
  }

  function renderRevisionList(revisions) {
    historyListContainer.innerHTML = '';

    revisions.forEach((rev) => {
      const isCurrent = (rev.revision === baseRevision);
      const date = new Date(rev.created_at);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = date.toLocaleDateString();

      const card = document.createElement('div');
      card.className = `history-card${isCurrent ? ' current' : ''}`;
      card.innerHTML = `
        <div class="history-card-header">
          <span class="history-rev-tag">Revision ${rev.revision}${isCurrent ? ' (Active)' : ''}</span>
          <span class="history-timestamp" title="${rev.created_at}">${dateStr} ${timeStr}</span>
        </div>
        <div class="history-card-meta">
          <span>${rev.byte_length.toLocaleString()} characters</span>
        </div>
        <div class="history-card-actions">
          <button class="btn btn-icon-only btn-rev-preview" data-rev="${rev.revision}" title="Preview revision without editing">Preview</button>
          <button class="btn btn-rev-restore" data-rev="${rev.revision}" title="Restore revision into editor as unsaved action">Restore</button>
        </div>
      `;

      card.querySelector('.btn-rev-preview').addEventListener('click', () => previewRevision(rev.revision));
      card.querySelector('.btn-rev-restore').addEventListener('click', () => restoreRevision(rev.revision));

      historyListContainer.appendChild(card);
    });
  }

  async function previewRevision(revNumber) {
    if (!currentDoc) return;

    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(currentDoc.id)}/revisions/${revNumber}`);
      if (!res.ok) throw new Error('Failed to load revision details');

      const revData = await res.json();
      currentPreviewRev = revNumber;
      currentPreviewContent = revData.content;

      previewModalTitle.textContent = `Preview Revision ${revNumber} — ${currentDoc.title}`;
      previewModalMeta.innerHTML = `
        <span>Revision: <strong>${revNumber}</strong></span> • 
        <span>Saved at: <strong>${new Date(revData.created_at).toLocaleString()}</strong></span> • 
        <span>Lines: <strong>${revData.content.split('\n').length}</strong></span>
      `;
      previewModalContent.textContent = revData.content;

      previewModal.classList.remove('hidden');
    } catch (err) {
      showAlert(`Failed to preview revision: ${err.message}`, 'error');
    }
  }

  function hidePreviewModal() {
    previewModal.classList.add('hidden');
    currentPreviewRev = null;
    currentPreviewContent = '';
  }

  async function restoreRevision(revNumber) {
    if (!currentDoc) return;

    try {
      let content = currentPreviewContent;
      if (currentPreviewRev !== revNumber || !content) {
        const res = await fetch(`/api/reports/${encodeURIComponent(currentDoc.id)}/revisions/${revNumber}`);
        if (!res.ok) throw new Error('Failed to fetch revision to restore');
        const revData = await res.json();
        content = revData.content;
      }

      // "Restoring an older revision should open it as an unsaved editor action so it can be undone before it is saved."
      hidePreviewModal();
      editor.setText(content, false); // false preserves undo stack so user can Ctrl+Z!
      setSaveStatus(false);
      editor.focus();

      showAlert(`Restored Revision ${revNumber} as an unsaved action. You can undo this with Ctrl+Z or save changes.`, 'conflict');
    } catch (err) {
      showAlert(`Restore failed: ${err.message}`, 'error');
    }
  }

  /* ----------------------------------------------------
     Find & Replace Actions
     ---------------------------------------------------- */
  function openFindPanel() {
    findReplacePanel.classList.remove('hidden');
  }

  function closeFindPanel() {
    findReplacePanel.classList.add('hidden');
    editor.findMatches('');
    findCountDisplay.textContent = '0 matches';
  }

  function updateFind() {
    const query = findInput.value;
    if (!query) {
      editor.findMatches('');
      findCountDisplay.textContent = '0 matches';
      return;
    }

    const matches = editor.findMatches(query, false);
    if (matches.length === 0) {
      findCountDisplay.textContent = '0 matches';
    } else {
      const activeIdx = editor.activeFindIndex >= 0 ? editor.activeFindIndex + 1 : 1;
      findCountDisplay.textContent = `${activeIdx} of ${matches.length} matches`;
    }
  }

  function doFindNext() {
    const result = editor.goToNextMatch();
    if (result) {
      findCountDisplay.textContent = `${result.index + 1} of ${result.total} matches`;
    }
  }

  function doFindPrev() {
    const result = editor.goToPrevMatch();
    if (result) {
      findCountDisplay.textContent = `${result.index + 1} of ${result.total} matches`;
    }
  }

  function doReplaceCurrent() {
    const rep = replaceInput.value;
    const ok = editor.replaceCurrentMatch(rep);
    if (ok) {
      updateFind();
      doFindNext();
    }
  }

  function doReplaceAll() {
    const q = findInput.value;
    const rep = replaceInput.value;
    const count = editor.replaceAllMatches(q, rep, false);
    updateFind();
    showAlert(`Replaced ${count} occurrence(s).`, 'conflict');
  }

  /* ----------------------------------------------------
     Alerts Banner
     ---------------------------------------------------- */
  function showAlert(msg, type = 'error', actionBtns = []) {
    alertMessage.textContent = msg;
    alertBanner.className = `alert-banner alert-${type}`;

    alertActions.innerHTML = '';
    actionBtns.forEach(btnInfo => {
      const b = document.createElement('button');
      b.className = 'btn btn-primary';
      b.style.padding = '4px 8px';
      b.style.fontSize = '12px';
      b.textContent = btnInfo.text;
      b.addEventListener('click', btnInfo.onClick);
      alertActions.appendChild(b);
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-icon-only';
    closeBtn.style.padding = '4px 6px';
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:currentColor;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
    closeBtn.title = 'Dismiss';
    closeBtn.addEventListener('click', hideAlert);
    alertActions.appendChild(closeBtn);

    alertBanner.classList.remove('hidden');
  }

  function hideAlert() {
    alertBanner.classList.add('hidden');
  }

  /* ----------------------------------------------------
     UI Event Bindings
     ---------------------------------------------------- */
  function bindUIEvents() {
    // Toolbar buttons
    btnSave.addEventListener('click', saveDocument);
    btnUndo.addEventListener('click', () => { editor.undo(); editor.focus(); });
    btnRedo.addEventListener('click', () => { editor.redo(); editor.focus(); });

    btnFindToggle.addEventListener('click', () => {
      if (findReplacePanel.classList.contains('hidden')) {
        openFindPanel();
        findInput.focus();
        findInput.select();
      } else {
        closeFindPanel();
        editor.focus();
      }
    });

    btnHistoryToggle.addEventListener('click', () => {
      historyDrawer.classList.toggle('hidden');
      if (!historyDrawer.classList.contains('hidden')) {
        fetchRevisionHistory();
      }
    });

    btnHistoryClose.addEventListener('click', () => {
      historyDrawer.classList.add('hidden');
    });

    reportsDropdown.addEventListener('change', (e) => {
      loadDocument(e.target.value);
    });

    // Find & Replace inputs
    findInput.addEventListener('input', updateFind);

    findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) doFindPrev();
        else doFindNext();
      } else if (e.key === 'Escape') {
        // "When the Find input has focus, Escape should return focus to the editing area without changing the current document selection, so people can copy the selected match or continue editing it from the keyboard."
        e.preventDefault();
        editor.focus();
      }
    });

    replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doReplaceCurrent();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        editor.focus();
      }
    });

    btnFindNext.addEventListener('click', doFindNext);
    btnFindPrev.addEventListener('click', doFindPrev);
    btnReplaceOne.addEventListener('click', doReplaceCurrent);
    btnReplaceAll.addEventListener('click', doReplaceAll);
    btnFindClose.addEventListener('click', () => {
      closeFindPanel();
      editor.focus();
    });

    // Preview Modal
    btnPreviewClose.addEventListener('click', hidePreviewModal);
    btnPreviewDismiss.addEventListener('click', hidePreviewModal);
    btnPreviewRestore.addEventListener('click', () => {
      if (currentPreviewRev) restoreRevision(currentPreviewRev);
    });

    // Conflict Modal
    btnConflictKeep.addEventListener('click', hideConflictModal);
    btnConflictReload.addEventListener('click', reloadServerVersion);

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveDocument();
      } else if (modKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        openFindPanel();
        const selected = editor.getAllSelectedText();
        if (selected && !selected.includes('\n')) {
          findInput.value = selected;
        }
        findInput.focus();
        findInput.select();
        updateFind();
      }
    });
  }

  // Expose app for testing/debugging
  window.app = {
    loadDocument,
    saveDocument,
    reloadServerVersion,
    restoreRevision,
    getCurrentDoc: () => currentDoc,
    getBaseRevision: () => baseRevision
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

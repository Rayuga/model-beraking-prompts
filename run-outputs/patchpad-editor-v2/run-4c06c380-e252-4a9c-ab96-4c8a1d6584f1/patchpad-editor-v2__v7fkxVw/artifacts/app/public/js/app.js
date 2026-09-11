// PatchPad Main Application
(function() {
  'use strict';

  // Instantiate core components
  const api = new window.ApiClient();
  let currentDocId = 'incident-alpha';
  let baseRevision = 1;
  let isSaved = true;
  let editor = null;
  let findController = null;
  let revisionController = null;

  // DOM Elements
  const elDocTitle = document.getElementById('doc-title');
  const elDocAuthor = document.getElementById('doc-author');
  const elDocSummary = document.getElementById('doc-summary');
  const elSaveStateBadge = document.getElementById('save-state-badge');
  const elRevisionBadge = document.getElementById('revision-badge');
  const elCursorPos = document.getElementById('cursor-pos');
  const elLineCharStats = document.getElementById('line-char-stats');
  const elCaretsCount = document.getElementById('carets-count');

  // Toolbar Buttons
  const btnSave = document.getElementById('btn-save');
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  const btnFindToggle = document.getElementById('btn-find-toggle');
  const btnHistoryToggle = document.getElementById('btn-history-toggle');
  const btnReportsList = document.getElementById('btn-reports-list');
  const btnFontIncrease = document.getElementById('btn-font-inc');
  const btnFontDecrease = document.getElementById('btn-font-dec');

  // Find & Replace Bar Elements
  const findBar = document.getElementById('find-replace-bar');
  const inputFind = document.getElementById('find-input');
  const inputReplace = document.getElementById('replace-input');
  const findCount = document.getElementById('find-count');
  const btnFindPrev = document.getElementById('btn-find-prev');
  const btnFindNext = document.getElementById('btn-find-next');
  const btnReplaceOne = document.getElementById('btn-replace-one');
  const btnReplaceAll = document.getElementById('btn-replace-all');
  const btnFindClose = document.getElementById('btn-find-close');
  const btnCaseSensitive = document.getElementById('toggle-case');
  const btnWholeWord = document.getElementById('toggle-word');
  const btnRegex = document.getElementById('toggle-regex');

  // History Sidebar Elements
  const historyPanel = document.getElementById('history-panel');
  const historyContent = document.getElementById('history-content');
  const btnCloseHistory = document.getElementById('btn-close-history');

  // Preview Banner Elements
  const previewBanner = document.getElementById('preview-banner');
  const previewText = document.getElementById('preview-text');
  const btnPreviewRestore = document.getElementById('btn-preview-restore');
  const btnPreviewExit = document.getElementById('btn-preview-exit');

  // Conflict Modal Elements
  const conflictModal = document.getElementById('conflict-modal');
  const conflictMessage = document.getElementById('conflict-message');
  const btnConflictKeep = document.getElementById('btn-conflict-keep');
  const btnConflictReload = document.getElementById('btn-conflict-reload');
  const btnConflictCopy = document.getElementById('btn-conflict-copy');

  // Reports Modal Elements
  const reportsModal = document.getElementById('reports-modal');
  const reportsListContent = document.getElementById('reports-list-content');
  const btnCloseReports = document.getElementById('btn-close-reports');

  // Toast / Notification
  const toast = document.getElementById('toast-notification');

  function showToast(message, type = 'info', duration = 3000) {
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast-message show toast-${type}`;
    setTimeout(() => {
      toast.className = 'toast-message';
    }, duration);
  }

  function updateSaveState(saved, isConflict = false) {
    isSaved = saved;
    if (isConflict) {
      elSaveStateBadge.textContent = 'Conflict';
      elSaveStateBadge.className = 'badge badge-conflict';
      btnSave.classList.add('btn-danger');
      return;
    }

    btnSave.classList.remove('btn-danger');
    if (saved) {
      elSaveStateBadge.textContent = 'Saved';
      elSaveStateBadge.className = 'badge badge-saved';
    } else {
      elSaveStateBadge.textContent = 'Unsaved changes';
      elSaveStateBadge.className = 'badge badge-unsaved';
    }

    // Update Undo/Redo button states
    if (editor) {
      btnUndo.disabled = !editor.history.canUndo();
      btnRedo.disabled = !editor.history.canRedo();
    }
  }

  function updateRevisionDisplay(rev) {
    baseRevision = rev;
    elRevisionBadge.textContent = `Rev ${rev}`;
    if (revisionController) {
      revisionController.currentDocumentRevision = rev;
      revisionController.loadRevisions();
    }
  }

  function updateCursorStats(info) {
    elCursorPos.textContent = `Ln ${info.lineNumber}, Col ${info.columnNumber}`;
    elLineCharStats.textContent = `${info.totalLines.toLocaleString()} lines, ${info.totalChars.toLocaleString()} chars`;

    if (info.caretCount > 1) {
      elCaretsCount.textContent = `${info.caretCount} carets`;
      elCaretsCount.style.display = 'inline-block';
    } else {
      elCaretsCount.style.display = 'none';
    }

    btnUndo.disabled = !editor.history.canUndo();
    btnRedo.disabled = !editor.history.canRedo();
  }

  // Initialize Editor
  function initEditor() {
    const editorContainer = document.getElementById('editor-container');
    findController = new window.FindController();

    editor = new window.EditorView(editorContainer, {
      fontSize: 14,
      lineHeight: 24,
      onCursorChange: (info) => {
        updateCursorStats(info);
      },
      onDocChange: () => {
        updateSaveState(false);
        if (findBar.classList.contains('show')) {
          runFind();
        }
      },
      onSaveRequest: () => {
        saveCurrentDocument();
      },
      onFindRequest: (isReplace = false) => {
        openFindBar(isReplace);
      },
      onEscape: () => {
        // Escape from editing area focuses find input
        openFindBar(false);
        inputFind.focus();
        inputFind.select();
      }
    });

    editor.setFindController(findController);

    // Initialize Revision Controller
    revisionController = new window.RevisionController(api, editor, historyContent, {
      documentId: currentDocId,
      onPreviewStart: (revData) => {
        previewBanner.classList.add('show');
        previewText.textContent = `Previewing Revision ${revData.revision} (saved on ${revisionController.formatTimestamp(revData.timestamp)} by ${revData.author || 'Riley Stone'}). Editing is disabled in preview.`;
      },
      onPreviewEnd: () => {
        previewBanner.classList.remove('show');
      },
      onRestore: (revNum) => {
        previewBanner.classList.remove('show');
        updateSaveState(false);
        showToast(`Restored content from Revision ${revNum} as unsaved changes`, 'info');
        editor.container.focus();
      }
    });
  }

  // Load document from server
  async function loadDocument(id = 'incident-alpha') {
    try {
      showToast('Loading document...', 'info', 1000);
      const doc = await api.getDocument(id);
      currentDocId = doc.id;
      baseRevision = doc.currentRevision;

      elDocTitle.textContent = doc.title || 'Incident Report';
      elDocAuthor.textContent = `Author: ${doc.author || 'Unknown'}`;
      if (elDocSummary) {
        elDocSummary.textContent = doc.summary || '';
      }

      updateRevisionDisplay(doc.currentRevision);
      editor.setText(doc.content, true);
      updateSaveState(true);

      revisionController.setDocumentId(doc.id, doc.currentRevision);
      showToast('Document loaded', 'success', 2000);
    } catch (err) {
      showToast(`Failed to load document: ${err.message}`, 'error', 5000);
    }
  }

  // Save current document
  async function saveCurrentDocument() {
    if (editor.options.readOnly) {
      showToast('Cannot save while in preview mode', 'warning');
      return;
    }

    btnSave.disabled = true;
    btnSave.classList.add('saving');
    const origText = btnSave.innerHTML;
    btnSave.innerHTML = `<span class="spinner"></span> Saving...`;

    try {
      const content = editor.getText();
      const res = await api.saveDocument({
        documentId: currentDocId,
        baseRevision: baseRevision,
        content: content,
        author: 'Riley Stone'
      });

      if (res.conflict) {
        // Stale save / Conflict!
        updateSaveState(false, true);
        showConflictModal(res);
        showToast(`Conflict: Server has newer revision (${res.currentRevision})`, 'error', 6000);
        return;
      }

      if (res.error) {
        showToast(`Save failed: ${res.message}`, 'error', 5000);
        return;
      }

      if (res.status === 'unchanged') {
        updateSaveState(true);
        showToast('Document is unchanged (already up to date)', 'info', 3000);
      } else {
        updateRevisionDisplay(res.revision);
        updateSaveState(true);
        showToast(`Saved as Revision ${res.revision}`, 'success', 3000);
      }
    } catch (err) {
      showToast(`Network error saving: ${err.message}`, 'error', 5000);
    } finally {
      btnSave.disabled = false;
      btnSave.classList.remove('saving');
      btnSave.innerHTML = origText;
    }
  }

  // Conflict Modal
  function showConflictModal(conflictData) {
    conflictMessage.innerHTML = `
      <p><strong>Another user or session saved a newer revision (${conflictData.currentRevision}) of this document.</strong></p>
      <p>Your local edits (based on revision ${baseRevision}) have been safely preserved in your editor so no work is lost.</p>
      <p>Choose an action below:</p>
    `;
    conflictModal.classList.add('show');
  }

  function hideConflictModal() {
    conflictModal.classList.remove('show');
  }

  // Find & Replace Functions
  function openFindBar(showReplace = false) {
    findBar.classList.add('show');
    if (showReplace) {
      findBar.classList.add('with-replace');
    }
    const selectedText = editor.getSelectedText();
    if (selectedText && !selectedText.includes('\n') && selectedText.length < 100) {
      inputFind.value = selectedText;
    }
    runFind();
    if (showReplace) {
      inputReplace.focus();
    } else {
      inputFind.focus();
      inputFind.select();
    }
  }

  function closeFindBar() {
    findBar.classList.remove('show');
    findBar.classList.remove('with-replace');
    findController.matches = [];
    findController.currentMatchIndex = -1;
    editor.render();
    editor.container.focus();
  }

  function runFind() {
    findController.setQuery(inputFind.value);
    findController.setReplaceText(inputReplace.value);
    findController.caseSensitive = btnCaseSensitive.classList.contains('active');
    findController.wholeWord = btnWholeWord.classList.contains('active');
    findController.useRegex = btnRegex.classList.contains('active');

    const primaryCaret = editor.selectionManager.primary.head;
    const res = findController.findMatches(editor.doc, primaryCaret);

    if (res.error) {
      findCount.textContent = 'Invalid regex';
      findCount.className = 'find-match-count error';
    } else if (res.count === 0) {
      findCount.textContent = inputFind.value ? '0 of 0' : '0 matches';
      findCount.className = 'find-match-count';
    } else {
      findCount.textContent = `${res.currentIndex + 1} of ${res.count}`;
      findCount.className = 'find-match-count has-matches';
    }

    editor.render();
  }

  function navigateFind(forward = true) {
    if (findController.matches.length === 0) {
      runFind();
    }
    if (findController.matches.length === 0) return;

    const match = forward ? findController.nextMatch() : findController.prevMatch();
    if (match) {
      findCount.textContent = `${findController.currentMatchIndex + 1} of ${findController.matches.length}`;
      editor.selectMatch(match);
    }
  }

  function replaceOneMatch() {
    const match = findController.getCurrentMatch();
    if (!match) {
      navigateFind(true);
      return;
    }

    // Select and replace
    editor.selectMatch(match);
    editor.replaceSelection(inputReplace.value);

    // Update find and move to next
    runFind();
    navigateFind(true);
    showToast('Replaced 1 match', 'info', 1500);
  }

  function replaceAllMatches() {
    runFind();
    if (findController.matches.length === 0) {
      showToast('No matches to replace', 'info', 2000);
      return;
    }

    const count = findController.matches.length;
    const replaceStr = inputReplace.value;

    const beforeText = editor.doc.getText();
    const beforeSelections = editor.selectionManager.selections.map(s => s.clone());

    // Replace from bottom to top to preserve offsets
    const sorted = [...findController.matches].sort((a, b) => {
      if (a.row !== b.row) return b.row - a.row;
      return b.startCol - a.startCol;
    });

    for (const m of sorted) {
      editor.doc.deleteRange({ row: m.row, col: m.startCol }, { row: m.row, col: m.endCol });
      editor.doc.insertAt({ row: m.row, col: m.startCol }, replaceStr);
    }

    editor.selectionManager.setSingleCaret(0, 0);
    const afterText = editor.doc.getText();
    const afterSelections = editor.selectionManager.selections.map(s => s.clone());

    editor.history.recordChange({
      beforeText,
      afterText,
      beforeSelections,
      afterSelections,
      actionType: 'replace_all'
    });

    editor.render();
    runFind();
    updateSaveState(false);
    showToast(`Replaced ${count} occurrence${count === 1 ? '' : 's'}`, 'success', 3000);
  }

  // Available Reports Modal
  async function showReportsList() {
    try {
      reportsModal.classList.add('show');
      reportsListContent.innerHTML = `<div class="reports-loading"><span class="spinner"></span> Loading reports...</div>`;
      const docs = await api.listDocuments();

      let html = '<div class="reports-grid">';
      for (const d of docs) {
        const isCurrent = d.id === currentDocId;
        html += `
          <div class="report-card${isCurrent ? ' active' : ''}" data-id="${d.id}">
            <div class="report-card-header">
              <span class="report-title">${d.title}</span>
              <span class="badge ${isCurrent ? 'badge-primary' : 'badge-secondary'}">Rev ${d.currentRevision}</span>
            </div>
            <div class="report-card-author">👤 ${d.author}</div>
            <div class="report-card-summary">${d.summary || 'No summary'}</div>
            <div class="report-card-footer">
              <span class="report-id">ID: <code>${d.id}</code></span>
              <button class="btn btn-sm ${isCurrent ? 'btn-secondary' : 'btn-primary'} btn-open-report" data-id="${d.id}">
                ${isCurrent ? 'Current' : 'Open'}
              </button>
            </div>
          </div>
        `;
      }
      html += '</div>';
      reportsListContent.innerHTML = html;

      const openBtns = reportsListContent.querySelectorAll('.btn-open-report');
      openBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const docId = btn.getAttribute('data-id');
          reportsModal.classList.remove('show');
          if (docId !== currentDocId) {
            loadDocument(docId);
          }
        });
      });
    } catch (err) {
      reportsListContent.innerHTML = `<div class="history-error">Failed to list reports: ${err.message}</div>`;
    }
  }

  // Event Listeners Wiring
  function wireEvents() {
    // Toolbar buttons
    btnSave.addEventListener('click', () => saveCurrentDocument());
    btnUndo.addEventListener('click', () => editor.undo());
    btnRedo.addEventListener('click', () => editor.redo());

    btnFindToggle.addEventListener('click', () => {
      if (findBar.classList.contains('show')) {
        closeFindBar();
      } else {
        openFindBar(false);
      }
    });

    btnHistoryToggle.addEventListener('click', () => {
      historyPanel.classList.toggle('open');
      if (historyPanel.classList.contains('open')) {
        revisionController.loadRevisions();
      }
    });

    btnCloseHistory.addEventListener('click', () => {
      historyPanel.classList.remove('open');
    });

    btnReportsList.addEventListener('click', () => showReportsList());
    btnCloseReports.addEventListener('click', () => reportsModal.classList.remove('show'));

    // Font size adjustments
    let currentFontSize = 14;
    btnFontIncrease.addEventListener('click', () => {
      if (currentFontSize < 24) {
        currentFontSize += 2;
        editor.setFontSize(currentFontSize);
      }
    });
    btnFontDecrease.addEventListener('click', () => {
      if (currentFontSize > 10) {
        currentFontSize -= 2;
        editor.setFontSize(currentFontSize);
      }
    });

    // Find & Replace Inputs & Buttons
    inputFind.addEventListener('input', () => runFind());
    inputReplace.addEventListener('input', () => runFind());

    inputFind.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        navigateFind(!e.shiftKey);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // Return focus to editing area without changing document selection
        editor.container.focus();
      }
    });

    inputReplace.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        replaceOneMatch();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        editor.container.focus();
      }
    });

    btnFindNext.addEventListener('click', () => navigateFind(true));
    btnFindPrev.addEventListener('click', () => navigateFind(false));
    btnReplaceOne.addEventListener('click', () => replaceOneMatch());
    btnReplaceAll.addEventListener('click', () => replaceAllMatches());
    btnFindClose.addEventListener('click', () => closeFindBar());

    // Find option toggles
    [btnCaseSensitive, btnWholeWord, btnRegex].forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        runFind();
      });
    });

    // Preview Banner
    btnPreviewExit.addEventListener('click', () => {
      revisionController.exitPreview();
    });

    btnPreviewRestore.addEventListener('click', () => {
      if (revisionController.previewingRevision !== null) {
        revisionController.restoreRevision(revisionController.previewingRevision);
      }
    });

    // Conflict Modal Actions
    btnConflictKeep.addEventListener('click', () => {
      hideConflictModal();
      showToast('Local draft preserved. You can continue editing, copy text, or reload.', 'info', 4000);
      editor.container.focus();
    });

    btnConflictReload.addEventListener('click', () => {
      hideConflictModal();
      loadDocument(currentDocId);
    });

    btnConflictCopy.addEventListener('click', async () => {
      try {
        const text = editor.getText();
        await navigator.clipboard.writeText(text);
        showToast('Draft copied to clipboard', 'success', 3000);
      } catch (e) {
        showToast('Clipboard access denied', 'error', 3000);
      }
    });

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openFindBar(false);
      } else if (modKey && !e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        openFindBar(true);
      } else if (modKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveCurrentDocument();
      }
    });

    // Window resize
    window.addEventListener('resize', () => {
      if (editor) {
        editor.render();
      }
    });
  }

  // Boot on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    initEditor();
    wireEvents();
    loadDocument('incident-alpha');
  });
})();

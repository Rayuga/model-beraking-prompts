/**
 * GridForge Main Application Controller
 */

(function () {
  const WORKBOOK_ID = 'ops-plan';
  const SHEET_ID = 'plan';

  let currentWorkbook = null;
  let baseRevision = 1;
  let isDirty = false;
  let isSaving = false;
  let isPreviewing = false;
  let previewRevisionData = null;
  let autosaveTimer = null;
  let currentUser = { id: 'riley', name: 'Riley Stone', color: '#2563eb' };

  // Core components
  let calculator = null;
  let grid = null;
  let undoRedo = null;
  let collabClient = null;
  let findReplace = null;

  // Local draft tracking
  let serverSnapshotCells = {}; // Base cells confirmed by server
  let localDraftCells = {};     // Cells edited locally { "B2": "value" }

  // DOM Elements
  const els = {
    workbookTitle: document.getElementById('workbook-title'),
    sheetName: document.getElementById('sheet-name'),
    saveStatusBadge: document.getElementById('save-status-badge'),
    saveStatusIcon: document.getElementById('save-status-icon'),
    saveStatusText: document.getElementById('save-status-text'),
    btnSaveNow: document.getElementById('btn-save-now'),
    btnUndo: document.getElementById('btn-undo'),
    btnRedo: document.getElementById('btn-redo'),
    btnFillDown: document.getElementById('btn-fill-down'),
    btnFindReplace: document.getElementById('btn-find-replace'),
    btnCellHistory: document.getElementById('btn-cell-history'),
    btnRevisions: document.getElementById('btn-revisions'),
    userSelect: document.getElementById('user-select'),
    currentUserAvatar: document.getElementById('current-user-avatar'),
    presenceLegend: document.getElementById('presence-legend'),
    previewBanner: document.getElementById('preview-banner'),
    previewRevNum: document.getElementById('preview-rev-num'),
    previewRevAuthor: document.getElementById('preview-rev-author'),
    previewRevTime: document.getElementById('preview-rev-time'),
    btnConfirmRestore: document.getElementById('btn-confirm-restore'),
    btnExitPreview: document.getElementById('btn-exit-preview'),

    // Modals
    revisionsModal: document.getElementById('revisions-modal'),
    revisionList: document.getElementById('revision-list'),
    btnCloseRevisions: document.getElementById('btn-close-revisions'),
    btnCloseRevisionsFooter: document.getElementById('btn-close-revisions-footer'),

    cellHistoryModal: document.getElementById('cell-history-modal'),
    cellHistoryRef: document.getElementById('cell-history-ref'),
    cellHistoryList: document.getElementById('cell-history-list'),
    btnCloseCellHistory: document.getElementById('btn-close-cell-history'),
    btnCloseCellHistoryFooter: document.getElementById('btn-close-cell-history-footer'),

    findReplaceModal: document.getElementById('find-replace-modal'),
    findInput: document.getElementById('find-input'),
    replaceInput: document.getElementById('replace-input'),
    findMatchCase: document.getElementById('find-match-case'),
    findEntireCell: document.getElementById('find-entire-cell'),
    findResultsCount: document.getElementById('find-results-count'),
    btnFindNext: document.getElementById('btn-find-next'),
    btnFindPrev: document.getElementById('btn-find-prev'),
    btnReplaceOne: document.getElementById('btn-replace-one'),
    btnReplaceAll: document.getElementById('btn-replace-all'),
    btnCloseFindReplace: document.getElementById('btn-close-find-replace'),

    conflictModal: document.getElementById('conflict-modal'),
    conflictDetailsList: document.getElementById('conflict-details-list'),
    btnConflictAcceptRemote: document.getElementById('btn-conflict-accept-remote'),
    btnConflictKeepDraft: document.getElementById('btn-conflict-keep-draft'),
    btnCloseConflict: document.getElementById('btn-close-conflict'),

    toastContainer: document.getElementById('toast-container')
  };

  // --- Initialize App ---
  async function init() {
    setupUndoRedo();
    await loadWorkbook();
    setupGrid();
    setupCollaboration();
    setupUIEvents();
    setupClipboard();
    setupFindReplace();
  }

  // --- Load Workbook from Server ---
  async function loadWorkbook() {
    try {
      const res = await fetch(`/api/workbooks/${WORKBOOK_ID}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();

      currentWorkbook = data;
      baseRevision = data.current_revision || 1;
      els.workbookTitle.textContent = data.title || 'Northwind Operations Plan';

      const sheet = data.sheets && data.sheets.find(s => s.id === SHEET_ID) || data.sheets[0];
      els.sheetName.textContent = `Sheet: ${sheet ? sheet.name : 'Plan'}`;

      serverSnapshotCells = { ...(sheet ? sheet.cells : {}) };
      localDraftCells = {};
      isDirty = false;

      // Populate user dropdown
      if (data.users && data.users.length > 0) {
        els.userSelect.innerHTML = '';
        data.users.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.id;
          opt.textContent = u.name;
          opt.dataset.color = u.color;
          els.userSelect.appendChild(opt);
        });

        const selectedUser = data.users[0];
        currentUser = { id: selectedUser.id, name: selectedUser.name, color: selectedUser.color || '#2563eb' };
        els.userSelect.value = currentUser.id;
        updateUserAvatar();
      }

      calculator = new FormulaEngine.WorkbookCalculator(serverSnapshotCells);
      calculator.computeAll();
      updateSaveStatusBadge('saved', `Saved (Rev ${baseRevision})`);
    } catch (err) {
      console.error('Failed to load workbook:', err);
      showToast(`Error loading workbook: ${err.message}`, 'error');
    }
  }

  // --- Grid Setup ---
  function setupGrid() {
    grid = new GridComponent.Grid({
      tableEl: document.getElementById('grid-table'),
      wrapperEl: document.getElementById('grid-wrapper'),
      formulaInputEl: document.getElementById('formula-input'),
      nameBoxEl: document.getElementById('name-box'),
      selectionBoxEl: document.getElementById('selection-box'),
      fillHandleEl: document.getElementById('fill-handle'),
      floatingEditorEl: document.getElementById('floating-editor'),
      suggestionsEl: document.getElementById('formula-suggestions'),
      remoteCursorsLayerEl: document.getElementById('remote-cursors-layer'),
      calculator: calculator,

      onCellCommit: (ref, oldVal, newVal) => {
        if (oldVal === newVal) return;
        applyCellEdit(ref, oldVal, newVal, true);
      },

      onSelectionChange: (activeRef, rangeStr) => {
        if (collabClient) {
          collabClient.sendPresence(activeRef, rangeStr);
        }
      },

      onFillCommit: (srcRange, direction, count) => {
        handleFill(srcRange, direction, count);
      },

      onDeleteSelection: () => {
        handleDeleteSelection();
      }
    });
  }

  // --- Collaboration Setup ---
  function setupCollaboration() {
    collabClient = new CollaborationClient.CollaborationClient({
      workbookId: WORKBOOK_ID,
      userId: currentUser.id,
      userName: currentUser.name,

      onPresenceUpdate: (sessions) => {
        renderPresence(sessions);
      },

      onRevisionSaved: (msg) => {
        handleRemoteRevision(msg);
      },

      onError: (err) => {
        showToast(`Collaboration warning: ${err}`, 'warning');
      }
    });

    collabClient.connect();
  }

  function renderPresence(sessions) {
    // Filter out current session
    const otherSessions = sessions.filter(s => s.sessionId !== collabClient.sessionId);

    // Update Presence Legend in toolbar
    els.presenceLegend.innerHTML = '';
    const uniqueUsers = new Map();
    sessions.forEach(s => {
      uniqueUsers.set(s.userId, { name: s.userName, color: s.color });
    });

    uniqueUsers.forEach((u, uid) => {
      const pill = document.createElement('span');
      pill.className = 'presence-pill';
      pill.style.backgroundColor = u.color;
      pill.textContent = (uid === currentUser.id) ? `${u.name} (You)` : u.name;
      els.presenceLegend.appendChild(pill);
    });

    // Render remote cursors on grid
    if (grid) {
      grid.renderRemoteCursors(otherSessions);
    }
  }

  function handleRemoteRevision(msg) {
    const newRev = msg.revision;
    const author = msg.user ? msg.user.name : 'A colleague';
    const remoteWorkbook = msg.workbook;

    if (!remoteWorkbook || !remoteWorkbook.sheets) return;
    const remoteSheet = remoteWorkbook.sheets.find(s => s.id === SHEET_ID) || remoteWorkbook.sheets[0];
    const incomingCells = remoteSheet ? remoteSheet.cells : {};

    // Check if we have local unsaved edits
    if (isDirty && Object.keys(localDraftCells).length > 0) {
      const conflicts = [];

      for (const [cellRef, localVal] of Object.entries(localDraftCells)) {
        const serverOldVal = serverSnapshotCells[cellRef] || '';
        const incomingVal = incomingCells[cellRef] || '';
        if (serverOldVal !== incomingVal && incomingVal !== localVal) {
          conflicts.push({
            cell: cellRef,
            localVal,
            incomingVal,
            author
          });
        }
      }

      if (conflicts.length > 0) {
        showConflictModal(conflicts, incomingCells, newRev);
        return;
      }

      // No direct cell conflicts: combine remote changes into our state, keep our local drafts
      for (const [ref, val] of Object.entries(incomingCells)) {
        if (!localDraftCells.hasOwnProperty(ref)) {
          calculator.setCell(ref, val);
        }
      }
      // Remove any cells deleted in remote that we didn't touch
      for (const ref of Object.keys(serverSnapshotCells)) {
        if (!incomingCells.hasOwnProperty(ref) && !localDraftCells.hasOwnProperty(ref)) {
          calculator.setCell(ref, '');
        }
      }

      serverSnapshotCells = { ...incomingCells };
      baseRevision = newRev;
      grid.render();
      showToast(`${author} saved changes (Rev ${newRev}). Your local drafts were merged.`, 'info');
      return;
    }

    // No local draft: seamlessly update to latest revision
    serverSnapshotCells = { ...incomingCells };
    localDraftCells = {};
    baseRevision = newRev;
    calculator.setCells(serverSnapshotCells);
    grid.render();
    updateSaveStatusBadge('saved', `Saved (Rev ${baseRevision})`);
    showToast(`${author} saved changes (Rev ${newRev})`, 'info');
  }

  // --- Cell & Batch Edits ---
  function applyCellEdit(ref, oldVal, newVal, pushUndo = true) {
    if (isPreviewing) {
      showToast('Cannot edit in revision preview mode', 'warning');
      return;
    }

    calculator.setCell(ref, newVal);
    localDraftCells[ref] = newVal;
    isDirty = true;

    if (pushUndo) {
      undoRedo.push({
        type: 'cell_edit',
        cell: ref,
        oldVal,
        newVal
      });
    }

    grid.render();
    updateSaveStatusBadge('unsaved', 'Unsaved edits');
    scheduleAutosave();
  }

  function applyBatchEdit(changes, description = 'Batch Edit', pushUndo = true) {
    if (isPreviewing || changes.length === 0) return;

    for (const change of changes) {
      calculator.setCell(change.cell, change.newVal);
      localDraftCells[change.cell] = change.newVal;
    }
    isDirty = true;

    if (pushUndo) {
      undoRedo.push({
        type: 'batch_edit',
        description,
        changes
      });
    }

    grid.render();
    updateSaveStatusBadge('unsaved', 'Unsaved edits');
    scheduleAutosave();
  }

  function handleDeleteSelection() {
    const range = grid.getSelectionRange();
    const cells = FormulaEngine.expandRange(range.startRef, range.endRef);
    const changes = [];

    for (const ref of cells) {
      const oldVal = calculator.getRawValue(ref);
      if (oldVal !== '') {
        changes.push({ cell: ref, oldVal, newVal: '' });
      }
    }

    if (changes.length > 0) {
      applyBatchEdit(changes, 'Clear');
    }
  }

  function handleFill(srcRange, direction, count) {
    const changes = [];

    if (direction === 'down') {
      for (let c = srcRange.minCol; c <= srcRange.maxCol; c++) {
        const colLetter = FormulaEngine.indexToColLetter(c);
        const sourceValues = [];
        for (let r = srcRange.minRow; r <= srcRange.maxRow; r++) {
          sourceValues.push(calculator.getRawValue(`${colLetter}${r}`));
        }

        const generated = ClipboardEngine.generateFillValues(sourceValues, count, 1, 0);
        for (let i = 0; i < count; i++) {
          const targetRow = srcRange.maxRow + 1 + i;
          const targetRef = `${colLetter}${targetRow}`;
          const oldVal = calculator.getRawValue(targetRef);
          const newVal = generated[i];
          changes.push({ cell: targetRef, oldVal, newVal });
        }
      }
    } else if (direction === 'right') {
      for (let r = srcRange.minRow; r <= srcRange.maxRow; r++) {
        const sourceValues = [];
        for (let c = srcRange.minCol; c <= srcRange.maxCol; c++) {
          const colLetter = FormulaEngine.indexToColLetter(c);
          sourceValues.push(calculator.getRawValue(`${colLetter}${r}`));
        }

        const generated = ClipboardEngine.generateFillValues(sourceValues, count, 0, 1);
        for (let i = 0; i < count; i++) {
          const targetCol = srcRange.maxCol + 1 + i;
          const colLetter = FormulaEngine.indexToColLetter(targetCol);
          const targetRef = `${colLetter}${r}`;
          const oldVal = calculator.getRawValue(targetRef);
          const newVal = generated[i];
          changes.push({ cell: targetRef, oldVal, newVal });
        }
      }
    }

    if (changes.length > 0) {
      applyBatchEdit(changes, 'Fill');
    }
  }

  // --- Autosave & Manual Save ---
  function scheduleAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      saveWorkbook('Autosave');
    }, 2000); // 2 second debounce (within 5 seconds)
  }

  async function saveWorkbook(description = 'Save') {
    if (isSaving || !isDirty || isPreviewing) return;
    isSaving = true;
    updateSaveStatusBadge('saving', 'Saving...');

    const snapshot = {
      id: WORKBOOK_ID,
      title: currentWorkbook ? currentWorkbook.title : 'Northwind Operations Plan',
      sheets: [
        {
          id: SHEET_ID,
          name: 'Plan',
          cells: { ...calculator.rawCells }
        }
      ]
    };

    try {
      const res = await fetch(`/api/workbooks/${WORKBOOK_ID}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseRevision: baseRevision,
          workbook: snapshot,
          userId: currentUser.id,
          userName: currentUser.name,
          description: description
        })
      });

      const result = await res.json();

      if (!res.ok) {
        if (res.status === 409 && result.conflict) {
          // Overlapping concurrent conflict
          updateSaveStatusBadge('error', 'Conflict');
          showToast(result.error || 'Concurrent edit conflict detected', 'error');
          // Fetch latest revision to help resolve
          const latestRes = await fetch(`/api/workbooks/${WORKBOOK_ID}`);
          if (latestRes.ok) {
            const latestWb = await latestRes.json();
            const latestSheet = latestWb.sheets.find(s => s.id === SHEET_ID) || latestWb.sheets[0];
            const conflicts = (result.conflictingCells || []).map(cell => ({
              cell,
              localVal: calculator.getRawValue(cell),
              incomingVal: (latestSheet.cells && latestSheet.cells[cell]) || '',
              author: 'Colleague'
            }));
            showConflictModal(conflicts, latestSheet.cells, latestWb.current_revision);
          }
        } else {
          updateSaveStatusBadge('error', 'Save failed');
          showToast(`Save rejected: ${result.error || 'Unknown error'}`, 'error');
        }
        isSaving = false;
        return;
      }

      baseRevision = result.revision;
      serverSnapshotCells = { ...snapshot.sheets[0].cells };
      localDraftCells = {};
      isDirty = false;
      updateSaveStatusBadge('saved', `Saved (Rev ${baseRevision})`);
    } catch (err) {
      console.error('Error saving workbook:', err);
      updateSaveStatusBadge('error', 'Network error');
      showToast(`Network error saving workbook: ${err.message}`, 'error');
    } finally {
      isSaving = false;
    }
  }

  function updateSaveStatusBadge(status, text) {
    els.saveStatusBadge.className = `save-status ${status}`;
    els.saveStatusText.textContent = text;
    if (status === 'saved') {
      els.saveStatusIcon.textContent = '✓';
    } else if (status === 'saving') {
      els.saveStatusIcon.textContent = '⏳';
    } else if (status === 'unsaved') {
      els.saveStatusIcon.textContent = '●';
    } else if (status === 'error') {
      els.saveStatusIcon.textContent = '⚠️';
    }
  }

  // --- Undo / Redo Setup ---
  function setupUndoRedo() {
    undoRedo = new HistoryManager.UndoRedoStack({
      onStateChange: (canUndo, canRedo) => {
        els.btnUndo.disabled = !canUndo;
        els.btnRedo.disabled = !canRedo;
      }
    });

    els.btnUndo.disabled = true;
    els.btnRedo.disabled = true;
  }

  function performUndo() {
    if (!undoRedo.canUndo() || isPreviewing) return;
    const action = undoRedo.undo();
    if (!action) return;

    if (action.type === 'cell_edit') {
      calculator.setCell(action.cell, action.oldVal);
      localDraftCells[action.cell] = action.oldVal;
    } else if (action.type === 'batch_edit') {
      for (const change of action.changes) {
        calculator.setCell(change.cell, change.oldVal);
        localDraftCells[change.cell] = action.oldVal;
      }
    } else if (action.type === 'restore') {
      calculator.setCells(action.oldCells);
      localDraftCells = { ...action.oldCells };
    }

    isDirty = true;
    grid.render();
    updateSaveStatusBadge('unsaved', 'Unsaved edits');
    scheduleAutosave();
  }

  function performRedo() {
    if (!undoRedo.canRedo() || isPreviewing) return;
    const action = undoRedo.redo();
    if (!action) return;

    if (action.type === 'cell_edit') {
      calculator.setCell(action.cell, action.newVal);
      localDraftCells[action.cell] = action.newVal;
    } else if (action.type === 'batch_edit') {
      for (const change of action.changes) {
        calculator.setCell(change.cell, change.newVal);
        localDraftCells[change.cell] = change.newVal;
      }
    } else if (action.type === 'restore') {
      calculator.setCells(action.newCells);
      localDraftCells = { ...action.newCells };
    }

    isDirty = true;
    grid.render();
    updateSaveStatusBadge('unsaved', 'Unsaved edits');
    scheduleAutosave();
  }

  // --- Clipboard (Copy, Cut, Paste) ---
  function setupClipboard() {
    document.addEventListener('copy', (e) => {
      if (grid.isEditing || document.activeElement.tagName === 'INPUT') return;
      e.preventDefault();
      const range = grid.getSelectionRange();
      const data = [];
      for (let r = range.minRow; r <= range.maxRow; r++) {
        const rowData = [];
        for (let c = range.minCol; c <= range.maxCol; c++) {
          const colLetter = FormulaEngine.indexToColLetter(c);
          rowData.push(calculator.getRawValue(`${colLetter}${r}`));
        }
        data.push(rowData);
      }
      const tsv = ClipboardEngine.formatTSV(data);
      e.clipboardData.setData('text/plain', tsv);
      showToast('Copied to clipboard', 'info');
    });

    document.addEventListener('cut', (e) => {
      if (grid.isEditing || document.activeElement.tagName === 'INPUT') return;
      e.preventDefault();
      const range = grid.getSelectionRange();
      const data = [];
      const changes = [];

      for (let r = range.minRow; r <= range.maxRow; r++) {
        const rowData = [];
        for (let c = range.minCol; c <= range.maxCol; c++) {
          const colLetter = FormulaEngine.indexToColLetter(c);
          const ref = `${colLetter}${r}`;
          const raw = calculator.getRawValue(ref);
          rowData.push(raw);
          if (raw !== '') {
            changes.push({ cell: ref, oldVal: raw, newVal: '' });
          }
        }
        data.push(rowData);
      }

      const tsv = ClipboardEngine.formatTSV(data);
      e.clipboardData.setData('text/plain', tsv);

      if (changes.length > 0) {
        applyBatchEdit(changes, 'Cut');
      }
      showToast('Cut to clipboard', 'info');
    });

    document.addEventListener('paste', (e) => {
      if (grid.isEditing || document.activeElement.tagName === 'INPUT') return;
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      if (!text) return;

      const parsed = ClipboardEngine.parseClipboardText(text);
      if (parsed.length === 0) return;

      const activeRow = grid.activeRow;
      const activeCol = grid.activeCol;
      const changes = [];

      for (let rIdx = 0; rIdx < parsed.length; rIdx++) {
        const rowData = parsed[rIdx];
        const targetRow = activeRow + rIdx;
        if (targetRow > GridComponent.NUM_ROWS) break;

        for (let cIdx = 0; cIdx < rowData.length; cIdx++) {
          const targetCol = activeCol + cIdx;
          if (targetCol > GridComponent.NUM_COLS) break;

          const colLetter = FormulaEngine.indexToColLetter(targetCol);
          const targetRef = `${colLetter}${targetRow}`;
          const oldVal = calculator.getRawValue(targetRef);
          const newVal = rowData[cIdx];

          changes.push({ cell: targetRef, oldVal, newVal });
        }
      }

      if (changes.length > 0) {
        applyBatchEdit(changes, 'Paste');
        grid.setSelection(activeRow, activeCol, activeRow + parsed.length - 1, activeCol + (parsed[0] ? parsed[0].length - 1 : 0));
        showToast('Pasted clipboard data', 'info');
      }
    });
  }

  // --- Find and Replace Setup ---
  function setupFindReplace() {
    findReplace = new FindReplaceEngine.FindReplace(calculator);

    els.btnFindReplace.addEventListener('click', () => {
      openModal(els.findReplaceModal);
      els.findInput.focus();
      els.findInput.select();
    });

    els.btnCloseFindReplace.addEventListener('click', () => {
      closeModal(els.findReplaceModal);
    });

    const runFind = () => {
      const query = els.findInput.value;
      const matches = findReplace.findAll(query, {
        matchCase: els.findMatchCase.checked,
        entireCell: els.findEntireCell.checked
      });

      els.findResultsCount.textContent = matches.length > 0 ? `${findReplace.currentIndex + 1} of ${matches.length} matches` : 'No matches found';
      if (matches.length > 0) {
        const currentRef = findReplace.current();
        grid.jumpToAddress(currentRef);
      }
    };

    els.findInput.addEventListener('input', runFind);
    els.findMatchCase.addEventListener('change', runFind);
    els.findEntireCell.addEventListener('change', runFind);

    els.btnFindNext.addEventListener('click', () => {
      const nextRef = findReplace.next();
      if (nextRef) {
        grid.jumpToAddress(nextRef);
        els.findResultsCount.textContent = `${findReplace.currentIndex + 1} of ${findReplace.matches.length} matches`;
      }
    });

    els.btnFindPrev.addEventListener('click', () => {
      const prevRef = findReplace.prev();
      if (prevRef) {
        grid.jumpToAddress(prevRef);
        els.findResultsCount.textContent = `${findReplace.currentIndex + 1} of ${findReplace.matches.length} matches`;
      }
    });

    els.btnReplaceOne.addEventListener('click', () => {
      const currentRef = findReplace.current();
      if (!currentRef) return;
      const query = els.findInput.value;
      const rep = els.replaceInput.value;
      const oldVal = calculator.getRawValue(currentRef);
      let newVal = rep;
      if (!els.findEntireCell.checked) {
        const flags = els.findMatchCase.checked ? 'g' : 'gi';
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        newVal = oldVal.replace(new RegExp(escaped, flags), rep);
      }
      applyCellEdit(currentRef, oldVal, newVal, true);
      runFind();
    });

    els.btnReplaceAll.addEventListener('click', () => {
      const query = els.findInput.value;
      const rep = els.replaceInput.value;
      const changes = findReplace.replaceAll(query, rep, {
        matchCase: els.findMatchCase.checked,
        entireCell: els.findEntireCell.checked
      });

      if (changes.length > 0) {
        applyBatchEdit(changes, 'Replace All');
        showToast(`Replaced ${changes.length} occurrences`, 'success');
        runFind();
      } else {
        showToast('No replacements made', 'info');
      }
    });
  }

  // --- Revision History & Preview ---
  async function openRevisionHistory() {
    openModal(els.revisionsModal);
    els.revisionList.innerHTML = '<div style="padding:12px; color:var(--text-muted);">Loading revisions...</div>';

    try {
      const res = await fetch(`/api/workbooks/${WORKBOOK_ID}/revisions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const revisions = await res.json();

      if (revisions.length === 0) {
        els.revisionList.innerHTML = '<div>No revisions found.</div>';
        return;
      }

      els.revisionList.innerHTML = '';
      revisions.forEach(rev => {
        const card = document.createElement('div');
        card.className = 'revision-card';

        const isCurrent = rev.revision_number === baseRevision && !isDirty;
        card.innerHTML = `
          <div class="revision-info">
            <div class="revision-title">
              Revision #${rev.revision_number} ${isCurrent ? '<span style="color:var(--success-color); font-size:11px;">(Current)</span>' : ''}
            </div>
            <div class="revision-meta">
              ${rev.user_name || 'Anonymous'} &bull; ${HistoryManager.formatRelativeTime(rev.created_at)} &bull; <em>${rev.description || 'Update'}</em>
            </div>
          </div>
          <div class="revision-actions">
            <button class="btn btn-sm btn-preview-rev" data-rev="${rev.revision_number}">Preview</button>
            <button class="btn btn-primary btn-sm btn-restore-rev" data-rev="${rev.revision_number}">Restore</button>
          </div>
        `;

        card.querySelector('.btn-preview-rev').addEventListener('click', () => {
          closeModal(els.revisionsModal);
          startRevisionPreview(rev.revision_number);
        });

        card.querySelector('.btn-restore-rev').addEventListener('click', () => {
          closeModal(els.revisionsModal);
          restoreRevision(rev.revision_number);
        });

        els.revisionList.appendChild(card);
      });
    } catch (err) {
      els.revisionList.innerHTML = `<div style="color:var(--danger-color);">Failed to load revisions: ${err.message}</div>`;
    }
  }

  async function startRevisionPreview(revNum) {
    try {
      const res = await fetch(`/api/workbooks/${WORKBOOK_ID}/revisions/${revNum}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      isPreviewing = true;
      previewRevisionData = data;

      const previewSheet = data.snapshot.sheets.find(s => s.id === SHEET_ID) || data.snapshot.sheets[0];
      calculator.setCells(previewSheet.cells);
      grid.render();

      els.previewRevNum.textContent = data.revision_number;
      els.previewRevAuthor.textContent = data.user_name || 'Anonymous';
      els.previewRevTime.textContent = HistoryManager.formatRelativeTime(data.created_at);
      els.previewBanner.classList.add('active');

      showToast(`Previewing Revision #${revNum} (Read-only)`, 'info');
    } catch (err) {
      showToast(`Failed to preview revision: ${err.message}`, 'error');
    }
  }

  function exitRevisionPreview() {
    if (!isPreviewing) return;
    isPreviewing = false;
    previewRevisionData = null;
    els.previewBanner.classList.remove('active');

    // Restore active draft cells into calculator
    const currentCells = { ...serverSnapshotCells, ...localDraftCells };
    calculator.setCells(currentCells);
    grid.render();
    updateSaveStatusBadge(isDirty ? 'unsaved' : 'saved', isDirty ? 'Unsaved edits' : `Saved (Rev ${baseRevision})`);
    showToast('Exited revision preview', 'info');
  }

  async function restoreRevision(revNum) {
    try {
      const res = await fetch(`/api/workbooks/${WORKBOOK_ID}/revisions/${revNum}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const oldCells = { ...calculator.rawCells };
      const restoredSheet = data.snapshot.sheets.find(s => s.id === SHEET_ID) || data.snapshot.sheets[0];
      const newCells = { ...restoredSheet.cells };

      if (isPreviewing) {
        exitRevisionPreview();
      }

      // Restoring puts version into an undoable draft and preserves history
      calculator.setCells(newCells);
      localDraftCells = { ...newCells };
      isDirty = true;

      undoRedo.push({
        type: 'restore',
        oldCells,
        newCells
      });

      grid.render();
      updateSaveStatusBadge('unsaved', 'Unsaved draft (Restored)');
      showToast(`Restored Revision #${revNum} to editable draft. Review before saving.`, 'success');
      // Give time to inspect or undo before autosaving (6 seconds debounce)
      if (autosaveTimer) clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => {
        saveWorkbook(`Restored Revision ${revNum}`);
      }, 6000);
    } catch (err) {
      showToast(`Failed to restore revision: ${err.message}`, 'error');
    }
  }

  // --- Cell History Inspector ---
  async function openCellHistory() {
    const activeRef = grid.getActiveRef();
    els.cellHistoryRef.textContent = activeRef;
    openModal(els.cellHistoryModal);
    els.cellHistoryList.innerHTML = '<div style="padding:12px; color:var(--text-muted);">Loading cell history...</div>';

    try {
      const res = await fetch(`/api/workbooks/${WORKBOOK_ID}/sheets/${SHEET_ID}/cells/${activeRef}/history`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const history = await res.json();

      if (history.length === 0) {
        els.cellHistoryList.innerHTML = '<div>No history recorded for this cell yet.</div>';
        return;
      }

      els.cellHistoryList.innerHTML = '';
      history.forEach(item => {
        const el = document.createElement('div');
        el.className = 'history-item';
        el.innerHTML = `
          <div class="history-item-header">
            <strong>${item.user_name || 'Anonymous'}</strong> (Rev #${item.revision_number})
            <span>${HistoryManager.formatRelativeTime(item.created_at)}</span>
          </div>
          <div class="history-diff">
            ${item.old_value !== null ? `<span class="history-diff-old">${escapeHtml(item.old_value || 'empty')}</span> &rarr; ` : ''}
            <span class="history-diff-new">${escapeHtml(item.new_value)}</span>
          </div>
        `;
        els.cellHistoryList.appendChild(el);
      });
    } catch (err) {
      els.cellHistoryList.innerHTML = `<div style="color:var(--danger-color);">Failed to load cell history: ${err.message}</div>`;
    }
  }

  // --- Conflict Modal ---
  function showConflictModal(conflicts, incomingCells, newRev) {
    openModal(els.conflictModal);
    els.conflictDetailsList.innerHTML = conflicts.map(c => `
      <div style="background:#fef2f2; border:1px solid #fca5a5; padding:8px 10px; border-radius:4px; margin-bottom:6px; font-size:12px;">
        <strong>Cell ${c.cell}</strong>:
        <div>Your draft: <code style="color:var(--primary-color); font-weight:bold;">${escapeHtml(c.localVal)}</code></div>
        <div>Remote saved by ${c.author}: <code style="color:var(--danger-color); font-weight:bold;">${escapeHtml(c.incomingVal)}</code></div>
      </div>
    `).join('');

    els.btnConflictAcceptRemote.onclick = () => {
      closeModal(els.conflictModal);
      serverSnapshotCells = { ...incomingCells };
      localDraftCells = {};
      baseRevision = newRev;
      calculator.setCells(serverSnapshotCells);
      isDirty = false;
      grid.render();
      updateSaveStatusBadge('saved', `Saved (Rev ${baseRevision})`);
      showToast('Accepted remote changes', 'info');
    };

    els.btnConflictKeepDraft.onclick = () => {
      closeModal(els.conflictModal);
      baseRevision = newRev; // update base revision to latest so save can proceed
      serverSnapshotCells = { ...incomingCells };
      saveWorkbook('Overwrite Conflict');
    };
  }

  // --- UI Event Handlers ---
  function setupUIEvents() {
    // Save button
    els.btnSaveNow.addEventListener('click', () => saveWorkbook('Manual Save'));

    // Undo / Redo
    els.btnUndo.addEventListener('click', performUndo);
    els.btnRedo.addEventListener('click', performRedo);

    // Global keyboard shortcuts (Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+F, Ctrl+D)
    window.addEventListener('keydown', (e) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl) {
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          saveWorkbook('Manual Save');
        } else if (e.key === 'z' && !e.shiftKey) {
          if (!grid.isEditing) {
            e.preventDefault();
            performUndo();
          }
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey)) {
          if (!grid.isEditing) {
            e.preventDefault();
            performRedo();
          }
        } else if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          openModal(els.findReplaceModal);
          els.findInput.focus();
          els.findInput.select();
        } else if (e.key === 'd' || e.key === 'D') {
          if (!grid.isEditing) {
            e.preventDefault();
            const range = grid.getSelectionRange();
            if (range.maxRow > range.minRow) {
              const src = { ...range, maxRow: range.minRow };
              handleFill(src, 'down', range.maxRow - range.minRow);
            }
          }
        }
      }
    });

    // Fill Down Button
    els.btnFillDown.addEventListener('click', () => {
      const range = grid.getSelectionRange();
      if (range.maxRow > range.minRow) {
        const src = { ...range, maxRow: range.minRow };
        handleFill(src, 'down', range.maxRow - range.minRow);
      } else {
        // Extend selection down 1 and fill
        handleFill(range, 'down', 1);
        grid.setSelection(range.minRow, range.minCol, range.minRow + 1, range.maxCol);
      }
    });

    // Revision History button
    els.btnRevisions.addEventListener('click', openRevisionHistory);
    els.btnCloseRevisions.addEventListener('click', () => closeModal(els.revisionsModal));
    els.btnCloseRevisionsFooter.addEventListener('click', () => closeModal(els.revisionsModal));

    // Cell History button
    els.btnCellHistory.addEventListener('click', openCellHistory);
    els.btnCloseCellHistory.addEventListener('click', () => closeModal(els.cellHistoryModal));
    els.btnCloseCellHistoryFooter.addEventListener('click', () => closeModal(els.cellHistoryModal));

    // Preview Banner Actions
    els.btnExitPreview.addEventListener('click', exitRevisionPreview);
    els.btnConfirmRestore.addEventListener('click', () => {
      if (previewRevisionData) {
        restoreRevision(previewRevisionData.revision_number);
      }
    });

    // Conflict Modal Close
    els.btnCloseConflict.addEventListener('click', () => closeModal(els.conflictModal));

    // User switch
    els.userSelect.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      const opt = e.target.selectedOptions[0];
      const selectedName = opt ? opt.textContent : 'User';
      const selectedColor = opt && opt.dataset.color ? opt.dataset.color : '#2563eb';

      currentUser = { id: selectedId, name: selectedName, color: selectedColor };
      updateUserAvatar();
      if (collabClient) {
        collabClient.switchUser(selectedId, selectedName);
      }
    });
  }

  function updateUserAvatar() {
    els.currentUserAvatar.style.backgroundColor = currentUser.color;
    els.currentUserAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
  }

  // --- Modal Helpers ---
  function openModal(modalEl) {
    if (modalEl) modalEl.classList.add('active');
  }

  function closeModal(modalEl) {
    if (modalEl) modalEl.classList.remove('active');
  }

  // --- Toast Notifications ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    els.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Boot on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', init);
})();

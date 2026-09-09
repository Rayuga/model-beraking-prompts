/* global GridForgeCore */
(() => {
  const core = window.GridForgeCore;
  const appRoot = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const palette = ['#2563eb', '#7c3aed', '#059669', '#ea580c', '#db2777', '#0f766e', '#b45309', '#9333ea'];

  const state = {
    workbookId: 'ops-plan',
    workbookTitle: '',
    users: [],
    session: null,
    bundle: null,
    baseSnapshot: null,
    draftSnapshot: null,
    baseRevisionId: 0,
    history: [],
    historyIndex: 0,
    dirty: false,
    saveStatus: 'idle',
    statusMessage: '',
    selected: { sheetId: null, start: 'A1', end: 'A1' },
    referenceRect: null,
    referenceTextRange: null,
    replaceNextReference: false,
    editing: false,
    formulaDraft: '',
    formulaBarFocused: false,
    previewMode: false,
    previewSnapshot: null,
    previewRevision: null,
    presenceSessions: [],
    revisionList: [],
    cellHistory: [],
    conflictCells: new Map(),
    searchQuery: '',
    replaceQuery: '',
    searchMatches: [],
    searchIndex: 0,
    autosaveTimer: null,
    heartbeatTimer: null,
    selectionTimer: null,
    stream: null,
    initialized: false,
    pendingInit: null,
  };

  const dom = {};

  function clone(value) {
    return core.clone(value);
  }

  function snapshotKey(snapshot) {
    return core.snapshotKey(snapshot);
  }

  function currentSnapshot() {
    if (state.previewMode && state.previewSnapshot) return state.previewSnapshot;
    return state.draftSnapshot;
  }

  function currentSheet() {
    const snapshot = currentSnapshot();
    if (!snapshot) return null;
    return snapshot.sheets.find((sheet) => sheet.id === state.selected.sheetId) || snapshot.sheets[0] || null;
  }

  function selectedRect() {
    return core.rectFromAddresses(state.selected.start, state.selected.end) || core.rectFromAddresses('A1', 'A1');
  }

  function selectedAddress() {
    return state.selected.end || state.selected.start || 'A1';
  }

  function selectedTopLeft() {
    const rect = selectedRect();
    return core.coordsToAddress(rect.startRow, rect.startCol);
  }

  function isEditingFormula() {
    return state.editing && state.formulaBarFocused;
  }

  function cellRaw(snapshot, address) {
    const sheet = snapshot && snapshot.sheets.find((entry) => entry.id === state.selected.sheetId);
    return sheet ? (sheet.cells[address] || '') : '';
  }

  function setStatus(message, kind = '') {
    state.statusMessage = message;
    state.statusKind = kind;
    renderStatusOnly();
  }

  function setDirty(isDirty, status = null) {
    state.dirty = isDirty;
    if (status) state.saveStatus = status;
    renderStatusOnly();
  }

  function normalizeSelection(start, end) {
    const rect = core.rectFromAddresses(start, end) || core.rectFromAddresses('A1', 'A1');
    return {
      sheetId: state.selected.sheetId || (state.bundle?.snapshot.sheets[0].id ?? 'plan'),
      start: core.coordsToAddress(rect.startRow, rect.startCol),
      end: core.coordsToAddress(rect.endRow, rect.endCol),
    };
  }

  function loadSessionInfo() {
    try {
      return JSON.parse(sessionStorage.getItem('gridforge.session') || 'null');
    } catch {
      return null;
    }
  }

  function saveSessionInfo(info) {
    sessionStorage.setItem('gridforge.session', JSON.stringify(info));
  }

  function clearSessionInfo() {
    sessionStorage.removeItem('gridforge.session');
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `Request failed: ${response.status}`);
      error.status = response.status;
      error.details = data.details;
      throw error;
    }
    return data;
  }

  function formatTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
    }).format(date);
  }

  function formatCellAddress(address) {
    return String(address || '').toUpperCase();
  }

  function formatRect(rect) {
    if (!rect) return '—';
    const topLeft = core.coordsToAddress(rect.startRow, rect.startCol);
    const bottomRight = core.coordsToAddress(rect.endRow, rect.endCol);
    return topLeft === bottomRight ? topLeft : `${topLeft}:${bottomRight}`;
  }

  function getCurrentSelectionRect() {
    return core.rectFromAddresses(state.selected.start, state.selected.end) || core.rectFromAddresses('A1', 'A1');
  }

  function updateSelection(start, end = start, options = {}) {
    const rect = normalizeSelection(start, end);
    state.selected = rect;
    if (!options.keepFormula) {
      state.referenceRect = options.referenceRect || null;
      state.referenceTextRange = options.referenceTextRange || null;
      if (!state.editing) {
        state.formulaDraft = cellRaw(currentSnapshot(), selectedTopLeft());
      }
    }
    if (!state.previewMode) {
      queuePresenceUpdate();
    }
    if (!options.silent) {
      render();
      scrollSelectionIntoView();
      fetchSelectedCellHistory();
      syncFormulaBarValue();
    }
  }

  function scrollSelectionIntoView() {
    const cell = dom.grid?.querySelector?.(`[data-address="${selectedTopLeft()}"]`);
    if (cell) cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function syncFormulaBarValue() {
    if (!dom.formulaBar) return;
    if (state.editing) {
      if (dom.formulaBar.value !== state.formulaDraft) dom.formulaBar.value = state.formulaDraft;
      return;
    }
    const snapshot = currentSnapshot();
    const value = snapshot ? cellRaw(snapshot, selectedAddress()) : '';
    state.formulaDraft = value;
    dom.formulaBar.value = value;
  }

  function applySnapshot(nextSnapshot, label, options = {}) {
    const before = clone(state.draftSnapshot);
    const after = clone(nextSnapshot);
    if (snapshotKey(before) === snapshotKey(after)) return;
    if (state.historyIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.historyIndex + 1);
    }
    state.history.push({ snapshot: after, label, timestamp: Date.now() });
    state.historyIndex = state.history.length - 1;
    state.draftSnapshot = after;
    state.selected.sheetId = after.sheets[0]?.id || state.selected.sheetId;
    state.referenceRect = options.referenceRect || null;
    state.referenceTextRange = options.referenceTextRange || null;
    if (options.touched) {
      for (const address of options.touched) state.conflictCells.delete(address);
    } else {
      state.conflictCells.clear();
    }
    state.dirty = snapshotKey(state.baseSnapshot) !== snapshotKey(state.draftSnapshot);
    state.saveStatus = state.dirty ? 'pending' : 'saved';
    state.statusMessage = options.message || (state.dirty ? 'Unsaved edits' : 'Saved');
    scheduleAutosave();
    render();
    syncFormulaBarValue();
    scrollSelectionIntoView();
    fetchSelectedCellHistory();
    queuePresenceUpdate();
  }

  function setDraftSnapshot(nextSnapshot, label, options = {}) {
    applySnapshot(nextSnapshot, label, options);
  }

  function selectedSheetId() {
    return state.selected.sheetId || currentSnapshot()?.sheets[0]?.id || 'plan';
  }

  function cellMapForSnapshot(snapshot, sheetId = selectedSheetId()) {
    const sheet = snapshot?.sheets.find((entry) => entry.id === sheetId);
    return sheet ? sheet.cells : {};
  }

  function updateCellRaw(snapshot, address, raw) {
    const next = clone(snapshot);
    const sheet = next.sheets.find((entry) => entry.id === selectedSheetId());
    if (!sheet) return next;
    core.setCellRaw(next, sheet.id, address, raw);
    return next;
  }

  function editSelectedCell(rawValue, label = 'edit', options = {}) {
    if (state.previewMode) {
      setStatus('Leave preview before editing.', 'warning');
      return;
    }
    const snapshot = clone(state.draftSnapshot);
    const address = selectedAddress();
    core.setCellRaw(snapshot, selectedSheetId(), address, rawValue);
    setDraftSnapshot(snapshot, label, { touched: [address], message: options.message });
  }

  function applyPatchToSelection(patch, label, options = {}) {
    if (state.previewMode) {
      setStatus('Leave preview before editing.', 'warning');
      return;
    }
    const snapshot = clone(state.draftSnapshot);
    const touched = [];
    const sheetId = selectedSheetId();
    for (const [address, raw] of Object.entries(patch)) {
      core.setCellRaw(snapshot, sheetId, address, raw);
      touched.push(address);
    }
    setDraftSnapshot(snapshot, label, { touched, message: options.message });
  }

  function parseClipboardMatrix(text) {
    const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!normalized.trim()) return [['']];
    if (normalized.includes('\t')) {
      return normalized.split('\n').map((line) => line.split('\t'));
    }
    if (normalized.includes(',') && normalized.includes('\n')) {
      return parseDelimited(normalized, ',');
    }
    if (normalized.includes(',')) {
      return parseDelimited(normalized, ',');
    }
    return normalized.split('\n').map((line) => [line]);
  }

  function parseDelimited(text, delimiter) {
    const rows = [];
    let current = '';
    let row = [];
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            quoted = false;
          }
        } else {
          current += ch;
        }
        continue;
      }
      if (ch === '"') {
        quoted = true;
      } else if (ch === delimiter) {
        row.push(current);
        current = '';
      } else if (ch === '\n') {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
    row.push(current);
    rows.push(row);
    return rows;
  }

  function setConflictCells(conflicts) {
    state.conflictCells = new Map();
    for (const conflict of conflicts || []) {
      if (conflict.address && conflict.address !== '*') {
        state.conflictCells.set(conflict.address, conflict);
      }
    }
  }

  function diffAddresses(fromSnapshot, toSnapshot) {
    const fromSheet = fromSnapshot.sheets.find((sheet) => sheet.id === selectedSheetId()) || fromSnapshot.sheets[0];
    const toSheet = toSnapshot.sheets.find((sheet) => sheet.id === selectedSheetId()) || toSnapshot.sheets[0];
    const changed = [];
    if (!fromSheet || !toSheet) return changed;
    const keys = new Set([...Object.keys(fromSheet.cells || {}), ...Object.keys(toSheet.cells || {})]);
    for (const key of keys) {
      const before = fromSheet.cells[key] || '';
      const after = toSheet.cells[key] || '';
      if (before !== after) changed.push(key);
    }
    return changed;
  }

  function normalizeMerge(baseSnapshot, localSnapshot, remoteSnapshot) {
    const merge = core.mergeSnapshots(baseSnapshot, localSnapshot, remoteSnapshot);
    return merge;
  }

  function handleRemoteSnapshot(remoteSnapshot, revision, options = {}) {
    if (!state.baseSnapshot) return;
    const localSnapshot = state.draftSnapshot || remoteSnapshot;
    const merge = normalizeMerge(state.baseSnapshot, localSnapshot, remoteSnapshot);
    state.baseSnapshot = clone(remoteSnapshot);
    state.baseRevisionId = revision?.id || state.baseRevisionId;
    state.draftSnapshot = clone(merge.merged);
    state.history = [{ snapshot: clone(state.draftSnapshot), label: 'merge', timestamp: Date.now() }];
    state.historyIndex = 0;
    state.dirty = snapshotKey(state.baseSnapshot) !== snapshotKey(state.draftSnapshot);
    state.saveStatus = state.dirty ? 'pending' : 'saved';
    state.statusMessage = merge.conflicts.length ? 'Conflict detected with incoming changes' : (options.message || 'Live update applied');
    setConflictCells(merge.conflicts);
    state.revisionList = options.revisionList || state.revisionList;
    state.presenceSessions = options.presenceSessions || state.presenceSessions;
    render();
    syncFormulaBarValue();
    fetchSelectedCellHistory();
    queuePresenceUpdate();
  }

  function scheduleAutosave() {
    clearTimeout(state.autosaveTimer);
    if (!state.session || state.previewMode) return;
    state.autosaveTimer = setTimeout(() => {
      if (state.dirty && !state.previewMode) saveWorkbook('autosave');
    }, 3500);
  }

  function queuePresenceUpdate() {
    clearTimeout(state.selectionTimer);
    if (!state.session || state.previewMode) return;
    state.selectionTimer = setTimeout(() => {
      sendPresenceUpdate().catch((error) => {
        state.statusMessage = error.message;
        renderStatusOnly();
      });
    }, 180);
  }

  async function sendPresenceUpdate() {
    if (!state.session || state.previewMode) return;
    const payload = {
      workbookId: state.workbookId,
      selection: {
        sheetId: selectedSheetId(),
        start: state.selected.start,
        end: state.selected.end,
        mode: state.selected.start === state.selected.end ? 'cell' : 'range',
        current: selectedAddress(),
      },
      sheetId: selectedSheetId(),
    };
    const response = await fetchJson(`/api/sessions/${state.session.id}/presence`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.session = response.session;
  }

  async function sendHeartbeat() {
    if (!state.session || state.previewMode) return;
    const response = await fetchJson(`/api/sessions/${state.session.id}/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ workbookId: state.workbookId }),
    });
    state.session = response.session;
  }

  async function saveWorkbook(kind = 'autosave') {
    if (!state.session || state.previewMode) return;
    if (!state.dirty && kind === 'autosave') return;
    state.saveStatus = 'saving';
    renderStatusOnly();
    try {
      const response = await fetchJson(`/api/workbooks/${state.workbookId}/save`, {
        method: 'POST',
        body: JSON.stringify({
          sessionId: state.session.id,
          baseRevisionId: state.baseRevisionId,
          snapshot: state.draftSnapshot,
          kind,
        }),
      });
      state.baseSnapshot = clone(response.snapshot);
      state.draftSnapshot = clone(response.snapshot);
      state.baseRevisionId = response.revision.id;
      state.history = [{ snapshot: clone(response.snapshot), label: 'saved', timestamp: Date.now() }];
      state.historyIndex = 0;
      state.conflictCells.clear();
      state.dirty = false;
      state.saveStatus = 'saved';
      state.statusMessage = kind === 'autosave' ? 'Autosaved' : 'Saved';
      state.revisionList = [response.revision, ...state.revisionList.filter((item) => item.id !== response.revision.id)].sort((a, b) => b.id - a.id);
      render();
      syncFormulaBarValue();
      fetchSelectedCellHistory();
    } catch (error) {
      if (error.status === 409) {
        state.saveStatus = 'conflict';
        state.statusMessage = 'Save rejected because someone else changed the same cells.';
        if (error.details) setConflictCells(error.details);
      } else {
        state.saveStatus = 'error';
        state.statusMessage = error.message || 'Save failed';
      }
      renderStatusOnly();
      throw error;
    }
  }

  function commitFormulaBar() {
    if (!state.editing || state.previewMode) return;
    const value = dom.formulaBar.value;
    state.editing = false;
    state.formulaBarFocused = false;
    state.formulaDraft = value;
    const next = clone(state.draftSnapshot);
    const address = selectedAddress();
    core.setCellRaw(next, selectedSheetId(), address, value);
    setDraftSnapshot(next, 'edit', { touched: [address], message: value.trim() ? 'Cell updated' : 'Cell cleared' });
  }

  function cancelFormulaBar() {
    state.editing = false;
    state.formulaBarFocused = false;
    syncFormulaBarValue();
    renderStatusOnly();
  }

  function beginEditing(value = '', cursorToEnd = true) {
    if (state.previewMode) {
      setStatus('Leave preview before editing.', 'warning');
      return;
    }
    state.editing = true;
    state.formulaBarFocused = true;
    state.formulaDraft = value;
    if (dom.formulaBar) {
      dom.formulaBar.value = value;
      dom.formulaBar.focus();
      if (cursorToEnd) {
        const len = value.length;
        dom.formulaBar.setSelectionRange(len, len);
      }
    }
    renderStatusOnly();
  }

  function insertTextAtCursor(text, { replaceRange = null } = {}) {
    const input = dom.formulaBar;
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    let nextValue = input.value;
    let nextStart = start;
    let nextEnd = end;
    if (replaceRange) {
      nextValue = nextValue.slice(0, replaceRange.start) + text + nextValue.slice(replaceRange.end);
      nextStart = replaceRange.start + text.length;
      nextEnd = nextStart;
    } else {
      nextValue = nextValue.slice(0, start) + text + nextValue.slice(end);
      nextStart = start + text.length;
      nextEnd = nextStart;
    }
    input.value = nextValue;
    input.focus();
    input.setSelectionRange(nextStart, nextEnd);
    state.formulaDraft = nextValue;
    state.replaceNextReference = true;
    state.referenceTextRange = { start: nextStart - text.length, end: nextStart };
    state.referenceRect = state.selected.start === state.selected.end ? core.rectFromAddresses(state.selected.start, state.selected.end) : getCurrentSelectionRect();
    state.editing = true;
    state.formulaBarFocused = true;
    renderStatusOnly();
  }

  function insertReferenceFromSelection() {
    if (!state.editing || !state.formulaBarFocused) return;
    const rect = getCurrentSelectionRect();
    const refText = formatRect(rect);
    const input = dom.formulaBar;
    if (!input) return;
    const hasRange = Boolean(state.referenceTextRange && state.replaceNextReference);
    const replaceRange = hasRange ? state.referenceTextRange : null;
    insertTextAtCursor(refText, { replaceRange });
    state.referenceRect = rect;
    state.referenceTextRange = { start: input.selectionStart - refText.length, end: input.selectionStart };
    state.replaceNextReference = true;
  }

  function clearSearchState() {
    state.searchMatches = [];
    state.searchIndex = 0;
  }

  function applySearch() {
    const query = String(state.searchQuery || '').trim();
    clearSearchState();
    if (!query) return;
    const snapshot = currentSnapshot();
    const sheet = snapshot.sheets.find((entry) => entry.id === selectedSheetId()) || snapshot.sheets[0];
    if (!sheet) return;
    const q = query.toLowerCase();
    state.searchMatches = Object.keys(sheet.cells)
      .filter((address) => String(sheet.cells[address]).toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (state.searchMatches.length) {
      const match = state.searchMatches[state.searchIndex % state.searchMatches.length];
      updateSelection(match, match);
      scrollSelectionIntoView();
    }
    render();
  }

  function findNext() {
    if (!state.searchMatches.length) return;
    state.searchIndex = (state.searchIndex + 1) % state.searchMatches.length;
    const address = state.searchMatches[state.searchIndex];
    updateSelection(address, address);
  }

  function replaceAll() {
    const search = String(state.searchQuery || '');
    const replace = String(state.replaceQuery || '');
    if (!search) return;
    const snapshot = clone(state.draftSnapshot);
    const sheet = snapshot.sheets.find((entry) => entry.id === selectedSheetId()) || snapshot.sheets[0];
    const touched = [];
    for (const [address, raw] of Object.entries(sheet.cells)) {
      if (String(raw).includes(search)) {
        sheet.cells[address] = String(raw).split(search).join(replace);
        touched.push(address);
      }
    }
    setDraftSnapshot(snapshot, 'replace-all', { touched, message: 'Replaced all matches' });
    applySearch();
  }

  function fillSelection(direction) {
    if (state.previewMode) {
      setStatus('Leave preview before editing.', 'warning');
      return;
    }
    const rect = getCurrentSelectionRect();
    let target = clone(rect);
    if (direction === 'down') {
      target.endRow = Math.min(core.MAX_ROWS - 1, rect.endRow + rectHeight(rect));
    } else if (direction === 'right') {
      target.endCol = Math.min(core.MAX_COLS - 1, rect.endCol + rectWidth(rect));
    } else {
      return;
    }
    const patch = core.generateFillPatch(state.draftSnapshot, selectedSheetId(), rect, target);
    applyPatchToSelection(patch, `fill-${direction}`, { message: `Filled ${direction}` });
  }

  function rectWidth(rect) {
    return core.rectWidth(rect);
  }

  function rectHeight(rect) {
    return core.rectHeight(rect);
  }

  function clearSelectionContents() {
    if (state.previewMode) return;
    const rect = getCurrentSelectionRect();
    const patch = {};
    for (const address of core.rectToAddresses(rect)) patch[address] = '';
    applyPatchToSelection(patch, 'clear', { message: 'Cleared selection' });
  }

  function copySelection(cut = false) {
    const snapshot = currentSnapshot();
    const rect = getCurrentSelectionRect();
    const sheet = snapshot.sheets.find((entry) => entry.id === selectedSheetId()) || snapshot.sheets[0];
    const rows = [];
    for (let row = rect.startRow; row <= rect.endRow; row += 1) {
      const values = [];
      for (let col = rect.startCol; col <= rect.endCol; col += 1) {
        const address = core.coordsToAddress(row, col);
        values.push(sheet.cells[address] || '');
      }
      rows.push(values.join('\t'));
    }
    navigator.clipboard.writeText(rows.join('\n')).catch(() => {});
    if (cut && !state.previewMode) {
      clearSelectionContents();
    }
  }

  async function pasteClipboardText(text) {
    if (state.previewMode) return;
    const matrix = parseClipboardMatrix(text);
    const start = state.selected.start || selectedAddress();
    const startCoords = core.addressToCoords(start);
    if (!startCoords) return;
    const snapshot = clone(state.draftSnapshot);
    const sheet = snapshot.sheets.find((entry) => entry.id === selectedSheetId()) || snapshot.sheets[0];
    const touched = [];
    for (let r = 0; r < matrix.length; r += 1) {
      for (let c = 0; c < matrix[r].length; c += 1) {
        const row = startCoords.row + r;
        const col = startCoords.col + c;
        if (row >= core.MAX_ROWS || col >= core.MAX_COLS) continue;
        const address = core.coordsToAddress(row, col);
        sheet.cells[address] = String(matrix[r][c] ?? '');
        touched.push(address);
      }
    }
    setDraftSnapshot(snapshot, 'paste', { touched, message: 'Pasted cells' });
    updateSelection(start, core.coordsToAddress(Math.min(core.MAX_ROWS - 1, startCoords.row + matrix.length - 1), Math.min(core.MAX_COLS - 1, startCoords.col + (matrix[0]?.length || 1) - 1)));
  }

  function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex -= 1;
    state.draftSnapshot = clone(state.history[state.historyIndex].snapshot);
    state.dirty = snapshotKey(state.baseSnapshot) !== snapshotKey(state.draftSnapshot);
    state.saveStatus = state.dirty ? 'pending' : 'saved';
    state.statusMessage = 'Undid last action';
    state.conflictCells.clear();
    render();
    syncFormulaBarValue();
    fetchSelectedCellHistory();
    scheduleAutosave();
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex += 1;
    state.draftSnapshot = clone(state.history[state.historyIndex].snapshot);
    state.dirty = snapshotKey(state.baseSnapshot) !== snapshotKey(state.draftSnapshot);
    state.saveStatus = state.dirty ? 'pending' : 'saved';
    state.statusMessage = 'Redid action';
    render();
    syncFormulaBarValue();
    fetchSelectedCellHistory();
    scheduleAutosave();
  }

  function openRevisionPreview(revisionId) {
    return fetchJson(`/api/workbooks/${state.workbookId}/revisions/${revisionId}`)
      .then((payload) => {
        state.previewMode = true;
        state.previewSnapshot = payload.snapshot;
        state.previewRevision = payload.revision;
        state.statusMessage = `Previewing revision #${revisionId}`;
        render();
        syncFormulaBarValue();
        fetchSelectedCellHistory();
      });
  }

  function exitPreview() {
    state.previewMode = false;
    state.previewSnapshot = null;
    state.previewRevision = null;
    state.statusMessage = 'Returned to live workbook';
    render();
    syncFormulaBarValue();
    fetchSelectedCellHistory();
  }

  function restorePreviewRevision() {
    if (!state.previewSnapshot) return;
    const next = clone(state.previewSnapshot);
    state.previewMode = false;
    state.previewRevision = null;
    state.previewSnapshot = null;
    setDraftSnapshot(next, 'restore', { message: 'Restored revision draft' });
  }

  function colorForSession(sessionId, index) {
    return palette[index % palette.length] || palette[0];
  }

  function buildPresenceMap() {
    const map = new Map();
    const sessions = state.presenceSessions || [];
    sessions.forEach((session, index) => {
      if (session.id === state.session?.id) return;
      const color = colorForSession(session.id, index);
      const rect = session.selection?.start && session.selection?.end ? core.rectFromAddresses(session.selection.start, session.selection.end) : null;
      if (!rect) return;
      for (const address of core.rectToAddresses(rect)) {
        if (!map.has(address)) map.set(address, []);
        map.get(address).push({ ...session, color });
      }
    });
    return map;
  }

  function buildSearchSet() {
    const set = new Set(state.searchMatches || []);
    return set;
  }

  function renderStatusOnly() {
    const status = document.getElementById('status-strip');
    if (!status) return;
    const pieces = [];
    if (state.previewMode) pieces.push(`<span class="status-pill warning">Previewing revision #${escapeHtml(state.previewRevision?.id || '')}</span>`);
    pieces.push(`<span class="status-pill ${state.dirty ? 'warning' : 'success'}">${state.dirty ? 'Unsaved edits' : 'Saved'}</span>`);
    pieces.push(`<span class="status-pill ${state.saveStatus === 'saving' ? 'warning' : state.saveStatus === 'conflict' ? 'danger' : 'success'}">${escapeHtml(saveStatusLabel())}</span>`);
    pieces.push(`<span>Selected: <strong>${escapeHtml(formatRect(getCurrentSelectionRect()))}</strong></span>`);
    pieces.push(`<span>Saved revision: <strong>#${escapeHtml(String(state.baseRevisionId || '—'))}</strong></span>`);
    pieces.push(`<span>${escapeHtml(state.statusMessage || '')}</span>`);
    status.innerHTML = pieces.join('');
  }

  function saveStatusLabel() {
    switch (state.saveStatus) {
      case 'saving': return 'Saving…';
      case 'conflict': return 'Conflict';
      case 'error': return 'Save error';
      case 'pending': return 'Pending save';
      case 'saved': return 'Saved';
      default: return 'Ready';
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderPresenceList() {
    const container = dom.presenceList;
    if (!container) return;
    const sessions = state.presenceSessions || [];
    if (!sessions.length) {
      container.innerHTML = '<p class="muted">No one else is currently viewing this workbook.</p>';
      return;
    }
    container.innerHTML = sessions.map((session, index) => {
      const color = session.id === state.session?.id ? '#2563eb' : colorForSession(session.id, index);
      const selection = session.selection?.start && session.selection?.end ? formatRect(core.rectFromAddresses(session.selection.start, session.selection.end)) : 'No selection';
      return `
        <div class="presence-item">
          <span class="presence-dot" style="background:${color};"></span>
          <div>
            <div class="presence-title">${escapeHtml(session.userName)}${session.id === state.session?.id ? ' (you)' : ''}</div>
            <div class="presence-meta">${escapeHtml(selection)} · ${escapeHtml(session.sheetId || 'Sheet')}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderRevisionList() {
    const container = dom.revisionList;
    if (!container) return;
    const revisions = state.revisionList || [];
    if (!revisions.length) {
      container.innerHTML = '<p class="muted">No revisions yet.</p>';
      return;
    }
    container.innerHTML = revisions.slice(0, 50).map((revision) => `
      <div class="revision-item ${state.previewRevision?.id === revision.id ? 'active' : ''}">
        <div class="revision-meta">#${revision.id} · ${escapeHtml(revision.kind)} · ${escapeHtml(formatTime(revision.createdAt))}</div>
        <div class="presence-title">${escapeHtml(revision.authorName || 'Unknown')}</div>
        <div class="revision-meta">${escapeHtml(revision.message || 'Workbook snapshot')}</div>
        <div class="revision-actions">
          <button class="small" data-action="preview-revision" data-revision-id="${revision.id}">Preview</button>
        </div>
      </div>
    `).join('');
  }

  function renderCellHistory() {
    const container = dom.cellHistoryList;
    if (!container) return;
    if (!state.cellHistory.length) {
      container.innerHTML = '<p class="muted">Select a cell to inspect its history.</p>';
      return;
    }
    container.innerHTML = state.cellHistory.map((entry) => `
      <div class="history-item">
        <div class="history-row">
          <div class="presence-title">Revision #${entry.revisionId}</div>
          <div class="history-meta">${escapeHtml(formatTime(entry.createdAt))}</div>
        </div>
        <div class="history-meta">${escapeHtml(entry.authorName || 'Unknown')} · ${escapeHtml(entry.kind)}</div>
        <div class="history-values"><strong>${escapeHtml(entry.before || '∅')}</strong> → ${escapeHtml(entry.after || '∅')}</div>
      </div>
    `).join('');
  }

  function cellDisplayClasses(address, value, evaluator, presenceMap, searchSet) {
    const classes = ['cell'];
    if (core.rectContains(getCurrentSelectionRect(), core.addressToCoords(address).row, core.addressToCoords(address).col)) {
      classes.push('selected');
      if (address === state.selected.start) classes.push('selection-start');
    }
    if (state.referenceRect && core.rectContains(state.referenceRect, core.addressToCoords(address).row, core.addressToCoords(address).col)) {
      classes.push('ref-highlight');
    }
    if (state.conflictCells.has(address)) classes.push('conflict');
    if (searchSet.has(address)) classes.push('preview');
    const display = evaluator.displayCell(selectedSheetId(), address);
    if (String(display).startsWith('#')) classes.push('error');
    if (String(display).startsWith('=')) classes.push('formula');
    if (!String(display).startsWith('#') && !String(display).startsWith('=')) {
      const numeric = core.toNumber(display);
      if (numeric != null) classes.push('numeric');
    }
    const remote = presenceMap.get(address);
    if (remote?.length === 1) {
      classes.push('remote-selection');
    } else if (remote?.length > 1) {
      classes.push('multi-remote');
    }
    if (state.previewMode) classes.push('preview');
    return classes;
  }

  function renderGrid() {
    const snapshot = currentSnapshot();
    if (!snapshot) return;
    const sheet = snapshot.sheets.find((entry) => entry.id === selectedSheetId()) || snapshot.sheets[0];
    if (!sheet) return;
    const evaluator = core.createFormulaEvaluator(snapshot);
    const presenceMap = buildPresenceMap();
    const searchSet = buildSearchSet();
    const cells = [];
    cells.push('<div class="corner"></div>');
    for (let col = 0; col < core.MAX_COLS; col += 1) {
      cells.push(`<div class="col-head">${core.colToLabel(col)}</div>`);
    }
    for (let row = 0; row < core.MAX_ROWS; row += 1) {
      cells.push(`<div class="row-head">${row + 1}</div>`);
      for (let col = 0; col < core.MAX_COLS; col += 1) {
        const address = core.coordsToAddress(row, col);
        const raw = sheet.cells[address] || '';
        const display = evaluator.displayCell(sheet.id, address);
        const classes = cellDisplayClasses(address, display, evaluator, presenceMap, searchSet);
        const remote = presenceMap.get(address) || [];
        const styleParts = [];
        if (remote.length === 1) {
          styleParts.push(`--remote-color:${remote[0].color}`);
        } else if (remote.length > 1) {
          styleParts.push(`--remote-color-a:${remote[0].color}`);
          styleParts.push(`--remote-color-b:${remote[1].color}`);
        }
        const text = display == null ? '' : String(display);
        cells.push(`
          <div class="${classes.join(' ')}" data-address="${address}" data-raw="${escapeHtml(raw)}" style="${styleParts.join(';')}">
            <span class="value">${escapeHtml(text)}</span>
          </div>
        `);
      }
    }
    dom.grid.innerHTML = cells.join('');
    renderCellBorders(presenceMap);
  }

  function renderCellBorders(presenceMap = buildPresenceMap()) {
    if (!dom.grid) return;
    const selected = getCurrentSelectionRect();
    for (const el of dom.grid.querySelectorAll('.cell')) {
      const address = el.dataset.address;
      if (!address) continue;
      const coords = core.addressToCoords(address);
      const isSelected = core.rectContains(selected, coords.row, coords.col);
      el.classList.toggle('selected', isSelected);
      el.classList.toggle('selection-start', address === state.selected.start);
      el.classList.toggle('ref-highlight', !!(state.referenceRect && core.rectContains(state.referenceRect, coords.row, coords.col)));
      el.classList.toggle('conflict', state.conflictCells.has(address));
      el.classList.toggle('preview', state.previewMode);
      const remote = presenceMap.get(address) || [];
      el.classList.toggle('remote-selection', remote.length === 1);
      el.classList.toggle('multi-remote', remote.length > 1);
      if (remote.length === 1) el.style.setProperty('--remote-color', remote[0].color);
      if (remote.length > 1) {
        el.style.setProperty('--remote-color-a', remote[0].color);
        el.style.setProperty('--remote-color-b', remote[1].color);
      }
      if (isSelected && remote.length === 0) {
        el.style.boxShadow = 'inset 0 0 0 2px #2563eb';
      } else if (isSelected && remote.length === 1) {
        el.style.boxShadow = `inset 0 0 0 2px #2563eb, inset 0 0 0 4px ${remote[0].color}`;
      } else if (isSelected && remote.length > 1) {
        el.style.boxShadow = `inset 0 0 0 2px #2563eb, inset 0 0 0 4px ${remote[0].color}, inset 0 0 0 6px ${remote[1].color}`;
      } else if (!isSelected && remote.length === 1) {
        el.style.boxShadow = `inset 0 0 0 2px ${remote[0].color}`;
      } else if (!isSelected && remote.length > 1) {
        el.style.boxShadow = `inset 0 0 0 2px ${remote[0].color}, inset 0 0 0 4px ${remote[1].color}`;
      } else {
        el.style.boxShadow = '';
      }
    }
  }

  function renderToolbar() {
    if (!dom.userSelect) return;
    dom.workbookTitle.textContent = state.workbookTitle || 'GridForge';
    dom.revisionLabel.textContent = state.baseRevisionId ? `Revision #${state.baseRevisionId}` : 'No revision';
    dom.formulaBar.value = state.editing ? state.formulaDraft : (currentSnapshot() ? cellRaw(currentSnapshot(), selectedAddress()) : '');
    dom.nameBox.value = formatRect(getCurrentSelectionRect());
    dom.userSelect.innerHTML = state.users.map((user) => `<option value="${escapeHtml(user.id)}" ${state.session?.userId === user.id ? 'selected' : ''}>${escapeHtml(user.name)}</option>`).join('');
    dom.userSelect.disabled = !state.session;
    dom.saveButton.disabled = !state.session || state.previewMode || !state.dirty;
    dom.undoButton.disabled = state.historyIndex <= 0;
    dom.redoButton.disabled = state.historyIndex >= state.history.length - 1;
    dom.fillDownButton.disabled = state.previewMode;
    dom.fillRightButton.disabled = state.previewMode;
    dom.previewButton.disabled = state.revisionList.length < 2 && !state.previewRevision;
    dom.restoreButton.disabled = !state.previewMode;
    dom.exitPreviewButton.disabled = !state.previewMode;
    dom.currentUserLabel.textContent = state.session ? `${state.session.userName} · ${state.session.id.slice(0, 8)}` : 'No session';
    dom.revisionLabel.title = state.previewMode ? `Previewing ${state.previewRevision?.createdAt || ''}` : 'Latest saved revision';
    dom.searchInput.value = state.searchQuery;
    dom.replaceInput.value = state.replaceQuery;
    dom.searchCount.textContent = state.searchMatches.length ? `${state.searchMatches.length} match${state.searchMatches.length === 1 ? '' : 'es'}` : 'No matches';
    renderStatusOnly();
    renderFunctionSuggestions();
  }

  function renderFunctionSuggestions() {
    const container = dom.functionSuggestions;
    if (!container) return;
    const value = state.formulaDraft || '';
    const show = state.editing && value.startsWith('=');
    if (!show) {
      container.innerHTML = '';
      container.classList.add('hidden');
      return;
    }
    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="hint">Click cells to insert references. Choose a function or keep typing.</div>
      ${core.FUNCTION_NAMES.map((name) => `<button type="button" data-fn="${name}">${name}</button>`).join('')}
    `;
  }

  function renderShell() {
    appRoot.innerHTML = `
      <div class="shell">
        <div class="topbar">
          <div class="title-block">
            <div class="app-title" id="workbook-title"></div>
            <div class="app-subtitle" id="revision-label"></div>
          </div>
          <div style="margin-left:auto" class="group">
            <label class="inline-help">User</label>
            <select id="user-select"></select>
            <button id="change-user" class="small">Switch session</button>
            <span id="current-user-label" class="inline-help"></span>
          </div>
        </div>
        <div class="toolbar">
          <div class="group">
            <label class="inline-help">Name box</label>
            <input id="name-box" class="name-box" aria-label="Name box" placeholder="A1 or A1:C3" />
            <button id="jump-box" class="small">Go</button>
          </div>
          <div class="formula-bar-wrap">
            <input id="formula-bar" class="formula-bar" aria-label="Formula bar" placeholder="Type a value or formula starting with =" />
            <div id="function-suggestions" class="function-suggestions hidden"></div>
          </div>
          <div class="group">
            <button id="save-button" class="primary">Save</button>
            <button id="undo-button">Undo</button>
            <button id="redo-button">Redo</button>
            <button id="fill-down-button">Fill ↓</button>
            <button id="fill-right-button">Fill →</button>
          </div>
          <div class="group">
            <button id="preview-button">Preview selected revision</button>
            <button id="restore-button" class="primary">Restore preview</button>
            <button id="exit-preview-button">Back to live</button>
          </div>
          <div class="group">
            <button id="copy-button">Copy</button>
            <button id="cut-button">Cut</button>
            <button id="paste-button">Paste</button>
            <button id="clear-button" class="danger">Clear</button>
          </div>
        </div>
        <div id="status-strip" class="status-strip"></div>
        <div id="preview-banner" class="preview-banner hidden"></div>
        <div id="conflict-banner" class="conflict-banner hidden"></div>
        <div class="workspace">
          <section class="sheet-panel">
            <div class="sheet-header">
              <div><strong>Plan</strong> <span class="inline-help">Northwind Operations Plan</span></div>
              <div class="legend" id="legend"></div>
            </div>
            <div class="grid-scroll" id="grid-scroll">
              <div class="grid" id="grid" role="grid" aria-label="Spreadsheet grid"></div>
            </div>
          </section>
          <aside class="side-panel">
            <section class="side-section">
              <h2>Here now</h2>
              <div id="presence-list" class="presence-list"></div>
            </section>
            <section class="side-section">
              <h2>Revisions</h2>
              <div id="revision-list" class="revision-list"></div>
            </section>
            <section class="side-section">
              <h2>Cell history</h2>
              <div id="history-meta" class="muted"></div>
              <div id="cell-history-list" class="history-list"></div>
              <hr />
              <h2>Find and replace</h2>
              <div class="group" style="margin-bottom:0.5rem;">
                <input id="search-input" placeholder="Find" />
                <button id="find-next-button" class="small">Next</button>
              </div>
              <div class="group" style="margin-bottom:0.5rem;">
                <input id="replace-input" placeholder="Replace with" />
                <button id="replace-all-button" class="small primary">Replace all</button>
              </div>
              <div id="search-count" class="inline-help"></div>
            </section>
          </aside>
        </div>
      </div>
    `;
    dom.workbookTitle = document.getElementById('workbook-title');
    dom.revisionLabel = document.getElementById('revision-label');
    dom.userSelect = document.getElementById('user-select');
    dom.changeUser = document.getElementById('change-user');
    dom.currentUserLabel = document.getElementById('current-user-label');
    dom.nameBox = document.getElementById('name-box');
    dom.jumpBox = document.getElementById('jump-box');
    dom.formulaBar = document.getElementById('formula-bar');
    dom.functionSuggestions = document.getElementById('function-suggestions');
    dom.saveButton = document.getElementById('save-button');
    dom.undoButton = document.getElementById('undo-button');
    dom.redoButton = document.getElementById('redo-button');
    dom.fillDownButton = document.getElementById('fill-down-button');
    dom.fillRightButton = document.getElementById('fill-right-button');
    dom.previewButton = document.getElementById('preview-button');
    dom.restoreButton = document.getElementById('restore-button');
    dom.exitPreviewButton = document.getElementById('exit-preview-button');
    dom.copyButton = document.getElementById('copy-button');
    dom.cutButton = document.getElementById('cut-button');
    dom.pasteButton = document.getElementById('paste-button');
    dom.clearButton = document.getElementById('clear-button');
    dom.grid = document.getElementById('grid');
    dom.gridScroll = document.getElementById('grid-scroll');
    dom.presenceList = document.getElementById('presence-list');
    dom.revisionList = document.getElementById('revision-list');
    dom.cellHistoryList = document.getElementById('cell-history-list');
    dom.historyMeta = document.getElementById('history-meta');
    dom.searchInput = document.getElementById('search-input');
    dom.replaceInput = document.getElementById('replace-input');
    dom.findNextButton = document.getElementById('find-next-button');
    dom.replaceAllButton = document.getElementById('replace-all-button');
    dom.searchCount = document.getElementById('search-count');
    dom.previewBanner = document.getElementById('preview-banner');
    dom.conflictBanner = document.getElementById('conflict-banner');
    render();
  }

  function renderLegend() {
    const legend = document.getElementById('legend');
    if (!legend) return;
    const sessions = (state.presenceSessions || []).filter((session) => session.id !== state.session?.id);
    if (!sessions.length) {
      legend.innerHTML = '<span class="inline-help">Only you are here right now.</span>';
      return;
    }
    legend.innerHTML = sessions.slice(0, 4).map((session, index) => `
      <span class="legend-item" title="${escapeHtml(session.userName)}">
        <span class="legend-swatch" style="color:${colorForSession(session.id, index)}"></span>
        ${escapeHtml(session.userName)}
      </span>
    `).join('');
  }

  function renderModals() {
    if (state.session) {
      modalRoot.innerHTML = '';
      return;
    }
    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">
          <header>
            <h1>Open Northwind Operations Plan</h1>
            <p>Choose who you are for this browser view. Each tab gets its own session.</p>
          </header>
          <div class="body">
            <div class="user-card-grid">
              ${state.users.map((user) => `
                <div class="user-card">
                  <div class="name">${escapeHtml(user.name)}</div>
                  <div class="id">${escapeHtml(user.id)}</div>
                  <button data-user-id="${user.id}" class="primary">Start as this user</button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
    modalRoot.querySelectorAll('[data-user-id]').forEach((button) => {
      button.addEventListener('click', () => startSession(button.dataset.userId));
    });
  }

  function renderPreviewBanner() {
    if (!dom.previewBanner || !dom.conflictBanner) return;
    if (state.previewMode && state.previewRevision) {
      dom.previewBanner.classList.remove('hidden');
      dom.previewBanner.textContent = `Previewing revision #${state.previewRevision.id} from ${formatTime(state.previewRevision.createdAt)}.`;
    } else {
      dom.previewBanner.classList.add('hidden');
      dom.previewBanner.textContent = '';
    }
    const conflicts = [...state.conflictCells.values()];
    if (conflicts.length) {
      dom.conflictBanner.classList.remove('hidden');
      dom.conflictBanner.innerHTML = `<strong>Conflict:</strong> ${conflicts.length} overlapping cell${conflicts.length === 1 ? '' : 's'} changed in another view. The conflicting cells are outlined in red.`;
    } else {
      dom.conflictBanner.classList.add('hidden');
      dom.conflictBanner.innerHTML = '';
    }
  }

  function render() {
    if (!dom.grid) {
      renderShell();
      attachHandlers();
    }
    renderToolbar();
    renderLegend();
    renderPresenceList();
    renderRevisionList();
    renderCellHistory();
    renderGrid();
    renderPreviewBanner();
    renderModals();
    renderStatusOnly();
    updateHistoryMeta();
  }

  function updateHistoryMeta() {
    if (!dom.historyMeta) return;
    const address = selectedAddress();
    dom.historyMeta.textContent = `${formatCellAddress(address)} · ${state.previewMode ? 'previewing' : 'live'} · ${state.dirty ? 'unsaved' : 'saved'}`;
  }

  async function fetchSelectedCellHistory() {
    if (!state.bundle) return;
    try {
      const address = selectedAddress();
      const sheetId = selectedSheetId();
      const payload = await fetchJson(`/api/workbooks/${state.workbookId}/cells/${address}/history?sheetId=${encodeURIComponent(sheetId)}`);
      state.cellHistory = payload.history || [];
      renderCellHistory();
      updateHistoryMeta();
    } catch {
      state.cellHistory = [];
      renderCellHistory();
    }
  }

  function setBundle(bundle) {
    state.bundle = bundle;
    state.workbookId = bundle.workbook.id;
    state.workbookTitle = bundle.workbook.title;
    state.users = bundle.users || state.users;
    state.baseSnapshot = clone(bundle.snapshot);
    state.draftSnapshot = clone(bundle.snapshot);
    state.baseRevisionId = bundle.currentRevision.id;
    state.history = [{ snapshot: clone(bundle.snapshot), label: 'initial', timestamp: Date.now() }];
    state.historyIndex = 0;
    state.dirty = false;
    state.saveStatus = 'saved';
    state.selected.sheetId = bundle.snapshot.sheets[0].id;
    state.selected.start = 'A1';
    state.selected.end = 'A1';
    state.presenceSessions = bundle.sessions || [];
    state.revisionList = bundle.revisions || [];
    state.conflictCells.clear();
    state.previewMode = false;
    state.previewSnapshot = null;
    state.previewRevision = null;
    state.statusMessage = 'Workbook loaded';
    syncFormulaBarValue();
    render();
    fetchSelectedCellHistory();
    queuePresenceUpdate();
  }

  async function loadBundleForSession(sessionId) {
    const bundle = await fetchJson(`/api/workbooks/${state.workbookId}/state?sessionId=${encodeURIComponent(sessionId)}`);
    state.session = loadSessionInfo() || state.session;
    setBundle(bundle);
    connectStream(sessionId);
    scheduleHeartbeat();
  }

  function scheduleHeartbeat() {
    clearInterval(state.heartbeatTimer);
    if (!state.session) return;
    state.heartbeatTimer = setInterval(() => {
      sendHeartbeat().catch(() => {});
    }, 10000);
  }

  function connectStream(sessionId) {
    if (state.stream) state.stream.close();
    state.stream = new EventSource(`/api/stream?sessionId=${encodeURIComponent(sessionId)}`);
    state.stream.addEventListener('state', (event) => {
      const bundle = JSON.parse(event.data);
      if (!state.baseSnapshot) {
        setBundle(bundle);
        return;
      }
      state.presenceSessions = bundle.sessions || state.presenceSessions;
      state.revisionList = bundle.revisions || state.revisionList;
      handleRemoteSnapshot(bundle.snapshot, bundle.currentRevision, {
        presenceSessions: bundle.sessions || [],
        revisionList: bundle.revisions || [],
      });
    });
    state.stream.addEventListener('presence', (event) => {
      const payload = JSON.parse(event.data);
      state.presenceSessions = payload.sessions || [];
      render();
    });
    state.stream.addEventListener('revision', (event) => {
      const payload = JSON.parse(event.data);
      if (payload?.revision) {
        state.revisionList = [payload.revision, ...state.revisionList.filter((item) => item.id !== payload.revision.id)].sort((a, b) => b.id - a.id);
      }
      if (payload?.snapshot) {
        handleRemoteSnapshot(payload.snapshot, payload.revision, { revisionList: state.revisionList });
      }
    });
    state.stream.onerror = () => {
      state.statusMessage = 'Connection lost; reconnecting automatically.';
      renderStatusOnly();
    };
  }

  async function startSession(userId) {
    const payload = await fetchJson('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ workbookId: state.workbookId, userId }),
    });
    state.session = payload.session;
    saveSessionInfo({ sessionId: payload.session.id, workbookId: state.workbookId, userId });
    setBundle(payload.bundle);
    connectStream(payload.session.id);
    scheduleHeartbeat();
    queuePresenceUpdate();
  }

  async function restoreUserSession() {
    const saved = loadSessionInfo();
    if (!saved || !saved.sessionId || saved.workbookId !== state.workbookId) return false;
    try {
      const session = saved;
      const bundle = await fetchJson(`/api/workbooks/${state.workbookId}/state?sessionId=${encodeURIComponent(session.sessionId)}`);
      state.session = { id: session.sessionId, workbookId: state.workbookId, userId: session.userId, userName: '' };
      const sessionDetails = (bundle.sessions || []).find((item) => item.id === session.sessionId);
      if (sessionDetails) state.session.userName = sessionDetails.userName;
      setBundle(bundle);
      connectStream(session.sessionId);
      scheduleHeartbeat();
      return true;
    } catch {
      clearSessionInfo();
      return false;
    }
  }

  function openUserSwitcher() {
    renderModals();
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <header>
          <h1>Start a new session</h1>
          <p>Each browser view is tracked separately. Switching creates a new session for the selected user.</p>
        </header>
        <div class="body">
          <div class="user-card-grid">
            ${state.users.map((user) => `
              <div class="user-card">
                <div class="name">${escapeHtml(user.name)}</div>
                <div class="id">${escapeHtml(user.id)}</div>
                <button data-user-id="${user.id}" class="primary">Use this user</button>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:0.85rem;" class="inline-help">Your current session will be closed after the new one is ready.</div>
        </div>
      </div>
    `;
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) backdrop.remove();
    });
    backdrop.querySelectorAll('[data-user-id]').forEach((button) => {
      button.addEventListener('click', async () => {
        const oldSession = state.session?.id;
        await startSession(button.dataset.userId);
        if (oldSession) {
          fetch(`/api/sessions/${encodeURIComponent(oldSession)}/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workbookId: state.workbookId }),
          }).catch(() => {});
        }
        backdrop.remove();
      });
    });
    modalRoot.innerHTML = '';
    modalRoot.appendChild(backdrop);
  }

  function attachHandlers() {
    dom.userSelect.addEventListener('change', () => {
      if (!state.session) return;
      saveSessionInfo({ sessionId: state.session.id, workbookId: state.workbookId, userId: dom.userSelect.value });
    });
    dom.changeUser.addEventListener('click', openUserSwitcher);
    dom.saveButton.addEventListener('click', () => commitFormulaBar(), { once: false });
    dom.saveButton.addEventListener('click', () => saveWorkbook('manual').catch(() => {}));
    dom.undoButton.addEventListener('click', undo);
    dom.redoButton.addEventListener('click', redo);
    dom.fillDownButton.addEventListener('click', () => fillSelection('down'));
    dom.fillRightButton.addEventListener('click', () => fillSelection('right'));
    dom.previewButton.addEventListener('click', () => {
      if (state.previewRevision) openRevisionPreview(state.previewRevision.id).catch((error) => setStatus(error.message, 'danger'));
      else if (state.revisionList[1]) openRevisionPreview(state.revisionList[1].id).catch((error) => setStatus(error.message, 'danger'));
    });
    dom.restoreButton.addEventListener('click', restorePreviewRevision);
    dom.exitPreviewButton.addEventListener('click', exitPreview);
    dom.jumpBox.addEventListener('click', () => {
      const value = String(dom.nameBox.value || '').trim().toUpperCase();
      if (!value) return;
      if (value.includes(':')) {
        const rect = core.rangeToRect(value);
        if (rect) updateSelection(core.coordsToAddress(rect.startRow, rect.startCol), core.coordsToAddress(rect.endRow, rect.endCol));
      } else {
        const coords = core.addressToCoords(value);
        if (coords) updateSelection(value, value);
      }
      dom.gridScroll.focus();
    });
    dom.nameBox.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') dom.jumpBox.click();
    });
    dom.formulaBar.addEventListener('focus', () => {
      state.formulaBarFocused = true;
      state.editing = true;
      state.formulaDraft = dom.formulaBar.value;
      renderStatusOnly();
    });
    dom.formulaBar.addEventListener('input', () => {
      state.formulaDraft = dom.formulaBar.value;
      state.editing = true;
      state.formulaBarFocused = true;
      state.replaceNextReference = /[+\-*/,(]/.test(state.formulaDraft);
      renderStatusOnly();
      renderFunctionSuggestions();
    });
    dom.formulaBar.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitFormulaBar();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelFormulaBar();
      } else if (event.key === 'Tab' && state.editing) {
        event.preventDefault();
        commitFormulaBar();
        moveSelectionBy(0, event.shiftKey ? -1 : 1);
      } else if (event.key === 'ArrowDown' && state.editing && event.altKey) {
        event.preventDefault();
        fillSelection('down');
      } else if (event.key === 'ArrowRight' && state.editing && event.altKey) {
        event.preventDefault();
        fillSelection('right');
      } else if (event.key === ',' || /[+\-*/()]/.test(event.key)) {
        state.replaceNextReference = false;
      }
    });
    dom.formulaBar.addEventListener('blur', () => {
      if (state.editing) commitFormulaBar();
    });
    dom.functionSuggestions.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-fn]');
      if (!button) return;
      const fn = button.dataset.fn;
      insertTextAtCursor(`${fn}(`);
      dom.formulaBar.focus();
    });
    dom.copyButton.addEventListener('click', () => copySelection(false));
    dom.cutButton.addEventListener('click', () => copySelection(true));
    dom.pasteButton.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        await pasteClipboardText(text);
      } catch (error) {
        setStatus('Paste unavailable in this browser.', 'warning');
      }
    });
    dom.clearButton.addEventListener('click', clearSelectionContents);
    dom.searchInput.addEventListener('input', () => {
      state.searchQuery = dom.searchInput.value;
      applySearch();
      renderStatusOnly();
    });
    dom.replaceInput.addEventListener('input', () => {
      state.replaceQuery = dom.replaceInput.value;
    });
    dom.findNextButton.addEventListener('click', findNext);
    dom.replaceAllButton.addEventListener('click', replaceAll);
    dom.grid.addEventListener('mousedown', (event) => {
      const target = event.target.closest('.cell');
      if (!target) return;
      const address = target.dataset.address;
      if (!address) return;
      if (isEditingFormula()) {
        event.preventDefault();
        startSelectionDrag(address, true);
      } else {
        startSelectionDrag(address, false);
      }
    });
    window.addEventListener('mousemove', (event) => {
      if (!state.dragging) return;
      updateDragSelection(event);
    });
    window.addEventListener('mouseup', () => {
      if (!state.dragging) return;
      endSelectionDrag();
    });
    window.addEventListener('keydown', handleGlobalKeydown, true);
    window.addEventListener('beforeunload', () => {
      if (state.session) {
        navigator.sendBeacon(`/api/sessions/${encodeURIComponent(state.session.id)}/close`, new Blob([JSON.stringify({ workbookId: state.workbookId })], { type: 'application/json' }));
      }
    });
    dom.grid.addEventListener('dblclick', (event) => {
      const target = event.target.closest('.cell');
      if (!target) return;
      const address = target.dataset.address;
      if (!address) return;
      updateSelection(address, address);
      beginEditing(cellRaw(currentSnapshot(), address));
    });
    dom.grid.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        beginEditing(cellRaw(currentSnapshot(), selectedAddress()));
      }
    });
    dom.revisionList.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action="preview-revision"]');
      if (!button) return;
      const id = Number(button.dataset.revisionId);
      if (Number.isInteger(id)) {
        await openRevisionPreview(id).catch((error) => setStatus(error.message, 'danger'));
      }
    });
  }

  function startSelectionDrag(address, fromFormula) {
    const rect = core.rectFromAddresses(address, address);
    state.dragging = {
      start: address,
      end: address,
      fromFormula,
    };
    updateSelection(address, address, { silent: false, keepFormula: fromFormula, referenceRect: fromFormula ? rect : null });
  }

  function updateDragSelection(event) {
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
    if (!cell || !state.dragging) return;
    const address = cell.dataset.address;
    if (!address) return;
    state.dragging.end = address;
    updateSelection(state.dragging.start, address, { silent: false, keepFormula: state.dragging.fromFormula, referenceRect: state.dragging.fromFormula ? core.rectFromAddresses(state.dragging.start, address) : null });
  }

  function endSelectionDrag() {
    if (!state.dragging) return;
    const drag = state.dragging;
    state.dragging = null;
    if (drag.fromFormula && state.formulaBarFocused) {
      insertReferenceFromSelection();
    }
    if (state.editing && state.formulaBarFocused && !drag.fromFormula) {
      // no-op
    }
  }

  function moveSelectionBy(rowDelta, colDelta) {
    const rect = getCurrentSelectionRect();
    const row = Math.max(0, Math.min(core.MAX_ROWS - 1, rect.endRow + rowDelta));
    const col = Math.max(0, Math.min(core.MAX_COLS - 1, rect.endCol + colDelta));
    updateSelection(core.coordsToAddress(row, col), core.coordsToAddress(row, col));
  }

  function handleGlobalKeydown(event) {
    if (!state.session) return;
    if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) && event.target !== dom.formulaBar) return;
    if (state.previewMode && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Delete', 'Backspace'].includes(event.key)) {
      if (!event.ctrlKey && !event.metaKey) return;
    }
    if (event.metaKey || event.ctrlKey) {
      switch (event.key.toLowerCase()) {
        case 'c': event.preventDefault(); copySelection(false); return;
        case 'x': event.preventDefault(); copySelection(true); return;
        case 'v': event.preventDefault(); navigator.clipboard.readText().then((text) => pasteClipboardText(text)).catch(() => setStatus('Paste unavailable.', 'warning')); return;
        case 'z': event.preventDefault(); if (event.shiftKey) redo(); else undo(); return;
        case 'y': event.preventDefault(); redo(); return;
        case 's': event.preventDefault(); commitFormulaBar(); saveWorkbook('manual').catch(() => {}); return;
        case 'd': event.preventDefault(); fillSelection('down'); return;
        case 'r': event.preventDefault(); fillSelection('right'); return;
        default: break;
      }
    }
    if (!state.editing) {
      if (event.key === 'F2' || event.key === 'Enter') {
        event.preventDefault();
        beginEditing(cellRaw(currentSnapshot(), selectedAddress()));
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        clearSelectionContents();
        return;
      }
      if (event.key === 'ArrowLeft') { event.preventDefault(); moveSelectionBy(0, -1); return; }
      if (event.key === 'ArrowRight') { event.preventDefault(); moveSelectionBy(0, 1); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); moveSelectionBy(-1, 0); return; }
      if (event.key === 'ArrowDown') { event.preventDefault(); moveSelectionBy(1, 0); return; }
      if (event.key === 'Tab') { event.preventDefault(); moveSelectionBy(0, event.shiftKey ? -1 : 1); return; }
      if (event.key.length === 1 && !event.altKey) {
        event.preventDefault();
        beginEditing(event.key, true);
        return;
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelFormulaBar();
    }
  }

  async function bootstrap() {
    const bootstrapData = await fetchJson('/api/bootstrap');
    state.workbookId = bootstrapData.workbook.id;
    state.workbookTitle = bootstrapData.workbook.title;
    state.users = bootstrapData.users || [];
    render();
    const restored = await restoreUserSession();
    if (!restored) {
      state.session = null;
      render();
    }
  }

  boot();

  async function boot() {
    try {
      const bootstrapData = await fetchJson('/api/bootstrap');
      state.workbookId = bootstrapData.workbook.id;
      state.workbookTitle = bootstrapData.workbook.title;
      state.users = bootstrapData.users || [];
      render();
      const restored = await restoreUserSession();
      if (!restored) {
        state.session = null;
        render();
      }
    } catch (error) {
      appRoot.innerHTML = `<div style="padding:2rem;">Failed to load GridForge: ${escapeHtml(error.message)}</div>`;
    }
  }
})();

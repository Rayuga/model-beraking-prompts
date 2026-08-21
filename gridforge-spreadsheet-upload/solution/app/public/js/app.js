const ROWS = 90;
const COLS = 20;

const grid = document.getElementById('grid');
const formulaBar = document.getElementById('formula-bar');
const message = document.getElementById('message');
const FUNCTIONS = ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'];
const tabSessionId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

const state = {
  workbookId: null,
  baseRevision: 0,
  workbook: null,
  cells: {},
  cellMeta: {},
  users: [],
  currentUserId: localStorage.getItem('gridforge-user') || 'riley',
  values: {},
  errors: {},
  selected: { row: 1, col: 1 },
  range: null,
  findMatches: [],
  findIndex: -1,
  dirty: false,
  undo: [],
  redo: [],
  editing: false,
  editCell: null,
  editBuffer: '',
  draggingRange: false,
  dragStart: null,
  formulaRefDrag: null,
  autosaveTimer: null,
  saving: false,
  saveError: '',
  eventSource: null,
  presence: [],
  presenceSessions: [],
  presenceConnected: false,
  pendingRemoteEvent: null,
  presencePublishTimer: null,
  lastPublishedSelection: ''
};

const $ = (id) => document.getElementById(id);

init();

async function init() {
  bindEvents();
  await loadUsers();
  const { workbooks } = await api('/api/workbooks');
  await loadWorkbook(workbooks[0].id);
}

async function loadUsers() {
  const { users } = await api('/api/users');
  state.users = users;
  if (!users.some((user) => user.id === state.currentUserId)) state.currentUserId = users[0]?.id || 'riley';
  $('user-select').innerHTML = users.map((user) => `
    <option value="${escapeHtml(user.id)}">${escapeHtml(user.name)}</option>
  `).join('');
  $('user-select').value = state.currentUserId;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || response.statusText), { data, response });
  return data;
}

async function loadWorkbook(id) {
  const data = await api(`/api/workbooks/${encodeURIComponent(id)}`);
  state.workbookId = id;
  state.baseRevision = data.revision;
  state.workbook = structuredClone(data.workbook);
  state.cells = { ...(state.workbook.sheets[0].cells || {}) };
  state.cellMeta = { ...(data.cellMeta || {}) };
  state.dirty = false;
  state.undo = [];
  state.redo = [];
  recalc();
  renderAll();
  await loadHistory();
  await loadSelectedCellHistory();
  connectLive();
}

function bindEvents() {
  $('user-select').addEventListener('change', () => {
    state.currentUserId = $('user-select').value;
    localStorage.setItem('gridforge-user', state.currentUserId);
    renderStatus();
    connectLive();
  });
  $('save-btn').addEventListener('click', () => saveWorkbook({ auto: false }));
  $('undo-btn').addEventListener('click', undo);
  $('redo-btn').addEventListener('click', redo);
  $('apply-formula').addEventListener('click', () => setSelectedValue(formulaBar.value));
  formulaBar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      if (state.editing) {
        commitEdit();
      } else {
        setSelectedValue(formulaBar.value);
      }
      grid.focus();
    }
    if (event.key === 'Escape') {
      commitEdit();
      updateFormulaBar();
      grid.focus();
    }
  });
  formulaBar.addEventListener('input', () => {
    if (!state.editing || state.editCell !== selectedAddr()) return;
    state.editBuffer = formulaBar.value;
    applyEditBuffer({ keepFormulaFocus: true });
  });
  $('formula-suggestions').addEventListener('mousedown', (event) => {
    const button = event.target.closest('[data-function]');
    if (!button) return;
    event.preventDefault();
    completeFunctionSuggestion(button.dataset.function);
  });
  $('fill-down-btn').addEventListener('click', () => fill('down'));
  $('fill-right-btn').addEventListener('click', () => fill('right'));
  $('find-next-btn').addEventListener('click', findNext);
  $('replace-one-btn').addEventListener('click', replaceOne);
  $('replace-all-btn').addEventListener('click', replaceAll);
  $('find-text').addEventListener('input', () => {
    state.findMatches = [];
    state.findIndex = -1;
    renderGrid();
  });
  $('name-box').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    goToNameBoxAddress();
  });
  grid.addEventListener('keydown', onGridKeyDown);
  grid.addEventListener('paste', onPaste);
  grid.addEventListener('copy', onCopy);
  grid.addEventListener('cut', onCut);
  grid.addEventListener('scroll', positionFormulaSuggestions);
  document.addEventListener('mouseup', () => {
    state.draggingRange = false;
    state.dragStart = null;
    state.formulaRefDrag = null;
  });
  window.addEventListener('beforeunload', () => state.eventSource?.close());
}

function connectLive() {
  state.eventSource?.close();
  state.presenceConnected = false;
  state.presence = [];
  state.presenceSessions = [];
  state.lastPublishedSelection = '';
  if (state.presencePublishTimer) clearTimeout(state.presencePublishTimer);
  renderPresence();
  if (!state.workbookId || !state.currentUserId) return;
  const query = new URLSearchParams({ userId: state.currentUserId, sessionId: tabSessionId });
  const source = new EventSource(`/api/workbooks/${encodeURIComponent(state.workbookId)}/events?${query}`);
  state.eventSource = source;
  source.addEventListener('ready', () => {
    if (state.eventSource !== source) return;
    state.presenceConnected = true;
    renderPresence();
    queuePresenceSelection(true);
  });
  source.addEventListener('presence', (event) => {
    if (state.eventSource !== source) return;
    const data = JSON.parse(event.data);
    state.presenceConnected = true;
    state.presence = Array.isArray(data.users) ? data.users : [];
    state.presenceSessions = Array.isArray(data.sessions) ? data.sessions : [];
    renderPresence();
    renderGrid();
  });
  source.addEventListener('workbook', (event) => {
    if (state.eventSource !== source) return;
    handleRemoteWorkbookEvent(JSON.parse(event.data)).catch((error) => {
      message.textContent = `Live update failed: ${error.message}`;
    });
  });
  source.onerror = () => {
    if (state.eventSource !== source) return;
    state.presenceConnected = false;
    renderPresence();
  };
}

function renderPresence() {
  const totalTabs = state.presence.reduce((sum, user) => sum + Number(user.tabCount || 0), 0);
  $('presence-count').textContent = state.presenceConnected
    ? `Live: ${state.presence.length} ${state.presence.length === 1 ? 'user' : 'users'}, ${totalTabs} open ${totalTabs === 1 ? 'view' : 'views'}`
    : 'Live: reconnecting';
  $('presence-legend').innerHTML = state.presenceSessions.length
    ? state.presenceSessions.map((session) => `
      <span class="presence-legend-entry">
        <span class="presence-dot" style="background:${escapeHtml(session.color)}"></span>
        ${escapeHtml(session.userName)} — ${escapeHtml(presenceSelectionAddress(session.selection))}${session.sessionId === tabSessionId ? ' (you)' : ''}
      </span>
    `).join('')
    : '<span>No live selections yet.</span>';
  $('presence').innerHTML = state.presence.length
    ? state.presence.map((user) => {
      const sessions = state.presenceSessions.filter((session) => session.userId === user.userId);
      return `
        <div class="presence-user">
          <strong>${escapeHtml(user.userName)} (${user.tabCount} open ${user.tabCount === 1 ? 'view' : 'views'})</strong>
          ${sessions.map((session) => `
            <div class="presence-session">
              <span class="presence-dot" style="background:${escapeHtml(session.color)}"></span>
              ${escapeHtml(presenceSelectionAddress(session.selection))}${session.sessionId === tabSessionId ? ' (you)' : ''}
            </div>
          `).join('')}
        </div>
      `;
    }).join('')
    : escapeHtml(state.presenceConnected ? 'No active viewers.' : 'Reconnecting…');
}

function presenceSelectionAddress(selection) {
  if (!selection) return 'connecting';
  if (selection.startRow === selection.endRow && selection.startCol === selection.endCol) {
    return addr(selection.startRow, selection.startCol);
  }
  return rangeAddress(selection.startRow, selection.startCol, selection.endRow, selection.endCol);
}

function queuePresenceSelection(force = false) {
  if (!state.workbookId || !state.presenceConnected) return;
  const range = normalizedRange();
  const selection = range
    ? { startRow: range.r1, startCol: range.c1, endRow: range.r2, endCol: range.c2 }
    : { startRow: state.selected.row, startCol: state.selected.col, endRow: state.selected.row, endCol: state.selected.col };
  const signature = `${state.currentUserId}:${selection.startRow}:${selection.startCol}:${selection.endRow}:${selection.endCol}`;
  if (!force && signature === state.lastPublishedSelection) return;
  if (state.presencePublishTimer) clearTimeout(state.presencePublishTimer);
  state.presencePublishTimer = setTimeout(async () => {
    state.lastPublishedSelection = signature;
    try {
      await api(`/api/workbooks/${encodeURIComponent(state.workbookId)}/presence`, {
        method: 'POST',
        body: JSON.stringify({ userId: state.currentUserId, sessionId: tabSessionId, selection })
      });
    } catch {
      state.lastPublishedSelection = '';
    }
  }, 60);
}

function cellChanges(beforeCells, afterCells) {
  const keys = new Set([...Object.keys(beforeCells || {}), ...Object.keys(afterCells || {})]);
  return [...keys].filter((key) => String(beforeCells?.[key] ?? '') !== String(afterCells?.[key] ?? ''));
}

function applyCellChanges(targetCells, sourceCells, addresses) {
  for (const address of addresses) {
    const value = sourceCells?.[address];
    if (String(value ?? '') === '') delete targetCells[address];
    else targetCells[address] = value;
  }
}

function preserveRemoteChangesInUndoHistory(remoteCells, remoteChanges) {
  for (const snap of [...state.undo, ...state.redo]) {
    applyCellChanges(snap.cells, remoteCells, remoteChanges);
  }
}

async function handleRemoteWorkbookEvent(payload) {
  if (!payload?.workbook || !Number.isInteger(payload.revision)) return;
  if (payload.sourceSessionId === tabSessionId || payload.revision <= state.baseRevision) return;
  if (state.saving) {
    if (!state.pendingRemoteEvent || payload.revision > state.pendingRemoteEvent.revision) {
      state.pendingRemoteEvent = payload;
    }
    return;
  }

  const baselineCells = state.workbook?.sheets?.[0]?.cells || {};
  const remoteCells = payload.workbook?.sheets?.[0]?.cells || {};
  const localChanges = cellChanges(baselineCells, state.cells);
  const remoteChanges = cellChanges(baselineCells, remoteCells);
  const conflicts = localChanges.filter((address) => remoteChanges.includes(address));

  if (state.dirty && conflicts.length) {
    if (state.autosaveTimer) clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
    state.saveError = 'conflict';
    renderStatus();
    message.textContent = `Live conflict in ${conflicts.join(', ')} from ${payload.savedBy?.name || 'another user'}. Your unsaved values were preserved; reload or revise them before saving.`;
    return;
  }

  preserveRemoteChangesInUndoHistory(remoteCells, remoteChanges);
  if (state.dirty) {
    const mergedCells = { ...remoteCells };
    applyCellChanges(mergedCells, state.cells, localChanges);
    state.workbook = structuredClone(payload.workbook);
    state.baseRevision = payload.revision;
    state.cells = mergedCells;
    state.cellMeta = { ...(payload.cellMeta || state.cellMeta) };
    state.saveError = '';
    recalc();
    renderAll();
    message.textContent = `Live revision ${payload.revision} from ${payload.savedBy?.name || 'another user'} merged; your unsaved edits were preserved.`;
    if (!state.editing) scheduleAutosave();
  } else {
    state.workbook = structuredClone(payload.workbook);
    state.baseRevision = payload.revision;
    state.cells = { ...remoteCells };
    state.cellMeta = { ...(payload.cellMeta || state.cellMeta) };
    state.saveError = '';
    recalc();
    renderAll();
    message.textContent = `Live revision ${payload.revision} received from ${payload.savedBy?.name || 'another user'}.`;
  }
  await loadHistory();
  await loadSelectedCellHistory();
}

function snapshot() {
  return {
    cells: { ...state.cells },
    selected: { ...state.selected },
    range: state.range ? { ...state.range } : null
  };
}

function restore(snap) {
  state.cells = { ...snap.cells };
  state.selected = { ...snap.selected };
  state.range = snap.range ? { ...snap.range } : null;
  state.findMatches = [];
  state.findIndex = -1;
  state.dirty = true;
  recalc();
  renderAll();
}

function pushUndo() {
  state.undo.push(snapshot());
  if (state.undo.length > 150) state.undo.shift();
  state.redo = [];
}

function undo() {
  if (!state.undo.length) return;
  state.redo.push(snapshot());
  restore(state.undo.pop());
}

function redo() {
  if (!state.redo.length) return;
  state.undo.push(snapshot());
  restore(state.redo.pop());
}

function markDirty() {
  state.dirty = true;
  state.saveError = '';
  if (!state.editing) scheduleAutosave();
  renderStatus();
}

function scheduleAutosave() {
  if (state.autosaveTimer) clearTimeout(state.autosaveTimer);
  state.autosaveTimer = setTimeout(() => saveWorkbook({ auto: true }), 900);
}

async function saveWorkbook({ auto = false } = {}) {
  if (state.autosaveTimer) {
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
  }
  if (state.saving) return;
  if (!auto) clearMessage();
  if (!state.dirty) {
    if (!auto) message.textContent = 'No changes to save.';
    return;
  }
  const workbook = currentWorkbook();
  const savedContent = JSON.stringify(workbook);
  state.saving = true;
  state.saveError = '';
  renderStatus();
  try {
    const result = await api(`/api/workbooks/${encodeURIComponent(state.workbookId)}/save`, {
      method: 'POST',
      body: JSON.stringify({ workbookId: state.workbookId, baseRevision: state.baseRevision, workbook, userId: state.currentUserId, sessionId: tabSessionId })
    });
    state.baseRevision = result.revision;
    state.workbook = structuredClone(result.workbook || workbook);
    state.cells = { ...(state.workbook.sheets[0].cells || {}) };
    state.cellMeta = { ...(result.cellMeta || state.cellMeta) };
    state.dirty = JSON.stringify(currentWorkbook()) !== savedContent;
    state.saving = false;
    recalc();
    renderAll();
    renderStatus();
    await loadHistory();
    await loadSelectedCellHistory();
    message.textContent = result.unchanged
      ? 'No changes to save.'
      : result.merged
        ? `Saved revision ${result.revision}. Non-overlapping edits were merged.`
        : `Saved revision ${result.revision}.`;
    if (state.dirty) scheduleAutosave();
  } catch (error) {
    state.saving = false;
    state.saveError = error.response?.status === 409 ? 'conflict' : 'failed';
    renderStatus();
    message.textContent = error.response?.status === 409
      ? `Save conflict: ${(error.data.conflictingCells || []).join(', ') || 'stale revision'}. Server is at revision ${error.data.currentRevision}.`
      : `Save failed: ${error.message}`;
  }
  if (state.pendingRemoteEvent) {
    const pending = state.pendingRemoteEvent;
    state.pendingRemoteEvent = null;
    await handleRemoteWorkbookEvent(pending);
  }
}

function currentWorkbook() {
  const workbook = structuredClone(state.workbook);
  workbook.sheets[0].cells = cleanCells(state.cells);
  return workbook;
}

function cleanCells(cells) {
  return Object.fromEntries(Object.entries(cells).filter(([, value]) => String(value ?? '') !== ''));
}

async function loadHistory() {
  const { revisions } = await api(`/api/workbooks/${encodeURIComponent(state.workbookId)}/revisions`);
  $('history').innerHTML = revisions.map(rev => `
    <div class="rev">
      <strong>Revision ${rev.revision}</strong>
      <span>${escapeHtml(rev.created_at)}</span>
      <div>
        <button type="button" onclick="previewRevision(${rev.revision})">Preview</button>
        <button type="button" onclick="restoreRevision(${rev.revision})">Restore Draft</button>
      </div>
      <pre class="preview" id="preview-${rev.revision}" hidden></pre>
    </div>
  `).join('');
}

window.previewRevision = async (revision) => {
  const { revision: row } = await api(`/api/workbooks/${encodeURIComponent(state.workbookId)}/revisions/${revision}`);
  const pre = $(`preview-${revision}`);
  pre.hidden = !pre.hidden;
  pre.textContent = JSON.stringify(row.workbook.sheets[0].cells, null, 2).slice(0, 1600);
};

window.restoreRevision = async (revision) => {
  const { revision: row } = await api(`/api/workbooks/${encodeURIComponent(state.workbookId)}/revisions/${revision}`);
  const before = snapshot();
  state.cells = { ...(row.workbook.sheets[0].cells || {}) };
  state.undo = [before];
  state.redo = [];
  state.dirty = true;
  recalc();
  renderAll();
  message.textContent = `Revision ${revision} restored as draft.`;
};

function renderAll() {
  $('workbook-title').textContent = state.workbook?.title || 'GridForge';
  $('sheet-label').textContent = state.workbook?.sheets?.[0]?.name || 'Plan';
  renderGrid();
  renderStatus();
  updateFormulaBar();
  renderFormulaSuggestions();
}

function renderStatus() {
  $('revision-label').textContent = `Revision ${state.baseRevision}`;
  $('save-state').textContent = state.saving
    ? 'Saving'
    : state.saveError
      ? 'Save failed'
      : state.dirty
        ? 'Dirty'
        : 'Saved';
  $('user-select').value = state.currentUserId;
  $('save-btn').disabled = !state.dirty;
  $('undo-btn').disabled = !state.undo.length;
  $('redo-btn').disabled = !state.redo.length;
  const r = normalizedRange();
  $('selection-label').textContent = r ? `${addr(r.r1, r.c1)}:${addr(r.r2, r.c2)}` : addr(state.selected.row, state.selected.col);
  const meta = state.cellMeta[selectedAddr()];
  $('cell-editor-label').textContent = meta
    ? `${selectedAddr()} last edited by ${meta.userName}`
    : `${selectedAddr()} has no saved editor`;
  queuePresenceSelection();
}

function renderGrid() {
  const frag = document.createDocumentFragment();
  const corner = div('corner', '');
  frag.append(corner);
  for (let c = 1; c <= COLS; c++) frag.append(div('col-header', colName(c)));
  const range = normalizedRange();
  const formulaRefs = formulaReferenceCells();
  const findSet = new Set(state.findMatches);
  for (let r = 1; r <= ROWS; r++) {
    const header = div('row-header', r);
    frag.append(header);
    for (let c = 1; c <= COLS; c++) {
      const a = addr(r, c);
      const cell = div('cell', displayValue(a));
      cell.dataset.addr = a;
      cell.dataset.raw = state.cells[a] || '';
      if (state.editing && state.editCell === a) {
        cell.textContent = state.editBuffer;
        cell.classList.add('editing');
      }
      if (state.errors[a] && !(state.editing && state.editCell === a)) {
        cell.classList.add('error');
        cell.title = state.errors[a];
      }
      if (findSet.has(a)) cell.classList.add('find-match');
      if (formulaRefs.has(a)) cell.classList.add('formula-ref');
      if (state.selected.row === r && state.selected.col === c) cell.classList.add('selected');
      if (range && r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2) cell.classList.add('in-range');
      const remoteSessions = state.presenceSessions.filter((session) => {
        const selection = session.selection;
        return session.sessionId !== tabSessionId && selection
          && r >= selection.startRow && r <= selection.endRow
          && c >= selection.startCol && c <= selection.endCol;
      });
      if (remoteSessions.length) {
        const labels = remoteSessions.map((session) => session.userName);
        const colors = remoteSessions.map((session) => session.color);
        cell.classList.add('remote-presence');
        cell.style.setProperty('--remote-rings', colors.map((color, index) => `inset 0 0 0 ${2 + (index * 2)}px ${color}`).join(', '));
        cell.title = [cell.title, `Currently selected by ${labels.join(', ')}`].filter(Boolean).join(' — ');
      }
      cell.addEventListener('mousedown', (event) => startMouseSelection(r, c, event));
      cell.addEventListener('mouseenter', () => extendMouseSelection(r, c));
      cell.addEventListener('dblclick', () => startEdit(a));
      frag.append(cell);
    }
  }
  grid.replaceChildren(frag);
}

function div(className, text) {
  const node = document.createElement('div');
  node.className = className;
  node.textContent = text;
  return node;
}

function selectCell(row, col, extend = false) {
  commitEdit();
  if (extend) {
    state.range = { startRow: state.selected.row, startCol: state.selected.col, endRow: row, endCol: col };
  } else {
    state.selected = { row, col };
    state.range = null;
  }
  updateFormulaBar();
  renderGrid();
  renderStatus();
  loadSelectedCellHistory();
  grid.focus();
}

function startMouseSelection(row, col, event) {
  if (event.button !== 0) return;
  if (state.editing && String(state.editBuffer).startsWith('=')) {
    event.preventDefault();
    startFormulaReferencePick(row, col);
    return;
  }
  commitEdit();
  event.preventDefault();
  if (event.shiftKey) {
    selectCell(row, col, true);
    return;
  }
  state.selected = { row, col };
  state.range = null;
  state.draggingRange = true;
  state.dragStart = { row, col };
  updateFormulaBar();
  renderGrid();
  renderStatus();
  loadSelectedCellHistory();
  grid.focus();
}

function startFormulaReferencePick(row, col) {
  const span = formulaReferenceReplacementSpan();
  state.formulaRefDrag = { startRow: row, startCol: col, insertStart: span.start, insertEnd: span.end };
  replaceFormulaReferenceText(addr(row, col));
}

function formulaReferenceReplacementSpan() {
  const caretStart = formulaBar.selectionStart ?? state.editBuffer.length;
  const caretEnd = formulaBar.selectionEnd ?? caretStart;
  if (caretStart !== caretEnd) return { start: caretStart, end: caretEnd };
  const before = state.editBuffer.slice(0, caretStart);
  const after = state.editBuffer.slice(caretEnd);
  const beforeRef = before.match(/([A-Z]+\d+(?::[A-Z]+\d+)?)$/i);
  const afterRef = after.match(/^([A-Z]+\d+(?::[A-Z]+\d+)?)/i);
  if (beforeRef) {
    return { start: caretStart - beforeRef[1].length, end: caretStart };
  }
  if (afterRef) {
    return { start: caretStart, end: caretStart + afterRef[1].length };
  }
  return { start: caretStart, end: caretStart };
}

function replaceFormulaReferenceText(reference) {
  if (!state.formulaRefDrag) return;
  const { insertStart, insertEnd } = state.formulaRefDrag;
  state.editBuffer = `${state.editBuffer.slice(0, insertStart)}${reference}${state.editBuffer.slice(insertEnd)}`;
  state.formulaRefDrag.insertEnd = insertStart + reference.length;
  applyEditBuffer({ keepFormulaFocus: true });
  formulaBar.focus();
  formulaBar.setSelectionRange(state.formulaRefDrag.insertEnd, state.formulaRefDrag.insertEnd);
}

function insertFormulaReference(reference) {
  const input = formulaBar;
  const start = input.selectionStart ?? state.editBuffer.length;
  const end = input.selectionEnd ?? start;
  state.editBuffer = `${state.editBuffer.slice(0, start)}${reference}${state.editBuffer.slice(end)}`;
  applyEditBuffer({ keepFormulaFocus: true });
  const caret = start + reference.length;
  formulaBar.focus();
  formulaBar.setSelectionRange(caret, caret);
}

function extendMouseSelection(row, col) {
  if (state.formulaRefDrag) {
    const start = state.formulaRefDrag;
    const reference = start.startRow === row && start.startCol === col
      ? addr(row, col)
      : rangeAddress(start.startRow, start.startCol, row, col);
    replaceFormulaReferenceText(reference);
    return;
  }
  if (!state.draggingRange || !state.dragStart) return;
  state.range = {
    startRow: state.dragStart.row,
    startCol: state.dragStart.col,
    endRow: row,
    endCol: col
  };
  renderGrid();
  renderStatus();
}

function updateFormulaBar() {
  const a = selectedAddr();
  $('name-box').value = a;
  formulaBar.value = state.cells[a] || '';
  renderFormulaSuggestions();
}

async function loadSelectedCellHistory() {
  if (!state.workbookId) return;
  const current = selectedAddr();
  try {
    const { history } = await api(`/api/workbooks/${encodeURIComponent(state.workbookId)}/cells/${encodeURIComponent(current)}/history`);
    if (current !== selectedAddr()) return;
    $('cell-history').innerHTML = history.length ? history.map((item) => `
      <div class="history-entry">
        <strong>${escapeHtml(item.userName)} · revision ${item.revision}</strong>
        <span>${escapeHtml(item.editedAt)}</span>
        <div><code>${escapeHtml(item.oldValue || '(blank)')}</code> → <code>${escapeHtml(item.newValue || '(blank)')}</code></div>
      </div>
    `).join('') : `${escapeHtml(current)} has no saved cell history.`;
  } catch {
    $('cell-history').textContent = 'Cell history unavailable.';
  }
}

function setSelectedValue(value) {
  setRangeValues([[String(value ?? '')]]);
}

function setRangeValues(matrix) {
  pushUndo();
  const start = state.selected;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      const a = addr(start.row + r, start.col + c);
      state.cells[a] = matrix[r][c];
    }
  }
  recalc();
  markDirty();
  renderAll();
}

function startEdit(a) {
  const value = prompt(`Edit ${a}`, state.cells[a] || '');
  if (value !== null) {
    const pos = parseAddr(a);
    state.selected = { row: pos.row, col: pos.col };
    setSelectedValue(value);
  }
}

function onGridKeyDown(event) {
  const key = event.key;
  if (state.editing) {
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      state.editBuffer += key;
      applyEditBuffer();
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      state.editBuffer = state.editBuffer.slice(0, -1);
      applyEditBuffer();
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      commitEdit();
      return;
    }
    commitEdit();
  }
  if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'z') {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'y') {
    event.preventDefault();
    redo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'a') {
    event.preventDefault();
    state.range = { startRow: 1, startCol: 1, endRow: ROWS, endCol: COLS };
    renderAll();
    return;
  }
  const moves = {
    ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0],
    Tab: [0, event.shiftKey ? -1 : 1], Enter: [event.shiftKey ? -1 : 1, 0]
  };
  if (moves[key]) {
    event.preventDefault();
    const [dr, dc] = moves[key];
    const next = {
      row: clamp(state.selected.row + dr, 1, ROWS),
      col: clamp(state.selected.col + dc, 1, COLS)
    };
    if (event.shiftKey && key.startsWith('Arrow')) {
      state.range = state.range || { startRow: state.selected.row, startCol: state.selected.col, endRow: state.selected.row, endCol: state.selected.col };
      state.range.endRow = next.row;
      state.range.endCol = next.col;
    } else {
      state.range = null;
    }
    state.selected = next;
    renderAll();
    scrollSelectionIntoView();
    return;
  }
  if (key === 'Delete' || key === 'Backspace') {
    event.preventDefault();
    clearRange();
    return;
  }
  if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    startFormulaEdit(key);
  }
}

function startFormulaEdit(initialText = '') {
  pushUndo();
  state.editing = true;
  state.editCell = addr(state.selected.row, state.selected.col);
  state.editBuffer = initialText;
  applyEditBuffer({ keepFormulaFocus: true });
  formulaBar.focus();
  formulaBar.setSelectionRange(formulaBar.value.length, formulaBar.value.length);
}

function applyEditBuffer({ keepFormulaFocus = false } = {}) {
  if (!state.editCell) return;
  state.cells[state.editCell] = state.editBuffer;
  formulaBar.value = state.editBuffer;
  recalc();
  markDirty();
  renderGrid();
  renderFormulaSuggestions();
  renderStatus();
  if (!keepFormulaFocus) grid.focus();
}

function commitEdit() {
  if (!state.editing) return;
  state.editing = false;
  state.editCell = null;
  state.editBuffer = '';
  state.formulaRefDrag = null;
  recalc();
  renderAll();
  if (state.dirty) scheduleAutosave();
}

function renderFormulaSuggestions() {
  const box = $('formula-suggestions');
  if (!state.editing || !String(state.editBuffer).startsWith('=')) {
    box.hidden = true;
    box.replaceChildren();
    return;
  }
  const caret = formulaBar.selectionStart ?? state.editBuffer.length;
  const beforeCaret = state.editBuffer.slice(0, caret);
  const token = beforeCaret.match(/[A-Z]*$/i)?.[0].toUpperCase() || '';
  const matches = token ? FUNCTIONS.filter((name) => name.startsWith(token)) : [];
  if (!matches.length || FUNCTIONS.includes(token)) {
    box.hidden = true;
    box.replaceChildren();
    return;
  }
  box.hidden = false;
  box.replaceChildren(...matches.map((name) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'formula-suggestion';
    button.dataset.function = name;
    button.textContent = name;
    return button;
  }));
  positionFormulaSuggestions();
}

function positionFormulaSuggestions() {
  const box = $('formula-suggestions');
  if (box.hidden || !state.editCell) return;
  const cell = grid.querySelector(`[data-addr="${state.editCell}"]`);
  if (!cell) return;
  const rect = cell.getBoundingClientRect();
  box.style.left = `${rect.left}px`;
  box.style.top = `${rect.bottom + 3}px`;
  box.style.width = `${Math.max(rect.width, 132)}px`;
}

function completeFunctionSuggestion(name) {
  if (!state.editing || !String(state.editBuffer).startsWith('=')) return;
  const caret = formulaBar.selectionStart ?? state.editBuffer.length;
  const beforeCaret = state.editBuffer.slice(0, caret);
  const token = beforeCaret.match(/[A-Z]*$/i)?.[0] || '';
  const start = caret - token.length;
  const replacement = `${name}(`;
  state.editBuffer = `${state.editBuffer.slice(0, start)}${replacement}${state.editBuffer.slice(caret)}`;
  applyEditBuffer({ keepFormulaFocus: true });
  const nextCaret = start + replacement.length;
  formulaBar.focus();
  formulaBar.setSelectionRange(nextCaret, nextCaret);
}

function onPaste(event) {
  event.preventDefault();
  const text = event.clipboardData.getData('text/plain');
  const matrix = parseClipboardTable(text);
  setRangeValues(matrix);
}

function parseClipboardTable(text) {
  const rows = String(text).split(/\r?\n/).filter((line, i, arr) => line || i < arr.length - 1);
  const delimiter = rows.some((line) => line.includes('\t')) ? '\t' : ',';
  return rows.map((line) => line.split(delimiter).map((cell) => cell.trim()));
}

function onCopy(event) {
  const text = rangeText();
  if (!text) return;
  event.preventDefault();
  event.clipboardData.setData('text/plain', text);
}

function onCut(event) {
  const text = rangeText();
  if (!text) return;
  event.preventDefault();
  event.clipboardData.setData('text/plain', text);
  clearRange();
}

function rangeText() {
  const r = normalizedRange() || { r1: state.selected.row, c1: state.selected.col, r2: state.selected.row, c2: state.selected.col };
  const rows = [];
  for (let row = r.r1; row <= r.r2; row++) {
    const vals = [];
    for (let col = r.c1; col <= r.c2; col++) vals.push(state.cells[addr(row, col)] || '');
    rows.push(vals.join('\t'));
  }
  return rows.join('\n');
}

function clearRange() {
  const r = normalizedRange() || { r1: state.selected.row, c1: state.selected.col, r2: state.selected.row, c2: state.selected.col };
  pushUndo();
  for (let row = r.r1; row <= r.r2; row++) {
    for (let col = r.c1; col <= r.c2; col++) state.cells[addr(row, col)] = '';
  }
  state.range = null;
  recalc();
  markDirty();
  renderAll();
}

function fill(direction) {
  const r = normalizedRange() || { r1: state.selected.row, c1: state.selected.col, r2: state.selected.row, c2: state.selected.col };
  pushUndo();
  if (direction === 'down') {
    for (let col = r.c1; col <= r.c2; col++) {
      const { seed, targetStart, targetEnd } = fillPlanDown(r, col);
      for (let row = targetStart; row <= targetEnd; row++) {
        state.cells[addr(row, col)] = fillValue(seed, row - r.r1, 'row');
      }
    }
  } else {
    for (let row = r.r1; row <= r.r2; row++) {
      const { seed, targetStart, targetEnd } = fillPlanRight(r, row);
      for (let col = targetStart; col <= targetEnd; col++) {
        state.cells[addr(row, col)] = fillValue(seed, col - r.c1, 'col');
      }
    }
  }
  recalc();
  markDirty();
  renderAll();
}

function fillPlanDown(r, col) {
  const selected = [];
  for (let row = r.r1; row <= r.r2; row++) selected.push(state.cells[addr(row, col)] || '');
  let sourceCount = selected.findIndex((value) => value === '');
  if (sourceCount < 0) sourceCount = selected.length;
  sourceCount = Math.max(1, sourceCount);
  const seed = selected.slice(0, sourceCount);
  if (sourceCount < selected.length) {
    return { seed, targetStart: r.r1 + sourceCount, targetEnd: r.r2 };
  }
  const extension = seed.length >= 2 && seed.map(Number).every(Number.isFinite) ? 4 : 2;
  return { seed, targetStart: r.r2 + 1, targetEnd: Math.min(ROWS, r.r2 + extension) };
}

function fillPlanRight(r, row) {
  const selected = [];
  for (let col = r.c1; col <= r.c2; col++) selected.push(state.cells[addr(row, col)] || '');
  let sourceCount = selected.findIndex((value) => value === '');
  if (sourceCount < 0) sourceCount = selected.length;
  sourceCount = Math.max(1, sourceCount);
  const seed = selected.slice(0, sourceCount);
  if (sourceCount < selected.length) {
    return { seed, targetStart: r.c1 + sourceCount, targetEnd: r.c2 };
  }
  return { seed, targetStart: r.c2 + 1, targetEnd: Math.min(COLS, r.c2 + 2) };
}

function fillValue(seed, offset, axis) {
  const last = seed[seed.length - 1] || '';
  const nums = seed.map(Number);
  if (seed.length >= 2 && nums.every(Number.isFinite)) {
    return String(nums[0] + (nums[1] - nums[0]) * offset);
  }
  if (String(last).startsWith('=')) return shiftFormula(last, axis === 'row' ? offset - seed.length + 1 : 0, axis === 'col' ? offset - seed.length + 1 : 0);
  return last;
}

function shiftFormula(formula, dr, dc) {
  return formula.replace(/\b([A-Z]+)(\d+)\b/g, (_m, letters, row) => {
    const col = colIndex(letters) + dc;
    return `${colName(Math.max(1, col))}${Math.max(1, Number(row) + dr)}`;
  });
}

function findQuery() {
  return $('find-text').value;
}

function replaceText() {
  return $('replace-text').value;
}

function recomputeFindMatches() {
  const query = findQuery();
  state.findMatches = [];
  state.findIndex = -1;
  if (!query) return;
  for (let row = 1; row <= ROWS; row++) {
    for (let col = 1; col <= COLS; col++) {
      const a = addr(row, col);
      if (String(state.cells[a] || '').includes(query)) state.findMatches.push(a);
    }
  }
}

function findNext() {
  const query = findQuery();
  if (!query) {
    message.textContent = 'Enter text to find.';
    return;
  }
  const selected = selectedAddr();
  const existing = state.findMatches.includes(selected) ? state.findMatches.indexOf(selected) : state.findIndex;
  recomputeFindMatches();
  if (!state.findMatches.length) {
    message.textContent = `No matches for ${query}.`;
    renderGrid();
    return;
  }
  state.findIndex = (existing + 1 + state.findMatches.length) % state.findMatches.length;
  const pos = parseAddr(state.findMatches[state.findIndex]);
  state.selected = { row: pos.row, col: pos.col };
  state.range = null;
  updateFormulaBar();
  renderGrid();
  renderStatus();
  scrollSelectionIntoView();
  message.textContent = `Match ${state.findIndex + 1} of ${state.findMatches.length}.`;
  loadSelectedCellHistory();
}

function replaceOne() {
  const query = findQuery();
  if (!query) return;
  const current = selectedAddr();
  if (!String(state.cells[current] || '').includes(query)) {
    findNext();
    return;
  }
  pushUndo();
  state.cells[current] = String(state.cells[current] || '').replace(query, replaceText());
  recalc();
  markDirty();
  recomputeFindMatches();
  renderAll();
}

function replaceAll() {
  const query = findQuery();
  if (!query) return;
  recomputeFindMatches();
  if (!state.findMatches.length) return;
  pushUndo();
  for (const a of state.findMatches) {
    state.cells[a] = String(state.cells[a] || '').split(query).join(replaceText());
  }
  recalc();
  markDirty();
  recomputeFindMatches();
  renderAll();
}

function goToNameBoxAddress() {
  const text = $('name-box').value.trim().toUpperCase();
  const range = parseRange(text);
  if (!range || range.r1 < 1 || range.c1 < 1 || range.r2 > ROWS || range.c2 > COLS) {
    message.textContent = `Invalid address: ${text}`;
    updateFormulaBar();
    return;
  }
  state.selected = { row: range.r1, col: range.c1 };
  state.range = range.r1 === range.r2 && range.c1 === range.c2
    ? null
    : { startRow: range.r1, startCol: range.c1, endRow: range.r2, endCol: range.c2 };
  updateFormulaBar();
  renderGrid();
  renderStatus();
  scrollSelectionIntoView();
  loadSelectedCellHistory();
  grid.focus();
}

function recalc() {
  state.values = {};
  state.errors = {};
  for (const a of allAddresses()) evaluate(a, []);
}

function evaluate(a, stack) {
  if (a in state.values || state.errors[a]) return state.values[a];
  const raw = state.cells[a] || '';
  if (!String(raw).startsWith('=')) {
    const num = Number(raw);
    state.values[a] = raw !== '' && Number.isFinite(num) ? num : raw;
    return state.values[a];
  }
  if (stack.includes(a)) {
    for (const item of stack) state.errors[item] = '#CIRCULAR';
    state.errors[a] = '#CIRCULAR';
    return null;
  }
  try {
    const value = evalFormula(String(raw).slice(1), [...stack, a]);
    if (!Number.isFinite(value)) throw new Error('#DIV/0!');
    state.values[a] = value;
    return value;
  } catch (error) {
    state.errors[a] = error.message || '#ERROR';
    return null;
  }
}

function evalFormula(expr, stack) {
  let i = 0;
  function skip() { while (/\s/.test(expr[i])) i++; }
  function parseExpression() {
    let value = parseTerm();
    while (true) {
      skip();
      if (expr[i] === '+') { i++; value += parseTerm(); }
      else if (expr[i] === '-') { i++; value -= parseTerm(); }
      else return value;
    }
  }
  function parseTerm() {
    let value = parseFactor();
    while (true) {
      skip();
      if (expr[i] === '*') { i++; value *= parseFactor(); }
      else if (expr[i] === '/') { i++; const d = parseFactor(); if (d === 0) throw new Error('#DIV/0!'); value /= d; }
      else return value;
    }
  }
  function parseFactor() {
    skip();
    if (expr[i] === '(') {
      i++;
      const value = parseExpression();
      skip();
      if (expr[i++] !== ')') throw new Error('#ERROR');
      return value;
    }
    if (expr[i] === '-') { i++; return -parseFactor(); }
    const rest = expr.slice(i);
    const fn = rest.match(/^(SUM|AVG|MIN|MAX|COUNT)\(/i);
    if (fn) {
      i += fn[0].length;
      const values = parseFunctionArgs(stack);
      skip();
      if (expr[i++] !== ')') throw new Error('#ERROR');
      const nums = values
        .filter((value) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)))
        .map(Number);
      const name = fn[1].toUpperCase();
      if (name === 'SUM') return nums.reduce((a, b) => a + b, 0);
      if (name === 'AVG') return nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
      if (name === 'MIN') return Math.min(...nums);
      if (name === 'MAX') return Math.max(...nums);
      return nums.length;
    }
    const rangeMatch = rest.match(/^([A-Z]+\d+):([A-Z]+\d+)/i);
    if (rangeMatch) throw new Error('#ERROR');
    const ref = rest.match(/^([A-Z]+\d+)/i);
    if (ref) {
      i += ref[1].length;
      const value = evaluate(ref[1].toUpperCase(), stack);
      return Number(value) || 0;
    }
    const num = rest.match(/^\d+(?:\.\d+)?/);
    if (num) {
      i += num[0].length;
      return Number(num[0]);
    }
    throw new Error('#ERROR');
  }
  function parseFunctionArgs(stackArg) {
    const values = [];
    skip();
    if (expr[i] === ')') return values;
    while (i < expr.length) {
      values.push(...parseRangeOrExpression(stackArg));
      skip();
      if (expr[i] !== ',') break;
      i++;
      skip();
      if (expr[i] === ')') throw new Error('#ERROR');
    }
    return values;
  }
  function parseRangeOrExpression(stackArg) {
    skip();
    const match = expr.slice(i).match(/^([A-Z]+\d+):([A-Z]+\d+)/i);
    if (!match) return [parseExpression()];
    i += match[0].length;
    const r = parseRange(match[0]);
    const values = [];
    for (let row = r.r1; row <= r.r2; row++) {
      for (let col = r.c1; col <= r.c2; col++) values.push(evaluate(addr(row, col), stackArg));
    }
    return values;
  }
  const result = parseExpression();
  skip();
  if (i < expr.length) throw new Error('#ERROR');
  return result;
}

function displayValue(a) {
  return state.errors[a] || (state.values[a] ?? '');
}

function formulaReferenceCells() {
  const refs = new Set();
  if (!state.editing || !String(state.editBuffer).startsWith('=')) return refs;
  const text = state.editBuffer.toUpperCase();
  for (const match of text.matchAll(/\b([A-Z]+\d+):([A-Z]+\d+)\b/g)) {
    const r = parseRange(match[0]);
    if (!r) continue;
    for (let row = r.r1; row <= r.r2; row++) {
      for (let col = r.c1; col <= r.c2; col++) refs.add(addr(row, col));
    }
  }
  for (const match of text.matchAll(/\b([A-Z]+\d+)\b/g)) refs.add(match[1]);
  return refs;
}

function allAddresses() {
  const set = new Set(Object.keys(state.cells));
  for (let r = 1; r <= ROWS; r++) for (let c = 1; c <= COLS; c++) set.add(addr(r, c));
  return set;
}

function normalizedRange() {
  if (!state.range) return null;
  return {
    r1: Math.min(state.range.startRow, state.range.endRow),
    r2: Math.max(state.range.startRow, state.range.endRow),
    c1: Math.min(state.range.startCol, state.range.endCol),
    c2: Math.max(state.range.startCol, state.range.endCol)
  };
}

function parseRange(text) {
  const [a, b] = String(text).toUpperCase().split(':');
  const p1 = parseAddr(a);
  const p2 = parseAddr(b || a);
  if (!p1 || !p2) return null;
  return { r1: Math.min(p1.row, p2.row), r2: Math.max(p1.row, p2.row), c1: Math.min(p1.col, p2.col), c2: Math.max(p1.col, p2.col) };
}

function rangeAddress(startRow, startCol, endRow, endCol) {
  const r1 = Math.min(startRow, endRow);
  const r2 = Math.max(startRow, endRow);
  const c1 = Math.min(startCol, endCol);
  const c2 = Math.max(startCol, endCol);
  return `${addr(r1, c1)}:${addr(r2, c2)}`;
}

function parseAddr(a) {
  const m = String(a).toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  return { row: Number(m[2]), col: colIndex(m[1]) };
}

function addr(row, col) {
  return `${colName(col)}${row}`;
}

function colName(index) {
  let name = '';
  while (index > 0) {
    const rem = (index - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
}

function colIndex(name) {
  return [...String(name).toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scrollSelectionIntoView() {
  grid.querySelector(`[data-addr="${addr(state.selected.row, state.selected.col)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function clearMessage() {
  message.textContent = '';
}

function selectedAddr() {
  return addr(state.selected.row, state.selected.col);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

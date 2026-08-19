const ROWS = 90;
const COLS = 20;

const grid = document.getElementById('grid');
const formulaBar = document.getElementById('formula-bar');
const message = document.getElementById('message');

const state = {
  workbookId: null,
  baseRevision: 0,
  workbook: null,
  cells: {},
  values: {},
  errors: {},
  selected: { row: 1, col: 1 },
  range: null,
  dirty: false,
  undo: [],
  redo: [],
  filter: null
};

const $ = (id) => document.getElementById(id);

init();

async function init() {
  bindEvents();
  const { workbooks } = await api('/api/workbooks');
  await loadWorkbook(workbooks[0].id);
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
  state.dirty = false;
  state.undo = [];
  state.redo = [];
  state.filter = null;
  recalc();
  renderAll();
  await loadHistory();
}

function bindEvents() {
  $('save-btn').addEventListener('click', saveWorkbook);
  $('undo-btn').addEventListener('click', undo);
  $('redo-btn').addEventListener('click', redo);
  $('apply-formula').addEventListener('click', () => setSelectedValue(formulaBar.value));
  formulaBar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') setSelectedValue(formulaBar.value);
  });
  $('fill-down-btn').addEventListener('click', () => fill('down'));
  $('fill-right-btn').addEventListener('click', () => fill('right'));
  $('clear-btn').addEventListener('click', clearRange);
  $('sort-desc-btn').addEventListener('click', sortDesc);
  $('filter-btn').addEventListener('click', applyFilter);
  $('clear-filter-btn').addEventListener('click', () => { state.filter = null; renderGrid(); });
  grid.addEventListener('keydown', onGridKeyDown);
  grid.addEventListener('paste', onPaste);
  grid.addEventListener('copy', onCopy);
  grid.addEventListener('cut', onCut);
}

function snapshot() {
  return {
    cells: { ...state.cells },
    selected: { ...state.selected },
    range: state.range ? { ...state.range } : null,
    filter: state.filter ? { ...state.filter } : null
  };
}

function restore(snap) {
  state.cells = { ...snap.cells };
  state.selected = { ...snap.selected };
  state.range = snap.range ? { ...snap.range } : null;
  state.filter = snap.filter ? { ...snap.filter } : null;
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
  renderStatus();
}

async function saveWorkbook() {
  clearMessage();
  if (!state.dirty) {
    message.textContent = 'No changes to save.';
    return;
  }
  const workbook = currentWorkbook();
  try {
    const result = await api(`/api/workbooks/${encodeURIComponent(state.workbookId)}/save`, {
      method: 'POST',
      body: JSON.stringify({ workbookId: state.workbookId, baseRevision: state.baseRevision, workbook })
    });
    state.baseRevision = result.revision;
    state.workbook = structuredClone(workbook);
    state.dirty = false;
    renderStatus();
    await loadHistory();
    message.textContent = result.unchanged ? 'No changes to save.' : `Saved revision ${result.revision}.`;
  } catch (error) {
    message.textContent = error.response?.status === 409
      ? `Save conflict: stale revision. Server is at revision ${error.data.currentRevision}.`
      : `Save failed: ${error.message}`;
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
}

function renderStatus() {
  $('revision-label').textContent = `Revision ${state.baseRevision}`;
  $('save-state').textContent = state.dirty ? 'Dirty' : 'Saved';
  $('save-btn').disabled = !state.dirty;
  $('undo-btn').disabled = !state.undo.length;
  $('redo-btn').disabled = !state.redo.length;
  const r = normalizedRange();
  $('selection-label').textContent = r ? `${addr(r.r1, r.c1)}:${addr(r.r2, r.c2)}` : addr(state.selected.row, state.selected.col);
}

function renderGrid() {
  const frag = document.createDocumentFragment();
  const corner = div('corner', '');
  frag.append(corner);
  for (let c = 1; c <= COLS; c++) frag.append(div('col-header', colName(c)));
  const range = normalizedRange();
  for (let r = 1; r <= ROWS; r++) {
    const hidden = rowHidden(r);
    const header = div(`row-header${hidden ? ' hidden-row' : ''}`, r);
    frag.append(header);
    for (let c = 1; c <= COLS; c++) {
      const a = addr(r, c);
      const cell = div(`cell${hidden ? ' hidden-row' : ''}`, displayValue(a));
      cell.dataset.addr = a;
      cell.dataset.raw = state.cells[a] || '';
      if (state.errors[a]) {
        cell.classList.add('error');
        cell.title = state.errors[a];
      }
      if (state.selected.row === r && state.selected.col === c) cell.classList.add('selected');
      if (range && r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2) cell.classList.add('in-range');
      cell.addEventListener('mousedown', (event) => selectCell(r, c, event.shiftKey));
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
  if (extend) {
    state.range = { startRow: state.selected.row, startCol: state.selected.col, endRow: row, endCol: col };
  } else {
    state.selected = { row, col };
    state.range = null;
  }
  updateFormulaBar();
  renderGrid();
  renderStatus();
  grid.focus();
}

function updateFormulaBar() {
  const a = addr(state.selected.row, state.selected.col);
  $('name-box').value = a;
  formulaBar.value = state.cells[a] || '';
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
    setSelectedValue(key);
  }
}

function onPaste(event) {
  event.preventDefault();
  const text = event.clipboardData.getData('text/plain');
  const matrix = text.split(/\r?\n/).filter((line, i, arr) => line || i < arr.length - 1).map(line => line.split('\t'));
  setRangeValues(matrix);
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
  const r = normalizedRange();
  if (!r) return;
  pushUndo();
  if (direction === 'down') {
    const height = r.r2 - r.r1 + 1;
    for (let col = r.c1; col <= r.c2; col++) {
      const seed = [];
      for (let row = r.r1; row <= r.r2; row++) seed.push(state.cells[addr(row, col)] || '');
      for (let row = r.r2 + 1; row <= Math.min(ROWS, r.r2 + height + 2); row++) {
        state.cells[addr(row, col)] = fillValue(seed, row - r.r1, 'row');
      }
    }
  } else {
    const width = r.c2 - r.c1 + 1;
    for (let row = r.r1; row <= r.r2; row++) {
      const seed = [];
      for (let col = r.c1; col <= r.c2; col++) seed.push(state.cells[addr(row, col)] || '');
      for (let col = r.c2 + 1; col <= Math.min(COLS, r.c2 + width + 2); col++) {
        state.cells[addr(row, col)] = fillValue(seed, col - r.c1, 'col');
      }
    }
  }
  recalc();
  markDirty();
  renderAll();
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

function sortDesc() {
  const r = parseRange($('sort-range').value);
  const sortCol = colIndex($('sort-column').value.trim().toUpperCase());
  if (!r || !sortCol) return;
  pushUndo();
  const rows = [];
  for (let row = r.r1; row <= r.r2; row++) {
    const obj = { row, cells: [] };
    for (let col = r.c1; col <= r.c2; col++) obj.cells.push(state.cells[addr(row, col)] || '');
    obj.key = Number(state.values[addr(row, sortCol)] ?? state.cells[addr(row, sortCol)] ?? 0);
    rows.push(obj);
  }
  rows.sort((a, b) => b.key - a.key);
  rows.forEach((obj, idx) => {
    const row = r.r1 + idx;
    obj.cells.forEach((value, offset) => {
      const oldRow = obj.row;
      const col = r.c1 + offset;
      state.cells[addr(row, col)] = shiftFormulaForRowMove(value, oldRow, row);
    });
  });
  recalc();
  markDirty();
  renderAll();
}

function shiftFormulaForRowMove(value, oldRow, newRow) {
  if (!String(value).startsWith('=')) return value;
  const delta = newRow - oldRow;
  return String(value).replace(/\b([A-Z]+)(\d+)\b/g, (_m, col, row) => `${col}${Number(row) + delta}`);
}

function applyFilter() {
  const r = parseRange($('filter-range').value);
  const text = $('filter-text').value;
  if (!r) return;
  state.filter = { ...r, text };
  renderGrid();
}

function rowHidden(row) {
  const f = state.filter;
  if (!f || row < f.r1 || row > f.r2) return false;
  for (let col = f.c1; col <= f.c2; col++) {
    if (String(displayValue(addr(row, col))).includes(f.text)) return false;
  }
  return true;
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
      const values = parseRangeArg(stack);
      skip();
      if (expr[i++] !== ')') throw new Error('#ERROR');
      const nums = values.map(Number).filter(Number.isFinite);
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
  function parseRangeArg(stackArg) {
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

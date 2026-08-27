const DEFAULT_DOCUMENT_ID = 'incident-alpha';
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

const state = {
  documentId: DEFAULT_DOCUMENT_ID,
  title: '',
  baseRevision: 0,
  lines: [''],
  caret: { line: 0, col: 0 },
  extraCarets: [],
  selection: null,
  preferredCol: null,
  undo: [],
  redo: [],
  typingGroup: null,
  dirty: false,
  query: '',
  matches: [],
  activeMatch: -1
};

const editor = document.getElementById('editor');
const message = document.getElementById('message');

document.addEventListener('DOMContentLoaded', async () => {
  bindControls();
  await loadDocuments();
  await loadDocument(DEFAULT_DOCUMENT_ID);
});

function bindControls() {
  const findBox = document.getElementById('find-box');
  document.getElementById('save-btn').addEventListener('click', saveDocument);
  document.getElementById('undo-btn').addEventListener('click', undo);
  document.getElementById('redo-btn').addEventListener('click', redo);
  document.getElementById('find-next-btn').addEventListener('click', findNext);
  document.getElementById('replace-current-btn').addEventListener('click', replaceCurrent);
  document.getElementById('replace-all-btn').addEventListener('click', replaceAll);
  findBox.addEventListener('input', (event) => {
    state.query = event.target.value;
    state.activeMatch = -1;
    recomputeMatches();
    render();
  });
  findBox.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) findPrevious();
      else findNext();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      editor.focus();
    }
  });

  editor.addEventListener('keydown', onKeyDown);
  editor.addEventListener('paste', onPaste);
  editor.addEventListener('mousedown', onMouseDown);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function loadDocuments() {
  const { documents } = await api('/api/documents');
  document.getElementById('document-list').innerHTML = documents.map((doc) => `
    <div class="revision">
      <strong>${escapeHtml(doc.title)}</strong><br>
      <span>Revision ${doc.current_revision}</span><br>
      <button type="button" onclick="loadDocument('${escapeAttr(doc.id)}')">Open</button>
    </div>
  `).join('');
}

async function loadDocument(id) {
  const { document: loadedDocument } = await api(`/api/documents/${encodeURIComponent(id)}`);
  state.documentId = loadedDocument.id;
  state.title = loadedDocument.title;
  state.baseRevision = loadedDocument.current_revision;
  state.lines = String(loadedDocument.content || '').split('\n');
  state.caret = { line: 0, col: 0 };
  state.extraCarets = [];
  state.selection = null;
  state.dirty = false;
  state.query = '';
  state.matches = [];
  state.activeMatch = -1;
  document.getElementById('find-box').value = '';
  document.getElementById('replace-box').value = '';
  clearMessage();
  await loadRevisions();
  render();
}

async function loadRevisions() {
  const { revisions } = await api(`/api/documents/${encodeURIComponent(state.documentId)}/revisions`);
  document.getElementById('revision-list').innerHTML = revisions.map((rev) => `
    <div class="revision">
      <strong>Revision ${rev.revision}</strong><br>
      <span>${escapeHtml(rev.saved_at)}</span><br>
      <button type="button" onclick="previewRevision(${rev.revision})">Preview</button>
      <button type="button" onclick="restoreRevision(${rev.revision})">Restore Draft</button>
      <pre id="revision-preview-${rev.revision}" hidden></pre>
    </div>
  `).join('');
}

window.loadDocument = loadDocument;
window.previewRevision = async (revision) => {
  const { revision: row } = await api(`/api/documents/${encodeURIComponent(state.documentId)}/revisions/${revision}`);
  const pre = document.getElementById(`revision-preview-${revision}`);
  pre.hidden = !pre.hidden;
  pre.textContent = row.content.slice(0, 1200);
};

window.restoreRevision = async (revision) => {
  const { revision: row } = await api(`/api/documents/${encodeURIComponent(state.documentId)}/revisions/${revision}`);
  const preRestore = snapshot();
  state.lines = String(row.content || '').split('\n');
  state.caret = { line: 0, col: 0 };
  state.selection = null;
  state.extraCarets = [];
  state.preferredCol = 0;
  state.undo = [preRestore];
  state.redo = [];
  state.typingGroup = null;
  markDirty();
  recomputeMatches();
  render();
  message.textContent = `Revision ${revision} restored as unsaved draft. Use Undo to return to the pre-restore draft.`;
};

function snapshot() {
  return {
    lines: state.lines.slice(),
    caret: { ...state.caret },
    extraCarets: state.extraCarets.map((c) => ({ ...c })),
    selection: state.selection ? {
      anchor: { ...state.selection.anchor },
      head: { ...state.selection.head }
    } : null
  };
}

function restore(snap) {
  state.lines = snap.lines.slice();
  state.caret = { ...snap.caret };
  state.extraCarets = snap.extraCarets.map((c) => ({ ...c }));
  state.selection = snap.selection ? {
    anchor: { ...snap.selection.anchor },
    head: { ...snap.selection.head }
  } : null;
  state.typingGroup = null;
  clampCaret();
  markDirty();
  recomputeMatches();
  render();
}

function pushUndo() {
  state.undo.push(snapshot());
  if (state.undo.length > 150) state.undo.shift();
  state.redo = [];
  state.typingGroup = null;
}

function pushGroupedUndo() {
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

function textContent() {
  return state.lines.join('\n');
}

async function saveDocument() {
  clearMessage();
  if (!state.dirty) {
    message.textContent = 'No changes to save.';
    renderStatus();
    return;
  }
  try {
    const data = await api(`/api/documents/${encodeURIComponent(state.documentId)}/save`, {
      method: 'POST',
      body: JSON.stringify({
        documentId: state.documentId,
        baseRevision: state.baseRevision,
        content: textContent()
      })
    });
    state.baseRevision = data.revision;
    state.dirty = false;
    await loadDocuments();
    await loadRevisions();
    render();
  } catch (error) {
    message.textContent = error.status === 409
      ? `Save conflict: this tab is stale. Server is at revision ${error.data?.currentRevision ?? 'newer'}; your draft was not saved.`
      : error.message;
    message.scrollIntoView({ block: 'nearest' });
    renderStatus();
  }
}

function markDirty() {
  state.dirty = true;
}

function onPaste(event) {
  event.preventDefault();
  const text = (event.clipboardData?.getData('text/plain') || '').replace(/\r\n?/g, '\n');
  if (text) insertText(text);
}

function onKeyDown(event) {
  if (event.metaKey || event.ctrlKey) {
    const key = event.key.toLowerCase();
    if (key === 'f') {
      event.preventDefault();
      const findBox = document.getElementById('find-box');
      findBox.focus();
      findBox.select();
      return;
    }
    if (key === 'arrowleft' || key === 'arrowright') {
      event.preventDefault();
      moveCaretByWord(key === 'arrowleft' ? 'left' : 'right', event.shiftKey);
      return;
    }
    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (key === 'y') {
      event.preventDefault();
      redo();
      return;
    }
    if (key === 's') {
      event.preventDefault();
      saveDocument();
      return;
    }
    if (key === 'a') {
      event.preventDefault();
      selectAll();
      return;
    }
    if (key === 'c') {
      event.preventDefault();
      copySelection();
      return;
    }
    if (key === 'x') {
      event.preventDefault();
      cutSelection();
      return;
    }
    if (key === 'v') {
      event.preventDefault();
      pasteFromClipboard();
      return;
    }
  }

  const navKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
  if (navKeys.includes(event.key)) {
    event.preventDefault();
    moveCaret(event.key, event.shiftKey);
    return;
  }
  if (event.key === 'Backspace') {
    event.preventDefault();
    backspace();
    return;
  }
  if (event.key === 'Delete') {
    event.preventDefault();
    deleteForward();
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    insertText('\n');
    return;
  }
  if (event.key === 'Tab') {
    event.preventDefault();
    if (event.shiftKey) outdentCurrentLine();
    else insertText('  ');
    return;
  }
  if (event.key.length === 1 && !event.altKey) {
    event.preventDefault();
    insertText(event.key);
  }
}

function onMouseDown(event) {
  state.typingGroup = null;
  const pos = pointToPosition(event);
  if (!pos) return;
  event.preventDefault();
  editor.focus();
  if (event.altKey || event.ctrlKey || event.metaKey) {
    state.selection = null;
    const existing = [state.caret, ...state.extraCarets].map(normalizePos);
    const found = existing.findIndex((caret) => samePos(caret, pos));
    if (found >= 0) {
      existing.splice(found, 1);
    } else {
      existing.push({ ...pos });
    }
    const ordered = existing.sort(comparePos);
    state.caret = ordered[0] || pos;
    state.extraCarets = ordered.slice(1);
    state.preferredCol = state.caret.col;
    render();
    return;
  }
  if (event.detail >= 3) {
    state.extraCarets = [];
    const lineEnd = pos.line < state.lines.length - 1
      ? { line: pos.line + 1, col: 0 }
      : { line: pos.line, col: state.lines[pos.line].length };
    state.selection = {
      anchor: { line: pos.line, col: 0 },
      head: lineEnd
    };
    state.caret = { ...state.selection.head };
    state.preferredCol = state.caret.col;
    render();
    return;
  }
  if (event.detail === 2) {
    const range = wordRangeAt(pos);
    state.extraCarets = [];
    state.selection = { anchor: range.start, head: range.end };
    state.caret = { ...range.end };
    state.preferredCol = state.caret.col;
    render();
    return;
  }
  state.extraCarets = [];
  state.caret = pos;
  state.selection = null;
  state.preferredCol = pos.col;
  render();

  const anchor = { ...pos };
  let dragScrollTimer = null;
  let lastMouseEvent = null;
  const move = (moveEvent) => {
    lastMouseEvent = moveEvent;
    const head = pointToPosition(moveEvent) || edgePositionForDrag(moveEvent);
    if (head) {
      state.caret = head;
      state.selection = samePos(anchor, head) ? null : { anchor, head };
      render();
    }
  };
  const startAutoScroll = () => {
    if (dragScrollTimer) return;
    dragScrollTimer = window.setInterval(() => {
      if (!lastMouseEvent) return;
      const rect = editor.getBoundingClientRect();
      let delta = 0;
      if (lastMouseEvent.clientY > rect.bottom - 18) delta = 28;
      if (lastMouseEvent.clientY < rect.top + 18) delta = -28;
      if (!delta) return;
      editor.scrollTop += delta;
      const head = edgePositionForDrag(lastMouseEvent);
      if (head) {
        state.caret = head;
        state.selection = samePos(anchor, head) ? null : { anchor, head };
        render();
      }
    }, 35);
  };
  const up = () => {
    if (dragScrollTimer) window.clearInterval(dragScrollTimer);
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  startAutoScroll();
}

function edgePositionForDrag(event) {
  const rect = editor.getBoundingClientRect();
  const lineHeight = 22;
  let lineOffset = Math.floor((editor.scrollTop + event.clientY - rect.top) / lineHeight);
  if (event.clientY >= rect.bottom) {
    lineOffset = Math.floor((editor.scrollTop + editor.clientHeight - 1) / lineHeight);
  }
  if (event.clientY <= rect.top) {
    lineOffset = Math.floor(editor.scrollTop / lineHeight);
  }
  const line = Math.max(0, Math.min(state.lines.length - 1, lineOffset));
  const col = event.clientX < rect.left + 80 ? 0 : state.lines[line].length;
  return { line, col };
}

function wordRangeAt(pos) {
  const p = normalizePos(pos);
  const line = state.lines[p.line];
  if (!line) return { start: p, end: p };
  const isWord = (ch) => /[A-Za-z0-9_-]/.test(ch || '');
  let col = Math.min(p.col, Math.max(0, line.length - 1));
  if (!isWord(line[col]) && col > 0 && isWord(line[col - 1])) col -= 1;
  if (!isWord(line[col])) return { start: p, end: p };
  let start = col;
  let end = col + 1;
  while (start > 0 && isWord(line[start - 1])) start -= 1;
  while (end < line.length && isWord(line[end])) end += 1;
  return {
    start: { line: p.line, col: start },
    end: { line: p.line, col: end }
  };
}

function selectAll() {
  state.extraCarets = [];
  state.selection = {
    anchor: { line: 0, col: 0 },
    head: {
      line: state.lines.length - 1,
      col: state.lines[state.lines.length - 1].length
    }
  };
  state.caret = { ...state.selection.head };
  state.preferredCol = state.caret.col;
  render();
  scrollCaretIntoView();
}

function selectedText() {
  if (!state.selection || collapsedSelection()) return '';
  const { start, end } = selectionRange();
  if (start.line === end.line) {
    return state.lines[start.line].slice(start.col, end.col);
  }
  const parts = [];
  parts.push(state.lines[start.line].slice(start.col));
  for (let line = start.line + 1; line < end.line; line += 1) {
    parts.push(state.lines[line]);
  }
  parts.push(state.lines[end.line].slice(0, end.col));
  return parts.join('\n');
}

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
  window.__patchpadClipboard = text;
}

async function readClipboard() {
  try {
    if (navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      if (text) return text;
    }
  } catch {
    // Browser permission can block scripted clipboard reads; keep local fallback.
  }
  return window.__patchpadClipboard || '';
}

async function copySelection() {
  const text = selectedText();
  if (!text) return;
  await writeClipboard(text);
}

async function cutSelection() {
  const text = selectedText();
  if (!text) return;
  await writeClipboard(text);
  pushUndo();
  const { start, end } = selectionRange();
  state.caret = replaceRange(start, end, '');
  state.selection = null;
  state.extraCarets = [];
  state.preferredCol = state.caret.col;
  markDirty();
  recomputeMatches();
  render();
}

async function pasteFromClipboard() {
  const text = (await readClipboard()).replace(/\r\n?/g, '\n');
  if (text) insertText(text);
}

function pointToPosition(event) {
  const lineEl = event.target.closest?.('.line');
  if (!lineEl) return null;
  const line = Number(lineEl.dataset.line);
  const textEl = lineEl.querySelector('.text');
  const rect = textEl.getBoundingClientRect();
  const charWidth = measureCharWidth();
  const col = Math.max(0, Math.floor((event.clientX - rect.left - 10) / charWidth));
  return normalizePos({ line, col });
}

let cachedCharWidth = null;
function measureCharWidth() {
  if (cachedCharWidth) return cachedCharWidth;
  const probe = document.createElement('span');
  probe.textContent = 'mmmmmmmmmm';
  probe.style.visibility = 'hidden';
  probe.style.position = 'absolute';
  probe.style.font = getComputedStyle(editor).font;
  document.body.appendChild(probe);
  cachedCharWidth = probe.getBoundingClientRect().width / 10 || 8.4;
  probe.remove();
  return cachedCharWidth;
}

function insertText(text) {
  if (!text) return;
  const replacingSelection = state.selection && !collapsedSelection();
  const canGroupTyping = text.length === 1 && !state.selection;
  if (canGroupTyping) {
    const caretKey = caretGroupKey();
    if (!state.typingGroup || state.typingGroup.nextCaretKey !== caretKey) {
      pushGroupedUndo();
      state.typingGroup = { nextCaretKey: caretKey };
    }
  } else if (replacingSelection && text.length === 1) {
    pushGroupedUndo();
    state.typingGroup = { nextCaretKey: null };
  } else {
    pushUndo();
  }
  if (replacingSelection) {
    const range = selectionRange();
    state.caret = replaceRange(range.start, range.end, text);
    state.selection = null;
    state.extraCarets = [];
  } else if (state.extraCarets.length) {
    const carets = [state.caret, ...state.extraCarets]
      .map(normalizePos)
      .sort(comparePos)
      .filter((pos, index, arr) => index === 0 || !samePos(pos, arr[index - 1]));
    const advancedCarets = [];
    for (const pos of [...carets].sort((a, b) => comparePos(b, a))) {
      replaceRange(pos, pos, text);
      advancedCarets.push(advancePosition(pos, text));
    }
    const orderedAdvanced = advancedCarets.sort(comparePos);
    state.caret = orderedAdvanced[0];
    state.extraCarets = orderedAdvanced.slice(1);
  } else {
    const next = replaceRange(state.caret, state.caret, text);
    state.caret = next;
  }
  state.preferredCol = state.caret.col;
  if (canGroupTyping || (replacingSelection && text.length === 1)) {
    state.typingGroup.nextCaretKey = caretGroupKey();
  }
  markDirty();
  recomputeMatches();
  render();
}

function caretGroupKey(carets = [state.caret, ...state.extraCarets]) {
  return carets
    .map(normalizePos)
    .sort(comparePos)
    .filter((pos, index, arr) => index === 0 || !samePos(pos, arr[index - 1]))
    .map(pos => `${pos.line}:${pos.col}`)
    .join('|');
}

function backspace() {
  if (!state.selection && state.extraCarets.length) {
    deleteAcrossCarets('backward');
    return;
  }
  if (state.selection && !collapsedSelection()) {
    pushUndo();
    const { start, end } = selectionRange();
    state.caret = replaceRange(start, end, '');
    state.selection = null;
  } else if (state.caret.col > 0 || state.caret.line > 0) {
    pushUndo();
    const start = previousPosition(state.caret);
    state.caret = replaceRange(start, state.caret, '');
  } else {
    return;
  }
  state.extraCarets = [];
  state.preferredCol = state.caret.col;
  markDirty();
  recomputeMatches();
  render();
}

function deleteForward() {
  if (!state.selection && state.extraCarets.length) {
    deleteAcrossCarets('forward');
    return;
  }
  if (state.selection && !collapsedSelection()) {
    pushUndo();
    const { start, end } = selectionRange();
    state.caret = replaceRange(start, end, '');
    state.selection = null;
  } else {
    const next = nextPosition(state.caret);
    if (samePos(next, state.caret)) return;
    pushUndo();
    state.caret = replaceRange(state.caret, next, '');
  }
  state.extraCarets = [];
  state.preferredCol = state.caret.col;
  markDirty();
  recomputeMatches();
  render();
}

function deleteAcrossCarets(direction) {
  const carets = [state.caret, ...state.extraCarets]
    .map(normalizePos)
    .sort(comparePos)
    .filter((pos, index, arr) => index === 0 || !samePos(pos, arr[index - 1]));
  const ranges = [];
  for (const caret of carets) {
    const start = direction === 'backward' ? previousPosition(caret) : caret;
    const end = direction === 'backward' ? caret : nextPosition(caret);
    if (!samePos(start, end)) ranges.push({ start, end });
  }
  if (!ranges.length) return;

  // Drop overlapping duplicate ranges so two adjacent carets do not delete the
  // same character twice. Then apply from bottom to top so earlier positions
  // remain valid while later text changes.
  const merged = [];
  for (const range of ranges.sort((a, b) => comparePos(a.start, b.start))) {
    const last = merged[merged.length - 1];
    if (last && comparePos(range.start, last.end) < 0) {
      if (comparePos(last.end, range.end) < 0) last.end = range.end;
    } else {
      merged.push({ start: { ...range.start }, end: { ...range.end } });
    }
  }

  pushUndo();
  const nextCarets = [];
  for (const range of merged.sort((a, b) => comparePos(b.start, a.start))) {
    for (let index = 0; index < nextCarets.length; index += 1) {
      nextCarets[index] = transformPositionAfterDeletion(nextCarets[index], range.start, range.end);
    }
    nextCarets.push(replaceRange(range.start, range.end, ''));
  }
  const orderedCarets = nextCarets
    .map(normalizePos)
    .sort(comparePos)
    .filter((pos, index, arr) => index === 0 || !samePos(pos, arr[index - 1]));
  state.caret = orderedCarets[0] || normalizePos(merged[0].start);
  state.extraCarets = orderedCarets.slice(1);
  state.preferredCol = state.caret.col;
  markDirty();
  recomputeMatches();
  render();
}

function transformPositionAfterDeletion(posRaw, startRaw, endRaw) {
  const pos = normalizePos(posRaw);
  const start = normalizePos(startRaw);
  const end = normalizePos(endRaw);
  if (comparePos(pos, start) <= 0) return pos;
  if (comparePos(pos, end) <= 0) return { ...start };
  if (start.line === end.line) {
    if (pos.line === start.line) {
      return normalizePos({ line: pos.line, col: pos.col - (end.col - start.col) });
    }
    return pos;
  }
  const removedLines = end.line - start.line;
  if (pos.line === end.line) {
    return normalizePos({ line: start.line, col: start.col + (pos.col - end.col) });
  }
  return normalizePos({ line: pos.line - removedLines, col: pos.col });
}

function replaceRange(startRaw, endRaw, replacement) {
  const start = normalizePos(startRaw);
  const end = normalizePos(endRaw);
  if (comparePos(end, start) < 0) return replaceRange(end, start, replacement);
  const before = state.lines[start.line].slice(0, start.col);
  const after = state.lines[end.line].slice(end.col);
  const inserted = String(replacement).split('\n');
  const newLines = [];
  newLines.push(...state.lines.slice(0, start.line));
  if (inserted.length === 1) {
    newLines.push(before + inserted[0] + after);
  } else {
    newLines.push(before + inserted[0]);
    newLines.push(...inserted.slice(1, -1));
    newLines.push(inserted[inserted.length - 1] + after);
  }
  newLines.push(...state.lines.slice(end.line + 1));
  state.lines = newLines.length ? newLines : [''];
  return advancePosition(start, replacement);
}

function advancePosition(start, text) {
  const parts = String(text).split('\n');
  if (parts.length === 1) return normalizePos({ line: start.line, col: start.col + parts[0].length });
  return normalizePos({
    line: start.line + parts.length - 1,
    col: parts[parts.length - 1].length
  });
}

function moveCaret(key, selecting) {
  state.typingGroup = null;
  const old = { ...state.caret };
  let next = { ...state.caret };
  if (!selecting && state.selection && (key === 'ArrowLeft' || key === 'ArrowRight')) {
    const range = selectionRange();
    next = key === 'ArrowLeft' ? range.start : range.end;
  } else if (key === 'ArrowLeft') {
    next = previousPosition(state.caret);
    state.preferredCol = next.col;
  } else if (key === 'ArrowRight') {
    next = nextPosition(state.caret);
    state.preferredCol = next.col;
  } else if (key === 'Home') {
    next = { line: state.caret.line, col: 0 };
    state.preferredCol = 0;
  } else if (key === 'End') {
    next = { line: state.caret.line, col: state.lines[state.caret.line].length };
    state.preferredCol = next.col;
  } else if (key === 'ArrowUp' || key === 'ArrowDown') {
    const targetLine = key === 'ArrowUp'
      ? Math.max(0, state.caret.line - 1)
      : Math.min(state.lines.length - 1, state.caret.line + 1);
    const preferred = state.preferredCol ?? state.caret.col;
    next = { line: targetLine, col: Math.min(preferred, state.lines[targetLine].length) };
  }
  state.caret = normalizePos(next);
  state.extraCarets = [];
  if (selecting) {
    const anchor = state.selection?.anchor || old;
    state.selection = samePos(anchor, state.caret) ? null : { anchor, head: { ...state.caret } };
  } else {
    state.selection = null;
  }
  render();
  scrollCaretIntoView();
}

function moveCaretByWord(direction, selecting) {
  state.typingGroup = null;
  const old = { ...state.caret };
  const content = textContent();
  let index = positionToIndex(state.caret);
  if (!selecting && state.selection) {
    const range = selectionRange();
    index = positionToIndex(direction === 'left' ? range.start : range.end);
  }
  if (direction === 'right') {
    while (index < content.length && !/\s/.test(content[index])) index += 1;
    while (index < content.length && /\s/.test(content[index])) index += 1;
  } else {
    while (index > 0 && /\s/.test(content[index - 1])) index -= 1;
    while (index > 0 && !/\s/.test(content[index - 1])) index -= 1;
  }
  state.caret = indexToPosition(index);
  state.preferredCol = state.caret.col;
  state.extraCarets = [];
  if (selecting) {
    const anchor = state.selection?.anchor || old;
    state.selection = samePos(anchor, state.caret) ? null : { anchor, head: { ...state.caret } };
  } else {
    state.selection = null;
  }
  render();
  scrollCaretIntoView();
}

function outdentCurrentLine() {
  const line = state.caret.line;
  const current = state.lines[line];
  const removable = current.startsWith('\t') ? 1 : Math.min((current.match(/^ */)?.[0].length || 0), 2);
  if (!removable) return;
  pushUndo();
  state.lines[line] = current.slice(removable);
  state.caret.col = Math.max(0, state.caret.col - removable);
  state.selection = null;
  state.extraCarets = [];
  state.preferredCol = state.caret.col;
  markDirty();
  recomputeMatches();
  render();
}

function previousPosition(pos) {
  const p = normalizePos(pos);
  if (p.col > 0) return { line: p.line, col: previousGraphemeBoundary(state.lines[p.line], p.col) };
  if (p.line > 0) return { line: p.line - 1, col: state.lines[p.line - 1].length };
  return p;
}

function nextPosition(pos) {
  const p = normalizePos(pos);
  if (p.col < state.lines[p.line].length) return { line: p.line, col: nextGraphemeBoundary(state.lines[p.line], p.col) };
  if (p.line < state.lines.length - 1) return { line: p.line + 1, col: 0 };
  return p;
}

function previousGraphemeBoundary(text, index) {
  let previous = 0;
  for (const segment of graphemeSegmenter.segment(text)) {
    if (segment.index >= index) break;
    previous = segment.index;
  }
  return previous;
}

function nextGraphemeBoundary(text, index) {
  for (const segment of graphemeSegmenter.segment(text)) {
    if (segment.index > index) return segment.index;
  }
  return text.length;
}

function normalizePos(pos) {
  const line = Math.max(0, Math.min(state.lines.length - 1, Number(pos.line) || 0));
  const col = Math.max(0, Math.min(state.lines[line].length, Number(pos.col) || 0));
  return { line, col };
}

function clampCaret() {
  state.caret = normalizePos(state.caret);
}

function comparePos(a, b) {
  if (a.line !== b.line) return a.line - b.line;
  return a.col - b.col;
}

function samePos(a, b) {
  return a.line === b.line && a.col === b.col;
}

function offsetPosition(pos, offset) {
  let absolute = positionToIndex(pos) + offset;
  absolute = Math.max(0, Math.min(textContent().length, absolute));
  return indexToPosition(absolute);
}

function positionToIndex(pos) {
  const p = normalizePos(pos);
  let index = 0;
  for (let i = 0; i < p.line; i += 1) index += state.lines[i].length + 1;
  return index + p.col;
}

function indexToPosition(index) {
  let remaining = index;
  for (let line = 0; line < state.lines.length; line += 1) {
    if (remaining <= state.lines[line].length) return { line, col: remaining };
    remaining -= state.lines[line].length + 1;
  }
  const last = state.lines.length - 1;
  return { line: last, col: state.lines[last].length };
}

function selectionRange() {
  const anchor = normalizePos(state.selection.anchor);
  const head = normalizePos(state.selection.head);
  return comparePos(anchor, head) <= 0
    ? { start: anchor, end: head }
    : { start: head, end: anchor };
}

function collapsedSelection() {
  return !state.selection || samePos(state.selection.anchor, state.selection.head);
}

function recomputeMatches() {
  state.matches = [];
  const q = state.query;
  if (!q) return;
  for (let line = 0; line < state.lines.length; line += 1) {
    let from = 0;
    while (from <= state.lines[line].length) {
      const col = state.lines[line].indexOf(q, from);
      if (col < 0) break;
      state.matches.push({ line, col, endCol: col + q.length });
      from = col + Math.max(q.length, 1);
    }
  }
  if (state.activeMatch >= state.matches.length) state.activeMatch = -1;
}

function findNext() {
  state.query = document.getElementById('find-box').value;
  recomputeMatches();
  if (!state.matches.length) {
    state.activeMatch = -1;
    render();
    return;
  }
  state.activeMatch = (state.activeMatch + 1) % state.matches.length;
  const match = state.matches[state.activeMatch];
  state.selection = {
    anchor: { line: match.line, col: match.col },
    head: { line: match.line, col: match.endCol }
  };
  state.caret = { line: match.line, col: match.endCol };
  state.extraCarets = [];
  render();
  scrollCaretIntoView();
}

function findPrevious() {
  state.query = document.getElementById('find-box').value;
  recomputeMatches();
  if (!state.matches.length) {
    state.activeMatch = -1;
    render();
    return;
  }
  state.activeMatch = state.activeMatch <= 0 ? state.matches.length - 1 : state.activeMatch - 1;
  const match = state.matches[state.activeMatch];
  state.selection = {
    anchor: { line: match.line, col: match.col },
    head: { line: match.line, col: match.endCol }
  };
  state.caret = { line: match.line, col: match.endCol };
  state.extraCarets = [];
  render();
  scrollCaretIntoView();
}

function replaceCurrent() {
  if (!state.matches.length || state.activeMatch < 0) return;
  const match = state.matches[state.activeMatch];
  const replacement = document.getElementById('replace-box').value;
  pushUndo();
  state.caret = replaceRange(
    { line: match.line, col: match.col },
    { line: match.line, col: match.endCol },
    replacement
  );
  state.selection = null;
  markDirty();
  recomputeMatches();
  render();
}

function replaceAll() {
  state.query = document.getElementById('find-box').value;
  const replacement = document.getElementById('replace-box').value;
  recomputeMatches();
  if (!state.query || !state.matches.length) return;
  pushUndo();
  const next = state.lines.map((line) => line.split(state.query).join(replacement));
  state.lines = next;
  state.caret = { line: 0, col: 0 };
  state.selection = null;
  state.extraCarets = [];
  state.activeMatch = -1;
  markDirty();
  recomputeMatches();
  render();
}

function render() {
  if (!state.lines.length) {
    editor.innerHTML = '<div class="line"><div class="gutter">1</div><div class="text">Loading document...</div></div>';
    return;
  }
  document.getElementById('doc-title').textContent = state.title || 'PatchPad';
  document.getElementById('revision-label').textContent = `Revision ${state.baseRevision}`;
  document.getElementById('cursor-label').textContent = `Ln ${state.caret.line + 1}, Col ${state.caret.col + 1}`;
  renderStatus();

  const fragment = document.createDocumentFragment();
  const range = state.selection && !collapsedSelection() ? selectionRange() : null;
  const caretSet = [state.caret, ...state.extraCarets].map(normalizePos);

  for (let lineIndex = 0; lineIndex < state.lines.length; lineIndex += 1) {
    const row = document.createElement('div');
    row.className = 'line';
    row.dataset.line = String(lineIndex);

    const gutter = document.createElement('div');
    gutter.className = 'gutter';
    gutter.textContent = String(lineIndex + 1);

    const text = document.createElement('div');
    text.className = 'text';
    text.dataset.lineText = state.lines[lineIndex];
    text.innerHTML = renderLine(lineIndex, range, caretSet);

    row.append(gutter, text);
    fragment.append(row);
  }
  editor.replaceChildren(fragment);
}

function renderStatus() {
  const count = state.query ? `${state.matches.length} matches` : 'No active search';
  const mode = state.dirty ? 'Dirty' : 'Saved';
  document.getElementById('save-state').textContent = `${mode} | ${count}`;
  document.getElementById('save-btn').disabled = !state.dirty;
}


function renderLine(lineIndex, selectionRangeValue, caretSet) {
  const line = state.lines[lineIndex];
  const points = new Set([0, line.length]);
  for (const caret of caretSet) {
    if (caret.line === lineIndex) points.add(caret.col);
  }
  if (selectionRangeValue) {
    const start = selectionRangeValue.start.line === lineIndex ? selectionRangeValue.start.col
      : selectionRangeValue.start.line < lineIndex && lineIndex < selectionRangeValue.end.line ? 0
        : null;
    const end = selectionRangeValue.end.line === lineIndex ? selectionRangeValue.end.col
      : selectionRangeValue.start.line < lineIndex && lineIndex < selectionRangeValue.end.line ? line.length
        : null;
    if (start !== null && end !== null) {
      points.add(start);
      points.add(end);
    }
  }
  for (const match of state.matches) {
    if (match.line === lineIndex) {
      points.add(match.col);
      points.add(match.endCol);
    }
  }
  const sorted = [...points].sort((a, b) => a - b);
  let html = '';
  for (let i = 0; i < sorted.length; i += 1) {
    const col = sorted[i];
    for (const caret of caretSet) {
      if (caret.line === lineIndex && caret.col === col) {
        html += `<span class="caret ${caret === state.caret ? '' : 'multi-caret'}"></span>`;
      }
    }
    const next = sorted[i + 1];
    if (next === undefined || next === col) continue;
    const text = line.slice(col, next);
    const classes = [];
    if (isSelected(lineIndex, col, next, selectionRangeValue)) classes.push('selection');
    const hitIndex = state.matches.findIndex((m) => m.line === lineIndex && m.col <= col && m.endCol >= next);
    if (hitIndex >= 0) classes.push(hitIndex === state.activeMatch ? 'find-hit active-hit' : 'find-hit');
    html += classes.length
      ? `<span class="${classes.join(' ')}">${escapeHtml(text)}</span>`
      : escapeHtml(text);
  }
  if (line.length) return html;
  const emptySelected = selectionRangeValue && isSelected(lineIndex, 0, 1, selectionRangeValue);
  const emptyCaret = caretSet.some((c) => c.line === lineIndex && c.col === 0);
  if (emptySelected && !emptyCaret) return '<span class="selection">&nbsp;</span>';
  return html || '&nbsp;';
}

function isSelected(line, startCol, endCol, range) {
  if (!range) return false;
  const startIndex = positionToIndex({ line, col: startCol });
  const endIndex = positionToIndex({ line, col: endCol });
  return startIndex < positionToIndex(range.end) && endIndex > positionToIndex(range.start);
}

function scrollCaretIntoView() {
  const row = editor.querySelector(`.line[data-line="${state.caret.line}"]`);
  row?.scrollIntoView({ block: 'nearest' });
}

function clearMessage() {
  message.textContent = '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

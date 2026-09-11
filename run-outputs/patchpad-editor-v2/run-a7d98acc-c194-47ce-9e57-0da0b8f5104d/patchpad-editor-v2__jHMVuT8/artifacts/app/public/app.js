const $ = (selector) => document.querySelector(selector);

const state = {
  documents: [],
  activeDocumentId: null,
  documentMeta: null,
  revisions: [],
  selectedRevision: null,
  previewRevision: null,
  text: '',
  savedText: '',
  baseRevision: 1,
  currentRevision: 1,
  saveMode: 'loading',
  message: 'Loading PatchPad…',
  messageType: '',
  selection: { start: 0, end: 0 },
  carets: [],
  undoStack: [],
  redoStack: [],
  drag: null,
  clipboardSelection: null,
  findQuery: '',
  replaceQuery: '',
  findMatchIndex: -1,
  matches: [],
  metrics: { charWidth: 8, lineHeight: 22, gutterWidth: 72 },
  renderScheduled: false,
  saveToken: 0,
  typingGroup: null,
};

const elements = {
  documentMeta: $('#documentMeta'),
  documentList: $('#documentList'),
  saveButton: $('#saveButton'),
  undoButton: $('#undoButton'),
  redoButton: $('#redoButton'),
  findInput: $('#findInput'),
  replaceInput: $('#replaceInput'),
  findPrevButton: $('#findPrevButton'),
  findNextButton: $('#findNextButton'),
  replaceCurrentButton: $('#replaceCurrentButton'),
  replaceAllButton: $('#replaceAllButton'),
  editorViewport: $('#editorViewport'),
  cursorInfo: $('#cursorInfo'),
  saveInfo: $('#saveInfo'),
  statusLine: $('#statusLine'),
  historySummary: $('#historySummary'),
  revisionHistory: $('#revisionHistory'),
  previewLabel: $('#previewLabel'),
  revisionPreview: $('#revisionPreview'),
  restoreRevisionButton: $('#restoreRevisionButton'),
  messageBanner: $('#messageBanner'),
};

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
const wordSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', { granularity: 'word' }) : null;

function scheduleRender() {
  if (state.renderScheduled) return;
  state.renderScheduled = true;
  requestAnimationFrame(() => {
    state.renderScheduled = false;
    render();
  });
}

function setMessage(text, type = '') {
  state.message = text;
  state.messageType = type;
  scheduleRender();
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function splitLines(text) {
  return text.split('\n');
}

function getLineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRange(start, end) {
  return start <= end ? { start, end } : { start: end, end: start };
}

function getGraphemeBoundaries(text) {
  if (!text) return [0];
  if (!segmenter) return Array.from({ length: text.length + 1 }, (_, i) => i);
  const boundaries = [0];
  for (const part of segmenter.segment(text)) {
    boundaries.push(part.index + part.segment.length);
  }
  return boundaries;
}

function prevGraphemeBoundary(text, offset) {
  if (offset <= 0) return 0;
  const boundaries = getGraphemeBoundaries(text);
  for (let i = boundaries.length - 1; i >= 0; i -= 1) {
    if (boundaries[i] < offset) return boundaries[i];
  }
  return 0;
}

function nextGraphemeBoundary(text, offset) {
  if (offset >= text.length) return text.length;
  const boundaries = getGraphemeBoundaries(text);
  for (const boundary of boundaries) {
    if (boundary > offset) return boundary;
  }
  return text.length;
}

function graphemeCount(text) {
  if (!text) return 0;
  if (!segmenter) return text.length;
  let count = 0;
  for (const _ of segmenter.segment(text)) count += 1;
  return count;
}

function lineIndexAndColumn(text, offset) {
  const safeOffset = clamp(offset, 0, text.length);
  const starts = getLineStarts(text);
  let lineIndex = 0;
  for (let i = 0; i < starts.length; i += 1) {
    if (starts[i] <= safeOffset) lineIndex = i;
    else break;
  }
  const lineStart = starts[lineIndex];
  const lineEnd = lineIndex + 1 < starts.length ? starts[lineIndex + 1] - 1 : text.length;
  const lineText = text.slice(lineStart, lineEnd);
  const prefix = text.slice(lineStart, safeOffset);
  return { lineIndex, column: graphemeCount(prefix), lineStart, lineEnd, lineText };
}

function offsetFromLineColumn(text, lineIndex, column) {
  const lines = splitLines(text);
  const starts = getLineStarts(text);
  const clampedLine = clamp(lineIndex, 0, lines.length - 1);
  const lineText = lines[clampedLine] || '';
  const boundaries = getGraphemeBoundaries(lineText);
  const graphemeLimit = boundaries.length - 1;
  const clampedColumn = clamp(column, 0, graphemeLimit);
  return starts[clampedLine] + boundaries[clampedColumn];
}

function findWordBoundary(text, offset, direction) {
  if (!text.length) return 0;
  if (!wordSegmenter) {
    const regex = /\w+/g;
    const matches = [...text.matchAll(regex)];
    if (direction > 0) {
      for (const match of matches) {
        const start = match.index;
        const end = start + match[0].length;
        if (end > offset) return start > offset ? start : end;
      }
      return text.length;
    }
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      const start = matches[i].index;
      if (start < offset) return start;
    }
    return 0;
  }
  const segments = [...wordSegmenter.segment(text)];
  if (direction > 0) {
    for (const seg of segments) {
      const start = seg.index;
      const end = start + seg.segment.length;
      if (end > offset && seg.isWordLike) return start > offset ? start : end;
      if (start > offset && seg.isWordLike) return start;
    }
    return text.length;
  }
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const seg = segments[i];
    if (seg.index < offset && seg.isWordLike) return seg.index;
  }
  return 0;
}

function currentSelectionRange() {
  if (state.carets.length > 1) return null;
  const range = state.selection;
  if (!range) return null;
  return normalizeRange(range.start, range.end);
}

function hasSelection() {
  const range = currentSelectionRange();
  return !!range && range.start !== range.end;
}

function setSelection(start, end = start) {
  state.selection = normalizeRange(clamp(start, 0, state.text.length), clamp(end, 0, state.text.length));
  state.carets = [];
  state.drag = null;
  scheduleRender();
}

function setCaret(offset) {
  const safe = clamp(offset, 0, state.text.length);
  state.selection = { start: safe, end: safe };
  state.carets = [];
  state.drag = null;
  scheduleRender();
}

function setMultipleCarets(offsets) {
  state.carets = offsets.map((offset) => ({ start: clamp(offset, 0, state.text.length), end: clamp(offset, 0, state.text.length) }));
  if (state.carets.length === 0) state.carets = [{ start: 0, end: 0 }];
  state.selection = { start: state.carets[0].start, end: state.carets[0].end };
  scheduleRender();
}

function orderedRangesDescending(ranges) {
  return ranges
    .map((range) => normalizeRange(range.start, range.end))
    .sort((a, b) => b.start - a.start || b.end - a.end);
}

function replaceRangesWithText(text, ranges, insertedText) {
  let result = text;
  const sorted = orderedRangesDescending(ranges);
  for (const range of sorted) {
    result = result.slice(0, range.start) + insertedText + result.slice(range.end);
  }
  return result;
}

function applySelectionReplacement(insertedText) {
  const range = currentSelectionRange();
  if (!range) return false;
  state.text = state.text.slice(0, range.start) + insertedText + state.text.slice(range.end);
  const caret = range.start + insertedText.length;
  state.selection = { start: caret, end: caret };
  state.carets = [];
  return true;
}

function captureUndoSnapshot() {
  return {
    text: state.text,
    selection: { ...state.selection },
    carets: state.carets.map((range) => ({ ...range })),
    baseRevision: state.baseRevision,
    currentRevision: state.currentRevision,
    savedText: state.savedText,
  };
}

function finalizeTypingGroup() {
  state.typingGroup = null;
}

function recordEdit(kind = 'edit') {
  if (kind === 'typing') {
    const now = Date.now();
    if (state.typingGroup && now - state.typingGroup.startedAt < 900) {
      state.typingGroup.startedAt = now;
      return;
    }
    finalizeTypingGroup();
    state.undoStack.push(captureUndoSnapshot());
    state.redoStack = [];
    state.typingGroup = { startedAt: now };
    return;
  }
  finalizeTypingGroup();
  state.undoStack.push(captureUndoSnapshot());
  state.redoStack = [];
}

function restoreSnapshot(snapshot) {
  state.text = snapshot.text;
  state.selection = { ...snapshot.selection };
  state.carets = snapshot.carets.map((range) => ({ ...range }));
  state.baseRevision = snapshot.baseRevision;
  state.currentRevision = snapshot.currentRevision;
  state.savedText = snapshot.savedText;
  state.drag = null;
  refreshFindMatches();
  updateDocumentDerivedState();
  scheduleRender();
}

function undo() {
  finalizeTypingGroup();
  const snapshot = state.undoStack.pop();
  if (!snapshot) return;
  state.redoStack.push(captureUndoSnapshot());
  restoreSnapshot(snapshot);
  setMessage('Undid the last edit.', 'success');
}

function redo() {
  finalizeTypingGroup();
  const snapshot = state.redoStack.pop();
  if (!snapshot) return;
  state.undoStack.push(captureUndoSnapshot());
  restoreSnapshot(snapshot);
  setMessage('Redid the last edit.', 'success');
}

function moveSelectionTo(offset, extend = false) {
  const safe = clamp(offset, 0, state.text.length);
  if (extend) {
    state.selection.end = safe;
    state.carets = [];
  } else {
    state.selection = { start: safe, end: safe };
    state.carets = [];
  }
  scheduleRender();
}

function textFromSelection() {
  const range = currentSelectionRange();
  if (!range || range.start === range.end) return '';
  return state.text.slice(range.start, range.end);
}

function deleteSelectionIfNeeded() {
  const range = currentSelectionRange();
  if (range && range.start !== range.end) {
    state.text = state.text.slice(0, range.start) + state.text.slice(range.end);
    state.selection = { start: range.start, end: range.start };
    return true;
  }
  return false;
}

function insertText(textToInsert, { typing = false } = {}) {
  if (!typing) recordEdit('edit');
  else recordEdit('typing');
  const selectionRange = currentSelectionRange();
  if (selectionRange && selectionRange.start !== selectionRange.end) {
    state.text = state.text.slice(0, selectionRange.start) + textToInsert + state.text.slice(selectionRange.end);
    const caret = selectionRange.start + textToInsert.length;
    state.selection = { start: caret, end: caret };
    state.carets = [];
  } else if (state.carets.length > 1) {
    const ranges = state.carets.map((range) => ({ start: range.start, end: range.end }));
    let nextText = state.text;
    const sorted = ranges.sort((a, b) => b.start - a.start || b.end - a.end);
    for (const range of sorted) {
      nextText = nextText.slice(0, range.start) + textToInsert + nextText.slice(range.end);
    }
    state.text = nextText;
    const nextPositions = ranges.map((range) => ({ start: range.start + textToInsert.length, end: range.start + textToInsert.length }));
    state.carets = nextPositions.sort((a, b) => a.start - b.start);
    state.selection = { ...state.carets[0] };
  } else {
    const caret = state.selection.end;
    state.text = state.text.slice(0, caret) + textToInsert + state.text.slice(caret);
    const nextCaret = caret + textToInsert.length;
    state.selection = { start: nextCaret, end: nextCaret };
  }
  markDirty();
  refreshFindMatches();
  updateDocumentDerivedState();
  scheduleRender();
}

function deleteByDirection(direction) {
  recordEdit('edit');
  const selectionRange = currentSelectionRange();
  if (selectionRange && selectionRange.start !== selectionRange.end) {
    state.text = state.text.slice(0, selectionRange.start) + state.text.slice(selectionRange.end);
    state.selection = { start: selectionRange.start, end: selectionRange.start };
    state.carets = [];
  } else if (state.carets.length > 1) {
    const ranges = [];
    for (const caret of state.carets) {
      const offset = caret.start;
      if (direction < 0 && offset === 0) continue;
      const start = direction < 0 ? prevGraphemeBoundary(state.text, offset) : offset;
      const end = direction < 0 ? offset : nextGraphemeBoundary(state.text, offset);
      if (start === end) continue;
      ranges.push({ start, end });
    }
    if (ranges.length === 0) return;
    state.text = replaceRangesWithText(state.text, ranges, '');
    const positions = ranges.map((range) => ({ start: range.start, end: range.start }));
    state.carets = positions.sort((a, b) => a.start - b.start);
    state.selection = { ...state.carets[0] };
  } else {
    const offset = state.selection.end;
    if (direction < 0 && offset === 0) return;
    const start = direction < 0 ? prevGraphemeBoundary(state.text, offset) : offset;
    const end = direction < 0 ? offset : nextGraphemeBoundary(state.text, offset);
    if (start === end) return;
    state.text = state.text.slice(0, start) + state.text.slice(end);
    state.selection = { start, end: start };
  }
  markDirty();
  refreshFindMatches();
  updateDocumentDerivedState();
  scheduleRender();
}

function indentSelection(outdent = false) {
  recordEdit('edit');
  const range = currentSelectionRange();
  const lines = splitLines(state.text);
  const lineStarts = getLineStarts(state.text);
  let startLine = 0;
  let endLine = lines.length - 1;
  if (range) {
    startLine = lineIndexAndColumn(state.text, range.start).lineIndex;
    const rangeEnd = Math.max(range.end, range.start);
    endLine = lineIndexAndColumn(state.text, Math.max(rangeEnd - 1, 0)).lineIndex;
  } else {
    const caretLine = lineIndexAndColumn(state.text, state.selection.end).lineIndex;
    startLine = endLine = caretLine;
  }
  const affected = [];
  for (let i = startLine; i <= endLine; i += 1) {
    affected.push(i);
  }
  let delta = 0;
  let nextText = state.text;
  for (const lineIndex of affected.slice().reverse()) {
    const start = lineStarts[lineIndex];
    if (outdent) {
      if (nextText.slice(start, start + 1) === '\t') {
        nextText = nextText.slice(0, start) + nextText.slice(start + 1);
        delta -= 1;
      } else if (nextText.slice(start, start + 2) === '  ') {
        nextText = nextText.slice(0, start) + nextText.slice(start + 2);
        delta -= 2;
      }
    } else {
      nextText = nextText.slice(0, start) + '\t' + nextText.slice(start);
      delta += 1;
    }
  }
  state.text = nextText;
  if (range) {
    state.selection = { start: range.start + delta, end: range.end + delta };
  } else {
    const caret = state.selection.end + delta;
    state.selection = { start: caret, end: caret };
  }
  markDirty();
  refreshFindMatches();
  updateDocumentDerivedState();
  scheduleRender();
}

function moveCaret(direction, { byWord = false, byLine = false, select = false } = {}) {
  finalizeTypingGroup();
  const text = state.text;
  const anchor = state.selection.start;
  const focus = state.selection.end;
  let next = focus;
  if (byWord) {
    next = findWordBoundary(text, focus, direction);
  } else if (byLine) {
    const info = lineIndexAndColumn(text, focus);
    const lines = splitLines(text);
    const targetLine = clamp(info.lineIndex + direction, 0, lines.length - 1);
    next = offsetFromLineColumn(text, targetLine, info.column);
  } else {
    next = direction < 0 ? prevGraphemeBoundary(text, focus) : nextGraphemeBoundary(text, focus);
  }
  if (select) state.selection = { start: anchor, end: next };
  else state.selection = { start: next, end: next };
  state.carets = [];
  scheduleRender();
}

function moveToLineBoundary(direction, select = false) {
  finalizeTypingGroup();
  const info = lineIndexAndColumn(state.text, state.selection.end);
  const target = direction < 0 ? info.lineStart : info.lineEnd;
  if (select) state.selection = { start: state.selection.start, end: target };
  else state.selection = { start: target, end: target };
  state.carets = [];
  scheduleRender();
}

function moveToDocumentBoundary(direction, select = false) {
  finalizeTypingGroup();
  const target = direction < 0 ? 0 : state.text.length;
  if (select) state.selection = { start: state.selection.start, end: target };
  else state.selection = { start: target, end: target };
  state.carets = [];
  scheduleRender();
}

function selectAll() {
  state.selection = { start: 0, end: state.text.length };
  state.carets = [];
  scheduleRender();
}

function replaceCurrent() {
  const selectionText = textFromSelection();
  if (!selectionText) {
    findNext();
    return;
  }
  insertText(elements.replaceInput.value, { typing: false });
  setMessage('Replaced the current match.', 'success');
}

function replaceAll() {
  if (!state.findQuery) {
    setMessage('Enter a find query first.', 'warning');
    return;
  }
  const count = state.matches.length;
  if (!count) {
    setMessage('No matches to replace.', 'warning');
    return;
  }
  recordEdit('edit');
  const replacement = elements.replaceInput.value;
  const ranges = [...state.matches].sort((a, b) => b.start - a.start || b.end - a.end);
  let nextText = state.text;
  for (const match of ranges) {
    nextText = nextText.slice(0, match.start) + replacement + nextText.slice(match.end);
  }
  state.text = nextText;
  state.selection = { start: 0, end: 0 };
  state.carets = [];
  markDirty();
  refreshFindMatches();
  updateDocumentDerivedState();
  setMessage(`Replaced ${count} matches.`, 'success');
  scheduleRender();
}

function refreshFindMatches() {
  const query = state.findQuery;
  state.matches = [];
  state.findMatchIndex = -1;
  if (!query) return;
  let index = 0;
  while (index <= state.text.length) {
    const found = state.text.indexOf(query, index);
    if (found === -1) break;
    state.matches.push({ start: found, end: found + query.length });
    index = found + Math.max(1, query.length);
  }
  if (state.matches.length) {
    const selection = currentSelectionRange();
    if (selection) {
      const idx = state.matches.findIndex((range) => range.start === selection.start && range.end === selection.end);
      state.findMatchIndex = idx >= 0 ? idx : 0;
    } else {
      state.findMatchIndex = 0;
    }
  }
}

function selectMatch(index) {
  if (!state.matches.length) return;
  const normalized = ((index % state.matches.length) + state.matches.length) % state.matches.length;
  const match = state.matches[normalized];
  state.findMatchIndex = normalized;
  setSelection(match.start, match.end);
  ensureRangeVisible(match.start, match.end);
}

function findNext() {
  if (!state.matches.length) {
    refreshFindMatches();
  }
  if (!state.matches.length) {
    setMessage('No matches found.', 'warning');
    return;
  }
  const current = state.findMatchIndex >= 0 ? state.findMatchIndex : -1;
  selectMatch(current + 1);
  setMessage(`Match ${state.findMatchIndex + 1} of ${state.matches.length}.`, 'success');
}

function findPrevious() {
  if (!state.matches.length) {
    refreshFindMatches();
  }
  if (!state.matches.length) {
    setMessage('No matches found.', 'warning');
    return;
  }
  const current = state.findMatchIndex >= 0 ? state.findMatchIndex : 0;
  selectMatch(current - 1);
  setMessage(`Match ${state.findMatchIndex + 1} of ${state.matches.length}.`, 'success');
}

function updateFindFromInput() {
  state.findQuery = elements.findInput.value;
  refreshFindMatches();
  if (state.findQuery && state.matches.length) {
    selectMatch(0);
    setMessage(`Found ${state.matches.length} matches.`, 'success');
  } else if (state.findQuery) {
    setMessage('No matches found.', 'warning');
  } else {
    setMessage('Find cleared.', '');
    state.findMatchIndex = -1;
  }
  scheduleRender();
}

function markDirty() {
  state.saveMode = state.text === state.savedText ? 'saved' : 'dirty';
  if (state.saveMode === 'dirty' && state.messageType !== 'error') {
    state.message = 'Unsaved changes';
  }
}

function updateDocumentDerivedState() {
  if (state.saveMode !== 'saving') {
    state.saveMode = state.text === state.savedText ? 'saved' : 'dirty';
  }
  const info = lineIndexAndColumn(state.text, state.selection.end);
  elements.cursorInfo.textContent = `Line ${info.lineIndex + 1}, Column ${info.column + 1}`;
  const caretCount = state.carets.length > 1 ? `${state.carets.length} carets` : '1 caret';
  elements.saveInfo.textContent = `${state.saveMode === 'saved' ? 'Saved' : state.saveMode === 'saving' ? 'Saving' : 'Unsaved'} · Revision ${state.currentRevision} · ${caretCount}`;
  if (state.saveMode === 'saving') {
    elements.statusLine.textContent = `Saving revision ${state.baseRevision}…`;
  } else {
    elements.statusLine.textContent = state.saveMode === 'saved' ? `Revision ${state.currentRevision} is saved.` : `Editing revision ${state.baseRevision}.`;
  }
  elements.historySummary.textContent = `${state.revisions.length} revision${state.revisions.length === 1 ? '' : 's'}`;
}

function ensureRangeVisible(start, end) {
  const viewport = elements.editorViewport;
  const range = normalizeRange(start, end);
  const startInfo = lineIndexAndColumn(state.text, range.start);
  const endInfo = lineIndexAndColumn(state.text, Math.max(range.end - 1, range.start));
  const top = startInfo.lineIndex * state.metrics.lineHeight;
  const bottom = (endInfo.lineIndex + 1) * state.metrics.lineHeight;
  if (top < viewport.scrollTop) viewport.scrollTop = Math.max(0, top - state.metrics.lineHeight * 2);
  if (bottom > viewport.scrollTop + viewport.clientHeight) {
    viewport.scrollTop = Math.max(0, bottom - viewport.clientHeight + state.metrics.lineHeight * 2);
  }
  const left = state.metrics.gutterWidth + startInfo.column * state.metrics.charWidth;
  const right = state.metrics.gutterWidth + endInfo.column * state.metrics.charWidth;
  if (left < viewport.scrollLeft + state.metrics.gutterWidth) {
    viewport.scrollLeft = Math.max(0, left - state.metrics.gutterWidth - 40);
  } else if (right > viewport.scrollLeft + viewport.clientWidth - 40) {
    viewport.scrollLeft = Math.max(0, right - viewport.clientWidth + 60);
  }
}

function getOffsetFromPoint(clientX, clientY) {
  const rect = elements.editorViewport.getBoundingClientRect();
  const x = clientX - rect.left + elements.editorViewport.scrollLeft - state.metrics.gutterWidth;
  const y = clientY - rect.top + elements.editorViewport.scrollTop;
  const lineIndex = clamp(Math.floor(y / state.metrics.lineHeight), 0, splitLines(state.text).length - 1);
  const lineText = splitLines(state.text)[lineIndex] || '';
  const graphemes = [...(segmenter ? segmenter.segment(lineText) : Array.from(lineText).map((segment, index) => ({ segment, index })) )];
  if (!graphemes.length) {
    return offsetFromLineColumn(state.text, lineIndex, 0);
  }
  const approxColumn = clamp(Math.round(x / state.metrics.charWidth), 0, graphemes.length);
  return offsetFromLineColumn(state.text, lineIndex, approxColumn);
}

function selectWordAtOffset(offset) {
  const before = state.text.slice(0, offset);
  const after = state.text.slice(offset);
  let start = offset;
  let end = offset;
  if (before) {
    const left = findWordBoundary(state.text, offset, -1);
    const right = findWordBoundary(state.text, offset, 1);
    start = left;
    end = right === offset ? nextGraphemeBoundary(state.text, offset) : right;
  } else {
    end = nextGraphemeBoundary(state.text, offset);
  }
  if (start === end) end = nextGraphemeBoundary(state.text, start);
  setSelection(start, end);
  ensureRangeVisible(start, end);
}

function selectLineAtOffset(offset) {
  const info = lineIndexAndColumn(state.text, offset);
  setSelection(info.lineStart, info.lineEnd);
  ensureRangeVisible(info.lineStart, info.lineEnd);
}

function handleMouseDown(event) {
  if (!state.text) return;
  elements.editorViewport.focus();
  const offset = getOffsetFromPoint(event.clientX, event.clientY);
  if (event.altKey || event.ctrlKey || event.metaKey) {
    const carets = state.carets.length > 0 ? state.carets.map((range) => range.start) : [state.selection.end];
    carets.push(offset);
    setMultipleCarets(carets);
    setMessage(`Added caret ${carets.length}.`, 'success');
    event.preventDefault();
    return;
  }
  if (event.detail >= 3) {
    selectLineAtOffset(offset);
  } else if (event.detail === 2) {
    selectWordAtOffset(offset);
  } else if (event.shiftKey) {
    state.selection.end = offset;
    state.carets = [];
    scheduleRender();
  } else {
    setCaret(offset);
  }
  state.drag = { anchor: offset, active: true, line: lineIndexAndColumn(state.text, offset).lineIndex };
  event.preventDefault();
}

function handleMouseMove(event) {
  if (!state.drag || !state.drag.active) return;
  const offset = getOffsetFromPoint(event.clientX, event.clientY);
  state.selection = { start: state.drag.anchor, end: offset };
  state.carets = [];
  ensureRangeVisible(state.selection.start, state.selection.end);
  scheduleRender();
}

function handleMouseUp() {
  if (state.drag) state.drag.active = false;
}

function handleCopy(event) {
  const selectionText = textFromSelection();
  if (!selectionText) return;
  event.clipboardData.setData('text/plain', selectionText);
  event.preventDefault();
}

function handleCut(event) {
  const selectionText = textFromSelection();
  if (!selectionText) return;
  event.clipboardData.setData('text/plain', selectionText);
  recordEdit('edit');
  deleteSelectionIfNeeded();
  markDirty();
  refreshFindMatches();
  updateDocumentDerivedState();
  scheduleRender();
  event.preventDefault();
}

function handlePaste(event) {
  const text = event.clipboardData.getData('text/plain');
  if (typeof text !== 'string') return;
  insertText(text, { typing: false });
  event.preventDefault();
}

function handleKeyDown(event) {
  if (event.metaKey || event.ctrlKey) {
    const key = event.key.toLowerCase();
    if (key === 's') {
      event.preventDefault();
      saveDocument();
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
    if (key === 'f') {
      event.preventDefault();
      elements.findInput.focus();
      elements.findInput.select();
      return;
    }
    if (key === 'a') {
      event.preventDefault();
      selectAll();
      return;
    }
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    elements.findInput.focus();
    return;
  }

  if (event.key === 'Tab') {
    event.preventDefault();
    indentSelection(event.shiftKey);
    return;
  }

  if (event.key === 'Backspace') {
    event.preventDefault();
    deleteByDirection(-1);
    return;
  }

  if (event.key === 'Delete') {
    event.preventDefault();
    deleteByDirection(1);
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    insertText('\n', { typing: true });
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    if (event.metaKey || event.ctrlKey) moveCaret(-1, { byWord: true, select: event.shiftKey });
    else moveCaret(-1, { select: event.shiftKey });
    return;
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    if (event.metaKey || event.ctrlKey) moveCaret(1, { byWord: true, select: event.shiftKey });
    else moveCaret(1, { select: event.shiftKey });
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveCaret(-1, { byLine: true, select: event.shiftKey });
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveCaret(1, { byLine: true, select: event.shiftKey });
    return;
  }

  if (event.key === 'Home') {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) moveToDocumentBoundary(-1, event.shiftKey);
    else moveToLineBoundary(-1, event.shiftKey);
    return;
  }

  if (event.key === 'End') {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) moveToDocumentBoundary(1, event.shiftKey);
    else moveToLineBoundary(1, event.shiftKey);
    return;
  }

  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    insertText(event.key, { typing: true });
  }
}

function applyPreviewRevision(revision) {
  if (!revision) return;
  state.previewRevision = revision;
  elements.previewLabel.textContent = `Revision ${revision.revision} · ${new Date(revision.createdAt).toLocaleString()}`;
  elements.revisionPreview.textContent = revision.content;
  elements.restoreRevisionButton.disabled = false;
  scheduleRender();
}

function restorePreviewRevision() {
  if (!state.previewRevision) return;
  recordEdit('edit');
  state.text = state.previewRevision.content;
  state.selection = { start: 0, end: 0 };
  state.carets = [];
  state.findMatchIndex = -1;
  markDirty();
  refreshFindMatches();
  updateDocumentDerivedState();
  setMessage(`Loaded revision ${state.previewRevision.revision} into the editor as an unsaved draft.`, 'success');
  scheduleRender();
}

async function loadBootstrap() {
  const response = await fetch('/api/bootstrap');
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || 'Failed to load reports');
  state.documents = data.documents || [];
  const activeDocument = data.activeDocument;
  state.revisions = data.revisions || [];
  if (!activeDocument) throw new Error('No seeded report was found');
  state.activeDocumentId = activeDocument.id;
  state.documentMeta = activeDocument;
  state.text = activeDocument.content;
  state.savedText = activeDocument.content;
  state.baseRevision = activeDocument.currentRevision;
  state.currentRevision = activeDocument.currentRevision;
  state.selection = { start: 0, end: 0 };
  state.carets = [];
  state.undoStack = [];
  state.redoStack = [];
  state.previewRevision = state.revisions[0] || null;
  if (state.previewRevision) {
    elements.previewLabel.textContent = `Revision ${state.previewRevision.revision} · ${new Date(state.previewRevision.createdAt).toLocaleString()}`;
    elements.revisionPreview.textContent = state.previewRevision.preview || '';
  }
  elements.restoreRevisionButton.disabled = true;
  state.findQuery = '';
  elements.findInput.value = '';
  elements.replaceInput.value = '';
  refreshFindMatches();
  updateDocumentDerivedState();
  populateDocuments();
  renderHistory();
  setMessage('Report loaded and ready.', 'success');
  scheduleRender();
}

function populateDocuments() {
  elements.documentMeta.innerHTML = `<strong>${escapeHtml(state.documentMeta.title)}</strong><br />${escapeHtml(state.documentMeta.author)} · ${escapeHtml(state.documentMeta.summary)}`;
  elements.documentList.innerHTML = state.documents.map((document) => {
    const active = document.id === state.activeDocumentId ? 'active' : '';
    return `<button class="doc-chip ${active}" data-document-id="${escapeHtml(document.id)}">
      <span class="doc-title">${escapeHtml(document.title)}</span>
      <span class="doc-meta">${escapeHtml(document.author)} · ${escapeHtml(document.id)}</span>
    </button>`;
  }).join('');
  elements.documentList.querySelectorAll('[data-document-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.documentId;
      await loadDocument(id);
    });
  });
}

function renderHistory() {
  elements.revisionHistory.innerHTML = state.revisions.map((revision) => {
    const selected = state.previewRevision && state.previewRevision.revision === revision.revision ? 'selected' : '';
    const preview = escapeHtml(revision.preview || '');
    return `<article class="revision-card ${selected}" data-revision="${revision.revision}">
      <div class="revision-top">
        <div class="revision-number">Revision ${revision.revision}</div>
        <div class="revision-time">${escapeHtml(new Date(revision.createdAt).toLocaleString())}</div>
      </div>
      <div class="revision-preview-snippet">${preview}</div>
      <div class="revision-actions">
        <button data-action="preview">Preview</button>
        <button data-action="restore">Restore</button>
      </div>
    </article>`;
  }).join('');
  elements.revisionHistory.querySelectorAll('[data-revision]').forEach((card) => {
    const revision = state.revisions.find((item) => String(item.revision) === card.dataset.revision);
    card.querySelector('[data-action="preview"]').addEventListener('click', async () => {
      await previewRevision(revision.revision);
    });
    card.querySelector('[data-action="restore"]').addEventListener('click', async () => {
      await previewRevision(revision.revision);
      restorePreviewRevision();
    });
  });
  elements.historySummary.textContent = `${state.revisions.length} revision${state.revisions.length === 1 ? '' : 's'}`;
  scheduleRender();
}

async function previewRevision(revisionNumber) {
  const response = await fetch(`/api/documents/${state.activeDocumentId}/revisions/${revisionNumber}`);
  const data = await response.json();
  if (!data.ok) {
    setMessage(data.error || 'Could not load revision preview.', 'error');
    return;
  }
  applyPreviewRevision(data);
  renderHistory();
  setMessage(`Previewing revision ${revisionNumber}.`, 'success');
}

async function loadDocument(documentId) {
  finalizeTypingGroup();
  const response = await fetch(`/api/documents/${documentId}`);
  const data = await response.json();
  if (!data.ok) {
    setMessage(data.error || 'Could not load report.', 'error');
    return;
  }
  state.activeDocumentId = data.document.id;
  state.documentMeta = data.document;
  state.revisions = data.revisions || [];
  state.text = data.document.content;
  state.savedText = data.document.content;
  state.baseRevision = data.document.currentRevision;
  state.currentRevision = data.document.currentRevision;
  state.selection = { start: 0, end: 0 };
  state.carets = [];
  state.undoStack = [];
  state.redoStack = [];
  state.previewRevision = state.revisions[0] || null;
  if (state.previewRevision) {
    elements.previewLabel.textContent = `Revision ${state.previewRevision.revision} · ${new Date(state.previewRevision.createdAt).toLocaleString()}`;
    elements.revisionPreview.textContent = state.previewRevision.preview || '';
  }
  elements.restoreRevisionButton.disabled = true;
  populateDocuments();
  renderHistory();
  updateDocumentDerivedState();
  refreshFindMatches();
  setMessage(`Loaded ${data.document.title}.`, 'success');
  scheduleRender();
}

async function saveDocument() {
  finalizeTypingGroup();
  const body = {
    documentId: state.activeDocumentId,
    baseRevision: state.baseRevision,
    content: state.text,
  };
  const token = ++state.saveToken;
  elements.saveButton.disabled = true;
  setMessage('Saving…', '');
  state.saveMode = 'saving';
  scheduleRender();
  let response;
  try {
    response = await fetch(`/api/documents/${state.activeDocumentId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (token !== state.saveToken) return;
    elements.saveButton.disabled = false;
    setMessage(`Save failed: ${error.message}`, 'error');
    updateDocumentDerivedState();
    return;
  }
  if (token !== state.saveToken) return;
  const data = await response.json();
  elements.saveButton.disabled = false;
  if (!response.ok) {
    if (response.status === 409) {
      state.saveMode = 'dirty';
      setMessage(`Conflict: another tab saved revision ${data.currentRevision}. Your draft is still preserved here.`, 'error');
      updateDocumentDerivedState();
      scheduleRender();
      return;
    }
    setMessage(data.error || 'Save failed.', 'error');
    updateDocumentDerivedState();
    scheduleRender();
    return;
  }
  state.savedText = state.text;
  state.baseRevision = data.currentRevision;
  state.currentRevision = data.currentRevision;
  state.revisions = await fetchRevisions();
  state.saveMode = 'saved';
  state.previewRevision = state.revisions[0] || null;
  if (state.previewRevision) {
    elements.previewLabel.textContent = `Revision ${state.previewRevision.revision} · ${new Date(state.previewRevision.createdAt).toLocaleString()}`;
    elements.revisionPreview.textContent = state.previewRevision.preview || '';
  }
  elements.restoreRevisionButton.disabled = true;
  setMessage(data.saved ? `Saved as revision ${data.currentRevision}.` : `No changes to save at revision ${data.currentRevision}.`, 'success');
  updateDocumentDerivedState();
  populateDocuments();
  renderHistory();
  scheduleRender();
}

async function fetchRevisions() {
  const response = await fetch(`/api/documents/${state.activeDocumentId}/revisions`);
  const data = await response.json();
  if (!data.ok) return state.revisions;
  return data.revisions || [];
}

function computeMetrics() {
  const sample = document.createElement('span');
  sample.textContent = '0';
  sample.style.position = 'absolute';
  sample.style.visibility = 'hidden';
  sample.style.fontFamily = '"SFMono-Regular", ui-monospace, Menlo, Consolas, "Liberation Mono", monospace';
  sample.style.fontSize = getComputedStyle(document.documentElement).getPropertyValue('--editor-font');
  sample.style.lineHeight = getComputedStyle(document.documentElement).getPropertyValue('--editor-line');
  document.body.appendChild(sample);
  const rect = sample.getBoundingClientRect();
  sample.remove();
  state.metrics.charWidth = rect.width || 8;
  state.metrics.lineHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--editor-line')) || 22;
  state.metrics.gutterWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')) || 72;
}

function render() {
  const lines = splitLines(state.text);
  const lineStarts = getLineStarts(state.text);
  const longestLineLength = lines.reduce((max, line) => Math.max(max, graphemeCount(line)), 0);
  const contentWidth = Math.max(
    elements.editorViewport.clientWidth,
    state.metrics.gutterWidth + longestLineLength * state.metrics.charWidth + 40,
  );
  const surfaceHeight = Math.max(lines.length * state.metrics.lineHeight + 12, elements.editorViewport.clientHeight);
  const selectedRange = currentSelectionRange();
  const selectionRanges = [];
  if (selectedRange && selectedRange.start !== selectedRange.end) {
    selectionRanges.push({ ...selectedRange, primary: true });
  }
  const carets = state.carets.length ? state.carets : [{ start: state.selection.end, end: state.selection.end }];
  const html = lines.map((lineText, index) => {
    const start = lineStarts[index];
    const end = index + 1 < lineStarts.length ? lineStarts[index + 1] - 1 : state.text.length;
    const ranges = selectionRanges
      .map((range) => {
        const intersectionStart = Math.max(range.start, start);
        const intersectionEnd = Math.min(range.end, end);
        return intersectionStart < intersectionEnd ? { start: intersectionStart - start, end: intersectionEnd - start, primary: range.primary } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);
    let rendered = '';
    let cursor = 0;
    for (const range of ranges) {
      if (range.start > cursor) {
        rendered += escapeHtml(lineText.slice(cursor, range.start));
      }
      const cls = range.primary ? 'selection primary' : 'selection';
      rendered += `<span class="${cls}">${escapeHtml(lineText.slice(range.start, range.end))}</span>`;
      cursor = range.end;
    }
    if (cursor < lineText.length) {
      rendered += escapeHtml(lineText.slice(cursor));
    }
    const caretMarks = carets
      .map((caret, caretIndex) => {
        const position = caret.start;
        if (position < start || position > end) return '';
        const col = graphemeCount(state.text.slice(start, position));
        const x = state.metrics.gutterWidth + col * state.metrics.charWidth;
        const style = `left:${x}px;top:${index * state.metrics.lineHeight + 2}px;height:${state.metrics.lineHeight - 4}px;`;
        return `<div class="caret" style="${style}" aria-hidden="true"></div>`;
      })
      .join('');
    return `<div class="editor-line" data-line="${index + 1}" style="top:${index * state.metrics.lineHeight}px; min-width:${contentWidth}px;">
      <span class="line-number">${index + 1}</span><span class="line-text">${rendered}</span>${caretMarks}
    </div>`;
  }).join('');
  elements.editorViewport.innerHTML = `<div class="editor-surface" style="width:${contentWidth}px;height:${surfaceHeight}px;">${html}</div>`;
  elements.messageBanner.textContent = state.message;
  elements.messageBanner.className = `message-banner ${state.messageType || ''}`.trim();
  updateDocumentDerivedState();
}

function refreshLineMetricsFromContent() {
  state.longestLineLength = splitLines(state.text).reduce((max, line) => Math.max(max, graphemeCount(line)), 0);
}

function attachEvents() {
  elements.editorViewport.addEventListener('keydown', handleKeyDown);
  elements.editorViewport.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  elements.editorViewport.addEventListener('copy', handleCopy);
  elements.editorViewport.addEventListener('cut', handleCut);
  elements.editorViewport.addEventListener('paste', handlePaste);
  elements.editorViewport.addEventListener('scroll', () => scheduleRender());
  elements.findInput.addEventListener('input', () => {
    updateFindFromInput();
    if (state.findQuery && state.matches.length) selectMatch(0);
  });
  elements.findInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      elements.editorViewport.focus();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) findPrevious();
      else findNext();
    }
  });
  elements.replaceInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      elements.editorViewport.focus();
    }
  });
  elements.findPrevButton.addEventListener('click', findPrevious);
  elements.findNextButton.addEventListener('click', findNext);
  elements.replaceCurrentButton.addEventListener('click', replaceCurrent);
  elements.replaceAllButton.addEventListener('click', replaceAll);
  elements.saveButton.addEventListener('click', saveDocument);
  elements.undoButton.addEventListener('click', undo);
  elements.redoButton.addEventListener('click', redo);
  elements.restoreRevisionButton.addEventListener('click', restorePreviewRevision);
  window.addEventListener('beforeunload', (event) => {
    if (state.text !== state.savedText) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

async function init() {
  computeMetrics();
  attachEvents();
  elements.editorViewport.focus();
  try {
    await loadBootstrap();
    refreshLineMetricsFromContent();
    updateDocumentDerivedState();
    render();
    setInterval(() => {
      refreshLineMetricsFromContent();
      scheduleRender();
    }, 5000);
  } catch (error) {
    setMessage(`Failed to load PatchPad: ${error.message}`, 'error');
  }
}

init();

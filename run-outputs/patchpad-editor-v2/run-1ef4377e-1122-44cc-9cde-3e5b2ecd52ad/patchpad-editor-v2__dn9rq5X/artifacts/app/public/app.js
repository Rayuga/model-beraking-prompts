(() => {
  const bootstrapNode = document.getElementById('patchpad-bootstrap');
  const bootstrap = bootstrapNode ? JSON.parse(bootstrapNode.textContent || '{}') : { reports: [], selectedReportId: null };

  const els = {
    saveButton: document.getElementById('save-button'),
    undoButton: document.getElementById('undo-button'),
    redoButton: document.getElementById('redo-button'),
    findNextButton: document.getElementById('find-next-button'),
    findPrevButton: document.getElementById('find-prev-button'),
    replaceCurrentButton: document.getElementById('replace-current-button'),
    replaceAllButton: document.getElementById('replace-all-button'),
    reloadButton: document.getElementById('reload-button'),
    discardButton: document.getElementById('discard-button'),
    findInput: document.getElementById('find-input'),
    replaceInput: document.getElementById('replace-input'),
    reportList: document.getElementById('report-list'),
    historyList: document.getElementById('history-list'),
    previewPane: document.getElementById('preview-pane'),
    reportTitle: document.getElementById('report-title'),
    reportMeta: document.getElementById('report-meta'),
    saveState: document.getElementById('save-state'),
    cursorState: document.getElementById('cursor-state'),
    feedback: document.getElementById('feedback'),
    editorViewport: document.getElementById('editor-viewport'),
    editorInner: document.getElementById('editor-inner'),
    matchCount: document.getElementById('match-count'),
  };

  const graphemeSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;
  const wordSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter(undefined, { granularity: 'word' })
    : null;

  const measureCanvas = document.createElement('canvas');
  const measureContext = measureCanvas.getContext('2d');

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const state = {
    reports: bootstrap.reports || [],
    selectedReportId: bootstrap.selectedReportId || null,
    report: null,
    text: '',
    savedText: '',
    baseRevision: 0,
    savedRevision: 0,
    loadedAt: '',
    dirty: false,
    selection: { anchor: 0, focus: 0 },
    extraCarets: [],
    document: buildDocument(''),
    undoStack: [],
    redoStack: [],
    editSession: null,
    findQuery: '',
    matches: [],
    activeMatchIndex: -1,
    previewRevision: null,
    preview: null,
    message: '',
    messageKind: 'info',
    loading: false,
    preferredColumn: 0,
    layout: {
      gutterWidth: 0,
      paddingLeft: 16,
      paddingTop: 16,
      lineHeight: 24,
      font: '14px ui-monospace, SFMono-Regular, Menlo, Consolas, Liberation Mono, monospace',
    },
    dragging: false,
    dragMode: 'selection',
    dragPointerId: null,
    dragHasStarted: false,
    latestServerRevision: 0,
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function cloneSelection(selection) {
    return { anchor: selection.anchor, focus: selection.focus };
  }

  function selectionRange(selection = state.selection) {
    return selection.anchor <= selection.focus
      ? { start: selection.anchor, end: selection.focus }
      : { start: selection.focus, end: selection.anchor };
  }

  function selectionIsCollapsed(selection = state.selection) {
    return selection.anchor === selection.focus;
  }

  function selectionLength(selection = state.selection) {
    const range = selectionRange(selection);
    return range.end - range.start;
  }

  function isMacLike() {
    return navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac');
  }

  function hasPrimaryModifier(event) {
    return isMacLike() ? event.metaKey : event.ctrlKey;
  }

  function safeParseBootstrap() {
    if (!bootstrap || !bootstrap.reports) {
      return { reports: [], selectedReportId: null };
    }
    return bootstrap;
  }

  function setFeedback(message, kind = 'info') {
    state.message = message;
    state.messageKind = kind;
    renderFeedback();
  }

  function clearFeedback() {
    state.message = '';
    state.messageKind = 'info';
    renderFeedback();
  }

  function formatDate(value) {
    if (!value) {
      return 'Unknown time';
    }
    try {
      return dateFormatter.format(new Date(value));
    } catch {
      return value;
    }
  }

  function setButtonState(button, disabled) {
    if (button) {
      button.disabled = disabled;
    }
  }

  function normalizeOffset(offset) {
    return clamp(offset, 0, state.document.text.length);
  }

  function segmentBoundaries(text, segmenter) {
    const boundaries = [0];
    if (segmenter) {
      for (const part of segmenter.segment(text)) {
        if (part.index !== boundaries[boundaries.length - 1]) {
          boundaries.push(part.index);
        }
      }
    } else {
      let index = 0;
      for (const ch of Array.from(text)) {
        index += ch.length;
        if (index !== boundaries[boundaries.length - 1]) {
          boundaries.push(index);
        }
      }
    }
    if (boundaries[boundaries.length - 1] !== text.length) {
      boundaries.push(text.length);
    }
    return boundaries;
  }

  function buildDocument(text) {
    const rawLines = text.split('\n');
    const lines = [];
    const wordSegments = [];
    let offset = 0;

    for (let index = 0; index < rawLines.length; index += 1) {
      const lineText = rawLines[index];
      const lineStart = offset;
      const lineEnd = lineStart + lineText.length;
      const hasBreak = index < rawLines.length - 1;
      const nextStart = lineEnd + (hasBreak ? 1 : 0);
      const graphemeBoundaries = segmentBoundaries(lineText, graphemeSegmenter);

      lines.push({
        index,
        text: lineText,
        start: lineStart,
        end: lineEnd,
        nextStart,
        hasBreak,
        graphemeBoundaries,
        graphemeCount: graphemeBoundaries.length - 1,
      });

      offset = nextStart;
    }

    if (wordSegmenter) {
      for (const part of wordSegmenter.segment(text)) {
        wordSegments.push({
          start: part.index,
          end: part.index + part.segment.length,
          isWordLike: Boolean(part.isWordLike),
        });
      }
    } else {
      const regex = /[\p{L}\p{N}_]+/gu;
      let match;
      while ((match = regex.exec(text))) {
        wordSegments.push({
          start: match.index,
          end: match.index + match[0].length,
          isWordLike: true,
        });
      }
    }

    return {
      text,
      lines,
      wordSegments,
    };
  }

  function currentLineData(offset = getPrimaryCaretOffset()) {
    const normalized = normalizeOffset(offset);
    const lines = state.document.lines;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (normalized < line.nextStart || index === lines.length - 1) {
        return { line, lineIndex: index, offsetWithinLine: Math.min(normalized - line.start, line.text.length) };
      }
    }
    const last = lines[lines.length - 1];
    return { line: last, lineIndex: lines.length - 1, offsetWithinLine: last ? last.text.length : 0 };
  }

  function graphemeOffsetFromColumn(line, column) {
    const boundaries = line.graphemeBoundaries;
    const capped = clamp(column, 0, boundaries.length - 1);
    return boundaries[capped];
  }

  function graphemeColumnFromOffset(line, offsetWithinLine) {
    const boundaries = line.graphemeBoundaries;
    let low = 0;
    let high = boundaries.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (boundaries[mid] <= offsetWithinLine) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return low;
  }

  function lineColumnPosition(offset) {
    const { line, lineIndex, offsetWithinLine } = currentLineData(offset);
    return {
      lineIndex,
      column: graphemeColumnFromOffset(line, offsetWithinLine),
      line,
    };
  }

  function getPrimaryCaretOffset() {
    return normalizeOffset(state.selection.focus);
  }

  function getSelectionRange() {
    const range = selectionRange();
    return {
      start: normalizeOffset(range.start),
      end: normalizeOffset(range.end),
    };
  }

  function getAllCaretOffsets() {
    const offsets = [getPrimaryCaretOffset(), ...state.extraCarets.map(normalizeOffset)];
    return Array.from(new Set(offsets)).sort((a, b) => a - b);
  }

  function collapseTo(offset, preserveExtras = false) {
    endEditSession();
    const next = normalizeOffset(offset);
    state.selection = { anchor: next, focus: next };
    if (!preserveExtras) {
      state.extraCarets = [];
    }
    state.preferredColumn = lineColumnPosition(next).column;
  }

  function selectRange(anchor, focus) {
    endEditSession();
    state.selection = {
      anchor: normalizeOffset(anchor),
      focus: normalizeOffset(focus),
    };
    state.extraCarets = [];
    state.preferredColumn = lineColumnPosition(state.selection.focus).column;
  }

  function applySelectionAfterEdit(nextCarets, preferredColumn = null) {
    const sorted = Array.from(new Set(nextCarets.map(normalizeOffset))).sort((a, b) => a - b);
    if (sorted.length === 0) {
      collapseTo(0);
      return;
    }
    state.selection = { anchor: sorted[0], focus: sorted[0] };
    state.extraCarets = sorted.slice(1);
    state.preferredColumn = preferredColumn === null ? lineColumnPosition(sorted[0]).column : preferredColumn;
  }

  function pushUndoSnapshot() {
    state.undoStack.push({
      text: state.text,
      selection: cloneSelection(state.selection),
      extraCarets: [...state.extraCarets],
      preferredColumn: state.preferredColumn,
    });
    if (state.undoStack.length > 100) {
      state.undoStack.shift();
    }
  }

  function restoreSnapshot(snapshot) {
    state.text = snapshot.text;
    state.document = buildDocument(state.text);
    state.selection = cloneSelection(snapshot.selection);
    state.extraCarets = [...snapshot.extraCarets];
    state.preferredColumn = snapshot.preferredColumn;
    state.dirty = state.text !== state.savedText;
    state.editSession = null;
    updateMatchesAfterTextChange(false);
    renderAll();
  }

  function beginEditSession(kind) {
    const now = Date.now();
    const session = state.editSession;
    if (!session || session.kind !== kind || now - session.startedAt > 700) {
      pushUndoSnapshot();
      state.redoStack = [];
      state.editSession = { kind, startedAt: now };
    } else {
      session.startedAt = now;
    }
  }

  function endEditSession() {
    state.editSession = null;
  }

  function replaceText(nextText, nextSelection, kind) {
    beginEditSession(kind);
    state.text = nextText;
    state.document = buildDocument(nextText);
    state.selection = {
      anchor: normalizeOffset(nextSelection.anchor),
      focus: normalizeOffset(nextSelection.focus),
    };
    state.extraCarets = nextSelection.extraCarets ? [...nextSelection.extraCarets] : [];
    state.preferredColumn = nextSelection.preferredColumn !== undefined
      ? nextSelection.preferredColumn
      : lineColumnPosition(state.selection.focus).column;
    state.dirty = state.text !== state.savedText;
    updateMatchesAfterTextChange(true);
    renderAll();
  }

  function replaceRangeInText(text, start, end, replacement) {
    return text.slice(0, start) + replacement + text.slice(end);
  }

  function applyBatchEdits(edits, kind) {
    if (!edits.length) {
      return;
    }
    const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
    beginEditSession(kind);
    let nextText = state.text;
    let shift = 0;
    const nextCarets = [];

    for (const edit of sorted) {
      const start = normalizeOffset(edit.start + shift);
      const end = normalizeOffset(edit.end + shift);
      nextText = replaceRangeInText(nextText, start, end, edit.insert);
      shift += edit.insert.length - (edit.end - edit.start);
      nextCarets.push(start + edit.insert.length);
    }

    state.text = nextText;
    state.document = buildDocument(nextText);
    applySelectionAfterEdit(nextCarets, sorted.length ? null : state.preferredColumn);
    state.dirty = state.text !== state.savedText;
    updateMatchesAfterTextChange(true);
    renderAll();
  }

  function deleteRange(start, end, kind) {
    if (start === end) {
      return;
    }
    replaceText(
      replaceRangeInText(state.text, start, end, ''),
      { anchor: start, focus: start },
      kind,
    );
  }

  function insertText(text, kind = 'typing') {
    if (!text) {
      return;
    }

    if (!selectionIsCollapsed() && state.extraCarets.length === 0) {
      const range = getSelectionRange();
      replaceText(
        replaceRangeInText(state.text, range.start, range.end, text),
        { anchor: range.start + text.length, focus: range.start + text.length },
        kind,
      );
      return;
    }

    const offsets = getAllCaretOffsets();
    const edits = offsets.map((offset) => ({ start: offset, end: offset, insert: text }));
    applyBatchEdits(edits, kind);
  }

  function deleteBackward(kind = 'delete') {
    if (!selectionIsCollapsed() && state.extraCarets.length === 0) {
      const range = getSelectionRange();
      deleteRange(range.start, range.end, kind);
      return;
    }

    const edits = [];
    for (const offset of getAllCaretOffsets()) {
      const prev = previousDeletionBoundary(offset);
      if (prev < offset) {
        edits.push({ start: prev, end: offset, insert: '' });
      }
    }
    applyBatchEdits(edits, kind);
  }

  function deleteForward(kind = 'delete') {
    if (!selectionIsCollapsed() && state.extraCarets.length === 0) {
      const range = getSelectionRange();
      deleteRange(range.start, range.end, kind);
      return;
    }

    const edits = [];
    for (const offset of getAllCaretOffsets()) {
      const next = nextDeletionBoundary(offset);
      if (next > offset) {
        edits.push({ start: offset, end: next, insert: '' });
      }
    }
    applyBatchEdits(edits, kind);
  }

  function previousDeletionBoundary(offset) {
    const pos = lineColumnPosition(offset);
    const line = pos.line;
    const column = pos.column;
    if (column > 0) {
      return line.start + graphemeOffsetFromColumn(line, column - 1);
    }
    if (pos.lineIndex === 0) {
      return offset;
    }
    const previousLine = state.document.lines[pos.lineIndex - 1];
    return previousLine.end;
  }

  function nextDeletionBoundary(offset) {
    const pos = lineColumnPosition(offset);
    const line = pos.line;
    const column = pos.column;
    if (column < line.graphemeCount) {
      return line.start + graphemeOffsetFromColumn(line, column + 1);
    }
    if (pos.lineIndex === state.document.lines.length - 1) {
      return offset;
    }
    return line.nextStart;
  }

  function moveSelection(direction, withShift = false, byWord = false, byLine = false) {
    endEditSession();
    state.extraCarets = [];

    const current = withShift ? state.selection.focus : (direction < 0 ? getSelectionRange().start : getSelectionRange().end);
    const next = byWord
      ? moveByWord(current, direction)
      : byLine
        ? moveByLine(current, direction)
        : moveByCharacter(current, direction);

    if (withShift) {
      state.selection.focus = next;
    } else {
      state.selection = { anchor: next, focus: next };
    }
    state.preferredColumn = lineColumnPosition(next).column;
    renderAll();
    scrollPrimaryCaretIntoView();
  }

  function moveByCharacter(offset, direction) {
    const pos = lineColumnPosition(offset);
    if (direction < 0) {
      if (pos.column > 0) {
        return pos.line.start + graphemeOffsetFromColumn(pos.line, pos.column - 1);
      }
      if (pos.lineIndex === 0) {
        return 0;
      }
      const previousLine = state.document.lines[pos.lineIndex - 1];
      return previousLine.end;
    }

    if (pos.column < pos.line.graphemeCount) {
      return pos.line.start + graphemeOffsetFromColumn(pos.line, pos.column + 1);
    }
    if (pos.lineIndex === state.document.lines.length - 1) {
      return state.document.text.length;
    }
    return pos.line.nextStart;
  }

  function moveByLine(offset, direction) {
    const current = lineColumnPosition(offset);
    const targetIndex = clamp(current.lineIndex + direction, 0, state.document.lines.length - 1);
    const targetLine = state.document.lines[targetIndex];
    const targetColumn = clamp(state.preferredColumn, 0, targetLine.graphemeCount);
    return targetLine.start + graphemeOffsetFromColumn(targetLine, targetColumn);
  }

  function moveByWord(offset, direction) {
    const segments = state.document.wordSegments;
    if (!segments.length) {
      return direction < 0 ? 0 : state.document.text.length;
    }

    if (direction > 0) {
      for (const segment of segments) {
        if (segment.start > offset) {
          return segment.start;
        }
        if (segment.start <= offset && segment.end > offset && segment.isWordLike) {
          return segment.end;
        }
      }
      return state.document.text.length;
    }

    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const segment = segments[index];
      if (segment.end < offset) {
        return segment.isWordLike ? segment.start : segment.start;
      }
      if (segment.start < offset && segment.end >= offset && segment.isWordLike) {
        return segment.start;
      }
    }
    return 0;
  }

  function selectAll() {
    endEditSession();
    state.selection = { anchor: 0, focus: state.document.text.length };
    state.extraCarets = [];
    state.preferredColumn = 0;
    renderAll();
    scrollPrimaryCaretIntoView();
  }

  function indentSelection(unindent = false) {
    endEditSession();
    const hasRangeSelection = !selectionIsCollapsed() && state.extraCarets.length === 0;

    if (!hasRangeSelection) {
      const offsets = getAllCaretOffsets();
      if (!unindent) {
        applyBatchEdits(offsets.map((offset) => ({ start: offset, end: offset, insert: '\t' })), 'indent');
        return;
      }

      const edits = [];
      const seen = new Set();
      for (const offset of offsets) {
        const line = currentLineData(offset).line;
        const key = `${line.start}:${line.end}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        if (line.text.startsWith('\t')) {
          edits.push({ start: line.start, end: line.start + 1, insert: '' });
        } else if (line.text.startsWith('  ')) {
          edits.push({ start: line.start, end: line.start + 2, insert: '' });
        }
      }

      if (!edits.length) {
        return;
      }
      applyBatchEdits(edits, 'unindent');
      return;
    }

    const range = getSelectionRange();
    const lines = state.document.lines;
    const firstLineIndex = currentLineData(range.start).lineIndex;
    const lastLineIndex = currentLineData(Math.max(range.end - 1, 0)).lineIndex;
    const edits = [];
    let anchorShift = 0;
    let focusShift = 0;

    for (let index = firstLineIndex; index <= lastLineIndex; index += 1) {
      const line = lines[index];
      if (unindent) {
        if (line.text.startsWith('\t')) {
          edits.push({ start: line.start, end: line.start + 1, insert: '' });
          if (line.start < range.start) anchorShift -= 1;
          if (line.start < range.end) focusShift -= 1;
        } else if (line.text.startsWith('  ')) {
          edits.push({ start: line.start, end: line.start + 2, insert: '' });
          if (line.start < range.start) anchorShift -= 2;
          if (line.start < range.end) focusShift -= 2;
        }
      } else {
        edits.push({ start: line.start, end: line.start, insert: '\t' });
        if (line.start <= range.start) anchorShift += 1;
        if (line.start <= range.end) focusShift += 1;
      }
    }

    if (!edits.length) {
      return;
    }

    const sorted = edits.sort((a, b) => a.start - b.start);
    let nextText = state.text;
    let shift = 0;
    for (const edit of sorted) {
      const start = edit.start + shift;
      const end = edit.end + shift;
      nextText = replaceRangeInText(nextText, start, end, edit.insert);
      shift += edit.insert.length - (edit.end - edit.start);
    }

    replaceText(
      nextText,
      {
        anchor: range.start + anchorShift,
        focus: range.end + focusShift,
      },
      unindent ? 'unindent' : 'indent',
    );
  }

  function copySelectionToClipboard(cut = false) {
    const range = getSelectionRange();
    if (range.start === range.end || state.extraCarets.length) {
      return false;
    }
    const text = state.text.slice(range.start, range.end);
    return writeClipboardText(text).then(() => {
      if (cut) {
        deleteRange(range.start, range.end, 'cut');
      }
    });
  }

  async function writeClipboardText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fallback below.
    }
    return false;
  }

  function isEditorFocused() {
    return document.activeElement === els.editorViewport || els.editorViewport.contains(document.activeElement);
  }

  function navigateMatches(direction) {
    if (!state.findQuery) {
      setFeedback('Enter a search term before navigating matches.', 'warning');
      return;
    }
    if (!state.matches.length) {
      setFeedback(`No matches found for “${state.findQuery}”.`, 'warning');
      return;
    }
    if (state.activeMatchIndex < 0) {
      state.activeMatchIndex = direction > 0 ? 0 : state.matches.length - 1;
    } else {
      state.activeMatchIndex = (state.activeMatchIndex + direction + state.matches.length) % state.matches.length;
    }
    activateMatch(state.activeMatchIndex, true);
  }

  function activateMatch(index, scrollIntoView = false) {
    if (!state.matches.length) {
      return;
    }
    endEditSession();
    const match = state.matches[clamp(index, 0, state.matches.length - 1)];
    if (!match) {
      return;
    }
    state.activeMatchIndex = index;
    state.selection = { anchor: match.start, focus: match.end };
    state.extraCarets = [];
    state.preferredColumn = lineColumnPosition(match.end).column;
    renderAll();
    if (scrollIntoView) {
      scrollPrimaryCaretIntoView();
    }
  }

  function refreshFindMatches(selectFirst = false) {
    const query = state.findQuery;
    if (!query) {
      state.matches = [];
      state.activeMatchIndex = -1;
      renderFindCount();
      return;
    }

    const matches = [];
    let startIndex = 0;
    while (startIndex <= state.text.length) {
      const found = state.text.indexOf(query, startIndex);
      if (found === -1) {
        break;
      }
      matches.push({ start: found, end: found + query.length });
      startIndex = found + Math.max(1, query.length);
    }

    state.matches = matches;
    if (!matches.length) {
      state.activeMatchIndex = -1;
      renderFindCount();
      return;
    }

    if (selectFirst || state.activeMatchIndex < 0 || state.activeMatchIndex >= matches.length) {
      state.activeMatchIndex = 0;
    }
    const active = matches[state.activeMatchIndex];
    state.selection = { anchor: active.start, focus: active.end };
    state.extraCarets = [];
    state.preferredColumn = lineColumnPosition(active.end).column;
    renderFindCount();
  }

  function updateMatchesAfterTextChange(selectFirst) {
    if (!state.findQuery) {
      state.matches = [];
      state.activeMatchIndex = -1;
      renderFindCount();
      return;
    }
    refreshFindMatches(selectFirst);
  }

  function replaceCurrentMatch() {
    if (!state.findQuery) {
      setFeedback('Type a search term before replacing a match.', 'warning');
      return;
    }
    if (!state.matches.length) {
      setFeedback(`No matches found for “${state.findQuery}”.`, 'warning');
      return;
    }
    if (state.activeMatchIndex < 0) {
      state.activeMatchIndex = 0;
    }
    const match = state.matches[state.activeMatchIndex];
    replaceText(
      replaceRangeInText(state.text, match.start, match.end, els.replaceInput.value),
      { anchor: match.start + els.replaceInput.value.length, focus: match.start + els.replaceInput.value.length },
      'replace',
    );
    refreshFindMatches(false);
    if (state.matches.length) {
      state.activeMatchIndex = clamp(state.activeMatchIndex, 0, state.matches.length - 1);
      activateMatch(state.activeMatchIndex, false);
    }
  }

  function replaceAllMatches() {
    if (!state.findQuery) {
      setFeedback('Type a search term before replacing matches.', 'warning');
      return;
    }
    if (!state.matches.length) {
      setFeedback(`No matches found for “${state.findQuery}”.`, 'warning');
      return;
    }
    const replacement = els.replaceInput.value;
    const query = state.findQuery;
    const matches = [...state.matches];
    let nextText = state.text;
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      const match = matches[index];
      nextText = replaceRangeInText(nextText, match.start, match.end, replacement);
    }
    const first = matches[0];
    replaceText(nextText, { anchor: first.start, focus: first.start }, 'replaceAll');
    refreshFindMatches(true);
    setFeedback(`Replaced ${matches.length} ${matches.length === 1 ? 'match' : 'matches'} for “${query}”.`, 'success');
  }

  function setPreview(revision, content, createdAt) {
    state.previewRevision = revision;
    state.preview = { revision, content, createdAt };
    renderPreview();
  }

  async function previewRevision(revision) {
    if (!state.report) {
      return;
    }
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(state.report.id)}/revisions/${revision}`);
      if (!response.ok) {
        throw new Error(`Failed to load revision ${revision}`);
      }
      const payload = await response.json();
      const selected = payload.revision;
      setPreview(selected.revision, selected.content, selected.createdAt);
      setFeedback(`Previewing revision ${selected.revision}.`, 'info');
    } catch (error) {
      setFeedback(error.message || 'Unable to preview revision.', 'error');
    }
  }

  async function restoreRevision(revision) {
    if (!state.report) {
      return;
    }
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(state.report.id)}/revisions/${revision}`);
      if (!response.ok) {
        throw new Error(`Failed to restore revision ${revision}`);
      }
      const payload = await response.json();
      const selected = payload.revision;
      if (selected.content === state.text) {
        setFeedback(`Revision ${selected.revision} is already open.`, 'info');
        return;
      }
      replaceText(
        selected.content,
        { anchor: 0, focus: 0 },
        'restore',
      );
      collapseTo(0);
      renderAll();
      scrollPrimaryCaretIntoView();
      setFeedback(`Restored revision ${selected.revision} as an unsaved edit.`, 'success');
    } catch (error) {
      setFeedback(error.message || 'Unable to restore revision.', 'error');
    }
  }

  async function openReport(reportId, options = {}) {
    if (!reportId) {
      return;
    }
    if (state.report && state.report.id !== reportId && state.dirty && !options.force) {
      const ok = window.confirm('Switching reports will discard unsaved changes. Continue?');
      if (!ok) {
        return;
      }
    }

    state.loading = true;
    renderButtons();
    try {
      const [reportResponse, historyResponse] = await Promise.all([
        fetch(`/api/reports/${encodeURIComponent(reportId)}`),
        fetch(`/api/reports/${encodeURIComponent(reportId)}/revisions`),
      ]);

      if (!reportResponse.ok) {
        throw new Error('Report could not be loaded.');
      }
      if (!historyResponse.ok) {
        throw new Error('Revision history could not be loaded.');
      }

      const reportPayload = await reportResponse.json();
      const historyPayload = await historyResponse.json();
      const report = reportPayload.report;

      state.report = report;
      state.selectedReportId = report.id;
      state.text = report.content;
      state.savedText = report.content;
      state.baseRevision = report.currentRevision;
      state.savedRevision = report.currentRevision;
      state.latestServerRevision = report.currentRevision;
      state.loadedAt = report.updatedAt;
      state.dirty = false;
      state.selection = { anchor: 0, focus: 0 };
      state.extraCarets = [];
      state.undoStack = [];
      state.redoStack = [];
      state.editSession = null;
      state.document = buildDocument(state.text);
      state.preview = null;
      state.previewRevision = null;
      state.history = historyPayload.revisions;
      state.matches = [];
      state.activeMatchIndex = -1;
      state.preferredColumn = 0;
      clearFeedback();
      refreshFindMatches(false);
      renderAll();
      els.editorViewport.focus();
      scrollPrimaryCaretIntoView(true);
      setFeedback(`Opened ${report.title} at revision ${report.currentRevision}.`, 'success');
    } catch (error) {
      setFeedback(error.message || 'Unable to open report.', 'error');
    } finally {
      state.loading = false;
      renderSaveState();
      renderButtons();
    }
  }

  async function reloadReport() {
    if (!state.report) {
      return;
    }
    if (state.dirty) {
      const ok = window.confirm('Reloading will discard your unsaved draft. Continue?');
      if (!ok) {
        return;
      }
    }
    await openReport(state.report.id, { force: true });
    setFeedback(`Reloaded the saved version of ${state.report.title}.`, 'success');
  }

  async function discardDraft() {
    if (!state.report) {
      return;
    }
    if (!state.dirty) {
      setFeedback('There are no local changes to discard.', 'info');
      return;
    }
    const ok = window.confirm('Discard your unsaved changes and return to the saved version?');
    if (!ok) {
      return;
    }
    await openReport(state.report.id, { force: true });
    setFeedback(`Discarded local changes for ${state.report.title}.`, 'success');
  }

  async function saveReport() {
    if (!state.report) {
      return;
    }
    if (!state.dirty) {
      setFeedback('Nothing has changed since the last save.', 'info');
      return;
    }

    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(state.report.id)}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: state.report.id,
          baseRevision: state.baseRevision,
          content: state.text,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (response.status === 409) {
        const latest = payload.report;
        state.latestServerRevision = latest ? latest.currentRevision : state.latestServerRevision;
        renderAll();
        setFeedback(
          `Save rejected because the server is now at revision ${latest ? latest.currentRevision : 'a newer revision'}. Your draft is still in the editor.`,
          'error',
        );
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error || 'Save failed.');
      }

      const report = payload.report;
      state.report = report;
      state.savedText = report.content;
      state.text = report.content;
      state.baseRevision = report.currentRevision;
      state.savedRevision = report.currentRevision;
      state.latestServerRevision = report.currentRevision;
      state.loadedAt = report.updatedAt;
      state.dirty = false;
      state.selection = { anchor: state.selection.focus, focus: state.selection.focus };
      state.extraCarets = [];
      state.undoStack = [];
      state.redoStack = [];
      state.editSession = null;
      state.document = buildDocument(state.text);
      await loadHistory(report.id);
      refreshFindMatches(false);
      renderAll();
      setFeedback(`Saved revision ${report.currentRevision}.`, 'success');
    } catch (error) {
      setFeedback(error.message || 'Unable to save report.', 'error');
    }
  }

  async function loadHistory(reportId) {
    const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}/revisions`);
    if (!response.ok) {
      throw new Error('Revision history could not be loaded.');
    }
    const payload = await response.json();
    state.history = payload.revisions;
    renderHistory();
  }

  async function openPreviewFromHistory(revision) {
    state.previewRevision = revision;
    renderHistory();
    await previewRevision(revision);
  }

  function onFindInput() {
    state.findQuery = els.findInput.value;
    refreshFindMatches(true);
    renderAll();
    if (state.findQuery && state.matches.length) {
      setFeedback(`Found ${state.matches.length} ${state.matches.length === 1 ? 'match' : 'matches'}.`, 'info');
    } else if (state.findQuery) {
      setFeedback(`No matches found for “${state.findQuery}”.`, 'warning');
    } else {
      setFeedback('Search cleared.', 'info');
    }
  }

  function renderFeedback() {
    if (!els.feedback) {
      return;
    }
    els.feedback.className = `feedback ${state.messageKind === 'error' ? 'is-error' : state.messageKind === 'warning' ? 'is-warning' : state.messageKind === 'success' ? 'is-success' : ''}`.trim();
    els.feedback.textContent = state.message || 'Ready.';
    renderSaveState();
  }

  function renderSaveState() {
    if (!els.saveState) {
      return;
    }
    els.saveState.className = 'status-pill';
    if (state.loading) {
      els.saveState.textContent = 'Loading…';
      return;
    }
    if (!state.report) {
      els.saveState.textContent = 'No report open';
      return;
    }

    if (state.dirty) {
      const stale = state.savedRevision !== state.baseRevision || state.latestServerRevision > state.baseRevision;
      els.saveState.textContent = stale
        ? `Unsaved draft · base ${state.baseRevision} / server ${Math.max(state.savedRevision, state.latestServerRevision)}`
        : 'Unsaved changes';
      els.saveState.classList.add(stale ? 'is-error' : 'is-dirty');
      return;
    }

    els.saveState.textContent = `Saved · revision ${state.savedRevision}`;
    els.saveState.classList.add('is-saved');
  }

  function renderCursorState() {
    if (!els.cursorState) {
      return;
    }
    if (!state.report) {
      els.cursorState.textContent = 'Open a report to begin editing.';
      return;
    }

    const primary = lineColumnPosition(getPrimaryCaretOffset());
    const selectedChars = selectionLength();
    const caretCount = 1 + state.extraCarets.length;
    const parts = [`Line ${primary.lineIndex + 1}`, `column ${primary.column + 1}`];
    if (caretCount > 1) {
      parts.push(`${caretCount} carets`);
    }
    if (selectedChars > 0) {
      parts.push(`${selectedChars} selected`);
    }
    els.cursorState.textContent = parts.join(' · ');
  }

  function renderReportHeader() {
    if (!state.report) {
      els.reportTitle.textContent = 'Northwind API Incident Report';
      els.reportMeta.textContent = 'Open a report to see its saved content.';
      return;
    }
    els.reportTitle.textContent = state.report.title;
    els.reportMeta.textContent = `ID ${state.report.id} · Author ${state.report.author} · Revision ${state.savedRevision} · Updated ${formatDate(state.loadedAt)}${state.report.summary ? ` · ${state.report.summary}` : ''}`;
  }

  function renderReportList() {
    if (!els.reportList) {
      return;
    }
    const buttons = [...els.reportList.querySelectorAll('[data-report-id]')];
    for (const button of buttons) {
      const reportId = button.getAttribute('data-report-id');
      const report = state.reports.find((entry) => entry.id === reportId);
      button.classList.toggle('is-active', state.report && state.report.id === reportId);
      if (report) {
        button.setAttribute('aria-pressed', state.report && state.report.id === reportId ? 'true' : 'false');
      }
      if (!button.dataset.bound) {
        button.addEventListener('click', () => {
          openReport(reportId);
        });
        button.dataset.bound = 'true';
      }
    }
  }

  function renderHistory() {
    if (!els.historyList) {
      return;
    }
    if (!state.report) {
      els.historyList.innerHTML = '<div class="empty-note">Open a report to see its revisions.</div>';
      return;
    }

    if (!state.history || !state.history.length) {
      els.historyList.innerHTML = '<div class="empty-note">No revisions are stored yet.</div>';
      return;
    }

    els.historyList.innerHTML = state.history.map((revision) => {
      const active = state.previewRevision === revision.revision;
      return `
        <div class="history-item ${active ? 'is-active' : ''}" data-history-revision="${revision.revision}">
          <button type="button" class="history-item__title-button" data-preview-revision="${revision.revision}">
            <span class="history-item__title">Revision ${revision.revision}${revision.current ? ' · current' : ''}</span>
          </button>
          <div class="history-item__meta">${escapeHtml(formatDate(revision.createdAt))} · ${revision.contentLength} chars</div>
          <div class="history-actions">
            <button type="button" data-restore-revision="${revision.revision}">Restore</button>
          </div>
        </div>
      `;
    }).join('');

    for (const entry of els.historyList.querySelectorAll('[data-preview-revision]')) {
      if (entry.dataset.bound) {
        continue;
      }
      entry.addEventListener('click', () => {
        openPreviewFromHistory(Number(entry.getAttribute('data-preview-revision')));
      });
      entry.dataset.bound = 'true';
    }

    for (const entry of els.historyList.querySelectorAll('[data-restore-revision]')) {
      if (entry.dataset.bound) {
        continue;
      }
      entry.addEventListener('click', () => {
        restoreRevision(Number(entry.getAttribute('data-restore-revision')));
      });
      entry.dataset.bound = 'true';
    }
  }

  function renderPreview() {
    if (!els.previewPane) {
      return;
    }
    if (!state.preview) {
      els.previewPane.innerHTML = '<div class="empty-note">Select a revision to preview it.</div>';
      return;
    }
    els.previewPane.innerHTML = `
      <div class="preview-meta">Revision ${state.preview.revision} · ${escapeHtml(formatDate(state.preview.createdAt))}</div>
      <pre>${escapeHtml(state.preview.content)}</pre>
    `;
  }

  function renderFindCount() {
    if (!els.matchCount) {
      return;
    }
    if (!state.findQuery) {
      els.matchCount.textContent = '0 matches';
      return;
    }
    els.matchCount.textContent = `${state.matches.length} ${state.matches.length === 1 ? 'match' : 'matches'}`;
  }

  function renderButtons() {
    setButtonState(els.saveButton, !state.report || state.loading);
    setButtonState(els.undoButton, !state.undoStack.length || state.loading);
    setButtonState(els.redoButton, !state.redoStack.length || state.loading);
    setButtonState(els.findNextButton, !state.report || state.loading);
    setButtonState(els.findPrevButton, !state.report || state.loading);
    setButtonState(els.replaceCurrentButton, !state.report || state.loading);
    setButtonState(els.replaceAllButton, !state.report || state.loading);
    setButtonState(els.reloadButton, !state.report || state.loading);
    setButtonState(els.discardButton, !state.report || state.loading);
  }

  function updateLayoutMetrics() {
    const style = getComputedStyle(els.editorInner);
    const fontSize = parseFloat(style.fontSize) || 14;
    const lineHeight = parseFloat(style.lineHeight) || 24;
    state.layout.paddingLeft = parseFloat(style.paddingLeft) || 16;
    state.layout.paddingTop = parseFloat(style.paddingTop) || 16;
    state.layout.lineHeight = lineHeight;
    state.layout.font = style.font || `${fontSize}px ${style.fontFamily}`;

    const firstLineNumber = els.editorInner.querySelector('.line-number');
    state.layout.gutterWidth = firstLineNumber ? firstLineNumber.getBoundingClientRect().width : 0;

    if (measureContext) {
      measureContext.font = `${fontSize}px ${style.fontFamily}`;
    }
  }

  function measureTextWidth(text) {
    if (!measureContext) {
      return text.length * 8;
    }
    return measureContext.measureText(text).width;
  }

  function renderEditor() {
    if (!state.report) {
      els.editorInner.innerHTML = '<div class="empty-note editor-empty">Open a report from the list to begin.</div>';
      return;
    }

    const selection = selectionRange();
    const lines = state.document.lines;
    const lineCountWidth = Math.max(4, String(lines.length).length);
    document.documentElement.style.setProperty('--gutter-width', `${lineCountWidth + 1.5}ch`);

    const scrollTop = els.editorViewport.scrollTop;
    const scrollLeft = els.editorViewport.scrollLeft;

    const html = [];
    for (const line of lines) {
      const localStart = Math.max(0, selection.start - line.start);
      const localEnd = Math.min(line.text.length, selection.end - line.start);
      let content = escapeHtml(line.text);
      if (selection.end > selection.start && localEnd > localStart) {
        content = `${escapeHtml(line.text.slice(0, localStart))}<span class="selection">${escapeHtml(line.text.slice(localStart, localEnd))}</span>${escapeHtml(line.text.slice(localEnd))}`;
      }
      html.push(`
        <div class="editor-line" data-line-index="${line.index}">
          <span class="line-number">${line.index + 1}</span>
          <span class="line-content">${content || '&#8203;'}</span>
        </div>
      `);
    }

    const caretOffsets = getAllCaretOffsets();
    for (let index = 0; index < caretOffsets.length; index += 1) {
      const offset = caretOffsets[index];
      const position = pixelPositionForOffset(offset);
      html.push(`<div class="caret ${index === 0 ? 'primary' : 'secondary'}" style="left:${position.x}px; top:${position.y}px;"></div>`);
    }

    els.editorInner.innerHTML = html.join('');
    updateLayoutMetrics();

    requestAnimationFrame(() => {
      els.editorViewport.scrollTop = scrollTop;
      els.editorViewport.scrollLeft = scrollLeft;
      updateLayoutMetrics();
      renderButtons();
      renderSaveState();
    });
  }

  function pixelPositionForOffset(offset) {
    const pos = lineColumnPosition(offset);
    const prefix = pos.line.text.slice(0, graphemeOffsetFromColumn(pos.line, pos.column));
    const x = state.layout.paddingLeft + state.layout.gutterWidth + measureTextWidth(prefix);
    const y = state.layout.paddingTop + pos.lineIndex * state.layout.lineHeight;
    return { x, y };
  }

  function scrollPrimaryCaretIntoView(forceTop = false) {
    if (!state.report) {
      return;
    }
    const offset = getPrimaryCaretOffset();
    const pos = pixelPositionForOffset(offset);
    const viewport = els.editorViewport;
    const margin = 48;
    const caretTop = pos.y;
    const caretBottom = pos.y + state.layout.lineHeight;
    const caretLeft = pos.x;
    const caretRight = pos.x + 2;

    if (forceTop) {
      viewport.scrollTop = 0;
      viewport.scrollLeft = 0;
      return;
    }

    if (caretTop < viewport.scrollTop + margin) {
      viewport.scrollTop = Math.max(0, caretTop - margin);
    } else if (caretBottom > viewport.scrollTop + viewport.clientHeight - margin) {
      viewport.scrollTop = caretBottom - viewport.clientHeight + margin;
    }

    if (caretLeft < viewport.scrollLeft + margin) {
      viewport.scrollLeft = Math.max(0, caretLeft - margin);
    } else if (caretRight > viewport.scrollLeft + viewport.clientWidth - margin) {
      viewport.scrollLeft = caretRight - viewport.clientWidth + margin;
    }
  }

  function renderAll() {
    renderReportHeader();
    renderReportList();
    renderHistory();
    renderPreview();
    renderCursorState();
    renderFindCount();
    renderSaveState();
    renderButtons();
    renderEditor();
  }

  function positionFromClientPoint(clientX, clientY) {
    const viewportRect = els.editorViewport.getBoundingClientRect();
    const localX = clientX - viewportRect.left + els.editorViewport.scrollLeft - state.layout.paddingLeft - state.layout.gutterWidth;
    const localY = clientY - viewportRect.top + els.editorViewport.scrollTop - state.layout.paddingTop;
    const lineIndex = clamp(Math.floor(localY / state.layout.lineHeight), 0, state.document.lines.length - 1);
    const line = state.document.lines[lineIndex];
    const x = Math.max(0, localX);
    const column = columnFromX(line, x);
    return line.start + graphemeOffsetFromColumn(line, column);
  }

  function columnFromX(line, x) {
    const boundaries = line.graphemeBoundaries;
    if (!line.text.length) {
      return 0;
    }

    const widths = boundaries.map((boundary) => measureTextWidth(line.text.slice(0, boundary)));
    let low = 0;
    let high = widths.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (widths[mid] < x) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    if (low === 0) {
      return 0;
    }
    if (low >= widths.length) {
      return line.graphemeCount;
    }

    const prevWidth = widths[low - 1];
    const currentWidth = widths[low];
    return (x - prevWidth) < (currentWidth - x) ? low - 1 : low;
  }

  function selectWordAt(offset) {
    const matches = state.document.wordSegments.filter((segment) => segment.isWordLike && segment.start <= offset && segment.end >= offset);
    const match = matches[0] || state.document.wordSegments.find((segment) => segment.isWordLike && segment.start > offset);
    if (!match) {
      collapseTo(offset);
      return;
    }
    selectRange(match.start, match.end);
  }

  function selectLineAt(offset) {
    const current = currentLineData(offset);
    const end = current.line.hasBreak ? current.line.nextStart : current.line.end;
    selectRange(current.line.start, end);
  }

  function addCaretAt(offset) {
    endEditSession();
    const offsets = getAllCaretOffsets();
    offsets.push(offset);
    applySelectionAfterEdit(offsets, lineColumnPosition(offset).column);
  }

  function handlePointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    if (event.target.closest('button') || event.target.closest('input')) {
      return;
    }
    event.preventDefault();
    els.editorViewport.focus();
    updateLayoutMetrics();
    const offset = positionFromClientPoint(event.clientX, event.clientY);

    if (event.altKey || hasPrimaryModifier(event)) {
      addCaretAt(offset);
      state.dragging = false;
      state.dragMode = 'multi';
      renderAll();
      scrollPrimaryCaretIntoView();
      return;
    }

    if (event.detail >= 3) {
      selectLineAt(offset);
      state.dragging = false;
      state.dragMode = 'selection';
      renderAll();
      scrollPrimaryCaretIntoView();
      return;
    }

    if (event.detail === 2) {
      selectWordAt(offset);
      state.dragging = false;
      state.dragMode = 'selection';
      renderAll();
      scrollPrimaryCaretIntoView();
      return;
    }

    if (event.shiftKey) {
      const base = state.selection.anchor;
      selectRange(base, offset);
      state.dragging = true;
      state.dragMode = 'selection';
      state.dragPointerId = event.pointerId;
      state.dragHasStarted = true;
      renderAll();
      return;
    }

    collapseTo(offset);
    state.dragging = true;
    state.dragMode = 'selection';
    state.dragPointerId = event.pointerId;
    state.dragHasStarted = true;
    renderAll();
  }

  function handlePointerMove(event) {
    if (!state.dragging || state.dragPointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    const offset = positionFromClientPoint(event.clientX, event.clientY);
    selectRange(state.selection.anchor, offset);
    autoScrollForPointer(event.clientX, event.clientY);
    renderAll();
  }

  function handlePointerUp(event) {
    if (state.dragPointerId !== event.pointerId) {
      return;
    }
    state.dragging = false;
    state.dragPointerId = null;
    state.dragHasStarted = false;
    renderAll();
  }

  function autoScrollForPointer(clientX, clientY) {
    const rect = els.editorViewport.getBoundingClientRect();
    const edge = 36;
    if (clientY < rect.top + edge) {
      els.editorViewport.scrollTop -= 24;
    } else if (clientY > rect.bottom - edge) {
      els.editorViewport.scrollTop += 24;
    }
    if (clientX < rect.left + edge) {
      els.editorViewport.scrollLeft -= 24;
    } else if (clientX > rect.right - edge) {
      els.editorViewport.scrollLeft += 24;
    }
  }

  function handleDocumentCopy(event) {
    if (!isEditorFocused()) {
      return;
    }
    const range = getSelectionRange();
    if (range.start === range.end || state.extraCarets.length) {
      return;
    }
    event.preventDefault();
    const text = state.text.slice(range.start, range.end);
    event.clipboardData.setData('text/plain', text);
  }

  function handleDocumentCut(event) {
    if (!isEditorFocused()) {
      return;
    }
    const range = getSelectionRange();
    if (range.start === range.end || state.extraCarets.length) {
      return;
    }
    event.preventDefault();
    event.clipboardData.setData('text/plain', state.text.slice(range.start, range.end));
    deleteRange(range.start, range.end, 'cut');
  }

  function handleDocumentPaste(event) {
    if (!isEditorFocused()) {
      return;
    }
    const text = event.clipboardData.getData('text/plain');
    if (!text) {
      return;
    }
    event.preventDefault();
    insertText(text, 'paste');
  }

  function handleEditorKeyDown(event) {
    if (!state.report) {
      return;
    }

    if (hasPrimaryModifier(event) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      els.findInput.focus();
      els.findInput.select();
      return;
    }

    if (event.key === 'F3') {
      event.preventDefault();
      navigateMatches(event.shiftKey ? -1 : 1);
      return;
    }

    if (hasPrimaryModifier(event) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveReport();
      return;
    }

    if (hasPrimaryModifier(event) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      selectAll();
      return;
    }

    if (hasPrimaryModifier(event) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    if (hasPrimaryModifier(event) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      els.findInput.focus();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      indentSelection(event.shiftKey);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      insertText('\n', 'typing');
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      if (hasPrimaryModifier(event)) {
        deleteByWord(-1);
      } else {
        deleteBackward('delete');
      }
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      if (hasPrimaryModifier(event)) {
        deleteByWord(1);
      } else {
        deleteForward('delete');
      }
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveSelection(-1, event.shiftKey, hasPrimaryModifier(event), false);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveSelection(1, event.shiftKey, hasPrimaryModifier(event), false);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(-1, event.shiftKey, false, true);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelection(1, event.shiftKey, false, true);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      moveToLineEdge('start', event.shiftKey);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      moveToLineEdge('end', event.shiftKey);
      return;
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      if (event.key === '\r') {
        return;
      }
      event.preventDefault();
      insertText(event.key, 'typing');
    }
  }

  function deleteByWord(direction) {
    const offsets = getAllCaretOffsets();
    const edits = [];
    for (const offset of offsets) {
      const boundary = direction < 0 ? previousWordBoundary(offset) : nextWordBoundary(offset);
      if (boundary !== offset) {
        if (direction < 0) {
          edits.push({ start: boundary, end: offset, insert: '' });
        } else {
          edits.push({ start: offset, end: boundary, insert: '' });
        }
      }
    }
    applyBatchEdits(edits, 'deleteWord');
  }

  function previousWordBoundary(offset) {
    const segments = state.document.wordSegments;
    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const segment = segments[index];
      if (segment.isWordLike && segment.end < offset) {
        return segment.start;
      }
      if (segment.isWordLike && segment.start < offset && segment.end >= offset) {
        return segment.start;
      }
    }
    return 0;
  }

  function nextWordBoundary(offset) {
    const segments = state.document.wordSegments;
    for (const segment of segments) {
      if (segment.isWordLike && segment.start > offset) {
        return segment.start;
      }
      if (segment.isWordLike && segment.start <= offset && segment.end > offset) {
        return segment.end;
      }
    }
    return state.document.text.length;
  }

  function moveToLineEdge(edge, withShift) {
    endEditSession();
    state.extraCarets = [];
    const current = currentLineData(getPrimaryCaretOffset());
    const next = edge === 'start'
      ? current.line.start
      : current.line.hasBreak
        ? current.line.nextStart
        : current.line.end;
    if (withShift) {
      state.selection.focus = next;
    } else {
      state.selection = { anchor: next, focus: next };
    }
    state.preferredColumn = edge === 'start' ? 0 : current.line.graphemeCount;
    renderAll();
    scrollPrimaryCaretIntoView();
  }

  function undo() {
    if (!state.undoStack.length) {
      setFeedback('Nothing to undo.', 'info');
      return;
    }
    state.redoStack.push({
      text: state.text,
      selection: cloneSelection(state.selection),
      extraCarets: [...state.extraCarets],
      preferredColumn: state.preferredColumn,
    });
    const snapshot = state.undoStack.pop();
    restoreSnapshot(snapshot);
    setFeedback('Undid the last edit.', 'info');
  }

  function redo() {
    if (!state.redoStack.length) {
      setFeedback('Nothing to redo.', 'info');
      return;
    }
    state.undoStack.push({
      text: state.text,
      selection: cloneSelection(state.selection),
      extraCarets: [...state.extraCarets],
      preferredColumn: state.preferredColumn,
    });
    const snapshot = state.redoStack.pop();
    restoreSnapshot(snapshot);
    setFeedback('Redid the last edit.', 'info');
  }

  function handleFindInputKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      els.editorViewport.focus();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      navigateMatches(event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === 'Tab') {
      return;
    }
  }

  function bindEvents() {
    els.saveButton.addEventListener('click', saveReport);
    els.undoButton.addEventListener('click', undo);
    els.redoButton.addEventListener('click', redo);
    els.findNextButton.addEventListener('click', () => navigateMatches(1));
    els.findPrevButton.addEventListener('click', () => navigateMatches(-1));
    els.replaceCurrentButton.addEventListener('click', replaceCurrentMatch);
    els.replaceAllButton.addEventListener('click', replaceAllMatches);
    els.reloadButton.addEventListener('click', reloadReport);
    els.discardButton.addEventListener('click', discardDraft);
    els.findInput.addEventListener('input', onFindInput);
    els.findInput.addEventListener('keydown', handleFindInputKeyDown);
    els.replaceInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        replaceCurrentMatch();
      }
    });

    els.editorViewport.addEventListener('keydown', handleEditorKeyDown);
    els.editorViewport.addEventListener('pointerdown', handlePointerDown);
    els.editorViewport.addEventListener('pointermove', handlePointerMove);
    els.editorViewport.addEventListener('pointerup', handlePointerUp);
    els.editorViewport.addEventListener('pointercancel', handlePointerUp);
    document.addEventListener('copy', handleDocumentCopy);
    document.addEventListener('cut', handleDocumentCut);
    document.addEventListener('paste', handleDocumentPaste);

    window.addEventListener('resize', () => {
      updateLayoutMetrics();
      renderAll();
    });

    els.editorViewport.addEventListener('scroll', () => {
      updateLayoutMetrics();
      renderCursorState();
    });
  }

  function initialize() {
    bootstrap.reports = safeParseBootstrap().reports || [];
    state.reports = bootstrap.reports;
    bindEvents();
    renderAll();
    renderFeedback();
    renderButtons();
    if (state.selectedReportId) {
      openReport(state.selectedReportId, { force: true });
    } else if (state.reports.length) {
      openReport(state.reports[0].id, { force: true });
    } else {
      setFeedback('No reports are available.', 'warning');
    }
  }

  initialize();
})();

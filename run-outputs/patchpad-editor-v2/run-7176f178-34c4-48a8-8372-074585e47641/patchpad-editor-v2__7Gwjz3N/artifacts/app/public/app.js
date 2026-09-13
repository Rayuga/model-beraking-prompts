(() => {
  const bootstrap = window.__PATCHPAD_BOOTSTRAP__ || { reports: [], currentId: null };
  const appRoot = document.getElementById('app');

  appRoot.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="section-label">Reports</div>
        <div id="reportList" class="report-list"></div>
      </aside>

      <div class="main">
        <div class="header">
          <div class="header-top">
            <div class="title-block">
              <div id="reportTitle" class="editor-title">PatchPad</div>
              <div id="reportSubtitle" class="title-subtitle">Loading report…</div>
            </div>
            <div class="toolbar">
              <button id="saveButton" type="button">Save</button>
              <button id="undoButton" type="button">Undo</button>
              <button id="redoButton" type="button">Redo</button>
              <button id="reloadButton" type="button">Reload latest</button>
              <button id="discardButton" type="button">Discard draft</button>
            </div>
          </div>

          <div class="findbar">
            <div class="find-group">
              <div class="find-label">Find</div>
              <input id="findInput" type="text" autocomplete="off" spellcheck="false" placeholder="Find text" />
              <span id="findCount" class="find-count">0 matches</span>
            </div>
            <div class="find-group">
              <div class="find-label">Replace</div>
              <input id="replaceInput" type="text" autocomplete="off" spellcheck="false" placeholder="Replace with" />
            </div>
            <div class="find-actions">
              <button id="findPrevButton" type="button">Find Previous</button>
              <button id="findNextButton" type="button">Find Next</button>
              <button id="replaceCurrentButton" type="button">Replace Current</button>
              <button id="replaceAllButton" type="button">Replace All</button>
            </div>
          </div>

          <div class="statusbar">
            <div id="saveState" class="status-line">Loading report…</div>
            <div id="cursorLine" class="cursor-line">Ln 1, Col 1</div>
            <div id="messageBar" class="message info">Ready.</div>
          </div>

          <div id="conflictBanner" class="message-banner hidden" aria-live="polite">
            <div id="conflictText">Conflict detected.</div>
            <div class="banner-actions">
              <button id="conflictReloadButton" type="button">Reload server copy</button>
              <button id="conflictDiscardButton" type="button">Discard local draft</button>
            </div>
          </div>
        </div>

        <div class="workspace">
          <div class="editor-panel">
            <div class="editor-shell">
              <div id="editorSurface" class="editor-scroller" tabindex="0" aria-label="Incident report editor">
                <div id="documentHost" class="document"></div>
              </div>
            </div>
          </div>

          <aside class="side-panel history-panel">
            <div class="section-label">Revision history</div>
            <div id="revisionList" class="revision-list"></div>
            <div id="previewCard" class="preview-card">
              <div class="revision-header">
                <div id="previewTitle" class="revision-number">Preview</div>
                <div id="previewMeta" class="revision-meta"></div>
              </div>
              <div id="previewContent" class="preview-content">Select a revision to preview it.</div>
              <div class="preview-actions">
                <button id="clearPreviewButton" type="button">Clear preview</button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  `;

  const refs = {
    reportList: document.getElementById('reportList'),
    reportTitle: document.getElementById('reportTitle'),
    reportSubtitle: document.getElementById('reportSubtitle'),
    saveButton: document.getElementById('saveButton'),
    undoButton: document.getElementById('undoButton'),
    redoButton: document.getElementById('redoButton'),
    reloadButton: document.getElementById('reloadButton'),
    discardButton: document.getElementById('discardButton'),
    findInput: document.getElementById('findInput'),
    replaceInput: document.getElementById('replaceInput'),
    findCount: document.getElementById('findCount'),
    findPrevButton: document.getElementById('findPrevButton'),
    findNextButton: document.getElementById('findNextButton'),
    replaceCurrentButton: document.getElementById('replaceCurrentButton'),
    replaceAllButton: document.getElementById('replaceAllButton'),
    saveState: document.getElementById('saveState'),
    cursorLine: document.getElementById('cursorLine'),
    messageBar: document.getElementById('messageBar'),
    conflictBanner: document.getElementById('conflictBanner'),
    conflictText: document.getElementById('conflictText'),
    conflictReloadButton: document.getElementById('conflictReloadButton'),
    conflictDiscardButton: document.getElementById('conflictDiscardButton'),
    editorSurface: document.getElementById('editorSurface'),
    documentHost: document.getElementById('documentHost'),
    revisionList: document.getElementById('revisionList'),
    previewTitle: document.getElementById('previewTitle'),
    previewMeta: document.getElementById('previewMeta'),
    previewContent: document.getElementById('previewContent'),
    clearPreviewButton: document.getElementById('clearPreviewButton'),
  };

  const graphemeSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;
  const wordSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter(undefined, { granularity: 'word' })
    : null;

  const state = {
    reports: Array.isArray(bootstrap.reports) ? bootstrap.reports.slice() : [],
    currentReportId: bootstrap.currentId || null,
    report: null,
    text: '',
    savedContent: '',
    savedRevision: 1,
    baseRevision: 1,
    selections: [{ anchor: 0, focus: 0 }],
    history: [],
    historyMeta: [],
    historyIndex: -1,
    preferredColumn: null,
    findQuery: '',
    matches: [],
    activeMatchIndex: -1,
    preview: null,
    dirty: false,
    message: { type: 'info', text: 'Ready.' },
    conflictMessage: '',
    dragging: null,
    charWidth: 8,
    lineHeight: 22,
    docPaddingTop: 0,
    docPaddingLeft: 0,
    renderQueued: false,
  };

  const TAB_SIZE = 4;
  const INDENT = '  ';

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeLineBreaks(value) {
    return String(value).replace(/\r\n?/g, '\n');
  }

  function cloneSelections(selections) {
    return selections.map((selection) => ({
      anchor: selection.anchor,
      focus: selection.focus,
    }));
  }

  function selectionSpan(selection) {
    return selection.anchor <= selection.focus
      ? { start: selection.anchor, end: selection.focus }
      : { start: selection.focus, end: selection.anchor };
  }

  function normalizeSelections(selections) {
    const spans = selections.map(selectionSpan).sort((a, b) => a.start - b.start || a.end - b.end);
    if (!spans.length) {
      return [{ anchor: 0, focus: 0 }];
    }

    const merged = [];
    for (const span of spans) {
      const last = merged[merged.length - 1];
      if (!last || span.start > last.end) {
        merged.push({ start: span.start, end: span.end });
      } else {
        last.end = Math.max(last.end, span.end);
      }
    }

    return merged.map((span) => ({ anchor: span.start, focus: span.end }));
  }

  function isCollapsed(selection) {
    return selection.anchor === selection.focus;
  }

  function primarySelection() {
    return state.selections[0] || { anchor: 0, focus: 0 };
  }

  function currentSnapshot() {
    return {
      text: state.text,
      selections: cloneSelections(state.selections),
      preferredColumn: state.preferredColumn,
    };
  }

  function resetHistory() {
    state.history = [currentSnapshot()];
    state.historyMeta = [{ kind: 'init', endPos: 0, time: Date.now() }];
    state.historyIndex = 0;
  }

  function setMessage(type, text) {
    state.message = { type, text };
    scheduleRender();
  }

  function setConflict(message) {
    state.conflictMessage = message;
    scheduleRender();
  }

  function updateDirtyFlag() {
    state.dirty = state.text !== state.savedContent;
  }

  function buildLines(text) {
    const lines = [];
    const rawLines = String(text).split('\n');
    let start = 0;
    for (let index = 0; index < rawLines.length; index += 1) {
      const lineText = rawLines[index];
      const end = start + lineText.length;
      lines.push({ index, start, end, text: lineText });
      start = end + 1;
    }
    if (!lines.length) {
      lines.push({ index: 0, start: 0, end: 0, text: '' });
    }
    return lines;
  }

  function lineIndexFromPosition(position, lines) {
    let low = 0;
    let high = lines.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const line = lines[mid];
      if (position < line.start) {
        high = mid - 1;
      } else if (position > line.end) {
        low = mid + 1;
      } else {
        return mid;
      }
    }
    return Math.max(0, Math.min(lines.length - 1, low));
  }

  function lineColToPosition(lineIndex, column, lines) {
    const line = lines[Math.max(0, Math.min(lines.length - 1, lineIndex))];
    const text = line.text;
    let visualColumn = 0;
    let position = 0;

    for (const segment of segmentGraphemes(text)) {
      const width = graphemeVisualWidth(segment, visualColumn);
      if (visualColumn + width > column) {
        break;
      }
      visualColumn += width;
      position = segment.index + segment.segment.length;
    }

    return line.start + position;
  }

  function positionToLineCol(position, lines) {
    const lineIndex = lineIndexFromPosition(position, lines);
    const line = lines[lineIndex];
    const localPosition = Math.max(0, Math.min(position - line.start, line.text.length));
    let column = 0;

    for (const segment of segmentGraphemes(line.text)) {
      if (segment.index >= localPosition) {
        break;
      }
      column += graphemeVisualWidth(segment, column);
    }

    return { lineIndex, column };
  }

  function graphemeVisualWidth(segment, currentColumn) {
    if (segment.segment === '\t') {
      return TAB_SIZE - (currentColumn % TAB_SIZE || TAB_SIZE);
    }
    return 1;
  }

  function segmentGraphemes(text) {
    if (!graphemeSegmenter) {
      const segments = [];
      let index = 0;
      for (const char of text) {
        segments.push({ segment: char, index });
        index += char.length;
      }
      return segments;
    }
    return Array.from(graphemeSegmenter.segment(text), (part) => ({
      segment: part.segment,
      index: part.index,
    }));
  }

  function prevGraphemeIndex(text, position) {
    if (position <= 0) {
      return 0;
    }
    const prefix = text.slice(0, position);
    const segments = segmentGraphemes(prefix);
    if (!segments.length) {
      return 0;
    }
    return segments[segments.length - 1].index;
  }

  function nextGraphemeIndex(text, position) {
    if (position >= text.length) {
      return text.length;
    }
    const suffix = text.slice(position);
    const segments = segmentGraphemes(suffix);
    if (!segments.length) {
      return text.length;
    }
    return position + segments[0].segment.length;
  }

  function isWordSegment(segment) {
    return /[\p{L}\p{N}_]/u.test(segment);
  }

  function wordLeft(text, position) {
    if (position <= 0) {
      return 0;
    }
    const prefix = segmentGraphemes(text.slice(0, position));
    if (!prefix.length) {
      return 0;
    }
    let index = prefix.length - 1;
    while (index >= 0 && !isWordSegment(prefix[index].segment)) {
      index -= 1;
    }
    if (index < 0) {
      return 0;
    }
    while (index >= 0 && isWordSegment(prefix[index].segment)) {
      index -= 1;
    }
    return prefix[index + 1] ? prefix[index + 1].index : 0;
  }

  function wordRight(text, position) {
    if (position >= text.length) {
      return text.length;
    }
    const suffix = segmentGraphemes(text.slice(position));
    if (!suffix.length) {
      return text.length;
    }
    let index = 0;
    while (index < suffix.length && !isWordSegment(suffix[index].segment)) {
      index += 1;
    }
    if (index >= suffix.length) {
      return text.length;
    }
    while (index < suffix.length && isWordSegment(suffix[index].segment)) {
      index += 1;
    }
    return position + (suffix[index] ? suffix[index].index : suffix[suffix.length - 1].index + suffix[suffix.length - 1].segment.length);
  }

  function selectionText(selection) {
    const span = selectionSpan(selection);
    return state.text.slice(span.start, span.end);
  }

  function selectedRanges() {
    return normalizeSelections(state.selections).map(selectionSpan);
  }

  function replaceRanges(text, spans, replacementFactory) {
    const merged = spans
      .filter((span) => span.end >= span.start)
      .sort((a, b) => a.start - b.start || a.end - b.end);

    if (!merged.length) {
      return { text, selections: cloneSelections(state.selections) };
    }

    const compact = [];
    for (const span of merged) {
      const last = compact[compact.length - 1];
      if (!last || span.start > last.end) {
        compact.push({ start: span.start, end: span.end });
      } else {
        last.end = Math.max(last.end, span.end);
      }
    }

    let result = '';
    let cursor = 0;
    const nextSelections = [];

    for (const span of compact) {
      result += text.slice(cursor, span.start);
      const insert = typeof replacementFactory === 'function'
        ? replacementFactory(span)
        : replacementFactory;
      result += insert;
      const caret = result.length;
      nextSelections.push({ anchor: caret, focus: caret });
      cursor = span.end;
    }

    result += text.slice(cursor);
    return { text: result, selections: nextSelections };
  }

  function commitHistory(action) {
    const snapshot = currentSnapshot();
    const now = Date.now();

    if (state.historyIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.historyIndex + 1);
      state.historyMeta = state.historyMeta.slice(0, state.historyIndex + 1);
    }

    const lastMeta = state.historyMeta[state.historyIndex];
    const canMergeTyping = action.kind === 'typing'
      && state.historyIndex === state.history.length - 1
      && lastMeta
      && lastMeta.kind === 'typing'
      && lastMeta.endPos === action.prevEndPos
      && now - lastMeta.time < 800
      && action.singleCaret;

    if (canMergeTyping) {
      state.history[state.historyIndex] = snapshot;
      state.historyMeta[state.historyIndex] = { ...action, time: now };
    } else {
      state.history.push(snapshot);
      state.historyMeta.push({ ...action, time: now });
      state.historyIndex = state.history.length - 1;
    }
  }

  function applyStateChange(nextText, nextSelections, action) {
    state.text = normalizeLineBreaks(nextText);
    state.selections = normalizeSelections(nextSelections);
    state.preferredColumn = action && action.resetPreferredColumn === false ? state.preferredColumn : null;
    updateDirtyFlag();
    state.conflictMessage = '';
    if (action && action.recordHistory !== false) {
      commitHistory(action);
    }
    refreshFindState(false);
    scheduleRender();
  }

  function restoreSnapshot(snapshot) {
    state.text = snapshot.text;
    state.selections = cloneSelections(snapshot.selections);
    state.preferredColumn = snapshot.preferredColumn ?? null;
    updateDirtyFlag();
    state.conflictMessage = '';
    refreshFindState(false);
    scheduleRender();
  }

  function undo() {
    if (state.historyIndex <= 0) {
      setMessage('info', 'Nothing to undo.');
      return;
    }
    state.historyIndex -= 1;
    restoreSnapshot(state.history[state.historyIndex]);
    setMessage('info', 'Undid the last edit.');
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) {
      setMessage('info', 'Nothing to redo.');
      return;
    }
    state.historyIndex += 1;
    restoreSnapshot(state.history[state.historyIndex]);
    setMessage('info', 'Redid the last edit.');
  }

  function insertText(text, kind = 'typing') {
    const normalized = normalizeLineBreaks(text);
    const ranges = selectedRanges();
    const singleCaret = ranges.length === 1 && ranges[0].start === ranges[0].end;
    const prevEndPos = primarySelection().focus;

    const { text: nextText, selections: nextSelections } = replaceRanges(state.text, ranges, normalized);
    const action = {
      kind,
      prevEndPos,
      endPos: nextSelections[0] ? nextSelections[0].focus : prevEndPos,
      singleCaret,
    };
    applyStateChange(nextText, nextSelections, action);
  }

  function deleteByDirection(direction) {
    const spans = [];
    for (const selection of normalizeSelections(state.selections)) {
      const span = selectionSpan(selection);
      if (span.end > span.start) {
        spans.push(span);
        continue;
      }
      if (direction === 'backward') {
        const start = prevGraphemeIndex(state.text, span.start);
        if (start !== span.start) {
          spans.push({ start, end: span.start });
        }
      } else {
        const end = nextGraphemeIndex(state.text, span.end);
        if (end !== span.end) {
          spans.push({ start: span.start, end });
        }
      }
    }

    if (!spans.length) {
      setMessage('info', 'Nothing to delete.');
      return;
    }

    const { text: nextText, selections: nextSelections } = replaceRanges(state.text, spans, '');
    applyStateChange(nextText, nextSelections, { kind: 'delete', endPos: nextSelections[0] ? nextSelections[0].focus : 0, singleCaret: false });
  }

  function changeSelectionPositions(mapper, actionKind, recordHistory = true) {
    const nextSelections = state.selections.map((selection) => {
      const nextAnchor = mapper(selection.anchor);
      const nextFocus = mapper(selection.focus);
      return { anchor: nextAnchor, focus: nextFocus };
    });
    applyStateChange(state.text, nextSelections, {
      kind: actionKind,
      prevEndPos: primarySelection().focus,
      endPos: nextSelections[0] ? nextSelections[0].focus : 0,
      singleCaret: nextSelections.length === 1 && isCollapsed(nextSelections[0]),
      recordHistory,
      resetPreferredColumn: true,
    });
  }

  function moveSelections(direction, extendSelection = false, wordMotion = false, homeEnd = null) {
    const lines = state.linesCache || buildLines(state.text);
    const nextSelections = state.selections.map((selection) => {
      const span = selectionSpan(selection);
      const anchor = selection.anchor;
      let target = selection.focus;
      if (!extendSelection) {
        if (direction === 'left' || homeEnd === 'home') {
          target = span.start;
        } else if (direction === 'right' || homeEnd === 'end') {
          target = span.end;
        }
      }

      let nextPosition = target;

      if (homeEnd === 'home') {
        const lineIndex = lineIndexFromPosition(target, lines);
        nextPosition = lines[lineIndex].start;
      } else if (homeEnd === 'end') {
        const lineIndex = lineIndexFromPosition(target, lines);
        nextPosition = lines[lineIndex].end;
      } else if (direction === 'left') {
        nextPosition = wordMotion ? wordLeft(state.text, target) : prevGraphemeIndex(state.text, target);
      } else if (direction === 'right') {
        nextPosition = wordMotion ? wordRight(state.text, target) : nextGraphemeIndex(state.text, target);
      } else if (direction === 'up' || direction === 'down') {
        const lineInfo = positionToLineCol(target, lines);
        const desiredColumn = state.preferredColumn ?? lineInfo.column;
        const nextLineIndex = direction === 'up' ? Math.max(0, lineInfo.lineIndex - 1) : Math.min(lines.length - 1, lineInfo.lineIndex + 1);
        nextPosition = lineColToPosition(nextLineIndex, desiredColumn, lines);
      }

      if (extendSelection) {
        return { anchor, focus: nextPosition };
      }
      return { anchor: nextPosition, focus: nextPosition };
    });

    if (direction === 'up' || direction === 'down') {
      const primaryLineInfo = positionToLineCol(primarySelection().focus, lines);
      state.preferredColumn = state.preferredColumn ?? primaryLineInfo.column;
    } else {
      state.preferredColumn = null;
    }

    applyStateChange(state.text, nextSelections, {
      kind: 'move',
      prevEndPos: primarySelection().focus,
      endPos: nextSelections[0] ? nextSelections[0].focus : 0,
      singleCaret: nextSelections.length === 1 && isCollapsed(nextSelections[0]),
      recordHistory: false,
      resetPreferredColumn: false,
    });
  }

  function selectAll() {
    applyStateChange(state.text, [{ anchor: 0, focus: state.text.length }], {
      kind: 'select-all',
      prevEndPos: primarySelection().focus,
      endPos: state.text.length,
      singleCaret: false,
      recordHistory: false,
      resetPreferredColumn: true,
    });
    setMessage('info', 'Selected the entire report.');
  }

  function selectWordAt(position) {
    const start = wordLeft(state.text, position);
    const end = wordRight(state.text, position);
    applyStateChange(state.text, [{ anchor: start, focus: end }], {
      kind: 'select-word',
      prevEndPos: primarySelection().focus,
      endPos: end,
      singleCaret: false,
      recordHistory: false,
      resetPreferredColumn: true,
    });
  }

  function selectLineAt(position) {
    const lines = state.linesCache || buildLines(state.text);
    const lineIndex = lineIndexFromPosition(position, lines);
    applyStateChange(state.text, [{ anchor: lines[lineIndex].start, focus: lines[lineIndex].end }], {
      kind: 'select-line',
      prevEndPos: primarySelection().focus,
      endPos: lines[lineIndex].end,
      singleCaret: false,
      recordHistory: false,
      resetPreferredColumn: true,
    });
  }

  function positionFromPoint(clientX, clientY) {
    const scroller = refs.editorSurface;
    const containerRect = scroller.getBoundingClientRect();
    const lines = state.linesCache || buildLines(state.text);
    const y = clientY - containerRect.top + scroller.scrollTop - state.docPaddingTop;
    const lineHeight = state.lineHeight || 22;
    const lineIndex = Math.max(0, Math.min(lines.length - 1, Math.floor(y / lineHeight)));
    const row = refs.documentHost.querySelector(`.line-row[data-line="${lineIndex}"]`);
    if (!row) {
      return state.text.length;
    }
    const textEl = row.querySelector('.line-text');
    const rect = textEl.getBoundingClientRect();
    const line = lines[lineIndex];
    const x = clientX - rect.left + scroller.scrollLeft;
    return lineColToPosition(lineIndex, columnFromX(line.text, x), lines);
  }

  function columnFromX(lineText, x) {
    if (x <= 0) {
      return 0;
    }
    let visual = 0;
    for (const segment of segmentGraphemes(lineText)) {
      const width = graphemeVisualWidth(segment, visual);
      const nextVisual = visual + width;
      const segmentCenter = (visual + nextVisual) / 2;
      if (x / state.charWidth < segmentCenter) {
        return visual;
      }
      visual = nextVisual;
    }
    return visual;
  }

  function extractSelectedText() {
    const parts = [];
    for (const range of selectedRanges()) {
      if (range.end > range.start) {
        parts.push(state.text.slice(range.start, range.end));
      }
    }
    return parts.join('\n');
  }

  function buildFindMatches(text, query) {
    if (!query) {
      return [];
    }
    const matches = [];
    let start = 0;
    while (start <= text.length) {
      const index = text.indexOf(query, start);
      if (index === -1) {
        break;
      }
      matches.push({ start: index, end: index + query.length });
      start = index + Math.max(1, query.length);
    }
    return matches;
  }

  function refreshFindState(selectMatch) {
    state.matches = buildFindMatches(state.text, state.findQuery);
    if (!state.matches.length) {
      state.activeMatchIndex = -1;
      if (selectMatch) {
        state.selections = [{ anchor: 0, focus: 0 }];
      }
      return;
    }

    if (state.activeMatchIndex < 0 || state.activeMatchIndex >= state.matches.length) {
      state.activeMatchIndex = 0;
    }

    if (selectMatch) {
      const match = state.matches[state.activeMatchIndex];
      state.selections = [{ anchor: match.start, focus: match.end }];
    }
  }

  function selectMatch(index) {
    if (!state.matches.length) {
      setMessage('warning', 'No matches found.');
      return;
    }
    const normalizedIndex = ((index % state.matches.length) + state.matches.length) % state.matches.length;
    state.activeMatchIndex = normalizedIndex;
    const match = state.matches[normalizedIndex];
    state.selections = [{ anchor: match.start, focus: match.end }];
    state.preferredColumn = null;
    setMessage('info', `Match ${normalizedIndex + 1} of ${state.matches.length}.`);
    scheduleRender();
  }

  function gotoNextMatch(direction) {
    if (!state.matches.length) {
      setMessage('warning', 'No matches found.');
      return;
    }
    const nextIndex = state.activeMatchIndex === -1
      ? (direction > 0 ? 0 : state.matches.length - 1)
      : state.activeMatchIndex + direction;
    selectMatch(nextIndex);
  }

  function replaceCurrent() {
    if (!state.matches.length) {
      setMessage('warning', 'No matches to replace.');
      return;
    }
    const currentSelection = selectionSpan(primarySelection());
    let matchIndex = state.activeMatchIndex;
    if (matchIndex < 0 || matchIndex >= state.matches.length) {
      matchIndex = state.matches.findIndex((match) => match.start === currentSelection.start && match.end === currentSelection.end);
    }
    if (matchIndex < 0) {
      setMessage('warning', 'Select a match before replacing it.');
      return;
    }
    const replacement = normalizeLineBreaks(refs.replaceInput.value);
    const match = state.matches[matchIndex];
    const nextText = state.text.slice(0, match.start) + replacement + state.text.slice(match.end);
    const nextCaret = match.start + replacement.length;
    applyStateChange(nextText, [{ anchor: nextCaret, focus: nextCaret }], {
      kind: 'replace-one',
      prevEndPos: match.start,
      endPos: nextCaret,
      singleCaret: true,
    });
    setMessage('success', 'Replaced the active match.');
  }

  function replaceAll() {
    if (!state.findQuery) {
      setMessage('warning', 'Type a search term first.');
      return;
    }
    const replacement = normalizeLineBreaks(refs.replaceInput.value);
    const count = state.matches.length;
    if (!count) {
      setMessage('warning', 'No matches to replace.');
      return;
    }
    const nextText = state.text.split(state.findQuery).join(replacement);
    const caret = state.matches[0].start + replacement.length;
    applyStateChange(nextText, [{ anchor: caret, focus: caret }], {
      kind: 'replace-all',
      prevEndPos: caret,
      endPos: caret,
      singleCaret: true,
    });
    setMessage('success', `Replaced ${count} matches.`);
  }

  function updateFindQuery(value, selectMatch) {
    state.findQuery = value;
    refreshFindState(selectMatch);
    if (selectMatch && state.matches.length) {
      const current = state.matches[0];
      state.activeMatchIndex = 0;
      state.selections = [{ anchor: current.start, focus: current.end }];
    }
    scheduleRender();
  }

  function refreshReportList() {
    if (!refs.reportList) {
      return;
    }
    if (!state.reports.length) {
      refs.reportList.innerHTML = '<div class="report-meta">No reports available.</div>';
      return;
    }

    refs.reportList.innerHTML = state.reports.map((report) => `
      <button type="button" class="report-card ${report.id === state.currentReportId ? 'active' : ''}" data-report-id="${escapeHtml(report.id)}">
        <div class="report-title">${escapeHtml(report.title)}</div>
        <div class="report-meta">${escapeHtml(report.author)} · ${escapeHtml(report.id)}</div>
      </button>
    `).join('');
  }

  function refreshRevisionList() {
    if (!state.report) {
      refs.revisionList.innerHTML = '<div class="revision-meta">Open a report to browse its revision history.</div>';
      return;
    }
    const revisions = state.report.revisions || [];
    if (!revisions.length) {
      refs.revisionList.innerHTML = '<div class="revision-meta">No saved revisions yet.</div>';
      return;
    }

    refs.revisionList.innerHTML = revisions.map((revision) => `
      <div class="revision-card ${revision.revisionNumber === state.savedRevision ? 'current' : ''}" data-revision-number="${revision.revisionNumber}">
        <div class="revision-header">
          <div class="revision-number">Revision ${revision.revisionNumber}</div>
          <div class="revision-meta">${escapeHtml(new Date(revision.createdAt).toLocaleString())}</div>
        </div>
        <div class="revision-meta">${revision.revisionNumber === state.savedRevision ? 'Current saved revision' : 'Older revision'}</div>
        <div class="revision-actions">
          <button type="button" data-action="preview-revision" data-revision-number="${revision.revisionNumber}">Preview</button>
          <button type="button" data-action="restore-revision" data-revision-number="${revision.revisionNumber}">Restore</button>
        </div>
      </div>
    `).join('');
  }

  function renderPreview() {
    if (!state.preview) {
      refs.previewTitle.textContent = 'Preview';
      refs.previewMeta.textContent = '';
      refs.previewContent.textContent = 'Select a revision to preview it.';
      refs.clearPreviewButton.disabled = true;
      return;
    }

    refs.previewTitle.textContent = `Revision ${state.preview.revisionNumber}`;
    refs.previewMeta.textContent = new Date(state.preview.createdAt).toLocaleString();
    refs.previewContent.textContent = state.preview.content;
    refs.clearPreviewButton.disabled = false;
  }

  function renderStatus() {
    const baseLabel = `Base revision ${state.baseRevision}`;
    const saveLabel = state.dirty
      ? `Unsaved changes · ${baseLabel}`
      : `Saved revision ${state.savedRevision}`;
    refs.saveState.textContent = saveLabel;

    const lines = state.linesCache || buildLines(state.text);
    const primary = primarySelection();
    const position = positionToLineCol(primary.focus, lines);
    refs.cursorLine.textContent = `Ln ${position.lineIndex + 1}, Col ${position.column + 1}${state.selections.length > 1 ? ` · ${state.selections.length} carets` : ''}`;

    refs.findCount.textContent = state.findQuery
      ? `${state.matches.length} match${state.matches.length === 1 ? '' : 'es'}`
      : '0 matches';

    refs.messageBar.textContent = state.message.text;
    refs.messageBar.className = `message ${state.message.type}`;

    refs.conflictBanner.classList.toggle('hidden', !state.conflictMessage);
    refs.conflictText.textContent = state.conflictMessage || 'Conflict detected.';

    refs.saveButton.disabled = !state.report;
    refs.undoButton.disabled = !state.report || state.historyIndex <= 0;
    refs.redoButton.disabled = !state.report || state.historyIndex >= state.history.length - 1;
    refs.reloadButton.disabled = !state.report;
    refs.discardButton.disabled = !state.report;
    refs.findPrevButton.disabled = !state.findQuery;
    refs.findNextButton.disabled = !state.findQuery;
    refs.replaceCurrentButton.disabled = !state.findQuery;
    refs.replaceAllButton.disabled = !state.findQuery;
  }

  function renderHeader() {
    if (!state.report) {
      refs.reportTitle.textContent = 'PatchPad';
      refs.reportSubtitle.textContent = 'Loading report…';
      return;
    }

    refs.reportTitle.textContent = state.report.title;
    refs.reportSubtitle.textContent = `ID ${state.report.id} · Author ${state.report.author} · ${state.report.summary}`;
  }

  function renderDocument() {
    state.linesCache = buildLines(state.text);
    const lines = state.linesCache;
    const lineNumberWidth = String(lines.length).length;
    const ranges = normalizeSelections(state.selections).map(selectionSpan);
    const primaryRange = selectionSpan(primarySelection());
    const activeLine = positionToLineCol(primarySelection().focus, lines).lineIndex;

    refs.documentHost.innerHTML = lines.map((line) => {
      const rowSelections = [];
      const carets = [];
      for (const range of ranges) {
        const start = Math.max(range.start, line.start) - line.start;
        const end = Math.min(range.end, line.end) - line.start;
        if (start === end && range.start >= line.start && range.start <= line.end) {
          carets.push(start);
        } else if (end > start) {
          rowSelections.push({ start, end, active: range.start === primaryRange.start && range.end === primaryRange.end });
        }
      }

      const clusters = segmentGraphemes(line.text);
      let html = '';
      let openSelections = 0;
      let selectionIndex = 0;
      let caretIndex = 0;
      const sortedSelections = rowSelections.sort((a, b) => a.start - b.start || a.end - b.end);
      const sortedCarets = carets.sort((a, b) => a - b);

      for (let position = 0; position <= line.text.length; position += 1) {
        while (selectionIndex < sortedSelections.length && sortedSelections[selectionIndex].start === position) {
          html += `<span class="selection ${sortedSelections[selectionIndex].active ? 'active-selection' : ''}">`;
          openSelections += 1;
          selectionIndex += 1;
        }
        while (caretIndex < sortedCarets.length && sortedCarets[caretIndex] === position) {
          html += '<span class="caret" aria-hidden="true"></span>';
          caretIndex += 1;
        }
        if (position >= line.text.length) {
          break;
        }
        const cluster = clusters.find((item) => item.index === position) || { segment: line.text[position], index: position };
        html += escapeHtml(cluster.segment);
        while (openSelections > 0) {
          const selection = sortedSelections[selectionIndex - openSelections];
          const selectionEnd = selection.end;
          if (selectionEnd === position + cluster.segment.length) {
            html += '</span>';
            openSelections -= 1;
          } else {
            break;
          }
        }
      }

      while (openSelections > 0) {
        html += '</span>';
        openSelections -= 1;
      }

      return `
        <div class="line-row ${line.index === activeLine ? 'active-line' : ''}" data-line="${line.index}">
          <div class="line-number">${String(line.index + 1).padStart(lineNumberWidth, ' ')}</div>
          <div class="line-text">${html || '<span class="caret" aria-hidden="true"></span>'}</div>
        </div>
      `;
    }).join('');

    measureEditorMetrics();
    scrollPrimarySelectionIntoView();
  }

  function measureEditorMetrics() {
    const probe = document.createElement('span');
    probe.className = 'line-text';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.whiteSpace = 'pre';
    probe.textContent = 'MMMMMMMMMM';
    document.body.appendChild(probe);
    const width = probe.getBoundingClientRect().width / 10;
    const lineHeightValue = getComputedStyle(probe).lineHeight;
    const lineHeight = Number.parseFloat(lineHeightValue) || 22;
    const documentProbe = document.createElement('div');
    documentProbe.className = 'document';
    documentProbe.style.position = 'absolute';
    documentProbe.style.visibility = 'hidden';
    documentProbe.innerHTML = '&nbsp;';
    document.body.appendChild(documentProbe);
    const docStyle = getComputedStyle(documentProbe);
    state.charWidth = width || 8;
    state.lineHeight = lineHeight || 22;
    state.docPaddingTop = Number.parseFloat(docStyle.paddingTop) || 0;
    state.docPaddingLeft = Number.parseFloat(docStyle.paddingLeft) || 0;
    probe.remove();
    documentProbe.remove();
  }

  function scrollPrimarySelectionIntoView() {
    const lines = state.linesCache || buildLines(state.text);
    const lineIndex = positionToLineCol(primarySelection().focus, lines).lineIndex;
    const row = refs.documentHost.querySelector(`.line-row[data-line="${lineIndex}"]`);
    if (row) {
      row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function scheduleRender() {
    if (state.renderQueued) {
      return;
    }
    state.renderQueued = true;
    window.requestAnimationFrame(() => {
      state.renderQueued = false;
      renderHeader();
      refreshReportList();
      renderDocument();
      refreshRevisionList();
      renderPreview();
      renderStatus();
    });
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) {
      const error = new Error((payload && payload.error) || `Request failed with status ${response.status}`);
      error.response = response;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function loadReportsList() {
    const data = await fetchJson('/api/reports');
    state.reports = data.reports || [];
    refreshReportList();
  }

  async function loadReport(reportId, options = {}) {
    if (!reportId) {
      state.report = null;
      state.currentReportId = null;
      state.text = '';
      state.savedContent = '';
      state.savedRevision = 1;
      state.baseRevision = 1;
      state.selections = [{ anchor: 0, focus: 0 }];
      state.preview = null;
      state.findQuery = '';
      state.matches = [];
      state.activeMatchIndex = -1;
      state.conflictMessage = '';
      state.dirty = false;
      resetHistory();
      scheduleRender();
      return;
    }

    const report = await fetchJson(`/api/reports/${encodeURIComponent(reportId)}`);
    state.report = report;
    state.currentReportId = report.id;
    state.text = report.content;
    state.savedContent = report.content;
    state.savedRevision = report.currentRevision;
    state.baseRevision = report.currentRevision;
    state.selections = [{ anchor: 0, focus: 0 }];
    state.preview = null;
    state.findQuery = '';
    state.matches = [];
    state.activeMatchIndex = -1;
    state.preferredColumn = null;
    state.conflictMessage = '';
    updateDirtyFlag();
    resetHistory();
    if (options.message) {
      setMessage('info', options.message);
    } else {
      setMessage('success', `Opened ${report.title}.`);
    }
    refreshFindState(false);
    await refreshRevisions();
    scheduleRender();
    window.requestAnimationFrame(() => {
      refs.editorSurface.focus({ preventScroll: true });
    });
  }

  async function refreshRevisions() {
    if (!state.report) {
      return;
    }
    const data = await fetchJson(`/api/reports/${encodeURIComponent(state.report.id)}/revisions`);
    state.report.revisions = data.revisions || [];
    scheduleRender();
  }

  async function saveReport() {
    if (!state.report) {
      return;
    }
    try {
      setMessage('info', 'Saving…');
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
        state.conflictMessage = `Save rejected: another tab saved revision ${payload.currentRevision}. Your draft is still open here.`;
        setMessage('error', 'Save rejected because the report changed elsewhere.');
        scheduleRender();
        return;
      }
      if (!response.ok) {
        throw new Error(payload.error || `Save failed with status ${response.status}`);
      }

      state.savedContent = state.text;
      state.savedRevision = payload.revision;
      state.baseRevision = payload.revision;
      updateDirtyFlag();
      await refreshRevisions();
      setMessage(payload.saved ? 'success' : 'info', payload.saved ? `Saved revision ${payload.revision}.` : `Nothing changed. Revision ${payload.revision} is still current.`);
      scheduleRender();
    } catch (error) {
      setMessage('error', error.message || 'Unable to save the report.');
    }
  }

  async function previewRevision(reportId, revisionNumber) {
    const revision = await fetchJson(`/api/reports/${encodeURIComponent(reportId)}/revisions/${revisionNumber}`);
    state.preview = revision;
    setMessage('info', `Previewing revision ${revisionNumber}.`);
    scheduleRender();
  }

  async function restoreRevision(reportId, revisionNumber) {
    const revision = await fetchJson(`/api/reports/${encodeURIComponent(reportId)}/revisions/${revisionNumber}`);
    const nextSelections = [{ anchor: 0, focus: 0 }];
    state.preview = revision;
    state.text = revision.content;
    state.selections = nextSelections;
    state.preferredColumn = null;
    updateDirtyFlag();
    commitHistory({ kind: 'restore', prevEndPos: 0, endPos: 0, singleCaret: true });
    refreshFindState(false);
    setMessage('warning', `Restored revision ${revisionNumber} into an unsaved draft.`);
    scheduleRender();
  }

  function clearPreview() {
    state.preview = null;
    setMessage('info', 'Cleared the preview panel.');
    scheduleRender();
  }

  function reloadCurrentReport(message) {
    if (!state.currentReportId) {
      return;
    }
    loadReport(state.currentReportId, { message: message || 'Reloaded the latest saved content.' }).catch((error) => {
      setMessage('error', error.message || 'Unable to reload the report.');
    });
  }

  function openReportFromList(reportId) {
    loadReport(reportId).catch((error) => {
      setMessage('error', error.message || 'Unable to open the report.');
    });
  }

  function handleEditorKeyDown(event) {
    const mod = event.metaKey || event.ctrlKey;
    const altWord = event.altKey || mod;

    if (mod && event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveReport();
      return;
    }

    if (mod && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      refs.findInput.focus();
      refs.findInput.select();
      return;
    }

    if (mod && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      undo();
      return;
    }

    if ((mod && event.key.toLowerCase() === 'z' && event.shiftKey) || (mod && event.key.toLowerCase() === 'y')) {
      event.preventDefault();
      redo();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      refs.findInput.focus();
      refs.findInput.select();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      if (event.shiftKey) {
        outdentSelections();
      } else {
        indentSelections();
      }
      return;
    }

    if (mod && event.key === 'a') {
      event.preventDefault();
      selectAll();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveSelections('left', event.shiftKey, altWord, null);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveSelections('right', event.shiftKey, altWord, null);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelections('up', event.shiftKey, false, null);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelections('down', event.shiftKey, false, null);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      moveSelections('left', event.shiftKey, false, mod ? 'home' : 'home');
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      moveSelections('right', event.shiftKey, false, mod ? 'end' : 'end');
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      deleteByDirection('backward');
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      deleteByDirection('forward');
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      insertText('\n', 'typing');
      return;
    }

    if (event.key.length === 1 && !mod) {
      event.preventDefault();
      insertText(event.key, 'typing');
    }
  }

  function indentSelections() {
    const lines = state.linesCache || buildLines(state.text);
    const touched = new Set();
    for (const selection of selectedRanges()) {
      const startLine = lineIndexFromPosition(selection.start, lines);
      const endLine = lineIndexFromPosition(Math.max(selection.end - 1, selection.start), lines);
      for (let lineIndex = startLine; lineIndex <= endLine; lineIndex += 1) {
        touched.add(lineIndex);
      }
    }
    if (!touched.size) {
      touched.add(lineIndexFromPosition(primarySelection().focus, lines));
    }

    const lineArray = lines.map((line) => line.text);
    const nextSelections = cloneSelections(state.selections);
    const sortedTouched = Array.from(touched).sort((a, b) => a - b);

    for (const lineIndex of sortedTouched) {
      lineArray[lineIndex] = `${INDENT}${lineArray[lineIndex]}`;
      for (const selection of nextSelections) {
        if (selection.anchor > lines[lineIndex].start) {
          selection.anchor += INDENT.length;
        }
        if (selection.focus > lines[lineIndex].start) {
          selection.focus += INDENT.length;
        }
      }
    }

    const nextText = lineArray.join('\n');
    applyStateChange(nextText, nextSelections, {
      kind: 'indent',
      prevEndPos: primarySelection().focus,
      endPos: primarySelection().focus + INDENT.length,
      singleCaret: nextSelections.length === 1 && isCollapsed(nextSelections[0]),
    });
  }

  function outdentSelections() {
    const lines = state.linesCache || buildLines(state.text);
    const touched = new Set();
    for (const selection of selectedRanges()) {
      const startLine = lineIndexFromPosition(selection.start, lines);
      const endLine = lineIndexFromPosition(Math.max(selection.end - 1, selection.start), lines);
      for (let lineIndex = startLine; lineIndex <= endLine; lineIndex += 1) {
        touched.add(lineIndex);
      }
    }
    if (!touched.size) {
      touched.add(lineIndexFromPosition(primarySelection().focus, lines));
    }

    const lineArray = lines.map((line) => line.text);
    const nextSelections = cloneSelections(state.selections);
    const sortedTouched = Array.from(touched).sort((a, b) => a - b);

    for (const lineIndex of sortedTouched) {
      const lineText = lineArray[lineIndex];
      const removal = lineText.startsWith(INDENT) ? INDENT.length : lineText.startsWith('\t') ? 1 : 0;
      if (removal > 0) {
        lineArray[lineIndex] = lineText.slice(removal);
        for (const selection of nextSelections) {
          if (selection.anchor > lines[lineIndex].start) {
            selection.anchor = Math.max(lines[lineIndex].start, selection.anchor - removal);
          }
          if (selection.focus > lines[lineIndex].start) {
            selection.focus = Math.max(lines[lineIndex].start, selection.focus - removal);
          }
        }
      }
    }

    const nextText = lineArray.join('\n');
    applyStateChange(nextText, nextSelections, {
      kind: 'outdent',
      prevEndPos: primarySelection().focus,
      endPos: Math.max(0, primarySelection().focus - INDENT.length),
      singleCaret: nextSelections.length === 1 && isCollapsed(nextSelections[0]),
    });
  }

  function handleEditorMouseDown(event) {
    if (!state.report) {
      return;
    }

    const lineRow = event.target.closest('.line-row');
    if (!lineRow) {
      return;
    }
    event.preventDefault();
    refs.editorSurface.focus();

    const position = positionFromPoint(event.clientX, event.clientY);

    if (event.altKey || event.metaKey || event.ctrlKey) {
      const nextSelections = cloneSelections(state.selections);
      nextSelections.push({ anchor: position, focus: position });
      applyStateChange(state.text, nextSelections, {
        kind: 'add-caret',
        prevEndPos: primarySelection().focus,
        endPos: position,
        singleCaret: nextSelections.length === 1,
        recordHistory: false,
      });
      setMessage('info', 'Added a caret.');
      return;
    }

    if (event.shiftKey) {
      const current = primarySelection();
      applyStateChange(state.text, [{ anchor: current.anchor, focus: position }], {
        kind: 'extend-selection',
        prevEndPos: current.focus,
        endPos: position,
        singleCaret: false,
        recordHistory: false,
      });
      return;
    }

    if (event.detail >= 3) {
      selectLineAt(position);
      return;
    }

    if (event.detail === 2) {
      selectWordAt(position);
      return;
    }

    applyStateChange(state.text, [{ anchor: position, focus: position }], {
      kind: 'place-caret',
      prevEndPos: primarySelection().focus,
      endPos: position,
      singleCaret: true,
      recordHistory: false,
    });

    state.dragging = {
      anchor: position,
      startSelections: cloneSelections(state.selections),
    };

    const moveHandler = (moveEvent) => {
      if (!state.dragging) {
        return;
      }
      const surfaceRect = refs.editorSurface.getBoundingClientRect();
      const edge = 28;
      if (moveEvent.clientY < surfaceRect.top + edge) {
        refs.editorSurface.scrollTop -= 24;
      } else if (moveEvent.clientY > surfaceRect.bottom - edge) {
        refs.editorSurface.scrollTop += 24;
      }
      if (moveEvent.clientX < surfaceRect.left + edge) {
        refs.editorSurface.scrollLeft -= 24;
      } else if (moveEvent.clientX > surfaceRect.right - edge) {
        refs.editorSurface.scrollLeft += 24;
      }

      const nextPosition = positionFromPoint(moveEvent.clientX, moveEvent.clientY);
      state.selections = [{ anchor: state.dragging.anchor, focus: nextPosition }];
      updateDirtyFlag();
      refreshFindState(false);
      scheduleRender();
    };

    const upHandler = () => {
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseup', upHandler);
      state.dragging = null;
      state.preferredColumn = null;
      refreshFindState(false);
      scheduleRender();
    };

    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler);
  }

  function handleCopyCut(event, cut = false) {
    const text = extractSelectedText();
    if (!text) {
      return;
    }
    event.preventDefault();
    event.clipboardData.setData('text/plain', text);
    if (cut) {
      deleteByDirection('backward');
    }
    setMessage('info', cut ? 'Cut selection to clipboard.' : 'Copied selection to clipboard.');
  }

  function handlePaste(event) {
    event.preventDefault();
    const text = normalizeLineBreaks(event.clipboardData.getData('text/plain'));
    insertText(text, 'paste');
    setMessage('success', 'Pasted clipboard text.');
  }

  function handleDocumentKeyDown(event) {
    if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')) {
      return;
    }
    if (event.target !== refs.editorSurface && !refs.editorSurface.contains(event.target)) {
      return;
    }
    handleEditorKeyDown(event);
  }

  function handleFindKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      refs.editorSurface.focus();
      setMessage('info', 'Returned focus to the editor.');
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      gotoNextMatch(event.shiftKey ? -1 : 1);
    }
  }

  function handleFindInput() {
    updateFindQuery(refs.findInput.value, true);
    if (state.matches.length) {
      selectMatch(0);
    } else {
      setMessage('warning', 'No matches found.');
    }
  }

  function handleReplaceInput() {
    scheduleRender();
  }

  function bindEvents() {
    document.addEventListener('keydown', handleDocumentKeyDown);
    refs.editorSurface.addEventListener('mousedown', handleEditorMouseDown);
    refs.editorSurface.addEventListener('copy', (event) => handleCopyCut(event, false));
    refs.editorSurface.addEventListener('cut', (event) => handleCopyCut(event, true));
    refs.editorSurface.addEventListener('paste', handlePaste);
    refs.findInput.addEventListener('keydown', handleFindKeyDown);
    refs.findInput.addEventListener('input', handleFindInput);
    refs.replaceInput.addEventListener('input', handleReplaceInput);
    refs.findPrevButton.addEventListener('click', () => gotoNextMatch(-1));
    refs.findNextButton.addEventListener('click', () => gotoNextMatch(1));
    refs.replaceCurrentButton.addEventListener('click', replaceCurrent);
    refs.replaceAllButton.addEventListener('click', replaceAll);
    refs.saveButton.addEventListener('click', saveReport);
    refs.undoButton.addEventListener('click', undo);
    refs.redoButton.addEventListener('click', redo);
    refs.reloadButton.addEventListener('click', () => reloadCurrentReport('Reloaded the latest saved content.'));
    refs.discardButton.addEventListener('click', () => reloadCurrentReport('Discarded the local draft.'));
    refs.conflictReloadButton.addEventListener('click', () => reloadCurrentReport('Reloaded the latest server copy after conflict.'));
    refs.conflictDiscardButton.addEventListener('click', () => reloadCurrentReport('Discarded the conflicted draft.'));
    refs.clearPreviewButton.addEventListener('click', clearPreview);
    refs.reportList.addEventListener('click', (event) => {
      const card = event.target.closest('[data-report-id]');
      if (!card) {
        return;
      }
      openReportFromList(card.getAttribute('data-report-id'));
    });
    refs.revisionList.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button || !state.report) {
        return;
      }
      const revisionNumber = Number(button.getAttribute('data-revision-number'));
      const action = button.getAttribute('data-action');
      if (action === 'preview-revision') {
        previewRevision(state.report.id, revisionNumber).catch((error) => {
          setMessage('error', error.message || 'Unable to preview the revision.');
        });
      } else if (action === 'restore-revision') {
        restoreRevision(state.report.id, revisionNumber).catch((error) => {
          setMessage('error', error.message || 'Unable to restore the revision.');
        });
      }
    });
    window.addEventListener('resize', () => {
      measureEditorMetrics();
      scheduleRender();
    });
  }

  async function bootstrapApp() {
    bindEvents();
    measureEditorMetrics();
    refreshReportList();
    renderHeader();
    renderPreview();
    renderStatus();

    try {
      if (!state.reports.length) {
        await loadReportsList();
      }
      const initialReportId = state.currentReportId || state.reports[0]?.id || null;
      if (initialReportId) {
        await loadReport(initialReportId, { message: 'Loaded the seeded incident report.' });
      } else {
        setMessage('warning', 'No reports were seeded into the database.');
      }
    } catch (error) {
      setMessage('error', error.message || 'Unable to load PatchPad.');
    }
  }

  bootstrapApp();
})();

(() => {
  const boot = window.__PATCHPAD_BOOT__ || { reports: [], activeReportId: null };
  const editorScroll = document.getElementById('editorScroll');
  const lineGutter = document.getElementById('lineGutter');
  const historyList = document.getElementById('historyList');
  const documentTitle = document.getElementById('documentTitle');
  const documentMeta = document.getElementById('documentMeta');
  const saveState = document.getElementById('saveState');
  const cursorState = document.getElementById('cursorState');
  const messageBar = document.getElementById('messageBar');
  const findBar = document.getElementById('findBar');
  const findInput = document.getElementById('findInput');
  const replaceInput = document.getElementById('replaceInput');
  const findCount = document.getElementById('findCount');
  const findStatus = document.getElementById('findStatus');
  const findToggleButton = document.getElementById('findToggleButton');
  const findPrevButton = document.getElementById('findPrevButton');
  const findNextButton = document.getElementById('findNextButton');
  const replaceCurrentButton = document.getElementById('replaceCurrentButton');
  const replaceAllButton = document.getElementById('replaceAllButton');
  const saveButton = document.getElementById('saveButton');
  const reloadButton = document.getElementById('reloadButton');
  const discardButton = document.getElementById('discardButton');
  const undoButton = document.getElementById('undoButton');
  const redoButton = document.getElementById('redoButton');
  const previewModal = document.getElementById('previewModal');
  const previewGutter = document.getElementById('previewGutter');
  const previewScroll = document.getElementById('previewScroll');
  const previewMeta = document.getElementById('previewMeta');
  const closePreviewButton = document.getElementById('closePreviewButton');
  const reportList = document.getElementById('report-list');

  const state = {
    reportId: boot.activeReportId,
    document: null,
    content: '',
    savedContent: '',
    baseRevision: 1,
    revisions: [],
    selectionRanges: [{ anchor: 0, head: 0 }],
    undoStack: [],
    redoStack: [],
    typingGroup: null,
    lines: [''],
    lineStarts: [0],
    matches: [],
    activeMatchIndex: -1,
    findQuery: '',
    preview: null,
    conflict: null,
    rowHeight: 24,
  };

  const measureCanvas = document.createElement('canvas');
  const measureContext = measureCanvas.getContext('2d');
  const segmenterGrapheme = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const segmenterWord = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;
  const metricsCache = new Map();
  let renderQueued = false;
  let dragSelection = null;
  let previewScrollState = { top: 0, left: 0 };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function cloneRanges(ranges) {
    return ranges.map((range) => ({ anchor: range.anchor, head: range.head }));
  }

  function normalizedRange(range) {
    return range.anchor <= range.head
      ? { start: range.anchor, end: range.head, anchor: range.anchor, head: range.head }
      : { start: range.head, end: range.anchor, anchor: range.anchor, head: range.head };
  }

  function sortRanges(ranges) {
    return ranges.map(normalizedRange).sort((a, b) => a.start - b.start || a.end - b.end);
  }

  function dedupeCollapsed(ranges) {
    const seen = new Set();
    const result = [];
    for (const range of ranges) {
      if (range.start === range.end) {
        const key = String(range.start);
        if (seen.has(key)) continue;
        seen.add(key);
      }
      result.push(range);
    }
    return result;
  }

  function updateContentModel(content) {
    state.content = content;
    state.lines = content.split('\n');
    if (!state.lines.length) state.lines = [''];
    state.lineStarts = [0];
    for (let i = 0; i < state.lines.length; i += 1) {
      state.lineStarts[i + 1] = state.lineStarts[i] + state.lines[i].length + (i < state.lines.length - 1 ? 1 : 0);
    }
    metricsCache.clear();
  }

  function snapshot() {
    return {
      content: state.content,
      selectionRanges: cloneRanges(state.selectionRanges),
      findQuery: state.findQuery,
      matches: state.matches.slice(),
      activeMatchIndex: state.activeMatchIndex,
    };
  }

  function restoreSnapshot(data) {
    updateContentModel(data.content);
    state.selectionRanges = cloneRanges(data.selectionRanges);
    state.findQuery = data.findQuery;
    state.matches = data.matches.slice();
    state.activeMatchIndex = data.activeMatchIndex;
    renderFindBar();
    queueRender();
  }

  function setMessage(text, kind = '') {
    messageBar.textContent = text || '';
    messageBar.className = kind ? `${kind}-text` : '';
  }

  function setStatus(text, kind = '') {
    saveState.textContent = text;
    saveState.className = kind ? `${kind}-text` : '';
  }

  function setDirtyStatus() {
    if (state.conflict) {
      setStatus(`Save conflict: server is at revision ${state.conflict.currentRevision}.`, 'warning');
      return;
    }
    if (state.content === state.savedContent) {
      setStatus(`Saved at revision ${state.baseRevision}.`, 'good');
    } else {
      setStatus(`Unsaved changes • base revision ${state.baseRevision}`, 'warning');
    }
  }

  function pushUndo(snapshotData, kind) {
    const group = state.typingGroup;
    const now = Date.now();
    if (group && group.kind === kind && now - group.time < 900) {
      group.time = now;
      return;
    }
    state.undoStack.push(snapshotData);
    state.redoStack.length = 0;
    state.typingGroup = { kind, time: now };
  }

  function finishGroup() {
    state.typingGroup = null;
  }

  function getPrimaryRange() {
    return normalizedRange(state.selectionRanges[0]);
  }

  function currentSelectionText() {
    const range = getPrimaryRange();
    return state.content.slice(range.start, range.end);
  }

  function ensureLineMetrics(line) {
    const cached = metricsCache.get(line);
    if (cached) return cached;
    measureContext.font = getComputedStyle(editorScroll).font;
    const offsets = [0];
    const widths = [0];
    let offset = 0;
    let width = 0;
    const segments = segmenterGrapheme ? Array.from(segmenterGrapheme.segment(line), (part) => part.segment) : Array.from(line);
    for (const segment of segments) {
      offset += segment.length;
      const display = segment === '\t' ? '    ' : segment;
      width += measureContext.measureText(display).width;
      offsets.push(offset);
      widths.push(width);
    }
    const metrics = { offsets, widths, width };
    metricsCache.set(line, metrics);
    return metrics;
  }

  function offsetToX(line, offset) {
    const metrics = ensureLineMetrics(line);
    let low = 0;
    let high = metrics.offsets.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (metrics.offsets[mid] === offset) return metrics.widths[mid];
      if (metrics.offsets[mid] < offset) low = mid + 1;
      else high = mid - 1;
    }
    return metrics.widths[Math.max(0, high)];
  }

  function xToOffset(line, x) {
    const metrics = ensureLineMetrics(line);
    let low = 0;
    let high = metrics.widths.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (metrics.widths[mid] === x) return metrics.offsets[mid];
      if (metrics.widths[mid] < x) low = mid + 1;
      else high = mid - 1;
    }
    return metrics.offsets[Math.max(0, high)];
  }

  function lineInfoForOffset(offset) {
    const clamped = Math.max(0, Math.min(state.content.length, offset));
    let lineIndex = 0;
    for (let i = state.lineStarts.length - 1; i >= 0; i -= 1) {
      if (state.lineStarts[i] <= clamped) {
        lineIndex = Math.min(i, state.lines.length - 1);
        break;
      }
    }
    return {
      lineIndex,
      lineStart: state.lineStarts[lineIndex],
      line: state.lines[lineIndex] || '',
      columnOffset: clamped - state.lineStarts[lineIndex],
    };
  }

  function nextGraphemeOffset(offset, direction) {
    if (direction > 0) {
      if (offset >= state.content.length) return state.content.length;
      const rest = state.content.slice(offset);
      const segments = segmenterGrapheme ? Array.from(segmenterGrapheme.segment(rest), (part) => part.segment) : Array.from(rest);
      return offset + (segments[0]?.length || 1);
    }
    if (offset <= 0) return 0;
    const part = state.content.slice(0, offset);
    const segments = segmenterGrapheme ? Array.from(segmenterGrapheme.segment(part), (seg) => seg.segment) : Array.from(part);
    return offset - (segments[segments.length - 1]?.length || 1);
  }

  function nextWordBoundary(offset, direction) {
    if (!segmenterWord) return nextGraphemeOffset(offset, direction);
    const segments = Array.from(segmenterWord.segment(state.content));
    if (direction > 0) {
      for (const segment of segments) {
        const end = segment.index + segment.segment.length;
        if (segment.index > offset) return segment.index;
        if (segment.index <= offset && offset < end) return end;
      }
      return state.content.length;
    }
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      const segment = segments[i];
      if (segment.isWordLike && segment.index < offset) return segment.index;
    }
    return 0;
  }

  function selectAll() {
    state.selectionRanges = [{ anchor: 0, head: state.content.length }];
    finishGroup();
    queueRender();
    scrollSelectionIntoView();
  }

  function findMatches() {
    if (!state.findQuery) {
      state.matches = [];
      state.activeMatchIndex = -1;
      renderFindBar();
      queueRender();
      return;
    }
    const matches = [];
    let index = state.content.indexOf(state.findQuery);
    while (index !== -1) {
      matches.push({ start: index, end: index + state.findQuery.length });
      index = state.content.indexOf(state.findQuery, index + Math.max(1, state.findQuery.length));
    }
    state.matches = matches;
    if (!matches.length) {
      state.activeMatchIndex = -1;
    } else if (state.activeMatchIndex < 0 || state.activeMatchIndex >= matches.length) {
      state.activeMatchIndex = 0;
    }
    renderFindBar();
    if (matches.length) {
      const active = matches[state.activeMatchIndex];
      state.selectionRanges = [{ anchor: active.start, head: active.end }];
      scrollSelectionIntoView();
    }
    queueRender();
  }

  function applyReplacement(ranges, replacement, kind) {
    const sorted = sortRanges(ranges);
    if (!sorted.length) return;
    const before = snapshot();
    pushUndo(before, kind);
    let content = state.content;
    const nextSelections = [];
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      const range = sorted[i];
      content = content.slice(0, range.start) + replacement + content.slice(range.end);
      nextSelections.unshift({ anchor: range.start + replacement.length, head: range.start + replacement.length });
    }
    updateContentModel(content);
    state.selectionRanges = nextSelections;
    if (state.findQuery) findMatches();
    else {
      state.matches = [];
      state.activeMatchIndex = -1;
      renderFindBar();
      queueRender();
    }
  }

  function typeText(text) {
    applyReplacement(sortRanges(state.selectionRanges), text, 'insert');
  }

  function deleteByDirection(direction) {
    const ranges = sortRanges(state.selectionRanges).map((range) => {
      if (range.start !== range.end) return range;
      const nextOffset = direction < 0 ? nextGraphemeOffset(range.start, -1) : nextGraphemeOffset(range.start, 1);
      return direction < 0
        ? { start: nextOffset, end: range.start, anchor: range.start, head: range.start }
        : { start: range.start, end: nextOffset, anchor: range.start, head: range.start };
    });
    applyReplacement(ranges, '', direction < 0 ? 'backspace' : 'delete');
  }

  function moveRanges(direction, { shift = false, byWord = false } = {}) {
    state.selectionRanges = state.selectionRanges.map((range) => {
      const normalized = normalizedRange(range);
      const source = shift ? range.head : (direction > 0 ? normalized.end : normalized.start);
      const nextOffset = byWord ? nextWordBoundary(source, direction) : nextGraphemeOffset(source, direction);
      return shift ? { anchor: range.anchor, head: nextOffset } : { anchor: nextOffset, head: nextOffset };
    });
    state.selectionRanges = dedupeCollapsed(sortRanges(state.selectionRanges));
    finishGroup();
    queueRender();
    scrollSelectionIntoView();
  }

  function moveVertical(direction, shift = false) {
    state.selectionRanges = state.selectionRanges.map((range) => {
      const current = shift ? range.head : normalizedRange(range).end;
      const info = lineInfoForOffset(current);
      const nextLine = Math.max(0, Math.min(state.lines.length - 1, info.lineIndex + direction));
      const line = state.lines[nextLine] || '';
      const nextColumn = Array.from(segmenterGrapheme ? segmenterGrapheme.segment(info.line.slice(0, info.columnOffset)) : info.line.slice(0, info.columnOffset)).length;
      const nextMetrics = ensureLineMetrics(line);
      const nextRelative = nextMetrics.offsets[Math.min(nextColumn, nextMetrics.offsets.length - 1)];
      const nextOffset = state.lineStarts[nextLine] + nextRelative;
      return shift ? { anchor: range.anchor, head: nextOffset } : { anchor: nextOffset, head: nextOffset };
    });
    state.selectionRanges = dedupeCollapsed(sortRanges(state.selectionRanges));
    finishGroup();
    queueRender();
    scrollSelectionIntoView();
  }

  function indentSelection(outdent = false) {
    const range = getPrimaryRange();
    const startLine = lineInfoForOffset(range.start).lineIndex;
    const endLine = range.end > range.start ? lineInfoForOffset(range.end - 1).lineIndex : lineInfoForOffset(range.end).lineIndex;
    const lines = state.lines.slice(startLine, endLine + 1);
    if (!lines.length) return;
    const before = snapshot();
    pushUndo(before, outdent ? 'outdent' : 'indent');
    const adjusted = lines.map((line) => {
      if (outdent) {
        if (line.startsWith('\t')) return line.slice(1);
        if (line.startsWith('    ')) return line.slice(4);
        if (line.startsWith(' ')) return line.replace(/^ +/, (match) => match.slice(Math.min(4, match.length)));
        return line;
      }
      return `\t${line}`;
    });
    const startOffset = state.lineStarts[startLine];
    const endOffset = endLine < state.lines.length - 1 ? state.lineStarts[endLine + 1] : state.content.length;
    updateContentModel(state.content.slice(0, startOffset) + adjusted.join('\n') + state.content.slice(endOffset));
    state.selectionRanges = [{ anchor: startOffset, head: startOffset + adjusted.join('\n').length }];
    renderFindBar();
    queueRender();
  }

  function renderFindBar() {
    findCount.textContent = `${state.matches.length} match${state.matches.length === 1 ? '' : 'es'}`;
    if (!state.findQuery) findStatus.textContent = 'Search the open report.';
    else if (!state.matches.length) findStatus.textContent = 'No matches.';
    else findStatus.textContent = `Match ${state.activeMatchIndex + 1} of ${state.matches.length}`;
  }

  function renderReports() {
    Array.from(reportList.querySelectorAll('.report-chip')).forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.reportId === state.reportId);
      chip.onclick = () => loadReport(chip.dataset.reportId);
    });
  }

  function renderHeader() {
    if (!state.document) {
      documentTitle.textContent = 'Loading…';
      documentMeta.textContent = '';
      return;
    }
    documentTitle.textContent = state.document.title;
    documentMeta.textContent = `Author: ${state.document.author} • ${state.document.summary}`;
  }

  function renderHistory() {
    if (!state.revisions.length) {
      historyList.innerHTML = '<div class="history-entry">No revisions available.</div>';
      return;
    }
    historyList.innerHTML = state.revisions.map((revision) => `
      <article class="history-entry">
        <div>
          <strong>Revision ${revision.revisionNumber}</strong>
          <div><small>${formatDate(revision.createdAt)}</small></div>
        </div>
        <div class="history-entry-actions">
          <button type="button" data-preview-revision="${revision.revisionNumber}">Preview</button>
          <button type="button" data-restore-revision="${revision.revisionNumber}">Restore</button>
        </div>
      </article>
    `).join('');
    historyList.querySelectorAll('[data-preview-revision]').forEach((button) => {
      button.onclick = () => openPreview(button.dataset.previewRevision);
    });
    historyList.querySelectorAll('[data-restore-revision]').forEach((button) => {
      button.onclick = () => restoreRevision(button.dataset.restoreRevision);
    });
  }

  function renderStatus() {
    setDirtyStatus();
    const info = lineInfoForOffset(getPrimaryRange().head);
    const column = Array.from(segmenterGrapheme ? segmenterGrapheme.segment(info.line.slice(0, info.columnOffset)) : info.line.slice(0, info.columnOffset)).length;
    cursorState.textContent = state.selectionRanges.length > 1
      ? `Line ${info.lineIndex + 1}, Column ${column + 1} • ${state.selectionRanges.length} carets`
      : `Line ${info.lineIndex + 1}, Column ${column + 1}`;
  }

  function renderSurface(scrollContainer, gutterContainer, content, preview = false) {
    const rowHeight = state.rowHeight;
    const scrollTop = preview ? previewScrollState.top : scrollContainer.scrollTop;
    const scrollLeft = preview ? previewScrollState.left : scrollContainer.scrollLeft;
    const visibleHeight = scrollContainer.clientHeight || 0;
    const startLine = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
    const endLine = Math.min(content.lines.length - 1, Math.ceil((scrollTop + visibleHeight) / rowHeight) + 2);
    const totalHeight = content.lines.length * rowHeight;
    const ranges = content.selectionRanges || [];
    const matches = content.matches || [];
    const activeMatchIndex = content.activeMatchIndex ?? -1;
    const rows = [];
    const gutterRows = [];
    let maxWidth = 0;

    for (let lineIndex = startLine; lineIndex <= endLine; lineIndex += 1) {
      const line = content.lines[lineIndex] || '';
      const lineStart = content.lineStarts[lineIndex] || 0;
      maxWidth = Math.max(maxWidth, ensureLineMetrics(line).width);
      const top = lineIndex * rowHeight;
      const selectionRects = [];
      const matchRects = [];
      const carets = [];

      for (const range of ranges) {
        const start = Math.max(range.start, lineStart);
        const end = Math.min(range.end, lineStart + line.length);
        if (start < end) {
          const left = offsetToX(line, start - lineStart);
          selectionRects.push({ left, width: Math.max(1, offsetToX(line, end - lineStart) - left) });
        }
        if (range.start === range.end && range.start >= lineStart && range.start <= lineStart + line.length) {
          carets.push({ left: offsetToX(line, range.start - lineStart) });
        }
      }

      for (let index = 0; index < matches.length; index += 1) {
        const match = matches[index];
        const start = Math.max(match.start, lineStart);
        const end = Math.min(match.end, lineStart + line.length);
        if (start < end) {
          const left = offsetToX(line, start - lineStart);
          matchRects.push({ left, width: Math.max(1, offsetToX(line, end - lineStart) - left), current: index === activeMatchIndex });
        }
      }

      rows.push(`
        <div class="line-row" style="top:${top}px; height:${rowHeight}px;">
          ${matchRects.map((rect) => `<div class="match-rect${rect.current ? ' current-match' : ''}" style="left:${rect.left}px; width:${rect.width}px;"></div>`).join('')}
          ${selectionRects.map((rect) => `<div class="selection-rect" style="left:${rect.left}px; width:${rect.width}px;"></div>`).join('')}
          ${carets.map((rect) => `<div class="cursor-rect" style="left:${rect.left}px;"></div>`).join('')}
          <span class="line-text">${escapeHtml(line)}</span>
        </div>
      `);
      gutterRows.push(`<div class="gutter-row" style="top:${top}px; height:${rowHeight}px;"><span class="line-number">${lineIndex + 1}</span></div>`);
    }

    scrollContainer.innerHTML = `<div class="editor-content" style="height:${totalHeight}px; min-width:${maxWidth + 200}px;">${rows.join('')}</div>`;
    gutterContainer.innerHTML = `<div class="gutter-content" style="height:${totalHeight}px; transform: translateY(${-scrollTop}px);">${gutterRows.join('')}</div>`;
    scrollContainer.scrollTop = scrollTop;
    scrollContainer.scrollLeft = scrollLeft;
  }

  function renderEditor() {
    if (!state.document) return;
    renderSurface(editorScroll, lineGutter, {
      lines: state.lines,
      lineStarts: state.lineStarts,
      selectionRanges: state.selectionRanges,
      matches: state.matches,
      activeMatchIndex: state.activeMatchIndex,
    });
    renderStatus();
  }

  function renderPreview() {
    if (!state.preview) return;
    const lines = state.preview.content.split('\n');
    const lineStarts = [0];
    for (let i = 0; i < lines.length; i += 1) {
      lineStarts[i + 1] = lineStarts[i] + lines[i].length + (i < lines.length - 1 ? 1 : 0);
    }
    renderSurface(previewScroll, previewGutter, {
      lines,
      lineStarts,
      selectionRanges: [],
      matches: [],
      activeMatchIndex: -1,
    }, true);
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderEditor();
      if (state.preview) renderPreview();
    });
  }

  function scrollSelectionIntoView() {
    const info = lineInfoForOffset(getPrimaryRange().head);
    const caretX = offsetToX(info.line, info.columnOffset);
    const caretY = info.lineIndex * state.rowHeight;
    if (caretY < editorScroll.scrollTop + 16) editorScroll.scrollTop = Math.max(0, caretY - state.rowHeight * 3);
    else if (caretY + state.rowHeight > editorScroll.scrollTop + editorScroll.clientHeight - 16) editorScroll.scrollTop = Math.max(0, caretY - editorScroll.clientHeight + state.rowHeight * 4);
    if (caretX < editorScroll.scrollLeft + 24) editorScroll.scrollLeft = Math.max(0, caretX - 40);
    else if (caretX > editorScroll.scrollLeft + editorScroll.clientWidth - 24) editorScroll.scrollLeft = Math.max(0, caretX - editorScroll.clientWidth + 80);
  }

  function selectWordAtOffset(offset) {
    if (!segmenterWord) {
      const info = lineInfoForOffset(offset);
      return { anchor: info.lineStart, head: info.lineStart + info.line.length };
    }
    const segments = Array.from(segmenterWord.segment(state.content));
    let selected = null;
    for (const segment of segments) {
      const end = segment.index + segment.segment.length;
      if (segment.isWordLike && segment.index <= offset && offset <= end) {
        selected = { start: segment.index, end };
        break;
      }
      if (segment.index > offset) {
        break;
      }
    }
    if (!selected) {
      for (let i = segments.length - 1; i >= 0; i -= 1) {
        if (segments[i].isWordLike && segments[i].index < offset) {
          selected = { start: segments[i].index, end: segments[i].index + segments[i].segment.length };
          break;
        }
      }
    }
    if (!selected) return { anchor: offset, head: offset };
    return { anchor: selected.start, head: selected.end };
  }

  function selectLineAtOffset(offset) {
    const info = lineInfoForOffset(offset);
    return { anchor: info.lineStart, head: info.lineStart + info.line.length };
  }

  function handleMouseDown(event) {
    const rect = editorScroll.getBoundingClientRect();
    const x = editorScroll.scrollLeft + event.clientX - rect.left;
    const y = editorScroll.scrollTop + event.clientY - rect.top;
    const lineIndex = Math.max(0, Math.min(state.lines.length - 1, Math.floor(y / state.rowHeight)));
    const line = state.lines[lineIndex] || '';
    const offset = state.lineStarts[lineIndex] + xToOffset(line, Math.max(0, x));

    if (event.altKey || event.ctrlKey || event.metaKey) {
      state.selectionRanges = [...state.selectionRanges, { anchor: offset, head: offset }];
      finishGroup();
      queueRender();
      return;
    }

    if (event.detail >= 3) {
      state.selectionRanges = [selectLineAtOffset(offset)];
    } else if (event.detail === 2) {
      state.selectionRanges = [selectWordAtOffset(offset)];
    } else {
      state.selectionRanges = [{ anchor: offset, head: offset }];
      dragSelection = { start: offset };
    }
    finishGroup();
    queueRender();
    scrollSelectionIntoView();
  }

  function handleMouseMove(event) {
    if (!dragSelection) return;
    const rect = editorScroll.getBoundingClientRect();
    if (event.clientY < rect.top + 20) editorScroll.scrollTop = Math.max(0, editorScroll.scrollTop - 24);
    else if (event.clientY > rect.bottom - 20) editorScroll.scrollTop += 24;
    if (event.clientX < rect.left + 20) editorScroll.scrollLeft = Math.max(0, editorScroll.scrollLeft - 24);
    else if (event.clientX > rect.right - 20) editorScroll.scrollLeft += 24;
    const nextRect = editorScroll.getBoundingClientRect();
    const x = editorScroll.scrollLeft + event.clientX - nextRect.left;
    const y = editorScroll.scrollTop + event.clientY - nextRect.top;
    const lineIndex = Math.max(0, Math.min(state.lines.length - 1, Math.floor(y / state.rowHeight)));
    const line = state.lines[lineIndex] || '';
    const offset = state.lineStarts[lineIndex] + xToOffset(line, Math.max(0, x));
    state.selectionRanges = [{ anchor: dragSelection.start, head: offset }];
    queueRender();
    scrollSelectionIntoView();
  }

  function handleMouseUp() {
    dragSelection = null;
  }

  function openFindBar() {
    findBar.hidden = false;
    findInput.focus();
    findInput.select();
  }

  function navigateMatches(direction) {
    if (!state.matches.length) {
      setMessage('No matches found.', 'warning');
      return;
    }
    const total = state.matches.length;
    state.activeMatchIndex = (state.activeMatchIndex + direction + total) % total;
    const match = state.matches[state.activeMatchIndex];
    state.selectionRanges = [{ anchor: match.start, head: match.end }];
    renderFindBar();
    scrollSelectionIntoView();
    queueRender();
    setMessage(`Match ${state.activeMatchIndex + 1} of ${total}.`, 'good');
  }

  function replaceCurrentMatch() {
    if (!state.matches.length) {
      setMessage('No match to replace.', 'warning');
      return;
    }
    const match = state.matches[state.activeMatchIndex < 0 ? 0 : state.activeMatchIndex];
    const before = snapshot();
    pushUndo(before, 'replace-current');
    updateContentModel(state.content.slice(0, match.start) + replaceInput.value + state.content.slice(match.end));
    state.selectionRanges = [{ anchor: match.start + replaceInput.value.length, head: match.start + replaceInput.value.length }];
    findMatches();
    setDirtyStatus();
    setMessage('Replaced the current match.', 'good');
  }

  function replaceAllMatches() {
    if (!state.matches.length) {
      setMessage('No matches to replace.', 'warning');
      return;
    }
    const before = snapshot();
    pushUndo(before, 'replace-all');
    const replacement = replaceInput.value;
    let content = state.content;
    for (let i = state.matches.length - 1; i >= 0; i -= 1) {
      const match = state.matches[i];
      content = content.slice(0, match.start) + replacement + content.slice(match.end);
    }
    updateContentModel(content);
    state.selectionRanges = [{ anchor: 0, head: 0 }];
    findMatches();
    setDirtyStatus();
    setMessage(`Replaced all ${before.matches.length} matches.`, 'good');
  }

  function applyFindQueryFromInput() {
    state.findQuery = findInput.value;
    state.activeMatchIndex = 0;
    findMatches();
    if (!state.matches.length) setMessage('No matches found.', 'warning');
  }

  function saveReport() {
    if (!state.document) return;
    setMessage('Saving report…');
    fetch(`/api/reports/${encodeURIComponent(state.document.id)}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: state.document.id, baseRevision: state.baseRevision, content: state.content }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (response.status === 409) {
          state.conflict = data.document || { currentRevision: 'unknown' };
          setDirtyStatus();
          setMessage('Save conflict: another tab saved a newer version. Your draft is preserved.', 'warning');
          return null;
        }
        if (!response.ok) throw new Error(data.error || 'Save failed.');
        return data;
      })
      .then((data) => {
        if (!data) return;
        state.conflict = null;
        state.savedContent = data.document.content;
        state.baseRevision = data.document.currentRevision;
        state.document.currentRevision = data.document.currentRevision;
        state.document.updatedAt = data.document.updatedAt;
        renderReports();
        renderHistory();
        setDirtyStatus();
        setMessage(data.changed ? `Saved as revision ${state.baseRevision}.` : 'No changes to save.', 'good');
      })
      .catch((error) => setMessage(error.message, 'error'));
  }

  function loadReport(reportId) {
    if (!reportId) return Promise.resolve();
    setStatus('Loading report…');
    setMessage('');
    return fetch(`/api/reports/${encodeURIComponent(reportId)}`)
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error || 'Failed to load report.');
        state.reportId = data.document.id;
        state.document = data.document;
        state.revisions = data.revisions;
        state.baseRevision = data.document.currentRevision;
        state.savedContent = data.document.content;
        state.conflict = null;
        state.undoStack = [];
        state.redoStack = [];
        state.typingGroup = null;
        state.findQuery = '';
        findInput.value = '';
        state.matches = [];
        state.activeMatchIndex = -1;
        updateContentModel(data.document.content);
        state.selectionRanges = [{ anchor: 0, head: 0 }];
        renderHeader();
        renderReports();
        renderHistory();
        renderFindBar();
        setDirtyStatus();
        queueRender();
        setMessage('Report loaded.', 'good');
      })
      .catch((error) => setMessage(error.message, 'error'));
  }

  function reloadLatest() {
    if (state.document) loadReport(state.document.id);
  }

  function openPreview(revisionNumber) {
    fetch(`/api/reports/${encodeURIComponent(state.document.id)}/revisions/${encodeURIComponent(revisionNumber)}`)
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error || 'Unable to preview revision.');
        state.preview = data;
        previewMeta.textContent = `Revision ${data.revisionNumber} • ${formatDate(data.createdAt)}`;
        previewModal.hidden = false;
        previewScroll.scrollTop = 0;
        previewScroll.scrollLeft = 0;
        renderPreview();
      })
      .catch((error) => setMessage(error.message, 'error'));
  }

  function closePreview() {
    state.preview = null;
    previewModal.hidden = true;
    editorScroll.focus();
  }

  function restoreRevision(revisionNumber) {
    fetch(`/api/reports/${encodeURIComponent(state.document.id)}/revisions/${encodeURIComponent(revisionNumber)}`)
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error || 'Unable to restore revision.');
        const before = snapshot();
        pushUndo(before, 'restore');
        updateContentModel(data.content);
        state.selectionRanges = [{ anchor: 0, head: 0 }];
        state.matches = [];
        state.activeMatchIndex = -1;
        renderFindBar();
        queueRender();
        setDirtyStatus();
        setMessage(`Restored revision ${data.revisionNumber} into the editor. Save to keep it.`, 'warning');
      })
      .catch((error) => setMessage(error.message, 'error'));
  }

  function handleUndo() {
    if (!state.undoStack.length) {
      setMessage('Nothing to undo.', 'warning');
      return;
    }
    const current = snapshot();
    const previous = state.undoStack.pop();
    state.redoStack.push(current);
    restoreSnapshot(previous);
    setDirtyStatus();
    setMessage('Undid the last change.', 'good');
  }

  function handleRedo() {
    if (!state.redoStack.length) {
      setMessage('Nothing to redo.', 'warning');
      return;
    }
    const current = snapshot();
    const next = state.redoStack.pop();
    state.undoStack.push(current);
    restoreSnapshot(next);
    setDirtyStatus();
    setMessage('Redid the last change.', 'good');
  }

  function insertTab(shiftKey) {
    const range = getPrimaryRange();
    if (range.start !== range.end && state.content.slice(range.start, range.end).includes('\n')) {
      indentSelection(shiftKey);
      return;
    }
    if (shiftKey) {
      indentSelection(true);
      return;
    }
    typeText('\t');
  }

  function handleKeyDown(event) {
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const mod = isMac ? event.metaKey : event.ctrlKey;
    const key = event.key;

    if (mod && key.toLowerCase() === 'f') {
      event.preventDefault();
      openFindBar();
      return;
    }
    if (mod && key.toLowerCase() === 's') {
      event.preventDefault();
      saveReport();
      return;
    }
    if (mod && key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      handleUndo();
      return;
    }
    if (mod && (key.toLowerCase() === 'y' || (key.toLowerCase() === 'z' && event.shiftKey))) {
      event.preventDefault();
      handleRedo();
      return;
    }
    if (mod && key.toLowerCase() === 'a') {
      event.preventDefault();
      selectAll();
      return;
    }

    if (key === 'Escape') {
      event.preventDefault();
      findInput.focus();
      return;
    }
    if (key === 'Tab') {
      event.preventDefault();
      insertTab(event.shiftKey);
      return;
    }
    if (key === 'Enter') {
      event.preventDefault();
      typeText('\n');
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      deleteByDirection(-1);
      return;
    }
    if (key === 'Delete') {
      event.preventDefault();
      deleteByDirection(1);
      return;
    }
    if (key === 'ArrowLeft') {
      event.preventDefault();
      moveRanges(-1, { shift: event.shiftKey, byWord: mod });
      return;
    }
    if (key === 'ArrowRight') {
      event.preventDefault();
      moveRanges(1, { shift: event.shiftKey, byWord: mod });
      return;
    }
    if (key === 'ArrowUp') {
      event.preventDefault();
      moveVertical(-1, event.shiftKey);
      return;
    }
    if (key === 'ArrowDown') {
      event.preventDefault();
      moveVertical(1, event.shiftKey);
      return;
    }
    if (key === 'Home') {
      event.preventDefault();
      state.selectionRanges = state.selectionRanges.map((range) => {
        const info = lineInfoForOffset(range.head);
        const target = mod ? 0 : info.lineStart;
        return event.shiftKey ? { anchor: range.anchor, head: target } : { anchor: target, head: target };
      });
      state.selectionRanges = dedupeCollapsed(sortRanges(state.selectionRanges));
      finishGroup();
      queueRender();
      scrollSelectionIntoView();
      return;
    }
    if (key === 'End') {
      event.preventDefault();
      state.selectionRanges = state.selectionRanges.map((range) => {
        const info = lineInfoForOffset(range.head);
        const target = mod ? state.content.length : info.lineStart + info.line.length;
        return event.shiftKey ? { anchor: range.anchor, head: target } : { anchor: target, head: target };
      });
      state.selectionRanges = dedupeCollapsed(sortRanges(state.selectionRanges));
      finishGroup();
      queueRender();
      scrollSelectionIntoView();
      return;
    }
    if (mod && key.toLowerCase() === 'g') {
      event.preventDefault();
      navigateMatches(event.shiftKey ? -1 : 1);
      return;
    }
    if (key.length === 1 && !mod) {
      event.preventDefault();
      typeText(key);
    }
  }

  function handlePaste(event) {
    event.preventDefault();
    typeText(event.clipboardData?.getData('text/plain') || '');
  }

  function handleCopy(event) {
    const range = getPrimaryRange();
    if (range.start === range.end) return;
    event.preventDefault();
    event.clipboardData?.setData('text/plain', currentSelectionText());
  }

  function handleCut(event) {
    const range = getPrimaryRange();
    if (range.start === range.end) return;
    event.preventDefault();
    event.clipboardData?.setData('text/plain', currentSelectionText());
    applyReplacement([range], '', 'cut');
  }

  function handleFindInputKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      editorScroll.focus();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      navigateMatches(event.shiftKey ? -1 : 1);
    }
  }

  function handleScroll() {
    queueRender();
  }

  function handlePreviewScroll() {
    previewScrollState = { top: previewScroll.scrollTop, left: previewScroll.scrollLeft };
    queueRender();
  }

  function handleResize() {
    metricsCache.clear();
    queueRender();
  }

  function handleFindQueryInput() {
    state.findQuery = findInput.value;
    state.activeMatchIndex = 0;
    findMatches();
    if (!state.matches.length) setMessage('No matches found.', 'warning');
  }

  function handleReportChipClick(event) {
    const reportId = event.currentTarget.dataset.reportId;
    loadReport(reportId);
  }

  function bindUi() {
    editorScroll.addEventListener('keydown', handleKeyDown);
    editorScroll.addEventListener('paste', handlePaste);
    editorScroll.addEventListener('copy', handleCopy);
    editorScroll.addEventListener('cut', handleCut);
    editorScroll.addEventListener('mousedown', handleMouseDown);
    editorScroll.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    editorScroll.addEventListener('scroll', handleScroll);
    previewScroll.addEventListener('scroll', handlePreviewScroll);
    findInput.addEventListener('input', handleFindQueryInput);
    findInput.addEventListener('keydown', handleFindInputKeyDown);
    replaceInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') editorScroll.focus();
    });
    findToggleButton.addEventListener('click', () => {
      findBar.hidden = !findBar.hidden;
      if (!findBar.hidden) {
        findInput.focus();
        findInput.select();
      } else {
        editorScroll.focus();
      }
    });
    findPrevButton.addEventListener('click', () => navigateMatches(-1));
    findNextButton.addEventListener('click', () => navigateMatches(1));
    replaceCurrentButton.addEventListener('click', replaceCurrentMatch);
    replaceAllButton.addEventListener('click', replaceAllMatches);
    saveButton.addEventListener('click', saveReport);
    reloadButton.addEventListener('click', reloadLatest);
    discardButton.addEventListener('click', reloadLatest);
    undoButton.addEventListener('click', handleUndo);
    redoButton.addEventListener('click', handleRedo);
    closePreviewButton.addEventListener('click', closePreview);
    previewModal.addEventListener('click', (event) => {
      if (event.target === previewModal || event.target.classList.contains('modal-backdrop')) closePreview();
    });
    window.addEventListener('resize', handleResize);
    reportList.querySelectorAll('.report-chip').forEach((chip) => {
      chip.addEventListener('click', handleReportChipClick);
    });
  }

  function init() {
    renderReports();
    bindUi();
    loadReport(state.reportId || boot.activeReportId).then(() => {
      editorScroll.focus();
      queueRender();
    });
  }

  init();
})();

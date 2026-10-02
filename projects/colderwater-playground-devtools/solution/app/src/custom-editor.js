import { tokenizer, parse } from 'acorn';
import { full as walk } from 'acorn-walk';
import prettier from 'prettier/standalone';
import babelPlugin from 'prettier/plugins/babel';
import estreePlugin from 'prettier/plugins/estree';
import htmlPlugin from 'prettier/plugins/html';

export function mountCodeEditor(host, callbacks = {}) {
  const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  host.innerHTML = `<div class="custom-tools" aria-label="Editor tools">
    <button id="undo-btn" type="button">Undo</button><button id="redo-btn" type="button">Redo</button>
    <button id="format-btn" type="button">Format document</button>
    <label>Find <input id="find-box" aria-label="Find in code"></label>
    <button id="find-next-btn" type="button">Next</button><button id="find-prev-btn" type="button">Previous</button>
    <label>Replace <input id="replace-box" aria-label="Replacement text"></label>
    <button id="replace-current-btn" type="button">Replace</button><button id="replace-all-btn" type="button">Replace all</button>
    <span id="save-state" aria-live="polite"></span>
  </div>
  <div id="editor" class="custom-code-editor" role="textbox" aria-label="Code editor" aria-multiline="true" tabindex="0"></div>
  <div class="editor-footer"><span id="cursor-label">Ln 1, Col 1</span><span id="focus-state">Click the code to edit</span><span id="editor-message" role="status"></span></div>`;
  const editor = host.querySelector('#editor');
  const message = host.querySelector('#editor-message');
  const state = {
    lines: [''], caret: {line: 0, col: 0}, extraCarets: [], selection: null,
    preferredCol: null, undo: [], redo: [], typingGroup: null, dirty: false,
    savedContent: '', query: '', matches: [], activeMatch: -1
  };
  let mode = 'js';
  let suppressChange = false;
  let lastEmitted = '';
  let leaveOnNextTab = false;
  let lastCaretKey = '';
  let syntaxCache = null;
  let syntaxSource = null;
  let syntaxMode = null;
  const onKey = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault(); callbacks.run?.(); return;
    }
    onKeyDown(event);
  };
  editor.addEventListener('keydown', onKey);
  editor.addEventListener('paste', onPaste);
  editor.addEventListener('copy', onCopy);
  editor.addEventListener('cut', onCut);
  editor.addEventListener('mousedown', onMouseDown);
  document.addEventListener('focusin', renderFocusStatus);
  document.addEventListener('focusout', () => queueMicrotask(renderFocusStatus));
  const findBox = host.querySelector('#find-box');
  findBox.addEventListener('input', event => {
    state.query = event.target.value; recomputeMatches(); render();
  });
  findBox.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); event.shiftKey ? findPrevious() : findNext(); }
    if (event.key === 'Escape') { event.preventDefault(); editor.focus(); }
  });
  for (const [id, command] of [
    ['undo-btn', undo], ['redo-btn', redo], ['find-next-btn', findNext],
    ['find-prev-btn', findPrevious], ['replace-current-btn', replaceCurrent],
    ['replace-all-btn', replaceAll]
  ]) host.querySelector('#' + id).addEventListener('click', () => {command(); editor.focus();});
  host.querySelector('#format-btn').addEventListener('click', () => formatDocument());
  host.querySelector('#replace-box').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); replaceCurrent(); editor.focus(); }
    if (event.key === 'Escape') { event.preventDefault(); editor.focus(); }
  });

  function setValue(value, resetHistory = true) {
    suppressChange = true;
    state.lines = String(value).replace(/\r\n?/g, '\n').split('\n');
    state.caret = {line: 0, col: 0}; state.extraCarets = []; state.selection = null;
    if (resetHistory) {state.undo = []; state.redo = []; state.typingGroup = null;}
    state.savedContent = textContent(); state.dirty = false;
    lastEmitted = textContent(); recomputeMatches(); render();
    suppressChange = false;
  }
  function setMode(value) { mode = value === 'html' ? 'html' : 'js'; syntaxSource = null; render(); }
  function markDirty() { state.dirty = textContent() !== state.savedContent; }
  async function formatDocument() {
    try {
      const before = textContent();
      const result = await prettier.format(before, {
        parser: mode === 'html' ? 'html' : 'babel',
        plugins: [babelPlugin, estreePlugin, htmlPlugin],
        tabWidth: 2, useTabs: false, printWidth: 80, semi: true
      });
      const formatted = result.replace(/\n$/, '');
      if (formatted === before) {message.textContent = 'Already formatted.'; editor.focus(); return;}
      pushUndo();
      const priorLine = state.caret.line;
      state.lines = formatted.split('\n');
      state.caret = {line: Math.min(priorLine, state.lines.length - 1), col: 0};
      state.extraCarets = []; state.selection = null;
      markDirty(); recomputeMatches(); render(); editor.focus();
      message.textContent = 'Document formatted. Undo restores the previous source.';
    } catch (error) {
      message.textContent = `Format failed, draft unchanged: ${String(error.message).split('\n')[0]}`;
      editor.focus();
    }
  }
  function syntaxForLine(line) {
    const value = textContent();
    if (syntaxSource !== value || syntaxMode !== mode) {
      syntaxSource = value; syntaxMode = mode;
      syntaxCache = state.lines.map(() => []);
      const add = (start, end, kind) => {
        let offset = 0;
        for (let i = 0; i < state.lines.length && offset < end; i++) {
          const right = offset + state.lines[i].length;
          if (start < right && end > offset) syntaxCache[i].push({start: Math.max(0, start - offset), end: Math.min(right, end) - offset, kind});
          offset = right + 1;
        }
      };
      if (mode === 'js') {
        try {
          const stream = tokenizer(value, {ecmaVersion: 'latest', sourceType: 'script', onComment: (_block, _text, start, end) => add(start, end, 'comment')});
          for (;;) {
            const token = stream.getToken();
            if (token.type.label === 'eof') break;
            const label = token.type.label;
            const kind = token.type.keyword ? 'keyword' : label === 'string' || label === 'template' ? 'string' : label === 'num' ? 'number' : null;
            if (kind) add(token.start, token.end, kind);
          }
        } catch {}
        try {
          const tree = parse(value, {ecmaVersion: 'latest', sourceType: 'script'});
          const names = new Set();
          walk(tree, node => {
            if (node.type === 'FunctionDeclaration' && node.id) names.add(node.id.name);
            if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' &&
                (node.init?.type === 'FunctionExpression' || node.init?.type === 'ArrowFunctionExpression')) names.add(node.id.name);
          });
          walk(tree, node => {
            if (node.type === 'FunctionDeclaration' && node.id) add(node.id.start, node.id.end, 'function');
            if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' &&
                (node.init?.type === 'FunctionExpression' || node.init?.type === 'ArrowFunctionExpression')) add(node.id.start, node.id.end, 'function');
            if (node.type === 'CallExpression' && node.callee?.type === 'Identifier') {
              add(node.callee.start, node.callee.end, 'function');
            }
            if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' &&
                !node.callee.computed && node.callee.property?.type === 'Identifier') {
              add(node.callee.property.start, node.callee.property.end, 'function');
            }
            // Words the tokenizer reports as plain names but that act as keywords here.
            const word = (at, text) => { if (value.startsWith(text, at)) add(at, at + text.length, 'keyword'); };
            if (node.type === 'VariableDeclaration' && node.kind !== 'var' && node.kind !== 'const') word(node.start, node.kind);
            if (node.type === 'AwaitExpression') word(node.start, 'await');
            if (node.type === 'YieldExpression') word(node.start, 'yield');
            if (/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type) && node.async) word(node.start, 'async');
            if ((node.type === 'MethodDefinition' || node.type === 'PropertyDefinition') && node.static) word(node.start, 'static');
            if (node.type === 'ForOfStatement') {
              const gap = value.slice(node.left.end, node.right.start);
              const at = gap.search(/\bof\b/);
              if (at >= 0) add(node.left.end + at, node.left.end + at + 2, 'keyword');
            }
          });
        } catch {}
      } else {
        for (let start = 0; start < value.length; start++) {
          if (value.startsWith('<!--', start)) {
            const close = value.indexOf('-->', start + 4);
            const end = close < 0 ? value.length : close + 3;
            add(start, end, 'comment'); start = end - 1; continue;
          }
          if (value[start] !== '<' || !/^<\/?[A-Za-z]/.test(value.slice(start))) continue;
          let quote = null, end = start + 1;
          for (; end < value.length; end++) {
            const char = value[end];
            if (quote) { if (char === quote) quote = null; }
            else if (char === '"' || char === "'") quote = char;
            else if (char === '>') break;
          }
          const segment = value.slice(start, Math.min(end + 1, value.length));
          const tag = /^<\/?([A-Za-z][\w:-]*)/.exec(segment);
          if (tag) add(start + segment.indexOf(tag[1]), start + segment.indexOf(tag[1]) + tag[1].length, 'tag');
          for (const attr of segment.matchAll(/([A-Za-z_:][\w:.-]*)\s*=/g)) add(start + attr.index, start + attr.index + attr[1].length, 'attribute');
          for (const quoted of segment.matchAll(/"[^"]*"|'[^']*'/g)) add(start + quoted.index, start + quoted.index + quoted[0].length, 'string');
          start = end;
        }
      }
      for (const tokens of syntaxCache) tokens.sort((a,b) => a.start - b.start || (a.kind === 'function' ? -1 : 1));
    }
    return syntaxCache[line] || [];
  }

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
    message.textContent = 'Undid the last change.';
  }

  function redo() {
    if (!state.redo.length) return;
    state.undo.push(snapshot());
    restore(state.redo.pop());
    message.textContent = 'Redid the change.';
  }

  function textContent() {
    return state.lines.join('\n');
  }

  function onPaste(event) {
    event.preventDefault();
    const text = (event.clipboardData?.getData('text/plain') || '').replace(/\r\n?/g, '\n');
    if (text) insertText(text);
  }

  function onCopy(event) {
    const text = selectedText();
    if (!text) return;
    event.preventDefault();
    event.clipboardData?.setData('text/plain', text);
  }

  function onCut(event) {
    const text = selectedText();
    if (!text) return;
    event.preventDefault();
    event.clipboardData?.setData('text/plain', text);
    removeSelection();
  }

  function onKeyDown(event) {
    if (['Shift', 'Control', 'Meta', 'Alt'].includes(event.key)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      state.typingGroup = null;
      leaveOnNextTab = true;
      message.textContent = 'Press Tab to leave the editor.';
      return;
    }
    if (leaveOnNextTab && event.key !== 'Tab') leaveOnNextTab = false;
    if (event.metaKey || event.ctrlKey) {
      const key = event.key.toLowerCase();
      if (key === 'home' || key === 'end') {
        event.preventDefault();
        moveCaret(event.key, event.shiftKey, true);
        return;
      }
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
        callbacks.save?.();
        return;
      }
      if (key === 'a') {
        event.preventDefault();
        selectAll();
        return;
      }
      // Copy, cut and paste arrive through the browser's own clipboard events.
      if (key === 'c' || key === 'x' || key === 'v') return;
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
      if (leaveOnNextTab) { leaveOnNextTab = false; return; }
      event.preventDefault();
      if (!collapsedSelection()) indentSelectedLines(event.shiftKey);
      else if (event.shiftKey) outdentCurrentLine();
      else insertText('  ');
      return;
    }
    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      insertText(event.key);
    }
  }

  function onMouseDown(event) {
    state.typingGroup = null;
    const pos = pointToPosition(event);
    if (!pos) return;
    event.preventDefault();
    editor.focus({ preventScroll: true });
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

  function removeSelection() {
    if (collapsedSelection()) return;
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

  function pointToPosition(event) {
    const lineEl = event.target.closest?.('.line');
    if (!lineEl) return null;
    const line = Number(lineEl.dataset.line);
    const textEl = lineEl.querySelector('.text');



    const content = state.lines[line];
    if (!content) return { line, col: 0 };
    const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    const boundaries = [...graphemeSegmenter.segment(content)].map(part => part.index);
    boundaries.push(content.length);
    const range = document.createRange();
    let nodeIndex = 0, offset = 0, col = 0, distance = Infinity;
    for (const boundary of boundaries) {
      while (nodeIndex < nodes.length - 1 && boundary > offset + nodes[nodeIndex].length) {
        offset += nodes[nodeIndex++].length;
      }
      if (!nodes[nodeIndex]) break;
      range.setStart(nodes[nodeIndex], boundary - offset);
      range.collapse(true);
      const nextDistance = Math.abs(event.clientX - range.getBoundingClientRect().left);
      if (nextDistance < distance) { distance = nextDistance; col = boundary; }
    }
    return { line, col };
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
    message.textContent = '';
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
      // Work on document offsets so carets sharing a line keep their own text.
      const offsets = carets.map(positionToIndex);
      const source = textContent();
      let output = '';
      let consumed = 0;
      offsets.forEach((offset) => {
        output += source.slice(consumed, offset) + text;
        consumed = offset;
      });
      output += source.slice(consumed);
      state.lines = output.split('\n');
      const moved = offsets.map((offset, index) => indexToPosition(offset + (index + 1) * text.length));
      state.caret = moved[0];
      state.extraCarets = moved.slice(1);
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

  function moveCaret(key, selecting, documentEdge = false) {
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
      next = { line: documentEdge ? 0 : state.caret.line, col: 0 };
      state.preferredCol = 0;
    } else if (key === 'End') {
      const line = documentEdge ? state.lines.length - 1 : state.caret.line;
      next = { line, col: state.lines[line].length };
      state.preferredCol = next.col;
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
      const targetLine = key === 'ArrowUp'
        ? Math.max(0, state.caret.line - 1)
        : Math.min(state.lines.length - 1, state.caret.line + 1);
      const preferred = state.preferredCol ?? state.caret.col;
      next = { line: targetLine, col: snapToGrapheme(state.lines[targetLine], Math.min(preferred, state.lines[targetLine].length)) };
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

  function indentSelectedLines(outdent) {
    const range = selectionRange();
    const last = range.end.line - (range.end.col === 0 ? 1 : 0);
    const changes = new Map();
    for (let line = range.start.line; line <= last; line++) {
      const text = state.lines[line];
      const remove = outdent ? (text.startsWith('\t') ? 1 : Math.min((text.match(/^ */)?.[0].length || 0), 2)) : 0;
      changes.set(line, outdent ? -remove : 2);
    }
    if (![...changes.values()].some(Boolean)) return;
    pushUndo();
    for (const [line, delta] of changes) {
      state.lines[line] = delta < 0 ? state.lines[line].slice(-delta) : ' '.repeat(delta) + state.lines[line];
    }
    const adjust = (position) => ({line: position.line, col: Math.max(0, position.col + (changes.get(position.line) || 0))});
    state.selection = {anchor: adjust(state.selection.anchor), head: adjust(state.selection.head)};
    state.caret = adjust(state.caret);
    state.extraCarets = [];
    state.preferredCol = null;
    markDirty();
    recomputeMatches();
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

  // Never leave the caret inside an emoji or between a letter and its accent.
  function snapToGrapheme(text, index) {
    let boundary = 0;
    for (const segment of graphemeSegmenter.segment(text)) {
      if (segment.index > index) break;
      boundary = segment.index;
    }
    return index >= text.length ? text.length : boundary;
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
    // The current match is whichever match the live selection covers exactly.
    state.activeMatch = -1;
    if (state.selection && !collapsedSelection()) {
      const { start, end } = selectionRange();
      state.activeMatch = state.matches.findIndex((m) =>
        m.line === start.line && m.col === start.col && m.line === end.line && m.endCol === end.col);
    }
  }

  function selectMatch(index) {
    const match = state.matches[index];
    state.activeMatch = index;
    state.selection = {
      anchor: { line: match.line, col: match.col },
      head: { line: match.line, col: match.endCol }
    };
    state.caret = { line: match.line, col: match.endCol };
    state.preferredCol = state.caret.col;
    state.extraCarets = [];
    state.typingGroup = null;
  }

  function clearMatchSelection(text) {
    state.activeMatch = -1;
    state.selection = null;
    message.textContent = text;
    render();
  }

  function findNext() {
    state.query = document.getElementById('find-box').value;
    recomputeMatches();
    if (!state.matches.length) {
      clearMatchSelection(state.query ? 'No matches.' : 'Type text to find.');
      return;
    }
    const from = state.selection && !collapsedSelection() ? selectionRange().end : normalizePos(state.caret);
    let index = state.matches.findIndex((m) => comparePos({ line: m.line, col: m.col }, from) >= 0);
    if (index < 0) index = 0;
    selectMatch(index);
    message.textContent = `Match ${index + 1} of ${state.matches.length}.`;
    render();
  }

  function findPrevious() {
    state.query = document.getElementById('find-box').value;
    recomputeMatches();
    if (!state.matches.length) {
      clearMatchSelection(state.query ? 'No matches.' : 'Type text to find.');
      return;
    }
    const from = state.selection && !collapsedSelection() ? selectionRange().start : normalizePos(state.caret);
    let index = -1;
    state.matches.forEach((m, i) => {
      if (comparePos({ line: m.line, col: m.endCol }, from) <= 0) index = i;
    });
    if (index < 0) index = state.matches.length - 1;
    selectMatch(index);
    message.textContent = `Match ${index + 1} of ${state.matches.length}.`;
    render();
  }

  function replaceCurrent() {
    state.query = document.getElementById('find-box').value;
    recomputeMatches();
    if (!state.matches.length || state.activeMatch < 0) {
      message.textContent = 'Use Next or Previous to choose a match first.';
      return;
    }
    const match = state.matches[state.activeMatch];
    const replacement = document.getElementById('replace-box').value;
    pushUndo();
    const start = { line: match.line, col: match.col };
    const end = replaceRange(start, { line: match.line, col: match.endCol }, replacement);
    state.caret = end;
    state.preferredCol = end.col;
    state.selection = null;
    state.extraCarets = [];
    markDirty();
    recomputeMatches();
    // Move to the following original match, skipping text that was just inserted.
    const outside = (m) => comparePos({ line: m.line, col: m.endCol }, start) <= 0 ||
      comparePos({ line: m.line, col: m.col }, end) >= 0;
    let next = state.matches.findIndex((m) => comparePos({ line: m.line, col: m.col }, end) >= 0);
    if (next < 0) next = state.matches.findIndex(outside);
    if (next >= 0) selectMatch(next);
    message.textContent = next >= 0 ? 'Replaced one match. The next match is selected.' : 'Replaced one match. No matches remain.';
    render();
  }

  function replaceAll() {
    state.query = document.getElementById('find-box').value;
    const replacement = document.getElementById('replace-box').value;
    recomputeMatches();
    if (!state.query || !state.matches.length) {
      message.textContent = state.query ? 'No matches to replace.' : 'Type text to find.';
      return;
    }
    const count = state.matches.length;
    pushUndo();
    // split/join visits each original match once, so inserted text is never rescanned.
    const next = state.lines.map((line) => line.split(state.query).join(replacement));
    state.lines = next.join('\n').split('\n');
    state.caret = { line: 0, col: 0 };
    state.preferredCol = 0;
    state.selection = null;
    state.extraCarets = [];
    markDirty();
    recomputeMatches();
    message.textContent = `Replaced ${count} ${count === 1 ? 'match' : 'matches'}. Undo restores them.`;
    render();
  }

  function render() {
    if (!state.lines.length) {
      editor.innerHTML = '<div class="line"><div class="gutter">1</div><div class="text">Loading document...</div></div>';
      return;
    }
    document.getElementById('cursor-label').textContent = `Ln ${state.caret.line + 1}, Col ${state.caret.col + 1}`;
    renderStatus();

    const fragment = document.createDocumentFragment();
    const range = state.selection && !collapsedSelection() ? selectionRange() : null;
    const caretSet = [state.caret, ...state.extraCarets].map(normalizePos);

    for (let lineIndex = 0; lineIndex < state.lines.length; lineIndex += 1) {
      const row = document.createElement('div');
      row.className = 'line';
      if (/^[A-Z][A-Za-z ]{2,40}$/.test(state.lines[lineIndex]) &&
          (lineIndex === 0 || state.lines[lineIndex - 1] === '')) {
        row.classList.add('section-heading');
      }
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
    const next = textContent();
    const caretKey = `${state.caret.line}:${state.caret.col}:${next.length}`;
    if (caretKey !== lastCaretKey) { lastCaretKey = caretKey; revealCaret(); }
    if (!suppressChange && next !== lastEmitted) { lastEmitted = next; callbacks.onChange?.(next); }
  }

  // Keep the primary caret inside the visible part of the scrolling editor.
  function revealCaret() {
    const caretEl = editor.querySelector('.primary-caret');
    if (!caretEl) return;
    const box = editor.getBoundingClientRect();
    const caretBox = caretEl.getBoundingClientRect();
    const gutter = editor.querySelector('.gutter')?.getBoundingClientRect().width || 0;
    const left = box.left + gutter + 8;
    const right = box.left + editor.clientWidth - 16;
    if (caretBox.left < left) editor.scrollLeft -= left - caretBox.left;
    else if (caretBox.right > right) editor.scrollLeft += caretBox.right - right;
    const rowBox = (caretEl.closest('.line') || caretEl).getBoundingClientRect();
    const top = box.top;
    const bottom = box.top + editor.clientHeight;
    if (rowBox.top < top) editor.scrollTop -= top - rowBox.top;
    else if (rowBox.bottom > bottom) editor.scrollTop += rowBox.bottom - bottom;
  }

  function renderStatus() {
    const count = state.query ? `${state.matches.length} matches` : 'No active search';
    document.getElementById('save-state').textContent = count;
    document.getElementById('undo-btn').disabled = state.undo.length === 0;
    document.getElementById('redo-btn').disabled = state.redo.length === 0;
    renderFocusStatus();
  }

  function renderFocusStatus() {
    const active = document.activeElement;
    const label = document.getElementById('focus-state');
    if (active === editor) {
      label.textContent = 'Editing area focused. Escape, then Tab leaves the editor.';
    } else if (active === document.getElementById('find-box')) {
      label.textContent = state.activeMatch >= 0 && !collapsedSelection()
        ? `Find focused. Match ${state.activeMatch + 1} of ${state.matches.length} selected. Escape returns to the editor.`
        : state.query && state.matches.length
          ? 'Find focused. Press Enter or Find Next to select a match. Escape returns to the editor.'
          : 'Find focused. No match selected. Escape returns to the editor.';
    } else if (active === document.getElementById('replace-box')) {
      label.textContent = 'Replacement field focused.';
    } else {
      label.textContent = 'Click the code to edit, or use Find to select text.';
    }
  }


  function renderLine(lineIndex, selectionRangeValue, caretSet) {
    const line = state.lines[lineIndex];
    const tokens = syntaxForLine(lineIndex);
    const points = new Set([0, line.length]);
    for (const token of tokens) { points.add(token.start); points.add(token.end); }
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
      caretSet.forEach((caret, caretIndex) => {
        if (caret.line === lineIndex && caret.col === col) {
          html += `<span class="caret ${caretIndex === 0 ? 'primary-caret' : 'multi-caret'}"></span>`;
        }
      });
      const next = sorted[i + 1];
      if (next === undefined || next === col) continue;
      const text = line.slice(col, next);
      const classes = [];
      if (isSelected(lineIndex, col, next, selectionRangeValue)) classes.push('selection');
      const hitIndex = state.matches.findIndex((m) => m.line === lineIndex && m.col <= col && m.endCol >= next);
      if (hitIndex >= 0) classes.push(hitIndex === state.activeMatch ? 'find-hit active-hit' : 'find-hit');
      const token = tokens.find(t => t.start <= col && t.end >= next);
      if (token) classes.push('tok-' + token.kind);
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
    revealCaret();
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
  render();
  return {
    getValue: textContent,
    setValue,
    setMode,
    format: formatDocument,
    undo,
    redo,
    focus: () => editor.focus(),
    endTypingRun: () => { state.typingGroup = null; },
    destroy: () => { editor.removeEventListener('keydown', onKey); host.replaceChildren(); }
  };
}

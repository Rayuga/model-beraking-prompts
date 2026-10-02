(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    title: $('titleInput'), filename: $('filenameInput'), editor: $('editorScroll'), bridge: $('inputBridge'),
    code: $('highlightLayer'), selection: $('selectionLayer'), carets: $('caretLayer'), gutter: $('gutter'),
    frame: $('previewFrame'), empty: $('previewEmpty'), output: $('consoleOutput'), state: $('draftState'),
    stateText: $('stateText'), position: $('positionStatus'), selectionStatus: $('selectionStatus'), message: $('messageStatus'),
    runState: $('runState'), toast: $('toastRegion'), library: $('libraryList'), count: $('libraryCount'),
    history: $('historyDialog'), historyTitle: $('historyTitle'), historyList: $('historyList')
  };
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const modKey = (e) => isMac ? e.metaKey : e.ctrlKey;
  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const glyphs = (text) => segmenter ? [...segmenter.segment(text)].map((part) => part.segment) : Array.from(text);

  const editor = { source: '', selections: [{ anchor: 0, head: 0, preferred: 0 }], undo: [], redo: [], focused: false, escapeArmed: false, dragging: false, dragAnchor: 0, activeSnippet: null, externalRevision: false };
  const runtime = { token: 0, active: false, frameWindow: null, timer: null, lastGood: null };
  let libraryPoll;

  function esc(text) { return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function linesOf(source) { return source.split('\n'); }
  function lineStarts(source) { const out = [0]; for (let i = 0; i < source.length; i++) if (source[i] === '\n') out.push(i + 1); return out; }
  function posToLC(pos) { const starts = lineStarts(editor.source); let line = 0; while (line + 1 < starts.length && starts[line + 1] <= pos) line++; return { line, col: glyphs(editor.source.slice(starts[line], pos)).length }; }
  function lcToPos(line, col) { const ls = linesOf(editor.source); const starts = lineStarts(editor.source); const chars = glyphs(ls[Math.max(0, Math.min(line, ls.length - 1))]); return starts[Math.max(0, Math.min(line, starts.length - 1))] + Array.from(chars.slice(0, Math.max(0, Math.min(col, chars.length)))).join('').length; }
  function cpLength(text) { return Array.from(text).length; }
  function visualColumn(lineText, col) { return Array.from(lineText.slice(0, col)).length; }
  function normalizeSelection(s) { return { start: Math.min(s.anchor, s.head), end: Math.max(s.anchor, s.head), forward: s.head >= s.anchor }; }
  function snapshot() { return { source: editor.source, selections: editor.selections.map((s) => ({ ...s })) }; }
  function restoreSnapshot(s) { editor.source = s.source; editor.selections = s.selections.map((x) => ({ ...x })); render(); }
  function recordUndo() { editor.undo.push(snapshot()); if (editor.undo.length > 100) editor.undo.shift(); editor.redo = []; updateUndoButtons(); }
  function undo() { if (!editor.undo.length) return; editor.redo.push(snapshot()); restoreSnapshot(editor.undo.pop()); updateDirty(); message('Undo applied.'); focusEditor(); }
  function redo() { if (!editor.redo.length) return; editor.undo.push(snapshot()); restoreSnapshot(editor.redo.pop()); updateUndoButtons(); updateDirty(); message('Redo applied.'); focusEditor(); }
  function updateUndoButtons() { $('undoBtn').disabled = !editor.undo.length; $('redoBtn').disabled = !editor.redo.length; }
  function message(text, kind = '') { els.message.textContent = text; els.message.style.color = kind === 'error' ? 'var(--red)' : kind === 'success' ? 'var(--green)' : ''; }
  function toast(text, kind = '') { const item = document.createElement('div'); item.className = `toast ${kind}`; item.textContent = text; els.toast.appendChild(item); setTimeout(() => item.remove(), 4200); }
  function focusEditor() { els.editor.focus(); editor.focused = true; editor.escapeArmed = false; render(); }
  function currentCaret() { return editor.selections[0].head; }
  function setSingle(pos, anchor = pos) { editor.selections = [{ anchor: pos === undefined ? currentCaret() : anchor, head: pos === undefined ? currentCaret() : pos, preferred: 0 }]; }

  function applyEdits(edits, label = 'Edit') {
    const valid = edits.filter(Boolean).sort((a, b) => b.start - a.start || b.end - a.end);
    if (!valid.length) return;
    recordUndo();
    let source = editor.source;
    const newSelections = [];
    let lastStart = Infinity;
    valid.forEach((edit) => {
      if (edit.start > lastStart) return;
      source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
      const caret = edit.start + edit.text.length;
      newSelections.push({ anchor: caret, head: caret, preferred: 0 });
      lastStart = edit.start;
    });
    editor.source = source;
    editor.selections = newSelections.reverse();
    render(); updateDirty(); message(`${label}.`); focusEditor();
  }
  function insertText(text, label = text.includes('\n') ? 'Pasted text inserted' : 'Text inserted') {
    const edits = editor.selections.map((s) => { const n = normalizeSelection(s); return { start: n.start, end: n.end, text }; });
    applyEdits(edits, label);
  }
  function deleteBackward() {
    const edits = [];
    editor.selections.forEach((s) => { const n = normalizeSelection(s); if (n.start !== n.end) edits.push({ start: n.start, end: n.end, text: '' }); else if (n.start > 0) { const prior = glyphs(editor.source.slice(0, n.start)); const len = prior.length ? prior[prior.length - 1].length : 1; edits.push({ start: n.start - len, end: n.start, text: '' }); } });
    applyEdits(dedupeEdits(edits), 'Deleted');
  }
  function deleteForward() {
    const edits = [];
    editor.selections.forEach((s) => { const n = normalizeSelection(s); if (n.start !== n.end) edits.push({ start: n.start, end: n.end, text: '' }); else { const next = glyphs(editor.source.slice(n.start))[0]; if (next) edits.push({ start: n.start, end: n.start + next.length, text: '' }); } });
    applyEdits(dedupeEdits(edits), 'Deleted');
  }
  function dedupeEdits(edits) { const seen = new Set(); return edits.filter((e) => { const key = `${e.start}:${e.end}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
  function moveHorizontal(dir, extend) {
    const selections = editor.selections.map((s) => {
      let pos = s.head; if (!extend && s.anchor !== s.head) pos = dir < 0 ? Math.min(s.anchor, s.head) : Math.max(s.anchor, s.head);
      else { const chars = glyphs(editor.source); pos = Math.max(0, Math.min(chars.length, glyphs(editor.source.slice(0, pos)).length + dir)); pos = chars.slice(0, pos).join('').length; }
      return { anchor: extend ? s.anchor : pos, head: pos, preferred: 0 };
    });
    editor.selections = selections; render(); ensureCaretVisible();
  }
  function moveVertical(dir, extend) {
    editor.selections = editor.selections.map((s) => { const lc = posToLC(s.head); const desired = s.preferred || lc.col; const line = Math.max(0, Math.min(linesOf(editor.source).length - 1, lc.line + dir)); const pos = lcToPos(line, desired); return { anchor: extend ? s.anchor : pos, head: pos, preferred: desired }; }); render(); ensureCaretVisible();
  }
  function moveLine(edge, extend) { editor.selections = editor.selections.map((s) => { const lc = posToLC(s.head); const pos = lcToPos(lc.line, edge === 'start' ? 0 : linesOf(editor.source)[lc.line].length); return { anchor: extend ? s.anchor : pos, head: pos, preferred: 0 }; }); render(); ensureCaretVisible(); }
  function indentSelection(outdent) {
    const ranges = editor.selections.map(normalizeSelection); const startLine = Math.min(...ranges.map((r) => posToLC(r.start).line)); let endLine = Math.max(...ranges.map((r) => posToLC(r.end).line)); if (ranges.every((r) => r.end > 0 && editor.source[r.end - 1] === '\n')) endLine--;
    const ls = linesOf(editor.source); const starts = lineStarts(editor.source); const edits = [];
    for (let i = startLine; i <= endLine; i++) { if (outdent) { const count = ls[i].startsWith('  ') ? 2 : ls[i].startsWith('\t') ? 1 : ls[i].startsWith(' ') ? 1 : 0; if (count) edits.push({ start: starts[i], end: starts[i] + count, text: '' }); } else edits.push({ start: starts[i], end: starts[i], text: '  ' }); }
    applyEdits(edits, outdent ? 'Selection outdented' : 'Selection indented');
  }

  function jsHighlight(text) {
    let html = '', i = 0, expectFunction = false;
    const keyword = /^(?:const|let|var|function|return|if|else|for|while|new|class|extends|async|await|throw|try|catch|finally|switch|case|break|continue|typeof|this|true|false|null|undefined|import|export|from|in|of|instanceof|delete|void|yield)\b/;
    while (i < text.length) {
      const rest = text.slice(i); let m;
      if (rest.startsWith('//')) { html += `<span class="tok-comment">${esc(rest)}</span>`; break; }
      if (rest.startsWith('/*')) { const end = text.indexOf('*/', i + 2); const take = end < 0 ? rest : text.slice(i, end + 2); html += `<span class="tok-comment">${esc(take)}</span>`; i += take.length; continue; }
      if (/^["'`]/.test(rest)) { const q = rest[0]; let j = 1; while (j < rest.length) { if (rest[j] === '\\') j += 2; else if (rest[j] === q) { j++; break; } else j++; } html += `<span class="tok-string">${esc(rest.slice(0, j))}</span>`; i += j; continue; }
      if ((m = rest.match(/^\b\d+(?:\.\d+)?\b/))) { html += `<span class="tok-number">${m[0]}</span>`; i += m[0].length; continue; }
      if ((m = rest.match(/^[A-Za-z_$][\w$]*/))) { const word = m[0]; const after = text.slice(i + word.length).match(/^\s*\(/); const cls = keyword.test(word) ? 'tok-keyword' : (after || expectFunction) ? 'tok-function' : ''; html += cls ? `<span class="${cls}">${esc(word)}</span>` : esc(word); expectFunction = word === 'function'; i += word.length; continue; }
      html += esc(rest[0]); i++;
    }
    return html;
  }
  function htmlHighlight(text) {
    let output = '', last = 0; const re = /<!--[\s\S]*?-->|<\/?([A-Za-z][\w:-]*)([^>]*?)>/g; let m;
    while ((m = re.exec(text))) { output += esc(text.slice(last, m.index)); const token = m[0]; if (token.startsWith('<!--')) output += `<span class="tok-comment">${esc(token)}</span>`; else { const match = token.match(/^(<\/?)([A-Za-z][\w:-]*)([\s\S]*?)(>)$/); let attrs = esc(match[3]).replace(/([:\w-]+)(=)(["'][^"']*["'])/g, '<span class="tok-attr">$1</span>$2<span class="tok-string">$3</span>'); output += `<span class="tok-punc">${esc(match[1])}</span><span class="tok-tag">${esc(match[2])}</span>${attrs}<span class="tok-punc">${esc(match[4])}</span>`; } last = m.index + token.length; }
    return output + esc(text.slice(last));
  }
  function render() {
    const htmlMode = /\.html$/i.test(els.filename.value.trim()); const ls = linesOf(editor.source); const lineHtml = htmlMode ? htmlHighlight(editor.source) : jsHighlight(editor.source);
    const pieces = lineHtml.split('\n'); els.code.innerHTML = pieces.map((line, i) => `<div class="code-line ${line ? '' : 'empty'}" data-line="${i}">${line || ' '}</div>`).join('');
    els.gutter.innerHTML = ls.map((_, i) => `<div class="gutter-line ${editor.selections.some((s) => posToLC(s.head).line === i) ? 'active' : ''}">${i + 1}</div>`).join('');
    const starts = lineStarts(editor.source); const ranges = editor.selections.map(normalizeSelection); let selectionRects = '';
    ranges.forEach((range) => { if (range.start === range.end) return; const from = posToLC(range.start), to = posToLC(range.end); for (let line = from.line; line <= to.line; line++) { const startCol = line === from.line ? from.col : 0; const endCol = line === to.line ? to.col : Array.from(ls[line]).length; selectionRects += `<div class="selection-rect" style="left:${startCol * 7.83}px;top:${(line) * 21}px;width:${Math.max(3, (endCol - startCol) * 7.83)}px"></div>`; } });
    els.selection.innerHTML = selectionRects;
    els.carets.innerHTML = editor.selections.map((s, idx) => { const p = posToLC(s.head); return `<div class="caret ${idx ? 'secondary' : ''}" style="left:${p.col * 7.83}px;top:${p.line * 21}px"></div>`; }).join('');
    const primary = posToLC(currentCaret()); els.position.textContent = `Ln ${primary.line + 1}, Col ${primary.col + 1}`; els.selectionStatus.textContent = `${htmlMode ? 'HTML' : 'JavaScript'} · ${editor.source.length.toLocaleString()} characters`;
    updateUndoButtons(); updateDirty();
  }
  function ensureCaretVisible() { const p = posToLC(currentCaret()); const x = 16 + p.col * 7.83; const y = 18 + p.line * 21; const view = els.editor; if (x < view.scrollLeft + 50) view.scrollLeft = Math.max(0, x - 50); else if (x > view.scrollLeft + view.clientWidth - 40) view.scrollLeft = x - view.clientWidth + 40; if (y < view.scrollTop + 18) view.scrollTop = Math.max(0, y - 18); else if (y > view.scrollTop + view.clientHeight - 35) view.scrollTop = y - view.clientHeight + 35; }
  function updateDirty() { const saved = editor.activeSnippet; const dirty = !saved || saved.title !== els.title.value || saved.filename !== els.filename.value || saved.source !== editor.source; els.state.className = `draft-state ${dirty ? '' : 'saved'} ${editor.externalRevision ? 'conflict' : ''}`; els.stateText.textContent = editor.externalRevision ? 'Newer revision available' : dirty ? (saved ? 'Unsaved changes' : 'Unsaved draft') : 'Saved'; }

  function mousePosition(e) { const rect = els.code.getBoundingClientRect(); const x = Math.max(0, e.clientX - rect.left + els.editor.scrollLeft - 16); const y = Math.max(0, e.clientY - rect.top + els.editor.scrollTop - 18); return lcToPos(Math.floor(y / 21), Math.round(x / 7.83)); }
  els.editor.addEventListener('mousedown', (e) => { if (e.button !== 0) return; const pos = mousePosition(e); if (e.detail === 3) { const line = posToLC(pos).line; const start = lineStarts(editor.source)[line]; const end = start + linesOf(editor.source)[line].length; editor.selections = [{ anchor: start, head: end, preferred: 0 }]; render(); focusEditor(); e.preventDefault(); return; } if (e.altKey || e.metaKey || e.ctrlKey) { editor.selections.push({ anchor: pos, head: pos, preferred: 0 }); render(); focusEditor(); return; } editor.selections = [{ anchor: pos, head: pos, preferred: 0 }]; editor.dragging = true; editor.dragAnchor = pos; render(); focusEditor(); e.preventDefault(); });
  document.addEventListener('mousemove', (e) => { if (!editor.dragging) return; editor.selections[0].head = mousePosition(e); render(); });
  document.addEventListener('mouseup', () => { editor.dragging = false; });
  els.editor.addEventListener('dblclick', (e) => { const p = mousePosition(e); const before = editor.source.slice(0, p); const after = editor.source.slice(p); const a = before.match(/[\w$-]+$/)?.[0]?.length || 0; const b = after.match(/^[\w$-]+/)?.[0]?.length || 0; editor.selections = [{ anchor: p - a, head: p + b, preferred: 0 }]; render(); });
  els.editor.addEventListener('keydown', (e) => {
    editor.focused = true;
    if (e.key === 'Escape') { editor.escapeArmed = true; message('Press Tab now to leave the editor.'); e.preventDefault(); return; }
    if (e.key === 'Tab' && editor.escapeArmed) { e.preventDefault(); editor.escapeArmed = false; $('formatBtn').focus(); return; }
    if (modKey(e) && e.key.toLowerCase() === 's') { e.preventDefault(); saveSnippet(); return; }
    if (modKey(e) && e.key === 'Enter') { e.preventDefault(); runSource(); return; }
    if (modKey(e) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (modKey(e) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (modKey(e) && e.key.toLowerCase() === 'a') { e.preventDefault(); editor.selections = [{ anchor: 0, head: editor.source.length, preferred: 0 }]; render(); return; }
    if (modKey(e) && e.key.toLowerCase() === 'c') { const text = selectedText(); if (text) navigator.clipboard?.writeText(text); e.preventDefault(); return; }
    if (modKey(e) && e.key.toLowerCase() === 'x') { const text = selectedText(); if (text) navigator.clipboard?.writeText(text); deleteBackward(); e.preventDefault(); return; }
    const extend = e.shiftKey;
    if (e.key === 'ArrowLeft') { moveHorizontal(-1, extend); e.preventDefault(); return; }
    if (e.key === 'ArrowRight') { moveHorizontal(1, extend); e.preventDefault(); return; }
    if (e.key === 'ArrowUp') { moveVertical(-1, extend); e.preventDefault(); return; }
    if (e.key === 'ArrowDown') { moveVertical(1, extend); e.preventDefault(); return; }
    if (e.key === 'Home') { moveLine('start', extend); e.preventDefault(); return; }
    if (e.key === 'End') { moveLine('end', extend); e.preventDefault(); return; }
    if (e.key === 'Backspace') { deleteBackward(); e.preventDefault(); return; }
    if (e.key === 'Delete') { deleteForward(); e.preventDefault(); return; }
    if (e.key === 'Enter') { insertText('\n', 'New line inserted'); e.preventDefault(); return; }
    if (e.key === 'Tab') { indentSelection(e.shiftKey); e.preventDefault(); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { insertText(e.key); e.preventDefault(); }
  });
  els.editor.addEventListener('paste', (e) => { e.preventDefault(); const text = e.clipboardData?.getData('text/plain'); if (text !== undefined) insertText(text, 'Pasted text inserted'); });
  function selectedText() { return editor.selections.map((s) => { const n = normalizeSelection(s); return editor.source.slice(n.start, n.end); }).join('\n'); }

  function findMatches() { const term = $('findInput').value; if (!term) return []; const out = []; let at = 0; while ((at = editor.source.indexOf(term, at)) >= 0) { out.push({ start: at, end: at + term.length }); at += term.length || 1; } return out; }
  function findNext(direction = 1) { const matches = findMatches(); if (!matches.length) { message('No literal matches found.', 'error'); return; } const current = currentCaret(); let match; if (direction > 0) match = matches.find((m) => m.start > current) || matches[0]; else match = [...matches].reverse().find((m) => m.end < current) || matches[matches.length - 1]; editor.selections = [{ anchor: match.start, head: match.end, preferred: 0 }]; render(); ensureCaretVisible(); focusEditor(); message(`Match ${matches.indexOf(match) + 1} of ${matches.length}.`); }
  function replaceCurrent() { const n = normalizeSelection(editor.selections[0]); const term = $('findInput').value; if (!term || editor.source.slice(n.start, n.end) !== term) { findNext(); return; } const next = $('replaceInput').value; applyEdits([{ start: n.start, end: n.end, text: next }], 'Match replaced'); findNext(); }
  function replaceAll() { const term = $('findInput').value; if (!term) return; const matches = findMatches(); if (!matches.length) { message('No literal matches found.', 'error'); return; } applyEdits(matches.map((m) => ({ ...m, text: $('replaceInput').value })), `${matches.length} match${matches.length === 1 ? '' : 'es'} replaced`); }
  $('findNext').onclick = () => findNext(1); $('findPrev').onclick = () => findNext(-1); $('replaceOne').onclick = replaceCurrent; $('replaceAll').onclick = replaceAll; $('findInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') findNext(e.shiftKey ? -1 : 1); });

  function scanUnsafe(source) {
    const found = []; let i = 0, quote = null, lineComment = false, blockComment = false;
    while (i < source.length) { const c = source[i], n = source[i + 1]; if (lineComment) { if (c === '\n') lineComment = false; i++; continue; } if (blockComment) { if (c === '*' && n === '/') { blockComment = false; i += 2; } else i++; continue; } if (quote) { if (c === '\\') i += 2; else if (c === quote) { quote = null; i++; } else i++; continue; } if (c === '/' && n === '/') { lineComment = true; i += 2; continue; } if (c === '/' && n === '*') { blockComment = true; i += 2; continue; } if (/['"`]/.test(c)) { quote = c; i++; continue; } const rest = source.slice(i); const checks = [[/^(?:window\.)?eval\s*\(/, 'eval()'], [/^(?:new\s+)?Function\s*\(/, 'Function()'], [/^WebAssembly\b/, 'WebAssembly'], [/^(?:new\s+)?Worker\b/, 'Worker'], [/^import\s*\(/, 'dynamic import()']]; const hit = checks.find(([re]) => re.test(rest)); if (hit) found.push(hit[1]); i++; }
    return [...new Set(found)];
  }
  function lineFromError(error) { const m = String(error?.stack || error?.message || '').match(/(?:<anonymous>|playground|app\.js)[^:]*:(\d+)(?::\d+)?/); return m ? Number(m[1]) : null; }
  function formatJS(source) {
    const tokens = []; let i = 0, current = ''; const flush = () => { if (current.trim()) tokens.push({ type: 'text', value: current.trim() }); current = ''; };
    while (i < source.length) { const c = source[i], n = source[i + 1]; if (c === '/' && n === '/') { flush(); let j = source.indexOf('\n', i); if (j < 0) j = source.length; tokens.push({ type: 'line', value: source.slice(i, j).trim() }); i = j; continue; } if (c === '/' && n === '*') { flush(); let j = source.indexOf('*/', i + 2); j = j < 0 ? source.length : j + 2; tokens.push({ type: 'block', value: source.slice(i, j).trim() }); i = j; continue; } if (/['"`]/.test(c)) { const q = c; let j = i + 1; while (j < source.length) { if (source[j] === '\\') j += 2; else if (source[j] === q) { j++; break; } else j++; } current += source.slice(i, j); i = j; continue; } if (c === '{' || c === '}' || c === ';') { flush(); tokens.push({ type: c, value: c }); i++; continue; } if (c === '\n') { flush(); i++; continue; } current += c; i++; }
    flush(); let depth = 0, out = []; const add = (s) => out.push(`${'  '.repeat(Math.max(0, depth))}${s}`.trimEnd());
    tokens.forEach((t) => { if (t.type === '}') { depth = Math.max(0, depth - 1); if (out.length && out[out.length - 1].trim() !== '}') out[out.length - 1] += ' }'; else add('}'); } else if (t.type === '{') { const prev = out.pop() || ''; add(`${prev.trim()} {`); depth++; } else if (t.type === ';') { if (out.length) out[out.length - 1] += ';'; } else if (t.type === 'line' || t.type === 'block') add(t.value); else add(t.value); });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function formatHTML(source) { const parts = source.replace(/>\s*</g, '><').match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || []; let depth = 0, out = []; parts.forEach((part) => { const t = part.trim(); if (!t) return; if (t.startsWith('</')) depth = Math.max(0, depth - 1); out.push(`${'  '.repeat(depth)}${t}`); if (t.startsWith('<') && !t.startsWith('</') && !t.startsWith('<!--') && !/^<[^>]+\/\s*>$/.test(t) && !/^<(meta|link|img|input|br|hr|source)\b/i.test(t)) depth++; }); return out.join('\n'); }
  $('formatBtn').onclick = () => { const htmlMode = /\.html$/i.test(els.filename.value.trim()); if (!htmlMode) { try { new Function(editor.source); } catch (e) { message(`Cannot format: ${e.message}${lineFromError(e) ? ` (line ${lineFromError(e)})` : ''}`, 'error'); toast('Formatting stopped because the JavaScript has a syntax error.', 'error'); return; } } else if (!/<html[\s>]/i.test(editor.source) || !/<\/html>/i.test(editor.source)) { message('Cannot format: provide a complete HTML document first.', 'error'); return; } const next = htmlMode ? formatHTML(editor.source) : formatJS(editor.source); if (next !== editor.source) applyEdits([{ start: 0, end: editor.source.length, text: next }], 'Document formatted'); else { message('Document is already formatted.'); focusEditor(); } };

  function clearConsole() { els.output.innerHTML = '<div class="console-placeholder">Output from your run will collect here.</div>'; }
  function serialize(value) { if (typeof value === 'string') return value; if (value instanceof Error) return value.message; try { const out = JSON.stringify(value); return out === undefined ? String(value) : out; } catch (_) { return String(value); } }
  function consoleLine(kind, text) { if (els.output.querySelector('.console-placeholder')) els.output.innerHTML = ''; const row = document.createElement('div'); row.className = `console-line ${kind}`; row.innerHTML = `<span class="console-prefix">${kind === 'error' ? '×' : kind === 'warn' ? '!' : '›'}</span><span>${esc(text)}</span>`; els.output.appendChild(row); els.output.scrollTop = els.output.scrollHeight; }
  function bridgeScript() { return `<script>(function(){var send=function(type,args){try{parent.postMessage({workbench:true,type:type,args:Array.prototype.slice.call(args).map(function(v){if(v instanceof Error)return v.message;try{return typeof v==='string'?v:JSON.stringify(v)}catch(e){return String(v)}})},'*')}catch(e){}};['log','info','debug'].forEach(function(k){console[k]=function(){send('log',arguments)}});console.warn=function(){send('warn',arguments)};console.error=function(){send('error',arguments)};window.onerror=function(message,source,line,col,error){send('error',[message+' (line '+line+')']);return true};window.onunhandledrejection=function(e){var r=e.reason;send('error',['Unhandled promise rejection: '+(r&&r.message?r.message:String(r))])};window.addEventListener('error',function(e){if(e.error)send('error',[e.error.message+' (line '+e.lineno+')'])});</script>`; }
  function safeSource(source) { return source.replace(/<\/script/gi, '<\\/script'); }
  function previewPolicy() { return '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; connect-src \'none\'; font-src data:;">'; }
  function makeHTML(source) { const bridge = bridgeScript(); const policy = previewPolicy(); if (/<head(?:\s|>)/i.test(source)) return source.replace(/<head([^>]*)>/i, '<head$1>' + policy + bridge); return policy + bridge + source; }
  function captureLastGood() { try { const doc = els.frame.contentDocument; if (!doc) return; const clone = doc.documentElement.cloneNode(true); clone.querySelectorAll('script').forEach((s) => s.remove()); const controls = [...doc.querySelectorAll('input,textarea,select')].map((el) => ({ selector: el.id ? `#${CSS.escape(el.id)}` : null, value: el.value, checked: el.checked })); const canvases = [...doc.querySelectorAll('canvas')].map((c) => ({ selector: c.id ? `#${CSS.escape(c.id)}` : null, image: c.toDataURL() })); runtime.lastGood = { html: clone.outerHTML, controls, canvases }; } catch (_) {} }
  function restoreLastGood() { if (!runtime.lastGood) { els.frame.srcdoc = ''; els.empty.classList.remove('hidden'); return; } const snap = runtime.lastGood; els.frame.onload = () => { snap.controls.forEach((x) => { if (x.selector) { const el = els.frame.contentDocument.querySelector(x.selector); if (el) { el.value = x.value; el.checked = x.checked; } } }); snap.canvases.forEach((x) => { if (x.selector) { const canvas = els.frame.contentDocument.querySelector(x.selector); if (canvas) { const ctx = canvas.getContext('2d'), image = new Image(); image.onload = () => ctx.drawImage(image, 0, 0); image.src = x.image; } } }); }; els.frame.srcdoc = snap.html; els.empty.classList.add('hidden'); }
  function finishRunFailure(reason) { if (!runtime.active) return; runtime.active = false; clearTimeout(runtime.timer); els.runState.textContent = 'Restored last good'; els.runState.className = 'run-state error'; consoleLine('error', reason); message(reason, 'error'); restoreLastGood(); $('stopBtn').disabled = true; }
  function runSource() {
    const source = editor.source, filename = els.filename.value.trim() || 'experiment.js', unsafe = scanUnsafe(source); if (unsafe.length) { const reason = `Run blocked: ${unsafe.join(', ')} is not allowed in the preview.`; consoleLine('error', reason); message(reason, 'error'); toast(reason, 'error'); return; }
    if (!/\.html$/i.test(filename)) { try { new Function(source); } catch (e) { const line = lineFromError(e); const reason = `Syntax error${line ? ` on line ${line}` : ''}: ${e.message}`; consoleLine('error', reason); message(reason, 'error'); els.runState.textContent = 'Syntax error'; els.runState.className = 'run-state error'; return; } }
    const token = ++runtime.token; runtime.active = true; runtime.frameWindow = null; clearTimeout(runtime.timer); els.runState.textContent = 'Running'; els.runState.className = 'run-state live'; $('stopBtn').disabled = false; message(`Running ${filename} from the current draft…`); clearConsole(); els.empty.classList.add('hidden');
    const frame = els.frame; frame.onload = () => { if (token !== runtime.token) return; runtime.frameWindow = frame.contentWindow; runtime.timer = setTimeout(() => finishRunFailure('Run exceeded the five-second budget; the last good preview was restored.'), 5000); setTimeout(() => { if (runtime.active && token === runtime.token) { captureLastGood(); message('Run completed. Preview is live.'); } }, 80); };
    frame.srcdoc = /\.html$/i.test(filename) ? makeHTML(source) : `${previewPolicy()}${bridgeScript()}<script>\n${safeSource(source)}\n<\/script>`;
  }
  function stopRun() { if (!runtime.active) return; runtime.token++; runtime.active = false; clearTimeout(runtime.timer); els.runState.textContent = 'Stopped'; els.runState.className = 'run-state error'; consoleLine('warn', 'Run stopped. Pending callbacks were discarded.'); message('Run stopped; the last good preview was restored.'); restoreLastGood(); $('stopBtn').disabled = true; }
  window.addEventListener('message', (e) => { if (!e.data?.workbench || e.source !== runtime.frameWindow || !runtime.active) return; const args = (e.data.args || []).map(String).join(' '); if (e.data.type === 'error') { consoleLine('error', args); finishRunFailure(args); } else consoleLine(e.data.type, args); });
  $('runBtn').onclick = runSource; $('stopBtn').onclick = stopRun; $('clearConsole').onclick = clearConsole;

  async function api(url, options = {}) { const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options }); const data = await res.json().catch(() => ({})); if (!res.ok) { const error = new Error(data.error || `Request failed (${res.status})`); error.data = data; error.status = res.status; throw error; } return data; }
  function validateFilename() { if (!/\.(js|html)$/i.test(els.filename.value.trim())) { toast('Filename must end in .js or .html.', 'error'); return false; } return true; }
  async function saveSnippet() { if (!validateFilename() || !els.title.value.trim()) { toast('Add a title and a .js or .html filename before saving.', 'error'); return; } const body = { title: els.title.value, filename: els.filename.value, source: editor.source }; try { let data; if (editor.activeSnippet) data = await api(`/api/snippets/${editor.activeSnippet.id}`, { method: 'PUT', body: JSON.stringify({ ...body, expectedRevision: editor.activeSnippet.revision }) }); else data = await api('/api/snippets', { method: 'POST', body: JSON.stringify(body) }); editor.activeSnippet = data.snippet; editor.externalRevision = false; updateDirty(); message('Saved successfully.'); toast('Saved to the shared library.', 'success'); focusEditor(); loadLibrary(); } catch (e) { if (e.status === 409) { editor.externalRevision = true; updateDirty(); message('Save refused: another tab has a newer revision.', 'error'); toast('Save conflict — your draft is safe. Load the newer revision or start from it manually.', 'error'); } else { message(e.message, 'error'); toast(e.message, 'error'); } } }
  function loadDraft(snippet) { editor.activeSnippet = snippet; editor.externalRevision = false; els.title.value = snippet.title; els.filename.value = snippet.filename; editor.source = snippet.source; editor.selections = [{ anchor: 0, head: 0, preferred: 0 }]; editor.undo = []; editor.redo = []; render(); message(`Loaded revision ${snippet.revision}.`); focusEditor(); }
  async function loadLibrary() { try { const data = await api('/api/snippets'); els.count.textContent = data.snippets.length; if (!data.snippets.length) { els.library.innerHTML = '<div class="library-empty">No saved snippets yet.<br><span>Save a draft to keep it here.</span></div>'; return; } els.library.innerHTML = data.snippets.map((s) => `<div class="snippet-item ${editor.activeSnippet?.id === s.id ? 'active' : ''}" data-id="${s.id}"><span class="snippet-icon ${/\.html$/i.test(s.filename) ? 'html' : ''}">${/\.html$/i.test(s.filename) ? 'H' : 'JS'}</span><div class="snippet-info"><div class="snippet-title">${esc(s.title)}</div><div class="snippet-meta">${esc(s.filename)} · rev ${s.revision}</div><button class="history-link" data-history="${s.id}">View history →</button></div></div>`).join(''); els.library.querySelectorAll('.snippet-item').forEach((item) => item.addEventListener('click', async (e) => { if (e.target.dataset.history) return; const data = await api(`/api/snippets/${item.dataset.id}`); loadDraft(data.snippet); })); els.library.querySelectorAll('[data-history]').forEach((button) => button.addEventListener('click', (e) => { e.stopPropagation(); showHistory(button.dataset.history); })); } catch (e) { toast(`Library unavailable: ${e.message}`, 'error'); } }
  async function pollLibrary() { try { const data = await api('/api/snippets'); const open = data.snippets.find((s) => s.id === editor.activeSnippet?.id); if (open && editor.activeSnippet && open.revision > editor.activeSnippet.revision) { editor.externalRevision = true; updateDirty(); message('A newer revision is available in another tab; your draft remains untouched.', 'error'); } loadLibrary(); } catch (_) {} }
  async function showHistory(id) { try { const data = await api(`/api/snippets/${id}/history`); const snippet = data.revisions[0]; els.historyTitle.textContent = snippet ? `${snippet.title} · history` : 'Revision history'; els.historyList.innerHTML = data.revisions.map((r) => `<div class="history-row"><div class="history-details"><strong>Revision ${r.revision}</strong><small>${new Date(r.createdAt).toLocaleString()} · ${esc(r.filename)} · ${r.source.length.toLocaleString()} chars</small></div><button data-restore="${r.revision}" data-snippet="${id}">${r.revision === (editor.activeSnippet?.revision) ? 'Current' : 'Restore'}</button></div>`).join(''); els.historyList.querySelectorAll('[data-restore]').forEach((b) => { if (b.textContent === 'Current') b.disabled = true; else b.onclick = () => restoreRevision(b.dataset.snippet, Number(b.dataset.restore)); }); els.history.showModal(); } catch (e) { toast(e.message, 'error'); } }
  async function restoreRevision(id, revision) { const key = `restore-${id}-${revision}-${editor.activeSnippet?.revision || 'unknown'}`; try { const data = await api(`/api/snippets/${id}/restore`, { method: 'POST', body: JSON.stringify({ revision, expectedRevision: editor.activeSnippet?.revision, restoreKey: key }) }); els.history.close(); loadDraft(data.snippet); toast(`Revision ${revision} restored as revision ${data.snippet.revision}.`, 'success'); loadLibrary(); } catch (e) { toast(e.status === 409 ? 'Restore refused because a newer save exists. Your draft is unchanged.' : e.message, 'error'); } }
  $('saveBtn').onclick = saveSnippet; $('newBtn').onclick = () => { editor.activeSnippet = null; editor.externalRevision = false; els.title.value = 'Untitled experiment'; els.filename.value = 'experiment.js'; editor.source = ''; editor.selections = [{ anchor: 0, head: 0, preferred: 0 }]; editor.undo = []; editor.redo = []; render(); message('New empty draft ready.'); focusEditor(); };
  $('closeHistory').onclick = () => els.history.close();
  els.title.addEventListener('input', updateDirty); els.filename.addEventListener('input', () => { render(); updateDirty(); });

  render(); loadLibrary(); libraryPoll = setInterval(pollLibrary, 3000);
  window.addEventListener('beforeunload', () => clearInterval(libraryPoll));
})();

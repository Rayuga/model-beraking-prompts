(() => {
  const $ = id => document.getElementById(id);
  const els = {
    title: $('titleInput'), filename: $('filenameInput'), editor: $('editorWrap'), viewport: $('codeViewport'),
    capture: $('keyCapture'), code: $('codeLayer'), numbers: $('lineNumbers'), selection: $('selectionLayer'), caret: $('caretLayer'),
    cursor: $('cursorStatus'), selectionStatus: $('selectionStatus'), mode: $('runMode'), draft: $('draftState'), draftText: $('draftText'),
    undo: $('undoButton'), redo: $('redoButton'), format: $('formatButton'), run: $('runButton'), stop: $('stopButton'),
    frame: $('previewFrame'), previewEmpty: $('previewEmpty'), previewStatus: $('previewStatus'), console: $('consoleOutput'), consoleCount: $('consoleCount'),
    findbar: $('findbar'), find: $('findInput'), replace: $('replaceInput'), toast: $('toastRegion'), library: $('libraryList'), libraryCount: $('libraryCount'),
    history: $('historyDialog'), historyList: $('historyList'), historySubtitle: $('historySubtitle')
  };
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const modKey = e => isMac ? e.metaKey : e.ctrlKey;
  const graphemes = value => Array.from(value);
  const state = {
    text: '', selections: [{ anchor: 0, head: 0, preferred: 0 }], history: [], historyIndex: -1,
    snippetId: null, revision: null, saved: { title: els.title.value, filename: els.filename.value, code: '' },
    activeRun: null, runSequence: 0, lastGood: null, findIndex: -1, remoteTimer: null, dragAnchor: 0
  };

  function snapshot() { return { text: state.text, selections: state.selections.map(s => ({ ...s })) }; }
  function sameSelections(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function sameSnapshot(a, b) { return a && a.text === b.text && sameSelections(a.selections, b.selections); }
  function setHistoryInitial() { state.history = [snapshot()]; state.historyIndex = 0; updateHistoryButtons(); }
  function pushHistory(before, after) {
    const last = state.history[state.historyIndex];
    if (sameSnapshot(last, after)) return;
    state.history = state.history.slice(0, state.historyIndex + 1);
    if (!sameSnapshot(last, before)) state.history.push(before);
    state.history.push(after);
    state.historyIndex = state.history.length - 1;
    updateHistoryButtons();
  }
  function commitEdit(mutator) {
    const before = snapshot(); mutator();
    if (!sameSnapshot(before, snapshot())) pushHistory(before, snapshot());
    render();
  }
  function restoreSnapshot(snap) { state.text = snap.text; state.selections = snap.selections.map(s => ({ ...s })); render(); }
  function updateHistoryButtons() { els.undo.disabled = state.historyIndex <= 0; els.redo.disabled = state.historyIndex >= state.history.length - 1; }
  function undo() { if (state.historyIndex <= 0) return; state.historyIndex--; restoreSnapshot(state.history[state.historyIndex]); toast('Undo applied', 'success'); focusEditor(); }
  function redo() { if (state.historyIndex >= state.history.length - 1) return; state.historyIndex++; restoreSnapshot(state.history[state.historyIndex]); toast('Redo applied', 'success'); focusEditor(); }

  function lineStarts(text = state.text) {
    const starts = [0]; for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1); return starts;
  }
  function positionInfo(pos) {
    const starts = lineStarts(); let low = 0, high = starts.length - 1;
    while (low <= high) { const mid = (low + high) >> 1; if (starts[mid] <= pos) low = mid + 1; else high = mid - 1; }
    const line = Math.max(0, high); return { line, column: graphemes(state.text.slice(starts[line], pos)).length, offset: pos - starts[line] };
  }
  function lineEnd(pos) { const next = state.text.indexOf('\n', pos); return next < 0 ? state.text.length : next; }
  function moveByGrapheme(pos, direction) {
    const chars = graphemes(state.text.slice(0, pos));
    if (direction < 0) return chars.slice(0, -1).join('').length;
    const next = graphemes(state.text.slice(pos))[0]; return pos + (next ? next.length : 0);
  }
  function colToOffset(line, column) {
    const starts = lineStarts(); const start = starts[Math.max(0, Math.min(line, starts.length - 1))];
    const end = lineEnd(start); const chars = graphemes(state.text.slice(start, end));
    return start + chars.slice(0, Math.max(0, column)).join('').length;
  }
  function primary() { return state.selections[0] || { anchor: 0, head: 0, preferred: 0 }; }
  function selectedRange(s) { return [Math.min(s.anchor, s.head), Math.max(s.anchor, s.head)]; }
  function collapseAt(pos) { return { anchor: pos, head: pos, preferred: positionInfo(pos).column }; }
  function normalizeSelections() { state.selections.sort((a, b) => Math.min(a.anchor, a.head) - Math.min(b.anchor, b.head)); }
  function moveCaret(direction, extend = false) {
    const before = snapshot();
    state.selections = state.selections.map(s => {
      const p = s.head; const info = positionInfo(p); let next = p;
      if (direction === 'left') next = moveByGrapheme(p, -1);
      if (direction === 'right') next = moveByGrapheme(p, 1);
      if (direction === 'home') next = lineStarts()[info.line];
      if (direction === 'end') next = lineEnd(p);
      if (direction === 'up' || direction === 'down') next = colToOffset(info.line + (direction === 'up' ? -1 : 1), s.preferred ?? info.column);
      if (direction === 'start') next = 0;
      if (direction === 'finish') next = state.text.length;
      return extend ? { anchor: s.anchor, head: next, preferred: (direction === 'up' || direction === 'down') ? s.preferred : positionInfo(next).column } : collapseAt(next);
    });
    normalizeSelections(); if (!sameSnapshot(before, snapshot())) render();
  }
  function replaceSelections(value) {
    const before = snapshot(); const ranges = state.selections.map(selectedRange).sort((a, b) => b[0] - a[0]);
    const next = [];
    for (const [start, end] of ranges) { state.text = state.text.slice(0, start) + value + state.text.slice(end); next.unshift(collapseAt(start + value.length)); }
    state.selections = next.length ? next : [collapseAt(state.text.length)]; normalizeSelections();
    pushHistory(before, snapshot()); render();
  }
  function deleteAt(direction) {
    const before = snapshot(); const ranges = state.selections.map(s => {
      let [a, b] = selectedRange(s); if (a === b) { if (direction < 0) a = moveByGrapheme(a, -1); else b = moveByGrapheme(b, 1); } return [a, b];
    }).sort((a, b) => b[0] - a[0]);
    const next = [];
    for (const [a, b] of ranges) { state.text = state.text.slice(0, a) + state.text.slice(b); next.unshift(collapseAt(a)); }
    state.selections = next; pushHistory(before, snapshot()); render();
  }
  function indent(outdent = false) {
    const before = snapshot(); const starts = lineStarts(); const lines = new Set();
    state.selections.forEach(s => { const [a, b] = selectedRange(s); const end = b > a && state.text[b - 1] === '\n' ? b - 1 : b; const first = positionInfo(a).line; const last = positionInfo(end).line; for (let i = first; i <= last; i++) lines.add(i); });
    const ordered = [...lines].sort((a, b) => b - a); for (const line of ordered) { const at = starts[line]; if (outdent) { const amount = state.text.slice(at, at + 2) === '  ' ? 2 : state.text[at] === '\t' ? 1 : 0; state.text = state.text.slice(0, at) + state.text.slice(at + amount); state.selections.forEach(s => { if (s.anchor >= at + amount) s.anchor -= amount; if (s.head >= at + amount) s.head -= amount; }); } else { state.text = state.text.slice(0, at) + '  ' + state.text.slice(at); state.selections.forEach(s => { if (s.anchor >= at) s.anchor += 2; if (s.head >= at) s.head += 2; }); } }
    pushHistory(before, snapshot()); render(); focusEditor();
  }

  function escapeHtml(value) { return value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
  function highlightLine(line, html = false) {
    let out = '', i = 0;
    const re = html ? /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g : /\/\/.*|\/\*[\s\S]*?\*\/|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b(?:const|let|var|function|return|if|else|for|while|class|new|try|catch|throw|await|async|import|export|from|true|false|null|undefined|this|typeof|in|of|switch|case|break|continue)\b|\b[A-Za-z_$][\w$]*(?=\s*\()/g;
    let m; while ((m = re.exec(line))) {
      out += escapeHtml(line.slice(i, m.index)); const token = m[0]; let cls = '';
      if (html) { if (token.startsWith('<!--')) cls = 'token-html-comment'; else if (token.startsWith('<')) { const tag = token.match(/^(<\/?)([A-Za-z][\w-]*)/); if (tag) { const rest = token.slice(tag[0].length); out += escapeHtml(tag[1]) + '<span class="token-tag">' + escapeHtml(tag[2]) + '</span>' + highlightHtmlAttrs(rest); i = m.index + token.length; continue; } } else cls = 'token-value'; }
      else if (/^\/\//.test(token) || /^\/\*/.test(token)) cls = 'token-comment'; else if (/^["'`]/.test(token)) cls = 'token-string'; else if (/^\d/.test(token)) cls = 'token-number'; else if (/^(const|let|var|function|return|if|else|for|while|class|new|try|catch|throw|await|async|import|export|from|true|false|null|undefined|this|typeof|in|of|switch|case|break|continue)$/.test(token)) cls = 'token-keyword'; else cls = 'token-function';
      out += '<span class="' + cls + '">' + escapeHtml(token) + '</span>'; i = m.index + token.length;
    }
    return out + escapeHtml(line.slice(i)) || '&nbsp;';
  }
  function highlightHtmlAttrs(rest) {
    let out = '', pos = 0; const re = /([A-Za-z_:][-\w:.]*)(\s*=\s*)("[^"]*"|'[^']*')/g; let m;
    while ((m = re.exec(rest))) { out += escapeHtml(rest.slice(pos, m.index)) + '<span class="token-attr">' + escapeHtml(m[1]) + '</span>' + escapeHtml(m[2]) + '<span class="token-value">' + escapeHtml(m[3]) + '</span>'; pos = m.index + m[0].length; }
    return out + escapeHtml(rest.slice(pos));
  }
  function render() {
    const lines = state.text.split('\n'); const htmlMode = /\.html$/i.test(els.filename.value.trim());
    els.code.innerHTML = lines.map((line, i) => '<div class="code-line ' + (i === positionInfo(primary().head).line ? 'active' : '') + '">' + (highlightLine(line, htmlMode) || '&nbsp;') + '</div>').join('');
    els.numbers.innerHTML = lines.map((_, i) => '<div>' + (i + 1) + '</div>').join('');
    els.code.style.minHeight = (lines.length * 22.75) + 'px'; els.numbers.style.height = els.code.offsetHeight + 'px';
    renderSelection(); updateStatus(); updateDirty(); updateHistoryButtons();
  }
  function measureChar() { const style = getComputedStyle(els.code); const canvas = measureChar.canvas || (measureChar.canvas = document.createElement('canvas')); const ctx = canvas.getContext('2d'); ctx.font = style.font; return ctx.measureText('M').width; }
  function pointFor(pos) { const info = positionInfo(pos); const starts = lineStarts(); const lineStart = starts[info.line]; const column = graphemes(state.text.slice(lineStart, pos)).length; return { x: 10 + column * measureChar(), y: info.line * 22.75 }; }
  function renderSelection() {
    els.selection.innerHTML = ''; els.caret.innerHTML = ''; const starts = lineStarts();
    state.selections.forEach((s, si) => { const [a, b] = selectedRange(s); if (a !== b) { let cursor = a; while (cursor < b) { const info = positionInfo(cursor); const end = Math.min(b, lineEnd(cursor)); const p = pointFor(cursor); const q = pointFor(end); const rect = document.createElement('div'); rect.className = 'selection-rect'; rect.style.left = p.x + 'px'; rect.style.top = p.y + 'px'; rect.style.width = Math.max(3, q.x - p.x) + 'px'; els.selection.appendChild(rect); cursor = end < b ? end + 1 : b; } } const p = pointFor(s.head); const caret = document.createElement('div'); caret.className = 'fake-caret' + (si ? ' secondary' : ''); caret.style.left = p.x + 'px'; caret.style.top = p.y + 'px'; els.caret.appendChild(caret); });
    const info = positionInfo(primary().head); const lineTop = info.line * 22.75; const p = pointFor(primary().head); if (lineTop < els.viewport.scrollTop + 18) els.viewport.scrollTop = Math.max(0, lineTop - 18); if (lineTop + 23 > els.viewport.scrollTop + els.viewport.clientHeight) els.viewport.scrollTop = lineTop - els.viewport.clientHeight + 42; if (p.x < els.viewport.scrollLeft + 10) els.viewport.scrollLeft = Math.max(0, p.x - 25); if (p.x > els.viewport.scrollLeft + els.viewport.clientWidth - 20) els.viewport.scrollLeft = p.x - els.viewport.clientWidth + 45;
  }
  function updateStatus() { const info = positionInfo(primary().head); els.cursor.textContent = `Ln ${info.line + 1}, Col ${info.column + 1}`; const total = state.selections.reduce((n, s) => n + (selectedRange(s)[1] - selectedRange(s)[0]), 0); els.selectionStatus.textContent = total ? `${total} selected` : state.selections.length > 1 ? `${state.selections.length} carets` : ''; els.mode.textContent = /\.html$/i.test(els.filename.value.trim()) ? 'Complete HTML' : 'JavaScript'; }
  function isDirty() { return els.title.value !== state.saved.title || els.filename.value !== state.saved.filename || state.text !== state.saved.code; }
  function updateDirty() { const dirty = isDirty(); els.draft.className = dirty ? 'draft-state dirty' : (state.snippetId ? 'draft-state saved' : 'draft-state'); els.draftText.textContent = dirty ? 'Unsaved changes' : (state.snippetId ? `Saved · revision ${state.revision}` : 'New draft'); }
  function focusEditor() { els.editor.focus(); els.capture.focus(); }
  function toast(message, type = '') { const item = document.createElement('div'); item.className = 'toast ' + type; item.textContent = message; els.toast.appendChild(item); setTimeout(() => item.remove(), 4200); }

  function formatJavaScript(code) {
    if (typeof code !== 'string' || !code.trim()) return code;
    const tokens = []; let current = '', quote = null, comment = null;
    for (let i = 0; i < code.length; i++) { const c = code[i], n = code[i + 1]; if (comment === 'line') { current += c; if (c === '\n') { tokens.push({ type:'comment', value:current }); current = ''; comment = null; } continue; } if (comment === 'block') { current += c; if (c === '*' && n === '/') { current += n; i++; tokens.push({ type:'comment', value:current }); current=''; comment=null; } continue; } if (quote) { current += c; if (c === '\\') { current += n || ''; i++; } else if (c === quote) { tokens.push({ type:'word', value:current }); current=''; quote=null; } continue; } if ((c === '"' || c === "'" || c === '`')) { if (current.trim()) tokens.push({ type:'word', value:current.trim() }); current = c; quote = c; continue; } if (c === '/' && n === '/') { if (current.trim()) tokens.push({ type:'word', value:current.trim() }); current='/'; comment='line'; continue; } if (c === '/' && n === '*') { if (current.trim()) tokens.push({ type:'word', value:current.trim() }); current='/*'; i++; comment='block'; continue; } if ('{};'.includes(c)) { if (current.trim()) tokens.push({ type:'word', value:current.trim() }); tokens.push({ type:c, value:c }); current=''; } else current += c; }
    if (current.trim()) tokens.push({ type: quote || comment ? 'comment' : 'word', value: current.trim() });
    let out = '', indent = 0, lineStart = true;
    const add = (s) => { if (lineStart && s.trim()) { out += '  '.repeat(Math.max(0, indent)); lineStart = false; } out += s; };
    for (let i=0;i<tokens.length;i++) { const t=tokens[i]; if (t.type === '}') { if (!lineStart) out += '\n'; indent = Math.max(0, indent - 1); add('}'); if (tokens[i+1] && tokens[i+1].type !== ';' && tokens[i+1].type !== '}') { out += '\n'; lineStart = true; } } else if (t.type === '{') { add((out && !/[\s\n]$/.test(out) ? ' ' : '') + '{'); out += '\n'; indent++; lineStart=true; } else if (t.type === ';') { add(';'); out += '\n'; lineStart=true; } else if (t.type === 'comment') { if (!lineStart) out += '\n'; add(t.value.trim()); out += '\n'; lineStart=true; } else { const value=t.value; if (!lineStart && !/[\s(.[{]$/.test(out) && !/^[,.)\]}]/.test(value)) out += ' '; add(value); } }
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function formatHtml(code) {
    const compact = code.replace(/>\s*</g, '><').trim(); let out='', indent=0, pos=0; const parts = compact.split(/(<[^>]+>)/g).filter(Boolean);
    for (const part of parts) { if (!part.trim()) continue; if (part.startsWith('</')) indent=Math.max(0,indent-1); if (out) out+='\n'; out += '  '.repeat(indent)+part.trim(); if (part.startsWith('<') && !part.startsWith('</') && !part.startsWith('<!') && !part.startsWith('<?') && !/\/\s*>$/.test(part) && !/^<(meta|link|input|img|br|hr)\b/i.test(part)) indent++; } return out;
  }
  function formatDocument() {
    const html = /\.html$/i.test(els.filename.value.trim()); const before = state.text; let formatted;
    if (html) { if (!/<html[\s>]/i.test(before) && !/<!doctype\s+html/i.test(before)) return toast('Format failed: this is not a complete HTML document.', 'error'); formatted = formatHtml(before); }
    else { try { new Function(`"use strict";\n${before}`); } catch (e) { return toast(`Format failed: ${e.message}`, 'error'); } formatted = formatJavaScript(before); }
    if (formatted === before) return toast('Already formatted — no change made.');
    const oldLen = before.length; commitEdit(() => { state.text = formatted; state.selections = [collapseAt(Math.min(state.selections[0].head, formatted.length))]; });
    toast(`Formatted ${html ? 'HTML' : 'JavaScript'} with two-space indentation.`, 'success'); focusEditor();
  }

  function meaningfulCode(code) { return code.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, ''); }
  function unsafeDynamic(code) { return /\beval\s*\(|\bFunction\s*\(|\bWebAssembly\b|\bnew\s+Worker\b|\bimport\s*\(/.test(meaningfulCode(code)); }
  function serialize(value) { try { if (typeof value === 'string') return value; if (value instanceof Error) return value.message || String(value); if (value === undefined) return 'undefined'; return JSON.stringify(value); } catch (_) { return String(value); } }
  const bridge = `
(function(){
  const send=(type,data)=>parent.postMessage(Object.assign({source:'local-playground',runId:'__RUN_ID__',type:type},data||{}),'*');
  const pending=new Set(), nativeTimeout=window.setTimeout.bind(window), nativeClearTimeout=window.clearTimeout.bind(window), nativeInterval=window.setInterval.bind(window), nativeClearInterval=window.clearInterval.bind(window);
  window.setTimeout=(fn,ms,...args)=>{let id;id=nativeTimeout(()=>{pending.delete(id);try{fn(...args)}finally{if(!pending.size)send('settled')}},ms);pending.add(id);return id};
  window.clearTimeout=id=>{pending.delete(id);nativeClearTimeout(id);if(!pending.size)send('settled')};
  window.setInterval=(fn,ms,...args)=>{const id=nativeInterval(fn,ms,...args);pending.add(id);return id};
  window.clearInterval=id=>{pending.delete(id);nativeClearInterval(id);if(!pending.size)send('settled')};
  const format=(args)=>args.map(a=>{try{return typeof a==='string'?a:(a instanceof Error?(a.message||String(a)):JSON.stringify(a))}catch(e){return String(e)}}).join(' ');
  ['log','info','warn','error'].forEach(level=>{const original=console[level];console[level]=function(...args){send('console',{level:level,text:format(args)});try{original.apply(console,args)}catch(e){}}});
  window.onerror=function(message,source,line,column,error){send('error',{message:(error&&error.message)||String(message),line:line||0});return true};
  window.onunhandledrejection=function(e){const r=e.reason,stack=r&&r.stack||'',match=stack.match(/:(\d+):\d+/);send('error',{message:r&&r.message? r.message : (typeof r==='string'?r:JSON.stringify(r)),line:match?Number(match[1]):0});};
  const snapshot=()=>{try{const clone=document.documentElement.cloneNode(true);clone.querySelectorAll('script').forEach(s=>s.remove());clone.querySelectorAll('input,textarea,select').forEach(e=>{if(e.tagName==='SELECT')Array.from(e.options).forEach(o=>o.selected=o.selected);else if(e.type==='checkbox'||e.type==='radio')e.checked=e.checked;else e.setAttribute('value',e.value)});clone.querySelectorAll('canvas').forEach(c=>{try{const img=document.createElement('img');img.src=c.toDataURL();c.replaceWith(img)}catch(e){}});send('snapshot',{html:'<!doctype html>'+clone.outerHTML})}catch(e){}};
  window.addEventListener('load',()=>setTimeout(()=>{snapshot();if(!pending.size)send('settled')},80));
  window.addEventListener('input',snapshot); window.addEventListener('change',snapshot); window.__playgroundSnapshot=snapshot;
})();\n`;
  function addConsole(text, type = '') { if (els.console.querySelector('.console-placeholder')) els.console.innerHTML=''; const row=document.createElement('div'); row.className='console-line '+type; row.textContent=text; els.console.appendChild(row); els.console.scrollTop=els.console.scrollHeight; els.consoleCount.textContent=els.console.querySelectorAll('.console-line').length; }
  function clearConsole() { els.console.innerHTML='<div class="console-placeholder">Output from your run will appear here.</div>'; els.consoleCount.textContent='0'; }
  function run() {
    const code=state.text, html=/\.html$/i.test(els.filename.value.trim()); if (unsafeDynamic(code)) return toast('Run refused: dynamic code (eval, Function, WebAssembly, workers, and dynamic imports) is disabled.', 'error');
    if (!html) { try { new Function(`"use strict";\n${code}`); } catch(e) { const match=String(e.stack||'').match(/<anonymous>:(\d+):/); const line=match?Math.max(1,Number(match[1])-1):0; clearConsole(); addConsole(`${e.message}${line?` (line ${line})`:''}`, 'error'); toast('Run stopped: fix the JavaScript syntax error first.', 'error'); return; } }
    stopRun(false); clearConsole(); const id=++state.runSequence; const prior=state.lastGood; state.activeRun={id, timer:null, snapshot:prior}; els.stop.disabled=false; els.previewEmpty.style.display='none'; els.previewStatus.textContent='Running'; els.previewStatus.style.background='#fff4db'; els.previewStatus.style.color='#a4660a';
    const runBridge = bridge.replaceAll('__RUN_ID__', String(id)); let source;
    if (html) { source = runBridge + '\n' + code; state.activeRun.offset = runBridge.split('\n').length; } else { source = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${runBridge.replace(/<\/script/gi,'<\\/script')}<\/script><script>\n${code}\n<\/script></body></html>`; state.activeRun.offset = runBridge.split('\n').length + 2; }
    els.frame.srcdoc=source; state.activeRun.timer=setTimeout(()=>{ if (!state.activeRun || state.activeRun.id!==id) return; addConsole('Run exceeded the five-second time limit.', 'error'); finishRun(false, id); },5000);
  }
  function finishRun(success, id) { if (!state.activeRun || state.activeRun.id!==id) return; const run=state.activeRun; clearTimeout(run.timer); if (success) { state.lastGood=run.snapshot || state.lastGood || {html:els.frame.srcdoc}; els.previewStatus.textContent='Last run'; els.previewStatus.style.background='#e8f8f2'; els.previewStatus.style.color='var(--green)'; } else { els.previewStatus.textContent='Restored last good'; if (state.lastGood && state.lastGood.html) els.frame.srcdoc=state.lastGood.html; else { els.frame.srcdoc=''; els.previewEmpty.style.display='flex'; } } state.activeRun=null; els.stop.disabled=true; }
  function stopRun(show=true) { if (!state.activeRun) return; const run=state.activeRun; clearTimeout(run.timer); state.activeRun=null; if (state.lastGood?.html) els.frame.srcdoc=state.lastGood.html; else { els.frame.srcdoc=''; els.previewEmpty.style.display='flex'; } els.stop.disabled=true; if (show) { addConsole('Run stopped.', 'warn'); toast('Run stopped; the last good preview was restored.'); } }

  async function api(url, options={}) { const response=await fetch(url,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options}); const data=await response.json().catch(()=>({error:'Server returned an invalid response.'})); if (!response.ok) { const error=new Error(data.error||`Request failed (${response.status})`); error.status=response.status; error.data=data; throw error; } return data; }
  async function save() {
    const body={title:els.title.value,filename:els.filename.value,code:state.text}; if (!/\.(js|html)$/i.test(body.filename.trim())) return toast('Save refused: filename must end in .js or .html.', 'error');
    try { const data=state.snippetId ? await api(`/api/snippets/${state.snippetId}`,{method:'PUT',body:JSON.stringify({...body,expectedRevision:state.revision})}) : await api('/api/snippets',{method:'POST',body:JSON.stringify(body)}); state.snippetId=data.id; state.revision=data.revision; state.saved={title:data.title,filename:data.filename,code:data.code}; updateDirty(); await loadLibrary(); toast(`Saved “${data.title}” as revision ${data.revision}.`, 'success'); focusEditor(); } catch(e) { if (e.status===409) toast('Save refused: another tab saved first. Your draft is still here.', 'error'); else toast(e.message,'error'); }
  }
  function newDraft() { stopRun(false); state.snippetId=null; state.revision=null; state.text=''; state.selections=[collapseAt(0)]; els.title.value='Untitled experiment'; els.filename.value='experiment.js'; state.saved={title:els.title.value,filename:els.filename.value,code:''}; setHistoryInitial(); clearConsole(); els.frame.srcdoc=''; els.previewEmpty.style.display='flex'; render(); toast('New draft ready.'); focusEditor(); }
  async function openSnippet(id) { try { const data=await api(`/api/snippets/${id}`); stopRun(false); state.snippetId=data.id; state.revision=data.revision; state.text=data.code; state.selections=[collapseAt(0)]; els.title.value=data.title; els.filename.value=data.filename; state.saved={title:data.title,filename:data.filename,code:data.code}; setHistoryInitial(); clearConsole(); els.frame.srcdoc=''; els.previewEmpty.style.display='flex'; render(); toast(`Opened “${data.title}”.`); focusEditor(); } catch(e) { toast(e.message,'error'); } }
  async function loadLibrary() { try { const list=await api('/api/snippets'); els.libraryCount.textContent=list.length; if (!list.length) { els.library.innerHTML='<div class="library-empty"><span>▱</span><p>No saved snippets yet</p><small>Save a draft to build your library.</small></div>'; return; } els.library.innerHTML=list.map(s=>`<div class="snippet-row"><span class="snippet-file-icon ${/\.html$/i.test(s.filename)?'html':''}">${/\.html$/i.test(s.filename)?'HTML':'JS'}</span><div class="snippet-info"><strong>${escapeHtml(s.title)}</strong><small>${escapeHtml(s.filename)} · revision ${s.revision} · ${new Date(s.updatedAt).toLocaleString()}</small></div><div class="snippet-actions"><button class="small-button open-snippet" data-id="${s.id}">Open</button><button class="small-button history-snippet" data-id="${s.id}">History</button></div></div>`).join(''); } catch(e) { toast(`Library unavailable: ${e.message}`,'error'); } }
  async function showHistory(id) { try { const data=await api(`/api/snippets/${id}`); const history=await api(`/api/snippets/${id}/history`); els.historySubtitle.textContent=`${data.title} · ${data.filename}`; els.historyList.innerHTML=history.map(h=>`<div class="history-item"><strong>Revision ${h.revision}</strong><small>${new Date(h.createdAt).toLocaleString()}</small><button class="small-button restore-history" data-id="${id}" data-expected="${data.revision}" data-revision="${h.revision}">Restore</button><div class="history-code">${escapeHtml(h.code)}</div></div>`).join(''); els.history.showModal(); } catch(e) { toast(e.message,'error'); } }
  async function restore(id, expectedRevision, snapshotRevision) { const requestId=crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; try { const data=await api(`/api/snippets/${id}/restore`,{method:'POST',body:JSON.stringify({expectedRevision,snapshotRevision,requestId})}); els.history.close(); await openSnippet(data.id); toast(`Restored revision ${snapshotRevision} as new revision ${data.revision}.`,'success'); } catch(e) { toast(e.status===409?'Restore refused: another tab saved first.':e.message,'error'); } }

  els.capture.addEventListener('keydown', e => {
    if (e.key === 'Tab') { e.preventDefault(); if (e.shiftKey) indent(true); else indent(); return; }
    if (e.altKey && e.key.toLowerCase()==='m') { e.preventDefault(); $('undoButton').focus(); return; }
    if (modKey(e) && e.key.toLowerCase()==='a') { e.preventDefault(); state.selections=[{anchor:0,head:state.text.length,preferred:0}]; render(); return; }
    if (modKey(e) && e.key.toLowerCase()==='z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (modKey(e) && e.key.toLowerCase()==='y') { e.preventDefault(); redo(); return; }
    if (modKey(e) && e.key.toLowerCase()==='f') { e.preventDefault(); els.findbar.hidden=false; els.find.focus(); return; }
    if (modKey(e) && e.key.toLowerCase()==='c') { e.preventDefault(); const copied=state.selections.map(selectedRange).sort((a,b)=>a[0]-b[0]).map(([a,b])=>state.text.slice(a,b)).join('\n'); navigator.clipboard?.writeText(copied); return; }
    if (modKey(e) && e.key.toLowerCase()==='x') { e.preventDefault(); const copied=state.selections.map(selectedRange).sort((a,b)=>a[0]-b[0]).map(([a,b])=>state.text.slice(a,b)).join('\n'); navigator.clipboard?.writeText(copied); deleteAt(1); return; }
    if (modKey(e) && e.key.toLowerCase()==='s') { e.preventDefault(); save(); return; }
    if (modKey(e) && e.key.toLowerCase()==='enter') { e.preventDefault(); run(); return; }
    if (e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='ArrowUp'||e.key==='ArrowDown'||e.key==='Home'||e.key==='End') { e.preventDefault(); const dir=e.key==='ArrowLeft'?'left':e.key==='ArrowRight'?'right':e.key==='ArrowUp'?'up':e.key==='ArrowDown'?'down':e.key.toLowerCase(); if (modKey(e)&&e.key==='Home') moveCaret('start',e.shiftKey); else if (modKey(e)&&e.key==='End') moveCaret('finish',e.shiftKey); else moveCaret(dir,e.shiftKey); return; }
    if (e.key==='Backspace') { e.preventDefault(); deleteAt(-1); return; } if (e.key==='Delete') { e.preventDefault(); deleteAt(1); return; }
    if (e.key==='Enter') { e.preventDefault(); replaceSelections('\n'); return; }
    if (e.key && e.key !== 'Dead' && e.key !== 'Unidentified' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing) { e.preventDefault(); replaceSelections(e.key); }
  });
  els.capture.addEventListener('paste', e => { e.preventDefault(); replaceSelections((e.clipboardData||window.clipboardData).getData('text')); });
  els.viewport.addEventListener('mousedown', e => { if (e.target===els.capture) return; e.preventDefault(); const rect=els.viewport.getBoundingClientRect(); const charWidth=measureChar(); const line=Math.max(0,Math.floor((e.clientY-rect.top+els.viewport.scrollTop-18)/22.75)); const col=Math.max(0,Math.round((e.clientX-rect.left+els.viewport.scrollLeft-10)/charWidth)); const pos=colToOffset(line,col); if (e.altKey || (modKey(e))) { state.selections.push(collapseAt(pos)); normalizeSelections(); } else state.selections=[{anchor:pos,head:pos,preferred:col}]; state.dragAnchor=pos; render(); focusEditor(); });
  els.viewport.addEventListener('mousemove', e => { if (e.buttons!==1) return; const rect=els.viewport.getBoundingClientRect(); const pos=colToOffset(Math.max(0,Math.floor((e.clientY-rect.top+els.viewport.scrollTop-18)/22.75)),Math.max(0,Math.round((e.clientX-rect.left+els.viewport.scrollLeft-10)/measureChar()))); const s=state.selections[state.selections.length-1]; s.head=pos; render(); });
  els.viewport.addEventListener('dblclick', e => { const s=state.selections[state.selections.length-1], p=s.head; let a=p,b=p; while(a>0&&!/\s/.test(state.text[a-1]))a--; while(b<state.text.length&&!/\s/.test(state.text[b]))b++; state.selections=[{anchor:a,head:b,preferred:positionInfo(b).column}]; render(); });
  els.viewport.addEventListener('click', e => { if (e.detail===3) { const p=primary().head, info=positionInfo(p), a=lineStarts()[info.line], b=lineEnd(p); state.selections=[{anchor:a,head:b,preferred:info.column}]; render(); } focusEditor(); });
  els.title.addEventListener('input', updateDirty); els.filename.addEventListener('input', () => { updateDirty(); render(); });
  $('undoButton').onclick=undo; $('redoButton').onclick=redo; $('formatButton').onclick=formatDocument; $('runButton').onclick=run; $('stopButton').onclick=()=>stopRun(true); $('saveButton').onclick=save; $('newButton').onclick=newDraft; $('clearConsole').onclick=clearConsole; $('refreshLibrary').onclick=loadLibrary;
  $('closeFind').onclick=()=>els.findbar.hidden=true; $('findNext').onclick=()=>findMatch(1); $('findPrev').onclick=()=>findMatch(-1); $('replaceCurrent').onclick=replaceCurrent; $('replaceAll').onclick=replaceAll;
  els.find.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();findMatch(e.shiftKey?-1:1)}});
  els.library.addEventListener('click',e=>{const open=e.target.closest('.open-snippet'), hist=e.target.closest('.history-snippet'); if(open)openSnippet(Number(open.dataset.id)); if(hist)showHistory(Number(hist.dataset.id));});
  $('closeHistory').onclick=()=>els.history.close(); els.historyList.addEventListener('click',e=>{const b=e.target.closest('.restore-history');if(b)restore(Number(b.dataset.id),Number(b.dataset.expected),Number(b.dataset.revision));});
  function findMatch(direction) { const query=els.find.value; if(!query)return; const from=primary().head; let index=direction>0?state.text.indexOf(query,from+1):state.text.lastIndexOf(query,from-1); if(index<0)index=direction>0?state.text.indexOf(query):state.text.lastIndexOf(query); if(index<0)return toast('No match found.'); state.selections=[{anchor:index,head:index+query.length,preferred:positionInfo(index).column}]; render(); focusEditor(); }
  function replaceCurrent() { const query=els.find.value;if(!query)return; const [a,b]=selectedRange(primary());if(state.text.slice(a,b)!==query){findMatch(1);return;} replaceSelections(els.replace.value); findMatch(1); toast('Replaced current match.','success'); }
  function replaceAll() { const query=els.find.value;if(!query)return; let count=0, at=0, out='';while(true){const i=state.text.indexOf(query,at);if(i<0){out+=state.text.slice(at);break;}out+=state.text.slice(at,i)+els.replace.value;at=i+query.length;count++;}if(!count)return toast('No match found.');const before=snapshot();state.text=out;state.selections=[collapseAt(0)];pushHistory(before,snapshot());render();focusEditor();toast(`Replaced ${count} match${count===1?'':'es'}.`,'success');}
  window.addEventListener('message', e => { const d=e.data;if(!d||d.source!=='local-playground'||!state.activeRun||String(d.runId)!==String(state.activeRun.id))return; if(d.type==='console')addConsole(d.text,d.level==='error'?'error':d.level==='warn'?'warn':''); if(d.type==='snapshot')state.activeRun.snapshot={html:d.html}; if(d.type==='error'){const line=d.line?Math.max(1,d.line-state.activeRun.offset):0;addConsole(`${d.message}${line?` (line ${line})`:''}`,'error');finishRun(false,state.activeRun.id);} if(d.type==='settled')finishRun(true,state.activeRun.id); });
  setInterval(async()=>{ loadLibrary(); if(state.snippetId){try{const fresh=await api(`/api/snippets/${state.snippetId}`);if(fresh.revision>state.revision)toast('This snippet changed in another tab; your draft is kept here.','error');}catch(_){}} },4000);
  setHistoryInitial(); render(); loadLibrary();
})();

const $ = id => document.getElementById(id);
const titleInput = $('titleInput');
const filenameInput = $('filenameInput');
const sourceInput = $('sourceInput');
const syntax = $('syntax');
const lineNumbers = $('lineNumbers');
const editorWrap = $('editorWrap');
const previewWrap = $('previewWrap');
const consoleLog = $('consoleLog');
const examplesList = $('examplesList');
const savedList = $('savedList');
const state = { snippetId: null, revision: null, lastGood: null, run: null, nextRun: 0, autoTimer: null, console: [], saved: [], conflict: null };

const examples = [
  { title: 'Signal Card', filename: 'signal-card.html', source: `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4efe8; font-family: system-ui, sans-serif; color: #252a36; }
    .card { width: min(340px, 86vw); padding: 28px; border-radius: 22px; background: #fffaf4; box-shadow: 0 18px 50px #6b594425; }
    .orb { width: 54px; height: 54px; display: grid; place-items: center; border-radius: 50%; color: white; background: #e75c42; font-size: 25px; transition: transform .3s, background .3s; }
    .orb.on { background: #3da879; transform: rotate(18deg) scale(1.08); }
    h1 { margin: 20px 0 6px; font-size: 25px; letter-spacing: -.8px; }
    p { margin: 0 0 22px; color: #737b8d; line-height: 1.5; font-size: 14px; }
    button { border: 0; border-radius: 10px; padding: 11px 15px; color: white; background: #252a36; cursor: pointer; }
    .status { margin-top: 18px; font-size: 11px; color: #3da879; font-weight: 700; }
  </style>
</head>
<body>
  <main class="card"><div class="orb" id="orb">✦</div><h1>A small signal</h1><p>Click the button and make the card change its mind.</p><button id="toggle">Change signal</button><div class="status" id="status">STATUS / listening</div></main>
  <script>
    const orb = document.querySelector('#orb');
    const status = document.querySelector('#status');
    document.querySelector('#toggle').addEventListener('click', () => {
      const active = orb.classList.toggle('on');
      status.textContent = active ? 'STATUS / signal received' : 'STATUS / listening';
      console.info('Signal toggled', { active });
    });
    console.log('Signal Card ready', { interactive: true });
  </script>
</body>
</html>` },
  { title: 'Tiny Dashboard', filename: 'tiny-dashboard.js', source: `const mount = document.body;
mount.innerHTML = \`
  <style>
    body { margin:0; padding:28px; background:#17202d; color:#edf2f7; font:15px system-ui; }
    .dash { max-width:480px; margin:auto; } h1 { font-size:24px; margin:0 0 5px; } p { color:#9ba7bb; margin:0 0 24px; }
    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; } .metric { background:#242e3d; border-radius:12px; padding:14px; }
    b { display:block; font-size:22px; margin-top:7px; } small { color:#78c89d; font-size:10px; }
  </style><section class="dash"><h1>Morning pulse</h1><p>Three numbers, no ceremony.</p><div class="grid"><div class="metric"><small>FOCUS</small><b>82%</b></div><div class="metric"><small>STREAK</small><b>06</b></div><div class="metric"><small>MOOD</small><b>Good</b></div></div></section>\`;
console.info('Dashboard mounted');
setTimeout(() => console.log('A delayed signal arrived'), 600);` },
  { title: 'Soft Landing', filename: 'soft-landing.css', source: `/* CSS mode styles a small built-in sample page. */
body { background: #e8edf4; color: #26364d; font-family: system-ui, sans-serif; }
.playground-sample { max-width: 440px; margin: 12vh auto; padding: 34px; background: #ffffff; border-radius: 24px; box-shadow: 0 24px 60px #26364d1c; }
.playground-sample .sample-kicker { color: #5876d9; letter-spacing: 2px; font-size: 11px; font-weight: 800; }
.playground-sample h1 { font-size: 36px; line-height: 1; letter-spacing: -2px; margin: 18px 0 10px; }
.playground-sample p { color: #768196; line-height: 1.6; }
.playground-sample .sample-pill { display: inline-block; margin-top: 12px; padding: 8px 12px; border-radius: 99px; background: #e9edff; color: #5876d9; font-size: 12px; font-weight: 700; }` }
];

function escapeHtml(value) { return value.replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch])); }
function highlight(value, mode) {
  let html = escapeHtml(value);
  if (mode === 'html') html = html.replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="tag">$2</span>').replace(/([\w-]+)(=)(&quot;.*?&quot;)/g, '<span class="attr">$1</span>$2<span class="string">$3</span>');
  html = html.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, '<span class="comment">$1</span>');
  html = html.replace(/(&#39;.*?&#39;|&quot;.*?&quot;|`[\s\S]*?`)/g, '<span class="string">$1</span>');
  html = html.replace(/\b(const|let|var|function|return|if|else|for|while|new|class|true|false|null|async|await|import|export)\b/g, '<span class="keyword">$1</span>');
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="number">$1</span>');
  return html || ' ';
}
function currentMode() { const match = filenameInput.value.trim().toLowerCase().match(/\.(js|html|css)$/); return match ? match[1] : ''; }
function updateEditor() {
  const mode = currentMode();
  $('modeBadge').textContent = mode ? mode.toUpperCase() : '—';
  $('filenameMode').textContent = mode ? `.${mode}` : '???';
  sourceInput.value = sourceInput.value; // preserves textarea selection in older browsers
  syntax.innerHTML = highlight(sourceInput.value, mode);
  lineNumbers.textContent = Array.from({ length: Math.max(1, sourceInput.value.split('\n').length) }, (_, i) => i + 1).join('\n');
  updateCursor();
}
function updateCursor() {
  const before = sourceInput.value.slice(0, sourceInput.selectionStart || 0);
  const line = before.split('\n').length;
  const col = before.length - before.lastIndexOf('\n');
  $('cursorPosition').textContent = `Ln ${line}, Col ${col}`;
}
function markDirty() { $('savedState').textContent = state.snippetId ? 'Unsaved changes' : 'New draft'; $('savedState').style.color = state.snippetId ? 'var(--accent)' : 'var(--green)'; }
function modeError() { addConsole('error', 'Choose a filename ending in .js, .html, or .css before running.'); setStatus('Needs a filename', 'Check the file extension', 'error'); }
function setStatus(title, detail, tone = '') { $('runStatus').textContent = title; $('runDetail').textContent = detail; $('runDot').className = `summary-dot ${tone}`; }
function addConsole(level, message, meta = {}) {
  state.console.push({ level, message: String(message), meta, time: new Date() });
  if (state.console.length > 160) state.console.shift();
  renderConsole();
}
function formatValue(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'undefined') return 'undefined';
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}
function renderConsole() {
  if (!state.console.length) consoleLog.innerHTML = '<div class="console-empty"><b>⌁</b><span>Run something to hear from it.</span></div>';
  else consoleLog.innerHTML = state.console.map(entry => {
    const safe = escapeHtml(entry.message);
    const structured = /^[{[]/.test(entry.message.trim());
    const content = structured ? `<details class="inspect"><summary>inspect value</summary><pre>${safe}</pre></details>` : safe;
    const line = entry.meta && entry.meta.line ? `<div class="error-line">line ${entry.meta.line}${entry.meta.column ? `, col ${entry.meta.column}` : ''}</div>` : '';
    return `<div class="console-entry"><span class="time">${entry.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span class="level level-${entry.level}">${escapeHtml(entry.level)}</span><div class="console-message">${content}${line}</div></div>`;
  }).join('');
  $('entryCount').textContent = `${state.console.length} entr${state.console.length === 1 ? 'y' : 'ies'}`;
  consoleLog.scrollTop = consoleLog.scrollHeight;
}
function toast(message, error = false) { const item = document.createElement('div'); item.className = `toast${error ? ' error' : ''}`; item.textContent = message; $('toastRegion').appendChild(item); setTimeout(() => item.remove(), 4200); }
function strippedCode(code) {
  let out = ''; let quote = ''; let comment = '';
  for (let i = 0; i < code.length; i += 1) { const c = code[i], n = code[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; out += c === '\n' ? '\n' : ' '; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { out += '  '; i++; comment = ''; } else out += c === '\n' ? '\n' : ' '; continue; }
    if (quote) { if (c === '\\') { out += '  '; i++; continue; } if (c === quote) quote = ''; out += c === '\n' ? '\n' : ' '; continue; }
    if ((c === '/' && n === '/') || (c === '/' && n === '*')) { comment = n === '/' ? 'line' : 'block'; out += '  '; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += ' '; continue; }
    out += c;
  } return out;
}
function unsupportedReason(source, mode) {
  const targets = mode === 'html' ? [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n') : source;
  const code = strippedCode(targets);
  if (/\beval\s*\(/.test(code)) return 'Dynamic eval() is outside this playground\'s safe scope.';
  if (/\bFunction\s*[({]/.test(code) || /\bnew\s+Function\b/.test(code)) return 'Dynamic Function construction is outside this playground\'s safe scope.';
  if (/\bWebAssembly\b/.test(code)) return 'WebAssembly is outside this playground\'s safe scope.';
  if (/\b(?:Worker|SharedWorker)\s*\(/.test(code)) return 'Additional workers are outside this playground\'s safe scope.';
  if (/\bimport\s*\(/.test(code)) return 'Dynamic module imports are outside this playground\'s safe scope.';
  return '';
}
function bridge(token) { return `(function(){const token=${JSON.stringify(token)};const born=Date.now();const send=(x)=>{try{window.parent.postMessage(Object.assign({playgroundToken:token},x),'*')}catch(e){}};const show=(x)=>{try{return typeof x==='string'?x:JSON.stringify(x,null,2)}catch(e){return String(x)}};const originalTimeout=window.setTimeout.bind(window);window.setTimeout=(fn,delay,...args)=>originalTimeout(()=>{if(Date.now()-born<5000)fn(...args)},delay);const originalInterval=window.setInterval.bind(window);window.setInterval=(fn,delay,...args)=>originalInterval(()=>{if(Date.now()-born<5000)fn(...args)},delay);window.__playgroundComplete=()=>send({type:'source-complete'});['log','info','warn','error'].forEach(level=>{const original=console[level];console[level]=(...args)=>{send({type:'log',level,message:args.map(show).join(' ')});try{original.apply(console,args)}catch(e){}}});window.addEventListener('error',e=>send({type:'error',message:e.message||'Uncaught error',line:e.lineno||0,column:e.colno||0}));window.addEventListener('unhandledrejection',e=>{const match=String(e.reason&&e.reason.stack||'').match(/:(\d+):(\d+)/);send({type:'error',message:'Unhandled Promise rejection: '+show(e.reason),line:match?Number(match[1]):0,column:match?Number(match[2]):0})});send({type:'bridge-ready'});})();`; }
function csp() { return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none';">`; }
function makeDocument(source, mode, token) {
  const b = bridge(token);
  if (mode === 'css') return `<!doctype html><html><head>${csp()}<style>${source}</style></head><body><section class="playground-sample"><div class="sample-kicker">CSS PLAYGROUND</div><h1>Soft landing.</h1><p>A small built-in page for trying out color, type and rhythm.</p><span class="sample-pill">style this sample</span></section><script>${b};window.__playgroundComplete();</script></body></html>`;
  if (mode === 'js') return `<!doctype html><html><head>${csp()}<style>body{margin:0;font-family:system-ui,sans-serif}</style><script>${b}</script></head><body><script>\n${source}\nwindow.__playgroundComplete();\n</script></body></html>`;
  let html = source;
  if (/<head\b[^>]*>/i.test(html)) html = html.replace(/(<head\b[^>]*>)/i, `$1${csp()}<script>${b}</script>`);
  else html = `${csp()}<script>${b}</script>${html}`;
  return `${html}<script>window.__playgroundComplete();</script>`;
}
function mapLine(line, mode) { if (!line) return 0; return mode === 'js' ? Math.max(1, line - 1) : line; }
function restoreLastGood() {
  const current = previewWrap.querySelector('iframe');
  if (current) current.remove();
  if (!state.lastGood) { $('emptyPreview').style.display = ''; return; }
  $('emptyPreview').style.display = 'none';
  const frame = document.createElement('iframe'); frame.setAttribute('sandbox', 'allow-scripts'); frame.srcdoc = state.lastGood.srcdoc; previewWrap.appendChild(frame);
}
function endRun(run, outcome, detail) {
  if (!state.run || state.run.token !== run.token || !run.active) return;
  clearTimeout(run.watchdog);
  $('stopBtn').disabled = outcome !== 'success';
  if (outcome === 'success') { run.committed = true; state.lastGood = { srcdoc: run.srcdoc }; $('previewTime').textContent = `${Math.round(performance.now() - run.started)} ms`; setStatus('Preview is good', detail || 'Ready for interaction', 'ok'); }
  else { run.active = false; state.lastGood = run.previousGood; restoreLastGood(); $('previewTime').textContent = `${Math.round(performance.now() - run.started)} ms`; setStatus(outcome === 'timeout' ? 'Time limit reached' : outcome === 'stopped' ? 'Run stopped' : 'Run failed', detail, 'error'); }
}
function finishWindow(run) { if (!state.run || state.run.token !== run.token || !run.active) return; run.active = false; $('stopBtn').disabled = true; }
function runCode() {
  const mode = currentMode();
  if (!mode) return modeError();
  const source = sourceInput.value;
  const blocked = unsupportedReason(source, mode);
  if (blocked) { addConsole('error', blocked); setStatus('Run refused', 'Last good preview kept', 'error'); restoreLastGood(); return; }
  if (state.run) { state.run.active = false; clearTimeout(state.run.watchdog); }
  const token = `run-${++state.nextRun}-${Math.random().toString(36).slice(2)}`;
  const srcdoc = makeDocument(source, mode, token);
  const frame = document.createElement('iframe'); frame.setAttribute('sandbox', 'allow-scripts'); frame.title = 'Isolated code preview'; frame.srcdoc = srcdoc;
  const previous = previewWrap.querySelector('iframe'); if (previous) previous.remove(); $('emptyPreview').style.display = 'none'; previewWrap.appendChild(frame);
  const run = { token, srcdoc, mode, started: performance.now(), active: true, ready: false, completed: false, committed: false, previousGood: state.lastGood ? { ...state.lastGood } : null, watchdog: null };
  state.run = run; $('stopBtn').disabled = false; setStatus('Running…', 'Isolated preview is starting', 'busy');
  run.watchdog = setTimeout(() => { if (!run.active) return; if (!run.completed) { addConsole('error', 'Run stopped after 5 seconds without completing.'); endRun(run, 'timeout', 'The five-second limit ended this run.'); } else finishWindow(run); }, 5000);
}
function stopRun() { if (!state.run) return; const run = state.run; if (!run.active) return; run.active = false; clearTimeout(run.watchdog); $('stopBtn').disabled = true; if (run.ready && state.lastGood && state.lastGood.srcdoc === run.srcdoc) { setStatus('Preview stopped', 'Last good picture kept on screen', 'ok'); } else { restoreLastGood(); setStatus('Run stopped', 'Last good preview restored', 'error'); } }
function handleMessage(event) {
  const data = event.data || {}; const frame = previewWrap.querySelector('iframe');
  if (!frame || event.source !== frame.contentWindow || !state.run || data.playgroundToken !== state.run.token || !state.run.active) return;
  const run = state.run;
  if (data.type === 'bridge-ready') { run.ready = true; addConsole('info', `${run.mode.toUpperCase()} preview ready`); return; }
  if (data.type === 'source-complete') { run.completed = true; endRun(run, 'success', 'Ready for interaction'); return; }
  if (data.type === 'log') addConsole(data.level || 'log', data.message || '', data);
  if (data.type === 'error') { const line = mapLine(data.line, run.mode); addConsole('error', data.message || 'Uncaught error', line ? { line } : {}); endRun(run, 'error', line ? `Source line ${line}` : 'See console for details'); }
}
function scheduleAuto() { clearTimeout(state.autoTimer); if ($('autoRun').checked) state.autoTimer = setTimeout(runCode, 2000); }
function setEditor(record) { titleInput.value = record.title; filenameInput.value = record.filename; sourceInput.value = record.source; state.snippetId = record.id || null; state.revision = record.revision || null; updateEditor(); markDirty(); }
function loadExample(example) { setEditor(example); $('savedState').textContent = 'Example · not saved'; $('savedState').style.color = 'var(--blue)'; runCode(); toast(`Loaded example: ${example.title}`); }
function newDraft() { clearTimeout(state.autoTimer); state.snippetId = null; state.revision = null; titleInput.value = 'Untitled idea'; filenameInput.value = 'idea.js'; sourceInput.value = ''; updateEditor(); markDirty(); setStatus('Fresh draft', 'Ready when you are', ''); sourceInput.focus(); }
async function saveSnippet() {
  const payload = { title: titleInput.value.trim(), filename: filenameInput.value.trim(), source: sourceInput.value, revision: state.revision };
  if (!payload.title) return toast('Give this snippet a title before saving.', true);
  if (!/\.(js|html|css)$/i.test(payload.filename)) return toast('Filename must end in .js, .html, or .css.', true);
  const method = state.snippetId ? 'PUT' : 'POST'; const url = state.snippetId ? `/api/snippets/${encodeURIComponent(state.snippetId)}` : '/api/snippets';
  try {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const result = await response.json();
    if (!response.ok) { if (result.conflict) showConflict(result.conflict, payload); else toast(result.error || 'Could not save this snippet.', true); return; }
    state.snippetId = result.id; state.revision = result.revision; titleInput.value = result.title; filenameInput.value = result.filename; $('savedState').textContent = `Saved · rev ${result.revision}`; $('savedState').style.color = 'var(--green)'; await loadSaved(); toast(method === 'POST' ? 'Snippet saved to your library.' : 'Saved revision updated.');
  } catch { toast('The local library is unavailable right now.', true); }
}
async function loadSaved() { try { const response = await fetch('/api/snippets'); state.saved = response.ok ? await response.json() : []; renderLibrary(); } catch { state.saved = []; renderLibrary(); } }
function renderLibrary() {
  $('savedCount').textContent = state.saved.length;
  $('emptyLibrary').style.display = state.saved.length ? 'none' : 'flex';
  savedList.innerHTML = state.saved.map(item => `<div class="snippet-row"><div class="snippet-info"><span class="snippet-title">${escapeHtml(item.title)}</span><span class="snippet-meta">${escapeHtml(item.filename)} · rev ${item.revision}</span></div><button class="load-btn" data-id="${item.id}" type="button">Load</button></div>`).join('');
  examplesList.innerHTML = examples.map((item, index) => `<div class="snippet-row"><div class="snippet-info"><span class="snippet-title">${escapeHtml(item.title)}</span><span class="snippet-meta">${item.filename} · ${index === 0 ? 'interactive' : index === 1 ? 'JavaScript' : 'CSS sample'}</span></div><button class="load-btn example-load" data-index="${index}" type="button">Try it</button></div>`).join('');
}
function showConflict(remote, local) { state.conflict = { remote, local }; $('localCompare').textContent = local.source; $('remoteCompare').textContent = remote.source; $('conflictModal').hidden = false; $('keepLocalBtn').focus(); toast('Save paused: another editor has a newer revision.', true); }
function closeConflict() { $('conflictModal').hidden = true; state.conflict = null; }
function loadConflictLatest() { if (!state.conflict) return; const record = state.conflict.remote; setEditor(record); $('savedState').textContent = `Loaded latest · rev ${record.revision}`; $('savedState').style.color = 'var(--green)'; closeConflict(); toast('Latest saved copy loaded. Reapply your changes deliberately.'); }
function applyTheme(dark) { document.body.classList.toggle('dark', dark); $('themeIcon').textContent = dark ? '☀' : '☾'; $('themeToggle').setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); localStorage.setItem('cw-theme', dark ? 'dark' : 'light'); }

sourceInput.addEventListener('input', () => { updateEditor(); markDirty(); scheduleAuto(); });
sourceInput.addEventListener('keyup', updateCursor); sourceInput.addEventListener('click', updateCursor); sourceInput.addEventListener('scroll', () => { syntax.scrollTop = sourceInput.scrollTop; syntax.scrollLeft = sourceInput.scrollLeft; lineNumbers.scrollTop = sourceInput.scrollTop; });
filenameInput.addEventListener('input', () => { updateEditor(); markDirty(); }); titleInput.addEventListener('input', markDirty);
$('runBtn').addEventListener('click', runCode); $('stopBtn').addEventListener('click', stopRun); $('clearConsole').addEventListener('click', () => { state.console = []; renderConsole(); }); $('newDraftBtn').addEventListener('click', newDraft); $('saveCurrentBtn').addEventListener('click', saveSnippet); $('saveBtn').addEventListener('click', saveSnippet);
examplesList.addEventListener('click', event => { const button = event.target.closest('.example-load'); if (button) loadExample(examples[Number(button.dataset.index)]); });
savedList.addEventListener('click', event => { const button = event.target.closest('.load-btn'); if (!button) return; const item = state.saved.find(record => record.id === button.dataset.id); if (item) { setEditor(item); runCode(); toast(`Loaded saved snippet: ${item.title}`); } });
$('themeToggle').addEventListener('click', () => applyTheme(!document.body.classList.contains('dark'))); $('autoRun').addEventListener('change', () => { if (!$('autoRun').checked) clearTimeout(state.autoTimer); });
$('closeConflict').addEventListener('click', closeConflict); $('keepLocalBtn').addEventListener('click', closeConflict); $('loadLatestBtn').addEventListener('click', loadConflictLatest); $('conflictModal').addEventListener('click', event => { if (event.target === $('conflictModal')) closeConflict(); });
window.addEventListener('message', handleMessage); document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); runCode(); } });

applyTheme(localStorage.getItem('cw-theme') === 'dark');
setEditor(examples[0]); renderLibrary(); renderConsole();
setTimeout(runCode, 100);
loadSaved();

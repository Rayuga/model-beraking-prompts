import { React, ReactDOM, EditorView, EditorState, basicSetup, Prec, keymap, indentWithTab, Compartment, javascript, html, css, darkEditor } from './vendor.js';
import { PreviewRunner, language } from './runtime';
import './style.css';

const h = React.createElement;
const { useState, useEffect, useRef } = React;
const examples = ['hello.js', 'counter.html', 'sheet.css', 'broken.js', 'slow.js'];
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const remember = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
async function api(url, method = 'GET', body = undefined) {
  const response = await fetch(url, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'The request could not be completed.'), { status: response.status, data });
  return data;
}
function Value({ value }) {
  if (value && typeof value === 'object') return h('details', null, h('summary', null, Array.isArray(value) ? `Array(${value.length})` : 'Object'), h('div', { className: 'tree' }, ...Object.entries(value).map(([key, item]) => h('div', { key }, h('strong', null, `${key}: `), h(Value, { value: item })))));
  return h('span', null, String(value));
}
function App() {
  const [code, setCode] = useState('');
  const [filename, setFilename] = useState('hello.js');
  const [title, setTitle] = useState('Welcome');
  const [record, setRecord] = useState(null);
  const [baseline, setBaseline] = useState({ code: '', filename: 'hello.js', title: 'Welcome' });
  const [snippets, setSnippets] = useState([]);
  const [theme, setTheme] = useState(() => read('cw-theme-v2', 'dark'));
  const [auto, setAuto] = useState(false);
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState('Ready');
  const [duration, setDuration] = useState(null);
  const [width, setWidth] = useState(() => Math.min(80, Math.max(25, Number(read('cw-width-v2', 52)))));
  const [height, setHeight] = useState(() => Math.min(80, Math.max(25, Number(read('cw-height-v2', 64)))));
  const [saveBusy, setSaveBusy] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [recoveryDraft, setRecoveryDraft] = useState(null);
  const editorHost = useRef(null), editor = useRef(null), previewHost = useRef(null), runner = useRef(null), consoleHost = useRef(null), following = useRef(true);
  const languageCompartment = useRef(new Compartment()), themeCompartment = useRef(new Compartment());
  const current = useRef(null), commands = useRef(null), initialised = useRef(false), initialAuto = useRef(true);
  const dirty = code !== baseline.code || title !== baseline.title || filename !== baseline.filename;
  current.current = { code, filename, title, record, dirty };
  function log(level, values) { setEntries(previous => [...previous.slice(-999), { level, values, id: crypto.randomUUID() }]); }
  function setRunStatus(next, time) { setStatus(next); setDuration(time); }
  function run() { runner.current?.run(current.current.code, current.current.filename); }
  function clear() { following.current = true; setEntries([]); }
  const discardAllowed = () => !current.current.dirty || confirm('Discard unsaved changes?');
  async function refresh() { const list = await api('/api/snippets'); setSnippets(list); return list; }
  function openRecord(item, force = false) {
    if (!force && !discardAllowed()) return;
    if (runner.current?.active) runner.current.stop('Previous run cancelled');
    setRecord(item.id ? item : null); setTitle(item.title); setFilename(item.filename); setCode(item.code); setBaseline({ title: item.title, filename: item.filename, code: item.code }); setConflict(null);
  }
  async function openExample(name, startup = false) {
    if (!startup && !discardAllowed()) return;
    try {
      const response = await fetch('/starters/' + name); if (!response.ok) throw new Error('Example could not be opened.');
      const text = await response.text();
      openRecord({ title: name.replace(/\.[^.]+$/, ''), filename: name, code: text }, true);
      if (startup) runner.current?.run(text, name);
    } catch (error) { log('error', [error.message]); }
  }
  async function save(duplicate = false, chosenTitle = current.current.title) {
    if (saveBusy) return;
    setSaveBusy(true);
    const draft = current.current;
    try {
      const body = { title: chosenTitle, filename: draft.filename, code: draft.code, ...(!duplicate && draft.record ? { revision: draft.record.revision } : {}) };
      const saved = await api('/api/snippets' + (!duplicate && draft.record ? '/' + draft.record.id : ''), !duplicate && draft.record ? 'PUT' : 'POST', body);
      setRecord(saved); setTitle(saved.title); setBaseline({ code: draft.code, filename: draft.filename, title: saved.title }); setConflict(null); await refresh(); setStatus(`Saved “${saved.title}” · revision ${saved.revision}`);
    } catch (error) {
      log('error', [error.message]); setStatus('Save failed — your draft is kept');
      if (error.data?.code === 'REVISION_CONFLICT') setConflict({ current: error.data.current, message: error.message });
    } finally { setSaveBusy(false); }
  }
  async function remove() {
    const draft = current.current;
    if (!draft.record || !confirm(`Delete “${draft.title}”? This cannot be undone.`)) return;
    try {
      await api('/api/snippets/' + draft.record.id, 'DELETE', { revision: draft.record.revision });
      setRecord(null); setBaseline({ title: '', filename: '', code: '' }); setConflict(null); await refresh(); setStatus('Deleted — the open code remains as an unsaved draft');
    } catch (error) { log('error', [error.message]); if (error.data?.code === 'REVISION_CONFLICT') setConflict({ current: error.data.current, message: error.message }); }
  }
  async function rename(chosenTitle) {
    const draft = current.current;
    if (saveBusy || !draft.record) return;
    setSaveBusy(true);
    try {
      const saved = await api('/api/snippets/' + draft.record.id, 'PUT', { title: chosenTitle, filename: draft.record.filename, code: draft.record.code, revision: draft.record.revision });
      setRecord(saved); setTitle(saved.title); setBaseline({ title: saved.title, filename: saved.filename, code: saved.code }); setConflict(null); await refresh(); setStatus(`Renamed to “${saved.title}” — unsaved code and filename edits remain in the draft`);
    } catch (error) {
      log('error', [error.message]);
      if (error.data?.code === 'REVISION_CONFLICT') setConflict({ current: error.data.current, message: error.message });
    } finally { setSaveBusy(false); }
  }
  async function loadLatest() {
    if (!record) return;
    try { const latest = await api('/api/snippets/' + record.id); setRecoveryDraft({ code, filename, title }); openRecord(latest, true); setStatus('Latest revision loaded. Your previous draft can be restored for review.'); }
    catch (error) { log('error', [error.message]); }
  }
  function newSnippet() {
    if (!discardAllowed()) return;
    openRecord({ title: 'Untitled', filename: 'snippet.js', code: 'document.body.innerHTML = "<h1>Hello, Colderwater</h1>";\nconsole.log("Ready to explore.");\n' }, true);
    setBaseline({ title: '', filename: '', code: '' });
  }
  function exportFile() {
    const link = document.createElement('a'), url = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
    link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file) {
    if (!file || !discardAllowed()) return;
    if (language(file.name) !== 'js') { log('error', ['Import a .js file.']); return; }
    openRecord({ title: file.name.replace(/\.[^.]+$/, ''), filename: file.name, code: await file.text() }, true); setBaseline({ title: '', filename: '', code: '' }); setStatus('File imported — save it to keep it in your library');
  }
  function resize(event, axis) {
    const target = event.currentTarget; target.setPointerCapture(event.pointerId);
    const parent = document.querySelector(axis === 'x' ? '.workspace' : '.right');
    const move = next => {
      const bounds = parent.getBoundingClientRect();
      const value = Math.min(80, Math.max(25, (axis === 'x' ? (next.clientX - bounds.left) / bounds.width : (next.clientY - bounds.top) / bounds.height) * 100));
      if (axis === 'x') { setWidth(value); remember('cw-width-v2', value); } else { setHeight(value); remember('cw-height-v2', value); }
    };
    const finish = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', finish); target.removeEventListener('pointercancel', finish); };
    target.addEventListener('pointermove', move); target.addEventListener('pointerup', finish); target.addEventListener('pointercancel', finish);
  }
  commands.current = { run, save: () => save(), clear };
  useEffect(() => {
    editor.current = new EditorView({ parent: editorHost.current, state: EditorState.create({ doc: '', extensions: [basicSetup, Prec.highest(keymap.of([indentWithTab, { key: 'Mod-Enter', run: () => (commands.current.run(), true) }, { key: 'Mod-s', run: () => (commands.current.save(), true) }, { key: 'Mod-Shift-k', run: () => (commands.current.clear(), true) }])), languageCompartment.current.of(javascript()), themeCompartment.current.of(darkEditor), EditorView.contentAttributes.of({ 'aria-label': 'Code editor', 'aria-describedby': 'keyboard-help' }), EditorView.updateListener.of(update => { if (update.docChanged) setCode(update.state.doc.toString()); })] }) });
    runner.current = new PreviewRunner(previewHost.current, log, setRunStatus);
    return () => { editor.current.destroy(); runner.current.destroy(); };
  }, []);
  useEffect(() => { if (editor.current && editor.current.state.doc.toString() !== code) editor.current.dispatch({ changes: { from: 0, to: editor.current.state.doc.length, insert: code } }); }, [code]);
  useEffect(() => { const mode = language(filename); editor.current?.dispatch({ effects: languageCompartment.current.reconfigure(mode === 'html' ? html() : mode === 'css' ? css() : javascript()) }); }, [filename]);
  useEffect(() => { editor.current?.dispatch({ effects: themeCompartment.current.reconfigure(theme === 'dark' ? darkEditor : []) }); document.documentElement.dataset.theme = theme; remember('cw-theme-v2', theme); }, [theme]);
  useEffect(() => { if (!auto) return; const timer = setTimeout(run, 500); return () => clearTimeout(timer); }, [code, filename, auto]);
  useEffect(() => { if (consoleHost.current && following.current) consoleHost.current.scrollTop = consoleHost.current.scrollHeight; }, [entries]);
  useEffect(() => {
    const beforeUnload = event => { if (current.current.dirty) { event.preventDefault(); event.returnValue = ''; } };
    const keydown = event => { if (event.defaultPrevented || !(event.ctrlKey || event.metaKey)) return; if (event.key === 'Enter') { event.preventDefault(); commands.current.run(); } else if (event.key.toLowerCase() === 's') { event.preventDefault(); commands.current.save(); } else if (event.shiftKey && event.key.toLowerCase() === 'k') { event.preventDefault(); commands.current.clear(); } };
    addEventListener('beforeunload', beforeUnload); addEventListener('keydown', keydown);
    return () => { removeEventListener('beforeunload', beforeUnload); removeEventListener('keydown', keydown); };
  }, []);
  useEffect(() => {
    if (initialised.current) return; initialised.current = true;
    refresh().then(items => { if (items.length) { openRecord(items[0], true); runner.current?.run(items[0].code, items[0].filename); } else openExample('hello.js', true); }).catch(error => { log('error', [error.message]); openExample('hello.js', true); });
  }, []);
  return h(React.Fragment, null,
    h('header', null, h('div', { className: 'brand' }, h('span', { className: 'mark', 'aria-hidden': true }, '≈'), h('div', null, h('h1', null, 'Colderwater'), h('p', null, 'A small place for big ideas.')), h('span', { className: 'badge' }, 'PLAYGROUND')), h('div', { className: 'toolbar' }, h('span', { className: 'offline' }, '● Local library'), h('button', { onClick: () => setTheme(theme === 'dark' ? 'light' : 'dark') }, theme === 'dark' ? 'Light theme' : 'Dark theme'))),
    h('div', { className: 'commandbar' }, h('div', null,
      h('label', null, 'Example ', h('select', { 'aria-label': 'Starter example', defaultValue: 'hello.js', onChange: event => openExample(event.target.value) }, ...examples.map(name => h('option', { key: name }, name)))), h('button', { className: 'primary', onClick: run }, 'Run ', h('kbd', null, 'Ctrl ↵')), h('button', { onClick: () => runner.current.stop('Run cancelled') }, 'Stop'), h('label', { className: 'check' }, h('input', { type: 'checkbox', checked: auto, onChange: event => setAuto(event.target.checked) }), 'Auto-run')),
      h('span', { className: 'runstatus', role: 'status' }, status, duration !== null ? ` · ${duration.toFixed(1)} ms` : '')),
    h('main', { className: 'workspace', style: { gridTemplateColumns: `minmax(0,${width}fr) 8px minmax(0,${100 - width}fr)` } },
      h('section', { className: 'editor pane', 'aria-label': 'Editor' }, h('div', { className: 'paneheading' }, h('h2', null, '01 / Editor'), h('span', { className: dirty ? 'dirty' : '' }, `${record ? `Loaded #${record.id} · revision ${record.revision}` : 'New snippet'} · ${dirty ? 'Unsaved changes' : 'Unchanged'}`)),
        h('div', { className: 'filebar' }, h('label', null, 'Title', h('input', { 'aria-label': 'Snippet title', value: title, onChange: event => setTitle(event.target.value) })), h('label', null, 'Filename', h('input', { 'aria-label': 'Filename', value: filename, onChange: event => setFilename(event.target.value) })), h('button', { onClick: () => save(), disabled: saveBusy }, saveBusy ? 'Saving…' : 'Save')),
        conflict && h('div', { className: 'conflict-notice', role: 'alert' }, h('strong', null, 'This snippet changed in another editor.'), h('p', null, 'Your draft is still here. Load the latest saved revision before saving or deleting.'), h('button', { onClick: loadLatest }, 'Reload latest')),
        recoveryDraft && !conflict && h('div', { className: 'draft-notice' }, 'Your previous draft is available.', h('button', { onClick: () => { setCode(recoveryDraft.code); setFilename(recoveryDraft.filename); setTitle(recoveryDraft.title); setRecoveryDraft(null); setStatus('Previous draft restored over the loaded revision — review, then Save'); } }, 'Restore previous draft')),
        h('div', { ref: editorHost, className: 'codehost' }),
        h('div', { className: 'library' }, h('div', { className: 'paneheading' }, h('h3', null, 'Saved snippets ', h('span', null, snippets.length)), h('div', { className: 'tools' }, h('button', { onClick: newSnippet }, 'New'), h('button', { onClick: () => { const name = prompt('Name for duplicate', `${title} copy`); if (name) save(true, name); } }, 'Duplicate'), h('button', { disabled: !record || saveBusy, onClick: () => { const name = prompt('Rename snippet', title); if (name) rename(name); } }, 'Rename'), h('button', { disabled: !record, onClick: remove }, 'Delete'))),
          h('div', { className: 'snippetlist', 'aria-label': 'Saved snippets' }, snippets.length ? snippets.map(item => h('button', { key: item.id, 'aria-pressed': item.id === record?.id, onClick: () => openRecord(item) }, item.title, h('small', null, item.filename))) : h('p', null, 'No saved snippets yet. Save your first experiment above.')),
          h('div', { className: 'tools' }, h('button', { onClick: exportFile }, 'Export file'), h('label', { className: 'import' }, 'Import file', h('input', { 'aria-label': 'Import file', type: 'file', accept: '.js,.html,.css', onChange: event => { importFile(event.target.files?.[0]); event.target.value = ''; } })))
        )
      ),
      h('div', { className: 'divider vertical', role: 'separator', 'aria-label': 'Resize editor and preview', 'aria-orientation': 'vertical', 'aria-valuemin': 25, 'aria-valuemax': 80, 'aria-valuenow': Math.round(width), tabIndex: 0, onPointerDown: event => resize(event, 'x'), onKeyDown: event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); const value = Math.min(80, Math.max(25, width + (event.key === 'ArrowLeft' ? -2 : 2))); setWidth(value); remember('cw-width-v2', value); } } }),
      h('div', { className: 'right', style: { gridTemplateRows: `minmax(150px,${height}fr) 8px minmax(130px,${100 - height}fr)` } },
        h('section', { className: 'preview pane', 'aria-label': 'Live preview' }, h('div', { className: 'paneheading' }, h('h2', null, '02 / Live preview'), h('span', null, 'Isolated frame')), h('div', { ref: previewHost, className: 'preview-host' })),
        h('div', { className: 'divider horizontal', role: 'separator', 'aria-label': 'Resize preview and console', 'aria-orientation': 'horizontal', 'aria-valuemin': 25, 'aria-valuemax': 80, 'aria-valuenow': Math.round(height), tabIndex: 0, onPointerDown: event => resize(event, 'y'), onKeyDown: event => { if (['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); const value = Math.min(80, Math.max(25, height + (event.key === 'ArrowUp' ? -2 : 2))); setHeight(value); remember('cw-height-v2', value); } } }),
        h('section', { className: 'console pane', 'aria-label': 'Console' }, h('div', { className: 'paneheading' }, h('h2', null, '03 / Console ', h('span', null, entries.length)), h('button', { onClick: clear }, 'Clear console')), h('div', { ref: consoleHost, className: 'entries', role: 'log', 'aria-label': 'Console output', onScroll: event => { const element = event.currentTarget; following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24; } }, entries.length ? entries.map(entry => h('div', { className: `entry ${entry.level}`, key: entry.id }, h('span', { className: 'level' }, entry.level), ...entry.values.map((value, index) => h(Value, { key: index, value })))) : h('p', { className: 'empty' }, 'Console is clear. Logs and errors appear here.')))
      )
    ),
    h('footer', null, h('span', null, 'JavaScript · HTML · CSS'), h('span', { id: 'keyboard-help' }, 'Ctrl/Cmd+Enter Run · Ctrl/Cmd+S Save · Ctrl/Cmd+Shift+K Clear console · Tab / Shift+Tab Indent · Escape, then Tab Leave editor · 5s run budget'))
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(h(App));

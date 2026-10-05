import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { mountCodeEditor } from './custom-editor.js';
import { PreviewRunner, language } from './runtime';
import './style.css';

const h = React.createElement;
const { useState, useEffect, useRef } = React;
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const remember = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
async function api(url, method = 'GET', body = undefined) {
  const response = await fetch(url, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'The request could not be completed.'), { status: response.status, data });
  return data;
}
function Value({ value }) {
  if (value && typeof value === 'object') return h('details', { open: true }, h('summary', null, Array.isArray(value) ? `Array(${value.length})` : 'Object'), h('div', { className: 'tree' }, ...Object.entries(value).map(([key, item]) => h('div', { key }, h('strong', null, `${key}: `), h(Value, { value: item })))));
  return h('span', null, String(value));
}
function App() {
  const [code, setCode] = useState('');
  const [filename, setFilename] = useState('snippet.js');
  const [title, setTitle] = useState('Untitled');
  const [record, setRecord] = useState(null);
  const [baseline, setBaseline] = useState({ code: '', filename: 'snippet.js', title: 'Untitled' });
  const [snippets, setSnippets] = useState([]);
  const [history, setHistory] = useState([]), [selectedRevision, setSelectedRevision] = useState(null);
  const [pendingRestore, setPendingRestore] = useState(null);
  const [loadEpoch, setLoadEpoch] = useState(0);
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
  const current = useRef(null), commands = useRef(null), initialised = useRef(false);
  const autoTimer = useRef(null), skipAuto = useRef(false);
  const dirty = code !== baseline.code || title !== baseline.title || filename !== baseline.filename;
  current.current = { code, filename, title, record, dirty };
  function log(level, values) { setEntries(previous => [...previous.slice(-999), { level, values, id: crypto.randomUUID() }]); }
  function setRunStatus(next, time) { setStatus(next); setDuration(time); }
  function cancelAuto() { clearTimeout(autoTimer.current); autoTimer.current = null; }
  function run() { cancelAuto(); runner.current?.run(current.current.code, current.current.filename); editor.current?.focus(); }
  function clear() { following.current = true; setEntries([]); }
  const discardAllowed = () => !current.current.dirty || confirm('Discard unsaved changes?');
  async function refresh() { const list = await api('/api/snippets'); setSnippets(list); return list; }
  function openRecord(item, force = false) {
    if (!force && !discardAllowed()) return;
    cancelAuto(); skipAuto.current = true;
    setLoadEpoch(value => value + 1);
    if (runner.current?.active) runner.current.stop('Previous run cancelled');
    // A loaded record starts with a clean editing history, even when its text
    // equals what the editor already holds.
    editor.current?.setValue(item.code);
    setRecord(item.id ? item : null); setTitle(item.title); setFilename(item.filename); setCode(item.code); setBaseline({ title: item.title, filename: item.filename, code: item.code }); setConflict(null); setSelectedRevision(null); setPendingRestore(null);
  }
  async function save(chosenTitle = current.current.title) {
    if (saveBusy) return;
    setSaveBusy(true);
    const draft = current.current;
    // Typing after a Save is its own Undo step, so Undo can return to the saved text.
    editor.current?.endTypingRun();
    editor.current?.focus();
    try {
      const body = { title: chosenTitle, filename: draft.filename, code: draft.code, ...(draft.record ? { revision: draft.record.revision } : {}) };
      const saved = await api('/api/snippets' + (draft.record ? '/' + draft.record.id : ''), draft.record ? 'PUT' : 'POST', body);
      setRecord(saved); setTitle(saved.title); setBaseline({ code: draft.code, filename: draft.filename, title: saved.title }); setConflict(null); await refresh(); setStatus(`Saved “${saved.title}” · revision ${saved.revision}`);
    } catch (error) {
      log('error', [error.message]); setStatus('Save failed — your draft is kept');
      if (error.data?.code === 'REVISION_CONFLICT') setConflict({ current: error.data.current, message: error.message });
    } finally { setSaveBusy(false); editor.current?.focus(); }
  }
  async function loadLatest() {
    if (!record) return;
    try { const latest = await api('/api/snippets/' + record.id); setRecoveryDraft({ code, filename, title }); openRecord(latest, true); setStatus('Latest revision loaded. Your previous draft can be restored for review.'); }
    catch (error) { log('error', [error.message]); }
  }
  async function restoreRevision(retry = false) {
    if (saveBusy || !current.current.record || (!retry && !selectedRevision)) return;
    const request = retry ? pendingRestore : { url: '/api/snippets/' + current.current.record.id + '/restore', body: { revision: current.current.record.revision, sourceRevision: selectedRevision.revision, operationId: crypto.randomUUID() } };
    if (!request) return;
    if (!retry && !confirm('Restore this saved revision as a new current revision?')) return;
    setPendingRestore(request); setSaveBusy(true);
    try {
      const restored = await api(request.url, 'POST', request.body);
      openRecord(restored, true); setPendingRestore(request); setStatus(`Restored as revision ${restored.revision}`); await refresh();
    } catch (error) {
      log('error', [error.message]); setStatus('Restore was not confirmed. Your draft is kept; retry the same attempt or reload latest.');
      if (error.data?.code === 'REVISION_CONFLICT') setConflict({ current: error.data.current, message: error.message });
    } finally { setSaveBusy(false); }
  }
  function newSnippet() {
    if (!discardAllowed()) return;
    openRecord({ title: 'Untitled', filename: 'snippet.js', code: 'document.body.innerHTML = "<h1>Hello, Colderwater</h1>";\nconsole.log("Ready to explore.");\n' }, true);
    setBaseline({ title: '', filename: '', code: '' });
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
    editor.current = mountCodeEditor(editorHost.current, { onChange: setCode, run: () => commands.current.run(), save: () => commands.current.save() });
    runner.current = new PreviewRunner(previewHost.current, log, setRunStatus);
    return () => { editor.current.destroy(); runner.current.destroy(); };
  }, []);
  useEffect(() => { if (editor.current && editor.current.getValue() !== code) editor.current.setValue(code); }, [code]);
  useEffect(() => { editor.current?.setMode(language(filename)); }, [filename]);
  useEffect(() => { document.documentElement.dataset.theme = 'dark'; }, []);
  useEffect(() => { cancelAuto(); if (skipAuto.current) { skipAuto.current = false; return; } if (auto) autoTimer.current = setTimeout(run, 700); return cancelAuto; }, [code, filename, auto, loadEpoch]);
  useEffect(() => { let disposed = false; if (!record) { setHistory([]); return; } api('/api/snippets/' + record.id + '/history').then(items => { if (!disposed) setHistory(items); }).catch(error => { if (!disposed) log('error', [error.message]); }); return () => { disposed = true; }; }, [record?.id, record?.revision, snippets.find(item => item.id === record?.id)?.revision]);
  useEffect(() => { if (consoleHost.current && following.current) consoleHost.current.scrollTop = consoleHost.current.scrollHeight; }, [entries]);
  useEffect(() => {
    const keydown = event => { if (event.defaultPrevented || !(event.ctrlKey || event.metaKey)) return; if (event.key === 'Enter') { event.preventDefault(); commands.current.run(); } else if (event.key.toLowerCase() === 's') { event.preventDefault(); commands.current.save(); } else if (event.shiftKey && event.key.toLowerCase() === 'k') { event.preventDefault(); commands.current.clear(); } };
    addEventListener('keydown', keydown);
    return () => { removeEventListener('keydown', keydown); };
  }, []);
  useEffect(() => {
    if (initialised.current) return; initialised.current = true;
    refresh().catch(error => log('error', [error.message]));
  }, []);
  // Other tabs share this library. Refresh only the list; the draft, caret and
  // undo history live in the editor and are never reloaded from here.
  useEffect(() => {
    const quiet = () => { refresh().catch(() => {}); };
    const timer = setInterval(quiet, 2000);
    addEventListener('focus', quiet); document.addEventListener('visibilitychange', quiet);
    return () => { clearInterval(timer); removeEventListener('focus', quiet); document.removeEventListener('visibilitychange', quiet); };
  }, []);
  const remote = record ? snippets.find(item => item.id === record.id) : null;
  const newerRevision = remote && remote.revision > record.revision ? remote.revision : null;
  const draftState = record ? (dirty ? 'Unsaved changes' : 'Saved') : (dirty ? 'Unsaved draft' : 'Nothing to save');
  return h(React.Fragment, null,
    h('header', null, h('div', { className: 'brand' }, h('span', { className: 'mark', 'aria-hidden': true }, '≈'), h('div', null, h('h1', null, 'Colderwater'), h('p', null, 'Experiment. Recover. Keep the history.')), h('span', { className: 'badge' }, 'PLAYGROUND')), h('div', { className: 'toolbar' }, h('span', { className: 'offline' }, '● Local library'))),
    h('div', { className: 'commandbar' }, h('div', null,
      h('button', { className: 'primary', onClick: run }, 'Run ', h('kbd', null, 'Ctrl ↵')), h('button', { onClick: () => runner.current.stop('Run stopped') }, 'Stop')),
      h('span', { className: 'runstatus', role: 'status' }, status, duration !== null ? ` · ${duration.toFixed(1)} ms` : '')),
    h('main', { className: 'workspace', style: { gridTemplateColumns: `minmax(0,${width}fr) 8px minmax(0,${100 - width}fr)` } },
      h('section', { className: 'editor pane', 'aria-label': 'Editor' }, h('div', { className: 'paneheading' }, h('h2', null, '01 / Editor'), h('span', { className: dirty ? 'dirty' : '', role: 'status', 'aria-label': 'Draft state' }, `${record ? `Loaded #${record.id} · revision ${record.revision}` : 'New snippet'} · ${draftState}`)),
        h('div', { className: 'filebar' }, h('label', null, 'Title', h('input', { 'aria-label': 'Snippet title', value: title, onChange: event => setTitle(event.target.value) })), h('label', null, 'Filename', h('input', { 'aria-label': 'Filename', value: filename, onChange: event => setFilename(event.target.value) })), h('button', { onClick: () => save(), disabled: saveBusy }, saveBusy ? 'Saving…' : 'Save')),
        conflict && h('div', { className: 'conflict-notice', role: 'alert' }, h('strong', null, 'This snippet changed in another editor.'), h('p', null, 'Your draft is still here. Load the latest saved revision before saving or restoring.'), h('button', { onClick: loadLatest }, 'Reload latest')),
        newerRevision && !conflict && h('div', { className: 'conflict-notice', role: 'status' }, h('strong', null, `Revision ${newerRevision} of this snippet was saved in another tab.`), h('p', null, 'Your draft is kept and nothing was loaded over it. Load the latest revision when you are ready.'), h('button', { onClick: loadLatest }, 'Load latest revision')),
        recoveryDraft && !conflict && h('div', { className: 'draft-notice' }, 'Your previous draft is available.', h('button', { onClick: () => { setCode(recoveryDraft.code); setFilename(recoveryDraft.filename); setTitle(recoveryDraft.title); setRecoveryDraft(null); setStatus('Previous draft restored over the loaded revision — review, then Save'); } }, 'Restore previous draft')),
        h('div', { ref: editorHost, className: 'codehost' }),
        h('div', { className: 'library' }, h('div', { className: 'paneheading' }, h('h3', null, 'Saved snippets ', h('span', null, snippets.length)), h('div', { className: 'tools' }, h('button', { onClick: newSnippet }, 'New'))),
          h('div', { className: 'snippetlist', 'aria-label': 'Saved snippets' }, snippets.length ? snippets.map(item => h('button', { key: item.id, 'aria-pressed': item.id === record?.id, onClick: () => openRecord(item) }, item.title, h('small', null, item.filename))) : h('p', null, 'No saved snippets yet. Save your first experiment above.')),
          record && h('section', { className: 'history', 'aria-label': 'Revision history' }, h('h3', null, 'Revision history'),
            h('div', { className: 'history-list' }, history.map(item => h('button', { key: item.revision, 'aria-pressed': selectedRevision?.revision === item.revision, onClick: () => setSelectedRevision(item) }, `Revision ${item.revision}`, item.restored_from ? ` · restored from ${item.restored_from}` : ''))),
            selectedRevision && h('div', { className: 'revision-preview' }, h('strong', null, `${selectedRevision.title} · ${selectedRevision.filename}`), h('pre', { 'aria-label': 'Historical source' }, selectedRevision.code), h('button', { disabled: saveBusy, onClick: () => restoreRevision() }, 'Restore selected revision')),
            pendingRestore && h('button', { disabled: saveBusy, onClick: () => restoreRevision(true) }, 'Retry same restore'))
        )
      ),
      h('div', { className: 'divider vertical', role: 'separator', 'aria-label': 'Resize editor and preview', 'aria-orientation': 'vertical', 'aria-valuemin': 25, 'aria-valuemax': 80, 'aria-valuenow': Math.round(width), tabIndex: 0, onPointerDown: event => resize(event, 'x'), onKeyDown: event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); const value = Math.min(80, Math.max(25, width + (event.key === 'ArrowLeft' ? -2 : 2))); setWidth(value); remember('cw-width-v2', value); } } }),
      h('div', { className: 'right', style: { gridTemplateRows: `minmax(150px,${height}fr) 8px minmax(130px,${100 - height}fr)` } },
        h('section', { className: 'preview pane', 'aria-label': 'Live preview' }, h('div', { className: 'paneheading' }, h('h2', null, '02 / Live preview'), h('span', null, 'Isolated frame')), h('div', { ref: previewHost, className: 'preview-host' })),
        h('div', { className: 'divider horizontal', role: 'separator', 'aria-label': 'Resize preview and console', 'aria-orientation': 'horizontal', 'aria-valuemin': 25, 'aria-valuemax': 80, 'aria-valuenow': Math.round(height), tabIndex: 0, onPointerDown: event => resize(event, 'y'), onKeyDown: event => { if (['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); const value = Math.min(80, Math.max(25, height + (event.key === 'ArrowUp' ? -2 : 2))); setHeight(value); remember('cw-height-v2', value); } } }),
        h('section', { className: 'console pane', 'aria-label': 'Console' }, h('div', { className: 'paneheading' }, h('h2', null, '03 / Console ', h('span', null, entries.length)), h('button', { onClick: clear }, 'Clear console')), h('div', { ref: consoleHost, className: 'entries', role: 'log', 'aria-label': 'Console output', onScroll: event => { const element = event.currentTarget; following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24; } }, entries.length ? entries.map(entry => h('div', { className: `entry ${entry.level}`, key: entry.id }, h('span', { className: 'level' }, entry.level), ...entry.values.map((value, index) => h(Value, { key: index, value })))) : h('p', { className: 'empty' }, 'Console is clear. Logs and errors appear here.')))
      )
    ),
    h('footer', null, h('span', null, 'JavaScript · HTML · Revision history'), h('span', { id: 'keyboard-help' }, 'Ctrl/Cmd+Enter Run · Ctrl/Cmd+S Save · Ctrl/Cmd+Shift+K Clear console · Tab / Shift+Tab Indent · Escape, then Tab Leave editor · 5s run budget'))
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(h(App));

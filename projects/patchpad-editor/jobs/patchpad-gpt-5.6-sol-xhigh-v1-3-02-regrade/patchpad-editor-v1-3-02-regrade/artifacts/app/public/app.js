'use strict';

const $ = id => document.getElementById(id);
const ui = {
  title: $('document-title'), meta: $('document-meta'), state: $('save-state'), save: $('save-button'),
  undo: $('undo-button'), redo: $('redo-button'), cursor: $('cursor-status'), caret: $('caret-status'), revision: $('revision-status'),
  message: $('message'), find: $('find-input'), replace: $('replace-input'), findButton: $('find-button'),
  replaceButton: $('replace-button'), replaceAll: $('replace-all-button'), match: $('match-status'),
  history: $('history-panel'), list: $('revision-list'), preview: $('preview'), previewTitle: $('preview-title'),
  previewContent: $('preview-content'), restore: $('restore-button')
};

let documentInfo = null;
let savedContent = '';
let currentMatch = null;
let previewRevision = null;
const editor = new PatchPadEditor.CanvasEditor($('editor'), $('editor-canvas'), $('editor-spacer'), { onChange: updateUI });

function showMessage(text, kind = 'error') {
  ui.message.textContent = text; ui.message.className = `message ${kind === 'info' ? 'info' : ''}`; ui.message.hidden = false;
  clearTimeout(showMessage.timer); showMessage.timer = setTimeout(() => { ui.message.hidden = true; }, kind === 'info' ? 3500 : 9000);
}

async function api(url, options) {
  const response = await fetch(url, options);
  let body;
  try { body = await response.json(); } catch { body = { error: 'The server returned an unreadable response.' }; }
  if (!response.ok) throw Object.assign(new Error(body.error || `Request failed (${response.status}).`), { status: response.status, body });
  return body;
}

function updateUI() {
  if (!documentInfo) return;
  const dirty = editor.model.text !== savedContent;
  const primary = editor.model.carets[0];
  const pos = editor.model.lineColumn(primary.head);
  ui.state.textContent = dirty ? 'Unsaved changes' : 'Saved'; ui.state.classList.toggle('dirty', dirty);
  ui.save.disabled = !dirty; ui.undo.disabled = !editor.model.undoStack.length; ui.redo.disabled = !editor.model.redoStack.length;
  ui.cursor.textContent = `Ln ${pos.line + 1}, Col ${pos.column + 1}`;
  ui.caret.textContent = `${editor.model.carets.length} ${editor.model.carets.length === 1 ? 'caret' : 'carets'}`;
  ui.revision.textContent = `Saved revision ${documentInfo.revision}`;
}

async function load() {
  try {
    const index = await api('/api/documents');
    if (!index.documents.length) throw new Error('No documents are available.');
    documentInfo = await api(`/api/documents/${encodeURIComponent(index.documents[0].id)}`);
    savedContent = documentInfo.content;
    ui.title.textContent = documentInfo.title;
    ui.meta.textContent = `${documentInfo.author} · ${documentInfo.summary}`;
    editor.setText(documentInfo.content); updateUI();
  } catch (error) { showMessage(`Could not open PatchPad: ${error.message}`); }
}

async function save() {
  if (!documentInfo) return;
  ui.save.disabled = true; ui.save.textContent = 'Saving…';
  const contentAtSave = editor.model.text;
  try {
    const result = await api(`/api/documents/${encodeURIComponent(documentInfo.id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: documentInfo.id, baseRevision: documentInfo.revision, content: contentAtSave })
    });
    documentInfo.revision = result.revision; documentInfo.updatedAt = result.updatedAt; savedContent = contentAtSave;
    showMessage(result.unchanged ? 'No content changes; the current revision was kept.' : `Saved revision ${result.revision}.`, 'info');
    updateUI();
  } catch (error) {
    const prefix = error.status === 409 ? 'Save refused to protect a newer revision. ' : 'Save failed. ';
    showMessage(prefix + error.message); updateUI();
  } finally { ui.save.textContent = 'Save'; updateUI(); }
}

function matchesFor(query) {
  if (!query) return [];
  const matches = []; let from = 0;
  while (from <= editor.model.text.length) {
    const at = editor.model.text.indexOf(query, from); if (at < 0) break;
    matches.push(at); from = at + Math.max(1, query.length);
  }
  return matches;
}

function findNext() {
  const query = ui.find.value;
  if (!query) { showMessage('Enter text to find.'); return; }
  const matches = matchesFor(query);
  if (!matches.length) { currentMatch = null; ui.match.textContent = 'No matches'; showMessage(`No matches for “${query}”.`); return; }
  const activeEnd = currentMatch?.query === query ? currentMatch.start + query.length : editor.model.carets[0].head;
  let index = matches.findIndex(at => at >= activeEnd); if (index < 0) index = 0;
  currentMatch = { query, start: matches[index], index };
  editor.model.breakTyping();
  editor.model.carets = [{ anchor: matches[index], head: matches[index] + query.length, goal: null }];
  editor.changed(); editor.ensureVisible(matches[index]); ui.match.textContent = `${index + 1} of ${matches.length}`; $('editor').focus();
}

function replaceCurrent() {
  const query = ui.find.value;
  if (!query) { showMessage('Enter text to replace.'); return; }
  const [range] = editor.model.normalizedRanges();
  if (!range || editor.model.text.slice(range.start, range.end) !== query) { findNext(); return; }
  editor.model.replaceRanges(ui.replace.value, 'replace-current'); currentMatch = { query, start: range.start - query.length, index: -1 };
  editor.changed(); findNext();
}

function replaceAll() {
  const query = ui.find.value;
  if (!query) { showMessage('Enter text to replace.'); return; }
  const count = editor.model.replaceAll(query, ui.replace.value);
  currentMatch = null; editor.changed();
  ui.match.textContent = count ? `${count} replaced` : 'No matches';
  showMessage(count ? `Replaced ${count} ${count === 1 ? 'match' : 'matches'} as one undoable edit.` : `No matches for “${query}”.`, count ? 'info' : 'error');
}

async function openHistory() {
  if (!documentInfo) return;
  ui.history.hidden = false; ui.list.textContent = 'Loading…'; ui.preview.hidden = true;
  try {
    const data = await api(`/api/documents/${encodeURIComponent(documentInfo.id)}/revisions`);
    ui.list.textContent = '';
    for (const item of data.revisions) {
      const row = document.createElement('div'); row.className = 'revision-item';
      const label = document.createElement('div');
      const strong = document.createElement('strong'); strong.textContent = `Revision ${item.revision}${item.revision === documentInfo.revision ? ' · current' : ''}`;
      const time = document.createElement('span'); time.textContent = new Date(item.createdAt).toLocaleString();
      label.append(strong, time);
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Preview'; button.addEventListener('click', () => preview(item.revision));
      row.append(label, button); ui.list.append(row);
    }
  } catch (error) { ui.list.textContent = ''; showMessage(`Could not load revision history: ${error.message}`); }
}

async function preview(revision) {
  try {
    const data = await api(`/api/documents/${encodeURIComponent(documentInfo.id)}/revisions/${revision}`);
    previewRevision = data; ui.previewTitle.textContent = `Revision ${revision}`; ui.previewContent.textContent = data.content; ui.preview.hidden = false;
  } catch (error) { showMessage(`Could not preview revision: ${error.message}`); }
}

function restoreDraft() {
  if (!previewRevision) return;
  editor.model.loadDraft(previewRevision.content); editor.changed(); editor.ensureVisible(0);
  ui.history.hidden = true; showMessage(`Revision ${previewRevision.revision} loaded as an unsaved draft. Undo returns to your previous draft.`, 'info'); $('editor').focus();
}

ui.save.addEventListener('click', save);
ui.undo.addEventListener('click', () => { editor.model.undo(); editor.changed(); editor.ensureVisible(); $('editor').focus(); });
ui.redo.addEventListener('click', () => { editor.model.redo(); editor.changed(); editor.ensureVisible(); $('editor').focus(); });
ui.findButton.addEventListener('click', findNext); ui.replaceButton.addEventListener('click', replaceCurrent); ui.replaceAll.addEventListener('click', replaceAll);
ui.find.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); findNext(); } });
$('history-button').addEventListener('click', openHistory); $('history-close').addEventListener('click', () => { ui.history.hidden = true; }); ui.restore.addEventListener('click', restoreDraft);
window.addEventListener('beforeunload', event => { if (documentInfo && editor.model.text !== savedContent) { event.preventDefault(); event.returnValue = ''; } });
load();

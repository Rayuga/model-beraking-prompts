(() => {
  const $ = id => document.getElementById(id);
  const state = { document: null, savedContent: '', previewRevision: null, draftBeforePreview: null, currentMatch: -1 };
  const editor = new PatchEditor($('editor'), {
    onChange: () => { updateStatus(); updateFindStatus(); },
    onCursor: ({ line, column, carets }) => {
      $('position-status').textContent = `Line ${line}, Column ${column}${carets > 1 ? ` · ${carets} carets` : ''}`;
    }
  });

  async function api(url, options) {
    const response = await fetch(url, options);
    let data;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
      const error = new Error(data.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function showMessage(text, info = false) {
    $('message').textContent = text;
    $('message').className = info ? 'info' : '';
    $('message').hidden = !text;
  }

  function updateStatus() {
    if (!state.document) return;
    const dirty = !state.previewRevision && editor.getText() !== state.savedContent;
    $('save-status').textContent = state.previewRevision ? 'Preview (read-only)' : dirty ? 'Dirty — unsaved' : 'Saved';
    $('save-status').className = dirty ? 'dirty' : 'saved';
    $('revision-status').textContent = `Revision ${state.document.revision}`;
    $('save-button').disabled = Boolean(state.previewRevision) || !dirty;
    $('undo-button').disabled = editor.readOnly || !editor.canUndo();
    $('redo-button').disabled = editor.readOnly || !editor.canRedo();
    $('replace-button').disabled = editor.readOnly;
    $('replace-all-button').disabled = editor.readOnly;
  }

  function matches() {
    const needle = $('find-input').value;
    if (!needle) return [];
    const result = [];
    let from = 0;
    while (from <= editor.getText().length) {
      const index = editor.getText().indexOf(needle, from);
      if (index < 0) break;
      result.push({ start: index, end: index + needle.length });
      from = index + Math.max(1, needle.length);
    }
    return result;
  }

  function updateFindStatus() {
    const found = matches();
    if (!found.length) {
      state.currentMatch = -1;
      $('find-status').textContent = $('find-input').value ? 'No matches' : '';
    } else {
      if (state.currentMatch >= found.length) state.currentMatch = -1;
      $('find-status').textContent = state.currentMatch >= 0 ? `${state.currentMatch + 1} of ${found.length}` : `${found.length} matches`;
    }
  }

  function findNext() {
    const found = matches();
    if (!found.length) { updateFindStatus(); showMessage($('find-input').value ? 'No matches found.' : 'Enter text to find.'); return; }
    const selection = editor.getSelection();
    const after = Math.max(selection.anchor, selection.head);
    let index = found.findIndex(match => match.start >= after && !(match.start === Math.min(selection.anchor, selection.head) && match.end === after));
    if (index < 0) index = 0;
    state.currentMatch = index;
    editor.setSelection(found[index].start, found[index].end);
    updateFindStatus(); showMessage(''); editor.root.focus();
  }

  function replaceCurrent() {
    const needle = $('find-input').value;
    if (!needle) return showMessage('Enter text to find before replacing.');
    const selection = editor.getSelection();
    const start = Math.min(selection.anchor, selection.head), end = Math.max(selection.anchor, selection.head);
    if (editor.getText().slice(start, end) !== needle) {
      findNext();
      return;
    }
    editor.replaceRanges([{ start, end }], $('replace-input').value);
    state.currentMatch = -1;
    updateFindStatus(); editor.root.focus();
  }

  function replaceAll() {
    const found = matches();
    if (!found.length) return showMessage($('find-input').value ? 'No matches to replace.' : 'Enter text to find before replacing.');
    editor.replaceRanges(found, $('replace-input').value);
    state.currentMatch = -1;
    showMessage(`Replaced ${found.length} matches.`, true);
    updateFindStatus(); editor.root.focus();
  }

  async function save() {
    if (state.previewRevision) return showMessage('Return to the editor before saving.');
    try {
      const result = await api(`/api/documents/${encodeURIComponent(state.document.id)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: state.document.id, baseRevision: state.document.revision, content: editor.getText() })
      });
      state.document = result.document;
      state.savedContent = result.document.content;
      showMessage(result.unchanged ? 'No changes to save.' : `Saved revision ${result.document.revision}.`, true);
      updateStatus(); await loadRevisions();
    } catch (error) {
      showMessage(error.status === 409
        ? `${error.message}. Your edits remain unsaved. Reload to view the newer saved revision, then reapply your changes.`
        : error.message);
      updateStatus();
    }
  }

  async function loadRevisions() {
    try {
      const revisions = await api(`/api/documents/${encodeURIComponent(state.document.id)}/revisions`);
      $('revision-list').replaceChildren(...revisions.map(item => {
        const li = document.createElement('li');
        const time = document.createElement('time');
        time.dateTime = item.createdAt;
        time.textContent = new Date(item.createdAt).toLocaleString();
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `Preview revision ${item.revision}`;
        button.addEventListener('click', () => preview(item.revision));
        li.append(`Revision ${item.revision} · `, time, button);
        return li;
      }));
    } catch (error) { showMessage(error.message); }
  }

  async function preview(revision) {
    try {
      const historical = await api(`/api/documents/${encodeURIComponent(state.document.id)}/revisions/${revision}`);
      if (!state.previewRevision) state.draftBeforePreview = editor.getText();
      state.previewRevision = historical.revision;
      editor.readOnly = true;
      editor.setText(historical.content, { silent: true });
      $('preview-number').textContent = historical.revision;
      $('preview-banner').hidden = false;
      updateStatus(); showMessage(`Previewing saved revision ${revision}.`, true);
    } catch (error) { showMessage(error.message); }
  }

  function exitPreview() {
    if (!state.previewRevision) return;
    editor.readOnly = false;
    editor.setText(state.draftBeforePreview, { silent: true });
    state.previewRevision = null;
    state.draftBeforePreview = null;
    $('preview-banner').hidden = true;
    updateStatus(); showMessage('Returned to your editing draft.', true);
  }

  async function restorePreview() {
    if (!state.previewRevision) return showMessage('Choose a revision to preview first.');
    const revision = state.previewRevision;
    try {
      const result = await api(`/api/documents/${encodeURIComponent(state.document.id)}/restore`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: state.document.id, baseRevision: state.document.revision, revision })
      });
      state.document = result.document;
      state.savedContent = result.document.content;
      state.previewRevision = null;
      state.draftBeforePreview = null;
      editor.readOnly = false;
      editor.setText(result.document.content, { silent: true });
      $('preview-banner').hidden = true;
      showMessage(result.unchanged ? `Revision ${revision} already matches current content; no revision was added.` : `Restored revision ${revision} as new revision ${result.document.revision}.`, true);
      updateStatus(); await loadRevisions();
    } catch (error) {
      showMessage(error.status === 409 ? `${error.message}. Restore was refused because a newer revision exists.` : error.message);
    }
  }

  async function initialize() {
    try {
      const documents = await api('/api/documents');
      if (!documents.length) throw new Error('No documents are available.');
      state.document = await api(`/api/documents/${encodeURIComponent(documents[0].id)}`);
      state.savedContent = state.document.content;
      $('document-title').textContent = state.document.title;
      editor.setText(state.document.content, { silent: true });
      updateStatus(); await loadRevisions();
    } catch (error) { showMessage(`Unable to open PatchPad: ${error.message}`); }
  }

  $('save-button').addEventListener('click', save);
  $('undo-button').addEventListener('click', () => { editor.undo(); updateStatus(); editor.root.focus(); });
  $('redo-button').addEventListener('click', () => { editor.redo(); updateStatus(); editor.root.focus(); });
  $('find-next-button').addEventListener('click', findNext);
  $('replace-button').addEventListener('click', replaceCurrent);
  $('replace-all-button').addEventListener('click', replaceAll);
  $('find-input').addEventListener('input', () => { state.currentMatch = -1; updateFindStatus(); });
  $('find-input').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); findNext(); } });
  $('exit-preview-button').addEventListener('click', exitPreview);
  $('restore-button').addEventListener('click', restorePreview);
  document.addEventListener('keydown', event => {
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); save(); }
    if (mod && event.key.toLowerCase() === 'f' && document.activeElement === editor.root) { event.preventDefault(); $('find-input').focus(); $('find-input').select(); }
    queueMicrotask(updateStatus);
  });
  window.addEventListener('beforeunload', event => {
    if (state.document && !state.previewRevision && editor.getText() !== state.savedContent) event.preventDefault();
  });

  initialize();
})();

// PatchPad Editor - Custom DOM-based text editor
class TextEditor {
  constructor() {
    this.editorInput = document.getElementById('editor');
    this.editorDisplay = document.getElementById('editorDisplay');
    this.editorContent = document.getElementById('editorContent');
    this.lineNumbersEl = document.getElementById('lineNumbers');
    this.statusEl = document.getElementById('statusText');
    this.revisionEl = document.getElementById('revisionText');
    this.cursorInfoEl = document.getElementById('cursorInfo');
    this.saveStatusEl = document.getElementById('saveStatus');

    // Content state
    this.text = '';
    this.currentDocument = null;
    this.baseRevision = null;

    // Edit history
    this.history = [];
    this.historyIndex = -1;
    this.isUndoRedo = false;
    this.lastAction = null;
    this.lastActionTime = 0;

    // Cursor and selection
    this.caretOffset = 0;
    this.selectionStart = -1;
    this.selectionEnd = -1;

    // Find/Replace
    this.findMatches = [];
    this.currentMatchIndex = -1;
    this.isModified = false;
    this.syncInProgress = false;

    // Caret visibility animation
    this.caretVisible = true;
    this.caretBlinkInterval = null;

    this.initializeEventListeners();
    this.loadDocument();
  }

  async loadDocument() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const docId = urlParams.get('doc') || 'incident-alpha';

      const response = await fetch(`/api/reports/${docId}`);
      if (!response.ok) {
        throw new Error('Failed to load document');
      }

      this.currentDocument = await response.json();
      this.baseRevision = this.currentDocument.currentRevision;
      this.text = this.currentDocument.content;

      // Update UI
      document.getElementById('reportTitle').textContent = this.currentDocument.title;
      document.getElementById('authorInfo').textContent = `By ${this.currentDocument.author}`;
      this.revisionEl.textContent = `Revision ${this.currentDocument.currentRevision}`;

      this.updateDisplay();
      this.updateLineNumbers();
      this.markSaved();
      this.startCaretBlink();
      this.editorInput.focus();
    } catch (err) {
      console.error('Failed to load document:', err);
      this.showError('Failed to load document');
    }
  }

  initializeEventListeners() {
    // Capture all keyboard input through hidden input
    this.editorInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.editorInput.addEventListener('keyup', (e) => this.handleKeyUp(e));
    this.editorInput.addEventListener('input', (e) => this.handleInput(e));
    this.editorInput.addEventListener('paste', (e) => this.handlePaste(e));

    // Click to position caret in display area
    this.editorDisplay.addEventListener('click', (e) => this.handleDisplayClick(e));
    this.editorDisplay.addEventListener('mousedown', (e) => this.handleDisplayMouseDown(e));
    this.editorDisplay.addEventListener('mousemove', (e) => this.handleDisplayMouseMove(e));
    this.editorDisplay.addEventListener('mouseup', (e) => this.handleDisplayMouseUp(e));

    // Button events
    document.getElementById('saveBtn').addEventListener('click', () => this.save());
    document.getElementById('undoBtn').addEventListener('click', () => this.undo());
    document.getElementById('redoBtn').addEventListener('click', () => this.redo());
    document.getElementById('findNextBtn').addEventListener('click', () => this.findNext());
    document.getElementById('findPrevBtn').addEventListener('click', () => this.findPrev());
    document.getElementById('replaceCurrBtn').addEventListener('click', () => this.replaceCurrent());
    document.getElementById('replaceAllBtn').addEventListener('click', () => this.replaceAll());
    document.getElementById('historyBtn').addEventListener('click', () => this.toggleHistory());
    document.getElementById('closeHistoryBtn').addEventListener('click', () => this.toggleHistory());

    // Find input events
    const findInput = document.getElementById('findInput');
    findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.shiftKey ? this.findPrev() : this.findNext();
      } else if (e.key === 'Escape') {
        this.editorInput.focus();
      }
    });
    findInput.addEventListener('input', () => this.updateFind());

    // Conflict modal
    document.getElementById('discardBtn').addEventListener('click', () => this.reloadDocument());
    document.getElementById('reloadBtn').addEventListener('click', () => window.location.reload());

    // Click on editor content to focus
    this.editorDisplay.addEventListener('click', () => {
      this.editorInput.focus();
    });
  }

  handleKeyDown(e) {
    // Clear input after handling
    const key = e.key;
    const ctrlOrCmd = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // Text input (regular characters)
    if (!ctrlOrCmd && !e.altKey && e.key.length === 1) {
      e.preventDefault();
      this.insertChar(e.key);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      this.insertChar('\n');
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      this.insertChar('\t');
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      this.backspace();
      return;
    }

    if (e.key === 'Delete') {
      e.preventDefault();
      this.delete();
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (ctrlOrCmd) {
        this.moveToNextWord(shift);
      } else if (shift) {
        this.extendSelectionRight();
      } else {
        this.moveRight();
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (ctrlOrCmd) {
        this.moveToPrevWord(shift);
      } else if (shift) {
        this.extendSelectionLeft();
      } else {
        this.moveLeft();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (shift) {
        this.extendSelectionUp();
      } else {
        this.moveUp();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (shift) {
        this.extendSelectionDown();
      } else {
        this.moveDown();
      }
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      this.moveToLineStart(shift);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      this.moveToLineEnd(shift);
      return;
    }

    if (ctrlOrCmd && e.key === 's') {
      e.preventDefault();
      this.save();
      return;
    }

    if (ctrlOrCmd && e.key === 'z' && !shift) {
      e.preventDefault();
      this.undo();
      return;
    }

    if ((ctrlOrCmd && e.key === 'y') || (ctrlOrCmd && shift && e.key === 'z')) {
      e.preventDefault();
      this.redo();
      return;
    }

    if (ctrlOrCmd && e.key === 'f') {
      e.preventDefault();
      document.getElementById('findInput').focus();
      document.getElementById('findInput').select();
      return;
    }

    if (ctrlOrCmd && e.key === 'h') {
      e.preventDefault();
      document.getElementById('replaceInput').focus();
      return;
    }

    if (ctrlOrCmd && e.key === 'a') {
      e.preventDefault();
      this.selectAll();
      return;
    }

    if (ctrlOrCmd && e.key === 'c') {
      e.preventDefault();
      this.copy();
      return;
    }

    if (ctrlOrCmd && e.key === 'x') {
      e.preventDefault();
      this.cut();
      return;
    }

    if (ctrlOrCmd && e.key === 'v') {
      e.preventDefault();
      this.paste();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      this.clearSelection();
      document.getElementById('findInput').focus();
      return;
    }
  }

  handleKeyUp(e) {
    this.updateCaretInfo();
  }

  handleInput(e) {
    // Clear the input
    this.editorInput.value = '';
  }

  async handlePaste(e) {
    e.preventDefault();
    try {
      const text = await navigator.clipboard.readText();
      this.insertChar(text);
    } catch (err) {
      console.error('Paste failed:', err);
    }
  }

  handleDisplayClick(e) {
    const offset = this.getOffsetFromClick(e);
    this.caretOffset = offset;
    this.clearSelection();
    this.updateDisplay();
    this.editorInput.focus();
  }

  handleDisplayMouseDown(e) {
    this.mouseDownOffset = this.getOffsetFromClick(e);
    this.selectionStart = this.mouseDownOffset;
    this.selectionEnd = this.mouseDownOffset;
    this.caretOffset = this.mouseDownOffset;
  }

  handleDisplayMouseMove(e) {
    if (typeof this.mouseDownOffset !== 'number') return;
    const offset = this.getOffsetFromClick(e);
    this.selectionEnd = offset;
    if (this.selectionStart > this.selectionEnd) {
      [this.selectionStart, this.selectionEnd] = [this.selectionEnd, this.selectionStart];
    }
    this.caretOffset = offset;
    this.updateDisplay();
  }

  handleDisplayMouseUp(e) {
    delete this.mouseDownOffset;
  }

  getOffsetFromClick(e) {
    const rect = this.editorDisplay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const lines = this.text.split('\n');
    let offset = 0;
    const lineHeight = parseFloat(getComputedStyle(this.editorDisplay).lineHeight);
    const charWidth = 8;

    let lineNum = Math.floor((y + this.editorContent.scrollTop) / lineHeight);
    lineNum = Math.max(0, Math.min(lineNum, lines.length - 1));

    for (let i = 0; i < lineNum; i++) {
      offset += lines[i].length + 1;
    }

    const charPos = Math.round((x + this.editorContent.scrollLeft) / charWidth);
    const lineLength = lines[lineNum].length;
    offset += Math.max(0, Math.min(charPos, lineLength));

    return Math.min(offset, this.text.length);
  }

  insertChar(char) {
    if (this.selectionStart !== -1 && this.selectionEnd !== -1) {
      const start = Math.min(this.selectionStart, this.selectionEnd);
      const end = Math.max(this.selectionStart, this.selectionEnd);
      this.text = this.text.slice(0, start) + char + this.text.slice(end);
      this.caretOffset = start + char.length;
      this.clearSelection();
    } else {
      this.text = this.text.slice(0, this.caretOffset) + char + this.text.slice(this.caretOffset);
      this.caretOffset += char.length;
    }

    this.recordEdit();
    this.updateDisplay();
    this.updateLineNumbers();
    this.markModified();
  }

  backspace() {
    if (this.selectionStart !== -1 && this.selectionEnd !== -1) {
      const start = Math.min(this.selectionStart, this.selectionEnd);
      this.text = this.text.slice(0, start) + this.text.slice(Math.max(this.selectionStart, this.selectionEnd));
      this.caretOffset = start;
      this.clearSelection();
    } else if (this.caretOffset > 0) {
      this.text = this.text.slice(0, this.caretOffset - 1) + this.text.slice(this.caretOffset);
      this.caretOffset--;
    }

    this.recordEdit();
    this.updateDisplay();
    this.updateLineNumbers();
    this.markModified();
  }

  delete() {
    if (this.selectionStart !== -1 && this.selectionEnd !== -1) {
      const start = Math.min(this.selectionStart, this.selectionEnd);
      this.text = this.text.slice(0, start) + this.text.slice(Math.max(this.selectionStart, this.selectionEnd));
      this.caretOffset = start;
      this.clearSelection();
    } else if (this.caretOffset < this.text.length) {
      this.text = this.text.slice(0, this.caretOffset) + this.text.slice(this.caretOffset + 1);
    }

    this.recordEdit();
    this.updateDisplay();
    this.updateLineNumbers();
    this.markModified();
  }

  moveRight() {
    this.caretOffset = Math.min(this.caretOffset + 1, this.text.length);
    this.clearSelection();
    this.updateDisplay();
  }

  moveLeft() {
    this.caretOffset = Math.max(this.caretOffset - 1, 0);
    this.clearSelection();
    this.updateDisplay();
  }

  moveUp() {
    const lineStart = this.text.lastIndexOf('\n', this.caretOffset - 1) + 1;
    if (lineStart === 0) return;

    const colInLine = this.caretOffset - lineStart;
    const prevLineStart = this.text.lastIndexOf('\n', lineStart - 2) + 1;
    const prevLineEnd = lineStart - 1;
    const prevLineLength = prevLineEnd - prevLineStart;

    this.caretOffset = prevLineStart + Math.min(colInLine, prevLineLength);
    this.clearSelection();
    this.updateDisplay();
  }

  moveDown() {
    const lineStart = this.text.lastIndexOf('\n', this.caretOffset - 1) + 1;
    const lineEnd = this.text.indexOf('\n', this.caretOffset);
    const actualLineEnd = lineEnd === -1 ? this.text.length : lineEnd;

    if (actualLineEnd === this.text.length) return;

    const colInLine = this.caretOffset - lineStart;
    const nextLineStart = actualLineEnd + 1;
    const nextLineEnd = this.text.indexOf('\n', nextLineStart);
    const actualNextLineEnd = nextLineEnd === -1 ? this.text.length : nextLineEnd;
    const nextLineLength = actualNextLineEnd - nextLineStart;

    this.caretOffset = nextLineStart + Math.min(colInLine, nextLineLength);
    this.clearSelection();
    this.updateDisplay();
  }

  moveToLineStart(select) {
    const lineStart = this.text.lastIndexOf('\n', this.caretOffset - 1) + 1;
    if (select) {
      if (this.selectionStart === -1) {
        this.selectionStart = this.caretOffset;
      }
      this.selectionEnd = lineStart;
    } else {
      this.clearSelection();
    }
    this.caretOffset = lineStart;
    this.updateDisplay();
  }

  moveToLineEnd(select) {
    const lineEnd = this.text.indexOf('\n', this.caretOffset);
    const actualLineEnd = lineEnd === -1 ? this.text.length : lineEnd;
    if (select) {
      if (this.selectionStart === -1) {
        this.selectionStart = this.caretOffset;
      }
      this.selectionEnd = actualLineEnd;
    } else {
      this.clearSelection();
    }
    this.caretOffset = actualLineEnd;
    this.updateDisplay();
  }

  moveToNextWord(select) {
    let offset = this.caretOffset;
    while (offset < this.text.length && /\w/.test(this.text[offset])) offset++;
    while (offset < this.text.length && /\s/.test(this.text[offset])) offset++;

    if (select) {
      if (this.selectionStart === -1) {
        this.selectionStart = this.caretOffset;
      }
      this.selectionEnd = offset;
    } else {
      this.clearSelection();
    }
    this.caretOffset = offset;
    this.updateDisplay();
  }

  moveToPrevWord(select) {
    let offset = this.caretOffset - 1;
    if (offset < 0) return;

    while (offset >= 0 && /\s/.test(this.text[offset])) offset--;
    while (offset >= 0 && /\w/.test(this.text[offset])) offset--;
    offset++;

    if (select) {
      if (this.selectionStart === -1) {
        this.selectionStart = this.caretOffset;
      }
      this.selectionEnd = offset;
    } else {
      this.clearSelection();
    }
    this.caretOffset = offset;
    this.updateDisplay();
  }

  extendSelectionRight() {
    if (this.selectionStart === -1) {
      this.selectionStart = this.caretOffset;
      this.selectionEnd = this.caretOffset + 1;
    } else {
      this.selectionEnd++;
    }
    this.caretOffset = this.selectionEnd;
    this.updateDisplay();
  }

  extendSelectionLeft() {
    if (this.selectionStart === -1) {
      this.selectionStart = this.caretOffset;
      this.selectionEnd = this.caretOffset - 1;
    } else {
      this.selectionEnd--;
    }
    this.caretOffset = this.selectionEnd;
    this.updateDisplay();
  }

  extendSelectionUp() {
    this.updateDisplay();
  }

  extendSelectionDown() {
    this.updateDisplay();
  }

  selectAll() {
    this.selectionStart = 0;
    this.selectionEnd = this.text.length;
    this.caretOffset = this.text.length;
    this.updateDisplay();
  }

  clearSelection() {
    this.selectionStart = -1;
    this.selectionEnd = -1;
  }

  copy() {
    if (this.selectionStart !== -1 && this.selectionEnd !== -1) {
      const start = Math.min(this.selectionStart, this.selectionEnd);
      const end = Math.max(this.selectionStart, this.selectionEnd);
      const selectedText = this.text.slice(start, end);
      navigator.clipboard.writeText(selectedText).catch(err => console.error('Copy failed:', err));
    }
  }

  cut() {
    if (this.selectionStart !== -1 && this.selectionEnd !== -1) {
      this.copy();
      const start = Math.min(this.selectionStart, this.selectionEnd);
      const end = Math.max(this.selectionStart, this.selectionEnd);
      this.text = this.text.slice(0, start) + this.text.slice(end);
      this.caretOffset = start;
      this.clearSelection();
      this.recordEdit();
      this.updateDisplay();
      this.updateLineNumbers();
      this.markModified();
    }
  }

  paste() {
    navigator.clipboard.readText()
      .then(text => this.insertChar(text))
      .catch(err => console.error('Paste failed:', err));
  }

  recordEdit() {
    if (this.isUndoRedo) {
      this.isUndoRedo = false;
      return;
    }

    const now = Date.now();
    const canGroup = this.lastAction === 'typing' && (now - this.lastActionTime) < 500;

    if (canGroup && this.historyIndex < this.history.length - 1) {
      this.history[this.historyIndex] = this.text;
    } else {
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(this.text);
      this.historyIndex++;
    }

    this.lastAction = 'typing';
    this.lastActionTime = now;

    document.getElementById('undoBtn').disabled = this.historyIndex <= 0;
    document.getElementById('redoBtn').disabled = this.historyIndex >= this.history.length - 1;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.isUndoRedo = true;
      this.text = this.history[this.historyIndex];
      this.clearSelection();
      this.updateDisplay();
      this.updateLineNumbers();
      this.markModified();

      document.getElementById('undoBtn').disabled = this.historyIndex <= 0;
      document.getElementById('redoBtn').disabled = false;
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.isUndoRedo = true;
      this.text = this.history[this.historyIndex];
      this.clearSelection();
      this.updateDisplay();
      this.updateLineNumbers();
      this.markModified();

      document.getElementById('undoBtn').disabled = false;
      document.getElementById('redoBtn').disabled = this.historyIndex >= this.history.length - 1;
    }
  }

  updateDisplay() {
    const lines = this.text.split('\n');
    let html = '';

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const lineStartOffset = lines.slice(0, lineIdx).reduce((sum, l) => sum + l.length + 1, 0);

      for (let charIdx = 0; charIdx < line.length; charIdx++) {
        const offset = lineStartOffset + charIdx;
        const char = line[charIdx];
        let charHtml = this.escapeHtml(char);

        if (char === '\t') {
          charHtml = '<span class="tab">  </span>';
        }

        // Check if in selection
        if (this.selectionStart !== -1 && this.selectionEnd !== -1) {
          const start = Math.min(this.selectionStart, this.selectionEnd);
          const end = Math.max(this.selectionStart, this.selectionEnd);
          if (offset >= start && offset < end) {
            charHtml = `<span class="selection">${charHtml}</span>`;
          }
        }

        // Check if find match
        for (let m = 0; m < this.findMatches.length; m++) {
          const match = this.findMatches[m];
          if (offset >= match.index && offset < match.index + match.length) {
            const isCurrent = m === this.currentMatchIndex;
            charHtml = `<span class="find-match${isCurrent ? ' current' : ''}">${charHtml}</span>`;
            break;
          }
        }

        // Add caret
        if (offset === this.caretOffset && this.caretVisible) {
          charHtml = `<span class="caret">${charHtml}</span>`;
        }

        html += charHtml;
      }

      // Caret at end of line
      if (this.caretOffset === lineStartOffset + line.length && this.caretVisible) {
        html += '<span class="caret">|</span>';
      }

      if (lineIdx < lines.length - 1) {
        html += '\n';
      }
    }

    // Caret at very end
    if (this.text.length === 0 && this.caretOffset === 0 && this.caretVisible) {
      html = '<span class="caret">|</span>';
    }

    this.editorDisplay.innerHTML = html;
  }

  escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  updateLineNumbers() {
    const lines = this.text.split('\n');
    let html = '';
    for (let i = 1; i <= lines.length; i++) {
      html += i + '\n';
    }
    this.lineNumbersEl.textContent = html;
  }

  updateCaretInfo() {
    const beforeCaret = this.text.slice(0, this.caretOffset);
    const lines = beforeCaret.split('\n');
    const lineNum = lines.length;
    const col = lines[lines.length - 1].length + 1;

    this.cursorInfoEl.textContent = `Line ${lineNum}, Column ${col}`;
  }

  updateFind() {
    const query = document.getElementById('findInput').value;
    if (!query) {
      this.findMatches = [];
      this.currentMatchIndex = -1;
      document.getElementById('matchCount').textContent = '';
      this.updateDisplay();
      return;
    }

    const regex = new RegExp(this.escapeRegex(query), 'g');
    this.findMatches = [];

    let match;
    while ((match = regex.exec(this.text)) !== null) {
      this.findMatches.push({ index: match.index, length: match[0].length });
    }

    document.getElementById('matchCount').textContent = 
      `${this.findMatches.length} match${this.findMatches.length !== 1 ? 'es' : ''}`;

    this.updateDisplay();
  }

  findNext() {
    if (this.findMatches.length === 0) return;

    this.currentMatchIndex = (this.currentMatchIndex + 1) % this.findMatches.length;
    const match = this.findMatches[this.currentMatchIndex];
    this.selectionStart = match.index;
    this.selectionEnd = match.index + match.length;
    this.caretOffset = match.index + match.length;
    this.updateDisplay();
    this.editorInput.focus();
  }

  findPrev() {
    if (this.findMatches.length === 0) return;

    this.currentMatchIndex = (this.currentMatchIndex - 1 + this.findMatches.length) % this.findMatches.length;
    const match = this.findMatches[this.currentMatchIndex];
    this.selectionStart = match.index;
    this.selectionEnd = match.index + match.length;
    this.caretOffset = match.index + match.length;
    this.updateDisplay();
    this.editorInput.focus();
  }

  replaceCurrent() {
    if (this.currentMatchIndex === -1 || this.findMatches.length === 0) return;

    const match = this.findMatches[this.currentMatchIndex];
    const replaceText = document.getElementById('replaceInput').value;

    this.text = this.text.slice(0, match.index) + replaceText + this.text.slice(match.index + match.length);
    this.caretOffset = match.index + replaceText.length;
    this.clearSelection();
    this.recordEdit();
    this.updateDisplay();
    this.updateLineNumbers();
    this.markModified();

    this.updateFind();
    if (this.findMatches.length > 0) {
      this.findNext();
    }
  }

  replaceAll() {
    if (this.findMatches.length === 0) return;

    const query = document.getElementById('findInput').value;
    const replaceText = document.getElementById('replaceInput').value;

    this.text = this.text.replace(new RegExp(this.escapeRegex(query), 'g'), replaceText);
    this.clearSelection();
    this.recordEdit();
    this.updateDisplay();
    this.updateLineNumbers();
    this.markModified();

    this.updateFind();
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  toggleHistory() {
    const panel = document.getElementById('historyPanel');
    if (panel.style.display === 'none') {
      panel.style.display = 'flex';
      this.displayHistory();
    } else {
      panel.style.display = 'none';
    }
  }

  displayHistory() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';

    const revisions = this.currentDocument.revisions || [];
    revisions.forEach(rev => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const revNum = document.createElement('div');
      revNum.className = 'history-item-revision';
      revNum.textContent = `Revision ${rev.revision}`;

      const timestamp = document.createElement('div');
      timestamp.className = 'history-item-timestamp';
      const date = new Date(rev.timestamp);
      timestamp.textContent = date.toLocaleString();

      const buttons = document.createElement('div');
      buttons.className = 'history-item-buttons';

      const previewBtn = document.createElement('button');
      previewBtn.className = 'btn btn-sm';
      previewBtn.textContent = 'Preview';
      previewBtn.addEventListener('click', () => this.previewRevision(rev.revision));

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'btn btn-sm';
      restoreBtn.textContent = 'Restore';
      restoreBtn.addEventListener('click', () => this.restoreRevision(rev.revision));

      buttons.appendChild(previewBtn);
      buttons.appendChild(restoreBtn);

      item.appendChild(revNum);
      item.appendChild(timestamp);
      item.appendChild(buttons);

      historyList.appendChild(item);
    });
  }

  async previewRevision(revision) {
    try {
      const response = await fetch(`/api/reports/${this.currentDocument.id}/revisions/${revision}`);
      const data = await response.json();

      const modal = document.getElementById('previewModal');
      const content = document.getElementById('previewContent');
      content.textContent = data.content;
      modal.style.display = 'flex';
    } catch (err) {
      this.showError('Failed to load revision');
    }
  }

  restoreRevision(revision) {
    const closePreview = () => {
      document.getElementById('previewModal').style.display = 'none';
    };

    fetch(`/api/reports/${this.currentDocument.id}/revisions/${revision}`)
      .then(r => r.json())
      .then(data => {
        closePreview();
        this.text = data.content;
        this.recordEdit();
        this.caretOffset = 0;
        this.clearSelection();
        this.updateDisplay();
        this.updateLineNumbers();
        this.markModified();
        this.showMessage(`Restored revision ${revision} as unsaved changes`);
      })
      .catch(err => this.showError('Failed to restore revision'));
  }

  async save() {
    if (this.syncInProgress) return;

    const content = this.text;
    const currentDoc = this.currentDocument.content;

    if (content === currentDoc) {
      this.showMessage('No changes to save');
      return;
    }

    this.syncInProgress = true;
    document.getElementById('saveBtn').disabled = true;

    try {
      const response = await fetch(`/api/reports/${this.currentDocument.id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          baseRevision: this.baseRevision,
          documentId: this.currentDocument.id
        })
      });

      const data = await response.json();

      if (response.status === 409) {
        this.showConflict(data.currentRevision);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Save failed');
      }

      this.currentDocument.currentRevision = data.revision;
      this.baseRevision = data.revision;
      this.currentDocument.content = content;
      this.revisionEl.textContent = `Revision ${data.revision}`;
      this.markSaved();
      this.showMessage('Saved successfully');

      this.loadDocument();
    } catch (err) {
      this.showError(err.message || 'Save failed');
    } finally {
      this.syncInProgress = false;
      document.getElementById('saveBtn').disabled = false;
    }
  }

  async reloadDocument() {
    try {
      const response = await fetch(`/api/reports/${this.currentDocument.id}`);
      const doc = await response.json();

      this.currentDocument = doc;
      this.baseRevision = doc.currentRevision;
      this.text = doc.content;
      this.caretOffset = 0;
      this.clearSelection();
      this.updateDisplay();
      this.updateLineNumbers();
      this.markSaved();

      document.getElementById('conflictModal').style.display = 'none';
      this.showMessage('Document reloaded from server');
    } catch (err) {
      this.showError('Failed to reload document');
    }
  }

  showConflict(serverRevision) {
    this.saveStatusEl.classList.add('error');
    this.statusEl.textContent = 'Conflict: Save rejected';
    document.getElementById('conflictModal').style.display = 'flex';
  }

  markModified() {
    this.isModified = true;
    this.saveStatusEl.classList.add('unsaved');
    this.statusEl.textContent = 'Unsaved changes';
  }

  markSaved() {
    this.isModified = false;
    this.saveStatusEl.classList.remove('unsaved', 'error');
    this.statusEl.textContent = 'Saved';
  }

  startCaretBlink() {
    if (this.caretBlinkInterval) return;

    this.caretBlinkInterval = setInterval(() => {
      this.caretVisible = !this.caretVisible;
      this.updateDisplay();
    }, 500);
  }

  showMessage(message) {
    const statusBar = document.getElementById('statusBar');
    statusBar.textContent = message;
    setTimeout(() => {
      if (statusBar.textContent === message) {
        statusBar.textContent = '';
      }
    }, 3000);
  }

  showError(message) {
    const statusBar = document.getElementById('statusBar');
    statusBar.textContent = '✗ ' + message;
    statusBar.style.color = 'var(--color-error)';
    setTimeout(() => {
      statusBar.textContent = '';
      statusBar.style.color = '';
    }, 5000);
  }
}

// Initialize editor
let editor;
document.addEventListener('DOMContentLoaded', () => {
  editor = new TextEditor();
});

function closePreview() {
  document.getElementById('previewModal').style.display = 'none';
}

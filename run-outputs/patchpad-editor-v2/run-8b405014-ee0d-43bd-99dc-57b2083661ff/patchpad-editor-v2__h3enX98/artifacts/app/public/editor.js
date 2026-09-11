class PatchPadEditor {
  constructor() {
    this.documentId = 'incident-alpha';
    this.content = '';
    this.currentRevision = 1;
    this.baseRevision = 1;
    this.isSaved = true;
    this.lines = [];
    
    // Cursor and selection
    this.carets = [{ pos: 0, anchor: 0 }]; // Array of {pos, anchor}
    this.mouseDown = false;
    this.dragStart = null;
    
    // Undo/Redo
    this.history = [];
    this.historyIndex = -1;
    this.lastTypedPos = null;
    this.lastTypedTime = 0;
    
    // Find/Replace
    this.findQuery = '';
    this.findMatches = [];
    this.findCurrentIndex = -1;
    this.replaceQuery = '';
    this.showReplace = false;
    
    // Preview state
    this.previewRevision = null;
    this.previewContent = '';
    
    // Conflict state
    this.hasConflict = false;
    this.conflictDraft = '';
    
    this.initializeElements();
    this.attachEventListeners();
    this.loadDocument();
  }
  
  initializeElements() {
    // Main elements
    this.editorPane = document.getElementById('editor-pane');
    this.textContent = document.getElementById('text-content');
    this.editorInput = document.getElementById('editor-input');
    this.lineNumbers = document.getElementById('line-numbers');
    this.cursorLayer = document.getElementById('cursor-layer');
    
    // UI elements
    this.saveStatus = document.getElementById('save-status');
    this.revisionDisplay = document.getElementById('revision-display');
    this.cursorPosition = document.getElementById('cursor-position');
    this.reportTitle = document.getElementById('report-title');
    
    // Buttons
    this.btnSave = document.getElementById('btn-save');
    this.btnUndo = document.getElementById('btn-undo');
    this.btnRedo = document.getElementById('btn-redo');
    this.btnFindNext = document.getElementById('btn-find-next');
    this.btnFindPrev = document.getElementById('btn-find-prev');
    this.btnReplaceToggle = document.getElementById('btn-replace-toggle');
    this.btnReplaceOne = document.getElementById('btn-replace-one');
    this.btnReplaceAll = document.getElementById('btn-replace-all');
    
    // Find/Replace inputs
    this.findInput = document.getElementById('find-input');
    this.findCount = document.getElementById('find-count');
    this.replaceInput = document.getElementById('replace-input');
    this.replaceControls = document.getElementById('replace-controls');
    
    // Revision history
    this.revisionList = document.getElementById('revision-list');
    
    // Conflict notification
    this.conflictNotification = document.getElementById('conflict-notification');
    this.conflictMessage = document.getElementById('conflict-message');
    this.btnReload = document.getElementById('btn-reload');
    this.btnKeepDraft = document.getElementById('btn-keep-draft');
    
    // Preview modal
    this.previewModal = document.getElementById('preview-modal');
    this.previewTitle = document.getElementById('preview-title');
    this.previewBody = document.getElementById('preview-body');
    this.btnRestorePreview = document.getElementById('btn-restore-preview');
    this.btnCancelPreview = document.getElementById('btn-cancel-preview');
    this.btnClosePreview = document.getElementById('btn-close-preview');
  }
  
  attachEventListeners() {
    // Editor input
    this.editorPane.addEventListener('click', (e) => this.handleClick(e));
    this.editorPane.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.editorPane.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.editorPane.addEventListener('mouseup', () => this.handleMouseUp());
    this.editorPane.addEventListener('scroll', () => this.syncLineNumbers());
    
    this.editorInput.addEventListener('input', (e) => this.handleInput(e));
    this.editorInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.editorInput.addEventListener('keyup', () => this.updateCursor());
    
    // Focus management
    this.editorPane.addEventListener('keydown', (e) => {
      if (!this.hasConflict) {
        this.editorInput.focus();
        this.handleKeyDown(e);
      }
    });
    
    // Buttons
    this.btnSave.addEventListener('click', () => this.save());
    this.btnUndo.addEventListener('click', () => this.undo());
    this.btnRedo.addEventListener('click', () => this.redo());
    this.btnFindNext.addEventListener('click', () => this.findNext());
    this.btnFindPrev.addEventListener('click', () => this.findPrev());
    this.btnReplaceToggle.addEventListener('click', () => this.toggleReplace());
    this.btnReplaceOne.addEventListener('click', () => this.replaceOne());
    this.btnReplaceAll.addEventListener('click', () => this.replaceAll());
    
    // Find/Replace
    this.findInput.addEventListener('input', () => this.updateFind());
    this.findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.shiftKey ? this.findPrev() : this.findNext();
      } else if (e.key === 'Escape') {
        this.editorInput.focus();
      }
    });
    
    this.replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.replaceOne();
      }
    });
    
    // Conflict notification
    this.btnReload.addEventListener('click', () => this.reloadDocument());
    this.btnKeepDraft.addEventListener('click', () => this.dismissConflict());
    
    // Preview modal
    this.btnClosePreview.addEventListener('click', () => this.closePreview());
    this.btnCancelPreview.addEventListener('click', () => this.closePreview());
    this.btnRestorePreview.addEventListener('click', () => this.confirmRestore());
    
    // Focus editor on load
    this.editorPane.addEventListener('click', () => this.editorInput.focus());
  }
  
  async loadDocument() {
    try {
      const response = await fetch(`/api/documents/${this.documentId}`);
      if (!response.ok) throw new Error('Failed to load document');
      
      const doc = await response.json();
      this.content = doc.content;
      this.currentRevision = doc.currentRevision;
      this.baseRevision = doc.currentRevision;
      this.reportTitle.textContent = doc.title;
      
      // Initialize history with the current content
      this.history = [this.content];
      this.historyIndex = 0;
      
      this.updateContent();
      this.refreshRevisionHistory();
      this.editorInput.focus();
    } catch (error) {
      console.error('Error loading document:', error);
      alert('Failed to load document');
    }
  }
  
  updateContent() {
    this.lines = this.content.split('\n');
    this.render();
    this.updateCursor();
  }
  
  render() {
    // Update text content with proper highlighting
    this.renderText();
    
    // Update line numbers
    this.updateLineNumbers();
    
    // Update undo/redo buttons
    this.btnUndo.disabled = this.historyIndex <= 0;
    this.btnRedo.disabled = this.historyIndex >= this.history.length - 1;
  }
  
  renderText() {
    // Clear and rebuild text content with syntax highlighting for matches
    this.textContent.innerHTML = '';
    let html = '';
    let lastPos = 0;
    
    // Highlight find matches
    if (this.findQuery && this.findMatches.length > 0) {
      for (let i = 0; i < this.findMatches.length; i++) {
        const matchPos = this.findMatches[i];
        html += this.escapeHtml(this.content.slice(lastPos, matchPos));
        
        const isCurrent = i === this.findCurrentIndex;
        html += `<span class="find-match${isCurrent ? ' current' : ''}">${
          this.escapeHtml(this.content.slice(matchPos, matchPos + this.findQuery.length))
        }</span>`;
        
        lastPos = matchPos + this.findQuery.length;
      }
      html += this.escapeHtml(this.content.slice(lastPos));
    } else {
      html = this.escapeHtml(this.content);
    }
    
    this.textContent.innerHTML = html;
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  updateLineNumbers() {
    const numLines = this.lines.length;
    let html = '';
    for (let i = 1; i <= numLines; i++) {
      html += `<div class="line-number">${i}</div>`;
    }
    this.lineNumbers.innerHTML = html;
  }
  
  syncLineNumbers() {
    this.lineNumbers.scrollTop = this.editorPane.scrollTop;
  }
  
  handleClick(e) {
    if (this.isClickInTextArea(e)) {
      const pos = this.getPositionFromClick(e);
      if (pos !== null) {
        const isMulti = e.altKey || e.ctrlKey || e.metaKey;
        
        if (isMulti) {
          this.addCaret(pos);
        } else {
          this.setCaret(pos);
        }
        
        this.editorInput.focus();
      }
    }
  }
  
  handleMouseDown(e) {
    if (this.isClickInTextArea(e)) {
      const pos = this.getPositionFromClick(e);
      if (pos !== null) {
        this.mouseDown = true;
        this.dragStart = pos;
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          this.carets = [{ pos, anchor: pos }];
        }
      }
    }
  }
  
  handleMouseMove(e) {
    if (this.mouseDown && this.dragStart !== null) {
      const pos = this.getPositionFromClick(e);
      if (pos !== null && this.carets.length > 0) {
        this.carets[this.carets.length - 1].anchor = this.dragStart;
        this.carets[this.carets.length - 1].pos = pos;
      }
      this.updateCursor();
    }
  }
  
  handleMouseUp() {
    this.mouseDown = false;
    this.dragStart = null;
  }
  
  isClickInTextArea(e) {
    // Check if click is within the text content area
    return this.textContent.contains(e.target) || this.editorPane.contains(e.target);
  }
  
  getPositionFromClick(e) {
    // Find the character position from a click event
    const paneRect = this.editorPane.getBoundingClientRect();
    const x = e.clientX - paneRect.left;
    const y = e.clientY - paneRect.top + this.editorPane.scrollTop;
    
    // Estimate line based on line height
    const computedStyle = getComputedStyle(this.textContent);
    const lineHeight = parseFloat(computedStyle.lineHeight);
    const estimatedLine = Math.floor(y / lineHeight);
    
    if (estimatedLine < 0 || estimatedLine >= this.lines.length) {
      return null;
    }
    
    // Get position at start of estimated line
    let linePos = 0;
    for (let i = 0; i < estimatedLine; i++) {
      linePos += this.lines[i].length + 1;
    }
    
    // Find exact column position by binary search or direct measurement
    // For now, use approximate char width - this could be improved with Range API
    const fontSize = parseFloat(computedStyle.fontSize);
    const charWidth = fontSize * 0.55; // Approximate for monospace
    
    const offsetInLine = Math.round((x - 8) / charWidth); // 8px is left padding
    const col = Math.min(Math.max(0, offsetInLine), this.lines[estimatedLine].length);
    
    return Math.min(linePos + col, this.content.length);
  }
  
  setCaret(pos) {
    this.carets = [{ pos: this.clampPos(pos), anchor: this.clampPos(pos) }];
    this.updateCursor();
  }
  
  addCaret(pos) {
    pos = this.clampPos(pos);
    const existing = this.carets.find(c => c.pos === pos);
    if (!existing) {
      this.carets.push({ pos, anchor: pos });
    }
    this.updateCursor();
  }
  
  clampPos(pos) {
    return Math.max(0, Math.min(pos, this.content.length));
  }
  
  handleInput(e) {
    const now = Date.now();
    const timeSinceLastType = now - this.lastTypedTime;
    
    // Save to history if:
    // 1. First input or
    // 2. More than 300ms since last input (new action) or
    // 3. Position changed significantly (new caret location)
    const shouldGroup = this.lastTypedPos !== null && 
                        timeSinceLastType < 300 &&
                        Math.abs(this.carets[0].pos - this.lastTypedPos) <= 1;
    
    if (this.historyIndex === -1 || !shouldGroup) {
      this.saveToHistory();
    }
    
    this.lastTypedTime = now;
    this.lastTypedPos = this.carets[0].pos;
    
    this.markUnsaved();
    this.render();
  }
  
  handleKeyDown(e) {
    if (this.hasConflict) {
      if (e.key === 'Escape') this.reloadDocument();
      return;
    }
    
    // Handle keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          this.save();
          return;
        case 'z':
          e.preventDefault();
          this.undo();
          return;
        case 'y':
        case 'Z':
          if (e.shiftKey) {
            e.preventDefault();
            this.redo();
          }
          return;
        case 'f':
          e.preventDefault();
          this.findInput.focus();
          this.findInput.select();
          return;
        case 'h':
          e.preventDefault();
          this.toggleReplace();
          return;
      }
    }
    
    if (e.key === 'Escape' && this.findInput === document.activeElement) {
      this.editorInput.focus();
      return;
    }
    
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        this.decreaseIndent();
      } else {
        this.insertText('\t');
      }
      return;
    }
    
    if (e.key === 'Enter') {
      e.preventDefault();
      this.insertText('\n');
      return;
    }
    
    if (e.key === 'Backspace') {
      e.preventDefault();
      this.delete(true);
      return;
    }
    
    if (e.key === 'Delete') {
      e.preventDefault();
      this.delete(false);
      return;
    }
    
    // Arrow keys
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      this.handleArrowKey(e.key, e.shiftKey, e.ctrlKey || e.metaKey, e.altKey);
      return;
    }
    
    if (e.key === 'Home') {
      e.preventDefault();
      this.handleHome(e.shiftKey);
      return;
    }
    
    if (e.key === 'End') {
      e.preventDefault();
      this.handleEnd(e.shiftKey);
      return;
    }
    
    // Regular text input
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      this.insertText(e.key);
    }
  }
  
  insertText(text) {
    // Sort selections by position (descending) to avoid offset issues
    const selections = this.getSelections()
      .map((sel, idx) => ({ ...sel, idx, start: Math.min(sel.start, sel.end), end: Math.max(sel.start, sel.end) }))
      .sort((a, b) => b.start - a.start);
    
    // Process replacements from end to start
    for (const sel of selections) {
      const { start, end } = sel;
      this.content = this.content.slice(0, start) + text + this.content.slice(end);
    }
    
    // Move all carets to after inserted text (collapse selection)
    // If multiple selections, keep them spread
    if (this.carets.length === 1) {
      const newPos = this.carets[0].anchor + text.length;
      this.carets = [{ pos: newPos, anchor: newPos }];
    } else {
      // For multiple carets, move each one separately
      for (const caret of this.carets) {
        const start = Math.min(caret.anchor, caret.pos);
        const end = Math.max(caret.anchor, caret.pos);
        const offset = (end - start) - text.length;
        caret.pos = end - offset;
        caret.anchor = caret.pos;
      }
    }
    
    this.updateContent();
    this.handleInput({});
  }
  
  delete(isBackspace) {
    const selections = this.getSelections();
    
    if (selections.some(sel => sel.start !== sel.end)) {
      // Delete selection
      this.insertText('');
    } else {
      // Delete character - sort by position descending to avoid offset issues
      const sortedCarets = [...this.carets].sort((a, b) => b.pos - a.pos);
      
      for (const caret of sortedCarets) {
        const pos = caret.pos;
        if (isBackspace && pos > 0) {
          this.content = this.content.slice(0, pos - 1) + this.content.slice(pos);
          caret.pos = pos - 1;
          caret.anchor = caret.pos;
        } else if (!isBackspace && pos < this.content.length) {
          this.content = this.content.slice(0, pos) + this.content.slice(pos + 1);
          caret.anchor = caret.pos;
        }
      }
    }
    
    this.updateContent();
    this.handleInput({});
  }
  
  handleArrowKey(key, shift, ctrl, alt) {
    for (const caret of this.carets) {
      let newPos = caret.pos;
      
      if (key === 'ArrowLeft') {
        if (ctrl || alt) {
          newPos = this.getPrevWordStart(newPos);
        } else {
          newPos = Math.max(0, newPos - 1);
        }
      } else if (key === 'ArrowRight') {
        if (ctrl || alt) {
          newPos = this.getNextWordStart(newPos);
        } else {
          newPos = Math.min(this.content.length, newPos + 1);
        }
      } else if (key === 'ArrowUp') {
        newPos = this.moveUp(newPos);
      } else if (key === 'ArrowDown') {
        newPos = this.moveDown(newPos);
      }
      
      if (shift) {
        caret.pos = newPos;
      } else {
        caret.pos = newPos;
        caret.anchor = newPos;
      }
    }
    
    this.updateCursor();
    this.render();
  }
  
  handleHome(shift) {
    for (const caret of this.carets) {
      const lineStart = this.getLineStart(caret.pos);
      const firstNonSpace = this.getFirstNonSpaceInLine(caret.pos);
      
      const newPos = caret.pos === lineStart ? firstNonSpace : lineStart;
      
      if (shift) {
        caret.pos = newPos;
      } else {
        caret.pos = newPos;
        caret.anchor = newPos;
      }
    }
    
    this.updateCursor();
    this.render();
  }
  
  handleEnd(shift) {
    for (const caret of this.carets) {
      const newPos = this.getLineEnd(caret.pos);
      
      if (shift) {
        caret.pos = newPos;
      } else {
        caret.pos = newPos;
        caret.anchor = newPos;
      }
    }
    
    this.updateCursor();
    this.render();
  }
  
  decreaseIndent() {
    const selections = this.getSelections();
    let offset = 0;
    
    for (const sel of selections) {
      const lineStart = this.getLineStart(Math.min(sel.start, sel.end));
      if (this.content[lineStart] === '\t') {
        this.content = this.content.slice(0, lineStart - offset) + this.content.slice(lineStart + 1 - offset);
        offset += 1;
      }
    }
    
    this.updateContent();
    this.handleInput({});
  }
  
  moveUp(pos) {
    const lineStart = this.getLineStart(pos);
    const col = pos - lineStart;
    const prevLineStart = this.getLineStart(lineStart - 1);
    const prevLineEnd = this.getLineEnd(prevLineStart);
    const prevLineLength = prevLineEnd - prevLineStart;
    
    return Math.max(0, prevLineStart + Math.min(col, prevLineLength));
  }
  
  moveDown(pos) {
    const lineEnd = this.getLineEnd(pos);
    const lineStart = this.getLineStart(pos);
    const col = pos - lineStart;
    const nextLineStart = lineEnd + 1;
    const nextLineEnd = this.getLineEnd(nextLineStart);
    const nextLineLength = nextLineEnd - nextLineStart;
    
    return Math.min(this.content.length, nextLineStart + Math.min(col, nextLineLength));
  }
  
  getLineStart(pos) {
    let lineStart = pos;
    while (lineStart > 0 && this.content[lineStart - 1] !== '\n') {
      lineStart--;
    }
    return lineStart;
  }
  
  getLineEnd(pos) {
    let lineEnd = pos;
    while (lineEnd < this.content.length && this.content[lineEnd] !== '\n') {
      lineEnd++;
    }
    return lineEnd;
  }
  
  getFirstNonSpaceInLine(pos) {
    const lineStart = this.getLineStart(pos);
    let col = lineStart;
    while (col < this.getLineEnd(pos) && /\s/.test(this.content[col])) {
      col++;
    }
    return col;
  }
  
  getPrevWordStart(pos) {
    if (pos === 0) return 0;
    pos--;
    while (pos > 0 && /\s/.test(this.content[pos])) pos--;
    while (pos > 0 && !/\s/.test(this.content[pos])) pos--;
    if (pos > 0 && /\s/.test(this.content[pos])) pos++;
    return pos;
  }
  
  getNextWordStart(pos) {
    if (pos >= this.content.length) return this.content.length;
    while (pos < this.content.length && !/\s/.test(this.content[pos])) pos++;
    while (pos < this.content.length && /\s/.test(this.content[pos])) pos++;
    return pos;
  }
  
  getSelections() {
    return this.carets.map(c => ({
      start: c.anchor,
      end: c.pos
    }));
  }
  
  updateCursor() {
    this.cursorLayer.innerHTML = '';
    
    if (this.carets.length === 0) return;
    
    // Get font metrics
    const fontSize = parseFloat(getComputedStyle(this.textContent).fontSize);
    const charWidth = fontSize * 0.55; // Approximate for monospace
    const lineHeight = parseFloat(getComputedStyle(this.textContent).lineHeight);
    const padLeft = 8; // Left padding from CSS
    const padTop = 8;  // Top padding from CSS
    
    for (let i = 0; i < this.carets.length; i++) {
      const caret = this.carets[i];
      const pos = caret.pos;
      const anchor = caret.anchor;
      
      const { line, col } = this.getLineAndColumn(pos);
      
      // Only update position display for first caret
      if (i === 0) {
        this.cursorPosition.textContent = `Line ${line + 1}, Column ${col + 1}`;
      }
      
      // Create cursor element
      const cursor = document.createElement('div');
      cursor.className = 'cursor' + (i > 0 ? ' inactive' : '');
      cursor.style.left = (padLeft + col * charWidth) + 'px';
      cursor.style.top = (padTop + line * lineHeight) + 'px';
      cursor.style.height = lineHeight + 'px';
      this.cursorLayer.appendChild(cursor);
      
      // Draw selection
      if (anchor !== pos) {
        const { line: anchorLine, col: anchorCol } = this.getLineAndColumn(anchor);
        this.drawSelection(
          anchorLine, anchorCol, line, col,
          charWidth, lineHeight, padLeft, padTop
        );
      }
    }
    
    this.syncLineNumbers();
  }
  
  getLineAndColumn(pos) {
    let line = 0;
    let col = 0;
    
    for (let i = 0; i < pos && i < this.content.length; i++) {
      if (this.content[i] === '\n') {
        line++;
        col = 0;
      } else {
        col++;
      }
    }
    
    return { line, col };
  }
  
  drawSelection(line1, col1, line2, col2, charWidth, lineHeight, padLeft, padTop) {
    for (let l = Math.min(line1, line2); l <= Math.max(line1, line2); l++) {
      let c1, c2;
      
      if (line1 === line2) {
        c1 = Math.min(col1, col2);
        c2 = Math.max(col1, col2);
      } else if (l === Math.min(line1, line2)) {
        c1 = line1 < line2 ? col1 : col2;
        c2 = this.lines[l]?.length || 0;
      } else if (l === Math.max(line1, line2)) {
        c1 = 0;
        c2 = line1 < line2 ? col2 : col1;
      } else {
        c1 = 0;
        c2 = this.lines[l]?.length || 0;
      }
      
      if (c1 < c2) {
        const selection = document.createElement('div');
        selection.className = 'selection';
        selection.style.left = (padLeft + c1 * charWidth) + 'px';
        selection.style.top = (padTop + l * lineHeight) + 'px';
        selection.style.width = ((c2 - c1) * charWidth) + 'px';
        selection.style.height = lineHeight + 'px';
        this.cursorLayer.appendChild(selection);
      }
    }
  }
  
  updateFind() {
    this.findQuery = this.findInput.value;
    this.findMatches = [];
    this.findCurrentIndex = -1;
    
    if (this.findQuery.length > 0) {
      let pos = 0;
      while (pos < this.content.length) {
        const index = this.content.indexOf(this.findQuery, pos);
        if (index === -1) break;
        this.findMatches.push(index);
        pos = index + 1;
      }
      
      if (this.findMatches.length > 0) {
        this.findCurrentIndex = 0;
        this.setCaret(this.findMatches[0] + this.findQuery.length);
      }
    }
    
    this.updateFindDisplay();
    this.render();
  }
  
  updateFindDisplay() {
    if (this.findMatches.length > 0) {
      this.findCount.textContent = `${this.findCurrentIndex + 1} / ${this.findMatches.length}`;
    } else {
      this.findCount.textContent = this.findQuery ? 'No matches' : '';
    }
  }
  
  findNext() {
    if (this.findMatches.length === 0) return;
    
    this.findCurrentIndex = (this.findCurrentIndex + 1) % this.findMatches.length;
    const pos = this.findMatches[this.findCurrentIndex];
    this.setCaret(pos + this.findQuery.length);
    this.updateFindDisplay();
    this.render();
  }
  
  findPrev() {
    if (this.findMatches.length === 0) return;
    
    this.findCurrentIndex = (this.findCurrentIndex - 1 + this.findMatches.length) % this.findMatches.length;
    const pos = this.findMatches[this.findCurrentIndex];
    this.setCaret(pos + this.findQuery.length);
    this.updateFindDisplay();
    this.render();
  }
  
  toggleReplace() {
    this.showReplace = !this.showReplace;
    this.replaceControls.style.display = this.showReplace ? 'flex' : 'none';
  }
  
  replaceOne() {
    if (this.findMatches.length === 0) return;
    
    const pos = this.findMatches[this.findCurrentIndex];
    const before = this.content.slice(0, pos);
    const after = this.content.slice(pos + this.findQuery.length);
    
    this.content = before + this.replaceQuery + after;
    
    // Update find matches positions
    const offset = this.replaceQuery.length - this.findQuery.length;
    for (let i = this.findCurrentIndex + 1; i < this.findMatches.length; i++) {
      this.findMatches[i] += offset;
    }
    
    this.updateContent();
    this.handleInput({});
    this.updateFind();
  }
  
  replaceAll() {
    if (this.findMatches.length === 0) return;
    
    let result = this.content;
    const offset = this.replaceQuery.length - this.findQuery.length;
    
    for (let i = this.findMatches.length - 1; i >= 0; i--) {
      const pos = this.findMatches[i];
      result = result.slice(0, pos) + this.replaceQuery + result.slice(pos + this.findQuery.length);
    }
    
    this.content = result;
    this.updateContent();
    this.handleInput({});
    this.updateFind();
  }
  
  saveToHistory() {
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(this.content);
    this.historyIndex++;
  }
  
  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.content = this.history[this.historyIndex];
    this.updateContent();
  }
  
  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.content = this.history[this.historyIndex];
    this.updateContent();
  }
  
  markUnsaved() {
    if (this.isSaved) {
      this.isSaved = false;
      this.saveStatus.textContent = 'Unsaved changes';
      this.saveStatus.classList.remove('saved');
      this.saveStatus.classList.add('unsaved');
    }
  }
  
  markSaved() {
    this.isSaved = true;
    this.saveStatus.textContent = 'Saved';
    this.saveStatus.classList.remove('unsaved');
    this.saveStatus.classList.add('saved');
    this.baseRevision = this.currentRevision;
  }
  
  async save() {
    if (this.isSaved) {
      alert('No unsaved changes');
      return;
    }
    
    try {
      const response = await fetch(`/api/documents/${this.documentId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: this.content,
          baseRevision: this.baseRevision,
          documentId: this.documentId
        })
      });
      
      if (response.status === 409) {
        // Conflict - another tab saved changes
        this.showConflict();
        return;
      }
      
      if (!response.ok) {
        const error = await response.json();
        alert(`Save failed: ${error.error}`);
        return;
      }
      
      const result = await response.json();
      this.currentRevision = result.revision;
      this.markSaved();
      this.revisionDisplay.textContent = `Revision ${this.currentRevision}`;
      this.refreshRevisionHistory();
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save document');
    }
  }
  
  showConflict() {
    this.hasConflict = true;
    this.conflictDraft = this.content;
    this.conflictNotification.style.display = 'flex';
  }
  
  dismissConflict() {
    this.hasConflict = false;
    this.conflictNotification.style.display = 'none';
  }
  
  async reloadDocument() {
    this.dismissConflict();
    this.content = '';
    await this.loadDocument();
  }
  
  async refreshRevisionHistory() {
    try {
      const response = await fetch(`/api/documents/${this.documentId}/history`);
      if (!response.ok) return;
      
      const revisions = await response.json();
      this.revisionList.innerHTML = '';
      
      for (const rev of revisions) {
        const item = document.createElement('div');
        item.className = 'revision-item';
        
        const number = document.createElement('span');
        number.className = 'revision-item-number';
        number.textContent = `Revision ${rev.revisionNumber}`;
        item.appendChild(number);
        
        const time = document.createElement('span');
        time.className = 'revision-item-time';
        const date = new Date(rev.createdAt);
        time.textContent = date.toLocaleString();
        item.appendChild(time);
        
        if (rev.revisionNumber === this.currentRevision) {
          item.style.background = 'var(--primary-light)';
          item.style.borderColor = 'var(--primary)';
        }
        
        item.addEventListener('click', () => this.previewRevision(rev.revisionNumber));
        this.revisionList.appendChild(item);
      }
    } catch (error) {
      console.error('Error loading revision history:', error);
    }
  }
  
  async previewRevision(revisionNumber) {
    try {
      const response = await fetch(`/api/documents/${this.documentId}/revisions/${revisionNumber}`);
      if (!response.ok) return;
      
      const revision = await response.json();
      this.previewContent = revision.content;
      this.previewRevision = revisionNumber;
      
      this.previewTitle.textContent = `Revision ${revisionNumber}`;
      this.previewBody.textContent = revision.content;
      this.previewModal.style.display = 'flex';
    } catch (error) {
      console.error('Error loading revision:', error);
    }
  }
  
  closePreview() {
    this.previewModal.style.display = 'none';
    this.previewContent = '';
    this.previewRevision = null;
  }
  
  async confirmRestore() {
    try {
      const response = await fetch(
        `/api/documents/${this.documentId}/restore/${this.previewRevision}`,
        { method: 'POST' }
      );
      
      if (!response.ok) {
        alert('Failed to restore revision');
        return;
      }
      
      const result = await response.json();
      this.content = result.content;
      this.currentRevision = result.revision;
      this.baseRevision = this.currentRevision;
      
      this.closePreview();
      this.updateContent();
      this.markSaved();
      this.revisionDisplay.textContent = `Revision ${this.currentRevision}`;
      this.refreshRevisionHistory();
      this.saveToHistory();
    } catch (error) {
      console.error('Error restoring revision:', error);
      alert('Failed to restore revision');
    }
  }
}

// Initialize editor on page load
document.addEventListener('DOMContentLoaded', () => {
  new PatchPadEditor();
});

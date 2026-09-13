// ============================================================================
// PatchPad Editor - Main Application
// ============================================================================

class EditorState {
  constructor(content = '') {
    this.content = content;
    this.carets = [0]; // Array of caret positions
    this.selections = []; // Array of { start, end } for each caret
    this.undoStack = [];
    this.redoStack = [];
    this.lastActionType = null;
  }

  copy() {
    const copy = new EditorState(this.content);
    copy.carets = [...this.carets];
    copy.selections = this.selections.map(s => ({ ...s }));
    return copy;
  }
}

class UndoAction {
  constructor(type, before, after, caretPositions) {
    this.type = type; // 'edit', 'delete', 'paste', 'replace', 'indent', 'restore'
    this.before = before;
    this.after = after;
    this.caretPositions = caretPositions;
  }
}

class PatchPadEditor {
  constructor() {
    this.state = new EditorState();
    this.baseRevision = 1;
    this.currentRevision = 1;
    this.documentId = 'incident-alpha';
    this.saved = true;
    this.isLoading = true;

    // Find and replace state
    this.findQuery = '';
    this.findMatches = [];
    this.findCurrentIndex = -1;

    // UI Elements
    this.editorEl = document.getElementById('editor');
    this.lineNumbersEl = document.getElementById('lineNumbers');
    this.overlayEl = document.getElementById('editorOverlay');
    this.saveBtn = document.getElementById('saveBtn');
    this.undoBtn = document.getElementById('undoBtn');
    this.redoBtn = document.getElementById('redoBtn');
    this.findBtn = document.getElementById('findBtn');
    this.replaceBtn = document.getElementById('replaceBtn');
    this.historyBtn = document.getElementById('historyBtn');
    this.saveStatusEl = document.getElementById('saveStatus');
    this.cursorPosEl = document.getElementById('cursorPos');
    this.docRevisionEl = document.getElementById('docRevision');
    this.docAuthorEl = document.getElementById('docAuthor');

    this.findReplacePanel = document.getElementById('findReplacePanel');
    this.findInput = document.getElementById('findInput');
    this.replaceInput = document.getElementById('replaceInput');
    this.replaceGroup = document.getElementById('replaceGroup');
    this.findCount = document.getElementById('findCount');
    this.findNextBtn = document.getElementById('findNextBtn');
    this.findPrevBtn = document.getElementById('findPrevBtn');
    this.replaceOneBtn = document.getElementById('replaceOneBtn');
    this.replaceAllBtn = document.getElementById('replaceAllBtn');
    this.findCloseBtn = document.getElementById('findCloseBtn');
    this.replaceBtn = document.getElementById('replaceBtn');

    this.revisionSidebar = document.getElementById('revisionSidebar');
    this.revisionList = document.getElementById('revisionList');
    this.historyBtn = document.getElementById('historyBtn');
    this.closeSidebarBtn = document.getElementById('closeSidebarBtn');

    this.revisionModal = document.getElementById('revisionModal');
    this.revisionPreviewNum = document.getElementById('revisionPreviewNum');
    this.revisionPreviewTime = document.getElementById('revisionPreviewTime');
    this.revisionPreviewText = document.getElementById('revisionPreviewText');
    this.restoreRevisionBtn = document.getElementById('restoreRevisionBtn');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.cancelModalBtn = document.getElementById('cancelModalBtn');

    this.notificationArea = document.getElementById('notificationArea');

    this.init();
  }

  async init() {
    try {
      // Load document
      const response = await fetch(`/api/documents/${this.documentId}`);
      if (!response.ok) throw new Error('Failed to load document');
      const doc = await response.json();

      this.state.content = doc.content;
      this.baseRevision = doc.currentRevision;
      this.currentRevision = doc.currentRevision;
      this.docAuthorEl.textContent = doc.author;
      this.updateRevisionDisplay();

      // Render initial content
      this.updateEditor();
      this.updateLineNumbers();

      // Setup event listeners
      this.setupEventListeners();

      this.isLoading = false;
      this.updateSaveStatus();
      this.updateUndoRedoButtons();
      
      // Focus hidden input for keyboard input
      this.hiddenInput.focus();
    } catch (err) {
      console.error('Initialization error:', err);
      this.showNotification('Failed to load document', 'error');
    }
  }

  setupEventListeners() {
    // Get hidden input for capturing keystrokes
    this.hiddenInput = document.getElementById('hiddenInput');

    // Editor click and mouse events
    this.editorEl.addEventListener('click', (e) => this.handleClick(e));
    this.editorEl.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.editorEl.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.editorEl.addEventListener('mouseup', () => this.handleMouseUp());

    // Hidden input for keyboard events
    this.hiddenInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.hiddenInput.addEventListener('input', (e) => this.handleHiddenInput(e));
    this.hiddenInput.addEventListener('paste', (e) => this.handlePasteEvent(e));

    // Scrolling
    this.editorEl.parentElement.addEventListener('scroll', () => this.updateOverlay());

    // Buttons
    this.saveBtn.addEventListener('click', () => this.save());
    this.undoBtn.addEventListener('click', () => this.undo());
    this.redoBtn.addEventListener('click', () => this.redo());
    this.findBtn.addEventListener('click', () => this.toggleFindReplace(false));
    this.replaceBtn.addEventListener('click', () => this.toggleFindReplace(true));
    this.historyBtn.addEventListener('click', () => this.toggleRevisionHistory());

    // Find and Replace
    this.findInput.addEventListener('input', () => this.updateFind());
    this.findInput.addEventListener('keydown', (e) => this.findInputKeyDown(e));
    this.findNextBtn.addEventListener('click', () => this.findNext());
    this.findPrevBtn.addEventListener('click', () => this.findPrev());
    this.replaceOneBtn.addEventListener('click', () => this.replaceOne());
    this.replaceAllBtn.addEventListener('click', () => this.replaceAll());
    this.findCloseBtn.addEventListener('click', () => this.closeFindReplace());

    // Revision history
    this.closeSidebarBtn.addEventListener('click', () => this.toggleRevisionHistory());
    this.closeModalBtn.addEventListener('click', () => this.closeRevisionModal());
    this.cancelModalBtn.addEventListener('click', () => this.closeRevisionModal());
    this.restoreRevisionBtn.addEventListener('click', () => this.confirmRestoreRevision());

    // Focus management
    this.editorEl.addEventListener('click', () => this.hiddenInput.focus());
    this.hiddenInput.addEventListener('focus', () => this.updateCursor());
    this.hiddenInput.addEventListener('blur', () => this.updateCursor());
  }

  handleHiddenInput(e) {
    const input = this.hiddenInput.value;
    
    if (input.length > 0) {
      this.insertCharacterSequence(input);
      this.recordUndoAction();
    }
    
    // Clear the hidden input for the next input
    this.hiddenInput.value = '';
  }

  handlePasteEvent(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    this.insertCharacterSequence(text);
    this.recordUndoAction();
  }

  insertCharacterSequence(chars) {
    // Handle selections - delete selected content first
    if (this.state.selections.length > 0 && this.state.selections[0] && this.state.selections[0].start !== this.state.selections[0].end) {
      const sel = this.state.selections[0];
      const start = Math.min(sel.start, sel.end);
      const end = Math.max(sel.start, sel.end);
      this.state.content = this.state.content.slice(0, start) + this.state.content.slice(end);
      this.state.carets[0] = start;
      this.state.selections[0] = null;
    }

    // Insert sequence at caret
    const pos = this.state.carets[0];
    this.state.content = this.state.content.slice(0, pos) + chars + this.state.content.slice(pos);
    this.state.carets[0] = pos + chars.length;
    this.state.selections[0] = null;

    this.saved = false;
    this.updateEditor();
    this.updateSaveStatus();
  }

  // ========================================================================
  // Text Editing Core
  // ========================================================================

  handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.insertNewline();
      this.recordUndoAction();
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      this.handleBackspace();
      this.recordUndoAction();
      return;
    }

    if (e.key === 'Delete') {
      e.preventDefault();
      this.handleDelete();
      this.recordUndoAction();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        this.handleShiftTab();
      } else {
        this.handleTab();
      }
      this.recordUndoAction();
      return;
    }

    if (e.key === 'ArrowLeft') {
      this.handleArrowLeft(e.shiftKey, e.ctrlKey || e.metaKey, e.altKey);
      e.preventDefault();
      return;
    }

    if (e.key === 'ArrowRight') {
      this.handleArrowRight(e.shiftKey, e.ctrlKey || e.metaKey, e.altKey);
      e.preventDefault();
      return;
    }

    if (e.key === 'ArrowUp') {
      this.handleArrowUp(e.shiftKey);
      e.preventDefault();
      return;
    }

    if (e.key === 'ArrowDown') {
      this.handleArrowDown(e.shiftKey);
      e.preventDefault();
      return;
    }

    if (e.key === 'Home') {
      this.handleHome(e.shiftKey);
      e.preventDefault();
      return;
    }

    if (e.key === 'End') {
      this.handleEnd(e.shiftKey);
      e.preventDefault();
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
        return;
      }

      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        this.redo();
        return;
      }

      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.save();
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.toggleFindReplace(false);
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        this.toggleFindReplace(true);
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        this.selectAll();
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        this.handleCopy();
        return;
      }

      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        this.handleCut();
        this.recordUndoAction();
        return;
      }

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        this.handlePaste();
        this.recordUndoAction();
        return;
      }
    }

    // Handle multiple carets
    if ((e.altKey || (e.ctrlKey && e.key === 'Click')) && e.key !== 'Alt' && e.key !== 'Control') {
      return;
    }

    // Let the input event handler take care of regular character input
  }

  insertNewline() {
    const before = this.state.copy();

    // Handle selections first
    if (this.state.selections.length > 0) {
      const newContent = this.state.content.split('');
      for (let i = this.state.selections.length - 1; i >= 0; i--) {
        const sel = this.state.selections[i];
        const start = Math.min(sel.start, sel.end);
        const end = Math.max(sel.start, sel.end);
        newContent.splice(start, end - start);
        this.state.carets[i] = start;
      }
      this.state.selections = [];
      this.state.content = newContent.join('');
    }

    // Insert newlines from right to left to not affect positions
    for (let i = this.state.carets.length - 1; i >= 0; i--) {
      const pos = this.state.carets[i];
      this.state.content = this.state.content.slice(0, pos) + '\n' + this.state.content.slice(pos);
      this.state.carets[i] = pos + 1;
    }

    this.saved = false;
    this.updateEditor();
    this.updateSaveStatus();
  }

  handleBackspace() {
    if (this.state.selections.length > 0 && this.state.selections.some(s => s.start !== s.end)) {
      // Delete selection
      const newContent = this.state.content.split('');
      for (let i = this.state.selections.length - 1; i >= 0; i--) {
        const sel = this.state.selections[i];
        const start = Math.min(sel.start, sel.end);
        const end = Math.max(sel.start, sel.end);
        if (start !== end) {
          newContent.splice(start, end - start);
          this.state.carets[i] = start;
        }
      }
      this.state.selections = [];
      this.state.content = newContent.join('');
    } else {
      // Delete one character before each caret
      for (let i = this.state.carets.length - 1; i >= 0; i--) {
        const pos = this.state.carets[i];
        if (pos > 0) {
          const charBefore = this.state.content[pos - 1];
          const charCount = this.getCharacterLength(charBefore);
          this.state.content = this.state.content.slice(0, pos - charCount) + this.state.content.slice(pos);
          this.state.carets[i] = pos - charCount;
        }
      }
    }

    this.state.selections = [];
    this.saved = false;
    this.updateEditor();
    this.updateSaveStatus();
  }

  handleDelete() {
    if (this.state.selections.length > 0 && this.state.selections.some(s => s.start !== s.end)) {
      // Delete selection
      const newContent = this.state.content.split('');
      for (let i = this.state.selections.length - 1; i >= 0; i--) {
        const sel = this.state.selections[i];
        const start = Math.min(sel.start, sel.end);
        const end = Math.max(sel.start, sel.end);
        if (start !== end) {
          newContent.splice(start, end - start);
          this.state.carets[i] = start;
        }
      }
      this.state.selections = [];
      this.state.content = newContent.join('');
    } else {
      // Delete one character after each caret
      for (let i = this.state.carets.length - 1; i >= 0; i--) {
        const pos = this.state.carets[i];
        if (pos < this.state.content.length) {
          const charAfter = this.state.content[pos];
          const charCount = this.getCharacterLength(charAfter);
          this.state.content = this.state.content.slice(0, pos) + this.state.content.slice(pos + charCount);
        }
      }
    }

    this.state.selections = [];
    this.saved = false;
    this.updateEditor();
    this.updateSaveStatus();
  }

  handleTab() {
    const before = this.state.copy();

    if (this.state.selections.length > 0 && this.state.selections.some(s => s.start !== s.end)) {
      // Block indent: indent every line that's part of selection
      const selectionRanges = this.state.selections.map(sel => ({
        start: Math.min(sel.start, sel.end),
        end: Math.max(sel.start, sel.end)
      }));

      const minStart = Math.min(...selectionRanges.map(r => r.start));
      const maxEnd = Math.max(...selectionRanges.map(r => r.end));

      // Find all lines in range
      const lines = this.state.content.split('\n');
      let charIndex = 0;
      const indentedLines = [];
      let indentOffset = 0;

      for (let i = 0; i < lines.length; i++) {
        const lineStart = charIndex;
        const lineEnd = charIndex + lines[i].length;

        if (lineEnd >= minStart && lineStart <= maxEnd) {
          indentedLines.push('  ' + lines[i]);
          indentOffset += 2;
        } else {
          indentedLines.push(lines[i]);
        }

        charIndex = lineEnd + 1; // +1 for newline
      }

      this.state.content = indentedLines.join('\n');

      // Update caret positions
      for (let i = 0; i < this.state.carets.length; i++) {
        this.state.carets[i] += 2;
        if (this.state.selections[i]) {
          this.state.selections[i].start += 2;
          this.state.selections[i].end += 2;
        }
      }
    } else {
      // Simple indent at cursor
      for (let i = this.state.carets.length - 1; i >= 0; i--) {
        const pos = this.state.carets[i];
        this.state.content = this.state.content.slice(0, pos) + '  ' + this.state.content.slice(pos);
        this.state.carets[i] = pos + 2;
      }
    }

    this.saved = false;
    this.updateEditor();
    this.updateSaveStatus();
  }

  handleShiftTab() {
    if (this.state.selections.length > 0 && this.state.selections.some(s => s.start !== s.end)) {
      // Block outdent
      const selectionRanges = this.state.selections.map(sel => ({
        start: Math.min(sel.start, sel.end),
        end: Math.max(sel.start, sel.end)
      }));

      const minStart = Math.min(...selectionRanges.map(r => r.start));
      const maxEnd = Math.max(...selectionRanges.map(r => r.end));

      const lines = this.state.content.split('\n');
      let charIndex = 0;
      const outdentedLines = [];
      let totalRemoved = 0;

      for (let i = 0; i < lines.length; i++) {
        const lineStart = charIndex;
        const lineEnd = charIndex + lines[i].length;

        if (lineEnd >= minStart && lineStart <= maxEnd) {
          if (lines[i].startsWith('  ')) {
            outdentedLines.push(lines[i].slice(2));
            totalRemoved += 2;
          } else if (lines[i].startsWith('\t')) {
            outdentedLines.push(lines[i].slice(1));
            totalRemoved += 1;
          } else {
            outdentedLines.push(lines[i]);
          }
        } else {
          outdentedLines.push(lines[i]);
        }

        charIndex = lineEnd + 1;
      }

      this.state.content = outdentedLines.join('\n');

      // Update caret positions
      for (let i = 0; i < this.state.carets.length; i++) {
        this.state.carets[i] = Math.max(0, this.state.carets[i] - 2);
      }
    }

    this.saved = false;
    this.updateEditor();
    this.updateSaveStatus();
  }

  handleArrowLeft(shift, ctrl, alt) {
    if (this.state.carets.length === 0) return;

    const caret = this.state.carets[0];
    let newPos = caret;

    if (ctrl) {
      // Move to start of word
      newPos = this.findWordBoundary(caret, -1);
    } else {
      newPos = Math.max(0, caret - 1);
    }

    if (shift) {
      if (!this.state.selections[0]) {
        this.state.selections[0] = { start: caret, end: caret };
      }
      this.state.selections[0].end = newPos;
    } else {
      this.state.carets[0] = newPos;
      this.state.selections[0] = null;
      this.state.carets.length = 1;
    }

    this.updateCursor();
  }

  handleArrowRight(shift, ctrl, alt) {
    if (this.state.carets.length === 0) return;

    const caret = this.state.carets[0];
    let newPos = caret;

    if (ctrl) {
      // Move to end of word or start of next word
      newPos = this.findWordBoundary(caret, 1);
    } else {
      newPos = Math.min(this.state.content.length, caret + 1);
    }

    if (shift) {
      if (!this.state.selections[0]) {
        this.state.selections[0] = { start: caret, end: caret };
      }
      this.state.selections[0].end = newPos;
    } else {
      this.state.carets[0] = newPos;
      this.state.selections[0] = null;
      this.state.carets.length = 1;
    }

    this.updateCursor();
  }

  handleArrowUp(shift) {
    if (this.state.carets.length === 0) return;

    const caret = this.state.carets[0];
    const lineStart = this.getLineStart(caret);
    const colInLine = caret - lineStart;

    if (lineStart === 0) return; // Already at first line

    const prevLineStart = this.getLineStart(lineStart - 1);
    const prevLineEnd = lineStart - 1;
    const prevLineLength = prevLineEnd - prevLineStart;

    const newPos = prevLineStart + Math.min(colInLine, prevLineLength);

    if (shift) {
      if (!this.state.selections[0]) {
        this.state.selections[0] = { start: caret, end: caret };
      }
      this.state.selections[0].end = newPos;
    } else {
      this.state.carets[0] = newPos;
      this.state.selections[0] = null;
    }

    this.updateCursor();
  }

  handleArrowDown(shift) {
    if (this.state.carets.length === 0) return;

    const caret = this.state.carets[0];
    const lineStart = this.getLineStart(caret);
    const lineEnd = this.getLineEnd(caret);
    const colInLine = caret - lineStart;

    if (lineEnd >= this.state.content.length) return; // Already at last line

    const nextLineStart = lineEnd + 1;
    const nextLineEnd = this.getLineEnd(nextLineStart);
    const nextLineLength = nextLineEnd - nextLineStart;

    const newPos = nextLineStart + Math.min(colInLine, nextLineLength);

    if (shift) {
      if (!this.state.selections[0]) {
        this.state.selections[0] = { start: caret, end: caret };
      }
      this.state.selections[0].end = newPos;
    } else {
      this.state.carets[0] = newPos;
      this.state.selections[0] = null;
    }

    this.updateCursor();
  }

  handleHome(shift) {
    if (this.state.carets.length === 0) return;

    const caret = this.state.carets[0];
    const lineStart = this.getLineStart(caret);
    const lineContent = this.state.content.slice(lineStart, this.getLineEnd(caret));
    
    // Find first non-whitespace
    let firstNonWhitespace = lineStart;
    for (let i = 0; i < lineContent.length; i++) {
      if (lineContent[i] !== ' ' && lineContent[i] !== '\t') {
        firstNonWhitespace = lineStart + i;
        break;
      }
    }

    const newPos = (caret === lineStart || caret > firstNonWhitespace) ? lineStart : firstNonWhitespace;

    if (shift) {
      if (!this.state.selections[0]) {
        this.state.selections[0] = { start: caret, end: caret };
      }
      this.state.selections[0].end = newPos;
    } else {
      this.state.carets[0] = newPos;
      this.state.selections[0] = null;
    }

    this.updateCursor();
  }

  handleEnd(shift) {
    if (this.state.carets.length === 0) return;

    const caret = this.state.carets[0];
    const lineEnd = this.getLineEnd(caret);
    const newPos = lineEnd;

    if (shift) {
      if (!this.state.selections[0]) {
        this.state.selections[0] = { start: caret, end: caret };
      }
      this.state.selections[0].end = newPos;
    } else {
      this.state.carets[0] = newPos;
      this.state.selections[0] = null;
    }

    this.updateCursor();
  }

  handleCopy() {
    if (this.state.selections.length > 0 && this.state.selections[0]) {
      const sel = this.state.selections[0];
      const start = Math.min(sel.start, sel.end);
      const end = Math.max(sel.start, sel.end);
      const text = this.state.content.slice(start, end);
      navigator.clipboard.writeText(text);
    }
  }

  handleCut() {
    if (this.state.selections.length > 0 && this.state.selections[0]) {
      const sel = this.state.selections[0];
      const start = Math.min(sel.start, sel.end);
      const end = Math.max(sel.start, sel.end);
      const text = this.state.content.slice(start, end);
      navigator.clipboard.writeText(text);
      
      // Delete selection
      this.state.content = this.state.content.slice(0, start) + this.state.content.slice(end);
      this.state.carets[0] = start;
      this.state.selections[0] = null;
      this.saved = false;
      this.updateEditor();
      this.updateSaveStatus();
    }
  }

  handlePaste() {
    navigator.clipboard.readText().then(text => {
      // Handle selections first
      if (this.state.selections.length > 0 && this.state.selections.some(s => s.start !== s.end)) {
        const newContent = this.state.content.split('');
        for (let i = this.state.selections.length - 1; i >= 0; i--) {
          const sel = this.state.selections[i];
          const start = Math.min(sel.start, sel.end);
          const end = Math.max(sel.start, sel.end);
          newContent.splice(start, end - start);
          this.state.carets[i] = start;
        }
        this.state.selections = [];
        this.state.content = newContent.join('');
      }

      // Paste at caret
      for (let i = this.state.carets.length - 1; i >= 0; i--) {
        const pos = this.state.carets[i];
        this.state.content = this.state.content.slice(0, pos) + text + this.state.content.slice(pos);
        this.state.carets[i] = pos + text.length;
      }

      this.saved = false;
      this.updateEditor();
      this.updateSaveStatus();
    }).catch(err => console.error('Paste error:', err));
  }

  selectAll() {
    this.state.selections = [{ start: 0, end: this.state.content.length }];
    this.state.carets = [this.state.content.length];
    this.updateCursor();
  }

  // ========================================================================
  // Mouse Handling
  // ========================================================================

  handleClick(e) {
    const scrollWrapper = this.editorEl.parentElement;
    const rect = this.editorEl.getBoundingClientRect();
    const scrollTop = scrollWrapper.scrollTop;
    const scrollLeft = scrollWrapper.scrollLeft;
    const y = e.clientY - rect.top + scrollTop;
    const x = e.clientX - rect.left + scrollLeft;

    const pos = this.getPositionFromCoords(x, y);

    if (e.altKey || (e.ctrlKey && !e.metaKey)) {
      // Add caret
      if (!this.state.carets.includes(pos)) {
        this.state.carets.push(pos);
        this.state.carets.sort((a, b) => a - b);
      }
    } else {
      // Set single caret
      this.state.carets = [pos];
      this.state.selections = [];
    }

    this.updateCursor();
    this.hiddenInput.focus();
  }

  handleMouseDown(e) {
    this.isSelecting = true;
    this.handleClick(e);
  }

  handleMouseMove(e) {
    if (!this.isSelecting) return;

    const scrollWrapper = this.editorEl.parentElement;
    const rect = this.editorEl.getBoundingClientRect();
    const scrollTop = scrollWrapper.scrollTop;
    const scrollLeft = scrollWrapper.scrollLeft;
    const y = e.clientY - rect.top + scrollTop;
    const x = e.clientX - rect.left + scrollLeft;

    const pos = this.getPositionFromCoords(x, y);
    if (this.state.carets.length > 0) {
      const primaryCaret = this.state.carets[0];
      this.state.selections[0] = { start: primaryCaret, end: pos };
      this.updateCursor();
    }
  }

  handleMouseUp() {
    this.isSelecting = false;
  }

  // ========================================================================
  // Undo/Redo
  // ========================================================================

  recordUndoAction() {
    const action = new UndoAction(
      'edit',
      this.state.copy(),
      this.state.copy(),
      [...this.state.carets]
    );

    // Check if we should group with the last action
    if (this.state.lastActionType === 'edit' && this.state.undoStack.length > 0) {
      const lastAction = this.state.undoStack[this.state.undoStack.length - 1];
      if (Date.now() - (lastAction.timestamp || 0) < 500) {
        lastAction.after = this.state.copy();
        lastAction.caretPositions = [...this.state.carets];
        return;
      }
    }

    if (this.state.undoStack.length === 0 || this.state.undoStack[this.state.undoStack.length - 1].after.content !== this.state.content) {
      action.timestamp = Date.now();
      this.state.undoStack.push(action);
      this.state.redoStack = []; // Clear redo when new action is taken
      this.state.lastActionType = 'edit';
    }

    this.updateUndoRedoButtons();
  }

  undo() {
    if (this.state.undoStack.length === 0) return;

    const action = this.state.undoStack.pop();
    this.state.redoStack.push({
      ...action,
      before: action.after,
      after: action.before
    });

    this.state.content = action.before.content;
    this.state.carets = action.before.carets;
    this.state.selections = action.before.selections;

    this.saved = false;
    this.updateEditor();
    this.updateSaveStatus();
    this.updateUndoRedoButtons();
    this.updateCursor();
  }

  redo() {
    if (this.state.redoStack.length === 0) return;

    const action = this.state.redoStack.pop();
    this.state.undoStack.push(action);

    this.state.content = action.after.content;
    this.state.carets = action.after.carets;
    this.state.selections = action.after.selections;

    this.saved = false;
    this.updateEditor();
    this.updateSaveStatus();
    this.updateUndoRedoButtons();
    this.updateCursor();
  }

  // ========================================================================
  // Find and Replace
  // ========================================================================

  toggleFindReplace(showReplace = false) {
    if (this.findReplacePanel.style.display === 'none') {
      this.findReplacePanel.style.display = 'block';
      this.findInput.focus();
      this.replaceGroup.style.display = showReplace ? 'flex' : 'none';
    } else {
      this.closeFindReplace();
    }
  }

  closeFindReplace() {
    this.findReplacePanel.style.display = 'none';
    this.editorEl.focus();
  }

  updateFind() {
    this.findQuery = this.findInput.value.toLowerCase();
    this.findMatches = [];
    this.findCurrentIndex = -1;

    if (this.findQuery.length === 0) {
      this.findCount.textContent = '';
      this.updateOverlay();
      return;
    }

    // Find all matches
    const content = this.state.content.toLowerCase();
    let index = 0;
    while ((index = content.indexOf(this.findQuery, index)) !== -1) {
      this.findMatches.push({ start: index, end: index + this.findQuery.length });
      index++;
    }

    this.findCount.textContent = `${this.findMatches.length} match${this.findMatches.length !== 1 ? 'es' : ''}`;
    this.updateOverlay();
  }

  findNext() {
    if (this.findMatches.length === 0) return;

    this.findCurrentIndex = (this.findCurrentIndex + 1) % this.findMatches.length;
    const match = this.findMatches[this.findCurrentIndex];
    this.state.carets = [match.end];
    this.state.selections = [{ start: match.start, end: match.end }];
    this.updateCursor();
    this.updateOverlay();
  }

  findPrev() {
    if (this.findMatches.length === 0) return;

    this.findCurrentIndex = (this.findCurrentIndex - 1 + this.findMatches.length) % this.findMatches.length;
    const match = this.findMatches[this.findCurrentIndex];
    this.state.carets = [match.end];
    this.state.selections = [{ start: match.start, end: match.end }];
    this.updateCursor();
    this.updateOverlay();
  }

  findInputKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        this.findPrev();
      } else {
        this.findNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.closeFindReplace();
    }
  }

  replaceOne() {
    if (this.findCurrentIndex < 0 || this.findCurrentIndex >= this.findMatches.length) return;

    const match = this.findMatches[this.findCurrentIndex];
    const replacement = this.replaceInput.value;

    this.state.content = this.state.content.slice(0, match.start) +
                        replacement +
                        this.state.content.slice(match.end);

    // Update matches
    const diff = replacement.length - this.findQuery.length;
    for (let i = this.findCurrentIndex + 1; i < this.findMatches.length; i++) {
      this.findMatches[i].start += diff;
      this.findMatches[i].end += diff;
    }
    this.findMatches.splice(this.findCurrentIndex, 1);

    this.saved = false;
    this.updateEditor();
    this.updateSaveStatus();
    this.updateFind();

    if (this.findMatches.length > 0) {
      this.findCurrentIndex = Math.min(this.findCurrentIndex, this.findMatches.length - 1);
      this.findNext();
    }
  }

  replaceAll() {
    if (this.findMatches.length === 0) return;

    const before = this.state.copy();
    let content = this.state.content;
    const replacement = this.replaceInput.value;

    // Replace from end to start to maintain positions
    for (let i = this.findMatches.length - 1; i >= 0; i--) {
      const match = this.findMatches[i];
      content = content.slice(0, match.start) + replacement + content.slice(match.end);
    }

    this.state.content = content;
    const action = new UndoAction('replace', before, this.state.copy(), [0]);
    this.state.undoStack.push(action);
    this.state.redoStack = [];

    this.saved = false;
    this.updateEditor();
    this.updateSaveStatus();
    this.updateUndoRedoButtons();
    this.updateFind();
  }

  // ========================================================================
  // Revision History
  // ========================================================================

  async toggleRevisionHistory() {
    if (this.revisionSidebar.style.display === 'none') {
      this.revisionSidebar.style.display = 'block';
      await this.loadRevisionHistory();
    } else {
      this.revisionSidebar.style.display = 'none';
    }
  }

  async loadRevisionHistory() {
    try {
      const response = await fetch(`/api/documents/${this.documentId}/history`);
      if (!response.ok) throw new Error('Failed to load history');
      const revisions = await response.json();

      this.revisionList.innerHTML = '';
      revisions.forEach(rev => {
        const item = document.createElement('div');
        item.className = 'revision-item' + (rev.revisionNumber === this.currentRevision ? ' current' : '');
        item.innerHTML = `
          <span class="revision-num">Revision ${rev.revisionNumber}</span>
          <span class="revision-time">${new Date(rev.timestamp).toLocaleString()}</span>
        `;
        item.addEventListener('click', () => this.previewRevision(rev.revisionNumber));
        this.revisionList.appendChild(item);
      });
    } catch (err) {
      console.error('Failed to load revision history:', err);
      this.showNotification('Failed to load revision history', 'error');
    }
  }

  async previewRevision(revisionNumber) {
    try {
      const response = await fetch(`/api/documents/${this.documentId}/revisions/${revisionNumber}`);
      if (!response.ok) throw new Error('Failed to load revision');
      const revision = await response.json();

      this.revisionPreviewNum.textContent = `Revision ${revision.revisionNumber}`;
      this.revisionPreviewTime.textContent = new Date(revision.timestamp).toLocaleString();
      this.revisionPreviewText.textContent = revision.content;
      this.currentPreviewRevision = revisionNumber;

      this.revisionModal.style.display = 'flex';
    } catch (err) {
      console.error('Failed to load revision:', err);
      this.showNotification('Failed to load revision', 'error');
    }
  }

  closeRevisionModal() {
    this.revisionModal.style.display = 'none';
  }

  confirmRestoreRevision() {
    if (!this.currentPreviewRevision) return;

    const action = new UndoAction(
      'restore',
      this.state.copy(),
      new EditorState(this.revisionPreviewText.textContent),
      [0]
    );

    this.state.undoStack.push(action);
    this.state.redoStack = [];

    this.state.content = this.revisionPreviewText.textContent;
    this.state.carets = [0];
    this.state.selections = [];

    this.saved = false;
    this.updateEditor();
    this.updateSaveStatus();
    this.updateUndoRedoButtons();
    this.closeRevisionModal();

    this.showNotification('Revision restored as unsaved changes', 'success');
  }

  // ========================================================================
  // Save
  // ========================================================================

  async save() {
    if (this.isLoading) return;

    try {
      const response = await fetch(`/api/documents/${this.documentId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: this.documentId,
          content: this.state.content,
          baseRevision: this.baseRevision
        })
      });

      if (response.status === 409) {
        // Conflict: stale save
        const data = await response.json();
        this.showNotification(
          'Conflict: Another tab saved newer changes. Your draft is preserved.',
          'error'
        );
        this.showConflictUI(data.currentContent, data.currentRevision);
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Save failed');
      }

      const data = await response.json();
      if (!data.contentUnchanged) {
        this.currentRevision = data.revision;
        this.baseRevision = data.revision;
        this.updateRevisionDisplay();
      }

      this.saved = true;
      this.updateSaveStatus();
      this.showNotification('Saved successfully', 'success');
    } catch (err) {
      console.error('Save error:', err);
      this.showNotification(`Save failed: ${err.message}`, 'error');
    }
  }

  showConflictUI(serverContent, serverRevision) {
    this.saveStatusEl.textContent = 'CONFLICT';
    this.saveStatusEl.className = 'save-status conflict';

    const action = document.createElement('div');
    action.style.marginTop = '10px';
    
    const discardBtn = document.createElement('button');
    discardBtn.className = 'btn';
    discardBtn.textContent = 'Discard and reload';
    discardBtn.addEventListener('click', () => {
      this.state.content = serverContent;
      this.baseRevision = serverRevision;
      this.currentRevision = serverRevision;
      this.saved = true;
      this.state.undoStack = [];
      this.state.redoStack = [];
      this.updateEditor();
      this.updateSaveStatus();
      this.updateRevisionDisplay();
      this.updateUndoRedoButtons();
      this.showNotification('Reloaded server version', 'success');
    });

    this.notificationArea.innerHTML = '';
    const notif = document.createElement('div');
    notif.className = 'notification error';
    notif.innerHTML = `
      <strong>Edit conflict detected!</strong> Your changes are based on an older revision.
      <br>Keep your draft or reload the server version?
    `;
    notif.appendChild(discardBtn);
    this.notificationArea.appendChild(notif);
  }

  // ========================================================================
  // UI Updates
  // ========================================================================

  updateEditor() {
    this.editorEl.textContent = this.state.content;
    this.updateLineNumbers();
    this.updateOverlay();
    if (this.hiddenInput && !this.hiddenInput.matches(':focus')) {
      this.hiddenInput.focus();
    }
  }

  updateLineNumbers() {
    const lines = this.state.content.split('\n');
    const lineNumbers = lines.map((_, i) => (i + 1).toString()).join('\n');
    this.lineNumbersEl.textContent = lineNumbers;
  }

  updateCursor() {
    const caret = this.state.carets[0] || 0;
    const line = this.state.content.slice(0, caret).split('\n').length;
    const lineStart = this.getLineStart(caret);
    const col = caret - lineStart + 1;

    this.cursorPosEl.textContent = `Line ${line}, Col ${col}`;

    this.updateOverlay();
  }

  updateOverlay() {
    this.overlayEl.innerHTML = '';

    // Draw selections
    for (let sel of this.state.selections) {
      if (!sel || sel.start === sel.end) continue;

      const start = Math.min(sel.start, sel.end);
      const end = Math.max(sel.start, sel.end);

      const rects = this.getRectsForRange(start, end);
      for (let rect of rects) {
        const el = document.createElement('div');
        el.className = 'selection-range';
        el.style.left = rect.x + 'px';
        el.style.top = rect.y + 'px';
        el.style.width = rect.width + 'px';
        el.style.height = rect.height + 'px';
        this.overlayEl.appendChild(el);
      }
    }

    // Draw find highlights
    if (this.findQuery.length > 0) {
      for (let i = 0; i < this.findMatches.length; i++) {
        const match = this.findMatches[i];
        const rects = this.getRectsForRange(match.start, match.end);
        for (let rect of rects) {
          const el = document.createElement('div');
          el.className = 'find-highlight' + (i === this.findCurrentIndex ? ' current' : '');
          el.style.left = rect.x + 'px';
          el.style.top = rect.y + 'px';
          el.style.width = rect.width + 'px';
          el.style.height = rect.height + 'px';
          this.overlayEl.appendChild(el);
        }
      }
    }

    // Draw carets
    for (let i = 0; i < this.state.carets.length; i++) {
      const rect = this.getCaretRect(this.state.carets[i]);
      const el = document.createElement('div');
      el.className = 'caret' + (i > 0 ? ' inactive' : '');
      el.style.left = rect.x + 'px';
      el.style.top = rect.y + 'px';
      el.style.height = rect.height + 'px';
      this.overlayEl.appendChild(el);
    }

    // Scroll to primary caret if needed
    this.scrollToPosition(this.state.carets[0]);
  }

  updateSaveStatus() {
    if (this.saved) {
      this.saveStatusEl.textContent = 'Saved';
      this.saveStatusEl.className = 'save-status saved';
    } else {
      this.saveStatusEl.textContent = 'Unsaved changes';
      this.saveStatusEl.className = 'save-status unsaved';
    }
  }

  updateRevisionDisplay() {
    this.docRevisionEl.textContent = `Revision ${this.currentRevision}`;
  }

  updateUndoRedoButtons() {
    this.undoBtn.disabled = this.state.undoStack.length === 0;
    this.redoBtn.disabled = this.state.redoStack.length === 0;
  }

  // ========================================================================
  // Utility Functions
  // ========================================================================

  getCharacterLength(char) {
    // Count emoji and multi-byte characters as single characters
    return [...char].length;
  }

  getLineStart(pos) {
    const lastNewline = this.state.content.lastIndexOf('\n', pos - 1);
    return lastNewline === -1 ? 0 : lastNewline + 1;
  }

  getLineEnd(pos) {
    const nextNewline = this.state.content.indexOf('\n', pos);
    return nextNewline === -1 ? this.state.content.length : nextNewline;
  }

  findWordBoundary(pos, direction) {
    const content = this.state.content;
    const isWord = (ch) => /\w/.test(ch);

    if (direction === 1) {
      // Forward
      while (pos < content.length && !isWord(content[pos])) pos++;
      while (pos < content.length && isWord(content[pos])) pos++;
      return pos;
    } else {
      // Backward
      pos--;
      while (pos >= 0 && !isWord(content[pos])) pos--;
      while (pos >= 0 && isWord(content[pos])) pos--;
      return Math.max(0, pos + 1);
    }
  }

  getPositionFromCoords(x, y) {
    const lines = this.state.content.split('\n');
    const lineHeight = 21; // 14px font + 1.5 line-height
    const charWidth = 8.4; // Approximate monospace char width
    const paddingLeft = 12; // padding from CSS

    let lineIndex = Math.floor(y / lineHeight);
    lineIndex = Math.max(0, Math.min(lineIndex, lines.length - 1));

    // Adjust x for padding
    const adjustedX = Math.max(0, x - paddingLeft);
    let charIndex = Math.floor(adjustedX / charWidth);
    const line = lines[lineIndex];
    charIndex = Math.max(0, Math.min(charIndex, line.length));

    let pos = 0;
    for (let i = 0; i < lineIndex; i++) {
      pos += lines[i].length + 1; // +1 for newline
    }
    pos += charIndex;

    return Math.min(pos, this.state.content.length);
  }

  getCaretRect(pos) {
    const lines = this.state.content.slice(0, pos).split('\n');
    const lineIndex = lines.length - 1;
    const colIndex = lines[lineIndex].length;

    const y = lineIndex * 21 + 12; // 21px line height, 12px padding top
    const x = (this.lineNumbersEl.offsetWidth || 60) + colIndex * 8.4 + 12; // 12px editor padding

    return { x, y, height: 21 };
  }

  getRectsForRange(start, end) {
    const rects = [];
    const lines = this.state.content.split('\n');
    let charIndex = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineStart = charIndex;
      const lineEnd = charIndex + line.length;

      if (lineEnd < start || lineStart > end) {
        charIndex = lineEnd + 1;
        continue;
      }

      const rangeStart = Math.max(start, lineStart);
      const rangeEnd = Math.min(end, lineEnd);
      const startCol = rangeStart - lineStart;
      const endCol = rangeEnd - lineStart;

      const y = lineIndex * 21 + 12;
      const x = (this.lineNumbersEl.offsetWidth || 60) + startCol * 8.4 + 12;
      const width = (endCol - startCol) * 8.4;

      rects.push({ x, y, width, height: 21 });
      charIndex = lineEnd + 1;
    }

    return rects;
  }

  scrollToPosition(pos) {
    const rect = this.getCaretRect(pos);
    const scrollWrapper = this.editorEl.parentElement;
    const containerHeight = scrollWrapper.clientHeight;
    const scrollTop = scrollWrapper.scrollTop;

    if (rect.y < scrollTop) {
      scrollWrapper.scrollTop = rect.y - 50;
    } else if (rect.y + rect.height > scrollTop + containerHeight) {
      scrollWrapper.scrollTop = rect.y - containerHeight + 100;
    }
  }

  showNotification(message, type = 'info') {
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.textContent = message;

    this.notificationArea.appendChild(notif);

    setTimeout(() => {
      notif.remove();
    }, 4000);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PatchPadEditor();
});

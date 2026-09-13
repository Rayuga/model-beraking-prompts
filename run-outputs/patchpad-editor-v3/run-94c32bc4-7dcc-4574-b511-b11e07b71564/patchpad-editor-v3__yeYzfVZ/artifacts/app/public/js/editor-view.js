// Custom DOM-based Editing Surface for PatchPad

class PatchPadEditorView {
  constructor(containerElement, docModel, undoManager, options = {}) {
    this.container = containerElement;
    this.doc = docModel;
    this.undo = undoManager;
    this.options = options;

    // Selections array: each item is { anchor: {line, col}, head: {line, col} }
    this.selections = [{
      anchor: { line: 0, col: 0 },
      head: { line: 0, col: 0 }
    }];

    this.desiredCol = 0; // For vertical navigation across lines
    this.isDragging = false;
    this.isFocused = false;
    this.searchHighlights = []; // Array of matches
    this.activeSearchMatchIndex = -1;

    // Metrics
    this.lineHeight = 24;
    this.charWidth = 8.5; // Monospace approximate, measured dynamically
    this.gutterWidth = 50;

    this.onCursorChange = options.onCursorChange || null;
    this.onContentChange = options.onContentChange || null;
    this.onSaveRequest = options.onSaveRequest || null;
    this.onFindRequest = options.onFindRequest || null;
    this.onEscape = options.onEscape || null;

    this._initDom();
    this._measureFont();
    this._bindEvents();
    this.render();
  }

  _initDom() {
    this.container.innerHTML = '';
    this.container.classList.add('patchpad-editor-wrapper');

    // Hidden input capture for keyboard/clipboard events
    this.inputCapture = document.createElement('textarea');
    this.inputCapture.className = 'patchpad-input-capture';
    this.inputCapture.setAttribute('tabindex', '0');
    this.inputCapture.setAttribute('autocomplete', 'off');
    this.inputCapture.setAttribute('autocorrect', 'off');
    this.inputCapture.setAttribute('autocapitalize', 'off');
    this.inputCapture.setAttribute('spellcheck', 'false');
    this.container.appendChild(this.inputCapture);

    // Main scroll container
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'patchpad-scroll-container';
    this.container.appendChild(this.scrollContainer);

    // Sizer sets full scroll height & width
    this.sizer = document.createElement('div');
    this.sizer.className = 'patchpad-sizer';
    this.scrollContainer.appendChild(this.sizer);

    // Layer container
    this.layersContainer = document.createElement('div');
    this.layersContainer.className = 'patchpad-layers-container';
    this.scrollContainer.appendChild(this.layersContainer);

    // Gutter
    this.gutter = document.createElement('div');
    this.gutter.className = 'patchpad-gutter';
    this.layersContainer.appendChild(this.gutter);

    // Content container (lines, selections, carets)
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'patchpad-content';
    this.layersContainer.appendChild(this.contentContainer);

    // Sub-layers inside content
    this.searchHighlightsLayer = document.createElement('div');
    this.searchHighlightsLayer.className = 'patchpad-search-highlights-layer';
    this.contentContainer.appendChild(this.searchHighlightsLayer);

    this.selectionLayer = document.createElement('div');
    this.selectionLayer.className = 'patchpad-selection-layer';
    this.contentContainer.appendChild(this.selectionLayer);

    this.textLayer = document.createElement('div');
    this.textLayer.className = 'patchpad-text-layer';
    this.contentContainer.appendChild(this.textLayer);

    this.cursorLayer = document.createElement('div');
    this.cursorLayer.className = 'patchpad-cursor-layer';
    this.contentContainer.appendChild(this.cursorLayer);
  }

  _measureFont() {
    const testSpan = document.createElement('span');
    testSpan.className = 'patchpad-measure-span';
    testSpan.textContent = 'MMMMMMMMMM1234567890';
    this.textLayer.appendChild(testSpan);
    const rect = testSpan.getBoundingClientRect();
    if (rect.width > 0) {
      this.charWidth = rect.width / 20;
    }
    if (rect.height > 0) {
      this.lineHeight = rect.height;
    }
    testSpan.remove();

    // Setup canvas for subpixel text measurement
    const canvas = document.createElement('canvas');
    this.canvasCtx = canvas.getContext('2d');
    if (this.canvasCtx) {
      const style = window.getComputedStyle(this.container);
      this.canvasCtx.font = `${style.fontSize || '14px'} ${style.fontFamily || 'monospace'}`;
    }
  }

  measureTextWidth(str) {
    if (!str) return 0;
    if (this.canvasCtx) {
      return this.canvasCtx.measureText(str).width;
    }
    return str.length * this.charWidth;
  }

  colToX(lineIdx, col) {
    const line = this.doc.getLine(lineIdx);
    const sub = line.substring(0, col);
    return this.measureTextWidth(sub);
  }

  xToCol(lineIdx, x) {
    const line = this.doc.getLine(lineIdx);
    if (!line || x <= 0) return 0;

    const segs = getGraphemeSegments(line);
    if (segs.length === 0) return 0;

    let prevX = 0;
    let prevCol = 0;

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const col = seg.index + seg.segment.length;
      const curX = this.measureTextWidth(line.substring(0, col));
      const midX = (prevX + curX) / 2;

      if (x < midX) {
        return prevCol;
      }
      prevX = curX;
      prevCol = col;
    }

    return line.length;
  }

  posFromMouseEvent(e) {
    const rect = this.contentContainer.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    const relY = clientY - rect.top;
    const relX = clientX - rect.left;

    let lineIdx = Math.floor(relY / this.lineHeight);
    lineIdx = Math.max(0, Math.min(this.doc.getLineCount() - 1, lineIdx));

    const col = this.xToCol(lineIdx, Math.max(0, relX));
    return { line: lineIdx, col };
  }

  _bindEvents() {
    // Focus tracking
    this.container.addEventListener('mousedown', (e) => {
      this.focus();
    });

    this.inputCapture.addEventListener('focus', () => {
      this.isFocused = true;
      this.container.classList.add('focused');
      this.renderCarets();
    });

    this.inputCapture.addEventListener('blur', () => {
      this.isFocused = false;
      this.container.classList.remove('focused');
      this.renderCarets();
    });

    // Scrolling
    this.scrollContainer.addEventListener('scroll', () => {
      this.render();
    });

    // Mouse Selection & Caret handling
    this.scrollContainer.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Left click only
      this.focus();

      const pos = this.posFromMouseEvent(e);
      this.desiredCol = pos.col;

      if (e.altKey || ((e.ctrlKey || e.metaKey) && !e.shiftKey)) {
        // Add multi-caret
        this.selections.push({
          anchor: { ...pos },
          head: { ...pos }
        });
      } else if (e.shiftKey) {
        // Extend primary selection
        if (this.selections.length === 0) {
          this.selections = [{ anchor: { ...pos }, head: { ...pos } }];
        } else {
          this.selections[this.selections.length - 1].head = { ...pos };
        }
      } else {
        // Single caret
        if (e.detail === 2) {
          // Double click: select word
          const wordRange = this.doc.getWordAtPos(pos);
          this.selections = [{
            anchor: wordRange.start,
            head: wordRange.end
          }];
        } else if (e.detail >= 3) {
          // Triple click: select line
          const lineSel = this.doc.getLineSelection(pos.line);
          this.selections = [lineSel];
        } else {
          this.selections = [{
            anchor: { ...pos },
            head: { ...pos }
          }];
        }
      }

      this.isDragging = true;
      this.render();
      this._emitCursorChange();

      const onMouseMove = (moveEvent) => {
        if (!this.isDragging) return;
        const curPos = this.posFromMouseEvent(moveEvent);
        this.desiredCol = curPos.col;
        const primary = this.selections[this.selections.length - 1];
        primary.head = { ...curPos };
        this._autoScroll(moveEvent);
        this.render();
        this._emitCursorChange();
      };

      const onMouseUp = () => {
        this.isDragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Keyboard handling
    this.inputCapture.addEventListener('keydown', (e) => this._handleKeyDown(e));
    this.inputCapture.addEventListener('beforeinput', (e) => this._handleBeforeInput(e));
    this.inputCapture.addEventListener('copy', (e) => this._handleCopy(e));
    this.inputCapture.addEventListener('cut', (e) => this._handleCut(e));
    this.inputCapture.addEventListener('paste', (e) => this._handlePaste(e));
  }

  _autoScroll(e) {
    const rect = this.scrollContainer.getBoundingClientRect();
    const margin = 20;
    if (e.clientY < rect.top + margin) {
      this.scrollContainer.scrollTop -= 15;
    } else if (e.clientY > rect.bottom - margin) {
      this.scrollContainer.scrollTop += 15;
    }
    if (e.clientX < rect.left + margin) {
      this.scrollContainer.scrollLeft -= 15;
    } else if (e.clientX > rect.right - margin) {
      this.scrollContainer.scrollLeft += 15;
    }
  }

  focus() {
    if (document.activeElement !== this.inputCapture) {
      this.inputCapture.focus();
    }
  }

  _emitCursorChange() {
    if (this.onCursorChange) {
      const primary = this.getPrimarySelection();
      this.onCursorChange({
        line: primary.head.line + 1,
        col: primary.head.col + 1,
        selectedText: this.doc.getSelectedText(primary),
        caretCount: this.selections.length,
        hasSelection: !this.doc.normalizeSelection(primary).isCollapsed
      });
    }
  }

  _emitContentChange(type = 'edit') {
    if (this.onContentChange) {
      this.onContentChange(this.doc.getText(), type);
    }
  }

  getPrimarySelection() {
    return this.selections[this.selections.length - 1] || {
      anchor: { line: 0, col: 0 },
      head: { line: 0, col: 0 }
    };
  }

  setSelections(sels) {
    this.selections = sels.map(s => ({
      anchor: this.doc.clampPosition(s.anchor),
      head: this.doc.clampPosition(s.head)
    }));
    this.render();
    this._emitCursorChange();
    this.scrollToCursor();
  }

  setSearchHighlights(matches, activeIndex = -1) {
    this.searchHighlights = matches || [];
    this.activeSearchMatchIndex = activeIndex;
    this.renderSearchHighlights();
  }

  scrollToCursor() {
    const primary = this.getPrimarySelection();
    const top = primary.head.line * this.lineHeight;
    const bottom = top + this.lineHeight;
    const left = this.colToX(primary.head.line, primary.head.col);
    const right = left + 20;

    const scrollTop = this.scrollContainer.scrollTop;
    const scrollLeft = this.scrollContainer.scrollLeft;
    const viewHeight = this.scrollContainer.clientHeight;
    const viewWidth = this.scrollContainer.clientWidth;

    if (top < scrollTop) {
      this.scrollContainer.scrollTop = top;
    } else if (bottom > scrollTop + viewHeight) {
      this.scrollContainer.scrollTop = bottom - viewHeight;
    }

    if (left < scrollLeft) {
      this.scrollContainer.scrollLeft = left;
    } else if (right > scrollLeft + viewWidth) {
      this.scrollContainer.scrollLeft = right - viewWidth;
    }
  }

  _handleBeforeInput(e) {
    if (e.inputType === 'insertText' && e.data) {
      e.preventDefault();
      this.insertTextAtCarets(e.data, 'typing');
    }
  }

  _handleKeyDown(e) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

    // Shortcuts
    if (ctrlOrCmd && !e.altKey && !e.shiftKey) {
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (this.onSaveRequest) this.onSaveRequest();
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (this.onFindRequest) this.onFindRequest();
        return;
      }
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        this.performUndo();
        return;
      }
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        this.performRedo();
        return;
      }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        this.selectAll();
        return;
      }
    }

    if (ctrlOrCmd && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      this.performRedo();
      return;
    }

    // Escape
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.onEscape) this.onEscape();
      return;
    }

    // Tab / Shift+Tab (Indentation)
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        this.outdent();
      } else {
        this.indent();
      }
      return;
    }

    // Enter / Newline
    if (e.key === 'Enter') {
      e.preventDefault();
      this.insertNewline();
      return;
    }

    // Backspace
    if (e.key === 'Backspace') {
      e.preventDefault();
      this.deleteBackward(ctrlOrCmd || e.altKey);
      return;
    }

    // Delete
    if (e.key === 'Delete') {
      e.preventDefault();
      this.deleteForward(ctrlOrCmd || e.altKey);
      return;
    }

    // Navigation Keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
      e.preventDefault();
      this._handleNavigation(e.key, e.shiftKey, ctrlOrCmd || e.altKey, ctrlOrCmd);
      return;
    }

    // Normal Character Insertion fallback (if beforeinput not fired)
    if (!ctrlOrCmd && !e.altKey && e.key.length === 1) {
      e.preventDefault();
      this.insertTextAtCarets(e.key, 'typing');
    }
  }

  _handleNavigation(key, isShift, isWordMod, isDocMod) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    this.selections = this.selections.map(sel => {
      let head = { ...sel.head };
      let anchor = isShift ? { ...sel.anchor } : { ...head };

      switch (key) {
        case 'ArrowLeft': {
          if (!isShift && !this.doc.isPositionsEqual(sel.anchor, sel.head)) {
            // Collapse to start of selection
            const norm = this.doc.normalizeSelection(sel);
            head = { ...norm.start };
            anchor = { ...head };
          } else if (isWordMod) {
            head = this.doc.getPrevWordPos(head);
            if (!isShift) anchor = { ...head };
          } else {
            head = this.doc.getPrevGraphemePos(head);
            if (!isShift) anchor = { ...head };
          }
          this.desiredCol = head.col;
          break;
        }
        case 'ArrowRight': {
          if (!isShift && !this.doc.isPositionsEqual(sel.anchor, sel.head)) {
            // Collapse to end of selection
            const norm = this.doc.normalizeSelection(sel);
            head = { ...norm.end };
            anchor = { ...head };
          } else if (isWordMod) {
            head = this.doc.getNextWordPos(head);
            if (!isShift) anchor = { ...head };
          } else {
            head = this.doc.getNextGraphemePos(head);
            if (!isShift) anchor = { ...head };
          }
          this.desiredCol = head.col;
          break;
        }
        case 'ArrowUp': {
          if (isDocMod) {
            head = { line: 0, col: 0 };
          } else if (head.line > 0) {
            const targetLine = head.line - 1;
            const col = Math.min(this.doc.getLineLength(targetLine), this.desiredCol);
            head = { line: targetLine, col };
          } else {
            head = { line: 0, col: 0 };
          }
          if (!isShift) anchor = { ...head };
          break;
        }
        case 'ArrowDown': {
          if (isDocMod) {
            const lastLine = this.doc.getLineCount() - 1;
            head = { line: lastLine, col: this.doc.getLineLength(lastLine) };
          } else if (head.line < this.doc.getLineCount() - 1) {
            const targetLine = head.line + 1;
            const col = Math.min(this.doc.getLineLength(targetLine), this.desiredCol);
            head = { line: targetLine, col };
          } else {
            const lastLine = this.doc.getLineCount() - 1;
            head = { line: lastLine, col: this.doc.getLineLength(lastLine) };
          }
          if (!isShift) anchor = { ...head };
          break;
        }
        case 'Home': {
          if (isDocMod) {
            head = { line: 0, col: 0 };
          } else {
            head = { line: head.line, col: 0 };
          }
          this.desiredCol = head.col;
          if (!isShift) anchor = { ...head };
          break;
        }
        case 'End': {
          if (isDocMod) {
            const lastLine = this.doc.getLineCount() - 1;
            head = { line: lastLine, col: this.doc.getLineLength(lastLine) };
          } else {
            head = { line: head.line, col: this.doc.getLineLength(head.line) };
          }
          this.desiredCol = head.col;
          if (!isShift) anchor = { ...head };
          break;
        }
        case 'PageUp': {
          const jump = Math.max(1, Math.floor(this.scrollContainer.clientHeight / this.lineHeight));
          const targetLine = Math.max(0, head.line - jump);
          head = { line: targetLine, col: Math.min(this.doc.getLineLength(targetLine), this.desiredCol) };
          if (!isShift) anchor = { ...head };
          break;
        }
        case 'PageDown': {
          const jump = Math.max(1, Math.floor(this.scrollContainer.clientHeight / this.lineHeight));
          const lastLine = this.doc.getLineCount() - 1;
          const targetLine = Math.min(lastLine, head.line + jump);
          head = { line: targetLine, col: Math.min(this.doc.getLineLength(targetLine), this.desiredCol) };
          if (!isShift) anchor = { ...head };
          break;
        }
      }

      return { anchor, head };
    });

    this.render();
    this._emitCursorChange();
    this.scrollToCursor();
  }

  selectAll() {
    const lastLine = this.doc.getLineCount() - 1;
    this.selections = [{
      anchor: { line: 0, col: 0 },
      head: { line: lastLine, col: this.doc.getLineLength(lastLine) }
    }];
    this.render();
    this._emitCursorChange();
  }

  _handleCopy(e) {
    const textToCopy = this.selections.map(s => this.doc.getSelectedText(s)).filter(Boolean).join('\n');
    if (textToCopy) {
      e.clipboardData.setData('text/plain', textToCopy);
      e.preventDefault();
    }
  }

  _handleCut(e) {
    const textToCopy = this.selections.map(s => this.doc.getSelectedText(s)).filter(Boolean).join('\n');
    if (textToCopy) {
      e.clipboardData.setData('text/plain', textToCopy);
      this.deleteBackward(false);
      e.preventDefault();
    }
  }

  _handlePaste(e) {
    const pasted = e.clipboardData.getData('text/plain');
    if (pasted) {
      e.preventDefault();
      this.insertTextAtCarets(pasted, 'paste');
    }
  }

  insertTextAtCarets(text, type = 'typing') {
    const beforeText = this.doc.getText();
    const beforeSelections = JSON.parse(JSON.stringify(this.selections));

    // Sort selections descending by start position to apply edits without shifting coordinates
    const sorted = this.selections.map((sel, idx) => ({ sel, idx, norm: this.doc.normalizeSelection(sel) }))
      .sort((a, b) => this.doc.comparePositions(b.norm.start, a.norm.start));

    const newSelectionsMap = [];

    for (const item of sorted) {
      const res = this.doc.replaceRange(item.norm.start, item.norm.end, text);
      newSelectionsMap[item.idx] = {
        anchor: res.newEndPos,
        head: res.newEndPos
      };
    }

    const afterText = this.doc.getText();
    this.selections = newSelectionsMap;
    this.desiredCol = this.getPrimarySelection().head.col;

    this.undo.recordAction({
      beforeText,
      afterText,
      beforeSelections,
      afterSelections: this.selections,
      type
    });

    this.render();
    this._emitCursorChange();
    this._emitContentChange(type);
    this.scrollToCursor();
  }

  insertNewline() {
    this.insertTextAtCarets('\n', 'typing');
  }

  deleteBackward(isWord = false) {
    const beforeText = this.doc.getText();
    const beforeSelections = JSON.parse(JSON.stringify(this.selections));

    const sorted = this.selections.map((sel, idx) => ({ sel, idx, norm: this.doc.normalizeSelection(sel) }))
      .sort((a, b) => this.doc.comparePositions(b.norm.start, a.norm.start));

    const newSelectionsMap = [];

    for (const item of sorted) {
      let startPos, endPos;
      if (!item.norm.isCollapsed) {
        startPos = item.norm.start;
        endPos = item.norm.end;
      } else {
        endPos = item.norm.head;
        if (isWord) {
          startPos = this.doc.getPrevWordPos(endPos);
        } else {
          startPos = this.doc.getPrevGraphemePos(endPos);
        }
      }

      const res = this.doc.replaceRange(startPos, endPos, '');
      newSelectionsMap[item.idx] = {
        anchor: res.newEndPos,
        head: res.newEndPos
      };
    }

    const afterText = this.doc.getText();
    this.selections = newSelectionsMap;
    this.desiredCol = this.getPrimarySelection().head.col;

    this.undo.recordAction({
      beforeText,
      afterText,
      beforeSelections,
      afterSelections: this.selections,
      type: 'backspace'
    });

    this.render();
    this._emitCursorChange();
    this._emitContentChange('delete');
    this.scrollToCursor();
  }

  deleteForward(isWord = false) {
    const beforeText = this.doc.getText();
    const beforeSelections = JSON.parse(JSON.stringify(this.selections));

    const sorted = this.selections.map((sel, idx) => ({ sel, idx, norm: this.doc.normalizeSelection(sel) }))
      .sort((a, b) => this.doc.comparePositions(b.norm.start, a.norm.start));

    const newSelectionsMap = [];

    for (const item of sorted) {
      let startPos, endPos;
      if (!item.norm.isCollapsed) {
        startPos = item.norm.start;
        endPos = item.norm.end;
      } else {
        startPos = item.norm.head;
        if (isWord) {
          endPos = this.doc.getNextWordPos(startPos);
        } else {
          endPos = this.doc.getNextGraphemePos(startPos);
        }
      }

      const res = this.doc.replaceRange(startPos, endPos, '');
      newSelectionsMap[item.idx] = {
        anchor: res.newEndPos,
        head: res.newEndPos
      };
    }

    const afterText = this.doc.getText();
    this.selections = newSelectionsMap;
    this.desiredCol = this.getPrimarySelection().head.col;

    this.undo.recordAction({
      beforeText,
      afterText,
      beforeSelections,
      afterSelections: this.selections,
      type: 'delete'
    });

    this.render();
    this._emitCursorChange();
    this._emitContentChange('delete');
    this.scrollToCursor();
  }

  indent() {
    const primary = this.getPrimarySelection();
    const norm = this.doc.normalizeSelection(primary);

    // Multiline selection block indent
    if (!norm.isCollapsed && (norm.start.line !== norm.end.line || (norm.start.col === 0 && norm.end.col === this.doc.getLineLength(norm.end.line)))) {
      const beforeText = this.doc.getText();
      const beforeSelections = JSON.parse(JSON.stringify(this.selections));

      const res = this.doc.indentBlock(primary);
      this.selections = [res.selection];

      const afterText = this.doc.getText();
      this.undo.recordAction({
        beforeText,
        afterText,
        beforeSelections,
        afterSelections: this.selections,
        type: 'indent'
      });

      this.render();
      this._emitCursorChange();
      this._emitContentChange('indent');
      return;
    }

    // Single line or collapsed cursor: insert 2 spaces
    this.insertTextAtCarets('  ', 'indent');
  }

  outdent() {
    const primary = this.getPrimarySelection();
    const beforeText = this.doc.getText();
    const beforeSelections = JSON.parse(JSON.stringify(this.selections));

    const res = this.doc.outdentBlock(primary);
    this.selections = [res.selection];

    const afterText = this.doc.getText();
    this.undo.recordAction({
      beforeText,
      afterText,
      beforeSelections,
      afterSelections: this.selections,
      type: 'outdent'
    });

    this.render();
    this._emitCursorChange();
    this._emitContentChange('outdent');
  }

  performUndo() {
    const res = this.undo.undo();
    if (!res) return;
    this.doc.setText(res.text);
    this.selections = res.selections || [{ anchor: { line: 0, col: 0 }, head: { line: 0, col: 0 } }];
    this.render();
    this._emitCursorChange();
    this._emitContentChange('undo');
    this.scrollToCursor();
  }

  performRedo() {
    const res = this.undo.redo();
    if (!res) return;
    this.doc.setText(res.text);
    this.selections = res.selections || [{ anchor: { line: 0, col: 0 }, head: { line: 0, col: 0 } }];
    this.render();
    this._emitCursorChange();
    this._emitContentChange('redo');
    this.scrollToCursor();
  }

  // Virtualized DOM Rendering
  render() {
    const lineCount = this.doc.getLineCount();
    const totalHeight = lineCount * this.lineHeight;

    // Estimate max width
    let maxLen = 0;
    for (let i = 0; i < Math.min(lineCount, 500); i++) {
      if (this.doc.lines[i].length > maxLen) maxLen = this.doc.lines[i].length;
    }
    const totalWidth = Math.max(800, maxLen * this.charWidth + 100);

    this.sizer.style.height = `${totalHeight}px`;
    this.sizer.style.width = `${totalWidth}px`;

    const scrollTop = this.scrollContainer.scrollTop;
    const viewportHeight = this.scrollContainer.clientHeight || 600;

    const overscan = 15;
    const startLine = Math.max(0, Math.floor(scrollTop / this.lineHeight) - overscan);
    const endLine = Math.min(lineCount - 1, Math.ceil((scrollTop + viewportHeight) / this.lineHeight) + overscan);

    this.layersContainer.style.top = `${startLine * this.lineHeight}px`;

    // Render Gutter
    let gutterHtml = '';
    const activeLine = this.getPrimarySelection().head.line;
    for (let i = startLine; i <= endLine; i++) {
      const isActive = i === activeLine ? ' active' : '';
      gutterHtml += `<div class="patchpad-gutter-line${isActive}" style="height:${this.lineHeight}px">${i + 1}</div>`;
    }
    this.gutter.innerHTML = gutterHtml;

    // Render Text Lines
    let linesHtml = '';
    for (let i = startLine; i <= endLine; i++) {
      const lineText = this.doc.getLine(i);
      const escaped = this._escapeHtml(lineText);
      linesHtml += `<div class="patchpad-line" style="height:${this.lineHeight}px">${escaped || '&nbsp;'}</div>`;
    }
    this.textLayer.innerHTML = linesHtml;

    // Render Selection, Highlights & Carets
    this.renderSelections(startLine, endLine);
    this.renderSearchHighlights(startLine, endLine);
    this.renderCarets(startLine, endLine);
  }

  _escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  renderSelections(startLine, endLine) {
    if (startLine === undefined) {
      const scrollTop = this.scrollContainer.scrollTop;
      const viewportHeight = this.scrollContainer.clientHeight || 600;
      startLine = Math.max(0, Math.floor(scrollTop / this.lineHeight) - 15);
      endLine = Math.min(this.doc.getLineCount() - 1, Math.ceil((scrollTop + viewportHeight) / this.lineHeight) + 15);
    }

    let selHtml = '';
    for (const sel of this.selections) {
      const norm = this.doc.normalizeSelection(sel);
      if (norm.isCollapsed) continue;

      const sL = Math.max(startLine, norm.start.line);
      const eL = Math.min(endLine, norm.end.line);

      for (let L = sL; L <= eL; L++) {
        const top = (L - startLine) * this.lineHeight;
        let leftCol = 0;
        let rightCol = this.doc.getLineLength(L);

        if (L === norm.start.line) leftCol = norm.start.col;
        if (L === norm.end.line) rightCol = norm.end.col;

        const leftX = this.colToX(L, leftCol);
        const rightX = this.colToX(L, rightCol);
        let width = Math.max(4, rightX - leftX);

        if (L < norm.end.line && rightCol === this.doc.getLineLength(L)) {
          width += 8; // Highlight newline span
        }

        selHtml += `<div class="patchpad-selection-rect" style="top:${top}px;left:${leftX}px;width:${width}px;height:${this.lineHeight}px"></div>`;
      }
    }
    this.selectionLayer.innerHTML = selHtml;
  }

  renderSearchHighlights(startLine, endLine) {
    if (startLine === undefined) {
      const scrollTop = this.scrollContainer.scrollTop;
      const viewportHeight = this.scrollContainer.clientHeight || 600;
      startLine = Math.max(0, Math.floor(scrollTop / this.lineHeight) - 15);
      endLine = Math.min(this.doc.getLineCount() - 1, Math.ceil((scrollTop + viewportHeight) / this.lineHeight) + 15);
    }

    let hlHtml = '';
    for (let i = 0; i < this.searchHighlights.length; i++) {
      const match = this.searchHighlights[i];
      if (match.end.line < startLine || match.start.line > endLine) continue;

      const isActive = i === this.activeSearchMatchIndex ? ' active-match' : '';
      const sL = Math.max(startLine, match.start.line);
      const eL = Math.min(endLine, match.end.line);

      for (let L = sL; L <= eL; L++) {
        const top = (L - startLine) * this.lineHeight;
        let leftCol = (L === match.start.line) ? match.start.col : 0;
        let rightCol = (L === match.end.line) ? match.end.col : this.doc.getLineLength(L);

        const leftX = this.colToX(L, leftCol);
        const rightX = this.colToX(L, rightCol);
        const width = Math.max(2, rightX - leftX);

        hlHtml += `<div class="patchpad-search-rect${isActive}" style="top:${top}px;left:${leftX}px;width:${width}px;height:${this.lineHeight}px"></div>`;
      }
    }
    this.searchHighlightsLayer.innerHTML = hlHtml;
  }

  renderCarets(startLine, endLine) {
    if (startLine === undefined) {
      const scrollTop = this.scrollContainer.scrollTop;
      const viewportHeight = this.scrollContainer.clientHeight || 600;
      startLine = Math.max(0, Math.floor(scrollTop / this.lineHeight) - 15);
      endLine = Math.min(this.doc.getLineCount() - 1, Math.ceil((scrollTop + viewportHeight) / this.lineHeight) + 15);
    }

    let caretHtml = '';
    for (const sel of this.selections) {
      const head = sel.head;
      if (head.line >= startLine && head.line <= endLine) {
        const top = (head.line - startLine) * this.lineHeight;
        const left = this.colToX(head.line, head.col);
        const blinkClass = this.isFocused ? ' blinking' : '';
        caretHtml += `<div class="patchpad-caret${blinkClass}" style="top:${top}px;left:${left}px;height:${this.lineHeight}px"></div>`;
      }
    }
    this.cursorLayer.innerHTML = caretHtml;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PatchPadEditorView };
}

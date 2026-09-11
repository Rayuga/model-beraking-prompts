// Custom DOM Editor Surface & Virtual Renderer
(function(window) {
  'use strict';

  const Grapheme = window.GraphemeUtils;
  const Selection = window.Selection;
  const SelectionManager = window.SelectionManager;
  const HistoryManager = window.HistoryManager;

  class EditorView {
    constructor(containerElement, options = {}) {
      this.container = containerElement;
      this.options = Object.assign({
        lineHeight: 24,
        fontSize: 14,
        fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, 'DejaVu Sans Mono', monospace",
        tabSize: 2,
        readOnly: false,
        onCursorChange: null,
        onDocChange: null,
        onSaveRequest: null,
        onFindRequest: null
      }, options);

      this.doc = new window.DocumentModel('');
      this.selectionManager = new SelectionManager();
      this.history = new HistoryManager();
      this.findController = null;

      this.charWidth = 8.4;
      this.lineHeight = this.options.lineHeight;
      this.scrollTop = 0;
      this.scrollLeft = 0;
      this.viewportHeight = 600;
      this.viewportWidth = 800;
      this.isDragging = false;
      this.dragStartPos = null;
      this.isFocused = false;
      this.autoScrollInterval = null;

      // Text measurement canvas
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');

      this._initDom();
      this._updateFontMetrics();
      this._bindEvents();
    }

    _initDom() {
      this.container.innerHTML = '';
      this.container.classList.add('patchpad-editor-root');
      this.container.setAttribute('tabindex', '0');
      this.container.setAttribute('role', 'textbox');
      this.container.setAttribute('aria-multiline', 'true');
      this.container.setAttribute('aria-label', 'Incident Report Content');

      // Gutter
      this.gutter = document.createElement('div');
      this.gutter.className = 'patchpad-gutter';
      this.gutterSizer = document.createElement('div');
      this.gutterSizer.className = 'patchpad-gutter-sizer';
      this.gutterLines = document.createElement('div');
      this.gutterLines.className = 'patchpad-gutter-lines';
      this.gutter.appendChild(this.gutterSizer);
      this.gutter.appendChild(this.gutterLines);

      // Viewport scroll area
      this.viewport = document.createElement('div');
      this.viewport.className = 'patchpad-viewport';

      // Sizer element defines scrollable dimensions
      this.sizer = document.createElement('div');
      this.sizer.className = 'patchpad-sizer';

      // Layers
      this.selectionLayer = document.createElement('div');
      this.selectionLayer.className = 'patchpad-layer patchpad-selections';

      this.searchLayer = document.createElement('div');
      this.searchLayer.className = 'patchpad-layer patchpad-search-matches';

      this.linesLayer = document.createElement('div');
      this.linesLayer.className = 'patchpad-layer patchpad-lines';

      this.caretsLayer = document.createElement('div');
      this.caretsLayer.className = 'patchpad-layer patchpad-carets';

      this.sizer.appendChild(this.selectionLayer);
      this.sizer.appendChild(this.searchLayer);
      this.sizer.appendChild(this.linesLayer);
      this.sizer.appendChild(this.caretsLayer);
      this.viewport.appendChild(this.sizer);

      this.container.appendChild(this.gutter);
      this.container.appendChild(this.viewport);
    }

    _updateFontMetrics() {
      const font = `${this.options.fontSize}px ${this.options.fontFamily}`;
      this.ctx.font = font;
      this.charWidth = this.ctx.measureText('M').width || 8.4;
      this.lineHeight = this.options.lineHeight || 24;

      this.container.style.fontSize = `${this.options.fontSize}px`;
      this.container.style.fontFamily = this.options.fontFamily;
      this.container.style.lineHeight = `${this.lineHeight}px`;
    }

    setFontSize(size) {
      this.options.fontSize = size;
      this._updateFontMetrics();
      this.render();
    }

    setFindController(findController) {
      this.findController = findController;
      this.render();
    }

    setText(text, clearHistory = true) {
      this.doc.setText(text);
      this.selectionManager.setSingleCaret(0, 0);
      if (clearHistory) {
        this.history.clear();
      }
      this.render();
      this._notifyCursorChange();
      if (this.options.onDocChange) {
        this.options.onDocChange(this.doc.getText());
      }
    }

    getText() {
      return this.doc.getText();
    }

    get isDirty() {
      return this.history.canUndo();
    }

    measureSubstring(text, col) {
      if (col <= 0 || !text) return 0;
      const sub = text.substring(0, Math.min(text.length, col));
      return this.ctx.measureText(sub).width;
    }

    colFromX(lineText, x) {
      if (x <= 0 || !lineText) return 0;
      const offsets = Grapheme.getGraphemeOffsets(lineText);
      let low = 0;
      let high = offsets.length - 1;

      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const w = this.measureSubstring(lineText, offsets[mid]);
        if (w < x) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }

      // Check which boundary is closer
      const idx1 = Math.max(0, low - 1);
      const idx2 = low;
      const w1 = this.measureSubstring(lineText, offsets[idx1]);
      const w2 = this.measureSubstring(lineText, offsets[idx2]);

      if (Math.abs(x - w1) <= Math.abs(x - w2)) {
        return offsets[idx1];
      }
      return offsets[idx2];
    }

    posFromCoords(clientX, clientY) {
      const rect = this.viewport.getBoundingClientRect();
      const relY = clientY - rect.top + this.viewport.scrollTop;
      const relX = clientX - rect.left + this.viewport.scrollLeft;

      let row = Math.floor(relY / this.lineHeight);
      row = Math.max(0, Math.min(this.doc.lineCount - 1, row));

      const lineText = this.doc.getLine(row);
      const col = this.colFromX(lineText, relX);

      return { row, col };
    }

    scrollCursorIntoView(pos = null) {
      if (!pos) {
        pos = this.selectionManager.primary.head;
      }
      const lineText = this.doc.getLine(pos.row);
      const cursorY = pos.row * this.lineHeight;
      const cursorX = this.measureSubstring(lineText, pos.col);

      const viewHeight = this.viewport.clientHeight;
      const viewWidth = this.viewport.clientWidth;
      const curScrollTop = this.viewport.scrollTop;
      const curScrollLeft = this.viewport.scrollLeft;

      // Vertical scroll
      if (cursorY < curScrollTop) {
        this.viewport.scrollTop = cursorY;
      } else if (cursorY + this.lineHeight > curScrollTop + viewHeight) {
        this.viewport.scrollTop = cursorY + this.lineHeight - viewHeight;
      }

      // Horizontal scroll
      if (cursorX < curScrollLeft + 20) {
        this.viewport.scrollLeft = Math.max(0, cursorX - 40);
      } else if (cursorX + 20 > curScrollLeft + viewWidth) {
        this.viewport.scrollLeft = cursorX - viewWidth + 40;
      }
    }

    render() {
      const totalLines = this.doc.lineCount;
      const totalHeight = Math.max(totalLines * this.lineHeight + 200, this.viewport.clientHeight);

      // Estimate max line width for sizer
      let maxLineWidth = 800;
      const step = Math.max(1, Math.floor(totalLines / 50));
      for (let i = 0; i < totalLines; i += step) {
        const len = this.doc.getLine(i).length;
        if (len * this.charWidth > maxLineWidth) {
          maxLineWidth = len * this.charWidth + 100;
        }
      }

      this.sizer.style.height = `${totalHeight}px`;
      this.sizer.style.width = `${maxLineWidth}px`;
      this.gutterSizer.style.height = `${totalHeight}px`;

      const scrollTop = this.viewport.scrollTop;
      const viewHeight = this.viewport.clientHeight || 600;
      const buffer = 15;

      const startRow = Math.max(0, Math.floor(scrollTop / this.lineHeight) - buffer);
      const endRow = Math.min(totalLines - 1, Math.ceil((scrollTop + viewHeight) / this.lineHeight) + buffer);

      // Render gutter line numbers
      this._renderGutter(startRow, endRow);

      // Render line contents
      this._renderLines(startRow, endRow);

      // Render selection highlights
      this._renderSelections(startRow, endRow);

      // Render search highlights
      this._renderSearchMatches(startRow, endRow);

      // Render carets
      this._renderCarets();
    }

    _renderGutter(startRow, endRow) {
      let html = '';
      const primaryRow = this.selectionManager.primary.head.row;
      for (let r = startRow; r <= endRow; r++) {
        const top = r * this.lineHeight;
        const isCurrent = r === primaryRow;
        html += `<div class="patchpad-gutter-line${isCurrent ? ' current' : ''}" data-row="${r}" style="top:${top}px;height:${this.lineHeight}px;">${r + 1}</div>`;
      }
      this.gutterLines.innerHTML = html;
    }

    _escapeHtml(text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    _renderLines(startRow, endRow) {
      let html = '';
      for (let r = startRow; r <= endRow; r++) {
        const top = r * this.lineHeight;
        const lineText = this.doc.getLine(r);
        const display = lineText.length === 0 ? '&nbsp;' : this._escapeHtml(lineText);
        html += `<div class="patchpad-line" style="top:${top}px;height:${this.lineHeight}px;">${display}</div>`;
      }
      this.linesLayer.innerHTML = html;
    }

    _renderSelections(startRow, endRow) {
      let html = '';
      for (const sel of this.selectionManager.selections) {
        if (sel.isEmpty()) continue;
        const range = sel.getRange();

        const sRow = Math.max(startRow, range.start.row);
        const eRow = Math.min(endRow, range.end.row);

        if (sRow > eRow) continue;

        for (let r = sRow; r <= eRow; r++) {
          const lineText = this.doc.getLine(r);
          const top = r * this.lineHeight;

          let startX = 0;
          let endX = 0;

          if (r === range.start.row && r === range.end.row) {
            startX = this.measureSubstring(lineText, range.start.col);
            endX = this.measureSubstring(lineText, range.end.col);
          } else if (r === range.start.row) {
            startX = this.measureSubstring(lineText, range.start.col);
            endX = this.measureSubstring(lineText, lineText.length) + this.charWidth * 0.8;
          } else if (r === range.end.row) {
            startX = 0;
            endX = this.measureSubstring(lineText, range.end.col);
          } else {
            startX = 0;
            endX = this.measureSubstring(lineText, lineText.length) + this.charWidth * 0.8;
          }

          const width = Math.max(3, endX - startX);
          html += `<div class="patchpad-selection-box" style="top:${top}px;left:${startX}px;width:${width}px;height:${this.lineHeight}px;"></div>`;
        }
      }
      this.selectionLayer.innerHTML = html;
    }

    _renderSearchMatches(startRow, endRow) {
      if (!this.findController || this.findController.matches.length === 0) {
        this.searchLayer.innerHTML = '';
        return;
      }

      let html = '';
      const curIndex = this.findController.currentMatchIndex;

      for (let i = 0; i < this.findController.matches.length; i++) {
        const m = this.findController.matches[i];
        if (m.row < startRow || m.row > endRow) continue;

        const lineText = this.doc.getLine(m.row);
        const top = m.row * this.lineHeight;
        const startX = this.measureSubstring(lineText, m.startCol);
        const endX = this.measureSubstring(lineText, m.endCol);
        const width = Math.max(2, endX - startX);
        const isActive = i === curIndex;

        html += `<div class="patchpad-search-match${isActive ? ' active' : ''}" style="top:${top}px;left:${startX}px;width:${width}px;height:${this.lineHeight}px;"></div>`;
      }

      this.searchLayer.innerHTML = html;
    }

    _renderCarets() {
      if (!this.isFocused && !this.options.alwaysShowCaret) {
        // Still show carets when editor is active
      }

      let html = '';
      for (let i = 0; i < this.selectionManager.selections.length; i++) {
        const sel = this.selectionManager.selections[i];
        const pos = sel.head;
        const lineText = this.doc.getLine(pos.row);
        const top = pos.row * this.lineHeight;
        const left = this.measureSubstring(lineText, pos.col);
        const isPrimary = i === 0;

        html += `<div class="patchpad-caret${isPrimary ? ' primary' : ''}" style="top:${top}px;left:${left}px;height:${this.lineHeight}px;"></div>`;
      }
      this.caretsLayer.innerHTML = html;
    }

    _resetCaretBlink() {
      const carets = this.caretsLayer.querySelectorAll('.patchpad-caret');
      carets.forEach(c => {
        c.style.animation = 'none';
        // force reflow
        void c.offsetWidth;
        c.style.animation = '';
      });
    }

    _notifyCursorChange() {
      const p = this.selectionManager.primary.head;
      const lineText = this.doc.getLine(p.row);
      const graphemes = Grapheme.getGraphemes(lineText.substring(0, p.col));

      if (this.options.onCursorChange) {
        this.options.onCursorChange({
          row: p.row,
          col: p.col,
          lineNumber: p.row + 1,
          columnNumber: graphemes.length + 1,
          caretCount: this.selectionManager.selections.length,
          selection: this.selectionManager.primary,
          totalLines: this.doc.lineCount,
          totalChars: this.doc.charCount
        });
      }
    }

    // --- Document & Editing Actions ---

    insertText(text, isTyping = false) {
      if (this.options.readOnly) return;
      const beforeText = this.doc.getText();
      const beforeSelections = this.selectionManager.selections.map(s => s.clone());

      // Sort selections descending so lower positions don't shift higher positions
      const sortedIndexes = this.selectionManager.selections
        .map((s, idx) => ({ sel: s, idx }))
        .sort((a, b) => {
          const rA = a.sel.getRange();
          const rB = b.sel.getRange();
          if (rA.start.row !== rB.start.row) return rB.start.row - rA.start.row;
          return rB.start.col - rA.start.col;
        });

      const newSelections = new Array(this.selectionManager.selections.length);

      // Check if multiline paste with exact caret count match
      const pastedLines = text.split(/\r\n|\r|\n/);
      const isMultiLinePerCaret = !isTyping && pastedLines.length > 1 && pastedLines.length === sortedIndexes.length;

      for (let i = 0; i < sortedIndexes.length; i++) {
        const item = sortedIndexes[i];
        const sel = item.sel;
        const textToInsert = isMultiLinePerCaret ? pastedLines[item.idx] : text;

        if (!sel.isEmpty()) {
          const range = sel.getRange();
          this.doc.deleteRange(range.start, range.end);
          const res = this.doc.insertAt(range.start, textToInsert);
          newSelections[item.idx] = new Selection({ row: res.newRow, col: res.newCol }, { row: res.newRow, col: res.newCol });
        } else {
          const res = this.doc.insertAt(sel.head, textToInsert);
          newSelections[item.idx] = new Selection({ row: res.newRow, col: res.newCol }, { row: res.newRow, col: res.newCol });
        }
      }

      this.selectionManager.selections = newSelections;
      this.selectionManager.normalize();

      const afterText = this.doc.getText();
      const afterSelections = this.selectionManager.selections.map(s => s.clone());

      this.history.recordChange({
        beforeText,
        afterText,
        beforeSelections,
        afterSelections,
        actionType: isTyping && text.length === 1 ? 'type_char' : 'insert',
        caretPos: this.selectionManager.primary.head
      });

      this.render();
      this.scrollCursorIntoView();
      this._resetCaretBlink();
      this._notifyCursorChange();
      if (this.options.onDocChange) {
        this.options.onDocChange(afterText);
      }
    }

    deleteBackward() {
      if (this.options.readOnly) return;
      const beforeText = this.doc.getText();
      const beforeSelections = this.selectionManager.selections.map(s => s.clone());

      const sortedIndexes = this.selectionManager.selections
        .map((s, idx) => ({ sel: s, idx }))
        .sort((a, b) => {
          const rA = a.sel.getRange();
          const rB = b.sel.getRange();
          if (rA.start.row !== rB.start.row) return rB.start.row - rA.start.row;
          return rB.start.col - rA.start.col;
        });

      const newSelections = new Array(this.selectionManager.selections.length);

      for (let i = 0; i < sortedIndexes.length; i++) {
        const item = sortedIndexes[i];
        const sel = item.sel;

        if (!sel.isEmpty()) {
          const range = sel.getRange();
          const res = this.doc.deleteRange(range.start, range.end);
          newSelections[item.idx] = new Selection(res.newPos, res.newPos);
        } else {
          const pos = sel.head;
          if (pos.col > 0) {
            const lineText = this.doc.getLine(pos.row);
            const prevCol = Grapheme.prevGraphemeCol(lineText, pos.col);
            const res = this.doc.deleteRange({ row: pos.row, col: prevCol }, pos);
            newSelections[item.idx] = new Selection(res.newPos, res.newPos);
          } else if (pos.row > 0) {
            const prevRow = pos.row - 1;
            const prevLineLen = this.doc.getLine(prevRow).length;
            const res = this.doc.deleteRange({ row: prevRow, col: prevLineLen }, pos);
            newSelections[item.idx] = new Selection(res.newPos, res.newPos);
          } else {
            newSelections[item.idx] = sel;
          }
        }
      }

      this.selectionManager.selections = newSelections;
      this.selectionManager.normalize();

      const afterText = this.doc.getText();
      const afterSelections = this.selectionManager.selections.map(s => s.clone());

      this.history.recordChange({
        beforeText,
        afterText,
        beforeSelections,
        afterSelections,
        actionType: 'delete_back',
        caretPos: this.selectionManager.primary.head
      });

      this.render();
      this.scrollCursorIntoView();
      this._resetCaretBlink();
      this._notifyCursorChange();
      if (this.options.onDocChange) {
        this.options.onDocChange(afterText);
      }
    }

    deleteForward() {
      if (this.options.readOnly) return;
      const beforeText = this.doc.getText();
      const beforeSelections = this.selectionManager.selections.map(s => s.clone());

      const sortedIndexes = this.selectionManager.selections
        .map((s, idx) => ({ sel: s, idx }))
        .sort((a, b) => {
          const rA = a.sel.getRange();
          const rB = b.sel.getRange();
          if (rA.start.row !== rB.start.row) return rB.start.row - rA.start.row;
          return rB.start.col - rA.start.col;
        });

      const newSelections = new Array(this.selectionManager.selections.length);

      for (let i = 0; i < sortedIndexes.length; i++) {
        const item = sortedIndexes[i];
        const sel = item.sel;

        if (!sel.isEmpty()) {
          const range = sel.getRange();
          const res = this.doc.deleteRange(range.start, range.end);
          newSelections[item.idx] = new Selection(res.newPos, res.newPos);
        } else {
          const pos = sel.head;
          const lineText = this.doc.getLine(pos.row);
          if (pos.col < lineText.length) {
            const nextCol = Grapheme.nextGraphemeCol(lineText, pos.col);
            const res = this.doc.deleteRange(pos, { row: pos.row, col: nextCol });
            newSelections[item.idx] = new Selection(res.newPos, res.newPos);
          } else if (pos.row < this.doc.lineCount - 1) {
            const res = this.doc.deleteRange(pos, { row: pos.row + 1, col: 0 });
            newSelections[item.idx] = new Selection(res.newPos, res.newPos);
          } else {
            newSelections[item.idx] = sel;
          }
        }
      }

      this.selectionManager.selections = newSelections;
      this.selectionManager.normalize();

      const afterText = this.doc.getText();
      const afterSelections = this.selectionManager.selections.map(s => s.clone());

      this.history.recordChange({
        beforeText,
        afterText,
        beforeSelections,
        afterSelections,
        actionType: 'delete_forward',
        caretPos: this.selectionManager.primary.head
      });

      this.render();
      this.scrollCursorIntoView();
      this._resetCaretBlink();
      this._notifyCursorChange();
      if (this.options.onDocChange) {
        this.options.onDocChange(afterText);
      }
    }

    insertNewline() {
      if (this.options.readOnly) return;
      // Extract leading indent from primary line for auto-indent
      const p = this.selectionManager.primary.head;
      const currentLine = this.doc.getLine(p.row);
      const matchIndent = currentLine.match(/^\s*/);
      const indent = matchIndent ? matchIndent[0] : '';

      this.insertText('\n' + indent, false);
    }

    indent() {
      if (this.options.readOnly) return;
      // If single collapsed selection, insert spaces
      if (this.selectionManager.selections.length === 1 && this.selectionManager.primary.isEmpty()) {
        this.insertText('  ', false);
        return;
      }

      const beforeText = this.doc.getText();
      const beforeSelections = this.selectionManager.selections.map(s => s.clone());

      for (const sel of this.selectionManager.selections) {
        const range = sel.getRange();
        this.doc.indentLines(range.start.row, range.end.row, '  ');
        sel.anchor.col += 2;
        sel.head.col += 2;
      }

      this.selectionManager.normalize();
      const afterText = this.doc.getText();
      const afterSelections = this.selectionManager.selections.map(s => s.clone());

      this.history.recordChange({
        beforeText,
        afterText,
        beforeSelections,
        afterSelections,
        actionType: 'indent'
      });

      this.render();
      this._notifyCursorChange();
      if (this.options.onDocChange) {
        this.options.onDocChange(afterText);
      }
    }

    unindent() {
      if (this.options.readOnly) return;
      const beforeText = this.doc.getText();
      const beforeSelections = this.selectionManager.selections.map(s => s.clone());

      for (const sel of this.selectionManager.selections) {
        const range = sel.getRange();
        const removed = this.doc.unindentLines(range.start.row, range.end.row, '  ');
        sel.anchor.col = Math.max(0, sel.anchor.col - (removed[0] || 0));
        sel.head.col = Math.max(0, sel.head.col - (removed[removed.length - 1] || 0));
      }

      this.selectionManager.normalize();
      const afterText = this.doc.getText();
      const afterSelections = this.selectionManager.selections.map(s => s.clone());

      this.history.recordChange({
        beforeText,
        afterText,
        beforeSelections,
        afterSelections,
        actionType: 'unindent'
      });

      this.render();
      this._notifyCursorChange();
      if (this.options.onDocChange) {
        this.options.onDocChange(afterText);
      }
    }

    undo() {
      if (this.options.readOnly) return;
      const res = this.history.undo(this.doc.getText());
      if (!res) return;

      this.doc.setText(res.text);
      this.selectionManager.selections = res.selections;
      this.selectionManager.normalize();

      this.render();
      this.scrollCursorIntoView();
      this._notifyCursorChange();
      if (this.options.onDocChange) {
        this.options.onDocChange(res.text);
      }
    }

    redo() {
      if (this.options.readOnly) return;
      const res = this.history.redo(this.doc.getText());
      if (!res) return;

      this.doc.setText(res.text);
      this.selectionManager.selections = res.selections;
      this.selectionManager.normalize();

      this.render();
      this.scrollCursorIntoView();
      this._notifyCursorChange();
      if (this.options.onDocChange) {
        this.options.onDocChange(res.text);
      }
    }

    restoreRevisionContent(content) {
      const beforeText = this.doc.getText();
      const beforeSelections = this.selectionManager.selections.map(s => s.clone());

      this.doc.setText(content);
      this.selectionManager.setSingleCaret(0, 0);

      const afterSelections = this.selectionManager.selections.map(s => s.clone());

      // Pushes onto undo stack so restoring can be undone!
      this.history.recordChange({
        beforeText,
        afterText: content,
        beforeSelections,
        afterSelections,
        actionType: 'restore'
      });

      this.render();
      this.scrollCursorIntoView();
      this._notifyCursorChange();
      if (this.options.onDocChange) {
        this.options.onDocChange(content);
      }
    }

    // --- Cursor Navigation ---

    moveLeft(extend = false, byWord = false) {
      for (const sel of this.selectionManager.selections) {
        if (!extend && !sel.isEmpty() && !byWord) {
          const range = sel.getRange();
          sel.anchor = { ...range.start };
          sel.head = { ...range.start };
          continue;
        }

        let nextPos;
        if (byWord) {
          nextPos = this.doc.findPrevWord(sel.head.row, sel.head.col);
        } else {
          const lineText = this.doc.getLine(sel.head.row);
          if (sel.head.col > 0) {
            const prevCol = Grapheme.prevGraphemeCol(lineText, sel.head.col);
            nextPos = { row: sel.head.row, col: prevCol };
          } else if (sel.head.row > 0) {
            const prevRow = sel.head.row - 1;
            nextPos = { row: prevRow, col: this.doc.getLine(prevRow).length };
          } else {
            nextPos = { row: 0, col: 0 };
          }
        }

        sel.head = nextPos;
        if (!extend) {
          sel.anchor = { ...nextPos };
        }
      }

      this.selectionManager.normalize();
      this.render();
      this.scrollCursorIntoView();
      this._resetCaretBlink();
      this._notifyCursorChange();
    }

    moveRight(extend = false, byWord = false) {
      for (const sel of this.selectionManager.selections) {
        if (!extend && !sel.isEmpty() && !byWord) {
          const range = sel.getRange();
          sel.anchor = { ...range.end };
          sel.head = { ...range.end };
          continue;
        }

        let nextPos;
        if (byWord) {
          nextPos = this.doc.findNextWord(sel.head.row, sel.head.col);
        } else {
          const lineText = this.doc.getLine(sel.head.row);
          if (sel.head.col < lineText.length) {
            const nextCol = Grapheme.nextGraphemeCol(lineText, sel.head.col);
            nextPos = { row: sel.head.row, col: nextCol };
          } else if (sel.head.row < this.doc.lineCount - 1) {
            nextPos = { row: sel.head.row + 1, col: 0 };
          } else {
            nextPos = { row: sel.head.row, col: lineText.length };
          }
        }

        sel.head = nextPos;
        if (!extend) {
          sel.anchor = { ...nextPos };
        }
      }

      this.selectionManager.normalize();
      this.render();
      this.scrollCursorIntoView();
      this._resetCaretBlink();
      this._notifyCursorChange();
    }

    moveUp(extend = false, numLines = 1) {
      for (const sel of this.selectionManager.selections) {
        const targetRow = Math.max(0, sel.head.row - numLines);
        const targetLine = this.doc.getLine(targetRow);
        const targetCol = Grapheme.clampCol(targetLine, sel.head.col);
        const nextPos = { row: targetRow, col: targetCol };

        sel.head = nextPos;
        if (!extend) {
          sel.anchor = { ...nextPos };
        }
      }

      this.selectionManager.normalize();
      this.render();
      this.scrollCursorIntoView();
      this._resetCaretBlink();
      this._notifyCursorChange();
    }

    moveDown(extend = false, numLines = 1) {
      for (const sel of this.selectionManager.selections) {
        const targetRow = Math.min(this.doc.lineCount - 1, sel.head.row + numLines);
        const targetLine = this.doc.getLine(targetRow);
        const targetCol = Grapheme.clampCol(targetLine, sel.head.col);
        const nextPos = { row: targetRow, col: targetCol };

        sel.head = nextPos;
        if (!extend) {
          sel.anchor = { ...nextPos };
        }
      }

      this.selectionManager.normalize();
      this.render();
      this.scrollCursorIntoView();
      this._resetCaretBlink();
      this._notifyCursorChange();
    }

    moveHome(extend = false, toDocStart = false) {
      if (toDocStart) {
        for (const sel of this.selectionManager.selections) {
          sel.head = { row: 0, col: 0 };
          if (!extend) sel.anchor = { row: 0, col: 0 };
        }
      } else {
        for (const sel of this.selectionManager.selections) {
          const lineText = this.doc.getLine(sel.head.row);
          const firstNonWs = lineText.search(/\S/);
          let targetCol = 0;
          if (firstNonWs >= 0 && sel.head.col !== firstNonWs) {
            targetCol = firstNonWs;
          }
          sel.head = { row: sel.head.row, col: targetCol };
          if (!extend) sel.anchor = { row: sel.head.row, col: targetCol };
        }
      }

      this.selectionManager.normalize();
      this.render();
      this.scrollCursorIntoView();
      this._resetCaretBlink();
      this._notifyCursorChange();
    }

    moveEnd(extend = false, toDocEnd = false) {
      if (toDocEnd) {
        const lastRow = this.doc.lineCount - 1;
        const lastCol = this.doc.getLine(lastRow).length;
        for (const sel of this.selectionManager.selections) {
          sel.head = { row: lastRow, col: lastCol };
          if (!extend) sel.anchor = { row: lastRow, col: lastCol };
        }
      } else {
        for (const sel of this.selectionManager.selections) {
          const lineLen = this.doc.getLine(sel.head.row).length;
          sel.head = { row: sel.head.row, col: lineLen };
          if (!extend) sel.anchor = { row: sel.head.row, col: lineLen };
        }
      }

      this.selectionManager.normalize();
      this.render();
      this.scrollCursorIntoView();
      this._resetCaretBlink();
      this._notifyCursorChange();
    }

    selectAll() {
      this.selectionManager.selectAll(this.doc);
      this.render();
      this._notifyCursorChange();
    }

    selectLine(row) {
      this.selectionManager.selectLine(this.doc, row);
      this.render();
      this._notifyCursorChange();
    }

    selectWord(row, col) {
      this.selectionManager.selectWord(this.doc, row, col);
      this.render();
      this._notifyCursorChange();
    }

    selectMatch(match) {
      if (!match) return;
      this.selectionManager.selections = [
        new Selection({ row: match.row, col: match.startCol }, { row: match.row, col: match.endCol })
      ];
      this.render();
      this.scrollCursorIntoView({ row: match.row, col: match.startCol });
      this._notifyCursorChange();
    }

    getSelectedText() {
      const parts = [];
      for (const sel of this.selectionManager.selections) {
        if (!sel.isEmpty()) {
          const range = sel.getRange();
          parts.push(this.doc.getRangeText(range.start, range.end));
        }
      }
      return parts.join('\n');
    }

    replaceSelection(text) {
      this.insertText(text, false);
    }

    // --- Event Binding ---

    _bindEvents() {
      // Synchronize scroll between gutter and viewport
      this.viewport.addEventListener('scroll', () => {
        this.gutter.scrollTop = this.viewport.scrollTop;
        this.render();
      }, { passive: true });

      // Focus / Blur
      this.container.addEventListener('focus', () => {
        this.isFocused = true;
        this.container.classList.add('focused');
        this.render();
      });

      this.container.addEventListener('blur', () => {
        this.isFocused = false;
        this.container.classList.remove('focused');
        this.render();
      });

      // Mouse Down on viewport
      this.viewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Left click only
        this.container.focus();

        const pos = this.posFromCoords(e.clientX, e.clientY);

        if (e.altKey || e.ctrlKey || e.metaKey) {
          // Multi-caret add
          this.selectionManager.addCaret(pos.row, pos.col);
        } else if (e.shiftKey) {
          // Extend primary selection
          this.selectionManager.primary.head = pos;
          this.selectionManager.normalize();
        } else {
          // Double / Triple click
          if (e.detail === 2) {
            this.selectWord(pos.row, pos.col);
            return;
          } else if (e.detail >= 3) {
            this.selectLine(pos.row);
            return;
          }

          this.selectionManager.setSingleCaret(pos.row, pos.col);
        }

        this.isDragging = true;
        this.dragStartPos = pos;
        this.render();
        this._notifyCursorChange();
      });

      // Window mouse move (for drag selection)
      window.addEventListener('mousemove', (e) => {
        if (!this.isDragging) return;

        const pos = this.posFromCoords(e.clientX, e.clientY);
        this.selectionManager.primary.head = pos;
        this.selectionManager.normalize();
        this.render();
        this._notifyCursorChange();

        // Auto-scroll when dragging near viewport boundaries
        const rect = this.viewport.getBoundingClientRect();
        if (e.clientY < rect.top + 30) {
          this.viewport.scrollTop -= 20;
        } else if (e.clientY > rect.bottom - 30) {
          this.viewport.scrollTop += 20;
        }
      });

      window.addEventListener('mouseup', () => {
        if (this.isDragging) {
          this.isDragging = false;
          this.dragStartPos = null;
        }
      });

      // Click on gutter line number
      this.gutter.addEventListener('mousedown', (e) => {
        const lineElem = e.target.closest('.patchpad-gutter-line');
        if (!lineElem) return;
        const row = parseInt(lineElem.getAttribute('data-row'), 10);
        if (!isNaN(row)) {
          this.container.focus();
          this.selectLine(row);
        }
      });

      // Keyboard events
      this.container.addEventListener('keydown', (e) => this._handleKeyDown(e));

      // Clipboard events
      this.container.addEventListener('copy', (e) => this._handleCopy(e));
      this.container.addEventListener('cut', (e) => this._handleCut(e));
      this.container.addEventListener('paste', (e) => this._handlePaste(e));
    }

    _handleKeyDown(e) {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Handle shortcuts
      if (modKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        this.selectAll();
        return;
      }

      if (modKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.undo();
        return;
      }

      if ((modKey && e.key.toLowerCase() === 'y') || (modKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        this.redo();
        return;
      }

      if (modKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (this.options.onSaveRequest) {
          this.options.onSaveRequest();
        }
        return;
      }

      if (modKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (this.options.onFindRequest) {
          this.options.onFindRequest(false);
        }
        return;
      }

      if (modKey && !e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        if (this.options.onFindRequest) {
          this.options.onFindRequest(true);
        }
        return;
      }

      // Escape key
      if (e.key === 'Escape') {
        e.preventDefault();
        if (this.options.onEscape) {
          this.options.onEscape();
        }
        return;
      }

      // Tab and Shift+Tab
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          this.unindent();
        } else {
          this.indent();
        }
        return;
      }

      // Navigation & editing keys
      const byWord = isMac ? e.altKey : e.ctrlKey;
      const toDocEnds = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.moveLeft(e.shiftKey, byWord);
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.moveRight(e.shiftKey, byWord);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (toDocEnds) {
          this.moveHome(e.shiftKey, true);
        } else {
          this.moveUp(e.shiftKey);
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (toDocEnds) {
          this.moveEnd(e.shiftKey, true);
        } else {
          this.moveDown(e.shiftKey);
        }
        return;
      }

      if (e.key === 'Home') {
        e.preventDefault();
        this.moveHome(e.shiftKey, toDocEnds);
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        this.moveEnd(e.shiftKey, toDocEnds);
        return;
      }

      if (e.key === 'PageUp') {
        e.preventDefault();
        const linesPerPage = Math.max(1, Math.floor(this.viewport.clientHeight / this.lineHeight) - 2);
        this.moveUp(e.shiftKey, linesPerPage);
        return;
      }

      if (e.key === 'PageDown') {
        e.preventDefault();
        const linesPerPage = Math.max(1, Math.floor(this.viewport.clientHeight / this.lineHeight) - 2);
        this.moveDown(e.shiftKey, linesPerPage);
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        this.deleteBackward();
        return;
      }

      if (e.key === 'Delete') {
        e.preventDefault();
        this.deleteForward();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        this.insertNewline();
        return;
      }

      // Regular character typing
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.insertText(e.key, true);
        return;
      }
    }

    _handleCopy(e) {
      const text = this.getSelectedText();
      if (!text) return;
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', text);
      }
    }

    _handleCut(e) {
      if (this.options.readOnly) return;
      const text = this.getSelectedText();
      if (!text) return;
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', text);
      }
      this.deleteBackward();
    }

    _handlePaste(e) {
      if (this.options.readOnly) return;
      e.preventDefault();
      const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
      if (text) {
        this.insertText(text, false);
      }
    }
  }

  if (typeof window !== 'undefined') window.EditorView = EditorView;
  if (typeof global !== 'undefined') global.EditorView = EditorView;
  if (typeof module !== 'undefined' && module.exports) module.exports = EditorView;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

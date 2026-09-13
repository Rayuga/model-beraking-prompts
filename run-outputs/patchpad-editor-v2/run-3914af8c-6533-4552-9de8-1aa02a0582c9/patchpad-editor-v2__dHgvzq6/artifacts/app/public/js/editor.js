/**
 * PatchPad Custom DOM-based Text Editor Engine
 * Pure custom DOM rendering - no textarea, contenteditable, or external editor dependencies.
 */

class PatchPadEditor {
  constructor(container, options = {}) {
    this.container = container;
    this.options = Object.assign({
      lineHeight: 24,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Consolas, Menlo, Monaco, monospace",
      fontSize: 14,
      tabSize: 2,
      onDirtyChange: () => {},
      onCursorChange: () => {},
      onHistoryChange: () => {},
      onEscape: () => {},
      onFindRequest: () => {},
      onSaveRequest: () => {}
    }, options);

    this.lines = [''];
    this.carets = [{ anchor: { line: 0, col: 0 }, head: { line: 0, col: 0 } }];
    this.activeCaretIdx = 0;

    // Measurement & Virtualization
    this.charWidth = 8.4;
    this.lineHeight = this.options.lineHeight;
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.viewportHeight = 600;
    this.viewportWidth = 800;

    // Undo / Redo
    this.undoStack = [];
    this.redoStack = [];
    this.lastEditType = null;
    this.lastEditTime = 0;

    // Find state
    this.findMatchesList = [];
    this.activeFindIndex = -1;

    // Grapheme Segmenter
    this.segmenter = (typeof Intl !== 'undefined' && Intl.Segmenter)
      ? new Intl.Segmenter('en', { granularity: 'grapheme' })
      : null;

    // Mouse tracking
    this.isMouseDown = false;
    this.dragStartPos = null;
    this.autoScrollTimer = null;

    // Caret blink
    this.caretVisible = true;
    this.caretBlinkTimer = null;

    this.initDOM();
    this.measureFont();
    this.bindEvents();
    this.startCaretBlink();
  }

  /* ----------------------------------------------------
     DOM Initialization
     ---------------------------------------------------- */
  initDOM() {
    this.container.classList.add('patchpad-editor-root');
    this.container.setAttribute('tabindex', '0');
    this.container.setAttribute('role', 'textbox');
    this.container.setAttribute('aria-multiline', 'true');
    this.container.setAttribute('aria-label', 'Incident Report Content Editor');

    this.container.innerHTML = `
      <div class="patchpad-editor-layout">
        <div class="patchpad-gutter" aria-hidden="true">
          <div class="patchpad-gutter-content"></div>
        </div>
        <div class="patchpad-scroll-view">
          <div class="patchpad-scroll-phantom"></div>
          <div class="patchpad-view-content">
            <div class="patchpad-selection-layer"></div>
            <div class="patchpad-find-layer"></div>
            <div class="patchpad-lines-layer"></div>
            <div class="patchpad-carets-layer"></div>
          </div>
        </div>
      </div>
      <textarea class="patchpad-hidden-input" aria-hidden="true" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" tabindex="-1" style="position: absolute; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; padding: 0; margin: 0; border: none; outline: none; resize: none; overflow: hidden; pointer-events: none; z-index: -1;"></textarea>
      <div class="patchpad-font-ruler" aria-hidden="true">MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM</div>
    `;

    this.layoutEl = this.container.querySelector('.patchpad-editor-layout');
    this.gutterEl = this.container.querySelector('.patchpad-gutter');
    this.gutterContentEl = this.container.querySelector('.patchpad-gutter-content');
    this.scrollViewEl = this.container.querySelector('.patchpad-scroll-view');
    this.scrollPhantomEl = this.container.querySelector('.patchpad-scroll-phantom');
    this.viewContentEl = this.container.querySelector('.patchpad-view-content');
    this.selectionLayerEl = this.container.querySelector('.patchpad-selection-layer');
    this.findLayerEl = this.container.querySelector('.patchpad-find-layer');
    this.linesLayerEl = this.container.querySelector('.patchpad-lines-layer');
    this.caretsLayerEl = this.container.querySelector('.patchpad-carets-layer');
    this.fontRulerEl = this.container.querySelector('.patchpad-font-ruler');
    this.hiddenInputEl = this.container.querySelector('.patchpad-hidden-input');
  }

  measureFont() {
    if (this.fontRulerEl) {
      const rect = this.fontRulerEl.getBoundingClientRect();
      if (rect.width > 0) {
        this.charWidth = rect.width / 40;
      }
      if (rect.height > 0) {
        this.lineHeight = Math.round(rect.height) || this.options.lineHeight;
      }
    }
  }

  /* ----------------------------------------------------
     Unicode / Grapheme Cluster Utilities
     ---------------------------------------------------- */
  getGraphemes(text) {
    if (!this.segmenter) {
      // Fallback
      return Array.from(text).map((c, i) => ({ segment: c, index: i, length: c.length }));
    }
    return [...this.segmenter.segment(text)].map(s => ({
      segment: s.segment,
      index: s.index,
      length: s.segment.length
    }));
  }

  nextGraphemeCol(line, col) {
    const gs = this.getGraphemes(line);
    for (const g of gs) {
      if (g.index > col) return g.index;
    }
    return line.length;
  }

  prevGraphemeCol(line, col) {
    const gs = this.getGraphemes(line);
    for (let i = gs.length - 1; i >= 0; i--) {
      if (gs[i].index < col) return gs[i].index;
    }
    return 0;
  }

  deleteGraphemeBefore(line, col) {
    if (col <= 0) return { newLine: line, newCol: 0 };
    const prevCol = this.prevGraphemeCol(line, col);
    const newLine = line.slice(0, prevCol) + line.slice(col);
    return { newLine, newCol: prevCol };
  }

  deleteGraphemeAfter(line, col) {
    if (col >= line.length) return { newLine: line, newCol: col };
    const nextCol = this.nextGraphemeCol(line, col);
    const newLine = line.slice(0, col) + line.slice(nextCol);
    return { newLine, newCol: col };
  }

  isWordChar(c) {
    return c && /[\p{L}\p{N}_]/u.test(c);
  }

  nextWordCol(line, col) {
    const len = line.length;
    if (col >= len) return len;
    let i = col;
    if (this.isWordChar(line[i])) {
      while (i < len && this.isWordChar(line[i])) i++;
      return i;
    }
    if (!/\s/.test(line[i])) {
      while (i < len && !this.isWordChar(line[i]) && !/\s/.test(line[i])) i++;
      return i;
    }
    while (i < len && /\s/.test(line[i])) i++;
    while (i < len && this.isWordChar(line[i])) i++;
    return i;
  }

  prevWordCol(line, col) {
    if (col <= 0) return 0;
    let i = col;
    while (i > 0 && !this.isWordChar(line[i - 1]) && /\s/.test(line[i - 1])) i--;
    if (i > 0 && !this.isWordChar(line[i - 1])) {
      while (i > 0 && !this.isWordChar(line[i - 1]) && !/\s/.test(line[i - 1])) i--;
      return i;
    }
    while (i > 0 && this.isWordChar(line[i - 1])) i--;
    return i;
  }

  /* ----------------------------------------------------
     Content & State Accessors
     ---------------------------------------------------- */
  getText() {
    return this.lines.join('\n');
  }

  setText(text, isExternalLoad = false) {
    const prevText = this.getText();
    const prevCarets = this.cloneCarets();

    this.lines = text.split('\n');
    if (this.lines.length === 0) this.lines = [''];

    // Clamp carets
    this.carets = this.carets.map(c => ({
      anchor: this.clampPos(c.anchor),
      head: this.clampPos(c.head)
    }));

    if (isExternalLoad) {
      this.undoStack = [];
      this.redoStack = [];
      this.carets = [{ anchor: { line: 0, col: 0 }, head: { line: 0, col: 0 } }];
      this.activeCaretIdx = 0;
    } else {
      this.pushUndoSnapshot(
        { text: prevText, carets: prevCarets },
        { text: this.getText(), carets: this.cloneCarets() },
        'restore'
      );
    }

    this.updateScrollPhantom();
    this.render();
    this.notifyChange();
  }

  clampPos(pos) {
    const line = Math.max(0, Math.min(pos.line, this.lines.length - 1));
    const maxCol = this.lines[line] ? this.lines[line].length : 0;
    const col = Math.max(0, Math.min(pos.col, maxCol));
    return { line, col };
  }

  cloneCarets() {
    return this.carets.map(c => ({
      anchor: { line: c.anchor.line, col: c.anchor.col },
      head: { line: c.head.line, col: c.head.col }
    }));
  }

  comparePos(a, b) {
    if (a.line !== b.line) return a.line - b.line;
    return a.col - b.col;
  }

  getNormalizedCaret(caret) {
    if (this.comparePos(caret.anchor, caret.head) <= 0) {
      return { start: { ...caret.anchor }, end: { ...caret.head } };
    }
    return { start: { ...caret.head }, end: { ...caret.anchor } };
  }

  hasSelection(caret = this.carets[0]) {
    return caret.anchor.line !== caret.head.line || caret.anchor.col !== caret.head.col;
  }

  getSelectedText(caret = this.carets[0]) {
    const { start, end } = this.getNormalizedCaret(caret);
    if (start.line === end.line && start.col === end.col) return '';
    if (start.line === end.line) {
      return this.lines[start.line].slice(start.col, end.col);
    }
    const result = [];
    result.push(this.lines[start.line].slice(start.col));
    for (let i = start.line + 1; i < end.line; i++) {
      result.push(this.lines[i]);
    }
    result.push(this.lines[end.line].slice(0, end.col));
    return result.join('\n');
  }

  getAllSelectedText() {
    const texts = this.carets.map(c => this.getSelectedText(c)).filter(t => t.length > 0);
    return texts.join('\n');
  }

  /* ----------------------------------------------------
     Undo / Redo System
     ---------------------------------------------------- */
  pushUndoSnapshot(beforeState, afterState, type) {
    const now = Date.now();

    // Group consecutive single-character typing at same location
    if (
      type === 'type' &&
      this.lastEditType === 'type' &&
      this.undoStack.length > 0 &&
      now - this.lastEditTime < 1500
    ) {
      // Update top undo entry after state
      this.undoStack[this.undoStack.length - 1].after = afterState;
    } else {
      this.undoStack.push({
        before: beforeState,
        after: afterState,
        type: type,
        time: now
      });
    }

    this.redoStack = [];
    this.lastEditType = type;
    this.lastEditTime = now;
    this.options.onHistoryChange(this.canUndo(), this.canRedo());
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return;
    const entry = this.undoStack.pop();
    this.redoStack.push(entry);

    this.lines = entry.before.text.split('\n');
    this.carets = entry.before.carets.map(c => ({
      anchor: { ...c.anchor },
      head: { ...c.head }
    }));
    this.lastEditType = null;

    this.updateScrollPhantom();
    this.scrollToCaret();
    this.render();
    this.notifyChange();
    this.options.onHistoryChange(this.canUndo(), this.canRedo());
  }

  redo() {
    if (!this.canRedo()) return;
    const entry = this.redoStack.pop();
    this.undoStack.push(entry);

    this.lines = entry.after.text.split('\n');
    this.carets = entry.after.carets.map(c => ({
      anchor: { ...c.anchor },
      head: { ...c.head }
    }));
    this.lastEditType = null;

    this.updateScrollPhantom();
    this.scrollToCaret();
    this.render();
    this.notifyChange();
    this.options.onHistoryChange(this.canUndo(), this.canRedo());
  }

  /* ----------------------------------------------------
     Editing Mutations (Multi-Caret Aware)
     ---------------------------------------------------- */
  executeMutation(mutationFn, type = 'edit') {
    const beforeText = this.getText();
    const beforeCarets = this.cloneCarets();

    mutationFn();

    const afterText = this.getText();
    const afterCarets = this.cloneCarets();

    this.pushUndoSnapshot(
      { text: beforeText, carets: beforeCarets },
      { text: afterText, carets: afterCarets },
      type
    );

    this.updateScrollPhantom();
    this.scrollToCaret();
    this.render();
    this.notifyChange();
  }

  // Inserts text (supports multi-caret and selection replacement)
  insertText(text, editType = 'type') {
    this.executeMutation(() => {
      // Sort carets bottom to top
      const sortedIndices = this.carets.map((c, i) => i).sort((a, b) => {
        const normA = this.getNormalizedCaret(this.carets[a]);
        const normB = this.getNormalizedCaret(this.carets[b]);
        return this.comparePos(normB.start, normA.start);
      });

      const newCarets = [...this.carets];

      for (const idx of sortedIndices) {
        const caret = this.carets[idx];
        const { start, end } = this.getNormalizedCaret(caret);

        // Delete selection span
        const linesBefore = this.lines.slice(0, start.line);
        const startLinePrefix = this.lines[start.line].slice(0, start.col);
        const endLineSuffix = this.lines[end.line].slice(end.col);
        const linesAfter = this.lines.slice(end.line + 1);

        const textLines = text.split('\n');
        let newPos = { line: 0, col: 0 };

        if (textLines.length === 1) {
          const mergedLine = startLinePrefix + textLines[0] + endLineSuffix;
          this.lines = [...linesBefore, mergedLine, ...linesAfter];
          newPos = { line: start.line, col: startLinePrefix.length + textLines[0].length };
        } else {
          const firstLine = startLinePrefix + textLines[0];
          const middleLines = textLines.slice(1, -1);
          const lastLine = textLines[textLines.length - 1] + endLineSuffix;
          this.lines = [...linesBefore, firstLine, ...middleLines, lastLine, ...linesAfter];
          newPos = {
            line: start.line + textLines.length - 1,
            col: textLines[textLines.length - 1].length
          };
        }

        newCarets[idx] = { anchor: { ...newPos }, head: { ...newPos } };
      }

      this.carets = this.mergeCarets(newCarets);
    }, editType);
  }

  deleteBackward() {
    this.executeMutation(() => {
      const sortedIndices = this.carets.map((c, i) => i).sort((a, b) => {
        const normA = this.getNormalizedCaret(this.carets[a]);
        const normB = this.getNormalizedCaret(this.carets[b]);
        return this.comparePos(normB.start, normA.start);
      });

      const newCarets = [...this.carets];

      for (const idx of sortedIndices) {
        const caret = this.carets[idx];

        if (this.hasSelection(caret)) {
          // Delete selection
          const { start, end } = this.getNormalizedCaret(caret);
          const linesBefore = this.lines.slice(0, start.line);
          const startLinePrefix = this.lines[start.line].slice(0, start.col);
          const endLineSuffix = this.lines[end.line].slice(end.col);
          const linesAfter = this.lines.slice(end.line + 1);

          this.lines = [...linesBefore, startLinePrefix + endLineSuffix, ...linesAfter];
          newCarets[idx] = { anchor: { ...start }, head: { ...start } };
        } else {
          const { line, col } = caret.head;
          if (col > 0) {
            // Delete grapheme before col
            const { newLine, newCol } = this.deleteGraphemeBefore(this.lines[line], col);
            this.lines[line] = newLine;
            newCarets[idx] = { anchor: { line, col: newCol }, head: { line, col: newCol } };
          } else if (line > 0) {
            // Merge with previous line
            const prevLineLen = this.lines[line - 1].length;
            this.lines[line - 1] = this.lines[line - 1] + this.lines[line];
            this.lines.splice(line, 1);
            const newPos = { line: line - 1, col: prevLineLen };
            newCarets[idx] = { anchor: newPos, head: newPos };
          }
        }
      }

      this.carets = this.mergeCarets(newCarets);
    }, 'delete');
  }

  deleteForward() {
    this.executeMutation(() => {
      const sortedIndices = this.carets.map((c, i) => i).sort((a, b) => {
        const normA = this.getNormalizedCaret(this.carets[a]);
        const normB = this.getNormalizedCaret(this.carets[b]);
        return this.comparePos(normB.start, normA.start);
      });

      const newCarets = [...this.carets];

      for (const idx of sortedIndices) {
        const caret = this.carets[idx];

        if (this.hasSelection(caret)) {
          // Delete selection
          const { start, end } = this.getNormalizedCaret(caret);
          const linesBefore = this.lines.slice(0, start.line);
          const startLinePrefix = this.lines[start.line].slice(0, start.col);
          const endLineSuffix = this.lines[end.line].slice(end.col);
          const linesAfter = this.lines.slice(end.line + 1);

          this.lines = [...linesBefore, startLinePrefix + endLineSuffix, ...linesAfter];
          newCarets[idx] = { anchor: { ...start }, head: { ...start } };
        } else {
          const { line, col } = caret.head;
          if (col < this.lines[line].length) {
            // Delete grapheme after col
            const { newLine, newCol } = this.deleteGraphemeAfter(this.lines[line], col);
            this.lines[line] = newLine;
            newCarets[idx] = { anchor: { line, col: newCol }, head: { line, col: newCol } };
          } else if (line < this.lines.length - 1) {
            // Merge with next line
            this.lines[line] = this.lines[line] + this.lines[line + 1];
            this.lines.splice(line + 1, 1);
            newCarets[idx] = { anchor: { line, col }, head: { line, col } };
          }
        }
      }

      this.carets = this.mergeCarets(newCarets);
    }, 'delete');
  }

  indent() {
    const hasMultiline = this.carets.some(c => c.anchor.line !== c.head.line);
    if (!hasMultiline && this.carets.length === 1 && !this.hasSelection()) {
      this.insertText('  ', 'indent');
      return;
    }

    this.executeMutation(() => {
      // Find all affected lines
      const affectedLines = new Set();
      for (const caret of this.carets) {
        const { start, end } = this.getNormalizedCaret(caret);
        const endLine = (end.col === 0 && end.line > start.line) ? end.line - 1 : end.line;
        for (let l = start.line; l <= endLine; l++) {
          affectedLines.add(l);
        }
      }

      for (const lineIdx of affectedLines) {
        this.lines[lineIdx] = '  ' + this.lines[lineIdx];
      }

      // Shift carets
      this.carets = this.carets.map(c => ({
        anchor: { line: c.anchor.line, col: c.anchor.col + 2 },
        head: { line: c.head.line, col: c.head.col + 2 }
      }));
    }, 'indent');
  }

  unindent() {
    this.executeMutation(() => {
      const affectedLines = new Set();
      for (const caret of this.carets) {
        const { start, end } = this.getNormalizedCaret(caret);
        const endLine = (end.col === 0 && end.line > start.line) ? end.line - 1 : end.line;
        for (let l = start.line; l <= endLine; l++) {
          affectedLines.add(l);
        }
      }

      const lineShifts = {};
      for (const lineIdx of affectedLines) {
        const line = this.lines[lineIdx];
        let spacesToRemove = 0;
        if (line.startsWith('  ')) spacesToRemove = 2;
        else if (line.startsWith(' ') || line.startsWith('\t')) spacesToRemove = 1;

        if (spacesToRemove > 0) {
          this.lines[lineIdx] = line.slice(spacesToRemove);
          lineShifts[lineIdx] = spacesToRemove;
        }
      }

      this.carets = this.carets.map(c => {
        const anchorShift = lineShifts[c.anchor.line] || 0;
        const headShift = lineShifts[c.head.line] || 0;
        return {
          anchor: { line: c.anchor.line, col: Math.max(0, c.anchor.col - anchorShift) },
          head: { line: c.head.line, col: Math.max(0, c.head.col - headShift) }
        };
      });
    }, 'unindent');
  }

  mergeCarets(carets) {
    if (carets.length <= 1) return carets;
    // Deduplicate identical positions
    const unique = [];
    for (const c of carets) {
      const exists = unique.some(
        u => u.anchor.line === c.anchor.line &&
             u.anchor.col === c.anchor.col &&
             u.head.line === c.head.line &&
             u.head.col === c.head.col
      );
      if (!exists) unique.push(c);
    }
    return unique.length > 0 ? unique : [carets[0]];
  }

  /* ----------------------------------------------------
     Cursor Navigation
     ---------------------------------------------------- */
  moveCaret(direction, { shift = false, word = false, doc = false, lineEdge = false } = {}) {
    this.resetCaretBlink();

    this.carets = this.carets.map(caret => {
      let head = { ...caret.head };
      const currentLine = this.lines[head.line] || '';

      if (doc) {
        if (direction === 'up' || direction === 'left') {
          head = { line: 0, col: 0 };
        } else {
          const lastLine = this.lines.length - 1;
          head = { line: lastLine, col: this.lines[lastLine].length };
        }
      } else if (lineEdge) {
        if (direction === 'left') {
          head.col = 0;
        } else if (direction === 'right') {
          head.col = currentLine.length;
        }
      } else if (word) {
        if (direction === 'left') {
          if (head.col === 0 && head.line > 0) {
            head.line--;
            head.col = this.lines[head.line].length;
          } else {
            head.col = this.prevWordCol(currentLine, head.col);
          }
        } else if (direction === 'right') {
          if (head.col >= currentLine.length && head.line < this.lines.length - 1) {
            head.line++;
            head.col = 0;
          } else {
            head.col = this.nextWordCol(currentLine, head.col);
          }
        }
      } else {
        // Simple 1-step move
        if (direction === 'left') {
          if (!shift && this.hasSelection(caret)) {
            head = this.getNormalizedCaret(caret).start;
          } else if (head.col > 0) {
            head.col = this.prevGraphemeCol(currentLine, head.col);
          } else if (head.line > 0) {
            head.line--;
            head.col = this.lines[head.line].length;
          }
        } else if (direction === 'right') {
          if (!shift && this.hasSelection(caret)) {
            head = this.getNormalizedCaret(caret).end;
          } else if (head.col < currentLine.length) {
            head.col = this.nextGraphemeCol(currentLine, head.col);
          } else if (head.line < this.lines.length - 1) {
            head.line++;
            head.col = 0;
          }
        } else if (direction === 'up') {
          if (head.line > 0) {
            head.line--;
            head.col = Math.min(head.col, this.lines[head.line].length);
          } else {
            head.col = 0;
          }
        } else if (direction === 'down') {
          if (head.line < this.lines.length - 1) {
            head.line++;
            head.col = Math.min(head.col, this.lines[head.line].length);
          } else {
            head.col = currentLine.length;
          }
        }
      }

      const anchor = shift ? { ...caret.anchor } : { ...head };
      return { anchor, head };
    });

    this.scrollToCaret();
    this.render();
    this.notifyCursor();
  }

  selectAll() {
    const lastLine = this.lines.length - 1;
    this.carets = [{
      anchor: { line: 0, col: 0 },
      head: { line: lastLine, col: this.lines[lastLine].length }
    }];
    this.render();
    this.notifyCursor();
  }

  /* ----------------------------------------------------
     Find and Replace
     ---------------------------------------------------- */
  findMatches(query, caseSensitive = false) {
    if (!query) {
      this.findMatchesList = [];
      this.activeFindIndex = -1;
      this.renderFindHighlights();
      return [];
    }

    const matches = [];
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);

    for (let lineIdx = 0; lineIdx < this.lines.length; lineIdx++) {
      const lineText = this.lines[lineIdx];
      let match;
      while ((match = regex.exec(lineText)) !== null) {
        matches.push({
          line: lineIdx,
          startCol: match.index,
          endCol: match.index + match[0].length,
          text: match[0]
        });
        if (regex.lastIndex === match.index) regex.lastIndex++;
      }
    }

    this.findMatchesList = matches;
    if (matches.length > 0) {
      if (this.activeFindIndex < 0 || this.activeFindIndex >= matches.length) {
        // Find match closest to current primary caret
        const caretPos = this.carets[0].head;
        let bestIdx = 0;
        for (let i = 0; i < matches.length; i++) {
          if (this.comparePos(matches[i], caretPos) >= 0) {
            bestIdx = i;
            break;
          }
        }
        this.activeFindIndex = bestIdx;
      }
    } else {
      this.activeFindIndex = -1;
    }

    this.renderFindHighlights();
    return matches;
  }

  goToNextMatch() {
    if (this.findMatchesList.length === 0) return null;
    this.activeFindIndex = (this.activeFindIndex + 1) % this.findMatchesList.length;
    return this.selectActiveMatch();
  }

  goToPrevMatch() {
    if (this.findMatchesList.length === 0) return null;
    this.activeFindIndex = (this.activeFindIndex - 1 + this.findMatchesList.length) % this.findMatchesList.length;
    return this.selectActiveMatch();
  }

  selectActiveMatch() {
    if (this.activeFindIndex < 0 || this.activeFindIndex >= this.findMatchesList.length) return null;
    const match = this.findMatchesList[this.activeFindIndex];
    this.carets = [{
      anchor: { line: match.line, col: match.startCol },
      head: { line: match.line, col: match.endCol }
    }];
    this.scrollToCaret();
    this.render();
    this.notifyCursor();
    return { match, index: this.activeFindIndex, total: this.findMatchesList.length };
  }

  replaceCurrentMatch(replacement) {
    if (this.activeFindIndex < 0 || this.activeFindIndex >= this.findMatchesList.length) return false;
    const match = this.findMatchesList[this.activeFindIndex];

    this.carets = [{
      anchor: { line: match.line, col: match.startCol },
      head: { line: match.line, col: match.endCol }
    }];

    this.insertText(replacement, 'replace');

    return true;
  }

  replaceAllMatches(query, replacement, caseSensitive = false) {
    if (!query) return 0;
    const matches = this.findMatches(query, caseSensitive);
    if (matches.length === 0) return 0;

    const count = matches.length;

    this.executeMutation(() => {
      const flags = caseSensitive ? 'g' : 'gi';
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, flags);

      this.lines = this.lines.map(line => line.replace(regex, replacement));
      this.carets = [{ anchor: { line: 0, col: 0 }, head: { line: 0, col: 0 } }];
    }, 'replace-all');

    this.findMatches(query, caseSensitive);
    return count;
  }

  /* ----------------------------------------------------
     Virtual Scrolling & Geometry
     ---------------------------------------------------- */
  updateScrollPhantom() {
    const totalHeight = Math.max(this.lines.length * this.lineHeight, this.viewportHeight);
    this.scrollPhantomEl.style.height = `${totalHeight}px`;

    // Measure max line width for horizontal scroll
    let maxCols = 80;
    const sampleStep = Math.max(1, Math.floor(this.lines.length / 50));
    for (let i = 0; i < this.lines.length; i += sampleStep) {
      if (this.lines[i].length > maxCols) maxCols = this.lines[i].length;
    }
    const totalWidth = Math.max(maxCols * this.charWidth + 100, this.viewportWidth);
    this.scrollPhantomEl.style.width = `${totalWidth}px`;
  }

  getVisibleRange() {
    const buffer = 15;
    const startLine = Math.max(0, Math.floor(this.scrollTop / this.lineHeight) - buffer);
    const endLine = Math.min(
      this.lines.length - 1,
      Math.ceil((this.scrollTop + this.viewportHeight) / this.lineHeight) + buffer
    );
    return { startLine, endLine };
  }

  scrollToCaret(caret = this.carets[0]) {
    const pos = caret.head;
    const targetY = pos.line * this.lineHeight;
    const targetX = pos.col * this.charWidth;

    const viewH = this.scrollViewEl.clientHeight || this.viewportHeight;
    const viewW = this.scrollViewEl.clientWidth || this.viewportWidth;

    if (targetY < this.scrollViewEl.scrollTop) {
      this.scrollViewEl.scrollTop = targetY - 48;
    } else if (targetY + this.lineHeight > this.scrollViewEl.scrollTop + viewH) {
      this.scrollViewEl.scrollTop = targetY - viewH + this.lineHeight + 48;
    }

    if (targetX < this.scrollViewEl.scrollLeft) {
      this.scrollViewEl.scrollLeft = Math.max(0, targetX - 48);
    } else if (targetX > this.scrollViewEl.scrollLeft + viewW - 60) {
      this.scrollViewEl.scrollLeft = targetX - viewW + 100;
    }
  }

  getPosFromCoords(clientX, clientY) {
    const contentRect = this.viewContentEl.getBoundingClientRect();
    const relX = clientX - contentRect.left;
    const relY = clientY - contentRect.top;

    const line = Math.max(0, Math.min(Math.floor(relY / this.lineHeight), this.lines.length - 1));
    const lineText = this.lines[line] || '';
    const approxCol = Math.round(relX / this.charWidth);
    const col = Math.max(0, Math.min(approxCol, lineText.length));

    return { line, col };
  }

  /* ----------------------------------------------------
     Rendering
     ---------------------------------------------------- */
  render() {
    this.viewportHeight = this.scrollViewEl.clientHeight || 600;
    this.viewportWidth = this.scrollViewEl.clientWidth || 800;

    const { startLine, endLine } = this.getVisibleRange();

    // 1. Render Gutter (Line Numbers)
    const gutterHtml = [];
    for (let i = startLine; i <= endLine; i++) {
      const top = i * this.lineHeight;
      const isCurrentLine = this.carets.some(c => c.head.line === i);
      const activeClass = isCurrentLine ? ' active' : '';
      gutterHtml.push(`
        <div class="patchpad-gutter-line${activeClass}" style="top:${top}px;height:${this.lineHeight}px;" data-line="${i}">
          ${i + 1}
        </div>
      `);
    }
    this.gutterContentEl.innerHTML = gutterHtml.join('');

    // 2. Render Lines
    const linesHtml = [];
    for (let i = startLine; i <= endLine; i++) {
      const top = i * this.lineHeight;
      const text = this.lines[i] || '';
      const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '&nbsp;';
      linesHtml.push(`
        <div class="patchpad-line" style="top:${top}px;height:${this.lineHeight}px;">${safeText}</div>
      `);
    }
    this.linesLayerEl.innerHTML = linesHtml.join('');

    // 3. Render Selections
    this.renderSelections(startLine, endLine);

    // 4. Render Carets
    this.renderCarets();

    // 5. Render Find Highlights
    this.renderFindHighlights();
  }

  renderSelections(startLine, endLine) {
    const selHtml = [];

    for (const caret of this.carets) {
      if (!this.hasSelection(caret)) continue;
      const { start, end } = this.getNormalizedCaret(caret);

      const renderStartLine = Math.max(start.line, startLine);
      const renderEndLine = Math.min(end.line, endLine);

      for (let l = renderStartLine; l <= renderEndLine; l++) {
        const lineText = this.lines[l] || '';
        const lineStartCol = (l === start.line) ? start.col : 0;
        const lineEndCol = (l === end.line) ? end.col : lineText.length;

        const top = l * this.lineHeight;
        const left = lineStartCol * this.charWidth;
        const width = Math.max((lineEndCol - lineStartCol) * this.charWidth, 6);

        selHtml.push(`
          <div class="patchpad-selection-rect" style="top:${top}px;left:${left}px;width:${width}px;height:${this.lineHeight}px;"></div>
        `);
      }
    }

    this.selectionLayerEl.innerHTML = selHtml.join('');
  }

  renderCarets() {
    const caretsHtml = [];
    const isFocused = document.activeElement === this.container;

    for (let i = 0; i < this.carets.length; i++) {
      const caret = this.carets[i];
      const top = caret.head.line * this.lineHeight;
      const left = caret.head.col * this.charWidth;
      const blinkClass = (this.caretVisible && isFocused) ? ' visible' : '';
      const isPrimary = i === 0 ? ' primary' : ' secondary';

      caretsHtml.push(`
        <div class="patchpad-caret${blinkClass}${isPrimary}" style="top:${top}px;left:${left}px;height:${this.lineHeight}px;"></div>
      `);
    }

    this.caretsLayerEl.innerHTML = caretsHtml.join('');
  }

  renderFindHighlights() {
    if (this.findMatchesList.length === 0) {
      this.findLayerEl.innerHTML = '';
      return;
    }

    const { startLine, endLine } = this.getVisibleRange();
    const highlights = [];

    for (let i = 0; i < this.findMatchesList.length; i++) {
      const match = this.findMatchesList[i];
      if (match.line < startLine || match.line > endLine) continue;

      const top = match.line * this.lineHeight;
      const left = match.startCol * this.charWidth;
      const width = (match.endCol - match.startCol) * this.charWidth;
      const isCurrent = i === this.activeFindIndex ? ' active-match' : '';

      highlights.push(`
        <div class="patchpad-find-match${isCurrent}" style="top:${top}px;left:${left}px;width:${width}px;height:${this.lineHeight}px;"></div>
      `);
    }

    this.findLayerEl.innerHTML = highlights.join('');
  }

  /* ----------------------------------------------------
     Caret Blinking
     ---------------------------------------------------- */
  startCaretBlink() {
    if (this.caretBlinkTimer) clearInterval(this.caretBlinkTimer);
    this.caretBlinkTimer = setInterval(() => {
      this.caretVisible = !this.caretVisible;
      const carets = this.caretsLayerEl.querySelectorAll('.patchpad-caret');
      carets.forEach(c => {
        if (this.caretVisible) c.classList.add('visible');
        else c.classList.remove('visible');
      });
    }, 530);
  }

  resetCaretBlink() {
    this.caretVisible = true;
    const carets = this.caretsLayerEl.querySelectorAll('.patchpad-caret');
    carets.forEach(c => c.classList.add('visible'));
  }

  /* ----------------------------------------------------
     Event Listeners
     ---------------------------------------------------- */
  bindEvents() {
    // Scroll listener
    this.scrollViewEl.addEventListener('scroll', () => {
      this.scrollTop = this.scrollViewEl.scrollTop;
      this.scrollLeft = this.scrollViewEl.scrollLeft;
      this.gutterEl.scrollTop = this.scrollTop;
      this.render();
    }, { passive: true });

    // Focus & Blur
    this.container.addEventListener('focus', () => {
      this.hiddenInputEl.focus({ preventScroll: true });
      this.container.classList.add('focused');
      this.resetCaretBlink();
      this.renderCarets();
    });

    this.hiddenInputEl.addEventListener('focus', () => {
      this.container.classList.add('focused');
      this.resetCaretBlink();
      this.renderCarets();
    });

    this.hiddenInputEl.addEventListener('blur', () => {
      this.container.classList.remove('focused');
      this.renderCarets();
    });

    // Keyboard & Input events on hidden input
    this.hiddenInputEl.addEventListener('keydown', (e) => this.handleKeyDown(e));

    this.hiddenInputEl.addEventListener('beforeinput', (e) => {
      if (e.inputType === 'insertText' || e.inputType === 'insertReplacementText') {
        if (e.data) {
          e.preventDefault();
          this.insertText(e.data, 'type');
          this.hiddenInputEl.value = '';
        }
      } else if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
        e.preventDefault();
        this.insertText('\n', 'type');
        this.hiddenInputEl.value = '';
      } else if (e.inputType === 'deleteContentBackward') {
        e.preventDefault();
        this.deleteBackward();
      } else if (e.inputType === 'deleteContentForward') {
        e.preventDefault();
        this.deleteForward();
      }
    });

    this.hiddenInputEl.addEventListener('input', () => {
      if (this.hiddenInputEl.value) {
        this.insertText(this.hiddenInputEl.value, 'type');
        this.hiddenInputEl.value = '';
      }
    });

    // Mouse events on editing surface
    this.scrollViewEl.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handleMouseUp(e));

    // Gutter click (select whole line)
    this.gutterEl.addEventListener('mousedown', (e) => {
      const lineEl = e.target.closest('.patchpad-gutter-line');
      if (lineEl) {
        const lineIdx = parseInt(lineEl.getAttribute('data-line'), 10);
        if (!isNaN(lineIdx)) {
          this.carets = [{
            anchor: { line: lineIdx, col: 0 },
            head: { line: lineIdx, col: this.lines[lineIdx].length }
          }];
          this.container.focus();
          this.render();
          this.notifyCursor();
        }
      }
    });

    // Double click (select word) and Triple click (select line)
    this.scrollViewEl.addEventListener('dblclick', (e) => {
      const pos = this.getPosFromCoords(e.clientX, e.clientY);
      const line = this.lines[pos.line] || '';
      const startCol = this.prevWordCol(line, pos.col);
      const endCol = this.nextWordCol(line, pos.col);
      this.carets = [{
        anchor: { line: pos.line, col: startCol },
        head: { line: pos.line, col: endCol }
      }];
      this.render();
      this.notifyCursor();
    });

    // Clipboard events
    this.container.addEventListener('copy', (e) => this.handleCopy(e));
    this.container.addEventListener('cut', (e) => this.handleCut(e));
    this.container.addEventListener('paste', (e) => this.handlePaste(e));

    // Window resize observer
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => {
        this.measureFont();
        this.updateScrollPhantom();
        this.render();
      }).observe(this.container);
    }
  }

  handleKeyDown(e) {
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const modKey = isMac ? e.metaKey : e.ctrlKey;
    const altKey = e.altKey;
    const shiftKey = e.shiftKey;

    this.resetCaretBlink();

    // 1. Escape key handling
    if (e.key === 'Escape') {
      e.preventDefault();
      this.options.onEscape();
      return;
    }

    // 2. Find shortcut (Ctrl+F / Cmd+F)
    if (modKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      this.options.onFindRequest();
      return;
    }

    // 3. Save shortcut (Ctrl+S / Cmd+S)
    if (modKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      this.options.onSaveRequest();
      return;
    }

    // 4. Undo / Redo shortcuts
    if (modKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (modKey && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      this.redo();
      return;
    }

    // 5. Select All (Ctrl+A / Cmd+A)
    if (modKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      this.selectAll();
      return;
    }

    // 6. Navigation
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const isWord = altKey || (modKey && !isMac);
      const isLineEdge = modKey && isMac;
      this.moveCaret('left', { shift: shiftKey, word: isWord, lineEdge: isLineEdge });
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const isWord = altKey || (modKey && !isMac);
      const isLineEdge = modKey && isMac;
      this.moveCaret('right', { shift: shiftKey, word: isWord, lineEdge: isLineEdge });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const isDoc = modKey && isMac;
      this.moveCaret('up', { shift: shiftKey, doc: isDoc });
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const isDoc = modKey && isMac;
      this.moveCaret('down', { shift: shiftKey, doc: isDoc });
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      this.moveCaret('left', { shift: shiftKey, doc: modKey, lineEdge: !modKey });
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      this.moveCaret('right', { shift: shiftKey, doc: modKey, lineEdge: !modKey });
      return;
    }
    if (e.key === 'PageUp') {
      e.preventDefault();
      for (let i = 0; i < 20; i++) this.moveCaret('up', { shift: shiftKey });
      return;
    }
    if (e.key === 'PageDown') {
      e.preventDefault();
      for (let i = 0; i < 20; i++) this.moveCaret('down', { shift: shiftKey });
      return;
    }

    // 7. Tab / Shift+Tab (Indentation)
    if (e.key === 'Tab') {
      e.preventDefault();
      if (shiftKey) this.unindent();
      else this.indent();
      return;
    }

    // 8. Enter
    if (e.key === 'Enter') {
      e.preventDefault();
      this.insertText('\n', 'type');
      return;
    }

    // 9. Backspace / Delete
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

    // 10. Printable characters (including emojis, accents, and unicode graphemes)
    const nonPrintableKeys = [
      'Backspace', 'Tab', 'Enter', 'Escape', 'Delete',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'PageUp', 'PageDown', 'Shift', 'Control',
      'Alt', 'Meta', 'CapsLock', 'Insert', 'NumLock', 'ScrollLock',
      'Pause', 'ContextMenu', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
      'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'Unidentified'
    ];
    if (!modKey && !altKey && !nonPrintableKeys.includes(e.key)) {
      e.preventDefault();
      this.insertText(e.key, 'type');
      return;
    }
  }

  handleMouseDown(e) {
    if (e.button !== 0) return; // Left button only

    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const isMultiCaret = e.altKey || (isMac ? e.metaKey : e.ctrlKey);

    const pos = this.getPosFromCoords(e.clientX, e.clientY);
    this.focus();

    if (isMultiCaret) {
      // Add or remove caret
      const existingIdx = this.carets.findIndex(
        c => c.head.line === pos.line && c.head.col === pos.col
      );
      if (existingIdx >= 0 && this.carets.length > 1) {
        this.carets.splice(existingIdx, 1);
        this.activeCaretIdx = Math.max(0, this.carets.length - 1);
      } else {
        this.carets.push({ anchor: { ...pos }, head: { ...pos } });
        this.activeCaretIdx = this.carets.length - 1;
      }
    } else {
      this.carets = [{ anchor: { ...pos }, head: { ...pos } }];
      this.activeCaretIdx = 0;
    }

    this.isMouseDown = true;
    this.dragStartPos = { ...pos };
    this.resetCaretBlink();
    this.render();
    this.notifyCursor();
  }

  handleMouseMove(e) {
    if (!this.isMouseDown) return;

    const pos = this.getPosFromCoords(e.clientX, e.clientY);
    const activeCaret = this.carets[this.activeCaretIdx];
    if (activeCaret) {
      activeCaret.head = { ...pos };
      this.render();
      this.notifyCursor();
    }

    // Auto-scroll when dragging near viewport boundaries
    const rect = this.scrollViewEl.getBoundingClientRect();
    const edgeBuffer = 30;
    if (e.clientY < rect.top + edgeBuffer) {
      this.scrollViewEl.scrollTop -= 15;
    } else if (e.clientY > rect.bottom - edgeBuffer) {
      this.scrollViewEl.scrollTop += 15;
    }
  }

  handleMouseUp() {
    this.isMouseDown = false;
    this.dragStartPos = null;
  }

  handleCopy(e) {
    const selectedText = this.getAllSelectedText();
    if (!selectedText) return;

    if (e.clipboardData) {
      e.clipboardData.setData('text/plain', selectedText);
      e.preventDefault();
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(selectedText);
    }
  }

  handleCut(e) {
    const selectedText = this.getAllSelectedText();
    if (!selectedText) return;

    if (e.clipboardData) {
      e.clipboardData.setData('text/plain', selectedText);
      e.preventDefault();
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(selectedText);
    }

    this.deleteBackward();
  }

  handlePaste(e) {
    e.preventDefault();
    let pastedText = '';
    if (e.clipboardData) {
      pastedText = e.clipboardData.getData('text/plain');
    }

    if (pastedText) {
      this.insertText(pastedText, 'paste');
    }
  }

  /* ----------------------------------------------------
     Change Notifications
     ---------------------------------------------------- */
  notifyChange() {
    this.options.onDirtyChange(this.getText());
    this.notifyCursor();
  }

  notifyCursor() {
    const primary = this.carets[0] || { head: { line: 0, col: 0 } };
    this.options.onCursorChange({
      line: primary.head.line + 1,
      col: primary.head.col + 1,
      caretCount: this.carets.length,
      hasSelection: this.hasSelection(primary),
      selectedLength: this.getSelectedText(primary).length
    });
  }

  focus() {
    this.hiddenInputEl.focus({ preventScroll: true });
    this.container.classList.add('focused');
    this.resetCaretBlink();
    this.renderCarets();
  }
}

window.PatchPadEditor = PatchPadEditor;

/**
 * GridForge Custom Spreadsheet Grid & Selection Component
 * Handles rendering, selection, mouse/keyboard events, floating cell editor, and reference picker.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./formula'));
  } else {
    root.GridComponent = factory(root.FormulaEngine);
  }
})(typeof self !== 'undefined' ? self : this, function (FormulaEngine) {

  const NUM_ROWS = 100;
  const NUM_COLS = 26; // A to Z

  class Grid {
    constructor(options = {}) {
      this.tableEl = options.tableEl;
      this.wrapperEl = options.wrapperEl;
      this.formulaInputEl = options.formulaInputEl;
      this.nameBoxEl = options.nameBoxEl;
      this.selectionBoxEl = options.selectionBoxEl;
      this.fillHandleEl = options.fillHandleEl;
      this.floatingEditorEl = options.floatingEditorEl;
      this.suggestionsEl = options.suggestionsEl;
      this.remoteCursorsLayerEl = options.remoteCursorsLayerEl;

      this.calculator = options.calculator || new FormulaEngine.WorkbookCalculator();

      // Selection state
      this.activeRow = 1;
      this.activeCol = 1;
      this.anchorRow = 1;
      this.anchorCol = 1;
      this.focusRow = 1;
      this.focusCol = 1;

      // Edit mode state
      this.isEditing = false;
      this.editInitialValue = '';
      this.isPickingRef = false;
      this.lastPickedRange = null;
      this.activeSuggestionIndex = -1;
      this.currentSuggestions = [];

      // Mouse drag state
      this.isMouseDown = false;
      this.isDraggingFill = false;
      this.fillStartRange = null;
      this.fillEndRange = null;

      // Callbacks
      this.onCellCommit = options.onCellCommit || (() => {});
      this.onSelectionChange = options.onSelectionChange || (() => {});
      this.onFillCommit = options.onFillCommit || (() => {});
      this.onDeleteSelection = options.onDeleteSelection || (() => {});

      // Cell element cache
      this.cellElements = {}; // "A1" -> td element
      this.rowHeaderElements = {}; // 1 -> th element
      this.colHeaderElements = {}; // 1 -> th element

      this._initDOM();
      this._bindEvents();
    }

    _initDOM() {
      const fragment = document.createDocumentFragment();

      // Header row (corner + columns A-Z)
      const headerRow = document.createElement('tr');
      const cornerTh = document.createElement('th');
      cornerTh.className = 'corner-header';
      cornerTh.title = 'Select all (Ctrl+A)';
      cornerTh.addEventListener('click', () => this.selectAll());
      headerRow.appendChild(cornerTh);

      for (let c = 1; c <= NUM_COLS; c++) {
        const colLetter = FormulaEngine.indexToColLetter(c);
        const th = document.createElement('th');
        th.className = 'col-header';
        th.textContent = colLetter;
        th.dataset.col = c;
        this.colHeaderElements[c] = th;
        th.addEventListener('click', (e) => this.selectColumn(c, e.shiftKey));
        headerRow.appendChild(th);
      }
      fragment.appendChild(headerRow);

      // Data rows 1-100
      for (let r = 1; r <= NUM_ROWS; r++) {
        const tr = document.createElement('tr');
        const rowTh = document.createElement('th');
        rowTh.className = 'row-header';
        rowTh.textContent = r;
        rowTh.dataset.row = r;
        this.rowHeaderElements[r] = rowTh;
        rowTh.addEventListener('click', (e) => this.selectRow(r, e.shiftKey));
        tr.appendChild(rowTh);

        for (let c = 1; c <= NUM_COLS; c++) {
          const colLetter = FormulaEngine.indexToColLetter(c);
          const ref = `${colLetter}${r}`;
          const td = document.createElement('td');
          td.className = 'grid-cell';
          td.dataset.ref = ref;
          td.dataset.row = r;
          td.dataset.col = c;
          this.cellElements[ref] = td;
          tr.appendChild(td);
        }
        fragment.appendChild(tr);
      }

      this.tableEl.innerHTML = '';
      this.tableEl.appendChild(fragment);

      this.render();
      this.updateSelection();
    }

    render() {
      // Update cell texts and styles based on calculator
      for (let r = 1; r <= NUM_ROWS; r++) {
        for (let c = 1; c <= NUM_COLS; c++) {
          const colLetter = FormulaEngine.indexToColLetter(c);
          const ref = `${colLetter}${r}`;
          const td = this.cellElements[ref];
          if (!td) continue;

          const raw = this.calculator.getRawValue(ref);
          const display = this.calculator.getDisplayValue(ref);

          // Remove old cell classes
          td.className = 'grid-cell';

          if (display !== undefined && display !== null && display !== '') {
            if (typeof display === 'number') {
              td.classList.add('cell-number');
              td.textContent = display.toLocaleString('en-US', { maximumFractionDigits: 10 });
            } else if (typeof display === 'string' && display.startsWith('#')) {
              td.classList.add('cell-error');
              td.textContent = display;
              td.title = this.calculator.errors[ref] || display;
            } else {
              td.classList.add('cell-text');
              td.textContent = String(display);
              td.removeAttribute('title');
            }
          } else {
            td.textContent = '';
            td.removeAttribute('title');
          }
        }
      }

      this.updateSelection();
    }

    updateCellDisplay(ref) {
      const td = this.cellElements[ref.toUpperCase()];
      if (!td) return;
      const display = this.calculator.getDisplayValue(ref);

      td.className = 'grid-cell';
      if (display !== undefined && display !== null && display !== '') {
        if (typeof display === 'number') {
          td.classList.add('cell-number');
          td.textContent = display.toLocaleString('en-US', { maximumFractionDigits: 10 });
        } else if (typeof display === 'string' && display.startsWith('#')) {
          td.classList.add('cell-error');
          td.textContent = display;
          td.title = this.calculator.errors[ref] || display;
        } else {
          td.classList.add('cell-text');
          td.textContent = String(display);
          td.removeAttribute('title');
        }
      } else {
        td.textContent = '';
        td.removeAttribute('title');
      }
    }

    // --- Selection Management ---
    getSelectionRange() {
      const minRow = Math.min(this.anchorRow, this.focusRow);
      const maxRow = Math.max(this.anchorRow, this.focusRow);
      const minCol = Math.min(this.anchorCol, this.focusCol);
      const maxCol = Math.max(this.anchorCol, this.focusCol);

      const startRef = `${FormulaEngine.indexToColLetter(minCol)}${minRow}`;
      const endRef = `${FormulaEngine.indexToColLetter(maxCol)}${maxRow}`;

      return {
        minRow, maxRow, minCol, maxCol,
        startRef, endRef,
        isSingle: minRow === maxRow && minCol === maxCol,
        rangeString: minRow === maxRow && minCol === maxCol ? startRef : `${startRef}:${endRef}`
      };
    }

    setSelection(anchorRow, anchorCol, focusRow = anchorRow, focusCol = anchorCol, emitEvent = true) {
      this.anchorRow = Math.max(1, Math.min(NUM_ROWS, anchorRow));
      this.anchorCol = Math.max(1, Math.min(NUM_COLS, anchorCol));
      this.focusRow = Math.max(1, Math.min(NUM_ROWS, focusRow));
      this.focusCol = Math.max(1, Math.min(NUM_COLS, focusCol));

      this.activeRow = this.anchorRow;
      this.activeCol = this.anchorCol;

      this.updateSelection();

      if (emitEvent) {
        const range = this.getSelectionRange();
        const activeRef = `${FormulaEngine.indexToColLetter(this.activeCol)}${this.activeRow}`;
        this.onSelectionChange(activeRef, range.rangeString);
      }
    }

    getActiveRef() {
      return `${FormulaEngine.indexToColLetter(this.activeCol)}${this.activeRow}`;
    }

    updateSelection() {
      const range = this.getSelectionRange();
      const activeRef = this.getActiveRef();

      // Update name box
      if (this.nameBoxEl && document.activeElement !== this.nameBoxEl) {
        this.nameBoxEl.value = range.rangeString;
      }

      // Update formula bar (if not currently focused/editing)
      if (this.formulaInputEl && !this.isEditing && document.activeElement !== this.formulaInputEl) {
        const raw = this.calculator.getRawValue(activeRef);
        this.formulaInputEl.value = raw !== undefined ? raw : '';
      }

      // Update header highlighting
      for (let c = 1; c <= NUM_COLS; c++) {
        if (this.colHeaderElements[c]) {
          if (c >= range.minCol && c <= range.maxCol) {
            this.colHeaderElements[c].classList.add('highlighted');
          } else {
            this.colHeaderElements[c].classList.remove('highlighted');
          }
        }
      }

      for (let r = 1; r <= NUM_ROWS; r++) {
        if (this.rowHeaderElements[r]) {
          if (r >= range.minRow && r <= range.maxRow) {
            this.rowHeaderElements[r].classList.add('highlighted');
          } else {
            this.rowHeaderElements[r].classList.remove('highlighted');
          }
        }
      }

      // Position selection box overlay
      const startTd = this.cellElements[`${FormulaEngine.indexToColLetter(range.minCol)}${range.minRow}`];
      const endTd = this.cellElements[`${FormulaEngine.indexToColLetter(range.maxCol)}${range.maxRow}`];

      if (startTd && endTd && this.selectionBoxEl) {
        const top = startTd.offsetTop;
        const left = startTd.offsetLeft;
        const width = (endTd.offsetLeft + endTd.offsetWidth) - left;
        const height = (endTd.offsetTop + endTd.offsetHeight) - top;

        this.selectionBoxEl.style.display = 'block';
        this.selectionBoxEl.style.top = `${top}px`;
        this.selectionBoxEl.style.left = `${left}px`;
        this.selectionBoxEl.style.width = `${width}px`;
        this.selectionBoxEl.style.height = `${height}px`;

        if (this.fillHandleEl) {
          this.fillHandleEl.style.display = 'block';
        }
      }

      // Update cell shading classes
      for (const [ref, td] of Object.entries(this.cellElements)) {
        const p = FormulaEngine.parseCellRef(ref);
        if (!p) continue;
        const inRange = p.rowNum >= range.minRow && p.rowNum <= range.maxRow &&
                        p.colIndex >= range.minCol && p.colIndex <= range.maxCol;

        if (inRange) {
          td.classList.add('selected-range');
        } else {
          td.classList.remove('selected-range');
        }

        if (p.rowNum === this.activeRow && p.colIndex === this.activeCol) {
          td.classList.add('active-cell');
        } else {
          td.classList.remove('active-cell');
        }
      }
    }

    selectAll() {
      this.setSelection(1, 1, NUM_ROWS, NUM_COLS);
    }

    selectRow(row, isShift = false) {
      if (isShift) {
        this.focusRow = row;
        this.focusCol = NUM_COLS;
        this.updateSelection();
      } else {
        this.setSelection(row, 1, row, NUM_COLS);
      }
    }

    selectColumn(col, isShift = false) {
      if (isShift) {
        this.focusRow = NUM_ROWS;
        this.focusCol = col;
        this.updateSelection();
      } else {
        this.setSelection(1, col, NUM_ROWS, col);
      }
    }

    jumpToAddress(addr) {
      if (!addr) return;
      const clean = addr.trim().toUpperCase();
      if (clean.includes(':')) {
        const [start, end] = clean.split(':');
        const p1 = FormulaEngine.parseCellRef(start);
        const p2 = FormulaEngine.parseCellRef(end);
        if (p1 && p2) {
          this.setSelection(p1.rowNum, p1.colIndex, p2.rowNum, p2.colIndex);
          this.scrollToCell(p1.rowNum, p1.colIndex);
        }
      } else {
        const p = FormulaEngine.parseCellRef(clean);
        if (p) {
          this.setSelection(p.rowNum, p.colIndex);
          this.scrollToCell(p.rowNum, p.colIndex);
        }
      }
    }

    scrollToCell(row, col) {
      const ref = `${FormulaEngine.indexToColLetter(col)}${row}`;
      const td = this.cellElements[ref];
      if (td && this.wrapperEl) {
        const top = td.offsetTop - 40;
        const left = td.offsetLeft - 60;
        this.wrapperEl.scrollTop = Math.max(0, top);
        this.wrapperEl.scrollLeft = Math.max(0, left);
      }
    }

    // --- Editing Mode ---
    startEditing(initialChar = null, fromFormulaBar = false) {
      if (this.isEditing) return;
      this.isEditing = true;
      this.isPickingRef = false;
      this.lastPickedRange = null;

      const activeRef = this.getActiveRef();
      const raw = this.calculator.getRawValue(activeRef) || '';
      this.editInitialValue = raw;

      let startValue = raw;
      if (initialChar !== null) {
        startValue = initialChar;
      }

      // Position floating editor over active cell
      const td = this.cellElements[activeRef];
      if (td && this.floatingEditorEl && !fromFormulaBar) {
        this.floatingEditorEl.style.display = 'block';
        this.floatingEditorEl.style.top = `${td.offsetTop}px`;
        this.floatingEditorEl.style.left = `${td.offsetLeft}px`;
        this.floatingEditorEl.style.width = `${td.offsetWidth}px`;
        this.floatingEditorEl.style.height = `${td.offsetHeight}px`;
        this.floatingEditorEl.value = startValue;
        this.floatingEditorEl.focus();
        if (initialChar === null) {
          this.floatingEditorEl.select();
        }
      }

      if (this.formulaInputEl) {
        this.formulaInputEl.value = startValue;
        if (fromFormulaBar) {
          this.formulaInputEl.focus();
        }
      }

      this._handleEditorInput(startValue);
    }

    commitEdit(moveDirection = null) {
      if (!this.isEditing) return;

      let newValue = '';
      if (this.floatingEditorEl && this.floatingEditorEl.style.display !== 'none') {
        newValue = this.floatingEditorEl.value;
      } else if (this.formulaInputEl) {
        newValue = this.formulaInputEl.value;
      }

      const activeRef = this.getActiveRef();
      const oldVal = this.editInitialValue;

      this._closeEditor();

      if (newValue !== oldVal) {
        this.onCellCommit(activeRef, oldVal, newValue);
      }

      if (moveDirection === 'down') {
        this.setSelection(Math.min(NUM_ROWS, this.activeRow + 1), this.activeCol);
      } else if (moveDirection === 'up') {
        this.setSelection(Math.max(1, this.activeRow - 1), this.activeCol);
      } else if (moveDirection === 'right') {
        this.setSelection(this.activeRow, Math.min(NUM_COLS, this.activeCol + 1));
      } else if (moveDirection === 'left') {
        this.setSelection(this.activeRow, Math.max(1, this.activeCol - 1));
      }
    }

    cancelEdit() {
      if (!this.isEditing) return;
      const activeRef = this.getActiveRef();
      const raw = this.editInitialValue;
      this._closeEditor();
      if (this.formulaInputEl) {
        this.formulaInputEl.value = raw;
      }
      this.updateCellDisplay(activeRef);
    }

    _closeEditor() {
      this.isEditing = false;
      this.isPickingRef = false;
      this.lastPickedRange = null;
      if (this.floatingEditorEl) {
        this.floatingEditorEl.style.display = 'none';
        this.floatingEditorEl.value = '';
      }
      if (this.suggestionsEl) {
        this.suggestionsEl.style.display = 'none';
      }
      this._clearFormulaHighlights();
      this.wrapperEl.focus();
    }

    _handleEditorInput(val) {
      // Sync inputs
      if (this.floatingEditorEl && document.activeElement === this.formulaInputEl) {
        this.floatingEditorEl.value = val;
      } else if (this.formulaInputEl && document.activeElement === this.floatingEditorEl) {
        this.formulaInputEl.value = val;
      }

      // Check for formula suggestions
      if (val.startsWith('=')) {
        this._updateFormulaSuggestions(val);
        this._updateFormulaHighlights(val);
      } else {
        if (this.suggestionsEl) this.suggestionsEl.style.display = 'none';
        this._clearFormulaHighlights();
      }
    }

    _updateFormulaSuggestions(val) {
      if (!this.suggestionsEl) return;
      const match = val.match(/=([A-Za-z]+)$/);
      if (!match) {
        this.suggestionsEl.style.display = 'none';
        return;
      }

      const query = match[1].toUpperCase();
      this.currentSuggestions = FormulaEngine.SUPPORTED_FUNCTIONS.filter(f => f.name.startsWith(query));

      if (this.currentSuggestions.length === 0) {
        this.suggestionsEl.style.display = 'none';
        return;
      }

      const activeRef = this.getActiveRef();
      const td = this.cellElements[activeRef];
      if (td) {
        this.suggestionsEl.style.display = 'block';
        this.suggestionsEl.style.top = `${td.offsetTop + td.offsetHeight + 2}px`;
        this.suggestionsEl.style.left = `${td.offsetLeft}px`;
      }

      this.suggestionsEl.innerHTML = this.currentSuggestions.map((item, idx) => `
        <div class="suggestion-item ${idx === 0 ? 'active' : ''}" data-index="${idx}">
          <div class="suggestion-name">${item.signature}</div>
          <div class="suggestion-desc">${item.description}</div>
        </div>
      `).join('');

      this.activeSuggestionIndex = 0;

      // Click to insert suggestion
      const items = this.suggestionsEl.querySelectorAll('.suggestion-item');
      items.forEach(el => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const idx = parseInt(el.dataset.index, 10);
          this._applySuggestion(this.currentSuggestions[idx]);
        });
      });
    }

    _applySuggestion(suggestion) {
      if (!suggestion) return;
      const editor = (this.floatingEditorEl && this.floatingEditorEl.style.display !== 'none') ? this.floatingEditorEl : this.formulaInputEl;
      if (!editor) return;

      const val = editor.value;
      const replaced = val.replace(/=([A-Za-z]+)$/, `=${suggestion.name}(`);
      editor.value = replaced;
      this._handleEditorInput(replaced);
      editor.focus();
    }

    // Highlight referenced cells while editing formula
    _updateFormulaHighlights(formulaVal) {
      this._clearFormulaHighlights();
      if (!formulaVal || !formulaVal.startsWith('=')) return;

      const deps = FormulaEngine.extractDependencies(formulaVal);
      deps.forEach((ref, idx) => {
        const td = this.cellElements[ref.toUpperCase()];
        if (td) {
          const colorClass = `ref-highlight-${idx % 4}`;
          td.classList.add(colorClass);
          td.dataset.highlightClass = colorClass;
        }
      });
    }

    _clearFormulaHighlights() {
      for (const td of Object.values(this.cellElements)) {
        if (td.dataset.highlightClass) {
          td.classList.remove(td.dataset.highlightClass);
          delete td.dataset.highlightClass;
        }
      }
    }

    // Point-and-click reference picker
    handleRefPicked(pickedRefOrRange) {
      if (!this.isEditing) return;
      const editor = (this.floatingEditorEl && this.floatingEditorEl.style.display !== 'none') ? this.floatingEditorEl : this.formulaInputEl;
      if (!editor) return;

      let val = editor.value;
      if (!val.startsWith('=')) return;

      if (this.isPickingRef && this.lastPickedRange) {
        // Replace previous reference token with new picked reference
        const lastRef = this.lastPickedRange;
        const lastIdx = val.lastIndexOf(lastRef);
        if (lastIdx !== -1) {
          val = val.substring(0, lastIdx) + pickedRefOrRange + val.substring(lastIdx + lastRef.length);
        } else {
          val += pickedRefOrRange;
        }
      } else {
        // Append picked reference
        // Check if last char is operator, paren, comma, or =
        const lastChar = val[val.length - 1];
        if (['=', '(', '+', '-', '*', '/', ',', ':', '^'].includes(lastChar)) {
          val += pickedRefOrRange;
        } else {
          // If already has reference or text at end, replace it or append with comma
          val += ',' + pickedRefOrRange;
        }
      }

      this.isPickingRef = true;
      this.lastPickedRange = pickedRefOrRange;
      editor.value = val;
      this._handleEditorInput(val);
    }

    // --- Presence Overlay Rendering ---
    renderRemoteCursors(sessions) {
      if (!this.remoteCursorsLayerEl) return;
      this.remoteCursorsLayerEl.innerHTML = '';

      sessions.forEach(session => {
        if (!session.cell) return;
        const cellRef = session.cell.toUpperCase();
        let minRow = 1, maxRow = 1, minCol = 1, maxCol = 1;

        if (session.range && session.range.includes(':')) {
          const [start, end] = session.range.split(':');
          const p1 = FormulaEngine.parseCellRef(start);
          const p2 = FormulaEngine.parseCellRef(end);
          if (p1 && p2) {
            minRow = Math.min(p1.rowNum, p2.rowNum);
            maxRow = Math.max(p1.rowNum, p2.rowNum);
            minCol = Math.min(p1.colIndex, p2.colIndex);
            maxCol = Math.max(p1.colIndex, p2.colIndex);
          }
        } else {
          const p = FormulaEngine.parseCellRef(cellRef);
          if (p) {
            minRow = maxRow = p.rowNum;
            minCol = maxCol = p.colIndex;
          }
        }

        const startTd = this.cellElements[`${FormulaEngine.indexToColLetter(minCol)}${minRow}`];
        const endTd = this.cellElements[`${FormulaEngine.indexToColLetter(maxCol)}${maxRow}`];

        if (startTd && endTd) {
          const top = startTd.offsetTop;
          const left = startTd.offsetLeft;
          const width = (endTd.offsetLeft + endTd.offsetWidth) - left;
          const height = (endTd.offsetTop + endTd.offsetHeight) - top;

          const box = document.createElement('div');
          box.className = 'remote-cursor-box';
          box.style.top = `${top}px`;
          box.style.left = `${left}px`;
          box.style.width = `${width}px`;
          box.style.height = `${height}px`;
          box.style.border = `2px solid ${session.color}`;
          box.style.backgroundColor = `${session.color}15`;

          const label = document.createElement('div');
          label.className = 'remote-cursor-label';
          label.style.backgroundColor = session.color;
          label.textContent = session.userName;

          box.appendChild(label);
          this.remoteCursorsLayerEl.appendChild(box);
        }
      });
    }

    // --- Event Bindings ---
    _bindEvents() {
      // Cell mousedown / drag
      this.tableEl.addEventListener('mousedown', (e) => {
        const td = e.target.closest('td.grid-cell');
        if (!td) return;

        const row = parseInt(td.dataset.row, 10);
        const col = parseInt(td.dataset.col, 10);
        const ref = td.dataset.ref;

        if (this.isEditing) {
          const editor = (this.floatingEditorEl && this.floatingEditorEl.style.display !== 'none') ? this.floatingEditorEl : this.formulaInputEl;
          if (editor && editor.value.startsWith('=')) {
            // Reference picking mode!
            e.preventDefault();
            this.isMouseDown = true;
            this.dragStartRow = row;
            this.dragStartCol = col;
            this.handleRefPicked(ref);
            return;
          } else {
            // Commit current edit and select clicked cell
            this.commitEdit();
          }
        }

        this.isMouseDown = true;
        this.dragStartRow = row;
        this.dragStartCol = col;

        if (e.shiftKey) {
          this.setSelection(this.anchorRow, this.anchorCol, row, col);
        } else {
          this.setSelection(row, col, row, col);
        }
      });

      // Cell mouseover during drag
      this.tableEl.addEventListener('mouseover', (e) => {
        if (!this.isMouseDown) return;
        const td = e.target.closest('td.grid-cell');
        if (!td) return;

        const row = parseInt(td.dataset.row, 10);
        const col = parseInt(td.dataset.col, 10);

        if (this.isEditing) {
          // Drag range reference picking
          const minR = Math.min(this.dragStartRow, row);
          const maxR = Math.max(this.dragStartRow, row);
          const minC = Math.min(this.dragStartCol, col);
          const maxC = Math.max(this.dragStartCol, col);
          const r1 = `${FormulaEngine.indexToColLetter(minC)}${minR}`;
          const r2 = `${FormulaEngine.indexToColLetter(maxC)}${maxR}`;
          const picked = (r1 === r2) ? r1 : `${r1}:${r2}`;
          this.handleRefPicked(picked);
        } else if (this.isDraggingFill) {
          this.fillEndRow = row;
          this.fillEndCol = col;
        } else {
          this.setSelection(this.dragStartRow, this.dragStartCol, row, col);
        }
      });

      window.addEventListener('mouseup', () => {
        if (this.isDraggingFill) {
          this._finalizeFill();
        }
        this.isMouseDown = false;
        this.isDraggingFill = false;
      });

      // Double click to edit cell
      this.tableEl.addEventListener('dblclick', (e) => {
        const td = e.target.closest('td.grid-cell');
        if (!td) return;
        this.startEditing();
      });

      // Fill Handle mousedown
      if (this.fillHandleEl) {
        this.fillHandleEl.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.isDraggingFill = true;
          this.fillStartRange = this.getSelectionRange();
          this.fillEndRow = this.focusRow;
          this.fillEndCol = this.focusCol;
        });
      }

      // Keyboard navigation on grid container
      this.wrapperEl.addEventListener('keydown', (e) => {
        if (this.isEditing) return;

        const isShift = e.shiftKey;
        const isCtrl = e.ctrlKey || e.metaKey;

        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            if (isShift) {
              this.focusRow = Math.max(1, this.focusRow - 1);
              this.updateSelection();
            } else {
              this.setSelection(Math.max(1, this.activeRow - 1), this.activeCol);
            }
            this.scrollToCell(this.focusRow, this.focusCol);
            break;

          case 'ArrowDown':
            e.preventDefault();
            if (isShift) {
              this.focusRow = Math.min(NUM_ROWS, this.focusRow + 1);
              this.updateSelection();
            } else {
              this.setSelection(Math.min(NUM_ROWS, this.activeRow + 1), this.activeCol);
            }
            this.scrollToCell(this.focusRow, this.focusCol);
            break;

          case 'ArrowLeft':
            e.preventDefault();
            if (isShift) {
              this.focusCol = Math.max(1, this.focusCol - 1);
              this.updateSelection();
            } else {
              this.setSelection(this.activeRow, Math.max(1, this.activeCol - 1));
            }
            this.scrollToCell(this.focusRow, this.focusCol);
            break;

          case 'ArrowRight':
            e.preventDefault();
            if (isShift) {
              this.focusCol = Math.min(NUM_COLS, this.focusCol + 1);
              this.updateSelection();
            } else {
              this.setSelection(this.activeRow, Math.min(NUM_COLS, this.activeCol + 1));
            }
            this.scrollToCell(this.focusRow, this.focusCol);
            break;

          case 'Tab':
            e.preventDefault();
            if (isShift) {
              this.setSelection(this.activeRow, Math.max(1, this.activeCol - 1));
            } else {
              this.setSelection(this.activeRow, Math.min(NUM_COLS, this.activeCol + 1));
            }
            this.scrollToCell(this.activeRow, this.activeCol);
            break;

          case 'Enter':
            e.preventDefault();
            if (isShift) {
              this.setSelection(Math.max(1, this.activeRow - 1), this.activeCol);
            } else {
              this.startEditing();
            }
            break;

          case 'F2':
            e.preventDefault();
            this.startEditing();
            break;

          case 'Delete':
          case 'Backspace':
            e.preventDefault();
            this.onDeleteSelection();
            break;

          case 'Home':
            e.preventDefault();
            if (isCtrl) {
              this.setSelection(1, 1);
              this.scrollToCell(1, 1);
            } else {
              this.setSelection(this.activeRow, 1);
              this.scrollToCell(this.activeRow, 1);
            }
            break;

          case 'End':
            e.preventDefault();
            if (isCtrl) {
              this.setSelection(NUM_ROWS, NUM_COLS);
              this.scrollToCell(NUM_ROWS, NUM_COLS);
            } else {
              this.setSelection(this.activeRow, NUM_COLS);
              this.scrollToCell(this.activeRow, NUM_COLS);
            }
            break;

          case 'PageDown':
            e.preventDefault();
            this.setSelection(Math.min(NUM_ROWS, this.activeRow + 20), this.activeCol);
            this.scrollToCell(this.activeRow, this.activeCol);
            break;

          case 'PageUp':
            e.preventDefault();
            this.setSelection(Math.max(1, this.activeRow - 20), this.activeCol);
            this.scrollToCell(this.activeRow, this.activeCol);
            break;

          case 'a':
          case 'A':
            if (isCtrl) {
              e.preventDefault();
              this.selectAll();
            }
            break;

          default:
            // Direct typing on selected cell starts edit mode
            if (!isCtrl && !e.altKey && e.key.length === 1) {
              this.startEditing(e.key);
            }
            break;
        }
      });

      // Floating Editor events
      if (this.floatingEditorEl) {
        this.floatingEditorEl.addEventListener('input', (e) => {
          this.isPickingRef = false;
          this._handleEditorInput(e.target.value);
        });

        this.floatingEditorEl.addEventListener('keydown', (e) => {
          if (this.suggestionsEl && this.suggestionsEl.style.display !== 'none' && this.currentSuggestions.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              this.activeSuggestionIndex = (this.activeSuggestionIndex + 1) % this.currentSuggestions.length;
              this._highlightSuggestion(this.activeSuggestionIndex);
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              this.activeSuggestionIndex = (this.activeSuggestionIndex - 1 + this.currentSuggestions.length) % this.currentSuggestions.length;
              this._highlightSuggestion(this.activeSuggestionIndex);
              return;
            }
            if (e.key === 'Tab' || e.key === 'Enter') {
              e.preventDefault();
              this._applySuggestion(this.currentSuggestions[this.activeSuggestionIndex]);
              return;
            }
          }

          if (e.key === 'Enter') {
            e.preventDefault();
            this.commitEdit(e.shiftKey ? 'up' : 'down');
          } else if (e.key === 'Tab') {
            e.preventDefault();
            this.commitEdit(e.shiftKey ? 'left' : 'right');
          } else if (e.key === 'Escape') {
            e.preventDefault();
            this.cancelEdit();
          }
        });
      }

      // Formula Input events
      if (this.formulaInputEl) {
        this.formulaInputEl.addEventListener('focus', () => {
          if (!this.isEditing) {
            this.startEditing(null, true);
          }
        });

        this.formulaInputEl.addEventListener('input', (e) => {
          this.isPickingRef = false;
          this._handleEditorInput(e.target.value);
        });

        this.formulaInputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.commitEdit('down');
          } else if (e.key === 'Escape') {
            e.preventDefault();
            this.cancelEdit();
          }
        });
      }

      // Name box jump
      if (this.nameBoxEl) {
        this.nameBoxEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.jumpToAddress(this.nameBoxEl.value);
            this.wrapperEl.focus();
          }
        });
      }
    }

    _highlightSuggestion(index) {
      const items = this.suggestionsEl.querySelectorAll('.suggestion-item');
      items.forEach((item, idx) => {
        if (idx === index) item.classList.add('active');
        else item.classList.remove('active');
      });
    }

    _finalizeFill() {
      if (!this.fillStartRange) return;
      const src = this.fillStartRange;
      const endR = this.fillEndRow || this.focusRow;
      const endC = this.fillEndCol || this.focusCol;

      // Determine fill direction (down, right, up, left)
      if (endR > src.maxRow) {
        // Fill Down
        const targetCount = endR - src.maxRow;
        this.onFillCommit(src, 'down', targetCount);
        this.setSelection(src.minRow, src.minCol, endR, src.maxCol);
      } else if (endC > src.maxCol) {
        // Fill Right
        const targetCount = endC - src.maxCol;
        this.onFillCommit(src, 'right', targetCount);
        this.setSelection(src.minRow, src.minCol, src.maxRow, endC);
      }
    }
  }

  return { Grid, NUM_ROWS, NUM_COLS };
});

class Grid {
  constructor(containerId, rows = 80, cols = 20) {
    this.container = document.getElementById(containerId);
    this.rows = rows;
    this.cols = cols;
    this.cells = {};
    this.selectedStart = null;
    this.selectedEnd = null;
    this.editingCell = null;
    this.clipboard = null;
    this.clipboardMode = null;
    this.presenceIndicators = new Map();
    this.undoStack = [];
    this.redoStack = [];
    this.cellElements = new Map();
    
    this.render();
    this.attachEventListeners();
  }

  render() {
    this.container.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'grid-wrapper';
    
    const header = document.createElement('div');
    header.className = 'grid-header';
    
    const corner = document.createElement('div');
    corner.className = 'grid-header-corner';
    header.appendChild(corner);
    
    for (let col = 1; col <= this.cols; col++) {
      const cell = document.createElement('div');
      cell.className = 'grid-header-cell';
      cell.textContent = FormulaHelper.colNumberToLetter(col);
      header.appendChild(cell);
    }
    wrapper.appendChild(header);
    
    for (let row = 1; row <= this.rows; row++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'grid-row';
      
      const rowNum = document.createElement('div');
      rowNum.className = 'grid-row-number';
      rowNum.textContent = row;
      rowDiv.appendChild(rowNum);
      
      for (let col = 1; col <= this.cols; col++) {
        const address = FormulaHelper.colNumberToLetter(col) + row;
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.address = address;
        
        const content = document.createElement('div');
        content.className = 'grid-cell-content';
        content.textContent = '';
        cell.appendChild(content);
        
        cell.addEventListener('click', (e) => this.selectCell(address, e));
        cell.addEventListener('dblclick', () => this.editCell(address));
        cell.addEventListener('mousedown', (e) => this.handleMouseDown(e, address));
        cell.addEventListener('mouseover', (e) => this.handleMouseOver(e, address));
        cell.addEventListener('mouseup', (e) => this.handleMouseUp(e, address));
        cell.addEventListener('contextmenu', (e) => this.handleContextMenu(e, address));
        
        rowDiv.appendChild(cell);
        this.cellElements.set(address, cell);
      }
      wrapper.appendChild(rowDiv);
    }
    
    this.container.appendChild(wrapper);
  }

  setCellContent(address, value, result) {
    const cell = this.cellElements.get(address);
    if (!cell) return;
    
    this.cells[address] = value;
    const content = cell.querySelector('.grid-cell-content');
    
    cell.classList.remove('formula', 'number', 'error', 'in-range', 'in-selection');
    
    if (FormulaHelper.isFormula(value)) {
      cell.classList.add('formula');
    }
    
    if (typeof result === 'string' && result.startsWith('#ERROR')) {
      cell.classList.add('error');
      content.textContent = result;
    } else if (typeof result === 'number') {
      cell.classList.add('number');
      content.textContent = result.toString();
    } else {
      content.textContent = result.toString();
    }
  }

  selectCell(address, event) {
    if (event && event.shiftKey && this.selectedStart) {
      this.selectedEnd = address;
      this.updateSelectionDisplay();
    } else if (event && event.ctrlKey) {
      // Multi-select handled separately
    } else {
      this.selectedStart = address;
      this.selectedEnd = null;
      this.updateSelectionDisplay();
    }
    
    if (this.onSelectionChanged) {
      this.onSelectionChanged(this.selectedStart, this.selectedEnd);
    }
  }

  updateSelectionDisplay() {
    this.cellElements.forEach((cell) => {
      cell.classList.remove('selected', 'in-selection');
    });
    
    if (this.selectedStart) {
      const startCell = this.cellElements.get(this.selectedStart);
      if (startCell) startCell.classList.add('selected');
    }
    
    if (this.selectedStart && this.selectedEnd) {
      const cells = this.getSelectionCells();
      for (const addr of cells) {
        const cell = this.cellElements.get(addr);
        if (cell) cell.classList.add('in-selection');
      }
    }
  }

  getSelectionCells() {
    if (!this.selectedStart) return [];
    if (!this.selectedEnd) return [this.selectedStart];
    
    const startCol = FormulaHelper.colLetterToNumber(this.selectedStart.match(/[A-Z]+/)[0]);
    const startRow = parseInt(this.selectedStart.match(/\d+/)[0]);
    const endCol = FormulaHelper.colLetterToNumber(this.selectedEnd.match(/[A-Z]+/)[0]);
    const endRow = parseInt(this.selectedEnd.match(/\d+/)[0]);
    
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    
    const cells = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        cells.push(FormulaHelper.colNumberToLetter(c) + r);
      }
    }
    return cells;
  }

  editCell(address) {
    this.editingCell = address;
    const cell = this.cellElements.get(address);
    if (!cell) return;
    
    const value = this.cells[address] || '';
    cell.innerHTML = `<input type="text" class="grid-cell-edit" value="${this.escapeHtml(value)}">`;
    const input = cell.querySelector('input');
    input.focus();
    input.select();
    
    input.addEventListener('blur', () => this.finishEditing(address));
    input.addEventListener('keydown', (e) => this.handleEditKeydown(e, address));
  }

  finishEditing(address) {
    const cell = this.cellElements.get(address);
    if (!cell) return;
    
    const input = cell.querySelector('input');
    if (!input) return;
    
    const newValue = input.value;
    const oldValue = this.cells[address] || '';
    
    this.cells[address] = newValue;
    
    this.editingCell = null;
    
    // Restore cell display
    const content = document.createElement('div');
    content.className = 'grid-cell-content';
    content.textContent = '';
    cell.innerHTML = '';
    cell.appendChild(content);
    
    if (newValue !== oldValue && this.onCellChanged) {
      this.onCellChanged(address, oldValue, newValue);
    }
    
    this.updateSelectionDisplay();
  }

  handleEditKeydown(event, address) {
    if (event.key === 'Enter') {
      this.finishEditing(address);
      this.navigateCell(address, 0, 1);
    } else if (event.key === 'Escape') {
      this.editingCell = null;
      this.updateSelectionDisplay();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      this.finishEditing(address);
      this.navigateCell(address, event.shiftKey ? -1 : 1, 0);
    }
  }

  navigateCell(from, colDelta, rowDelta) {
    const col = FormulaHelper.colLetterToNumber(from.match(/[A-Z]+/)[0]);
    const row = parseInt(from.match(/\d+/)[0]);
    
    const newCol = col + colDelta;
    const newRow = row + rowDelta;
    
    if (newCol >= 1 && newCol <= this.cols && newRow >= 1 && newRow <= this.rows) {
      const newAddr = FormulaHelper.colNumberToLetter(newCol) + newRow;
      this.selectCell(newAddr);
      this.scrollToCell(newAddr);
    }
  }

  scrollToCell(address) {
    const cell = this.cellElements.get(address);
    if (cell) {
      cell.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
    }
  }

  copy() {
    const cells = this.getSelectionCells();
    const data = {};
    for (const addr of cells) {
      data[addr] = this.cells[addr] || '';
    }
    this.clipboard = { data, range: cells, startCell: this.selectedStart };
    this.clipboardMode = 'copy';
  }

  cut() {
    this.copy();
    this.clipboardMode = 'cut';
  }

  paste() {
    if (!this.clipboard) return;
    
    const startCell = this.selectedStart;
    const startCol = FormulaHelper.colLetterToNumber(startCell.match(/[A-Z]+/)[0]);
    const startRow = parseInt(startCell.match(/\d+/)[0]);
    
    const clipStartCol = FormulaHelper.colLetterToNumber(this.clipboard.startCell.match(/[A-Z]+/)[0]);
    const clipStartRow = parseInt(this.clipboard.startCell.match(/\d+/)[0]);
    
    const updates = {};
    const action = {
      type: 'paste',
      updates: {},
      startCell,
      originalClipboardMode: this.clipboardMode
    };
    
    for (const addr in this.clipboard.data) {
      const col = FormulaHelper.colLetterToNumber(addr.match(/[A-Z]+/)[0]);
      const row = parseInt(addr.match(/\d+/)[0]);
      
      const newCol = startCol + (col - clipStartCol);
      const newRow = startRow + (row - clipStartRow);
      
      if (newCol >= 1 && newCol <= this.cols && newRow >= 1 && newRow <= this.rows) {
        const newAddr = FormulaHelper.colNumberToLetter(newCol) + newRow;
        let newValue = this.clipboard.data[addr];
        
        if (FormulaHelper.isFormula(newValue)) {
          const colDelta = newCol - col;
          const rowDelta = newRow - row;
          newValue = newValue.substring(1);
          newValue = newValue.replace(/([A-Z]+)(\d+)/g, (match, c, r) => {
            const nc = FormulaHelper.colLetterToNumber(c) + colDelta;
            const nr = parseInt(r) + rowDelta;
            if (nc >= 1 && nr >= 1 && nc <= this.cols && nr <= this.rows) {
              return FormulaHelper.colNumberToLetter(nc) + nr;
            }
            return match;
          });
          newValue = '=' + newValue;
        }
        
        const oldValue = this.cells[newAddr] || '';
        updates[newAddr] = newValue;
        action.updates[newAddr] = { old: oldValue, new: newValue };
        this.cells[newAddr] = newValue;
      }
    }
    
    if (this.clipboardMode === 'cut') {
      this.clipboard = null;
      this.clipboardMode = null;
    }
    
    this.undoStack.push(action);
    this.redoStack = [];
    
    if (this.onPaste) {
      this.onPaste(updates);
    }
  }

  pasteText(text) {
    const rows = text.trim().split(/[\r\n]+/);
    const updates = {};
    const action = {
      type: 'paste',
      updates: {},
      startCell: this.selectedStart
    };
    
    const startCell = this.selectedStart;
    const startCol = FormulaHelper.colLetterToNumber(startCell.match(/[A-Z]+/)[0]);
    const startRow = parseInt(startCell.match(/\d+/)[0]);
    
    for (let r = 0; r < rows.length; r++) {
      const cols = rows[r].split(/\t/);
      for (let c = 0; c < cols.length; c++) {
        const newCol = startCol + c;
        const newRow = startRow + r;
        if (newCol <= this.cols && newRow <= this.rows) {
          const addr = FormulaHelper.colNumberToLetter(newCol) + newRow;
          const newValue = cols[c];
          const oldValue = this.cells[addr] || '';
          updates[addr] = newValue;
          action.updates[addr] = { old: oldValue, new: newValue };
          this.cells[addr] = newValue;
        }
      }
    }
    
    this.undoStack.push(action);
    this.redoStack = [];
    
    if (this.onPaste) {
      this.onPaste(updates);
    }
  }

  fill(direction) {
    const cells = this.getSelectionCells();
    if (cells.length < 2) return;
    
    const updates = {};
    const action = {
      type: 'fill',
      direction,
      updates: {},
      startCell: this.selectedStart
    };
    
    let sourceCells = [];
    let targetCells = [];
    
    if (direction === 'down') {
      const rows = new Set(cells.map(c => parseInt(c.match(/\d+/)[0])));
      const minRow = Math.min(...rows);
      const maxRow = Math.max(...rows);
      sourceCells = cells.filter(c => parseInt(c.match(/\d+/)[0]) === minRow);
      targetCells = cells.filter(c => parseInt(c.match(/\d+/)[0]) > minRow);
    } else if (direction === 'right') {
      const cols = new Set(cells.map(c => c.match(/[A-Z]+/)[0]));
      const sortedCols = Array.from(cols).sort();
      const minCol = sortedCols[0];
      const maxCol = sortedCols[sortedCols.length - 1];
      sourceCells = cells.filter(c => c.match(/[A-Z]+/)[0] === minCol);
      targetCells = cells.filter(c => c.match(/[A-Z]+/)[0] !== minCol);
    }
    
    if (sourceCells.length === 0) return;
    
    for (const targetCell of targetCells) {
      const sourceCell = sourceCells[0];
      let value = this.cells[sourceCell] || '';
      
      if (FormulaHelper.isFormula(value)) {
        value = FormulaHelper.adjustFormula(value, sourceCell, targetCell);
      } else {
        const sourceVal = parseFloat(this.cells[sourceCell] || '');
        if (!isNaN(sourceVal)) {
          const sourceRow = parseInt(sourceCell.match(/\d+/)[0]);
          const targetRow = parseInt(targetCell.match(/\d+/)[0]);
          const rowDelta = targetRow - sourceRow;
          value = (sourceVal + rowDelta).toString();
        }
      }
      
      const oldValue = this.cells[targetCell] || '';
      updates[targetCell] = value;
      action.updates[targetCell] = { old: oldValue, new: value };
      this.cells[targetCell] = value;
    }
    
    this.undoStack.push(action);
    this.redoStack = [];
    
    if (this.onFill) {
      this.onFill(updates);
    }
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    
    const action = this.undoStack.pop();
    this.redoStack.push(action);
    
    const updates = {};
    for (const addr in action.updates) {
      const old = action.updates[addr].old;
      this.cells[addr] = old;
      updates[addr] = old;
    }
    
    if (this.onUndo) {
      this.onUndo(updates);
    }
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    
    const action = this.redoStack.pop();
    this.undoStack.push(action);
    
    const updates = {};
    for (const addr in action.updates) {
      const newVal = action.updates[addr].new;
      this.cells[addr] = newVal;
      updates[addr] = newVal;
    }
    
    if (this.onRedo) {
      this.onRedo(updates);
    }
    return true;
  }

  addPresenceIndicator(sessionId, userId, color, cell, range) {
    const address = cell;
    const cellEl = this.cellElements.get(address);
    if (!cellEl) return;
    
    let indicator = this.presenceIndicators.get(sessionId);
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'presence-indicator';
      indicator.style.borderColor = color;
      indicator.dataset.sessionId = sessionId;
      cellEl.appendChild(indicator);
      this.presenceIndicators.set(sessionId, indicator);
    }
  }

  removePresenceIndicator(sessionId) {
    const indicator = this.presenceIndicators.get(sessionId);
    if (indicator) {
      indicator.remove();
      this.presenceIndicators.delete(sessionId);
    }
  }

  handleMouseDown(event, address) {
    if (event.button !== 0) return;
    this.selectCell(address, event);
  }

  handleMouseOver(event, address) {
    if (event.buttons !== 1) return;
    this.selectedEnd = address;
    this.updateSelectionDisplay();
  }

  handleMouseUp(event, address) {
    // Selection already handled
  }

  handleContextMenu(event, address) {
    event.preventDefault();
  }

  attachEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (this.editingCell) return;
      
      const ctrl = e.ctrlKey || e.metaKey;
      
      if (ctrl && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        this.copy();
      } else if (ctrl && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        this.cut();
      } else if (ctrl && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        this.paste();
      } else if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
        if (this.onUpdated) this.onUpdated();
      } else if ((ctrl && e.key.toLowerCase() === 'y') || (ctrl && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        this.redo();
        if (this.onUpdated) this.onUpdated();
      } else if (e.key.toLowerCase() === 'arrowup') {
        e.preventDefault();
        this.navigateCell(this.selectedStart, 0, -1);
      } else if (e.key.toLowerCase() === 'arrowdown') {
        e.preventDefault();
        this.navigateCell(this.selectedStart, 0, 1);
      } else if (e.key.toLowerCase() === 'arrowleft') {
        e.preventDefault();
        this.navigateCell(this.selectedStart, -1, 0);
      } else if (e.key.toLowerCase() === 'arrowright') {
        e.preventDefault();
        this.navigateCell(this.selectedStart, 1, 0);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.deleteSelection();
      } else if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        this.fill('down');
      } else if (ctrl && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        this.fill('right');
      }
    });
  }

  deleteSelection() {
    const cells = this.getSelectionCells();
    const updates = {};
    const action = {
      type: 'delete',
      updates: {}
    };
    
    for (const addr of cells) {
      const oldValue = this.cells[addr] || '';
      updates[addr] = '';
      action.updates[addr] = { old: oldValue, new: '' };
      this.cells[addr] = '';
    }
    
    this.undoStack.push(action);
    this.redoStack = [];
    
    if (this.onDelete) {
      this.onDelete(updates);
    }
  }

  find(text, options = {}) {
    const results = [];
    for (const [addr, value] of Object.entries(this.cells)) {
      let match = false;
      const searchValue = options.matchCase ? value : value.toLowerCase();
      const searchText = options.matchCase ? text : text.toLowerCase();
      
      if (options.wholeCell) {
        match = searchValue === searchText;
      } else {
        match = searchValue.includes(searchText);
      }
      
      if (match) {
        results.push(addr);
      }
    }
    return results;
  }

  replace(text, replacement, options = {}) {
    const results = this.find(text, options);
    const updates = {};
    const action = {
      type: 'replace',
      updates: {}
    };
    
    for (const addr of results) {
      const value = this.cells[addr] || '';
      const searchValue = options.matchCase ? value : value.toLowerCase();
      const searchText = options.matchCase ? text : text.toLowerCase();
      
      let newValue;
      if (options.wholeCell) {
        newValue = searchValue === searchText ? replacement : value;
      } else {
        newValue = value.replace(
          new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options.matchCase ? 'g' : 'gi'),
          replacement
        );
      }
      
      if (newValue !== value) {
        updates[addr] = newValue;
        action.updates[addr] = { old: value, new: newValue };
        this.cells[addr] = newValue;
      }
    }
    
    if (Object.keys(updates).length > 0) {
      this.undoStack.push(action);
      this.redoStack = [];
    }
    
    return updates;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getNameBoxValue() {
    const start = this.selectedStart;
    const end = this.selectedEnd;
    
    if (!start) return '';
    if (!end || start === end) return start;
    
    return start + ':' + end;
  }

  setNameBoxValue(value) {
    const parts = value.split(':');
    if (parts.length === 1 && FormulaHelper.isCellReference(value)) {
      this.selectCell(value);
      this.scrollToCell(value);
    } else if (parts.length === 2 && FormulaHelper.isCellReference(parts[0]) && FormulaHelper.isCellReference(parts[1])) {
      this.selectedStart = parts[0];
      this.selectedEnd = parts[1];
      this.updateSelectionDisplay();
      this.scrollToCell(parts[0]);
    }
  }

  getFormulaBarValue() {
    return this.cells[this.selectedStart] || '';
  }

  setFormulaBarValue(value) {
    if (!this.selectedStart) return;
    const oldValue = this.cells[this.selectedStart] || '';
    this.cells[this.selectedStart] = value;
    
    if (value !== oldValue && this.onCellChanged) {
      this.onCellChanged(this.selectedStart, oldValue, value);
    }
  }
}

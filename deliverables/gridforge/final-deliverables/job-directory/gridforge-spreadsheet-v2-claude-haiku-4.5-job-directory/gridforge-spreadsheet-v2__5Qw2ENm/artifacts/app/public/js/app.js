class GridForgeApp {
  constructor() {
    this.workbookId = 'ops-plan';
    this.userId = null;
    this.sessionId = null;
    this.users = [];
    this.grid = null;
    this.currentRevision = 0;
    this.autosaveTimer = null;
    this.presenceTimer = null;
    this.lastSavedSnapshot = null;
    this.findCurrentIndex = 0;
    this.findResults = [];
  }

  async init() {
    try {
      const data = await api.getWorkbook(this.workbookId);
      this.users = data.users;
      this.currentRevision = data.revision;
      this.showUserSelection();
    } catch (error) {
      console.error('Failed to load workbook:', error);
      alert('Failed to load workbook: ' + error.message);
    }
  }

  showUserSelection() {
    const modal = document.getElementById('user-select-modal');
    const buttons = document.getElementById('user-buttons');
    
    buttons.innerHTML = '';
    for (const user of this.users) {
      const btn = document.createElement('button');
      btn.className = 'user-btn';
      btn.textContent = user.name + ' (' + user.id + ')';
      btn.addEventListener('click', () => this.selectUser(user.id));
      buttons.appendChild(btn);
    }
    
    modal.style.display = 'flex';
  }

  async selectUser(userId) {
    this.userId = userId;
    
    try {
      const response = await api.createSession(this.workbookId, userId);
      this.sessionId = response.sessionId;
      
      document.getElementById('user-select-modal').style.display = 'none';
      document.getElementById('main-app').style.display = 'flex';
      
      await this.loadWorkbook();
      this.attachEventListeners();
      this.startAutosave();
      this.startPresenceUpdates();
    } catch (error) {
      console.error('Failed to create session:', error);
      alert('Failed to create session: ' + error.message);
    }
  }

  async loadWorkbook() {
    try {
      const data = await api.getWorkbook(this.workbookId);
      
      document.getElementById('workbook-title').textContent = data.workbook.title;
      document.getElementById('user-indicator').textContent = this.users.find(u => u.id === this.userId)?.name || this.userId;
      
      this.currentRevision = data.revision;
      this.lastSavedSnapshot = this.buildSnapshot(data);
      
      this.grid = new Grid('grid', 80, 20);
      
      for (const sheet of data.sheets) {
        for (const [addr, cellData] of Object.entries(sheet.cells)) {
          const value = cellData.value;
          const result = cellData.result;
          this.grid.setCellContent(addr, value, result);
        }
      }
      
      this.grid.selectedStart = 'A1';
      this.grid.updateSelectionDisplay();
      this.updateFormulaBar();
      this.updateNameBox();
      this.updateSaveStatus('saved');
      
      this.grid.onCellChanged = (addr, oldValue, newValue) => this.handleCellChange(addr, oldValue, newValue);
      this.grid.onPaste = (updates) => this.handlePaste(updates);
      this.grid.onFill = (updates) => this.handleFill(updates);
      this.grid.onDelete = (updates) => this.handleDelete(updates);
      this.grid.onSelectionChanged = () => this.onSelectionChanged();
      this.grid.onUndo = (updates) => this.handleUndo(updates);
      this.grid.onRedo = (updates) => this.handleRedo(updates);
      this.grid.onUpdated = () => this.updateFormulaBar();
    } catch (error) {
      console.error('Failed to load workbook:', error);
      alert('Failed to load workbook: ' + error.message);
    }
  }

  buildSnapshot(data) {
    const sheets = data.sheets.map(sheet => ({
      id: sheet.id,
      name: sheet.name,
      cells: Object.fromEntries(
        Object.entries(sheet.cells).map(([addr, cellData]) => [addr, cellData.value])
      )
    }));

    return {
      workbook: data.workbook,
      sheets
    };
  }

  handleCellChange(addr, oldValue, newValue) {
    this.updateSaveStatus('unsaved');
    this.updateFormulaBar();
    this.updateNameBox();
    // Recalculate this cell and dependent cells
    if (FormulaHelper.isFormula(newValue)) {
      api.calculate(this.grid.cells, addr).then(data => {
        this.grid.setCellContent(addr, newValue, data.result);
      }).catch(err => {
        this.grid.setCellContent(addr, newValue, '#ERROR: ' + err.message);
      });
    } else {
      const num = parseFloat(newValue);
      const result = isNaN(num) ? newValue : num;
      this.grid.setCellContent(addr, newValue, result);
    }
    this.scheduleSave();
  }

  handlePaste(updates) {
    this.updateSaveStatus('unsaved');
    // Update cell displays for pasted cells
    for (const addr in updates) {
      const value = this.grid.cells[addr];
      if (FormulaHelper.isFormula(value)) {
        api.calculate(this.grid.cells, addr).then(data => {
          this.grid.setCellContent(addr, value, data.result);
        }).catch(err => {
          this.grid.setCellContent(addr, value, '#ERROR: ' + err.message);
        });
      } else {
        const num = parseFloat(value);
        const result = isNaN(num) ? value : num;
        this.grid.setCellContent(addr, value, result);
      }
    }
    this.scheduleSave();
  }

  handleFill(updates) {
    this.updateSaveStatus('unsaved');
    // Update cell displays for filled cells
    for (const addr in updates) {
      const value = this.grid.cells[addr];
      if (FormulaHelper.isFormula(value)) {
        api.calculate(this.grid.cells, addr).then(data => {
          this.grid.setCellContent(addr, value, data.result);
        }).catch(err => {
          this.grid.setCellContent(addr, value, '#ERROR: ' + err.message);
        });
      } else {
        const num = parseFloat(value);
        const result = isNaN(num) ? value : num;
        this.grid.setCellContent(addr, value, result);
      }
    }
    this.scheduleSave();
  }

  handleDelete(updates) {
    this.updateSaveStatus('unsaved');
    // Clear the cell displays for deleted cells
    for (const addr in updates) {
      this.grid.setCellContent(addr, '', '');
    }
    this.scheduleSave();
  }

  handleUndo(updates) {
    this.updateSaveStatus('unsaved');
    for (const addr in updates) {
      this.grid.setCellContent(addr, this.grid.cells[addr], updates[addr]);
    }
    this.refreshCellCalculations();
    this.updateFormulaBar();
    this.updateNameBox();
  }

  handleRedo(updates) {
    this.updateSaveStatus('unsaved');
    for (const addr in updates) {
      this.grid.setCellContent(addr, this.grid.cells[addr], updates[addr]);
    }
    this.refreshCellCalculations();
    this.updateFormulaBar();
    this.updateNameBox();
  }

  onSelectionChanged() {
    this.updateFormulaBar();
    this.updateNameBox();
    if (this.sessionId) {
      this.updatePresence();
    }
  }

  updateFormulaBar() {
    if (!this.grid.selectedStart) {
      document.getElementById('formula-input').value = '';
      return;
    }
    
    const value = this.grid.cells[this.grid.selectedStart] || '';
    document.getElementById('formula-input').value = value;
  }

  updateNameBox() {
    if (!this.grid.selectedStart) {
      document.getElementById('name-box').value = '';
      return;
    }
    
    const nameBoxValue = this.grid.getNameBoxValue();
    document.getElementById('name-box').value = nameBoxValue;
  }

  updateSaveStatus(status) {
    const statusEl = document.getElementById('save-status');
    statusEl.className = 'save-status ' + status;
    
    if (status === 'saving') {
      statusEl.textContent = 'Saving...';
    } else if (status === 'saved') {
      statusEl.textContent = 'Saved';
    } else if (status === 'unsaved') {
      statusEl.textContent = 'Unsaved changes';
    } else if (status === 'error') {
      statusEl.textContent = 'Save failed';
    }
  }

  refreshCellCalculations() {
    for (const addr of Object.keys(this.grid.cells)) {
      const value = this.grid.cells[addr];
      if (FormulaHelper.isFormula(value)) {
        api.calculate(this.grid.cells, addr).then(data => {
          this.grid.setCellContent(addr, value, data.result);
        }).catch(err => {
          this.grid.setCellContent(addr, value, '#ERROR: ' + err.message);
        });
      }
    }
  }

  scheduleSave() {
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => this.save(), 5000);
  }

  async save() {
    try {
      this.updateSaveStatus('saving');
      
      const snapshot = this.buildSnapshot({
        workbook: { id: this.workbookId, title: document.getElementById('workbook-title').textContent },
        sheets: [{
          id: 'plan',
          name: 'Plan',
          cells: {}
        }]
      });

      snapshot.sheets[0].cells = this.grid.cells;

      const result = await api.saveWorkbook(
        this.workbookId,
        snapshot,
        this.currentRevision,
        this.sessionId
      );

      if (result.success) {
        this.currentRevision = result.newRevision;
        this.lastSavedSnapshot = snapshot;
        this.updateSaveStatus('saved');
      } else if (result.conflicts) {
        this.handleSaveConflict(result.conflicts);
      }
    } catch (error) {
      console.error('Save failed:', error);
      this.updateSaveStatus('error');
    }
  }

  handleSaveConflict(conflicts) {
    const msg = 'Save conflict: Changes were made to the same cells by another user.\n\n' +
      conflicts.map(c => `${c.address}: Was "${c.current}", you tried "${c.incoming}"`).join('\n') +
      '\n\nYour changes have not been saved.';
    alert(msg);
    this.updateSaveStatus('error');
  }

  startAutosave() {
    this.autosaveTimer = setTimeout(() => this.save(), 5000);
  }

  startPresenceUpdates() {
    this.presenceTimer = setInterval(() => this.updatePresenceDisplay(), 3000);
  }

  updatePresence() {
    if (!this.sessionId) return;
    
    const selection = this.grid.getSelectionCells();
    const cell = this.grid.selectedStart;
    const range = selection.length > 1 ? this.grid.selectedStart + ':' + this.grid.selectedEnd : null;
    
    api.updatePresence(this.sessionId, cell, range).catch(err => {
      console.error('Failed to update presence:', err);
    });
  }

  async updatePresenceDisplay() {
    try {
      const data = await api.getPresence(this.workbookId);
      const panel = document.getElementById('presence-panel');
      const list = document.getElementById('presence-list');
      
      list.innerHTML = '';
      
      for (const p of data.presence) {
        if (p.sessionId === this.sessionId) continue;
        
        const item = document.createElement('div');
        item.className = 'presence-item';
        item.style.borderLeftColor = p.color;
        
        const name = document.createElement('div');
        name.className = 'presence-item-name';
        name.textContent = p.user?.name || p.userId;
        item.appendChild(name);
        
        if (p.cell) {
          const cellInfo = document.createElement('div');
          cellInfo.className = 'presence-item-cell';
          cellInfo.textContent = p.cell;
          item.appendChild(cellInfo);
        }
        
        list.appendChild(item);
        
        if (p.cell) {
          this.grid.addPresenceIndicator(p.sessionId, p.userId, p.color, p.cell, p.range);
        }
      }
      
      if (data.presence.length > 0) {
        panel.classList.add('active');
      }
    } catch (error) {
      console.error('Failed to update presence:', error);
    }
  }

  attachEventListeners() {
    document.getElementById('btn-save').addEventListener('click', () => this.save());
    document.getElementById('btn-undo').addEventListener('click', () => {
      this.grid.undo();
      this.updateFormulaBar();
      this.updateNameBox();
    });
    document.getElementById('btn-redo').addEventListener('click', () => {
      this.grid.redo();
      this.updateFormulaBar();
      this.updateNameBox();
    });
    document.getElementById('btn-cut').addEventListener('click', () => this.grid.cut());
    document.getElementById('btn-copy').addEventListener('click', () => this.grid.copy());
    document.getElementById('btn-paste').addEventListener('click', () => this.grid.paste());
    document.getElementById('btn-fill-down').addEventListener('click', () => {
      this.grid.fill('down');
      this.refreshCellCalculations();
      this.updateSaveStatus('unsaved');
      this.scheduleSave();
    });
    document.getElementById('btn-fill-right').addEventListener('click', () => {
      this.grid.fill('right');
      this.refreshCellCalculations();
      this.updateSaveStatus('unsaved');
      this.scheduleSave();
    });

    document.getElementById('formula-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = e.target.value;
        this.grid.setFormulaBarValue(value);
        this.updateSaveStatus('unsaved');
        this.scheduleSave();
      }
    });

    document.getElementById('formula-input').addEventListener('input', (e) => {
      const value = e.target.value;
      if (value.startsWith('=')) {
        const suggestions = FormulaHelper.suggestFunctions(value.substring(1));
        const suggestionsEl = document.getElementById('formula-suggestions');
        if (suggestions.length > 0) {
          suggestionsEl.innerHTML = suggestions.map(s => 
            `<div class="formula-suggestion">${s}</div>`
          ).join('');
          suggestionsEl.style.display = 'block';
        } else {
          suggestionsEl.style.display = 'none';
        }
      } else {
        document.getElementById('formula-suggestions').style.display = 'none';
      }
    });

    document.getElementById('name-box').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = e.target.value;
        this.grid.setNameBoxValue(value);
        this.updateFormulaBar();
      }
    });

    document.getElementById('btn-find').addEventListener('click', () => {
      document.getElementById('find-modal').style.display = 'flex';
    });
    
    document.getElementById('close-find').addEventListener('click', () => {
      document.getElementById('find-modal').style.display = 'none';
    });
    
    document.getElementById('btn-close-find').addEventListener('click', () => {
      document.getElementById('find-modal').style.display = 'none';
    });

    document.getElementById('btn-find-all').addEventListener('click', () => this.findAll());
    document.getElementById('btn-replace-next').addEventListener('click', () => this.replaceNext());
    document.getElementById('btn-replace-all').addEventListener('click', () => this.replaceAll());

    document.getElementById('btn-revisions').addEventListener('click', () => this.showRevisions());
    document.getElementById('close-revisions').addEventListener('click', () => {
      document.getElementById('revisions-modal').style.display = 'none';
    });
    document.getElementById('btn-close-revisions').addEventListener('click', () => {
      document.getElementById('revisions-modal').style.display = 'none';
    });
    document.getElementById('btn-restore-revision').addEventListener('click', () => this.restoreRevision());

    document.getElementById('close-history').addEventListener('click', () => {
      document.getElementById('history-modal').style.display = 'none';
    });
    document.getElementById('btn-close-history').addEventListener('click', () => {
      document.getElementById('history-modal').style.display = 'none';
    });

    document.addEventListener('keydown', (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.save();
      } else if (ctrl && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        document.getElementById('find-modal').style.display = 'flex';
      }
    });

    document.addEventListener('paste', (e) => {
      if (e.target === document.getElementById('formula-input')) return;
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      this.grid.pasteText(text);
      this.refreshCellCalculations();
      this.updateSaveStatus('unsaved');
      this.scheduleSave();
    });
  }

  findAll() {
    const text = document.getElementById('find-input').value;
    const matchCase = document.getElementById('find-match-case').checked;
    const wholeCell = document.getElementById('find-whole-cell').checked;
    
    this.findResults = this.grid.find(text, { matchCase, wholeCell });
    this.findCurrentIndex = 0;
    this.displayFindResults();
  }

  displayFindResults() {
    const resultsEl = document.getElementById('find-results');
    if (this.findResults.length === 0) {
      resultsEl.innerHTML = '<div>No matches found</div>';
      return;
    }
    
    resultsEl.innerHTML = this.findResults.map((addr, i) => 
      `<div class="find-result-item" data-index="${i}" onclick="app.selectFindResult(${i})">${addr}: ${app.grid.cells[addr]}</div>`
    ).join('');
  }

  selectFindResult(index) {
    const addr = this.findResults[index];
    this.grid.selectCell(addr);
    this.grid.scrollToCell(addr);
    this.updateFormulaBar();
    this.updateNameBox();
  }

  replaceNext() {
    if (this.findResults.length === 0) {
      alert('No matches found');
      return;
    }
    
    const addr = this.findResults[this.findCurrentIndex];
    const text = document.getElementById('find-input').value;
    const replacement = document.getElementById('replace-input').value;
    const matchCase = document.getElementById('find-match-case').checked;
    const wholeCell = document.getElementById('find-whole-cell').checked;
    
    const value = this.grid.cells[addr] || '';
    const searchValue = matchCase ? value : value.toLowerCase();
    const searchText = matchCase ? text : text.toLowerCase();
    
    let newValue;
    if (wholeCell) {
      newValue = searchValue === searchText ? replacement : value;
    } else {
      newValue = value.replace(
        new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi'),
        replacement
      );
    }
    
    this.grid.cells[addr] = newValue;
    this.grid.onCellChanged(addr, value, newValue);
    
    this.findCurrentIndex = (this.findCurrentIndex + 1) % this.findResults.length;
    const nextAddr = this.findResults[this.findCurrentIndex];
    this.grid.selectCell(nextAddr);
    this.grid.scrollToCell(nextAddr);
  }

  replaceAll() {
    const text = document.getElementById('find-input').value;
    const replacement = document.getElementById('replace-input').value;
    const matchCase = document.getElementById('find-match-case').checked;
    const wholeCell = document.getElementById('find-whole-cell').checked;
    
    const updates = this.grid.replace(text, replacement, { matchCase, wholeCell });
    
    if (Object.keys(updates).length > 0) {
      this.refreshCellCalculations();
      this.updateSaveStatus('unsaved');
      this.scheduleSave();
      alert(`Replaced ${Object.keys(updates).length} cells`);
    } else {
      alert('No matches found');
    }
  }

  async showRevisions() {
    try {
      const data = await api.getRevisions(this.workbookId);
      const modal = document.getElementById('revisions-modal');
      const listEl = document.getElementById('revisions-list');
      
      listEl.innerHTML = data.revisions.map(r => `
        <div class="revision-item" data-revision="${r.revision}" onclick="app.selectRevision(${r.revision})">
          <div class="revision-item-revision">Revision ${r.revision}</div>
          <div class="revision-item-date">${new Date(r.created_at).toLocaleString()}</div>
        </div>
      `).join('');
      
      modal.style.display = 'flex';
    } catch (error) {
      console.error('Failed to load revisions:', error);
      alert('Failed to load revisions: ' + error.message);
    }
  }

  async selectRevision(revision) {
    try {
      const data = await api.getRevision(this.workbookId, revision);
      const previewEl = document.getElementById('preview-content');
      
      let preview = '';
      for (const sheet of data.sheets) {
        for (const [addr, cellData] of Object.entries(sheet.cells)) {
          const value = cellData.value;
          preview += `${addr}: ${value}\n`;
        }
      }
      
      previewEl.textContent = preview || '(no changes)';
      document.getElementById('revision-preview').style.display = 'block';
      
      this.selectedRevision = {
        revision,
        data
      };
    } catch (error) {
      console.error('Failed to load revision:', error);
      alert('Failed to load revision: ' + error.message);
    }
  }

  restoreRevision() {
    if (!this.selectedRevision) return;
    
    const revision = this.selectedRevision;
    for (const sheet of revision.data.sheets) {
      for (const [addr, cellData] of Object.entries(sheet.cells)) {
        this.grid.cells[addr] = cellData.value;
      }
    }
    
    this.currentRevision = revision.revision;
    this.refreshCellCalculations();
    this.updateFormulaBar();
    this.updateNameBox();
    this.updateSaveStatus('unsaved');
    this.scheduleSave();
    
    document.getElementById('revisions-modal').style.display = 'none';
  }
}

const app = new GridForgeApp();
app.init();

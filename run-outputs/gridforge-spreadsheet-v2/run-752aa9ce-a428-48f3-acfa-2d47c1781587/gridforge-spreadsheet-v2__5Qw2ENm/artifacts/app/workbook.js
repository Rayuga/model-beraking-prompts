const FormulaCalculator = require('./formula');

class Workbook {
  constructor(db) {
    this.db = db;
  }

  async load(workbookId, revision = null) {
    const snapshot = await this.db.getRevision(workbookId, revision);
    if (!snapshot) throw new Error('Workbook not found');
    return snapshot;
  }

  async getCurrentCells(workbookId) {
    const snapshot = await this.load(workbookId);
    if (!snapshot || !snapshot.sheets || snapshot.sheets.length === 0) {
      return {};
    }
    return snapshot.sheets[0]?.cells || {};
  }

  async calculateCell(workbookId, address) {
    const cells = await this.getCurrentCells(workbookId);
    const calc = new FormulaCalculator(cells);
    const value = cells[address];
    if (!value) return '';
    return calc.calculate(value);
  }

  async updateCell(workbookId, sheetId, cellAddress, newValue, userId) {
    const snapshot = await this.load(workbookId);
    
    if (!snapshot.sheets || snapshot.sheets.length === 0) {
      throw new Error('No sheets found');
    }

    const sheet = snapshot.sheets[0];
    const previousValue = sheet.cells[cellAddress] || '';

    sheet.cells[cellAddress] = newValue;

    const newRevision = await this.db.saveRevision(workbookId, snapshot);
    await this.db.recordCellChange(workbookId, sheetId, cellAddress, newRevision, previousValue, newValue, userId);

    return { newRevision, previousValue, newValue };
  }

  async updateCells(workbookId, sheetId, updates, userId) {
    const snapshot = await this.load(workbookId);
    
    if (!snapshot.sheets || snapshot.sheets.length === 0) {
      throw new Error('No sheets found');
    }

    const sheet = snapshot.sheets[0];
    const changes = [];

    for (const [cellAddress, newValue] of Object.entries(updates)) {
      const previousValue = sheet.cells[cellAddress] || '';
      sheet.cells[cellAddress] = newValue;
      changes.push({ cellAddress, previousValue, newValue });
    }

    const newRevision = await this.db.saveRevision(workbookId, snapshot);

    for (const change of changes) {
      await this.db.recordCellChange(
        workbookId, 
        sheetId, 
        change.cellAddress, 
        newRevision, 
        change.previousValue, 
        change.newValue, 
        userId
      );
    }

    return { newRevision, changes };
  }

  async validateWorkbook(snapshot) {
    if (!snapshot.workbook || !snapshot.workbook.id || !snapshot.workbook.title) {
      throw new Error('Missing workbook identity');
    }

    if (!Array.isArray(snapshot.sheets)) {
      throw new Error('Sheets must be an array');
    }

    for (const sheet of snapshot.sheets) {
      if (!sheet.id || !sheet.name) {
        throw new Error('Sheet missing identity or name');
      }
      if (typeof sheet.cells !== 'object') {
        throw new Error('Sheet cells must be an object');
      }
      for (const [addr, value] of Object.entries(sheet.cells)) {
        if (typeof value !== 'string') {
          throw new Error(`Cell ${addr} value must be a string`);
        }
      }
    }

    return true;
  }

  async saveWithConflictResolution(workbookId, basedOnRevision, snapshot, userId) {
    await this.validateWorkbook(snapshot);

    const workbook = await this.db.getWorkbook(workbookId);
    if (!workbook) throw new Error('Workbook not found');

    const currentSnapshot = await this.load(workbookId);
    if (snapshot.workbook.id !== workbookId || snapshot.workbook.title !== currentSnapshot.workbook.title) {
      throw new Error('Workbook identity mismatch');
    }

    if (basedOnRevision !== workbook.current_revision) {
      return await this.mergeChanges(workbookId, basedOnRevision, snapshot, userId);
    }

    const newRevision = await this.db.saveRevision(workbookId, snapshot);

    const currentSheet = currentSnapshot.sheets[0];
    const newSheet = snapshot.sheets[0];

    for (const [addr, newValue] of Object.entries(newSheet.cells)) {
      const previousValue = currentSheet.cells[addr] || '';
      if (previousValue !== newValue) {
        await this.db.recordCellChange(workbookId, newSheet.id, addr, newRevision, previousValue, newValue, userId);
      }
    }

    return { success: true, newRevision };
  }

  async mergeChanges(workbookId, basedOnRevision, incomingSnapshot, userId) {
    const baseSnapshot = await this.load(workbookId, basedOnRevision);
    const currentSnapshot = await this.load(workbookId);

    const baseSheet = baseSnapshot.sheets[0];
    const currentSheet = currentSnapshot.sheets[0];
    const incomingSheet = incomingSnapshot.sheets[0];

    const mergedCells = { ...currentSheet.cells };
    const conflicts = [];

    for (const [addr, incomingValue] of Object.entries(incomingSheet.cells)) {
      const baseValue = baseSheet.cells[addr] || '';
      const currentValue = currentSheet.cells[addr] || '';

      if (baseValue === currentValue) {
        mergedCells[addr] = incomingValue;
      } else if (incomingValue === baseValue) {
        mergedCells[addr] = currentValue;
      } else {
        conflicts.push({
          address: addr,
          current: currentValue,
          incoming: incomingValue,
          base: baseValue
        });
        mergedCells[addr] = currentValue;
      }
    }

    if (conflicts.length > 0) {
      return {
        success: false,
        conflicts,
        message: 'Save rejected due to concurrent changes to the same cells'
      };
    }

    const mergedSnapshot = {
      workbook: currentSnapshot.workbook,
      sheets: currentSnapshot.sheets.map((sheet, index) => ({
        ...sheet,
        cells: index === 0 ? mergedCells : sheet.cells
      }))
    };

    const newRevision = await this.db.saveRevision(workbookId, mergedSnapshot);

    const newSheet = mergedSnapshot.sheets[0];
    for (const [addr, newValue] of Object.entries(newSheet.cells)) {
      const previousValue = currentSheet.cells[addr] || '';
      if (previousValue !== newValue) {
        await this.db.recordCellChange(workbookId, newSheet.id, addr, newRevision, previousValue, newValue, userId);
      }
    }

    return { success: true, newRevision, merged: true };
  }
}

module.exports = Workbook;

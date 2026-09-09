class FormulaHelper {
  static isFormula(value) {
    return typeof value === 'string' && value.startsWith('=');
  }

  static getFormulaFunctions() {
    return ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'];
  }

  static suggestFunctions(input) {
    const functions = this.getFormulaFunctions();
    const suggestions = [];
    
    for (const func of functions) {
      if (func.startsWith(input.toUpperCase())) {
        suggestions.push(func + '()');
      }
    }
    return suggestions;
  }

  static extractCellReferences(formula) {
    const references = [];
    const regex = /([A-Z]+\d+(?::[A-Z]+\d+)?)/g;
    let match;
    while ((match = regex.exec(formula)) !== null) {
      references.push(match[1]);
    }
    return [...new Set(references)];
  }

  static colLetterToNumber(col) {
    col = col.toUpperCase();
    let num = 0;
    for (let i = 0; i < col.length; i++) {
      num = num * 26 + (col.charCodeAt(i) - 64);
    }
    return num;
  }

  static colNumberToLetter(num) {
    let col = '';
    while (num > 0) {
      num--;
      col = String.fromCharCode(65 + num % 26) + col;
      num = Math.floor(num / 26);
    }
    return col;
  }

  static parseRange(range) {
    const [start, end] = range.split(':');
    if (!end) return [start];
    
    const startCol = this.colLetterToNumber(start.match(/[A-Z]+/)[0]);
    const startRow = parseInt(start.match(/\d+/)[0]);
    const endCol = this.colLetterToNumber(end.match(/[A-Z]+/)[0]);
    const endRow = parseInt(end.match(/\d+/)[0]);
    
    const cells = [];
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        cells.push(this.colNumberToLetter(c) + r);
      }
    }
    return cells;
  }

  static adjustFormula(formula, fromCell, toCell) {
    const fromCol = this.colLetterToNumber(fromCell.match(/[A-Z]+/)[0]);
    const fromRow = parseInt(fromCell.match(/\d+/)[0]);
    const toCol = this.colLetterToNumber(toCell.match(/[A-Z]+/)[0]);
    const toRow = parseInt(toCell.match(/\d+/)[0]);
    
    const colOffset = toCol - fromCol;
    const rowOffset = toRow - fromRow;
    
    return formula.replace(/([A-Z]+)(\d+)(?=[^\d]|$)/g, (match, col, row) => {
      const c = this.colLetterToNumber(col);
      const r = parseInt(row);
      return this.colNumberToLetter(c + colOffset) + (r + rowOffset);
    });
  }

  static isCellReference(str) {
    return /^[A-Z]+\d+$/.test(str.trim());
  }

  static isRangeReference(str) {
    return /^[A-Z]+\d+:[A-Z]+\d+$/.test(str.trim());
  }
}

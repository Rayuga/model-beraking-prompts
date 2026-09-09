class FormulaCalculator {
  constructor(cells) {
    this.cells = cells || {};
    this.computing = new Set();
  }

  setCells(cells) {
    this.cells = cells || {};
  }

  isFormula(value) {
    return typeof value === 'string' && value.startsWith('=');
  }

  calculate(value) {
    if (!this.isFormula(value)) {
      const num = parseFloat(value);
      return isNaN(num) ? value : num;
    }

    const formula = value.substring(1).trim();
    try {
      return this.evaluateExpression(formula);
    } catch (e) {
      return '#ERROR: ' + e.message;
    }
  }

  getCellValue(address) {
    const value = this.cells[address];
    if (value === undefined || value === '') return 0;
    if (this.isFormula(value)) return this.calculate(value);
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }

  evaluateExpression(expr) {
    expr = expr.trim();
    
    if (this.computing.has(expr)) {
      throw new Error('Circular reference');
    }

    this.computing.add(expr);
    try {
      return this.parseExpression(expr);
    } finally {
      this.computing.delete(expr);
    }
  }

  parseExpression(expr) {
    return this.parseAddSubtract(expr);
  }

  parseAddSubtract(expr) {
    let tokens = this.tokenize(expr);
    let result = this.parseMultiplyDivide(tokens[0]);
    let i = 1;

    while (i < tokens.length) {
      const op = tokens[i];
      const right = this.parseMultiplyDivide(tokens[i + 1]);
      if (op === '+') result = result + right;
      else if (op === '-') result = result - right;
      i += 2;
    }
    return result;
  }

  parseMultiplyDivide(expr) {
    if (typeof expr !== 'string') return expr;
    
    let tokens = this.tokenizeMultDiv(expr);
    let result = this.parsePrimary(tokens[0]);
    let i = 1;

    while (i < tokens.length) {
      const op = tokens[i];
      const right = this.parsePrimary(tokens[i + 1]);
      if (op === '*') result = result * right;
      else if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        result = result / right;
      }
      i += 2;
    }
    return result;
  }

  parsePrimary(expr) {
    if (typeof expr !== 'string') return expr;
    
    expr = expr.trim();

    if (expr.startsWith('(') && expr.endsWith(')')) {
      return this.evaluateExpression(expr.substring(1, expr.length - 1));
    }

    if (expr.toUpperCase().startsWith('SUM(')) {
      return this.parseFunction('SUM', expr);
    }
    if (expr.toUpperCase().startsWith('AVG(')) {
      return this.parseFunction('AVG', expr);
    }
    if (expr.toUpperCase().startsWith('MIN(')) {
      return this.parseFunction('MIN', expr);
    }
    if (expr.toUpperCase().startsWith('MAX(')) {
      return this.parseFunction('MAX', expr);
    }
    if (expr.toUpperCase().startsWith('COUNT(')) {
      return this.parseFunction('COUNT', expr);
    }

    if (this.isRange(expr)) {
      return this.getRangeValues(expr);
    }

    if (this.isCellReference(expr)) {
      return this.getCellValue(expr);
    }

    const num = parseFloat(expr);
    if (isNaN(num)) throw new Error('Invalid expression: ' + expr);
    return num;
  }

  parseFunction(func, expr) {
    const match = expr.match(/^([A-Z]+)\((.*)\)$/i);
    if (!match) throw new Error('Invalid function syntax');
    
    const args = this.parseArguments(match[2]);
    const values = [];

    for (const arg of args) {
      if (this.isRange(arg)) {
        values.push(...this.getRangeValues(arg));
      } else if (this.isCellReference(arg)) {
        values.push(this.getCellValue(arg));
      } else {
        const num = parseFloat(arg);
        if (!isNaN(num)) values.push(num);
      }
    }

    if (values.length === 0) return 0;

    switch (func.toUpperCase()) {
      case 'SUM':
        return values.reduce((a, b) => a + b, 0);
      case 'AVG':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'MIN':
        return Math.min(...values);
      case 'MAX':
        return Math.max(...values);
      case 'COUNT':
        return values.length;
      default:
        throw new Error('Unknown function: ' + func);
    }
  }

  parseArguments(str) {
    const args = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }

    if (current.trim()) args.push(current.trim());
    return args;
  }

  isRange(expr) {
    expr = expr.trim();
    return /^[A-Za-z]+\d+:[A-Za-z]+\d+$/.test(expr);
  }

  isCellReference(expr) {
    expr = expr.trim();
    return /^[A-Za-z]+\d+$/.test(expr);
  }

  getRangeValues(range) {
    const [start, end] = range.split(':');
    const values = [];
    const startCol = this.colLetterToNumber(start.match(/[A-Za-z]+/)[0]);
    const startRow = parseInt(start.match(/\d+/)[0]);
    const endCol = this.colLetterToNumber(end.match(/[A-Za-z]+/)[0]);
    const endRow = parseInt(end.match(/\d+/)[0]);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const addr = this.colNumberToLetter(c) + r;
        const val = this.getCellValue(addr);
        if (val !== 0 || this.cells[addr]) {
          values.push(val);
        }
      }
    }
    return values;
  }

  tokenize(expr) {
    const tokens = [];
    let current = '';

    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];
      if (char === '+' || char === '-') {
        if (current.trim()) tokens.push(current.trim());
        tokens.push(char);
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) tokens.push(current.trim());
    return tokens;
  }

  tokenizeMultDiv(expr) {
    if (typeof expr !== 'string') return [expr];
    
    const tokens = [];
    let current = '';
    let inParen = 0;
    let inFunc = false;

    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];
      if (char === '(') {
        inParen++;
        current += char;
      } else if (char === ')') {
        inParen--;
        current += char;
      } else if ((char === '*' || char === '/') && inParen === 0) {
        if (current.trim()) tokens.push(current.trim());
        tokens.push(char);
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) tokens.push(current.trim());
    return tokens;
  }

  colLetterToNumber(col) {
    col = col.toUpperCase();
    let num = 0;
    for (let i = 0; i < col.length; i++) {
      num = num * 26 + (col.charCodeAt(i) - 64);
    }
    return num;
  }

  colNumberToLetter(num) {
    let col = '';
    while (num > 0) {
      num--;
      col = String.fromCharCode(65 + num % 26) + col;
      num = Math.floor(num / 26);
    }
    return col;
  }
}

module.exports = FormulaCalculator;

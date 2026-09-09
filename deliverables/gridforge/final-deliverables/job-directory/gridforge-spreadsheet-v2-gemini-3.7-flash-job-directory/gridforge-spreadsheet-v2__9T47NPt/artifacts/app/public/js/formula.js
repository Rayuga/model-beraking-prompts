/**
 * GridForge Formula & Calculation Engine
 * Pure JavaScript - zero external dependencies.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FormulaEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Helper: column letter <-> index (1-based: A=1, B=2, ..., Z=26, AA=27...)
  function colLetterToIndex(colStr) {
    let index = 0;
    const str = colStr.toUpperCase();
    for (let i = 0; i < str.length; i++) {
      index = index * 26 + (str.charCodeAt(i) - 64);
    }
    return index;
  }

  function indexToColLetter(index) {
    let col = '';
    let temp = index;
    while (temp > 0) {
      let rem = (temp - 1) % 26;
      col = String.fromCharCode(65 + rem) + col;
      temp = Math.floor((temp - 1) / 26);
    }
    return col;
  }

  // Parse cell reference: "A1", "$B$2", "C$3", "$D4" -> { colStr, rowNum, colIndex, isColAbs, isRowAbs }
  function parseCellRef(ref) {
    const match = ref.match(/^(\$?)([A-Za-z]+)(\$?)([1-9][0-9]*)$/);
    if (!match) return null;
    const isColAbs = match[1] === '$';
    const colStr = match[2].toUpperCase();
    const isRowAbs = match[3] === '$';
    const rowNum = parseInt(match[4], 10);
    const colIndex = colLetterToIndex(colStr);
    return {
      raw: ref,
      colStr,
      rowNum,
      colIndex,
      isColAbs,
      isRowAbs,
      normalized: `${colStr}${rowNum}`
    };
  }

  // Expand range: "A1:B3" -> ["A1", "A2", "A3", "B1", "B2", "B3"]
  function expandRange(startRef, endRef) {
    const pStart = parseCellRef(startRef);
    const pEnd = parseCellRef(endRef);
    if (!pStart || !pEnd) return [];

    const minCol = Math.min(pStart.colIndex, pEnd.colIndex);
    const maxCol = Math.max(pStart.colIndex, pEnd.colIndex);
    const minRow = Math.min(pStart.rowNum, pEnd.rowNum);
    const maxRow = Math.max(pStart.rowNum, pEnd.rowNum);

    const cells = [];
    for (let c = minCol; c <= maxCol; c++) {
      const colLetter = indexToColLetter(c);
      for (let r = minRow; r <= maxRow; r++) {
        cells.push(`${colLetter}${r}`);
      }
    }
    return cells;
  }

  // Shift cell reference by deltaRow and deltaCol (respecting $ absolute modifiers)
  function shiftCellRef(ref, deltaRow, deltaCol) {
    const p = parseCellRef(ref);
    if (!p) return ref;

    let targetCol = p.colIndex;
    if (!p.isColAbs) {
      targetCol += deltaCol;
    }
    let targetRow = p.rowNum;
    if (!p.isRowAbs) {
      targetRow += deltaRow;
    }

    if (targetCol < 1 || targetRow < 1) {
      return '#REF!';
    }

    const colStr = indexToColLetter(targetCol);
    const prefixCol = p.isColAbs ? '$' : '';
    const prefixRow = p.isRowAbs ? '$' : '';
    return `${prefixCol}${colStr}${prefixRow}${targetRow}`;
  }

  // Shift formula references
  function shiftFormula(formulaStr, deltaRow, deltaCol) {
    if (!formulaStr || !formulaStr.startsWith('=')) return formulaStr;
    const formulaBody = formulaStr.slice(1);

    // Replace range refs and cell refs using regex
    // Range regex: (\$?[A-Za-z]+\$?[1-9][0-9]*):(\$?[A-Za-z]+\$?[1-9][0-9]*)
    // Cell regex: (\$?[A-Za-z]+\$?[1-9][0-9]*)
    const rangeRegex = /(\$?[A-Za-z]+\$?[1-9][0-9]*):(\$?[A-Za-z]+\$?[1-9][0-9]*)/g;
    const cellRegex = /(^|[^A-Za-z0-9_:\$])(\$?[A-Za-z]+\$?[1-9][0-9]*)(?![A-Za-z0-9_:\(])/g;

    let shifted = formulaBody.replace(rangeRegex, (match, ref1, ref2) => {
      const s1 = shiftCellRef(ref1, deltaRow, deltaCol);
      const s2 = shiftCellRef(ref2, deltaRow, deltaCol);
      if (s1 === '#REF!' || s2 === '#REF!') return '#REF!';
      return `${s1}:${s2}`;
    });

    shifted = shifted.replace(cellRegex, (match, prefix, ref) => {
      const shiftedRef = shiftCellRef(ref, deltaRow, deltaCol);
      return `${prefix}${shiftedRef}`;
    });

    return `=${shifted}`;
  }

  // Extract all referenced cell addresses from a formula string (returns array of uppercase normalized cell keys)
  function extractDependencies(formulaStr) {
    if (!formulaStr || !formulaStr.startsWith('=')) return [];
    const deps = new Set();
    const str = formulaStr.slice(1);

    // Match ranges: A1:B10
    const rangeRegex = /([A-Za-z]+\$?[1-9][0-9]*):([A-Za-z]+\$?[1-9][0-9]*)/g;
    let match;
    const stripped = str.replace(rangeRegex, (m, r1, r2) => {
      const cells = expandRange(r1, r2);
      cells.forEach(c => deps.add(c));
      return '___RANGE___';
    });

    // Match single cell refs: A1, B2 (avoid matching function names followed by paren)
    const cellRegex = /\b([A-Za-z]+[1-9][0-9]*)\b(?!\s*\()/g;
    while ((match = cellRegex.exec(stripped)) !== null) {
      const ref = match[1].toUpperCase();
      // Ensure it's a valid cell ref
      if (parseCellRef(ref)) {
        deps.add(ref);
      }
    }

    return Array.from(deps);
  }

  // --- Lexer / Tokenizer ---
  const TOKEN_TYPES = {
    NUMBER: 'NUMBER',
    STRING: 'STRING',
    IDENTIFIER: 'IDENTIFIER',
    CELL_REF: 'CELL_REF',
    RANGE_REF: 'RANGE_REF',
    OPERATOR: 'OPERATOR',
    LPAREN: 'LPAREN',
    RPAREN: 'RPAREN',
    COMMA: 'COMMA',
    COLON: 'COLON'
  };

  function tokenize(input) {
    const tokens = [];
    let i = 0;
    const str = input.startsWith('=') ? input.slice(1) : input;

    while (i < str.length) {
      const char = str[i];

      if (/\s/.test(char)) {
        i++;
        continue;
      }

      if (char === '(') {
        tokens.push({ type: TOKEN_TYPES.LPAREN, value: '(' });
        i++;
        continue;
      }
      if (char === ')') {
        tokens.push({ type: TOKEN_TYPES.RPAREN, value: ')' });
        i++;
        continue;
      }
      if (char === ',') {
        tokens.push({ type: TOKEN_TYPES.COMMA, value: ',' });
        i++;
        continue;
      }
      if (char === ':') {
        tokens.push({ type: TOKEN_TYPES.COLON, value: ':' });
        i++;
        continue;
      }

      // Comparison / Multi-char operators
      if (char === '<') {
        if (str[i + 1] === '>') {
          tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '<>' });
          i += 2;
          continue;
        }
        if (str[i + 1] === '=') {
          tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '<=' });
          i += 2;
          continue;
        }
        tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '<' });
        i++;
        continue;
      }
      if (char === '>') {
        if (str[i + 1] === '=') {
          tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '>=' });
          i += 2;
          continue;
        }
        tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '>' });
        i++;
        continue;
      }
      if (char === '!' && str[i + 1] === '=') {
        tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '!=' });
        i += 2;
        continue;
      }
      if (char === '=' || char === '+' || char === '-' || char === '*' || char === '/' || char === '^' || char === '%') {
        tokens.push({ type: TOKEN_TYPES.OPERATOR, value: char });
        i++;
        continue;
      }

      // Strings in quotes
      if (char === '"' || char === "'") {
        const quote = char;
        let s = '';
        i++;
        while (i < str.length && str[i] !== quote) {
          s += str[i];
          i++;
        }
        if (i < str.length && str[i] === quote) {
          i++;
        }
        tokens.push({ type: TOKEN_TYPES.STRING, value: s });
        continue;
      }

      // Numbers
      if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(str[i + 1]))) {
        let numStr = '';
        while (i < str.length && /[0-9.]/.test(str[i])) {
          numStr += str[i];
          i++;
        }
        tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseFloat(numStr) });
        continue;
      }

      // Identifiers, Cell references, Ranges, or Function names
      if (/[A-Za-z_\$]/.test(char)) {
        let ident = '';
        while (i < str.length && /[A-Za-z0-9_\$]/.test(str[i])) {
          ident += str[i];
          i++;
        }

        // Check if followed by colon for range: e.g. A1:B10
        if (str[i] === ':') {
          let j = i + 1;
          while (j < str.length && /\s/.test(str[j])) j++;
          if (/[A-Za-z0-9_\$]/.test(str[j])) {
            let ident2 = '';
            while (j < str.length && /[A-Za-z0-9_\$]/.test(str[j])) {
              ident2 += str[j];
              j++;
            }
            if (parseCellRef(ident) && parseCellRef(ident2)) {
              tokens.push({ type: TOKEN_TYPES.RANGE_REF, value: `${ident}:${ident2}` });
              i = j;
              continue;
            }
          }
        }

        // Check if it's a cell reference
        if (parseCellRef(ident)) {
          tokens.push({ type: TOKEN_TYPES.CELL_REF, value: ident.toUpperCase() });
          continue;
        }

        // Otherwise identifier (function name like SUM, AVG, MIN, MAX, COUNT, or TRUE/FALSE)
        const upper = ident.toUpperCase();
        if (upper === 'TRUE') {
          tokens.push({ type: TOKEN_TYPES.NUMBER, value: 1 });
        } else if (upper === 'FALSE') {
          tokens.push({ type: TOKEN_TYPES.NUMBER, value: 0 });
        } else {
          tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value: upper });
        }
        continue;
      }

      // Unknown character
      throw new Error(`Unexpected character: '${char}'`);
    }

    return tokens;
  }

  // --- Parser (Recursive Descent) ---
  class FormulaParser {
    constructor(tokens, cellLookupFn) {
      this.tokens = tokens;
      this.pos = 0;
      this.cellLookupFn = cellLookupFn || (() => 0);
    }

    peek() {
      return this.tokens[this.pos] || null;
    }

    consume(expectedType, expectedValue) {
      const token = this.peek();
      if (!token) throw new Error('#SYNTAX!');
      if (expectedType && token.type !== expectedType) {
        throw new Error('#SYNTAX!');
      }
      if (expectedValue && token.value !== expectedValue) {
        throw new Error('#SYNTAX!');
      }
      this.pos++;
      return token;
    }

    parse() {
      if (this.tokens.length === 0) return 0;
      const result = this.parseExpression();
      if (this.pos < this.tokens.length) {
        throw new Error('#SYNTAX!');
      }
      return result;
    }

    // Comparison: =, <>, !=, <, <=, >, >=
    parseExpression() {
      let left = this.parseAdditive();

      while (this.peek() && this.peek().type === TOKEN_TYPES.OPERATOR &&
        ['=', '<>', '!=', '<', '<=', '>', '>='].includes(this.peek().value)) {
        const op = this.consume().value;
        const right = this.parseAdditive();
        if (op === '=') left = (left === right) ? 1 : 0;
        else if (op === '<>' || op === '!=') left = (left !== right) ? 1 : 0;
        else if (op === '<') left = (left < right) ? 1 : 0;
        else if (op === '<=') left = (left <= right) ? 1 : 0;
        else if (op === '>') left = (left > right) ? 1 : 0;
        else if (op === '>=') left = (left >= right) ? 1 : 0;
      }

      return left;
    }

    // Addition, Subtraction: +, -
    parseAdditive() {
      let left = this.parseMultiplicative();

      while (this.peek() && this.peek().type === TOKEN_TYPES.OPERATOR &&
        (this.peek().value === '+' || this.peek().value === '-')) {
        const op = this.consume().value;
        const right = this.parseMultiplicative();
        const lNum = this.toNumber(left);
        const rNum = this.toNumber(right);
        if (op === '+') left = lNum + rNum;
        else if (op === '-') left = lNum - rNum;
      }

      return left;
    }

    // Multiplication, Division: *, /
    parseMultiplicative() {
      let left = this.parseExponentiation();

      while (this.peek() && this.peek().type === TOKEN_TYPES.OPERATOR &&
        (this.peek().value === '*' || this.peek().value === '/')) {
        const op = this.consume().value;
        const right = this.parseExponentiation();
        const lNum = this.toNumber(left);
        const rNum = this.toNumber(right);
        if (op === '*') left = lNum * rNum;
        else if (op === '/') {
          if (rNum === 0) throw new Error('#DIV/0!');
          left = lNum / rNum;
        }
      }

      return left;
    }

    // Exponentiation: ^
    parseExponentiation() {
      let left = this.parseUnary();

      while (this.peek() && this.peek().type === TOKEN_TYPES.OPERATOR && this.peek().value === '^') {
        this.consume();
        const right = this.parseUnary();
        left = Math.pow(this.toNumber(left), this.toNumber(right));
      }

      return left;
    }

    // Unary: +, -
    parseUnary() {
      if (this.peek() && this.peek().type === TOKEN_TYPES.OPERATOR &&
        (this.peek().value === '+' || this.peek().value === '-')) {
        const op = this.consume().value;
        const operand = this.parseUnary();
        const num = this.toNumber(operand);
        return op === '-' ? -num : num;
      }

      return this.parsePrimary();
    }

    // Primary: Number, String, CellRef, FunctionCall, Range (in function), (Expr)
    parsePrimary() {
      const token = this.peek();
      if (!token) throw new Error('#SYNTAX!');

      if (token.type === TOKEN_TYPES.NUMBER) {
        this.consume();
        // Check for percent postfix
        if (this.peek() && this.peek().type === TOKEN_TYPES.OPERATOR && this.peek().value === '%') {
          this.consume();
          return token.value / 100;
        }
        return token.value;
      }

      if (token.type === TOKEN_TYPES.STRING) {
        this.consume();
        return token.value;
      }

      if (token.type === TOKEN_TYPES.CELL_REF) {
        this.consume();
        const cellVal = this.cellLookupFn(token.value);
        if (typeof cellVal === 'string' && cellVal.startsWith('#')) {
          throw new Error(cellVal);
        }
        return cellVal;
      }

      if (token.type === TOKEN_TYPES.IDENTIFIER) {
        return this.parseFunctionCall();
      }

      if (token.type === TOKEN_TYPES.LPAREN) {
        this.consume(TOKEN_TYPES.LPAREN);
        const expr = this.parseExpression();
        this.consume(TOKEN_TYPES.RPAREN);
        return expr;
      }

      throw new Error('#SYNTAX!');
    }

    parseFunctionCall() {
      const fnNameToken = this.consume(TOKEN_TYPES.IDENTIFIER);
      const fnName = fnNameToken.value.toUpperCase();

      this.consume(TOKEN_TYPES.LPAREN);
      const rawArgs = [];

      if (this.peek() && this.peek().type !== TOKEN_TYPES.RPAREN) {
        while (true) {
          // Check if argument is a RANGE_REF e.g. A1:B10
          if (this.peek() && this.peek().type === TOKEN_TYPES.RANGE_REF) {
            const rangeToken = this.consume(TOKEN_TYPES.RANGE_REF);
            const [r1, r2] = rangeToken.value.split(':');
            const cells = expandRange(r1, r2);
            for (const cellRef of cells) {
              const val = this.cellLookupFn(cellRef);
              rawArgs.push(val);
            }
          } else {
            // Expression argument
            const val = this.parseExpression();
            rawArgs.push(val);
          }

          if (this.peek() && this.peek().type === TOKEN_TYPES.COMMA) {
            this.consume(TOKEN_TYPES.COMMA);
          } else {
            break;
          }
        }
      }

      this.consume(TOKEN_TYPES.RPAREN);
      return this.evaluateFunction(fnName, rawArgs);
    }

    evaluateFunction(fnName, args) {
      // Flatten any nested arrays
      const flatArgs = [];
      const flatten = (items) => {
        for (const item of items) {
          if (Array.isArray(item)) flatten(item);
          else flatArgs.push(item);
        }
      };
      flatten(args);

      // Check for error propagation in arguments
      for (const arg of flatArgs) {
        if (typeof arg === 'string' && arg.startsWith('#')) {
          throw new Error(arg);
        }
      }

      // Filter numeric values for statistical functions
      const numbers = [];
      for (const val of flatArgs) {
        if (val === null || val === undefined || val === '') continue;
        if (typeof val === 'number') {
          if (!isNaN(val)) numbers.push(val);
        } else if (typeof val === 'string') {
          const num = Number(val);
          if (!isNaN(num) && val.trim() !== '') {
            numbers.push(num);
          }
        } else if (typeof val === 'boolean') {
          numbers.push(val ? 1 : 0);
        }
      }

      switch (fnName) {
        case 'SUM': {
          let sum = 0;
          for (const n of numbers) sum += n;
          return sum;
        }
        case 'AVG':
        case 'AVERAGE': {
          if (numbers.length === 0) throw new Error('#DIV/0!');
          let sum = 0;
          for (const n of numbers) sum += n;
          return sum / numbers.length;
        }
        case 'MIN': {
          if (numbers.length === 0) return 0;
          return Math.min(...numbers);
        }
        case 'MAX': {
          if (numbers.length === 0) return 0;
          return Math.max(...numbers);
        }
        case 'COUNT': {
          return numbers.length;
        }
        default:
          throw new Error('#NAME?');
      }
    }

    toNumber(val) {
      if (typeof val === 'number') return val;
      if (val === null || val === undefined || val === '') return 0;
      if (typeof val === 'boolean') return val ? 1 : 0;
      if (typeof val === 'string') {
        if (val.startsWith('#')) throw new Error(val);
        const num = Number(val);
        if (isNaN(num)) throw new Error('#VALUE!');
        return num;
      }
      return 0;
    }
  }

  // --- Evaluation Engine & Dependency Graph ---
  class WorkbookCalculator {
    constructor(cells = {}) {
      this.rawCells = { ...cells }; // cellRef -> string raw value
      this.computedValues = {};     // cellRef -> computed result (number, string, or error string)
      this.errors = {};             // cellRef -> error message
      this.dependencies = {};       // cellRef -> [deps]
      this.reverseDependencies = {};// dep -> [cells depending on it]
    }

    setCells(cells) {
      this.rawCells = { ...cells };
      this.computeAll();
    }

    setCell(ref, rawValue) {
      const normalizedRef = ref.toUpperCase();
      if (rawValue === '' || rawValue === null || rawValue === undefined) {
        delete this.rawCells[normalizedRef];
      } else {
        this.rawCells[normalizedRef] = String(rawValue);
      }
      this.computeAll();
    }

    computeAll() {
      this.computedValues = {};
      this.errors = {};
      this.dependencies = {};
      this.reverseDependencies = {};

      // 1. Build dependency graph
      for (const [ref, raw] of Object.entries(this.rawCells)) {
        if (typeof raw === 'string' && raw.startsWith('=')) {
          const deps = extractDependencies(raw);
          this.dependencies[ref] = deps;
          deps.forEach(d => {
            if (!this.reverseDependencies[d]) this.reverseDependencies[d] = [];
            this.reverseDependencies[d].push(ref);
          });
        }
      }

      // 2. Detect circular dependencies
      const circularCells = this._detectCycles();
      for (const circ of circularCells) {
        this.computedValues[circ] = '#CIRCULAR!';
        this.errors[circ] = 'Circular reference detected';
      }

      // 3. Evaluate non-circular cells in topological order
      const visited = new Set(circularCells);
      const evalCell = (ref) => {
        if (visited.has(ref)) return;
        visited.add(ref);

        const raw = this.rawCells[ref];
        if (raw === undefined || raw === null || raw === '') {
          this.computedValues[ref] = '';
          return;
        }

        if (typeof raw !== 'string' || !raw.startsWith('=')) {
          // Plain value: number or text
          const trimmed = String(raw).trim();
          const num = Number(trimmed);
          if (!isNaN(num) && trimmed !== '') {
            this.computedValues[ref] = num;
          } else {
            this.computedValues[ref] = raw;
          }
          return;
        }

        // Formula cell: evaluate dependencies first
        const deps = this.dependencies[ref] || [];
        for (const dep of deps) {
          if (!visited.has(dep) && !circularCells.has(dep)) {
            evalCell(dep);
          }
        }

        // If any direct dependency is a circular reference, propagate
        for (const dep of deps) {
          if (circularCells.has(dep)) {
            this.computedValues[ref] = '#CIRCULAR!';
            return;
          }
        }

        // Evaluate formula
        try {
          const tokens = tokenize(raw);
          const parser = new FormulaParser(tokens, (cellRef) => {
            const norm = cellRef.toUpperCase();
            if (circularCells.has(norm)) throw new Error('#CIRCULAR!');
            if (this.computedValues[norm] !== undefined) {
              return this.computedValues[norm];
            }
            if (this.rawCells[norm] !== undefined) {
              evalCell(norm);
              return this.computedValues[norm] !== undefined ? this.computedValues[norm] : 0;
            }
            return 0; // Empty cell defaults to 0
          });

          const result = parser.parse();
          // Round floating point artifacts if needed (e.g. 0.1 + 0.2 -> 0.3)
          if (typeof result === 'number' && isFinite(result)) {
            const rounded = Math.round(result * 1e10) / 1e10;
            this.computedValues[ref] = rounded;
          } else {
            this.computedValues[ref] = result;
          }
        } catch (err) {
          const errMsg = err.message.startsWith('#') ? err.message : '#ERROR!';
          this.computedValues[ref] = errMsg;
          this.errors[ref] = err.message;
        }
      };

      for (const ref of Object.keys(this.rawCells)) {
        evalCell(ref);
      }

      return this.computedValues;
    }

    _detectCycles() {
      const circular = new Set();
      const UNVISITED = 0, VISITING = 1, VISITED = 2;
      const state = {};

      const dfs = (node, path) => {
        state[node] = VISITING;
        path.push(node);

        const neighbors = this.dependencies[node] || [];
        for (const neighbor of neighbors) {
          if (this.rawCells[neighbor] && typeof this.rawCells[neighbor] === 'string' && this.rawCells[neighbor].startsWith('=')) {
            if (state[neighbor] === VISITING) {
              // Found cycle! Add all nodes in cycle path
              const cycleStartIdx = path.indexOf(neighbor);
              for (let i = cycleStartIdx; i < path.length; i++) {
                circular.add(path[i]);
              }
            } else if (state[neighbor] !== VISITED) {
              dfs(neighbor, path);
            }
          }
        }

        path.pop();
        state[node] = VISITED;
      };

      for (const node of Object.keys(this.dependencies)) {
        if (!state[node]) {
          dfs(node, []);
        }
      }

      return circular;
    }

    getDisplayValue(ref) {
      const norm = ref.toUpperCase();
      if (this.computedValues[norm] !== undefined) {
        return this.computedValues[norm];
      }
      return this.rawCells[norm] !== undefined ? this.rawCells[norm] : '';
    }

    getRawValue(ref) {
      const norm = ref.toUpperCase();
      return this.rawCells[norm] !== undefined ? this.rawCells[norm] : '';
    }
  }

  // Known built-in functions with descriptions for autocomplete
  const SUPPORTED_FUNCTIONS = [
    { name: 'SUM', signature: 'SUM(value1, [value2, ...])', description: 'Adds all the numbers in a range of cells' },
    { name: 'AVG', signature: 'AVG(value1, [value2, ...])', description: 'Returns the average (arithmetic mean) of arguments' },
    { name: 'AVERAGE', signature: 'AVERAGE(value1, [value2, ...])', description: 'Returns the average of arguments' },
    { name: 'MIN', signature: 'MIN(value1, [value2, ...])', description: 'Returns the smallest number in a set of values' },
    { name: 'MAX', signature: 'MAX(value1, [value2, ...])', description: 'Returns the largest number in a set of values' },
    { name: 'COUNT', signature: 'COUNT(value1, [value2, ...])', description: 'Counts how many numbers are in the list of arguments' },
  ];

  return {
    colLetterToIndex,
    indexToColLetter,
    parseCellRef,
    expandRange,
    shiftCellRef,
    shiftFormula,
    extractDependencies,
    tokenize,
    FormulaParser,
    WorkbookCalculator,
    SUPPORTED_FUNCTIONS
  };
});

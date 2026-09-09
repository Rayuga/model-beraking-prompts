(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GridForgeCore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const MAX_ROWS = 80;
  const MAX_COLS = 20;
  const FUNCTION_NAMES = ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function colToLabel(index) {
    let n = index + 1;
    let label = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      label = String.fromCharCode(65 + rem) + label;
      n = Math.floor((n - 1) / 26);
    }
    return label;
  }

  function labelToCol(label) {
    const text = String(label || '').trim().toUpperCase();
    if (!/^[A-Z]+$/.test(text)) return -1;
    let value = 0;
    for (const ch of text) value = value * 26 + (ch.charCodeAt(0) - 64);
    return value - 1;
  }

  function addressToCoords(address) {
    const match = /^([A-Z]+)([1-9]\d*)$/i.exec(String(address || '').trim());
    if (!match) return null;
    const col = labelToCol(match[1]);
    const row = Number(match[2]) - 1;
    if (col < 0 || row < 0) return null;
    return { row, col };
  }

  function coordsToAddress(row, col) {
    return `${colToLabel(col)}${row + 1}`;
  }

  function isValidAddress(address) {
    const coords = addressToCoords(address);
    return !!coords && coords.row < MAX_ROWS && coords.col < MAX_COLS;
  }

  function parseRangeAddress(text) {
    const match = /^([A-Z]+[1-9]\d*):([A-Z]+[1-9]\d*)$/i.exec(String(text || '').trim());
    if (!match) return null;
    const start = addressToCoords(match[1]);
    const end = addressToCoords(match[2]);
    if (!start || !end) return null;
    const top = Math.min(start.row, end.row);
    const bottom = Math.max(start.row, end.row);
    const left = Math.min(start.col, end.col);
    const right = Math.max(start.col, end.col);
    if (top < 0 || left < 0 || bottom >= MAX_ROWS || right >= MAX_COLS) return null;
    return { startRow: top, endRow: bottom, startCol: left, endCol: right };
  }

  function rectFromAddresses(startAddress, endAddress) {
    const a = addressToCoords(startAddress);
    const b = addressToCoords(endAddress);
    if (!a || !b) return null;
    return {
      startRow: Math.min(a.row, b.row),
      endRow: Math.max(a.row, b.row),
      startCol: Math.min(a.col, b.col),
      endCol: Math.max(a.col, b.col),
    };
  }

  function rectToAddresses(rect) {
    const addresses = [];
    for (let row = rect.startRow; row <= rect.endRow; row += 1) {
      for (let col = rect.startCol; col <= rect.endCol; col += 1) {
        addresses.push(coordsToAddress(row, col));
      }
    }
    return addresses;
  }

  function normalizeRect(a, b) {
    if (!a || !b) return null;
    return {
      startRow: Math.min(a.startRow, b.startRow),
      endRow: Math.max(a.endRow, b.endRow),
      startCol: Math.min(a.startCol, b.startCol),
      endCol: Math.max(a.endCol, b.endCol),
    };
  }

  function rectContains(rect, row, col) {
    return row >= rect.startRow && row <= rect.endRow && col >= rect.startCol && col <= rect.endCol;
  }

  function rectWidth(rect) {
    return rect.endCol - rect.startCol + 1;
  }

  function rectHeight(rect) {
    return rect.endRow - rect.startRow + 1;
  }

  function emptyWorkbook(workbookId, title, sheetId = 'sheet-1', sheetName = 'Sheet1') {
    return {
      workbook: { id: workbookId, title },
      sheets: [{ id: sheetId, name: sheetName, cells: {} }],
    };
  }

  function normalizeCells(cells) {
    const normalized = {};
    for (const [address, value] of Object.entries(cells || {})) {
      if (!value && value !== '') continue;
      if (typeof value !== 'string') {
        throw new Error(`Cell ${address} must be a string`);
      }
      if (!isValidAddress(address)) {
        throw new Error(`Invalid cell address: ${address}`);
      }
      normalized[address.toUpperCase()] = value;
    }
    return normalized;
  }

  function validateSnapshot(snapshot) {
    if (!isObject(snapshot)) throw new Error('Snapshot must be an object');
    if (!isObject(snapshot.workbook)) throw new Error('Snapshot workbook is required');
    const { workbook, sheets } = snapshot;
    if (typeof workbook.id !== 'string' || !workbook.id.trim()) throw new Error('Workbook id must be a string');
    if (typeof workbook.title !== 'string' || !workbook.title.trim()) throw new Error('Workbook title must be a string');
    if (!Array.isArray(sheets) || sheets.length === 0) throw new Error('Workbook must include sheets');
    const seenSheetIds = new Set();
    const seenSheetNames = new Set();
    const normalizedSheets = sheets.map((sheet) => {
      if (!isObject(sheet)) throw new Error('Sheet must be an object');
      if (typeof sheet.id !== 'string' || !sheet.id.trim()) throw new Error('Sheet id must be a string');
      if (typeof sheet.name !== 'string' || !sheet.name.trim()) throw new Error('Sheet name must be a string');
      if (seenSheetIds.has(sheet.id)) throw new Error('Duplicate sheet id');
      if (seenSheetNames.has(sheet.name)) throw new Error('Duplicate sheet name');
      seenSheetIds.add(sheet.id);
      seenSheetNames.add(sheet.name);
      return {
        id: sheet.id,
        name: sheet.name,
        cells: normalizeCells(sheet.cells || {}),
      };
    });
    return { workbook: { id: workbook.id, title: workbook.title }, sheets: normalizedSheets };
  }

  function snapshotKey(snapshot) {
    return JSON.stringify(snapshot);
  }

  function getSheet(snapshot, sheetId) {
    return snapshot.sheets.find((sheet) => sheet.id === sheetId) || null;
  }

  function getActiveSheet(snapshot) {
    return snapshot.sheets[0] || null;
  }

  function getCellRaw(snapshot, sheetId, address) {
    const sheet = getSheet(snapshot, sheetId);
    if (!sheet) return '';
    return sheet.cells[address.toUpperCase()] || '';
  }

  function setCellRaw(snapshot, sheetId, address, raw) {
    const sheet = getSheet(snapshot, sheetId);
    if (!sheet) throw new Error(`Unknown sheet ${sheetId}`);
    const key = address.toUpperCase();
    if (!isValidAddress(key)) throw new Error(`Invalid cell address ${key}`);
    if (raw === '' || raw == null) delete sheet.cells[key];
    else sheet.cells[key] = String(raw);
  }

  function isNumericText(text) {
    return /^-?(?:\d+\.?\d*|\d*\.\d+)(?:e[+-]?\d+)?$/i.test(String(text).trim());
  }

  function toNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && isNumericText(value)) return Number(value);
    return null;
  }

  function escapeFormulaString(text) {
    return String(text).replace(/\\/g, '\\\\');
  }

  function tokenizeFormula(input) {
    const text = String(input || '');
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (/\s/.test(ch)) {
        i += 1;
        continue;
      }
      if ('+-*/(),'.includes(ch)) {
        tokens.push({ type: ch, value: ch });
        i += 1;
        continue;
      }
      const slice = text.slice(i);
      const rangeMatch = /^([A-Za-z]+[1-9]\d*):([A-Za-z]+[1-9]\d*)/.exec(slice);
      if (rangeMatch) {
        tokens.push({ type: 'range', value: `${rangeMatch[1].toUpperCase()}:${rangeMatch[2].toUpperCase()}` });
        i += rangeMatch[0].length;
        continue;
      }
      const refMatch = /^([A-Za-z]+[1-9]\d*)/.exec(slice);
      if (refMatch) {
        tokens.push({ type: 'ref', value: refMatch[1].toUpperCase() });
        i += refMatch[0].length;
        continue;
      }
      const numberMatch = /^(?:\d+\.\d*|\d*\.\d+|\d+)/.exec(slice);
      if (numberMatch) {
        tokens.push({ type: 'number', value: numberMatch[0] });
        i += numberMatch[0].length;
        continue;
      }
      const identMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(slice);
      if (identMatch) {
        tokens.push({ type: 'ident', value: identMatch[0].toUpperCase() });
        i += identMatch[0].length;
        continue;
      }
      throw new Error(`Unexpected token near "${slice.slice(0, 8)}"`);
    }
    return tokens;
  }

  function parseFormula(formula) {
    const tokens = tokenizeFormula(formula.startsWith('=') ? formula.slice(1) : formula);
    let index = 0;

    function peek() {
      return tokens[index] || null;
    }

    function consume(type) {
      const token = peek();
      if (!token || token.type !== type) return null;
      index += 1;
      return token;
    }

    function expect(type) {
      const token = consume(type);
      if (!token) throw new Error(`Expected ${type}`);
      return token;
    }

    function parsePrimary() {
      const token = peek();
      if (!token) throw new Error('Unexpected end of formula');
      if (consume('number')) {
        return { type: 'number', value: Number(token.value) };
      }
      if (consume('ref')) {
        return { type: 'ref', address: token.value };
      }
      if (consume('range')) {
        const [start, end] = token.value.split(':');
        return { type: 'range', start, end };
      }
      if (consume('ident')) {
        const name = token.value;
        if (consume('(')) {
          const args = [];
          if (!consume(')')) {
            do {
              args.push(parseExpression());
            } while (consume(','));
            expect(')');
          }
          return { type: 'call', name, args };
        }
        throw new Error(`Unexpected identifier ${name}`);
      }
      if (consume('(')) {
        const expr = parseExpression();
        expect(')');
        return expr;
      }
      throw new Error(`Unexpected token ${token.type}`);
    }

    function parseUnary() {
      if (consume('+')) return { type: 'unary', operator: '+', argument: parseUnary() };
      if (consume('-')) return { type: 'unary', operator: '-', argument: parseUnary() };
      return parsePrimary();
    }

    function parseMultiplicative() {
      let node = parseUnary();
      while (true) {
        if (consume('*')) node = { type: 'binary', operator: '*', left: node, right: parseUnary() };
        else if (consume('/')) node = { type: 'binary', operator: '/', left: node, right: parseUnary() };
        else break;
      }
      return node;
    }

    function parseExpression() {
      let node = parseMultiplicative();
      while (true) {
        if (consume('+')) node = { type: 'binary', operator: '+', left: node, right: parseMultiplicative() };
        else if (consume('-')) node = { type: 'binary', operator: '-', left: node, right: parseMultiplicative() };
        else break;
      }
      return node;
    }

    const ast = parseExpression();
    if (index !== tokens.length) throw new Error('Unexpected trailing tokens');
    return ast;
  }

  function precedence(node) {
    if (!node) return 0;
    if (node.type === 'binary') return node.operator === '+' || node.operator === '-' ? 1 : 2;
    if (node.type === 'unary') return 3;
    return 4;
  }

  function emitFormulaNode(node, rowDelta = 0, colDelta = 0, parentPrec = 0) {
    let text = '';
    if (!node) return text;
    if (node.type === 'number') {
      text = Number.isInteger(node.value) ? String(node.value) : String(node.value);
    } else if (node.type === 'ref') {
      const coords = addressToCoords(node.address);
      if (!coords) throw new Error(`Invalid reference ${node.address}`);
      text = coordsToAddress(coords.row + rowDelta, coords.col + colDelta);
    } else if (node.type === 'range') {
      const start = addressToCoords(node.start);
      const end = addressToCoords(node.end);
      if (!start || !end) throw new Error(`Invalid range ${node.start}:${node.end}`);
      text = `${coordsToAddress(start.row + rowDelta, start.col + colDelta)}:${coordsToAddress(end.row + rowDelta, end.col + colDelta)}`;
    } else if (node.type === 'call') {
      text = `${node.name}(${node.args.map((arg) => emitFormulaNode(arg, rowDelta, colDelta, 0)).join(',')})`;
    } else if (node.type === 'unary') {
      const inner = emitFormulaNode(node.argument, rowDelta, colDelta, precedence(node));
      text = `${node.operator}${inner}`;
    } else if (node.type === 'binary') {
      const prec = precedence(node);
      const left = emitFormulaNode(node.left, rowDelta, colDelta, prec);
      const right = emitFormulaNode(node.right, rowDelta, colDelta, prec + 0.1);
      text = `${left}${node.operator}${right}`;
      if (prec < parentPrec) text = `(${text})`;
      return text;
    } else {
      throw new Error(`Unknown formula node type ${node.type}`);
    }
    if (precedence(node) < parentPrec) return `(${text})`;
    return text;
  }

  function shiftFormula(formula, rowDelta, colDelta) {
    if (!String(formula || '').startsWith('=')) return String(formula || '');
    const ast = parseFormula(formula);
    return '=' + emitFormulaNode(ast, rowDelta, colDelta);
  }

  function flattenEvaluationValue(value) {
    if (Array.isArray(value)) return value.flatMap(flattenEvaluationValue);
    return [value];
  }

  function rangeValues(snapshot, sheetId, range, evalCell, stack) {
    const values = [];
    for (let row = range.startRow; row <= range.endRow; row += 1) {
      for (let col = range.startCol; col <= range.endCol; col += 1) {
        const address = coordsToAddress(row, col);
        values.push(evalCell(sheetId, address, stack));
      }
    }
    return values;
  }

  function evaluateFormula(formula, context) {
    const { snapshot, sheetId, evalCell, stack = [] } = context;
    const ast = parseFormula(formula);

    function evaluateNode(node, localStack) {
      switch (node.type) {
        case 'number':
          return node.value;
        case 'ref':
          return evalCell(sheetId, node.address, localStack);
        case 'range': {
          const range = parseRangeAddress(`${node.start}:${node.end}`);
          if (!range) throw new Error('Invalid range reference');
          return rangeValues(snapshot, sheetId, range, evalCell, localStack);
        }
        case 'unary': {
          const value = evaluateNode(node.argument, localStack);
          const num = toNumber(value);
          if (num == null) throw new Error('Unary operator requires a numeric value');
          return node.operator === '-' ? -num : num;
        }
        case 'binary': {
          const left = evaluateNode(node.left, localStack);
          const right = evaluateNode(node.right, localStack);
          const leftNum = toNumber(left);
          const rightNum = toNumber(right);
          if (leftNum == null || rightNum == null) throw new Error('Arithmetic requires numeric values');
          if (node.operator === '+') return leftNum + rightNum;
          if (node.operator === '-') return leftNum - rightNum;
          if (node.operator === '*') return leftNum * rightNum;
          if (node.operator === '/') {
            if (rightNum === 0) throw new Error('#DIV/0!');
            return leftNum / rightNum;
          }
          throw new Error(`Unknown operator ${node.operator}`);
        }
        case 'call': {
          const name = node.name.toUpperCase();
          if (!FUNCTION_NAMES.includes(name)) throw new Error(`Unknown function ${name}`);
          const values = node.args.flatMap((arg) => flattenEvaluationValue(evaluateNode(arg, localStack)));
          const numbers = values.map(toNumber).filter((item) => item != null);
          if (name === 'SUM') return numbers.reduce((sum, item) => sum + item, 0);
          if (name === 'COUNT') return numbers.length;
          if (name === 'AVG') {
            if (!numbers.length) throw new Error('#DIV/0!');
            return numbers.reduce((sum, item) => sum + item, 0) / numbers.length;
          }
          if (name === 'MIN') return numbers.length ? Math.min(...numbers) : 0;
          if (name === 'MAX') return numbers.length ? Math.max(...numbers) : 0;
          throw new Error(`Unknown function ${name}`);
        }
        default:
          throw new Error(`Unknown formula node type ${node.type}`);
      }
    }

    return evaluateNode(ast, stack);
  }

  function createFormulaEvaluator(snapshot) {
    const cache = new Map();
    const sheet = getActiveSheet(snapshot);
    if (!sheet) throw new Error('Workbook has no sheets');

    function evalCell(sheetId, address, stack = []) {
      const normalized = address.toUpperCase();
      const key = `${sheetId}!${normalized}`;
      if (cache.has(key)) return cache.get(key);
      const currentStack = stack.includes(key) ? stack : stack.concat(key);
      if (stack.includes(key)) throw new Error('#CIRCULAR!');
      const sheetRef = getSheet(snapshot, sheetId);
      if (!sheetRef) throw new Error(`Unknown sheet ${sheetId}`);
      const raw = sheetRef.cells[normalized] || '';
      let value;
      if (String(raw).startsWith('=')) {
        try {
          value = evaluateFormula(raw, { snapshot, sheetId, evalCell, stack: currentStack });
        } catch (error) {
          value = error.message || '#ERROR!';
        }
      } else if (isNumericText(raw)) {
        value = Number(raw);
      } else {
        value = raw;
      }
      cache.set(key, value);
      return value;
    }

    function displayCell(sheetId, address) {
      const raw = getCellRaw(snapshot, sheetId, address);
      if (String(raw).startsWith('=')) {
        const value = evalCell(sheetId, address, []);
        if (typeof value === 'number' && Number.isFinite(value)) return Number.isInteger(value) ? String(value) : String(value);
        return String(value);
      }
      return raw;
    }

    return { evalCell, displayCell };
  }

  function diffCells(baseSheet, nextSheet) {
    const changed = new Map();
    const allAddresses = new Set([...Object.keys(baseSheet.cells || {}), ...Object.keys(nextSheet.cells || {})]);
    for (const address of allAddresses) {
      const before = baseSheet.cells[address] || '';
      const after = nextSheet.cells[address] || '';
      if (before !== after) changed.set(address, { before, after });
    }
    return changed;
  }

  function diffSnapshots(base, next) {
    const result = { workbookChanged: false, sheetChanges: new Map(), workbook: { before: base.workbook, after: next.workbook } };
    if (base.workbook.id !== next.workbook.id || base.workbook.title !== next.workbook.title) {
      result.workbookChanged = true;
    }
    const baseSheets = new Map(base.sheets.map((sheet) => [sheet.id, sheet]));
    const nextSheets = new Map(next.sheets.map((sheet) => [sheet.id, sheet]));
    const allSheetIds = new Set([...baseSheets.keys(), ...nextSheets.keys()]);
    for (const sheetId of allSheetIds) {
      const baseSheet = baseSheets.get(sheetId) || { id: sheetId, name: '', cells: {} };
      const nextSheet = nextSheets.get(sheetId) || { id: sheetId, name: '', cells: {} };
      const changes = diffCells(baseSheet, nextSheet);
      if (baseSheet.name !== nextSheet.name || changes.size) {
        result.sheetChanges.set(sheetId, {
          before: baseSheet,
          after: nextSheet,
          cellChanges: changes,
        });
      }
    }
    return result;
  }

  function applyPatch(base, patchSnapshot) {
    const snapshot = clone(base);
    for (const sheet of patchSnapshot.sheets) {
      const target = getSheet(snapshot, sheet.id);
      if (!target) throw new Error(`Unknown sheet ${sheet.id}`);
      target.cells = clone(sheet.cells || {});
      target.name = sheet.name;
    }
    snapshot.workbook.title = patchSnapshot.workbook.title;
    return snapshot;
  }

  function mergeSnapshots(base, current, incoming) {
    const baseSheets = new Map(base.sheets.map((sheet) => [sheet.id, sheet]));
    const currentSheets = new Map(current.sheets.map((sheet) => [sheet.id, sheet]));
    const incomingSheets = new Map(incoming.sheets.map((sheet) => [sheet.id, sheet]));
    const merged = clone(current);
    const conflicts = [];

    for (const [sheetId, baseSheet] of baseSheets.entries()) {
      const currentSheet = currentSheets.get(sheetId);
      const incomingSheet = incomingSheets.get(sheetId);
      if (!currentSheet || !incomingSheet) {
        conflicts.push({ sheetId, address: '*', reason: 'Missing sheet in one snapshot' });
        continue;
      }
      if (currentSheet.name !== incomingSheet.name || baseSheet.name !== incomingSheet.name) {
        conflicts.push({ sheetId, address: '*', reason: 'Sheet name changed' });
        continue;
      }
      const currentChanges = diffCells(baseSheet, currentSheet);
      const incomingChanges = diffCells(baseSheet, incomingSheet);
      const allAddresses = new Set([...currentChanges.keys(), ...incomingChanges.keys()]);
      for (const address of allAddresses) {
        const currentChanged = currentChanges.has(address);
        const incomingChanged = incomingChanges.has(address);
        const currentValue = currentSheet.cells[address] || '';
        const incomingValue = incomingSheet.cells[address] || '';
        const baseValue = baseSheet.cells[address] || '';
        if (incomingChanged && currentChanged && currentValue !== incomingValue) {
          conflicts.push({ sheetId, address, base: baseValue, current: currentValue, incoming: incomingValue });
          continue;
        }
        if (incomingChanged && !currentChanged) {
          if (incomingValue) merged.sheets.find((sheet) => sheet.id === sheetId).cells[address] = incomingValue;
          else delete merged.sheets.find((sheet) => sheet.id === sheetId).cells[address];
        }
      }
    }

    return { merged, conflicts };
  }

  function changesBetweenSnapshots(base, next) {
    const result = new Map();
    const baseSheets = new Map(base.sheets.map((sheet) => [sheet.id, sheet]));
    const nextSheets = new Map(next.sheets.map((sheet) => [sheet.id, sheet]));
    for (const [sheetId, baseSheet] of baseSheets.entries()) {
      const nextSheet = nextSheets.get(sheetId);
      if (!nextSheet) continue;
      const diff = diffCells(baseSheet, nextSheet);
      result.set(sheetId, diff);
    }
    return result;
  }

  function cellHistory(revisions, sheetId, address) {
    const events = [];
    let previousValue = '';
    for (const revision of revisions) {
      const sheet = revision.snapshot.sheets.find((item) => item.id === sheetId);
      if (!sheet) continue;
      const value = sheet.cells[address] || '';
      if (value !== previousValue) {
        events.push({
          revisionId: revision.id,
          createdAt: revision.createdAt,
          kind: revision.kind,
          authorUserId: revision.authorUserId,
          authorName: revision.authorName,
          before: previousValue,
          after: value,
        });
        previousValue = value;
      }
    }
    return events;
  }

  function parseAddressOrRange(input) {
    const text = String(input || '').trim().toUpperCase();
    if (!text) return null;
    if (text.includes(':')) return parseRangeAddress(text);
    return addressToCoords(text);
  }

  function parseSingleAddress(input) {
    const coords = addressToCoords(input);
    return coords ? coordsToAddress(coords.row, coords.col) : null;
  }

  function rangeToRect(rangeText) {
    return parseRangeAddress(rangeText);
  }

  function seriesFromSelection(snapshot, sheetId, rect, direction) {
    const sheet = getSheet(snapshot, sheetId);
    if (!sheet) throw new Error(`Unknown sheet ${sheetId}`);
    const cells = [];
    for (let row = rect.startRow; row <= rect.endRow; row += 1) {
      for (let col = rect.startCol; col <= rect.endCol; col += 1) {
        const address = coordsToAddress(row, col);
        cells.push({ address, raw: sheet.cells[address] || '' });
      }
    }
    return cells;
  }

  function generateFillPatch(snapshot, sheetId, sourceRect, targetRect) {
    const sheet = getSheet(snapshot, sheetId);
    if (!sheet) throw new Error(`Unknown sheet ${sheetId}`);
    const patch = {};
    const sourceWidth = rectWidth(sourceRect);
    const sourceHeight = rectHeight(sourceRect);
    const sourceRows = sourceRect.endRow - sourceRect.startRow + 1;
    const sourceCols = sourceRect.endCol - sourceRect.startCol + 1;
    const sourceCells = [];
    for (let row = sourceRect.startRow; row <= sourceRect.endRow; row += 1) {
      for (let col = sourceRect.startCol; col <= sourceRect.endCol; col += 1) {
        const address = coordsToAddress(row, col);
        sourceCells.push({ row, col, address, raw: sheet.cells[address] || '' });
      }
    }
    const singleDirection = sourceRows === 1 || sourceCols === 1;
    const numericSequence = singleDirection && sourceCells.every((cell) => toNumber(cell.raw) != null);
    const sequenceValues = sourceCells.map((cell) => toNumber(cell.raw));
    const step = numericSequence && sequenceValues.length > 1 ? sequenceValues[sequenceValues.length - 1] - sequenceValues[0] : 0;

    for (let row = targetRect.startRow; row <= targetRect.endRow; row += 1) {
      for (let col = targetRect.startCol; col <= targetRect.endCol; col += 1) {
        const address = coordsToAddress(row, col);
        const srcRow = sourceRect.startRow + ((row - targetRect.startRow) % sourceHeight);
        const srcCol = sourceRect.startCol + ((col - targetRect.startCol) % sourceWidth);
        const sourceAddress = coordsToAddress(srcRow, srcCol);
        const raw = sheet.cells[sourceAddress] || '';
        if (String(raw).startsWith('=')) {
          const rowDelta = row - srcRow;
          const colDelta = col - srcCol;
          patch[address] = shiftFormula(raw, rowDelta, colDelta);
          continue;
        }
        if (numericSequence && sourceCells.length >= 1) {
          if (sourceCols === 1 && targetRect.endRow >= sourceRect.endRow) {
            const offset = row - sourceRect.startRow;
            patch[address] = String((sequenceValues[0] || 0) + step * offset);
            continue;
          }
          if (sourceRows === 1 && targetRect.endCol >= sourceRect.endCol) {
            const offset = col - sourceRect.startCol;
            patch[address] = String((sequenceValues[0] || 0) + step * offset);
            continue;
          }
        }
        patch[address] = raw;
      }
    }
    return patch;
  }

  function setSheetCells(snapshot, sheetId, nextCells) {
    const next = clone(snapshot);
    const sheet = getSheet(next, sheetId);
    if (!sheet) throw new Error(`Unknown sheet ${sheetId}`);
    sheet.cells = clone(nextCells);
    return next;
  }

  function emptyCellMapForSheet(sheet) {
    return clone(sheet.cells || {});
  }

  return {
    MAX_ROWS,
    MAX_COLS,
    FUNCTION_NAMES,
    clone,
    colToLabel,
    labelToCol,
    addressToCoords,
    coordsToAddress,
    isValidAddress,
    parseRangeAddress,
    rectFromAddresses,
    rectToAddresses,
    normalizeRect,
    rectContains,
    rectWidth,
    rectHeight,
    emptyWorkbook,
    normalizeCells,
    validateSnapshot,
    snapshotKey,
    getSheet,
    getActiveSheet,
    getCellRaw,
    setCellRaw,
    isNumericText,
    toNumber,
    tokenizeFormula,
    parseFormula,
    shiftFormula,
    createFormulaEvaluator,
    diffSnapshots,
    applyPatch,
    mergeSnapshots,
    changesBetweenSnapshots,
    cellHistory,
    parseAddressOrRange,
    parseSingleAddress,
    rangeToRect,
    seriesFromSelection,
    generateFillPatch,
    setSheetCells,
    emptyCellMapForSheet,
  };
});

/**
 * GridForge Clipboard & Fill Engine
 * Handles Copy, Cut, Paste (TSV/CSV) and Fill patterns (Numbers, Formulas)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./formula'));
  } else {
    root.ClipboardEngine = factory(root.FormulaEngine);
  }
})(typeof self !== 'undefined' ? self : this, function (FormulaEngine) {

  // Parse TSV / CSV text into 2D array
  function parseClipboardText(text) {
    if (!text) return [];
    // Normalize newlines
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop(); // Remove trailing empty line
    }

    return lines.map(line => {
      // Check if line contains tabs
      if (line.includes('\t')) {
        return line.split('\t');
      }
      // Simple CSV parsing (handles basic commas and quotes)
      const row = [];
      let inQuotes = false;
      let curr = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(curr.trim());
          curr = '';
        } else {
          curr += char;
        }
      }
      row.push(curr.trim());
      return row;
    });
  }

  // Format 2D array as TSV text
  function formatTSV(gridData) {
    return gridData.map(row => row.join('\t')).join('\n');
  }

  /**
   * Fill Pattern Generator
   * @param {Array<string>} sourceValues - Array of raw values from source selection
   * @param {number} targetCount - Number of cells to fill
   * @param {number} deltaRow - Row offset per step (e.g. 1 for down, -1 for up, 0 for right)
   * @param {number} deltaCol - Col offset per step (e.g. 1 for right, -1 for left, 0 for down)
   */
  function generateFillValues(sourceValues, targetCount, deltaRow, deltaCol) {
    if (sourceValues.length === 0 || targetCount <= 0) return [];

    // Check if source values are all formulas
    const allFormulas = sourceValues.every(v => typeof v === 'string' && v.startsWith('='));
    if (allFormulas) {
      const results = [];
      const srcLen = sourceValues.length;
      for (let i = 0; i < targetCount; i++) {
        const srcIdx = i % srcLen;
        const cycle = Math.floor(i / srcLen) + 1;
        const totalDeltaRow = deltaRow * (srcLen * (cycle - 1) + (srcIdx + 1));
        const totalDeltaCol = deltaCol * (srcLen * (cycle - 1) + (srcIdx + 1));
        const shifted = FormulaEngine.shiftFormula(sourceValues[srcIdx], totalDeltaRow, totalDeltaCol);
        results.push(shifted);
      }
      return results;
    }

    // Check if source values are numbers for arithmetic progression
    const numericValues = sourceValues.map(v => {
      const num = Number(v);
      return (!isNaN(num) && v !== '' && v !== null && v !== undefined) ? num : null;
    });

    const isAllNumeric = numericValues.every(n => n !== null);

    if (isAllNumeric && numericValues.length >= 2) {
      // Linear regression / step progression
      const step = (numericValues[numericValues.length - 1] - numericValues[0]) / (numericValues.length - 1);
      const results = [];
      let lastVal = numericValues[numericValues.length - 1];
      for (let i = 0; i < targetCount; i++) {
        lastVal += step;
        // Round to avoid floating point anomalies
        const rounded = Math.round(lastVal * 1e8) / 1e8;
        results.push(String(rounded));
      }
      return results;
    } else if (isAllNumeric && numericValues.length === 1) {
      // Single number: repeat value
      return Array(targetCount).fill(String(numericValues[0]));
    }

    // Mixed or text values: repeating pattern
    const results = [];
    for (let i = 0; i < targetCount; i++) {
      const val = sourceValues[i % sourceValues.length];
      if (typeof val === 'string' && val.startsWith('=')) {
        const cycle = Math.floor(i / sourceValues.length) + 1;
        const shifted = FormulaEngine.shiftFormula(val, deltaRow * cycle, deltaCol * cycle);
        results.push(shifted);
      } else {
        results.push(val !== undefined && val !== null ? String(val) : '');
      }
    }
    return results;
  }

  return {
    parseClipboardText,
    formatTSV,
    generateFillValues
  };
});

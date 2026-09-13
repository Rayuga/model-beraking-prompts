// Find and Replace engine for PatchPad

class FindReplaceEngine {
  constructor() {
    this.query = '';
    this.replaceText = '';
    this.caseSensitive = false;
    this.matches = [];
    this.currentIndex = -1;
  }

  setQuery(query, caseSensitive = false) {
    this.query = query;
    this.caseSensitive = caseSensitive;
  }

  setReplaceText(text) {
    this.replaceText = text;
  }

  /**
   * Search through document lines and find all matches
   * @param {DocumentModel} docModel 
   * @returns {Array<{ start: {line: number, col: number}, end: {line: number, col: number} }>}
   */
  updateMatches(docModel) {
    this.matches = [];
    this.currentIndex = -1;

    if (!this.query) {
      return this.matches;
    }

    const lines = docModel.lines;
    const query = this.caseSensitive ? this.query : this.query.toLowerCase();
    const queryLen = this.query.length;

    // Handle multiline query
    if (this.query.includes('\n')) {
      const fullText = docModel.getText();
      const targetText = this.caseSensitive ? fullText : fullText.toLowerCase();
      let pos = 0;
      while ((pos = targetText.indexOf(query, pos)) !== -1) {
        const startPos = this._charIndexToPos(lines, pos);
        const endPos = this._charIndexToPos(lines, pos + queryLen);
        this.matches.push({ start: startPos, end: endPos });
        pos += queryLen || 1;
      }
    } else {
      // Single line fast path
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        const lineText = this.caseSensitive ? line : line.toLowerCase();
        let col = 0;
        while ((col = lineText.indexOf(query, col)) !== -1) {
          this.matches.push({
            start: { line: lineIdx, col },
            end: { line: lineIdx, col: col + queryLen }
          });
          col += queryLen || 1;
        }
      }
    }

    return this.matches;
  }

  _charIndexToPos(lines, charIndex) {
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLen = lines[i].length + 1; // +1 for \n
      if (count + lineLen > charIndex) {
        return { line: i, col: charIndex - count };
      }
      count += lineLen;
    }
    const lastLine = lines.length - 1;
    return { line: lastLine, col: lines[lastLine].length };
  }

  /**
   * Find index of match closest to or at current cursor position
   * @param {{ line: number, col: number }} pos 
   * @param {DocumentModel} docModel 
   */
  findNearestMatchIndex(pos, docModel) {
    if (this.matches.length === 0) return -1;
    for (let i = 0; i < this.matches.length; i++) {
      const m = this.matches[i];
      if (docModel.comparePositions(m.start, pos) >= 0) {
        return i;
      }
    }
    return 0; // Wrap to first
  }

  nextMatch() {
    if (this.matches.length === 0) {
      this.currentIndex = -1;
      return null;
    }
    if (this.currentIndex === -1) {
      this.currentIndex = 0;
    } else {
      this.currentIndex = (this.currentIndex + 1) % this.matches.length;
    }
    return this.matches[this.currentIndex];
  }

  prevMatch() {
    if (this.matches.length === 0) {
      this.currentIndex = -1;
      return null;
    }
    if (this.currentIndex <= 0) {
      this.currentIndex = this.matches.length - 1;
    } else {
      this.currentIndex = this.currentIndex - 1;
    }
    return this.matches[this.currentIndex];
  }

  getCurrentMatch() {
    if (this.currentIndex >= 0 && this.currentIndex < this.matches.length) {
      return this.matches[this.currentIndex];
    }
    return null;
  }

  /**
   * Replace the currently selected match
   * @param {DocumentModel} docModel 
   * @param {string} [replacement] 
   */
  replaceCurrent(docModel, replacement = this.replaceText) {
    const current = this.getCurrentMatch();
    if (!current) return null;

    const beforeText = docModel.getText();
    const res = docModel.replaceRange(current.start, current.end, replacement);
    const afterText = docModel.getText();

    // Recompute matches after replacement
    this.updateMatches(docModel);

    // Keep current index or clamp
    if (this.currentIndex >= this.matches.length) {
      this.currentIndex = 0;
    }

    const nextMatch = this.getCurrentMatch();

    return {
      beforeText,
      afterText,
      replacedRange: { start: current.start, end: res.newEndPos },
      nextMatch,
      selection: {
        anchor: current.start,
        head: res.newEndPos
      }
    };
  }

  /**
   * Replace all occurrences in the document
   * @param {DocumentModel} docModel 
   * @param {string} [replacement] 
   */
  replaceAll(docModel, replacement = this.replaceText) {
    if (!this.query || this.matches.length === 0) {
      return { count: 0, beforeText: docModel.getText(), afterText: docModel.getText() };
    }

    const beforeText = docModel.getText();
    const count = this.matches.length;

    // Apply replacements backwards from last match to first match
    for (let i = this.matches.length - 1; i >= 0; i--) {
      const m = this.matches[i];
      docModel.replaceRange(m.start, m.end, replacement);
    }

    const afterText = docModel.getText();
    this.updateMatches(docModel);
    this.currentIndex = -1;

    return {
      count,
      beforeText,
      afterText
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FindReplaceEngine };
}

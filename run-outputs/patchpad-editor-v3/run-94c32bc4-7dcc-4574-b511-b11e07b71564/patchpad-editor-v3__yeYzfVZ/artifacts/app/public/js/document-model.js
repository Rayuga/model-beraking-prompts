// Document Model for PatchPad
// Handles lines, positions, selections, and text mutations

if (typeof require !== 'undefined') {
  var {
    getGraphemeSegments,
    prevGraphemeBoundary,
    nextGraphemeBoundary,
    isWordChar,
    isWhitespace,
    prevWordBoundary,
    nextWordBoundary
  } = require('./graphemes.js');
}

class DocumentModel {
  constructor(initialText = '') {
    this.lines = initialText.split('\n');
    this.tabSize = 2;
    this.indentUnit = '  '; // 2 spaces
  }

  getText() {
    return this.lines.join('\n');
  }

  setText(text) {
    this.lines = text.split('\n');
  }

  getLineCount() {
    return this.lines.length;
  }

  getLine(lineIdx) {
    if (lineIdx < 0 || lineIdx >= this.lines.length) return '';
    return this.lines[lineIdx];
  }

  getLineLength(lineIdx) {
    if (lineIdx < 0 || lineIdx >= this.lines.length) return 0;
    return this.lines[lineIdx].length;
  }

  clampPosition(pos) {
    let line = Math.max(0, Math.min(this.lines.length - 1, pos.line));
    let col = Math.max(0, Math.min(this.lines[line].length, pos.col));
    return { line, col };
  }

  comparePositions(a, b) {
    if (a.line !== b.line) return a.line - b.line;
    return a.col - b.col;
  }

  isPositionsEqual(a, b) {
    return a.line === b.line && a.col === b.col;
  }

  minPosition(a, b) {
    return this.comparePositions(a, b) <= 0 ? a : b;
  }

  maxPosition(a, b) {
    return this.comparePositions(a, b) >= 0 ? a : b;
  }

  normalizeSelection(sel) {
    const start = this.minPosition(sel.anchor, sel.head);
    const end = this.maxPosition(sel.anchor, sel.head);
    const isReversed = this.comparePositions(sel.anchor, sel.head) > 0;
    return {
      start: this.clampPosition(start),
      end: this.clampPosition(end),
      anchor: this.clampPosition(sel.anchor),
      head: this.clampPosition(sel.head),
      isCollapsed: this.isPositionsEqual(sel.anchor, sel.head),
      isReversed
    };
  }

  getTextInRange(start, end) {
    const s = this.clampPosition(start);
    const e = this.clampPosition(end);
    if (this.comparePositions(s, e) >= 0) return '';

    if (s.line === e.line) {
      return this.lines[s.line].substring(s.col, e.col);
    }

    const result = [];
    result.push(this.lines[s.line].substring(s.col));
    for (let i = s.line + 1; i < e.line; i++) {
      result.push(this.lines[i]);
    }
    result.push(this.lines[e.line].substring(0, e.col));
    return result.join('\n');
  }

  getSelectedText(sel) {
    const norm = this.normalizeSelection(sel);
    if (norm.isCollapsed) return '';
    return this.getTextInRange(norm.start, norm.end);
  }

  replaceRange(start, end, newText) {
    const s = this.clampPosition(start);
    const e = this.clampPosition(end);
    const deletedText = this.getTextInRange(s, e);

    const prefix = this.lines[s.line].substring(0, s.col);
    const suffix = this.lines[e.line].substring(e.col);

    const newLines = newText.split('\n');
    let newEndPos;

    if (newLines.length === 1) {
      const mergedLine = prefix + newLines[0] + suffix;
      const deleteCount = e.line - s.line + 1;
      this.lines.splice(s.line, deleteCount, mergedLine);
      newEndPos = { line: s.line, col: prefix.length + newLines[0].length };
    } else {
      const firstLine = prefix + newLines[0];
      const lastLine = newLines[newLines.length - 1] + suffix;
      const middleLines = newLines.slice(1, -1);
      const deleteCount = e.line - s.line + 1;
      this.lines.splice(s.line, deleteCount, firstLine, ...middleLines, lastLine);
      newEndPos = {
        line: s.line + newLines.length - 1,
        col: newLines[newLines.length - 1].length
      };
    }

    return {
      startPos: s,
      newEndPos,
      deletedText
    };
  }

  // Word & boundary helpers
  getPrevWordPos(pos) {
    const line = this.lines[pos.line] || '';
    if (pos.col === 0) {
      if (pos.line > 0) {
        return { line: pos.line - 1, col: this.lines[pos.line - 1].length };
      }
      return { line: 0, col: 0 };
    }
    const newCol = prevWordBoundary(line, pos.col);
    return { line: pos.line, col: newCol };
  }

  getNextWordPos(pos) {
    const line = this.lines[pos.line] || '';
    if (pos.col >= line.length) {
      if (pos.line < this.lines.length - 1) {
        return { line: pos.line + 1, col: 0 };
      }
      return { line: pos.line, col: line.length };
    }
    const newCol = nextWordBoundary(line, pos.col);
    return { line: pos.line, col: newCol };
  }

  getPrevGraphemePos(pos) {
    const line = this.lines[pos.line] || '';
    if (pos.col === 0) {
      if (pos.line > 0) {
        return { line: pos.line - 1, col: this.lines[pos.line - 1].length };
      }
      return { line: 0, col: 0 };
    }
    const newCol = prevGraphemeBoundary(line, pos.col);
    return { line: pos.line, col: newCol };
  }

  getNextGraphemePos(pos) {
    const line = this.lines[pos.line] || '';
    if (pos.col >= line.length) {
      if (pos.line < this.lines.length - 1) {
        return { line: pos.line + 1, col: 0 };
      }
      return { line: pos.line, col: line.length };
    }
    const newCol = nextGraphemeBoundary(line, pos.col);
    return { line: pos.line, col: newCol };
  }

  getWordAtPos(pos) {
    const line = this.lines[pos.line] || '';
    if (!line) return { start: pos, end: pos };
    let startCol = pos.col;
    let endCol = pos.col;

    if (startCol > 0 && isWordChar(line[startCol - 1])) {
      while (startCol > 0 && isWordChar(line[startCol - 1])) {
        startCol = prevGraphemeBoundary(line, startCol);
      }
    }
    while (endCol < line.length && isWordChar(line[endCol])) {
      endCol = nextGraphemeBoundary(line, endCol);
    }
    return {
      start: { line: pos.line, col: startCol },
      end: { line: pos.line, col: endCol }
    };
  }

  getLineSelection(lineIdx) {
    if (lineIdx < 0 || lineIdx >= this.lines.length) return null;
    if (lineIdx === this.lines.length - 1) {
      return {
        anchor: { line: lineIdx, col: 0 },
        head: { line: lineIdx, col: this.lines[lineIdx].length }
      };
    }
    return {
      anchor: { line: lineIdx, col: 0 },
      head: { line: lineIdx + 1, col: 0 }
    };
  }

  // Block Indent / Outdent
  indentBlock(selection) {
    const norm = this.normalizeSelection(selection);
    let startLine = norm.start.line;
    let endLine = norm.end.line;

    // A selection ending at the start of the next line does not include that next line
    if (norm.end.col === 0 && endLine > startLine) {
      endLine = endLine - 1;
    }

    const unit = this.indentUnit;
    for (let i = startLine; i <= endLine; i++) {
      this.lines[i] = unit + this.lines[i];
    }

    // Preserve selection block
    const newAnchor = {
      line: selection.anchor.line,
      col: selection.anchor.col + (selection.anchor.col === 0 && selection.anchor.line > endLine ? 0 : unit.length)
    };
    const newHead = {
      line: selection.head.line,
      col: selection.head.col + (selection.head.col === 0 && selection.head.line > endLine ? 0 : unit.length)
    };

    return {
      selection: {
        anchor: this.clampPosition(newAnchor),
        head: this.clampPosition(newHead)
      },
      startLine,
      endLine
    };
  }

  outdentBlock(selection) {
    const norm = this.normalizeSelection(selection);
    let startLine = norm.start.line;
    let endLine = norm.end.line;

    if (norm.end.col === 0 && endLine > startLine) {
      endLine = endLine - 1;
    }

    let anchorDelta = 0;
    let headDelta = 0;

    for (let i = startLine; i <= endLine; i++) {
      const line = this.lines[i];
      let removed = 0;
      if (line.startsWith('  ')) {
        this.lines[i] = line.substring(2);
        removed = 2;
      } else if (line.startsWith(' ') || line.startsWith('\t')) {
        this.lines[i] = line.substring(1);
        removed = 1;
      }

      if (i === selection.anchor.line) {
        anchorDelta = Math.min(selection.anchor.col, removed);
      }
      if (i === selection.head.line) {
        headDelta = Math.min(selection.head.col, removed);
      }
    }

    const newAnchor = {
      line: selection.anchor.line,
      col: Math.max(0, selection.anchor.col - anchorDelta)
    };
    const newHead = {
      line: selection.head.line,
      col: Math.max(0, selection.head.col - headDelta)
    };

    return {
      selection: {
        anchor: this.clampPosition(newAnchor),
        head: this.clampPosition(newHead)
      },
      startLine,
      endLine
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DocumentModel };
}

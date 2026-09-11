// Document Data Model
(function(window) {
  'use strict';

  const Grapheme = window.GraphemeUtils || {
    prevGraphemeCol: (text, col) => Math.max(0, col - 1),
    nextGraphemeCol: (text, col) => Math.min(text.length, col + 1),
    clampCol: (text, col) => Math.max(0, Math.min(text.length, col))
  };

  class DocumentModel {
    constructor(text = '') {
      this.lines = [];
      this.setText(text);
    }

    setText(text) {
      if (typeof text !== 'string') text = '';
      this.lines = text.split(/\r\n|\r|\n/);
      if (this.lines.length === 0) {
        this.lines = [''];
      }
    }

    getText() {
      return this.lines.join('\n');
    }

    get lineCount() {
      return this.lines.length;
    }

    get charCount() {
      let count = 0;
      for (let i = 0; i < this.lines.length; i++) {
        count += this.lines[i].length;
      }
      return count + Math.max(0, this.lines.length - 1);
    }

    getLine(row) {
      if (row < 0 || row >= this.lines.length) return '';
      return this.lines[row];
    }

    clampPosition(pos) {
      let row = Math.max(0, Math.min(this.lines.length - 1, pos.row));
      let line = this.lines[row] || '';
      let col = Grapheme.clampCol(line, pos.col);
      return { row, col };
    }

    comparePositions(a, b) {
      if (a.row < b.row) return -1;
      if (a.row > b.row) return 1;
      if (a.col < b.col) return -1;
      if (a.col > b.col) return 1;
      return 0;
    }

    getRangeText(start, end) {
      if (this.comparePositions(start, end) > 0) {
        const temp = start;
        start = end;
        end = temp;
      }

      start = this.clampPosition(start);
      end = this.clampPosition(end);

      if (start.row === end.row) {
        return this.lines[start.row].substring(start.col, end.col);
      }

      const result = [];
      result.push(this.lines[start.row].substring(start.col));
      for (let r = start.row + 1; r < end.row; r++) {
        result.push(this.lines[r]);
      }
      result.push(this.lines[end.row].substring(0, end.col));
      return result.join('\n');
    }

    insertAt(pos, text) {
      pos = this.clampPosition(pos);
      if (!text) return { newRow: pos.row, newCol: pos.col, insertedText: '' };

      const insertLines = text.split(/\r\n|\r|\n/);
      const currentLine = this.lines[pos.row] || '';
      const prefix = currentLine.substring(0, pos.col);
      const suffix = currentLine.substring(pos.col);

      if (insertLines.length === 1) {
        this.lines[pos.row] = prefix + insertLines[0] + suffix;
        return {
          newRow: pos.row,
          newCol: pos.col + insertLines[0].length,
          insertedText: text
        };
      }

      const newLines = [];
      newLines.push(prefix + insertLines[0]);
      for (let i = 1; i < insertLines.length - 1; i++) {
        newLines.push(insertLines[i]);
      }
      newLines.push(insertLines[insertLines.length - 1] + suffix);

      this.lines.splice(pos.row, 1, ...newLines);

      const endRow = pos.row + insertLines.length - 1;
      const endCol = insertLines[insertLines.length - 1].length;

      return {
        newRow: endRow,
        newCol: endCol,
        insertedText: text
      };
    }

    deleteRange(start, end) {
      if (this.comparePositions(start, end) > 0) {
        const temp = start;
        start = end;
        end = temp;
      }

      start = this.clampPosition(start);
      end = this.clampPosition(end);

      if (start.row === end.row && start.col === end.col) {
        return { deletedText: '', newPos: start };
      }

      const deletedText = this.getRangeText(start, end);

      if (start.row === end.row) {
        const line = this.lines[start.row];
        this.lines[start.row] = line.substring(0, start.col) + line.substring(end.col);
        return { deletedText, newPos: start };
      }

      const startLine = this.lines[start.row];
      const endLine = this.lines[end.row];
      const mergedLine = startLine.substring(0, start.col) + endLine.substring(end.col);

      const deleteCount = end.row - start.row + 1;
      this.lines.splice(start.row, deleteCount, mergedLine);

      return { deletedText, newPos: start };
    }

    indentLines(startRow, endRow, indentStr = '  ') {
      const minRow = Math.max(0, Math.min(startRow, endRow));
      const maxRow = Math.min(this.lines.length - 1, Math.max(startRow, endRow));

      for (let r = minRow; r <= maxRow; r++) {
        this.lines[r] = indentStr + this.lines[r];
      }
    }

    unindentLines(startRow, endRow, indentStr = '  ') {
      const minRow = Math.max(0, Math.min(startRow, endRow));
      const maxRow = Math.min(this.lines.length - 1, Math.max(startRow, endRow));
      const len = indentStr.length;
      const removedPerLine = [];

      for (let r = minRow; r <= maxRow; r++) {
        const line = this.lines[r];
        let removed = 0;
        if (line.startsWith(indentStr)) {
          this.lines[r] = line.substring(len);
          removed = len;
        } else if (line.startsWith('\t')) {
          this.lines[r] = line.substring(1);
          removed = 1;
        } else if (line.startsWith(' ')) {
          let spaces = 0;
          while (spaces < len && line[spaces] === ' ') {
            spaces++;
          }
          this.lines[r] = line.substring(spaces);
          removed = spaces;
        }
        removedPerLine.push(removed);
      }
      return removedPerLine;
    }

    findWordBoundaries(row, col) {
      row = Math.max(0, Math.min(this.lines.length - 1, row));
      const line = this.lines[row] || '';
      if (line.length === 0) return { startCol: 0, endCol: 0 };

      col = Math.max(0, Math.min(line.length, col));

      // Classify character type
      const isWordChar = (c) => /[\p{L}\p{N}_]/u.test(c);
      const isWhitespace = (c) => /\s/.test(c);

      // If at end of line, check character before
      let checkCol = col >= line.length ? line.length - 1 : col;
      let targetChar = line[checkCol];
      let type = isWordChar(targetChar) ? 'word' : isWhitespace(targetChar) ? 'space' : 'punct';

      let startCol = checkCol;
      while (startCol > 0) {
        let prevChar = line[startCol - 1];
        let prevType = isWordChar(prevChar) ? 'word' : isWhitespace(prevChar) ? 'space' : 'punct';
        if (prevType !== type) break;
        startCol--;
      }

      let endCol = checkCol + 1;
      while (endCol < line.length) {
        let nextChar = line[endCol];
        let nextType = isWordChar(nextChar) ? 'word' : isWhitespace(nextChar) ? 'space' : 'punct';
        if (nextType !== type) break;
        endCol++;
      }

      return { startCol, endCol };
    }

    findPrevWord(row, col) {
      if (col === 0) {
        if (row === 0) return { row: 0, col: 0 };
        return { row: row - 1, col: this.lines[row - 1].length };
      }

      const line = this.lines[row] || '';
      let c = col;

      // Skip whitespace to the left
      while (c > 0 && /\s/.test(line[c - 1])) {
        c--;
      }

      if (c === 0) return { row, col: 0 };

      const isWordChar = (char) => /[\p{L}\p{N}_]/u.test(char);
      const targetIsWord = isWordChar(line[c - 1]);

      while (c > 0) {
        const char = line[c - 1];
        if (/\s/.test(char)) break;
        if (isWordChar(char) !== targetIsWord) break;
        c--;
      }

      return { row, col: c };
    }

    findNextWord(row, col) {
      const line = this.lines[row] || '';
      if (col >= line.length) {
        if (row >= this.lines.length - 1) return { row: this.lines.length - 1, col: line.length };
        return { row: row + 1, col: 0 };
      }

      let c = col;
      const isWordChar = (char) => /[\p{L}\p{N}_]/u.test(char);

      // If on whitespace, skip whitespace first
      if (/\s/.test(line[c])) {
        while (c < line.length && /\s/.test(line[c])) {
          c++;
        }
        return { row, col: c };
      }

      // If on word or punct, move past current token
      const targetIsWord = isWordChar(line[c]);
      while (c < line.length) {
        const char = line[c];
        if (/\s/.test(char)) break;
        if (isWordChar(char) !== targetIsWord) break;
        c++;
      }

      // Skip following whitespace to get to start of next word (or end of line)
      while (c < line.length && /\s/.test(line[c])) {
        c++;
      }

      return { row, col: c };
    }
  }

  if (typeof window !== 'undefined') window.DocumentModel = DocumentModel;
  if (typeof global !== 'undefined') global.DocumentModel = DocumentModel;
  if (typeof module !== 'undefined' && module.exports) module.exports = DocumentModel;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

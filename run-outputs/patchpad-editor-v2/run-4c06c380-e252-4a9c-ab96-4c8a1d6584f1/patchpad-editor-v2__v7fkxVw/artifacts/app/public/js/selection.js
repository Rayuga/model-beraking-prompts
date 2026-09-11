// Caret and Selection Management
(function(window) {
  'use strict';

  class Selection {
    constructor(anchor = { row: 0, col: 0 }, head = { row: 0, col: 0 }) {
      this.anchor = { row: anchor.row, col: anchor.col };
      this.head = { row: head.row, col: head.col };
    }

    isEmpty() {
      return this.anchor.row === this.head.row && this.anchor.col === this.head.col;
    }

    getRange() {
      if (this.anchor.row < this.head.row) {
        return { start: { ...this.anchor }, end: { ...this.head }, isReversed: false };
      }
      if (this.anchor.row > this.head.row) {
        return { start: { ...this.head }, end: { ...this.anchor }, isReversed: true };
      }
      if (this.anchor.col <= this.head.col) {
        return { start: { ...this.anchor }, end: { ...this.head }, isReversed: false };
      }
      return { start: { ...this.head }, end: { ...this.anchor }, isReversed: true };
    }

    clone() {
      return new Selection(this.anchor, this.head);
    }
  }

  class SelectionManager {
    constructor() {
      this.selections = [new Selection()];
    }

    get primary() {
      return this.selections[0] || new Selection();
    }

    setPrimary(sel) {
      this.selections = [sel];
    }

    setSingleCaret(row, col) {
      this.selections = [new Selection({ row, col }, { row, col })];
    }

    addCaret(row, col) {
      // Check if caret already exists at exact pos
      const existsIndex = this.selections.findIndex(s =>
        s.isEmpty() && s.head.row === row && s.head.col === col
      );
      if (existsIndex >= 0 && this.selections.length > 1) {
        // Toggle/remove if already exists
        this.selections.splice(existsIndex, 1);
        return;
      }
      this.selections.push(new Selection({ row, col }, { row, col }));
      this.normalize();
    }

    normalize() {
      if (this.selections.length === 0) {
        this.selections = [new Selection()];
        return;
      }

      // Sort selections in document order by their start pos
      this.selections.sort((a, b) => {
        const rangeA = a.getRange();
        const rangeB = b.getRange();
        if (rangeA.start.row !== rangeB.start.row) {
          return rangeA.start.row - rangeB.start.row;
        }
        return rangeA.start.col - rangeB.start.col;
      });

      // Merge overlapping/duplicate selections
      const merged = [this.selections[0]];
      for (let i = 1; i < this.selections.length; i++) {
        const current = this.selections[i];
        const last = merged[merged.length - 1];

        const rCurrent = current.getRange();
        const rLast = last.getRange();

        // Check if overlapping or duplicate
        const overlaps = (
          (rCurrent.start.row < rLast.end.row) ||
          (rCurrent.start.row === rLast.end.row && rCurrent.start.col <= rLast.end.col)
        );

        if (overlaps) {
          // If both are empty carets at the same position
          if (current.isEmpty() && last.isEmpty()) {
            if (current.head.row === last.head.row && current.head.col === last.head.col) {
              continue; // duplicate caret
            }
          }
          // Merge ranges
          const newStart = rLast.start;
          let newEnd = rLast.end;
          if (rCurrent.end.row > newEnd.row || (rCurrent.end.row === newEnd.row && rCurrent.end.col > newEnd.col)) {
            newEnd = rCurrent.end;
          }
          merged[merged.length - 1] = new Selection(newStart, newEnd);
        } else {
          merged.push(current);
        }
      }

      this.selections = merged;
    }

    selectAll(doc) {
      const lastRow = Math.max(0, doc.lineCount - 1);
      const lastCol = doc.getLine(lastRow).length;
      this.selections = [new Selection({ row: 0, col: 0 }, { row: lastRow, col: lastCol })];
    }

    selectLine(doc, row) {
      row = Math.max(0, Math.min(doc.lineCount - 1, row));
      const lineLen = doc.getLine(row).length;
      if (row < doc.lineCount - 1) {
        // Include newline
        this.selections = [new Selection({ row, col: 0 }, { row: row + 1, col: 0 })];
      } else {
        this.selections = [new Selection({ row, col: 0 }, { row, col: lineLen })];
      }
    }

    selectWord(doc, row, col) {
      const bounds = doc.findWordBoundaries(row, col);
      this.selections = [new Selection({ row, col: bounds.startCol }, { row, col: bounds.endCol })];
    }
  }

  if (typeof window !== 'undefined') {
    window.Selection = Selection;
    window.SelectionManager = SelectionManager;
  }
  if (typeof global !== 'undefined') {
    global.Selection = Selection;
    global.SelectionManager = SelectionManager;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Selection, SelectionManager };
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

// Undo and Redo History Manager
(function(window) {
  'use strict';

  class HistoryManager {
    constructor(options = {}) {
      this.maxStack = options.maxStack || 200;
      this.batchTimeout = options.batchTimeout || 1000;
      this.undoStack = [];
      this.redoStack = [];
    }

    canUndo() {
      return this.undoStack.length > 0;
    }

    canRedo() {
      return this.redoStack.length > 0;
    }

    recordChange({ beforeText, afterText, beforeSelections, afterSelections, actionType = 'generic', caretPos = null }) {
      if (beforeText === afterText) {
        return;
      }

      const now = Date.now();
      const lastAction = this.undoStack[this.undoStack.length - 1];

      // Clone selections to avoid reference mutations
      const clonedBeforeSel = beforeSelections.map(s => s.clone());
      const clonedAfterSel = afterSelections.map(s => s.clone());

      // Check if we can coalesce typing
      if (
        actionType === 'type_char' &&
        lastAction &&
        lastAction.actionType === 'type_char' &&
        now - lastAction.timestamp < this.batchTimeout &&
        caretPos &&
        lastAction.lastCaretRow === caretPos.row &&
        (lastAction.lastCaretCol === caretPos.col - 1 || lastAction.lastCaretCol === caretPos.col)
      ) {
        // Coalesce with last action
        lastAction.afterText = afterText;
        lastAction.afterSelections = clonedAfterSel;
        lastAction.lastCaretRow = caretPos.row;
        lastAction.lastCaretCol = caretPos.col;
        lastAction.timestamp = now;
      } else {
        // Create new action
        const action = {
          actionType,
          timestamp: now,
          beforeText,
          afterText,
          beforeSelections: clonedBeforeSel,
          afterSelections: clonedAfterSel,
          lastCaretRow: caretPos ? caretPos.row : null,
          lastCaretCol: caretPos ? caretPos.col : null
        };

        this.undoStack.push(action);
        if (this.undoStack.length > this.maxStack) {
          this.undoStack.shift();
        }
      }

      // Any new edit clears redo
      this.redoStack = [];
    }

    undo(currentText) {
      if (!this.canUndo()) return null;

      const action = this.undoStack.pop();
      this.redoStack.push(action);

      return {
        text: action.beforeText,
        selections: action.beforeSelections.map(s => s.clone())
      };
    }

    redo(currentText) {
      if (!this.canRedo()) return null;

      const action = this.redoStack.pop();
      this.undoStack.push(action);

      return {
        text: action.afterText,
        selections: action.afterSelections.map(s => s.clone())
      };
    }

    clear() {
      this.undoStack = [];
      this.redoStack = [];
    }
  }

  if (typeof window !== 'undefined') window.HistoryManager = HistoryManager;
  if (typeof global !== 'undefined') global.HistoryManager = HistoryManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = HistoryManager;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

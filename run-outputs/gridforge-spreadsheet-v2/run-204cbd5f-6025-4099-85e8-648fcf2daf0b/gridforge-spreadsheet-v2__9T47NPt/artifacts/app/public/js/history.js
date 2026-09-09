/**
 * GridForge History & Revision Management
 * Full Undo/Redo stack, Revision Browser, Preview & Restore, Cell History Inspector
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HistoryManager = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  class UndoRedoStack {
    constructor(options = {}) {
      this.maxSize = options.maxSize || 100;
      this.undoStack = [];
      this.redoStack = [];
      this.onStateChange = options.onStateChange || (() => {});
    }

    push(action) {
      this.undoStack.push(action);
      if (this.undoStack.length > this.maxSize) {
        this.undoStack.shift();
      }
      this.redoStack = []; // Clear redo stack on new action
      this.onStateChange(this.canUndo(), this.canRedo());
    }

    canUndo() {
      return this.undoStack.length > 0;
    }

    canRedo() {
      return this.redoStack.length > 0;
    }

    undo() {
      if (!this.canUndo()) return null;
      const action = this.undoStack.pop();
      this.redoStack.push(action);
      this.onStateChange(this.canUndo(), this.canRedo());
      return action;
    }

    redo() {
      if (!this.canRedo()) return null;
      const action = this.redoStack.pop();
      this.undoStack.push(action);
      this.onStateChange(this.canUndo(), this.canRedo());
      return action;
    }

    clear() {
      this.undoStack = [];
      this.redoStack = [];
      this.onStateChange(false, false);
    }
  }

  function formatRelativeTime(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffSecs = Math.floor((now - date) / 1000);
      if (diffSecs < 5) return 'just now';
      if (diffSecs < 60) return `${diffSecs}s ago`;
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoString;
    }
  }

  return {
    UndoRedoStack,
    formatRelativeTime
  };
});

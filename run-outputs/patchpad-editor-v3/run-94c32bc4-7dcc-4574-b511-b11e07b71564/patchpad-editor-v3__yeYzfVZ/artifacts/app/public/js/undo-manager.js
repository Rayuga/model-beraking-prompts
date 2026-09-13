// Undo / Redo Manager for PatchPad

class UndoManager {
  constructor(maxSize = 200) {
    this.maxSize = maxSize;
    this.undoStack = [];
    this.redoStack = [];
    this.onChangeCallback = null;
  }

  setOnChange(callback) {
    this.onChangeCallback = callback;
  }

  notifyChange() {
    if (this.onChangeCallback) {
      this.onChangeCallback({
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      });
    }
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyChange();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Record a new action
   * @param {Object} action
   * @param {string} action.beforeText
   * @param {string} action.afterText
   * @param {Array} action.beforeSelections
   * @param {Array} action.afterSelections
   * @param {string} action.type - 'typing' | 'backspace' | 'delete' | 'paste' | 'indent' | 'outdent' | 'replace' | 'replace_all' | 'restore_revision'
   * @param {boolean} [action.forceNewGroup=false]
   */
  recordAction({
    beforeText,
    afterText,
    beforeSelections,
    afterSelections,
    type = 'edit',
    forceNewGroup = false
  }) {
    if (beforeText === afterText) {
      return; // No change
    }

    // A new edit clears Redo stack
    this.redoStack = [];

    const now = Date.now();
    const lastAction = this.undoStack[this.undoStack.length - 1];

    // Check for typing coalescing
    const canCoalesceTyping = !forceNewGroup &&
      type === 'typing' &&
      lastAction &&
      lastAction.type === 'typing' &&
      now - lastAction.timestamp < 2000 &&
      beforeSelections &&
      beforeSelections.length === 1 &&
      lastAction.afterSelections &&
      lastAction.afterSelections.length === 1 &&
      beforeSelections[0].head.line === lastAction.afterSelections[0].head.line &&
      beforeSelections[0].head.col === lastAction.afterSelections[0].head.col;

    if (canCoalesceTyping) {
      lastAction.afterText = afterText;
      lastAction.afterSelections = JSON.parse(JSON.stringify(afterSelections));
      lastAction.timestamp = now;
    } else {
      this.undoStack.push({
        beforeText,
        afterText,
        beforeSelections: JSON.parse(JSON.stringify(beforeSelections)),
        afterSelections: JSON.parse(JSON.stringify(afterSelections)),
        type,
        timestamp: now
      });

      if (this.undoStack.length > this.maxSize) {
        this.undoStack.shift();
      }
    }

    this.notifyChange();
  }

  undo() {
    if (!this.canUndo()) return null;
    const action = this.undoStack.pop();
    this.redoStack.push(action);
    this.notifyChange();
    return {
      text: action.beforeText,
      selections: JSON.parse(JSON.stringify(action.beforeSelections)),
      type: action.type
    };
  }

  redo() {
    if (!this.canRedo()) return null;
    const action = this.redoStack.pop();
    this.undoStack.push(action);
    this.notifyChange();
    return {
      text: action.afterText,
      selections: JSON.parse(JSON.stringify(action.afterSelections)),
      type: action.type
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UndoManager };
}

const assert = require('assert');
const { JSDOM } = require('jsdom');

// Setup JSDOM environment
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="editor-container"></div></body></html>`, {
  url: 'http://localhost:3000'
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;

// Mock measureText for Canvas in JSDOM
dom.window.HTMLCanvasElement.prototype.getContext = function() {
  return {
    measureText: function(str) {
      return { width: (str ? str.length : 0) * 8.4 };
    },
    font: ''
  };
};

// Load modules
require('../public/js/grapheme.js');
require('../public/js/document-model.js');
require('../public/js/selection.js');
require('../public/js/history.js');
require('../public/js/find-controller.js');
require('../public/js/editor-view.js');

const Grapheme = window.GraphemeUtils;
const DocumentModel = window.DocumentModel;
const Selection = window.Selection;
const SelectionManager = window.SelectionManager;
const HistoryManager = window.HistoryManager;
const FindController = window.FindController;
const EditorView = window.EditorView;

console.log('Running PatchPad unit tests...');

// 1. Grapheme tests
{
  const text = 'Hello 🚀👩‍👩‍👧‍👦 World!';
  const graphemes = Grapheme.getGraphemes(text);
  assert(graphemes.length > 0, 'Graphemes extracted');
  assert(graphemes.includes('🚀'), 'Emoji recognized');
  console.log('✔ Grapheme segmentation tests passed');
}

// 2. DocumentModel tests
{
  const doc = new DocumentModel('Line 1\nLine 2\nLine 3');
  assert.strictEqual(doc.lineCount, 3);
  assert.strictEqual(doc.getLine(0), 'Line 1');

  // Insert test
  doc.insertAt({ row: 0, col: 4 }, ' inserted');
  assert.strictEqual(doc.getLine(0), 'Line inserted 1');

  // Multiline insert
  doc.insertAt({ row: 1, col: 4 }, ' A\nLine 2.5');
  assert.strictEqual(doc.lineCount, 4);

  // Delete range
  doc.deleteRange({ row: 0, col: 0 }, { row: 0, col: 5 });
  assert.strictEqual(doc.getLine(0), 'inserted 1');

  // Word boundaries
  const doc2 = new DocumentModel('The quick brown_fox jumps!');
  const w1 = doc2.findWordBoundaries(0, 5);
  assert.strictEqual(doc2.getRangeText({ row: 0, col: w1.startCol }, { row: 0, col: w1.endCol }), 'quick');

  const nextW = doc2.findNextWord(0, 0);
  assert.strictEqual(nextW.col, 4); // start of 'quick'

  const prevW = doc2.findPrevWord(0, 10);
  assert.strictEqual(prevW.col, 4); // start of 'quick'

  console.log('✔ DocumentModel tests passed');
}

// 3. SelectionManager tests
{
  const sm = new SelectionManager();
  sm.setSingleCaret(0, 0);
  assert.strictEqual(sm.selections.length, 1);

  // Add multi carets
  sm.addCaret(1, 5);
  sm.addCaret(2, 10);
  assert.strictEqual(sm.selections.length, 3);

  // Duplicate caret should not duplicate
  sm.normalize();
  assert.strictEqual(sm.selections.length, 3);

  console.log('✔ SelectionManager tests passed');
}

// 4. HistoryManager tests
{
  const hm = new HistoryManager();
  const sel = [new Selection({ row: 0, col: 0 }, { row: 0, col: 0 })];

  hm.recordChange({
    beforeText: 'abc',
    afterText: 'abcd',
    beforeSelections: sel,
    afterSelections: sel,
    actionType: 'type_char',
    caretPos: { row: 0, col: 3 }
  });

  // Coalesce typing
  hm.recordChange({
    beforeText: 'abcd',
    afterText: 'abcde',
    beforeSelections: sel,
    afterSelections: sel,
    actionType: 'type_char',
    caretPos: { row: 0, col: 4 }
  });

  assert.strictEqual(hm.undoStack.length, 1, 'Typing coalesced into single action');

  const undone = hm.undo('abcde');
  assert.strictEqual(undone.text, 'abc', 'Undo returned initial text');

  const redone = hm.redo('abc');
  assert.strictEqual(redone.text, 'abcde', 'Redo returned final text');

  console.log('✔ HistoryManager tests passed');
}

// 5. FindController tests
{
  const doc = new DocumentModel('alpha beta alpha gamma ALPHA');
  const fc = new FindController();
  fc.setQuery('alpha');
  const res = fc.findMatches(doc);
  assert.strictEqual(res.count, 3, 'Found 3 case-insensitive matches');

  const next = fc.nextMatch();
  assert(next !== null);

  console.log('✔ FindController tests passed');
}

// 6. EditorView end-to-end tests
{
  const container = document.getElementById('editor-container');
  const editor = new EditorView(container);

  editor.setText('Hello world');
  assert.strictEqual(editor.getText(), 'Hello world');

  // Type single char
  editor.insertText('!', true);
  assert.strictEqual(editor.getText(), '!Hello world');

  // Test undo
  editor.undo();
  assert.strictEqual(editor.getText(), 'Hello world');

  // Test redo
  editor.redo();
  assert.strictEqual(editor.getText(), '!Hello world');

  // Test Restore revision as undoable unsaved action
  editor.restoreRevisionContent('Restored Revision Content');
  assert.strictEqual(editor.getText(), 'Restored Revision Content');
  assert.strictEqual(editor.isDirty, true);

  // Undo the restore
  editor.undo();
  assert.strictEqual(editor.getText(), '!Hello world');

  console.log('✔ EditorView tests passed');
}

console.log('\nAll unit tests passed successfully!');

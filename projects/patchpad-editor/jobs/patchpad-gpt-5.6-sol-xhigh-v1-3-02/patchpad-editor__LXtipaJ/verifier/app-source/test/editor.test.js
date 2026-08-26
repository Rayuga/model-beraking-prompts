'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EditorModel } = require('../public/editor.js');

test('contiguous typing is one undoable run and new edits clear redo', () => {
  const model = new EditorModel('');
  model.insert('a'); model.insert('b'); model.insert('c');
  assert.equal(model.text, 'abc'); assert.equal(model.undoStack.length, 1);
  assert.ok(model.undo()); assert.equal(model.text, '');
  assert.ok(model.redo()); assert.equal(model.text, 'abc');
  model.undo(); model.insert('x'); assert.equal(model.redoStack.length, 0);
});

test('cursor movement separates typing runs even when it returns to the same offset', () => {
  const model = new EditorModel('');
  model.insert('a'); model.move('left'); model.move('right'); model.insert('b');
  assert.equal(model.undoStack.length, 2); model.undo(); assert.equal(model.text, 'a');
});

test('a contiguous multi-caret typing run undoes together', () => {
  const model = new EditorModel('a\nb');
  model.carets = [{ anchor: 1, head: 1 }, { anchor: 3, head: 3 }];
  model.insert('x'); model.insert('y'); assert.equal(model.text, 'axy\nbxy');
  assert.equal(model.undoStack.length, 1); model.undo(); assert.equal(model.text, 'a\nb');
});

test('typing over a selection is one independent edit', () => {
  const model = new EditorModel('hello world');
  model.carets = [{ anchor: 6, head: 11 }]; model.insert('PatchPad'); model.insert('!');
  assert.equal(model.text, 'hello PatchPad!'); assert.equal(model.undoStack.length, 2);
  model.undo(); assert.equal(model.text, 'hello PatchPad'); model.undo(); assert.equal(model.text, 'hello world');
});

test('multi-caret typing and deletion apply atomically', () => {
  const model = new EditorModel('abc\ndef');
  model.carets = [{ anchor: 1, head: 1 }, { anchor: 5, head: 5 }]; model.insert('X');
  assert.equal(model.text, 'aXbc\ndXef'); assert.equal(model.undoStack.length, 1);
  model.undo(); assert.equal(model.text, 'abc\ndef');
  model.carets = [{ anchor: 1, head: 1 }, { anchor: 5, head: 5 }]; model.delete(-1);
  assert.equal(model.text, 'bc\nef'); model.undo(); assert.equal(model.text, 'abc\ndef');
});

test('vertical movement preserves desired column through short lines', () => {
  const model = new EditorModel('123456\nx\nabcdef');
  model.carets = [{ anchor: 5, head: 5, goal: null }]; model.move('down');
  assert.deepEqual(model.lineColumn(model.carets[0].head), { line: 1, column: 1 });
  model.move('down'); assert.deepEqual(model.lineColumn(model.carets[0].head), { line: 2, column: 5 });
});

test('replace all and restore draft each undo in one step', () => {
  const model = new EditorModel('one two one');
  assert.equal(model.replaceAll('one', '1'), 2); assert.equal(model.text, '1 two 1'); model.undo(); assert.equal(model.text, 'one two one');
  model.insert(' draft', 'paste'); const draft = model.text; model.loadDraft('old revision'); model.undo(); assert.equal(model.text, draft);
});

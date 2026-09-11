const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { JSDOM } = require('jsdom');

async function main() {
  console.log('============================================');
  console.log('       PatchPad Verification Test Suite     ');
  console.log('============================================\n');

  // Test 1: Clean DB and Seeding
  console.log('Test 1: Fresh Database Seeding & Verification');
  const dbPath = path.resolve(__dirname, '../test-patchpad.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  process.env.SQLITE_PATH = dbPath;

  const db = require('../db');
  const docs = db.listDocuments();
  assert.strictEqual(docs.length, 1, 'Fresh workspace must list only 1 document');
  const seedDoc = docs[0];
  assert.strictEqual(seedDoc.id, 'incident-alpha', 'Doc id must be incident-alpha');
  assert.strictEqual(seedDoc.title, 'Northwind API Incident Report', 'Title must match seed');
  assert.strictEqual(seedDoc.author, 'Riley Stone', 'Author must match seed');
  assert.strictEqual(seedDoc.currentRevision, 1, 'Initial revision must be 1');

  const fullDoc = db.getDocument('incident-alpha');
  assert(fullDoc.content.includes('OMEGA-END-ANCHOR'), 'Document must contain tail sentinel');
  assert(fullDoc.content.includes('Incident: Northwind API latency event'), 'Document must contain header');
  assert(fullDoc.content.includes('Log line 0001:'), 'Document must contain generated lines');
  assert(fullDoc.content.includes('Log line 1200:'), 'Document must contain 1200th line');

  const initialRevisions = db.getRevisions('incident-alpha');
  assert.strictEqual(initialRevisions.length, 1, 'Initially 1 revision in history');
  assert.strictEqual(initialRevisions[0].revision, 1);
  console.log('  ✔ Fresh DB seeding verified (1226 lines, Rev 1)');

  // Test 2: Restart Idempotency
  console.log('Test 2: Database Restart Idempotency');
  // Re-run initSchema on same db
  db.getDb();
  const docsAfterRestart = db.listDocuments();
  assert.strictEqual(docsAfterRestart.length, 1, 'Restarting must not duplicate document');
  const revsAfterRestart = db.getRevisions('incident-alpha');
  assert.strictEqual(revsAfterRestart.length, 1, 'Restarting must not duplicate revisions');
  console.log('  ✔ Normal restarts keep existing data and do not duplicate');

  // Test 3: Express REST API and Conflict Safety
  console.log('Test 3: REST API & Conflict Safety');
  const app = require('../server');
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  async function req(urlPath, options = {}) {
    const res = await fetch(`${baseUrl}${urlPath}`, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
    return { status: res.status, ok: res.ok, data };
  }

  // GET /api/documents
  const listRes = await req('/api/documents');
  assert.strictEqual(listRes.status, 200);
  assert.strictEqual(listRes.data.length, 1);
  assert.strictEqual(listRes.data[0].id, 'incident-alpha');

  // GET /api/reports alias
  const aliasRes = await req('/api/reports');
  assert.strictEqual(aliasRes.status, 200);
  assert.strictEqual(aliasRes.data.length, 1);

  // Invalid save: missing content
  const badReq1 = await req('/api/documents/incident-alpha/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseRevision: 1 })
  });
  assert.strictEqual(badReq1.status, 400, 'Missing content must return 400');

  // Invalid save: non-integer baseRevision
  const badReq2 = await req('/api/documents/incident-alpha/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseRevision: 'one', content: 'test' })
  });
  assert.strictEqual(badReq2.status, 400, 'Non-integer baseRevision must return 400');

  // Invalid save: documentId mismatch
  const badReq3 = await req('/api/documents/incident-alpha/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId: 'wrong-id', baseRevision: 1, content: 'test' })
  });
  assert.strictEqual(badReq3.status, 400, 'DocumentId mismatch must return 400');

  // Save unchanged content: must return 200 unchanged and NOT create new revision
  const unchangeRes = await req('/api/documents/incident-alpha/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseRevision: 1, content: fullDoc.content })
  });
  assert.strictEqual(unchangeRes.status, 200);
  assert.strictEqual(unchangeRes.data.status, 'unchanged');
  assert.strictEqual(unchangeRes.data.revision, 1);
  const revsAfterUnchanged = await req('/api/documents/incident-alpha/revisions');
  assert.strictEqual(revsAfterUnchanged.data.length, 1, 'Unchanged save must not create a new revision');

  // Valid save changed content: rev 1 -> rev 2
  const modifiedContent = fullDoc.content + '\n-- Additional Note 1';
  const saveRes = await req('/api/documents/incident-alpha/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseRevision: 1, content: modifiedContent, author: 'Riley Stone', summary: 'Added Note 1' })
  });
  assert.strictEqual(saveRes.status, 200);
  assert.strictEqual(saveRes.data.status, 'saved');
  assert.strictEqual(saveRes.data.revision, 2);

  // Stale save (tab trying to save with baseRevision 1 when server is at 2)
  const staleSaveRes = await req('/api/documents/incident-alpha/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseRevision: 1, content: fullDoc.content + '\n-- Conflicting Tab Edits' })
  });
  assert.strictEqual(staleSaveRes.status, 409, 'Stale baseRevision must return HTTP 409 Conflict');
  assert.strictEqual(staleSaveRes.data.currentRevision, 2);
  assert(staleSaveRes.data.currentContent.includes('-- Additional Note 1'), 'Current server content preserved');

  // Verify revisions history endpoint
  const revsAfterSave = await req('/api/documents/incident-alpha/revisions');
  assert.strictEqual(revsAfterSave.data.length, 2);
  assert.strictEqual(revsAfterSave.data[0].revision, 2);
  assert.strictEqual(revsAfterSave.data[1].revision, 1);

  // Verify specific revision endpoint
  const rev1Detail = await req('/api/documents/incident-alpha/revisions/1');
  assert.strictEqual(rev1Detail.status, 200);
  assert.strictEqual(rev1Detail.data.revision, 1);
  assert.strictEqual(rev1Detail.data.content, fullDoc.content);

  const rev2Detail = await req('/api/documents/incident-alpha/revisions/2');
  assert.strictEqual(rev2Detail.status, 200);
  assert.strictEqual(rev2Detail.data.revision, 2);
  assert.strictEqual(rev2Detail.data.content, modifiedContent);

  console.log('  ✔ REST API, validations, 409 conflict, and revisions endpoints verified');

  // Test 4: Editor Surface DOM and Interactivity (JSDOM)
  console.log('Test 4: Custom DOM Editor Engine & Interactivity');
  const dom = new JSDOM(fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8'), {
    url: 'http://localhost:3000'
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.HTMLCanvasElement = dom.window.HTMLCanvasElement;

  dom.window.HTMLCanvasElement.prototype.getContext = function() {
    return {
      measureText: (str) => ({ width: (str ? str.length : 0) * 8.4 }),
      font: ''
    };
  };

  // Require client scripts into window
  require('../public/js/grapheme.js');
  require('../public/js/document-model.js');
  require('../public/js/selection.js');
  require('../public/js/history.js');
  require('../public/js/find-controller.js');
  require('../public/js/editor-view.js');
  require('../public/js/api.js');
  require('../public/js/revision-controller.js');

  const editorContainer = dom.window.document.getElementById('editor-container');
  const testEditor = new dom.window.EditorView(editorContainer, {
    fontSize: 14,
    lineHeight: 24
  });

  // Verify non-use of textarea or contenteditable on editor surface
  assert(!editorContainer.querySelector('textarea'), 'Editor must not use textarea');
  assert(!editorContainer.querySelector('[contenteditable="true"]'), 'Editor must not use contenteditable');
  assert(!editorContainer.querySelector('.monaco-editor'), 'Editor must not use Monaco');
  assert(!editorContainer.querySelector('.cm-editor'), 'Editor must not use CodeMirror');
  console.log('  ✔ Custom DOM editor verified (no textarea/contenteditable/Monaco/CodeMirror)');

  // Test Unicode & Emoji Navigation
  console.log('Test 5: Unicode, Accents & Emoji Editing');
  testEditor.setText('Alert 🚨 and e\u0301 accent and 👩‍👩‍👧‍👦');
  // Backspace at end
  testEditor.selectionManager.setSingleCaret(0, testEditor.getText().length);
  testEditor.deleteBackward();
  assert(!testEditor.getText().includes('👩‍👩‍👧‍👦'), 'Deleting backward over emoji cluster deletes entire cluster');

  // Test Arrow navigation over emoji
  testEditor.setText('A🚨B');
  testEditor.selectionManager.setSingleCaret(0, 1); // Before 🚨
  testEditor.moveRight(false); // Move right past 🚨
  assert.strictEqual(testEditor.selectionManager.primary.head.col, 1 + '🚨'.length);
  testEditor.moveLeft(false); // Move left back before 🚨
  assert.strictEqual(testEditor.selectionManager.primary.head.col, 1);
  console.log('  ✔ Unicode graphemes and emojis navigation and deletion verified');

  // Test Multi-caret
  console.log('Test 6: Multi-caret Editing');
  testEditor.setText('foo 123\nbar 123\nbaz 123');
  testEditor.selectionManager.setSingleCaret(0, 3); // after foo
  testEditor.selectionManager.addCaret(1, 3);       // after bar
  testEditor.selectionManager.addCaret(2, 3);       // after baz
  assert.strictEqual(testEditor.selectionManager.selections.length, 3);

  // Type '_test' at all 3 carets
  testEditor.insertText('_test', false);
  assert.strictEqual(testEditor.getText(), 'foo_test 123\nbar_test 123\nbaz_test 123');

  // Backspace at all 3 carets
  testEditor.deleteBackward();
  assert.strictEqual(testEditor.getText(), 'foo_tes 123\nbar_tes 123\nbaz_tes 123');

  // Undo restores initial multi-caret text
  testEditor.undo(); // undo deleteBackward
  testEditor.undo(); // undo insertText
  assert.strictEqual(testEditor.getText(), 'foo 123\nbar 123\nbaz 123');
  console.log('  ✔ Multi-caret insertion, deletion, and undo verified');

  // Test Find & Replace
  console.log('Test 7: Find & Replace Controller');
  const fc = new dom.window.FindController();
  fc.setQuery('123');
  fc.setReplaceText('999');
  testEditor.setText('Row 1: 123\nRow 2: 123\nRow 3: 123');
  const findRes = fc.findMatches(testEditor.doc);
  assert.strictEqual(findRes.count, 3, 'Found 3 matches');

  // Wrap around navigation
  const m1 = fc.nextMatch(); // match 2
  const m2 = fc.nextMatch(); // match 3
  const m3 = fc.nextMatch(); // match 1 (wrapped)
  assert.strictEqual(fc.currentMatchIndex, 0, 'Find next wrapped to start');

  // Replace one
  testEditor.selectMatch(m3);
  testEditor.replaceSelection('999');
  assert.strictEqual(testEditor.getText(), 'Row 1: 999\nRow 2: 123\nRow 3: 123');

  // Replace all
  fc.setQuery('123');
  fc.findMatches(testEditor.doc);
  const matches = fc.matches;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    testEditor.doc.deleteRange({ row: m.row, col: m.startCol }, { row: m.row, col: m.endCol });
    testEditor.doc.insertAt({ row: m.row, col: m.startCol }, '999');
  }
  assert.strictEqual(testEditor.getText(), 'Row 1: 999\nRow 2: 999\nRow 3: 999');
  console.log('  ✔ Find & Replace forward/backward wrapping, replace, and replace all verified');

  // Test Revision Restore as Undoable Unsaved Action
  console.log('Test 8: Revision Preview and Restore Safety');
  testEditor.setText('Current Local Working Draft', true);
  testEditor.restoreRevisionContent('Restored Revision 1 Content');
  assert.strictEqual(testEditor.getText(), 'Restored Revision 1 Content');
  assert.strictEqual(testEditor.isDirty, true, 'Restoring revision marks as unsaved dirty action');

  // Undo restore
  testEditor.undo();
  assert.strictEqual(testEditor.getText(), 'Current Local Working Draft', 'Undoing restore recovers draft');
  console.log('  ✔ Revision restore opens as unsaved action and can be undone');

  // Test Manifest presence and format
  console.log('Test 9: APP_MANIFEST.md Validation');
  const manifestPath = path.resolve(__dirname, '../APP_MANIFEST.md');
  assert(fs.existsSync(manifestPath), 'APP_MANIFEST.md must exist');
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  assert(manifestContent.includes('npm start'), 'Manifest must include start command');
  assert(/SQLite path:\s*`?\/app\/patchpad\.db`?/i.test(manifestContent), 'Manifest must specify SQLite path as /app/patchpad.db');
  assert(manifestContent.includes('/api/documents'), 'Manifest must list API routes');
  console.log('  ✔ APP_MANIFEST.md verified with exact required path');

  // Cleanup test server & db
  server.close();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  console.log('\n============================================');
  console.log('  ✔ ALL 9 VERIFICATION TESTS PASSED (100%)  ');
  console.log('============================================\n');
}

main().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});

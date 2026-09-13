const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const { DocumentModel } = require('../public/js/document-model.js');
const { UndoManager } = require('../public/js/undo-manager.js');
const { FindReplaceEngine } = require('../public/js/find-replace.js');
const {
  getGraphemeSegments,
  prevGraphemeBoundary,
  nextGraphemeBoundary,
  prevWordBoundary,
  nextWordBoundary
} = require('../public/js/graphemes.js');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failedTests++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failedTests++;
  }
}

async function runAllTests() {
  console.log('Starting PatchPad Test Suite...\n');

  // ==========================================
  // Section 1: Grapheme & Unicode Handling
  // ==========================================
  console.log('Section 1: Grapheme & Unicode Handling');

  test('Emoji with skin tone modifier counts as single grapheme cluster', () => {
    const text = 'a👍🏽b';
    const segs = getGraphemeSegments(text);
    assert.strictEqual(segs.length, 3);
    assert.strictEqual(segs[0].segment, 'a');
    assert.strictEqual(segs[1].segment, '👍🏽');
    assert.strictEqual(segs[2].segment, 'b');

    const nextBound = nextGraphemeBoundary(text, 1);
    assert.strictEqual(nextBound, 1 + '👍🏽'.length);
    const prevBound = prevGraphemeBoundary(text, nextBound);
    assert.strictEqual(prevBound, 1);
  });

  test('Complex ZWJ emoji counts as single grapheme cluster', () => {
    const text = '👨‍👩‍👧‍👦';
    const segs = getGraphemeSegments(text);
    assert.strictEqual(segs.length, 1);
    assert.strictEqual(segs[0].segment, '👨‍👩‍👧‍👦');
  });

  test('Combining accent marks handled as single grapheme cluster', () => {
    const text = 'e\u0301'; // é as e + combining acute
    const segs = getGraphemeSegments(text);
    assert.strictEqual(segs.length, 1);
    assert.strictEqual(nextGraphemeBoundary(text, 0), text.length);
  });

  test('Word boundaries handle alphanumeric and punctuation', () => {
    const text = 'foo bar-baz  qux';
    assert.strictEqual(nextWordBoundary(text, 0), 3); // 'foo' -> end of foo
    assert.strictEqual(nextWordBoundary(text, 3), 4); // ' ' -> skip whitespace
    assert.strictEqual(prevWordBoundary(text, 3), 0); // start of 'foo'
    assert.strictEqual(prevWordBoundary(text, 7), 4); // 'bar'
  });

  // ==========================================
  // Section 2: Document Model & Text Mutations
  // ==========================================
  console.log('\nSection 2: Document Model & Text Mutations');

  test('Initializes with seed-like multi-line text', () => {
    const doc = new DocumentModel('Line 1\nLine 2\nLine 3');
    assert.strictEqual(doc.getLineCount(), 3);
    assert.strictEqual(doc.getText(), 'Line 1\nLine 2\nLine 3');
  });

  test('replaceRange single line insertion and deletion', () => {
    const doc = new DocumentModel('Hello world');
    doc.replaceRange({ line: 0, col: 5 }, { line: 0, col: 5 }, ' beautiful');
    assert.strictEqual(doc.getText(), 'Hello beautiful world');

    doc.replaceRange({ line: 0, col: 5 }, { line: 0, col: 15 }, '');
    assert.strictEqual(doc.getText(), 'Hello world');
  });

  test('replaceRange multi-line insertion and deletion', () => {
    const doc = new DocumentModel('Line 1\nLine 4');
    doc.replaceRange({ line: 0, col: 6 }, { line: 1, col: 0 }, '\nLine 2\nLine 3\n');
    assert.strictEqual(doc.getLineCount(), 4);
    assert.strictEqual(doc.getLine(1), 'Line 2');
    assert.strictEqual(doc.getLine(2), 'Line 3');
  });

  test('Block indent and outdent across multiple lines', () => {
    const doc = new DocumentModel('function test() {\nconst a = 1;\nconst b = 2;\n}');
    // Select lines 1 to 2
    const sel = {
      anchor: { line: 1, col: 0 },
      head: { line: 2, col: 12 }
    };
    const indRes = doc.indentBlock(sel);
    assert.strictEqual(doc.getLine(1), '  const a = 1;');
    assert.strictEqual(doc.getLine(2), '  const b = 2;');
    assert.strictEqual(doc.getLine(0), 'function test() {'); // Line 0 untouched
    assert.strictEqual(doc.getLine(3), '}'); // Line 3 untouched

    doc.outdentBlock(indRes.selection);
    assert.strictEqual(doc.getLine(1), 'const a = 1;');
    assert.strictEqual(doc.getLine(2), 'const b = 2;');
  });

  test('Block indent requirement: selection ending at start of next line does NOT include that next line', () => {
    const doc = new DocumentModel('Line 1\nLine 2\nLine 3\nLine 4');
    const sel = {
      anchor: { line: 0, col: 0 },
      head: { line: 2, col: 0 } // Head is at line 2 col 0 (Line 3)
    };
    const res = doc.indentBlock(sel);
    assert.strictEqual(res.startLine, 0);
    assert.strictEqual(res.endLine, 1); // Only lines 0 and 1 indented!
    assert.strictEqual(doc.getLine(0), '  Line 1');
    assert.strictEqual(doc.getLine(1), '  Line 2');
    assert.strictEqual(doc.getLine(2), 'Line 3'); // Line 3 NOT indented
    assert.strictEqual(doc.getLine(3), 'Line 4');
  });

  // ==========================================
  // Section 3: Undo / Redo Stack
  // ==========================================
  console.log('\nSection 3: Undo / Redo Stack');

  test('Undo / Redo restores exact before and after states', () => {
    const undo = new UndoManager();
    undo.recordAction({
      beforeText: 'initial',
      afterText: 'step 1',
      beforeSelections: [{ anchor: { line: 0, col: 0 }, head: { line: 0, col: 0 } }],
      afterSelections: [{ anchor: { line: 0, col: 6 }, head: { line: 0, col: 6 } }],
      type: 'edit'
    });

    assert.strictEqual(undo.canUndo(), true);
    assert.strictEqual(undo.canRedo(), false);

    const undone = undo.undo();
    assert.strictEqual(undone.text, 'initial');
    assert.strictEqual(undo.canUndo(), false);
    assert.strictEqual(undo.canRedo(), true);

    const redone = undo.redo();
    assert.strictEqual(redone.text, 'step 1');
    assert.strictEqual(undo.canUndo(), true);
    assert.strictEqual(undo.canRedo(), false);
  });

  test('Coalesces continuous typing into a single undo step', () => {
    const undo = new UndoManager();
    // Type 'a'
    undo.recordAction({
      beforeText: '',
      afterText: 'a',
      beforeSelections: [{ anchor: { line: 0, col: 0 }, head: { line: 0, col: 0 } }],
      afterSelections: [{ anchor: { line: 0, col: 1 }, head: { line: 0, col: 1 } }],
      type: 'typing'
    });
    // Type 'b' immediately after
    undo.recordAction({
      beforeText: 'a',
      afterText: 'ab',
      beforeSelections: [{ anchor: { line: 0, col: 1 }, head: { line: 0, col: 1 } }],
      afterSelections: [{ anchor: { line: 0, col: 2 }, head: { line: 0, col: 2 } }],
      type: 'typing'
    });
    // Type 'c'
    undo.recordAction({
      beforeText: 'ab',
      afterText: 'abc',
      beforeSelections: [{ anchor: { line: 0, col: 2 }, head: { line: 0, col: 2 } }],
      afterSelections: [{ anchor: { line: 0, col: 3 }, head: { line: 0, col: 3 } }],
      type: 'typing'
    });

    // Should only have 1 action in undo stack
    assert.strictEqual(undo.undoStack.length, 1);
    const res = undo.undo();
    assert.strictEqual(res.text, '');
  });

  test('New edit clears redo stack', () => {
    const undo = new UndoManager();
    undo.recordAction({
      beforeText: 'A',
      afterText: 'B',
      beforeSelections: [],
      afterSelections: [],
      type: 'edit'
    });
    undo.undo();
    assert.strictEqual(undo.canRedo(), true);

    // New edit
    undo.recordAction({
      beforeText: 'A',
      afterText: 'C',
      beforeSelections: [],
      afterSelections: [],
      type: 'edit'
    });
    assert.strictEqual(undo.canRedo(), false);
  });

  // ==========================================
  // Section 4: Find & Replace Engine
  // ==========================================
  console.log('\nSection 4: Find & Replace Engine');

  test('Finds all matches and navigates with wrapping', () => {
    const doc = new DocumentModel('apple banana apple cherry apple');
    const find = new FindReplaceEngine();
    find.setQuery('apple');
    const matches = find.updateMatches(doc);

    assert.strictEqual(matches.length, 3);
    assert.deepStrictEqual(find.nextMatch(), matches[0]);
    assert.deepStrictEqual(find.nextMatch(), matches[1]);
    assert.deepStrictEqual(find.nextMatch(), matches[2]);
    assert.deepStrictEqual(find.nextMatch(), matches[0]); // Wrap forward

    assert.deepStrictEqual(find.prevMatch(), matches[2]); // Wrap backward
  });

  test('Replace Current replaces active match and advances', () => {
    const doc = new DocumentModel('foo bar foo baz');
    const find = new FindReplaceEngine();
    find.setQuery('foo');
    find.setReplaceText('XYZ');
    find.updateMatches(doc);
    find.nextMatch(); // Select first match

    const res = find.replaceCurrent(doc);
    assert.strictEqual(doc.getText(), 'XYZ bar foo baz');
    assert.strictEqual(find.matches.length, 1); // 1 remaining match
  });

  test('Replace All performs atomic replacement across entire document', () => {
    const doc = new DocumentModel('Log line ALPHA-0001: test ALPHA-0001\nLog line ALPHA-0002');
    const find = new FindReplaceEngine();
    find.setQuery('ALPHA');
    find.setReplaceText('BETA');
    find.updateMatches(doc);

    const res = find.replaceAll(doc);
    assert.strictEqual(res.count, 3);
    assert.strictEqual(doc.getText(), 'Log line BETA-0001: test BETA-0001\nLog line BETA-0002');
  });

  // ==========================================
  // Section 5: Database & Seed Verification
  // ==========================================
  console.log('\nSection 5: Database & Seed Verification');

  const testDbPath = path.join(__dirname, 'test-patchpad.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const Database = require('better-sqlite3');
  const dbModule = require('../db.js');
  const testDb = new Database(testDbPath);
  testDb.pragma('journal_mode = WAL');

  // Initialize DB schema & seed
  const appDb = dbModule.getDb(testDbPath);

  test('Database seeds initial report correctly', () => {
    const doc = dbModule.getDocument('incident-alpha', appDb);
    assert.ok(doc, 'Seeded document must exist');
    assert.strictEqual(doc.id, 'incident-alpha');
    assert.strictEqual(doc.title, 'Northwind API Incident Report');
    assert.strictEqual(doc.author, 'Riley Stone');
    assert.strictEqual(doc.current_revision, 1);

    const lines = doc.content.split('\n');
    assert.strictEqual(lines.length, 1226, 'Should have exactly 1226 lines');
    assert.strictEqual(lines[0], 'Incident: Northwind API latency event');
    assert.strictEqual(lines[lines.length - 1], 'The editor must preserve this tail sentinel: OMEGA-END-ANCHOR.');
  });

  test('Re-initializing DB does not duplicate report or overwrite history', () => {
    const docs = dbModule.listDocuments(appDb);
    assert.strictEqual(docs.length, 1);
  });

  test('Saving unchanged content does not increment revision', () => {
    const doc = dbModule.getDocument('incident-alpha', appDb);
    const res = dbModule.saveDocument('incident-alpha', 1, doc.content, 'No-op save', appDb);
    assert.strictEqual(res.saved, false);
    assert.strictEqual(res.revision, 1);

    const docAfter = dbModule.getDocument('incident-alpha', appDb);
    assert.strictEqual(docAfter.current_revision, 1);
  });

  test('Saving changed content increments revision and records history', () => {
    const doc = dbModule.getDocument('incident-alpha', appDb);
    const newContent = doc.content + '\nAdded line for revision 2';
    const res = dbModule.saveDocument('incident-alpha', 1, newContent, 'First change', appDb);
    assert.strictEqual(res.saved, true);
    assert.strictEqual(res.revision, 2);

    const docAfter = dbModule.getDocument('incident-alpha', appDb);
    assert.strictEqual(docAfter.current_revision, 2);

    const revs = dbModule.getRevisions('incident-alpha', appDb);
    assert.strictEqual(revs.length, 2);
    assert.strictEqual(revs[0].revision_number, 2);
    assert.strictEqual(revs[1].revision_number, 1);
  });

  test('Stale save throws 409 conflict error', () => {
    const doc = dbModule.getDocument('incident-alpha', appDb);
    assert.strictEqual(doc.current_revision, 2);

    let caughtErr = null;
    try {
      dbModule.saveDocument('incident-alpha', 1, doc.content + ' conflict', 'Stale edit', appDb);
    } catch (err) {
      caughtErr = err;
    }
    assert.ok(caughtErr, 'Should throw error on stale save');
    assert.strictEqual(caughtErr.status, 409);
    assert.strictEqual(caughtErr.currentRevision, 2);
  });

  // Clean up test db
  dbModule.closeDb();
  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch (e) {}
  }
  const testWal = testDbPath + '-wal';
  if (fs.existsSync(testWal)) {
    try { fs.unlinkSync(testWal); } catch (e) {}
  }
  const testShm = testDbPath + '-shm';
  if (fs.existsSync(testShm)) {
    try { fs.unlinkSync(testShm); } catch (e) {}
  }

  // Also reset live DB for server endpoints test
  const liveDbPath = path.join(__dirname, '..', 'patchpad.db');
  if (fs.existsSync(liveDbPath)) {
    try { fs.unlinkSync(liveDbPath); } catch (e) {}
  }
  const liveWal = path.join(__dirname, '..', 'patchpad.db-wal');
  if (fs.existsSync(liveWal)) {
    try { fs.unlinkSync(liveWal); } catch (e) {}
  }
  const liveShm = path.join(__dirname, '..', 'patchpad.db-shm');
  if (fs.existsSync(liveShm)) {
    try { fs.unlinkSync(liveShm); } catch (e) {}
  }

  // ==========================================
  // Section 6: Express Server HTTP Endpoints
  // ==========================================
  console.log('\nSection 6: Express Server HTTP Endpoints');

  const server = require('../server.js');
  const TEST_PORT = 3999;
  let httpServer;

  await new Promise((resolve) => {
    httpServer = server.listen(TEST_PORT, '127.0.0.1', resolve);
  });

  function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method,
        headers: payload ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        } : {}
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  await asyncTest('GET /api/reports returns list containing incident-alpha', async () => {
    const res = await request('GET', '/api/reports');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const found = res.body.find(r => r.id === 'incident-alpha');
    assert.ok(found);
    assert.strictEqual(found.title, 'Northwind API Incident Report');
    assert.strictEqual(found.author, 'Riley Stone');
  });

  await asyncTest('GET /api/reports/incident-alpha returns document with 1226 lines', async () => {
    const res = await request('GET', '/api/reports/incident-alpha');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, 'incident-alpha');
    assert.strictEqual(res.body.title, 'Northwind API Incident Report');
    assert.strictEqual(res.body.current_revision, 1);
    const lines = res.body.content.split('\n');
    assert.strictEqual(lines.length, 1226);
  });

  await asyncTest('POST /api/reports/incident-alpha/save rejects non-integer baseRevision with 400', async () => {
    const res = await request('POST', '/api/reports/incident-alpha/save', {
      baseRevision: 'one',
      content: 'test'
    });
    assert.strictEqual(res.status, 400);
  });

  await asyncTest('POST /api/reports/incident-alpha/save rejects non-string content with 400', async () => {
    const res = await request('POST', '/api/reports/incident-alpha/save', {
      baseRevision: 1,
      content: 12345
    });
    assert.strictEqual(res.status, 400);
  });

  await asyncTest('POST /api/reports/incident-alpha/save rejects mismatched documentId with 400', async () => {
    const res = await request('POST', '/api/reports/incident-alpha/save', {
      baseRevision: 1,
      content: 'test',
      documentId: 'wrong-doc'
    });
    assert.strictEqual(res.status, 400);
  });

  await asyncTest('POST /api/reports/incident-alpha/save with valid change increments revision', async () => {
    const docRes = await request('GET', '/api/reports/incident-alpha');
    const content = docRes.body.content;
    const saveRes = await request('POST', '/api/reports/incident-alpha/save', {
      baseRevision: 1,
      content: content + '\nNew line appended'
    });
    assert.strictEqual(saveRes.status, 200);
    assert.strictEqual(saveRes.body.saved, true);
    assert.strictEqual(saveRes.body.revision, 2);
  });

  await asyncTest('POST /api/reports/incident-alpha/save with stale revision returns 409 Conflict', async () => {
    const saveRes = await request('POST', '/api/reports/incident-alpha/save', {
      baseRevision: 1, // Server is now at revision 2!
      content: 'Stale update content'
    });
    assert.strictEqual(saveRes.status, 409);
    assert.strictEqual(saveRes.body.serverRevision, 2);
  });

  await asyncTest('GET /api/reports/incident-alpha/revisions and /:revNum returns history', async () => {
    const revsRes = await request('GET', '/api/reports/incident-alpha/revisions');
    assert.strictEqual(revsRes.status, 200);
    assert.strictEqual(revsRes.body.length, 2);

    const rev1Res = await request('GET', '/api/reports/incident-alpha/revisions/1');
    assert.strictEqual(rev1Res.status, 200);
    assert.strictEqual(rev1Res.body.revision_number, 1);
    assert.ok(rev1Res.body.content.includes('OMEGA-END-ANCHOR'));
  });

  httpServer.close();

  // Reset database for clean startup
  dbModule.closeDb();
  if (fs.existsSync(liveDbPath)) {
    try { fs.unlinkSync(liveDbPath); } catch (e) {}
  }
  if (fs.existsSync(liveWal)) {
    try { fs.unlinkSync(liveWal); } catch (e) {}
  }
  if (fs.existsSync(liveShm)) {
    try { fs.unlinkSync(liveShm); } catch (e) {}
  }

  console.log(`\n==========================================`);
  console.log(`Test Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log(`==========================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});

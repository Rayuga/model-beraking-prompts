const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocket } = require('ws');

const FormulaEngine = require('../public/js/formula');
const ClipboardEngine = require('../public/js/clipboard');
const HistoryManager = require('../public/js/history');
const FindReplaceEngine = require('../public/js/find_replace');
const { initDatabase, StorageEngine } = require('../server/db');
const { app, server, storageEngine } = require('../server/index');

const TEST_PORT = 3001;

async function runAllTests() {
  console.log('========================================');
  console.log('Running GridForge Automated Test Suite');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(err);
      failed++;
    }
  }

  // --- 1. Formula Engine Tests ---
  console.log('[1] Formula Engine Tests:');

  await test('Basic Arithmetic & Parentheses', () => {
    const calc = new FormulaEngine.WorkbookCalculator({
      'A1': '10',
      'A2': '5',
      'A3': '=A1 + A2 * 2',      // 10 + 10 = 20
      'A4': '=(A1 + A2) * 2',    // 15 * 2 = 30
      'A5': '=A1 - A2',          // 5
      'A6': '=A1 / A2',          // 2
      'A7': '=2 ^ 3',            // 8
      'A8': '=-A1 + 20',         // 10
      'A9': '=50% * 200'         // 100
    });
    calc.computeAll();
    assert.strictEqual(calc.getDisplayValue('A3'), 20);
    assert.strictEqual(calc.getDisplayValue('A4'), 30);
    assert.strictEqual(calc.getDisplayValue('A5'), 5);
    assert.strictEqual(calc.getDisplayValue('A6'), 2);
    assert.strictEqual(calc.getDisplayValue('A7'), 8);
    assert.strictEqual(calc.getDisplayValue('A8'), 10);
    assert.strictEqual(calc.getDisplayValue('A9'), 100);
  });

  await test('Functions: SUM, AVG, AVERAGE, MIN, MAX, COUNT', () => {
    const calc = new FormulaEngine.WorkbookCalculator({
      'B1': '10',
      'B2': '20',
      'B3': '30',
      'B4': '40',
      'C1': '=SUM(B1:B4)',
      'C2': '=AVG(B1:B4)',
      'C3': '=AVERAGE(B1:B4)',
      'C4': '=MIN(B1:B4)',
      'C5': '=MAX(B1:B4)',
      'C6': '=COUNT(B1:B4)',
      'C7': '=SUM(B1:B2, 50, B3*2)' // 10 + 20 + 50 + 60 = 140
    });
    calc.computeAll();
    assert.strictEqual(calc.getDisplayValue('C1'), 100);
    assert.strictEqual(calc.getDisplayValue('C2'), 25);
    assert.strictEqual(calc.getDisplayValue('C3'), 25);
    assert.strictEqual(calc.getDisplayValue('C4'), 10);
    assert.strictEqual(calc.getDisplayValue('C5'), 40);
    assert.strictEqual(calc.getDisplayValue('C6'), 4);
    assert.strictEqual(calc.getDisplayValue('C7'), 140);
  });

  await test('Error Handling: DIV/0, Circular, Syntax, Value', () => {
    const calc = new FormulaEngine.WorkbookCalculator({
      'D1': '=10 / 0',
      'D2': '=SUM(10 +',
      'D3': '="Hello" * 2',
      'E1': '=E2 + 1',
      'E2': '=E1 + 1'
    });
    calc.computeAll();
    assert.strictEqual(calc.getDisplayValue('D1'), '#DIV/0!');
    assert.strictEqual(calc.getDisplayValue('D2'), '#SYNTAX!');
    assert.strictEqual(calc.getDisplayValue('D3'), '#VALUE!');
    assert.strictEqual(calc.getDisplayValue('E1'), '#CIRCULAR!');
    assert.strictEqual(calc.getDisplayValue('E2'), '#CIRCULAR!');
  });

  await test('Formula Shifting (Relative vs Absolute References)', () => {
    // Relative shift down 2 rows, right 1 col
    const f1 = FormulaEngine.shiftFormula('=B2*C2', 2, 1);
    assert.strictEqual(f1, '=C4*D4');

    // Range shift
    const f2 = FormulaEngine.shiftFormula('=SUM(D2:D4)', 2, 0);
    assert.strictEqual(f2, '=SUM(D4:D6)');

    // Absolute column and row
    const f3 = FormulaEngine.shiftFormula('=$B$2*C2', 2, 1);
    assert.strictEqual(f3, '=$B$2*D4');

    // Mixed absolute: B$2 (fixed row) and $C2 (fixed col)
    const f4 = FormulaEngine.shiftFormula('=B$2*$C2', 2, 1);
    assert.strictEqual(f4, '=C$2*$C4');
  });

  // --- 2. Clipboard & Fill Tests ---
  console.log('\n[2] Clipboard & Fill Tests:');

  await test('TSV and CSV Parsing & Formatting', () => {
    const tsvText = 'Item\tQty\tPrice\nServer\t3\t120\nDatabase\t2\t350';
    const parsed = ClipboardEngine.parseClipboardText(tsvText);
    assert.strictEqual(parsed.length, 3);
    assert.strictEqual(parsed[0][0], 'Item');
    assert.strictEqual(parsed[1][1], '3');
    assert.strictEqual(parsed[2][2], '350');

    const formatted = ClipboardEngine.formatTSV(parsed);
    assert.strictEqual(formatted, tsvText);
  });

  await test('Fill Pattern Progression (Numbers & Formulas)', () => {
    // Linear number sequence [1, 2] -> [3, 4, 5]
    const seq = ClipboardEngine.generateFillValues(['1', '2'], 3, 1, 0);
    assert.deepStrictEqual(seq, ['3', '4', '5']);

    // Single number repeat
    const rep = ClipboardEngine.generateFillValues(['10'], 3, 1, 0);
    assert.deepStrictEqual(rep, ['10', '10', '10']);

    // Formula fill down
    const formFill = ClipboardEngine.generateFillValues(['=B2*C2'], 3, 1, 0);
    assert.deepStrictEqual(formFill, ['=B3*C3', '=B4*C4', '=B5*C5']);
  });

  // --- 3. Storage & Concurrency Engine Tests ---
  console.log('\n[3] Storage & Concurrency Engine Tests:');

  const testDbFile = path.join(__dirname, 'test_storage.db');
  if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
  const testDb = initDatabase(testDbFile);
  const storage = new StorageEngine(testDb);

  await test('Database Seeding from seed file', () => {
    const wb = storage.getWorkbook('ops-plan');
    assert.ok(wb);
    assert.strictEqual(wb.title, 'Northwind Operations Plan');
    assert.strictEqual(wb.current_revision, 1);
    assert.strictEqual(wb.sheets[0].cells['A1'], 'Item');
    assert.strictEqual(wb.sheets[0].cells['D2'], '=B2*C2');
    assert.strictEqual(wb.sheets[0].cells['A80'], 'ANCHOR-BOTTOM');

    const revisions = storage.getRevisions('ops-plan');
    assert.strictEqual(revisions.length, 1);
    assert.strictEqual(revisions[0].revision_number, 1);
  });

  await test('Database Persistence across restarts', () => {
    // Modify a cell in testDb
    const snap = storage.getWorkbookSnapshot('ops-plan');
    snap.sheets[0].cells['A1'] = 'Modified Item';
    const res = storage.saveWorkbook('ops-plan', 1, snap, 'riley', 'Riley Stone', 'Edit A1');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.revision, 2);

    testDb.close();

    // Reopen DB (simulating restart)
    const reopenedDb = initDatabase(testDbFile);
    const reopenedStorage = new StorageEngine(reopenedDb);
    const wb = reopenedStorage.getWorkbook('ops-plan');
    assert.strictEqual(wb.current_revision, 2);
    assert.strictEqual(wb.sheets[0].cells['A1'], 'Modified Item');
    reopenedDb.close();
  });

  // Re-open fresh testDb for remaining concurrency tests
  if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
  const concurrencyDb = initDatabase(testDbFile);
  const concurrencyStorage = new StorageEngine(concurrencyDb);

  await test('No change save returns current revision without creating duplicate', () => {
    const snap = concurrencyStorage.getWorkbookSnapshot('ops-plan');
    const res = concurrencyStorage.saveWorkbook('ops-plan', 1, snap, 'riley', 'Riley Stone');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.revision, 1);
    assert.strictEqual(res.noChange, true);
    const revisions = concurrencyStorage.getRevisions('ops-plan');
    assert.strictEqual(revisions.length, 1);
  });

  await test('Sequential Save increments revision and tracks cell history', () => {
    const snap = concurrencyStorage.getWorkbookSnapshot('ops-plan');
    snap.sheets[0].cells['B2'] = '10';
    const res = concurrencyStorage.saveWorkbook('ops-plan', 1, snap, 'morgan', 'Morgan Lee', 'Update Qty');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.revision, 2);

    const historyB2 = concurrencyStorage.getCellHistory('ops-plan', 'plan', 'B2');
    assert.ok(historyB2.length >= 2);
    assert.strictEqual(historyB2[0].new_value, '10');
    assert.strictEqual(historyB2[0].old_value, '3');
    assert.strictEqual(historyB2[0].user_name, 'Morgan Lee');
  });

  await test('Concurrent Non-Overlapping Save Merges Cleanly', () => {
    // Current revision is 2 (Morgan changed B2).
    // Riley was at baseRevision 1 and changes C2 to '150' (no overlap with B2).
    const snapRiley = concurrencyStorage.getRevision('ops-plan', 1).snapshot;
    snapRiley.sheets[0].cells['C2'] = '150';

    const res = concurrencyStorage.saveWorkbook('ops-plan', 1, snapRiley, 'riley', 'Riley Stone', 'Update Price');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.revision, 3);
    assert.strictEqual(res.merged, true);

    const currentWb = concurrencyStorage.getWorkbook('ops-plan');
    assert.strictEqual(currentWb.sheets[0].cells['B2'], '10');  // Morgan's change kept
    assert.strictEqual(currentWb.sheets[0].cells['C2'], '150'); // Riley's change merged
  });

  await test('Concurrent Overlapping Stale Save is Rejected with 409 Conflict', () => {
    // Current revision is 3.
    // Priya was at baseRevision 1 and also modified B2 to '99' (overlaps with Morgan's change to B2 in Rev 2).
    const snapPriya = concurrencyStorage.getRevision('ops-plan', 1).snapshot;
    snapPriya.sheets[0].cells['B2'] = '99';

    const res = concurrencyStorage.saveWorkbook('ops-plan', 1, snapPriya, 'priya', 'Priya Shah', 'Conflicting Qty');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.conflict, true);
    assert.strictEqual(res.statusCode, 409);
    assert.ok(res.conflictingCells.includes('B2'));

    // Verify DB was NOT altered
    const currentWb = concurrencyStorage.getWorkbook('ops-plan');
    assert.strictEqual(currentWb.current_revision, 3);
    assert.strictEqual(currentWb.sheets[0].cells['B2'], '10');
  });

  await test('Server rejects malformed / invalid requests with 400', () => {
    const snap = concurrencyStorage.getWorkbookSnapshot('ops-plan');

    // 1. Non-integer revision
    const r1 = concurrencyStorage.saveWorkbook('ops-plan', 2.5, snap, 'riley', 'Riley');
    assert.strictEqual(r1.success, false);
    assert.strictEqual(r1.statusCode, 400);

    // 2. Future revision
    const r2 = concurrencyStorage.saveWorkbook('ops-plan', 999, snap, 'riley', 'Riley');
    assert.strictEqual(r2.success, false);
    assert.strictEqual(r2.statusCode, 400);

    // 3. Renaming workbook
    const snapRename = JSON.parse(JSON.stringify(snap));
    snapRename.title = 'Hacked Name';
    const r3 = concurrencyStorage.saveWorkbook('ops-plan', 3, snapRename, 'riley', 'Riley');
    assert.strictEqual(r3.success, false);
    assert.strictEqual(r3.statusCode, 400);

    // 4. Non-string cell value
    const snapBadCell = JSON.parse(JSON.stringify(snap));
    snapBadCell.sheets[0].cells['B2'] = 12345; // number instead of string
    const r4 = concurrencyStorage.saveWorkbook('ops-plan', 3, snapBadCell, 'riley', 'Riley');
    assert.strictEqual(r4.success, false);
    assert.strictEqual(r4.statusCode, 400);
  });

  concurrencyDb.close();
  if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);

  // --- 4. HTTP Server & REST API Tests ---
  console.log('\n[4] HTTP Server & REST API Tests:');

  const httpServer = http.createServer(app);
  await new Promise(resolve => httpServer.listen(TEST_PORT, resolve));

  async function apiRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: path,
        method: method,
        headers: body ? { 'Content-Type': 'application/json' } : {}
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, body: data });
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  await test('GET /api/workbook returns 200 with seed', async () => {
    const res = await apiRequest('GET', '/api/workbook');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, 'ops-plan');
    assert.strictEqual(res.body.title, 'Northwind Operations Plan');
    assert.ok(res.body.sheets.length > 0);
  });

  await test('GET /api/workbooks/ops-plan/revisions returns revision list', async () => {
    const res = await apiRequest('GET', '/api/workbooks/ops-plan/revisions');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1);
  });

  await test('GET /api/workbooks/ops-plan/sheets/plan/cells/A1/history returns history', async () => {
    const res = await apiRequest('GET', '/api/workbooks/ops-plan/sheets/plan/cells/A1/history');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1);
  });

  await test('POST /api/workbooks/ops-plan/save with valid data', async () => {
    const wbRes = await apiRequest('GET', '/api/workbooks/ops-plan');
    const curRev = wbRes.body.current_revision;
    const snap = {
      id: 'ops-plan',
      title: 'Northwind Operations Plan',
      sheets: [
        {
          id: 'plan',
          name: 'Plan',
          cells: { ...wbRes.body.sheets[0].cells, 'A14': 'ANCHOR-TOP-' + Date.now() }
        }
      ]
    };

    const saveRes = await apiRequest('POST', '/api/workbooks/ops-plan/save', {
      baseRevision: curRev,
      workbook: snap,
      userId: 'riley',
      userName: 'Riley Stone',
      description: 'API Test Save'
    });

    assert.strictEqual(saveRes.status, 200);
    assert.strictEqual(saveRes.body.success, true);
    assert.strictEqual(saveRes.body.revision, curRev + 1);
  });

  await test('Static Assets Served Locally (index.html, style.css, formula.js)', async () => {
    const htmlRes = await apiRequest('GET', '/');
    assert.strictEqual(htmlRes.status, 200);
    assert.ok(String(htmlRes.body).includes('GridForge'));

    const cssRes = await apiRequest('GET', '/css/style.css');
    assert.strictEqual(cssRes.status, 200);

    const jsRes = await apiRequest('GET', '/js/formula.js');
    assert.strictEqual(jsRes.status, 200);
  });

  // --- 5. WebSocket Real-time Collaboration Tests ---
  console.log('\n[5] WebSocket Real-time Collaboration Tests:');

  await test('WebSocket Presence & Revision Broadcast', async () => {
    const { wsManager } = require('../server/index');
    wsManager.attach(httpServer);

    const wsUrl = `ws://127.0.0.1:${TEST_PORT}/ws`;

    const client1 = new WebSocket(wsUrl);
    const client2 = new WebSocket(wsUrl);

    await Promise.all([
      new Promise(r => client1.on('open', r)),
      new Promise(r => client2.on('open', r))
    ]);

    // Client 1 joins as Riley
    client1.send(JSON.stringify({
      type: 'join',
      sessionId: 'sess_riley_test',
      userId: 'riley',
      userName: 'Riley Stone',
      cell: 'B2',
      range: 'B2',
      workbookId: 'ops-plan'
    }));

    // Client 2 joins as Morgan
    client2.send(JSON.stringify({
      type: 'join',
      sessionId: 'sess_morgan_test',
      userId: 'morgan',
      userName: 'Morgan Lee',
      cell: 'C2',
      range: 'C2:D4',
      workbookId: 'ops-plan'
    }));

    // Wait for presence update on client 1
    const presenceMsg = await new Promise((resolve) => {
      client1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'presence_update' && msg.sessions.length >= 2) {
          resolve(msg);
        }
      });
    });

    assert.ok(presenceMsg.sessions.some(s => s.userId === 'riley' && s.cell === 'B2'));
    assert.ok(presenceMsg.sessions.some(s => s.userId === 'morgan' && s.range === 'C2:D4'));

    // Test Revision Broadcast
    const revPromise = new Promise((resolve) => {
      client2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'revision_saved') {
          resolve(msg);
        }
      });
    });

    // Make an API save request
    const wbRes = await apiRequest('GET', '/api/workbooks/ops-plan');
    const curRev = wbRes.body.current_revision;
    const snap = {
      id: 'ops-plan',
      title: 'Northwind Operations Plan',
      sheets: [
        {
          id: 'plan',
          name: 'Plan',
          cells: { ...wbRes.body.sheets[0].cells, 'A14': 'WS-BROADCAST-TEST-' + Date.now() }
        }
      ]
    };

    await apiRequest('POST', '/api/workbooks/ops-plan/save', {
      baseRevision: curRev,
      workbook: snap,
      userId: 'riley',
      userName: 'Riley Stone',
      description: 'WS Broadcast Test'
    });

    const receivedRev = await revPromise;
    assert.strictEqual(receivedRev.revision, curRev + 1);
    assert.strictEqual(receivedRev.user.id, 'riley');

    client1.close();
    client2.close();
  });

  httpServer.close();

  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  runAllTests().catch(err => {
    console.error('Test suite exception:', err);
    process.exit(1);
  });
}

module.exports = { runAllTests };

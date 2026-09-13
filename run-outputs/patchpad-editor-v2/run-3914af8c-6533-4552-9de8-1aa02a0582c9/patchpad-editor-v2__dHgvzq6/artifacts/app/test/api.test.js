const assert = require('assert');
const path = require('path');
const fs = require('fs');

async function runApiTests(baseURL) {
  console.log('--- Starting Backend API & Conflict Safety Tests ---');

  // 1. GET /api/reports
  console.log('1. Testing GET /api/reports...');
  const reportsRes = await fetch(`${baseURL}/api/reports`);
  assert.strictEqual(reportsRes.status, 200, 'GET /api/reports should return 200');
  const reports = await reportsRes.json();
  assert(Array.isArray(reports), 'reports should be an array');
  assert(reports.length >= 1, 'reports should have at least 1 report');
  const seedReport = reports.find(r => r.id === 'incident-alpha');
  assert(seedReport, 'incident-alpha must exist');
  assert.strictEqual(seedReport.title, 'Northwind API Incident Report');
  assert.strictEqual(seedReport.author, 'Riley Stone');
  assert.strictEqual(seedReport.current_revision, 1);
  console.log('✓ GET /api/reports passed.');

  // 2. GET /api/reports/incident-alpha
  console.log('2. Testing GET /api/reports/incident-alpha...');
  const docRes = await fetch(`${baseURL}/api/reports/incident-alpha`);
  assert.strictEqual(docRes.status, 200);
  const doc = await docRes.json();
  assert.strictEqual(doc.id, 'incident-alpha');
  assert.strictEqual(doc.title, 'Northwind API Incident Report');
  assert.strictEqual(doc.author, 'Riley Stone');
  assert.strictEqual(doc.current_revision, 1);
  assert(doc.current_content.includes('Incident: Northwind API latency event'));
  assert(doc.current_content.includes('The editor must preserve this tail sentinel: OMEGA-END-ANCHOR.'));
  const lines = doc.current_content.split('\n');
  assert.strictEqual(lines.length, 1226, 'Should have 1226 lines');
  console.log('✓ GET /api/reports/incident-alpha passed.');

  // 3. Validation on POST /api/reports/incident-alpha/save
  console.log('3. Testing validation errors on save...');
  // Missing content
  const err1 = await fetch(`${baseURL}/api/reports/incident-alpha/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseRevision: 1 })
  });
  assert.strictEqual(err1.status, 400, 'Missing content should return 400');

  // Non-integer revision
  const err2 = await fetch(`${baseURL}/api/reports/incident-alpha/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseRevision: 'one', content: 'test' })
  });
  assert.strictEqual(err2.status, 400, 'Non-integer revision should return 400');

  // Document ID mismatch
  const err3 = await fetch(`${baseURL}/api/reports/incident-alpha/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseRevision: 1, content: 'test', documentId: 'wrong-id' })
  });
  assert.strictEqual(err3.status, 400, 'Document ID mismatch should return 400');

  // Non-existent document
  const err4 = await fetch(`${baseURL}/api/reports/non-existent/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseRevision: 1, content: 'test' })
  });
  assert.strictEqual(err4.status, 404, 'Non-existent document should return 404');
  console.log('✓ Validation error tests passed.');

  // 4. Save unchanged content
  console.log('4. Testing save with unchanged content...');
  const unchangedRes = await fetch(`${baseURL}/api/reports/incident-alpha/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseRevision: 1, content: doc.current_content })
  });
  assert.strictEqual(unchangedRes.status, 200);
  const unchangedData = await unchangedRes.json();
  assert.strictEqual(unchangedData.revision, 1, 'Revision should remain 1 when content unchanged');
  assert.strictEqual(unchangedData.changed, false);
  console.log('✓ Save unchanged content passed.');

  // 5. Save changed content -> creates Revision 2
  console.log('5. Testing save changed content (Rev 1 -> Rev 2)...');
  const modifiedContent = doc.current_content.replace('Status: Draft for executive review', 'Status: Final Incident Report');
  const save1Res = await fetch(`${baseURL}/api/reports/incident-alpha/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseRevision: 1, content: modifiedContent })
  });
  assert.strictEqual(save1Res.status, 200);
  const save1Data = await save1Res.json();
  assert.strictEqual(save1Data.revision, 2, 'New revision should be 2');
  assert.strictEqual(save1Data.changed, true);

  // Check document in DB is now Rev 2
  const docAfterSave = await (await fetch(`${baseURL}/api/reports/incident-alpha`)).json();
  assert.strictEqual(docAfterSave.current_revision, 2);
  assert(docAfterSave.current_content.includes('Status: Final Incident Report'));
  console.log('✓ Save changed content passed.');

  // 6. Conflict Safety: Stale Save Attempt (tab with baseRevision 1 tries to save)
  console.log('6. Testing conflict safety on stale save...');
  const staleContent = doc.current_content.replace('Status: Draft for executive review', 'Status: Stale Edit from Tab B');
  const conflictRes = await fetch(`${baseURL}/api/reports/incident-alpha/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseRevision: 1, content: staleContent })
  });
  assert.strictEqual(conflictRes.status, 409, 'Stale save must return 409 Conflict');
  const conflictData = await conflictRes.json();
  assert.strictEqual(conflictData.currentRevision, 2, 'Conflict response should indicate currentRevision is 2');

  // Ensure server content was NOT modified by the rejected stale save
  const docAfterConflict = await (await fetch(`${baseURL}/api/reports/incident-alpha`)).json();
  assert.strictEqual(docAfterConflict.current_revision, 2);
  assert(docAfterConflict.current_content.includes('Status: Final Incident Report'), 'Server content must stay at Rev 2');
  console.log('✓ Conflict safety passed.');

  // 7. Revision History querying
  console.log('7. Testing revision history endpoints...');
  const revsRes = await fetch(`${baseURL}/api/reports/incident-alpha/revisions`);
  assert.strictEqual(revsRes.status, 200);
  const revs = await revsRes.json();
  assert.strictEqual(revs.length, 2, 'Should have 2 revisions');
  assert.strictEqual(revs[0].revision, 2);
  assert.strictEqual(revs[1].revision, 1);

  // Fetch Rev 1
  const rev1Res = await fetch(`${baseURL}/api/reports/incident-alpha/revisions/1`);
  assert.strictEqual(rev1Res.status, 200);
  const rev1Data = await rev1Res.json();
  assert.strictEqual(rev1Data.revision, 1);
  assert(rev1Data.content.includes('Status: Draft for executive review'));

  // Fetch Rev 2
  const rev2Res = await fetch(`${baseURL}/api/reports/incident-alpha/revisions/2`);
  assert.strictEqual(rev2Res.status, 200);
  const rev2Data = await rev2Res.json();
  assert.strictEqual(rev2Data.revision, 2);
  assert(rev2Data.content.includes('Status: Final Incident Report'));
  console.log('✓ Revision history endpoints passed.');

  console.log('=== ALL BACKEND API & CONFLICT TESTS PASSED ===\n');
}

module.exports = { runApiTests };

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase, createApp } = require('../server');

async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patchpad-'));
  const dbPath = path.join(dir, 'test.db');
  const db = openDatabase(dbPath);
  const server = createApp({ db }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  return { db, base: `http://127.0.0.1:${server.address().port}`, dbPath };
}

async function request(base, url, options) {
  const response = await fetch(base + url, options); return { status: response.status, body: await response.json() };
}

const put = (base, id, payload) => request(base, `/api/documents/${id}`, { method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) });

test('first startup seeds exact long document once and preserves metadata and tail', async t => {
  const { db, dbPath } = await fixture(t);
  const row = db.prepare('SELECT * FROM documents').get();
  assert.equal(row.id, 'incident-alpha'); assert.equal(row.revision, 1);
  assert.match(row.content, /Log line 1200:.*ALPHA-1200/); assert.ok(row.content.endsWith('The editor must preserve this tail sentinel: OMEGA-END-ANCHOR.'));
  const metadata = JSON.parse(row.generation_metadata); assert.equal(metadata.generatedLineCount, 1200); assert.equal(metadata.tailSections.length, 3);
  const db2 = openDatabase(dbPath); assert.equal(db2.prepare('SELECT count(*) count FROM documents').get().count, 1); assert.equal(db2.prepare('SELECT count(*) count FROM revisions').get().count, 1); db2.close();
});

test('changed save creates revision while unchanged save does not', async t => {
  const { base, db } = await fixture(t); const original = db.prepare('SELECT content FROM documents').get().content;
  const saved = await put(base, 'incident-alpha', { id:'incident-alpha', baseRevision:1, content:original + '\nedit' });
  assert.equal(saved.status, 200); assert.equal(saved.body.revision, 2); assert.equal(saved.body.unchanged, false);
  const unchanged = await put(base, 'incident-alpha', { id:'incident-alpha', baseRevision:2, content:original + '\nedit' });
  assert.equal(unchanged.body.unchanged, true); assert.equal(db.prepare('SELECT count(*) count FROM revisions').get().count, 2);
});

test('stale save is refused and cannot overwrite newer content', async t => {
  const { base, db } = await fixture(t); const original = db.prepare('SELECT content FROM documents').get().content;
  assert.equal((await put(base, 'incident-alpha', { id:'incident-alpha', baseRevision:1, content:'newer' })).status, 200);
  const stale = await put(base, 'incident-alpha', { id:'incident-alpha', baseRevision:1, content:'stale overwrite' });
  assert.equal(stale.status, 409); assert.equal(db.prepare('SELECT content FROM documents').get().content, 'newer'); assert.equal(db.prepare('SELECT count(*) count FROM revisions').get().count, 2);
});

test('unknown, mismatched, and malformed saves never mutate history', async t => {
  const { base, db } = await fixture(t); const cases = [
    put(base, 'unknown', { id:'unknown', baseRevision:1, content:'x' }),
    put(base, 'incident-alpha', { id:'other', baseRevision:1, content:'x' }),
    put(base, 'incident-alpha', { id:'incident-alpha', content:'x' }),
    put(base, 'incident-alpha', { id:'incident-alpha', baseRevision:'1', content:'x' }),
    put(base, 'incident-alpha', { id:'incident-alpha', baseRevision:1, content:42 })
  ];
  const results = await Promise.all(cases); assert.deepEqual(results.map(r => r.status), [404,400,400,400,400]);
  assert.equal(db.prepare('SELECT revision FROM documents').get().revision, 1); assert.equal(db.prepare('SELECT count(*) count FROM revisions').get().count, 1);
});

test('revision APIs expose history and exact preview content', async t => {
  const { base } = await fixture(t); await put(base, 'incident-alpha', { id:'incident-alpha', baseRevision:1, content:'revision two' });
  const history = await request(base, '/api/documents/incident-alpha/revisions'); assert.deepEqual(history.body.revisions.map(r => r.revision), [2,1]);
  const preview = await request(base, '/api/documents/incident-alpha/revisions/2'); assert.equal(preview.body.content, 'revision two');
});

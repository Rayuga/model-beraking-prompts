// Exercises the golden solution through the same restart helper used by the judge.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const requests = new Set();
    context.on('request', r => {
      const path = new URL(r.url()).pathname;
      if (path.startsWith('/api/')) requests.add(r.method() + ' ' + path);
    });
    const page = await context.newPage();
    const ready = p => p.waitForFunction(() => document.querySelector('#doc-title')?.textContent === 'Northwind API Incident Report');
    const read = (p, path) => p.evaluate(async path => {
      const r = await fetch(path);
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    }, path);
    const snapshot = async p => {
      const docs = (await read(p, '/api/documents')).documents;
      assert.equal(docs.length, 1);
      const doc = (await read(p, '/api/documents/incident-alpha')).document;
      const history = (await read(p, '/api/documents/incident-alpha/revisions')).revisions;
      const contents = [];
      for (const revision of history) {
        contents.push((await read(p, `/api/documents/incident-alpha/revisions/${revision.revision}`)).revision);
      }
      return { docs, doc, history, contents };
    };
    await page.goto('http://localhost:3000/');
    await ready(page);
    const before = await snapshot(page);
    const marker = 'PATCHPAD-RESTART-PROOF';
    assert.ok(!before.doc.content.includes(marker));
    await page.locator('#find-box').fill('OMEGA-END-ANCHOR');
    await page.locator('#find-box').press('Enter');
    await page.locator('#find-box').press('Escape');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type(marker);
    const response = page.waitForResponse(r => r.url().endsWith('/save') && r.request().method() === 'POST');
    await page.locator('#save-btn').click();
    assert.equal((await response).status(), 200);
    const saved = await snapshot(page);
    assert.equal(saved.doc.current_revision, before.doc.current_revision + 1);
    assert.equal(saved.history.length, before.history.length + 1);
    assert.equal(saved.doc.content, before.doc.content + '\n' + marker);
    const restarts = [];
    for (let i = 0; i < 2; i++) {
      const previousPid = fs.readFileSync('/logs/verifier/app.pid', 'utf8').trim();
      const output = execFileSync('bash', ['/tests/app-lifecycle.sh', 'restart'], { encoding: 'utf8', timeout: 60000 });
      const currentPid = fs.readFileSync('/logs/verifier/app.pid', 'utf8').trim();
      assert.notEqual(previousPid, currentPid);
      assert.match(output, /Application ready/);
      const fresh = await context.newPage();
      await fresh.goto('http://localhost:3000/');
      await ready(fresh);
      assert.deepEqual(await snapshot(fresh), saved);
      const last = fresh.locator('.line').last().locator('.text');
      await last.scrollIntoViewIfNeeded();
      assert.equal(await last.getAttribute('data-line-text'), marker);
      restarts.push({ previousPid, currentPid, exact_document_and_history: true });
      await fresh.close();
    }
    const manifest = fs.readFileSync('/app/APP_MANIFEST.md', 'utf8');
    assert.match(manifest, /npm start/);
    assert.match(manifest, /SQLite path:/);
    const routeMap = [
      ['GET', '/api/documents', '/api/documents'],
      ['GET', '/api/documents/:id', '/api/documents/incident-alpha'],
      ['POST', '/api/documents/:id/save', '/api/documents/incident-alpha/save'],
      ['GET', '/api/documents/:id/revisions', '/api/documents/incident-alpha/revisions'],
      ['GET', '/api/documents/:id/revisions/:revision', '/api/documents/incident-alpha/revisions/1'],
    ];
    for (const [method, documented, observed] of routeMap) {
      assert.ok(manifest.includes(`| ${method} | \`${documented}\``), documented);
      assert.ok(requests.has(method + ' ' + observed), observed);
    }
    fs.writeFileSync('/results/restart-regression.json', JSON.stringify({
      scope: 'Unpaid golden checks for the two new Functional criteria',
      manifest_routes_match_observed_requests: true, routeMap, restarts,
      saved_revision: saved.doc.current_revision, saved_history_count: saved.history.length,
    }, null, 2));
    console.log('PASS Two actual server restarts preserve unique saved document and complete revision history');
    console.log('PASS Manifest routes match successful live API requests');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

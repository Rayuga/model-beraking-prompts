'use strict';
// Local diagnostic witness only. Does not run the configured judge or predict its score.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const evidence = '/evidence';
const source = '/frozen/app';
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hashTree = root => Object.fromEntries(fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => { const p = path.join(e.parentPath || e.path, e.name); return [path.relative(root, p), sha(p)]; }));
const sourceBefore = hashTree(source);
const result = { kind: 'Local golden and dead-payment-writer UI witness; not configured grading', source_sha256: sourceBefore, observations: [] };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run(mode, port) {
  const app = '/tmp/row30-' + mode;
  fs.cpSync(source, app, { recursive: true });
  if (mode === 'dead_payments') {
    const file = app + '/src/index.js';
    const text = fs.readFileSync(file, 'utf8');
    const from = text.indexOf('function remit(o, kind, cents) {');
    const to = text.indexOf('\nfunction mintGrant(o)', from);
    assert.ok(from > 0 && to > from);
    fs.writeFileSync(file, text.slice(0, from) + 'function remit(o, kind, cents) { /* diagnostic no-op payment writer */ }\n' + text.slice(to));
    fs.writeFileSync(evidence + '/mutation.diff', '--- frozen/src/index.js\n+++ diagnostic/src/index.js\n@@\n' + text.slice(from, to).split('\n').map(l => '-' + l).join('\n') + '\n+function remit(o, kind, cents) { /* diagnostic no-op payment writer */ }\n');
    result.mutation = { file: 'src/index.js', original_sha256: sourceBefore['src/index.js'], mutated_sha256: sha(file), change: 'Replace only remit() body with no-op; preserve approvals, revisions, rescissions and all other writers.' };
  }
  const base = 'http://127.0.0.1:' + port;
  const child = spawn('node', [app + '/server.js'], { env: { ...process.env, NODE_PATH: '/usr/local/lib/node_modules', PORT: String(port), DB_PATH: '/tmp/row30-' + mode + '.db' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '', browser;
  child.stdout.on('data', x => logs += x); child.stderr.on('data', x => logs += x);
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await sleep(50); }
    browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const browserErrors = []; page.on('pageerror', e => browserErrors.push(e.message));
    let observedReadUrl;
    page.on('response', r => { if (r.request().method() === 'GET' && r.url().endsWith('/api/bootstrap')) observedReadUrl = r.url(); });
    const emails = { recruiter: 'rafael.costa', approver: 'yuki.tanaka', finance: 'farah.nasser', auditor: 'aud.halvorsen' };
    async function login(role) {
      if (await page.locator('#logout').isVisible()) await page.locator('#logout').click();
      await page.getByLabel('Email').fill(emails[role] + '@hireops.example');
      await page.getByLabel('Password').fill('Hireops!2026');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.getByRole('heading', { name: 'Coordinated Changes', exact: true }).waitFor();
    }
    async function nav(name) { await page.getByRole('navigation').getByRole('button', { name, exact: true }).click(); }
    async function data() { assert.ok(observedReadUrl); const r = await context.request.get(observedReadUrl); assert.equal(r.status(), 200); return r.json(); }
    async function action(button, operation) {
      const pending = page.waitForResponse(r => r.request().method() === 'POST' && operation(r.url()));
      await button.click(); const r = await pending; assert.equal(r.status(), 200, await r.text());
      return r.json();
    }
    await page.goto(base); await login('recruiter'); await nav('Requisitions');
    await page.locator('#req-id').fill('ROW30-REQ'); await page.locator('#req-title').fill('Row30 payment control'); await page.locator('#req-budget').fill('2000000.00');
    await action(page.getByRole('button', { name: 'Create requisition', exact: true }), u => u.endsWith('/api/requisitions'));
    await page.locator('article.entity[data-entity="ROW30-REQ"]').waitFor();
    await nav('Offers');
    for (const [selector, value] of Object.entries({ '#off-id': 'ROW30-OFFER', '#off-cand': 'Row30 candidate', '#off-base': '100000.00', '#off-sign': '10000.01', '#off-rel': '123.45', '#off-units': '7', '#off-fair': '1.02', '#off-strike': '0.01', '#off-start': '2024-02-29T12:34:56.789Z' })) await page.locator(selector).fill(value);
    await page.locator('#off-req').selectOption('ROW30-REQ');
    await action(page.getByRole('button', { name: 'Create offer', exact: true }), u => u.endsWith('/api/offers'));
    await page.locator('article.entity[data-entity="ROW30-OFFER"]').waitFor();
    await login('approver'); await nav('Offers');
    await action(page.getByRole('button', { name: 'Approve ROW30-OFFER', exact: true }), u => u.endsWith('/approve'));
    let current = 'ROW30-OFFER';
    async function checkpoint(stage) {
      const d = await data(); const chain = d.offers.filter(o => o.id === 'ROW30-OFFER' || o.id.startsWith('ROW30-OFFER-R'));
      const offer = chain.find(o => o.id === current);
      const payments = chain.flatMap(o => o.remittances || []);
      const unique = [...new Map(payments.map(p => [p.id, p])).values()];
      result.observations.push({ mode, stage, id: current, status: offer.status, relocation_cents: offer.relocation_cents, signing_bonus_cents: offer.signing_bonus_cents, payment_records: unique, payment_count: unique.length });
      if (mode === 'dead_payments') assert.equal(unique.length, 0); else assert.ok(unique.length > 0);
      return offer;
    }
    assert.equal((await checkpoint('approval')).status, 'COMMITTED');
    await login('recruiter'); await nav('Offers');
    async function revise(fields) {
      await page.getByRole('button', { name: 'Revise ' + current, exact: true }).click();
      for (const [name, value] of Object.entries(fields)) await page.locator('input[name="' + name + '"]').fill(value);
      const r = await action(page.getByRole('button', { name: 'Apply revision', exact: true }), u => u.endsWith('/revise'));
      await page.locator('#detail-backdrop').waitFor({ state: 'hidden' }); current = r.revised_offer_id;
    }
    await revise({ base: '110000.00', signing: '8000.03', relocation: '222.22', units: '11', fair: '2.03', strike: '0.02' });
    assert.equal((await checkpoint('revision_1')).relocation_cents, 22222);
    await login('finance'); await nav('Offers');
    await revise({ base: '90000.00', signing: '12000.05', relocation: '333.00', units: '13', fair: '3.04', strike: '0.03' });
    assert.equal((await checkpoint('revision_2')).relocation_cents, 33300);
    await page.getByRole('button', { name: 'Rescind ' + current, exact: true }).click();
    await page.locator('input[name="effective_at"]').fill('2025-02-28T12:34:56.789Z');
    await action(page.getByRole('button', { name: 'Post rescission (Finance controller only)', exact: true }), u => u.endsWith('/rescind'));
    await page.locator('#detail-backdrop').waitFor({ state: 'hidden' });
    assert.equal((await checkpoint('rescission')).status, 'RESCINDED');
    await login('auditor'); await nav('Offers');
    await checkpoint('fresh_auditor_readback');
    await page.screenshot({ path: evidence + '/' + mode + '.png', fullPage: true });
    assert.deepEqual(browserErrors, []);
  } finally {
    if (browser) await browser.close(); child.kill(); fs.writeFileSync(evidence + '/' + mode + '-server.log', logs);
  }
}
(async () => {
  try { await run('golden', 3096); await run('dead_payments', 3097); assert.deepEqual(hashTree(source), sourceBefore); result.completed = true; }
  catch (e) { result.error = e.stack; process.exitCode = 1; }
  finally { fs.writeFileSync(evidence + '/payment-control-results.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2)); }
})();

'use strict';
// Scripted golden browser observations for the live change desk. Fixture setup uses the
// API; every asserted behaviour is driven through the page. Not a configured judge run.
const fs = require('fs'), assert = require('assert/strict'), { spawn } = require('child_process');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const out = '/evidence/results'; fs.mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:3000', db = '/tmp/hireops-live-desk.db';
const results = [], errors = [], cookies = {};
const emails = { r: 'rafael.costa', a: 'yuki.tanaka', f: 'farah.nasser', u: 'aud.halvorsen' };
const sleep = (n) => new Promise((r) => setTimeout(r, n));
let child, browser, logs = '', serial = 0;

function launch() {
  child = spawn('node', ['/app/server.js'], { cwd: '/tmp', env: { PATH: process.env.PATH, HOME: '/tmp', NODE_PATH: '/usr/local/lib/node_modules', PORT: '3000', DB_PATH: db }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (b) => logs += b); child.stderr.on('data', (b) => logs += b);
}
async function healthy() { for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/api/health')).ok) return; } catch {} await sleep(50); } throw new Error('server did not start'); }
async function api(who, url, body) {
  const r = await fetch(base + url, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...(cookies[who] ? { cookie: cookies[who] } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => null);
  return { status: r.status, data };
}
async function ok(who, url, body) { const r = await api(who, url, body); assert.equal(r.status, 200, `${url} -> ${r.status} ${JSON.stringify(r.data)}`); return r.data; }
const B1 = { base_salary_cents: 9823, signing_bonus_cents: 1001, relocation_cents: 321, equity_units: 7, equity_fair_cents: 102, equity_strike_cents: 1 };
async function req(budget = 10000) { const id = 'LD-R' + (++serial); await ok('r', '/api/requisitions', { id, title: id, dept: 'Desk', budget_cents: budget }); return id; }
async function hire(req_id, terms = B1) { const id = 'LD-O' + (++serial); await ok('r', '/api/offers', { id, req_id, candidate: 'Cand ' + id, start_date: '2024-02-29T12:34:56.789Z', ...terms }); await ok('a', `/api/offers/${id}/approve`, {}); return id; }
async function pair(budget) { const a = await req(budget), b = await req(budget); return { a, b, x: await hire(a), y: await hire(b) }; }
const record = (name, details = {}) => { results.push({ name, passed: true, ...details }); console.log('PASS', name); };

async function login(page, who) {
  if (!page.url().startsWith(base)) await page.goto(base);
  await page.getByLabel('Email').fill(emails[who] + '@hireops.example');
  await page.getByLabel('Password').fill('Hireops!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Coordinated Changes', level: 1 }).waitFor();
}
const field = (page, n, label) => page.getByLabel(`Member ${n} ${label}`, { exact: true });
async function setMember(page, n, offer, dest, t) {
  await field(page, n, 'source offer').selectOption(offer);
  await field(page, n, 'destination requisition').selectOption(dest);
  const map = { 'Base salary (dollars)': t[0], 'Signing bonus (dollars)': t[1], 'Relocation (dollars)': t[2], 'Equity units': t[3], 'Equity fair value (dollars)': t[4], 'Equity strike price (dollars)': t[5] };
  for (const [label, value] of Object.entries(map)) await field(page, n, label).fill(value);
}
const swapA = ['94.47', '8.03', '9.99', '11', '2.03', '0.02'], swapB = ['90.22', '12.05', '7.77', '13', '3.04', '0.03'];
const rowText = (page, n) => page.locator('fieldset.member-row').nth(n - 1).locator('.row-figures').innerText();
const footer = (page) => page.getByRole('region', { name: 'Headroom after this change' }).innerText();
const card = (page, key) => page.locator('article[data-change-set]').filter({ has: page.getByRole('heading', { name: new RegExp('^' + key + '\\s') }) });
async function save(page, key) {
  await page.getByLabel('Operation key', { exact: true }).fill(key);
  const wait = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/preview'));
  await page.getByRole('button', { name: 'Save preview', exact: true }).click();
  return wait;
}

(async () => {
  try {
    launch(); await healthy();
    for (const [who, email] of Object.entries(emails)) {
      const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email + '@hireops.example', password: 'Hireops!2026' }) });
      assert.equal(r.status, 200); cookies[who] = r.headers.get('set-cookie').split(';')[0];
    }
    browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const p = await pair();
    await login(page, 'f');

    // 1. Figures before saving: funded swap fits, one cent over is flagged, saved preview agrees.
    await setMember(page, 1, p.x, p.b, swapA); await setMember(page, 2, p.y, p.a, swapB);
    let r1 = await rowText(page, 1), r2 = await rowText(page, 2), f = await footer(page);
    assert.match(r1, /\$100\.00\s+->\s+\$100\.00/); assert.match(r1, /-\$1\.98/); assert.match(r1, /\$105\.01 \(Band I\)\s+->\s+\$104\.02/);
    assert.match(r2, /\$100\.00\s+->\s+\$100\.00/); assert.match(r2, /\$2\.04/);
    assert.equal((f.match(/Fits/g) || []).length, 2); assert.ok(!/Over budget/.test(f)); assert.equal((f.match(/\$0\.00\s+->\s+\$0\.00/g) || []).length, 2);
    assert.equal((await api('u', '/api/change-sets')).data.length, 0);
    await field(page, 1, 'Base salary (dollars)').fill('94.48');
    f = await footer(page); assert.match(f, /Over budget by \$0\.01/); assert.equal((f.match(/Fits/g) || []).length, 1);
    await field(page, 1, 'Base salary (dollars)').fill('94.47');
    let resp = await save(page, 'LD-SWAP'); assert.equal(resp.status(), 200);
    const saved = (await resp.json()).id;
    await card(page, 'LD-SWAP').waitFor();
    const savedText = await card(page, 'LD-SWAP').innerText();
    assert.match(savedText, /Current:/); assert.match(savedText, /-\$1\.98/); assert.match(savedText, /\$105\.01\s+->\s+\$104\.02/);
    assert.equal(await page.evaluate(() => document.activeElement.tagName + ':' + document.activeElement.textContent), 'H3:LD-SWAP  /  PREVIEW');
    record('live row figures and netted footer before saving; one-cent overrun flagged; saved preview agrees; focus lands on saved preview');
    await page.screenshot({ path: out + '/desk-saved-preview.png', fullPage: true });

    // 2. Live desk: out-of-date mark arrives with typing, focus and scroll intact.
    const typed = field(page, 2, 'Relocation (dollars)');
    await typed.fill(''); await typed.pressSequentially('41.5');
    await page.evaluate(() => window.scrollTo(0, 260));
    const scroll0 = await page.evaluate(() => window.scrollY); assert.ok(scroll0 > 0);
    const extra = await hire(await req(1000000), { ...B1, base_salary_cents: 100 });
    await sleep(1500); assert.match(await card(page, 'LD-SWAP').innerText(), /Current:/);   // unrelated settlement does not mark it
    const bump = await ok('r', '/api/offers', { id: 'LD-BUMP', req_id: p.a, candidate: 'Pending only', start_date: '2026-09-01', ...B1, base_salary_cents: 1 });
    await sleep(1500); assert.match(await card(page, 'LD-SWAP').innerText(), /Current:/);   // pending creation does not mark it
    const t0 = Date.now();
    await ok('f', `/api/offers/${p.x}/revise`, { ...B1, relocation_cents: 322 });           // same run-rate: balance returns, history moved
    await card(page, 'LD-SWAP').getByText(/Out of date/).waitFor({ timeout: 10000 });
    const arrival = Date.now() - t0;
    assert.equal(await typed.inputValue(), '41.5');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label') || document.activeElement.closest('label').innerText.split('\n')[0]), 'Member 2 Relocation (dollars)');
    assert.equal(await page.evaluate(() => window.scrollY), scroll0);
    await typed.pressSequentially('5'); assert.equal(await typed.inputValue(), '41.55');
    assert.match(await page.locator('fieldset.member-row').nth(0).locator('.row-status').innerText(), /No longer current/);
    assert.equal(await field(page, 1, 'Base salary (dollars)').inputValue(), '94.47');
    record('out-of-date mark and superseded-source flag arrive without reload; typed value, focus and scroll kept', { arrival_ms: arrival, extra, bump: bump.id });
    await page.screenshot({ path: out + '/desk-out-of-date.png', fullPage: true });

    // Refused commit of the out-of-date preview: focus on the refusal, entries kept.
    await card(page, 'LD-SWAP').getByRole('button', { name: 'Commit reviewed change' }).click();
    await card(page, 'LD-SWAP').getByRole('alert').filter({ hasText: /Stale/ }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'alert');
    assert.equal(await field(page, 2, 'Signing bonus (dollars)').inputValue(), '12.05');
    record('refused commit focuses its explanation and keeps editor entries');

    // 3. Four rows, remove the second, others keep their values; field-level refusal.
    const q = await pair(1000000), s = await pair(1000000);
    await page.getByRole('button', { name: 'Add member', exact: true }).click();
    await page.getByRole('button', { name: 'Add member', exact: true }).click();
    assert.ok(await page.getByRole('button', { name: 'Add member', exact: true }).isDisabled());
    await setMember(page, 1, q.x, q.a, ['11.11', '1.01', '0.00', '0', '0.00', '0.00']);
    await setMember(page, 2, q.y, q.b, ['22.22', '2.02', '0.00', '0', '0.00', '0.00']);
    await setMember(page, 3, s.x, s.a, ['33.33', '3.03', '0.00', '0', '0.00', '0.00']);
    await setMember(page, 4, s.y, s.b, ['44.44', '4.04', '0.00', '0', '0.00', '0.00']);
    assert.equal((await footer(page)).match(/Fits/g).length, 4);
    await page.getByRole('button', { name: 'Remove member 2', exact: true }).click();
    assert.equal(await page.locator('fieldset.member-row').count(), 3);
    assert.equal(await field(page, 1, 'Base salary (dollars)').inputValue(), '11.11');
    assert.equal(await field(page, 2, 'Base salary (dollars)').inputValue(), '33.33');
    assert.equal(await field(page, 3, 'Signing bonus (dollars)').inputValue(), '4.04');
    assert.equal(await field(page, 2, 'source offer').inputValue(), s.x);
    f = await footer(page); assert.equal(f.match(/Fits/g).length, 3); assert.ok(!f.includes(q.b));
    await field(page, 3, 'Signing bonus (dollars)').fill('4.045');
    const before = (await api('u', '/api/change-sets')).data.length;
    await page.getByLabel('Operation key', { exact: true }).fill('LD-FIELD');
    await page.getByRole('button', { name: 'Save preview', exact: true }).click();
    const summary = page.locator('.error-summary');
    await summary.getByRole('button', { name: /Member 3 Signing bonus/ }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.className), 'error-summary');
    assert.equal(await field(page, 3, 'Signing bonus (dollars)').getAttribute('aria-invalid'), 'true');
    assert.equal(await field(page, 1, 'Signing bonus (dollars)').getAttribute('aria-invalid'), null);
    await summary.getByRole('button', { name: /Member 3 Signing bonus/ }).click();
    assert.equal(await page.evaluate(() => document.activeElement.closest('label').innerText.split('\n')[0]), 'Member 3 Signing bonus (dollars)');
    assert.equal((await api('u', '/api/change-sets')).data.length, before);
    assert.equal(await field(page, 2, 'Base salary (dollars)').inputValue(), '33.33');
    await field(page, 3, 'Signing bonus (dollars)').fill('4.04');
    resp = await save(page, 'LD-FIELD'); assert.equal(resp.status(), 200);
    await card(page, 'LD-FIELD').waitFor();
    record('remove a middle member keeps the others; field-level refusal names member and field, marks it, links to it; correction saves');

    // 4. Entries survive a workspace switch and a reload.
    await field(page, 1, 'Relocation (dollars)').fill('77.01');
    await page.getByRole('button', { name: 'Offers', exact: true }).click();
    await page.getByRole('heading', { name: 'Offers', level: 1 }).waitFor();
    await page.getByRole('button', { name: 'Coordinated Changes', exact: true }).click();
    assert.equal(await field(page, 1, 'Relocation (dollars)').inputValue(), '77.01');
    await page.reload(); await page.getByRole('heading', { name: 'Coordinated Changes', level: 1 }).waitFor();
    assert.equal(await field(page, 1, 'Relocation (dollars)').inputValue(), '77.01');
    assert.equal(await page.getByLabel('Operation key', { exact: true }).inputValue(), 'LD-FIELD');
    assert.equal(await page.locator('fieldset.member-row').count(), 3);
    record('unsent entries survive a workspace switch and a reload');

    // 5. Session ends mid-edit: another person sees nothing, the same person continues.
    await page.getByLabel('Operation key', { exact: true }).fill('LD-SESSION');
    const tab = await ctx.newPage(); await tab.goto(base);
    await tab.getByRole('button', { name: 'Sign out', exact: true }).click(); await tab.getByLabel('Email').waitFor(); await tab.close();
    await sleep(1000);   // a background refresh may already have noticed the ended session; either path is valid
    if (await page.getByRole('button', { name: 'Save preview', exact: true }).isVisible()) await page.getByRole('button', { name: 'Save preview', exact: true }).click({ timeout: 3000 }).catch(() => {});
    await page.getByText(/Your session has ended/).waitFor();
    assert.equal((await api('u', '/api/change-sets')).data.some((c) => c.operation_key === 'LD-SESSION'), false);
    await login(page, 'r');
    assert.notEqual(await field(page, 1, 'Relocation (dollars)').inputValue(), '77.01');
    assert.equal(await page.locator('fieldset.member-row').count(), 2);
    assert.equal(await page.getByLabel('Operation key', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await login(page, 'f');
    assert.equal(await field(page, 1, 'Relocation (dollars)').inputValue(), '77.01');
    assert.equal(await page.getByLabel('Operation key', { exact: true }).inputValue(), 'LD-SESSION');
    assert.equal(await page.locator('fieldset.member-row').count(), 3);
    resp = await page.waitForResponse((r) => r.url().endsWith('/preview'), { timeout: 100 }).catch(() => null);
    resp = await save(page, 'LD-SESSION'); assert.equal(resp.status(), 200);
    await card(page, 'LD-SESSION').waitFor();
    record('session lost mid-edit: sign-in prompt, another person sees no entries, the same person resumes and saves');

    // 6. What-if for a role that cannot save: same figures, nothing stored.
    const w = await pair();
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } }), aud = await ctx2.newPage();
    aud.on('pageerror', (e) => errors.push(e.message));
    await login(aud, 'u');
    assert.equal(await aud.getByRole('button', { name: 'Save preview' }).count(), 0);
    await setMember(aud, 1, w.x, w.b, swapA); await setMember(aud, 2, w.y, w.a, swapB);
    const a1 = await rowText(aud, 1), a2 = await rowText(aud, 2), af = await footer(aud);
    const count = (await api('u', '/api/change-sets')).data.length;
    await page.getByRole('button', { name: 'Add member', exact: true }).waitFor();
    while (await page.locator('fieldset.member-row').count() > 2) await page.getByRole('button', { name: 'Remove member 3', exact: true }).click();
    await setMember(page, 1, w.x, w.b, swapA); await setMember(page, 2, w.y, w.a, swapB);
    assert.equal(await rowText(page, 1), a1); assert.equal(await rowText(page, 2), a2); assert.equal(await footer(page), af);
    assert.match(a1, /-\$1\.98/); assert.equal(af.match(/Fits/g).length, 2);
    assert.equal((await api('u', '/api/change-sets')).data.length, count);
    assert.equal((await api('u', '/api/change-sets/preview', { operation_key: 'LD-AUD', members: [] })).status, 403);
    record('auditor what-if shows the same figures as Finance for the same entries and stores nothing');
    await aud.screenshot({ path: out + '/auditor-what-if.png', fullPage: true });

    // 7. A viewer sees the change set turn COMMITTED; lost response keeps its notice; retry is the same operation.
    resp = await save(page, 'LD-LOST'); assert.equal(resp.status(), 200); const lost = (await resp.json()).id;
    await card(aud, 'LD-LOST').getByText(/Current:/).waitFor({ timeout: 10000 });
    let forwarded = 0, status;
    const handler = async (route) => {
      const r = route.request();
      if (!forwarded && r.method() === 'POST' && new URL(r.url()).pathname === `/api/change-sets/${lost}/commit`) { forwarded++; const real = await route.fetch(); status = real.status(); return route.abort(); }
      return route.continue();
    };
    await page.route('**/api/change-sets/**', handler);
    try {
      await card(page, 'LD-LOST').getByRole('button', { name: 'Commit reviewed change' }).click();
      await card(page, 'LD-LOST').getByRole('alert').filter({ hasText: /No confirmation was received/ }).waitFor();
    } finally { await page.unroute('**/api/change-sets/**', handler); }
    assert.equal(forwarded, 1); assert.equal(status, 200);
    await card(aud, 'LD-LOST').getByRole('heading', { name: /COMMITTED/ }).waitFor({ timeout: 10000 });
    await sleep(1500);
    assert.match(await card(page, 'LD-LOST').innerText(), /No confirmation was received/);   // notice outlives the live update
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'alert');   // and focus stays on it
    assert.equal(await card(page, 'LD-LOST').getByRole('button', { name: 'Retry this same operation' }).count(), 1);
    const snap = await ok('u', '/api/bootstrap');
    const retry = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/commit'));
    await card(page, 'LD-LOST').getByRole('button').click();
    assert.equal((await retry).url(), base + `/api/change-sets/${lost}/commit`);
    await page.getByText(/original stored receipt/).waitFor();
    assert.ok(!/No confirmation/.test(await card(page, 'LD-LOST').innerText()));
    const snap2 = await ok('u', '/api/bootstrap');
    for (const k of ['offers', 'commitment_movements', 'equity_grants', 'remittances', 'referral_accruals', 'after_images']) assert.deepEqual(snap2[k], snap[k]);
    record('viewer sees COMMITTED without reload; lost-response notice persists; retry returns the original result with no new effects', { forwarded, status });

    // 8. Exact large money through the ordinary number inputs (P2 control).
    const big = await req(1000000);
    await login2(page);
    async function login2(pg) { await pg.getByRole('button', { name: 'Offers', exact: true }).click(); }
    await page.locator(`#off-req option[value="${big}"]`).waitFor({ state: 'attached', timeout: 10000 });
    await page.locator('#off-id').fill('LD-BIG'); await page.locator('#off-req').selectOption(big);
    await page.locator('#off-cand').fill('Big Money'); await page.locator('#off-base').fill('100.00');
    await page.locator('#off-rel').fill('90071992547409.91'); await page.locator('#off-units').fill('1');
    await page.locator('#off-fair').fill('70368744177664.01'); await page.locator('#off-strike').fill('70368744177664.01');
    await page.getByRole('button', { name: 'Create offer', exact: true }).click();
    await page.locator('article[data-entity="LD-BIG"]').waitFor();
    const bigOffer = (await ok('u', '/api/offers/LD-BIG')).composition;
    assert.equal(bigOffer.relocation_cents, 9007199254740991); assert.equal(bigOffer.equity_fair_cents, 7036874417766401);
    await ok('a', '/api/offers/LD-BIG/approve', {});
    await page.locator('article[data-entity="LD-BIG"]').getByRole('button', { name: 'Revise LD-BIG' }).waitFor({ timeout: 10000 });   // arrives live
    await page.locator('article[data-entity="LD-BIG"]').getByRole('button', { name: 'Revise LD-BIG' }).click();
    await page.getByLabel('New base salary (dollars)').fill('101.00');
    await page.getByRole('button', { name: 'Apply revision' }).click();
    await page.locator('article[data-entity="LD-BIG-R"]').waitFor();
    const rev = (await ok('u', '/api/offers/LD-BIG-R')).composition;
    assert.equal(rev.relocation_cents, 9007199254740991); assert.equal(rev.equity_strike_cents, 7036874417766401); assert.equal(rev.base_salary_cents, 10100);
    record('sixteen-digit money passes the ordinary create and revise forms unchanged; other workspaces also update live');

    // 9. Real restart: saved previews, receipt and freshness survive; retry returns the original.
    const beforeRestart = await ok('u', '/api/change-sets');
    child.kill('SIGTERM'); await new Promise((r) => child.once('exit', r)); launch(); await healthy();
    assert.deepEqual((await ok('u', '/api/change-sets')), beforeRestart);
    await page.getByRole('button', { name: 'Coordinated Changes', exact: true }).click();
    await page.reload(); await page.getByRole('heading', { name: 'Coordinated Changes', level: 1 }).waitFor();
    await card(page, 'LD-LOST').getByRole('button', { name: 'Retrieve original receipt' }).click();
    await page.getByText(/original stored receipt/).waitFor();
    assert.deepEqual((await ok('u', '/api/change-sets')), beforeRestart);
    await ok('r', '/api/requisitions', { id: 'LD-AFTER', title: 'after restart', dept: 'Desk', budget_cents: 1 });
    await page.locator('select[aria-label="Member 1 destination requisition"] option[value="LD-AFTER"]').waitFor({ state: 'attached', timeout: 15000 });
    record('process restart keeps saved changes; retry returns the original receipt; live updates resume after restart');

    assert.deepEqual(errors, []); record('no JavaScript page errors');
  } catch (e) { results.push({ passed: false, error: e.stack }); console.log('FAIL', e.stack); process.exitCode = 1; }
  finally {
    if (browser) await browser.close(); if (child) child.kill();
    fs.writeFileSync(out + '/server.log', logs);
    fs.writeFileSync(out + '/live-desk.json', JSON.stringify({ kind: 'Scripted golden browser observations; not a configured judge run', results, page_errors: errors }, null, 2));
  }
})();

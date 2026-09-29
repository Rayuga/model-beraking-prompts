const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const base = 'http://localhost:3000';
const evidence = path.join(__dirname, 'gate-address-evidence');
fs.mkdirSync(evidence, { recursive: true });
const results = { started_at: new Date().toISOString(), app_image: 'ridgeline-agent:20260926-hardening', browser_image: 'ridgeline-verifier:20260926-hardening', container: 'ridgeline-gate-address-20260926', checks: [], exchanges: [], screenshots: [], browser_errors: [] };
let browser;
let page;
let catalogueURL;
let lookupURL;
let kilnSKU;
function pass(name, details = {}) { results.checks.push({ name, passed: true, ...details }); console.log(`PASS ${name}`); }
async function snapshot(name, target = page) { const file = path.join(evidence, `${name}.png`); await target.screenshot({ path: file, fullPage: true }); results.screenshots.push(file); }
async function fetchJSON(target, url, init = {}) {
  const result = await target.evaluate(async ({ url, init }) => { const response = await fetch(url, init); return { status: response.status, body: await response.json() }; }, { url, init });
  results.exchanges.push({ url, method: init.method || 'GET', request_body: init.body ? JSON.parse(init.body) : undefined, ...result });
  return result;
}
async function stocks(target = page) {
  const response = await fetchJSON(target, catalogueURL);
  assert.equal(response.status, 200);
  const prints = response.body.prints;
  return Object.fromEntries(prints.flatMap(print => print.sizes.map(size => [`${print.sku}/${size.size}`, size.in_stock])));
}
async function buy(name) {
  await page.getByRole('button', { name: 'The prints', exact: true }).click();
  await page.getByRole('button', { name: 'View Kiln', exact: true }).click();
  await page.getByRole('button', { name: /^A3/ }).click();
  await page.getByRole('button', { name: 'Add to basket', exact: true }).click();
  await page.getByRole('button', { name: 'View basket', exact: false }).click();
  await page.getByRole('button', { name: 'Continue to checkout', exact: true }).click();
  const values = { 'Full name': name, 'Address line 1': '27 Paper Street', 'Town or city': 'Leeds', 'Postcode': 'LS1 1AA' };
  for (const [label, value] of Object.entries(values)) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && response.request().postData()?.includes(name));
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 201);
  const order = await response.json();
  const request = response.request();
  const operation = { url: request.url(), method: request.method(), headers: await request.allHeaders(), body: request.postDataJSON() };
  results.exchanges.push({ purpose: 'ordinary UI purchase', ...operation, status: response.status(), response: order });
  assert.ok(order.reference);
  await page.getByText(order.reference, { exact: true }).waitFor();
  await assertReceipt(page, order, name);
  const observedLookup = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name).findLast(url => url.includes('/api/') && url.includes(location.pathname.split('/').pop())));
  assert.ok(observedLookup, 'normal receipt page must perform an observed server lookup');
  lookupURL = observedLookup;
  return { order, operation, name, lookup: observedLookup };
}
async function assertReceipt(target, order, name) {
  assert.match(await target.locator('.receipt-address').innerText(), new RegExp(name));
  assert.match(await target.locator('.receipt-lines').innerText(), /Kiln/);
  assert.match(await target.locator('.receipt-lines').innerText(), /A3/);
  assert.match(await target.locator('.receipt-lines').innerText(), /1\s*×/);
  assert.equal((await target.locator('.summary-total').innerText()).includes('39.70'), true);
  assert.equal(order.address_name, name);
  assert.equal(order.lines.length, 1);
  assert.equal(order.lines[0].qty, 1);
  assert.equal(order.lines[0].size, 'A3');
  assert.equal(order.lines[0].title, 'Kiln');
  assert.equal(order.total_pence, 3970);
}
async function freshLookup(purchase, tag) {
  const clean = await browser.newContext({ viewport: { width: 1365, height: 1000 } });
  const stateBefore = await clean.storageState();
  assert.deepEqual(stateBefore, { cookies: [], origins: [] });
  const fresh = await clean.newPage();
  fresh.on('pageerror', error => results.browser_errors.push(error.message));
  await fresh.goto(base);
  const storage = await fresh.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  assert.equal(JSON.stringify(storage).includes(purchase.name), false);
  assert.equal(JSON.stringify(storage).includes(purchase.order.reference), false);
  await fresh.getByRole('button', { name: 'Track an order', exact: true }).click();
  await fresh.getByLabel('Order reference', { exact: true }).fill(purchase.order.reference);
  const lookupPromise = fresh.waitForResponse(response => response.request().method() === 'GET' && response.url().includes(purchase.order.reference));
  await fresh.getByRole('button', { name: 'Find order', exact: true }).click();
  const response = await lookupPromise;
  assert.equal(response.status(), 200);
  const retrieved = await response.json();
  assert.deepEqual(retrieved, purchase.order);
  await fresh.getByText(purchase.order.reference, { exact: true }).waitFor();
  await assertReceipt(fresh, retrieved, purchase.name);
  results.exchanges.push({ purpose: `${tag}: fresh-context normal tracking`, url: response.url(), method: 'GET', status: response.status(), body: retrieved, context_storage_before_load: stateBefore });
  const reloadResponsePromise = fresh.waitForResponse(next => next.request().method() === 'GET' && next.url() === response.url());
  await fresh.reload();
  const reloadResponse = await reloadResponsePromise;
  assert.equal(reloadResponse.status(), 200);
  const reloaded = await reloadResponse.json();
  assert.deepEqual(reloaded, purchase.order);
  await fresh.getByText(purchase.order.reference, { exact: true }).waitFor();
  await assertReceipt(fresh, reloaded, purchase.name);
  results.exchanges.push({ purpose: `${tag}: fresh-context reload`, url: reloadResponse.url(), method: 'GET', status: reloadResponse.status(), body: reloaded });
  await snapshot(`${tag}-fresh-context-reload`, fresh);
  await clean.close();
}
async function main() {
  browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium' });
  results.chromium_version = browser.version();
  assert.match(results.chromium_version, /^152\./);
  const context = await browser.newContext({ viewport: { width: 1365, height: 1000 } });
  page = await context.newPage();
  page.on('pageerror', error => results.browser_errors.push(error.message));
  const health = await page.goto(`${base}/api/health`);
  assert.equal(health.ok(), true);
  results.health = { url: health.url(), status: health.status() };
  const catalogueResponsePromise = page.waitForResponse(response => response.request().method() === 'GET' && response.url().endsWith('/api/prints'));
  await page.goto(base);
  const catalogueResponse = await catalogueResponsePromise;
  catalogueURL = catalogueResponse.url();
  const catalogue = await catalogueResponse.json();
  const kiln = catalogue.prints.find(print => print.title === 'Kiln');
  kilnSKU = kiln.sku;
  const key = `${kilnSKU}/A3`;
  const initial = await stocks();
  assert.equal(initial[key], 7);
  assert.equal(catalogue.prints.length, 8);
  assert.equal(Object.keys(initial).length, 13);
  const runTag = Date.now().toString(36);
  const gate = await buy(`Gate Browser ${runTag}`);
  assert.equal((await stocks())[key], 6);
  await freshLookup(gate, 'gate');
  pass('gate: genuine UI order, observed server commit, independent clean-context tracking and reload', { reference: gate.order.reference, stock_before: 7, stock_after: 6, unique_recipient: gate.name });
  const startAddress = await stocks();
  const control = await buy(`Address Control ${runTag}`);
  const afterControl = await stocks();
  assert.equal(afterControl[key], startAddress[key] - 1);
  await freshLookup(control, 'address-positive-control');
  pass('address: genuine complete-address UI positive control', { reference: control.order.reference, stock_before: startAddress[key], stock_after: afterControl[key], operation: control.operation });
  const probes = [{ field: 'name', mode: 'omit' }, { field: 'line1', mode: 'blank' }, { field: 'city', mode: 'omit' }, { field: 'postcode', mode: 'blank' }];
  for (const { field, mode } of probes) {
    const body = structuredClone(control.operation.body);
    body.checkout_id = await page.evaluate(() => crypto.randomUUID());
    assert.notEqual(body.checkout_id, control.operation.body.checkout_id);
    if (mode === 'omit') delete body.address[field]; else body.address[field] = '   ';
    const invalid = await fetchJSON(page, control.operation.url, { method: control.operation.method, headers: { 'content-type': control.operation.headers['content-type'] }, body: JSON.stringify(body) });
    assert.ok(invalid.status >= 400 && invalid.status < 500, `${field} is refused`);
    assert.equal(Boolean(invalid.body.reference), false, 'no successful new reference');
    assert.deepEqual(await stocks(), afterControl, `${field} must not mutate any variant`);
    const reread = await fetchJSON(page, control.lookup);
    assert.equal(reread.status, 200);
    assert.deepEqual(reread.body, control.order, `${field} must not alter positive-control receipt`);
    pass(`address: ${mode} ${field} refused server-side, no reference, all stock and positive receipt unchanged`, { status: invalid.status, response: invalid.body, checkout_id: body.checkout_id });
  }
  const followup = await buy(`Address Followup ${runTag}`);
  assert.notEqual(followup.order.reference, control.order.reference);
  assert.notEqual(followup.operation.body.checkout_id, control.operation.body.checkout_id);
  assert.equal((await stocks())[key], startAddress[key] - 2);
  await freshLookup(followup, 'address-followup');
  await snapshot('address-followup-original-session');
  const final = await stocks();
  for (const stockKey of Object.keys(initial)) assert.equal(final[stockKey], initial[stockKey] - (stockKey === key ? 3 : 0));
  pass('address: fresh new complete-address UI purchase succeeds after four refusals and survives clean-context lookup/reload', { reference: followup.order.reference, stock_after: final[key] });
  assert.deepEqual(results.browser_errors, []);
  results.final_stock = final;
  results.passed = true;
}
main().catch(async error => {
  results.passed = false;
  results.error = { message: error.message, stack: error.stack };
  if (page) { results.failure_url = page.url(); results.failure_text = await page.locator('body').innerText().catch(() => 'unavailable'); await snapshot('failure').catch(() => {}); }
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  results.finished_at = new Date().toISOString();
  fs.writeFileSync(path.join(__dirname, 'gate-address-browser-results.json'), JSON.stringify(results, null, 2));
  if (browser) await browser.close();
});

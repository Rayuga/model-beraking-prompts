const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const results = { started_at: new Date().toISOString(), checks: [], orders_submitted: 0, browser_errors: [] };
const base = 'http://localhost:3000';
const evidence = path.join(__dirname, 'basket-context-evidence');
fs.mkdirSync(evidence, { recursive: true });
let browser;
let pageA;
let pageB;
function pass(name) { results.checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
async function inspect(target, title, size, qty, total) {
  await target.locator('.basket-line').waitFor();
  assert.equal(await target.locator('.basket-line').count(), 1);
  assert.equal(await target.locator('.basket-line h2').innerText(), title);
  assert.match(await target.locator('.basket-line').innerText(), new RegExp(size));
  assert.equal(await target.getByRole('spinbutton').inputValue(), String(qty));
  await target.waitForFunction(expected => document.querySelector('.summary-total')?.textContent.includes(expected), total);
  return { line: await target.locator('.basket-line').innerText(), total: await target.locator('.summary-total').innerText() };
}
async function add(target, title, size, qty) {
  await target.getByRole('button', { name: 'The prints', exact: true }).click();
  await target.getByRole('button', { name: `View ${title}`, exact: true }).click();
  await target.getByRole('button', { name: new RegExp(`^${size}`) }).click();
  await target.getByRole('spinbutton').fill(String(qty));
  await target.getByRole('spinbutton').press('Tab');
  await target.getByRole('button', { name: 'Add to basket', exact: true }).click();
  await target.getByRole('button', { name: 'View basket', exact: false }).click();
}
async function stocks(target) {
  return target.evaluate(async () => { const data = await (await fetch('/api/prints')).json(); return Object.fromEntries(data.prints.flatMap(print => print.sizes.map(size => [`${print.sku}/${size.size}`, size.in_stock]))); });
}
async function main() {
  browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium' });
  results.chromium_version = browser.version();
  assert.match(results.chromium_version, /^152\./);
  const contextA = await browser.newContext({ viewport: { width: 1365, height: 1000 } });
  pageA = await contextA.newPage();
  for (const context of [contextA]) context.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/orders')) results.orders_submitted++; });
  pageA.on('pageerror', error => results.browser_errors.push(error.message));
  await pageA.goto(base);
  results.initial_stock = await stocks(pageA);
  await pageA.getByRole('button', { name: /Open basket/ }).click();
  assert.equal(await pageA.locator('.basket-line').count(), 0);
  await add(pageA, 'Night Ferry', 'A2', 2);
  results.a_before_reload = await inspect(pageA, 'Night Ferry', 'A2', 2, '132.20');
  await pageA.reload();
  results.a_after_reload = await inspect(pageA, 'Night Ferry', 'A2', 2, '132.20');
  assert.deepEqual(results.a_after_reload, results.a_before_reload);
  pass('A: two Night Ferry A2 and GBP 132.20 survive a full page reload');
  const contextB = await browser.newContext({ viewport: { width: 1365, height: 1000 } });
  results.b_storage_before_load = await contextB.storageState();
  assert.deepEqual(results.b_storage_before_load, { cookies: [], origins: [] });
  contextB.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/orders')) results.orders_submitted++; });
  pageB = await contextB.newPage();
  pageB.on('pageerror', error => results.browser_errors.push(error.message));
  await pageB.goto(base);
  await pageB.getByRole('button', { name: /Open basket/ }).click();
  assert.equal(await pageB.locator('.basket-line').count(), 0);
  assert.match(await pageB.locator('main').innerText(), /empty/i);
  pass('B: independent clean browser context starts with an empty basket');
  await add(pageB, 'Long Field', 'A3', 1);
  results.b_before_reload = await inspect(pageB, 'Long Field', 'A3', 1, '39.70');
  await pageA.reload();
  results.a_after_b_adds = await inspect(pageA, 'Night Ferry', 'A2', 2, '132.20');
  assert.deepEqual(results.a_after_b_adds, results.a_before_reload);
  await pageB.reload();
  results.b_after_reload = await inspect(pageB, 'Long Field', 'A3', 1, '39.70');
  assert.deepEqual(results.b_after_reload, results.b_before_reload);
  await pageA.screenshot({ path: path.join(evidence, 'context-a-night-ferry-after-reload.png'), fullPage: true });
  await pageB.screenshot({ path: path.join(evidence, 'context-b-long-field-after-reload.png'), fullPage: true });
  pass('Both contexts retain only their own exact variant, quantity and totals after subsequent reloads');
  await pageA.getByRole('button', { name: 'Remove Night Ferry A2', exact: true }).click();
  await pageA.locator('.basket-line').waitFor({ state: 'detached' });
  await pageB.getByRole('button', { name: 'Remove Long Field A3', exact: true }).click();
  await pageB.locator('.basket-line').waitFor({ state: 'detached' });
  results.final_stock = await stocks(pageA);
  assert.deepEqual(results.final_stock, results.initial_stock);
  assert.equal(results.orders_submitted, 0);
  assert.deepEqual(results.browser_errors, []);
  pass('Both baskets cleared; no order was placed and all 13 stocks remain unchanged');
  results.passed = true;
}
main().catch(async error => {
  results.passed = false;
  results.error = { message: error.message, stack: error.stack };
  if (pageA) { results.failure_body_a = await pageA.locator('body').innerText(); await pageA.screenshot({ path: path.join(evidence, 'failure-a.png'), fullPage: true }); }
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  results.finished_at = new Date().toISOString();
  fs.writeFileSync(path.join(__dirname, 'basket-context-browser-results.json'), JSON.stringify(results, null, 2));
  if (browser) await browser.close();
});

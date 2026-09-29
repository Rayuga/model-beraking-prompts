const path = require('path');
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core'));
const base = process.env.RIDGELINE_UI_URL || 'http://127.0.0.1:3310';
const evidence = path.join(__dirname, 'ui-evidence');
fs.mkdirSync(evidence, { recursive: true });
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1208/chrome-win64/chrome.exe') });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const failures = [];
  const externalRequests = [];
  const checkoutRequests = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('request', req => {
    if (!req.url().startsWith(base)) externalRequests.push(req.url());
    if (req.url() === `${base}/api/orders` && req.method() === 'POST') checkoutRequests.push(req.postDataJSON());
  });
  const results = [];
  async function check(name, fn) { await fn(); results.push({ name, result: 'pass' }); }
  try {
    await page.goto(base);
    await page.locator('.print-card').first().waitFor();
    await check('catalogue has eight illustrated editions and no page errors', async () => {
      assert.equal(await page.locator('.print-card').count(), 8);
      assert.equal(await page.locator('.print-card img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)), true);
      assert.deepEqual(failures, []);
    });
    await page.screenshot({ path: path.join(evidence, 'catalogue-desktop.png'), fullPage: true });
    await check('search and size/paper filters work', async () => {
      await page.getByRole('searchbox', { name: 'Search prints' }).fill('Harbour');
      assert.equal(await page.locator('.print-card').count(), 1);
      assert.match(await page.locator('.print-card').innerText(), /Harbour Mouth/);
      await page.getByRole('searchbox', { name: 'Search prints' }).fill('');
      await page.getByLabel('Size', { exact: true }).selectOption('A2');
      const count = await page.locator('.print-card').count();
      assert(count > 0 && count < 8);
      await page.getByLabel('Size', { exact: true }).selectOption('');
      const papers = await page.getByLabel('Paper', { exact: true }).locator('option').allTextContents();
      await page.getByLabel('Paper', { exact: true }).selectOption({ label: papers.find(value => /Munken/.test(value)) });
      assert.equal(await page.locator('.print-card').count(), 3);
      await page.getByLabel('Paper', { exact: true }).selectOption('');
      await page.getByLabel('Sort', { exact: true }).selectOption('price_desc');
      assert.match(await page.locator('.print-card').first().innerText(), /42.50/);
    });
    await check('theme persists through reload and mobile fits viewport', async () => {
      await page.getByRole('button', { name: 'Switch to dark theme' }).click();
      await page.reload();
      await page.locator('.print-card').first().waitFor();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      await page.screenshot({ path: path.join(evidence, 'catalogue-dark.png'), fullPage: true });
      await page.getByRole('button', { name: 'Switch to light theme' }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.screenshot({ path: path.join(evidence, 'catalogue-mobile.png'), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1100 });
    });
    await check('detail uses variant stock and basket rejects excessive quantity', async () => {
      await page.getByRole('button', { name: 'View Long Field', exact: true }).click();
      await page.getByRole('button', { name: /^A3/ }).click();
      const quantity = page.getByRole('spinbutton', { name: 'Quantity for Long Field A3 to add' });
      await quantity.fill('13'); await quantity.blur();
      await page.getByRole('button', { name: 'Add to basket', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Only 12' }).waitFor();
      assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('ridgeline_basket_v2')))).length, 0);
      await quantity.fill('2'); await quantity.blur();
      await page.getByRole('button', { name: 'Add to basket', exact: true }).click();
      await page.getByRole('button', { name: 'View basket', exact: false }).click();
      await page.getByRole('button', { name: 'Continue to checkout', exact: true }).waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.querySelector('.summary-total dd')?.textContent === '£79.10');
    });
    await check('trade threshold reverses and basket survives reload', async () => {
      await page.getByRole('button', { name: 'Increase Long Field A3', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.summary-total dd')?.textContent === '£105.65');
      assert.match(await page.locator('.basket-line-info').innerText(), /Trade price applied/);
      await page.getByRole('button', { name: 'Decrease Long Field A3', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.summary-total dd')?.textContent === '£79.10');
      await page.reload();
      await page.getByRole('spinbutton', { name: 'Quantity for Long Field A3', exact: true }).waitFor();
      assert.equal(await page.getByRole('spinbutton', { name: 'Quantity for Long Field A3', exact: true }).inputValue(), '2');
      await page.waitForFunction(() => document.querySelector('.summary-total dd')?.textContent === '£79.10');
      await page.screenshot({ path: path.join(evidence, 'basket-desktop.png'), fullPage: true });
    });
    let reference;
    await check('address/review/checkout records one order and clears basket', async () => {
      await page.getByRole('button', { name: 'Continue to checkout', exact: true }).click();
      await page.getByLabel('Full name', { exact: true }).fill('Morgan Reed');
      await page.getByLabel('Address line 1', { exact: true }).fill('18 Ink Lane');
      await page.getByLabel('Town or city', { exact: true }).fill('Bristol');
      await page.getByLabel('Postcode', { exact: true }).fill('BS1 4QA');
      await page.getByRole('button', { name: 'Review order', exact: true }).click();
      const responsePromise = page.waitForResponse(response => response.url() === `${base}/api/orders` && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Place order', exact: true }).click();
      const response = await responsePromise;
      assert.equal(response.status(), 201);
      const order = await response.json(); reference = order.reference;
      assert.equal(order.total_pence, 7910);
      await page.getByText(reference, { exact: true }).waitFor();
      assert(checkoutRequests[0].checkout_id);
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ridgeline_basket_v2'))), []);
      await page.reload();
      await page.getByText(reference, { exact: true }).waitFor();
      assert.match(await page.locator('.summary').innerText(), /£79.10/);
      await page.screenshot({ path: path.join(evidence, 'order-placed.png'), fullPage: true });
    });
    await check('cancellation confirmation keeps immutable receipt and restores stock', async () => {
      await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
      await page.getByRole('alertdialog').waitFor();
      await page.getByRole('button', { name: 'Keep order', exact: true }).click();
      assert.equal(await page.getByRole('alertdialog').count(), 0);
      await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
      await page.getByRole('heading', { name: 'Order cancelled.', exact: true }).waitFor();
      assert.match(await page.locator('.summary').innerText(), /£79.10/);
      assert.equal(await page.getByRole('button', { name: 'Cancel order', exact: true }).count(), 0);
      await page.reload();
      await page.getByRole('heading', { name: 'Order cancelled.', exact: true }).waitFor();
      await page.screenshot({ path: path.join(evidence, 'order-cancelled.png'), fullPage: true });
      const catalogue = await (await context.request.get(`${base}/api/prints`)).json();
      assert.equal(catalogue.prints.find(print => print.sku === 'RP-101').sizes.find(variant => variant.size === 'A3').in_stock, 12);
    });
    await check('seeded historical receipt retains prices and cannot be cancelled', async () => {
      await page.getByRole('button', { name: 'Track an order', exact: true }).click();
      await page.getByLabel('Order reference', { exact: true }).fill('RP-100001');
      await page.getByRole('button', { name: 'Find order', exact: true }).click();
      await page.getByText('RP-100001', { exact: true }).waitFor();
      assert.match(await page.locator('.summary').innerText(), /£73.20/);
      assert.match(await page.locator('.receipt-lines').innerText(), /£35.00/);
      assert.equal(await page.getByRole('button', { name: 'Cancel order', exact: true }).count(), 0);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.screenshot({ path: path.join(evidence, 'receipt-mobile.png'), fullPage: true });
    });
    await check('no browser runtime errors or external requests', async () => { assert.deepEqual(failures, []); assert.deepEqual(externalRequests, []); });
    fs.writeFileSync(path.join(evidence, 'browser-results.json'), JSON.stringify({ base, results, failures, externalRequests, checkoutRequests: checkoutRequests.length }, null, 2));
    process.stdout.write(JSON.stringify({ result: 'pass', checks: results.length, evidence }, null, 2));
  } catch (error) {
    await page.screenshot({ path: path.join(evidence, 'failure.png'), fullPage: true });
    fs.writeFileSync(path.join(evidence, 'browser-results.json'), JSON.stringify({ base, results, error: error.stack, failures, externalRequests }, null, 2));
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

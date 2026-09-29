const path = require('path');
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core'));
const base = process.env.RIDGELINE_UI_URL || 'http://127.0.0.1:3310';
const evidence = path.join(__dirname, 'ui-evidence');
const results = [];
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1208/chrome-win64/chrome.exe') });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function fits(name) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: path.join(evidence, name), fullPage: true });
  }
  async function stock(sku, size) { const { prints } = await (await context.request.get(`${base}/api/prints`)).json(); return prints.find(print => print.sku === sku).sizes.find(variant => variant.size === size).in_stock; }
  async function tabTo(predicate, label) {
    const visited = [];
    for (let i = 0; i < 90; i++) {
      await page.keyboard.press('Tab');
      const current = await page.evaluate(() => {
        const element = document.activeElement;
        const css = getComputedStyle(element);
        return { tag: element.tagName, name: element.getAttribute('name'), aria: element.getAttribute('aria-label'), text: element.textContent.trim(), outline: css.outlineStyle, outlineWidth: css.outlineWidth };
      });
      visited.push(current);
      if (predicate(current)) { assert.notEqual(current.outline, 'none', `${label} has visible focus`); return; }
    }
    throw new Error(`Tab sequence could not reach ${label}: ${JSON.stringify(visited.slice(-22))}`);
  }
  try {
    await page.goto(`${base}/print/RP-104`);
    await page.getByRole('button', { name: /^A2/ }).click();
    const before = await stock('RP-104', 'A2');
    assert.equal(before, 1, 'probe must consume the last available unit');
    await page.getByRole('button', { name: 'Add to basket', exact: true }).click();
    await page.getByRole('button', { name: 'View basket', exact: false }).click();
    await page.waitForFunction(() => document.querySelector('.summary-total dd')?.textContent === '£59.70');
    await fits('basket-mobile.png');
    await page.getByRole('button', { name: 'Continue to checkout', exact: true }).click();
    for (const [label, value] of [['Full name', 'Robin Stone'], ['Address line 1', '27 Paper Street'], ['Town or city', 'Leeds'], ['Postcode', 'LS1 1AA']]) await page.getByLabel(label, { exact: true }).fill(value);
    await fits('checkout-mobile.png');
    await page.getByRole('button', { name: 'Review order', exact: true }).click();
    await fits('checkout-review-mobile.png');
    let original;
    let originalBody;
    await page.route(`${base}/api/orders`, async route => {
      originalBody = route.request().postDataJSON();
      const response = await route.fetch();
      assert.equal(response.status(), 201);
      original = await response.json();
      await route.abort('failed');
    }, { times: 1 });
    await page.getByRole('button', { name: 'Place order', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'retrying will not place' }).waitFor();
    assert.equal(await stock('RP-104', 'A2'), 0);
    const savedIntent = await page.evaluate(() => JSON.parse(localStorage.getItem('ridgeline_checkout_v2')));
    assert.equal(savedIntent.id, originalBody.checkout_id);
    assert.deepEqual(savedIntent.body, originalBody);
    assert.equal(await page.getByLabel('Full name', { exact: true }).count(), 0, 'pending address cannot be edited');
    await page.getByRole('button', { name: /Open basket/ }).click();
    await page.getByRole('button', { name: 'Remove Slack Water A2', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Recover the saved order' }).waitFor();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ridgeline_basket_v2'))), [{ sku: 'RP-104', size: 'A2', qty: 1 }]);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ridgeline_checkout_v2')).body), originalBody);
    await page.getByRole('button', { name: 'Recover saved order →', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Recover saved order', exact: true }).waitFor();
    assert.match(await page.locator('address').innerText(), /Robin Stone/);
    await fits('checkout-recovery-last-unit-mobile.png');
    const retryResponse = page.waitForResponse(response => response.url() === `${base}/api/orders` && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Recover saved order', exact: true }).click();
    const response = await retryResponse;
    assert.equal(response.status(), 200);
    assert.equal(response.request().postDataJSON().checkout_id, originalBody.checkout_id);
    assert.deepEqual(response.request().postDataJSON(), originalBody);
    assert.equal((await response.json()).reference, original.reference);
    await page.getByText(original.reference, { exact: true }).waitFor();
    assert.equal(await stock('RP-104', 'A2'), 0);
    await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
    await page.getByRole('alertdialog').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('alertdialog').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Cancel order');
    await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
    await page.getByRole('heading', { name: 'Order cancelled.', exact: true }).waitFor();
    assert.equal(await stock('RP-104', 'A2'), before);
    results.push({ name: 'lost checkout response for LAST available unit survives reload and retry returns same order without second deduction', result: 'pass', reference: original.reference });
    results.push({ name: 'unresolved checkout locks cart/address and recovery replays exact original payload', result: 'pass' });
    results.push({ name: 'native cancellation dialog closes with Escape and returns focus to trigger', result: 'pass' });
    results.push({ name: '390px basket, checkout address and review pages fit viewport', result: 'pass' });
    await page.goto(base);
    await page.locator('.print-card').first().waitFor();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await tabTo(element => element.aria === 'View Kiln', 'Kiln print');
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Kiln', exact: true }).waitFor();
    await tabTo(element => element.tag === 'BUTTON' && element.text === 'Add to basket', 'Add to basket');
    await page.keyboard.press('Enter');
    await page.getByRole('status').filter({ hasText: 'added to your basket' }).waitFor();
    await tabTo(element => element.tag === 'BUTTON' && element.text.startsWith('View basket'), 'View basket');
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'The basket.', exact: true }).waitFor();
    await tabTo(element => element.tag === 'BUTTON' && element.text === 'Continue to checkout', 'Continue to checkout');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Review order', exact: true }).waitFor();
    await tabTo(element => element.tag === 'INPUT' && element.name === 'name', 'Full name');
    await page.keyboard.press('Control+A'); await page.keyboard.type('Keyboard Buyer');
    await page.keyboard.press('Tab'); await page.keyboard.press('Control+A'); await page.keyboard.type('42 Studio Road');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); await page.keyboard.press('Control+A'); await page.keyboard.type('York');
    await page.keyboard.press('Tab'); await page.keyboard.press('Control+A'); await page.keyboard.type('YO1 7AA');
    await tabTo(element => element.tag === 'BUTTON' && element.text === 'Review order', 'Review order');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Place order', exact: true }).waitFor();
    await tabTo(element => element.tag === 'BUTTON' && element.text === 'Place order', 'Place order');
    const keyboardResponse = page.waitForResponse(response => response.url() === `${base}/api/orders` && response.request().method() === 'POST');
    await page.keyboard.press('Enter');
    const keyboardOrder = await (await keyboardResponse).json();
    await page.getByText(keyboardOrder.reference, { exact: true }).waitFor();
    assert.equal(keyboardOrder.address_name, 'Keyboard Buyer');
    assert.equal(keyboardOrder.lines[0].sku, 'RP-105');
    await page.screenshot({ path: path.join(evidence, 'keyboard-purchase.png'), fullPage: true });
    results.push({ name: 'complete keyboard-only catalogue-to-receipt purchase with visible focus', result: 'pass', reference: keyboardOrder.reference });
    await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
    await page.getByRole('heading', { name: 'Order cancelled.', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(evidence, 'browser-resilience-results.json'), JSON.stringify({ results, errors }, null, 2));
    console.log(JSON.stringify({ result: 'pass', checks: results.length, evidence }, null, 2));
  } catch (error) {
    await page.screenshot({ path: path.join(evidence, 'resilience-failure.png'), fullPage: true });
    fs.writeFileSync(path.join(evidence, 'browser-resilience-results.json'), JSON.stringify({ results, error: error.stack, errors }, null, 2));
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

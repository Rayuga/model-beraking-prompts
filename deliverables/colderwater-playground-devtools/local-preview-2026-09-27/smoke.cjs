const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const report = { scope: 'Local golden preview smoke, no paid judging or saved-library writes', passed: false, pageErrors: [], checks: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    page.on('pageerror', e => report.pageErrors.push(e.message));
    await page.goto('http://localhost:3000');
    const editor = page.getByRole('textbox', { name: 'Code editor', exact: true });
    await editor.waitFor();
    await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent.startsWith('Complete'));
    const preview = page.frameLocator('iframe');
    await preview.locator('#out').getByText('12 squared is 144', { exact: false }).waitFor();
    assert.match(await page.locator('body').innerText(), /printed %d rows/);
    report.checks.push({ name: 'Initial editor, preview and console execute hello.js', passed: true });
    await page.screenshot({ path: '/evidence/golden-preview.png', fullPage: true });
    await page.getByLabel('Starter example', { exact: true }).selectOption('counter.html');
    await page.getByRole('button', { name: /^Run/ }).click();
    await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent.startsWith('Complete'));
    await preview.locator('#n').getByText('0', { exact: true }).waitFor();
    await preview.getByRole('button', { name: '+1', exact: true }).click();
    assert.equal(await preview.locator('#n').innerText(), '1');
    await preview.getByRole('button', { name: '-1', exact: true }).click();
    assert.equal(await preview.locator('#n').innerText(), '0');
    report.checks.push({ name: 'HTML counter interaction 0 to1 to0', passed: true });
    await editor.click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    assert.notEqual(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Code editor');
    report.checks.push({ name: 'Escape then Tab leaves editor', passed: true });
    assert.equal(report.pageErrors.length, 0);
    report.passed = true;
  } catch (e) {
    report.error = e.message;
    process.exitCode = 1;
  } finally {
    await browser.close();
    fs.writeFileSync('/evidence/smoke-results.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  }
})();

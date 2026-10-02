const fs = require('node:fs');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const { GoldenBrowser, ObservationLedger } = require('./workflow_core.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const driver = new GoldenBrowser(page, new ObservationLedger({ scope: 'Visible mobile preview capture, not a visual grade' }), 'http://localhost:3000');
    await driver.open();
    await driver.run("document.body.innerHTML='<h1>Mobile preview ready</h1><p>This output is visible after scrolling.</p>';console.log('mobile-output');", 'mobile-view.js');
    await page.locator('iframe').scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    const renderedText = await driver.body();
    await page.screenshot({ path: '/evidence/mobile-preview-visible.png' });
    fs.writeFileSync('/evidence/mobile-preview-visible.json', JSON.stringify({ scope: 'Actual mobile viewport after scrolling preview into view; no Likert grade', renderedText, viewport: page.viewportSize(), scrollY: await page.evaluate(() => scrollY) }, null, 2));
    console.log(renderedText);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

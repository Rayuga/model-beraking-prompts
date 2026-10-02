const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--unsafely-treat-insecure-origin-as-secure=http://172.17.0.8:3000'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('http://172.17.0.8:3000/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/cw-editor.png', fullPage: true });
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });

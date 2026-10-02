const fs = require('node:fs');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const output = '/evidence/row17-canvas-proof.json';
const report = {
  scope: 'Independent row 17 focused product proof; not a configured judge result',
  input_sha256: 'ae1d6f45959dbff89eb8963973dd7cfd29f634674f246410819317a7a3fc57a0',
  target: 'cw-stricter-golden-20261001 server/public deployment',
  deployment_limit: 'This target omits frozen local node_modules; no solve.sh installation claim',
  started_at: new Date().toISOString(),
  source: '<!doctype html><html><body><h1>Canvas recovery control</h1><canvas id="painting" width="180" height="100"></canvas><button id="paint">Paint red</button><p id="state">Not painted</p><script>document.getElementById("paint").addEventListener("click", () => { const c = document.getElementById("painting").getContext("2d"); c.fillStyle = "#e02424"; c.fillRect(0, 0, 180, 100); document.getElementById("state").textContent = "Painted red"; console.log("canvas-painted-control"); });</script></body></html>',
  failure_source: 'document.body.innerHTML = "<h1>Failed candidate</h1>";\nthrow new Error("canvas-recovery-test");'
};
let browser;
async function editor(page, code) {
  const editable = page.locator('.cm-content');
  await editable.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(code);
}
async function picture(page) {
  const frame = page.frames().find(x => x !== page.mainFrame());
  return {
    heading: await frame.locator('h1').innerText(),
    state: await frame.locator('#state').innerText(),
    center_rgba: await frame.locator('#painting').evaluate(c => [...c.getContext('2d').getImageData(90, 50, 1, 1).data]),
    canvas_png: await frame.locator('#painting').evaluate(c => c.toDataURL()),
    run_status: await page.getByRole('status').innerText()
  };
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto('http://localhost:3000');
  await page.getByRole('textbox', { name: 'Filename', exact: true }).fill('canvas-control.html');
  await editor(page, report.source);
  await page.getByRole('button', { name: /^Run / }).click();
  await page.getByRole('status').filter({ hasText: /^Complete/ }).waitFor();
  await page.frames().find(x => x !== page.mainFrame()).getByRole('button', { name: 'Paint red' }).click();
  await page.getByRole('status').filter({ hasText: /^Complete/ }).waitFor();
  report.before = await picture(page);
  await page.screenshot({ path: '/evidence/row17-canvas-before.png', fullPage: true });
  await page.getByRole('textbox', { name: 'Filename', exact: true }).fill('failure.js');
  await editor(page, report.failure_source);
  await page.getByRole('button', { name: /^Run / }).click();
  await page.getByRole('status').filter({ hasText: /Error/ }).waitFor();
  report.after = await picture(page);
  report.console = await page.getByRole('log').innerText();
  await page.screenshot({ path: '/evidence/row17-canvas-after.png', fullPage: true });
  report.canvas_preserved = JSON.stringify(report.before.center_rgba) === JSON.stringify(report.after.center_rgba);
  report.dom_text_preserved = report.before.state === report.after.state;
})().catch(error => { report.error = String(error); report.stack = error.stack; process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  report.finished_at = new Date().toISOString();
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ error: report.error, before: report.before, after: report.after, canvas_preserved: report.canvas_preserved, dom_text_preserved: report.dom_text_preserved }));
});

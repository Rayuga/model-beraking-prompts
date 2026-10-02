const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

const destination = process.env.CW_CANVAS_RESULT || '/evidence/canvas-regression.json';
const source = `<!doctype html><html><body>
<h1>Successful drawing</h1>
<canvas id="painting" width="180" height="100"></canvas>
<label>Keep this note <input id="note" value="initial"></label>
<button id="paint">Paint red</button><p id="state">Not painted</p>
<script>
document.getElementById('paint').addEventListener('click', () => {
  const context = document.getElementById('painting').getContext('2d');
  context.fillStyle = '#e02424'; context.fillRect(0, 0, 180, 100);
  document.getElementById('state').textContent = 'Painted red';
  console.log('painted-successfully');
});
</script></body></html>`;
const report = { scope: 'Local scripted canvas and form recovery regression, not a configured judge result', started_at: new Date().toISOString(), cases: [] };
let browser;

async function enter(page, code) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(code);
}
async function completed(page) {
  await page.getByRole('status').filter({ hasText: /^Complete/ }).waitFor();
}
async function frame(page) {
  const child = page.frames().find(item => item !== page.mainFrame());
  assert(child, 'Preview frame exists');
  return child;
}
async function inspect(page) {
  const child = await frame(page);
  await child.locator('#painting').waitFor();
  await child.waitForFunction(() => {
    const canvas = document.querySelector('#painting');
    return canvas && canvas.getContext('2d').getImageData(90, 50, 1, 1).data[3] === 255;
  }, null, { timeout: 2000 }).catch(() => {});
  return {
    pixel: await child.locator('#painting').evaluate(canvas => [...canvas.getContext('2d').getImageData(90, 50, 1, 1).data]),
    note: await child.locator('#note').inputValue(),
    caption: await child.locator('#state').innerText(),
  };
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  for (const ending of ['error', 'stop', 'timeout']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const observation = { ending };
    try {
      await page.goto('http://localhost:3000');
      await page.getByRole('textbox', { name: 'Filename', exact: true }).fill('canvas.html');
      await enter(page, source);
      await page.getByRole('button', { name: /^Run / }).click();
      await completed(page);
      await (await frame(page)).getByRole('button', { name: 'Paint red' }).click();
      await completed(page);
      await (await frame(page)).getByLabel('Keep this note').fill('actual-user-value-741');
      await completed(page);
      observation.before = await inspect(page);
      assert.deepEqual(observation.before.pixel, [224, 36, 36, 255], 'Successful canvas control');
      if (ending === 'stop') {
        await page.getByRole('button', { name: /^Stop/ }).click();
        await page.getByRole('status').filter({ hasText: /cancelled|stopped/i }).waitFor();
      } else {
        await page.getByRole('textbox', { name: 'Filename', exact: true }).fill('failure.js');
        await enter(page, ending === 'error'
          ? "document.body.innerHTML = '<p>Failed candidate</p>';\nthrow new Error('canvas-regression');"
          : "document.body.innerHTML = '<p>Unfinished candidate</p>';\nwhile (true) {}");
        await page.getByRole('button', { name: /^Run / }).click();
        await page.getByRole('status').filter({ hasText: /Error|time limit/i }).waitFor({ timeout: 12000 });
        if (ending === 'timeout') assert.match(await page.getByRole('log').innerText(), /time limit/i);
      }
      observation.after = await inspect(page);
      observation.passed = JSON.stringify(observation.before) === JSON.stringify(observation.after);
    } catch (error) { observation.error = String(error); observation.passed = false; }
    report.cases.push(observation);
    await context.close();
  }
  report.passed = report.cases.every(item => item.passed);
  if (!report.passed) process.exitCode = 1;
})().catch(error => { report.error = String(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  report.finished_at = new Date().toISOString();
  fs.writeFileSync(destination, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
});

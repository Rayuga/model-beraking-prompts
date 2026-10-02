const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

(async () => {
  const origin = process.env.CW_URL || 'http://172.17.0.10:3000/';
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', `--unsafely-treat-insecure-origin-as-secure=${origin.replace(/\/$/, '')}`] });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(origin, { waitUntil: 'networkidle' });
  const editor = page.getByRole('textbox', { name: 'Code editor' });
  const frame = () => page.frameLocator('.preview-host iframe');
  const write = async (code, filename = 'matrix.js') => {
    await page.getByRole('textbox', { name: 'Filename' }).fill(filename);
    await editor.click(); await page.keyboard.press('ControlOrMeta+A');
    await page.evaluate(text => navigator.clipboard.writeText(text), code);
    await page.keyboard.press('ControlOrMeta+V');
    await page.waitForFunction(expected => [...document.querySelectorAll('#editor .line .text')].map(el => el.textContent).join('\n') === expected, code);
  };
  const run = async (wait = 500) => { await page.getByRole('button', { name: /^Run/ }).click(); await page.waitForTimeout(wait); };
  const results = {};

  await write(`let total=0;document.body.innerHTML='<button id="add">Add</button><output id="sum">0</output>';document.getElementById('add').onclick=()=>{total+=6;document.getElementById('sum').textContent=total;console.log('total',total);};`);
  await run(); await frame().locator('#add').click(); await frame().locator('#add').click();
  assert.equal(await frame().locator('#sum').innerText(), '12');
  assert.match(await page.getByRole('log', { name: 'Console output' }).innerText(), /total.*6.*total.*12/s);
  results.cw_authored_custom_editor_run = true;

  const good = `document.body.innerHTML='<input id="name" value="old"><canvas id="c" width="2" height="2"></canvas><button id="blue">Blue</button>';const c=document.getElementById('c');const g=c.getContext('2d');g.fillStyle='red';g.fillRect(0,0,2,2);document.getElementById('blue').onclick=()=>{g.fillStyle='blue';g.fillRect(0,0,2,2);};`;
  await write(good); await run();
  await frame().locator('#name').fill('changed'); await frame().locator('#blue').click(); await page.waitForTimeout(150);
  const pixel = async () => frame().locator('#c').evaluate(c => Array.from(c.getContext('2d').getImageData(0,0,1,1).data));
  assert.deepEqual(await pixel(), [0,0,255,255]);
  await write('throw new Error("recovery-failure")'); await run();
  assert.equal(await frame().locator('#name').inputValue(), 'changed'); assert.deepEqual(await pixel(), [0,0,255,255]);
  results.cw_last_good_recovery = true;

  await write('while(true){}'); await run(5600);
  assert.match(await page.getByRole('log', { name: 'Console output' }).innerText(), /five-second time limit/i);
  assert.equal(await frame().locator('#name').inputValue(), 'changed');
  await write('document.body.textContent="RECOVERED"'); await run(); assert.equal(await frame().locator('body').innerText(), 'RECOVERED');
  await write('setTimeout(()=>{document.body.textContent="OLD-RUN"},900)'); await run(80);
  await write('document.body.textContent="NEW-RUN"'); await run(1200); assert.equal(await frame().locator('body').innerText(), 'NEW-RUN');
  await write('setTimeout(()=>{document.body.textContent="OLD-STOP"},900)'); await run(80);
  await page.getByRole('button', { name: 'Stop', exact: true }).click(); await page.waitForTimeout(1200);
  assert.notEqual(await frame().locator('body').innerText(), 'OLD-STOP');
  results.cw_timeout_stop_and_supersession = true;

  await write('document.body.textContent="BOUNDARY-GOOD";console.log("ordinary-ok")'); await run();
  const controls = [
    'try{parent.document.body.dataset.bad="1"}catch(e){throw new Error("parent blocked")}',
    'localStorage.setItem("cw-bad","1")',
    'fetch("https://example.com/cw-qc-network.invalid")',
    'eval("1+1")',
    'Function("return 2")()',
    'WebAssembly.compile(new Uint8Array())',
    'new Worker("worker.js")',
    'import("module.js")'
  ];
  for (const candidate of controls) {
    await write(candidate); await run(700);
    assert.equal(await frame().locator('body').innerText(), 'BOUNDARY-GOOD');
  }
  await write('document.body.textContent="eval Function Worker import WebAssembly"'); await run();
  assert.equal(await frame().locator('body').innerText(), 'eval Function Worker import WebAssembly');
  results.cw_preview_boundary = true;

  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ results, pageErrors }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });

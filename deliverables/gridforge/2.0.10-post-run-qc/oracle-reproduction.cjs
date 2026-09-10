// Unpaid diagnostic. It records outcomes; it never changes the task or official scores.
const fs = require('node:fs');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const context = await browser.newContext({viewport:{width:1280,height:800},permissions:['clipboard-read','clipboard-write']});
  const page = await context.newPage();
  const observations = [];
  try {
    await page.goto('http://localhost:3000');
    await page.locator('[data-addr="F3"]').waitFor();
    await page.locator('[data-addr="F3"]').click();
    await page.keyboard.type('DELETE-ME-F3');
    const focusBeforeEnter = await page.evaluate(() => document.activeElement.id);
    await page.keyboard.press('Enter');
    const afterEnter = await page.locator('.cell.selected').getAttribute('data-addr');
    observations.push({name:'F3 grid-started text commit Enter',focusBeforeEnter,expected:'F4',actual:afterEnter,passed:afterEnter==='F4'});
    await page.locator('[data-addr="G3"]').click();
    await page.keyboard.type('KEYBOARD-G3');
    await page.keyboard.press('Shift+Tab');
    const afterShiftTab = await page.locator('.cell.selected').getAttribute('data-addr');
    observations.push({name:'G3 grid-started text commit Shift+Tab',expected:'F3',actual:afterShiftTab,passed:afterShiftTab==='F3'});
    // Each drag uses real mouse events. Read-only DOM snapshots record the endpoints.
    await page.locator('#name-box').fill('J35');
    await page.locator('#name-box').press('Enter');
    await page.evaluate(() => navigator.clipboard.writeText('RANGE-A\tRANGE-B\tRANGE-C\nRANGE-D\tRANGE-E\tRANGE-F\nRANGE-G\tRANGE-H\tRANGE-I'));
    await page.keyboard.press('Control+V');
    await page.waitForTimeout(500);
    for (const steps of [1,12,40]) {
      await page.goto('http://localhost:3000');
      await page.locator('[data-addr="K36"]').waitFor();
      await page.locator('#name-box').fill('K36');
      await page.locator('#name-box').press('Enter');
      const gridBox = await page.locator('#grid').boundingBox();
      await page.mouse.move(gridBox.x+gridBox.width/2,gridBox.y+gridBox.height/2);
      await page.mouse.wheel(400,200);
      await page.waitForTimeout(200);
      const [start,end] = await page.evaluate(() => ['L37','J35'].map(a => {
        const r = document.querySelector('[data-addr="'+a+'"]').getBoundingClientRect();
        return {x:r.x,y:r.y,width:r.width,height:r.height};
      }));
      const hits = await page.evaluate(([a,b]) => [a,b].map(r => document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-addr]')?.dataset.addr),[start,end]);
      if (hits[0] !== 'L37' || hits[1] !== 'J35') {
        observations.push({name:'Reverse-drag diagnostic setup',steps,start,end,hits,probe_error:'Endpoints not visibly hit-testable; no app verdict'});
        continue;
      }
      await page.mouse.move(start.x+start.width/2,start.y+start.height/2);
      await page.mouse.down();
      await page.mouse.move(end.x+end.width/2,end.y+end.height/2,{steps});
      await page.mouse.up();
      const selected = await page.locator('.cell.in-range').evaluateAll(els => els.map(e=>e.dataset.addr));
      const expected = ['J35','K35','L35','J36','K36','L36','J37','K37','L37'];
      observations.push({name:'Reverse L37 to J35 center-to-center drag',steps,start,end,hits,selected,passed:JSON.stringify(selected)===JSON.stringify(expected)});
    }
    await page.screenshot({path:'/results/oracle-reproduction.png'});
  } finally {
    fs.writeFileSync('/results/oracle-reproduction.json',JSON.stringify({scope:'Fresh exact-source diagnostic in historical local tool image, not an Oracle regrade',observations},null,2));
    await browser.close();
  }
  console.log(JSON.stringify(observations));
})().catch(e=>{console.error(e);process.exitCode=1;});

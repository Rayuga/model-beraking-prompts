const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const page = await browser.newPage({viewport:{width:1280,height:800}});
  const errors = [], observations = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto('http://localhost:3000');
    await page.waitForFunction(() => document.querySelector('#doc-title')?.textContent === 'Northwind API Incident Report');
    const lines = () => page.locator('#editor .text').evaluateAll(es => es.map(e => e.dataset.lineText));
    const baseline = await lines();
    async function observe(index) {
      const row = page.locator(`#editor .line[data-line="${index}"]`);
      await row.scrollIntoViewIfNeeded();
      const label = row.locator('.gutter');
      assert(await label.isVisible(), 'Document line number must be visibly rendered');
      assert.equal((await label.innerText()).trim(), String(index + 1));
      assert.equal(await row.locator('.text').getAttribute('data-line-text'), baseline[index]);
      const boxes = await row.evaluate(e => {
        const n = e.querySelector('.gutter').getBoundingClientRect(), t = e.querySelector('.text').getBoundingClientRect();
        return {numberY:n.y,textY:t.y,numberHeight:n.height,textHeight:t.height};
      });
      assert(Math.abs(boxes.numberY - boxes.textY) < 2, 'Number is associated with the corresponding logical line');
      observations.push({line:index+1,label:await label.innerText(),text:baseline[index],...boxes});
    }
    async function point(index) {
      const row = page.locator(`#editor .line[data-line="${index}"] .text`);
      await row.scrollIntoViewIfNeeded();
      return row.evaluate(e => {const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x+parseFloat(s.paddingLeft)+1,y:r.y+r.height/2};});
    }
    const p = await point(0); await page.mouse.click(p.x,p.y); await page.keyboard.press('Home');
    assert.equal(await page.locator('#cursor-label').innerText(),'Ln 1, Col 1');
    await observe(0);
    for(let i=0;i<4;i++) await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#cursor-label').innerText(),'Ln 5, Col 1');
    await observe(4);
    await page.keyboard.press('End');
    assert.equal(await page.locator('#cursor-label').innerText(),'Ln 5, Col 9');
    for(const [key,label] of [
      ['ArrowDown','Ln 6, Col 9'],['Home','Ln 6, Col 1'],
      ['ArrowLeft','Ln 5, Col 9'],['ArrowRight','Ln 6, Col 1'],
      ['End',`Ln 6, Col ${baseline[5].length+1}`],['ArrowUp','Ln 5, Col 9'],
      ['ArrowDown',`Ln 6, Col ${baseline[5].length+1}`]
    ]) {await page.keyboard.press(key); assert.equal(await page.locator('#cursor-label').innerText(),label);}
    await observe(5);
    await page.screenshot({path:'/results/line-numbers-top.png'});
    const last = baseline.length - 1, tail = await point(last);
    await page.mouse.click(tail.x,tail.y);await page.keyboard.press('End');
    assert.equal(await page.locator('#cursor-label').innerText(),`Ln ${last+1}, Col ${baseline[last].length+1}`);
    await observe(last);
    assert.deepEqual(await lines(),baseline);
    await page.screenshot({path:'/results/line-numbers-tail.png'});
    const hidden = await page.addStyleTag({content:'#editor .gutter {display:none !important}'});
    assert(!(await page.locator(`#editor .line[data-line="${last}"] .gutter`).isVisible()));
    assert(await page.locator('#cursor-label').isVisible());
    await hidden.evaluate(e=>e.remove());
    assert.deepEqual(errors,[]);
    fs.writeFileSync('/results/line-number-check.json',JSON.stringify({passed:true,observations,full_navigation_sequence:true,document_unchanged:true,status_alone_does_not_supply_line_numbers:true,errors},null,2)+'\n');
    console.log('PASS visible line numbers, full existing navigation sequence, scrolling, unchanged document and status-only negative control');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

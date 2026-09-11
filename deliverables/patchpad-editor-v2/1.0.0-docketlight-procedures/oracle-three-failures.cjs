const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const ctx = await browser.newContext({viewport:{width:1280,height:800},permissions:['clipboard-read','clipboard-write']});
  const page = await ctx.newPage(), results = [], checkpoints = [];
  page.on('dialog', d => d.accept());
  const ready = () => page.waitForFunction(() => document.querySelector('#doc-title')?.textContent === 'Northwind API Incident Report');
  const fresh = async () => {await page.goto('http://localhost:3000'); await ready();};
  const lines = () => page.locator('#editor .text').evaluateAll(es => es.map(e => e.dataset.lineText));
  const checkpoint = async (name, extra={}) => {
    const record = {name, focus:await page.evaluate(() => document.activeElement.id), ...extra};
    checkpoints.push(record);
    fs.writeFileSync('/results/oracle-checkpoints.json', JSON.stringify(checkpoints, null, 2));
    return record;
  };
  const find = async q => {await page.locator('#find-box').fill(q); await page.locator('#find-next-btn').click(); assert.equal(await page.evaluate(() => document.activeElement.id),'editor');};
  const copy = async expected => {
    await page.evaluate(() => navigator.clipboard.writeText('UNTOUCHED-CLIPBOARD'));
    await page.keyboard.press('Control+c');
    await page.waitForFunction(async expected => await navigator.clipboard.readText() === expected, expected);
    return page.evaluate(() => navigator.clipboard.readText());
  };
  const point = async index => {
    const row = page.locator(`.line[data-line="${index}"] .text`);
    await row.scrollIntoViewIfNeeded();
    return row.evaluate(e => {const r=e.getBoundingClientRect(), s=getComputedStyle(e); return {x:r.x+parseFloat(s.paddingLeft)+0.2,y:r.y+r.height/2};});
  };
  const test = async (name, fn) => {try {await fresh(); const evidence=await fn();results.push({name,passed:true,evidence}); console.log('PASS '+name);} catch(e) {results.push({name,passed:false,error:e.stack});console.log('FAIL '+name+': '+e.message);}};
  await test('Tab Shift+Tab Undo Redo with separately persisted text checkpoints',async () => {
    const baseline=await lines(), pos=await point(4); await page.mouse.click(pos.x,pos.y);await page.keyboard.press('Home');
    assert.equal(await page.locator('#cursor-label').textContent(),'Ln 5, Col 1');
    await page.keyboard.press('Tab');const indented=await lines();await checkpoint('tab',{line:indented[4]});
    assert.match(indented[4],/^[\t ]+Timeline$/);assert.deepEqual(indented.filter((_,i)=>i!==4),baseline.filter((_,i)=>i!==4));
    await page.keyboard.press('Shift+Tab');await checkpoint('shift-tab',{line:(await lines())[4]});assert.deepEqual(await lines(),baseline);
    await page.keyboard.press('Control+z');await checkpoint('undo',{line:(await lines())[4]});assert.deepEqual(await lines(),indented);
    await page.keyboard.press('Control+y');await checkpoint('redo',{line:(await lines())[4]});assert.deepEqual(await lines(),baseline);
    await fresh();assert.deepEqual(await lines(),baseline);return {indented:indented[4],reversed:'Timeline'};
  });
  await test('Real glyph-start drag and keyboard selection through ALPHA-0060',async () => {
    const baseline=await lines();await find('ALPHA-0010');await page.keyboard.press('Home');const a=await point(32), r=await page.locator('#editor').boundingBox();
    const initial=await page.locator('#editor').evaluate(e=>e.scrollTop);
    const offscreen=await page.locator('.line[data-line="82"]').boundingBox();assert(offscreen.y>Math.min(r.y+r.height,800));
    await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(r.x+r.width-20,Math.min(r.y+r.height+12,798),{steps:15});
    await page.waitForFunction(()=>document.querySelector('.line[data-line="82"] .selection'),null,{timeout:20000});await page.mouse.up();
    await page.keyboard.press('Control+c');await page.waitForFunction(async()=> (await navigator.clipboard.readText()).includes('ALPHA-0060'));
    const selected=await page.evaluate(()=>navigator.clipboard.readText()), after=await page.locator('#editor').evaluate(e=>e.scrollTop);
    assert(selected.startsWith(baseline[32]));assert(selected.indexOf('ALPHA-0010')<selected.indexOf('ALPHA-0060'));assert(after>initial);
    await checkpoint('mouse-range',{start:a,initial,after,firstLine:selected.split('\n')[0],includesTarget:selected.includes('ALPHA-0060')});
    await find('ALPHA-0010');await page.keyboard.press('Home');const keyboardBefore=await page.locator('#editor').evaluate(e=>e.scrollTop);
    for(let i=0;i<50;i++)await page.keyboard.press('Shift+ArrowDown');await page.keyboard.press('Shift+End');
    const exact=baseline.slice(32,83).join('\n');await copy(exact);const caret=await page.locator('.caret').boundingBox(), ed=await page.locator('#editor').boundingBox();
    assert(caret.y>=ed.y&&caret.y+caret.height<=Math.min(ed.y+ed.height,800)+2);assert(await page.locator('#editor').evaluate(e=>e.scrollTop)>keyboardBefore);
    await checkpoint('keyboard-range',{lineCount:exact.split('\n').length,caretVisible:true});assert.deepEqual(await lines(),baseline);
    return {mouseScroll:after-initial,keyboardLines:51,exactText:true};
  });
  await test('External clipboard selects the tabbed second line before Cut',async () => {
    const baseline=await lines();await find('OMEGA-END-ANCHOR');await page.keyboard.press('End');await page.keyboard.press('Enter');
    const payload='EXTERNAL-A\nEXTERNAL-B\tCELL\nEXTERNAL-C';await page.evaluate(s=>navigator.clipboard.writeText(s),payload);await page.keyboard.press('Control+v');
    await page.waitForFunction(()=>[...document.querySelectorAll('#editor .text')].at(-1).dataset.lineText==='EXTERNAL-C');
    const pasted=await lines();assert.deepEqual(pasted.slice(-3),payload.split('\n'));await checkpoint('paste',{tail:pasted.slice(-3)});
    await page.keyboard.press('ArrowUp');await page.keyboard.press('Home');await page.keyboard.press('Shift+End');await copy('EXTERNAL-B\tCELL');await checkpoint('second-line-selected',{clipboard:await page.evaluate(()=>navigator.clipboard.readText())});
    await page.keyboard.press('Control+x');await page.waitForFunction(()=>[...document.querySelectorAll('#editor .text')].at(-2).dataset.lineText==='');
    const cut=await lines();assert.deepEqual(cut.slice(-3),['EXTERNAL-A','','EXTERNAL-C']);await checkpoint('cut',{tail:cut.slice(-3)});
    await page.keyboard.press('Control+z');assert.deepEqual(await lines(),pasted);await checkpoint('undo-cut',{tail:(await lines()).slice(-3)});
    await page.keyboard.press('Control+a');await copy(pasted.join('\n'));await checkpoint('whole-document-copy',{length:pasted.join('\n').length});
    await fresh();assert.deepEqual(await lines(),baseline);return {payloadPreserved:true,exactCut:true,undo:true,wholeCopy:true,reloadDiscard:true};
  });
  await fresh();await page.screenshot({path:'/results/golden-desktop-before.png'});
  await page.getByRole('button',{name:'Preview',exact:true}).first().click();await page.screenshot({path:'/results/golden-preview-before.png'});
  fs.writeFileSync('/results/oracle-three-results.json',JSON.stringify(results,null,2));await browser.close();
  if(results.some(r=>!r.passed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});

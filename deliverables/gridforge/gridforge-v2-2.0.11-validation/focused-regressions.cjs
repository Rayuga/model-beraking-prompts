// Real-browser checks against current golden source. No model or judge calls.
const assert=require('node:assert/strict'), fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 let context=await browser.newContext({viewport:{width:1280,height:800},permissions:['clipboard-read','clipboard-write']});
 let page=await context.newPage(); const results=[],errors=[];
 const watch=()=>page.on('pageerror',e=>errors.push(e.message)); watch();
 const read=route=>page.evaluate(async route=>(await fetch(route)).json(),route);
 const current=()=>read('/api/workbooks/ops-plan'), history=()=>read('/api/workbooks/ops-plan/revisions');
 const cell=a=>page.locator(`[data-addr="${a}"]`);
 const value=async(a,v)=>assert.equal(await cell(a).textContent(),String(v),a);
 const jump=async a=>{await page.locator('#name-box').fill(a);await page.locator('#name-box').press('Enter');};
 const edit=async(a,v,key='Enter')=>{await jump(a);await page.keyboard.type(v);await page.keyboard.press(key);};
 const save=async()=>{if(await page.locator('#save-btn').isEnabled())await page.locator('#save-btn').click();await page.waitForFunction(()=>document.querySelector('#save-state').textContent==='Saved');};
 const check=async(name,fn)=>{await fn();results.push({name,passed:true});console.log('PASS '+name);};
 try {
  await page.goto('http://localhost:3000');await cell('F3').waitFor();
  await check('grid-started Enter/Shift-Enter/Tab/Shift-Tab commits; F3 Delete/Undo with controls',async()=>{
   const outside=await cell('F2').textContent();
   await edit('F3','DELETE-ME-F3');assert.equal(await page.locator('.cell.selected').getAttribute('data-addr'),'F4');
   await edit('G3','KEYBOARD-G3','Shift+Tab');assert.equal(await page.locator('.cell.selected').getAttribute('data-addr'),'F3');
   await page.keyboard.press('Delete');await value('F3','');await value('G3','KEYBOARD-G3');await value('F2',outside);
   await page.keyboard.press('Control+Z');await value('F3','DELETE-ME-F3');await value('G3','KEYBOARD-G3');await value('F2',outside);
   await edit('F5','TAB-COMMIT','Tab');assert.equal(await page.locator('.cell.selected').getAttribute('data-addr'),'G5');
   await edit('G5','UP-COMMIT','Shift+Enter');assert.equal(await page.locator('.cell.selected').getAttribute('data-addr'),'G4');
   await jump('F5');await page.locator('#formula-bar').click();await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'apply-formula','Direct formula-bar Tab remains toolbar navigation');
  });
  await check('delayed save responses preserve name-box and direct formula-bar drafts',async()=>{
   for(const target of ['#name-box','#formula-bar']){
    await save();let seen;const observed=new Promise(resolve=>seen=resolve);
    await page.route('**/save',async route=>{
     const response=await route.fetch();seen();await new Promise(resolve=>setTimeout(resolve,1000));await route.fulfill({response});
    });
    await edit('S74',target==='\x23name-box'?'NAMEBOX-RENDER':'FORMULA-RENDER');
    await page.locator('#save-btn').click();await observed;
    const text=target==='#name-box'?'B2:D4':'TOOLBAR-DRAFT';await page.locator(target).fill(text);
    await page.waitForFunction(()=>document.querySelector('#save-state').textContent==='Saved');
    assert.equal(await page.locator(target).inputValue(),text);
    await page.unroute('**/save');
    if(target==='#name-box'){
     await page.keyboard.press('Enter');assert.equal(await page.locator('#selection-label').textContent(),'B2:D4');
    }else{
     await page.locator('#apply-formula').click();await value('S75','TOOLBAR-DRAFT');await save();
    }
   }
  });
  await check('autosave within full five seconds and unchanged saves add no revision',async()=>{
   await save();const before=await current(), list=await history();
   await edit('F30','AUTOSAVE-F30');const start=Date.now();
   await page.waitForFunction(()=>document.querySelector('#save-state').textContent==='Saved',null,{timeout:5000});
   const after=await current();assert.equal(after.revision,before.revision+1);assert.equal(after.workbook.sheets[0].cells.F30,'AUTOSAVE-F30');
   const revised=await history();assert.equal(revised.revisions.length,list.revisions.length+1);
   await save();await save();assert.deepEqual(await current(),after);assert.deepEqual(await history(),revised);
   results.push({name:'measured autosave latency',passed:true,milliseconds:Date.now()-start});
  });
  await check('Find cycle normalized from observed match; Replace Current/All atomic Undo/Redo',async()=>{
   for(const [a,v] of [['J50','FIND-QC-ONE'],['J51','FIND-QC-TWO'],['J52','FIND-QC-THREE']])await edit(a,v);
   await jump('A1');await page.locator('#find-text').fill('FIND-QC');
   const selected=()=>page.locator('.cell.selected').getAttribute('data-addr');
   const addresses=['J50','J51','J52'];let start=await selected();
   if(!addresses.includes(start)){await page.locator('#find-next-btn').click();start=await selected();}
   assert.ok(addresses.includes(start));const index=addresses.indexOf(start);
   for(let i=1;i<=3;i++){await page.locator('#find-next-btn').click();assert.equal(await selected(),addresses[(index+i)%3]);}
   for(let i=0;i<3&&await selected()!=='J50';i++)await page.locator('#find-next-btn').click();
   assert.equal(await selected(),'J50');await page.locator('#replace-text').fill('REPLACED-QC');await page.locator('#replace-one-btn').click();
   await value('J50','REPLACED-QC-ONE');await value('J51','FIND-QC-TWO');await value('J52','FIND-QC-THREE');
   await page.locator('#replace-all-btn').click();await value('J51','REPLACED-QC-TWO');await value('J52','REPLACED-QC-THREE');
   await page.locator('#undo-btn').click();await value('J50','REPLACED-QC-ONE');await value('J51','FIND-QC-TWO');await value('J52','FIND-QC-THREE');
   await page.locator('#redo-btn').click();await value('J50','REPLACED-QC-ONE');await value('J51','REPLACED-QC-TWO');await value('J52','REPLACED-QC-THREE');
  });
  await check('restore is unsaved draft; single Undo restores complete workbook and leaves history unchanged',async()=>{
   await edit('F33','RESTORE-BASE');await save();const base=await current();
   await edit('F33','RESTORE-CURRENT');await save();const before=await current(), list=await history();
   const card=page.locator('.rev').filter({has:page.locator('strong',{hasText:new RegExp('^Revision '+base.revision+'$')})});
   await card.getByRole('button',{name:/Restore/}).click();
   await page.waitForFunction(()=>document.querySelector('[data-addr="F33"]').textContent==='RESTORE-BASE');
   await value('F33','RESTORE-BASE');
   assert.equal(await page.locator('#save-state').textContent(),'Dirty');
   await page.waitForTimeout(5500);assert.deepEqual(await current(),before);assert.deepEqual(await history(),list);
   await page.locator('#undo-btn').click();await value('F33','RESTORE-CURRENT');
   const raws=await page.locator('.cell[data-addr]').evaluateAll(els=>Object.fromEntries(els.filter(e=>e.dataset.raw).map(e=>[e.dataset.addr,e.dataset.raw])));
   const expected=Object.fromEntries(Object.entries(before.workbook.sheets[0].cells).filter(([,v])=>v!==''));
   assert.deepEqual(raws,expected);assert.deepEqual(await current(),before);assert.deepEqual(await history(),list);
  });
  await check('two real process restarts preserve complete workbook, history, seed count and formulas',async()=>{
   await edit('Q70','RESTART-Q70');await edit('R70','=7*8');await save();await value('R70',56);
   const before=await current(), list=await history(), workbooks=await read('/api/workbooks');
   for(let i=0;i<2;i++){
    await context.close();execFileSync('bash',['/tests/restart-app.sh'],{stdio:'inherit',timeout:45000});
    context=await browser.newContext({viewport:{width:1280,height:800}});page=await context.newPage();watch();
    await page.goto('http://localhost:3000');await cell('R70').waitFor();await value('Q70','RESTART-Q70');await value('R70',56);
    assert.deepEqual(await current(),before);assert.deepEqual(await history(),list);assert.deepEqual(await read('/api/workbooks'),workbooks);
    assert.equal(workbooks.workbooks.length,1);
   }
  });
  assert.deepEqual(errors,[]);
 } finally {fs.writeFileSync('/results/focused-regression.json',JSON.stringify({scope:'Unpaid current golden checks, not Oracle score',results,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

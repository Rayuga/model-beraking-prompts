const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage(),results=[];
 const lines=()=>page.locator('.line .text').evaluateAll(es=>es.map(e=>e.dataset.lineText));
 const ready=()=>page.waitForFunction(()=>document.querySelector('#doc-title')?.textContent==='Northwind API Incident Report');
 const find=async q=>{await page.getByRole('textbox',{name:'Find text',exact:true}).fill(q);await page.getByRole('button',{name:'Find Next',exact:true}).click();};
 const copy=async expected=>{await page.keyboard.press('Control+c');await page.waitForFunction(async v=>await navigator.clipboard.readText()===v,expected,{timeout:5000});};
 const check=async(name,fn)=>{await page.goto('http://localhost:3000');await ready();try{await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}console.log(results.at(-1));};
 try{
 await check('document_end_home_and_shift_selection',async()=>{
   const baseline=await lines();await page.getByRole('textbox',{name:'PatchPad custom editor',exact:true}).focus();
   await page.keyboard.press('Control+End');assert.equal(await page.locator('#cursor-label').textContent(),`Ln ${baseline.length}, Col ${baseline.at(-1).length+1}`);
   await page.keyboard.press('Control+Shift+Home');await copy(baseline.join('\n'));
   await page.keyboard.press('Control+Home');assert.equal(await page.locator('#cursor-label').textContent(),'Ln 1, Col 1');
   await page.keyboard.press('Control+Shift+End');await copy(baseline.join('\n'));assert.deepEqual(await lines(),baseline);
 });
 await check('scoped_preview_and_restore_undo',async()=>{
   const baseline=await lines();await find('Timeline');await page.keyboard.type('PREVIEW-CURRENT-MARKER');
   const draft=await lines();const rev=page.locator('.revision').filter({has:page.locator('strong',{hasText:/^Revision 1$/})});
   await rev.getByRole('button',{name:'Preview',exact:true}).click();
   const preview=page.locator('#revision-preview-1');await preview.waitFor({state:'visible'});
   assert.equal(await preview.textContent(),baseline.join('\n'));assert(!((await preview.textContent()).includes('PREVIEW-CURRENT-MARKER')));
   assert((await page.locator('body').textContent()).includes('PREVIEW-CURRENT-MARKER'));
   await rev.getByRole('button',{name:'Restore Draft',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('restored as unsaved'));
   assert.deepEqual(await lines(),baseline);await page.keyboard.press('Control+z');assert.deepEqual(await lines(),draft);
 });
 await check('cut_keeps_empty_logical_line_and_next_search_is_fresh',async()=>{
   await find('OMEGA-END-ANCHOR');await page.keyboard.press('End');await page.keyboard.press('Enter');
   await page.evaluate(()=>navigator.clipboard.writeText('PASTE-A\nPASTE-B\nPASTE-C'));await page.keyboard.press('Control+v');
   await page.waitForFunction(()=>document.querySelector('.line:last-child .text').dataset.lineText==='PASTE-C');
   await find('PASTE-B');await copy('PASTE-B');await page.keyboard.press('Control+x');
   await page.waitForFunction(()=>[...document.querySelectorAll('.line .text')].at(-2).dataset.lineText==='');
   assert.deepEqual((await lines()).slice(-3),['PASTE-A','','PASTE-C']);await page.keyboard.press('Control+z');assert.deepEqual((await lines()).slice(-3),['PASTE-A','PASTE-B','PASTE-C']);
   await page.reload();await ready();await find('NEXT');await copy('NEXT');assert.equal(await page.locator('#cursor-label').textContent(),'Ln 18, Col 5');
 });
 fs.writeFileSync('/results/targeted-'+(process.env.PHASE||'after')+'.json',JSON.stringify({results},null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

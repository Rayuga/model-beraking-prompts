const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:1280,height:800},permissions:['clipboard-read','clipboard-write']});
 const page=await ctx.newPage(),passed=[],observations={};
 const version=JSON.parse(fs.readFileSync('/solution/app/package.json','utf8')).version;
 const ready=()=>page.waitForFunction(()=>document.querySelector('#doc-title').textContent==='Northwind API Incident Report');
 const lines=()=>page.locator('#editor .text').evaluateAll(es=>es.map(e=>e.dataset.lineText));
 const focus=()=>page.locator('#editor').evaluate(e=>e===document.activeElement);
 const clip=t=>page.evaluate(t=>navigator.clipboard.writeText(t),t);
 const copied=async t=>{await page.keyboard.press('Control+c');await page.waitForFunction(async t=>await navigator.clipboard.readText()===t,t);};
 const reset=async()=>{await page.reload();await ready();};
 const find=async(q,click=false)=>{
   await page.locator('#find-box').fill(q);
   if(click)await page.locator('#find-next-btn').click();
   else {await page.keyboard.press('Enter');assert(!(await focus()));await page.keyboard.press('Escape');}
   assert(await focus());await copied(q);
 };
 const pass=n=>{passed.push(n);console.log('PASS '+n);};
 try{
   await page.goto('http://localhost:3000');await ready();
   const baseline=await lines();await find('Incident:',true);await page.keyboard.press('End');await page.keyboard.type(' UNSAVED-SHOULD-DISAPPEAR');
   assert((await page.locator('#save-state').innerText()).startsWith('Dirty'));assert(await page.locator('#save-btn').isEnabled());
   assert.equal(await page.locator('#save-state').getAttribute('role'),'status');
   await reset();assert.deepEqual(await lines(),baseline);pass('Dirty status is observed before unsaved reload, exact saved content returns');
   for(const clicked of [false,true]){
     await find('OMEGA-END-ANCHOR',true);await page.keyboard.press('End');await page.keyboard.press('Enter');
     const samples='UNICODE-BACKSPACE:A🙂B\nUNICODE-DELETE:AéB\nUNICODE-NAV:A🙂éB';await clip(samples);await page.keyboard.press('Control+v');await page.waitForFunction(()=>[...document.querySelectorAll('#editor .text')].at(-1).dataset.lineText==='UNICODE-NAV:A🙂éB');
     await find('🙂',clicked);await page.keyboard.press('ArrowRight');await page.keyboard.press('Backspace');assert.equal((await lines()).at(-3),'UNICODE-BACKSPACE:AB');await page.keyboard.press('Control+z');assert.equal((await lines()).at(-3),'UNICODE-BACKSPACE:A🙂B');
     await find('é',clicked);await page.keyboard.press('ArrowLeft');await page.keyboard.press('Delete');assert.equal((await lines()).at(-2),'UNICODE-DELETE:AB');await page.keyboard.press('Control+z');assert.equal((await lines()).at(-2),'UNICODE-DELETE:AéB');
     await find('é',clicked); // Establish the previous short-query selection.
     assert((await page.locator('#editor .selection').count())>0);
     await page.locator('#find-box').fill('A🙂éB');
     assert.equal(await page.locator('#editor .selection').count(),0);
     assert((await page.locator('#focus-state').innerText()).includes('Press Enter or Find Next'));
     await find('A🙂éB',clicked);await page.keyboard.press('ArrowLeft');for(const glyph of ['A','🙂','é']){await page.keyboard.press('Shift+ArrowRight');await copied(glyph);await page.keyboard.press('ArrowRight');}
     pass('Unicode deletion and navigation with '+(clicked?'clicked Find Next (already editor-focused)':'Find Enter then one Escape'));
     await reset();
   }
   // Preserve the documented toggle: an unnecessary Escape from an already
   // focused editor returns to Find. This is not a failed Find-to-editor exit.
   await find('NEXT',true);await page.keyboard.press('Escape');assert(await page.locator('#find-box').evaluate(e=>e===document.activeElement));await page.keyboard.press('Escape');assert(await focus());await copied('NEXT');
   assert(await page.locator('#focus-state').isVisible());assert((await page.locator('#focus-state').innerText()).startsWith('Editing area focused.'));
   pass('Find/editor Escape direction depends on actual focus and preserves selection');
   await reset();await find('OMEGA-END-ANCHOR',true);await page.keyboard.press('End');await page.keyboard.type(' REDO-CLEAR-ORIGINAL');await page.keyboard.press('Control+z');await page.keyboard.type(' REDO-CLEAR-NEW');
   const after=await lines();observations.redoDisabledAfterNewEdit=await page.locator('#redo-btn').isDisabled();
   if(!observations.redoDisabledAfterNewEdit)await page.locator('#redo-btn').click();
   await page.keyboard.press('Control+y');assert.deepEqual(await lines(),after);assert(!after.join('\n').includes('REDO-CLEAR-ORIGINAL'));
   assert(observations.redoDisabledAfterNewEdit);
   pass('New edit invalidates Redo; button/shortcut cannot resurrect old marker');
   await reset();await page.locator('#find-box').fill('NEXT');for(let i=0;i<4;i++){await page.locator('#find-next-btn').click();await copied('NEXT');}
   assert((await page.locator('#cursor-label').innerText()).includes('Ln 18,'));await page.locator('#replace-box').fill('FOLLOWUP');await page.locator('#replace-current-btn').click();assert.equal((await lines())[17],'FOLLOWUP: Replace temporary dashboard link before publishing.');
   await page.locator('#find-box').fill('ALPHA-00');await page.locator('#replace-box').fill('INCIDENT-MARKER-00');assert((await page.locator('#save-state').innerText()).includes('99 matches'));await page.locator('#replace-all-btn').click();
   const text=(await lines()).join('\n');assert.equal(text.split('INCIDENT-MARKER-00').length-1,99);assert(text.includes('ALPHA-0100')&&text.includes('ALPHA-1200'));assert.equal(text.split('OMEGA-END-ANCHOR').length-1,1);
   pass('Replace Current and exact 99-item Replace All with live field readback');
   await reset();await page.screenshot({path:'/preview/patchpad-localhost.png'});
 }finally{
   fs.writeFileSync('/preview/current-failures-'+version+'.json',JSON.stringify({version,passed,observations,scope:'Exact real-input diagnostics; no paid judge/action trajectory available'},null,2)+'\n');await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});

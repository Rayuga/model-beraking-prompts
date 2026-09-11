const fs=require('node:fs'), assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:1280,height:800}});
 const page=await context.newPage(),results=[];
 const lines=()=>page.locator('.line .text').evaluateAll(es=>es.map(e=>e.dataset.lineText));
 const ready=()=>page.waitForFunction(()=>document.querySelector('#doc-title')?.textContent==='Northwind API Incident Report');
 const find=async q=>{await page.locator('#find-box').fill(q);await page.locator('#find-box').press('Enter');await page.locator('#find-box').press('Escape');};
 const append=async s=>{await find('OMEGA-END-ANCHOR');await page.keyboard.press('End');await page.keyboard.press('Enter');await page.evaluate(s=>navigator.clipboard.writeText(s),s);await page.keyboard.press('Control+v');await page.waitForFunction(s=>document.querySelector('.line:last-child .text').dataset.lineText===s,s);};
 const check=async(name,fn)=>{await page.goto('http://localhost:3000');await ready();try{await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}console.log(JSON.stringify(results.at(-1)));};
 try{
 await check('keyboard_find_escape_unicode_delete_and_undo',async()=>{
   const sample='UNICODE:A\u{1f642}e\u0301B';await append(sample);
   await find('\u{1f642}');await page.keyboard.press('ArrowRight');await page.keyboard.press('Backspace');assert.equal((await lines()).at(-1),'UNICODE:Ae\u0301B');
   await page.keyboard.press('Control+z');assert.equal((await lines()).at(-1),sample);
   await find('e\u0301');await page.keyboard.press('ArrowLeft');await page.keyboard.press('Delete');assert.equal((await lines()).at(-1),'UNICODE:A\u{1f642}B');
   await page.keyboard.press('Control+z');assert.equal((await lines()).at(-1),sample);
 });
 await check('mouse_after_combined_grapheme_backspace',async()=>{
   await append('Ae\u0301B');
   const row=page.locator('.line:last-child .text');await row.scrollIntoViewIfNeeded();
   // Measure an actual rendered DOM text boundary. Read-only Range geometry;
   // do not set DOM/model selection or call application functions.
   const point=await row.evaluate(el=>{const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n=w.nextNode();const r=document.createRange();r.setStart(n,3);r.setEnd(n,3);const b=r.getBoundingClientRect();return{x:b.x+.2,y:b.y+b.height/2};});
   await page.mouse.click(point.x,point.y);await page.keyboard.press('Backspace');
   assert.equal((await lines()).at(-1),'AB');
 });
 await check('empty_system_clipboard_does_not_paste_previous_copy',async()=>{
   await find('Timeline');await page.keyboard.press('Control+c');
   await page.waitForFunction(async()=>await navigator.clipboard.readText()==='Timeline');
   await page.evaluate(()=>navigator.clipboard.writeText(''));
   await page.keyboard.press('ArrowRight');const before=await lines();
   await page.keyboard.press('Control+v');await page.waitForTimeout(500);
   assert.deepEqual(await lines(),before);
 });
 for(const [name,grapheme] of [['emoji','\u{1f642}'],['joined_emoji','\u{1f469}\u200d\u{1f4bb}'],['flag','\u{1f1ee}\u{1f1f3}']]){
  await check('mouse_'+name+'_delete_undo_and_shift_selection',async()=>{
   const sample='A'+grapheme+'B';await append(sample);
   const row=page.locator('.line:last-child .text');await row.scrollIntoViewIfNeeded();
   const point=await row.evaluate((el,offset)=>{const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n=walker.nextNode();while(n&&offset>n.length){offset-=n.length;n=walker.nextNode();}const r=document.createRange();r.setStart(n,offset);r.collapse(true);const b=r.getBoundingClientRect();return{x:b.x+.2,y:b.y+b.height/2};},1+grapheme.length);
   await page.mouse.click(point.x,point.y);await page.keyboard.press('Backspace');assert.equal((await lines()).at(-1),'AB');
   await page.keyboard.press('Control+z');assert.equal((await lines()).at(-1),sample);
   await page.keyboard.press('Shift+ArrowLeft');await page.keyboard.press('Control+c');
   await page.waitForFunction(async g=>await navigator.clipboard.readText()===g,grapheme);
   await page.keyboard.press('Delete');assert.equal((await lines()).at(-1),'AB');
  });
 }
 fs.writeFileSync('/results/browser-variants.json',JSON.stringify({scope:'Local real-browser variants; no model grade',results},null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

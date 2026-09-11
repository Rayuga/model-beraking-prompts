// Actual unchanged Gemini export: persisted offscreen content is not missing.
const assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const ctx=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
 const result={scope:'Unchanged Gemini, exact persistence and virtualized-tail observation, no LLM grade',restarts:[],passed:false};
 let page=await ctx.newPage();
 const open=async()=>{await page.goto('http://localhost:3000');await page.waitForSelector('.editor-line');};
 const snapshot=async()=>page.evaluate(async()=>{
   const docs=await (await fetch('/api/documents')).json();
   const doc=await (await fetch('/api/documents/'+docs[0].id)).json();
   const history=await (await fetch('/api/documents/'+doc.id+'/revisions')).json();
   const versions=await Promise.all(history.map(r=>fetch('/api/documents/'+doc.id+'/revisions/'+r.revision_number).then(r=>r.json())));
   return {docs,doc,history,versions};
 });
 const find=async q=>{await page.locator('#find-input').fill(q);await page.keyboard.press('Enter');await page.keyboard.press('Escape');await page.keyboard.press('Control+c');await page.waitForFunction(async q=>await navigator.clipboard.readText()===q,q);};
 try{
  await open();const before=await snapshot();assert.equal(before.docs.length,1);assert(!before.doc.content.includes('PATCHPAD-RESTART-PROOF'));
  await find('OMEGA-END-ANCHOR');await page.keyboard.press('End');await page.keyboard.press('Enter');await page.keyboard.type('PATCHPAD-RESTART-PROOF');
  const saved=page.waitForResponse(r=>r.url().endsWith('/save')&&r.request().method()==='POST');await page.locator('#btn-save').click();assert((await saved).ok());
  await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved');
  const baseline=await snapshot();assert.equal(baseline.doc.current_revision,before.doc.current_revision+1);assert.equal(baseline.history.length,before.history.length+1);
  assert.equal(baseline.doc.content.split('PATCHPAD-RESTART-PROOF').length-1,1);
  for(let i=0;i<2;i++){
   execFileSync('bash',['/tests/app-lifecycle.sh','restart'],{stdio:'pipe'});
   await page.close();page=await ctx.newPage();await open();assert.deepEqual(await snapshot(),baseline);
   const initial=await page.locator('.editor-line').filter({hasText:'PATCHPAD-RESTART-PROOF'}).count();
   const mounted=await page.locator('.editor-line').count();
   await find('PATCHPAD-RESTART-PROOF');await page.locator('.editor-line').filter({hasText:'PATCHPAD-RESTART-PROOF'}).waitFor({state:'visible'});
   result.restarts.push({initial_marker_rows:initial,initial_mounted_rows:mounted,logical_lines:baseline.doc.content.split('\n').length,marker_visible_after_find:true,exact_copied_marker:'PATCHPAD-RESTART-PROOF',identical_content_metadata_history:true});
  }
  assert(result.restarts.every(x=>x.initial_marker_rows===0&&x.initial_mounted_rows<x.logical_lines));result.passed=true;
 }finally{fs.writeFileSync('/results/virtual-restart.json',JSON.stringify(result,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

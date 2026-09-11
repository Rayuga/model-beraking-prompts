const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:800}}), errors=[], results=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000');
  await page.waitForFunction(()=>document.querySelector('#doc-title')?.textContent==='Northwind API Incident Report');
  const dimensions=()=>page.evaluate(()=>{
    const r=document.querySelector('#editor').getBoundingClientRect();
    return {pageWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,viewportWidth:innerWidth,viewportHeight:innerHeight,editorTop:r.top,editorBottom:r.bottom,editorHeight:r.height,titleSize:getComputedStyle(document.querySelector('#doc-title')).fontSize};
  });
  let geometry=await dimensions();
  assert(geometry.pageWidth<=1280&&geometry.pageHeight<=800);
  assert(geometry.editorBottom<=800&&geometry.editorHeight>350);
  assert.equal(await page.locator('h1#doc-title').count(),1);
  assert.equal(await page.locator('.line[data-line="4"].section-heading').count(),1);
  assert.equal(await page.locator('.line[data-line="11"].section-heading').count(),1);
  await page.screenshot({path:'/results/golden-desktop-after.png'});
  results.push({name:'Desktop title, section hierarchy and contained viewport',passed:true,geometry});
  await page.locator('#find-box').fill('OMEGA-END-ANCHOR');await page.locator('#find-next-btn').click();await page.keyboard.press('End');
  for(let i=1;i<=6;i++){
    await page.keyboard.type(' HISTORY-VIEW-'+i);
    const response=page.waitForResponse(r=>r.url().endsWith('/save')&&r.request().method()==='POST');
    await page.locator('#save-btn').click();assert.equal((await response).status(),200);
    await page.waitForFunction(()=>document.querySelector('#save-state').textContent.startsWith('Saved'));
    await page.locator('#find-box').fill('OMEGA-END-ANCHOR');await page.locator('#find-next-btn').click();await page.keyboard.press('End');
  }
  await page.reload();await page.waitForSelector('#revision-list .revision');
  const saved=await page.evaluate(async()=> (await(await fetch('/api/documents/incident-alpha')).json()).document);
  const card=page.locator('#revision-list .revision').filter({has:page.locator('strong',{hasText:/^Revision 1$/})});
  await card.getByRole('button',{name:'Preview',exact:true}).click();
  const preview=page.locator('#revision-preview-1');await preview.waitFor({state:'visible'});await preview.scrollIntoViewIfNeeded();
  const pre=await preview.evaluate(e=>({height:e.clientHeight,scrollHeight:e.scrollHeight,fontSize:getComputedStyle(e).fontSize,content:e.textContent}));
  assert(pre.height>=300);assert.equal(pre.fontSize,'13px');assert(pre.content.endsWith('OMEGA-END-ANCHOR.'));assert(!pre.content.includes('HISTORY-VIEW-'));
  const after=await page.evaluate(async()=> (await(await fetch('/api/documents/incident-alpha')).json()).document);
  assert.deepEqual(after,saved);
  assert((await dimensions()).pageHeight<=800);
  await page.screenshot({path:'/results/golden-history-after.png'});
  await preview.hover();await page.mouse.wheel(0,200000);await page.waitForTimeout(250);
  assert(await preview.evaluate(e=>e.scrollTop>0));
  assert(await page.locator('aside').evaluate(e=>e.scrollHeight>e.clientHeight));
  results.push({name:'Seven-revision history, large readable preview, independent scrolling and unchanged saved content',passed:true,previewHeight:pre.height,previewFontSize:pre.fontSize,revision:after.current_revision});
  assert.deepEqual(errors,[]);
  fs.writeFileSync('/results/desktop-review.json',JSON.stringify({results,errors},null,2));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

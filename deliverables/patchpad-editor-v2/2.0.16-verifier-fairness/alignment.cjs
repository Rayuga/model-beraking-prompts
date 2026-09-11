// Golden-specific regression; not a replacement for the shipped verifier.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const passed=[];
  try {
    const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
    const page=await context.newPage();
    const seed=JSON.parse(fs.readFileSync('/tests/incident_seed.json','utf8')).document;
    const listingResponse=page.waitForResponse(r=>r.url().endsWith('/api/documents') && r.request().method()==='GET');
    await page.goto('http://localhost:3000/');
    const response=await listingResponse;
    assert.equal(response.status(),200);
    const listing=(await response.json()).documents;
    assert.equal(listing.length,1);
    for(const key of ['id','title','author'])assert.equal(listing[0][key],seed[key]);
    passed.push('Bootstrap report list contains exactly the seeded id, title and author');
    await page.waitForFunction(()=>document.querySelector('#doc-title')?.textContent==='Northwind API Incident Report');
    assert.equal(await page.locator('#doc-title').isVisible(),true);
    assert.equal(await page.locator('#doc-title').textContent(),seed.title);
    passed.push('Exact supplied report title is visibly rendered');
    const doc=()=>page.evaluate(async()=> (await (await fetch('/api/documents/incident-alpha')).json()).document);
    const before=await doc();
    await page.locator('#editor').click();
    await page.keyboard.press('Control+f');
    assert(await page.locator('#find-box').evaluate(e=>e===document.activeElement));
    await page.keyboard.type('NEXT');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    assert(await page.locator('#editor').evaluate(e=>e===document.activeElement));
    await page.keyboard.press('Control+c');
    await page.waitForFunction(async()=>await navigator.clipboard.readText()==='NEXT');
    const coordinate=await page.locator('#cursor-label').textContent();
    passed.push('Escape from Find returns editor focus with selected NEXT available to Copy');
    await page.keyboard.press('Escape');
    assert(await page.locator('#find-box').evaluate(e=>e===document.activeElement));
    await page.keyboard.press('Escape');
    assert(await page.locator('#editor').evaluate(e=>e===document.activeElement));
    assert.equal(await page.locator('#cursor-label').textContent(),coordinate);
    await page.keyboard.press('Control+c');
    await page.waitForFunction(async()=>await navigator.clipboard.readText()==='NEXT');
    assert.deepEqual(await doc(),before);
    passed.push('Editor-to-Find and Find-to-editor Escape preserve selection and stored document');
    fs.writeFileSync('/results/alignment.json',JSON.stringify({passed,scope:'Focused golden checks for explicit brief requirements; no paid model'},null,2)+'\n');
    console.log(JSON.stringify({passed}));
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});

// Local DOM-observability fixtures. Not a replacement for the browser judge.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const observations=[];
 const read=async p=>p.locator('#editor').evaluate(e=>({tag:e.tagName.toLowerCase(),contentEditable:e.isContentEditable===true,prohibited:['textarea','input'].includes(e.tagName.toLowerCase()) || e.isContentEditable===true}));
 try{
  const p=await b.newPage();await p.goto('http://localhost:3000/');
  await p.waitForFunction(()=>document.querySelector('#doc-title')?.textContent==='Northwind API Incident Report');
  const golden=await read(p);assert.equal(golden.prohibited,false);
  const before=await p.evaluate(async()=> (await (await fetch('/api/documents/incident-alpha')).json()).document);
  assert(await p.locator('#find-box').isVisible());assert.equal(await p.locator('#find-box').evaluate(e=>e.tagName),'INPUT');
  assert.deepEqual(await p.evaluate(async()=> (await (await fetch('/api/documents/incident-alpha')).json()).document),before);
  observations.push({name:'Golden custom surface with ordinary Find input',...golden,passed:true});
  // These synthetic fixtures live on a separate page, never replace the app.
  const fixture=await b.newPage();
  for(const [name,html,expected] of [
   ['textarea document','<textarea id="editor">Report</textarea>',true],
   ['input document','<input id="editor" value="Report">',true],
   ['contenteditable document','<div id="editor" contenteditable="true">Report</div>',true],
   ['inherited contenteditable','<section contenteditable="true"><div id="editor">Report</div></section>',true],
   ['custom DOM plus external input','<input aria-label="Find"><div id="editor" tabindex="0">Report</div>',false],
   ['custom canvas','<canvas id="editor" tabindex="0"></canvas>',false],
   ['custom SVG','<svg id="editor" tabindex="0"><text>Report</text></svg>',false],
   ['custom DOM with hidden input plumbing','<div id="editor" tabindex="0">Report<input type="hidden"></div>',false],
  ]){
   await fixture.setContent(html);const got=await read(fixture);assert.equal(got.prohibited,expected,name);
   observations.push({name,...got,passed:true});
  }
  fs.writeFileSync('/results/surface-fixtures.json',JSON.stringify({observations,scope:'Read-only surface evidence on golden plus synthetic DOM fixtures. Third-party editor attribution and LLM gate execution were not tested. These are not official criterion scores.'},null,2)+'\n');
  console.log('PASS golden surface and 8 DOM fixtures (4 prohibited, 4 allowed)');
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});

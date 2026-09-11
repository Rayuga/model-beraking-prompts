// Read-only checks on the running preview. This is not a paid LLM judge run.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await context.newPage();const requests=[],responses=[],errors=[],checks=[];
 page.on('request',r=>requests.push({url:r.url(),method:r.method(),type:r.resourceType()}));
 page.on('response',r=>responses.push(r));page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>document.querySelector('#doc-title')?.textContent==='Northwind API Incident Report'&&document.querySelector('#revision-list')?.children.length>0);
 const result={scope:'Live browser observations on golden 1.0.0 at localhost:3034; not an oracle score',checks,errors};
 const check=async(id,fn)=>{try{const evidence=await fn();checks.push({id,status:'pass',evidence});console.log('PASS '+id);}catch(e){checks.push({id,status:'fail',error:e.message});console.log('FAIL '+id+': '+e.message);}};
 try{
  await page.goto('http://localhost:3000/');await ready();
  await page.screenshot({path:'/preview/constraints-polish-desktop.png',fullPage:true});
  const dataResponse=responses.find(r=>r.url().endsWith('/api/documents/incident-alpha')&&r.request().method()==='GET');
  assert(dataResponse&&dataResponse.ok(),'Live report read not observed');
  const before=await dataResponse.json();
  await check('global_browser_and_custom_surface_gates',async()=>{
   assert.equal(errors.length,0);assert(before.document.content.length>0);
   const surface=await page.locator('#editor').evaluate(e=>({tag:e.tagName,role:e.getAttribute('role'),editable:e.isContentEditable,embeddedNativeEditors:e.querySelectorAll('textarea,input,[contenteditable="true"]').length,ancestors:(()=>{let a=e,arr=[];while(a){arr.push({tag:a.tagName,editable:a.isContentEditable});a=a.parentElement;}return arr;})(),renderedRows:e.querySelectorAll('.line').length}));
   assert.equal(surface.tag,'DIV');assert(!surface.editable);assert.equal(surface.embeddedNativeEditors,0);assert(surface.renderedRows>0);assert(surface.ancestors.every(a=>!a.editable));
   const scripts=await page.locator('script[src]').evaluateAll(es=>es.map(e=>e.src));
   assert.deepEqual(scripts,['http://localhost:3000/js/app.js']);
   const scriptResponse=responses.find(r=>r.url()===scripts[0]);const loadedSource=await scriptResponse.text();
   assert(loadedSource.includes('function renderLine')||loadedSource.includes('function render('));
   return {reportRead:{url:dataResponse.url(),status:dataResponse.status(),title:before.document.title},surface,scripts,visibleSearchInputs:await page.locator('.toolbar input').count(),note:'Custom DIV with rendered line elements; only the app script loads. Search inputs are outside the document surface.'};
  });
  await check('same_origin_application_shell',async()=>{
   const external=requests.filter(r=>/^https?:/.test(r.url)&&new URL(r.url).origin!=='http://localhost:3000');assert.deepEqual(external,[]);
   return {observedRequests:requests.slice(),externalRequests:external};
  });
  await check('self_contained_entry_and_reload',async()=>{
   await page.reload();await ready();assert(await page.locator('#editor').isVisible());assert.equal(errors.length,0);
   assert(requests.every(r=>!/^https?:/.test(r.url)||new URL(r.url).origin==='http://localhost:3000'));
   return {reloadEditorVisible:true,pageTitle:await page.title(),browserErrors:errors.slice()};
  });
  await check('labelled_primary_controls',async()=>{
   const controls=[];
   for(const name of ['Save','Undo','Redo','Find Next','Replace Current','Replace All']){
    const e=page.getByRole('button',{name,exact:true});assert(await e.isVisible());controls.push({name,visible:true,enabled:await e.isEnabled()});
   }
   for(const name of ['Find text','Replacement text']){assert(await page.getByRole('textbox',{name,exact:true}).isVisible());}
   assert(await page.getByRole('heading',{name:'Revision History'}).isVisible());
   return {controls,searchAccessibleNames:['Find text','Replacement text'],historyHeading:'Revision History',note:'Disabled Save/Undo/Redo are expected before an edit and remain visibly labelled.'};
  });
  await check('keyboard_focus_and_editor_entry',async()=>{
   await page.reload();await ready();const route=[];
   const focused=async(key)=>{await page.keyboard.press(key);const f=await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return {id:e.id,tag:e.tagName,label:e.getAttribute('aria-label')||e.textContent?.trim().slice(0,90),outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,outlineColor:s.outlineColor,focusVisible:e.matches(':focus-visible')};});route.push({key,...f});return f;};
   let reached=false;
   for(let i=0;i<16;i++){const f=await focused('Tab');assert(f.focusVisible&&parseFloat(f.outlineWidth)>0&&f.outlineStyle!=='none',JSON.stringify(f));if(f.id==='editor'){reached=true;break;}}
   assert(reached,'Editor not reached with real Tab');
   const afterEscape=await focused('Escape');assert.equal(afterEscape.id,'find-box');
   const next=await focused('Tab');assert.equal(next.id,'replace-box');
   const back=await focused('Shift+Tab');assert.equal(back.id,'find-box');
   for(let i=0;i<16;i++){const f=await focused('Shift+Tab');if(f.tag==='BODY')continue;assert(f.focusVisible&&parseFloat(f.outlineWidth)>0&&f.outlineStyle!=='none',JSON.stringify(f));if(f.id==='editor')break;}
   assert(route.some(f=>f.label==='Preview'),'History Preview not keyboard reachable');
   assert(route.some(f=>f.label==='Restore Draft'),'History Restore not keyboard reachable');
   await page.screenshot({path:'/preview/polish-keyboard-focus.png'});
   const after=await page.evaluate(async url=>(await fetch(url)).json(),dataResponse.url());assert.deepEqual(after,before);
   assert.equal(await page.locator('#save-state').innerText(),'Saved | No active search');
   return {route,escapeReturnsToFind:true,documentAndRevisionUnchanged:true,visibleFocusIndicator:'3px solid outline observed on keyboard-focused controls'};
  });
  const history=await page.locator('#revision-list').innerText();
  const feedback=await page.locator('#save-state').evaluate(e=>({text:e.textContent,role:e.getAttribute('role'),live:e.getAttribute('aria-live')}));
  const alert=await page.locator('#message').evaluate(e=>({text:e.textContent,role:e.getAttribute('role'),rect:{width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height},display:getComputedStyle(e).display}));
  assert(/Revision \d+/.test(history)&&/\d{4}-\d{2}-\d{2}/.test(history));assert.equal(feedback.role,'status');assert.equal(alert.role,'alert');
  checks.push({id:'history_and_feedback_readability',status:alert.text.trim()?'pass':'partially_verified',evidence:{history,feedback,alert,normalStatusVisible:await page.locator('#save-state').isVisible(),errorRegionVisible:await page.locator('#message').isVisible(),note:'History and normal Saved status are readable. A role=alert container exists, but is empty on the fresh saved page. The Polish prompt forbids edits/saves/restores, so no save-error state was induced. Error-state readability is not proven by an empty DOM element.'}});
  const after=await page.evaluate(async url=>(await fetch(url)).json(),dataResponse.url());assert.deepEqual(after,before);
  result.documentAndRevisionUnchanged=true;
 }finally{fs.writeFileSync('/preview/constraints-polish-results.json',JSON.stringify(result,null,2)+'\n');await browser.close();}
 if(checks.some(c=>c.status==='fail'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

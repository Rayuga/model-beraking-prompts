const assert = require('node:assert/strict');
const fs = require('node:fs');
const {spawn} = require('node:child_process');
const {randomUUID} = require('node:crypto');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const directory = '/evidence/screenshots';
fs.mkdirSync(directory,{recursive:true});
const base='http://127.0.0.1:3000';
const results=[],errors=[],responses=[];
const server=spawn('node',['/app/backend/server.js'],{cwd:'/app/backend',stdio:['ignore','pipe','pipe']});
const serverLog=fs.createWriteStream('/evidence/server.log');
server.stdout.pipe(serverLog);server.stderr.pipe(serverLog);
let browser;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function req(method,path,body,token){
 const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
 const data=await r.json();assert(r.ok,JSON.stringify(data));return data;
}
async function settle(page){await page.waitForFunction(()=>document.body.dataset.busy==='false');}
async function login(page){
 await page.locator('#email').fill('hiring@pellmoor.test');
 await page.locator('#password').fill('password123');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.locator('#app').waitFor({state:'visible'});await settle(page);
}
async function record(page,name){
 const details=await page.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  const dialog=document.querySelector('#batch-dialog');
  const panel=document.querySelector('#panel');
  const data={theme:document.documentElement.dataset.theme||'light',viewport:{width:innerWidth,height:innerHeight},horizontalOverflow:document.documentElement.scrollWidth>innerWidth,pageScrollY:scrollY};
  if(dialog.open){
   const body=document.querySelector('.batch-body');
   const dr=rect(dialog),buttons=[...document.querySelectorAll('.batch-actions button')].map(e=>({id:e.id,...rect(e)}));
   Object.assign(data,{dialog:dr,body:{...rect(body),scrollTop:body.scrollTop,scrollHeight:body.scrollHeight,clientHeight:body.clientHeight},buttons,actionsVisible:buttons.every(r=>r.top>=dr.top&&r.bottom<=dr.bottom&&r.left>=dr.left&&r.right<=dr.right)});
  }
  if(panel.childElementCount) data.panel={...rect(panel),scrollTop:panel.scrollTop,scrollHeight:panel.scrollHeight,clientHeight:panel.clientHeight};
  return data;
 });
 await page.screenshot({path:`${directory}/${name}.png`});
 results.push({name,...details});
 assert(!details.horizontalOverflow,`${name}: horizontal overflow`);
 if(details.buttons)assert(details.actionsVisible,`${name}: clipped actions`);
}
async function scrollPart(page,selector,bottom){await page.locator(selector).evaluate((el,bottom)=>el.scrollTop=bottom?el.scrollHeight:0,bottom);}
async function inspect(page,label){
 await page.locator('[data-code="ROLE-014"]').click();await settle(page);
 await page.evaluate(()=>scrollTo(0,0));await record(page,`${label}-vacancy-overview`);
 await page.locator('#funnel').scrollIntoViewIfNeeded();await record(page,`${label}-vacancy-funnel`);
 await page.locator('.cand[data-id="CAND-101"]').click();await page.locator('#close').waitFor();
 await scrollPart(page,'#panel',false);await record(page,`${label}-candidate-top`);
 await scrollPart(page,'#panel',true);await record(page,`${label}-candidate-bottom`);
 await page.locator('#close').click();
 await page.locator('.cand[data-id="CAND-104"]').click();await page.locator('#close').waitFor();
 await record(page,`${label}-candidate-empty`);await page.locator('#close').click();
 await page.locator('#batch-open').click();
 await scrollPart(page,'.batch-body',false);await record(page,`${label}-batch-selection-top`);
 await scrollPart(page,'.batch-body',true);await record(page,`${label}-batch-selection-bottom`);
 await page.locator('[data-batch-id="CAND-101"]').check();
 await page.locator('[data-batch-id="CAND-104"]').check();
 await page.locator('#batch-review').click();await page.locator('#batch-edit').waitFor();
 await scrollPart(page,'.batch-body',false);await record(page,`${label}-batch-blocked-review-top`);
 await scrollPart(page,'.batch-body',true);await record(page,`${label}-batch-blocked-review-bottom`);
 await page.locator('#batch-close').click();
 await page.locator('[data-code="ROLE-017"]').click();await settle(page);
 await page.locator('#funnel').scrollIntoViewIfNeeded();await record(page,`${label}-vacancy-empty`);
}
async function stressSetup(){
 const ruth=await req('POST','/api/login',{email:'hiring@pellmoor.test',password:'password123'});
 const cal=await req('POST','/api/login',{email:'coord@pellmoor.test',password:'password123'});
 for(let i=0;i<14;i++){
  const role=await req('GET','/api/roles/ROLE-014',undefined,ruth.token);
  await req('POST','/api/candidates/CAND-101/notes',{body:`Review note ${i+1}: The workshop examples and safety discussion will be available to everyone reviewing this application.`,expected_revision:role.revision,operation_id:randomUUID()},ruth.token);
 }
 for(let i=0;i<8;i++){
  const role=await req('GET','/api/roles/ROLE-014',undefined,cal.token);
  await req('POST','/api/candidates',{role:'ROLE-014',name:`Additional applicant ${i+1}`,expected_revision:role.revision,operation_id:randomUUID()},cal.token);
 }
}
(async()=>{
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await sleep(100);}
  browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  for(const phase of ['seed','expanded']){
   if(phase==='expanded')await stressSetup();
   for(const viewport of [{width:1280,height:800},{width:390,height:844}])for(const theme of ['light','dark']){
    const context=await browser.newContext({viewport});const page=await context.newPage();
    page.on('pageerror',e=>errors.push({phase,viewport,theme,error:String(e)}));
    page.on('response',r=>{if(r.url().includes('/api/roles/'))responses.push({url:r.url(),status:r.status()});});
    const label=`${phase}-${viewport.width}x${viewport.height}-${theme}`;
    await page.goto(base);await page.locator('#signin').waitFor({state:'visible'});
    if(theme==='dark'){await login(page);await page.locator('#theme').click();await page.locator('#signout').click();}
    await record(page,`${label}-signin`);await login(page);
    await page.reload();await page.locator('#app').waitFor({state:'visible'});await settle(page);
    if(theme==='dark')await page.locator('#theme').click();
    await inspect(page,label);await context.close();
   }
  }
  assert.deepEqual(errors,[]);assert(responses.some(r=>r.status===200));
 }finally{
  fs.writeFileSync('/evidence/results.json',JSON.stringify({kind:'local frozen-r8 golden visual audit; not hosted judge scores',image:'pellmoor-tests:2.0.3 (cached)',results,pageErrors:errors,successfulProtectedReads:responses.filter(r=>r.status===200).length},null,2));
  if(browser)await browser.close();server.kill('SIGTERM');serverLog.end();
 }
 console.log(`PASS ${results.length} screenshots across seed/expanded records, both themes and required viewports; no horizontal overflow, clipped batch actions or page errors`);
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

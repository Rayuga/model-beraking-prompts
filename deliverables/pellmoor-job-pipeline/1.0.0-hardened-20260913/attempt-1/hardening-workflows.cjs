const assert = require('node:assert/strict');
const fs = require('node:fs');
const {randomUUID} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const base='http://127.0.0.1:3000';
const results=[];
const tokens={};
const accounts={r:'hiring',c:'coord',o:'panel1',w:'panel2'};
const ids=['ROLE-014','ROLE-015','ROLE-016','ROLE-017'];
let browser,page,persistedReceipt;
async function group(name,fn){
  try {await fn(); results.push({name,status:'passed'}); console.log('PASS '+name);}
  catch(e){results.push({name,status:'failed',error:String(e.stack)});throw e;}
  finally {fs.writeFileSync('/evidence/hardening-regressions.json',JSON.stringify({kind:'unpaid local regressions, not judge scores',results},null,2));}
}
async function req(method,path,body,who='r'){
 const headers={'Content-Type':'application/json','Connection':'close'};
 if(tokens[who]) headers.Authorization='Bearer '+tokens[who];
 const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const text=await response.text();
 let data;try{data=JSON.parse(text)}catch{data=text}
 return {status:response.status,data};
}
async function role(id='ROLE-014'){const x=await req('GET','/api/roles/'+id);assert.equal(x.status,200);return x.data;}
async function cand(id){const x=await req('GET','/api/candidates/'+id);assert.equal(x.status,200);return x.data;}
async function state(){
 const roles=await Promise.all(ids.map(role));
 const candidates=await Promise.all(roles.flatMap(x=>x.candidates.map(c=>cand(c.id))));
 return {roles,candidates};
}
async function mutation(who,path,body,roleId,expected){
 const r=await role(roleId);
 const b={...body,expected_revision:r.revision,operation_id:randomUUID()};
 const x=await req('POST',path,b,who);
 if(expected!==undefined) assert.equal(x.status,expected,JSON.stringify(x.data));
 return {...x,body:b};
}
const cp=(id,kind)=>'/api/candidates/'+id+'/'+kind;
async function reject(who,path,body,roleId,expected){
 const before=await state();
 const x=await mutation(who,path,body,roleId,expected);
 assert(x.status>=400&&x.status<500,JSON.stringify(x));assert(x.data.error);
 assert.deepEqual(await state(),before);return x;
}
async function loginUI(who){
 await page.goto(base);
 if(await page.locator('#app').isVisible()) await page.locator('#signout').click();
 await page.locator('#email').fill(accounts[who]+'@pellmoor.test');
 await page.locator('#password').fill('password123');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.locator('#app').waitFor({state:'visible'});
 await page.locator('#board .cand').first().waitFor();
 await page.waitForFunction(()=>document.body.dataset.busy==='false');
 assert((await page.locator('#whoami').textContent()).includes(accounts[who]==='hiring'?'Ruth':accounts[who]==='coord'?'Cal':accounts[who]==='panel1'?'Otis':'Wren'));
}
async function choose(roleId){
 if(await page.locator('#close').count())await page.locator('#close').click();
 await page.locator(`[data-code="${roleId}"]`).click();
 await page.waitForFunction(()=>document.body.dataset.busy==='false');
}
async function open(id){await page.locator(`.cand[data-id="${id}"]`).click();await page.locator('#close').waitFor();}
async function clickMutation(selector,path){
 const pending=page.waitForResponse(r=>r.url().endsWith(path)&&r.request().method()==='POST');
 await page.locator(selector).click(); const response=await pending;
 await page.waitForFunction(()=>document.body.dataset.busy==='false');
 await page.locator('#close').waitFor();
 return response.status();
}
async function uiPanel(id,who,remove=false){
 await loginUI('c');await choose((await cand(id)).candidate.role);await open(id);
 if(remove) assert.equal(await clickMutation(`.remove-member[data-member="${accounts[who]}@pellmoor.test"]`,cp(id,'panel')),201);
 else {await page.locator('#member').selectOption(accounts[who]+'@pellmoor.test');assert.equal(await clickMutation('#panelform button',cp(id,'panel')),201);}
}
async function uiScore(id,who,value=4){
 await loginUI(who);await choose((await cand(id)).candidate.role);await open(id);
 await page.locator('#score').selectOption(String(value));assert.equal(await clickMutation('#scoreform button',cp(id,'score')),201);
}
async function uiMove(id,stage,status=200){
 await loginUI('r');await choose((await cand(id)).candidate.role);await open(id);
 assert.equal(await clickMutation(`[data-to="${stage}"]`,cp(id,'stage')),status);
}
async function uiCreate(name){
 await loginUI('c');await choose('ROLE-017');await page.locator('#candidate-name').fill(name);
 const response=page.waitForResponse(r=>r.url().endsWith('/api/candidates')&&r.request().method()==='POST');
 await page.locator('#addcandidate button').click();const x=await response;assert.equal(x.status(),201);
 const id=(await x.json()).candidate.id;await page.waitForFunction(()=>document.body.dataset.busy==='false');return id;
}
async function replay(path,receipt,who='r'){
 const before=await state();assert.deepEqual(await req('POST',path,receipt.body,who),{status:receipt.status,data:receipt.data});assert.deepEqual(await state(),before);
}
async function main(){
 for(const [key,name] of Object.entries(accounts))tokens[key]=(await req('POST','/api/login',{email:name+'@pellmoor.test',password:'password123'},'none')).data.token;
 browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 let winner,loser,winReceipt,fullReceipt,noteReceipt;
 await group('Panel addition invalidates all scores, preserves visible archives and has one revision/event',async()=>{
  await uiScore('CAND-101','w',3);const before=await cand('CAND-101');
  await uiPanel('CAND-101','r');const after=await cand('CAND-101');
  assert.equal(after.candidate.assessment_version,before.candidate.assessment_version+1);
  assert.equal(after.revision,before.revision+1);assert.equal(after.activity.length,before.activity.length+1);
  assert.deepEqual(after.scores,[]);assert.equal(after.historical_scores.length,2);
  assert.match(await page.locator('#historical-scores').textContent(),/Otis Barre.*historical/);
  assert.match(await page.locator('#assessment-status').textContent(),/waiting on a score/);
  await uiScore('CAND-101','r');await reject('r',cp('CAND-101','stage'),{stage:'offer'},'ROLE-014',409);
  await uiScore('CAND-101','o');await uiScore('CAND-101','w');assert.equal((await cand('CAND-101')).offer_readiness.ready,true);
 });
 await group('Removal and readdition invalidate retained members too; ineligible/duplicate/absent writes preserve everything',async()=>{
  const before=await cand('CAND-101');await uiPanel('CAND-101','w',true);let c=await cand('CAND-101');
  assert.equal(c.candidate.assessment_version,before.candidate.assessment_version+1);assert.deepEqual(c.scores,[]);
  await reject('w',cp('CAND-101','score'),{score:5},'ROLE-014',403);
  await reject('c',cp('CAND-101','panel'),{member:'panel2@pellmoor.test',action:'remove'},'ROLE-014',409);
  await reject('c',cp('CAND-101','panel'),{member:'coord@pellmoor.test'},'ROLE-014',409);
  await reject('c',cp('CAND-101','panel'),{member:'hiring@pellmoor.test'},'ROLE-014',409);
  await uiPanel('CAND-101','w');c=await cand('CAND-101');assert.deepEqual(c.scores,[]);
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const remove=page.locator('.remove-member').first();await remove.scrollIntoViewIfNeeded();
  const box=await remove.boundingBox();assert(box.x>=0&&box.x+box.width<=390);
  await page.screenshot({path:'/evidence/hardened-panel-controls-mobile.png'});
  await page.setViewportSize({width:1280,height:800});
  assert.equal(c.candidate.assessment_version,before.candidate.assessment_version+2);
  await reject('r',cp('CAND-101','stage'),{stage:'offer'},'ROLE-014',409);
  for(const who of ['r','o','w'])await uiScore('CAND-101',who);
 });
 await group('Offer reopening archives assessment, releases capacity, requires fresh scores and freezes later writes',async()=>{
  await uiMove('CAND-101','offer');let c=await cand('CAND-101');
  for(const id of ['CAND-101','CAND-108','CAND-103','CAND-107']){
   const r=(await cand(id)).candidate.role;
   await reject('c',cp(id,'panel'),{member:'hiring@pellmoor.test'},r,409);
   await reject('c',cp(id,'panel'),{member:'panel1@pellmoor.test',action:'remove'},r,409);
   await reject('o',cp(id,'score'),{score:4},r,409);
  }
  await loginUI('c');await open('CAND-101');assert.equal(await page.locator('#panelform').count(),0);assert.equal(await page.locator('.remove-member').count(),0);
  assert.match(await page.locator('#panel').textContent(),/frozen/);
  const cap=(await role()).capacity;await uiMove('CAND-101','interview');const reopened=await cand('CAND-101');
  assert.deepEqual(reopened.panel,c.panel);assert.equal(reopened.candidate.assessment_version,c.candidate.assessment_version+1);assert.deepEqual(reopened.scores,[]);
  assert.equal((await role()).capacity.available,cap.available+1);await uiMove('CAND-101','offer',409);
  for(const who of ['r','o','w'])await uiScore('CAND-101',who);
  await uiMove('CAND-101','offer');await mutation('w',cp('CAND-103','notes'),{body:'Frozen records retain notes'},'ROLE-014',201);
 });
 await group('Seeded filled capacity converts hired to offer and back without requiring a free opening',async()=>{
  assert.deepEqual((await role('ROLE-016')).capacity,{reserved:0,filled:1,available:0});
  await uiMove('CAND-108','offer');assert.deepEqual((await role('ROLE-016')).capacity,{reserved:1,filled:0,available:0});
  await uiMove('CAND-108','hired');assert.deepEqual((await role('ROLE-016')).capacity,{reserved:0,filled:1,available:0});
 });
 await group('Competing complete UI assessments cannot overbook; refreshed loser gets capacity rejection',async()=>{
  const applicants=[];
  for(const label of ['A','B']){
   const id=await uiCreate('Capacity '+label+' '+randomUUID());applicants.push(id);
   await uiMove(id,'screening');await uiMove(id,'interview');await uiPanel(id,'o');await uiPanel(id,'w');
   await uiScore(id,'o');await uiScore(id,'w');
  }
  const before=await role('ROLE-017');const bodies=applicants.map(()=>({stage:'offer',expected_revision:before.revision,operation_id:randomUUID()}));
  const responses=await Promise.all(applicants.map((id,i)=>req('POST',cp(id,'stage'),bodies[i])));
  assert.deepEqual(responses.map(x=>x.status).sort(),[200,409]);const wi=responses.findIndex(x=>x.status===200);winner=applicants[wi];loser=applicants[1-wi];
  winReceipt={...responses[wi],body:bodies[wi]};const after=await role('ROLE-017');assert.equal(after.revision,before.revision+1);
  assert.deepEqual(after.capacity,{reserved:1,filled:0,available:0});assert.equal((await cand(loser)).candidate.stage,'interview');
  const loserBefore=before.candidates.find(x=>x.id===loser);const loserAfter=after.candidates.find(x=>x.id===loser);assert.deepEqual(loserAfter,loserBefore);
  fullReceipt=await reject('r',cp(loser,'stage'),{stage:'offer'},'ROLE-017',409);assert.match(fullReceipt.data.error,/no available opening/);
 });
 await group('Release capacity, replay historical success and failure without changes, then hire fresh loser',async()=>{
  await uiMove(winner,'withdrawn');assert.deepEqual((await role('ROLE-017')).capacity,{reserved:0,filled:0,available:1});
  await reject('o',cp(winner,'score'),{score:5},'ROLE-017',409);
  await reject('c',cp(winner,'panel'),{member:'hiring@pellmoor.test'},'ROLE-017',409);
  await replay(cp(winner,'stage'),winReceipt);await replay(cp(loser,'stage'),fullReceipt);
  await uiMove(loser,'offer');await uiMove(loser,'hired');assert.deepEqual((await role('ROLE-017')).capacity,{reserved:0,filled:1,available:0});
  await page.reload();await page.locator('#board .cand').first().waitFor();await choose('ROLE-017');assert.match(await page.locator('#role-sub').textContent(),/0 reserved.*1 filled.*0 available/);
 });
 await group('Receipts survive logout, key reordering and new sessions; actor/path/payload scopes remain distinct',async()=>{
  noteReceipt=await mutation('w',cp(winner,'notes'),{body:'Wren receipt before restart'},'ROLE-017',201);
  await req('POST','/api/logout',{},'w');const before=await state();assert.equal((await req('POST',cp(winner,'notes'),noteReceipt.body,'w')).status,401);assert.deepEqual(await state(),before);
  tokens.w=(await req('POST','/api/login',{email:'panel2@pellmoor.test',password:'password123'},'none')).data.token;
  await replay(cp(winner,'notes'),noteReceipt,'w');const reordered={...noteReceipt,body:Object.fromEntries(Object.entries(noteReceipt.body).reverse())};await replay(cp(winner,'notes'),reordered,'w');
  const r=await role('ROLE-017');const other=await req('POST',cp(winner,'notes'),{...noteReceipt.body,body:'Otis independent receipt',expected_revision:r.revision},'o');assert.equal(other.status,201);assert.equal(other.data.note.author,'panel1@pellmoor.test');
  const stable=await state();for(const [path,body] of [[cp(winner,'notes'),{...noteReceipt.body,body:'changed'}],[cp(loser,'notes'),noteReceipt.body]]){
   const result=await req('POST',path,body,'w');assert.equal(result.status,409);assert.match(result.data.error,/different input/);assert.deepEqual(await state(),stable);
  }
 });
 await group('Current and historical assessment presentation works on mobile and both themes',async()=>{
  await loginUI('c');await open('CAND-101');await page.screenshot({path:'/evidence/hardened-assessment-desktop.png',fullPage:true});
  await page.keyboard.press('Escape');await page.locator('#theme').click();await open('CAND-101');await page.screenshot({path:'/evidence/hardened-assessment-dark.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.locator('#historical-scores').scrollIntoViewIfNeeded();assert(await page.locator('#historical-scores').isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/evidence/hardened-assessment-mobile.png',fullPage:true});
  await page.keyboard.press('Escape');await choose('ROLE-017');await page.screenshot({path:'/evidence/hardened-capacity-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 });
 await group('Restart preserves exact product state and original success, business rejection and note receipts',async()=>{
  const before=await state();execFileSync('bash',['/tests/app-lifecycle.sh','restart'],{stdio:'inherit'});assert.deepEqual(await state(),before);
  for(const who of ['r','w'])tokens[who]=(await req('POST','/api/login',{email:accounts[who]+'@pellmoor.test',password:'password123'},'none')).data.token;
  await replay(cp(winner,'stage'),winReceipt);await replay(cp(loser,'stage'),fullReceipt);await replay(cp(winner,'notes'),noteReceipt,'w');
  await reject('r',cp(winner,'stage'),{stage:'offer'},'ROLE-017',409);
  await page.reload();await page.locator('#board .cand').first().waitFor();await choose('ROLE-017');assert.match(await page.locator('#role-sub').textContent(),/0 reserved.*1 filled.*0 available/);
 });
 await browser.close();console.log('ALL HARDENING GROUPS PASSED: '+results.length);
}
main().catch(async e=>{console.error(e);if(page)await page.screenshot({path:'/evidence/hardening-failure.png',fullPage:true}).catch(()=>{});if(browser)await browser.close();process.exitCode=1;});

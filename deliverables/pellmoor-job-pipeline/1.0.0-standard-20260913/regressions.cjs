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
  finally {fs.writeFileSync('/evidence/regressions.json',JSON.stringify({kind:'unpaid local regressions, not judge scores',results},null,2));}
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
async function main(){
 await group('Authentication: wrong password, protected reads, four accounts, token-only revocation',async()=>{
   for(const path of ['/api/me','/api/roles','/api/roles/ROLE-014','/api/candidates/CAND-101'])assert.equal((await req('GET',path,undefined,'none')).status,401);
   assert.equal((await req('POST','/api/login',{email:'hiring@pellmoor.test',password:'wrong'},'none')).status,401);
   for(const [key,name] of Object.entries(accounts)){
     const x=await req('POST','/api/login',{email:name+'@pellmoor.test',password:'password123'},'none');
     assert.equal(x.status,200);assert(x.data.token.length>=32);tokens[key]=x.data.token;
   }
   const second=await req('POST','/api/login',{email:'hiring@pellmoor.test',password:'password123'},'none');
   tokens.other=second.data.token;assert.notEqual(tokens.other,tokens.r);
   assert.equal((await req('POST','/api/logout',{},'other')).status,200);
   assert.equal((await req('GET','/api/roles',undefined,'other')).status,401);
   assert.equal((await req('GET','/api/me')).data.person.email,'hiring@pellmoor.test');
 });
 await group('Exact seed, all nine candidates, empty vacancy, panels/scores, derived funnel',async()=>{
   const seed=JSON.parse(fs.readFileSync('/recruitment/records/pellmoor_seed_data.json'));
   const current=await state();assert.equal(current.candidates.length,9);
   for(const sr of seed.roles){const r=current.roles.find(x=>x.role.code===sr.code);assert.deepEqual(r.role,sr);assert.equal(r.revision,0);}
   for(const sc of seed.candidates){const c=current.candidates.find(x=>x.candidate.id===sc.id).candidate;for(const key of ['id','role','name','stage','history'])assert.deepEqual(c[key],sc[key]);}
   assert.equal(current.roles[3].candidates.length,0);
   assert.deepEqual(current.roles[0].funnel.map(x=>[x.reached,x.still,x.left]),[[4,1,0],[3,1,0],[2,1,1],[0,0,0],[0,0,0]]);
   const devi=await cand('CAND-106');assert.deepEqual(devi.scores.map(x=>x.score),[5,4]);
   const pim=await cand('CAND-104');assert.deepEqual([pim.panel,pim.scores,pim.notes],[[],[],[]]);
 });
 browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await group('Real browser login, root reload, seed SVG and empty-state navigation',async()=>{
   await page.goto(base);await page.locator('#password').fill('wrong');await page.getByRole('button',{name:'Sign in',exact:true}).click();
   await page.locator('#toast.show').waitFor();assert(await page.locator('#signin').isVisible());
   await loginUI('r');assert.equal(await page.locator('#funnel svg .rung').count(),5);
   await choose('ROLE-017');assert.match(await page.locator('#funnel').textContent(),/Nobody has applied/);assert.equal(await page.locator('#funnel svg').count(),0);
   await choose('ROLE-014');await open('CAND-104');assert.match(await page.locator('#panel').textContent(),/No panel yet/);
   await page.keyboard.press('Escape');assert.equal(await page.locator('.cand[data-id="CAND-104"]').evaluate(e=>e===document.activeElement),true);
   await page.reload();await page.locator('#board .cand').first().waitFor();assert(await page.locator('#app').isVisible());assert.deepEqual(errors,[]);
 });
 await group('Duplicate names reject atomically; same name in another vacancy succeeds in UI',async()=>{
   await reject('c','/api/candidates',{role:'ROLE-015',name:'Ilse Vandal'},'ROLE-015',409);
   await loginUI('c');await choose('ROLE-017');await page.locator('#candidate-name').fill('Ilse Vandal');
   const response=page.waitForResponse(r=>r.url().endsWith('/api/candidates')&&r.request().method()==='POST');
   await page.locator('#addcandidate button').click();assert.equal((await response).status(),201);
   await page.locator('#board .cand').first().waitFor();assert.match(await page.locator('[data-code="ROLE-017"] span').textContent(),/1 live.*1 total.*r1/);await page.reload();await page.locator('#board .cand').first().waitFor();
   assert.equal((await role('ROLE-017')).candidates.length,1);assert.equal((await cand('CAND-105')).candidate.stage,'applied');
 });
 await group('Server role enforcement, legal stage move and independent applications',async()=>{
   for(const who of ['c','o'])await reject(who,cp('CAND-105','stage'),{stage:'screening'},'ROLE-015',403);
   await reject('r','/api/candidates',{role:'ROLE-017',name:'Forbidden candidate'},'ROLE-017',403);
   await reject('r',cp('CAND-104','panel'),{member:'panel1@pellmoor.test'},'ROLE-014',403);
   await reject('c',cp('CAND-101','score'),{score:3},'ROLE-014',403);
   await loginUI('r');await choose('ROLE-015');await open('CAND-105');assert.equal(await clickMutation('[data-to="screening"]',cp('CAND-105','stage')),200);
   assert.equal((await cand('CAND-105')).candidate.stage,'screening');assert.equal((await cand('CAND-101')).candidate.stage,'interview');
   assert.equal((await cand('CAND-105')).activity[0].actor,'hiring@pellmoor.test');
   for(const stage of ['applied','screening'])assert.equal(await clickMutation(`[data-to="${stage}"]`,cp('CAND-105','stage')),200);
   assert.deepEqual((await cand('CAND-105')).candidate.history,['applied','screening','applied','screening']);
 });
 await group('Illegal skips/backsteps and terminal changes reject with exact protected state',async()=>{
   await reject('r',cp('CAND-102','stage'),{stage:'offer'},'ROLE-014',409);
   await reject('r',cp('CAND-101','stage'),{stage:'applied'},'ROLE-014',409);
   for(const [id,roleId] of [['CAND-103','ROLE-014'],['CAND-107','ROLE-015']])for(const stage of ['applied','rejected','withdrawn'])await reject('r',cp(id,'stage'),{stage},roleId,409);
   await choose('ROLE-014');await open('CAND-103');assert.equal(await page.locator('#panel [data-to]').count(),0);
 });
 await group('Score boundaries, fractional rejection, unassigned rejection and forged identity',async()=>{
   await loginUI('o');await open('CAND-101');
   for(const score of [1,5]){await page.locator('#score').selectOption(String(score));assert.equal(await clickMutation('#scoreform button',cp('CAND-101','score')),201);assert.equal((await cand('CAND-101')).scores.find(x=>x.panel_member==='panel1@pellmoor.test').score,score);}
   for(const score of [0,6,2.5,true,[1],{},'3',null])await reject('o',cp('CAND-101','score'),{score},'ROLE-014');
   await reject('o',cp('CAND-104','score'),{score:3},'ROLE-014',403);
   await reject('o',cp('CAND-101','score'),{score:3,panel_member:'panel2@pellmoor.test'},'ROLE-014',400);
 });
 await group('Complete offer workflow through UI: panel gates, per-actor scores, exact funnel ripple',async()=>{
   await loginUI('r');await open('CAND-104');
   for(const stage of ['screening','interview'])assert.equal(await clickMutation(`[data-to="${stage}"]`,cp('CAND-104','stage')),200);
   await loginUI('c');await open('CAND-104');await page.locator('#member').selectOption('hiring@pellmoor.test');assert.equal(await clickMutation('#panelform button',cp('CAND-104','panel')),201);
   await loginUI('r');await open('CAND-104');assert.equal(await clickMutation('[data-to="offer"]',cp('CAND-104','stage')),409);await page.locator('#toast.show').waitFor();assert.match(await page.locator('#toast').textContent(),/at least 2/);
   await loginUI('c');await open('CAND-104');await page.locator('#member').selectOption('panel1@pellmoor.test');assert.equal(await clickMutation('#panelform button',cp('CAND-104','panel')),201);
   await reject('r',cp('CAND-104','stage'),{stage:'offer'},'ROLE-014',409);
   for(const who of ['r','o']){await loginUI(who);await open('CAND-104');await page.locator('#score').selectOption('4');assert.equal(await clickMutation('#scoreform button',cp('CAND-104','score')),201);}
   await loginUI('r');await open('CAND-104');assert.equal(await clickMutation('[data-to="offer"]',cp('CAND-104','stage')),200);
   const r=await role();assert.deepEqual(r.funnel.map(x=>x.reached),[4,4,3,1,0]);assert.deepEqual(r.funnel.map(x=>x.left),[0,0,1,0,0]);
   const p=await cand('CAND-104');assert.equal(p.activity.length,7);assert.equal(p.candidate.stage,'offer');
   assert.deepEqual(p.activity.map(x=>x.actor).reverse(),['hiring','hiring','coord','coord','hiring','panel1','hiring'].map(x=>x+'@pellmoor.test'));
 });
 await group('Attributed append-only notes, correction retained, mutation feedback',async()=>{
   await loginUI('w');await choose('ROLE-015');await open('CAND-106');
   for(const body of ['Strong workshop examples','Correction: references still pending']){
     await page.locator('#note').fill(body);assert.equal(await clickMutation('#notef button',cp('CAND-106','notes')),201);
   }
   const c=await cand('CAND-106');assert.equal(c.notes.length,2);assert(c.notes.every(x=>x.author==='panel2@pellmoor.test'));
   assert.deepEqual(c.notes.map(x=>x.body),['Strong workshop examples','Correction: references still pending']);
   const before=await state();for(const method of ['PATCH','DELETE'])assert.equal((await req(method,'/api/notes/'+c.notes[0].id,{},'w')).status,409);
   assert.equal((await req('DELETE','/api/activity/'+c.activity[0].id,{},'w')).status,409);assert.deepEqual(await state(),before);
 });
 await group('Independent stale UI, 409 refresh and reviewed retry',async()=>{
   await loginUI('r');await choose('ROLE-015');await open('CAND-106');
   await mutation('r',cp('CAND-105','stage'),{stage:'interview'},'ROLE-015',200);
   const before=await state();assert.equal(await clickMutation('[data-to="hired"]',cp('CAND-106','stage')),409);assert.deepEqual(await state(),before);
   await page.locator('#toast.show').waitFor();assert.match(await page.locator('#toast').textContent(),/changed since/);
   assert.equal(await clickMutation('[data-to="hired"]',cp('CAND-106','stage')),200);assert.equal((await cand('CAND-106')).candidate.stage,'hired');
 });
 await group('Simultaneous writes: exactly one note/activity/revision',async()=>{
   const before=await cand('CAND-105');const revision=before.revision;
   const responses=await Promise.all(['concurrent A','concurrent B'].map(body=>req('POST',cp('CAND-105','notes'),{body,expected_revision:revision,operation_id:randomUUID()},'w')));
   assert.deepEqual(responses.map(x=>x.status).sort(),[201,409]);const after=await cand('CAND-105');
   assert.equal(after.revision,revision+1);assert.equal(after.notes.length,before.notes.length+1);assert.equal(after.activity.length,before.activity.length+1);
 });
 await group('Success and rejection receipts replay original responses after newer work; mismatched input rejected',async()=>{
   const saved=await mutation('w',cp('CAND-106','notes'),{body:'Receipt original'},'ROLE-015',201);persistedReceipt=saved;
   await mutation('w',cp('CAND-106','notes'),{body:'Later work'},'ROLE-015',201);
   let before=await state();assert.deepEqual(await req('POST',cp('CAND-106','notes'),saved.body,'w'),{status:saved.status,data:saved.data});assert.deepEqual(await state(),before);
   const rejected=await reject('r',cp('CAND-102','stage'),{stage:'offer'},'ROLE-014',409);
   await mutation('w',cp('CAND-102','notes'),{body:'After rejection'},'ROLE-014',201);before=await state();
   assert.deepEqual(await req('POST',cp('CAND-102','stage'),rejected.body),{status:rejected.status,data:rejected.data});
   const mismatch=await req('POST',cp('CAND-102','stage'),{...rejected.body,stage:'interview'});assert.equal(mismatch.status,409);assert.match(mismatch.data.error,/different input/);assert.deepEqual(await state(),before);
 });
 await group('Malformed metadata/unknown IDs/forged fields: non-5xx and exact state preservation',async()=>{
   const before=await state(),revision=(await role()).revision;
   const baseBody={body:'must not persist',expected_revision:revision,operation_id:randomUUID()};
   const probes=[];
   for(const expected_revision of [undefined,'0',1.5,-1,revision+100])probes.push({...baseBody,expected_revision,operation_id:randomUUID()});
   for(const operation_id of [undefined,'tiny',{},12])probes.push({...baseBody,operation_id});
   for(const key of ['actor','candidate','role','history','funnel','revision'])probes.push({...baseBody,operation_id:randomUUID(),[key]:'forged'});
   for(const body of probes){const x=await req('POST',cp('CAND-102','notes'),body);assert(x.status>=400&&x.status<500,JSON.stringify(x));}
   await reject('r',cp('UNKNOWN','notes'),{body:'No'},'ROLE-014',404);
   await reject('c','/api/candidates',{role:'UNKNOWN',name:'No candidate'},'ROLE-014',404);
   await reject('c',cp('CAND-102','panel'),{member:'nobody@pellmoor.test'},'ROLE-014',404);
   assert.deepEqual(await state(),before);
 });
 await group('Pending save duplicate prevention with delayed real response',async()=>{
   await loginUI('w');await choose('ROLE-015');await open('CAND-106');const before=await cand('CAND-106');
   let release,seen;const seenPromise=new Promise(r=>seen=r);const held=new Promise(r=>release=r);let requests=0;
   await page.route('**/api/candidates/CAND-106/notes',async route=>{requests++;const response=await route.fetch();seen();await held;await route.fulfill({response});});
   await page.locator('#note').fill('Pending regression');await page.locator('#notef button').click();await seenPromise;
   assert(await page.locator('#notef button').isDisabled());assert.match(await page.locator('#progress').textContent(),/Saving/);
   await page.keyboard.press('Enter');assert.equal(requests,1);release();
   await page.waitForFunction(()=>document.body.dataset.busy==='false');await page.waitForFunction(()=>document.querySelector('#panel')?.textContent.includes('Pending regression'));
   await page.unroute('**/api/candidates/CAND-106/notes');assert.equal((await cand('CAND-106')).notes.length,before.notes.length+1);
 });
 await group('Read-only presentation journey: themes, mobile overflow, keyboard drawer, reduced motion, no data mutation',async()=>{
   await loginUI('r');const before=await state();
   assert.match(await page.locator('#roles [aria-current]').evaluate(e=>getComputedStyle(e,'::after').content),/Selected/);
   const colors=[];
   for(const theme of ['dark','light']){await page.locator('#theme').click();colors.push(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor));await page.screenshot({path:'/evidence/pellmoor-desktop-'+theme+'.png',fullPage:true});}
   assert.notEqual(colors[0],colors[1]);
   await open('CAND-104');await page.keyboard.press('Shift+Tab');assert(await page.locator('#panel').evaluate(e=>e.contains(document.activeElement)));
   await page.keyboard.press('Escape');assert(await page.locator('[data-id="CAND-104"]').evaluate(e=>e===document.activeElement));
   await page.setViewportSize({width:390,height:844});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile page overflows');
   await open('CAND-104');await page.locator('#note').scrollIntoViewIfNeeded();assert(await page.locator('#note').isVisible());
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile drawer overflows');
   await page.screenshot({path:'/evidence/pellmoor-mobile-drawer.png',fullPage:true});
   await page.emulateMedia({reducedMotion:'reduce'});
   const durations=await page.locator('#toast').evaluate(e=>getComputedStyle(e).transitionDuration.split(',').map(parseFloat));assert(durations.every(x=>x<.01));
   await page.keyboard.press('Escape');await page.setViewportSize({width:1280,height:800});
   assert.deepEqual(await state(),before);assert.deepEqual(errors,[]);
 });
 await group('Theme toggle changes rendered palette with OS dark preference',async()=>{
   const previous=page;const context=await browser.newContext({colorScheme:'dark'});page=await context.newPage();
   await loginUI('r');const color=await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor);
   await page.locator('#theme').click();assert.notEqual(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),color);
   await context.close();page=previous;
 });
 await group('Real UI backstep followed by withdrawal: chronological history and correct loss rung',async()=>{
   const baseline=await role('ROLE-017');await loginUI('c');await choose('ROLE-017');
   await page.locator('#candidate-name').fill('UI backstep '+randomUUID());
   const response=page.waitForResponse(r=>r.url().endsWith('/api/candidates')&&r.request().method()==='POST');
   await page.locator('#addcandidate button').click();const created=await response;assert.equal(created.status(),201);const id=(await created.json()).candidate.id;
   await page.waitForFunction(()=>document.body.dataset.busy==='false');
   await loginUI('r');await choose('ROLE-017');await open(id);
   for(const stage of ['screening','interview','screening','withdrawn'])assert.equal(await clickMutation(`[data-to="${stage}"]`,cp(id,'stage')),200);
   assert.deepEqual(await page.locator('#panel .history span').allTextContents(),['applied','screening','interview','screening','withdrawn']);
   assert.equal(await page.locator('#panel .history [aria-current]').count(),1);
   const current=await role('ROLE-017');assert.deepEqual(current.funnel.map((r,i)=>r.reached-baseline.funnel[i].reached),[1,1,1,0,0]);
   assert.deepEqual(current.funnel.map((r,i)=>r.still-baseline.funnel[i].still),[0,0,0,0,0]);
   assert.deepEqual(current.funnel.map((r,i)=>r.left-baseline.funnel[i].left),[0,1,0,0,0]);
   await page.reload();await page.locator('#board .cand').first().waitFor();assert.deepEqual(await role('ROLE-017'),current);
 });
 await group('Malformed score and backstep/terminal-loss edge regressions',async()=>{
   execFileSync('node',['/evidence/edge-regressions.cjs'],{stdio:'inherit'});
   assert(JSON.parse(fs.readFileSync('/evidence/edge-regressions.json')).findings.every(x=>x.passed));
 });
 await group('Actual managed process restart: all records, history, scores, notes, revisions, receipts and sessions persist',async()=>{
   const before=await state();const pid=fs.readFileSync('/logs/verifier/app.pid','utf8');
   execFileSync('bash',['/tests/app-lifecycle.sh','restart'],{stdio:'inherit'});
   assert.notEqual(fs.readFileSync('/logs/verifier/app.pid','utf8'),pid);assert.deepEqual(await state(),before);
   await page.reload();await page.locator('#board .cand').first().waitFor();assert(await page.locator('#app').isVisible());
   assert.equal((await req('GET','/api/roles',undefined,'other')).status,401);
   assert.equal((await req('GET','/api/me',undefined,'w')).status,200);
   assert.deepEqual(await req('POST',cp('CAND-106','notes'),persistedReceipt.body,'w'),{status:persistedReceipt.status,data:persistedReceipt.data});
   assert.deepEqual(await state(),before);
 });
 await browser.close();console.log('ALL LOCAL GROUPS PASSED: '+results.length);
}
main().catch(async e=>{console.error(e);if(page)await page.screenshot({path:'/evidence/failure.png',fullPage:true}).catch(()=>{});if(browser)await browser.close();process.exitCode=1;});

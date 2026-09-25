const assert = require('node:assert/strict');
const fs = require('node:fs');
const {randomUUID} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const {captureCommittedLoss}=require('/tests/functional/capture-loss.js');
const {preservePrimarySession}=require('/tests/functional/preserve-primary.js');
const base='http://127.0.0.1:3000';
const results=[];
const tokens={};
const accounts={r:'hiring',c:'coord',o:'panel1',w:'panel2'};
const ids=['ROLE-014','ROLE-015','ROLE-016','ROLE-017'];
let browser,page,persistedReceipt;
async function inPage(temporary, action) {const previous=page;page=temporary;try{return await action();}finally{page=previous;}}
async function group(name,fn){
  try {await fn(); results.push({name,status:'passed'}); console.log('PASS '+name);}
  catch(e){results.push({name,status:'failed',error:String(e.stack)});throw e;}
  finally {fs.writeFileSync('/evidence/batch-regressions.json',JSON.stringify({kind:'unpaid local regressions, not judge scores',results},null,2));}
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
async function uiCreate(name,roleId='ROLE-014'){
 await loginUI('c');await choose(roleId);await page.locator('#candidate-name').fill(name);
 const response=page.waitForResponse(r=>r.url().endsWith('/api/candidates')&&r.request().method()==='POST');
 await page.locator('#addcandidate button').click();const x=await response;assert.equal(x.status(),201);
 const id=(await x.json()).candidate.id;await page.waitForFunction(()=>document.body.dataset.busy==='false');return id;
}
async function replay(path,receipt,who='r'){
 const before=await state();assert.deepEqual(await req('POST',path,receipt.body,who),{status:receipt.status,data:receipt.data});assert.deepEqual(await state(),before);
}
const endpoint='/api/roles/ROLE-014/batch-offers';
async function startBatch(selection){
 await loginUI('r');await choose('ROLE-014');await page.locator('#batch-open').click();
 for(const id of selection)await page.locator(`[data-batch-id="${id}"]`).check();
}
async function reviewBatchUI(){
 await page.locator('#batch-review').click();await page.locator('#batch-confirm').waitFor();
 await page.waitForFunction(()=>!document.querySelector('#batch-close').disabled);
}
async function commitUI(){
 const response=page.waitForResponse(r=>r.url().endsWith(endpoint)&&r.request().method()==='POST');
 await page.locator('#batch-confirm').click();const x=await response;
 await page.waitForFunction(()=>!document.querySelector('#batch-close').disabled);
 return {status:x.status(),data:await x.json(),body:x.request().postDataJSON()};
}
async function readyAgain(selection){
 for(const id of selection){if((await cand(id)).candidate.stage==='offer')await uiMove(id,'interview');
  await uiScore(id,'o');await uiScore(id,'w');}
}
async function checkCommit(before,selected,receipt){
 const after=await state();const r=after.roles.find(x=>x.role.code==='ROLE-014'),old=before.roles.find(x=>x.role.code==='ROLE-014');
 assert.equal(r.revision,old.revision+1);assert.equal(r.capacity.reserved,old.capacity.reserved+selected.length);
 assert.equal(r.capacity.available,old.capacity.available-selected.length);assert.equal(r.capacity.filled,old.capacity.filled);
 const own=x=>{const {revision,offer_readiness,...rest}=x;return rest;};
 for(const previous of before.candidates){const now=after.candidates.find(x=>x.candidate.id===previous.candidate.id);
  if(!selected.includes(previous.candidate.id)){assert.deepEqual(own(now),own(previous));continue;}
  assert.equal(now.candidate.stage,'offer');assert.deepEqual(now.candidate.history,[...previous.candidate.history,'offer']);
  assert.equal(now.candidate.assessment_version,previous.candidate.assessment_version);
  for(const key of ['panel','scores','historical_scores','notes'])assert.deepEqual(now[key],previous[key]);
  const added=now.activity.filter(x=>!previous.activity.some(y=>y.id===x.id));assert.equal(added.length,1);
  assert.equal(added[0].actor,'hiring@pellmoor.test');assert.equal(added[0].details.batch_id,receipt.data.batch_id);
  assert.equal(added[0].details.batch_position,selected.indexOf(now.candidate.id)+1);assert.equal(added[0].details.batch_size,selected.length);
 }
 for(const id of ids.filter(x=>x!=='ROLE-014'))assert.deepEqual(after.roles.find(x=>x.role.code===id),before.roles.find(x=>x.role.code===id));
}
async function main(){
 for(const [key,name] of Object.entries(accounts))tokens[key]=(await req('POST','/api/login',{email:name+'@pellmoor.test',password:'password123'},'none')).data.token;
 browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 let A,B,C,D,firstSuccess,lostSuccess,fullRejection;
  const ledgerDir='/logs/verifier/functional-evidence';
  async function saveReceipt(label,path,receipt,before,who='r') {
    const record={actor:accounts[who]+'@pellmoor.test',method:'POST',url:base+path,operation_id:receipt.body.operation_id,request_headers:{'Content-Type':'application/json'},request_body:JSON.stringify(receipt.body),status:receipt.status,response_body:JSON.stringify(receipt.data),before,after:await state()};
    const file='/evidence/'+label+'-capture.json';fs.writeFileSync(file,JSON.stringify(record));
    execFileSync('python3',['/tests/functional/receipt-ledger.py','put',label,file],{stdio:'inherit'});
  }
  await group('Legacy stale conflict, successful receipt and rejected receipt keep their exact checkpoints',async()=>{
    await loginUI('r');await choose('ROLE-015');await open('CAND-106');
    const reviewed=(await role('ROLE-015')).revision;
    let conflict,beforeConflict;
    const preserved=await preservePrimarySession(page,{
      observePrimary:async primary=>({url:primary.url(),drawer:await primary.locator('#panel').textContent()}),
      preparePrimary:async()=>({reviewed}),
      actSecondary:async secondary=>inPage(secondary,async()=>{
        await loginUI('r');await choose('ROLE-015');await open('CAND-105');
        assert.equal(await clickMutation('[data-to=screening]',cp('CAND-105','stage')),200);
        return {revision:(await role('ROLE-015')).revision};
      }),
      resumePrimary:async()=>{
        beforeConflict=await state();
        const waiting=page.waitForResponse(r=>r.url().endsWith(cp('CAND-106','stage')));
        await page.locator('[data-to=hired]').click();const response=await waiting;
        conflict={status:response.status(),body:response.request().postDataJSON(),data:await response.json()};
        await page.waitForFunction(()=>document.body.dataset.busy==='false');
        assert.equal(conflict.status,409);assert.equal(conflict.body.expected_revision,reviewed);
        assert.deepEqual(await state(),beforeConflict);
        await saveReceipt('legacy_stale_conflict',cp('CAND-106','stage'),conflict,beforeConflict);
        await page.locator('#close').waitFor();
        assert.equal(await clickMutation('[data-to=hired]',cp('CAND-106','stage')),200);
        assert.equal((await cand('CAND-106')).candidate.stage,'hired');
        return {stale_status:conflict.status,retry_stage:'hired'};
      }
    });
    fs.writeFileSync('/evidence/legacy-preserved-session.json',JSON.stringify(preserved,null,2));assert.equal(preserved.setup_error,null);
    await loginUI('r');await choose('ROLE-015');await open('CAND-105');await page.locator('#note').fill('Original legacy successful receipt');
    let before=await state();const waiting=page.waitForResponse(r=>r.url().endsWith(cp('CAND-105','notes')));
    await page.locator('#notef button').click();const response=await waiting;
    const success={status:response.status(),body:response.request().postDataJSON(),data:await response.json()};
    await page.waitForFunction(()=>document.body.dataset.busy==='false');assert.equal(success.status,201);
    await saveReceipt('legacy_note_success',cp('CAND-105','notes'),success,before);await replay(cp('CAND-105','notes'),success);
    before=await state();const rejection=await reject('r',cp('CAND-105','stage'),{stage:'hired'},'ROLE-015',409);
    await saveReceipt('legacy_stage_rejection',cp('CAND-105','stage'),rejection,before);
    await uiMove('CAND-105','interview');await replay(cp('CAND-105','stage'),rejection);
    before=await state();const mismatch=await req('POST',cp('CAND-105','stage'),{...rejection.body,stage:'withdrawn'});
    assert.equal(mismatch.status,409);assert.match(mismatch.data.error,/operation|different|identity|payload/i);assert.deepEqual(await state(),before);
    execFileSync('python3',['/tests/functional/receipt-ledger.py','check','--scope','legacy'],{stdio:'inherit'});
  });
  await group('Offer hired and terminal frozen writes reject without changing any product state',async()=>{
    for(const stage of ['offer','hired']) {
      await uiMove('CAND-106',stage);
      await reject('c',cp('CAND-106','panel'),{member:'hiring@pellmoor.test',action:'add'},'ROLE-015');
      await reject('c',cp('CAND-106','panel'),{member:'panel2@pellmoor.test',action:'remove'},'ROLE-015');
      await reject('o',cp('CAND-106','score'),{score:3},'ROLE-015');
    }
    for(const [id,roleId] of [['CAND-103','ROLE-014'],['CAND-107','ROLE-015']]) {
      await reject('c',cp(id,'panel'),{member:'panel1@pellmoor.test',action:'add'},roleId);
      await reject('c',cp(id,'panel'),{member:'panel1@pellmoor.test',action:'remove'},roleId);
    }
  });
  await group('Original individual capacity receipts and Wren note persist outside the batch fixture',async()=>{
    const individual=[];
    for(const label of ['A','B']) {
      const id=await uiCreate('Individual '+label+' '+randomUUID().slice(0,6),'ROLE-017');individual.push(id);
      await uiMove(id,'screening');await uiMove(id,'interview');await uiPanel(id,'o');await uiPanel(id,'w');await uiScore(id,'o');await uiScore(id,'w');
    }
    let before=await state();const win=await mutation('r',cp(individual[0],'stage'),{stage:'offer'},'ROLE-017',200);
    await saveReceipt('individual_offer_success',cp(individual[0],'stage'),win,before);
    before=await state();const full=await reject('r',cp(individual[1],'stage'),{stage:'offer'},'ROLE-017',409);
    assert.match(full.data.error,/opening|capacity/i);await saveReceipt('individual_capacity_rejection',cp(individual[1],'stage'),full,before);
    await uiMove(individual[0],'withdrawn');await replay(cp(individual[0],'stage'),win);await replay(cp(individual[1],'stage'),full);
    await uiMove(individual[1],'offer');await uiMove(individual[1],'hired');
    await loginUI('w');await choose('ROLE-017');await open(individual[0]);await page.locator('#note').fill('Original restart ledger note');
    before=await state();const observed=page.waitForResponse(r=>r.url().endsWith(cp(individual[0],'notes'))&&r.request().method()==='POST');
    await page.locator('#notef button').click();const response=await observed;const note={status:response.status(),data:await response.json(),body:response.request().postDataJSON()};
    await page.waitForFunction(()=>document.body.dataset.busy==='false');await saveReceipt('wren_note_success',cp(individual[0],'notes'),note,before,'w');
  });
 await group('Batch fixture through real UI: four applicants, current assessments and two free openings',async()=>{
  for(const c of (await role()).candidates.filter(c=>['offer','hired'].includes(c.stage)))await uiMove(c.id,'withdrawn');
  const created=[];
  for(const name of ['A','B','C','D']){
   const id=await uiCreate('Batch '+name+' '+randomUUID().slice(0,6));created.push(id);
   await uiMove(id,'screening');await uiMove(id,'interview');await uiPanel(id,'o');await uiPanel(id,'w');
   await uiScore(id,'o');if(name!=='B')await uiScore(id,'w');
  }
  [A,B,C,D]=created;assert.equal((await role()).capacity.available,2);
 });
 await group('Read-only selection, blocked and ready reviews, cancellation, geometry and keyboard focus',async()=>{
  const before=await state();await startBatch([A,B]);await reviewBatchUI();
  assert(await page.locator('#batch-confirm').isDisabled());assert.match(await page.locator('.batch-warning').textContent(),/score/);
  assert.equal(await page.locator('#batch-count').textContent(),'2');assert.deepEqual(await state(),before);
  assert.match(await page.locator('.batch-metrics').textContent(),/0 reserved · 0 filled.*2 reserved · 0 filled/s);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'batch-open');
  await startBatch([A,C]);await reviewBatchUI();assert.equal(await page.locator('#batch-confirm').isDisabled(),false);
  for(const width of [1280,390,320])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:width===1280?800:844});
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert(await page.locator('#batch-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth));
   const bad=await page.locator('.batch-choice b,.batch-choice small,.batch-state,.batch-metrics>div').evaluateAll(es=>es.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent));assert.deepEqual(bad,[]);
   await page.locator('#batch-confirm').scrollIntoViewIfNeeded();assert((await page.locator('#batch-confirm').boundingBox()).height>=44);
   await page.screenshot({path:`/evidence/batch-review-${width}-${theme}.png`});
  }
  await page.setViewportSize({width:1280,height:800});await page.keyboard.press('Escape');assert.deepEqual(await state(),before);
 });
 await group('Single atomic commit: exact history, one revision and one linked event per applicant',async()=>{
  await startBatch([A,C]);await reviewBatchUI();const before=await state();firstSuccess=await commitUI();assert.equal(firstSuccess.status,200);
  await checkCommit(before,[A,C],firstSuccess);await saveReceipt('batch_ac_success',endpoint,firstSuccess,before);await page.screenshot({path:'/evidence/batch-complete.png'});
  await readyAgain([A,C]);
 });
 await group('Reject eligible-first and invalid-first batches and aggregate overcapacity without any product write',async()=>{
  const b=await cand(B);assert.equal(b.candidate.stage,'interview');assert.deepEqual(b.panel,['panel1@pellmoor.test','panel2@pellmoor.test']);assert.deepEqual(b.scores.map(s=>s.panel_member),['panel1@pellmoor.test']);
  fs.writeFileSync('/evidence/b-missing-wren-setup.json',JSON.stringify(b,null,2));
  for(const selection of [[A,B],[B,A],[A,C,D]])await reject('r',endpoint,{candidate_ids:selection},'ROLE-014',409);
  await uiScore(B,'w');
 });
 await group('Batch roles, malformed selection, foreign/unknown IDs and ownership claims',async()=>{
  for(const who of ['c','o','w'])await reject(who,endpoint,{candidate_ids:[A,C]},'ROLE-014',403);
  for(const selection of [[],[A,A],[A,'CAND-UNKNOWN'],[A,'CAND-105'],A,{},[true]])await reject('r',endpoint,{candidate_ids:selection},'ROLE-014');
  for(const key of ['capacity','assessment_version','actor'])await reject('r',endpoint,{candidate_ids:[A,C],[key]:'forged'},'ROLE-014',400);
 });
 await group('Stale reviewed revision is refused once, selection retained, explicit new review then commit',async()=>{
  await startBatch([A,C]);await reviewBatchUI();const reviewed=(await role()).revision;
  const preserved=await preservePrimarySession(page,{
    observePrimary:async primary=>({status:await primary.locator('#batch-status').textContent()}),
    preparePrimary:async()=>({reviewed,selection:[A,C]}),
    actSecondary:async secondary=>inPage(secondary,async()=>{
      await loginUI('w');await choose('ROLE-014');await open(B);await page.locator('#note').fill('Concurrent review change');
      assert.equal(await clickMutation('#notef button',cp(B,'notes')),201);return {revision:(await role()).revision};
    }),
    resumePrimary:async()=>{
      const before=await state();let sent=0;const observe=r=>{if(r.url().endsWith(endpoint)&&r.method()==='POST')sent++;};page.on('request',observe);
      try {
        const refusal=await commitUI();assert.equal(refusal.status,409);assert.equal(refusal.body.expected_revision,reviewed);assert.deepEqual(await state(),before);
        assert.equal(await page.locator('[data-batch-id]:checked').count(),2);assert.match(await page.locator('#batch-status').textContent(),/Review it again/);
        await page.waitForTimeout(300);assert.equal(sent,1);await reviewBatchUI();const accepted=await commitUI();assert.equal(accepted.status,200);
        assert.notEqual(accepted.body.operation_id,refusal.body.operation_id);await checkCommit(before,[A,C],accepted);return {refusal,accepted};
      } finally {page.off('request',observe);}
    }
  });
  fs.writeFileSync('/evidence/batch-stale-preserved-session.json',JSON.stringify(preserved,null,2));assert.equal(preserved.setup_error,null);
  await readyAgain([A,C]);
 });
 await group('Batch versus individual and overlapping batch races accept either whole winner, never a partial batch',async()=>{
  let before=await state();let revision=(await role()).revision;
  const responses=await Promise.all([
   req('POST',endpoint,{candidate_ids:[A,C],expected_revision:revision,operation_id:randomUUID()}),
   req('POST',cp(D,'stage'),{stage:'offer',expected_revision:revision,operation_id:randomUUID()})]);
  assert.deepEqual(responses.map(x=>x.status).sort(),[200,409]);assert.equal((await role()).revision,revision+1);
  const selected=responses[0].status===200?[A,C]:[D];
  assert.equal((await role()).capacity.reserved,selected.length);
  for(const id of [A,C,D])assert.equal((await cand(id)).candidate.stage,selected.includes(id)?'offer':'interview');
  if(responses[0].status===200)await checkCommit(before,[A,C],responses[0]);
  await readyAgain(selected);before=await state();revision=(await role()).revision;
  const pairs=[[A,C],[C,D]];const raced=await Promise.all(pairs.map(candidate_ids=>req('POST',endpoint,{candidate_ids,expected_revision:revision,operation_id:randomUUID()})));
  assert.deepEqual(raced.map(x=>x.status).sort(),[200,409]);const winner=raced.findIndex(x=>x.status===200);
  await checkCommit(before,pairs[winner],raced[winner]);await readyAgain(pairs[winner]);
 });
 await group('Lost confirmation response, duplicate prevention, exact retry and current view after another session withdraws',async()=>{
  await startBatch([C,D]);await reviewBatchUI();const lossBefore=await state();
  const preserved=await preservePrimarySession(page,{
    observePrimary:async primary=>({status:await primary.locator('#batch-status').textContent()}),
    preparePrimary:async()=>{
      const capture=await captureCommittedLoss(page,{url:base+endpoint,method:'POST',activate:()=>page.locator('#batch-confirm').click(),observePending:async()=>({retryDisabled:await page.locator('#batch-retry').isDisabled()}),activateAgain:()=>page.keyboard.press('Enter')});
      fs.writeFileSync('/evidence/capture-helper-result.json',JSON.stringify(capture,null,2));
      assert.equal(capture.setup_error,null);assert.equal(capture.requests_while_pending,1);assert(capture.pending.retryDisabled);
      const originalResponse=capture.requests[0];lostSuccess={status:originalResponse.status,data:originalResponse.response_json,body:JSON.parse(originalResponse.request_body)};
      await saveReceipt('batch_cd_lost_success',endpoint,lostSuccess,lossBefore);
      await page.waitForFunction(()=>!document.querySelector('#batch-retry').disabled);assert.match(await page.locator('#batch-status').textContent(),/outcome could not be confirmed/);
      return capture;
    },
    actSecondary:async secondary=>inPage(secondary,async()=>{await uiMove(C,'withdrawn');return {stage:(await cand(C)).candidate.stage};}),
    resumePrimary:async()=>{
      const before=await state();const response=page.waitForResponse(r=>r.url().endsWith(endpoint));await page.locator('#batch-retry').click();const retried=await response;
      assert.deepEqual(retried.request().postDataJSON(),lostSuccess.body);assert.deepEqual(await retried.json(),lostSuccess.data);
      await page.waitForFunction(()=>!document.querySelector('#batch-close').disabled);assert.deepEqual(await state(),before);
      assert.match(await page.locator('#role-sub').textContent(),/1 reserved.*1 available/);return {status:retried.status(),live_stage:(await cand(C)).candidate.stage};
    }
  });
  fs.writeFileSync('/evidence/batch-lost-preserved-session.json',JSON.stringify(preserved,null,2));assert.equal(preserved.setup_error,null);
  await page.locator('#batch-finish').click();
  assert(await page.locator('.col.terminal .cand[data-id="'+C+'"]').isVisible());
 });
 await group('Historical success/rejection replay after room becomes available, array mismatch and actor/session isolation',async()=>{
  const fullBefore=await state();fullRejection=await reject('r',endpoint,{candidate_ids:[A,B]},'ROLE-014',409);await saveReceipt('batch_ab_capacity_rejection',endpoint,fullRejection,fullBefore);await uiMove(D,'withdrawn');
  assert.equal((await req('POST','/api/roles/ROLE-014/batch-preview',{candidate_ids:[A,B]})).data.ready,true);
  await replay(endpoint,fullRejection);const authBefore=await state();const fresh=await req('POST',endpoint,{candidate_ids:[A,B],expected_revision:(await role()).revision,operation_id:randomUUID()},'c');assert.equal(fresh.status,403);assert.deepEqual(await state(),authBefore);const success=await mutation('r',endpoint,{candidate_ids:[A,B]},'ROLE-014',200);
  await replay(endpoint,firstSuccess);await replay(endpoint,{...firstSuccess,body:Object.fromEntries(Object.entries(firstSuccess.body).reverse())});
  const before=await state();assert.equal((await req('POST',endpoint,{...firstSuccess.body,candidate_ids:[C,A]})).status,409);assert.deepEqual(await state(),before);
  assert.equal((await req('POST','/api/logout',{},'r')).status,200);assert.equal((await req('POST',endpoint,firstSuccess.body)).status,401);
  tokens.r=(await req('POST','/api/login',{email:'hiring@pellmoor.test',password:'password123'},'none')).data.token;
  await replay(endpoint,firstSuccess);
  const calBefore=await state();const historical=await req('POST',endpoint,firstSuccess.body,'c');assert(historical.status>=400&&historical.status<500);assert.deepEqual(await state(),calBefore);assert.notDeepEqual(historical.data,firstSuccess.data);
  assert.equal(fresh.status,403);
  const mismatch=await req('POST',endpoint,{...firstSuccess.body,candidate_ids:[C,A]},'c');assert.equal(mismatch.status,409);assert.deepEqual(await state(),calBefore);
  fs.writeFileSync('/evidence/cal-probe-results.json',JSON.stringify({historical_status:historical.status,historical_reason:historical.data.error,fresh_status:fresh.status,fresh_reason:fresh.data.error,own_receipt_mismatch_status:mismatch.status,product_state_unchanged:true},null,2));
 });
 await group('Actual restart preserves batch receipts, exact product state and current UI',async()=>{
  execFileSync('python3',['/tests/functional/receipt-ledger.py','check'],{stdio:'inherit'});const before=await state();execFileSync('bash',['/tests/app-lifecycle.sh','restart'],{stdio:'inherit'});assert.deepEqual(await state(),before);
  const ledgerFiles=fs.readdirSync(ledgerDir).filter(name=>name.endsWith('.json'));assert.equal(ledgerFiles.length,9);
  for(const name of ledgerFiles) {
    const record=JSON.parse(fs.readFileSync(ledgerDir+'/'+name));const who=record.actor==='panel2@pellmoor.test'?'w':'r';
    tokens[who]=(await req('POST','/api/login',{email:record.actor,password:'password123'},'none')).data.token;
    await replay(new URL(record.url).pathname,{body:JSON.parse(record.request_body),status:record.status,data:JSON.parse(record.response_body)},who);
  }
  execFileSync('python3',['/tests/functional/receipt-ledger.py','check'],{stdio:'inherit'});
  await loginUI('r');assert.match(await page.locator('#role-sub').textContent(),/2 reserved.*0 available/);assert.deepEqual(errors,[]);
 });
 fs.writeFileSync('/evidence/batch-receipt-evidence.json',JSON.stringify({fixture:{A,B,C,D},firstSuccess,lostSuccess,fullRejection},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});

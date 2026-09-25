const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const base='http://127.0.0.1:3000',results=[];
let browser,ada,ben,attemptId;
async function check(name,fn){await fn();results.push({name,passed:true});console.log('PASS '+name);}
async function api(path,token,body,method){const r=await fetch(base+path,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
async function login(name){const r=await api('/api/auth/login',null,{email:name+'@coursemark.example',password:'Coursemark!2026'});assert.equal(r.status,200);return r.data.token;}
async function get(path,t=ada){const r=await api(path,t);assert.equal(r.status,200);return r.data;}
async function write(path,token,body={},method='POST'){const r=await api(path,token,{...body,expected_revision:(await get('/api/me',token)).revision,operation_id:randomUUID()},method);assert(r.status===200||r.status===201,JSON.stringify(r));return r.data;}
async function snapshot(){return Promise.all(['/api/me','/api/assessments','/api/attempts','/api/audit','/api/outcomes'].map(p=>get(p)));}
async function action(page,selector,path){const pending=page.waitForResponse(r=>r.url().endsWith(path)&&r.request().method()!=='GET');await page.locator(selector).click();const r=await pending;await r.finished();return r;}
(async()=>{
 await check('distinct public deployment-health contract needs no authentication',async()=>{const r=await api('/api/health');assert.equal(r.status,200);assert.equal(r.data.ok,true);assert(!('users' in r.data||'attempts' in r.data||'courses' in r.data));});
 ada=await login('ada.mensah');ben=await login('ben.okafor');
 await check('bounded Functional handoff leaves a graded hidden written attempt without changing weighted results',async()=>{
  const before=await get('/api/outcomes');
  const a=await write('/api/assessments',ada,{course_id:'BIO-214',title:'Review practice',opens_at:'2026-09-02T11:00:00Z',due_at:'2026-09-02T13:00:00Z',duration_minutes:30,max_attempts:1});
  const id=a.assessment.id;await write('/api/assessments/'+id+'/items',ada,{kind:'written',prompt:'Explain one sampling bias',points:2,criterion_label:'Explains bias'});await write('/api/assessments/'+id+'/publish',ada);
  const started=await write('/api/assessments/'+id+'/start',ben);attemptId=started.attempt.id;
  await write('/api/attempts/'+attemptId+'/submit',ben);
  const at=(await get('/api/attempts')).attempts.find(a=>a.id===attemptId);
  await write('/api/attempts/'+attemptId+'/grades/'+at.items[0].rubric[0].id,ada,{score:1,feedback:'Reviewable practice'},'PUT');
  const graded=(await get('/api/attempts')).attempts.find(a=>a.id===attemptId);assert.equal(graded.status,'graded');assert.equal(graded.feedback_status,'hidden');
  const after=await get('/api/outcomes');assert.equal(after.assessments.find(a=>a.id===id).weight,0);assert.deepEqual(after.rows.map(r=>[r.student.id,r.final_percentage]),before.rows.map(r=>[r.student.id,r.final_percentage]));
 });
 browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 await check('Polish worksheet validation and release preview complete without accepted course writes',async()=>{
  const p=await browser.newPage({viewport:{width:375,height:812}});await p.goto(base);await p.locator('#login-email').fill('ada.mensah@coursemark.example');await p.locator('#login-password').fill('Coursemark!2026');await p.locator('#login-form button[type=submit]').click();await p.locator('#app-view').waitFor({state:'visible'});await p.locator('.tab[data-view=gradebook]').click();
  const before=await snapshot();await p.locator('[data-worksheet="'+attemptId+'"]').click();
  const selected=p.locator('#worksheet-rows [data-include]');await selected.uncheck();
  assert.equal((await action(p,'#worksheet-form button[type=submit]','/api/grading-worksheet/'+attemptId)).status(),400);await p.locator('#worksheet-error').filter({hasText:'distinct rubric rows'}).waitFor();await selected.check();assert.equal(await p.locator('#worksheet-rows [data-worksheet-score]').inputValue(),'1');
  await p.keyboard.press('Escape');await p.locator('#worksheet-dialog').waitFor({state:'hidden'});assert(await p.evaluate(()=>document.activeElement!==document.body));
  await p.locator('#open-release-batch').click();await p.locator('[data-release-choice="'+attemptId+'"]').check();assert.equal((await action(p,'#preview-release','/api/release-plans')).status(),200);await p.locator('#release-preview').filter({hasText:'Review practice'}).waitFor();assert(await p.locator('#commit-release').isEnabled());
  await p.locator('[data-release-choice="'+attemptId+'"]').uncheck();assert(await p.locator('#commit-release').isDisabled());await p.locator('[data-release-choice="'+attemptId+'"]').check();assert.equal((await action(p,'#preview-release','/api/release-plans')).status(),200);await p.locator('#release-preview').filter({hasText:'Review practice'}).waitFor();
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.keyboard.press('Escape');await p.locator('#release-batch-dialog').waitFor({state:'hidden'});assert.deepEqual(await snapshot(),before);await p.close();
 });
 await browser.close();fs.writeFileSync('/evidence/rubric-workflow.json',JSON.stringify({kind:'Local workflow evidence, not platform rubric QC or model scores',results},null,2));
})().catch(async error=>{console.error(error);results.push({passed:false,error:String(error),stack:error.stack});fs.writeFileSync('/evidence/rubric-workflow.json',JSON.stringify({results},null,2));if(browser)await browser.close();process.exitCode=1;});

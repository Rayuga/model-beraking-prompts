const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const results=[];
let browser,armed=null,last=null;
const people={ruth:'ruth.adebayo',arun:'arun.das',leila:'leila.ward',owen:'owen.park'};
async function api(page,url,method='GET',body){return page.evaluate(async({url,method,body})=>{const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()};},{url,method,body});}
async function login(who){const page=await (await browser.newContext()).newPage();page.on('dialog',d=>d.accept());await page.goto('http://localhost:3000');await page.getByLabel('Email',{exact:true}).fill(people[who]+'@commonground.example');await page.getByLabel('Password',{exact:true}).fill('CommonGround!2026');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.locator('#app-view').waitFor({state:'visible'});return page;}
async function snap(page){return {ballots:(await api(page,'/api/ballots')).body,members:(await api(page,'/api/members')).body,audit:(await api(page,'/api/audit')).body};}
async function main(){
 browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const pages={};for(const who of Object.keys(people)) pages[who]=await login(who);
 const ruth=pages.ruth,exchanges={};
 await ruth.route('**/api/**',async route=>{
  const req=route.request();
  if(!armed||!['POST','PATCH'].includes(req.method())) return route.continue();
  const family=armed;armed=null;
  const url=req.url(),method=req.method(),body=req.postDataJSON(),before=await snap(ruth);
  try{
   for(const who of ['arun','leila','owen']){
    const copy={...body,operation_id:crypto.randomUUID()};
    const r=await api(pages[who],url,method,copy);assert.equal(r.status,403,`${family}/${who}: ${JSON.stringify(r)}`);assert.deepEqual(await snap(ruth),before);
    results.push({name:`${family} denied for ${who} in eligible current state`,passed:true});
    if(who!=='arun'){
     const forged=await api(pages[who],url,method,{...copy,operation_id:crypto.randomUUID(),actor_id:'user-ruth',user_id:'user-ruth',role:'Coordinator'});
     assert.equal(forged.status,403);assert.deepEqual(await snap(ruth),before);
     results.push({name:`${family} ignores forged Ruth authority from ${who}`,passed:true});
    }
   }
   exchanges[family]={url,method,body};
   await route.continue();
  }catch(e){last=e;await route.abort();}
 });
 async function action(family,click){armed=family;const wait=ruth.waitForResponse(r=>r.request().method()!=='GET'&&r.url().includes('/api/')&&!r.url().includes('/auth/'));await click();const r=await wait;if(last)throw last;assert(r.status()>=200&&r.status()<300,`${family}: ${r.status()}`);results.push({name:`${family} genuine authorized UI positive control`,passed:true});await ruth.locator('#ballot-dialog').waitFor({state:'hidden'});return r.json();}
 await ruth.getByRole('button',{name:'New ballot',exact:true}).click();
 await ruth.getByLabel('Ballot title',{exact:true}).fill('Role matrix ballot');
 await ruth.getByLabel('Voting method').selectOption('single');
 await ruth.locator('input[name=choice]').nth(0).fill('Yes');await ruth.locator('input[name=choice]').nth(1).fill('No');
 const created=await action('create',()=>ruth.getByRole('button',{name:'Save draft',exact:true}).click());const id=created.ballot.id;
 await ruth.reload();await ruth.locator(`[data-ballot-edit="${id}"]`).click();await ruth.getByLabel('Ballot title',{exact:true}).fill('Role matrix edited');
 await action('edit',()=>ruth.getByRole('button',{name:'Save draft',exact:true}).click());
 for(const step of ['open','close','publish']){
  await ruth.reload();const button=ruth.locator(`[data-ballot-card="${id}"] [data-ballot-action="${step}"]`);
  await action(step,()=>button.click());
 }
 await ruth.reload();await ruth.locator('.nav-item[data-view="members"]').click();
 await action('membership',()=>ruth.locator('[data-member-id="user-owen"]').click());
 const published=(await api(ruth,'/api/ballots')).body.ballots.find(b=>b.id===id);
 for(const family of ['edit','open','close','publish']){
  const e=exchanges[family],before=await snap(ruth);
  const r=await api(ruth,e.url,e.method,{...e.body,expected_revision:published.revision,operation_id:crypto.randomUUID()});
  assert.equal(r.status,409,JSON.stringify(r));assert.deepEqual(await snap(ruth),before);
  results.push({name:`Published blocks current-revision ${family}`,passed:true});
 }
 assert.equal(results.length,40);
 fs.writeFileSync('/results/roles-results.json',JSON.stringify({results},null,2));
 await browser.close();console.log('PASS',results.length,'role, identity and terminal-state checks');
}
main().catch(e=>{console.error(e);fs.writeFileSync('/results/roles-failure.json',JSON.stringify({error:String(e),results},null,2));process.exit(1);});

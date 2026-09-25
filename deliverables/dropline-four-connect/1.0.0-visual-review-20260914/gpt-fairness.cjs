const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const results=[];
 try {
 const p=await browser.newPage(),q=await browser.newPage();
 async function login(page){await page.goto('http://localhost:3000');await page.locator('#signin-email').fill('avery@dropline.test');await page.locator('#signin-password').fill('password123');const response=page.waitForResponse(r=>r.url().endsWith('/api/auth/signin'));await page.locator('[data-signin-button]').click();const data=await (await response).json();await page.locator('[data-action="newgame"]').waitFor();return data.token;}
 const a=await login(p),b=await login(q);assert.notEqual(a,b);results.push({name:'Separate real login submissions issue distinct tokens',passed:true});
 async function action(selector,path){const wait=p.waitForResponse(r=>r.url().endsWith(path)&&r.request().method()==='POST');await p.locator(selector).click();await (await wait).finished();await p.waitForFunction(()=>!document.querySelector('[data-action="newgame"]').disabled);}
 await action('[data-action="newgame"]','/api/game/new');
 let release,arrive,count=0;const held=new Promise(r=>release=r),arrived=new Promise(r=>arrive=r);
 await p.route('**/api/game/move',async route=>{count++;const response=await route.fetch();arrive();await held;await route.fulfill({response});});
 await p.locator('[data-column-control][data-column="2"]').click();await arrived;
 const disabled=await p.locator('[data-column-control][data-column="2"]').isDisabled();assert(disabled);
 const target=await p.locator('[data-column-control][data-column="2"]').boundingBox();await p.mouse.click(target.x+target.width/2,target.y+target.height/2);release();
 await p.waitForFunction(()=>!document.querySelector('[data-action="newgame"]').disabled);await p.unroute('**/api/game/move');assert.equal(count,1);results.push({name:'Real pending game repeat, response held, only one request',passed:true,requests:count});
 const focus=await p.evaluate(()=>document.activeElement.tagName);results.push({name:'Game focus after activation',activeElement:focus,defectReproduced:focus==='BODY'});
 const auth={Authorization:'Bearer '+a,'Content-Type':'application/json'};
 const jget=async path=>(await fetch('http://localhost:3000'+path,{headers:auth})).json();
 await action('[data-action="newgame"]','/api/game/new');
 for(const col of [1,7,2,7,3,6,4])await action(`[data-column-control][data-column="${col}"]`,'/api/game/move');
 const archive=await jget('/api/archive'),source=archive.archive[0].matchId;
 const post=async(path,body)=>{const r=await fetch('http://localhost:3000'+path,{method:'POST',headers:auth,body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const creation={operationId:crypto.randomUUID(),sourceMatchId:source,sourceStep:0,name:'Fairness local '+crypto.randomUUID()};
 const created=await post('/api/analyses',creation);assert.equal(created.status,200);const id=created.data.analysis.id;
 const repeated=await post('/api/analyses',{...creation,operationId:crypto.randomUUID()});results.push({name:'Distinct intended same-name study creation',defectReproduced:repeated.data.analysis.id===id,explanation:'New operation returns existing study, although separate analyses may share a name'});
 await p.reload();await p.locator(`[data-action="open-analysis"][data-analysis-id="${id}"]`).first().click();await p.locator('[data-analysis-column-control]').first().waitFor();
 let analysisCount=0,releaseA,arriveA;const heldA=new Promise(r=>releaseA=r),arrivedA=new Promise(r=>arriveA=r);
 await p.route('**/api/analyses/*/move',async route=>{analysisCount++;const response=await route.fetch();arriveA();await heldA;await route.fulfill({response});});
 await p.locator('[data-analysis-column-control][data-column="2"]').click();await arrivedA;
 assert(await p.locator('[data-analysis-column-control][data-column="2"]').isDisabled());
 const targetA=await p.locator('[data-analysis-column-control][data-column="2"]').boundingBox();await p.mouse.click(targetA.x+targetA.width/2,targetA.y+targetA.height/2);releaseA();
 await p.waitForFunction(()=>!document.querySelector('[data-analysis-column-control]').disabled);await p.unroute('**/api/analyses/*/move');assert.equal(analysisCount,1);results.push({name:'Real pending analysis repeat, response held, only one request',passed:true,requests:analysisCount});
 const current=(await jget('/api/analyses/'+id)).analysis;
 const numericString=await post('/api/analyses/'+id+'/move',{operationId:crypto.randomUUID(),expectedRevision:String(current.revision),column:3});results.push({name:'String revision is accepted contrary to strict typed contract',defectReproduced:numericString.status===200,status:numericString.status});
 fs.writeFileSync('/evidence/gpt-fairness.json',JSON.stringify({kind:'Local reproduction on unmodified GPT artifact; not a regrade',results},null,2));console.log(JSON.stringify(results));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

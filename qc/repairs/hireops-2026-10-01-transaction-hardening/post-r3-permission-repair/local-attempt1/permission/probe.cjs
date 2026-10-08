'use strict';
const fs = require('fs'), assert = require('assert/strict'), crypto = require('crypto');
const {spawn} = require('child_process');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const out = '/evidence', source = '/source/solution/app';
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const users = {r:'rafael.costa',c:'mei.lin',a1:'ingrid.sorensen',a2:'bill.okafor',a3:'yuki.tanaka',f:'farah.nasser',u:'aud.halvorsen'};
const economicKeys = ['requisitions','offers','commitment_movements','equity_grants','equity_cancellations','remittances','referral_accruals','after_images','audit'];
const economics = data => Object.fromEntries(economicKeys.map(k=>[k,k==='audit'?data[k].filter(x=>!['LOGIN','LOGOUT'].includes(x.action)):data[k]]));
const save = (name, data) => fs.writeFileSync(out+'/'+name, JSON.stringify(data,null,2));
const sourceHash = hash(fs.readFileSync(source+'/src/change-sets.js'));
const summary = {scope:'Finite private-copy browser mutation witness for quality row32; fixture setup uses HTTP. Not a configured judge grade, reward, Oracle or target-builder score.', source_sha256:sourceHash, results:[]};

async function run(variant) {
  const app='/tmp/row32-'+variant;
  fs.cpSync(source,app,{recursive:true});
  let code=fs.readFileSync(app+'/src/change-sets.js','utf8');
  if(variant==='save_then_forbid') {
    const auth="app.post('/api/change-sets/preview', auth('finance_controller'), (req,res) => {";
    assert.equal(code.split(auth).length,2);
    code=code.replace(auth,"app.post('/api/change-sets/preview', auth(), (req,res) => {");
    const completion="    }).immediate();\n    res.json(result);\n  });\n  app.post('/api/change-sets/:id/commit'";
    assert.equal(code.split(completion).length,2);
    code=code.replace(completion,"    }).immediate();\n    if (req.user.role !== 'finance_controller') return res.status(403).json({error:'Finance role required'});\n    res.json(result);\n  });\n  app.post('/api/change-sets/:id/commit'");
    fs.writeFileSync(app+'/src/change-sets.js',code);
    fs.writeFileSync(out+'/mutant-change-sets.js',code);
  }
  const record={variant,module_sha256:hash(code),observations:[]};
  let child,browser,logs='',serial=0;
  const base='http://127.0.0.1:3032', cookies={};
  async function api(actor,path,body) {
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(cookies[actor]?{cookie:cookies[actor]}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
  }
  const terms={base_salary_cents:1000,signing_bonus_cents:100,relocation_cents:321,equity_units:7,equity_fair_cents:102,equity_strike_cents:1};
  async function fixtureHire(reqId) {
    const id='R32-O'+(++serial);
    assert.equal((await api('r','/api/offers',{id,req_id:reqId,candidate:id,start_date:'2024-02-29T12:34:56.789Z',...terms})).status,200);
    assert.equal((await api('a3','/api/offers/'+id+'/approve',{})).status,200);
    return id;
  }
  async function login(page,actor) {
    await page.goto(base);
    await page.getByLabel('Email',{exact:true}).fill(users[actor]+'@hireops.example');
    await page.getByLabel('Password',{exact:true}).fill('Hireops!2026');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('heading',{name:'Coordinated Changes',exact:true}).waitFor();
  }
  try {
    child=spawn('node',[app+'/server.js'],{env:{...process.env,PORT:'3032',DB_PATH:'/tmp/row32-'+variant+'.db'},stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
    let ready=false;
    for(let i=0;i<100;i++){try{if((await api('','/api/health')).status===200){ready=true;break;}}catch{}await sleep(50);}
    assert.ok(ready);
    for(const actor of ['r','a3']){const r=await api('','/api/auth/login',{email:users[actor]+'@hireops.example',password:'Hireops!2026'});assert.equal(r.status,200);cookies[actor]=r.cookie.split(';')[0];}
    assert.equal((await api('r','/api/requisitions',{id:'R32-REQ',title:'Row32 authorization trace',dept:'Research',budget_cents:1000000})).status,200);
    const ids=[await fixtureHire('R32-REQ'),await fixtureHire('R32-REQ')];
    browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
    const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();
    const bootstrapSeen=page.waitForResponse(r=>r.request().method()==='GET'&&r.url().includes('/api/bootstrap'));
    await login(page,'f'); const bootstrapResponse=await bootstrapSeen;
    const readUrl=bootstrapResponse.url();
    await page.getByLabel('Operation key',{exact:true}).fill('R32-FINANCE-CONTROL');
    await page.getByLabel('Member 1 source offer',{exact:true}).selectOption(ids[0]);
    await page.getByLabel('Member 2 source offer',{exact:true}).selectOption(ids[1]);
    const requestPromise=page.waitForRequest(r=>r.method()==='POST'&&r.url().includes('/change-sets/'));
    const responsePromise=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/change-sets/'));
    await page.getByRole('button',{name:'Preview coordinated change',exact:true}).click();
    const observed=await requestPromise,response=await responsePromise;
    assert.equal(response.status(),200); const control=await response.json();
    assert.equal(control.state,'PREVIEW');
    await page.getByRole('region',{name:'Current preview',exact:true}).getByRole('button',{name:'Commit reviewed change',exact:true}).waitFor();
    record.financeControl={status:response.status(),savedIdentity:control.id,operation:control.operation_key,method:observed.method(),observedUrl:observed.url(),observedReadUrl:readUrl,body:observed.postDataJSON()};
    const auditContext=await browser.newContext(),audit=await auditContext.newPage();await login(audit,'u');
    await audit.getByRole('heading',{name:'R32-FINANCE-CONTROL  /  PREVIEW',exact:true}).waitFor();
    record.financeControl.freshAuditorUiReadback=true;
    for(const actor of ['r','c','a1','a2','a3','u']) {
      const actorContext=await browser.newContext(),actorPage=await actorContext.newPage();await login(actorPage,actor);
      const beforeResponse=await auditContext.request.get(readUrl);assert.equal(beforeResponse.status(),200);const before=await beforeResponse.json();
      const body={...observed.postDataJSON(),operation_key:'R32-DENIED-'+actor};
      const denied=await actorContext.request.fetch(observed.url(),{method:observed.method(),data:body});
      const deniedBody=await denied.json();
      const afterResponse=await auditContext.request.get(readUrl);assert.equal(afterResponse.status(),200);const after=await afterResponse.json();
      assert.equal(denied.status(),403); assert.deepEqual(economics(after),economics(before));
      const added=after.change_sets.filter(x=>!before.change_sets.some(y=>y.id===x.id));
      assert.equal(added.length,variant==='golden'?0:1);
      if(added.length){assert.equal(added[0].operation_key,body.operation_key);assert.equal(added[0].state,'PREVIEW');}
      record.observations.push({actor,status:denied.status(),response:deniedBody,financialStateUnchanged:true,beforePreviewCount:before.change_sets.length,afterPreviewCount:after.change_sets.length,addedPreview:added});
      save(variant+'-'+actor+'-before.json',before);save(variant+'-'+actor+'-after.json',after);
      await actorContext.close();
    }
    await audit.getByRole('button',{name:'Reload current offers and history',exact:true}).click();
    if(variant!=='golden')await audit.getByRole('heading',{name:'R32-DENIED-r  /  PREVIEW',exact:true}).waitFor();
    await audit.screenshot({path:out+'/'+variant+'-auditor.png',fullPage:true});
    record.newUnauthorizedPreviewsVisible=variant!=='golden';
    record.sourceReadOnlySha256After=hash(fs.readFileSync(source+'/src/change-sets.js'));assert.equal(record.sourceReadOnlySha256After,sourceHash);
  } finally {
    if(browser)await browser.close();
    if(child&&child.exitCode===null){child.kill('SIGTERM');for(let i=0;i<100&&child.exitCode===null;i++)await sleep(20);if(child.exitCode===null)child.kill('SIGKILL');}
    fs.writeFileSync(out+'/'+variant+'-server.log',logs);
  }
  return record;
}
(async()=>{try{summary.results.push(await run('golden'));summary.results.push(await run('save_then_forbid'));summary.completed=true;}catch(e){summary.error=e.stack;process.exitCode=1;}finally{save('results.json',summary);console.log(JSON.stringify(summary,null,2));}})();

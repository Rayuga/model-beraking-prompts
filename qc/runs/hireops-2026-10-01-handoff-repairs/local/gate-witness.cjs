'use strict';
// Scripted browser prerequisite witnesses, never a configured judge result.
const fs=require('fs'),assert=require('assert/strict'),{spawn}=require('child_process');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const out='/evidence/gate-witness';fs.mkdirSync(out,{recursive:true});const results=[];
async function run(name){
 const dir='/tmp/hireops-gate-'+name;fs.cpSync('/solution/app',dir,{recursive:true});
 const p=dir+'/src/index.js';let code=fs.readFileSync(p,'utf8');
 if(name==='dead_approval')code=code.replace("app.post('/api/offers/:id/approve', auth('approver'), (req, res) => {","app.post('/api/offers/:id/approve', auth('approver'), (req, res) => { return res.status(409).json({error:'Deliberate dead approval fixture'});");
 if(name==='no_op_create')code=code.replace("app.post('/api/requisitions', auth(), (req, res) => {","app.post('/api/requisitions', auth(), (req, res) => { return res.json({created:true});");
 fs.writeFileSync(p,code);
 const proc=spawn('node',[dir+'/server.js'],{env:{...process.env,PORT:'3058',DB_PATH:dir+'/app.db'},stdio:['ignore','pipe','pipe']});let logs='';proc.stdout.on('data',x=>logs+=x);proc.stderr.on('data',x=>logs+=x);
 let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://localhost:3058/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const ctx=await browser.newContext(),page=await ctx.newPage();
  async function login(pg,email){await pg.goto('http://localhost:3058');await pg.locator('#email').fill(email+'@hireops.example');await pg.locator('#password').fill('Hireops!2026');await pg.getByRole('button',{name:'Sign in',exact:true}).click();await pg.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();}
  const nav=(pg,n)=>pg.getByRole('navigation').getByRole('button',{name:n,exact:true}).click();
  await login(page,'rafael.costa');await nav(page,'Requisitions');
  await page.locator('#req-id').fill('gate-own-req');await page.locator('#req-title').fill('Gate witness');await page.locator('#req-budget').fill('1000');
  const response=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/requisitions'));await page.getByRole('button',{name:'Create requisition',exact:true}).click();const writeStatus=(await response).status();await page.locator('#flash .ok').waitFor();
  await page.getByRole('heading',{name:'Requisitions',exact:true}).waitFor();
  const reqSaved=await page.locator('article[data-entity="gate-own-req"]').count()>0;
  let offerSaved=false;
  if(reqSaved){await nav(page,'Offers');await page.locator('#off-id').fill('gate-own-offer');await page.locator('#off-req').selectOption('gate-own-req');await page.locator('#off-cand').fill('Gate candidate');await page.locator('#off-base').fill('10');for(const id of ['off-sign','off-rel','off-units','off-fair','off-strike'])await page.locator('#'+id).fill('0');await page.locator('#off-start').fill('2026-09-01');await page.getByRole('button',{name:'Create offer',exact:true}).click();await page.locator('article[data-entity="gate-own-offer"]').waitFor();offerSaved=true;}
  const independent=await browser.newContext();const fresh=await independent.newPage();await login(fresh,'aud.halvorsen');await nav(fresh,'Requisitions');const freshReq=await fresh.locator('article[data-entity="gate-own-req"]').count()>0;await nav(fresh,'Offers');const freshOffer=await fresh.locator('article[data-entity="gate-own-offer"]').count()>0;
  const pending=freshOffer&&(await fresh.locator('article[data-entity="gate-own-offer"]').innerText()).includes('PENDING');
  let approvalDisabled=null;if(name==='dead_approval'){const a=await browser.newContext();const ap=await a.newPage();await login(ap,'yuki.tanaka');await nav(ap,'Offers');await ap.getByRole('button',{name:'Approve gate-own-offer',exact:true}).click();await ap.locator('#flash .error').waitFor();approvalDisabled=(await ap.locator('article[data-entity="gate-own-offer"]').innerText()).includes('PENDING');await a.close();}
  results.push({variant:name,write_response_status:writeStatus,reqSaved,offerSaved,freshReq,freshOffer,pending,basic_gate_observations_satisfied:reqSaved&&offerSaved&&freshReq&&pending,approvalDisabled});
  await independent.close();await ctx.close();
 }finally{if(browser)await browser.close();proc.kill();await new Promise(r=>proc.once('exit',r));fs.writeFileSync(out+'/'+name+'.log',logs);}
}
(async()=>{for(const n of ['golden','dead_approval','no_op_create'])await run(n);assert(results[0].basic_gate_observations_satisfied);assert(results[1].basic_gate_observations_satisfied&&results[1].approvalDisabled);assert(!results[2].basic_gate_observations_satisfied);fs.writeFileSync(out+'/results.json',JSON.stringify({scope:'Local scripted UI and empty-context evidence for basic gate; no judge score',results},null,2));console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exitCode=1});

'use strict';
// Scripted golden browser observations. API fixture setup is not a configured judge run.
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto'),{spawn}=require('child_process');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const out='/evidence/targeted-golden';fs.mkdirSync(out,{recursive:true});
const results=[],errors=[],base='http://127.0.0.1:3061';let child,browser,logs='',serial=0;
const cookies={},emails={r:'rafael.costa',a:'yuki.tanaka',f:'farah.nasser',u:'aud.halvorsen'};
const sleep=n=>new Promise(r=>setTimeout(r,n));
async function api(who,url,body){const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(cookies[who]?{cookie:cookies[who]}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
const terms={base_salary_cents:1000,signing_bonus_cents:100,equity_units:7,equity_fair_cents:102,equity_strike_cents:1,relocation_cents:321};
async function req(){const id='UI-R'+(++serial);await api('r','/api/requisitions',{id,title:id,dept:'Engineering',budget_cents:100000});return id;}
async function hire(req_id){const id='UI-O'+(++serial);await api('r','/api/offers',{id,req_id,candidate:id,start_date:'2024-02-29T12:34:56.789Z',...terms});await api('a',`/api/offers/${id}/approve`,{});return id;}
async function pair(){const a=await req(),b=await req();return{a,b,x:await hire(a),y:await hire(b)};}
const record=(name,details={})=>results.push({name,passed:true,...details});
function hashes(){const o={};function walk(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+d.name;if(d.isDirectory())walk(p);else o[p.replace('/solution/','')]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}}walk('/solution');return o;}
const source=hashes();
(async()=>{try{
 child=spawn('node',['/solution/app/server.js'],{env:{...process.env,PORT:'3061',DB_PATH:'/tmp/hireops-batch-ui.db'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await sleep(50);}
 for(const [who,email] of Object.entries(emails)){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:email+'@hireops.example',password:'Hireops!2026'})});assert.equal(r.status,200);cookies[who]=r.headers.get('set-cookie').split(';')[0];}
 const p=await pair(),q=await pair();
 browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 async function login(page,who){await page.goto(base);await page.getByLabel('Email').fill(emails[who]+'@hireops.example');await page.getByLabel('Password').fill('Hireops!2026');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Coordinated Changes',exact:true}).waitFor();}
 await login(page,'f');
 async function editor(p,key){await page.getByLabel('Operation key',{exact:true}).fill(key);await page.getByLabel('Member 1 source offer',{exact:true}).selectOption(p.x);await page.getByLabel('Member 2 source offer',{exact:true}).selectOption(p.y);await page.getByLabel('Member 1 destination requisition',{exact:true}).selectOption(p.b);await page.getByLabel('Member 2 destination requisition',{exact:true}).selectOption(p.a);await page.getByLabel('Member 1 Signing bonus (dollars)',{exact:true}).fill('1.23');await page.getByLabel('Member 2 Equity fair value (dollars)',{exact:true}).fill('2.03');}
 const current=page.getByRole('region',{name:'Current preview',exact:true});
 async function preview(){const r=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/preview'));await page.getByRole('button',{name:'Preview coordinated change',exact:true}).click();const response=await r;assert.equal(response.status(),200);await current.getByRole('button',{name:'Commit reviewed change',exact:true}).waitFor();return response.json();}

 await editor(p,'PREPARE-RECOVERY');
 const baseField=page.getByLabel('Member 1 Base salary (dollars)',{exact:true});
 await baseField.fill('999999.99');
 const refused=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/preview'));
 await page.getByRole('button',{name:'Preview coordinated change',exact:true}).click();
 assert.equal((await refused).status(),409);
 const editorForm=page.getByRole('form',{name:'Coordinated change editor'});
 await editorForm.getByRole('alert').filter({hasText:/exceeds requisition/}).waitFor();
 assert.equal(await baseField.inputValue(),'999999.99');
 assert.equal(await page.getByLabel('Member 1 Signing bonus (dollars)',{exact:true}).inputValue(),'1.23');
 assert.equal(await page.getByLabel('Member 1 destination requisition',{exact:true}).inputValue(),p.b);
 assert.equal(await page.getByLabel('Member 2 Equity fair value (dollars)',{exact:true}).inputValue(),'2.03');
 await page.screenshot({path:out+'/prepare-refusal.png',fullPage:true});
 await baseField.fill('10.00');await preview();
 await current.getByRole('button',{name:'Commit reviewed change',exact:true}).click();
 await page.getByRole('heading',{name:/PREPARE-RECOVERY.*COMMITTED/}).waitFor();
 record('actual over-budget prepare refusal explains failure, retains member terms and supports corrected commit');
 const data=await api('u','/api/bootstrap'),employee=data.employees[0];
 const reqId=await req(),offerId='FINANCIAL-DISPLAY';
 await api('r','/api/offers',{id:offerId,req_id:reqId,candidate:'Display candidate',start_date:'2024-02-29T12:34:56.789Z',referred_by:employee.id,referred_hire_start:'2025-01-31T12:34:56.789Z',...terms});
 await api('a',`/api/offers/${offerId}/approve`,{});
 await page.getByRole('button',{name:'Reload current offers and history',exact:true}).click();
 const renderedData=await api('u','/api/bootstrap'),offer=renderedData.offers.find(o=>o.id===offerId),grant=offer.equity_grant,referral=renderedData.referral_accruals.find(r=>r.offer_id===offerId);
 async function nav(name){await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();}
 await nav('Offers');
 const offerCard=page.locator('article.entity[data-entity="'+offerId+'"]');
 assert.ok((await offerCard.innerText()).includes(grant.schedule_note));
 assert.ok((await offerCard.innerText()).includes(offer.remittances[0].amount_display));
 await nav('Equity Table');
 const grantRow=page.getByRole('row').filter({hasText:offerId});
 assert.ok((await grantRow.innerText()).includes(grant.schedule_note));
 await nav('Referrals');
 const refCard=page.locator('article.entity[data-entity="'+referral.id+'"]');
 const text=await refCard.innerText();
 for(const v of [referral.at_hire_display,referral.contingent_display,referral.retention_cliff_at,employee.name])assert.ok(text.includes(v),v);
 await page.screenshot({path:out+'/financial-referral.png',fullPage:true});
 record('normal rendered offer/equity/referral surfaces expose grant schedule, signing payment, referral recipient, halves and cliff');
 assert.deepEqual(errors,[]);assert.deepEqual(hashes(),source);record('no JavaScript errors or source mutation');
 }catch(e){results.push({passed:false,error:e.stack});process.exitCode=1;}finally{if(browser)await browser.close();if(child)child.kill();fs.writeFileSync(out+'/server.log',logs);fs.writeFileSync(out+'/results.json',JSON.stringify({kind:'Scripted golden browser evidence, not configured judge grade',source_sha256:source,results,browser_errors:errors},null,2));console.log(JSON.stringify(results,null,2));}})();

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const root = '/evidence/round2';
fs.mkdirSync(root,{recursive:true});
const base = 'http://localhost:3000';
const report={kind:'Independent local Chromium walk of simplified gates/polish and visual surfaces; no paid judge',checks:[],screenshots:[],pageErrors:[],externalRequests:[],orderWrites:[],productResponses:[],focusEvidence:[],layoutEvidence:[]};
function record(name,value,detail){report.checks.push({name,passed:!!value,detail});assert(value,name+' '+JSON.stringify(detail));}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 report.browserVersion=browser.version();
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();
 const pendingResponses=[];
 page.on('pageerror',e=>report.pageErrors.push(e.message));
 page.on('request',r=>{
   if(!r.url().startsWith(base))report.externalRequests.push(r.url());
   if(r.method()==='POST' && /\/api\/orders(?:\/|$)/.test(new URL(r.url()).pathname))report.orderWrites.push({url:r.url(),method:r.method()});
 });
 page.on('response',r=>{
   if(new URL(r.url()).pathname==='/api/prints')pendingResponses.push(r.json().then(data=>report.productResponses.push({url:r.url(),status:r.status(),titles:data.prints?.map(p=>p.title),variants:data.prints?.flatMap(p=>p.sizes).length})).catch(()=>{}));
 });
 async function ready(){await page.waitForLoadState('networkidle');}
 async function theme(desired){
   const actual=await page.locator('html').getAttribute('data-theme');
   if(actual!==desired)await page.getByRole('button',{name:'Switch to '+desired+' theme',exact:true}).click();
   await page.waitForTimeout(250);
 }
 async function capture(surface){
   for(const [viewport,size] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
     await page.setViewportSize(size);
     for(const appearance of ['light','dark']){
       await theme(appearance);
       const layout=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,mainWidth:document.querySelector('main')?.getBoundingClientRect().width,title:document.querySelector('h1')?.textContent,background:getComputedStyle(document.documentElement).backgroundColor,color:getComputedStyle(document.body).color}));
       report.layoutEvidence.push({surface,viewportLabel:viewport,theme:appearance,...layout});
       record(surface+' '+viewport+' '+appearance+' no page-wide overflow',layout.documentWidth<=layout.viewport+1,layout);
       const file=surface+'-'+viewport+'-'+appearance+'.png';
       await page.screenshot({path:path.join(root,file),fullPage:true});
       report.screenshots.push(file);
     }
   }
   await page.setViewportSize({width:1440,height:1000});await theme('light');
 }
 try{
   const health=await page.goto(base+'/api/health');
   record('constraints gate: successful stated health response',health.status()>=200 && health.status()<300,{status:health.status()});
   await page.goto(base);await page.locator('.print-card').first().waitFor();await ready();
   const served=await page.evaluate(async()=>await (await fetch('/assets/app.js')).text());
   const local=fs.readFileSync('/source/app/public/assets/app.js','utf8');
   report.sourceHash={served:crypto.createHash('sha256').update(served).digest('hex'),workspace:crypto.createHash('sha256').update(local).digest('hex')};
   record('served golden frontend matches current workspace',served===local,report.sourceHash);
   const initialCatalogue=await page.evaluate(async()=>await (await fetch('/api/prints')).json());
   const initialStocks=Object.fromEntries(initialCatalogue.prints.flatMap(p=>p.sizes).map(v=>[v.sku+':'+v.size,v.in_stock]));
   const target=initialCatalogue.prints.find(p=>p.sizes.some(v=>v.in_stock>0));
   const variant=target.sizes.find(v=>v.in_stock>0);
   report.sampledProduct={sku:target.sku,title:target.title,size:variant.size};
   record('render gate: populated public catalogue',await page.locator('.print-card').count()>0,{cards:await page.locator('.print-card').count()});
   await Promise.all(pendingResponses);
   record('constraints gate: observed server product response',report.productResponses.some(r=>r.status===200 && r.titles?.includes(target.title)),report.productResponses);
   record('all loaded print photographs are real rendered images',await page.locator('.print-card img').evaluateAll(imgs=>imgs.length>0 && imgs.every(img=>img.complete && img.naturalWidth>0)));
   for(const name of ['Size','Paper','Sort'])record('labelled '+name+' control',await page.getByLabel(name,{exact:true}).count()===1);
   record('labelled search control',await page.getByRole('searchbox',{name:'Search prints'}).count()===1);
   record('labelled basket control',await page.getByRole('button',{name:/Open basket,/}).count()===1);
   record('labelled theme control',await page.getByRole('button',{name:/Switch to .* theme/}).count()===1);
   await capture('catalogue');
   await page.goto(base);await ready();
   for(let i=0;i<26;i++){
     await page.keyboard.press('Tab');
     const state=await page.evaluate(()=>{
       const e=document.activeElement,s=getComputedStyle(e);
       return {tag:e.tagName,type:e.type||'',label:e.getAttribute('aria-label')||e.labels?.[0]?.innerText||e.textContent?.trim().slice(0,50),outline:s.outlineStyle,outlineWidth:s.outlineWidth,shadow:s.boxShadow,focusVisible:e.matches(':focus-visible')};
     });
     if(state.type==='search'||state.tag==='SELECT')report.focusEvidence.push(state);
     if(report.focusEvidence.some(e=>e.type==='search')&&report.focusEvidence.filter(e=>e.tag==='SELECT').length>=2)break;
   }
   record('polish keyboard: actual Tab reaches search and two other controls',report.focusEvidence.some(e=>e.type==='search')&&report.focusEvidence.filter(e=>e.tag==='SELECT').length>=2,report.focusEvidence);
   record('polish keyboard: visible focus styling',report.focusEvidence.every(e=>e.focusVisible&&((e.outline!=='none'&&parseFloat(e.outlineWidth)>0)||e.shadow!=='none')),report.focusEvidence);
   await page.screenshot({path:path.join(root,'keyboard-focus.png'),fullPage:true});report.screenshots.push('keyboard-focus.png');
   const allCount=await page.locator('.print-card').count();
   await page.getByRole('searchbox',{name:'Search prints'}).fill(target.title);
   record('polish search gives visible matching results',await page.locator('.print-card').count()===1 && (await page.locator('.print-card').innerText()).includes(target.title));
   await page.getByRole('searchbox',{name:'Search prints'}).fill('');
   record('polish clearing search restores results',await page.locator('.print-card').count()===allCount);
   await page.getByRole('button',{name:'View '+target.title,exact:true}).click();
   await page.getByRole('heading',{name:target.title,exact:true}).waitFor();
   record('render gate: print detail reachable through app control',await page.locator('.product-art img').isVisible());
   await page.getByRole('button',{name:new RegExp('^'+variant.size)}).click();
   await capture('detail');
   await page.getByRole('button',{name:'Add to basket',exact:true}).click();
   await page.getByRole('status').filter({hasText:'added to your basket'}).waitFor();
   record('polish add acknowledges action visibly',await page.getByRole('status').filter({hasText:'added to your basket'}).isVisible() && (await page.locator('.basket-count').innerText())==='1');
   await page.getByRole('button',{name:/View basket/}).click();await ready();
   record('polish populated basket reached',await page.locator('.basket-line').count()===1);
   await capture('basket');
   await page.getByRole('button',{name:'Continue to checkout',exact:true}).click();await ready();
   for(const [label,value] of [['Full name','Local Visual Check'],['Address line 1','18 Print Lane'],['Town or city','Bristol'],['Postcode','BS1 4QA']])await page.getByLabel(label,{exact:true}).fill(value);
   await page.getByRole('button',{name:'Review order',exact:true}).click();
   await page.getByRole('button',{name:'Place order',exact:true}).waitFor();
   await capture('checkout-review');
   await page.getByRole('button',{name:/Edit basket/}).click();await ready();
   await page.getByRole('button',{name:'Remove '+target.title+' '+variant.size,exact:true}).click();await ready();
   record('polish cleanup leaves unplaced basket empty',await page.getByText('Your basket is empty.',{exact:false}).isVisible() && (await page.locator('.basket-count').innerText())==='0');
   await page.getByRole('button',{name:'Explore the prints',exact:true}).click();await ready();
   record('polish navigation returns usable catalogue',await page.locator('.print-card').count()===allCount);
   await page.getByRole('button',{name:'Track an order',exact:true}).click();
   await page.getByLabel('Order reference',{exact:true}).fill('RP-100001');
   await page.getByRole('button',{name:'Find order',exact:true}).click();
   await page.getByText('RP-100001',{exact:true}).waitFor();
   await capture('receipt');
   record('theme visibly changes page colours',report.layoutEvidence.filter(e=>e.theme==='light').every(light=>{const dark=report.layoutEvidence.find(e=>e.surface===light.surface&&e.viewport===light.viewport&&e.theme==='dark');return dark&&dark.background!==light.background&&dark.color!==light.color;}));
   const finalCatalogue=await page.evaluate(async()=>await (await fetch('/api/prints')).json());
   const finalStocks=Object.fromEntries(finalCatalogue.prints.flatMap(p=>p.sizes).map(v=>[v.sku+':'+v.size,v.in_stock]));
   record('browser validation leaves all durable stock unchanged',JSON.stringify(initialStocks)===JSON.stringify(finalStocks));
   record('no order writes performed',report.orderWrites.length===0,report.orderWrites);
   record('no browser runtime exceptions',report.pageErrors.length===0,report.pageErrors);
   record('no external app requests',report.externalRequests.length===0,report.externalRequests);
   report.passed=true;
 }catch(error){report.passed=false;report.error=error.stack;await page.screenshot({path:path.join(root,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
 finally{
   report.checkCount=report.checks.length;
   fs.writeFileSync(path.join(root,'browser-criteria-results.json'),JSON.stringify(report,null,2));
   console.log(JSON.stringify({passed:report.passed,browserVersion:report.browserVersion,checkCount:report.checkCount,screenshots:report.screenshots.length,error:report.error},null,2));
   await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('node:module').createRequire(require.resolve('@playwright/mcp'))('playwright');
const base='http://127.0.0.1:3000',results=[],errors=[];
let browser,context,page,id;
async function record(name,fn){await fn();results.push({name,passed:true});console.log('PASS '+name);}
async function read(){const r=await context.request.get(`${base}/api/games/${id}?seat=a`);assert(r.ok());return r.json();}
async function action(selector,path){const wait=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===path);await page.locator(selector).click();const r=await wait;assert(r.ok(),await r.text());const v=await r.json();await page.waitForFunction(()=>!document.querySelector('main').hasAttribute('aria-busy'));return v;}
async function seat(s){if(await page.locator('#seatb').isChecked()===(s==='b'))return;const wait=page.waitForResponse(r=>r.request().method()==='GET'&&r.url().includes(`/${id}?seat=${s}`));await page.locator('#seatb').setChecked(s==='b');await wait;await page.waitForFunction(s=>document.querySelector('#turnhint').textContent.includes('Seat '+s.toUpperCase()),s);}
async function discard(s,cards){await seat(s);for(const c of cards)await page.locator(`[data-card="${c}"]`).click();return action('#discard',`/api/games/${id}/discard`);}
(async()=>{
for(let n=0;n<60;n++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});context=await browser.newContext({viewport:{width:1280,height:800}});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await record('terminal-driven browser launches and opens the live page',async()=>{await page.goto(base);await page.waitForSelector('#ladder tr');assert(await page.locator('#new').isEnabled());});
await record('zero-score game renders selectable cards and both seats discard',async()=>{await page.selectOption('#practice-deal','pegging');await page.fill('#start-a','0');await page.fill('#start-b','0');const v=await action('#fixed-practice','/api/games');id=v.id;assert.deepEqual(v.scores,{a:0,b:0});assert.equal(await page.locator('#hand button:enabled').count(),6);await discard('a',['4S','6D']);await discard('b',['8C','KD']);await action('#cut',`/api/games/${id}/cut`);});
let snapshot;
await record('legal card plays through browser controls and persists',async()=>{await seat('b');await action('[data-card="5S"]',`/api/games/${id}/play`);snapshot=await read();assert.equal(snapshot.count,5);assert.deepEqual(snapshot.them.laid,['5S']);});
await record('fresh page reopens the saved game and continues legal play',async()=>{await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(id=>[...document.querySelector('#saved-games').options].some(o=>o.value===id),id);await page.selectOption('#saved-games',id);const wait=page.waitForResponse(r=>r.request().method()==='GET'&&r.url().includes(`/${id}?seat=`));await page.locator('#open-game').click();await wait;await page.waitForSelector('[data-card="7H"]');assert.deepEqual(await read(),snapshot);await seat('a');await action('[data-card="7H"]',`/api/games/${id}/play`);assert.equal((await read()).count,12);});
await record('browser has no uncaught errors',async()=>assert.deepEqual(errors,[]));
await page.screenshot({path:'/evidence/browser-acceptance.png',fullPage:true});
fs.writeFileSync('/evidence/browser-acceptance-results.json',JSON.stringify({kind:'local browser acceptance check, not Oracle score',results,errors},null,2));await browser.close();
})().catch(async error=>{fs.writeFileSync('/evidence/browser-acceptance-results.json',JSON.stringify({kind:'local browser acceptance check, not Oracle score',results,error:error.stack,errors},null,2));console.error(error);if(browser)await browser.close();process.exit(1)});

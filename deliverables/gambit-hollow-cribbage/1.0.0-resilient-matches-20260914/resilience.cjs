const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const presets=require('/assets/club/practice-deals.json'),reference=require('/evidence/reference-checkpoints.json');
const base='http://127.0.0.1:3000',results=[],errors=[];
let browser,context,page,lastCapture,finishedCapture,creationCapture;
const key=()=>crypto.randomUUID();
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(e){results.push({name,passed:false,error:e.stack});throw e;}finally{fs.writeFileSync('/evidence/resilience-results.json',JSON.stringify({kind:'local browser and runtime regression, not an LLM Oracle score',results,errors},null,2));}}
async function get(path){const r=await context.request.get(base+path);assert(r.ok(),path);return r.json();}
async function state(id,seat='a'){return get(`/api/games/${id}?seat=${seat}`);}
async function snapshot(id){return {a:await state(id),b:await state(id,'b')};}
async function open(p,id){await p.goto('about:blank');await p.goto(base+(id?'#'+id:''));await p.waitForFunction(()=>document.querySelector('#practice-deal').options.length>0);if(id)await p.waitForFunction(id=>typeof view!=='undefined'&&view?.id===id,id);}
async function settle(p){await p.waitForFunction(()=>!document.querySelector('main').hasAttribute('aria-busy'));}
async function click(p,selector,path){const wait=p.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===path);await p.locator(selector).click();const r=await wait,data=await r.json();lastCapture={url:r.url(),headers:await r.request().allHeaders(),data:r.request().postDataJSON(),status:r.status(),response:data};assert(r.ok(),JSON.stringify(data));await settle(p);return data;}
async function seat(p,s){if(await p.locator('#seatb').isChecked()===(s==='b'))return;const wait=p.waitForResponse(r=>r.request().method()==='GET'&&r.url().includes('/api/games/')&&r.url().includes('?seat='+s));await p.locator('#seatb').setChecked(s==='b');await wait;await p.waitForFunction(s=>document.querySelector('#turnhint').textContent.includes('Seat '+s.toUpperCase()),s);}
async function create(p,preset='pegging',a=0,b=0){await p.selectOption('#practice-deal',preset);await p.fill('#start-a',String(a));await p.fill('#start-b',String(b));return click(p,'#fixed-practice','/api/games');}
async function discard(p,id,s,cards){await seat(p,s);for(const c of cards)await p.locator(`[data-card="${c}"]`).click();return click(p,'#discard',`/api/games/${id}/discard`);}
async function play(p,id,s,c){await seat(p,s);return click(p,`[data-card="${c}"]`,`/api/games/${id}/play`);}
async function ready(p,preset='pegging',a=0,b=0){let v=await create(p,preset,a,b);for(const s of ['a','b'])v=await discard(p,v.id,s,presets[preset][s].slice(4));return click(p,'#cut',`/api/games/${v.id}/cut`);}
async function sequence(p,id,name,limit=8){let v;for(const move of reference.cases[name].moves.slice(0,limit)){const [s,c]=move.split(':');v=await play(p,id,s,c);}return v;}
async function replay(cap,change={}){const headers={...cap.headers,...change.headers};delete headers['content-length'];delete headers.host;const r=await context.request.post(change.url||cap.url,{headers,data:change.data||cap.data});return {status:r.status(),data:await r.json()};}
async function sameReceipt(cap){const r=await replay(cap);assert.equal(r.status,cap.status);assert.deepEqual(r.data,cap.response);}
async function refused(cap,change){const r=await replay(cap,change);assert(r.status>=400&&r.status<500,JSON.stringify(r));assert(r.data.error);}
async function boardShot(p,name){await p.screenshot({path:'/evidence/'+name+'.png',fullPage:true});}

(async()=>{
browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await open(page);
await check('new pegging cases: exhausted seat, consecutive plays and last-card 31',async()=>{
 for(const name of ['tail','last31']){
  let v=await ready(page,name);const id=v.id;
  for(const cp of reference.cases[name].checkpoints){const [s,c]=cp.move.split(':');const prior=v.revision;v=await play(page,id,s,c);assert.deepEqual(v.scores,cp.scores);assert.equal(v.count,cp.count);assert.equal(v.revision,prior+1);}
  assert.equal(v.phase,'show');v=await click(page,'#show',`/api/games/${id}/show`);assert.deepEqual(v.scores,reference.cases[name].final);assert.deepEqual(v.shown.map(s=>s.total),reference.cases[name].show_pone_dealer_crib);
 }
});
await check('complete seven-hand club match from zero, every move and ordered show',async()=>{
 const before=await get('/api/ladder');let v=await create(page,'club_series');const id=v.id;
 for(const hand of reference.match){
  assert.equal(v.hand_no,hand.hand);assert.equal(v.dealer,hand.dealer);
  const preset=presets[hand.practice],map={a:hand.dealer,b:hand.dealer==='a'?'b':'a'};
  for(const local of ['a','b']){const s=map[local];assert.deepEqual((await state(id,s)).you.hand,preset[local]);v=await discard(page,id,s,preset[local].slice(4));}
  v=await click(page,'#cut',`/api/games/${id}/cut`);assert.equal(v.cut,preset.cut);
  for(const move of hand.moves){const [s,c]=move.move.split(':');v=await play(page,id,s,c);assert.deepEqual(v.scores,move.scores);}
  if(v.phase==='show'){v=await click(page,'#show',`/api/games/${id}/show`);if(hand.finished)finishedCapture=structuredClone(lastCapture);assert.deepEqual(v.shown.map(s=>s.total),hand.shown.map(s=>s.points));}
  assert.deepEqual(v.scores,hand.scores);assert.equal(v.phase,hand.finished?'over':'between');
  const current=await get('/api/ladder');
  if(!hand.finished){assert.deepEqual(current.members,before.members);await page.reload();await page.waitForSelector('.show-entry');v=await click(page,'#deal',`/api/games/${id}/deal`);}
 }
 const after=await get('/api/ladder');for(const m of before.members){const actual=after.members.find(x=>x.no===m.no);assert.equal(actual.played,m.played+(['M-014','M-021'].includes(m.no)?1:0));assert.equal(actual.won,m.won+(m.no==='M-014'?1:0));}
 await sameReceipt(finishedCapture);assert.deepEqual(await get('/api/ladder'),after);await boardShot(page,'desktop-complete-match');
});
await check('creation identities replay once and independent identical games stay distinct',async()=>{
 const first=await create(page);creationCapture=structuredClone(lastCapture);const baseline=await get('/api/ladder');await sameReceipt(creationCapture);await sameReceipt(creationCapture);assert.deepEqual(await get('/api/ladder'),baseline);
 const second=await create(page);assert.notEqual(first.id,second.id);assert.notEqual(lastCapture.headers['idempotency-key'],creationCapture.headers['idempotency-key']);assert.equal(second.revision,0);
});
await check('accepted discard retries after a newer move do not roll back or increment',async()=>{
 let v=await create(page);const id=v.id;await discard(page,id,'a',presets.pegging.a.slice(4));const cap=structuredClone(lastCapture);await discard(page,id,'b',presets.pegging.b.slice(4));const baseline=await snapshot(id);assert.equal(baseline.a.revision,2);await sameReceipt(cap);await sameReceipt(cap);assert.deepEqual(await snapshot(id),baseline);
 const sibling=await create(page);const siblingBefore=await snapshot(sibling.id),ladder=await get('/api/ladder');
 await refused(cap,{data:{...cap.data,cards:['7H','TH']}});
 await refused(cap,{url:base+`/api/games/${sibling.id}/discard`});
 await refused(cap,{url:base+`/api/games/${id}/cut`,data:{seat:'a'}});
 assert.deepEqual(await snapshot(id),baseline);assert.deepEqual(await snapshot(sibling.id),siblingBefore);assert.deepEqual(await get('/api/ladder'),ladder);await sameReceipt(cap);
});
await check('stale tab rejects a legal move then refreshes; invalid revisions cannot mutate',async()=>{
 const v=await create(page);const id=v.id;const other=await context.newPage();await open(other,id);await seat(other,'b');
 await discard(page,id,'a',presets.pegging.a.slice(4));const before=await snapshot(id);for(const c of presets.pegging.b.slice(4))await other.locator(`[data-card="${c}"]`).click();
 const wait=other.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/discard'));await other.locator('#discard').click();const r=await wait;assert.equal(r.status(),409);await settle(other);assert.match(await other.locator('#err').innerText(),/changed|latest/i);assert.deepEqual(await snapshot(id),before);
 await discard(other,id,'b',presets.pegging.b.slice(4));const cap=structuredClone(lastCapture);const current=await snapshot(id);
 for(const revision of ['','1.5','0'])await refused(cap,{headers:{'idempotency-key':key(),'if-match':revision},url:base+`/api/games/${id}/cut`,data:{seat:'a'}});
 assert.deepEqual(await snapshot(id),current);await page.reload();await page.waitForFunction(()=>!document.querySelector('#cut').disabled);await click(page,'#cut',`/api/games/${id}/cut`);await other.close();
});
await check('lost committed response survives reload and retry displays latest sibling-seat move',async()=>{
 const v=await create(page);const id=v.id;let captured,resolve;const accepted=new Promise(r=>resolve=r);
 await page.route(`**/api/games/${id}/discard`,async route=>{
  const request=route.request(),response=await route.fetch();captured={url:request.url(),headers:await request.allHeaders(),data:request.postDataJSON(),status:response.status(),response:await response.json()};await route.abort('failed');resolve();
 });
 for(const c of presets.pegging.a.slice(4))await page.locator(`[data-card="${c}"]`).click();await page.locator('#discard').click();await accepted;await page.waitForSelector('#retry-save:visible');assert.equal(captured.status,200);assert.equal((await state(id)).revision,1);
 const other=await context.newPage();await open(other,id);await discard(other,id,'b',presets.pegging.b.slice(4));const latest=await snapshot(id);assert.equal(latest.a.revision,2);
 await page.unroute(`**/api/games/${id}/discard`);await page.reload();await page.waitForSelector('#retry-save:visible');const wait=page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/discard'));await page.locator('#retry-save').click();const retry=await wait;assert.equal((await retry.allHeaders())['idempotency-key'],captured.headers['idempotency-key']);assert.equal((await retry.allHeaders())['if-match'],captured.headers['if-match']);assert.deepEqual(retry.postDataJSON(),captured.data);
 await page.waitForFunction(()=>document.querySelector('#phase').textContent==='cut');await settle(page);assert.deepEqual(await snapshot(id),latest);assert.equal(await page.locator('#retry-save').isVisible(),false);await click(page,'#cut',`/api/games/${id}/cut`);await other.close();
});
await check('lost create response retries one game after page reload',async()=>{
 let captured,resolve;const accepted=new Promise(r=>resolve=r),before=await get('/api/ladder');
 await page.route('**/api/games',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();captured=await response.json();await route.abort('failed');resolve();});
 await page.locator('#new').click();await accepted;await page.waitForSelector('#retry-save:visible');await page.unroute('**/api/games');await page.reload();await page.waitForSelector('#retry-save:visible');await page.locator('#retry-save').click();await page.waitForURL('**#'+captured.id);await settle(page);const after=await get('/api/ladder');assert.equal(after.games.length,before.games.length+1);assert.deepEqual(after.members,before.members);assert.equal((await state(captured.id)).revision,0);
});
await check('multiple saved games, six phase snapshots and durable receipts across restart',async()=>{
 const ids=[];
 let v=await create(page);await discard(page,v.id,'a',presets.pegging.a.slice(4));ids.push(v.id);
 v=await create(page);for(const s of ['a','b'])await discard(page,v.id,s,presets.pegging[s].slice(4));ids.push(v.id);
 v=await ready(page,'go');await sequence(page,v.id,'go',3);ids.push(v.id);
 v=await ready(page);await sequence(page,v.id,'pegging');await click(page,'#show',`/api/games/${v.id}/show`);ids.push(v.id);
 v=await ready(page,'club_series');await sequence(page,v.id,'pegging');await click(page,'#show',`/api/games/${v.id}/show`);ids.push(v.id);
 ids.push(finishedCapture.response.id);const before={};for(const id of ids)before[id]=await snapshot(id);const ladder=await get('/api/ladder');
 execFileSync('bash',['/tests/app-lifecycle.sh','restart'],{stdio:'inherit'});
 for(const id of ids){assert.deepEqual(await snapshot(id),before[id]);if(id!==finishedCapture.response.id){await open(page);await page.selectOption('#saved-games',id);await page.locator('#open-game').click();await page.waitForURL('**#'+id);}}
 assert.deepEqual(await get('/api/ladder'),ladder);await sameReceipt(creationCapture);await sameReceipt(finishedCapture);assert.deepEqual(await get('/api/ladder'),ladder);
 for(let i=0;i<5;i++){
  await open(page,ids[i]);
  if(i===0)await discard(page,ids[i],'b',presets.pegging.b.slice(4));
  if(i===1)await click(page,'#cut',`/api/games/${ids[i]}/cut`);
  if(i===2)await play(page,ids[i],'a','9S');
  if(i>=3){v=await click(page,'#deal',`/api/games/${ids[i]}/deal`);assert.equal(v.hand_no,2);assert.equal(v.dealer,'b');if(i===4){assert.deepEqual((await state(v.id,'b')).you.hand,presets.pairs.a);assert.deepEqual((await state(v.id,'a')).you.hand,presets.pairs.b);}}
  for(let j=i+1;j<ids.length;j++)assert.deepEqual(await snapshot(ids[j]),before[ids[j]]);
 }
});
await check('visible pending suppression and mobile board legibility',async()=>{
 let requests=0,release,entered;const held=new Promise(r=>release=r),seen=new Promise(r=>entered=r);
 await page.route('**/api/games',async route=>{if(route.request().method()!=='POST')return route.continue();requests++;entered();await held;return route.continue();});
 await page.locator('#fixed-practice').click();await seen;assert.equal(await page.locator('#fixed-practice').isDisabled(),true);assert.match(await page.locator('#save-status').innerText(),/Saving/);await page.keyboard.press('Enter');await page.keyboard.press('Space');assert.equal(requests,1);release();await settle(page);await page.unroute('**/api/games');
 await page.setViewportSize({width:375,height:760});await page.waitForTimeout(100);assert.equal(await page.locator('#board').getAttribute('viewBox'),'0 0 360 246');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await boardShot(page,'mobile-resilient-table');await page.locator('#hand-score-form').scrollIntoViewIfNeeded();await boardShot(page,'mobile-resilient-bench');assert.deepEqual(errors,[]);
});
await browser.close();
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exit(1)});

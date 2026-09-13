// Unpaid golden-specific tests; not a judge implementation or Oracle score.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
 const passed=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const pass=n=>{passed.push(n);console.log('PASS '+n);};
 const has=async(s,t)=>assert((await page.locator(s).innerText()).includes(t),s+' missing '+t);
 let token;
 async function login(user){
   await page.goto('http://localhost:3000');
   await page.locator('#email').fill(user+'@brickfall.test');await page.locator('#password').fill('password123');
   const [response]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/login')&&r.status()===200),page.getByRole('button',{name:'Enter arcade',exact:true}).click()]);
   token=(await response.json()).token;
   await page.locator('#app-view').waitFor({state:'visible'});
 }
 const state=async()=>{const r=await context.request.get('http://localhost:3000/api/bootstrap',{headers:{Authorization:'Bearer '+token}});assert.equal(r.status(),200);return r.json();};
 const ranked=s=>({user:s.user,revision:s.revision,savedRun:s.savedRun,leaderboard:s.leaderboard,recentRuns:s.recentRuns});
 const drill=async id=>{await page.locator('#drill-select').selectOption(id);await page.locator('#load-drill').click();await page.waitForFunction(()=>!document.querySelector('#step-drill').disabled);};
 try{
  await login('mira');
  let s=await state();const expected=JSON.parse(fs.readFileSync('/results/expected-digests.json','utf8'));
  assert.equal(s.seedManifest.length,10);for(const row of s.seedManifest)assert.equal(row.digest,expected[row.level]);
  pass('Ten manifest hashes match independently derived workbook empty-drop convention');
  await page.locator('#resume-action').click();await has('#telemetry','score=24500 lives=1 combo=x4');
  const finishPromise=page.waitForResponse(r=>r.url().endsWith('/api/run/finish')&&r.request().method()==='POST');
  await page.locator('#pause').click();const finish=await finishPromise,req=finish.request(),body=await finish.json();
  assert.equal(finish.status(),200);await page.waitForFunction(()=>document.querySelector('#sync-state').textContent.includes('terminal'));
  await has('#telemetry','phase=game-over');await has('#telemetry','score=24500 lives=0');await has('#telemetry','balls=0 held=0 drops=0');await has('#telemetry','effect=none');
  const payload=JSON.parse(req.postData());assert.equal(body.revision,payload.expectedRevision+1);
  s=await state();assert.equal(s.savedRun,null);assert.equal(s.recentRuns.length,1);assert.equal(s.user.bestScore,24500);
  assert.equal(s.recentRuns[0].outcome,'game-over');assert.equal(s.recentRuns[0].state.lives,0);
  assert.equal(s.leaderboard.filter(x=>x.initials==='MRC'&&x.score===24500).length,2);
  assert(!s.leaderboard.some(x=>x.initials==='RAY'));await page.locator('#run-history button').first().click();await has('#run-dialog-state','phase=game-over');await page.locator('#close-run-dialog').click();
  pass('Independent terminal finish/records: exact outcome, one revision, history and leaderboard');
  const before=ranked(s),replay=await context.request.fetch(req.url(),{method:req.method(),headers:req.headers(),data:req.postData()});
  assert.equal(replay.status(),finish.status());assert.deepEqual(await replay.json(),body);assert.deepEqual(ranked(await state()),before);
  pass('Independent terminal receipt retry preserves exact response and durable state');
  await page.reload();await page.locator('#app-view').waitFor({state:'visible'});assert(!(await page.locator('#resume-action').isVisible()));assert.deepEqual(ranked(await state()),before);
  pass('Independent terminal refresh preserves records with no resumable save');
  await page.locator('body').click({position:{x:5,y:5}});
  const startPromise=page.waitForResponse(r=>r.url().endsWith('/api/run/start')&&r.status()===200);await page.keyboard.press('r');await startPromise;
  await has('#telemetry','phase=ready');await has('#telemetry','score=0 lives=3 combo=x1 next-life=20000');await has('#telemetry','balls=1 held=1 drops=0');await has('#telemetry','effect=none');assert.deepEqual((await state()).recentRuns,before.recentRuns);
  pass('Independent R restart from reloaded terminal menu creates exact fresh run and retains history');
  const baseline=ranked(await state());await drill('brick-types');await has('#telemetry','speed=1000');
  const frozen=await page.locator('#telemetry').innerText();await page.waitForTimeout(1200);assert.equal(await page.locator('#telemetry').innerText(),frozen);
  await page.locator('#step-drill').click();await has('#telemetry','ticks=120');await has('#telemetry','speed=520');await has('#telemetry','score=1400');assert.deepEqual(ranked(await state()),baseline);
  pass('Paused fast-ball fixture preserves 1000; real Advance returns capped 520 and expected score');
  await drill('sticky-catch');await page.locator('#step-drill').click();await has('#telemetry','held=1');
  const id=(await page.locator('#telemetry').innerText()).match(/ball-data=(\d+):/)[1];
  await page.locator('#launch').click();await page.locator('#pause').click();await has('#telemetry','held=0');await has('#telemetry','ball-data='+id+':');
  await drill('sticky-catch');await page.locator('#step-drill').click();await page.locator('#step-drill').click();await has('#telemetry','ticks=240');await has('#telemetry','held=0');await has('#telemetry','effect=none');assert.deepEqual(ranked(await state()),baseline);
  pass('Sticky manual release and timed expiry keep ball identity and ranked state');
  for(const id of ['score','lives','level','combo','power-name','power-time'])assert(await page.locator('#'+id).isVisible());
  await page.setViewportSize({width:375,height:760});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const sel of ['#game-canvas','#leaderboard','#launch','#pause']){await page.locator(sel).scrollIntoViewIfNeeded();assert(await page.locator(sel).isVisible());}
  await page.screenshot({path:'/results/rubric-mobile.png',fullPage:true});
  pass('Six semantic HUD values and required canvas/control/leaderboard regions exist at 375px');
  assert.deepEqual(errors,[]);
 }finally{fs.writeFileSync('/results/targeted.json',JSON.stringify({passed,errors,scope:'Local golden observations, not an LLM grade'},null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

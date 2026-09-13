const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),passed=[],observations=[];
 const pass=name=>{passed.push(name);console.log('PASS '+name);};
 try{
  await page.goto('http://localhost:3000');await page.locator('#email').fill('polly@brickfall.test');await page.locator('#password').fill('password123');
  const login=page.waitForResponse(r=>r.url().endsWith('/api/login')&&r.status()===200);
  await page.getByRole('button',{name:'Enter arcade',exact:true}).click();const token=(await(await login).json()).token;
  await page.locator('#app-view').waitFor({state:'visible'});
  const saved=async()=>{const r=await context.request.get('http://localhost:3000/api/bootstrap',{headers:{Authorization:'Bearer '+token}});assert.equal(r.status(),200);const s=await r.json();return {user:s.user,revision:s.revision,savedRun:s.savedRun,recentRuns:s.recentRuns,leaderboard:s.leaderboard};};
  const before=await saved();
  const count=async()=>{await page.locator('#telemetry').scrollIntoViewIfNeeded();assert(await page.locator('#telemetry').isVisible());const text=await page.locator('#telemetry').innerText();const m=text.match(/\bticks=(\d+)\b/);assert(m,'Visible counter is required');return Number(m[1]);};
  const load=async id=>{await page.locator('#drill-select').selectOption(id);await page.locator('#load-drill').click();await page.waitForFunction(()=>!document.querySelector('#step-drill').disabled);assert.equal(await count(),0);};
  const advance=async expected=>{await page.locator('#step-drill').click();assert.equal(await count(),expected);};
  await load('brick-types');await advance(120);observations.push({drill:'brick-types',counts:[0,120]});pass('Brick types visibly reports zero then exactly 120 fixed steps');
  await load('power-relay');await advance(120);await page.waitForTimeout(2100);assert.equal(await count(),120);await advance(240);observations.push({drill:'power-relay',counts:[0,120,120,240]});pass('Power relay counter accumulates 120/240 and freezes during real paused time');
  await load('last-ball');await advance(1);assert((await page.locator('#telemetry').innerText()).includes('phase=life-lost'));observations.push({drill:'last-ball',counts:[0,1]});pass('Last ball visibly counts its early stopping step exactly once');
  await load('sticky-catch');await advance(120);await advance(240);observations.push({drill:'sticky-catch',counts:[0,120,240]});pass('Sticky counter reaches 240 for the independently graded expiry check');
  for(const id of ['brick-types','power-relay','multiball','sticky-catch','extra-life','last-ball','final-wall'])await load(id);
  assert.deepEqual(await saved(),before);pass('All seven drill loads reset the practice counter and preserve ranked state');
  await load('power-relay');await advance(240-120);await page.screenshot({path:'/results/visible-step-counter.png'});
 }finally{fs.writeFileSync('/results/step-counter.json',JSON.stringify({passed,observations,scope:'Visible golden counter assertions; no paid judge run'},null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

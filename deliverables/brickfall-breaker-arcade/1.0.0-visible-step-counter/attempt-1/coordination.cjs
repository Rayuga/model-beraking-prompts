const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});const c=await browser.newContext();let a=await c.newPage();const b=await c.newPage(),passed=[];
 const pass=n=>{passed.push(n);console.log('PASS '+n);};
 const login=async(p,user)=>{await p.goto('http://localhost:3000');await p.locator('#email').fill(user+'@brickfall.test');await p.locator('#password').fill('password123');const reply=p.waitForResponse(r=>r.url().endsWith('/api/login'));await p.getByRole('button',{name:'Enter arcade',exact:true}).click();const token=(await(await reply).json()).token;await p.locator('#app-view').waitFor({state:'visible'});return token;};
 const bootstrap=async token=>(await c.request.get('http://localhost:3000/api/bootstrap',{headers:{Authorization:'Bearer '+token}})).json();
 const ranked=s=>({user:s.user,revision:s.revision,savedRun:s.savedRun,recentRuns:s.recentRuns,leaderboard:s.leaderboard});
 const action=async(p,selector,suffix)=>{const pending=p.waitForResponse(r=>r.url().endsWith(suffix)&&['POST','PUT'].includes(r.request().method()));await p.locator(selector).click();return pending;};
 const replay=async reply=>{const q=reply.request();return c.request.fetch(q.url(),{method:q.method(),headers:q.headers(),data:q.postData()});};
 try{
 const dev=await login(a,'dev');assert.equal((await bootstrap(dev)).revision,1);await a.locator('#resume-action').click();assert((await a.locator('#telemetry').innerText()).includes('score=19950'));
 const progressed=await action(a,'#pause','/api/run/progress');assert.equal(progressed.status(),200);const progressBody=await progressed.json();
 await a.waitForFunction(()=>document.querySelector('#telemetry').textContent.includes('score=23050 lives=4 combo=x2 next-life=40000'));
 const progressState=ranked(await bootstrap(dev));assert.equal(progressState.user.bestScore,6200);const repeat=await replay(progressed);assert.equal(repeat.status(),200);assert.deepEqual(await repeat.json(),progressBody);assert.deepEqual(ranked(await bootstrap(dev)),progressState);
 await a.locator('#overlay-action').click();await a.waitForFunction(()=>document.querySelector('#telemetry').textContent.includes('level=4 score=23050'));await a.waitForFunction(()=>document.querySelector('#sync-state').textContent.endsWith('saved'));
 await a.reload();await a.locator('#resume-action').click();assert((await a.locator('#telemetry').innerText()).includes('level=4 score=23050 lives=4'));pass('Dev threshold, level unlock, progress receipt replay and level-4 reload');
 await a.close();a=await c.newPage();
 const ta=await login(a,'polly');const cleared=await action(a,'#new-run','/api/run/clear');assert.equal(cleared.status(),200);const empty=ranked(await bootstrap(ta));assert.equal(empty.savedRun,null);const duplicateClear=await replay(cleared);assert.deepEqual(await duplicateClear.json(),await cleared.json());assert.deepEqual(ranked(await bootstrap(ta)),empty);
 const tb=await login(b,'polly');assert.notEqual(ta,tb);assert(/^[0-9a-f]{64}$/.test(ta)&&/^[0-9a-f]{64}$/.test(tb));
 const start=await action(a,'#start-selected','/api/run/start');const started=ranked(await bootstrap(ta));const duplicateStart=await replay(start);assert.deepEqual(await duplicateStart.json(),await start.json());assert.deepEqual(ranked(await bootstrap(ta)),started);
 const stale=await action(b,'#start-selected','/api/run/start');assert.equal(stale.status(),409);await b.waitForFunction(()=>document.querySelector('#sync-state').textContent.includes('reconciled'));assert.deepEqual(ranked(await bootstrap(ta)),started);
 const newer=await action(b,'#start-selected','/api/run/start');assert.equal(newer.status(),200);const current=ranked(await bootstrap(tb));assert.equal(current.revision,started.revision+1);
 const oldConflict=await replay(stale);assert.equal(oldConflict.status(),409);assert.deepEqual(await oldConflict.json(),await stale.json());assert.deepEqual(ranked(await bootstrap(tb)),current);
 const q=start.request(),changed=JSON.parse(q.postData());changed.level=2;const bad=await c.request.fetch(q.url(),{method:q.method(),headers:q.headers(),data:JSON.stringify(changed)});assert(bad.status()>=400);assert.deepEqual(ranked(await bootstrap(ta)),current);pass('Clear/start idempotency, two-tab 409 reconciliation, old 409 replay and changed-payload rejection');
 await a.reload();await a.locator('#app-view').waitFor({state:'visible'});const beforeLogout=ranked(await bootstrap(ta));await a.locator('#sign-out').click();await a.locator('#login-view').waitFor({state:'visible'});await b.locator('#start-selected').click();await b.locator('#login-view').waitFor({state:'visible'});
 const fresh=await login(b,'polly');assert.deepEqual(ranked(await bootstrap(fresh)),beforeLogout);const own=await bootstrap(dev);assert.equal(own.user.initials,'DVP');assert.equal(own.savedRun.state.level,4);assert.notDeepEqual(own.savedRun,beforeLogout.savedRun);pass('Distinct bearer sessions, account-wide revocation, rejected-write nonmutation and Dev/Polly isolation');
 }finally{fs.writeFileSync('/results/coordination.json',JSON.stringify({passed,scope:'Local real UI plus captured request replay'},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

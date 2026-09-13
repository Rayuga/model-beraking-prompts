const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:800}}),polly=await context.newPage(),dev=await context.newPage(),passed=[],evidence={};
 const pass=n=>{passed.push(n);console.log('PASS '+n);};
 const login=async(p,user)=>{await p.goto('http://localhost:3000');await p.locator('#email').fill(user+'@brickfall.test');await p.locator('#password').fill('password123');const wait=p.waitForResponse(r=>r.url().endsWith('/api/login')&&r.status()===200);await p.getByRole('button',{name:'Enter arcade',exact:true}).click();const token=(await(await wait).json()).token;await p.locator('#app-view').waitFor({state:'visible'});return token;};
 const read=async token=>{const r=await context.request.get('http://localhost:3000/api/bootstrap',{headers:{Authorization:'Bearer '+token}});assert.equal(r.status(),200);const s=await r.json();return {user:s.user,revision:s.revision,savedRun:s.savedRun,recentRuns:s.recentRuns,leaderboard:s.leaderboard};};
 try{
  const pt=await login(polly,'polly'),dt=await login(dev,'dev');const before=await read(pt);
  await polly.locator('#drill-select').selectOption('final-wall');await polly.locator('#load-drill').click();await polly.waitForFunction(()=>!document.querySelector('#step-drill').disabled);
  const initial=await polly.locator('#telemetry').innerText();assert(initial.includes('normal=1 strong=0 damaged=0 solid=1'));
  await polly.locator('#step-drill').click();const completed=await polly.locator('#telemetry').innerText();assert(completed.includes('phase=completed'));assert(completed.includes('normal=0 strong=0 damaged=0 solid=1'));assert(completed.includes('score=15100'));assert.deepEqual(await read(pt),before);evidence.solid={initial,completed};pass('Final wall completes at 15100 while its solid survives and ranked state stays unchanged');
  const readProbe=await context.request.get('http://localhost:3000/api/bootstrap?email=dev%40brickfall.test&initials=DVP',{headers:{Authorization:'Bearer '+pt}});assert.equal(readProbe.status(),200);assert.equal((await readProbe.json()).user.email,'polly@brickfall.test');
  const wait=polly.waitForResponse(r=>r.url().endsWith('/api/run/start')&&r.status()===200);await polly.locator('#start-selected').click();const response=await wait,request=response.request();const pb=await read(pt),db=await read(dt);
  const body={...JSON.parse(request.postData()),expectedRevision:pb.revision,operationId:crypto.randomUUID(),email:'dev@brickfall.test',initials:'DVP'};
  const probe=await context.request.fetch(request.url(),{method:request.method(),headers:request.headers(),data:JSON.stringify(body)});assert.equal(probe.status(),200);const pa=await read(pt);assert.equal(pa.user.email,'polly@brickfall.test');assert.equal(pa.revision,pb.revision+1);assert.notEqual(pa.savedRun.state.runId,pb.savedRun.state.runId);assert.deepEqual(await read(dt),db);
  evidence.identity={readStatus:readProbe.status(),writeStatus:probe.status(),pollyRevisionBefore:pb.revision,pollyRevisionAfter:pa.revision,devUnchanged:true};pass('Forged Dev identity on Polly read and fresh write stays Polly-owned; Dev remains unchanged');
  const devBefore=await read(dt),pollyBefore=await read(pt);assert.equal(devBefore.user.bestScore,6200);assert.equal(devBefore.savedRun.state.level,4);assert.equal(devBefore.savedRun.state.score,23050);
  await dev.locator('#resume-action').click();await dev.locator('#assist').getAttribute('aria-pressed').then(async x=>{if(x==='true')await dev.locator('#assist').click();});
  const finish=dev.waitForResponse(r=>r.url().endsWith('/api/run/finish')&&r.status()===200,{timeout:150000});
  for(let life=0;life<6;life++){
    if((await dev.locator('#telemetry').innerText()).includes('phase=game-over'))break;
    await dev.locator('#game-canvas').focus();await dev.keyboard.down('ArrowRight');await dev.waitForTimeout(850);await dev.keyboard.up('ArrowRight');
    await dev.locator('#launch').click();
    await dev.waitForFunction(()=>/phase=(life-lost|game-over)/.test(document.querySelector('#telemetry').textContent),null,{timeout:45000});
  }
  await finish;const terminal=await read(dt),score=terminal.recentRuns[0].score;assert(score>devBefore.user.bestScore);assert.equal(terminal.user.bestScore,score);assert.equal(terminal.savedRun,null);assert((await dev.locator('#best').innerText()).replace(/,/g,'').includes(String(score)));
  await dev.reload();await dev.locator('#app-view').waitFor({state:'visible'});assert.equal((await read(dt)).user.bestScore,score);assert.equal((await read(pt)).user.bestScore,pollyBefore.user.bestScore);
  evidence.best={before:devBefore.user.bestScore,terminalScore:score,after:terminal.user.bestScore,reload:score};pass('Real Dev terminal run raises best above 6200 and preserves it after reload without changing Polly best');
 }finally{fs.writeFileSync('/results/coverage.json',JSON.stringify({passed,evidence,scope:'Local real-browser coverage; no paid judge'},null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

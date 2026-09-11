const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const results=[];let baseline;
 try{
  for(const dimension of ['render','constraints','functional','polish']){
   const context=await browser.newContext(),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://localhost:3000');assert(await page.locator('#login-view').isVisible());assert(!(await page.locator('#app-view').isVisible()));
   await page.locator('#email').fill('polly@brickfall.test');await page.locator('#password').fill('wrong-pass-47');
   await page.getByRole('button',{name:'Enter arcade',exact:true}).click();await page.locator('#login-error').filter({hasText:'Invalid'}).waitFor();assert(!(await page.locator('#app-view').isVisible()));
   await page.locator('#password').fill('password123');
   const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/bootstrap')&&r.status()===200);
   await page.getByRole('button',{name:'Enter arcade',exact:true}).click();await page.locator('#app-view').waitFor({state:'visible'});
   const response=await responsePromise,data=await response.json();
   assert(response.request().headers().authorization.startsWith('Bearer '));assert(data.user&&data.recentRuns.length);
   const snapshot={user:data.user,savedRun:data.savedRun,revision:data.revision,leaderboard:data.leaderboard,recentRuns:data.recentRuns};
   if(baseline)assert.deepEqual(snapshot,baseline);else baseline=snapshot;
   const denied=await page.evaluate(async url=>{const r=await fetch(url,{credentials:'omit',headers:{}});return {status:r.status,data:await r.json()};},response.url());
   assert.equal(denied.status,401);assert(!denied.data.user&&!denied.data.savedRun&&!denied.data.recentRuns);assert.deepEqual(errors,[]);
   results.push({dimension,passed:true,unauthenticated_status:denied.status,ranked_state_unchanged:true});await context.close();
  }
  fs.writeFileSync('/results/gate-regression.json',JSON.stringify({results},null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

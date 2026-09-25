const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const results = [];
const record = (name, data) => { results.push({name, ...data}); console.log(name, JSON.stringify(data)); };
const base = 'http://localhost:3000';
async function login(page) {
  await page.goto(base);
  await page.getByLabel('Email', {exact:true}).fill('ruth.adebayo@commonground.example');
  await page.getByLabel('Password', {exact:true}).fill('CommonGround!2026');
  await page.getByRole('button', {name:'Sign in', exact:true}).click();
  await page.locator('#app-view').waitFor({state:'visible'});
}
const protectedRead = async (page, cookie) => {
  const response = await page.context().request.get(base+'/api/ballots', cookie ? {headers:{Cookie:cookie}} : {});
  return {status:response.status(), body:await response.json()};
};
const credential = async page => (await page.context().cookies()).filter(c=>c.name==='cg_session').map(c=>c.name+'='+c.value).join('; ');
async function main() {
  const browser = await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  try {
    for (let attempt=1;attempt<=5;attempt++) {
      const a = await (await browser.newContext()).newPage();
      const b = await (await browser.newContext()).newPage();
      a.on('dialog', dialog=>dialog.accept());
      await login(a); await login(b);
      const oldA=await credential(a);
      const normal=a.waitForResponse(r=>r.url().endsWith('/api/auth/logout') && r.request().method()==='POST');
      await a.getByRole('button',{name:'Sign out',exact:true}).click();
      assert.equal((await normal).status(),200);
      assert.equal((await protectedRead(a,oldA)).status,401);
      await b.reload();
      await b.locator('#app-view').waitFor({state:'visible'});
      assert.equal((await protectedRead(b)).status,200);
      await login(a);
      const endedA=await credential(a), endedB=await credential(b);
      assert.notEqual(endedA,endedB);
      const ended=a.waitForResponse(r=>r.url().endsWith('/api/auth/logout-all') && r.request().method()==='POST');
      await a.getByRole('button',{name:'End all sessions',exact:true}).click();
      assert.equal((await ended).status(),200);
      const immediate=[await protectedRead(a),await protectedRead(b)];
      await a.reload(); await b.reload();
      await a.locator('#login-view').waitFor({state:'visible'});
      await b.locator('#login-view').waitFor({state:'visible'});
      const refreshed=[await protectedRead(a),await protectedRead(b)];
      const replayed=[await protectedRead(a,endedA),await protectedRead(b,endedB)];
      for (const result of [...immediate,...refreshed,...replayed]) {
        assert.equal(result.status,401);
        assert(!JSON.stringify(result.body).includes('Courtyard'));
      }
      const identity=await a.context().request.get(base+'/api/me');
      assert.equal(identity.status(),200);
      assert.deepEqual(await identity.json(),{user:null});
      await login(a);
      assert.equal((await protectedRead(a)).status,200);
      record('revocation sequence '+attempt,{passed:true,immediate:immediate.map(r=>r.status),refreshed:refreshed.map(r=>r.status),replayed:replayed.map(r=>r.status),anonymousIdentityStatus:identity.status(),freshLogin:200});
      await a.context().close(); await b.context().close();
    }
    const page=await (await browser.newContext()).newPage();
    page.on('dialog',dialog=>dialog.accept());
    await login(page);
    await page.route('**/api/auth/logout-all',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Session service unavailable. Please retry.'})}));
    await page.getByRole('button',{name:'End all sessions',exact:true}).click();
    await page.waitForTimeout(250);
    const logoutFailure={loginVisible:await page.locator('#login-view').isVisible(),workspaceVisible:await page.locator('#app-view').isVisible(),protectedStatus:(await protectedRead(page)).status,visibleError:await page.getByText('Session service unavailable. Please retry.',{exact:true}).isVisible()};
    record('failed logout feedback',{passed:!logoutFailure.loginVisible && logoutFailure.workspaceVisible && logoutFailure.visibleError,...logoutFailure});
    await page.unroute('**/api/auth/logout-all');
    await page.context().close();
    const rapid=await (await browser.newContext()).newPage();
    await rapid.goto(base);
    await rapid.getByLabel('Email',{exact:true}).fill('ruth.adebayo@commonground.example');
    await rapid.getByLabel('Password',{exact:true}).fill('CommonGround!2026');
    let requests=0;
    await rapid.route('**/api/auth/login',async route=>{requests++;await new Promise(resolve=>setTimeout(resolve,500));await route.continue();});
    await rapid.getByRole('button',{name:'Sign in',exact:true}).dblclick();
    await rapid.locator('#app-view').waitFor({state:'visible'});
    await rapid.waitForTimeout(600);
    record('rapid sign-in submits once',{passed:requests===1,loginRequests:requests});
    fs.writeFileSync('/results/session-results.json',JSON.stringify({results},null,2)+'\n');
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});

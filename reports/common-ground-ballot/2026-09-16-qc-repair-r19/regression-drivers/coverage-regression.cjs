const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const results = [];
async function group(name, run) {
  try { const evidence = await run(); results.push({name, passed:true, evidence}); console.log('PASS', name); }
  catch(e) { results.push({name, passed:false, error:String(e)}); console.log('FAIL', name, String(e)); }
}
async function login(browser, account) {
  const page = await (await browser.newContext({viewport:{width:1280,height:900}})).newPage();
  page.setDefaultTimeout(5000);
  page.reads = new Map();
  page.on('response', response => {
    const path = new URL(response.url()).pathname;
    if (response.request().method() === 'GET' && path.startsWith('/api/')) {
      page.reads.set(path, response.json().then(body => ({status:response.status(),body})).catch(()=>({status:response.status(),body:null})));
    }
  });
  await page.goto('http://localhost:3000');
  await page.getByLabel('Email',{exact:true}).fill(account+'@commonground.example');
  await page.getByLabel('Password',{exact:true}).fill('CommonGround!2026');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#app-view').waitFor({state:'visible'});
  await page.waitForResponse(r=>r.url().endsWith('/api/ballots')).catch(async()=>{
    assert(page.reads.has('/api/ballots'));
  });
  return page;
}
async function view(page, name) {
  const pending = ['members','audit'].includes(name) ? page.waitForResponse(r=>r.url().endsWith('/api/'+name)) : null;
  await page.locator('.nav-item[data-view='+name+']').click();
  if(pending) await pending;
  await page.locator('#view-'+name).waitFor({state:'visible'});
}
async function reload(page) {
  const response = page.waitForResponse(r=>r.url().endsWith('/api/ballots'));
  await page.reload(); await response;
  await page.locator('#app-view').waitFor({state:'visible'});
}
async function read(page,path) { assert(page.reads.has(path),'UI must issue the real read: '+path); const value=await page.reads.get(path); assert.equal(value.status,200); return value.body; }
async function visibleText(locator) { await locator.waitFor({state:'visible'}); const value=await locator.innerText(); assert(value.trim(),'visible text required'); return value; }
async function draft(page,title) {
  await view(page,'ballots');
  await page.getByRole('button',{name:'New ballot',exact:true}).click();
  await page.getByLabel('Ballot title',{exact:true}).fill(title);
  await page.getByLabel('Ballot choice',{exact:true}).nth(0).fill('Yes');
  await page.getByLabel('Ballot choice',{exact:true}).nth(1).fill('No');
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/ballots') && r.request().method()==='POST');
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  assert.equal((await saved).status(),201);
  await page.locator('#ballot-dialog').waitFor({state:'hidden'});
  await reload(page);
}
async function main() {
  const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  try {
    const ruth=await login(browser,'ruth.adebayo');
    await draft(ruth,'Observer review evidence');
    const arun=await login(browser,'arun.das');
    const leila=await login(browser,'leila.ward');
    const control=(await read(ruth,'/api/ballots')).ballots;
    const published=control.find(b=>b.title==='Garden location');
    assert(published && published.status==='published');

    await group('observer_ballot_setup_access',async()=>{
      for(let repeat=0;repeat<2;repeat++) {
        if(repeat)await reload(arun);
        await view(arun,'ballots');
        const actual=(await read(arun,'/api/ballots')).ballots;
        const shape=b=>[b.id,b.title,b.description,b.method,b.choices,b.status];
        assert.deepEqual(actual.map(shape),control.map(shape));
        for(const b of control) {
          const card=arun.locator('[data-ballot-card="'+b.id+'"]');
          assert((await visibleText(card)).includes(b.title));
          for(const choice of b.choices)assert((await card.innerText()).includes(choice.label));
        }
      }
      return {records:control.length,reloaded:true};
    });
    await group('observer_published_results_access',async()=>{
      for(let repeat=0;repeat<2;repeat++) {
        if(repeat)await reload(arun);
        await view(arun,'results');
        const actual=(await read(arun,'/api/ballots')).ballots.find(b=>b.id===published.id);
        assert.deepEqual(actual.results,published.results);
        const panel=arun.locator('#view-results article').filter({has:arun.getByRole('heading',{name:published.title,exact:true})});
        const text=await visibleText(panel);
        for(const row of published.results)assert(text.includes(row.label));
      }
      return {publishedRecord:published.id,reloaded:true};
    });
    await group('observer_members_access',async()=>{
      await view(ruth,'members');
      const expected=(await read(ruth,'/api/members')).members;
      assert.equal(expected.length,2);
      for(let repeat=0;repeat<2;repeat++) {
        if(repeat)await reload(arun);
        await view(arun,'members');
        assert.deepEqual((await read(arun,'/api/members')).members,expected);
        const text=await visibleText(arun.locator('#view-members .member-list'));
        for(const member of expected)assert(text.includes(member.name));
        assert(text.includes('Active')&&text.includes('Paused'));
      }
      return {members:expected.map(m=>m.name),reloaded:true};
    });
    await group('observer_audit_access',async()=>{
      await view(ruth,'audit');
      const expected=(await read(ruth,'/api/audit')).events;
      assert(expected.some(e=>e.details.includes('Observer review evidence')));
      for(let repeat=0;repeat<2;repeat++) {
        if(repeat)await reload(arun);
        await view(arun,'audit');
        assert.deepEqual((await read(arun,'/api/audit')).events,expected);
        const text=await visibleText(arun.locator('#view-audit'));
        assert(text.includes('Observer review evidence')&&text.includes('Ruth Adebayo'));
        assert(await arun.locator('#view-audit time').count()>0);
      }
      return {events:expected.length,reloaded:true};
    });
    await group('status_text_without_color',async()=>{
      const checked=[];
      for(const width of [1280,390])for(const theme of ['light','dark']) {
        await ruth.setViewportSize({width,height:844});
        if(await ruth.locator('html').getAttribute('data-theme')!==theme)await ruth.locator('#theme-button').click();
        await view(ruth,'ballots');
        const states=new Set();
        for(const ballot of control) {
          const text=await visibleText(ruth.locator('[data-ballot-card="'+ballot.id+'"] .status'));
          assert.equal(text.trim().toLowerCase(),ballot.status); states.add(ballot.status);
        }
        assert.equal(states.size,4);
        await view(ruth,'members');
        assert.deepEqual((await ruth.locator('.membership-state').allInnerTexts()).sort(),['Active','Paused']);
        for(const item of await ruth.locator('.membership-state').all())await visibleText(item);
        await view(ruth,'turnout');
        const statuses=await ruth.locator('.participation-state').allInnerTexts();
        assert(statuses.includes('Participated')&&statuses.includes('Pending'));
        for(const item of await ruth.locator('.participation-state').all())await visibleText(item);
        checked.push({width,theme,lifecycleStates:4,membershipStates:2,participationStates:2});
      }
      return checked;
    });
    await group('unavailable_action_guidance',async()=>{
      await ruth.setViewportSize({width:1280,height:900});
      await view(ruth,'ballots');
      const expectations={draft:[/closing and publishing are unavailable/i,/open it/i],open:[/definition is locked/i,/close voting before publishing/i],closed:[/cannot reopen/i,/definition is locked/i],published:[/no further edits or lifecycle actions/i]};
      for(const status of Object.keys(expectations)) {
        const ballot=control.find(b=>b.status===status),card=ruth.locator('[data-ballot-card="'+ballot.id+'"]');
        const guidance=card.locator('.action-guidance,.locked-note');
        const text=await visibleText(guidance);
        for(const pattern of expectations[status])assert.match(text,pattern);
        const allowed={draft:['open'],open:['close'],closed:['publish'],published:[]}[status];
        assert.deepEqual(await card.locator('[data-ballot-action]').evaluateAll(buttons=>buttons.filter(b=>!b.disabled).map(b=>b.dataset.ballotAction)),allowed);
      }
      await view(arun,'ballots');
      assert.match(await visibleText(arun.locator('#ballots-subtitle')),/without changing/i);
      await view(leila,'vote');
      const complete=leila.locator('.vote-panel').filter({has:leila.locator('.participated')}).first();
      assert.match(await visibleText(complete),/Participation recorded/i);
      assert.equal(await complete.locator('[data-vote-id]').count(),0);
      await view(ruth,'ballots');
      await ruth.screenshot({path:'/results/lifecycle-guidance-desktop.png',fullPage:true});
      await ruth.setViewportSize({width:390,height:844});
      assert(await ruth.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await ruth.screenshot({path:'/results/lifecycle-guidance-mobile.png',fullPage:true});
      return {lifecycleStates:4,observerReadOnly:true,memberAlreadyParticipated:true};
    });
  } finally { await browser.close(); }
  fs.writeFileSync('/results/coverage-results.json',JSON.stringify({results},null,2)+'\n');
  if(results.some(r=>!r.passed))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});

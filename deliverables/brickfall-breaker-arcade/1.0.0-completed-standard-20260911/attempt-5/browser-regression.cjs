const fs = require('node:fs');
const assert = require('node:assert/strict');
let chromium;
try { ({chromium} = require('playwright')); }
catch { ({chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright')); }
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
  const context = await browser.newContext({viewport:{width:1280,height:900}});
  const page = await context.newPage();
  const errors=[], requests=[], passed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  const pass = name => {passed.push(name); console.log('PASS '+name);};
  const text = id => page.locator(id).innerText();
  const has = async (id,value) => assert((await text(id)).includes(value),`${id} expected ${value}; got ${await text(id)}`);
  const login = async user => {
    await page.locator('#email').fill(user+'@brickfall.test');
    await page.locator('#password').fill('password123');
    await page.getByRole('button',{name:'Enter arcade',exact:true}).click();
    await page.locator('#app-view').waitFor({state:'visible'});
  };
  try {
    await page.goto('http://localhost:3000/');
    await page.locator('#email').fill('mira@brickfall.test');
    await page.locator('#password').fill('wrong-pass-47');
    await page.getByRole('button',{name:'Enter arcade',exact:true}).click();
    await page.locator('#login-error').filter({hasText:'Invalid'}).waitFor();
    await login('mira');
    await has('#player-name','Mira Chen');
    assert.equal(await page.locator('#seed-manifest li').count(),10);
    assert.equal(await page.locator('#leaderboard tr').count(),10);
    await has('#leaderboard','42,000');
    await has('#sync-state','Revision 1');
    pass('wrong-password rejection, real sign-in, ten levels and seeded leaderboard');
    await page.locator('#resume-action').click();
    const checkpoint = await text('#telemetry');
    assert(checkpoint.includes('score=24500 lives=1 combo=x4'));
    assert(checkpoint.includes('effect=wide 13s'));
    await page.waitForTimeout(2100);
    assert.equal(await text('#telemetry'),checkpoint);
    await page.reload();
    await page.locator('#resume-action').click();
    assert.equal(await text('#telemetry'),checkpoint);
    pass('Mira exact checkpoint freezes and survives reload');
    await page.locator('#sign-out').click();
    await page.locator('#login-view').waitFor({state:'visible'});
    await login('polly');
    assert.equal(await page.locator('#run-history li').count(),10);
    await page.locator('#run-history button').first().click();
    await page.locator('#run-dialog').waitFor({state:'visible'});
    await has('#run-dialog-state','score=5900');
    await page.locator('#close-run-dialog').click();
    pass('Polly latest-ten history and exact terminal snapshot');
    const beforeSync=await text('#sync-state'), beforeBoard=await text('#leaderboard');
    const cases=[
      ['brick-types',['ticks=120','score=1400','normal=0 strong=0 damaged=1 solid=1']],
      ['power-relay',['ticks=120','drops=0','effect=sticky 20s']],
      ['multiball',['ticks=120','balls=1','lives=3','effect=multiball 9s']],
      ['sticky-catch',['ticks=120','held=1','effect=sticky 1s']],
      ['extra-life',['score=20050 lives=4 combo=x2 next-life=40000','normal=1']],
      ['last-ball',['phase=life-lost','lives=1','ticks=1','drops=0','effect=none']],
      ['final-wall',['phase=completed','score=15100','normal=0']]
    ];
    for (const [drill,expected] of cases) {
      await page.locator('#drill-select').selectOption(drill);
      await page.locator('#load-drill').click();
      await page.locator('#step-drill').waitFor({state:'visible'});
      await page.waitForFunction(()=>!document.querySelector('#step-drill').disabled);
      await page.locator('#step-drill').click();
      for(const value of expected) await has('#telemetry',value);
      if(drill==='power-relay') {
        const paused=await text('#telemetry'); await page.waitForTimeout(1100);
        assert.equal(await text('#telemetry'),paused);
        await page.locator('#step-drill').click(); await has('#telemetry','effect=sticky 19s');
      }
      if(drill==='sticky-catch') {
        await page.locator('#step-drill').click();
        await has('#telemetry','effect=none'); await has('#telemetry','held=0');
      }
      assert.equal((await text('#sync-state')).match(/Revision \d+/)[0],beforeSync.match(/Revision \d+/)[0]);
      assert.equal(await text('#leaderboard'),beforeBoard);
      pass('real-engine drill '+drill+' with ranked-state nonmutation');
    }
    const pending = page.waitForResponse(r=>r.url().endsWith('/api/run/start') && r.request().method()==='POST');
    await page.locator('#start-selected').click();
    const response=await pending, req=response.request(), responseBody=await response.json();
    assert.equal(response.status(),200);
    const replay=await context.request.fetch(req.url(),{method:req.method(),headers:req.headers(),data:req.postData()});
    assert.deepEqual(await replay.json(),responseBody);
    assert.equal(replay.status(),200);
    const changed=JSON.parse(req.postData()); changed.level=2;
    const rejected=await context.request.fetch(req.url(),{method:req.method(),headers:req.headers(),data:JSON.stringify(changed)});
    assert(rejected.status()>=400 && rejected.status()<500);
    await page.reload(); await page.locator('#resume-action').click();
    await has('#telemetry','score=0 lives=3');
    await has('#telemetry','revision='+responseBody.revision);
    pass('captured start replay, changed-payload rejection and ranked reload');
    await page.setViewportSize({width:375,height:760});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    await page.screenshot({path:'/results/brickfall-mobile.png',fullPage:true});
    await context.request.get('http://localhost:3000/api/health');
    assert(requests.every(url=>new URL(url).origin==='http://localhost:3000'));
    assert.deepEqual(errors,[]);
    pass('375px layout, same-origin resources and no fatal browser errors');
    fs.writeFileSync('/results/browser-regression.json',JSON.stringify({scope:'Golden-specific local browser regressions, not an Oracle score',passed,errors},null,2)+'\n');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});

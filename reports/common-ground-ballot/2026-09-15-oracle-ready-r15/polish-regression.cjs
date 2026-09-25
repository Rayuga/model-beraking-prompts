const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const results=[];
async function group(name,fn) {
  try {const evidence=await fn();results.push({name,passed:true,evidence});console.log('PASS',name);}
  catch(error){results.push({name,passed:false,error:String(error)});console.log('FAIL',name,String(error));}
}
async function main() {
  const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await (await browser.newContext({viewport:{width:390,height:844},hasTouch:true})).newPage();
    await page.goto('http://localhost:3000');
    await page.getByLabel('Email',{exact:true}).fill('ruth.adebayo@commonground.example');
    await page.getByLabel('Password',{exact:true}).fill('CommonGround!2026');
    await page.getByRole('button',{name:'Sign in',exact:true}).tap();
    await page.locator('#app-view').waitFor({state:'visible'});
    const roster=page.waitForResponse(r=>r.url().endsWith('/api/members')&&r.request().method()==='GET');
    await page.locator('.nav-item[data-view=members]').tap();
    assert.equal((await roster).status(),200);
    await page.locator('#view-members').waitFor({state:'visible'});
    await page.locator('#view-members').getByText('Owen Park',{exact:true}).waitFor();
    await group('theme_switch_preserves_workspace',async()=>{
      const before=await page.locator('#view-members').innerText();
      await page.getByRole('button',{name:'Switch to dark theme'}).tap();
      assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
      assert.equal(await page.locator('#view-members').innerText(),before);
      await page.getByRole('button',{name:'Switch to light theme'}).tap();
      assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
      assert.equal(await page.locator('#view-members').innerText(),before);
      return {bothDirections:true,preservedView:'members'};
    });
    await group('comfortable_touch_targets',async()=>{
      for(const view of ['ballots','vote','turnout','results','members','audit']) {
        await page.locator(`.nav-item[data-view=${view}]`).tap();
        await page.locator(`#view-${view}`).waitFor({state:'visible'});
        assert.equal(await page.locator('.nav-item.active').getAttribute('data-view'),view);
      }
      await page.locator('.nav-item[data-view=ballots]').tap();
      await page.getByRole('button',{name:'New ballot',exact:true}).tap();
      await page.locator('#ballot-dialog').waitFor({state:'visible'});
      await page.locator('#ballot-dialog').getByRole('button',{name:'Cancel',exact:true}).tap();
      await page.locator('#ballot-dialog').waitFor({state:'hidden'});
      return {touchInput:true,navigationTargets:6,dialogOpenedAndClosed:true};
    });
    await group('reduced_motion_preference',async()=>{
      const durations=()=>page.locator('.nav-item').first().evaluate(el=>{
        const style=getComputedStyle(el),seconds=value=>value.split(',').map(v=>parseFloat(v)*(v.trim().endsWith('ms')?.001:1));
        return {transition:Math.max(...seconds(style.transitionDuration)),animation:Math.max(...seconds(style.animationDuration)),scroll:getComputedStyle(document.documentElement).scrollBehavior};
      });
      await page.emulateMedia({reducedMotion:'no-preference'});const normal=await durations();
      await page.emulateMedia({reducedMotion:'reduce'});const reduced=await durations();
      assert(reduced.transition<=normal.transition*.1 && reduced.animation<=Math.max(normal.animation*.1,.001),JSON.stringify({normal,reduced}));
      await page.locator('.nav-item[data-view=members]').tap();
      await page.locator('#view-members').waitFor({state:'visible'});
      await page.locator('.nav-item[data-view=ballots]').tap();
      await page.getByRole('button',{name:'New ballot',exact:true}).tap();
      await page.locator('#ballot-dialog').getByRole('button',{name:'Cancel',exact:true}).tap();
      return {normal,reduced,controlsRemainUsable:true};
    });
  } finally {await browser.close();}
  fs.writeFileSync('/results/polish-results.json',JSON.stringify({results},null,2)+'\n');
  if(results.some(r=>!r.passed))process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});

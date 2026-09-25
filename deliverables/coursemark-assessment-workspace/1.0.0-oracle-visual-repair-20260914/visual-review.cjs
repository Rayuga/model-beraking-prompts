const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const out='/evidence/visual-review',shots=[];
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 async function shot(p,name){await p.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));await p.screenshot({path:out+'/'+name+'.png',fullPage:false,animations:'disabled'});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));shots.push(name);}
 async function login(p,who){await p.goto('http://127.0.0.1:3000');await p.locator('#login-email').fill(who+'@coursemark.example');await p.locator('#login-password').fill('Coursemark!2026');await p.locator('#login-form button[type=submit]').click();await p.locator('#app-view').waitFor({state:'visible'});await p.waitForFunction(()=>document.querySelector('#courses-list').children.length>0);}
 for(const [size,width,height] of [['desktop',1280,800],['mobile',375,812]]){
  const p=await browser.newPage({viewport:{width,height}});await p.goto('http://127.0.0.1:3000');await shot(p,size+'-signin');await login(p,'ada.mensah');
  for(const view of ['courses','assessments','attempts','gradebook','audit']){await p.locator('.tab[data-view='+view+']').click();await p.locator('.tab[data-view='+view+'][aria-current=page]').waitFor();await shot(p,size+'-'+view);}
  await p.locator('.tab[data-view=assessments]').click();
  for(const [selector,id,name] of [['#new-assessment','assessment-dialog','create'],['[data-add-item="A-02"]','item-dialog','question'],['[data-review-items="A-01"]','items-dialog','details']]){await p.locator(selector).click();await p.locator('#'+id).waitFor({state:'visible'});await shot(p,size+'-'+name);await p.keyboard.press('Escape');await p.locator('#'+id).waitFor({state:'hidden'});}
  await p.locator('.tab[data-view=gradebook]').click();await p.locator('[data-grade="AT-101"]').click();await p.locator('#grade-dialog').waitFor({state:'visible'});await shot(p,size+'-grading');await p.keyboard.press('Escape');
  await p.locator('[data-worksheet="AT-101"]').click();await p.locator('#worksheet-dialog').waitFor({state:'visible'});await shot(p,size+'-worksheet');await p.keyboard.press('Escape');
  await p.locator('#open-outcomes').click();await p.locator('#outcome-dialog').waitFor({state:'visible'});await shot(p,size+'-outcomes');
  for(const [selector,id,name] of [['#edit-weights','weight-dialog','weights'],['#edit-exception','exception-dialog','exception']]){await p.locator(selector).click();await p.locator('#'+id).waitFor({state:'visible'});await shot(p,size+'-'+name);await p.keyboard.press('Escape');await p.locator('#'+id).waitFor({state:'hidden'});}
  await p.keyboard.press('Escape');await p.locator('#open-release-batch').click();await p.locator('[data-release-choice="AT-103"]').check();await p.locator('#preview-release').click();await p.locator('.release-review').waitFor({state:'visible'});await shot(p,size+'-release-preview');await p.close();
  const q=await browser.newPage({viewport:{width,height}});await login(q,'nora.kim');await q.locator('.tab[data-view=assessments]').click();await shot(q,size+'-student');await q.locator('#assessments-list [data-open-attempt="AT-100"]').click();await q.locator('#attempt-dialog').waitFor({state:'visible'});await shot(q,size+'-attempt');await q.close();
 }
 await browser.close();fs.writeFileSync(out+'/index.json',JSON.stringify({kind:'Rendered golden surfaces for visual review, not judge scores',screenshots:shots},null,2));console.log('PASS screenshots and viewport overflow checks: '+shots.length);
})().catch(e=>{console.error(e);process.exit(1)});

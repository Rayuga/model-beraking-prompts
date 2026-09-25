const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
let browser;const results=[];
async function main(){
 browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3000');await page.locator('#password').fill('password123');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.locator('#board .cand').first().waitFor();
 const snapshot=()=>page.evaluate(async()=>{const headers={Authorization:'Bearer '+localStorage.getItem('pellmoor_session_v2')};const r=await fetch('/api/roles/ROLE-014',{headers});return r.json();});
 const before=await snapshot();
 for(const width of [1280,390,320])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:width===1280?800:844});
  if((await page.locator('html').getAttribute('data-theme')||'light')!==theme)await page.locator('#theme').click();
  await page.locator('#batch-open').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'batch-close');
  await page.keyboard.press('Shift+Tab');assert(await page.locator('#batch-dialog').evaluate(e=>e.contains(document.activeElement)));
  await page.screenshot({path:`/evidence/batch-selection-${width}-${theme}.png`});
  const choice=page.locator('[data-batch-id="CAND-101"]');await choice.focus();await page.keyboard.press('Space');assert(await choice.isChecked());
  await page.locator('#batch-review').focus();await page.keyboard.press('Enter');await page.locator('#batch-confirm').waitFor();
  assert(await page.locator('#batch-confirm').isDisabled());assert.match(await page.locator('.batch-warning').textContent(),/score/);
  assert(await page.locator('#batch-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#batch-edit').scrollIntoViewIfNeeded();await page.screenshot({path:`/evidence/batch-blocked-${width}-${theme}.png`});
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'batch-open');
  await page.locator('#batch-open').click();await page.locator('#batch-edit').click();await page.locator('[data-batch-id="CAND-101"]').uncheck();await page.keyboard.press('Escape');
  assert.deepEqual(await snapshot(),before);results.push({width,theme,keyboard_selection_and_dismissal:true,blocked_confirmation:true,read_only:true,no_overflow:true});
 }
 assert.deepEqual(errors,[]);
}
main().catch(e=>{results.push({error:e.stack});process.exitCode=1;console.error(e);}).finally(async()=>{fs.writeFileSync('/evidence/batch-presentation.json',JSON.stringify({scope:'Read-only selection and blocked-review presentation on fresh seed; no judge scores',results},null,2));if(browser)await browser.close();});

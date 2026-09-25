const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const results=[];
let browser;
async function main(){
 browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const bounds=async(selector)=>page.locator(selector).evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent.trim().slice(0,60),x:r.x,y:r.y,width:r.width,height:r.height,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};}));
 const login=async(account)=>{
  await page.goto('http://localhost:3000');
  if(await page.locator('#app').isVisible())await page.locator('#signout').click();
  await page.locator('#email').fill(account+'@pellmoor.test');await page.locator('#password').fill('password123');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#board .cand').first().waitFor();await page.waitForFunction(()=>document.body.dataset.busy==='false');
 };
 for(const width of [1280,390,320]){
  await page.setViewportSize({width,height:width===1280?800:844});
  await login('hiring');
  for(const theme of ['light','dark']){
   if(await page.locator('html').getAttribute('data-theme')!==theme && !(theme==='light' && !await page.locator('html').getAttribute('data-theme'))) await page.locator('#theme').click();
   const nav=await bounds('#roles');const cards=await bounds('#roles button');
   assert.equal(cards.length,4);assert(nav[0].scrollWidth<=nav[0].clientWidth+1,'Vacancy navigation overflows');
   for(const card of cards){assert(card.width>0&&card.height>=44);assert(card.x>=0&&card.x+card.width<=width+1);assert(card.scrollWidth<=card.clientWidth+1);}
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflow');
   const glyphs=await page.locator('#funnel svg text').evaluateAll(es=>es.map(e=>{const b=e.getBBox();return {text:e.textContent,x:b.x,end:b.x+b.width,width:e.ownerSVGElement.viewBox.baseVal.width};}));
   for(const glyph of glyphs)assert(glyph.x>=-0.5&&glyph.end<=glyph.width+0.5,`Clipped funnel text: ${JSON.stringify(glyph)}`);
   assert.equal(await page.locator('#toast').evaluate(e=>e.classList.contains('show')),false,'Stale sign-out feedback after successful login');
   if(width!==320)await page.screenshot({path:`/evidence/golden-${width}-${theme}-workspace.png`,fullPage:true});
   for(const id of ['CAND-101','CAND-102','CAND-103']){
    await page.locator(`.cand[data-id="${id}"]`).click();await page.locator('#close').waitFor();
    const buttons=await bounds('.moves button');
    for(const b of buttons){assert(b.height>=44);assert(b.scrollWidth<=b.clientWidth+1);assert(b.x>=0&&b.x+b.width<=width+1);}
    if(buttons.length===4){assert.equal(buttons[0].y,buttons[1].y);assert.equal(buttons[2].y,buttons[3].y);assert.equal(buttons[0].width,buttons[1].width);}
    assert(await page.locator('#panel').evaluate(e=>e.scrollWidth<=e.clientWidth),'Drawer overflow');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'close');
    if(id==='CAND-101'&&width!==320)await page.screenshot({path:`/evidence/golden-${width}-${theme}-drawer.png`});
    await page.keyboard.press('Escape');assert.equal(await page.locator('#panel').textContent(),'');
   }
   results.push({viewport:width,theme,vacancy_cards:cards,uniform_action_grid:true,page_and_drawer_no_overflow:true,funnel_text_within_svg:true,stale_signout_feedback_cleared:true});
  }
  await login('coord');
  await page.locator('.cand[data-id="CAND-101"]').click();await page.locator('#close').waitFor();
  await page.locator('.remove-member').first().scrollIntoViewIfNeeded();
  const removals=await bounds('.remove-member');assert.equal(removals.length,2);
  for(const b of removals){assert(b.height>=44);assert(b.x>=0&&b.x+b.width<=width+1);}
  assert(await page.locator('#panel').evaluate(e=>e.scrollWidth<=e.clientWidth));
  if(width!==320)await page.screenshot({path:`/evidence/golden-${width}-panel-controls.png`});
  await page.keyboard.press('Escape');
 }
 assert.deepEqual(errors,[]);
 await page.setViewportSize({width:390,height:844});await page.locator('#signout').click();
 await page.screenshot({path:'/evidence/golden-390-signin.png'});
 console.log('PASS golden layout: three widths, both themes, four vacancies, manager actions and coordinator controls');
}
main().catch(e=>{results.push({error:e.stack});process.exitCode=1;console.error(e);}).finally(async()=>{fs.writeFileSync('/evidence/visual-regressions.json',JSON.stringify({scope:'Local geometry and interaction checks, not a Visual judge score',results},null,2));if(browser)await browser.close();});
